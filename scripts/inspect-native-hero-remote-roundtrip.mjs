#!/usr/bin/env node
// Check each real saved-world handoff and its complete immutable evidence.
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
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointNextAgentId,
  checkpointAgentQueues,checkpointUnitAgentLinks,checkpointPlacements} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointTerrain,VERTEX_BYTES} from '../web/world/terrain.mjs';
import {requireCheckpointHaloLayout} from '../web/world/halo-checkpoint-layout.mjs';

const [manifestName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-hero-remote-roundtrip-\d{3}-observed\.json$/);
await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const descriptor=async filename=>{const {bytes,sha256}=await hashNativeFile(filename);return {filename:resolve(filename),bytes,sha256};};
const json=async name=>{assert.ok((await lstat(name)).size<1024*1024);return JSON.parse(await readFile(name,'utf8'));};
async function bound(row){const {filename,bytes,sha256}=row;assert.deepEqual(await descriptor(filename),{filename,bytes,sha256});
  if(row.largestRead!==undefined)assert.ok(row.largestRead<=4096);}
const m=await json(manifestName);
for(const [key,value]of Object.entries({nativeRemoteRoundtripQualified:true,nativeSessionTerminal:true,nativeExitCode:0,
  publicationWorkerExitCode:0,ownedProducerAbsent:true,publicationWorkerAbsent:true,originalInputsUnchanged:true,
  sourceJournalUnchanged:true,copiedJournalUnchanged:false,nativeExecutableUnchanged:true,originalGMPBytesChanged:false,
  stopReason:null,browserUsed:false,nativeProcessesStarted:1,remoteRoundtrip:true,ownerTransferred:true,goalComplete:false}))assert.equal(m[key],value,key);
