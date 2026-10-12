#!/usr/bin/env node
// Publish original source retirement and original home continuation together.
// Only an owned stopped journal is writable; this never imports a live actor.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdtemp,readdir,open} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {checkpointActorRecords,checkpointAgents} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
const[archiveName,outputName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outputName,/^output\/native-halo-return-route-publication-\d{3}-observed\.json$/);await assert.rejects(lstat(outputName),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const archive=await json(archiveName);assert.equal(archive.generation,253);assert.equal(archive.nativeReturnedSourceRetirementQualified,true);
assert.equal(archive.removedRecords,7);assert.equal(archive.unrelatedRecordComparisons,455);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
function bound(original,digest){const rows=archive.evidence.filter(r=>r.original===resolve(original));assert.equal(rows.length,1);
 if(digest!==undefined)assert.equal(rows[0].sha256,digest);return rows[0];}
const proofRow=bound('output/native-halo-return-source-001-observed.json'),proof=await json(proofRow.preserved);
const trialRow=bound(proof.manifest,proof.manifestSha256),trial=await json(trialRow.preserved),prepRow=bound(trial.preparation,trial.preparationSha256),p=await json(prepRow.preserved);
assert.equal(proof.nativeReturnedSourceRetirementQualified,true);assert.equal(proof.originalRemovalQualified,true);assert.equal(proof.ownerPublished,false);
assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);assert.equal(trial.stopReason,null);
try{process.kill(trial.nativePid,0);throw Error('Source producer still live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(await hash(archive.nativeExecutableRetained),archive.nativeExecutableSha256);
const sourceRow=bound(proof.retiredWorld.filename,proof.retiredWorld.sha256),destRow=bound(p.qualifiedDestination.filename,p.qualifiedDestination.sha256);
const source={filename:sourceRow.preserved,bytes:sourceRow.bytes,sha256:sourceRow.sha256};
const destination={filename:destRow.preserved,bytes:destRow.bytes,sha256:destRow.sha256};
assert.equal(await hash(p.liveArchive.filename),p.liveArchive.sha256);const liveArchive=await json(p.liveArchive.filename);
assert.equal(liveArchive.nativeReturnedHeroContinuationQualified,true);assert.equal(liveArchive.waitDeadlinePreserved,true);
for(const r of liveArchive.sources.concat(liveArchive.evidence))assert.equal(await hash(r.preserved),r.sha256);
const liveProofRow=liveArchive.evidence.find(r=>r.original.endsWith('/output/native-halo-return-live-001-observed.json'));assert.ok(liveProofRow);
const liveProof=await json(liveProofRow.preserved),liveTrialRow=liveArchive.evidence.find(r=>r.original===liveProof.manifest);assert.ok(liveTrialRow);
assert.equal(liveTrialRow.sha256,liveProof.manifestSha256);const liveTrial=await json(liveTrialRow.preserved);
assert.equal(liveTrial.nativeSessionTerminal,true);assert.equal(liveTrial.nativeExitCode,0);assert.equal(liveTrial.ownedProducerAbsent,true);
try{process.kill(liveTrial.nativePid,0);throw Error('Home producer still live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(destination.sha256,liveTrial.worlds[2].sha256);
assert.equal(await checkpointSavedClock(await stoppedFileSource(source.filename)),1500);
assert.equal(await checkpointSavedClock(await stoppedFileSource(destination.filename)),63650);
const filenames=(await readdir(p.journal)).sort();assert.deepEqual(filenames,Object.keys(p.journalSha256).sort());
async function unchanged(){for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
 assert.equal(await readFile(join(p.journal,HERO_ROUTE_HEAD),'utf8'),p.ownerManifest);}
await unchanged();
const operationId=createHash('sha256').update(JSON.stringify({kind:'original-home-return',sourceProofSha256:proofRow.sha256,
 destinationProofSha256:liveProofRow.sha256,previousManifest:p.ownerManifest,worlds:[source.sha256,destination.sha256],identity:p.identity})+'\n').digest('hex');
async function request(){return{kind:'handoff',operationId,expectedManifest:p.ownerManifest,regions:['0_-1','0_0'],
 aliases:[{unitId:510,agentId:54},{unitId:496,agentId:22}],
 homeAliases:[{kind:'proxy',unitId:0,agentId:53},{kind:'native',unitId:469,agentId:7}],
 worlds:await Promise.all([source,destination].map(async r=>({source:await stoppedFileSource(r.filename),sha256:r.sha256})))};}
async function context(directory){const stats={},io=await stoppedHeroRouteStorage(directory,stats),store=new HeroRouteStore(io,p.identity,p.identity.contentDigest);
 const before=await store.read();assert.equal(before.record.manifest,p.ownerManifest);assert.deepEqual(before.owner,p.selected.owner);
 return{directory,stats,io,store};}
async function clone(){await unchanged();const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-hero-route-'));
 for(const n of filenames){const f=await open(join(directory,n),'wx');let at=0;
  try{assert.equal((await hashNativeFile(join(p.journal,n),{sink:async bytes=>{
   for(let i=0;i<bytes.length;){const{bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
  }})).sha256,p.journalSha256[n]);await f.sync();}finally{await f.close();}}
 return context(directory);}
async function owner(f,region){const store=new HeroRouteStore(f.io,p.identity,p.identity.contentDigest),selected=await store.read();
 assert.equal(selected.owner.region,region);assert.equal(selected.owner.entityId,p.identity.entityId);
 assert.deepEqual({unitId:selected.owner.unitId,agentId:selected.owner.agentId},region==='0_0'?{unitId:496,agentId:22}:{unitId:510,agentId:54});return selected;}
const interruptions=[];
for(const stage of ['after-source','after-destination','before-publish','after-publish']){
 const f=await clone(),r=await request();await assert.rejects(f.store.commit(r,async at=>{if(at===stage)throw Error('return qualification interruption');}),/return qualification interruption/);
 const observed=await owner(f,stage==='after-publish'?'0_0':'0_-1'),recovered=await f.store.commit(r);
 assert.equal(recovered.revision,3);assert.equal(recovered.idempotent,stage==='after-publish');await owner(f,'0_0');
 interruptions.push({stage,directory:f.directory,ownerAfterInterruption:observed.owner.region,recoveredRevision:3,idempotent:recovered.idempotent,stats:f.stats});
}
const refusals=[];
for(const kind of ['duplicate-northern-owner','deleted-home-guild']){
 const f=await clone(),r=await request();let at,value,input;
 if(kind==='duplicate-northern-owner'){
  input=await stoppedFileSource(join(p.journal,'Frontier_Hero_Route_0_-1_1.GMP'));
  const hero=await checkpointActorRecords(input,510);at=hero.unit.offset+60;value=(await input.readAt(at,1))[0]^1;
 }else{
  input=await stoppedFileSource(destination.filename);let guild;for await(const a of checkpointAgents(input))if(a.agentId===7)guild=a;
  assert.ok(guild&&!guild.deleted);at=guild.nativeIdOffset+4;value=1;
 }
 const changed={size:input.size,async readAt(offset,n){const bytes=await input.readAt(offset,n);if(offset<=at&&at<offset+n)bytes[at-offset]=value;return bytes;}};
 r.worlds[kind==='duplicate-northern-owner'?0:1]={source:changed,sha256:await hashCheckpointSource(changed)};
 let refusal;try{await f.store.commit(r);}catch(e){refusal=e.message;}
 assert.match(refusal??'',kind==='duplicate-northern-owner'?/Retired|membership/:/association.*missing|Registered home guild/);
 const selected=await owner(f,'0_-1');assert.equal(selected.record.manifest,p.ownerManifest);
 refusals.push({kind,refusal,directory:f.directory,selectedOwner:'0_-1'});
}
await unchanged();const actual=await context(p.journal),r=await request(),published=await actual.store.commit(r);
assert.equal(published.revision,3);assert.equal(published.idempotent,false);const selected=await owner(actual,'0_0');
const writes=actual.stats.writes,retry=await actual.store.commit(r);assert.equal(retry.idempotent,true);assert.equal(actual.stats.writes,writes);
const opened=[],originalOpen=actual.io.open;actual.io.open=async n=>{opened.push(n);return originalOpen(n);};
let exportedSource;await actual.store.withOwner(async v=>{
 assert.equal(v.entry.world.sha256,destination.sha256);assert.equal(await checkpointSavedClock(v.source),63650);exportedSource=v.source;
});assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_0_0_0.GMP']);
await assert.rejects(exportedSource.readAt(0,16),/lease ended/);
await actual.store.withDestination('0_-1',null,async v=>{
 assert.deepEqual(v.regions,['0_0','0_-1']);assert.equal(v.entries[0].world.sha256,destination.sha256);
 assert.equal(v.entries[1].world.sha256,source.sha256);assert.equal(v.sources.length,2);
});
const afterFiles=(await readdir(p.journal)).sort();assert.equal(afterFiles.filter(n=>n.endsWith('.GMP')).length,4);
for(const n of ['Frontier_Hero_Route_0_-1_1.GMP','Frontier_Hero_Route_0_0_1.GMP','Frontier_Hero_Route_Identity.json',
 'Frontier_Hero_Route_Node_0.json','Frontier_Hero_Route_Node_1.json','Frontier_Hero_Route_Node_2.json'])assert.equal(await hash(join(p.journal,n)),p.journalSha256[n]);
assert.equal(await hash(join(p.journal,'Frontier_Hero_Route_0_-1_0.GMP')),source.sha256);
assert.equal(await hash(join(p.journal,'Frontier_Hero_Route_0_0_0.GMP')),destination.sha256);
assert.equal(await readFile(join(p.journal,HERO_ROUTE_HEAD),'utf8'),published.manifest);
for(const stats of [actual.stats,...interruptions.map(r=>r.stats)]){assert.ok(stats.largestRead<=4096&&stats.largestWrite<=4096);assert.equal(stats.peakReads,1);}
const sourceSha256={};for(const n of ['scripts/publish-native-halo-return-route.mjs','scripts/lib/native-generation.mjs','scripts/lib/stopped-entity-io.mjs',
 'scripts/lib/stopped-hero-route-io.mjs','web/world/hero-route-store.mjs','web/world/entity-ownership.mjs','web/world/entity-home-ownership.mjs',
 'web/world/checkpoint.mjs','web/world/checkpoint-lease.mjs','web/world/saved-clock.mjs','web/world/transfer-store.mjs'])sourceSha256[n]=await hash(n);
const journalSha256={};for(const n of afterFiles)journalSha256[n]=await hash(join(p.journal,n));
const report={version:1,stoppedOriginalHaloReturnPublished:true,sourceArchive:{filename:resolve(archiveName),sha256:await hash(archiveName)},
 qualifiedSourceProof:{filename:proofRow.preserved,sha256:proofRow.sha256},qualifiedDestinationProof:{filename:liveProofRow.preserved,sha256:liveProofRow.sha256},
 sourceWorld:source,destinationWorld:destination,journal:p.journal,journalSha256,identity:p.identity,previousManifest:p.ownerManifest,
 selectedManifest:published.manifest,selectedRevision:3,selectedOwner:selected.owner,sourceClock:1500,destinationClock:63650,
 retiredSourceSelected:true,returnedHomeSelected:true,immutableRegisteredHomePreserved:true,retainedCheckpointSlots:4,maximumSlotsPerRegion:2,
 idempotentRetryWithoutWrites:true,ownerExportDormantWorldsOpened:0,ownerReaderRevoked:true,interruptions,refusals,stats:actual.stats,sourceSha256,
 nativeProcessesStarted:0,browserUsed:false,seamlessLiveTravelQualified:false,automaticReturnCrossingQualified:false,
 cooperativeRegionalOwnershipQualified:false,goalComplete:false};
await writeFile(outputName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({stoppedOriginalHaloReturnPublished:true,selectedRevision:3,selectedOwner:'0_0',interruptionRecoveries:4,refusals:2,retainedCheckpointSlots:4}));
