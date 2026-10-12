#!/usr/bin/env node
// Prepare the actual selected traveler against the original saved pure home.
// No actor allocation, save edit, scheduling, or ownership publication occurs.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir} from 'node:fs/promises';
import {join,resolve,dirname,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {ownedDirectory,stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {prepareCheckpointRegisteredHeroArrival,MAX_ARRIVAL_RECORD_BYTES,MAX_ARRIVAL_TOTAL_RECORD_BYTES} from '../web/world/arrival.mjs';
import {checkpointUnitAgentLinks} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {sampleNativeGroundHeight} from '../web/world/terrain-ground.mjs';
import {execFileSync} from 'node:child_process';
const[proofName,directoryName,mode]=process.argv.slice(2);assert.ok(mode===undefined||mode==='--live');assert.equal(process.argv.length,mode?5:4);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-halo-session-arrival-(live-)?preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const hash=async n=>(await hashNativeFile(n)).sha256;
let proof,m,p,producerManifestBytes=null;
if(mode==='--live'){
 producerManifestBytes=await readFile(proofName);assert.ok(producerManifestBytes.length<256*1024);m=JSON.parse(producerManifestBytes);
 assert.ok(['actor-arrival','actor-activation'].includes(m.mode));assert.equal(m.nativeOnly,true);assert.equal(m.browserUsed,false);assert.equal(m.ownerPublished,false);
 assert.equal(m.nativeSessionTerminal,false);assert.equal(m.nativeExitCode,null);process.kill(m.nativePid,0);
 assert.equal(execFileSync('/bin/ps',['-p',String(m.nativePid),'-o','comm='],{encoding:'utf8',maxBuffer:2048}).trim(),m.privateNativeExecutable);
 assert.equal(await hash(m.privateNativeExecutable),m.nativeExecutableSha256);assert.equal(await hash(m.preparation),m.preparationSha256);
 p=await json(m.preparation);assert.equal(m.root,join(m.fixture,'native-world-halo'));assert.equal(m.actorPagingRequest.destination,'1_0');
 const log=await readFile(m.log,'utf8');assert.ok(log.length<4*1024*1024);
 const rows=[...log.matchAll(/Halo session proxy ready serial=1 key=1_0 agent=(\d+) clock=50 phase=7 original-writer=1 ordinary-ticks=1 hero-imported=0 owner-published=0 result=pass/g)];assert.equal(rows.length,1);
 assert.ok(log.includes('Halo session epoch held serial=1 key=1_0 clock=50 phase=7 ordinary-ticks=1'));
 const crossings=[...log.matchAll(/Halo hero crossed source=0_0 destination=1_0 unit=(\d+) agent=(\d+) previous-clock=\d+ clock=(\d+) previous=-?\d+,-?\d+,-?\d+ accepted=-?\d+,-?\d+,-?\d+ projected=(-?\d+),(-?\d+),(-?\d+) native-cells=4 /g)];assert.equal(crossings.length,1);
 assert.deepEqual(crossings[0].slice(1,4).map(Number),[p.selectedOwner.unitId,p.selectedOwner.agentId,m.actorHeldRequest.clock]);
 const saved=async(region,name)=>{const filename=join(m.root,'frontier_'+region,'Documents/My Games/MajestyHD/SaveGame',name);return{filename,...await hashNativeFile(filename,{maximum:2*1024*1024})};};
 proof={manifest:resolve(proofName),manifestSha256:await hash(proofName),sourceSha256:{},destinationEpochQualified:true,
  crossing:{heldCheckpoint:await saved('0_0','Halo_Session_Actor_Held_0.GMP'),crossingClock:m.actorHeldRequest.clock,
   handoff:{destinationPose:Object.fromEntries(['x','y','z'].map((key,i)=>[key,Number(crossings[0][4+i])]))}},
  proxyReadyWorld:await saved('1_0','Halo_Session_Proxy_Ready_1.GMP'),proxyAgentId:Number(rows[0][1])};
}else{
 proof=await json(proofName);assert.equal(proof.nativeRunningDestinationProxyQualified,true);assert.equal(proof.ownerPublished,false);
 assert.equal(await hash(proof.manifest),proof.manifestSha256);m=await json(proof.manifest);p=await json(m.preparation);
 assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
 try{process.kill(m.nativePid,0);throw Error('Native arrival producer is still live');}catch(e){if(e.code!=='ESRCH')throw e;}
}
await ownedDirectory(m.fixture,'actor-arrival-fixture-halo-world-session-');
for(const[n,h]of Object.entries(proof.sourceSha256))assert.equal(await hash(n),h);
for(const[n,h]of Object.entries(m.compiledSourceSha256))assert.equal(await hash(n),h);
const sourceWorld=proof.crossing.heldCheckpoint,destinationWorld=proof.proxyReadyWorld;
for(const r of [sourceWorld,destinationWorld])assert.equal(await hash(r.filename),r.sha256);
const source=await stoppedFileSource(sourceWorld.filename),destination=await stoppedFileSource(destinationWorld.filename);
const owner=p.selectedOwner,attachedUnitBindings=[];
for await(const u of checkpointUnitAgentLinks(source))if(u.parentUnitId===owner.unitId){
 assert.ok(attachedUnitBindings.length<3);assert.equal(u.agentId,0);attachedUnitBindings.push({from:u.unitId,to:100001+attachedUnitBindings.length});
}
assert.equal(attachedUnitBindings.length,3);
const options={unitId:owner.unitId,freshUnitId:100000,freshAgentId:1000,unitBindings:[],attachedUnitBindings,
 sourceClockMs:await checkpointSavedClock(source),destinationClockMs:await checkpointSavedClock(destination),
 haloRegions:{version:'halo-v1',sourceRegion:'0_0',destinationRegion:'1_0'}};
assert.equal(options.sourceClockMs,proof.crossing.crossingClock);assert.ok([0,50].includes(options.destinationClockMs));if(options.destinationClockMs)assert.equal(proof.destinationEpochQualified,true);
const context={identity:p.identity,regions:['0_0','1_0'],ownerSide:0,
 aliases:[{unitId:owner.unitId,agentId:owner.agentId},{unitId:100000,agentId:1000}],
 homeAliases:[p.actorCrossing.guild,{kind:'proxy',unitId:0,agentId:proof.proxyAgentId}],referenceBindings:[]};
let prepared;
try{prepared=await prepareCheckpointRegisteredHeroArrival(source,destination,options,context);}
catch(error){
 for(const r of [sourceWorld,destinationWorld])assert.equal(await hash(r.filename),r.sha256);
 for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
 await mkdir(directory);
 await writeFile(join(directory,'refused.json'),JSON.stringify({version:1,nativeRunningTravelerArrivalPrepared:false,refusal:error.message,
  proof:{filename:resolve(proofName),sha256:await hash(proofName)},sourceWorld,destinationWorld,options,context,
  preparationScriptSha256:await hash('scripts/prepare-native-halo-session-arrival.mjs'),arrivalSourceSha256:await hash('web/world/arrival.mjs'),
  sourceUnchanged:true,destinationUnchanged:true,actualJournalUnchanged:true,nativeProcessesStarted:0,browserUsed:false,heroImported:false,ownerPublished:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
 console.error(JSON.stringify({nativeRunningTravelerArrivalPrepared:false,refusal:error.message,report:join(directory,'refused.json')}));process.exit(1);
}
assert.equal(prepared.plan.registeredHome.guildEntityId,p.identity.registeredHome.guildEntityId);
assert.equal(prepared.plan.registeredHome.destination.agentId,proof.proxyAgentId);
assert.equal(prepared.plan.registeredHome.destinationNativeMembershipRequired,false);
assert.equal(prepared.plan.ranges.order,undefined);assert.equal(prepared.plan.heroOrders,undefined);
assert.equal(Object.keys(prepared.records).length,9);
const placement=prepared.plan.haloPlacement;
assert.deepEqual(placement.destinationFixed,proof.crossing.handoff.destinationPose);
const sourceGround=await sampleNativeGroundHeight(await checkpointTerrain(source),placement.sourceFixed),
 destinationGround=await sampleNativeGroundHeight(await checkpointTerrain(destination),placement.destinationFixed);
assert.equal(sourceGround,destinationGround);
// Preserve the original saved Z as well as the terrain under the global point.
// A moving unit's saved height can differ from a new ground sample; snapping
// it would alter original state during transfer.
assert.equal(placement.destinationFixed.z,placement.sourceFixed.z);
const hero=new DataView(prepared.records.unit.buffer,prepared.records.unit.byteOffset,prepared.records.unit.length);
assert.deepEqual([60,64,68].map(at=>hero.getInt32(at,true)),Object.values(placement.destinationFixed));
assert.deepEqual([72,76].map(at=>hero.getUint32(at,true)),Object.values(placement.destinationGrid));
const savedGroundOffset=placement.sourceFixed.z-sourceGround;
assert.equal(placement.destinationFixed.z-destinationGround,savedGroundOffset);
// Check the actual prepared context words independently of the returned plan.
const agent=new DataView(prepared.records.agent.buffer,prepared.records.agent.byteOffset,prepared.records.agent.length);
for(const c of prepared.plan.contexts){const offset=c.offset-prepared.plan.ranges.agent.offset;
 assert.deepEqual([0,4,8,12].map(n=>agent.getUint32(offset+n,true)),[c.delay,c.after,c.flags,c.remainder]);
 if(c.active&&!c.paused)assert.equal((options.destinationClockMs-c.after)>>>0,c.elapsed);
}
assert.equal(prepared.plan.attachedOrders.length,3);
const profiles=[];
for(const o of prepared.plan.attachedOrders){
 const data=prepared.records[o.record],v=new DataView(data.buffer,data.byteOffset,data.length),range=prepared.plan.ranges[o.record];
 assert.equal(v.getUint32(0,true),o.freshUnitId);assert.equal(o.clockPolicy,'original-halo-effect-preserve-dispatch-age');
 profiles.push(o.markerClock.profile);
 for(const patch of o.markerClock.patches)assert.equal(v.getUint32(patch.offset-range.offset,true),patch.after);
}
assert.deepEqual(profiles.sort(),['arb2-reward-1000','wait-arg1','wait-arg3']);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
const sourceSha256={};
// Include the whole local module dependency closure, including clock/order
// validation. The future native reader must bind these exact inert records.
const pending=[resolve('scripts/prepare-native-halo-session-arrival.mjs')];
while(pending.length){const name=pending.pop(),relative=name.slice(workspace.length+1);if(sourceSha256[relative])continue;
 assert.ok(name.startsWith(workspace+'/')&&Object.keys(sourceSha256).length<128);assert.ok((await lstat(name)).size<256*1024);
 const text=await readFile(name,'utf8');sourceSha256[relative]=await hash(name);
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(name),match[1]));
}
await mkdir(directory);const records={};let totalRecordBytes=0;
let proofReference={filename:resolve(proofName),sha256:await hash(proofName)};
if(producerManifestBytes){assert.equal(proofReference.sha256,proof.manifestSha256);
 const snapshot=join(directory,'Producer.before.json');await writeFile(snapshot,producerManifestBytes,{flag:'wx'});
 assert.equal(await hash(snapshot),proof.manifestSha256);proofReference={filename:snapshot,sha256:proof.manifestSha256,producerManifest:resolve(proofName)};}
for(const[name,bytes]of Object.entries(prepared.records)){
 assert.match(name,/^[A-Za-z0-9_]+$/);assert.ok(bytes.length<=MAX_ARRIVAL_RECORD_BYTES);totalRecordBytes+=bytes.length;
 const filename=join(directory,name+'.bin');await writeFile(filename,bytes,{flag:'wx'});records[name]={filename,...await hashNativeFile(filename)};
}
assert.ok(totalRecordBytes<=MAX_ARRIVAL_TOTAL_RECORD_BYTES);
// One bounded, inert original-reader package for the running native importer.
// Proposed IDs must still be rebound to original reservations before reading.
const ordered=[['unit',0,owner.unitId],...attachedUnitBindings.map(b=>[`attached_${b.from}`,0,b.from]),
 ['agent',1,owner.unitId],['container',2,owner.unitId],...attachedUnitBindings.map(b=>[`attached_order_${b.from}`,3,b.from])];
assert.equal(ordered.length,9);assert.deepEqual(ordered.map(r=>r[0]).sort(),Object.keys(prepared.records).sort());
const words=a=>{const b=Buffer.alloc(a.length*4);a.forEach((n,i)=>b.writeUInt32LE(n,i*4));return b;};
const pack=Buffer.concat([words([0x31415348,1,9,options.sourceClockMs,options.destinationClockMs,owner.unitId,owner.agentId,
 proof.proxyAgentId,options.freshUnitId,options.freshAgentId,3,totalRecordBytes]),
 ...ordered.flatMap(([name,kind,id])=>[words([kind,id,prepared.records[name].length]),Buffer.from(prepared.records[name])])]);
assert.equal(pack.length,totalRecordBytes+48+9*12);const packName=join(directory,'Halo_Session_Arrival.pack');
await writeFile(packName,pack,{flag:'wx'});const packed={filename:packName,...await hashNativeFile(packName)};
for(const r of [sourceWorld,destinationWorld])assert.equal(await hash(r.filename),r.sha256);
const report={version:1,nativeRunningTravelerArrivalPrepared:true,proof:proofReference,
 compiledSourceSha256:m.compiledSourceSha256,nativeExecutableSha256:m.nativeExecutableSha256,sourceWorld,destinationWorld,
 identity:p.identity,selectedOwner:owner,actualOwnerRevision:4,actualOwnerManifest:p.selectedManifest,actualJournal:p.journal,actualJournalSha256:p.journalSha256,
 options,context,records,totalRecordBytes,pack:packed,packDescriptors:ordered,plan:prepared.plan,sourceSha256,
 sourceGround,destinationGround,savedGroundOffset,savedHeightPreserved:true,savedPointGroundContinuityQualified:true,scriptDispatchAgesPreserved:true,attachedOrderDispatchAgesPreserved:true,
 sourceUnchanged:true,destinationUnchanged:true,actualJournalUnchanged:true,nativeProcessesStarted:0,browserUsed:false,
 nativeProducerLive:mode==='--live',destinationProxyIndependentlyQualified:mode!=='--live',
 heroImported:false,attachedOrderRuntimeQualified:false,ownerPublished:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeRunningTravelerArrivalPrepared:true,records:Object.keys(records).length,totalRecordBytes,attachedUnits:attachedUnitBindings.length,report:join(directory,'preparation.json'),heroImported:false}));