for(const pid of [m.nativePid,m.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
assert.deepEqual(m.preservedBefore,m.preservedAfter);await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');
await ownedDirectory(m.journal,'actor-arrival-fixture-hero-route-');
for(const row of [m.build,m.preparation,m.script,m.roundtrip,m.publicationWorkerScript,...m.originalInputs])await bound(row);
assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const [name,digest]of Object.entries(m.compiledSourceSha256))assert.equal((await descriptor(name)).sha256,digest);
for(const [name,digest]of [[m.log,m.logSha256],[m.publicationLog,m.publicationLogSha256],
  ['scripts/run-native-hero-remote-roundtrip.py',m.runnerSha256],['scripts/lib/native_pair_guard.py',m.guardSha256],
  ['scripts/run-native-regional-home.py',m.supervisorSha256],[join(m.fixture,'native/recomp/pop_smoke'),m.nativeExecutableSha256]])
  assert.equal((await descriptor(name)).sha256,digest);
const prep=await json(m.preparation.filename),proof=await json(m.roundtrip.filename),identity=await json(prep.identity.filename);
assert.equal(prep.sourceOwnerRevision,17);assert.equal(proof.nativeRemoteRoundtripCompleted,true);assert.equal(proof.cycles.length,m.crossings);
const hashes={};for(const name of (await readdir(prep.sourceJournal)).sort())hashes[name]=(await descriptor(join(prep.sourceJournal,name))).sha256;
assert.deepEqual(hashes,m.sourceJournalBefore);
const originalStats={},finalStats={},originalStore=new HeroRouteStore(await stoppedHeroRouteStorage(prep.sourceJournal,originalStats),identity,identity.contentDigest),
  finalStore=new HeroRouteStore(await stoppedHeroRouteStorage(m.journal,finalStats),identity,identity.contentDigest);
const first=await originalStore.withOwner(async s=>s.entry),initialTarget=await originalStore.withDestination('-4_-1',null,async s=>s.entries[1]);
const worlds=new Map([['-5_-1',first],['-4_-1',initialTarget]]);let previousOwner=first,previousManifest=prep.ownerManifest;
async function records(s){const map=new Map(),add=(key,r)=>{assert.ok(!map.has(key)&&map.size<4096);map.set(key,r);};
  for await(const r of checkpointUnits(s))add('UNIT:'+r.primary.words[1],r);
  for await(const r of checkpointAgents(s))add('GPL:'+r.agentId,r);
  for await(const r of checkpointAttachments(s))add(r.kind+':'+r.unitId,r);return map;}
async function exact(a,ar,b,br){assert.ok(ar&&br);assert.equal(ar.size,br.size);
  for(let at=0;at<ar.size;at+=4096){const n=Math.min(4096,ar.size-at);assert.deepEqual(await a.readAt(ar.offset+at,n),await b.readAt(br.offset+at,n));}}
async function compareTerrain(dormant,s){const bt=await checkpointTerrain(dormant),at=await checkpointTerrain(s);
  assert.deepEqual([bt.width,bt.height,at.width,at.height],[128,128,128,128]);
  for(let y=0;y<=128;y++){
    const b=Buffer.from(await dormant.readAt(bt.heightOffset(0,y),129*VERTEX_BYTES)),a=Buffer.from(await s.readAt(at.heightOffset(0,y),129*VERTEX_BYTES));
    for(let x=0;x<=128;x++)assert.equal(a.readUInt32LE(x*VERTEX_BYTES),b.readUInt32LE(x*VERTEX_BYTES));}}
const results=[];
for(const [index,c]of proof.cycles.entries()){
  const serial=index+1,sourceRegion=serial%2?'-5_-1':'-4_-1',targetRegion=serial%2?'-4_-1':'-5_-1';
  assert.equal(c.serial,serial);assert.equal(c.crossing.serial,serial);assert.equal(c.crossing.region,sourceRegion);assert.equal(c.crossing.target,targetRegion);
  assert.deepEqual(c.sourceEntry,previousOwner);assert.equal(c.previousOwnerManifest,previousManifest);
  assert.equal(c.publication.ownerRevision,17+2*serial-1);assert.equal(c.receipt.ownerRevision,17+2*serial);
  const expectedTarget=worlds.get(targetRegion);assert.deepEqual(c.destinationEntry,expectedTarget);
  for(const row of [c.captured,c.destinationFile,c.targetBefore,c.pack,c.proxyRecord,c.retired,c.active,c.playedCheckpoint,...Object.values(c.observedRecords)])await bound(row);
  assert.equal(c.destinationFile.sha256,expectedTarget.world.sha256);assert.equal(c.destinationFile.bytes,expectedTarget.world.size);
  const capture=await stoppedFileSource(c.captured.filename),dormant=await stoppedFileSource(c.destinationFile.filename),
    before=await stoppedFileSource(c.targetBefore.filename),retired=await stoppedFileSource(c.retired.filename),
    active=await stoppedFileSource(c.active.filename),played=await stoppedFileSource(c.playedCheckpoint.filename),ready=parseNativeHeroArrivalReady(c.ready),
    alias={unitId:ready.unitId,agentId:ready.agentId},home={kind:'proxy',unitId:0,agentId:ready.homeAgentId};
  assert.equal(ready.serial,serial);assert.equal(ready.region,targetRegion);assert.equal(ready.clock,c.destinationClock);
  assert.deepEqual(c.receipt.owner,alias);assert.deepEqual(c.receipt.home,home);assert.deepEqual(home,expectedTarget.homeAlias);
  assert.notEqual(alias.unitId,expectedTarget.alias.unitId);assert.notEqual(alias.agentId,expectedTarget.alias.agentId);
  assert.equal(c.receipt.acknowledgement,nativeHeroArrivalPublished(c.ready,c.receipt.ownerManifest));
  for(const [s,clock]of [[capture,c.crossing.clock],[retired,c.crossing.clock],[dormant,c.destinationClock],[before,c.destinationClock],
    [active,c.destinationClock],[played,c.destinationClock+300]])assert.equal(await checkpointSavedClock(s),clock);
  await verifyRegisteredHeroSnapshot(identity,c.sourceEntry.alias,c.sourceEntry.homeAlias,capture,true,sourceRegion);
  await verifyRegisteredHeroSnapshot(identity,c.sourceEntry.alias,c.sourceEntry.homeAlias,retired,false,sourceRegion);
  for(const s of [active,played])await verifyRegisteredHeroSnapshot(identity,alias,home,s,true,targetRegion);
  const prepared=await prepareSelectedHeroNeighborArrival(identity,{entries:[c.sourceEntry,c.destinationEntry],sources:[capture,dormant],
    regions:[sourceRegion,targetRegion]},c.crossing);assert.deepEqual(await readFile(c.pack.filename),Buffer.from(prepared.pack));
  const nativeMap=new Map([[100000,alias.unitId]]),agentMap=new Map([[1000,alias.agentId],[home.agentId,home.agentId]]);let at=48;
  for(const name of ['unit','agent','container','order']){
    const n=prepared.packDescriptors.find(d=>d.name===name).bytes,b=Buffer.from(prepared.pack.slice(at+12,at+12+n));at+=12+n;
    const put=(offset,map)=>{const v=b.readUInt32LE(offset);assert.ok(map.has(v));b.writeUInt32LE(map.get(v),offset);};
    if(name==='unit'){put(36,nativeMap);for(const e of prepared.plan.edits)if(e.record==='unit'&&e.reason==='native script association')put(e.offset-prepared.plan.ranges.unit.offset,agentMap);}
    else if(name==='agent'){for(const e of prepared.plan.edits)if(e.record==='agent'){
      if(e.reason==='script identity'||e.reason.startsWith('script:'))put(e.offset-prepared.plan.ranges.agent.offset,agentMap);
      else if(e.reason==='script native association')put(e.offset-prepared.plan.ranges.agent.offset,nativeMap);}}
    else if(name==='container')for(const o of [0,56,72])put(o,nativeMap);else put(0,nativeMap);
    assert.deepEqual(await readFile(c.observedRecords[name].filename),name==='container'||name==='order'?b.subarray(36):b,name);
  }
  const bm=await records(before),am=await records(active),pm=await records(played),dm=await records(dormant),rm=await records(retired);
  assert.deepEqual([...am.keys()].sort(),[...bm.keys(),'UNIT:'+alias.unitId,'GPL:'+alias.agentId,'CONT:'+alias.unitId,'ORDR:'+alias.unitId].sort());
  for(const [key,row]of bm)await exact(before,row,active,am.get(key));
  assert.equal(await checkpointNextAgentId(before),alias.agentId);assert.equal(await checkpointNextAgentId(active),alias.agentId+1);
  for(const key of ['UNIT:'+c.sourceEntry.alias.unitId,'GPL:'+c.sourceEntry.alias.agentId,'CONT:'+c.sourceEntry.alias.unitId,'ORDR:'+c.sourceEntry.alias.unitId])assert.ok(!rm.has(key));
  const poses=[];
  for(const [s,map]of [[before,bm],[active,am],[played,pm]])await exact(dormant,dm.get('GPL:'+home.agentId),s,map.get('GPL:'+home.agentId));
  for(const s of [active,played]){
    const links=[];for await(const r of checkpointUnitAgentLinks(s))if(r.agentId===alias.agentId)links.push(r.unitId);assert.deepEqual(links,[alias.unitId]);
    const queued=[];for await(const q of checkpointAgentQueues(s)){assert.notEqual(q.agentId,home.agentId);if(q.agentId===alias.agentId)queued.push(q.type);}
    assert.deepEqual(queued,['queued-agent']);const p=[];for await(const r of checkpointPlacements(s))if(r.unitId===alias.unitId)p.push([r.fixedPosition.x,r.fixedPosition.y,r.fixedPosition.z]);
    assert.equal(p.length,1);poses.push(p[0]);await requireCheckpointHaloLayout(s,targetRegion,'halo-v1');}
  assert.notDeepEqual(poses[0],poses[1]);for(const s of [before,active,played])await compareTerrain(dormant,s);
  worlds.set(sourceRegion,{...c.sourceEntry,world:{size:c.retired.bytes,sha256:c.retired.sha256}});
  previousOwner={region:targetRegion,slot:c.destinationEntry.slot===0?1:0,alias,homeAlias:home,world:{size:c.active.bytes,sha256:c.active.sha256}};
  // Journal slot selection is proved by the next entry or the final reader.
  const next=proof.cycles[index+1]?.sourceEntry;if(next){assert.deepEqual(next.alias,alias);assert.equal(next.world.sha256,c.active.sha256);previousOwner=next;}
  worlds.set(targetRegion,previousOwner);previousManifest=c.receipt.ownerManifest;
  results.push({serial,sourceRegion,targetRegion,sourceClock:c.crossing.clock,targetClock:c.destinationClock,playedClock:c.destinationClock+300,
    alias,homeAlias:home,exactImportedRecords:4,preservedActorRecords:bm.size,activePose:poses[0],playedPose:poses[1],terrainHeightWordsPreserved:16641});
}
const final=await finalStore.withOwner(async s=>({record:s.record,entry:s.entry}));assert.equal(final.record.revision,17+2*m.crossings);
assert.equal(final.record.manifest,previousManifest);assert.deepEqual(final.entry.alias,previousOwner.alias);assert.equal(final.entry.world.sha256,previousOwner.world.sha256);
for(const key of ['0_0','1_0','1_-1','0_-1','-1_-1','-2_-1','-3_-1'])await finalStore.withDestination(key,null,async s=>
  originalStore.withDestination(key,null,async old=>assert.deepEqual(s.entries[1],old.entries[1])));
const departed=results.at(-1).sourceRegion;await finalStore.withDestination(departed,null,async s=>assert.equal(s.entries[1].world.sha256,proof.cycles.at(-1).retired.sha256));
assert.equal(originalStats.writes??0,0);assert.equal(finalStats.writes??0,0);
const log=await readFile(m.log,'utf8');assert.ok(log.length<m.logCeilingBytes&&!/invariant failed|abort from|result=fail|binding refused|load refused/.test(log));
assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));const releases=[];
for(const c of results){const r=new RegExp(`Session released serial=${c.serial} region=${c.sourceRegion} roots-freed=1,1,1,1,1,1,1,1 .*heap-before=(\\d+) heap-after=(\\d+) blocks-before=(\\d+) blocks-after=(\\d+) clock=0`,'g'),matches=[...log.matchAll(r)];
  assert.equal(matches.length,1);releases.push({serial:c.serial,heapBefore:Number(matches[0][1]),heapAfter:Number(matches[0][2]),blocksBefore:Number(matches[0][3]),blocksAfter:Number(matches[0][4])});
  assert.equal(log.split(`Hero travel resumed serial=${c.serial} region=${c.targetRegion} `).length-1,1);}
assert.ok(m.resourceSamples.length&&m.resourceSamples.every(s=>s.rssBytes<=m.rssCeilingBytes));
const sourceSha256={},pending=[resolve('scripts/inspect-native-hero-remote-roundtrip.mjs')];
while(pending.length){const file=pending.pop();if(sourceSha256[file])continue;assert.ok(Object.keys(sourceSha256).length<128);
  sourceSha256[file]=(await descriptor(file)).sha256;for(const match of (await readFile(file,'utf8')).matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))
    if(match[1].startsWith('.'))pending.push(resolve(dirname(file),match[1]));}
await writeFile(outName,JSON.stringify({version:1,nativeRemoteRoundtripQualified:true,manifest:await descriptor(manifestName),sourceSha256,cycles:results,
  releases,ownerRevision:final.record.revision,otherSevenDormantEntriesUnchanged:true,originalInputsUnchanged:true,sourceJournalUnchanged:true,
  producersAbsent:true,peakAggregateRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),nativeElapsedMs:m.finishedAtMs-m.startedAtMs,
  browserUsed:false,liveOPFSQualified:false,continuousWorldQualified:false,sustainedMemoryQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeRemoteRoundtripQualified:true,crossings:m.crossings,ownerRevision:final.record.revision}));
