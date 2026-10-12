#!/usr/bin/env node
// Verify original disposal/attachment after the selected running crossing.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {inspectNativeHaloSessionRetirement} from './inspect-native-halo-session-retirement.mjs';
import {equalWorlds} from './inspect-native-halo-session-actor.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {haloTerrainHeight,haloSharedVertex} from '../web/world/halo-region-layout.mjs';
import {nativeHeightBits} from '../web/world/native-height.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
export async function inspectNativeHaloSessionActorPaging(trialName) {
const m=await json(trialName),p=await json(m.preparation);
assert.ok(['actor-paging','actor-proxy','actor-epoch','actor-arrival','actor-activation'].includes(m.mode));assert.equal(m.haloSessionActorPagingTrialCompleted,true);
const retirement=await inspectNativeHaloSessionRetirement(trialName),crossing=retirement.crossing,request=m.actorPagingRequest;
for(const r of [request.retired,request.packet])assert.equal(await hash(r.filename),r.sha256);
assert.deepEqual(request.retired,retirement.retiredWorld);assert.equal(request.destination,crossing.handoff.destinationRegion);assert.equal(request.destination,'1_0');
assert.equal(request.clock,retirement.sourceClock);
assert.equal(await readFile(request.packet.filename,'utf8'),`halo-session-actor-page-v1\n0\n0_0\n1_0\n${request.clock}\n${request.retired.sha256}\n`);
const log=await readFile(m.log,'utf8');
const exits=[...log.matchAll(/Halo session actor page serial=(\d+) source=(\S+) target=(\S+) saved-clock=(\d+) phase=4 pending=4 clock=0 original-quit=1 checkpoint-bound=1 owner-published=0 result=pass/g)];
assert.equal(exits.length,1);assert.deepEqual(exits[0].slice(1),['1','0_0','1_0',String(request.clock)]);
const releases=[...log.matchAll(/Session released serial=(\d+) region=(\S+) roots-freed=1,1,1,1,1,1,1,1 terrain-bytes=(\d+) spatial-bytes=(\d+) heap-before=(\d+) heap-after=(\d+) blocks-before=(\d+) blocks-after=(\d+) clock=0/g)];
assert.equal(releases.length,1);const r=releases[0];assert.deepEqual(r.slice(1,5),['1','0_0','530456','524288']);
assert.ok(Number(r[5])>Number(r[6]));assert.ok(Number(r[7])>Number(r[8]));
const observers=[...log.matchAll(/Session release observer removed serial=(\d+) hooks=(\d+) retained-roots=0/g)];assert.equal(observers.length,1);assert.equal(observers[0][1],'1');
const unloaded=log.indexOf('Session unloaded serial=1 source=0_0 target=1_0 world-null=1 '),attached=log.indexOf('Session attached serial=1 region=1_0 mode=new ');
const generated=log.indexOf('Halo session generated ready serial=1 key=1_0 clock=0 shared-vertices=2480 ordinary-ticks=0 original-generator=1 original-writer=1 layout-bound=1 result=pass');
const held=log.indexOf('Halo session destination held serial=1 key=1_0 clock=0 phase=7 ordinary-ticks=0 source-retired=1 actor-imported=0 owner-published=0 result=pass');
assert.ok(exits[0].index<r.index&&r.index<unloaded&&unloaded<attached&&attached<generated&&generated<held);
assert.ok(r.index<observers[0].index&&observers[0].index<attached);
function file(key,name){const filename=join(m.root,`frontier_${key}`,name.endsWith('.GMP')?'Documents/My Games/MajestyHD/SaveGame':'',name);
 const rows=m.files.filter(r=>r.filename===filename);assert.equal(rows.length,1,filename);return rows[0];}
// Both ordinary checkpoint heads must select exactly their hashed/layout-bound
// original writer files. Source retirement is durable before original unload.
const identities=[p.identity.registeredHome.worldId,p.identity.entityId,p.identity.registeredHome.guildEntityId,p.settingsProducerExecutableSha256];
const selected={};
for(const key of ['0_0','1_0']){
 const lines=(await readFile(file(key,`Frontier_${key}.checkpoint`).filename,'utf8')).split('\n');
 assert.equal(lines.length,6);assert.equal(lines.pop(),'');assert.equal(lines[0],'checkpoint-v1');assert.ok(['0','1'].includes(lines[1]));
 assert.equal(lines[4],`654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:${m.nativeExecutableSha256}`);
 const world=file(key,`Frontier_${key}${lines[1]==='1'?'_Recovery':''}.GMP`);assert.equal(String(world.bytes),lines[2]);assert.equal(world.sha256,lines[3]);
 assert.equal(await readFile(file(key,'Halo_Restore.layout').filename,'utf8'),['majesty-halo-reload-v1','halo-v1',key,lines[2],world.sha256,...identities,''].join('\n'));
 selected[key]=world;
}
const generatedWorld=file('1_0','Halo_Session_Generated_1.GMP'),heldWorld=file('1_0','Halo_Session_Destination_Held_1.GMP');
const sourceCheckpointComparison=await equalWorlds(retirement.retiredWorld,selected['0_0']);
const destinationCheckpointComparison=await equalWorlds(generatedWorld,selected['1_0']);
const destinationHeldComparison=await equalWorlds(generatedWorld,heldWorld);
for(const comparison of [sourceCheckpointComparison,destinationCheckpointComparison,destinationHeldComparison]){
 assert.equal(comparison.cachedTerrainShadingRebuilt,false);assert.deepEqual(comparison.orderContainerPermutations,[]);
}
assert.equal(await checkpointSavedClock(await stoppedFileSource(selected['0_0'].filename)),request.clock);
let sharedVertexComparisons=0;
for(const world of [generatedWorld,selected['1_0'],heldWorld]){
 const source=await stoppedFileSource(world.filename);assert.equal(await checkpointSavedClock(source),0);
 const terrain=await checkpointTerrain(source);assert.deepEqual([terrain.width,terrain.height],[128,128]);
 for(let y=0;y<=128;y++)for(let x=0;x<=128;x++)if(haloSharedVertex(x,y)){
  const bytes=await source.readAt(terrain.heightOffset(x,y),4);assert.equal(new DataView(bytes.buffer,bytes.byteOffset,4).getUint32(0,true),nativeHeightBits(haloTerrainHeight('1_0',x,y)));sharedVertexComparisons++;
 }
}
assert.equal(sharedVertexComparisons,7440);
// No production region has more than two checkpoint worlds; unique test
// captures are evidence only and are not dormant native world instances.
for(const key of ['0_0','0_-1','1_0'])assert.ok(m.files.filter(r=>r.filename===join(m.root,`frontier_${key}/Documents/My Games/MajestyHD/SaveGame/Frontier_${key}.GMP`)||r.filename===join(m.root,`frontier_${key}/Documents/My Games/MajestyHD/SaveGame/Frontier_${key}_Recovery.GMP`)).length<=2);
const sourceSha256={...retirement.sourceSha256};for(const n of ['scripts/inspect-native-halo-session-actor-paging.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,nativeRunningActorPagingQualified:true,nativeRunningSourceRetirementQualified:true,nativeSelectedHeroCoreCrossingQualified:true,completeHeldWorldQualified:true,
 manifest:resolve(trialName),manifestSha256:await hash(trialName),sourceSha256,retirement,crossing,removedRecords:retirement.removedRecords,unrelatedRecordComparisons:retirement.unrelatedRecordComparisons,
 sourceRetired:true,sourceUnloaded:true,destinationAttached:true,destinationSimulationHeld:true,destinationActorImported:false,destinationActivated:false,
 selectedPrivateWorlds:selected,generatedWorld,heldWorld,sourceCheckpointComparison,destinationCheckpointComparison,destinationHeldComparison,
 exactCheckpointRecordComparisons:sourceCheckpointComparison.records+destinationCheckpointComparison.records+destinationHeldComparison.records,
 sharedVertexComparisons,originalDisposals:1,freedRootsPerDisposal:8,releaseHeap:{before:Number(r[5]),after:Number(r[6])},maximumSlotsPerRegion:2,
 originalReaderWriter:true,actualJournalUnchanged:true,nativeSessionTerminal:true,nativeExitCode:0,ownerPublished:false,browserUsed:false,
 elapsedMs:m.finishedAtMs-m.startedAtMs,peakSampledNativeRssBytes:Math.max(...m.resourceSamples.map(r=>r.rssBytes)),sustainedBrowserMemoryQualified:false,goalComplete:false};
return report;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const[trialName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
 assert.match(outName,/^output\/native-halo-session-actor-paging-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
 const report=await inspectNativeHaloSessionActorPaging(trialName);await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({nativeRunningActorPagingQualified:true,originalDisposals:1,freedRootsPerDisposal:8,exactCheckpointRecordComparisons:report.exactCheckpointRecordComparisons,sharedVertexComparisons:report.sharedVertexComparisons}));
}
