#!/usr/bin/env node
// Qualify actual original-reader import against whole saved graphs and the
// production arrival planner, without accepting native pass messages alone.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve,basename,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {prepareCheckpointRegisteredHeroArrival} from '../web/world/arrival.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointChunks,checkpointAgentQueues,
 checkpointActorRecords,checkpointAgentReferencePlan,checkpointNextAgentId} from '../web/world/checkpoint.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {checkpointActorOrderUnitReferences} from '../web/world/order-unit-bindings.mjs';
import {inspectSelectedSourceRetirement} from './inspect-native-halo-source-retirement.mjs';

const [manifestName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-hero-arrival-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function bound(row){assert.equal((await lstat(row.filename)).size,row.bytes);assert.equal(await hash(row.filename),row.sha256);}
async function small(n){const source=await stoppedFileSource(n);assert.ok(source.size<=65536);const bytes=Buffer.alloc(source.size);
 for(let at=0;at<bytes.length;at+=4096)bytes.set(await source.readAt(at,Math.min(4096,bytes.length-at)),at);return bytes;}
const raw=await json(manifestName),connected=raw.nativeSelectedHeroArrivalBoundaryObserved===true;
let sourceQualification;
if(connected){
 assert.equal(raw.selectedHeroBindingTrialQualified,true);assert.equal(raw.heroImported,true);assert.equal(raw.destinationActivated,true);
 sourceQualification=await inspectSelectedSourceRetirement(manifestName);assert.equal(sourceQualification.nativeSelectedHeroPagingQualified,true);
}
const m=connected?{...raw,preparation:raw.destinationPreparation,worlds:raw.arrivalWorlds.slice(0,5),profile:join(raw.fixture,'frontier_1_0'),
 clock:raw.destinationClock,nativeHeroArrivalTrialQualified:raw.nativeSelectedHeroArrivalBoundaryObserved}:raw;
let firstObserved;
if(raw.importRepeatNeighbor){await bound(raw.repeatNeighborPageInput);const staged=await json(raw.repeatNeighborPageInput.filename);
 assert.equal(staged.nativePid,raw.nativePid);assert.equal(staged.fixture,raw.fixture);firstObserved=staged.firstObserved;assert.ok(firstObserved);
}
async function observed(name){
 if(!firstObserved)return join(m.profile,name);
 const row=firstObserved[name];assert.ok(row);assert.equal(row.filename,join(m.profile,'First_'+name));await bound(row);return row.filename;
}
const activation=m.nativeHeroActivationTrialQualified===true;
assert.equal(m.nativeHeroArrivalTrialQualified,true);assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);
assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);assert.equal(m.browserUsed,false);
assert.equal(m.heroImported,true);if(!connected)assert.equal(m.destinationActivated,activation);
assert.equal(m.ownerTransferred,m.nativeSelectedHeroResumeBoundaryObserved===true);
assert.deepEqual(m.preservedBefore,m.preservedAfter);
try{process.kill(m.nativePid,0);assert.fail('Native producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
await ownedDirectory(m.fixture,connected?'actor-arrival-fixture-hero-binding-':'actor-arrival-fixture-hero-home-');assert.equal(m.profile,join(m.fixture,'frontier_1_0'));
await bound(m.build);await bound(m.preparation);await bound(m.arrivalPreparation);await bound(m.arrivalPackage);
const p=await json(m.arrivalPreparation.filename),home=await json(m.preparation.filename);
assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const[n,h]of Object.entries({...p.sourceSha256,...m.compiledSourceSha256}))assert.equal(await hash(n),h);
let runtimeRunner=connected?'scripts/run-native-hero-binding.py':'scripts/run-native-hero-home.py';
if(connected&&m.postprocessingRequalification){
 const r=m.postprocessingRequalification;assert.equal(r.version,1);assert.equal(r.genericHomeReadyEvents,3);assert.equal(r.nativeProcessesStarted,0);
 await bound(r.original);await bound(r.runtimeRunner);await bound(r.tool);const original=await json(r.original.filename);
 assert.equal(original.nativePid,m.nativePid);assert.equal(original.publicationWorkerPid,m.publicationWorkerPid);
 assert.equal(original.logSha256,m.logSha256);assert.equal(original.runnerSha256,m.runnerSha256);assert.equal(r.runtimeRunner.sha256,m.runnerSha256);
 const amended={...original,bindingBoundaryObserved:true,selectedHeroBindingTrialQualified:true,postprocessingRequalification:r};
 assert.deepEqual(raw,amended);runtimeRunner=r.runtimeRunner.filename;
}
for(const[n,h]of [[m.log,m.logSha256],[runtimeRunner,m.runnerSha256],
 ['scripts/lib/native_pair_guard.py',m.guardSha256],['scripts/run-native-regional-home.py',m.supervisorSha256],
 [join(m.fixture,'native/recomp/pop_smoke'),m.nativeExecutableSha256]])assert.equal(await hash(n),h);
for(const key of connected?['copiedCheckpointUnchanged','proposalUnchanged','nativeExecutableUnchanged','arrivalPackageUnchanged','destinationCopiedUnchanged']:
 ['copiedCheckpointUnchanged','originalCheckpointUnchanged','proposalUnchanged','originalProposalUnchanged',
 'nativeExecutableUnchanged','arrivalPackageUnchanged','originalArrivalPackageUnchanged','sourceArrivalCheckpointUnchanged','destinationArrivalCheckpointUnchanged'])assert.equal(m[key],true);
for(const row of [m.sourceCheckpoint,m.proposal,p.sourceWorld,p.destinationWorld,p.pack,...m.worlds])await bound(row);
assert.equal(m.worlds.length,activation?10:5);assert.deepEqual(m.worlds.slice(0,5).map(r=>basename(r.filename)),
 ['Hero_Home_Before.GMP','Hero_Home_Registered.GMP','Hero_Home_Reused.GMP','Hero_Arrival_Refused.GMP','Hero_Arrival_Imported.GMP']);
const {unitId:hero,agentId:agent,homeAgentId:proxy}=m.importedAliases;
assert.equal(proxy,home.proposedAgentId);assert.equal(m.clock,p.options.destinationClockMs);
const source=await stoppedFileSource(p.sourceWorld.filename),destination=await stoppedFileSource(p.destinationWorld.filename);
if(connected){
 assert.equal(raw.arrivalWorlds.length,6);await bound(raw.arrivalWorlds[5]);
 assert.equal(raw.nativeCrossing.clock,p.options.sourceClockMs);assert.equal(raw.nativeCrossing.unitId,p.selectedOwner.unitId);assert.equal(raw.nativeCrossing.agentId,p.selectedOwner.agentId);
 const captured=await stoppedFileSource(raw.heldSave.checkpoint.filename),capturedRecords=await records(captured),plannedRecords=await records(source);
 for(const name of ['UNIT:'+p.selectedOwner.unitId,'GPL:'+p.selectedOwner.agentId,'CONT:'+p.selectedOwner.unitId,'ORDR:'+p.selectedOwner.unitId]){
  const a=capturedRecords.get(name),b=plannedRecords.get(name);assert.ok(a&&b);assert.equal(a.size,b.size);
  for(let at=0;at<a.size;at+=4096){const n=Math.min(4096,a.size-at);assert.deepEqual(await captured.readAt(a.offset+at,n),await source.readAt(b.offset+at,n),'Actual source differs from prepared '+name);}
 }
}
const repeated=await prepareCheckpointRegisteredHeroArrival(source,destination,p.options,p.context);
assert.deepEqual(repeated.plan,p.plan);assert.equal(p.options.attachedUnitBindings.length,0);
assert.deepEqual(Object.keys(repeated.records).sort(),['agent','container','order','unit']);
const words=values=>{const bytes=Buffer.alloc(values.length*4);values.forEach((n,i)=>bytes.writeUInt32LE(n,i*4));return bytes;};
const expectedPack=Buffer.concat([words([0x3141484d,1,4,p.options.sourceClockMs,m.clock,p.selectedOwner.unitId,p.selectedOwner.agentId,
 proxy,100000,1000,0,p.totalRecordBytes]),...['unit','agent','container','order'].flatMap((n,i)=>[words([i,p.selectedOwner.unitId,repeated.records[n].length]),Buffer.from(repeated.records[n])])]);
assert.equal(expectedPack.length,p.pack.bytes);assert.deepEqual(await small(p.pack.filename),expectedPack);
const nativeMap=new Map([[100000,hero]]),agentMap=new Map([[1000,agent],[proxy,proxy]]),expected=new Map(),standalone=[];
for(const[name,prepared]of Object.entries(repeated.records)){
 const bytes=Buffer.from(prepared),put=(at,map)=>{const value=bytes.readUInt32LE(at);assert.ok(map.has(value));bytes.writeUInt32LE(map.get(value),at);};
 let key,observed,payload=bytes;
 if(name==='unit'){put(36,nativeMap);for(const e of p.plan.edits)if(e.record===name&&e.reason==='native script association')put(e.offset-p.plan.ranges[name].offset,agentMap);
  key='UNIT:'+hero;observed='Hero_Arrival_Arrival_Unit_Observed.UNIT';
 }else if(name==='agent'){
  for(const e of p.plan.edits)if(e.record==='agent'){
   if(e.reason==='script identity'||e.reason.startsWith('script:'))put(e.offset-p.plan.ranges.agent.offset,agentMap);
   else if(e.reason==='script native association')put(e.offset-p.plan.ranges.agent.offset,nativeMap);}
  key='GPL:'+agent;observed='Hero_Arrival_Arrival_Agent_Observed.GPL';
 }else if(name==='container'){put(0,nativeMap);for(const at of [56,72])put(at,nativeMap);
  key='CONT:'+hero;observed='Hero_Arrival_Arrival_Container_Observed.bin';payload=bytes.subarray(36);
 }else{assert.equal(name,'order');put(0,nativeMap);key='ORDR:'+hero;observed='Hero_Arrival_Arrival_Orders_Observed.bin';payload=bytes.subarray(36);}
 expected.set(key,bytes);const filename=firstObserved?firstObserved[observed].filename:join(m.profile,observed);
 if(firstObserved){assert.equal(filename,join(m.profile,'First_'+observed));await bound(firstObserved[observed]);}
 assert.deepEqual(await small(filename),payload,name);
 standalone.push({filename,...await hashNativeFile(filename)});
}
async function records(s){const map=new Map(),add=(key,r)=>{assert.ok(!map.has(key)&&map.size<4096);map.set(key,r);};
 for await(const r of checkpointUnits(s))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(s))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(s))add(r.kind+':'+r.unitId,r);return map;}
