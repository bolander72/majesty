#!/usr/bin/env node
// Verify a stopped original-reader restart from the actual selected owner.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {selectedHeroRuntimeBinding} from '../web/world/hero-runtime-binding.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointAgentQueues,
  checkpointPlacements,checkpointNextAgentId,checkpointUnitAgentLinks,checkpointActorRecords} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointTerrain,VERTEX_BYTES} from '../web/world/terrain.mjs';
import {requireCheckpointHaloLayout} from '../web/world/halo-checkpoint-layout.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';

const [manifestName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-hero-remote-owner-restore-\d{3}-observed\.json$/);
await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const descriptor=async filename=>{const {bytes,sha256}=await hashNativeFile(filename);return {filename:resolve(filename),bytes,sha256};};
const json=async filename=>{assert.ok((await lstat(filename)).size<1024*1024);return JSON.parse(await readFile(filename,'utf8'));};
const bound=async row=>assert.deepEqual(await descriptor(row.filename),row);
const m=await json(manifestName);
for(const [key,value]of Object.entries({nativeRemoteOwnerRestoreQualified:true,nativeSessionTerminal:true,nativeExitCode:0,
  ownedProducerAbsent:true,originalInputsUnchanged:true,sourceJournalUnchanged:true,copiedJournalUnchanged:true,
  nativeExecutableUnchanged:true,originalGMPBytesChanged:false,stopReason:null,browserUsed:false,nativeProcessesStarted:1,
  ownerTransferred:false,goalComplete:false}))assert.equal(m[key],value,key);
assert.throws(()=>process.kill(m.nativePid,0),e=>e.code==='ESRCH');assert.deepEqual(m.preservedBefore,m.preservedAfter);
await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');
assert.equal(m.profile,join(m.fixture,'frontier_-5_-1'));
for(const row of [m.build,m.preparation,m.script,m.copiedSource,m.savedCheckpoint,...m.originalInputs])await bound(row);
assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const [name,digest]of Object.entries(m.compiledSourceSha256))assert.equal((await descriptor(name)).sha256,digest);
for(const [name,digest]of [[m.log,m.logSha256],['scripts/run-native-hero-remote-owner-restore.py',m.runnerSha256],
  ['scripts/lib/native_pair_guard.py',m.guardSha256],['scripts/run-native-regional-home.py',m.supervisorSha256],
  [join(m.fixture,'native/recomp/pop_smoke'),m.nativeExecutableSha256]])assert.equal((await descriptor(name)).sha256,digest);
