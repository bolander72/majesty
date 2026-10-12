// Stopped native saves through destination discovery and terrain streaming.
// This is terminal-only; no browser storage inspection or game execution.
import assert from 'node:assert/strict';
import {lstat,mkdtemp,mkdir,copyFile,writeFile,readFile,opendir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {NativeRealmCatalog} from '../web/world/realm-catalog.mjs';
import {opfsNativeRealmStorage} from '../web/world/realm-profile.mjs';
import {savedAtlasStore,paintNativeAtlas,NATIVE_ATLAS_CELL} from '../web/world/native-atlas.mjs';
import {NativeTerrainScene} from '../web/world/terrain-scene.mjs';
import {realmTerrainProvider} from '../web/world/realm-terrain.mjs';

const root=resolve(import.meta.dirname,'..'),output=join(root,'output'),build=join(root,'upstream/majesty-recomp/build');
const report=join(output,'native-realm-catalog-001-observed.json');await assert.rejects(lstat(report),{code:'ENOENT'});
async function describe(filename){
  const stat=await lstat(filename,{bigint:true}),hash=createHash('sha256');
  for await(const bytes of createReadStream(filename,{highWaterMark:4096}))hash.update(bytes);
  return {filename,size:Number(stat.size),inode:String(stat.ino),mtimeNs:String(stat.mtimeNs),sha256:hash.digest('hex')};
}
const input=join(build,'actor-arrival-fixture-entity-revision-export-iIyAMK');
const expected=[['0_0','Source.GMP','a4e87de15b4fdd02046cc7878532b9b94ce0ed0b577766fe29933363559c9919'],
  ['1_0','Destination.GMP','9dc5e6b964bf3c6ed43f781aec890635fce2869f35d252c9bd462ac3c32a154c']];
const originals=[];for(const [key,name,hash]of expected){const record=await describe(join(input,name));assert.equal(record.sha256,hash);originals.push({key,...record});}
const wasm=join(build,'web-site/majesty/MajestyRecomp.wasm');
const wasmStat=async()=>{const s=await lstat(wasm,{bigint:true});return {size:String(s.size),inode:String(s.ino),mtimeNs:String(s.mtimeNs)};};
const wasmBefore=await wasmStat(),owned=await mkdtemp(join(build,'actor-arrival-fixture-realm-catalog-'));
const world='stopped-world',content='owned-stopped-catalog-content';
for(const record of originals){
  const directory=join(owned,'native-world-'+world,'frontier_'+record.key),saves=join(directory,'Documents/My Games/MajestyHD/SaveGame');
  await mkdir(saves,{recursive:true});await copyFile(record.filename,join(saves,'Frontier_'+record.key+'.GMP'));
  await writeFile(join(directory,'Frontier_'+record.key+'.checkpoint'),`checkpoint-v1\n0\n${record.size}\n${record.sha256}\n${content}\n`,{flag:'wx'});
}
let held=false,phase='catalog',catalogBodyReads=0,cursors=0,peakCursors=0,largestRead=0;
const calls=[];const locks={async request(name,options,consume){assert.equal(name,'majesty-pair-native-world-'+world);
  assert.equal(options.mode,'shared');assert.equal(options.ifAvailable,true);assert.equal(held,false);held=true;
  try{return await consume({});}finally{held=false;}}};
function missing(error){if(error.code==='ENOENT')error.name='NotFoundError';return error;}
function directory(path){return {kind:'directory',
  async getDirectoryHandle(name,options){assert.ok(held);assert.equal(options,undefined);assert.match(name,/^[a-zA-Z0-9 _-]+$/);
    const selected=join(path,name);try{assert.ok((await lstat(selected)).isDirectory());}catch(error){throw missing(error);}return directory(selected);},
  entries(){return (async function*(){
    const iterator=await opendir(path);++cursors;peakCursors=Math.max(peakCursors,cursors);
    try{for await(const entry of iterator){assert.ok(held);yield [entry.name,{kind:entry.isDirectory()?'directory':'file'}];}}
    finally{--cursors;}
  })();},
  async getFileHandle(name,options){assert.ok(held);assert.equal(options,undefined);assert.match(name,/^[a-zA-Z0-9_.-]+$/);
    const selected=join(path,name);try{assert.ok((await lstat(selected)).isFile());}catch(error){throw missing(error);}
    return {async getFile(){const source=await stoppedFileSource(selected);return {size:source.size,slice(at,end){return {async arrayBuffer(){
      assert.ok(held);largestRead=Math.max(largestRead,end-at);if(phase==='catalog'&&name.endsWith('.GMP'))++catalogBodyReads;
      calls.push({phase,file:name,bytes:end-at});const bytes=await source.readAt(at,end-at);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length);
    }};}};}};
  },
};}
const profiles=directory(owned),catalog=new NativeRealmCatalog(profiles,world,{locks}),page=await catalog.page();
assert.equal(page.done,true);assert.equal(page.items.length,2);assert.equal(catalogBodyReads,0);assert.equal(cursors,0);assert.equal(peakCursors,1);
assert.deepEqual(page.items.map(x=>x.key).sort(),['0_0','1_0']);
for(const item of page.items){assert.equal(item.state,'saved');assert.equal(item.sha256,originals.find(x=>x.key===item.key).sha256);}
await catalog.reset();assert.equal((await catalog.page()).items.length,2);assert.equal(cursors,0);
phase='terrain';const scene=new NativeTerrainScene(realmTerrainProvider(savedAtlasStore(opfsNativeRealmStorage(profiles,world,locks)),{includeUnits:true}));
const visits=[];for(const [x,y]of [[0,0],[1,0],[100000,-100000],[0,0]]){
  const center={x:x*128+64,y:y*128+64};await scene.move(center.x,center.y,128,128);
  let rectangles=0;const ctx={fillRect(){++rectangles;},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){}};
  const painted=paintNativeAtlas(ctx,scene,{x:center.x*NATIVE_ATLAS_CELL,y:center.y*NATIVE_ATLAS_CELL},512,512);
  const represented=[...new Set([...scene.active.values()].filter(Boolean).map(w=>w.realmKey))];
  if(x===100000)assert.equal(represented.length,0);else assert.ok(represented.includes(`${x}_${y}`));
  assert.ok(scene.active.size<=49);assert.ok(scene.residentHighWater<=98);
  visits.push({requested:`${x}_${y}`,represented,activeWindows:scene.active.size,activeBytes:scene.activeBytes,rectangles,...painted});
}
const bounds={activeWindows:scene.activeHighWater,residentWindows:scene.residentHighWater,residentBytes:scene.residentBytesHighWater};await scene.close();
assert.equal(scene.residentWindows,0);assert.equal(scene.activeBytes,0);assert.ok(largestRead<=4096);
for(const record of originals){const {key,...before}=record;assert.deepEqual(await describe(record.filename),before);}
assert.deepEqual(await wasmStat(),wasmBefore);
const files=['web/world/realm-catalog.mjs','web/world/realm-catalog-controls.mjs','web/world/view.mjs','web/world/index.html',
  'web/world/native-atlas.mjs','web/world/realm-store.mjs','web/world/realm-profile.mjs','web/world/realm-terrain.mjs','web/world/terrain-scene.mjs',
  'tests/realm-catalog.test.mjs','tests/native-atlas.test.mjs','scripts/qualify-native-realm-catalog.mjs'];
const sources=[];for(const filename of files){const selected=join(owned,filename.replaceAll('/','__'));await copyFile(join(root,filename),selected);
  sources.push({source:filename,...await describe(selected)});}
const tests=join(output,'native-realm-catalog-001-qualified-tests.log'),log=await readFile(tests,'utf8');assert.match(log,/fail 0/);assert.match(log,/pass \d+/);
const observed={version:1,result:'pass',scope:'Stopped original saves through destination metadata discovery and read-only atlas rendering; no browser/native game execution',
  originals,fixture:owned,catalog:{page,bodyReads:catalogBodyReads,peakCursors,cursors},visits,bounds,largestRead,
  metadataReads:calls.filter(x=>x.phase==='catalog').length,originalsUnchanged:true,wasmBefore,wasmAfter:await wasmStat(),
  sources,tests:await describe(tests),limits:['Fixture content identity is test-only','No browser OPFS/DOM execution or native gameplay',
    'Directory pagination is best-effort between leases; refresh after collection changes','No seamless/actor/co-op region handoff or sustained browser memory qualification']};
await writeFile(report,JSON.stringify(observed,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({result:'pass',report,destinations:page.items.length,catalogBodyReads,bounds,largestRead})+'\n');
