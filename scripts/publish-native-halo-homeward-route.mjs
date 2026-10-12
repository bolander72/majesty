#!/usr/bin/env node
// Select original west-crossing retirement and home AI continuation together.
// Operates only on the owned, stopped native test journal. No live game writes.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdtemp,readdir,open} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';

const [archiveName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-halo-homeward-route-publication-\d{3}-observed\.json$/);
await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const archive=await json(archiveName);
assert.equal(archive.nativeHaloHomewardActivationQualified,true);assert.equal(archive.homewardGameplayResumed,true);
assert.equal(archive.completeScriptRootsQualified,true);assert.equal(archive.originalTicks,200);
assert.equal(archive.exactActivationRecords,494);assert.equal(archive.selectedRevision,5);
assert.equal(archive.sourceRetired,true);assert.equal(archive.ownerPublished,false);assert.equal(archive.browserUsed,false);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
// Keep the JS custody readers bound to those used for the native proof.
for(const r of archive.sources)if(r.original.startsWith(join(workspace,'web')+'/')||
 r.original.startsWith(join(workspace,'scripts/lib')+'/'))assert.equal(await hash(r.original),r.sha256);
function bound(name,digest){const rows=archive.evidence.filter(r=>r.original===resolve(name));assert.equal(rows.length,1,name);
 if(digest!==undefined)assert.equal(rows[0].sha256,digest);return rows[0];}
async function boundJson(name,digest){return json(bound(name,digest).preserved);}
const proofRow=bound(archive.proof.filename,archive.proof.sha256),proof=await json(proofRow.preserved);
assert.equal(proof.nativeHaloHomewardActivationQualified,true);assert.equal(proof.originalTicks,200);
assert.equal(proof.originalSpatialAndDrawingActivationQualified,true);assert.equal(proof.originalCommandsRestored,true);
assert.equal(proof.reciprocalGuildMembershipQualified,true);assert.equal(proof.ownerPublished,false);
const trial=await boundJson(proof.manifest,proof.manifestSha256),p=await boundJson(trial.preparation,trial.preparationSha256);
assert.equal(trial.selectedHaloHomewardActivationTrialCompleted,true);assert.equal(trial.nativeSessionTerminal,true);
assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);assert.equal(trial.stopReason,null);
function absent(pid){try{process.kill(pid,0);throw Error('Native producer is live');}catch(e){if(e.code!=='ESRCH')throw e;}}
absent(trial.nativePid);assert.equal(await hash(archive.privateNativeExecutable),archive.nativeExecutableSha256);
assert.equal(trial.nativeExecutableSha256,archive.nativeExecutableSha256);
const capsule=await boundJson(p.capsule.filename,p.capsule.sha256);
assert.equal(capsule.homewardReturnCapsulePrepared,true);assert.equal(capsule.sourceRetired,true);
const retiredProofRow=bound(capsule.retirementProof.filename,capsule.retirementProof.sha256);
const retirement=await json(retiredProofRow.preserved);
assert.equal(retirement.nativeHomewardSourceRetirementQualified,true);assert.equal(retirement.exactRemainingRecords,479);
assert.equal(retirement.completeScriptRootQualified,true);assert.equal(retirement.noIncomingTypedReferences,true);
assert.equal(retirement.proxyPreserved,true);assert.equal(retirement.ownerPublished,false);
assert.deepEqual([...retirement.removedRecords].sort(),['UNIT:532','GPL:35','CONT:532','ORDR:532'].sort());
assert.equal(capsule.retiredWorld.sha256,retirement.retiredWorld.sha256);
assert.equal(capsule.sourceWorld.sha256,retirement.beforeWorld.sha256);
assert.equal(await hash(p.archive.filename),p.archive.sha256);const retiredArchive=await json(p.archive.filename);
assert.equal(retiredArchive.nativeHomewardSourceRetirementQualified,true);
for(const r of retiredArchive.sources.concat(retiredArchive.evidence))assert.equal(await hash(r.preserved),r.sha256);
const crossingRow=retiredArchive.evidence.find(r=>r.original===retirement.crossingProof.filename);
assert.ok(crossingRow);assert.equal(crossingRow.sha256,retirement.crossingProof.sha256);
const crossing=await json(crossingRow.preserved);assert.equal(crossing.nativeSelectedHaloHomeLegQualified,true);
assert.equal(crossing.originalHomewardMovementQualified,true);
const sourceTrialRow=retiredArchive.evidence.find(r=>r.original===crossing.manifest);
assert.ok(sourceTrialRow);assert.equal(sourceTrialRow.sha256,crossing.manifestSha256);
const sourceTrial=await json(sourceTrialRow.preserved);
assert.equal(sourceTrial.nativeSessionTerminal,true);assert.equal(sourceTrial.nativeExitCode,0);
assert.equal(sourceTrial.ownedProducerAbsent,true);assert.equal(sourceTrial.stopReason,null);absent(sourceTrial.nativePid);
const sourceRow=bound(capsule.retiredWorld.filename,capsule.retiredWorld.sha256);
const destinationRow=bound(proof.worlds[2].filename,proof.worlds[2].sha256);
const source={filename:sourceRow.preserved,bytes:sourceRow.bytes,sha256:sourceRow.sha256};
const destination={filename:destinationRow.preserved,bytes:destinationRow.bytes,sha256:destinationRow.sha256};
assert.equal(await checkpointSavedClock(await stoppedFileSource(source.filename)),3750);
assert.equal(await checkpointSavedClock(await stoppedFileSource(destination.filename)),94550);
assert.deepEqual(p.owner,capsule.selected.owner);assert.equal(capsule.selected.record.revision,5);
assert.equal(p.owner.region,'1_0');assert.deepEqual({unitId:p.owner.unitId,agentId:p.owner.agentId},{unitId:532,agentId:35});
assert.deepEqual(p.journalSha256,capsule.journalSha256);assert.equal(p.ownerManifest,capsule.ownerManifest);
const filenames=Object.keys(p.journalSha256).sort();
async function unchanged(){assert.deepEqual((await readdir(p.journal)).sort(),filenames);
 for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
 assert.equal(await readFile(join(p.journal,HERO_ROUTE_HEAD),'utf8'),p.ownerManifest);}
