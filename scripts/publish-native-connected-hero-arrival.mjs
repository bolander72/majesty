#!/usr/bin/env node
// Select the actual same-process retired/activated pair in a fresh journal.
// Preserve the enrolled seed and native snapshots; no engine/browser is run.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdtemp,readdir,open} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {HeroRouteStore,HERO_ROUTE_HEAD,HERO_ROUTE_IDENTITY} from '../web/world/hero-route-store.mjs';
import {nativeHeroArrivalReady,publishHeldNativeHeroArrival} from '../web/world/hero-travel-publication.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {nativeWorldDirectory} from '../web/world/realm-profile.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';

const [archiveName,startupName,outName]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(outName,/^output\/native-connected-hero-publication-\d{3}-observed\.json$/);
await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const operation=value=>createHash('sha256').update(JSON.stringify(value)+'\n').digest('hex');
const archive=await json(archiveName);
assert.equal(archive.nativeConnectedHeroArrivalActivatedQualified,true);assert.equal(archive.sourceUnloaded,true);
assert.equal(archive.destinationActivated,true);assert.equal(archive.ownerPublished,false);assert.equal(archive.ordinaryTicks,0);
assert.equal(archive.browserUsed,false);assert.equal(Object.keys(archive.compiledInputs).length,54);
for(const r of [...archive.sources,...archive.evidence]){
 assert.equal((await lstat(r.preserved)).size,r.bytes);assert.equal(await hash(r.preserved),r.sha256);
 // Bind the current custody readers to the frozen native qualification.
 if(archive.sources.includes(r)&&(r.original.startsWith(join(workspace,'web')+'/')||r.original.startsWith(join(workspace,'scripts/lib')+'/')))
  assert.equal(await hash(r.original),r.sha256);
}
function evidence(n,h){const rows=archive.evidence.filter(r=>r.original===resolve(n));assert.equal(rows.length,1);
 if(h!==undefined)assert.equal(rows[0].sha256,h);return rows[0];}
