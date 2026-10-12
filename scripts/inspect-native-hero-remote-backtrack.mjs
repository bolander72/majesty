#!/usr/bin/env node
// Independently check one stopped real return to a journal-selected kingdom.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {prepareSelectedHeroNeighborArrival} from '../web/world/hero-home-arrival-package.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {parseNativeHeroArrivalReady,nativeHeroArrivalPublished} from '../web/world/hero-travel-publication.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointActorRecords,
  checkpointNextAgentId,checkpointAgentQueues,checkpointUnitAgentLinks,checkpointPlacements} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointTerrain,VERTEX_BYTES} from '../web/world/terrain.mjs';
import {requireCheckpointHaloLayout} from '../web/world/halo-checkpoint-layout.mjs';

const [manifestName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-hero-remote-backtrack-\d{3}-observed\.json$/);
await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const descriptor=async filename=>{const {bytes,sha256}=await hashNativeFile(filename);return {filename:resolve(filename),bytes,sha256};};
const json=async name=>{assert.ok((await lstat(name)).size<1024*1024);return JSON.parse(await readFile(name,'utf8'));};
const bound=async row=>{
  const {filename,bytes,sha256}=row;assert.deepEqual(await descriptor(filename),{filename,bytes,sha256});
  if(row.largestRead!==undefined)assert.ok(row.largestRead<=4096);
};
const m=await json(manifestName);
for(const [key,value]of Object.entries({nativeRemoteBacktrackQualified:true,nativeSessionTerminal:true,nativeExitCode:0,
  publicationWorkerExitCode:0,ownedProducerAbsent:true,publicationWorkerAbsent:true,originalInputsUnchanged:true,
  sourceJournalUnchanged:true,copiedJournalUnchanged:false,nativeExecutableUnchanged:true,originalGMPBytesChanged:false,
  stopReason:null,browserUsed:false,nativeProcessesStarted:1,remoteBacktrack:true,goalComplete:false}))assert.equal(m[key],value,key);
