#!/usr/bin/env node
// One owned native engine consumes the production generation request. Only
// the controlled journal/request adapter writes; no browser or second engine.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,rename,mkdir,unlink,copyFile} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {checkpointHeroGenerationInitialization} from '../web/world/arrival.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {publishHeldHeroOwnerCheckpoint} from '../web/world/hero-owner-checkpoint-publication.mjs';
import {requireCheckpointHeroCrossing} from '../web/world/hero-travel-boundary.mjs';
import {parseHeroRuntimeBinding,selectedHeroRuntimeBinding} from '../web/world/hero-runtime-binding.mjs';
import {stageNativeHeroGenerationRequest,HERO_GENERATION_REQUEST} from '../web/world/hero-generation-request.mjs';
import {fileProfileStorage} from '../tests/fixtures/file-profile-storage.mjs';
import {realmFiles} from '../web/world/realm-store.mjs';
import {prepareSelectedHeroGeneratedNeighbor} from './lib/prepare-selected-hero-generated-neighbor.mjs';
import {stageSelectedHeroBrowserInput} from './lib/stage-selected-hero-browser-input.mjs';
import {parseNativeHeroArrivalReady,nativeHeroArrivalPublished,publishHeldNativeHeroArrival} from '../web/world/hero-travel-publication.mjs';

const [inputName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
const json=async name=>{assert.ok((await lstat(name)).size<256*1024);return JSON.parse(await readFile(name,'utf8'));};
const descriptor=async filename=>({filename:resolve(filename),...await hashNativeFile(filename)});
const m=await json(inputName);assert.equal(m.generateNeighbor,true);assert.equal(m.nativeSessionTerminal,false);
await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');
await ownedDirectory(m.publicationJournal,'actor-arrival-fixture-hero-route-');
assert.equal(resolve(outName),join(m.fixture,'generation.json'));await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
function check(){process.kill(m.nativePid,0);}
check();assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const [name,h] of Object.entries(m.compiledSourceSha256))assert.equal((await hashNativeFile(name)).sha256,h);
assert.equal((await hashNativeFile(m.startup.filename)).sha256,m.startup.sha256);
const startup=await json(m.startup.filename),binding=parseHeroRuntimeBinding(m.runtimeBinding);
assert.equal(binding.region,'0_0');assert.equal(binding.homeKind,'native');
const profile=join(m.fixture,'frontier_0_0'),target=join(m.fixture,'frontier_1_0');
async function log(){check();assert.ok((await lstat(m.log)).size<m.logCeilingBytes);return readFile(m.log,'utf8');}
const lines=await log(),crosses=[...lines.matchAll(/^\[frontier\] Hero crossing serial=1 region=0_0 target=(\S+) previous-clock=(\d+) clock=(\d+) unit=(\d+) agent=(\d+) previous=(-?\d+,-?\d+,-?\d+) accepted=(-?\d+,-?\d+,-?\d+) phase=3 pending=7 original-tick=1 native-cells=4$/gm)],
  held=[...lines.matchAll(/^\[frontier\] Hero save held serial=1 region=0_0 clock=(\d+) slot=([01]) bytes=(\d+) sha256=([0-9a-f]{64}) phase=7 pending=0$/gm)];
assert.equal(crosses.length,1);assert.equal(held.length,1);assert.ok(crosses[0].index<held[0].index);
const c=crosses[0],h=held[0],pose=text=>Object.fromEntries(text.split(',').map((v,i)=>[['x','y','z'][i],Number(v)]));
const crossing={serial:1,region:'0_0',target:c[1],previousClock:Number(c[2]),clock:Number(c[3]),unitId:Number(c[4]),agentId:Number(c[5]),
 previous:pose(c[6]),accepted:pose(c[7])};
assert.equal(crossing.target,'1_0');assert.equal(crossing.clock,Number(h[1]));assert.equal(h[2],'1');
assert.equal(crossing.unitId,binding.unitId);assert.equal(crossing.agentId,binding.agentId);
const sourceNames=realmFiles('0_0'),sourceFile=join(profile,'Documents/My Games/MajestyHD/SaveGame',sourceNames.slots[1]),
 captured=await descriptor(sourceFile);assert.equal(captured.bytes,Number(h[3]));assert.equal(captured.sha256,h[4]);
