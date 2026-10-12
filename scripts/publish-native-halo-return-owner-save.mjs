#!/usr/bin/env node
// Persist verified original continuation of the currently selected home owner.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdtemp,readdir,open} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
const[archiveName,outputName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outputName,/^output\/native-halo-return-owner-save-\d{3}-observed\.json$/);await assert.rejects(lstat(outputName),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const archive=await json(archiveName);assert.equal(archive.generation,255);assert.equal(archive.journalSelectedReturnedHomeReloadQualified,true);
assert.equal(archive.exactRecordComparisons,1467);assert.equal(archive.expiredEffectsRestored,false);assert.equal(archive.actorImported,false);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
function bound(original,digest){const rows=archive.evidence.filter(r=>r.original===resolve(original));assert.equal(rows.length,1);
 if(digest!==undefined)assert.equal(rows[0].sha256,digest);return rows[0];}
const proofRow=bound('output/native-halo-return-owner-002-observed.json'),proof=await json(proofRow.preserved);
const trial=await json(bound(proof.manifest,proof.manifestSha256).preserved),p=await json(bound(trial.preparation,trial.preparationSha256).preserved);
assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);assert.equal(trial.stopReason,null);
try{process.kill(trial.nativePid,0);throw Error('Owner producer still live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(await hash(archive.nativeExecutableRetained),archive.nativeExecutableSha256);
const evolvedRow=bound(proof.evolvedWorld.filename,proof.evolvedWorld.sha256),evolved={filename:evolvedRow.preserved,bytes:evolvedRow.bytes,sha256:evolvedRow.sha256};
assert.equal(await checkpointSavedClock(await stoppedFileSource(evolved.filename)),64150);
const filenames=(await readdir(p.journal)).sort();assert.deepEqual(filenames,Object.keys(p.journalSha256).sort());
async function unchanged(){for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
 assert.equal(await readFile(join(p.journal,HERO_ROUTE_HEAD),'utf8'),p.ownerManifest);}
await unchanged();
const operationId=createHash('sha256').update(JSON.stringify({kind:'original-returned-owner-save',proofSha256:proofRow.sha256,
 previousManifest:p.ownerManifest,evolvedSha256:evolved.sha256})+'\n').digest('hex');
async function request(){return{kind:'save',operationId,expectedManifest:p.ownerManifest,regions:['0_0'],aliases:[p.selected.entry.alias],
 homeAliases:[p.selected.entry.homeAlias],worlds:[{source:await stoppedFileSource(evolved.filename),sha256:evolved.sha256}]};}
async function context(directory){const stats={},io=await stoppedHeroRouteStorage(directory,stats),store=new HeroRouteStore(io,p.identity,p.identity.contentDigest);
 const selected=await store.read();assert.equal(selected.record.manifest,p.ownerManifest);assert.deepEqual(selected.owner,p.selected.owner);return{directory,stats,io,store};}
async function clone(){await unchanged();const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-hero-route-'));
 for(const n of filenames){const f=await open(join(directory,n),'wx');let at=0;
  try{assert.equal((await hashNativeFile(join(p.journal,n),{sink:async bytes=>{
   for(let i=0;i<bytes.length;){const{bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
  }})).sha256,p.journalSha256[n]);await f.sync();}finally{await f.close();}}
 return context(directory);}
async function selected(f,clock){const store=new HeroRouteStore(f.io,p.identity,p.identity.contentDigest);let result;
 await store.withOwner(async v=>{assert.deepEqual(v.owner,p.selected.owner);assert.equal(await checkpointSavedClock(v.source),clock);
  result={record:v.record,owner:v.owner,entry:v.entry};});return result;}
const interruptions=[];
for(const stage of ['after-source','before-publish','after-publish']){
 const f=await clone(),r=await request();await assert.rejects(f.store.commit(r,async at=>{if(at===stage)throw Error('owner save qualification interruption');}),/owner save qualification interruption/);
 const observed=await selected(f,stage==='after-publish'?64150:63650),recovered=await f.store.commit(r);
 assert.equal(recovered.revision,4);assert.equal(recovered.idempotent,stage==='after-publish');await selected(f,64150);
 interruptions.push({stage,directory:f.directory,clockAfterInterruption:stage==='after-publish'?64150:63650,
  revisionAfterInterruption:observed.record.revision,recoveredRevision:4,idempotent:recovered.idempotent,stats:f.stats});
}
await unchanged();const actual=await context(p.journal),r=await request(),published=await actual.store.commit(r);
assert.equal(published.revision,4);const state=await selected(actual,64150);assert.equal(state.entry.world.sha256,evolved.sha256);
const writes=actual.stats.writes,retry=await actual.store.commit(r);assert.equal(retry.idempotent,true);assert.equal(actual.stats.writes,writes);
const opened=[],originalOpen=actual.io.open;actual.io.open=async n=>{opened.push(n);return originalOpen(n);};let escaped;
await actual.store.withOwner(async v=>{assert.equal(v.record.manifest,published.manifest);assert.equal(v.entry.world.sha256,evolved.sha256);escaped=v.source;});
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_0_0_1.GMP']);await assert.rejects(escaped.readAt(0,16),/lease ended/);
const afterFiles=(await readdir(p.journal)).sort();assert.equal(afterFiles.filter(n=>n.endsWith('.GMP')).length,4);
for(const n of filenames)if(n!==HERO_ROUTE_HEAD&&n!=='Frontier_Hero_Route_0_0_1.GMP')assert.equal(await hash(join(p.journal,n)),p.journalSha256[n]);
assert.equal(await hash(join(p.journal,'Frontier_Hero_Route_0_0_1.GMP')),evolved.sha256);
for(const stats of [actual.stats,...interruptions.map(r=>r.stats)]){assert.ok(stats.largestRead<=4096&&stats.largestWrite<=4096);assert.equal(stats.peakReads,1);}
const sourceSha256={};for(const n of ['scripts/publish-native-halo-return-owner-save.mjs','scripts/lib/native-generation.mjs','scripts/lib/stopped-entity-io.mjs',
 'scripts/lib/stopped-hero-route-io.mjs','web/world/hero-route-store.mjs','web/world/entity-ownership.mjs','web/world/entity-home-ownership.mjs',
 'web/world/checkpoint.mjs','web/world/checkpoint-lease.mjs','web/world/saved-clock.mjs','web/world/transfer-store.mjs'])sourceSha256[n]=await hash(n);
const journalSha256={};for(const n of afterFiles)journalSha256[n]=await hash(join(p.journal,n));
const report={version:1,journalSelectedReturnedHomeSavePublished:true,nativeArchive:{filename:resolve(archiveName),sha256:await hash(archiveName)},
 nativeProof:{filename:proofRow.preserved,sha256:proofRow.sha256},evolvedWorld:evolved,journal:p.journal,journalSha256,identity:p.identity,
 previousManifest:p.ownerManifest,selectedManifest:published.manifest,selectedRevision:4,selectedOwner:state.owner,
 startClock:63650,endClock:64150,immutableRegisteredHomePreserved:true,retainedCheckpointSlots:4,maximumSlotsPerRegion:2,
 idempotentRetryWithoutWrites:true,ownerExportDormantWorldsOpened:0,ownerReaderRevoked:true,northernCheckpointsUnchanged:true,
 interruptions,stats:actual.stats,sourceSha256,nativeProcessesStarted:0,browserUsed:false,
 seamlessLiveTravelQualified:false,automaticReturnCrossingQualified:false,cooperativeRegionalOwnershipQualified:false,goalComplete:false};
await writeFile(outputName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({journalSelectedReturnedHomeSavePublished:true,selectedRevision:4,evolvedClock:64150,interruptionRecoveries:3,retainedCheckpointSlots:4}));
