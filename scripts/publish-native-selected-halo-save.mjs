#!/usr/bin/env node
// Publish one verified original continuation back to its private route journal.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
const[proofName,outputName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outputName,/^output\/native-selected-halo-save-\d{3}-observed\.json$/);
await assert.rejects(lstat(outputName),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const proof=await json(proofName),m=await json(proof.manifest),p=await json(proof.selectedOwnerPreparation.filename);
assert.equal(proof.selectedOriginalHaloOwnerReloadQualified,true);assert.equal(proof.evolvedClock,1500);
assert.equal(await hash(proof.manifest),proof.manifestSha256);assert.equal(await hash(proof.selectedOwnerPreparation.filename),proof.selectedOwnerPreparation.sha256);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
try{process.kill(m.nativePid,0);throw Error('Native owner still running');}catch(e){if(e.code!=='ESRCH')throw e;}
for(const[n,h]of Object.entries({...proof.sourceSha256,...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
assert.equal(await hash(m.log),m.logSha256);assert.equal(await hash(m.privateNativeExecutable),m.nativeExecutableSha256);
assert.equal(await hash(proof.evolvedWorld.filename),proof.evolvedWorld.sha256);
const stats={},io=await stoppedHeroRouteStorage(p.journal,stats),store=new HeroRouteStore(io,p.identity,p.identity.contentDigest);
const before=await store.read();assert.equal(before.record.manifest,proof.selectedManifest);assert.deepEqual(before.owner,proof.selectedOwner);
const filenames=(await readdir(p.journal)).sort(),originalHashes={};
for(const n of filenames)originalHashes[n]=await hash(join(p.journal,n));
const operationId=createHash('sha256').update(JSON.stringify({kind:'original-owner-save',proofSha256:await hash(proofName),
  selectedManifest:proof.selectedManifest,evolvedWorldSha256:proof.evolvedWorld.sha256})+'\n').digest('hex');
const request={kind:'save',operationId,expectedManifest:proof.selectedManifest,regions:[before.owner.region],
  aliases:[p.selected.entry.alias],homeAliases:[p.selected.entry.homeAlias],
  worlds:[{source:await stoppedFileSource(proof.evolvedWorld.filename),sha256:proof.evolvedWorld.sha256}]};
const published=await store.commit(request);assert.equal(published.revision,2);
const opened=[],originalOpen=io.open;io.open=async name=>{opened.push(name);return originalOpen(name);};
const reopened=new HeroRouteStore(io,p.identity,p.identity.contentDigest);let selected;
await reopened.withOwner(async value=>{
  assert.deepEqual(value.owner,proof.selectedOwner);assert.equal(value.record.manifest,published.manifest);
  assert.equal(await checkpointSavedClock(value.source),1500);assert.equal(value.entry.world.sha256,proof.evolvedWorld.sha256);
  selected={record:value.record,owner:value.owner,entry:value.entry};
});
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_0_-1_1.GMP']);
const writes=stats.writes,retry=await store.commit(request);assert.equal(retry.idempotent,true);assert.equal(stats.writes,writes);
// Both dormant home slots and the old selected destination slot are immutable.
for(const[n,h]of Object.entries(originalHashes))if(n.endsWith('.GMP'))assert.equal(await hash(join(p.journal,n)),h);
const worlds=(await readdir(p.journal)).filter(n=>n.endsWith('.GMP'));assert.equal(worlds.length,4);
assert.ok(stats.largestRead<=4096&&stats.largestWrite<=4096);assert.equal(stats.peakReads,1);
const sourceSha256={};for(const n of ['scripts/publish-native-selected-halo-save.mjs','web/world/hero-route-store.mjs','web/world/entity-ownership.mjs',
  'web/world/entity-home-ownership.mjs','web/world/checkpoint.mjs','web/world/saved-clock.mjs','scripts/lib/stopped-hero-route-io.mjs',
  'scripts/lib/stopped-entity-io.mjs','scripts/lib/native-generation.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,selectedOriginalHaloOwnerSavePublished:true,proof:{filename:resolve(proofName),sha256:await hash(proofName)},
  directory:p.journal,identity:p.identity,previousManifest:proof.selectedManifest,selectedManifest:published.manifest,selected,
  sourceClock:1000,evolvedClock:1500,selectedRevision:2,selectedOwner:selected.owner,evolvedWorld:proof.evolvedWorld,
  oldWorldsPreserved:originalHashes,retainedCheckpointSlots:4,maximumSlotsPerRegion:2,idempotentRetryWithoutWrites:true,
  stats,sourceSha256,dormantWorldsOpenedForOwnerExport:0,nativeProcessesStarted:0,browserUsed:false,
  seamlessLiveTravelQualified:false,repeatedReturnTravelQualified:false,goalComplete:false};
await writeFile(outputName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({selectedOriginalHaloOwnerSavePublished:true,selectedRevision:2,evolvedClock:1500,retainedCheckpointSlots:4}));
