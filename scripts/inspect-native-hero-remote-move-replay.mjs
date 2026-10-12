#!/usr/bin/env node
// Authenticate actual original-reader saves, retained records and resumed
// motion independently of the native qualification driver's pass message.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {prepareSelectedHeroGeneratedNeighbor} from './lib/prepare-selected-hero-generated-neighbor.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {selectedHeroRuntimeBinding} from '../web/world/hero-runtime-binding.mjs';
import {registeredHeroHome,verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {withProposedRemoteHome} from '../web/world/remote-home-projection.mjs';
import {prepareCheckpointRegisteredHeroArrival} from '../web/world/arrival.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointAgentQueues,checkpointPlacements,
 checkpointNextAgentId,checkpointChunks} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';

const [manifestName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-hero-remote-move-replay-\d{3}-observed\.json$/);
await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const descriptor=async filename=>{const {bytes,sha256}=await hashNativeFile(filename);return {filename:resolve(filename),bytes,sha256};};
const json=async filename=>{assert.ok((await lstat(filename)).size<1024*1024);return JSON.parse(await readFile(filename,'utf8'));};
const bound=async row=>assert.deepEqual(await descriptor(row.filename),row);
const m=await json(manifestName);
for(const [key,value]of Object.entries({nativeRemoteMoveReplayQualified:true,nativeSessionTerminal:true,nativeExitCode:0,
 ownedProducerAbsent:true,originalInputsUnchanged:true,copiedWarmUnchanged:true,nativeExecutableUnchanged:true,
 stopReason:null,browserUsed:false,nativeProcessesStarted:1,ownerTransferred:false,goalComplete:false}))assert.equal(m[key],value,key);
assert.throws(()=>process.kill(m.nativePid,0),e=>e.code==='ESRCH');assert.deepEqual(m.preservedBefore,m.preservedAfter);
await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-home-');assert.equal(m.profile,join(m.fixture,'frontier_-3_-1'));
await bound(m.build);await bound(m.preparation);await bound(m.copiedWarm);await bound(m.script);
for(const row of [...m.originalInputs,...Object.values(m.worlds)])await bound(row);
assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const [name,digest]of Object.entries(m.compiledSourceSha256))assert.equal((await descriptor(name)).sha256,digest);
for(const [name,digest]of [[m.log,m.logSha256],['scripts/run-native-hero-remote-move-replay.py',m.runnerSha256],
 ['scripts/lib/native_pair_guard.py',m.guardSha256],['scripts/run-native-regional-home.py',m.supervisorSha256],
 [join(m.fixture,'native/recomp/pop_smoke'),m.nativeExecutableSha256]])assert.equal((await descriptor(name)).sha256,digest);
const prep=await json(m.preparation.filename);
for(const [name,digest]of Object.entries(prep.sourceSha256))assert.equal((await descriptor(name)).sha256,digest);
assert.equal(prep.exactStoppedThreeCommandCapsulePrepared,true);assert.equal(prep.sourceWrites,0);await bound(prep.sourceHead);
const old=await json(prep.producer.filename),identity=await json(join(old.publicationJournal,'Frontier_Hero_Route_Identity.json')),
 stats={},store=new HeroRouteStore(await stoppedHeroRouteStorage(old.publicationJournal,stats),identity,identity.contentDigest);
const selected=await store.withOwner(async selected=>({record:selected.record,entry:selected.entry}));
assert.equal(selected.record.revision,11);assert.equal(selected.entry.world.sha256,prep.sourceCheckpoint.sha256);
const runtime=selectedHeroRuntimeBinding(identity,selected.entry,prep.crossing.clock),
 prepared=await prepareSelectedHeroGeneratedNeighbor(store,runtime,prep.crossing,prep.warmCheckpoint);