const sourceNativeManifest=await readFile(join(profile,sourceNames.marker),'utf8');
const content='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256;
assert.equal(sourceNativeManifest,['checkpoint-v1',1,captured.bytes,captured.sha256,content,''].join('\n'));
const travel=await requireCheckpointHeroCrossing(await stoppedFileSource(sourceFile),m.runtimeBinding,crossing);
const identity=await json(join(m.publicationJournal,'Frontier_Hero_Route_Identity.json'));
assert.equal(identity.entityId,startup.receipt.owner.entityId);assert.equal(identity.registeredHome.worldId,startup.worldId);
const stats={},store=new HeroRouteStore(await stoppedHeroRouteStorage(m.publicationJournal,stats),identity,identity.contentDigest);
const initial=await store.read();assert.equal(initial.record.manifest,startup.receipt.ownerManifest);
const alias={unitId:binding.unitId,agentId:binding.agentId},homeAlias={kind:'native',unitId:binding.homeUnitId,agentId:binding.homeAgentId};
const operationId=createHash('sha256').update(JSON.stringify(['native-held-generation-capture',captured.sha256,initial.record.manifest])+'\n').digest('hex');
const publication=await publishHeldHeroOwnerCheckpoint(store,{operationId,expectedManifest:initial.record.manifest,region:'0_0',alias,homeAlias,
 clock:crossing.clock,sha256:captured.sha256,source:await stoppedFileSource(sourceFile)});
assert.equal(publication.ownerRevision,1);
const adapter=fileProfileStorage(m.fixture,()=>{check();return true;}),targetNames=realmFiles('1_0');
async function absent(){
 for(const name of [join(target,targetNames.marker),...targetNames.slots.map(n=>join(target,'Documents/My Games/MajestyHD/SaveGame',n))])
  await assert.rejects(lstat(name),e=>e.code==='ENOENT');
}
async function validate(){
 check();assert.equal(await readFile(join(profile,sourceNames.marker),'utf8'),sourceNativeManifest);
 assert.deepEqual(await descriptor(sourceFile),captured);
 await store.withOwner(async selected=>{
  assert.equal(selected.record.manifest,publication.ownerManifest);assert.equal(selected.entry.world.sha256,captured.sha256);
  assert.equal(selected.entry.world.size,captured.bytes);assert.equal(selected.owner.region,'0_0');
  assert.equal(selected.owner.unitId,binding.unitId);assert.equal(selected.owner.agentId,binding.agentId);
 });await absent();check();
}
const request=await stageNativeHeroGenerationRequest(adapter.directory(profile),{serial:1,sourceRegion:'0_0',targetRegion:'1_0',
 sourceClock:crossing.clock,sourceAlias:alias,homeAlias,sourceNativeManifest,ownerManifest:publication.ownerManifest},{check,validate});