const proofRow=evidence(archive.proof.filename,archive.proof.sha256),proof=await json(proofRow.preserved);
assert.deepEqual(proof,archive.qualification);assert.equal(proof.connectedArrivalActivatedQualified,true);
assert.equal(proof.sourceRetired,true);assert.equal(proof.sourceUnloaded,true);assert.equal(proof.destinationActivated,true);
assert.equal(proof.connectedActivation.originalTicks,0);assert.equal(proof.connectedActivation.aiScheduled,true);
const m=await json(evidence(proof.manifest.filename,proof.manifest.sha256).preserved);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
assert.equal(m.stopReason,null);assert.equal(m.nativeProcessesStarted,1);assert.equal(m.ownerTransferred,false);
try{process.kill(m.nativePid,0);throw Error('Connected native producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
const p=await json(evidence(proof.preparation.filename,proof.preparation.sha256).preserved);
const startup=await json(evidence(startupName,await hash(startupName)).preserved);
assert.equal(startup.originalSelectedCrossingSourceStartupQualified,true);assert.equal(startup.independentlyEnrolled,true);
assert.equal(m.initialOwner,true);
const identity=p.identity,initialAlias={unitId:startup.receipt.owner.unitId,agentId:startup.receipt.owner.agentId};
assert.deepEqual(initialAlias,{unitId:p.selectedOwner.unitId,agentId:p.selectedOwner.agentId});
assert.equal(initialAlias.unitId,proof.connectedSourceQualification.removedUnitId);
assert.equal(initialAlias.agentId,proof.connectedSourceQualification.removedAgentId);
assert.equal(identity.entityId,startup.receipt.owner.entityId);
assert.equal(identity.registeredHome.worldId,startup.worldId);
const sourceHome={kind:'native',unitId:identity.registeredHome.home.unitId,agentId:identity.registeredHome.home.agentId};
const targetAlias=proof.destinationAliases,targetHome=proof.homeAlias;
const captured=proof.connectedSourceQualification.sourceWorld,retired=proof.connectedSourceQualification.retiredWorld;
const active=proof.connectedActivation.activeWorld;
const snapshots=[captured,retired,active,proof.importedWorld,proof.connectedSourceQualification.paging.heldDestination];
async function unchangedSnapshots(){for(const r of snapshots){
 assert.equal((await lstat(r.filename)).size,r.bytes);assert.equal(await hash(r.filename),r.sha256);
 assert.ok(archive.snapshots.some(v=>v.filename===r.filename&&v.sha256===r.sha256&&v.bytes===r.bytes));
}}
await unchangedSnapshots();
assert.equal(await checkpointSavedClock(await stoppedFileSource(captured.filename)),proof.sourceClock);
assert.equal(await checkpointSavedClock(await stoppedFileSource(retired.filename)),proof.sourceClock);
assert.equal(await checkpointSavedClock(await stoppedFileSource(active.filename)),proof.destinationClock);
const seedDirectory=join(startup.fixture,'majesty/profile',nativeWorldDirectory(startup.receipt.world),'hero-route');
const seedHashes=startup.routeHashes,seedNames=Object.keys(seedHashes).sort();assert.equal(seedNames.length,4);
async function unchangedSeed(){assert.deepEqual((await readdir(seedDirectory)).sort(),seedNames);
 for(const n of seedNames)assert.equal(await hash(join(seedDirectory,n)),seedHashes[n]);
 assert.equal(await readFile(join(seedDirectory,HERO_ROUTE_HEAD),'utf8'),startup.receipt.ownerManifest);
 assert.deepEqual(await json(join(seedDirectory,HERO_ROUTE_IDENTITY)),identity);
}
await unchangedSeed();
async function world(r){return {source:await stoppedFileSource(r.filename),sha256:r.sha256};}
// First select the exact accepted capture as the recovery owner. Interrupted
// handoffs must retain this checkpoint, not rewind to the initial94550 save.
async function cloneCaptured(){
 await unchangedSeed();const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-hero-route-'));
 for(const n of seedNames){const file=await open(join(directory,n),'wx');let at=0;
  try{assert.equal((await hashNativeFile(join(seedDirectory,n),{sink:async bytes=>{
   for(let i=0;i<bytes.length;){const {bytesWritten}=await file.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);at+=bytesWritten;i+=bytesWritten;}
  }})).sha256,seedHashes[n]);await file.sync();}finally{await file.close();}}
 const stats={},io=await stoppedHeroRouteStorage(directory,stats),store=new HeroRouteStore(io,identity,identity.contentDigest);
 const initial=await store.read();assert.equal(initial.record.manifest,startup.receipt.ownerManifest);
 const saved=await store.commit({kind:'save',operationId:operation(['connected-hero-capture',proofRow.sha256,captured.sha256]),
  expectedManifest:initial.record.manifest,regions:['0_0'],aliases:[initialAlias],homeAliases:[sourceHome],worlds:[await world(captured)]});
 assert.equal(saved.revision,1);
 return {directory,stats,io,store,captureManifest:saved.manifest};
}
const heldReady=r=>nativeHeroArrivalReady({serial:m.heldSave.serial,region:'1_0',clock:proof.destinationClock,
 unitId:targetAlias.unitId,agentId:targetAlias.agentId,homeAgentId:targetHome.agentId,size:r.bytes,sha256:r.sha256});
async function request(f){return {ready:heldReady(active),operationId:operation(['connected-hero-arrival',proofRow.sha256,f.captureManifest,retired.sha256,active.sha256]),
 expectedManifest:f.captureManifest,sourceRegion:'0_0',sourceAlias:initialAlias,sourceHome,sourceClock:proof.sourceClock,
 capturedSha256:captured.sha256,retiredSource:await world(retired),activeSource:await world(active)};}
async function owner(f,published){
 const store=new HeroRouteStore(f.io,identity,identity.contentDigest);let result,escaped;
 await store.withOwner(async v=>{
  assert.equal(v.owner.region,published?'1_0':'0_0');assert.equal(v.owner.entityId,identity.entityId);
  assert.deepEqual(v.entry.alias,published?targetAlias:initialAlias);assert.deepEqual(v.entry.homeAlias,published?targetHome:sourceHome);
  assert.equal(v.entry.world.sha256,(published?active:captured).sha256);
  assert.equal(await checkpointSavedClock(v.source),published?proof.destinationClock:proof.sourceClock);
  result={record:v.record,owner:v.owner,entry:v.entry};escaped=v.source;
 });await assert.rejects(escaped.readAt(0,16),/lease ended/);return result;
}
const refusals=[];
for(const [kind,bad,side]of [['source-still-owns',captured,0],['destination-before-import',proof.connectedSourceQualification.paging.heldDestination,1],
 ['destination-not-activated',proof.importedWorld,1]]){
 const f=await cloneCaptured(),r=await request(f),writes=f.stats.writes;r[side?'activeSource':'retiredSource']=await world(bad);
 if(side)r.ready=heldReady(bad); // Exercise the saved graph, not just a descriptor mismatch.
 await assert.rejects(publishHeldNativeHeroArrival(f.store,r));assert.equal(f.stats.writes,writes);await owner(f,false);
 refusals.push({kind,directory:f.directory,additionalWrites:0,capturedOwnerPreserved:true});
}
const interruptions=[];
for(const stage of ['after-source','after-destination','before-publish','after-publish']){
 const f=await cloneCaptured(),r=await request(f);
 await assert.rejects(publishHeldNativeHeroArrival(f.store,r,{boundary:at=>{if(at===stage)throw Error('connected hero interruption');}}),/connected hero interruption/);
 const selected=await owner(f,stage==='after-publish'),retry=await publishHeldNativeHeroArrival(f.store,r);assert.equal(retry.ownerRevision,2);
 assert.equal(retry.idempotent,stage==='after-publish');await owner(f,true);
 interruptions.push({stage,directory:f.directory,selectedRevisionAfterInterruption:selected.record.revision,
  recoveredRevision:2,idempotent:retry.idempotent,completePairSelected:true,stats:f.stats});
}
const boundaryRefusals=[];
for(const [kind,change]of [['wrong-source-clock',r=>{r.sourceClock++;}],['changed-captured-digest',r=>{r.capturedSha256='0'.repeat(64);}],
 ['changed-outgoing-alias',r=>{r.sourceAlias={...r.sourceAlias,unitId:r.sourceAlias.unitId+1};}]]){
 const f=await cloneCaptured(),r=await request(f),writes=f.stats.writes;change(r);
 await assert.rejects(publishHeldNativeHeroArrival(f.store,r));assert.equal(f.stats.writes,writes);await owner(f,false);
 boundaryRefusals.push({kind,directory:f.directory,additionalWrites:0,capturedOwnerPreserved:true});
}
const cancellations=[];
for(const stage of ['before-publish','after-publish']){
 const f=await cloneCaptured(),r=await request(f),controller=new AbortController(),reason=Error('Held hero publication cancelled at '+stage);
 await assert.rejects(publishHeldNativeHeroArrival(f.store,r,{signal:controller.signal,boundary:at=>{
  if(at===stage)controller.abort(reason);
 }}),e=>e===reason);
 const selected=await owner(f,stage==='after-publish'),writes=f.stats.writes;
 const recovered=await publishHeldNativeHeroArrival(f.store,r);assert.equal(recovered.ownerRevision,2);
 if(stage==='after-publish')assert.equal(f.stats.writes,writes);
 await owner(f,true);cancellations.push({stage,directory:f.directory,acknowledgementProduced:false,
  selectedRevisionAfterCancellation:selected.record.revision,recoveredRevision:2,idempotent:recovered.idempotent,stats:f.stats});
}
const actual=await cloneCaptured(),r=await request(actual),published=await publishHeldNativeHeroArrival(actual.store,r);assert.equal(published.ownerRevision,2);
const selected=await owner(actual,true),writes=actual.stats.writes;
const retried=await publishHeldNativeHeroArrival(actual.store,r);assert.equal(retried.idempotent,true);assert.equal(actual.stats.writes,writes);
const opened=[],originalOpen=actual.io.open;actual.io.open=async n=>{opened.push(n);return originalOpen(n);};await owner(actual,true);
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_1_0_0.GMP']);
const names=(await readdir(actual.directory)).sort(),worldNames=names.filter(n=>n.endsWith('.GMP'));assert.equal(worldNames.length,3);
for(const[key,row]of [['Frontier_Hero_Route_0_0_0.GMP',retired],['Frontier_Hero_Route_0_0_1.GMP',captured],['Frontier_Hero_Route_1_0_0.GMP',active]])
 assert.equal(await hash(join(actual.directory,key)),row.sha256);
for(const s of [actual.stats,...interruptions.map(v=>v.stats)]){assert.ok(s.largestRead<=4096&&s.largestWrite<=4096);assert.equal(s.peakReads,1);}
await unchangedSeed();await unchangedSnapshots();
const sourceSha256={},pending=[resolve('scripts/publish-native-connected-hero-arrival.mjs')];
while(pending.length){const n=pending.pop(),name=relative(workspace,n);if(sourceSha256[name])continue;
 assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&Object.keys(sourceSha256).length<256);
 const text=await readFile(n,'utf8');assert.ok(text.length<256*1024);sourceSha256[name]=await hash(n);
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(n),match[1]));}
const journalSha256={};for(const n of names)journalSha256[n]=await hash(join(actual.directory,n));
const report={version:1,connectedNativeHeroPairPublished:true,nativeArchive:{filename:resolve(archiveName),sha256:await hash(archiveName)},
 nativeProof:{filename:proofRow.preserved,sha256:proofRow.sha256},startup:{filename:resolve(startupName),sha256:await hash(startupName)},
 journal:actual.directory,journalSha256,identity,capturedWorld:captured,retiredWorld:retired,activeWorld:active,
 capturedManifest:actual.captureManifest,selectedManifest:published.ownerManifest,selectedRevision:2,selectedOwner:selected.owner,
 heldReady:r.ready,publicationReceipt:published,productionHeldPublicationQualified:true,nativeReceiptConsumed:false,
 selected,sourceClock:proof.sourceClock,destinationClock:proof.destinationClock,originalTicks:0,
 immutableRegisteredHomePreserved:true,seedJournalUnchanged:true,nativeSnapshotsUnchanged:true,captureRecoveryRetained:true,
 retainedCheckpointSlots:3,maximumSlotsPerRegion:2,exactRetryWrites:0,ownerExportDormantWorldsOpened:0,ownerReaderRevoked:true,
 refusals,interruptions,boundaryRefusals,cancellations,stats:actual.stats,sourceSha256,nativeProcessesStarted:0,browserUsed:false,
 livePublicationQualified:false,connectedResumeQualified:false,concurrentOsWritersQualified:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({connectedNativeHeroPairPublished:true,selectedRevision:2,ownerRegion:selected.owner.region,
 interruptionRecoveries:interruptions.length,refusals:refusals.length+boundaryRefusals.length,cancellations:cancellations.length,
 exactRetryWrites:0,retainedCheckpointSlots:3}));