assert.equal(prepared.packSha256,prep.pack.sha256);assert.deepEqual(prepared.home.record,new Uint8Array(await readFile(prep.home.filename)));
const source=await stoppedFileSource(prep.sourceCheckpoint.filename),warm=await stoppedFileSource(prep.warmCheckpoint.filename);
const repeated=await withProposedRemoteHome(warm,registeredHeroHome(identity),prepared.home,
 async projected=>prepareCheckpointRegisteredHeroArrival(source,projected.source,prepared.arrival.options,prepared.arrival.context));
assert.deepEqual(repeated.plan,prepared.arrival.plan);assert.equal(stats.writes??0,0);
const {unitId:hero,agentId:agent,proxyAgentId:proxy}=m.arrival;
assert.equal(proxy,25);assert.equal(await checkpointSavedClock(source),81900);assert.equal(await checkpointSavedClock(warm),100);
const nativeMap=new Map([[100000,hero]]),agentMap=new Map([[1000,agent],[proxy,proxy]]),expected=new Map();
for(const [name,record]of Object.entries(repeated.records)){
 const bytes=Buffer.from(record),put=(at,map)=>{const n=bytes.readUInt32LE(at);assert.ok(map.has(n));bytes.writeUInt32LE(map.get(n),at);};
 if(name==='unit'){
  put(36,nativeMap);
  for(const edit of repeated.plan.edits)if(edit.record===name&&edit.reason==='native script association')put(edit.offset-repeated.plan.ranges.unit.offset,agentMap);
  expected.set('UNIT:'+hero,bytes);
 }else if(name==='agent'){
  for(const edit of repeated.plan.edits)if(edit.record===name){
   if(edit.reason==='script identity'||edit.reason.startsWith('script:'))put(edit.offset-repeated.plan.ranges.agent.offset,agentMap);
   else if(edit.reason==='script native association')put(edit.offset-repeated.plan.ranges.agent.offset,nativeMap);
  }expected.set('GPL:'+agent,bytes);
 }else if(name==='container'){
  for(const at of [0,56,72])put(at,nativeMap);expected.set('CONT:'+hero,bytes);
 }else{
  assert.equal(name,'order');put(0,nativeMap);expected.set('ORDR:'+hero,bytes);
 }
}
assert.equal(expected.size,4);
async function records(s){
 const map=new Map(),add=(key,row)=>{assert.ok(!map.has(key)&&map.size<4096);map.set(key,row);};
 for await(const row of checkpointUnits(s))add('UNIT:'+row.primary.words[1],row);
 for await(const row of checkpointAgents(s))add('GPL:'+row.agentId,row);
 for await(const row of checkpointAttachments(s))add(row.kind+':'+row.unitId,row);
 return map;
}
async function exact(a,ar,b,br){
 assert.equal(ar.size,br.size);
 for(let at=0;at<ar.size;at+=4096){const n=Math.min(4096,ar.size-at);assert.deepEqual(await a.readAt(ar.offset+at,n),await b.readAt(br.offset+at,n));}
}
async function root(s,tag){let row;for await(const c of checkpointChunks(s))if(c.tag===tag){assert.equal(row,undefined);row=c;}assert.ok(row);return row;}
async function queues(s){const rows=[];for await(const row of checkpointAgentQueues(s)){assert.ok(rows.length<8192);rows.push(row);}return rows;}
const semantic=q=>q.type==='queued-agent'?{type:q.type,queue:q.queue,index:q.index,agentId:q.agentId}:{type:q.type,activeQueue:q.activeQueue};
const checkpoint=async name=>stoppedFileSource(m.worlds[name].filename),before=await checkpoint('Hero_Arrival_Refused'),
 imported=await checkpoint('Hero_Arrival_Imported'),ready=await checkpoint('Hero_Activation_Ready'),unrouted=await checkpoint('Hero_Activation_Unrouted'),
 played=await checkpoint('Hero_Activation_Crossed'),closed=await checkpoint('Hero_Activation_Closed');
