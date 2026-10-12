#!/usr/bin/env node
// Publish the qualified retired source and evolved destination under one owner.
// Writes only the owned stopped test journal after all clone recovery checks.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdtemp,readdir,open} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
const [archiveName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-halo-session-activation-publication-\d{3}-observed\.json$/);
await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const archive=await json(archiveName);assert.equal(archive.nativeRunningActorActivationQualified,true);
assert.equal(archive.completeActivationRootsQualified,true);assert.equal(archive.originalTicks,70);
assert.equal(archive.sourceRetired,true);assert.equal(archive.sourceUnloaded,true);assert.equal(archive.destinationActivated,true);
assert.equal(archive.ownerPublished,false);assert.equal(archive.browserUsed,false);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
// Custody verification runs current JS readers; bind them to the readers
// whose exact source bytes accompany the qualified native saves.
for(const r of archive.sources)if(r.original.startsWith(join(workspace,'web')+'/')||
 r.original.startsWith(join(workspace,'scripts/lib')+'/'))assert.equal(await hash(r.original),r.sha256);
function bound(name,digest){const rows=archive.evidence.filter(r=>r.original===resolve(name));assert.equal(rows.length,1);
 if(digest!==undefined)assert.equal(rows[0].sha256,digest);return rows[0];}
async function boundJson(name,digest){return json(bound(name,digest).preserved);}
const proofRow=bound(archive.proof.filename,archive.proof.sha256),proof=await json(proofRow.preserved);
assert.equal(proof.nativeRunningActorActivationQualified,true);assert.equal(proof.waitDeadlinesPreserved,true);
assert.equal(proof.originalSpatialAndDrawingActivationQualified,true);assert.equal(proof.remoteHomeRequestPreserved,true);
assert.equal(proof.expiredEffectsAbsent,true);assert.equal(proof.ownerPublished,false);
const trial=await boundJson(proof.manifest,proof.manifestSha256),p=await boundJson(trial.preparation,trial.preparationSha256);
assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);
assert.equal(trial.haloSessionActorActivationTrialCompleted,true);assert.equal(trial.stopReason,null);
try{process.kill(trial.nativePid,0);throw Error('Native producer is live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(await hash(archive.privateNativeExecutable),archive.nativeExecutableSha256);
assert.equal(trial.nativeExecutableSha256,archive.nativeExecutableSha256);
const arrival=await boundJson(proof.arrivalProof.filename,proof.arrivalProof.sha256);
const proxy=await boundJson(arrival.proxyProof.filename,arrival.proxyProof.sha256);
assert.equal(arrival.nativeRunningActorArrivalQualified,true);assert.equal(proxy.nativeRunningSourceRetirementQualified,true);
assert.equal(proxy.retirement.originalRemovalQualified,true);assert.equal(proxy.retirement.noIncomingTypedReferences,true);
assert.deepEqual([...proxy.retirement.removedRecords].sort(),['UNIT:496','UNIT:505','UNIT:506','UNIT:507','GPL:22','ORDR:505','ORDR:506','ORDR:507','CONT:496'].sort());assert.equal(proxy.manifestSha256,proof.manifestSha256);
const sourceRow=bound(proxy.retirement.retiredWorld.filename,proxy.retirement.retiredWorld.sha256);
const destRow=bound(proof.worlds[2].filename,proof.worlds[2].sha256);
const source={filename:sourceRow.preserved,bytes:sourceRow.bytes,sha256:sourceRow.sha256};
const destination={filename:destRow.preserved,bytes:destRow.bytes,sha256:destRow.sha256};
assert.equal(await checkpointSavedClock(await stoppedFileSource(source.filename)),84550);
assert.equal(await checkpointSavedClock(await stoppedFileSource(destination.filename)),3550);
assert.equal(p.selectedRevision,4);assert.equal(p.selectedOwner.region,'0_0');
assert.deepEqual({unitId:p.selectedOwner.unitId,agentId:p.selectedOwner.agentId},{unitId:496,agentId:22});
const filenames=Object.keys(p.journalSha256).sort();
async function unchanged(){assert.deepEqual((await readdir(p.journal)).sort(),filenames);
 for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
 assert.equal(await readFile(join(p.journal,HERO_ROUTE_HEAD),'utf8'),p.selectedManifest);}
await unchanged();
const alias={unitId:proof.destinationAliases.unitId,agentId:proof.destinationAliases.agentId};
const homeAlias={kind:'proxy',unitId:0,agentId:proof.proxyAgentId};
const nativeHome={kind:'native',unitId:469,agentId:7};
const operationId=createHash('sha256').update(JSON.stringify({kind:'original-running-halo-handoff',proofSha256:proofRow.sha256,
 previousManifest:p.selectedManifest,worlds:[source.sha256,destination.sha256],identity:p.identity})+'\n').digest('hex');
async function request(){return {kind:'handoff',operationId,expectedManifest:p.selectedManifest,regions:['0_0','1_0'],
 aliases:[{unitId:496,agentId:22},alias],homeAliases:[nativeHome,homeAlias],
 worlds:await Promise.all([source,destination].map(async r=>({source:await stoppedFileSource(r.filename),sha256:r.sha256})))};}
async function context(directory){const stats={},io=await stoppedHeroRouteStorage(directory,stats);
 const store=new HeroRouteStore(io,p.identity,p.identity.contentDigest),before=await store.read();
 assert.equal(before.record.manifest,p.selectedManifest);assert.deepEqual(before.owner,p.selectedOwner);
 return {directory,stats,io,store};}
async function clone(){await unchanged();const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-hero-route-'));
 for(const n of filenames){const f=await open(join(directory,n),'wx');let at=0;
  try{assert.equal((await hashNativeFile(join(p.journal,n),{sink:async bytes=>{
   for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
  }})).sha256,p.journalSha256[n]);await f.sync();}finally{await f.close();}}
 return context(directory);}
async function owner(f,region){const selected=await new HeroRouteStore(f.io,p.identity,p.identity.contentDigest).read();
 assert.equal(selected.owner.region,region);assert.equal(selected.owner.entityId,p.identity.entityId);
 assert.deepEqual({unitId:selected.owner.unitId,agentId:selected.owner.agentId},region==='0_0'?{unitId:496,agentId:22}:alias);
 return selected;}
// Refuse an unchanged source that still owns the crossing hero, and refuse a
// destination that does not yet contain the crossing hero. The archive gate
// separately requires qualified activation and the original3550 endpoint.
const refusals=[];
for(const kind of ['source-still-owns','destination-before-import']){
 const f=await clone(),r=await request(),bad=kind==='source-still-owns'?proxy.retirement.beforeWorld:arrival.beforeWorld;
 const row=bound(bad.filename,bad.sha256),side=kind==='source-still-owns'?0:1;
 r.worlds[side]={source:await stoppedFileSource(row.preserved),sha256:row.sha256};
 await assert.rejects(f.store.commit(r));assert.equal(f.stats.writes??0,0);await owner(f,'0_0');
 refusals.push({kind,directory:f.directory,writes:0,ownerUnchanged:true});
}
const interruptions=[];
for(const stage of ['after-source','after-destination','before-publish','after-publish']){
 const f=await clone(),r=await request();
 await assert.rejects(f.store.commit(r,async at=>{if(at===stage)throw Error('halo activation custody interruption');}),/halo activation custody interruption/);
 const selected=await owner(f,stage==='after-publish'?'1_0':'0_0');
 const recovered=await f.store.commit(r);assert.equal(recovered.revision,5);assert.equal(recovered.idempotent,stage==='after-publish');
 await owner(f,'1_0');interruptions.push({stage,directory:f.directory,revisionAfterInterruption:selected.record.revision,
  recoveredRevision:5,idempotent:recovered.idempotent,stats:f.stats});
}
await unchanged();const actual=await context(p.journal),r=await request(),published=await actual.store.commit(r);
assert.equal(published.revision,5);const selected=await owner(actual,'1_0');
const writes=actual.stats.writes,retry=await actual.store.commit(r);assert.equal(retry.idempotent,true);assert.equal(actual.stats.writes,writes);
const opened=[],originalOpen=actual.io.open;actual.io.open=async n=>{opened.push(n);return originalOpen(n);};let escaped;
await actual.store.withOwner(async v=>{assert.equal(v.record.manifest,published.manifest);assert.deepEqual(v.entry.alias,alias);
 assert.deepEqual(v.entry.homeAlias,homeAlias);assert.equal(v.entry.world.sha256,destination.sha256);
 assert.equal(await checkpointSavedClock(v.source),3550);escaped=v.source;});
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_1_0_0.GMP']);
await assert.rejects(escaped.readAt(0,16),/lease ended/);
const afterFiles=(await readdir(p.journal)).sort(),worldFiles=afterFiles.filter(n=>n.endsWith('.GMP'));
assert.equal(worldFiles.length,5);assert.equal(worldFiles.filter(n=>n.includes('_1_0_')).length,1);
assert.equal(await hash(join(p.journal,'Frontier_Hero_Route_0_0_0.GMP')),source.sha256);
assert.equal(await hash(join(p.journal,'Frontier_Hero_Route_1_0_0.GMP')),destination.sha256);
for(const n of filenames)if(n!==HERO_ROUTE_HEAD&&n!=='Frontier_Hero_Route_0_0_0.GMP')assert.equal(await hash(join(p.journal,n)),p.journalSha256[n]);
for(const stats of [actual.stats,...interruptions.map(r=>r.stats)]){
 assert.ok(stats.largestRead<=4096&&stats.largestWrite<=4096);assert.equal(stats.peakReads,1);}
const sourceSha256={};for(const n of ['scripts/publish-native-halo-session-activation.mjs','scripts/lib/native-generation.mjs',
 'scripts/lib/stopped-entity-io.mjs','scripts/lib/stopped-hero-route-io.mjs','web/world/hero-route-store.mjs',
 'web/world/entity-ownership.mjs','web/world/entity-home-ownership.mjs','web/world/checkpoint.mjs','web/world/checkpoint-lease.mjs',
 'web/world/saved-clock.mjs','web/world/transfer-store.mjs'])sourceSha256[n]=await hash(n);
const journalSha256={};for(const n of afterFiles)journalSha256[n]=await hash(join(p.journal,n));
const report={version:1,journalRunningHaloHandoffPublished:true,nativeArchive:{filename:resolve(archiveName),sha256:await hash(archiveName)},
 nativeProof:{filename:proofRow.preserved,sha256:proofRow.sha256},sourceWorld:source,destinationWorld:destination,
 journal:p.journal,journalSha256,identity:p.identity,previousManifest:p.selectedManifest,selectedManifest:published.manifest,
 selectedRevision:5,selectedOwner:selected.owner,sourceClock:84550,destinationClock:3550,retainedCheckpointSlots:5,maximumSlotsPerRegion:2,
 immutableRegisteredHomePreserved:true,northernCheckpointsUnchanged:true,idempotentRetryWithoutWrites:true,
 ownerExportDormantWorldsOpened:0,ownerReaderRevoked:true,refusals,interruptions,stats:actual.stats,sourceSha256,
 nativeProcessesStarted:0,browserUsed:false,seamlessLiveTravelQualified:false,cooperativeRegionalOwnershipQualified:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({journalRunningHaloHandoffPublished:true,selectedRevision:5,selectedOwner:selected.owner,
 interruptionRecoveries:interruptions.length,refusals:refusals.length,retainedCheckpointSlots:5}));
