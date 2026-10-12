#!/usr/bin/env node
// Build inert original-reader records for an observed crossing into a visited world.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir} from 'node:fs/promises';
import {join,resolve,dirname,basename,relative} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,workspace,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {prepareCheckpointRegisteredHeroArrival,MAX_ARRIVAL_RECORD_BYTES,MAX_ARRIVAL_TOTAL_RECORD_BYTES} from '../web/world/arrival.mjs';
import {checkpointUnitAgentLinks} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {sampleNativeGroundHeight} from '../web/world/terrain-ground.mjs';
import {execFileSync} from 'node:child_process';
const [proofName,directoryName,mode]=process.argv.slice(2),live=mode==='--live';assert.equal(process.argv.length,live?5:4);assert.ok(mode===undefined||live);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),live?/^native-halo-saved-arrival-live-preparation-\d{3}$/:/^native-halo-saved-arrival-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
let proof,m,p,producerManifestBytes;
if(live){
 producerManifestBytes=await readFile(proofName);assert.ok(producerManifestBytes.length<256*1024);m=JSON.parse(producerManifestBytes);p=await json(m.preparation);
 assert.equal(m.nativeOnly,true);assert.equal(m.browserUsed,false);assert.equal(m.ownerPublished,false);assert.equal(m.savedActorArrivalRequested,true);
 assert.equal(m.nativeSessionTerminal,false);assert.equal(m.nativeExitCode,null);process.kill(m.nativePid,0);
 assert.equal(execFileSync('/bin/ps',['-p',String(m.nativePid),'-o','comm='],{encoding:'utf8',maxBuffer:2048}).trim(),m.privateNativeExecutable);
 assert.equal(await hash(m.privateNativeExecutable),m.nativeExecutableSha256);assert.equal(m.root,join(m.fixture,'native-world-halo'));
 const log=await readFile(m.log,'utf8');assert.ok(log.length<4*1024*1024);
 assert.ok(log.includes('Halo session destination held serial=1 key=1_0 clock=3750 phase=7 ordinary-ticks=0'));
 const crossed=[...log.matchAll(/Halo hero crossed source=0_0 destination=1_0 unit=(\d+) agent=(\d+) previous-clock=\d+ clock=(\d+) previous=-?\d+,-?\d+,-?\d+ accepted=-?\d+,-?\d+,-?\d+ projected=(-?\d+),(-?\d+),(-?\d+) native-cells=4 /g)];
 assert.equal(crossed.length,1);assert.deepEqual(crossed[0].slice(1,4).map(Number),[p.selectedOwner.unitId,p.selectedOwner.agentId,m.actorHeldRequest.clock]);
 const saved=async(region,name)=>{const filename=join(m.root,'frontier_'+region,'Documents/My Games/MajestyHD/SaveGame',name);return{filename,...await hashNativeFile(filename,{maximum:2*1024*1024})};};
 proof={destinationActorImported:false,ownerPublished:false,destinationClock:3750,sourceSha256:{},manifest:resolve(proofName),manifestSha256:await hash(proofName),
  retirement:{sourceClock:m.actorHeldRequest.clock,crossing:{heldCheckpoint:await saved('0_0','Halo_Session_Actor_Held_0.GMP'),
   handoff:{destinationPose:Object.fromEntries(['x','y','z'].map((key,i)=>[key,Number(crossed[0][4+i])]))}}},heldWorld:await saved('1_0','Halo_Session_Destination_Held_1.GMP')};
}else{
 proof=await json(proofName);assert.equal(proof.nativeSavedActorDestinationPagingQualified,true);
 assert.equal(await hash(proof.manifest),proof.manifestSha256);m=await json(proof.manifest);p=await json(m.preparation);
 assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
 try{process.kill(m.nativePid,0);throw Error('Saved arrival producer still live');}catch(e){if(e.code!=='ESRCH')throw e;}
}
assert.equal(proof.destinationActorImported,false);assert.equal(proof.ownerPublished,false);assert.equal(proof.destinationClock,3750);
await ownedDirectory(m.fixture,'actor-arrival-fixture-halo-world-session-');
assert.equal(await hash(m.preparation),m.preparationSha256);assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const [n,h]of Object.entries({...m.compiledSourceSha256,...proof.sourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
const sourceWorld=proof.retirement.crossing.heldCheckpoint,destinationWorld=proof.heldWorld;
for(const r of [sourceWorld,destinationWorld])assert.equal(await hash(r.filename),r.sha256);
const source=await stoppedFileSource(sourceWorld.filename),destination=await stoppedFileSource(destinationWorld.filename);
const owner=p.selectedOwner,attachedUnitBindings=[];
for await(const u of checkpointUnitAgentLinks(source))if(u.parentUnitId===owner.unitId){
 assert.ok(attachedUnitBindings.length<3);assert.equal(u.agentId,0);attachedUnitBindings.push({from:u.unitId,to:100001+attachedUnitBindings.length});
}
const options={unitId:owner.unitId,freshUnitId:100000,freshAgentId:1000,unitBindings:[],attachedUnitBindings,
 sourceClockMs:await checkpointSavedClock(source),destinationClockMs:await checkpointSavedClock(destination),
 haloRegions:{version:'halo-v1',sourceRegion:'0_0',destinationRegion:'1_0'}};
assert.equal(options.sourceClockMs,proof.retirement.sourceClock);assert.equal(options.destinationClockMs,3750);
const context={identity:p.identity,regions:['0_0','1_0'],ownerSide:0,
 aliases:[{unitId:owner.unitId,agentId:owner.agentId},{unitId:100000,agentId:1000}],
 homeAliases:[p.actorCrossing.guild,p.savedActorDestination.homeAlias],referenceBindings:[]};
const prepared=await prepareCheckpointRegisteredHeroArrival(source,destination,options,context);
assert.equal(attachedUnitBindings.length,0);assert.deepEqual(Object.keys(prepared.records).sort(),['agent','container','order','unit']);
const placement=prepared.plan.haloPlacement;assert.deepEqual(placement.destinationFixed,proof.retirement.crossing.handoff.destinationPose);
assert.equal(placement.remoteHomeRoutingRequired,true);assert.equal(prepared.plan.registeredHome.destination.agentId,34);
const sourceGround=await sampleNativeGroundHeight(await checkpointTerrain(source),placement.sourceFixed),
 destinationGround=await sampleNativeGroundHeight(await checkpointTerrain(destination),placement.destinationFixed);
assert.equal(sourceGround,destinationGround);assert.equal(placement.sourceFixed.z,placement.destinationFixed.z);
const unit=new DataView(prepared.records.unit.buffer,prepared.records.unit.byteOffset,prepared.records.unit.length);
assert.deepEqual([60,64,68].map(at=>unit.getInt32(at,true)),Object.values(placement.destinationFixed));
assert.deepEqual([72,76].map(at=>unit.getUint32(at,true)),Object.values(placement.destinationGrid));
const agent=new DataView(prepared.records.agent.buffer,prepared.records.agent.byteOffset,prepared.records.agent.length);
for(const c of prepared.plan.contexts){const at=c.offset-prepared.plan.ranges.agent.offset;
 assert.deepEqual([0,4,8,12].map(n=>agent.getUint32(at+n,true)),[c.delay,c.after,c.flags,c.remainder]);
 if(c.active&&!c.paused)assert.equal((options.destinationClockMs-c.after)>>>0,c.elapsed);
}
const sourceSha256={},pending=[resolve('scripts/prepare-native-halo-saved-arrival.mjs')];
while(pending.length){const name=pending.pop(),rel=relative(workspace,name);if(sourceSha256[rel])continue;
 assert.ok(!rel.startsWith('..')&&!rel.startsWith('/')&&Object.keys(sourceSha256).length<128);assert.ok((await lstat(name)).size<256*1024);
 const text=await readFile(name,'utf8');sourceSha256[rel]=await hash(name);
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(name),match[1]));
}
for(const r of [sourceWorld,destinationWorld])assert.equal(await hash(r.filename),r.sha256);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
await mkdir(directory);const records={};let totalRecordBytes=0;
for(const[name,bytes]of Object.entries(prepared.records)){
 assert.match(name,/^[a-z]+$/);assert.ok(bytes.length<=MAX_ARRIVAL_RECORD_BYTES);totalRecordBytes+=bytes.length;
 const filename=join(directory,name+'.bin');await writeFile(filename,bytes,{flag:'wx'});records[name]={filename,...await hashNativeFile(filename)};
}
assert.ok(totalRecordBytes<=MAX_ARRIVAL_TOTAL_RECORD_BYTES);
assert.equal(totalRecordBytes,2760);
const words=values=>{const b=Buffer.alloc(values.length*4);values.forEach((n,i)=>b.writeUInt32LE(n,i*4));return b;};
const names=['unit','agent','container','order'],pack=Buffer.concat([
 words([0x31534948,1,4,options.sourceClockMs,options.destinationClockMs,owner.unitId,owner.agentId,34,100000,1000,0,totalRecordBytes]),
 ...names.flatMap((key,i)=>[words([i,owner.unitId,prepared.records[key].length]),Buffer.from(prepared.records[key])])]);
