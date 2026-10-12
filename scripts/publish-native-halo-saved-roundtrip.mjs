#!/usr/bin/env node
// Publish both actual original crossings through the existing paired journal.
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
assert.match(outName,/^output\/native-halo-saved-roundtrip-publication-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const archive=await json(archiveName);assert.equal(archive.generation,297);assert.equal(archive.nativeSavedHomeOriginalGameplayQualified,true);
assert.equal(archive.exactHomeActivationRecords,509);assert.equal(archive.homeGameplayTicks,200);assert.equal(archive.selectedRevision,6);assert.equal(archive.ownerPublished,false);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
for(const r of archive.sources)if(r.original.startsWith(join(workspace,'web')+'/')||r.original.startsWith(join(workspace,'scripts/lib')+'/'))assert.equal(await hash(r.original),r.sha256);
function bound(name,digest){const rows=archive.evidence.filter(r=>r.original===resolve(name));assert.equal(rows.length,1,name);if(digest!==undefined)assert.equal(rows[0].sha256,digest);return rows[0];}
const boundJson=async(name,digest)=>json(bound(name,digest).preserved);
const proofRow=bound(archive.homeActivationProof.filename,archive.homeActivationProof.sha256),proof=await json(proofRow.preserved);
assert.equal(proof.nativeSavedHomeOriginalGameplayQualified,true);assert.equal(proof.originalAiUngated,true);assert.equal(proof.counts.ticks,200);assert.equal(proof.ownerPublished,false);
const trial=await boundJson(proof.manifest,proof.manifestSha256),p=await boundJson(trial.preparation,trial.preparationSha256);
assert.equal(trial.haloSavedActorHomeActivationTrialCompleted,true);assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.stopReason,null);assert.equal(trial.ownedProducerAbsent,true);
try{process.kill(trial.nativePid,0);throw Error('Native producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(await hash(archive.privateNativeExecutable),archive.nativeExecutableSha256);
const eastProof=await boundJson(archive.activationProof.filename,archive.activationProof.sha256),arrival=await boundJson(archive.proof.filename,archive.proof.sha256),returned=await boundJson(archive.returnProof.filename,archive.returnProof.sha256);
assert.equal(eastProof.nativeSavedNeighborActorActivationQualified,true);assert.equal(eastProof.nativeSavedNeighborHomeLegQualified,true);assert.equal(eastProof.exactActivationRecords,483);assert.equal(eastProof.crossingClock,4050);
const retirement=arrival.paging.retirement;assert.equal(retirement.nativeRunningSourceRetirementQualified,true);assert.equal(retirement.noIncomingTypedReferences,true);assert.equal(retirement.unrelatedRecordComparisons,503);assert.equal(retirement.sourceClock,103500);
assert.equal(returned.nativeSavedNeighborReturnRetirementQualified,true);assert.equal(returned.exactRemainingRecords,479);assert.equal(returned.completeScriptRootQualified,true);assert.equal(returned.sourceClock,4050);
assert.deepEqual(retirement.removedRecords.slice().sort(),['UNIT:508','GPL:25','CONT:508','ORDR:508'].sort());
assert.deepEqual(returned.removedRecords.slice().sort(),['UNIT:537','GPL:37','CONT:537','ORDR:537'].sort());
const row=r=>{const b=bound(r.filename,r.sha256);return{filename:b.preserved,bytes:b.bytes,sha256:b.sha256};};
const homeRetired=row(retirement.retiredWorld),eastActive=row(eastProof.worlds[1]),eastRetired=row(returned.retiredWorld),homeActive=row(proof.worlds[2]);
for(const[r,clock]of [[homeRetired,103500],[eastActive,3750],[eastRetired,4050],[homeActive,113500]])assert.equal(await checkpointSavedClock(await stoppedFileSource(r.filename)),clock);
const homeOld={unitId:508,agentId:25},eastAlias={unitId:537,agentId:37},homeAlias={unitId:513,agentId:29},nativeHome={kind:'native',unitId:469,agentId:7},proxy={kind:'proxy',unitId:0,agentId:34};
assert.deepEqual(p.selectedOwner,{entityId:p.identity.entityId,region:'0_0',...homeOld});assert.equal(p.selectedRevision,6);
assert.deepEqual(eastProof.destinationAliases,eastAlias);assert.deepEqual({unitId:proof.actualNativeUnitId,agentId:proof.actualAgentId},homeAlias);
const filenames=Object.keys(p.journalSha256).sort();
async function unchanged(){assert.deepEqual((await readdir(p.journal)).sort(),filenames);for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);assert.equal(await readFile(join(p.journal,HERO_ROUTE_HEAD),'utf8'),p.selectedManifest);}
await unchanged();
const legs=[{name:'outward',regions:['0_0','1_0'],aliases:[homeOld,eastAlias],homeAliases:[nativeHome,proxy],worlds:[homeRetired,eastActive],revision:7},
 {name:'return',regions:['1_0','0_0'],aliases:[eastAlias,homeAlias],homeAliases:[proxy,nativeHome],worlds:[eastRetired,homeActive],revision:8}];
async function request(leg,manifest){return{kind:'handoff',operationId:createHash('sha256').update(JSON.stringify({kind:'original-saved-roundtrip-'+leg.name,proofSha256:proofRow.sha256,previousManifest:manifest,worlds:leg.worlds.map(r=>r.sha256),identity:p.identity})+'\n').digest('hex'),expectedManifest:manifest,
 regions:leg.regions,aliases:leg.aliases,homeAliases:leg.homeAliases,worlds:await Promise.all(leg.worlds.map(async r=>({source:await stoppedFileSource(r.filename),sha256:r.sha256})))};}
async function context(directory){const stats={},io=await stoppedHeroRouteStorage(directory,stats),store=new HeroRouteStore(io,p.identity,p.identity.contentDigest);return{directory,stats,io,store};}
async function clone(){await unchanged();const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-hero-route-'));
 for(const n of filenames){const f=await open(join(directory,n),'wx');let at=0;try{assert.equal((await hashNativeFile(join(p.journal,n),{sink:async b=>{for(let i=0;i<b.length;){const{bytesWritten}=await f.write(b,i,b.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}}})).sha256,p.journalSha256[n]);await f.sync();}finally{await f.close();}}return context(directory);}
async function selected(f,revision){const s=await new HeroRouteStore(f.io,p.identity,p.identity.contentDigest).read();assert.equal(s.record.revision,revision);assert.deepEqual(s.owner,{entityId:p.identity.entityId,region:revision===7?'1_0':'0_0',...(revision===7?eastAlias:revision===8?homeAlias:homeOld)});return s;}
async function begin(f,index){let s=await selected(f,6);if(index){const r=await request(legs[0],s.record.manifest);await f.store.commit(r);s=await selected(f,7);}return request(legs[index],s.record.manifest);}
const refusals=[];
for(let index=0;index<2;++index)for(const kind of ['source-still-owns','destination-before-import']){
 const f=await clone(),r=await begin(f,index),bad=kind==='source-still-owns'?(index?returned.beforeWorld:retirement.beforeWorld):(index?returned.heldHome:arrival.beforeWorld),b=row(bad),side=kind==='source-still-owns'?0:1;
 r.worlds[side]={source:await stoppedFileSource(b.filename),sha256:b.sha256};const writes=f.stats.writes??0;
 await assert.rejects(f.store.commit(r));assert.equal(f.stats.writes??0,writes);await selected(f,6+index);refusals.push({leg:legs[index].name,kind,directory:f.directory,additionalWrites:0,ownerUnchanged:true});
}
const interruptions=[];
for(let index=0;index<2;++index)for(const stage of ['after-source','after-destination','before-publish','after-publish']){
 const f=await clone(),r=await begin(f,index);await assert.rejects(f.store.commit(r,async at=>{if(at===stage)throw Error('saved roundtrip interruption');}),/saved roundtrip interruption/);
 const previous=await selected(f,stage==='after-publish'?legs[index].revision:6+index),restarted=new HeroRouteStore(f.io,p.identity,p.identity.contentDigest),recovered=await restarted.commit(r);
 assert.equal(recovered.revision,legs[index].revision);assert.equal(recovered.idempotent,stage==='after-publish');await selected(f,legs[index].revision);
 interruptions.push({leg:legs[index].name,stage,directory:f.directory,revisionAfterInterruption:previous.record.revision,recoveredRevision:recovered.revision,idempotent:recovered.idempotent,stats:f.stats});
}
const stale=await clone(),old=await request(legs[0],p.selectedManifest),outward=await stale.store.commit(old),back=await request(legs[1],outward.manifest);await stale.store.commit(back);const staleWrites=stale.stats.writes;
await assert.rejects(stale.store.commit(old));assert.equal(stale.stats.writes,staleWrites);await selected(stale,8);refusals.push({kind:'stale-outward-after-return',directory:stale.directory,additionalWrites:0,ownerUnchanged:true});
await unchanged();const actual=await context(p.journal),firstRequest=await request(legs[0],p.selectedManifest),first=await actual.store.commit(firstRequest);await selected(actual,7);
let writes=actual.stats.writes;const firstRetry=await actual.store.commit(firstRequest);assert.equal(firstRetry.idempotent,true);assert.equal(actual.stats.writes,writes);
const secondRequest=await request(legs[1],first.manifest),last=await actual.store.commit(secondRequest),owner=await selected(actual,8);
writes=actual.stats.writes;const lastRetry=await actual.store.commit(secondRequest);assert.equal(lastRetry.idempotent,true);assert.equal(actual.stats.writes,writes);
const opened=[],originalOpen=actual.io.open;actual.io.open=async n=>{opened.push(n);return originalOpen(n);};let escaped;
await actual.store.withOwner(async v=>{assert.equal(v.record.manifest,last.manifest);assert.deepEqual(v.entry.alias,homeAlias);assert.deepEqual(v.entry.homeAlias,nativeHome);assert.equal(v.entry.world.sha256,homeActive.sha256);assert.equal(await checkpointSavedClock(v.source),113500);escaped=v.source;});
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_0_0_1.GMP']);await assert.rejects(escaped.readAt(0,16),/lease ended/);opened.length=0;
await actual.store.withDestination('1_0',null,async v=>{assert.deepEqual(v.regions,['0_0','1_0']);assert.equal(v.entries[0].world.sha256,homeActive.sha256);assert.equal(v.entries[1].world.sha256,eastRetired.sha256);assert.equal(await checkpointSavedClock(v.sources[0]),113500);assert.equal(await checkpointSavedClock(v.sources[1]),4050);});
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_0_0_1.GMP','Frontier_Hero_Route_1_0_1.GMP']);
const afterFiles=(await readdir(p.journal)).sort(),worldFiles=afterFiles.filter(n=>n.endsWith('.GMP'));assert.equal(worldFiles.length,6);for(const region of ['0_0','1_0','0_-1'])assert.equal(worldFiles.filter(n=>n.includes('_'+region+'_')).length,2);
for(const n of filenames)if(n!==HERO_ROUTE_HEAD&&!/^Frontier_Hero_Route_(0_0|1_0)_[01]\.GMP$/.test(n))assert.equal(await hash(join(p.journal,n)),p.journalSha256[n]);
for(const stats of [actual.stats,...interruptions.map(r=>r.stats)]){assert.ok(stats.largestRead<=4096&&stats.largestWrite<=4096);assert.equal(stats.peakReads,1);}
const sourceSha256={},pending=[resolve('scripts/publish-native-halo-saved-roundtrip.mjs')];
while(pending.length){const n=pending.pop(),rel=n.slice(workspace.length+1);assert.ok(n.startsWith(workspace+'/')&&Object.keys(sourceSha256).length<128);if(sourceSha256[rel])continue;assert.ok((await lstat(n)).size<256*1024);sourceSha256[rel]=await hash(n);const text=await readFile(n,'utf8');for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(n,'..',match[1]));}
const journalSha256={};for(const n of afterFiles)journalSha256[n]=await hash(join(p.journal,n));
const report={version:1,journalOriginalSavedRoundtripPublished:true,nativeArchive:{filename:resolve(archiveName),sha256:await hash(archiveName)},nativeProof:{filename:proofRow.preserved,sha256:proofRow.sha256},
 sourceWorld:eastRetired,destinationWorld:homeActive,outwardWorlds:[homeRetired,eastActive],journal:p.journal,journalSha256,identity:p.identity,settings:p.settings,settingsProducerExecutableSha256:p.settingsProducerExecutableSha256,
 previousManifest:p.selectedManifest,outwardManifest:first.manifest,selectedManifest:last.manifest,selectedRevision:8,selectedOwner:owner.owner,outwardRevision:7,
 sourceClock:4050,destinationClock:113500,retainedCheckpointSlots:6,maximumSlotsPerRegion:2,immutableRegisteredHomePreserved:true,northernCheckpointsUnchanged:true,idempotentRetryWithoutWrites:true,
 ownerExportDormantWorldsOpened:0,ownerReaderRevoked:true,pairedExportIntermediateWorldsOpened:0,refusals,interruptions,stats:actual.stats,sourceSha256,nativeProcessesStarted:0,browserUsed:false,
 physicalGuildEntryQualified:false,seamlessLiveTravelQualified:false,cooperativeRegionalOwnershipQualified:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({journalOriginalSavedRoundtripPublished:true,selectedRevision:8,outwardRevision:7,interruptionRecoveries:interruptions.length,refusals:refusals.length,retainedCheckpointSlots:6}));
