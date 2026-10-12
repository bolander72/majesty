#!/usr/bin/env node
// Verify original saved-region import independently of native pass messages.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {inspectNativeHaloSavedActorPaging} from './inspect-native-halo-saved-actor-paging.mjs';
import {prepareCheckpointRegisteredHeroArrival} from '../web/world/arrival.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointAgentQueues,checkpointChunks,checkpointActorRecords,checkpointAgentReferencePlan} from '../web/world/checkpoint.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {checkpointActorOrderUnitReferences} from '../web/world/order-unit-bindings.mjs';
const [trialName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-halo-saved-arrival-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const paging=await inspectNativeHaloSavedActorPaging(trialName),m=await json(trialName),prep=await json(m.preparation);
assert.equal(m.savedActorArrivalRequested,true);assert.equal(m.haloSavedActorArrivalTrialCompleted,true);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);
try{process.kill(m.nativePid,0);throw Error('Native producer is live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(await hash(m.savedArrivalGate.filename),m.savedArrivalGate.sha256);const gate=await json(m.savedArrivalGate.filename);
assert.equal(gate.generation,288);assert.equal(gate.nativeSavedActorDestinationPagingQualified,true);
assert.equal(gate.savedNeighborArrivalCapsulePrepared,true);assert.equal(gate.destinationActorImported,false);
for(const row of gate.sources.concat(gate.evidence))assert.equal(await hash(row.preserved),row.sha256);
const request=m.savedActorArrivalRequest;
for(const r of [request.preparation,request.pack,request.packet])assert.equal(await hash(r.filename),r.sha256);
assert.equal(await hash('scripts/prepare-native-halo-saved-arrival.mjs'),request.helperSha256);
const p=await json(request.preparation.filename);assert.equal(p.savedNeighborArrivalCapsulePrepared,true);assert.equal(p.livePreparation,true);
assert.equal(p.heroImported,false);assert.equal(p.ownerPublished,false);assert.equal(p.destinationActivated,false);
for(const [n,h]of Object.entries({...paging.sourceSha256,...p.sourceSha256,...m.compiledSourceSha256}))assert.equal(await hash(n),h);
assert.equal(await hash(p.proof.filename),p.proof.sha256);const snapshot=await json(p.proof.filename);
assert.equal(snapshot.nativePid,m.nativePid);assert.equal(snapshot.mode,m.mode);assert.equal(snapshot.nativeSessionTerminal,false);
assert.equal(snapshot.nativeExitCode,null);assert.equal(snapshot.savedActorArrivalRequested,true);assert.equal(p.proof.producerManifest,resolve(trialName));
assert.deepEqual(snapshot.compiledSourceSha256,m.compiledSourceSha256);assert.deepEqual(p.compiledSourceSha256,m.compiledSourceSha256);
for(const r of [p.sourceWorld,p.destinationWorld,p.pack,...Object.values(p.records)])assert.equal(await hash(r.filename),r.sha256);
for(const key of ['filename','bytes','sha256']){
 assert.equal(p.destinationWorld[key],paging.heldWorld[key]);assert.equal(p.sourceWorld[key],paging.retirement.crossing.heldCheckpoint[key]);
}
assert.equal(p.options.sourceClockMs,paging.retirement.sourceClock);assert.equal(p.options.destinationClockMs,3750);
assert.equal(p.existingHomeProxy,34);assert.deepEqual(p.context.homeAliases[1],{kind:'proxy',unitId:0,agentId:34});
const source=await stoppedFileSource(p.sourceWorld.filename),destination=await stoppedFileSource(p.destinationWorld.filename);
const repeated=await prepareCheckpointRegisteredHeroArrival(source,destination,p.options,p.context);assert.deepEqual(repeated.plan,p.plan);
assert.equal(p.plan.haloPlacement.remoteHomeRoutingRequired,true);
for(const [name,r]of Object.entries(p.records))assert.deepEqual(new Uint8Array(await readFile(r.filename)),repeated.records[name]);
assert.equal(await readFile(request.packet.filename,'utf8'),`halo-session-saved-arrival-v1\n1\n1_0\n${p.options.sourceClockMs}\n3750\n${p.sourceWorld.sha256}\n${p.destinationWorld.sha256}\n${p.pack.sha256}\n2856\n`);
assert.equal(request.pack.sha256,p.pack.sha256);assert.equal(p.totalRecordBytes,2760);assert.equal(p.pack.bytes,2856);
const words=values=>{const b=Buffer.alloc(values.length*4);values.forEach((n,i)=>b.writeUInt32LE(n,i*4));return b;};
const expectedPack=Buffer.concat([words([0x31534948,1,4,p.options.sourceClockMs,3750,508,25,34,100000,1000,0,2760]),
 ...['unit','agent','container','order'].flatMap((name,i)=>[words([i,508,repeated.records[name].length]),Buffer.from(repeated.records[name])])]);
assert.deepEqual(await readFile(p.pack.filename),expectedPack);
const log=await readFile(m.log,'utf8'),rows=[...log.matchAll(/Halo saved arrival imported source=(\d+)\/(\d+) hero=(\d+) agent=(\d+) proxy=(\d+) clock=3750 records=4 commands=2 exact=1 registry-preserved=1 queues-preserved=1 drawing-preserved=1 original-readers=1 scheduled=0 activation=0 owner-published=0 result=pass/g)];
assert.equal(rows.length,1);const [sourceHero,sourceAgent,hero,agent,proxyId]=rows[0].slice(1).map(Number);
assert.deepEqual([sourceHero,sourceAgent,proxyId],[prep.selectedOwner.unitId,prep.selectedOwner.agentId,34]);
assert.ok(log.includes(`Halo saved arrival saved serial=1 key=1_0 hero=${hero} agent=${agent} clock=3750 records=4 source-retired=1 original-writer=1 scheduled=0 activation=0 owner-published=0 result=pass`));
const nativeMap=new Map([[100000,hero]]),agentMap=new Map([[1000,agent],[34,34]]);
function file(name){const filename=join(m.root,'frontier_1_0',name.endsWith('.GMP')?'Documents/My Games/MajestyHD/SaveGame':'',name),rows=m.files.filter(r=>r.filename===filename);assert.equal(rows.length,1);return rows[0];}
const expected=new Map(),standalone=[];
for(const[name,r]of Object.entries(p.records)){
 const bytes=Buffer.from(await readFile(r.filename)),put=(at,map)=>{const value=bytes.readUInt32LE(at);assert.ok(map.has(value));bytes.writeUInt32LE(map.get(value),at);};
 let key,observed,payload=bytes;
 if(name==='unit'){
  const id=nativeMap.get(bytes.readUInt32LE(36));put(36,nativeMap);
  for(const e of p.plan.edits)if(e.record===name&&e.reason==='native script association')put(e.offset-p.plan.ranges[name].offset,agentMap);
  key='UNIT:'+id;observed='Halo_Saved_Arrival_Unit_Observed.UNIT';
 }else if(name==='agent'){
  for(const e of p.plan.edits)if(e.record==='agent'){
   if(e.reason==='script identity'||e.reason.startsWith('script:'))put(e.offset-p.plan.ranges.agent.offset,agentMap);
   else if(e.reason==='script native association')put(e.offset-p.plan.ranges.agent.offset,nativeMap);
  }key='GPL:'+agent;observed='Halo_Saved_Arrival_Agent_Observed.GPL';
 }else if(name==='container'){
  put(0,nativeMap);for(const at of [56,72])put(at,nativeMap);
  key='CONT:'+hero;observed='Halo_Saved_Arrival_Container_Observed.bin';payload=bytes.subarray(36);
 }else{
  assert.equal(name,'order');const id=nativeMap.get(bytes.readUInt32LE(0));put(0,nativeMap);
  key='ORDR:'+id;observed='Halo_Saved_Arrival_Orders_Observed.bin';payload=bytes.subarray(36);
 }
 assert.ok(!expected.has(key));expected.set(key,bytes);const saved=file(observed);assert.equal(await hash(saved.filename),saved.sha256);
 assert.deepEqual(await readFile(saved.filename),payload,name);standalone.push(saved);
}
assert.equal(expected.size,4);
const beforeWorld=file('Halo_Session_Saved_Arrival_Before_1.GMP'),importedWorld=file('Halo_Session_Saved_Arrival_Imported_1.GMP');
for(const r of [beforeWorld,importedWorld])assert.equal(await hash(r.filename),r.sha256);
const before=await stoppedFileSource(beforeWorld.filename),after=await stoppedFileSource(importedWorld.filename);
async function records(s){const map=new Map(),add=(k,r)=>{assert.ok(!map.has(k)&&map.size<4096);map.set(k,r);};
 for await(const r of checkpointUnits(s))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(s))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(s))add(r.kind+':'+r.unitId,r);return map;}