const before=await stoppedFileSource(m.worlds[3].filename),after=await stoppedFileSource(m.worlds[4].filename);
const bm=await records(before),am=await records(after);
assert.deepEqual([...am.keys()].sort(),[...bm.keys(),...expected.keys()].sort());
for(const[key,bytes]of expected){const r=am.get(key);assert.equal(r.size,bytes.length);
 for(let at=0;at<r.size;at+=4096)assert.deepEqual(Buffer.from(await after.readAt(r.offset+at,Math.min(4096,r.size-at))),bytes.subarray(at,at+4096),key);}
let unrelatedRecordComparisons=0;
for(const[key,r]of bm){const a=am.get(key);assert.equal(a.size,r.size);for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);
 assert.deepEqual(await after.readAt(a.offset+at,n),await before.readAt(r.offset+at,n),key);}unrelatedRecordComparisons++;}
const unscheduled=[34,proxy],states=[];
for(let i=1;i<5;i++)states.push(await connectedWorldState(m.worlds[i].filename,{unscheduledAgents:i===4?[...unscheduled,agent]:unscheduled}));
for(const s of states){assert.equal(s.clock,m.clock);assert.equal(s.rng,states[0].rng);assert.equal(s.gameplayRng,states[0].gameplayRng);assert.equal(s.rawTerrainSha256,states[0].rawTerrainSha256);}
for(const s of states.slice(1,3))assert.deepEqual(s.roots,states[0].roots); // reuse and invalid requests changed no gameplay state
const changed=new Set(['MAP ','GPL ','VHCL','ORDR','CONT','ORLS']);
assert.deepEqual(states[2].roots.filter(r=>!changed.has(r.tag)),states[3].roots.filter(r=>!changed.has(r.tag)));
async function queues(s){const result=[];for await(const q of checkpointAgentQueues(s)){assert.ok(result.length<8192);const {offset,size,...row}=q;result.push(row);}return result;}
assert.deepEqual(await queues(before),await queues(after));assert.ok(!(await queues(after)).some(q=>q.agentId===agent));
assert.equal(await checkpointNextAgentId(before),agent);assert.equal(await checkpointNextAgentId(after),agent+1);
async function root(s,tag){let result;for await(const c of checkpointChunks(s))if(c.tag===tag){assert.equal(result,undefined);result=c;}assert.ok(result);return result;}
for(const[tag,name]of [['VHCL','unit'],['ORDR','order'],['CONT','container']]){const b=await root(before,tag),a=await root(after,tag);
 assert.equal(a.version,b.version);assert.equal(a.count,b.count+1);assert.equal(a.size,b.size+repeated.records[name].length);}
