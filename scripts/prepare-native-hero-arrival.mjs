#!/usr/bin/env node
// Prepare an original-reader capsule from the actual production crossing and
// an independently qualified original destination registration. No handoff.
import assert from 'node:assert/strict';
import {readFile,lstat,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve,dirname,basename,relative} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {fileProfileStorage} from '../tests/fixtures/file-profile-storage.mjs';
import {openNativeHeroRouteStore} from '../web/world/hero-route-profile.mjs';
import {nativeHeroContentDigest} from '../web/world/hero-route-launch.mjs';
import {prepareCheckpointRegisteredHeroArrival,MAX_ARRIVAL_TOTAL_RECORD_BYTES} from '../web/world/arrival.mjs';
import {checkpointUnitAgentLinks,checkpointNextAgentId} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {requireCheckpointHaloLayout} from '../web/world/halo-checkpoint-layout.mjs';
import {planHaloActorHandoff} from '../web/world/halo-region-layout.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {sampleNativeGroundHeight} from '../web/world/terrain-ground.mjs';

const [homeName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,4);
const hash=async name=>(await hashNativeFile(name)).sha256;
async function json(name){assert.ok((await lstat(name)).size<256*1024);return JSON.parse(await readFile(name,'utf8'));}
async function bound(row){assert.equal((await lstat(row.filename)).size,row.bytes);assert.equal(await hash(row.filename),row.sha256);}
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-hero-arrival-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const home=await json(homeName);assert.equal(home.nativeHeroHomeRegistrationQualified,true);
assert.equal(home.heroImported,false);assert.equal(home.ownerTransferred,false);
assert.equal(await hash(home.manifest.filename),home.manifest.sha256);
const nativeHome=await json(home.manifest.filename);await bound(nativeHome.preparation);
const p=await json(nativeHome.preparation.filename);assert.equal(await hash(p.proof.filename),p.proof.sha256);
const proof=await json(p.proof.filename),startup=await json(proof.startup.filename);
assert.equal(await hash(proof.startup.filename),proof.startup.sha256);
assert.equal(await hash(p.stoppedCaptureAttempt.filename),p.stoppedCaptureAttempt.sha256);
const capture=await json(p.stoppedCaptureAttempt.filename);
for(const attempt of [capture,nativeHome]){
 assert.equal(attempt.nativeSessionTerminal,true);assert.equal(attempt.nativeExitCode,0);assert.equal(attempt.ownedProducerAbsent,true);
 try{process.kill(attempt.nativePid,0);assert.fail('Original producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
}
const archiveName=join(workspace,'output/hero-home-registration-generation-308/manifest.json'),archive=await json(archiveName);
assert.equal(archive.originalNativeHeroHomeRegistrationQualified,true);
assert.deepEqual(nativeHome.compiledSourceSha256,archive.compiledSourceSha256);
for(const[name,digest]of Object.entries(home.sourceSha256)){
 const row=archive.sources.find(r=>relative(workspace,r.source)===name);assert.ok(row);assert.equal(row.sha256,digest);
 assert.equal(await hash(row.preserved),digest);
}
for(const[name,digest]of Object.entries(startup.sourceSha256))assert.equal(await hash(name),digest);
const sourceWorld=capture.heldSave.checkpoint,destinationWorld=nativeHome.worlds[1];
await bound(sourceWorld);await bound(destinationWorld);
const source=await stoppedFileSource(sourceWorld.filename),destination=await stoppedFileSource(destinationWorld.filename);
let held=false;const fixture=resolve(proof.fixture),lockName='majesty-pair-native-world-'+proof.receipt.world;
const locks={async request(name,options,consume){assert.equal(name,lockName);assert.equal(options.mode,'shared');assert.equal(options.ifAvailable,true);
 assert.equal(held,false);held=true;try{return await consume({});}finally{held=false;}}};
const io=fileProfileStorage(fixture,()=>held),profiles=io.directory(join(fixture,'majesty/profile'));
const route=await openNativeHeroRouteStore(profiles,proof.receipt.world,{worldId:startup.worldId,
 entityId:proof.receipt.owner.entityId,contentDigest:nativeHeroContentDigest(startup.content)},{locks});
let identity;
await route.withOwner(async selected=>{assert.equal(selected.record.manifest,proof.publication.ownerManifest);
 assert.equal(selected.entry.world.sha256,sourceWorld.sha256);identity=route.identity;});
assert.equal(io.stats.writes,0);assert.equal(io.stats.activeIO,0);
const owner=proof.receipt.owner,attachedUnitBindings=[];
for await(const unit of checkpointUnitAgentLinks(source))if(unit.parentUnitId===owner.unitId){
 assert.ok(attachedUnitBindings.length<16);assert.equal(unit.agentId,0);attachedUnitBindings.push({from:unit.unitId,to:100001+attachedUnitBindings.length});}
const options={unitId:owner.unitId,freshUnitId:100000,freshAgentId:1000,unitBindings:[],attachedUnitBindings,
 sourceClockMs:await checkpointSavedClock(source),destinationClockMs:await checkpointSavedClock(destination),
 haloRegions:{version:'halo-v1',sourceRegion:owner.region,destinationRegion:p.region}};
assert.equal(options.sourceClockMs,capture.nativeCrossing.clock);assert.equal(options.destinationClockMs,p.clock);
assert.equal(await checkpointNextAgentId(destination),p.proposedAgentId+1);
const context={identity,regions:[owner.region,p.region],ownerSide:0,
 aliases:[{unitId:owner.unitId,agentId:owner.agentId},{unitId:100000,agentId:1000}],
 homeAliases:[{kind:'native',unitId:identity.registeredHome.home.unitId,agentId:identity.registeredHome.home.agentId},
 {kind:'proxy',unitId:0,agentId:p.proposedAgentId}],referenceBindings:[]};
const layouts=[];for(const[s,key]of [[source,owner.region],[destination,p.region]])layouts.push(await requireCheckpointHaloLayout(s,key,'halo-v1'));
const prepared=await prepareCheckpointRegisteredHeroArrival(source,destination,options,context);
const crossing=planHaloActorHandoff(capture.nativeCrossing.previous,capture.nativeCrossing.accepted,owner.region);
assert.equal(crossing.destinationRegion,p.region);
assert.deepEqual(prepared.plan.haloPlacement.destinationFixed,crossing.destinationPose);
const sourceGround=await sampleNativeGroundHeight(await checkpointTerrain(source),prepared.plan.haloPlacement.sourceFixed),
 destinationGround=await sampleNativeGroundHeight(await checkpointTerrain(destination),prepared.plan.haloPlacement.destinationFixed);
assert.equal(sourceGround,destinationGround);
const sourceSha256={},pending=[resolve('scripts/prepare-native-hero-arrival.mjs')];
while(pending.length){const filename=pending.pop(),name=relative(workspace,filename);if(sourceSha256[name])continue;
 assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&Object.keys(sourceSha256).length<128);
 const text=await readFile(filename,'utf8');assert.ok(text.length<256*1024);sourceSha256[name]=await hash(filename);
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(filename),match[1]));}
// Include every planned child/order record; no effect may be silently omitted.
const ordered=[['unit',0,owner.unitId],...attachedUnitBindings.map(b=>[`attached_${b.from}`,0,b.from]),
 ['agent',1,owner.unitId],['container',2,owner.unitId],['order',3,owner.unitId],
 ...attachedUnitBindings.map(b=>[`attached_order_${b.from}`,3,b.from]).filter(([key])=>key in prepared.records)];