const bm=await records(before),am=await records(after);assert.deepEqual([...am.keys()].sort(),[...bm.keys(),...expected.keys()].sort());
for(const[key,bytes]of expected){const r=am.get(key);assert.equal(r.size,bytes.length);assert.deepEqual(Buffer.from(await after.readAt(r.offset,r.size)),bytes,key);}
let unrelatedRecordComparisons=0;
for(const[k,r]of bm){const ar=am.get(k);assert.equal(ar.size,r.size,k);for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);
 assert.deepEqual(await after.readAt(ar.offset+at,n),await before.readAt(r.offset+at,n),k);}unrelatedRecordComparisons++;}
async function queues(s){const rows=[];for await(const r of checkpointAgentQueues(s))rows.push(r.type==='queued-agent'?{type:r.type,queue:r.queue,agentId:r.agentId}:{type:r.type,activeQueue:r.activeQueue});return rows;}
assert.deepEqual(await queues(before),await queues(after));for(const q of await queues(after))assert.notEqual(q.agentId,agent);
const bs=await connectedWorldState(beforeWorld.filename,{unscheduledAgents:[34]}),as=await connectedWorldState(importedWorld.filename,{unscheduledAgents:[34,agent]});
assert.equal(bs.clock,3750);assert.equal(as.clock,3750);assert.equal(bs.rng,as.rng);assert.equal(bs.gameplayRng,as.gameplayRng);assert.equal(bs.rawTerrainSha256,as.rawTerrainSha256);
const changed=new Set(['MAP ','GPL ','VHCL','ORDR','CONT','ORLS']);assert.deepEqual(bs.roots.filter(r=>!changed.has(r.tag)),as.roots.filter(r=>!changed.has(r.tag)));
async function root(s,tag){let result;for await(const r of checkpointChunks(s))if(r.tag===tag){assert.equal(result,undefined);result=r;}assert.ok(result);return result;}
for(const[tag,count,bytes]of [['VHCL',1,442],['ORDR',1,392],['CONT',1,76]]){const b=await root(before,tag),a=await root(after,tag);
 assert.equal(a.count,b.count+count);assert.equal(a.size,b.size+bytes);assert.equal(a.version,b.version);}
