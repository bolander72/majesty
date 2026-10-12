#!/usr/bin/env node
// Read only two stopped original-generation saves; no game/browser launch.
import assert from 'node:assert/strict';
import {readFile,lstat,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {checkpointPlacements} from '../web/world/checkpoint.mjs';
import {checkpointTerrain,VERTEX_BYTES} from '../web/world/terrain.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {requireCheckpointHaloLayout} from '../web/world/halo-checkpoint-layout.mjs';
import {haloSharedVertex} from '../web/world/halo-region-layout.mjs';

const [beforeName,afterName,outName]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(outName,/^output\/native-hero-entry-ground-\d{3}-observed\.json$/);
await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const descriptor=async filename=>({filename:resolve(filename),...await hashNativeFile(filename)});
async function json(name){assert.ok((await lstat(name)).size<1024*1024);return JSON.parse(await readFile(name,'utf8'));}
async function bound(row){const current=await descriptor(row.filename);assert.equal(current.sha256,row.sha256);assert.equal(current.bytes,row.bytes);}
const before=await json(beforeName),after=await json(afterName);
for(const m of [before,after]){
 for(const [key,value] of Object.entries({nativeSessionTerminal:true,nativeExitCode:0,stopReason:null,ownedProducerAbsent:true,
  browserUsed:false,nativeOnly:true,nativeProcessesStarted:1,heroEntryGroundFixture:true,haloGenerationTrialCompleted:true,
  originalSettingsUnchanged:true,privateNativeExecutableUnchanged:true,ownerPublished:false,heroCrossingQualified:false}))assert.equal(m[key],value,key);
 assert.equal(m.region,'-1_-1');assert.equal(m.layout,'halo-v1');assert.deepEqual(m.preservedAfter,m.preservedBefore);
 assert.throws(()=>process.kill(m.nativePid,0),e=>e.code==='ESRCH');
 await ownedDirectory(m.fixture,'actor-arrival-fixture-halo-world-');
 await bound(m.checkpoint);assert.equal((await descriptor(m.log)).sha256,m.logSha256);
 assert.equal((await descriptor(m.privateNativeExecutable)).sha256,m.nativeExecutableSha256);
 assert.equal((await descriptor(m.buildReport)).sha256,m.buildReportSha256);
 assert.ok(Math.max(...m.resourceSamples.map(r=>r.rssBytes))<=m.rssCeilingBytes);
}
assert.equal(Object.keys(after.compiledSourceSha256).length,54);
for(const [name,sha256] of Object.entries(after.compiledSourceSha256))assert.equal((await descriptor(name)).sha256,sha256);
// The old code was frozen before its condition was corrected. Authenticate
// that exact baseline instead of relabeling it as the new compiled source.
const frozen=await json('output/native-entry-ground-360-preserved/manifest.json');
for(const [name,sha256] of Object.entries(before.compiledSourceSha256)){
 const row=frozen.files.find(r=>r.path===name);assert.equal(row?.sha256,sha256);
 assert.equal((await descriptor(join('output/native-entry-ground-360-preserved/source',name))).sha256,sha256);
}
const oldLog=await readFile(before.log,'utf8'),log=await readFile(after.log,'utf8');
assert.ok(!/Assertion|invariant failed|GplException/.test(log));
assert.ok(oldLog.includes('ground-rejected=0 no-hero-activation=1'));
const omissions=[...log.matchAll(/^\[frontier\] Hero entry ground placement refused target=-1_-1 description=([0-9a-f]{8}) grid=(\d+),(\d+) rectangle=(-?\d+),(-?\d+),(-?\d+),(-?\d+) original-formatter=1 before-construction=1 original-null-branch=004b20d7 count=(\d+)$/gm)];
assert.equal(omissions.length,3);assert.ok(log.includes('ground-rejected=3 no-hero-activation=1'));
const oldSource=await stoppedFileSource(before.checkpoint.filename),source=await stoppedFileSource(after.checkpoint.filename);
assert.equal(await checkpointSavedClock(oldSource),0);assert.equal(await checkpointSavedClock(source),0);
const oldPlacements=[],placements=[];
for await(const p of checkpointPlacements(oldSource))oldPlacements.push(p);
for await(const p of checkpointPlacements(source))placements.push(p);
const skipped=[];
for(const [index,match] of omissions.entries()){
 const description=parseInt(match[1],16),x=Number(match[2]),y=Number(match[3]),rect=match.slice(4,8).map(Number);
 assert.equal(Number(match[8]),index+1);
 assert.ok(rect[0]<253&&251<rect[2]&&rect[1]<129&&127<rect[3]);
 const same=p=>p.family==='GRND'&&p.description===description&&p.mapPosition?.x===x*16&&p.mapPosition?.y===y*16;
 assert.equal(oldPlacements.filter(same).length,1);assert.equal(placements.filter(same).length,0);
 skipped.push({description,x,y,rectangle:rect,baselineUnitId:oldPlacements.find(same).unitId});
}
assert.ok(skipped.some(p=>p.description===0x32304755&&p.x===250&&p.y===126));
const geometry=await requireCheckpointHaloLayout(source,'-1_-1','halo-v1');
await requireCheckpointHaloLayout(oldSource,'-1_-1','halo-v1');
const oldTerrain=await checkpointTerrain(oldSource),terrain=await checkpointTerrain(source);
let heights=0,interiorDifferences=0,sharedHeights=0;
for(let y=0;y<=128;y++){
 const a=await oldSource.readAt(oldTerrain.heightOffset(0,y),129*VERTEX_BYTES),b=await source.readAt(terrain.heightOffset(0,y),129*VERTEX_BYTES),
  av=new DataView(a.buffer,a.byteOffset,a.byteLength),bv=new DataView(b.buffer,b.byteOffset,b.byteLength);
 for(let x=0;x<=128;x++){
  const same=av.getUint32(x*VERTEX_BYTES,true)===bv.getUint32(x*VERTEX_BYTES,true);
  if(haloSharedVertex(x,y)){assert.ok(same,'Protected shared terrain changed');++sharedHeights;}
  else if(!same)++interiorDifferences;
  ++heights;
 }
}
const report={version:1,nativeFreshEntryGroundPlacementQualified:true,before:await descriptor(beforeName),after:await descriptor(afterName),
 skipped,allSavedHeightWordsCompared:heights,sharedHeightWordsUnchanged:sharedHeights,interiorChangedHeightWords:interiorDifferences,
 geometry,originalSafeNullBranch:'004b20d7',inspectionReadOnly:true,
 limitations:'New generation may differ in interior terrain and actor placement. This verifies the shared halo heights and omitted ground tiles; it does not claim complete world equivalence or hero arrival.',
 peakRssBytes:Math.max(...after.resourceSamples.map(r=>r.rssBytes)),elapsedMs:after.finishedAtMs-after.startedAtMs,
 heroImported:false,heroActivated:false,heroCrossingQualified:false,ownerPublished:false,browserUsed:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeFreshEntryGroundPlacementQualified:true,skipped:skipped.length,sharedHeightWordsUnchanged:sharedHeights,interiorChangedHeightWords:interiorDifferences,browserUsed:false}));
