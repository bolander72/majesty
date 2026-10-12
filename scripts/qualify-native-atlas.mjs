// Terminal-only qualification using existing isolated native snapshots.
import assert from 'node:assert/strict';
import {readFile,open,stat,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {savedAtlasStore,moveNativeAtlas,paintNativeAtlas} from '../web/world/native-atlas.mjs';
import {NativeTerrainScene} from '../web/world/terrain-scene.mjs';
import {realmTerrainProvider} from '../web/world/realm-terrain.mjs';

const root=resolve(import.meta.dirname,'..');
const args=process.argv.slice(2);
assert.ok(args.length===0||args.length===2&&args[0]==='--output','Use --output output/<fresh-report>.json');
const output=resolve(root,args[1]??'output/native-atlas-real-files-observed.json');
assert.ok(output.startsWith(join(root,'output')+'/')&&output.endsWith('.json'));
const summary=JSON.parse(await readFile(join(root,'output/actor-transfer-case-summary.json'),'utf8'));
const fixture=summary.committedFixture;
assert.ok(typeof fixture==='string'&&fixture.startsWith(join(root,'upstream/majesty-recomp/build/actor-arrival-fixture-')));
const expected={
  'Source_Before.GMP':'6e6a2ee125b68ce00ec25a46f205904e7cdd8f83ca009c10cf29e8e9ab76e2d1',
  'Destination_Before.GMP':'83222090215e19ed3d1e3d2ea92df87d68cad77c3496ac3d3e4d8083112ba4b9',
};
async function describe(path){
  const info=await stat(path),hash=createHash('sha256');
  for await(const part of createReadStream(path,{highWaterMark:4096}))hash.update(part);
  return {size:info.size,mtimeMs:info.mtimeMs,sha256:hash.digest('hex')};
}
const before={};
for(const [name,sha]of Object.entries(expected)){
  before[name]=await describe(join(fixture,name));assert.equal(before[name].sha256,sha);
}
const regions=new Map([['0_0','Source_Before.GMP'],['1_0','Destination_Before.GMP']]);
const markers=new Map([...regions].map(([key,name])=>[key,Buffer.from(`checkpoint-v1\n0\n${before[name].size}\n${before[name].sha256}\noriginal-fixture-content\n`)]));
let locked=false,largestRead=0,openFiles=0,maxOpenFiles=0,reads=0;
const io={async withLock(mode,consume){assert.equal(mode,'shared');assert.equal(locked,false);locked=true;try{return await consume();}finally{locked=false;}},
  async open(name){
    assert.ok(locked);
    const match=/^Frontier_(-?\d+_-?\d+)\.(GMP|checkpoint)$/.exec(name);
    if(!match||!regions.has(match[1]))return null;
    const key=match[1],filename=regions.get(key),marker=markers.get(key),size=match[2]==='checkpoint'?marker.length:before[filename].size;
    return {size,async readAt(at,n){
      assert.ok(locked);assert.ok(n<=4096);assert.ok(at>=0&&at+n<=size);largestRead=Math.max(largestRead,n);++reads;
      if(match[2]==='checkpoint')return marker.subarray(at,at+n);
      const file=await open(join(fixture,filename),'r');++openFiles;maxOpenFiles=Math.max(maxOpenFiles,openFiles);
      try{const buffer=Buffer.alloc(n),read=await file.read(buffer,0,n,at);assert.equal(read.bytesRead,n);return buffer;}
      finally{await file.close();--openFiles;}
    }};
  }};
const scene=new NativeTerrainScene(realmTerrainProvider(savedAtlasStore(io)));
const origin={x:512,y:256};
await scene.move(origin.x/4,origin.y/4,128,128);

// A bounded software sink checks pixel coverage and colors without GPU/DOM.
function raster(){
  const pixels=new Uint8Array(512*512),palette=new Map(),labels=[];
  let draws=0;
  return {pixels,palette,labels,get draws(){return draws;},
    fillRect(x,y,w,h){
      assert.ok(Number.isInteger(x)&&Number.isInteger(y));assert.ok(w>0&&w%4===0);assert.equal(h,4);
      assert.ok(x>=0&&y>=0&&x+w<=512&&y+h<=512);++draws;
      if(!palette.has(this.fillStyle))palette.set(this.fillStyle,palette.size+1);
      const color=palette.get(this.fillStyle);assert.ok(color<=33);
      for(let row=y;row<y+h;++row)pixels.fill(color,row*512+x,row*512+x+w);
    },beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(text){labels.push(text);}};
}
const first=raster(),painted=paintNativeAtlas(first,scene,origin,512,512);
assert.equal(painted.cells,16384);assert.ok(first.draws<painted.cells);assert.ok(first.pixels.every(color=>color>0));
const rasterHash=createHash('sha256').update(first.pixels).digest('hex');
// Independently retained pre-batching evidence for these exact pinned inputs.
assert.equal(rasterHash,'f36804724e4ab6daebba6ae984d21d422428be6f11957f8e08ff7ad458733e0c');
const loaded=scene.activeBytes;
const beforePanReads=reads,beforePanWindows=scene.windowReads;
for(let step=1;step<=25;++step)await moveNativeAtlas(scene,128+step/10,64+step/10,128,128);
assert.equal(reads,beforePanReads);assert.equal(scene.windowReads,beforePanWindows);
for(let step=1;step<=12;++step){
  await scene.move(1024*step,1024*step,128,128);
  assert.equal(scene.activeBytes,0);assert.ok([...scene.active.values()].every(value=>value===null));
  assert.equal(scene.active.has('0,0'),false);
}
await scene.move(origin.x/4,origin.y/4,128,128);
const restored=raster();paintNativeAtlas(restored,scene,origin,512,512);
assert.deepEqual(restored.pixels,first.pixels);assert.deepEqual([...restored.palette],[...first.palette]);
assert.equal(scene.activeBytes,loaded);assert.ok(scene.residentHighWater<=98);assert.ok(scene.residentBytesHighWater<=1462258);
const fresh=new NativeTerrainScene(realmTerrainProvider(savedAtlasStore(io)));
await fresh.move(origin.x/4,origin.y/4,128,128);
const restarted=raster();paintNativeAtlas(restarted,fresh,origin,512,512);assert.deepEqual(restarted.pixels,first.pixels);
const sceneResources={activeBytes:loaded,residentWindowsHighWater:scene.residentHighWater,residentBytesHighWater:scene.residentBytesHighWater};
await scene.close();await fresh.close();
assert.equal(scene.activeBytes,0);assert.equal(fresh.activeBytes,0);
const after={};for(const name of Object.keys(expected)){after[name]=await describe(join(fixture,name));assert.deepEqual(after[name],before[name]);}
assert.equal(openFiles,0);assert.equal(maxOpenFiles,1);assert.equal(locked,false);
const report={
  qualification:'terminal-only saved native terrain renderer and source read adapter; browser publication unverified',
  inputs:{fixture,before,after,unchanged:true,regions:[...regions]},
  rendered:{width:512,height:512,cells:painted.cells,windows:painted.windows,terrainDraws:first.draws,unbatchedTerrainDraws:painted.cells,drawCallReduction:painted.cells/first.draws,preBatchingRasterExact:true,colors:first.palette.size,palette:[...first.palette],rasterSha256:rasterHash,labels:first.labels},
  travel:{localPans:25,localPanFileReads:0,emptyDestinations:12,originEvicted:true,returnPixelsExact:true,freshReaderPixelsExact:true},
  resources:{largestRead,reads,maxOpenFiles,...sceneResources,closedActiveBytes:[scene.activeBytes,fresh.activeBytes],testRasterBytes:first.pixels.length,productionRasterCachesAdded:0},
  limitations:['native textures, buildings and heroes are not rendered','independent kingdoms have unreconciled seams','fixture manifests exist only in owned memory; no OPFS or original engine execution','not whole process/GPU/WASM memory qualification'],
  browserLaunches:0,gameLaunches:0,builds:0,
};
await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({passed:true,cells:painted.cells,terrainDraws:first.draws,drawCallReduction:painted.cells/first.draws,colors:first.palette.size,largestRead,maxOpenFiles,preBatchingRasterExact:true,returnPixelsExact:true,originalsUnchanged:true}));