// The MAP/PRAM writer retains the factory's last reserved native ID. All
// other bytes remain exact; the original factory reserves one native ID.
const mb=await root(before,'MAP '),ma=await root(after,'MAP ');assert.equal(mb.size,56);assert.equal(ma.size,56);
assert.equal(ma.version,mb.version);assert.equal(ma.count,mb.count);
const mapBytes=Buffer.from(await before.readAt(mb.offset+16,56));assert.equal(mapBytes.readUInt32LE(48),hero-1);mapBytes.writeUInt32LE(hero,48);
assert.deepEqual(Buffer.from(await after.readAt(ma.offset+16,56)),mapBytes);
async function registrations(s){const r=await root(s,'ORLS');assert.equal(r.version,1);assert.equal(r.size,(r.count+1)*4);assert.ok(r.size<=16388);
 const words=[];for(let at=0;at<r.size;at+=4096){const bytes=await s.readAt(r.offset+16+at,Math.min(4096,r.size-at)),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.length);for(let j=0;j<bytes.length;j+=4)words.push(v.getUint32(j,true));}
 assert.equal(words.shift(),0x5244524f);assert.equal(new Set(words).size,words.length);return words;}
assert.deepEqual(await registrations(after),[...await registrations(before),hero]);
// Validate the entire GPL root as one original ordered-map insertion plus
// its five envelope/count/counter DWORD changes. No opaque bytes are ignored.
const bg=await root(before,'GPL '),ag=await root(after,'GPL '),agents=[];for await(const r of checkpointAgents(before))agents.push(r);
assert.equal(ag.version,bg.version);assert.equal(ag.count,bg.count);
const last=agents.at(-1),added=am.get('GPL:'+agent),delta=1854,insertion=last.offset+last.size-bg.offset;
assert.ok(last.agentId<agent);assert.equal(added.offset-4-ag.offset,insertion);assert.equal(ag.size,bg.size+delta);
const key=await after.readAt(added.offset-4,4);assert.equal(new DataView(key.buffer,key.byteOffset,4).getUint32(0,true),agent);
const patches=[];for(const[relative,increment,oldExpected]of [[4,delta,bg.size],[16,delta,bg.size],[28,delta,null],[agents[0].offset-8-bg.offset,1,agents.length],[bg.end-12-bg.offset,1,agent]]){
 const raw=await before.readAt(bg.offset+relative,4),old=new DataView(raw.buffer,raw.byteOffset,4).getUint32(0,true);if(oldExpected!==null)assert.equal(old,oldExpected);
 const bytes=Buffer.alloc(4);bytes.writeUInt32LE(old+increment);patches.push({relative,bytes});}
