#!/usr/bin/env node
// Authenticate the stopped trial and actual native GMPs independently of its
// live worker. Inspect actual saves and original-engine lifecycle evidence.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {parseRealmManifest,realmFiles} from '../web/world/realm-store.mjs';
import {parseHeroRuntimeBinding} from '../web/world/hero-runtime-binding.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {checkpointAbsentAgentReferences,checkpointAgentQueues,checkpointAgentValues,checkpointPlacements,checkpointAttachments} from '../web/world/checkpoint.mjs';
import {parseNativeHeroArrivalReady,nativeHeroArrivalPublished} from '../web/world/hero-travel-publication.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {requireCheckpointHaloLayout} from '../web/world/halo-checkpoint-layout.mjs';
import {requireCheckpointHeroCrossing} from '../web/world/hero-travel-boundary.mjs';
import {nativeRegionGenerationSeed} from '../web/world/hero-generation-request.mjs';
import {checkpointHeroGenerationInitialization} from '../web/world/arrival.mjs';
import {checkpointActorOrderNavigation} from '../web/world/order-navigation.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {haloRegionLayout} from '../web/world/halo-region-layout.mjs';

const [manifestName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-hero-generation-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async name=>(await hashNativeFile(name)).sha256;
const descriptor=async filename=>({filename:resolve(filename),...await hashNativeFile(filename)});
const json=async name=>{assert.ok((await lstat(name)).size<1024*1024);return JSON.parse(await readFile(name,'utf8'));};
async function bound(row){assert.equal((await lstat(row.filename)).size,row.bytes);assert.equal(await hash(row.filename),row.sha256);}
const m=await json(manifestName);assert.equal(m.generateNeighbor,true);assert.equal(m.nativeFreshNeighborTrialQualified,true);
assert.equal(m.nativeFreshNeighborInitializationQualified,true);
if(m.stoppedCompletionChecksRecovered){
 // Authenticate the original terminal run, rather than accepting replacement
 // pass flags without the preserved producer evidence that justified them.
 await bound(m.recoveryOriginal);await bound(m.recoveryArchive);
 assert.equal(await hash('scripts/recover-native-hero-generation-report.mjs'),m.recoveryScriptSha256);
 assert.equal(m.recoveryGameProcessesStarted,0);assert.equal(m.independentSavedStateVerificationRequired,true);
 const original=await json(m.recoveryOriginal.filename),archive=await json(m.recoveryArchive.filename);
 for(const [key,value]of Object.entries(original))assert.deepEqual(m[key],value,key);
 assert.equal(original.freshGeneration,undefined);assert.equal(archive.nativeTrialCompleted,true);
 const frozen=archive.evidence.find(row=>row.source===m.recoveryOriginal.filename);assert.ok(frozen);
 assert.equal(frozen.sha256,m.recoveryOriginal.sha256);assert.equal(await hash(frozen.preserved),frozen.sha256);
 assert.ok(m.freshGeneration.bytes>256*1024&&m.freshGeneration.bytes<=512*1024);
}
for(const [key,value] of Object.entries({nativeSessionTerminal:true,nativeExitCode:0,stopReason:null,ownedProducerAbsent:true,
 publicationWorkerTerminal:true,publicationWorkerExitCode:0,publicationWorkerAbsent:true,browserUsed:false,nativeProcessesStarted:1,
 sourceCheckpointUnchanged:true,copiedCheckpointUnchanged:true,startupFixtureUnchanged:true,nativeExecutableUnchanged:true}))assert.equal(m[key],value,key);
assert.deepEqual(m.preservedBefore,m.preservedAfter);
for(const pid of [m.nativePid,m.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');
await ownedDirectory(m.publicationJournal,'actor-arrival-fixture-hero-route-');
assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const [name,digest] of Object.entries(m.compiledSourceSha256))assert.equal(await hash(name),digest);
await bound(m.build);await bound(m.startup);await bound(m.freshGeneration);
assert.equal(await hash('scripts/run-native-hero-binding.py'),m.runnerSha256);
assert.equal(await hash('scripts/stage-held-native-hero-generation.mjs'),m.publicationWorkerSha256);
assert.equal(await hash(join(m.fixture,'native/recomp/pop_smoke')),m.nativeExecutableSha256);
assert.equal(await hash(m.log),m.logSha256);
const g=await json(m.freshGeneration.filename),arrived=m.arriveGeneratedNeighbor===true,repeat=m.repeatGeneratedNeighbor===true;
if(repeat){assert.equal(m.nativeRepeatedGeneratedNeighborArrivalQualified,true);assert.ok(g.repeatedGeneration);}
assert.equal(g.heroImported,arrived);assert.equal(g.ownerTransferred,arrived);
if(arrived){assert.equal(m.nativeGeneratedNeighborArrivalQualified,true);assert.equal(g.nativeGeneratedArrivalGameplayObserved,true);}
assert.equal(g.nativeGenerationInitializedObserved,true);assert.equal(g.generatedClock,100);assert.equal(g.initializationTicks,2);
const initial=parseHeroRuntimeBinding(m.runtimeBinding),input=JSON.parse(g.request.requestManifest);
assert.equal(input.kind,'majesty-hero-generation-input-v1');assert.equal(input.version,1);assert.equal(input.serial,1);
assert.equal(input.sourceRegion,'0_0');assert.equal(input.targetRegion,'1_0');assert.equal(input.sourceClock,g.crossing.clock);
assert.deepEqual(input.sourceAlias,{unitId:initial.unitId,agentId:initial.agentId});
assert.deepEqual(input.homeAlias,{kind:'native',unitId:initial.homeUnitId,agentId:initial.homeAgentId});
assert.equal(input.sourceNativeManifest,g.sourceNativeManifest);assert.equal(input.ownerManifest,g.publication.ownerManifest);
assert.deepEqual(input.generation,{layout:'halo-v1',seed:nativeRegionGenerationSeed('1_0'),nativeCells:128,coreCells:124});
assert.equal(g.request.nativeAction,'frontier-hero-generate-1');assert.equal(g.request.nativeActionIssued,false);
assert.equal(g.request.requestSize,g.preservedRequest.bytes);assert.equal(g.request.requestSha256,g.preservedRequest.sha256);
assert.ok(g.request.requestSize<=4096);await bound(g.preservedRequest);
assert.equal(await readFile(g.preservedRequest.filename,'utf8'),g.request.requestManifest);
assert.equal(g.controls.length,6);assert.deepEqual(g.controls.map(c=>c.kind),['wrong-seed','wrong-clock','wrong-unit','wrong-target','wrong-owner','orphaned-target']);
assert.ok(g.controls.every(c=>c.refusedByEngine&&c.sourceCaptureUnchanged&&c.ownerUnchanged));
assert.equal((await lstat(join(m.fixture,'Hero_Generation_Orphan_Preserved.GMP'))).size,0);
const log=await readFile(m.log,'utf8');assert.ok(!/result=fail|invariant failed|abort from|GplException/.test(log));
assert.equal(log.split('[frontier] Hero generation request refused ').length-1,6);
if(!arrived)assert.ok(!/Hero travel resumed|Hero travel publication held|Hero proxy home input consumed/.test(log));
const timeline=[`[frontier] Hero crossing serial=1 region=0_0 target=1_0 `,
 `[frontier] Hero save held serial=1 region=0_0 clock=${input.sourceClock} `,
 `[streaming] Selected hero retired unit=${initial.unitId} agent=${initial.agentId} `,
 `[frontier] Hero generation request consumed serial=1 source=0_0 target=1_0 bytes=${g.request.requestSize} `,
 '[frontier] Session released serial=1 region=0_0 roots-freed=1,1,1,1,1,1,1,1',
 '[frontier] Session release observer removed serial=1 ',
 '[frontier] Region 1_0 connected generation extent cells=128,128 ',
 '[frontier] Session attached serial=1 region=1_0 mode=new ',
 '[frontier] Hero generation held serial=1 source=0_0 target=1_0 clock=0 ',
 '[frontier] Hero generation initialized serial=1 source=0_0 target=1_0 clock=100 ',
 '[frontier] Hero generation stable serial=1 target=1_0 clock=100 '];
const positions=timeline.map(line=>{assert.equal(log.split(line).length-1,1,line);return log.indexOf(line);});
assert.deepEqual(positions,[...positions].sort((a,b)=>a-b));
assert.ok(g.stable.boundaries>=8&&g.stable.elapsedNs>=1e9);assert.equal(g.stable.clock,100);
const content='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256;
for(const [key,text,row] of [['0_0',g.sourceNativeManifest,g.captured],['1_0',g.targetNativeManifest,g.generated]]){
 const names=realmFiles(key),manifest=parseRealmManifest(text,content);
 assert.equal(await readFile(join(m.fixture,'frontier_'+key,names.marker),'utf8'),repeat&&key==='1_0'?g.repeatedGeneration.sourceNativeManifest:arrived&&key==='1_0'?g.arrival.activeNativeManifest:text);
 assert.equal(row.filename,join(m.fixture,'frontier_'+key,'Documents/My Games/MajestyHD/SaveGame',repeat&&key==='1_0'?'Hero_Generation_Initialized.GMP':names.slots[manifest.slot]));
 await bound(row);assert.equal(manifest.size,row.bytes);assert.equal(manifest.sha256,row.sha256);
}
await bound(g.retired);
await bound(g.coldGenerated);
const coldManifest=parseRealmManifest(g.coldTargetNativeManifest,content),warmManifest=parseRealmManifest(g.targetNativeManifest,content);
assert.notEqual(coldManifest.slot,warmManifest.slot);assert.equal(coldManifest.size,g.coldGenerated.bytes);assert.equal(coldManifest.sha256,g.coldGenerated.sha256);
assert.equal(g.coldGenerated.filename,join(m.fixture,'frontier_1_0','Documents/My Games/MajestyHD/SaveGame',arrived?'Hero_Generation_Cold.GMP':realmFiles('1_0').slots[coldManifest.slot]));
assert.notEqual(g.coldGenerated.sha256,g.generated.sha256);
const captured=await stoppedFileSource(g.captured.filename),retired=await stoppedFileSource(g.retired.filename),generated=await stoppedFileSource(g.generated.filename);
assert.equal(await checkpointSavedClock(captured),input.sourceClock);assert.equal(await checkpointSavedClock(retired),input.sourceClock);
assert.equal(await checkpointSavedClock(generated),100);assert.equal(await checkpointSavedClock(await stoppedFileSource(g.coldGenerated.filename)),0);
await verifyRegisteredHeroSnapshot(g.identity,input.sourceAlias,input.homeAlias,captured,true,'0_0');
await verifyRegisteredHeroSnapshot(g.identity,input.sourceAlias,input.homeAlias,retired,false,'0_0');
assert.equal((await checkpointAbsentAgentReferences(retired,initial.agentId)).sites.length,0);
assert.deepEqual(await requireCheckpointHeroCrossing(captured,m.runtimeBinding,g.crossing),g.travel);
const sourceGeometry=await requireCheckpointHaloLayout(captured,'0_0','halo-v1'),generatedGeometry=await requireCheckpointHaloLayout(generated,'1_0','halo-v1');
const coldGeometry=await requireCheckpointHaloLayout(await stoppedFileSource(g.coldGenerated.filename),'1_0','halo-v1');
assert.deepEqual(coldGeometry,generatedGeometry);
const stats={},store=new HeroRouteStore(await stoppedHeroRouteStorage(m.publicationJournal,stats),g.identity,g.identity.contentDigest);
let arrivalEvidence;
if(arrived){
 const a=g.arrival,ready=parseNativeHeroArrivalReady(a.ready),home={kind:'proxy',unitId:0,agentId:ready.homeAgentId},alias={unitId:ready.unitId,agentId:ready.agentId};
 for(const row of [a.home,a.pack,a.staged.manifest,a.active,a.continued])await bound(row);
 const manifest=parseRealmManifest(a.activeNativeManifest,content);assert.equal(manifest.size,a.active.bytes);assert.equal(manifest.sha256,a.active.sha256);
 assert.equal(a.active.filename,join(m.fixture,'frontier_1_0','Documents/My Games/MajestyHD/SaveGame',realmFiles('1_0').slots[manifest.slot]));
 assert.equal(ready.clock,100);assert.equal(ready.size,a.active.bytes);assert.equal(ready.sha256,a.active.sha256);
 assert.equal(a.originalGameplayTicks,2);assert.equal(a.continuedClock,200);assert.equal(a.unpublishedPairRefused,true);assert.equal(a.publicationRetryReadOnly,true);
 assert.equal(a.published.ownerRevision,2);assert.equal(a.published.acknowledgement,nativeHeroArrivalPublished(a.ready,a.published.ownerManifest));
 assert.equal(await readFile(join(m.fixture,'frontier_1_0/Frontier_Hero_Travel_Published.txt'),'utf8'),a.published.acknowledgement);
 const active=await stoppedFileSource(a.active.filename),continued=await stoppedFileSource(a.continued.filename);
 const importedOrders=await inspectImportedHeroOrders(a.pack,active,ready.unitId);
 assert.equal(await checkpointSavedClock(active),100);assert.equal(await checkpointSavedClock(continued),200);
 await verifyRegisteredHeroSnapshot(g.identity,alias,home,active,true,'1_0');
 await verifyRegisteredHeroSnapshot(g.identity,alias,home,continued,true,'1_0');
 assert.deepEqual(await requireCheckpointHaloLayout(active,'1_0','halo-v1'),generatedGeometry);
 assert.deepEqual(await requireCheckpointHaloLayout(continued,'1_0','halo-v1'),generatedGeometry);
 let activeQueueEntries=0;for await(const q of checkpointAgentQueues(active))if(q.type==='queued-agent'&&q.agentId===ready.agentId)activeQueueEntries++;
 assert.equal(activeQueueEntries,1);
 let continuedQueueEntries=0;for await(const q of checkpointAgentQueues(continued))if(q.type==='queued-agent'&&q.agentId===ready.agentId)continuedQueueEntries++;
 assert.equal(continuedQueueEntries,1);
 if(!repeat)await store.withOwner(async selected=>{
  assert.equal(selected.record.manifest,a.published.ownerManifest);assert.equal(selected.owner.region,'1_0');
  assert.deepEqual(selected.entry.alias,alias);assert.deepEqual(selected.entry.homeAlias,home);assert.equal(selected.entry.world.sha256,a.active.sha256);
 });
 if(!repeat)await store.withDestination('0_0',null,async selected=>{
  assert.equal(selected.record.manifest,a.published.ownerManifest);assert.deepEqual(selected.regions,['1_0','0_0']);
  assert.equal(selected.entries[0].world.sha256,a.active.sha256);assert.equal(selected.entries[1].world.sha256,g.retired.sha256);
  assert.deepEqual(selected.entries[1].alias,input.sourceAlias);assert.deepEqual(selected.entries[1].homeAlias,input.homeAlias);
  assert.equal(await checkpointSavedClock(selected.sources[1]),input.sourceClock);
 });
 const tail=[`[frontier] Hero travel arrival ready source=${initial.unitId}/${initial.agentId} source-clock=${input.sourceClock} region=1_0 hero=${ready.unitId} agent=${ready.agentId} home=${ready.homeAgentId} clock=100 `,
  '[frontier] Hero proxy home input consumed serial=1 source=0_0 target=1_0 ',`[frontier] Hero travel publication held receipt=${a.ready} `,
  '[frontier] Hero travel publication refused serial=1 region=1_0 clock=100 ',
  '[frontier] Hero travel publication accepted serial=1 region=1_0 clock=100 ',
  `[frontier] Hero travel resumed serial=1 region=1_0 unit=${ready.unitId} agent=${ready.agentId} home=proxy/0/${ready.homeAgentId} clock=100 `,
  '[frontier] Hero generated neighbor gameplay held serial=1 region=1_0 '];
 const order=tail.map(line=>{assert.equal(log.split(line).length-1,1,line);return log.indexOf(line);});assert.deepEqual(order,[...order].sort((a,b)=>a-b));assert.ok(order[0]>positions.at(-1));
 const staged=JSON.parse(await readFile(a.staged.manifest.filename,'utf8'));
 assert.equal(staged.destinationNativeManifest,g.targetNativeManifest);assert.equal(staged.ownerManifest,input.ownerManifest);
 assert.equal(staged.sourceClock,input.sourceClock);assert.equal(staged.destinationClock,100);assert.equal(staged.home.admission,'reserve-new');
 arrivalEvidence={active:a.active,continued:a.continued,owner:alias,home,registeredArrivalAndContinuedVerified:true,selectedActiveAndRetiredPairVerified:true,activeQueueEntries,continuedQueueEntries,
  importedOrders,originalGameplayTicks:2,continuedClock:200,unpublishedPairRefused:true,ownerManifest:a.published.ownerManifest};
}else{
 await store.withOwner(async selected=>{
  assert.equal(selected.record.manifest,input.ownerManifest);assert.equal(selected.owner.region,'0_0');
  assert.deepEqual(selected.entry.alias,input.sourceAlias);assert.deepEqual(selected.entry.homeAlias,input.homeAlias);
  assert.equal(selected.entry.world.sha256,g.captured.sha256);
 });
 await assert.rejects(store.withDestination('1_0',null,()=>assert.fail('New kingdom already selected in custody')),
  /Unvisited hero route region needs a stopped candidate/);
}
assert.equal(stats.writes??0,0);
const extra=g.additionalGenerations??[],journeys=m.generatedNeighborJourneys??(repeat?2:1),three=journeys>=3;
const journeyRegions=['0_0','1_0','1_-1','0_-1','-1_-1','-2_-1','-3_-1','-4_-1','-5_-1'];
assert.ok(Number.isInteger(journeys)&&journeys>=1&&journeys<=8);
assert.equal(extra.length,Math.max(0,journeys-2));
if(three)assert.equal(m.nativeThreeGeneratedNeighborArrivalsQualified,true);
const repeatedEvidence=repeat?await inspectRepeatedGeneration(g.repeatedGeneration,g.arrival,2,journeys===2):undefined;
const additionalEvidence=[];
for(let serial=3;serial<=journeys;serial++)additionalEvidence.push(await inspectRepeatedGeneration(extra[serial-3],serial===3?g.repeatedGeneration:extra[serial-4],serial,serial===journeys));
const entryReservations=arrived&&log.includes('[frontier] Hero entry reserved ')?
 await inspectEntryReservations([g,...(repeat?[g.repeatedGeneration]:[]),...extra]):[];
const navigationDeferrals=arrived?await inspectNavigationDeferrals([{...g,...g.arrival},...(repeat?[g.repeatedGeneration]:[]),...extra]):[];
assert.equal(stats.writes??0,0);
const peakRssBytes=Math.max(...m.resourceSamples.map(r=>r.rssBytes));assert.ok(peakRssBytes<=m.rssCeilingBytes);
// Original guest-heap occupancy after unload is distinct from process RSS.
// Check all releases, and retain the series rather than infer a plateau from
// a short run or from the eight large roots being freed.
const unloadMemory=[...log.matchAll(/^\[frontier\] Session released serial=(\d+) region=(\S+) roots-freed=1,1,1,1,1,1,1,1 terrain-bytes=530456 spatial-bytes=524288 heap-before=(\d+) heap-after=(\d+) blocks-before=(\d+) blocks-after=(\d+) clock=0$/gm)].map(r=>({
 serial:Number(r[1]),region:r[2],heapBeforeBytes:Number(r[3]),heapAfterBytes:Number(r[4]),
 blocksBefore:Number(r[5]),blocksAfter:Number(r[6])}));
assert.equal(unloadMemory.length,journeys);
for(const [index,row]of unloadMemory.entries()){
 assert.equal(row.serial,index+1);assert.equal(row.region,journeyRegions[index]);
 assert.ok(row.heapBeforeBytes-row.heapAfterBytes>=530456+524288);
 assert.ok(row.blocksBefore>row.blocksAfter);
}
const unloadedHeapGrowthBytes=unloadMemory.at(-1).heapAfterBytes-unloadMemory[0].heapAfterBytes;
await writeFile(outName,JSON.stringify({version:1,nativeFreshRegionGenerationQualified:true,manifest:await descriptor(manifestName),
 nativeFreshRegionInitializationQualified:true,originalInitializationTicks:2,coldGenerated:g.coldGenerated,coldGeometry,
 request:g.preservedRequest,captured:g.captured,retired:g.retired,generated:g.generated,sourceClock:input.sourceClock,generatedClock:100,
 sourceGeometry,generatedGeometry,sharedVertices:generatedGeometry.sharedVertices,registeredSourceRetirementVerified:true,
 retiredAgentReferences:0,allEightSourceRootsReleased:true,selectedOwnerRemainsCapturedSource:!arrived,refusedRequests:6,
 stablePausedBoundaries:g.stable.boundaries,stableElapsedNs:g.stable.elapsedNs,originalPausedInputUsed:true,
 nativeElapsedMs:m.finishedAtMs-m.startedAtMs,peakAggregateRssBytes:peakRssBytes,unloadMemory,unloadedHeapGrowthBytes,compiledInputs:54,
 entryReservations,freshEntryReservationQualified:entryReservations.length===journeys,
 navigationDeferrals,readOnlyPathGoalDeferralObserved:navigationDeferrals.length>0,
 nativeGeneratedNeighborArrivalQualified:arrived,arrival:arrivalEvidence,repeatedGeneration:repeatedEvidence,
 nativeRepeatedGeneratedNeighborArrivalQualified:repeat,additionalGenerations:additionalEvidence,
 nativeThreeGeneratedNeighborArrivalsQualified:three,qualifiedGeneratedNeighborJourneys:journeys,
 heroImported:arrived,ownerTransferred:arrived,browserUsed:false,liveOPFSQualified:false,sustainedBrowserMemoryQualified:false,
 continuousExpansionQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeFreshRegionGenerationQualified:true,nativeFreshRegionInitializationQualified:true,nativeGeneratedNeighborArrivalQualified:arrived,generatedClock:100,sharedVertices:generatedGeometry.sharedVertices,refusedRequests:6,peakRssBytes}));

// Compare every serialized order byte, including an in-flight Move leaf, with
// the actual original-engine arrival save. Only its newly assigned unit ID
// changes after the bounded stopped capsule was prepared.
async function inspectImportedHeroOrders(packRow,active,unitId){
 assert.ok(packRow.bytes>=96&&packRow.bytes<=256*1024);
 const bytes=await readFile(packRow.filename);assert.equal(bytes.length,packRow.bytes);
 let at=48,expected;
 for(let kind=0;kind<4;kind++){
  assert.ok(at+12<=bytes.length);assert.equal(bytes.readUInt32LE(at),kind);
  const size=bytes.readUInt32LE(at+8);assert.ok(size>=56&&size<=65536&&at+12+size<=bytes.length);
  if(kind===3)expected=Buffer.from(bytes.subarray(at+12,at+12+size));at+=12+size;
 }
 assert.equal(at,bytes.length);assert.equal(expected.readUInt32LE(0),100000);expected.writeUInt32LE(unitId,0);
 let saved;
 for await(const record of checkpointAttachments(active))if(record.kind==='ORDR'&&record.unitId===unitId){
  assert.equal(saved,undefined);assert.equal(record.size,expected.length);const blocks=[];
  for(let offset=0;offset<record.size;offset+=4096){
   const size=Math.min(4096,record.size-offset),block=await active.readAt(record.offset+offset,size);
   assert.equal(block.length,size);blocks.push(Buffer.from(block));
  }saved=Buffer.concat(blocks);
 }
 assert.ok(saved);assert.deepEqual(saved,expected);
 const banks=[],entries=[];
 for await(const row of checkpointActorOrderEntries(active,unitId)){
  if(row.type==='bank')banks.push(row.count);
  if(row.type==='entry')entries.push({bank:row.bank,index:row.index,kind:row.kind});
 }
 const moving=JSON.stringify(banks)==='[2,1,0]';
 assert.deepEqual(banks,moving?[2,1,0]:[1,1,0]);
 assert.deepEqual(entries,moving?[{bank:0,index:0,kind:2},{bank:0,index:1,kind:4},{bank:1,index:0,kind:7}]:
  [{bank:0,index:0,kind:4},{bank:1,index:0,kind:7}]);
 return {serializedBytes:saved.length,allImportedOrderBytesVerified:true,banks,entries,inFlightMovePreserved:moving};
}

// The original route remains in the source when its absolute Path4 goal cannot
// be represented in the apparent neighboring crossing. Authenticate the live
// observation against the current owner's prior arrival and later real crossing.
async function inspectNavigationDeferrals(legs){
 const rows=[...log.matchAll(/^\[frontier\] Hero boundary deferred region=(\S+) target=(\S+) unit=(\d+) agent=(\d+) clock=(\d+) goal=(-?\d+),(-?\d+) original-orders-preserved=1 original-gameplay-continues=1 phase=3 pending=0$/gm)],out=[],samples=new Map();
 assert.ok(rows.length<=legs.length*4);
 for(const r of rows){
  const index=legs.findIndex(leg=>leg.crossing.region===r[1]);assert.ok(index>=0);
  const leg=legs[index],prior=index?parseNativeHeroArrivalReady(legs[index-1].ready):initial;
  const source=haloRegionLayout(r[1]),target=haloRegionLayout(r[2]),goal={x:Number(r[6]),y:Number(r[7])};
  assert.ok(goal.x>=0&&goal.x<4096&&goal.y>=0&&goal.y<4096);
  const dx=source.native.originX-target.native.originX,dy=source.native.originY-target.native.originY;
  assert.equal(Math.abs(dx)+Math.abs(dy),3968);
  const projected={x:goal.x+dx,y:goal.y+dy};assert.ok(projected.x<0||projected.y<0||projected.x>=4096||projected.y>=4096);
  assert.equal(Number(r[3]),prior.unitId);assert.equal(Number(r[4]),prior.agentId);
  const clock=Number(r[5]);assert.ok(clock>=(index?legs[index-1].continuedClock:initial.clock)&&clock<leg.crossing.clock);
  const next=log.indexOf(`[frontier] Hero crossing serial=${leg.crossing.serial} region=${r[1]} `);
  assert.ok(next>r.index);const count=(samples.get(r[1])??0)+1;samples.set(r[1],count);assert.ok(count<=4);
  let sameGoal=false;
  for await(const point of checkpointActorOrderNavigation(await stoppedFileSource(leg.captured.filename),leg.crossing.unitId))
   if(point.kind===4&&point.field==='destination'&&point.x===goal.x&&point.y===goal.y)sameGoal=true;
  out.push({sourceRegion:r[1],deferredTarget:r[2],unitId:Number(r[3]),agentId:Number(r[4]),clock,goal,projected,
   nextCrossingSerial:leg.crossing.serial,nextCrossingTarget:leg.crossing.target,nextCrossingClock:leg.crossing.clock,
   nativeGameplayContinued:true,originalGoalPresentAtNextCrossing:sameGoal});
 }
 return out;
}

async function inspectRepeatedGeneration(second,priorJourney,serial,finalJourney){
 const prior=parseNativeHeroArrivalReady(priorJourney.ready),sourceRegion=journeyRegions[serial-1],
  targetRegion=journeyRegions[serial],b=parseHeroRuntimeBinding(second.runtimeBinding),
  request=JSON.parse(second.request.requestManifest),ready=parseNativeHeroArrivalReady(second.ready);
 assert.equal(second.nativeGeneratedArrivalGameplayObserved,true);assert.equal(second.targetWasAbsentBeforeAction,true);
 assert.equal(b.region,sourceRegion);assert.equal(b.clock,prior.clock);assert.equal(b.sha256,priorJourney.active.sha256);
 assert.equal(b.unitId,prior.unitId);assert.equal(b.agentId,prior.agentId);assert.equal(b.homeKind,'proxy');
 assert.equal(b.homeAgentId,prior.homeAgentId);assert.equal(b.homeUnitId,0);
 assert.equal(request.kind,'majesty-hero-generation-input-v1');assert.equal(request.version,1);assert.equal(request.serial,serial);
 assert.equal(request.sourceRegion,sourceRegion);assert.equal(request.targetRegion,targetRegion);assert.equal(request.sourceClock,second.crossing.clock);
 assert.deepEqual(request.sourceAlias,{unitId:b.unitId,agentId:b.agentId});
 assert.deepEqual(request.homeAlias,{kind:'proxy',unitId:0,agentId:b.homeAgentId});
 assert.equal(request.sourceNativeManifest,second.sourceNativeManifest);assert.equal(request.ownerManifest,second.publication.ownerManifest);
 assert.equal(second.publication.ownerRevision,serial*2-1);assert.equal(second.published.ownerRevision,serial*2);
 assert.deepEqual(request.generation,{layout:'halo-v1',seed:nativeRegionGenerationSeed(targetRegion),nativeCells:128,coreCells:124});
 assert.equal(second.request.nativeAction,'frontier-hero-generate-'+serial);assert.equal(second.request.nativeActionIssued,false);
 assert.equal(second.request.requestSize,second.preservedRequest.bytes);assert.equal(second.request.requestSha256,second.preservedRequest.sha256);
 assert.equal(await readFile(second.preservedRequest.filename,'utf8'),second.request.requestManifest);
 for(const row of [second.preservedRequest,second.captured,second.retired,second.coldGenerated,second.generated,
   second.home,second.pack,second.staged.manifest,second.active,second.continued])await bound(row);
 const source=await stoppedFileSource(second.captured.filename),retired=await stoppedFileSource(second.retired.filename),
  cold=await stoppedFileSource(second.coldGenerated.filename),warm=await stoppedFileSource(second.generated.filename),
  active=await stoppedFileSource(second.active.filename),continued=await stoppedFileSource(second.continued.filename);
 const importedOrders=await inspectImportedHeroOrders(second.pack,active,ready.unitId);
 assert.ok(second.crossing.clock>200);assert.equal(second.crossing.unitId,prior.unitId);assert.equal(second.crossing.agentId,prior.agentId);
 assert.equal(await checkpointSavedClock(source),request.sourceClock);assert.equal(await checkpointSavedClock(retired),request.sourceClock);
 assert.deepEqual(await requireCheckpointHeroCrossing(source,second.runtimeBinding,second.crossing),second.travel);
 await verifyRegisteredHeroSnapshot(g.identity,request.sourceAlias,request.homeAlias,source,true,sourceRegion);
 await verifyRegisteredHeroSnapshot(g.identity,request.sourceAlias,request.homeAlias,retired,false,sourceRegion);
 assert.equal((await checkpointAbsentAgentReferences(retired,b.agentId)).sites.length,0);
 const initialization=await checkpointHeroGenerationInitialization(source,b.unitId,request.sourceClock),
  initializedClock=initialization.clock,playedClock=initializedClock+100;
 assert.deepEqual(second.initialization,initialization);
 assert.equal(await checkpointSavedClock(cold),0);assert.equal(await checkpointSavedClock(warm),initializedClock);
 assert.equal(await checkpointSavedClock(active),initializedClock);assert.equal(await checkpointSavedClock(continued),playedClock);
 const sourceGeometry=await requireCheckpointHaloLayout(source,sourceRegion,'halo-v1');
 assert.deepEqual(await requireCheckpointHaloLayout(retired,sourceRegion,'halo-v1'),sourceGeometry);
 const targetGeometry=await requireCheckpointHaloLayout(cold,targetRegion,'halo-v1');
 for(const snapshot of [warm,active,continued])assert.deepEqual(await requireCheckpointHaloLayout(snapshot,targetRegion,'halo-v1'),targetGeometry);
 for(const [key,manifest,row]of [[sourceRegion,second.sourceNativeManifest,second.captured],[targetRegion,second.targetNativeManifest,second.generated],
  [targetRegion,second.activeNativeManifest,second.active]]){
  const parsed=parseRealmManifest(manifest,content);assert.equal(parsed.size,row.bytes);assert.equal(parsed.sha256,row.sha256);
  assert.equal(row.filename,join(m.fixture,'frontier_'+key,'Documents/My Games/MajestyHD/SaveGame',row===second.generated&&!finalJourney?'Hero_Generation_Initialized.GMP':realmFiles(key).slots[parsed.slot]));
 }
 assert.equal(await readFile(join(m.fixture,'frontier_'+targetRegion,realmFiles(targetRegion).marker),'utf8'),finalJourney?second.activeNativeManifest:extra[serial-2].sourceNativeManifest);
 assert.equal(ready.serial,serial);assert.equal(ready.region,targetRegion);assert.equal(ready.clock,initializedClock);
 assert.equal(ready.size,second.active.bytes);assert.equal(ready.sha256,second.active.sha256);
 const alias={unitId:ready.unitId,agentId:ready.agentId},home={kind:'proxy',unitId:0,agentId:ready.homeAgentId};
 await verifyRegisteredHeroSnapshot(g.identity,alias,home,active,true,targetRegion);
 await verifyRegisteredHeroSnapshot(g.identity,alias,home,continued,true,targetRegion);
 let activeQueueEntries=0,continuedQueueEntries=0;
 for await(const q of checkpointAgentQueues(active))if(q.type==='queued-agent'&&q.agentId===ready.agentId)activeQueueEntries++;
 for await(const q of checkpointAgentQueues(continued))if(q.type==='queued-agent'&&q.agentId===ready.agentId)continuedQueueEntries++;
 assert.equal(activeQueueEntries,1);assert.equal(continuedQueueEntries,1);
 const contexts=async(checkpoint,id)=>{
  const result=[];
  for await(const value of checkpointAgentValues(checkpoint,id))if(value.type===8){
   assert.ok(result.length<64);const bytes=await checkpoint.readAt(value.stateOffset,16),v=new DataView(bytes.buffer,bytes.byteOffset,16);
   result.push({attribute:value.attribute,path:value.path,delay:v.getUint32(0,true),stamp:v.getUint32(4,true),
    flags:v.getUint32(8,true),remainder:v.getUint32(12,true),flag:value.flag,functions:value.functions.map(f=>({slot:f.slot,name:f.name}))});
  }return result;
 };
 const beforeContexts=await contexts(source,prior.agentId),afterContexts=await contexts(active,ready.agentId);
 assert.equal(beforeContexts.length,initialization.contexts);
 const expectedContexts=beforeContexts.map(c=>({...c,stamp:(c.flags&0x7f)&&!(c.flags&0x80)?
   (initializedClock-((request.sourceClock-c.stamp)>>>0))>>>0:c.stamp}));
 assert.deepEqual(afterContexts,expectedContexts);
 assert.ok(afterContexts.every(c=>!(c.flags&0x7f)||(c.flags&0x80)||c.stamp!==0));
 assert.equal(second.originalGameplayTicks,2);assert.equal(second.continuedClock,playedClock);assert.equal(second.publicationRetryReadOnly,true);
 assert.equal(second.published.acknowledgement,nativeHeroArrivalPublished(second.ready,second.published.ownerManifest));
 assert.equal(await readFile(join(m.fixture,'frontier_'+targetRegion+'/Frontier_Hero_Travel_Published.txt'),'utf8'),second.published.acknowledgement);
 if(finalJourney)await store.withOwner(async selected=>{
  assert.equal(selected.record.manifest,second.published.ownerManifest);assert.equal(selected.owner.region,targetRegion);
  assert.deepEqual(selected.entry.alias,alias);assert.deepEqual(selected.entry.homeAlias,home);assert.equal(selected.entry.world.sha256,second.active.sha256);
 });
 if(finalJourney)for(const [region,row,clock,sourceAlias,sourceHome]of [
  ...[g.repeatedGeneration,...extra].filter(leg=>leg.crossing.serial<serial).map(leg=>[
    leg.crossing.region,leg.retired,leg.crossing.clock,JSON.parse(leg.request.requestManifest).sourceAlias,
    JSON.parse(leg.request.requestManifest).homeAlias]),
  [sourceRegion,second.retired,request.sourceClock,request.sourceAlias,request.homeAlias],
  ['0_0',g.retired,input.sourceClock,input.sourceAlias,input.homeAlias]])await store.withDestination(region,null,async selected=>{
   assert.equal(selected.record.manifest,second.published.ownerManifest);assert.deepEqual(selected.regions,[targetRegion,region]);
   assert.equal(selected.entries[0].world.sha256,second.active.sha256);assert.equal(selected.entries[1].world.sha256,row.sha256);
   assert.deepEqual(selected.entries[1].alias,sourceAlias);assert.deepEqual(selected.entries[1].homeAlias,sourceHome);
   assert.equal(await checkpointSavedClock(selected.sources[1]),clock);
  });
 const staged=JSON.parse(await readFile(second.staged.manifest.filename,'utf8'));
 assert.equal(staged.serial,serial);assert.equal(staged.ownerManifest,request.ownerManifest);
 assert.equal(staged.sourceNativeManifest,second.sourceNativeManifest);assert.equal(staged.destinationNativeManifest,second.targetNativeManifest);
 assert.equal(staged.destinationClock,initializedClock);assert.equal(staged.sourceClock,request.sourceClock);assert.equal(staged.home.admission,'reserve-new');
 const sequence=[
  `[frontier] Hero generated exploration continued serial=${serial-1} region=${sourceRegion} clock=${priorJourney.continuedClock} `,
  `[frontier] Hero crossing serial=${serial} region=${sourceRegion} target=${targetRegion} `,
  `[frontier] Hero save held serial=${serial} region=${sourceRegion} clock=${request.sourceClock} `,
  `[streaming] Selected hero retired unit=${prior.unitId} agent=${prior.agentId} `,
  `[frontier] Hero generation request consumed serial=${serial} source=${sourceRegion} target=${targetRegion} `,
  `[frontier] Session released serial=${serial} region=${sourceRegion} roots-freed=1,1,1,1,1,1,1,1`,
  `[frontier] Session release observer removed serial=${serial} `,
  `[frontier] Region ${targetRegion} connected generation extent cells=128,128 `,
  `[frontier] Session attached serial=${serial} region=${targetRegion} mode=new `,
  `[frontier] Hero generation held serial=${serial} source=${sourceRegion} target=${targetRegion} clock=0 `,
  `[frontier] Hero generation initialized serial=${serial} source=${sourceRegion} target=${targetRegion} clock=${initializedClock} `,
  `[frontier] Hero generation stable serial=${serial} target=${targetRegion} clock=${initializedClock} `,
  `[frontier] Hero travel arrival ready source=${prior.unitId}/${prior.agentId} source-clock=${request.sourceClock} region=${targetRegion} hero=${ready.unitId} `,
  `[frontier] Hero proxy home input consumed serial=${serial} source=${sourceRegion} target=${targetRegion} `,
  `[frontier] Hero travel publication held receipt=${second.ready} `,
  `[frontier] Hero travel publication accepted serial=${serial} region=${targetRegion} clock=${initializedClock} `,
  `[frontier] Hero travel resumed serial=${serial} region=${targetRegion} `,
  `[frontier] Hero generated neighbor gameplay held serial=${serial} region=${targetRegion} `];
 const order=sequence.map(line=>{assert.equal(log.split(line).length-1,1,line);return log.indexOf(line);});
 assert.deepEqual(order,[...order].sort((a,b)=>a-b));
 assert.ok(order[0]>log.indexOf(`[frontier] Hero generated neighbor gameplay held serial=${serial-1} `));
 assert.equal(log.split('retained-roots=0').length-1,m.generatedNeighborJourneys??2);
 const prefixes=second.arrivalPlan.heroOrders.haloNavigation.consumedPathPrefixes;
 if(serial===2){assert.equal(prefixes.length,1);assert.equal(prefixes[0].removedPoints,1);}
 const nav=async(s,id)=>{const result=[];for await(const p of checkpointActorOrderNavigation(s,id)){
   assert.ok(result.length<256);result.push(p);
  }return result;};
 const oldNav=await nav(source,prior.unitId),newNav=await nav(active,ready.unitId);
 const verifiedPrefixes=[];
 for(const p of prefixes){const oldHeader=oldNav.find(r=>r.type==='navigation'&&r.bank===p.bank&&r.index===p.index),
  newHeader=newNav.find(r=>r.type==='navigation'&&r.bank===p.bank&&r.index===p.index);
 assert.equal(oldHeader.kind,4);assert.equal(newHeader.kind,4);
 assert.equal(oldHeader.cursor,p.sourceCursor);assert.equal(oldHeader.count,p.sourceCount);
 assert.equal(newHeader.cursor,p.destinationCursor);assert.equal(newHeader.count,p.destinationCount);
 assert.equal(oldHeader.capacity,newHeader.capacity);
 const oldPoints=oldNav.filter(r=>r.bank===p.bank&&r.index===p.index&&r.field==='waypoint').slice(p.removedPoints),
  newPoints=newNav.filter(r=>r.bank===p.bank&&r.index===p.index&&r.field==='waypoint');
 assert.deepEqual(newPoints.map(r=>[r.x,r.y]),oldPoints.map(r=>[r.x+(Number(sourceRegion.split('_')[0])-Number(targetRegion.split('_')[0]))*248,
   r.y+(Number(sourceRegion.split('_')[1])-Number(targetRegion.split('_')[1]))*248]));verifiedPrefixes.push(p);}
 return {qualified:true,crossing:second.crossing,sourceGeometry,targetGeometry,sourceClock:request.sourceClock,
  generatedClocks:[0,initializedClock],arrivalClock:initializedClock,continuedClock:playedClock,originalInitializationTicks:initialization.ticks,originalGameplayTicks:2,
  allEightSourceRootsReleased:true,retiredAgentReferences:0,activeQueueEntries,continuedQueueEntries,
  owner:alias,home,ownerRevision:serial*2,allDormantWorldsSelectedAndRegistered:finalJourney,
  schedulingContexts:afterContexts.length,allOriginalContextAgesAndFieldsVerified:true,initialization,
  importedOrders,consumedPathPrefixes:verifiedPrefixes,originalActivePathCursorAndRemainingPointsVerified:true,source:second.captured,retired:second.retired,
  cold:second.coldGenerated,generated:second.generated,active:second.active,continued:second.continued,
  browserUsed:false,sustainedMemoryQualified:false,goalComplete:false};
}

async function inspectEntryReservations(legs){
 const lines=log.split('\n'),results=[];
 function one(prefix,pattern){const rows=lines.filter(line=>line.startsWith(prefix));assert.equal(rows.length,1,prefix);
  const match=pattern.exec(rows[0]);assert.ok(match,rows[0]);return {line:rows[0],match};}
 assert.equal(lines.filter(line=>line.startsWith('[frontier] Hero entry reserved ')).length,legs.length);
 for(const leg of legs){
  const request=JSON.parse(leg.request.requestManifest),ready=parseNativeHeroArrivalReady(leg.ready??leg.arrival.ready),
   {sourceRegion,targetRegion,sourceClock,sourceAlias}=request;
  const source=one(`[streaming] Hero source entry bounds hero=${sourceAlias.unitId} agent=${sourceAlias.agentId} `,
   /^\[streaming\] Hero source entry bounds hero=\d+ agent=\d+ grid=(\d+),(\d+) rectangle=(-?\d+),(-?\d+),(-?\d+),(-?\d+) clock=(\d+) original-formatter=005b85e0 source-held=1$/);
  assert.equal(Number(source.match[7]),sourceClock);
  const old=source.match.slice(3,7).map(Number),center=source.match.slice(1,3).map(Number);
  assert.ok(old[0]<=center[0]&&center[0]<old[2]&&old[1]<=center[1]&&center[1]<old[3]);
  const reservation=one(`[frontier] Hero entry reserved source=${sourceRegion} target=${targetRegion} `,
   /^\[frontier\] Hero entry reserved source=\S+ target=\S+ rectangle=(-?\d+),(-?\d+),(-?\d+),(-?\d+) source-pointers=0 target-absent=1$/),
   rect=reservation.match.slice(1).map(Number),a=sourceRegion.split('_').map(Number),b=targetRegion.split('_').map(Number),
   dx=(a[0]-b[0])*248,dy=(a[1]-b[1])*248;
  assert.deepEqual(rect,[old[0]+dx,old[1]+dy,old[2]+dx,old[3]+dy]);
  assert.ok(rect[0]>=0&&rect[1]>=0&&rect[2]<256&&rect[3]<256&&rect[2]>rect[0]&&rect[3]>rect[1]);
  assert.ok(rect[2]-rect[0]<=32&&rect[3]-rect[1]<=32);
  const guard=one(`[frontier] Hero entry placement guard target=${targetRegion} `,
   /^\[frontier\] Hero entry placement guard target=\S+ rectangle=(-?\d+),(-?\d+),(-?\d+),(-?\d+) empty-stores=1 original-queries=1$/);
  assert.deepEqual(guard.match.slice(1).map(Number),rect);
  const finished=one(`[frontier] Hero entry placement finished target=${targetRegion} `,
   /^\[frontier\] Hero entry placement finished target=\S+ queries=(\d+) rejected=(\d+) ground-rejected=(\d+) clock=(\d+) phase=7 pending=0 original-arrival-collision-required=1$/);
  const [queries,rejected,groundRejected,clock]=finished.match.slice(1).map(Number);
  assert.ok(queries>0);assert.equal(clock,ready.clock);
  const timeline=[source.line,reservation.line,`[streaming] Selected hero retired unit=${sourceAlias.unitId} agent=${sourceAlias.agentId} `,
   `[frontier] Session release observer removed serial=${request.serial} `,guard.line,finished.line,
   `[frontier] Hero travel arrival ready source=${sourceAlias.unitId}/${sourceAlias.agentId} source-clock=${sourceClock} region=${targetRegion} `];
  let previous=-1;for(const text of timeline){const at=log.indexOf(text);assert.ok(at>previous,text);previous=at;}
  const omissions=lines.filter(line=>line.startsWith(`[frontier] Hero entry ground placement refused target=${targetRegion} `));
  assert.equal(omissions.length,Math.min(groundRejected,8));
  const cold=await stoppedFileSource(leg.coldGenerated.filename),placements=[];
  for await(const placement of checkpointPlacements(cold))placements.push(placement);
  for(const line of omissions){
   const match=/description=([0-9a-f]{8}) grid=(\d+),(\d+) rectangle=(-?\d+),(-?\d+),(-?\d+),(-?\d+) original-formatter=1 before-construction=1 original-null-branch=004b20d7 count=(\d+)$/.exec(line);assert.ok(match);
   const key=parseInt(match[1],16),x=Number(match[2]),y=Number(match[3]),box=match.slice(4,8).map(Number);
   assert.ok(box[0]<rect[2]&&rect[0]<box[2]&&box[1]<rect[3]&&rect[1]<box[3]);
   assert.equal(placements.filter(p=>p.description===key&&p.mapPosition?.x===x*16&&p.mapPosition?.y===y*16).length,0);
   assert.ok(log.indexOf(line)>log.indexOf(guard.line)&&log.indexOf(line)<log.indexOf(finished.line));
  }
  results.push({sourceRegion,targetRegion,sourceClock,rectangle:rect,queries,rejected,groundRejected,
   skippedGroundAbsentFromOriginalColdSave:true,reservationEndsBeforeImport:true,originalArrivalCollisionPassed:true,
   retainedSourcePointers:0,browserUsed:false});
 }
 return results;
}
