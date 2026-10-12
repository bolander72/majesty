#!/usr/bin/env node
// Select the real stopped eighth-region owner without changing its journal.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {requireCheckpointHaloLayout} from '../web/world/halo-checkpoint-layout.mjs';
import {selectedHeroRuntimeBinding,selectedHeroHaloBinding} from '../web/world/hero-runtime-binding.mjs';

const [archiveName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/hero-remote-owner-restore-\d{3}-preparation\.json$/);
await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const json=async name=>{assert.ok((await lstat(name)).size<=1024*1024);return JSON.parse(await readFile(name,'utf8'));};
const descriptor=async filename=>{const {bytes,sha256}=await hashNativeFile(filename);return {filename:resolve(filename),bytes,sha256};};
const archive=await json(archiveName);assert.equal(archive.generatedRegions,8);
const evidence=async pattern=>{
 const matches=archive.evidence.filter(row=>pattern.test(row.source));assert.equal(matches.length,1);
 const row=matches[0];assert.equal((await descriptor(row.preserved)).sha256,row.sha256);
 assert.equal((await descriptor(row.source)).sha256,row.sha256);return {row,value:await json(row.source)};
};
const original=await evidence(/native-hero-binding-attempt-074-recovered\.json$/),
 checked=await evidence(/native-hero-generation-013-observed\.json$/),m=original.value;
assert.equal(checked.value.qualifiedGeneratedNeighborJourneys,8);
assert.equal(checked.value.manifest.sha256,original.row.sha256);
for(const key of ['nativeSessionTerminal','ownedProducerAbsent','publicationWorkerAbsent'])assert.equal(m[key],true);
for(const pid of [m.nativePid,m.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
assert.equal(m.nativeExitCode,0);assert.equal(m.publicationWorkerExitCode,0);
const identityName=join(m.publicationJournal,'Frontier_Hero_Route_Identity.json'),identity=await json(identityName),
 head=await descriptor(join(m.publicationJournal,HERO_ROUTE_HEAD)),stats={};
const store=new HeroRouteStore(await stoppedHeroRouteStorage(m.publicationJournal,stats),identity,identity.contentDigest);
const g=await json(m.freshGeneration.filename),last=g.additionalGenerations.at(-1),source=await descriptor(last.active.filename);
assert.equal(source.sha256,last.active.sha256);
const selected=await store.withOwner(async selected=>{
 assert.equal(selected.record.revision,16);assert.equal(selected.owner.region,'-5_-1');
 assert.equal(selected.entry.world.sha256,source.sha256);assert.equal(selected.entry.homeAlias.kind,'proxy');
 const clock=await checkpointSavedClock(selected.source);assert.equal(clock,100);
 const layout=await requireCheckpointHaloLayout(selected.source,'-5_-1','halo-v1');
 const binding=selectedHeroRuntimeBinding(identity,selected.entry,clock);
 return {entry:selected.entry,clock,runtimeBinding:binding,haloBinding:selectedHeroHaloBinding(binding,layout),
  ownerManifest:selected.record.manifest};
});
const checkSource=await stoppedFileSource(source.filename);assert.equal(await checkpointSavedClock(checkSource),100);
assert.deepEqual(await descriptor(head.filename),head);assert.equal(stats.writes??0,0);
const report={version:1,originalRemoteOwnerRestorePrepared:true,archive:await descriptor(archiveName),
 producer:await descriptor(original.row.source),inspection:await descriptor(checked.row.source),
 sourceCheckpoint:source,sourceJournal:m.publicationJournal,sourceHead:head,identity:await descriptor(identityName),
 sourceOwnerRevision:16,region:'-5_-1',...selected,sourceJournalUnchanged:true,sourceWrites:0,adapterStats:stats,
 preparationScriptSha256:(await descriptor('scripts/prepare-native-hero-remote-owner-restore.mjs')).sha256,
 browserUsed:false,nativeProcessesStarted:0,nativeRemoteOwnerRestored:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({originalRemoteOwnerRestorePrepared:true,region:report.region,revision:16,sourceWrites:0}));
