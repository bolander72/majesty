// Terminal-only byte/storage qualification. Does not start or inspect a game.
import assert from 'node:assert/strict';
import {open,lstat,mkdir,mkdtemp,rename,unlink,readFile,writeFile,copyFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {NativeRealmStore} from '../web/world/realm-store.mjs';
import {opfsNativeRealmStorage} from '../web/world/realm-profile.mjs';
import {savedAtlasStore} from '../web/world/native-atlas.mjs';
import {exportNativeRegion,inspectNativeRegionBackup,restoreNativeRegionBackup} from '../web/world/region-backup.mjs';

const root=resolve(import.meta.dirname,'..'),output=join(root,'output'),build=join(root,'upstream/majesty-recomp/build');
const report=join(output,'native-region-backup-001-observed.json');
await assert.rejects(lstat(report),{code:'ENOENT'});
const input=join(build,'actor-arrival-fixture-entity-revision-export-iIyAMK/Source.GMP');
const expected='a4e87de15b4fdd02046cc7878532b9b94ce0ed0b577766fe29933363559c9919';
async function describe(filename){
  const info=await lstat(filename,{bigint:true}),hash=createHash('sha256');
  for await(const page of createReadStream(filename,{highWaterMark:4096}))hash.update(page);
  return {filename,size:Number(info.size),inode:String(info.ino),mtimeNs:String(info.mtimeNs),sha256:hash.digest('hex')};
}
const original=await describe(input);assert.equal(original.sha256,expected);assert.equal(original.size,336981);
const wasm=join(build,'web-site/majesty/MajestyRecomp.wasm');
const wasmStat=async()=>{const s=await lstat(wasm,{bigint:true});return {size:String(s.size),inode:String(s.ino),mtimeNs:String(s.mtimeNs)};};
const wasmBefore=await wasmStat(),owned=await mkdtemp(join(build,'actor-arrival-fixture-region-backup-'));
let largestRead=0,largestWrite=0,held=false;const locks={async request(_name,options,consume){
  assert.equal(options.ifAvailable,true);assert.equal(held,false);held=true;try{return await consume({});}finally{held=false;}}};
function directory(path){return {
  async getDirectoryHandle(name,{create=false}={}){
    assert.match(name,/^[a-zA-Z0-9 _-]+$/);const next=join(path,name);
    if(create)await mkdir(next,{recursive:false}).catch(e=>{if(e.code!=='EEXIST')throw e;});
    try{assert.ok((await lstat(next)).isDirectory());}catch(e){if(e.code==='ENOENT')e.name='NotFoundError';throw e;}
    return directory(next);
  },
  async getFileHandle(name,{create=false}={}){
    assert.match(name,/^[a-zA-Z0-9_.-]+$/);const next=join(path,name);
    if(create){const handle=await open(next,'a');await handle.close();}
    try{assert.ok((await lstat(next)).isFile());}catch(e){if(e.code==='ENOENT')e.name='NotFoundError';throw e;}
    return {async getFile(){const source=await stoppedFileSource(next);return {size:source.size,slice(at,end){return {async arrayBuffer(){
      largestRead=Math.max(largestRead,end-at);const value=await source.readAt(at,end-at);return value.buffer.slice(value.byteOffset,value.byteOffset+value.length);
    }};}};},async createWritable(){
      const staging=next+'.writing',handle=await open(staging,'wx');let closed=false;
      return {async write(bytes){largestWrite=Math.max(largestWrite,bytes.length);await handle.write(bytes);},
        async close(){await handle.close();closed=true;await rename(staging,next);},
        async abort(){if(!closed)await handle.close();await unlink(staging).catch(e=>{if(e.code!=='ENOENT')throw e;});}};
    }};
  },
};}
const profiles=directory(owned),content='owned-stopped-byte-roundtrip';
const source=await stoppedFileSource(input),homeIO=opfsNativeRealmStorage(profiles,'source-world',locks);
await new NativeRealmStore(homeIO,{content}).commit('0_0',{source,sha256:expected,expectedManifest:null});
const archive=join(owned,'source-world-0_0.majesty-region'),handle=await open(archive,'wx');
let exported;
try{exported=await exportNativeRegion(savedAtlasStore(homeIO),'0_0',{async write(bytes){largestWrite=Math.max(largestWrite,bytes.length);await handle.write(bytes);}},{world:'source-world'});}
finally{await handle.close();}
const archiveSource=await stoppedFileSource(archive),checked=await inspectNativeRegionBackup(archiveSource);
assert.equal(checked.metadata.sha256,expected);assert.equal(checked.metadata.content,content);
const restored=await restoreNativeRegionBackup(profiles,'restored-world',archiveSource,{locks});
assert.equal(restored.region,'0_0');assert.equal(restored.record.sha256,expected);
const restoredFile=join(owned,'native-world-restored-world/frontier_0_0/Documents/My Games/MajestyHD/SaveGame/Frontier_0_0.GMP');
const described=await describe(restoredFile);assert.equal(described.sha256,expected);assert.equal(described.size,original.size);
await assert.rejects(restoreNativeRegionBackup(profiles,'restored-world',archiveSource,{locks}),/already exists/);
assert.deepEqual(await describe(restoredFile),described);
assert.deepEqual(await describe(input),original);assert.deepEqual(await wasmStat(),wasmBefore);
assert.ok(largestRead<=4096);assert.ok(largestWrite<=4096);
// Capture the sources and already-passing focused test log without overwriting
// earlier evidence. Bytes of the independent fixture are not distributable assets.
const files=['web/world/region-backup.mjs','web/world/region-backup-controls.mjs','web/world/view.mjs','web/world/index.html',
  'tests/region-backup.test.mjs','tests/native-atlas.test.mjs','scripts/qualify-native-region-backup.mjs'];
const frozen=[];for(const filename of files){const copy=join(owned,filename.replaceAll('/','__'));await copyFile(join(root,filename),copy);
  frozen.push({source:filename,...await describe(copy)});}
const testLog=join(output,'native-region-backup-001-qualified-tests.log'),log=await readFile(testLog,'utf8');
assert.match(log,/fail 0/);assert.match(log,/pass \d+/);assert.ok(!log.includes('not ok '));
const observed={version:1,result:'pass',scope:'Terminal-only independent kingdom byte/lease/publication roundtrip; no browser or native game execution',
  original,archive:await describe(archive),exported,restored:described,largestRead,largestWrite,refusedExistingWorld:true,
  preservedOriginal:true,wasmBefore,wasmAfter:await wasmStat(),sources:frozen,tests:await describe(testLog),
  limits:['Fixture content identity is test-only; original asset/mod compatibility is not exercised',
    'No complete profile, co-op campaign or connected actor-ledger backup','No browser OPFS or file-picker execution during app crash suspension']};
await writeFile(report,JSON.stringify(observed,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({result:'pass',report,originalBytes:original.size,backupBytes:exported.bytes,largestRead,largestWrite})+'\n');