const bm=await records(before),im=await records(imported),rm=await records(ready),um=await records(unrouted);
assert.deepEqual([...im.keys()].sort(),[...bm.keys(),...expected.keys()].sort());
for(const [key,bytes]of expected){const row=im.get(key);assert.equal(row.size,bytes.length);
 for(let at=0;at<row.size;at+=4096)assert.deepEqual(Buffer.from(await imported.readAt(row.offset+at,Math.min(4096,row.size-at))),bytes.subarray(at,at+4096),key);
}
for(const [key,row]of bm)await exact(before,row,imported,im.get(key));
assert.deepEqual([...rm.keys()].sort(),[...im.keys()].sort());assert.deepEqual([...um.keys()].sort(),[...im.keys()].sort());
for(const [key,row]of im){await exact(imported,row,ready,rm.get(key));await exact(ready,rm.get(key),unrouted,um.get(key));}
assert.equal(await checkpointNextAgentId(before),agent);assert.equal(await checkpointNextAgentId(imported),agent+1);
const states=[];
for(const name of ['Hero_Arrival_Refused','Hero_Arrival_Imported','Hero_Activation_Ready','Hero_Activation_Unrouted'])
 states.push(await connectedWorldState(m.worlds[name].filename,{unscheduledAgents:name==='Hero_Arrival_Imported'?[proxy,agent]:[proxy]}));
for(const state of states)for(const key of ['clock','rng','gameplayRng','rawTerrainSha256'])assert.equal(state[key],states[0][key]);
const changed=new Set(['MAP ','GPL ','VHCL','ORDR','CONT','ORLS']);
assert.deepEqual(states[0].roots.filter(r=>!changed.has(r.tag)),states[1].roots.filter(r=>!changed.has(r.tag)));
assert.deepEqual(states[1].roots.filter(r=>r.tag!=='GPL '),states[2].roots.filter(r=>r.tag!=='GPL '));
assert.deepEqual(states[2].roots,states[3].roots);
const iq=await queues(imported),rq=await queues(ready),added=rq.filter(q=>q.agentId===agent);
assert.equal(added.length,1);assert.equal(added[0].type,'queued-agent');assert.ok(!iq.some(q=>q.agentId===agent));
assert.deepEqual(rq.filter(q=>q.agentId!==agent).map(semantic),iq.map(semantic));
// Authenticate the complete opaque GPL root's sole activation scheduler append.
const gb=await root(imported,'GPL '),ga=await root(ready,'GPL '),q=added[0],insertion=q.offset-ga.offset;
assert.equal(ga.size,gb.size+4);assert.equal(ga.version,gb.version);assert.equal(ga.count,gb.count);
const patches=[];
for(const [relative,increment,oldExpected]of [[4,4,gb.size],[16,4,gb.size],[28,4,null],[q.offset-(q.index+1)*4-ga.offset,1,q.index]]){
 const old=Buffer.from(await imported.readAt(gb.offset+relative,4)).readUInt32LE(0);if(oldExpected!==null)assert.equal(old,oldExpected);
 const bytes=Buffer.alloc(4);bytes.writeUInt32LE(old+increment);patches.push({relative,bytes});
}
for(let at=0;at<gb.size+16;){const n=Math.min(4096,gb.size+16-at,at<insertion?insertion-at:Infinity),bytes=Uint8Array.from(await imported.readAt(gb.offset+at,n));
 for(const patch of patches)for(let j=0;j<4;j++){const index=patch.relative+j-at;if(index>=0&&index<n)bytes[index]=patch.bytes[j];}
 assert.deepEqual(await ready.readAt(ga.offset+at+(at>=insertion?4:0),n),bytes);at+=n;
}
assert.equal(Buffer.from(await ready.readAt(q.offset,4)).readUInt32LE(0),agent);
const orders=[];for await(const row of checkpointActorOrderEntries(ready,hero))if(row.type==='entry')orders.push({bank:row.bank,index:row.index,kind:row.kind});
assert.deepEqual(orders,prep.orders);
const alias={unitId:hero,agentId:agent},homeAlias={kind:'proxy',unitId:0,agentId:proxy};
for(const s of [imported,ready,unrouted,played,closed])await verifyRegisteredHeroSnapshot(identity,alias,homeAlias,s,true,'-3_-1');
const log=await readFile(m.log,'utf8');assert.ok(log.length<m.logCeilingBytes&&!/invariant failed|abort from|result=fail/.test(log));
assert.ok(!log.includes('[streaming] Hero remote home leg '));
const matches=[...log.matchAll(/^\[frontier\] Hero remote Move replay gameplay held hero=(\d+) agent=(\d+) from-clock=100 clock=(\d+) previous=(-?\d+,-?\d+,-?\d+) accepted=(-?\d+,-?\d+,-?\d+) ai=(\d+) other-ai=(\d+) contexts=(\d+) commands=(\d+) ticks=(\d+) original-movement=1 new-route=0 phase=3 pending=7 owner-published=0 result=pass$/gm)];
assert.equal(matches.length,1);const motion=matches[0],pose=text=>text.split(',').map(Number),ticks=Number(motion[10]),clock=Number(motion[3]);
assert.equal(Number(motion[1]),hero);assert.equal(Number(motion[2]),agent);assert.ok(ticks>=2&&ticks<=40);assert.equal(clock,100+ticks*50);
for(const index of [6,7,8,9])assert.ok(Number(motion[index])>0);assert.notDeepEqual(pose(motion[4]),pose(motion[5]));
async function position(s){let value;for await(const row of checkpointPlacements(s))if(row.unitId===hero){assert.equal(value,undefined);value=row.fixedPosition;}assert.ok(value);return [value.x,value.y,value.z];}
assert.deepEqual(await position(unrouted),pose(motion[4]));assert.deepEqual(await position(played),pose(motion[5]));
assert.equal(await checkpointSavedClock(played),clock);assert.equal(await checkpointSavedClock(closed),clock);
const pm=await records(played),cm=await records(closed);assert.deepEqual([...pm.keys()].sort(),[...cm.keys()].sort());
for(const [key,row]of pm)await exact(played,row,closed,cm.get(key));
assert.deepEqual((await connectedWorldState(m.worlds.Hero_Activation_Crossed.filename,{unscheduledAgents:[proxy]})).roots,
 (await connectedWorldState(m.worlds.Hero_Activation_Closed.filename,{unscheduledAgents:[proxy]})).roots);
