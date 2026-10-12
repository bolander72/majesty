#!/usr/bin/env node
// Inspect actual original departure, disposal and a held saved neighbor.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {inspectNativeHaloSessionRetirement} from './inspect-native-halo-session-retirement.mjs';
import {equalWorlds} from './inspect-native-halo-session-actor.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointAgents,checkpointPlacements} from '../web/world/checkpoint.mjs';
import {verifyRegisteredHeroSnapshot,registeredHeroHome} from '../web/world/entity-home-ownership.mjs';
import {verifyEntitySnapshot} from '../web/world/entity-ownership.mjs';
import {prepareOrReuseRemoteHomeAgent} from '../web/world/remote-home-cache.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
export async function inspectNativeHaloSavedActorPaging(trialName){
const m=await json(trialName),p=await json(m.preparation);
assert.equal(m.savedActorPagingRequested,true);assert.equal(m.actorMoveRequested,true);assert.equal(m.mode,'actor-paging');
assert.equal(m.haloSessionActorPagingTrialCompleted,true);assert.deepEqual(m.route,['0_0','1_0']);
assert.equal(p.selectedRevision,6);assert.equal(p.savedActorDestination.clock,3750);
const retirement=await inspectNativeHaloSessionRetirement(trialName),crossing=retirement.crossing,request=m.actorPagingRequest;
assert.equal(crossing.originalMovementRequestQualified,true);assert.equal(crossing.originalRewardFlagCreationQualified,false);
assert.equal(request.destination,'1_0');assert.equal(request.clock,retirement.sourceClock);assert.deepEqual(request.retired,retirement.retiredWorld);
for(const r of [request.packet,m.savedActorIds])assert.equal(await hash(r.filename),r.sha256);
assert.equal(await readFile(request.packet.filename,'utf8'),`halo-session-actor-page-v1\n0\n0_0\n1_0\n${request.clock}\n${request.retired.sha256}\n`);
const ids=await readFile(m.savedActorIds.filename);assert.equal(ids.length,32);
assert.deepEqual(Array.from({length:8},(_,i)=>ids.readUInt32LE(i*4)),[0x31534448,1,94550,508,25,3750,34,3]);
const log=await readFile(m.log,'utf8'),matches=re=>[...log.matchAll(re)];
assert.ok(!/Halo bounty created|Halo session generated ready|Halo session epoch |Halo session proxy ready|Halo session arrival saved|Session fallback/.test(log));
const page=matches(/^\[frontier\] Halo session actor page serial=1 source=0_0 target=1_0 saved-clock=(\d+) phase=4 pending=4 clock=0 original-quit=1 checkpoint-bound=1 owner-published=0 result=pass$/gm);
assert.equal(page.length,1);assert.equal(Number(page[0][1]),request.clock);
const release=matches(/^\[frontier\] Session released serial=1 region=0_0 roots-freed=1,1,1,1,1,1,1,1 terrain-bytes=530456 spatial-bytes=524288 heap-before=(\d+) heap-after=(\d+) blocks-before=(\d+) blocks-after=(\d+) clock=0$/gm);
assert.equal(release.length,1);const r=release[0];assert.ok(Number(r[1])>Number(r[2]));assert.ok(Number(r[3])>Number(r[4]));
const removed=matches(/^\[frontier\] Session release observer removed serial=1 hooks=\d+ retained-roots=0$/gm);assert.equal(removed.length,1);
const unloaded=log.indexOf('Session unloaded serial=1 source=0_0 target=1_0 world-null=1 ');
const attached=log.indexOf('Session attached serial=1 region=1_0 mode=saved phase=1 pending=2');
const restored=log.indexOf('Halo restore ready key=1_0 layout=halo-v1 clock=3750 ');
const held=log.indexOf('Halo session destination held serial=1 key=1_0 clock=3750 phase=7 ordinary-ticks=0 source-retired=1 actor-imported=0 owner-published=0 result=pass');
assert.ok(page[0].index<r.index&&r.index<unloaded&&unloaded<removed[0].index&&removed[0].index<attached&&attached<restored&&restored<held);
function file(region,name){const filename=join(m.root,`frontier_${region}`,name.endsWith('.GMP')?'Documents/My Games/MajestyHD/SaveGame':'',name);
 const rows=m.files.filter(r=>r.filename===filename);assert.equal(rows.length,1,filename);return rows[0];}
const selected={};
const identities=[p.identity.registeredHome.worldId,p.identity.entityId,p.identity.registeredHome.guildEntityId,p.settingsProducerExecutableSha256];
for(const key of m.route){
 const lines=(await readFile(file(key,`Frontier_${key}.checkpoint`).filename,'utf8')).split('\n');
 assert.equal(lines.length,6);assert.equal(lines.pop(),'');assert.equal(lines[0],'checkpoint-v1');assert.ok(['0','1'].includes(lines[1]));
 assert.equal(lines[4],`654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:${m.nativeExecutableSha256}`);
 const world=file(key,`Frontier_${key}${lines[1]==='1'?'_Recovery':''}.GMP`);assert.equal(String(world.bytes),lines[2]);assert.equal(world.sha256,lines[3]);
 assert.equal(await readFile(file(key,'Halo_Restore.layout').filename,'utf8'),['majesty-halo-reload-v1','halo-v1',key,lines[2],world.sha256,...identities,''].join('\n'));selected[key]=world;
}
const destination=p.worlds[1],loaded=file('1_0','Halo_Session_Reloaded_1.GMP'),heldWorld=file('1_0','Halo_Session_Destination_Held_1.GMP');
// A later return saves the retired east into its alternate slot. Qualify this
// earlier load against the bound initial slot, and retain the final selected
// descriptors separately for the return inspector to validate.
const returnPage=m.savedActorReturnPageRequested===true;
const loadedInput=returnPage?m.initialWorlds.find(r=>r.region==='1_0').world:selected['1_0'];
assert.equal(await hash(loadedInput.filename),loadedInput.sha256);
assert.equal(loadedInput.sha256,destination.sha256);
const sourceComparison=await equalWorlds(retirement.retiredWorld,selected['0_0']);
const loadedComparison=await equalWorlds(destination,loaded,{unscheduledAgents:[34]});
const heldComparison=await equalWorlds(loaded,heldWorld,{unscheduledAgents:[34]});
for(const world of [loadedInput,loaded,heldWorld]){
 const source=await stoppedFileSource(world.filename);assert.equal(await checkpointSavedClock(source),3750);
 await verifyRegisteredHeroSnapshot(p.identity,destination.entry.alias,destination.entry.homeAlias,source,false,'1_0');
 await verifyEntitySnapshot(p.identity,destination.entry.alias,source,false,destination.entry.homeAlias);
 const registered=registeredHeroHome(p.identity),reuse=await prepareOrReuseRemoteHomeAgent(source,registered,
  {worldId:registered.record.worldId,contentDigest:registered.record.contentDigest,destinationRegion:'1_0',freshAgentId:1000});
 assert.equal(reuse.plan.admission,'reuse-existing');assert.equal(reuse.plan.proposedAgentId,34);assert.equal(reuse.plan.recordSha256,p.savedActorDestination.homePlan.recordSha256);
}
const beforeMove=file('0_0','Halo_Session_Move_Before_0.GMP'),readyMove=file('0_0','Halo_Session_Move_Ready_0.GMP');
const beforeSource=await stoppedFileSource(beforeMove.filename),readySource=await stoppedFileSource(readyMove.filename);
async function script(s){let a;for await(const r of checkpointAgents(s))if(r.agentId===25){assert.equal(a,undefined);a=r;}assert.ok(a);assert.ok(a.size<4096);return s.readAt(a.offset,a.size);}
assert.deepEqual(await script(beforeSource),await script(readySource));
async function placement(s){let a;for await(const r of checkpointPlacements(s))if(r.unitId===508){assert.equal(a,undefined);a=r.fixedPosition;}assert.ok(a);return a;}
assert.deepEqual(await placement(beforeSource),await placement(readySource));
assert.equal(await checkpointSavedClock(beforeSource),94550);assert.equal(await checkpointSavedClock(readySource),94550);
assert.ok(m.finishedAtMs-m.startedAtMs<55000);assert.ok(m.resourceSamples.every(r=>r.rssBytes<=512*1024*1024));
for(const key of m.route)assert.ok(m.files.filter(r=>/^Frontier_(?:0_0|1_0)(?:_Recovery)?\.GMP$/.test(r.filename.split('/').pop())&&r.filename.includes(`/frontier_${key}/`)).length<=2);
const sourceSha256={...retirement.sourceSha256};for(const n of ['scripts/inspect-native-halo-saved-actor-paging.mjs','web/world/remote-home-cache.mjs','web/world/remote-home.mjs','web/world/hero-home.mjs','web/world/sha256.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,nativeSavedActorDestinationPagingQualified:true,qualificationBoundary:'held-destination-before-arrival',laterArrivalRequested:!!m.savedActorArrivalRequested,laterReturnPageRequested:returnPage,loadedInputWorld:loadedInput,manifest:resolve(trialName),manifestSha256:await hash(trialName),sourceSha256,
 retirement,sourceRetired:true,sourceUnloaded:true,destinationAttached:true,destinationSimulationHeld:true,destinationClock:3750,existingHomeProxy:34,
 selectedPrivateWorlds:selected,loadedWorld:loaded,heldWorld,sourceComparison,loadedComparison,heldComparison,
 exactCheckpointRecordComparisons:sourceComparison.records+loadedComparison.records+heldComparison.records,originalDisposals:1,freedRootsPerDisposal:8,
 releaseHeap:{before:Number(r[1]),after:Number(r[2])},maximumSlotsPerRegion:2,originalMovementRequestQualified:true,heroAiUngated:true,
 moveRequestScriptAndPositionPreserved:true,automaticHeroDepartureQualified:false,destinationActorImported:false,destinationActivated:false,
 elapsedMs:m.finishedAtMs-m.startedAtMs,peakSampledNativeRssBytes:Math.max(...m.resourceSamples.map(r=>r.rssBytes)),
actualJournalUnchanged:true,nativeSessionTerminal:true,nativeExitCode:0,ownerPublished:false,browserUsed:false,sustainedBrowserMemoryQualified:false,goalComplete:false};
return report;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
const [trialName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-halo-saved-actor-paging-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const report=await inspectNativeHaloSavedActorPaging(trialName);
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSavedActorDestinationPagingQualified:true,exactCheckpointRecordComparisons:report.exactCheckpointRecordComparisons,destinationClock:3750,existingHomeProxy:34}));
}