const mb=await root(before,'MAP '),ma=await root(after,'MAP ');assert.equal(mb.size,56);assert.equal(ma.size,56);
const mapBytes=Buffer.from(await before.readAt(mb.offset+16,56));assert.equal(mapBytes.readUInt32LE(48),hero-1);mapBytes.writeUInt32LE(hero,48);
assert.deepEqual(Buffer.from(await after.readAt(ma.offset+16,56)),mapBytes);
async function registrations(s){const r=await root(s,'ORLS');assert.equal(r.version,1);assert.equal(r.size,(r.count+1)*4);assert.ok(r.count<=4096);
 const ids=[];for(let at=0;at<r.size;at+=4096){const b=Buffer.from(await s.readAt(r.offset+16+at,Math.min(4096,r.size-at)));for(let i=0;i<b.length;i+=4)ids.push(b.readUInt32LE(i));}
 assert.equal(ids.shift(),0x5244524f);assert.equal(new Set(ids).size,ids.length);return ids;}
assert.deepEqual(await registrations(after),[...await registrations(before),hero]);
// Account for every opaque GPL byte: one ordered-map insertion, runtime and
// manager envelope sizes, record count and original next-ID counter.
const bg=await root(before,'GPL '),ag=await root(after,'GPL '),agents=[];for await(const a of checkpointAgents(before))agents.push(a);
const added=am.get('GPL:'+agent),delta=added.size+4,last=agents.at(-1),insertion=last.offset+last.size-bg.offset;
assert.ok(last.agentId<agent);assert.equal(ag.size,bg.size+delta);assert.equal(added.offset-4-ag.offset,insertion);
const key=Buffer.from(await after.readAt(added.offset-4,4));assert.equal(key.readUInt32LE(0),agent);
const patches=[];for(const[relative,increment,oldExpected]of [[4,delta,bg.size],[16,delta,bg.size],[28,delta,null],
 [agents[0].offset-8-bg.offset,1,agents.length],[bg.end-12-bg.offset,1,agent]]){
 const old=Buffer.from(await before.readAt(bg.offset+relative,4)).readUInt32LE(0);if(oldExpected!==null)assert.equal(old,oldExpected);
 const bytes=Buffer.alloc(4);bytes.writeUInt32LE(old+increment);patches.push({relative,bytes});}