const pure=rm.get('GPL:'+proxy);await exact(ready,pure,played,pm.get('GPL:'+proxy));
assert.ok(m.resourceSamples.length&&m.resourceSamples.every(r=>r.rssBytes<=m.rssCeilingBytes));await bound(prep.sourceHead);
await writeFile(outName,JSON.stringify({version:1,nativeRemoteMoveReplayQualified:true,manifest:await descriptor(manifestName),preparation:m.preparation,
 originalCapsuleExactlyRegenerated:true,allFourImportedRecordsExact:true,allUnrelatedImportedRecordsPreserved:bm.size,
 originalThreeCommandsPreserved:orders,activationAllRecordsUnchanged:true,activationSchedulerRootAppendVerified:true,
 physicalMovementVerifiedFromOriginalSaves:true,originalContextCallbackObserved:true,originalGameplayTicks:ticks,continuedClock:clock,
 newRouteIssued:false,remoteHomeRecordUnchanged:true,sourceOwnerRevision:11,sourceJournalUnchanged:true,ownerTransferred:false,
 nativeElapsedMs:m.finishedAtMs-m.startedAtMs,peakAggregateRssBytes:Math.max(...m.resourceSamples.map(r=>r.rssBytes)),
 inspectorSha256:(await descriptor('scripts/inspect-native-hero-remote-move-replay.mjs')).sha256,browserUsed:false,
 liveOPFSQualified:false,sustainedMemoryQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeRemoteMoveReplayQualified:true,originalCommands:orders.length,originalGameplayTicks:ticks,newRouteIssued:false}));