for(const pid of [m.nativePid,m.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
assert.deepEqual(m.preservedBefore,m.preservedAfter);await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');
await ownedDirectory(m.journal,'actor-arrival-fixture-hero-route-');
for(const row of [m.build,m.preparation,m.script,m.copiedSource,m.savedCheckpoint,m.backtrack,m.publicationWorkerScript,...m.originalInputs])await bound(row);
assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const [name,digest]of Object.entries(m.compiledSourceSha256))assert.equal((await descriptor(name)).sha256,digest);
for(const [name,digest]of [[m.log,m.logSha256],[m.publicationLog,m.publicationLogSha256],
  ['scripts/run-native-hero-remote-backtrack.py',m.runnerSha256],['scripts/lib/native_pair_guard.py',m.guardSha256],
  ['scripts/run-native-regional-home.py',m.supervisorSha256],[join(m.fixture,'native/recomp/pop_smoke'),m.nativeExecutableSha256]])
  assert.equal((await descriptor(name)).sha256,digest);
const prep=await json(m.preparation.filename),proof=await json(m.backtrack.filename),identity=await json(prep.identity.filename);
assert.equal(prep.progressedHeldOwnerPublished,true);assert.equal(prep.sourceOwnerRevision,17);assert.equal(prep.clock,18000);
for(const row of [proof.captured,proof.pack,proof.proxyRecord,proof.retired,proof.active,proof.playedCheckpoint])await bound(row);
assert.equal(proof.captured.filename,m.savedCheckpoint.filename);assert.equal(proof.captured.sha256,m.savedCheckpoint.sha256);
assert.equal(proof.captured.bytes,m.savedCheckpoint.bytes);assert.equal(proof.publication.ownerRevision,18);
assert.equal(proof.nativeRemoteBacktrackCompleted,true);assert.equal(proof.newRouteAfterArrivalIssued,false);
assert.equal(proof.browserUsed,false);assert.equal(proof.liveOPFSQualified,false);
const hashes={};for(const name of (await readdir(prep.sourceJournal)).sort()){
  const p=join(prep.sourceJournal,name),s=await lstat(p);assert.ok(s.isFile()&&!s.isSymbolicLink());hashes[name]=(await descriptor(p)).sha256;
}assert.deepEqual(hashes,m.sourceJournalBefore);
const initialStats={},finalStats={},originalStore=new HeroRouteStore(await stoppedHeroRouteStorage(prep.sourceJournal,initialStats),identity,identity.contentDigest),
  finalStore=new HeroRouteStore(await stoppedHeroRouteStorage(m.journal,finalStats),identity,identity.contentDigest);
const before=await originalStore.withOwner(async s=>({record:s.record,entry:s.entry}));assert.equal(before.record.revision,17);
const ready=parseNativeHeroArrivalReady(proof.ready),alias={unitId:ready.unitId,agentId:ready.agentId},home={kind:'proxy',unitId:0,agentId:ready.homeAgentId};
assert.equal(ready.serial,1);assert.equal(ready.region,'-4_-1');assert.equal(ready.clock,88600);
assert.deepEqual(proof.receipt.owner,alias);assert.deepEqual(proof.receipt.home,home);assert.equal(proof.receipt.ownerRevision,19);
assert.equal(proof.receipt.acknowledgement,nativeHeroArrivalPublished(proof.ready,proof.receipt.ownerManifest));
assert.equal(await readFile(join(m.fixture,'frontier_-4_-1/Frontier_Hero_Travel_Published.txt'),'utf8'),proof.receipt.acknowledgement);
const capture=await stoppedFileSource(proof.captured.filename),retired=await stoppedFileSource(proof.retired.filename),
  active=await stoppedFileSource(proof.active.filename),played=await stoppedFileSource(proof.playedCheckpoint.filename);
assert.equal(await checkpointSavedClock(capture),18850);assert.equal(await checkpointSavedClock(retired),18850);
assert.equal(await checkpointSavedClock(active),88600);assert.equal(await checkpointSavedClock(played),88900);
await verifyRegisteredHeroSnapshot(identity,before.entry.alias,before.entry.homeAlias,capture,true,'-5_-1');
await verifyRegisteredHeroSnapshot(identity,before.entry.alias,before.entry.homeAlias,retired,false,'-5_-1');
for(const s of [active,played])await verifyRegisteredHeroSnapshot(identity,alias,home,s,true,'-4_-1');
let prepared,destinationFile,destinationEntry;
await originalStore.withDestination('-4_-1',null,async s=>{
  destinationEntry=s.entries[1];assert.deepEqual(destinationEntry,proof.destinationEntry);
  destinationFile=join(prep.sourceJournal,`Frontier_Hero_Route_-4_-1_${destinationEntry.slot}.GMP`);
  assert.equal((await descriptor(destinationFile)).sha256,destinationEntry.world.sha256);
  // Rebuild solely from the actual held crossing and the original dormant save.
  const selection={...s,sources:[capture,s.sources[1]]};
  prepared=await prepareSelectedHeroNeighborArrival(identity,selection,proof.crossing);
});
assert.deepEqual(await readFile(proof.pack.filename),Buffer.from(prepared.pack));
assert.notEqual(alias.unitId,destinationEntry.alias.unitId);assert.notEqual(alias.agentId,destinationEntry.alias.agentId);
assert.notEqual(alias.unitId,before.entry.alias.unitId);assert.deepEqual(home,destinationEntry.homeAlias);
const targetProfile=join(m.fixture,'frontier_-4_-1'),targetSave=join(targetProfile,'Documents/My Games/MajestyHD/SaveGame'),
  targetBefore=await stoppedFileSource(join(targetSave,'Hero_Travel_Home_Held.GMP')),
  dormant=await stoppedFileSource(destinationFile);
assert.equal((await descriptor(join(targetSave,'Frontier_-4_-1.GMP'))).sha256,destinationEntry.world.sha256);
assert.equal(await checkpointNextAgentId(targetBefore),alias.agentId);assert.equal(await checkpointNextAgentId(active),alias.agentId+1);
const nativeMap=new Map([[100000,alias.unitId]]),agentMap=new Map([[1000,alias.agentId],[home.agentId,home.agentId]]);
const observations={unit:'Hero_Arrival_Arrival_Unit_Observed.UNIT',agent:'Hero_Arrival_Arrival_Agent_Observed.GPL',
  container:'Hero_Arrival_Arrival_Container_Observed.bin',order:'Hero_Arrival_Arrival_Orders_Observed.bin'};
assert.equal(prepared.packDescriptors.length,4);
const offsets={};let at=48;
for(const name of ['unit','agent','container','order']){offsets[name]=at+12;at+=12+prepared.packDescriptors.find(d=>d.name===name).bytes;}
let importedRecords=0;
for(const name of ['unit','agent','container','order']){
  const size=prepared.packDescriptors.find(d=>d.name===name).bytes,b=Buffer.from(prepared.pack.slice(offsets[name],offsets[name]+size));
  const put=(offset,map)=>{const v=b.readUInt32LE(offset);assert.ok(map.has(v));b.writeUInt32LE(map.get(v),offset);};
  if(name==='unit'){put(36,nativeMap);for(const e of prepared.plan.edits)if(e.record==='unit'&&e.reason==='native script association')put(e.offset-prepared.plan.ranges.unit.offset,agentMap);}
  else if(name==='agent'){for(const e of prepared.plan.edits)if(e.record==='agent'){
    if(e.reason==='script identity'||e.reason.startsWith('script:'))put(e.offset-prepared.plan.ranges.agent.offset,agentMap);
    else if(e.reason==='script native association')put(e.offset-prepared.plan.ranges.agent.offset,nativeMap);}}
  else if(name==='container')for(const n of [0,56,72])put(n,nativeMap);
  else put(0,nativeMap);
  assert.deepEqual(await readFile(join(targetProfile,observations[name])),name==='container'||name==='order'?b.subarray(36):b,name);importedRecords++;
}
async function records(s){const map=new Map(),add=(key,row)=>{assert.ok(!map.has(key)&&map.size<4096);map.set(key,row);};
  for await(const r of checkpointUnits(s))add('UNIT:'+r.primary.words[1],r);
  for await(const r of checkpointAgents(s))add('GPL:'+r.agentId,r);
  for await(const r of checkpointAttachments(s))add(r.kind+':'+r.unitId,r);return map;
}
async function exact(a,ar,b,br){assert.ok(ar&&br);assert.equal(ar.size,br.size);
  for(let at=0;at<ar.size;at+=4096){const n=Math.min(4096,ar.size-at);assert.deepEqual(await a.readAt(ar.offset+at,n),await b.readAt(br.offset+at,n));}}
const bm=await records(targetBefore),am=await records(active),pm=await records(played),rm=await records(retired),dm=await records(dormant);
const incoming=['UNIT:'+alias.unitId,'GPL:'+alias.agentId,'CONT:'+alias.unitId,'ORDR:'+alias.unitId];
assert.deepEqual([...am.keys()].sort(),[...bm.keys(),...incoming].sort());
for(const [key,row]of bm)await exact(targetBefore,row,active,am.get(key));
for(const [s,map]of [[targetBefore,bm],[active,am],[played,pm]])await exact(dormant,dm.get('GPL:'+home.agentId),s,map.get('GPL:'+home.agentId));
for(const key of ['UNIT:'+before.entry.alias.unitId,'GPL:'+before.entry.alias.agentId,'CONT:'+before.entry.alias.unitId,'ORDR:'+before.entry.alias.unitId])assert.ok(!rm.has(key));
const positions=[];
for(const s of [active,played]){
  const links=[];for await(const r of checkpointUnitAgentLinks(s))if(r.agentId===alias.agentId)links.push(r.unitId);assert.deepEqual(links,[alias.unitId]);
  const queued=[];for await(const q of checkpointAgentQueues(s)){
    assert.notEqual(q.agentId,home.agentId);if(q.agentId===alias.agentId)queued.push(q.type);}
  assert.deepEqual(queued,['queued-agent']);const actor=await checkpointActorRecords(s,alias.unitId);assert.equal(actor.agent.agentId,alias.agentId);
  const poses=[];for await(const p of checkpointPlacements(s))if(p.unitId===alias.unitId)poses.push([p.fixedPosition.x,p.fixedPosition.y,p.fixedPosition.z]);
  assert.equal(poses.length,1);positions.push(poses[0]);await requireCheckpointHaloLayout(s,'-4_-1','halo-v1');
}assert.notDeepEqual(positions[0],positions[1]);
const terrainBefore=await checkpointTerrain(dormant);
for(const s of [targetBefore,active,played]){const terrain=await checkpointTerrain(s);assert.deepEqual([terrain.width,terrain.height],[128,128]);
  for(let y=0;y<=128;y++){
    const b=Buffer.from(await dormant.readAt(terrainBefore.heightOffset(0,y),129*VERTEX_BYTES)),a=Buffer.from(await s.readAt(terrain.heightOffset(0,y),129*VERTEX_BYTES));
    for(let x=0;x<=128;x++)assert.equal(a.readUInt32LE(x*VERTEX_BYTES),b.readUInt32LE(x*VERTEX_BYTES));
  }}
const selected=await finalStore.withOwner(async s=>({record:s.record,entry:s.entry}));assert.equal(selected.record.revision,19);
assert.equal(selected.entry.region,'-4_-1');assert.deepEqual(selected.entry.alias,alias);assert.deepEqual(selected.entry.homeAlias,home);
assert.equal(selected.entry.world.sha256,proof.active.sha256);
for(const key of ['-5_-1','0_0','1_0','1_-1','0_-1','-1_-1','-2_-1','-3_-1'])await finalStore.withDestination(key,null,async s=>{
  if(key==='-5_-1')assert.equal(s.entries[1].world.sha256,proof.retired.sha256);
  else await originalStore.withDestination(key,null,async original=>assert.deepEqual(s.entries[1],original.entries[1]));
});assert.equal(initialStats.writes??0,0);assert.equal(finalStats.writes??0,0);
const log=await readFile(m.log,'utf8');assert.ok(log.length<m.logCeilingBytes&&!/invariant failed|abort from|result=fail|binding refused|load refused/.test(log));
assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
for(const text of ['Session released serial=1 region=-5_-1 roots-freed=1,1,1,1,1,1,1,1',
  'Session unloaded serial=1 source=-5_-1 target=-4_-1 world-null=1','Hero travel resumed serial=1 region=-4_-1 ',
  'Remote backtrack gameplay held region=-4_-1 '])assert.equal(log.split(text).length-1,1);
assert.equal(log.split('Hero remote home leg ').length-1,1);
assert.ok(m.resourceSamples.length&&m.resourceSamples.every(s=>s.rssBytes<=m.rssCeilingBytes));
const sourceSha256={},pending=[resolve('scripts/inspect-native-hero-remote-backtrack.mjs')];
while(pending.length){const file=pending.pop();if(sourceSha256[file])continue;assert.ok(Object.keys(sourceSha256).length<128);
  sourceSha256[file]=(await descriptor(file)).sha256;
  for(const match of (await readFile(file,'utf8')).matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(file),match[1]));}