for(let at=0;at<bg.size+16;){const n=Math.min(4096,bg.size+16-at,at<insertion?insertion-at:Infinity),bytes=Uint8Array.from(await before.readAt(bg.offset+at,n));
 for(const p of patches)for(let j=0;j<4;j++){const relative=p.relative+j-at;if(relative>=0&&relative<n)bytes[relative]=p.bytes[j];}
 assert.deepEqual(await after.readAt(ag.offset+at+(at>=insertion?delta:0),n),bytes);at+=n;}
const alias={unitId:hero,agentId:agent},homeAlias={kind:'proxy',unitId:0,agentId:proxy};
await verifyRegisteredHeroSnapshot(p.identity,alias,homeAlias,after,true,'1_0');
const actor=await checkpointActorRecords(after,hero);assert.equal(actor.agent.agentId,agent);assert.equal(actor.agent.unitId,hero);
assert.equal(actor.agent.deleted,false);assert.equal(actor.unit.agentId,agent);assert.equal(actor.unit.parentUnitId,0);assert.equal(actor.unit.stateFlags&4,0);
for(const key of ['family','description','playerNumber'])assert.equal(actor.unit[key],p.identity.actor[key]);
for(const r of await checkpointAgentReferencePlan(after,agent,id=>id))assert.ok([agent,proxy].includes(r.before));
for await(const r of checkpointActorOrderUnitReferences(after,hero))assert.ok(!r.targetUnitId||r.targetUnitId===hero);
const pure=bm.get('GPL:'+proxy);assert.equal(pure.size,home.proposal.bytes);
for(const name of ['Hero_Arrival_Home_Before.GPL','Hero_Arrival_Home_Observed.GPL'])assert.deepEqual(await small(await observed(name)),Buffer.from(await before.readAt(pure.offset,pure.size)));
let connectedActivation;
if(connected){
 const activeWorld=raw.arrivalWorlds[5];assert.equal(basename(activeWorld.filename),'Hero_Travel_Target_Active.GMP');
 const active=await stoppedFileSource(activeWorld.filename),activeRecords=await records(active);
 assert.deepEqual([...activeRecords.keys()].sort(),[...am.keys()].sort());
 let exactRecordComparisons=0;
 for(const[key,r]of am){const a=activeRecords.get(key);assert.equal(a.size,r.size);
  for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);
   assert.deepEqual(await active.readAt(a.offset+at,n),await after.readAt(r.offset+at,n),key);}
  exactRecordComparisons++;
 }
 const activeState=await connectedWorldState(activeWorld.filename,{unscheduledAgents:unscheduled});
 for(const key of ['clock','rng','gameplayRng','rawTerrainSha256'])assert.equal(activeState[key],states[3][key]);
 assert.deepEqual(activeState.roots.filter(r=>r.tag!=='GPL '),states[3].roots.filter(r=>r.tag!=='GPL '));
 await verifyRegisteredHeroSnapshot(p.identity,alias,homeAlias,active,true,'1_0');
 assert.equal(await checkpointNextAgentId(active),agent+1);
 const readyQueues=[];for await(const q of checkpointAgentQueues(active)){assert.ok(readyQueues.length<8192);readyQueues.push(q);}
 const beforeQueues=[];for await(const q of checkpointAgentQueues(after)){assert.ok(beforeQueues.length<8192);beforeQueues.push(q);}
 const queued=readyQueues.filter(q=>q.agentId===agent);assert.equal(queued.length,1);assert.equal(queued[0].type,'queued-agent');
 assert.ok(!beforeQueues.some(q=>q.agentId===agent));
 const semantic=q=>q.type==='queued-agent'?{type:q.type,queue:q.queue,index:q.index,agentId:q.agentId}:{type:q.type,activeQueue:q.activeQueue};
 assert.deepEqual(readyQueues.filter(q=>q.agentId!==agent).map(semantic),beforeQueues.map(semantic));
 // The only opaque GPL change is the original scheduler's appended ID.
 const b=await root(after,'GPL '),a=await root(active,'GPL '),q=queued[0],atInsert=q.offset-a.offset;
 assert.equal(a.size,b.size+4);assert.equal(a.version,b.version);assert.equal(a.count,b.count);
 assert.equal(q.index,beforeQueues.filter(v=>v.type==='queued-agent'&&v.queue===q.queue).length);
 assert.ok(atInsert>=32&&atInsert<b.size+16);
 const edits=[];for(const[relative,increment,oldExpected]of [[4,4,b.size],[16,4,b.size],[28,4,null],
  [q.offset-(q.index+1)*4-a.offset,1,q.index]]){
  const old=Buffer.from(await after.readAt(b.offset+relative,4)).readUInt32LE(0);if(oldExpected!==null)assert.equal(old,oldExpected);
  const bytes=Buffer.alloc(4);bytes.writeUInt32LE(old+increment);edits.push({relative,bytes});
 }
 assert.equal(Buffer.from(await active.readAt(q.offset,4)).readUInt32LE(0),agent);
 for(let at=0;at<b.size+16;){const n=Math.min(4096,b.size+16-at,at<atInsert?atInsert-at:Infinity),bytes=Uint8Array.from(await after.readAt(b.offset+at,n));
  for(const e of edits)for(let j=0;j<4;j++){const relative=e.relative+j-at;if(relative>=0&&relative<n)bytes[relative]=e.bytes[j];}
  assert.deepEqual(await active.readAt(a.offset+at+(at>=atInsert?4:0),n),bytes);at+=n;
 }
 connectedActivation={activeWorld,exactRecordComparisons,allRecordsExact:true,completeChangedRootQualified:true,
  aiScheduled:true,otherQueuesExact:true,registeredHomePreserved:true,clock:m.clock,originalTicks:0,
  ordinaryAiExecutionQualified:false,ownerTransferred:false};
}
const log=await readFile(m.log,'utf8');assert.ok(log.length<m.logCeilingBytes&&!/result=fail|invariant failed|abort from/.test(log));
assert.ok(log.includes(`source=${p.selectedOwner.unitId}/${p.selectedOwner.agentId} hero=${hero} agent=${agent} proxy=${proxy} clock=${m.clock} records=4`));
if(connected){
 assert.ok(log.includes('footprint=4 drawing=1 queued=1 orders-admitted=1 original-collision=1 original-postload=1'));
 assert.ok(log.includes(`Hero travel arrival ready source=${p.selectedOwner.unitId}/${p.selectedOwner.agentId} source-clock=${p.options.sourceClockMs} region=1_0 hero=${hero} agent=${agent} home=${proxy} clock=${m.clock} original-import=1 activated=1 paused=1 ordinary-ticks=0 owner-published=0 result=pass`));
}
assert.ok(m.resourceSamples.length&&m.resourceSamples.every(r=>r.rssBytes<=m.rssCeilingBytes));
const sourceSha256={...p.sourceSha256,...m.compiledSourceSha256,...sourceQualification?.sourceSha256};
const pending=[resolve('scripts/inspect-native-hero-arrival.mjs')],visited=new Set();
while(pending.length){const n=pending.pop(),name=relative(workspace,n);if(visited.has(name))continue;visited.add(name);
 assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&visited.size<256);
 const text=await readFile(n,'utf8');assert.ok(text.length<256*1024);const h=await hash(n);
 if(sourceSha256[name])assert.equal(h,sourceSha256[name]);sourceSha256[name]=h;
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(n),match[1]));
}
const report={version:1,nativeHeroArrivalQualified:true,manifest:{filename:resolve(manifestName),sha256:await hash(manifestName)},sourceSha256,
 preparation:m.arrivalPreparation,sourceWorld:p.sourceWorld,destinationOriginalWorld:p.destinationWorld,
 beforeWorld:m.worlds[3],importedWorld:m.worlds[4],destinationAliases:alias,homeAlias,standaloneRecords:standalone,
 exactImportedRecords:4,unrelatedRecordComparisons,originalReadersQualified:true,originalFactoryReservationsQualified:true,
 completeChangedRootsQualified:true,otherRootsAndRngExact:true,rawTerrainExact:true,queuesExact:true,
 destinationClock:m.clock,sourceClock:p.options.sourceClockMs,haloPlacement:p.plan.haloPlacement,
 destinationActorImported:true,destinationActivated:!!connectedActivation,sourceRetired:connected,sourceUnloaded:connected,
 ownerTransferred:m.ownerTransferred,publicationIndependentlyQualified:false,
 connectedArrivalActivatedQualified:!!connectedActivation,connectedActivation,connectedSourceQualification:sourceQualification,
 browserUsed:false,nativeSessionTerminal:true,ownedProducerAbsent:true,goalComplete:false,
 elapsedMs:m.finishedAtMs-m.startedAtMs,sampledResourceScope:m.publishArrival?'native-and-owned-publication-worker':'native',
 peakSampledNativeRssBytes:m.publishArrival?undefined:Math.max(...m.resourceSamples.map(r=>r.rssBytes)),
 peakSampledNativeAndPublisherRssBytes:m.publishArrival?Math.max(...m.resourceSamples.map(r=>r.rssBytes)):undefined};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeHeroArrivalQualified:true,exactImportedRecords:4,unrelatedRecordComparisons,
 hero,agent,destinationClock:m.clock,activated:!!connectedActivation,ownerTransferred:m.ownerTransferred,publicationIndependentlyQualified:false}));