await unchanged();
const alias={unitId:proof.actualNativeUnitId,agentId:proof.actualAgentId};assert.deepEqual(alias,{unitId:508,agentId:25});
const proxy={kind:'proxy',unitId:0,agentId:34},nativeHome={kind:'native',unitId:469,agentId:7};
const operationId=createHash('sha256').update(JSON.stringify({kind:'original-running-halo-homeward',proofSha256:proofRow.sha256,
 retirementProofSha256:retiredProofRow.sha256,previousManifest:p.ownerManifest,worlds:[source.sha256,destination.sha256],identity:p.identity})+'\n').digest('hex');
async function request(){return {kind:'handoff',operationId,expectedManifest:p.ownerManifest,regions:['1_0','0_0'],
 aliases:[{unitId:532,agentId:35},alias],homeAliases:[proxy,nativeHome],
 worlds:await Promise.all([source,destination].map(async r=>({source:await stoppedFileSource(r.filename),sha256:r.sha256})))};}
async function context(directory){const stats={},io=await stoppedHeroRouteStorage(directory,stats);
 const store=new HeroRouteStore(io,p.identity,p.identity.contentDigest),before=await store.read();
 assert.equal(before.record.manifest,p.ownerManifest);assert.deepEqual(before.owner,p.owner);return {directory,stats,io,store};}
async function clone(){await unchanged();const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-hero-route-'));
 for(const n of filenames){const f=await open(join(directory,n),'wx');let at=0;
  try{assert.equal((await hashNativeFile(join(p.journal,n),{sink:async bytes=>{
   for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
  }})).sha256,p.journalSha256[n]);await f.sync();}finally{await f.close();}}
 return context(directory);}
async function owner(f,region){const selected=await new HeroRouteStore(f.io,p.identity,p.identity.contentDigest).read();
 assert.equal(selected.owner.region,region);assert.equal(selected.owner.entityId,p.identity.entityId);
 assert.deepEqual({unitId:selected.owner.unitId,agentId:selected.owner.agentId},region==='0_0'?alias:{unitId:532,agentId:35});return selected;}