const prep=await json(m.preparation.filename),identity=await json(prep.identity.filename);
assert.equal(prep.originalRemoteOwnerRestorePrepared,true);assert.equal(prep.sourceWrites,0);
if(prep.preparationScript){
  await bound(prep.preparationScript);assert.equal(prep.progressedHeldOwnerPublished,true);
  assert.equal(prep.sourceOwnerRevision,17);assert.equal(prep.idempotentRetryVerified,true);
  assert.equal(prep.dormantEntriesPreserved.length,8);
  for(const row of [...prep.originalJournalInputs,prep.originalSourceHead])await bound(row);
}else assert.equal((await descriptor('scripts/prepare-native-hero-remote-owner-restore.mjs')).sha256,prep.preparationScriptSha256);
for(const dir of [prep.sourceJournal,m.journal]){
  const hashes={};for(const name of (await readdir(dir)).sort()){
    const file=join(dir,name),st=await lstat(file);assert.ok(st.isFile()&&!st.isSymbolicLink());
    hashes[name]=(await descriptor(file)).sha256;
  }assert.deepEqual(hashes,m.sourceJournalBefore);
}
const stats={},store=new HeroRouteStore(await stoppedHeroRouteStorage(prep.sourceJournal,stats),identity,identity.contentDigest);
const selected=await store.withOwner(async selected=>({record:selected.record,entry:selected.entry}));
assert.equal(selected.record.revision,prep.sourceOwnerRevision);assert.equal(selected.entry.region,'-5_-1');
assert.equal(selected.entry.world.sha256,prep.sourceCheckpoint.sha256);
const sourceClock=prep.clock;assert.ok(sourceClock>=100);
assert.equal(selectedHeroRuntimeBinding(identity,selected.entry,sourceClock),prep.runtimeBinding);
assert.equal(stats.writes??0,0);
const alias=selected.entry.alias,home=selected.entry.homeAlias;
assert.deepEqual(alias,{unitId:568,agentId:62});assert.deepEqual(home,{kind:'proxy',unitId:0,agentId:61});
assert.equal(m.copiedSource.sha256,prep.sourceCheckpoint.sha256);
const before=await stoppedFileSource(prep.sourceCheckpoint.filename),after=await stoppedFileSource(m.savedCheckpoint.filename);
assert.equal(await checkpointSavedClock(before),sourceClock);assert.equal(await checkpointSavedClock(after),m.savedClock);
assert.ok(m.savedClock>sourceClock);
for(const source of [before,after])await verifyRegisteredHeroSnapshot(identity,alias,home,source,true,prep.region);
async function records(source){
  const map=new Map(),add=(key,row)=>{assert.ok(map.size<4096&&!map.has(key));map.set(key,row);};
  for await(const row of checkpointUnits(source))add('UNIT:'+row.primary.words[1],row);
  for await(const row of checkpointAgents(source))add('GPL:'+row.agentId,row);
  for await(const row of checkpointAttachments(source))add(row.kind+':'+row.unitId,row);
  return map;
}
const bm=await records(before),am=await records(after);
// The original simulation recruits, destroys scenery and changes orders.
// Compare the registered hero and pure home, and validate newly allocated
// script IDs instead of requiring a frozen world after active gameplay.
const counterBefore=await checkpointNextAgentId(before),counterAfter=await checkpointNextAgentId(after);
const oldAgents=[...bm.keys()].filter(k=>k.startsWith('GPL:'));
assert.ok(oldAgents.every(k=>am.has(k)),'An original script agent was lost');
const addedAgents=[...am.keys()].filter(k=>k.startsWith('GPL:')&&!bm.has(k)).map(k=>Number(k.slice(4))).sort((a,b)=>a-b);
assert.deepEqual(addedAgents,Array.from({length:counterAfter-counterBefore},(_,i)=>counterBefore+i));
assert.ok(addedAgents.length<=32);
let sourceRangers;
for(const source of [before,after]){
  const hero=await checkpointActorRecords(source,alias.unitId);
  assert.equal(hero.agent.agentId,alias.agentId);assert.equal(hero.unit.description,identity.actor.description);
  assert.equal(hero.unit.playerNumber,identity.actor.playerNumber);
  const linked=[],rangers=[];
  for await(const row of checkpointUnitAgentLinks(source)){
    if(row.agentId===alias.agentId)linked.push(row.unitId);
    if(row.description===identity.actor.description&&row.playerNumber===identity.actor.playerNumber)rangers.push(row.unitId);
  }assert.deepEqual(linked,[alias.unitId]);
  rangers.sort((a,b)=>a-b);
  if(source===before)sourceRangers=rangers;
  else assert.deepEqual(rangers,sourceRangers,'Restart introduced or lost a ranger');
}
const proxyKey='GPL:'+home.agentId,br=bm.get(proxyKey),ar=am.get(proxyKey);
assert.ok(br&&ar);assert.equal(br.size,ar.size);
for(let at=0;at<br.size;at+=4096){const n=Math.min(4096,br.size-at);
  assert.deepEqual(await before.readAt(br.offset+at,n),await after.readAt(ar.offset+at,n));}
for(const source of [before,after]){
  let heroQueued=0;for await(const row of checkpointAgentQueues(source)){
    assert.notEqual(row.agentId,home.agentId,'Pure home became scheduled');
    if(row.agentId===alias.agentId){assert.equal(row.type,'queued-agent');heroQueued++;}
  }assert.equal(heroQueued,1,'Restored hero scheduler membership differs');
}
async function position(source){
  let value;for await(const row of checkpointPlacements(source))if(row.unitId===alias.unitId){
    assert.equal(value,undefined);value=[row.fixedPosition.x,row.fixedPosition.y,row.fixedPosition.z];
  }assert.ok(value);return value;
}
const startPose=await position(before),savedPose=await position(after);
const physicalMovementObserved=JSON.stringify(startPose)!==JSON.stringify(savedPose);
async function orders(source){const entries=[];
  for await(const row of checkpointActorOrderEntries(source,alias.unitId))if(row.type==='entry'){
    assert.ok(entries.length<64);entries.push({bank:row.bank,index:row.index,kind:row.kind});
  }return entries;
}
const sourceOrders=await orders(before),savedOrders=await orders(after);
if(prep.sourceOwnerRevision===17)assert.deepEqual(sourceOrders,prep.originalHeroOrderEntries);
const motionRequired=sourceOrders.length>0;
if(m.motionRequired!==undefined)assert.equal(m.motionRequired,motionRequired);
if(motionRequired)assert.ok(physicalMovementObserved,'Saved moving hero did not continue');
const beforeState=await connectedWorldState(prep.sourceCheckpoint.filename,{unscheduledAgents:[home.agentId]}),
  afterState=await connectedWorldState(m.savedCheckpoint.filename,{unscheduledAgents:[home.agentId]});