await writeFile(outName,JSON.stringify({version:1,nativeRemoteBacktrackQualified:true,manifest:await descriptor(manifestName),sourceSha256,
  sourceRegion:'-5_-1',targetRegion:'-4_-1',sourceClock:18850,targetClock:88600,playedClock:88900,originalGameplayTicks:6,
  alias,homeAlias:home,exactPreparedPackVerified:true,exactImportedRecords:importedRecords,existingActorRecordsPreserved:bm.size,
  existingPureHomeUnchanged:true,homeUnscheduled:true,heroQueuedExactlyOnce:true,nativeBacklinkUnique:true,
  retiredSourceHeroAbsent:true,originalTerrainHeightWordsPreserved:16641,destinationBeforeArrival:await descriptor(destinationFile),
  activePose:positions[0],playedPose:positions[1],originalMovementVerified:true,ownerRevision:19,otherSevenDormantEntriesUnchanged:true,
  eightDepartedWorldRootsReleased:true,originalInputsUnchanged:true,sourceJournalUnchanged:true,independentInspectorWrites:0,
  nativeExitCode:0,publicationWorkerExitCode:0,producersAbsent:true,
  peakAggregateRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),browserUsed:false,liveOPFSQualified:false,
  continuousWorldQualified:false,sustainedMemoryQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeRemoteBacktrackQualified:true,ownerRevision:19,originalGameplayTicks:6,exactImportedRecords:importedRecords}));
