#!/usr/bin/env node
// Original stopped saves through the production atlas, without a browser/game.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {savedAtlasStore,moveNativeAtlas} from '../web/world/native-atlas.mjs';
import {NativeTerrainScene} from '../web/world/terrain-scene.mjs';
import {realmTerrainProvider} from '../web/world/realm-terrain.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
const [manifestName,inspectionName,outputName]=process.argv.slice(2);
assert.equal(process.argv.length,5,'Usage: <terminal native roundtrip> <independent inspection> <fresh report>');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function jsonFile(name){
  const descriptor={filename:resolve(name),...await hashNativeFile(name,{maximum:512*1024})};
  return {descriptor,value:JSON.parse(await readFile(name,'utf8'))};
}
function absent(pid){
  assert.ok(Number.isInteger(pid)&&pid>0);
  try{process.kill(pid,0);assert.fail('Original producer is still present');}
  catch(error){assert.equal(error.code,'ESRCH');}
}
async function exact(d){
  const actual=await hashNativeFile(d.filename);
  assert.equal(actual.bytes,d.bytes);assert.equal(actual.sha256,d.sha256);
}
const original=await jsonFile(manifestName),inspection=await jsonFile(inspectionName),n=original.value;
assert.equal(n.nativeRemoteRoundtripQualified,true);assert.equal(n.nativeSessionTerminal,true);
assert.equal(n.nativeExitCode,0);assert.equal(n.publicationWorkerExitCode,0);
absent(n.nativePid);absent(n.publicationWorkerPid);
assert.equal(inspection.value.nativeRemoteRoundtripQualified,true);
assert.equal(inspection.value.manifest.sha256,original.descriptor.sha256);
assert.equal(inspection.value.manifest.bytes,original.descriptor.bytes);
await exact(n.roundtrip);
const snapshot=await jsonFile(n.roundtrip.filename),cycles=snapshot.value.cycles;
assert.equal(cycles.length,8);assert.equal(snapshot.value.nativeRemoteRoundtripCompleted,true);
const before=cycles[0].captured,after=cycles[7].active,region=cycles[0].crossing.region;
assert.equal(region,'-5_-1');assert.equal(cycles[7].receipt.region,region);
await exact(before);await exact(after);
const clocks=[await checkpointSavedClock(await stoppedFileSource(before.filename)),
  await checkpointSavedClock(await stoppedFileSource(after.filename))];
assert.deepEqual(clocks,[18850,23050]);
let selected=before,held=false,corrupt=false;
const stats={locks:0,opens:0,reads:0,readBytes:0,largestRead:0,writes:0};
const io={async withLock(mode,fn){
  assert.equal(mode,'shared');assert.equal(held,false);held=true;++stats.locks;
  try{return await fn();}finally{held=false;}
},async open(name){
  assert.equal(held,true);++stats.opens;
  const marker=`Frontier_${region}.checkpoint`,slot=`Frontier_${region}.GMP`;
  let source;
  if(name===marker){
    const bytes=Buffer.from(`checkpoint-v1\n0\n${selected.bytes}\n${selected.sha256}\natlas-native-refresh-fixture\n`);
    source={size:bytes.length,async readAt(at,n){return bytes.subarray(at,at+n);}};
  }else if(name===slot)source=await stoppedFileSource(selected.filename);
  else{assert.match(name,/^Frontier_-?\d+_-?\d+(?:_Recovery)?\.(?:checkpoint|GMP)$/);return null;}
  return {size:source.size,async readAt(at,n){
    assert.equal(held,true);++stats.reads;stats.readBytes+=n;stats.largestRead=Math.max(stats.largestRead,n);
    const bytes=await source.readAt(at,n);
    if(corrupt&&name===slot&&at===0&&n){const changed=bytes.slice();changed[0]^=1;return changed;}
    return bytes;
  }};
},atomicWrite(){++stats.writes;throw Error('Original atlas is read-only');}};
const scene=new NativeTerrainScene(realmTerrainProvider(savedAtlasStore(io),{includeUnits:true}));
const x=-5*128+64,y=-128+64,width=128,height=128;
const markers=()=>{
  const h=createHash('sha256');
  for(const [key,value] of scene.active){h.update(key);if(value?.markers)h.update(new Uint8Array(value.markers.buffer));}
  return h.digest('hex');
};
await moveNativeAtlas(scene,x,y,width,height);const oldView=scene.active,oldIdentity=scene.identity,oldMarkers=markers();
selected=after;const reads=stats.reads,opens=stats.opens,locks=stats.locks;
for(let step=1;step<=100;++step)await moveNativeAtlas(scene,x+step/1000,y+step/1000,width,height);
assert.equal(stats.reads,reads);assert.equal(stats.opens,opens);assert.equal(stats.locks,locks);
assert.equal(scene.active,oldView);assert.equal(scene.identity,oldIdentity);assert.equal(markers(),oldMarkers);
await moveNativeAtlas(scene,x,y,width,height,{refresh:true});
assert.notEqual(scene.identity,oldIdentity);const newMarkers=markers();assert.notEqual(newMarkers,oldMarkers);
assert.equal(oldView.size,0);const current=scene.active,identity=scene.identity;
corrupt=true;
await assert.rejects(moveNativeAtlas(scene,x,y,width,height,{refresh:true}),/Damaged/);
assert.equal(scene.active,current);assert.equal(scene.identity,identity);assert.equal(markers(),newMarkers);
corrupt=false;
await moveNativeAtlas(scene,x,y,width,height,{refresh:true});
assert.equal(scene.identity,identity);assert.equal(markers(),newMarkers);
assert.equal(stats.writes,0);assert.equal(held,false);assert.ok(stats.largestRead<=4096);
assert.ok(scene.activeHighWater<=49);assert.ok(scene.residentHighWater<=98);
const residency={activeHighWater:scene.activeHighWater,residentHighWater:scene.residentHighWater,
  residentBytesHighWater:scene.residentBytesHighWater};
await scene.close();assert.equal(scene.residentBytes,0);assert.equal(scene.active.size,0);
await exact(before);await exact(after);
const sources={};
async function record(name){
  name=resolve(name);if(sources[name])return;
  assert.ok(name.startsWith(workspace+'/'));const bytes=await readFile(name);sources[name]=hash(bytes);
  if(name.endsWith('.mjs'))for(const m of bytes.toString().matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){
    if(m[1].startsWith('.'))await record(resolve(dirname(name),m[1]));
  }
}
await record(new URL(import.meta.url).pathname);await record(resolve(workspace,'web/world/view.mjs'));
const report={version:1,originalSavedAtlasRefreshQualified:true,manifest:original.descriptor,
  independentInspection:inspection.descriptor,nativeSnapshot:snapshot.descriptor,before,after,region,clocks,
  staleMarkerSha256:oldMarkers,freshMarkerSha256:newMarkers,readFreePans:100,
  explicitRefreshUpdatesOriginalMarkers:true,corruptRefreshPreservesScene:true,previousViewExpires:true,
  originalInputsUnchanged:true,sourceSha256:sources,stats,residency,browserUsed:false,liveOPFSQualified:false,
  nativeProcessesStarted:0,actualBrowserFPSQualified:false,sustainedBrowserMemoryQualified:false,goalComplete:false};
await writeFile(outputName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({originalSavedAtlasRefreshQualified:true,readFreePans:100,clocks,stats,residency}));