assert.equal(beforeState.clock,sourceClock);assert.equal(afterState.clock,m.savedClock);
const bt=await checkpointTerrain(before),at=await checkpointTerrain(after);
assert.deepEqual([bt.width,bt.height,at.width,at.height],[128,128,128,128]);
for(let y=0;y<=128;y++){
  const b=Buffer.from(await before.readAt(bt.heightOffset(0,y),129*VERTEX_BYTES)),
    a=Buffer.from(await after.readAt(at.heightOffset(0,y),129*VERTEX_BYTES));
  for(let x=0;x<=128;x++)assert.equal(a.readUInt32LE(x*VERTEX_BYTES),b.readUInt32LE(x*VERTEX_BYTES));
}
for(const source of [before,after])await requireCheckpointHaloLayout(source,prep.region,'halo-v1');
const log=await readFile(m.log,'utf8');assert.ok(log.length<m.logCeilingBytes&&!/invariant failed|abort from|result=fail|binding refused/.test(log));
assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
assert.equal(log.split(`Selected remote hero restored unit=568 agent=62 proxy=61 clock=${sourceClock} `).length-1,1);
assert.ok(log.includes('imported=0 reactivated=0 native-cache-empty=1 result=pass'));
const callback=[...log.matchAll(/Restored remote hero original context unit=568 agent=62 proxy=61 clock=(\d+) original-callback=1 pure-home-preserved=1 new-route=0 result=pass/g)];
assert.equal(callback.length,1);assert.ok(Number(callback[0][1])>sourceClock&&Number(callback[0][1])<=m.savedClock);
if(motionRequired)assert.ok(log.includes('Hero halo motion region=-5_-1 unit=568 agent=62 '));
assert.ok(!log.includes('[streaming] Hero remote home leg '));
assert.ok(m.resourceSamples.length&&m.resourceSamples.every(r=>r.rssBytes<=m.rssCeilingBytes));
// Bind the actual checker and its local dependencies for later archive use.
const sourceSha256={},pending=[resolve('scripts/inspect-native-hero-remote-owner-restore.mjs')];
while(pending.length){const file=pending.pop();if(sourceSha256[file])continue;
  assert.ok(Object.keys(sourceSha256).length<128);sourceSha256[file]=(await descriptor(file)).sha256;
  for(const match of (await readFile(file,'utf8')).matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))
    if(match[1].startsWith('.'))pending.push(resolve(dirname(file),match[1]));
}
await writeFile(outName,JSON.stringify({version:1,nativeRemoteOwnerRestoreQualified:true,
  manifest:await descriptor(manifestName),preparation:m.preparation,sourceSha256,
  sourceOwnerRevision:prep.sourceOwnerRevision,region:prep.region,alias,homeAlias:home,sourceClock,savedClock:m.savedClock,
  sourcePose:startPose,savedPose,physicalMovementVerifiedFromOriginalSaves:physicalMovementObserved,
  sourceHeroOrders:sourceOrders,savedHeroOrders:savedOrders,motionRequired,
  originalContextCallbackClock:Number(callback[0][1]),originalContextCallbackObserved:true,
  actorAndAttachmentKeysBefore:bm.size,actorAndAttachmentKeysAfter:am.size,
  originalScriptAgentsRetained:oldAgents.length,newScriptAgents:addedAgents,
  agentAllocationCounterBefore:counterBefore,agentAllocationCounterAfter:counterAfter,
  sourceRangerIdsPreserved:sourceRangers,registeredHeroNativeBacklinkUnique:true,heroQueuedExactlyOnce:true,
  remoteHomeRecordUnchanged:true,remoteHomeUnscheduled:true,terrainHeightWordsPreserved:16641,
  sharedHaloRecipePreserved:true,
  sourceJournalUnchanged:true,copiedJournalUnchanged:true,originalCheckpointByteIdentical:true,
  controlledNativeContentLabel:m.controlledNativeContentLabel,newRouteIssued:false,ownerTransferred:false,
  nativeElapsedMs:m.finishedAtMs-m.startedAtMs,peakAggregateRssBytes:Math.max(...m.resourceSamples.map(r=>r.rssBytes)),
  browserUsed:false,liveOPFSQualified:false,continuousWorldQualified:false,sustainedMemoryQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeRemoteOwnerRestoreQualified:true,savedClock:m.savedClock,actorKeys:bm.size,newRouteIssued:false}));