for(let at=0;at<bg.size+16;){const n=Math.min(4096,bg.size+16-at,at<insertion?insertion-at:Infinity),bytes=Uint8Array.from(await before.readAt(bg.offset+at,n));
 for(const p of patches)for(let j=0;j<4;j++){const relative=p.relative+j-at;if(relative>=0&&relative<n)bytes[relative]=p.bytes[j];}
 assert.deepEqual(await after.readAt(ag.offset+at+(at>=insertion?delta:0),n),bytes);at+=n;}
// Confirm the existing home proxy stayed pure and exact, and ownership
// relationships agree with both the typed script and native container.
const alias={unitId:hero,agentId:agent},homeAlias={kind:'proxy',unitId:0,agentId:34};
await verifyRegisteredHeroSnapshot(p.identity,alias,homeAlias,after,true,'1_0');
// Custody publication requires one scheduled AI entry. This import boundary
// deliberately has none; qualify the reciprocal identity and references here
// without weakening that production publication requirement.
const actor=await checkpointActorRecords(after,hero);
assert.equal(actor.agent.agentId,agent);assert.equal(actor.agent.unitId,hero);
assert.equal(actor.agent.deleted,false);assert.equal(actor.unit.agentId,agent);
assert.equal(actor.unit.parentUnitId,0);assert.equal(actor.unit.stateFlags&4,0);
for(const key of ['family','description','playerNumber'])assert.equal(actor.unit[key],p.identity.actor[key]);
for(const ref of await checkpointAgentReferencePlan(after,agent,id=>id))assert.ok([agent,34].includes(ref.before));
for await(const ref of checkpointActorOrderUnitReferences(after,hero))assert.ok(!ref.targetUnitId||ref.targetUnitId===hero);
for(const name of ['Halo_Saved_Home_Before.GPL','Halo_Saved_Home_Observed.GPL']){
 const r=file(name);assert.equal(await hash(r.filename),r.sha256);
 const home=bm.get('GPL:34');assert.deepEqual(await readFile(r.filename),Buffer.from(await before.readAt(home.offset,home.size)));
}
const sourceSha256={...paging.sourceSha256,...p.sourceSha256};sourceSha256['scripts/inspect-native-halo-saved-arrival.mjs']=await hash('scripts/inspect-native-halo-saved-arrival.mjs');
const report={version:1,nativeSavedNeighborActorArrivalQualified:true,paging,manifest:resolve(trialName),manifestSha256:await hash(trialName),
 sourceSha256,preparation:request.preparation,selectedOwner:prep.selectedOwner,destinationAliases:alias,proxyAgentId:34,
 beforeWorld,importedWorld,standaloneRecords:standalone,exactImportedRecordComparisons:4,unrelatedRecordComparisons,
 originalReadersQualified:true,originalFactoryReservationsQualified:true,scriptAndOrderDispatchAgesPreserved:true,globalPoseAndSavedAnchorPreserved:true,
 completeChangedRootsQualified:true,otherWorldRootsAndRngExact:true,rawTerrainExact:true,queuesExact:true,betweenInsertionSnapshotsTicks:0,
 destinationClock:3750,existingHomeProxyExact:true,sourceRetired:true,sourceUnloaded:true,destinationAttached:true,destinationActorImported:true,destinationActivated:false,
 actualJournalUnchanged:true,nativeSessionTerminal:true,nativeExitCode:0,ownerPublished:false,browserUsed:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSavedNeighborActorArrivalQualified:true,exactImportedRecordComparisons:4,unrelatedRecordComparisons,hero,agent,activated:false}));