assert.deepEqual(ordered.map(([name])=>name).sort(),Object.keys(prepared.records).sort());
let totalRecordBytes=0;for(const bytes of Object.values(prepared.records))totalRecordBytes+=bytes.length;
assert.ok(totalRecordBytes<=MAX_ARRIVAL_TOTAL_RECORD_BYTES);
const words=values=>{const bytes=Buffer.alloc(values.length*4);values.forEach((n,i)=>bytes.writeUInt32LE(n,i*4));return bytes;};
const pack=Buffer.concat([words([0x3141484d,1,ordered.length,options.sourceClockMs,options.destinationClockMs,
 owner.unitId,owner.agentId,p.proposedAgentId,options.freshUnitId,options.freshAgentId,attachedUnitBindings.length,totalRecordBytes]),
 ...ordered.flatMap(([name,kind,id])=>[words([kind,id,prepared.records[name].length]),Buffer.from(prepared.records[name])])]);
await bound(sourceWorld);await bound(destinationWorld);await mkdir(directory);
const packName=join(directory,'Frontier_Hero_Arrival.pack');await writeFile(packName,pack,{flag:'wx'});
const report={version:1,nativeHeroArrivalPrepared:true,homeRegistration:{filename:resolve(homeName),sha256:await hash(homeName)},
 registrationArchive:{filename:archiveName,sha256:await hash(archiveName)},sourceWorld,destinationWorld,sourceSha256,
 identity,selectedOwner:owner,options,context,plan:prepared.plan,layouts,ground:{sourceGround,destinationGround},
 pack:{filename:packName,...await hashNativeFile(packName)},packDescriptors:ordered.map(([name,kind,id])=>({name,kind,id,bytes:prepared.records[name].length})),
 totalRecordBytes,sourceRetired:false,heroImported:false,destinationActivated:false,ownerTransferred:false,
 originalFilesUnchanged:true,nativeProcessesStarted:0,browserUsed:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeHeroArrivalPrepared:true,records:ordered.length,totalRecordBytes,packBytes:pack.length,
 sourceClock:options.sourceClockMs,destinationClock:options.destinationClockMs,attachedUnits:attachedUnitBindings.length,heroImported:false}));