assert.equal(pack.length,2856);const packName=join(directory,'Halo_Session_Saved_Arrival.pack');await writeFile(packName,pack,{flag:'wx'});
let reference={filename:resolve(proofName),sha256:await hash(proofName)};
if(live){assert.equal(reference.sha256,proof.manifestSha256);const name=join(directory,'Producer.before.json');await writeFile(name,producerManifestBytes,{flag:'wx'});reference={filename:name,sha256:proof.manifestSha256,producerManifest:resolve(proofName)};}
const report={version:1,savedNeighborArrivalCapsulePrepared:true,livePreparation:live,proof:reference,pack:{filename:packName,...await hashNativeFile(packName)},
 compiledSourceSha256:m.compiledSourceSha256,sourceSha256,sourceWorld,destinationWorld,options,context,records,totalRecordBytes,
 plan:prepared.plan,ground:{sourceGround,destinationGround,zPreserved:true},identity:p.identity,existingHomeProxy:34,destinationClock:3750,sourceRetired:true,sourceUnchanged:true,destinationUnchanged:true,
 journal:p.journal,journalSha256:p.journalSha256,selectedManifest:p.selectedManifest,selectedRevision:6,
 nativeProcessesStarted:0,browserUsed:false,heroImported:false,destinationActivated:false,ownerPublished:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({savedNeighborArrivalCapsulePrepared:true,records:4,totalRecordBytes,existingHomeProxy:34,destinationClock:3750}));