// Refusal and recovery checks finish on copies before the selected journal
// can change. A loaded or imported-only world is not sufficient native proof.
const refusals=[];
for(const kind of ['source-still-owns','destination-before-import']){
 const f=await clone(),r=await request(),bad=kind==='source-still-owns'?capsule.sourceWorld:p.homeWorld;
 const row=bound(bad.filename,bad.sha256),side=kind==='source-still-owns'?0:1;
 r.worlds[side]={source:await stoppedFileSource(row.preserved),sha256:row.sha256};
 await assert.rejects(f.store.commit(r));assert.equal(f.stats.writes??0,0);await owner(f,'1_0');
 refusals.push({kind,directory:f.directory,writes:0,ownerUnchanged:true});
}
const interruptions=[];
for(const stage of ['after-source','after-destination','before-publish','after-publish']){
 const f=await clone(),r=await request();
 await assert.rejects(f.store.commit(r,async at=>{if(at===stage)throw Error('homeward custody interruption');}),/homeward custody interruption/);
 const selected=await owner(f,stage==='after-publish'?'0_0':'1_0');
 const recovered=await f.store.commit(r);assert.equal(recovered.revision,6);assert.equal(recovered.idempotent,stage==='after-publish');
 await owner(f,'0_0');interruptions.push({stage,directory:f.directory,revisionAfterInterruption:selected.record.revision,
  recoveredRevision:6,idempotent:recovered.idempotent,stats:f.stats});
}
await unchanged();const actual=await context(p.journal),r=await request(),published=await actual.store.commit(r);
assert.equal(published.revision,6);const selected=await owner(actual,'0_0');
const writes=actual.stats.writes,retry=await actual.store.commit(r);assert.equal(retry.idempotent,true);assert.equal(actual.stats.writes,writes);
const opened=[],originalOpen=actual.io.open;actual.io.open=async n=>{opened.push(n);return originalOpen(n);};let escaped;
await actual.store.withOwner(async v=>{assert.equal(v.record.manifest,published.manifest);assert.deepEqual(v.entry.alias,alias);
 assert.deepEqual(v.entry.homeAlias,nativeHome);assert.equal(v.entry.world.sha256,destination.sha256);
 assert.equal(await checkpointSavedClock(v.source),94550);escaped=v.source;});
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_0_0_1.GMP']);
await assert.rejects(escaped.readAt(0,16),/lease ended/);
opened.length=0;
await actual.store.withDestination('1_0',null,async v=>{
 assert.deepEqual(v.regions,['0_0','1_0']);assert.equal(v.entries[0].world.sha256,destination.sha256);
 assert.equal(v.entries[1].world.sha256,source.sha256);
 assert.equal(await checkpointSavedClock(v.sources[0]),94550);assert.equal(await checkpointSavedClock(v.sources[1]),3750);
});
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_0_0_1.GMP','Frontier_Hero_Route_1_0_1.GMP']);
const afterFiles=(await readdir(p.journal)).sort(),worldFiles=afterFiles.filter(n=>n.endsWith('.GMP'));
assert.equal(worldFiles.length,6);assert.equal(worldFiles.filter(n=>n.includes('_1_0_')).length,2);
assert.equal(await hash(join(p.journal,'Frontier_Hero_Route_1_0_1.GMP')),source.sha256);
assert.equal(await hash(join(p.journal,'Frontier_Hero_Route_0_0_1.GMP')),destination.sha256);
for(const n of filenames)if(n!==HERO_ROUTE_HEAD&&n!=='Frontier_Hero_Route_0_0_1.GMP')assert.equal(await hash(join(p.journal,n)),p.journalSha256[n]);
for(const stats of [actual.stats,...interruptions.map(r=>r.stats)]){
 assert.ok(stats.largestRead<=4096&&stats.largestWrite<=4096);assert.equal(stats.peakReads,1);}
const sourceSha256={};for(const n of ['scripts/publish-native-halo-homeward-route.mjs','scripts/lib/native-generation.mjs',
 'scripts/lib/stopped-entity-io.mjs','scripts/lib/stopped-hero-route-io.mjs','web/world/hero-route-store.mjs',
 'web/world/entity-ownership.mjs','web/world/entity-home-ownership.mjs','web/world/checkpoint.mjs','web/world/checkpoint-lease.mjs',
 'web/world/saved-clock.mjs','web/world/transfer-store.mjs'])sourceSha256[n]=await hash(n);
const journalSha256={};for(const n of afterFiles)journalSha256[n]=await hash(join(p.journal,n));
const report={version:1,journalOriginalHaloHomewardPublished:true,nativeArchive:{filename:resolve(archiveName),sha256:await hash(archiveName)},
 nativeProof:{filename:proofRow.preserved,sha256:proofRow.sha256},retirementProof:{filename:retiredProofRow.preserved,sha256:retiredProofRow.sha256},
 sourceWorld:source,destinationWorld:destination,journal:p.journal,journalSha256,identity:p.identity,
 previousManifest:p.ownerManifest,selectedManifest:published.manifest,selectedRevision:6,selectedOwner:selected.owner,
 sourceClock:3750,destinationClock:94550,retainedCheckpointSlots:6,maximumSlotsPerRegion:2,
 immutableRegisteredHomePreserved:true,northernCheckpointsUnchanged:true,idempotentRetryWithoutWrites:true,
 ownerExportDormantWorldsOpened:0,ownerReaderRevoked:true,pairedExportIntermediateWorldsOpened:0,
 refusals,interruptions,stats:actual.stats,sourceSha256,nativeProcessesStarted:0,browserUsed:false,
 enteredGuild:proof.enteredGuild,seamlessLiveTravelQualified:false,cooperativeRegionalOwnershipQualified:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({journalOriginalHaloHomewardPublished:true,selectedRevision:6,selectedOwner:selected.owner,
 interruptionRecoveries:interruptions.length,refusals:refusals.length,retainedCheckpointSlots:6}));