assert.equal(request.nativeActionIssued,false);assert.equal(adapter.stats.activeIO,0);assert.equal((await log()).includes('Hero generation request consumed '),false);
const requestPath=join(profile,HERO_GENERATION_REQUEST),preservedRequest=join(profile,'Hero_Generation_Request_1.json');
await writeFile(preservedRequest,request.requestManifest,{flag:'wx'});
let sequence=0;
async function action(){check();const path=join(profile,'Frontier_Hero_Generation_Action.txt');
 await writeFile(path+'.tmp',`majesty-hero-generation-action-v1|1|${++sequence}\n`,{flag:'wx'});await rename(path+'.tmp',path);
}
async function until(find,label,maximumPolls=120){
 for(let i=0;i<maximumPolls;i++){const text=await log(),value=find(text);if(value)return value;
  assert.ok(!/GplException|invariant failed|result=fail|Hero arrival activation refused/.test(text));await new Promise(r=>setTimeout(r,50));}
 assert.fail(label+' was not observed');
}
const controls=[];
for(const kind of ['wrong-seed','wrong-clock','wrong-unit','wrong-target','wrong-owner','orphaned-target']){
 const body=JSON.parse(request.requestManifest),previous=(await log()).split('[frontier] Hero generation request refused ').length-1;
 let orphan;
 if(kind==='wrong-seed')body.generation.seed++;
 if(kind==='wrong-clock')body.sourceClock++;
 if(kind==='wrong-unit')body.sourceAlias.unitId++;
 if(kind==='wrong-target')body.targetRegion='0_1';
 if(kind==='wrong-owner')body.ownerManifest=body.ownerManifest.replace('"revision":1','"revision":2');
 if(kind==='orphaned-target'){
  orphan=join(target,'Documents/My Games/MajestyHD/SaveGame',targetNames.slots[0]);
  await mkdir(dirname(orphan),{recursive:true});await writeFile(orphan,'',{flag:'wx'});
 }
 await writeFile(requestPath,JSON.stringify(body)+'\n');await action();
 await until(text=>text.split('[frontier] Hero generation request refused ').length-1>previous,kind);
 assert.ok(!(await log()).includes('Hero generation request consumed '));
 assert.deepEqual(await descriptor(sourceFile),captured);
 assert.equal(await readFile(join(m.publicationJournal,'Frontier_Hero_Route.checkpoint'),'utf8'),publication.ownerManifest);
 if(orphan){assert.equal((await lstat(orphan)).size,0);await rename(orphan,join(m.fixture,'Hero_Generation_Orphan_Preserved.GMP'));}
 controls.push({kind,refusedByEngine:true,sourceCaptureUnchanged:true,ownerUnchanged:true});
}
await writeFile(requestPath,request.requestManifest);await validate();await action();
const match=await until(text=>/^\[frontier\] Hero generation held serial=1 source=0_0 target=1_0 clock=0 slot=([01]) bytes=(\d+) sha256=([0-9a-f]{64}) layout=halo-v1 shared-vertices=2480 original-generator=1 original-writer=1 source-roots-cleared=1 phase=7 pending=0 ordinary-ticks=0 hero-imported=0 owner-published=0$/m.exec(text),'fresh held checkpoint');
let coldGenerated=await descriptor(join(target,'Documents/My Games/MajestyHD/SaveGame',targetNames.slots[Number(match[1])]));
assert.equal(coldGenerated.bytes,Number(match[2]));assert.equal(coldGenerated.sha256,match[3]);
const coldTargetNativeManifest=['checkpoint-v1',match[1],coldGenerated.bytes,coldGenerated.sha256,content,''].join('\n');
const initialized=await until(text=>/^\[frontier\] Hero generation initialized serial=1 source=0_0 target=1_0 clock=100 slot=([01]) bytes=(\d+) sha256=([0-9a-f]{64}) layout=halo-v1 shared-vertices=2480 original-generator=1 original-writer=1 source-roots-cleared=1 phase=7 pending=0 original-ticks=2 hero-imported=0 owner-published=0$/m.exec(text),'original initialization checkpoint');
assert.notEqual(initialized[1],match[1]);
const stable=await until(text=>/^\[frontier\] Hero generation stable serial=1 target=1_0 clock=100 observed-boundaries=(\d+) elapsed-ns=(\d+) phase=7 pending=0 ordinary-ticks=0$/m.exec(text),'stable initialized clock');
assert.ok(Number(stable[1])>=8);assert.ok(Number(stable[2])>=1e9);
let generated=await descriptor(join(target,'Documents/My Games/MajestyHD/SaveGame',targetNames.slots[Number(initialized[1])]));
assert.equal(generated.bytes,Number(initialized[2]));assert.equal(generated.sha256,initialized[3]);
assert.deepEqual(await descriptor(coldGenerated.filename),coldGenerated);
const targetManifest=await readFile(join(target,targetNames.marker),'utf8');
assert.equal(targetManifest,['checkpoint-v1',initialized[1],generated.bytes,generated.sha256,content,''].join('\n'));
assert.equal(await readFile(join(m.publicationJournal,'Frontier_Hero_Route.checkpoint'),'utf8'),publication.ownerManifest);
assert.deepEqual(await descriptor(sourceFile),captured);
const retired=await descriptor(join(profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Travel_Source_Retired.GMP'));
let arrivalResult;
if(m.arriveGeneratedNeighbor){
 const backup=join(target,'Documents/My Games/MajestyHD/SaveGame/Hero_Generation_Cold.GMP');
 await assert.rejects(lstat(backup),e=>e.code==='ENOENT');await copyFile(coldGenerated.filename,backup);
 const preserved=await descriptor(backup);assert.equal(preserved.sha256,coldGenerated.sha256);assert.equal(preserved.bytes,coldGenerated.bytes);coldGenerated=preserved;
 if(m.repeatGeneratedNeighbor){
  const backup=join(target,'Documents/My Games/MajestyHD/SaveGame/Hero_Generation_Initialized.GMP');
  await copyFile(generated.filename,backup);const preserved=await descriptor(backup);
  assert.equal(preserved.sha256,generated.sha256);assert.equal(preserved.bytes,generated.bytes);generated=preserved;
 }
 const prepared=await prepareSelectedHeroGeneratedNeighbor(store,m.runtimeBinding,crossing,generated);
 assert.equal(prepared.destinationClock,100);
 const homeName=join(m.fixture,'Hero_Generated_Arrival.GPL'),packName=join(m.fixture,'Hero_Generated_Arrival.pack');
 await writeFile(homeName,prepared.home.record,{flag:'wx'});await writeFile(packName,prepared.arrival.pack,{flag:'wx'});
 const home=await descriptor(homeName),pack=await descriptor(packName);
 const staged=await stageSelectedHeroBrowserInput(m,{crossing,owner:{unitId:binding.unitId,agentId:binding.agentId},
  ownerManifest:publication.ownerManifest,nativeManifest:sourceNativeManifest,journal:m.publicationJournal},
  {region:'1_0',clock:100,nativeManifest:targetManifest,homeAlias:{kind:'proxy',unitId:0,agentId:prepared.home.plan.proposedAgentId},
   homeAdmission:prepared.home.plan.admission,proxyRecord:home},{pack});
 const readyMatch=await until(text=>/^\[frontier\] Hero travel publication held receipt=(\S+) phase=7 pending=0 ordinary-ticks=0$/m.exec(text),'generated arrival activation');
 const readyPacket=readyMatch[1],ready=parseNativeHeroArrivalReady(readyPacket);assert.equal(ready.region,'1_0');assert.equal(ready.clock,100);
 const activeNativeManifest=await readFile(join(target,targetNames.marker),'utf8'),slot=Number(activeNativeManifest.split('\n')[1]),
  active=await descriptor(join(target,'Documents/My Games/MajestyHD/SaveGame',targetNames.slots[slot]));
 assert.equal(active.bytes,ready.size);assert.equal(active.sha256,ready.sha256);
 const refusal='[frontier] Hero travel publication refused serial=1 region=1_0 clock=100 phase=7 pending=0';
 const before=(await log()).split(refusal).length-1,ack=join(target,'Frontier_Hero_Travel_Published.txt');
 await writeFile(ack+'.tmp',nativeHeroArrivalPublished(readyPacket,publication.ownerManifest),{flag:'wx'});await rename(ack+'.tmp',ack);
 await until(text=>text.split(refusal).length-1>before,'unpublished generated pair refusal');
 assert.ok(!(await log()).includes('[frontier] Hero travel resumed '));
 const world=async row=>({source:await stoppedFileSource(row.filename),sha256:row.sha256});
 const request={ready:readyPacket,operationId:createHash('sha256').update(JSON.stringify(['native-generated-arrival',publication.ownerManifest,retired.sha256,active.sha256])+'\n').digest('hex'),
  expectedManifest:publication.ownerManifest,sourceRegion:'0_0',sourceAlias:alias,sourceHome:homeAlias,sourceClock:crossing.clock,
  capturedSha256:captured.sha256,retiredSource:await world(retired),activeSource:await world(active)};
 const published=await publishHeldNativeHeroArrival(store,request);assert.equal(published.ownerRevision,2);
 const writes=stats.writes,retry=await publishHeldNativeHeroArrival(store,request);assert.equal(retry.idempotent,true);assert.equal(stats.writes,writes);
 await writeFile(ack+'.tmp',published.acknowledgement,{flag:'wx'});await rename(ack+'.tmp',ack);
 const played=await until(text=>/^\[frontier\] Hero generated neighbor gameplay held serial=1 region=1_0 unit=(\d+) agent=(\d+) home=0\/(\d+) from-clock=100 clock=200 ticks=2 original-gameplay=1 fresh-proxy-binding=1 phase=7 pending=0 result=pass$/m.exec(text),'resumed generated gameplay');
 assert.equal(Number(played[1]),ready.unitId);assert.equal(Number(played[2]),ready.agentId);assert.equal(Number(played[3]),ready.homeAgentId);
 const continued=await descriptor(join(target,'Documents/My Games/MajestyHD/SaveGame/Hero_Generated_Neighbor_Played.GMP'));
 assert.deepEqual(await descriptor(captured.filename),captured);assert.deepEqual(await descriptor(retired.filename),retired);
 assert.deepEqual(await descriptor(generated.filename),generated);assert.deepEqual(await descriptor(active.filename),active);
 arrivalResult={home,pack,staged,ready:readyPacket,active,activeNativeManifest,continued,published,arrivalPlan:prepared.arrival.plan,
  originalGameplayTicks:2,continuedClock:200,unpublishedPairRefused:true,publicationRetryReadOnly:true};
}
const journeyRegions=['0_0','1_0','1_-1','0_-1','-1_-1','-2_-1','-3_-1','-4_-1','-5_-1'];
let repeatedGeneration;const additionalGenerations=[];
if(m.repeatGeneratedNeighbor){
 assert.ok(arrivalResult);repeatedGeneration=await repeatGeneratedJourney(arrivalResult,2,'1_-1');
 let prior=repeatedGeneration;
 for(let serial=3;serial<=(m.generatedNeighborJourneys??2);serial++){
  prior=await repeatGeneratedJourney(prior,serial,journeyRegions[serial]);additionalGenerations.push(prior);
 }
}
await writeFile(outName,JSON.stringify({version:1,nativeGenerationHoldObserved:true,nativeGenerationInitializedObserved:true,
 initializationTicks:2,generatedClock:100,coldGenerated,coldTargetNativeManifest,identity,crossing,travel,captured,retired,generated,
 sourceNativeManifest,targetNativeManifest:targetManifest,publication,request,preservedRequest:await descriptor(preservedRequest),controls,
 stable:{boundaries:Number(stable[1]),elapsedNs:Number(stable[2]),clock:100},sourceStagingStats:adapter.stats,journalStats:stats,
 targetWasAbsentBeforeAction:true,sourceStagedWithoutActionStayedHeld:true,heroImported:!!arrivalResult,ownerTransferred:!!arrivalResult,
 nativeGeneratedArrivalGameplayObserved:!!arrivalResult,arrival:arrivalResult,repeatedGeneration,additionalGenerations,
 browserUsed:false,liveOPFSQualified:false,sustainedMemoryQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeGenerationHoldObserved:true,generatedBytes:generated.bytes,refusals:controls.length}));

// Continue the first imported actor through another original crossing. This
// adapter consumes production stagers and actual checkpoints; it never moves
// the actor, edits game saves or supplies a synthetic clock/arrival receipt.
async function repeatGeneratedJourney(first,serial,targetRegion){
 const firstReady=parseNativeHeroArrivalReady(first.ready),sourceRegion=firstReady.region;
 assert.ok(serial>=2&&serial<=8);assert.equal(sourceRegion,journeyRegions[serial-1]);assert.equal(targetRegion,journeyRegions[serial]);
 const boundary=pattern=>new RegExp('^\\[frontier\\] '+pattern+'$','m');
 const sourceProfile=join(m.fixture,'frontier_'+sourceRegion),targetProfile=join(m.fixture,'frontier_'+targetRegion);
 const sourceNames=realmFiles(sourceRegion),targetNames=realmFiles(targetRegion);
 const runtimeBinding=selectedHeroRuntimeBinding(identity,{region:sourceRegion,
  alias:{unitId:firstReady.unitId,agentId:firstReady.agentId},homeAlias:{kind:'proxy',unitId:0,agentId:firstReady.homeAgentId},
  world:{sha256:first.active.sha256}},firstReady.clock);
 const binding=parseHeroRuntimeBinding(runtimeBinding),alias={unitId:binding.unitId,agentId:binding.agentId},
  homeAlias={kind:'proxy',unitId:0,agentId:binding.homeAgentId};
 const movement=await until(text=>boundary(String.raw`Hero crossing serial=${serial} region=${sourceRegion} target=(\S+) previous-clock=(\d+) clock=(\d+) unit=(\d+) agent=(\d+) previous=(-?\d+,-?\d+,-?\d+) accepted=(-?\d+,-?\d+,-?\d+) phase=3 pending=7 original-tick=1 native-cells=4`).exec(text),'next original crossing',serial>=4?1800:120);
 const crossing={serial,region:sourceRegion,target:movement[1],previousClock:Number(movement[2]),clock:Number(movement[3]),
  unitId:Number(movement[4]),agentId:Number(movement[5]),previous:pose(movement[6]),accepted:pose(movement[7])};
 assert.equal(crossing.target,targetRegion);assert.equal(crossing.unitId,binding.unitId);assert.equal(crossing.agentId,binding.agentId);
 assert.ok(crossing.clock>200&&crossing.previousClock<crossing.clock);
 const held=await until(text=>boundary(String.raw`Hero save held serial=${serial} region=${sourceRegion} clock=(\d+) slot=([01]) bytes=(\d+) sha256=([0-9a-f]{64}) phase=7 pending=0`).exec(text),'next captured checkpoint');
 assert.equal(Number(held[1]),crossing.clock);assert.equal(held[2],'1');
 const captured=await descriptor(join(sourceProfile,'Documents/My Games/MajestyHD/SaveGame',sourceNames.slots[Number(held[2])]));
 assert.equal(captured.bytes,Number(held[3]));assert.equal(captured.sha256,held[4]);
 const sourceNativeManifest=await readFile(join(sourceProfile,sourceNames.marker),'utf8');
 assert.equal(sourceNativeManifest,['checkpoint-v1',held[2],captured.bytes,captured.sha256,content,''].join('\n'));
 const travel=await requireCheckpointHeroCrossing(await stoppedFileSource(captured.filename),runtimeBinding,crossing);
 const publication=await publishHeldHeroOwnerCheckpoint(store,{operationId:createHash('sha256').update(JSON.stringify([
  'native-held-next-generation-capture',serial,captured.sha256,first.published.ownerManifest])+'\n').digest('hex'),
  expectedManifest:first.published.ownerManifest,region:sourceRegion,alias,homeAlias,clock:crossing.clock,
  sha256:captured.sha256,source:await stoppedFileSource(captured.filename)});
 assert.equal(publication.ownerRevision,serial*2-1);
 async function absent(){for(const name of [join(targetProfile,targetNames.marker),...targetNames.slots.map(n=>join(targetProfile,'Documents/My Games/MajestyHD/SaveGame',n))])
  await assert.rejects(lstat(name),e=>e.code==='ENOENT');}
 async function validate(){
  check();assert.equal(await readFile(join(sourceProfile,sourceNames.marker),'utf8'),sourceNativeManifest);
  assert.deepEqual(await descriptor(captured.filename),captured);
  await store.withOwner(async selected=>{
   assert.equal(selected.record.manifest,publication.ownerManifest);assert.equal(selected.entry.world.sha256,captured.sha256);
   assert.equal(selected.entry.world.size,captured.bytes);assert.equal(selected.owner.region,sourceRegion);
   assert.equal(selected.owner.unitId,binding.unitId);assert.equal(selected.owner.agentId,binding.agentId);
  });await absent();check();
 }
 const initialization=await checkpointHeroGenerationInitialization(await stoppedFileSource(captured.filename),binding.unitId,crossing.clock),
  initializedClock=initialization.clock,playedClock=initializedClock+100;
 const request=await stageNativeHeroGenerationRequest(adapter.directory(sourceProfile),{serial,sourceRegion,targetRegion,
  sourceClock:crossing.clock,sourceAlias:alias,homeAlias,sourceNativeManifest,ownerManifest:publication.ownerManifest},{check,validate});
 const preservedRequest=join(sourceProfile,`Hero_Generation_Request_${serial}.json`);await writeFile(preservedRequest,request.requestManifest,{flag:'wx'});
 await validate();const action=join(sourceProfile,'Frontier_Hero_Generation_Action.txt');
 await writeFile(action+'.tmp',`majesty-hero-generation-action-v1|${serial}|1\n`,{flag:'wx'});await rename(action+'.tmp',action);
 const cold=await until(text=>boundary(String.raw`Hero generation held serial=${serial} source=${sourceRegion} target=${targetRegion} clock=0 slot=([01]) bytes=(\d+) sha256=([0-9a-f]{64}) layout=halo-v1 shared-vertices=2480 original-generator=1 original-writer=1 source-roots-cleared=1 phase=7 pending=0 ordinary-ticks=0 hero-imported=0 owner-published=0`).exec(text),'next cold generation');
 let coldGenerated=await descriptor(join(targetProfile,'Documents/My Games/MajestyHD/SaveGame',targetNames.slots[Number(cold[1])]));
 assert.equal(coldGenerated.bytes,Number(cold[2]));assert.equal(coldGenerated.sha256,cold[3]);
 const coldTargetNativeManifest=['checkpoint-v1',cold[1],coldGenerated.bytes,coldGenerated.sha256,content,''].join('\n');
 const warm=await until(text=>boundary(String.raw`Hero generation initialized serial=${serial} source=${sourceRegion} target=${targetRegion} clock=${initializedClock} slot=([01]) bytes=(\d+) sha256=([0-9a-f]{64}) layout=halo-v1 shared-vertices=2480 original-generator=1 original-writer=1 source-roots-cleared=1 phase=7 pending=0 original-ticks=${initialization.ticks} hero-imported=0 owner-published=0`).exec(text),'next initialized generation');
 assert.notEqual(warm[1],cold[1]);
 let generated=await descriptor(join(targetProfile,'Documents/My Games/MajestyHD/SaveGame',targetNames.slots[Number(warm[1])]));
 assert.equal(generated.bytes,Number(warm[2]));assert.equal(generated.sha256,warm[3]);
 const stable=await until(text=>boundary(String.raw`Hero generation stable serial=${serial} target=${targetRegion} clock=${initializedClock} observed-boundaries=(\d+) elapsed-ns=(\d+) phase=7 pending=0 ordinary-ticks=0`).exec(text),'next stable initialized hold');
 assert.ok(Number(stable[1])>=8&&Number(stable[2])>=1e9);
 const targetNativeManifest=await readFile(join(targetProfile,targetNames.marker),'utf8');
 assert.equal(targetNativeManifest,['checkpoint-v1',warm[1],generated.bytes,generated.sha256,content,''].join('\n'));
 const backup=join(targetProfile,'Documents/My Games/MajestyHD/SaveGame/Hero_Generation_Cold.GMP');
 await copyFile(coldGenerated.filename,backup);const preserved=await descriptor(backup);
 assert.equal(preserved.sha256,coldGenerated.sha256);assert.equal(preserved.bytes,coldGenerated.bytes);coldGenerated=preserved;
 const retired=await descriptor(join(sourceProfile,'Documents/My Games/MajestyHD/SaveGame/Hero_Travel_Source_Retired.GMP'));
 const prepared=await prepareSelectedHeroGeneratedNeighbor(store,runtimeBinding,crossing,generated);assert.equal(prepared.destinationClock,initializedClock);
 if(serial<(m.generatedNeighborJourneys??2)){
  const backup=join(targetProfile,'Documents/My Games/MajestyHD/SaveGame/Hero_Generation_Initialized.GMP');
  await copyFile(generated.filename,backup);const preserved=await descriptor(backup);
  assert.equal(preserved.sha256,generated.sha256);assert.equal(preserved.bytes,generated.bytes);generated=preserved;
 }
 const name=serial===2?'Hero_Second_Generated_Arrival':serial===3?'Hero_Third_Generated_Arrival':`Hero_Generated_Arrival_${serial}`;
 const homeName=join(m.fixture,name+'.GPL'),packName=join(m.fixture,name+'.pack');
 await writeFile(homeName,prepared.home.record,{flag:'wx'});await writeFile(packName,prepared.arrival.pack,{flag:'wx'});
 const home=await descriptor(homeName),pack=await descriptor(packName);
 const staged=await stageSelectedHeroBrowserInput(m,{crossing,owner:alias,ownerManifest:publication.ownerManifest,
  nativeManifest:sourceNativeManifest,journal:m.publicationJournal},{region:targetRegion,clock:initializedClock,nativeManifest:targetNativeManifest,
  homeAlias:{kind:'proxy',unitId:0,agentId:prepared.home.plan.proposedAgentId},homeAdmission:prepared.home.plan.admission,proxyRecord:home},{pack});
 const readyMatch=await until(text=>{
  const matches=[...text.matchAll(/^\[frontier\] Hero travel publication held receipt=(\S+) phase=7 pending=0 ordinary-ticks=0$/gm)];
  return matches.find(row=>parseNativeHeroArrivalReady(row[1]).serial===serial);
 },'second activated arrival');
 const readyPacket=readyMatch[1],ready=parseNativeHeroArrivalReady(readyPacket);assert.equal(ready.region,targetRegion);assert.equal(ready.clock,initializedClock);
 const activeNativeManifest=await readFile(join(targetProfile,targetNames.marker),'utf8'),slot=Number(activeNativeManifest.split('\n')[1]),
  active=await descriptor(join(targetProfile,'Documents/My Games/MajestyHD/SaveGame',targetNames.slots[slot]));
 assert.equal(active.bytes,ready.size);assert.equal(active.sha256,ready.sha256);
 const world=async row=>({source:await stoppedFileSource(row.filename),sha256:row.sha256});
 const arrivalRequest={ready:readyPacket,operationId:createHash('sha256').update(JSON.stringify([
  'native-next-generated-arrival',serial,publication.ownerManifest,retired.sha256,active.sha256])+'\n').digest('hex'),
  expectedManifest:publication.ownerManifest,sourceRegion,sourceAlias:alias,sourceHome:homeAlias,sourceClock:crossing.clock,
  capturedSha256:captured.sha256,retiredSource:await world(retired),activeSource:await world(active)};
 const published=await publishHeldNativeHeroArrival(store,arrivalRequest);assert.equal(published.ownerRevision,serial*2);
 const writes=stats.writes,retry=await publishHeldNativeHeroArrival(store,arrivalRequest);assert.equal(retry.idempotent,true);assert.equal(stats.writes,writes);
 const ack=join(targetProfile,'Frontier_Hero_Travel_Published.txt');
 await writeFile(ack+'.tmp',published.acknowledgement,{flag:'wx'});await rename(ack+'.tmp',ack);
 const played=await until(text=>boundary(String.raw`Hero generated neighbor gameplay held serial=${serial} region=${targetRegion} unit=(\d+) agent=(\d+) home=0/(\d+) from-clock=${initializedClock} clock=${playedClock} ticks=2 original-gameplay=1 fresh-proxy-binding=1 phase=7 pending=0 result=pass`).exec(text),'next resumed original gameplay');
 assert.equal(Number(played[1]),ready.unitId);assert.equal(Number(played[2]),ready.agentId);assert.equal(Number(played[3]),ready.homeAgentId);
 const continued=await descriptor(join(targetProfile,'Documents/My Games/MajestyHD/SaveGame/Hero_Generated_Neighbor_Played.GMP'));
 for(const row of [captured,retired,generated,active,first.active,first.continued])assert.deepEqual(await descriptor(row.filename),row);
 return {runtimeBinding,crossing,travel,captured,retired,coldGenerated,generated,sourceNativeManifest,coldTargetNativeManifest,targetNativeManifest,
  publication,request,initialization,preservedRequest:await descriptor(preservedRequest),stable:{boundaries:Number(stable[1]),elapsedNs:Number(stable[2]),clock:initializedClock},
  home,pack,staged,ready:readyPacket,active,activeNativeManifest,continued,published,arrivalPlan:prepared.arrival.plan,
  originalGameplayTicks:2,continuedClock:playedClock,publicationRetryReadOnly:true,targetWasAbsentBeforeAction:true,
  nativeGeneratedArrivalGameplayObserved:true};
}
