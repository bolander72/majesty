#!/usr/bin/env node
// Export only the journal-selected returned home for original-engine reload.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {checkpointActorRecords,checkpointUnitAgentLinks,checkpointAttachments,checkpointAgentQueues} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const[archiveName,buildName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,5);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-halo-return-owner-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const archive=await json(archiveName);assert.equal(archive.stoppedOriginalHaloReturnPublished,true);assert.equal(archive.selectedRevision,3);
assert.equal(archive.interruptionRecoveries,4);assert.equal(archive.refusals,2);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
function bound(a,original,digest){const rows=a.evidence.filter(r=>r.original===resolve(original));assert.equal(rows.length,1);
 if(digest!==undefined)assert.equal(rows[0].sha256,digest);return rows[0];}
const proofRow=bound(archive,'output/native-halo-return-route-publication-001-observed.json'),proof=await json(proofRow.preserved);
assert.equal(proof.stoppedOriginalHaloReturnPublished,true);assert.deepEqual(proof.selectedOwner,{entityId:proof.identity.entityId,region:'0_0',unitId:496,agentId:22});
assert.equal(proof.destinationClock,63650);assert.equal(proof.sourceClock,1500);assert.equal(proof.retainedCheckpointSlots,4);
assert.equal(await hash(proof.sourceArchive.filename),proof.sourceArchive.sha256);const sourceArchive=await json(proof.sourceArchive.filename);
assert.equal(sourceArchive.generation,253);assert.equal(sourceArchive.nativeReturnedSourceRetirementQualified,true);
for(const r of sourceArchive.sources.concat(sourceArchive.evidence))assert.equal(await hash(r.preserved),r.sha256);
const sourceProofRow=bound(sourceArchive,'output/native-halo-return-source-001-observed.json'),sourceProof=await json(sourceProofRow.preserved);
const sourceTrial=await json(bound(sourceArchive,sourceProof.manifest,sourceProof.manifestSha256).preserved);
assert.equal(sourceTrial.nativeSessionTerminal,true);assert.equal(sourceTrial.nativeExitCode,0);assert.equal(sourceTrial.ownedProducerAbsent,true);
try{process.kill(sourceTrial.nativePid,0);throw Error('Source producer still live');}catch(e){if(e.code!=='ESRCH')throw e;}
const base=await json(bound(sourceArchive,sourceTrial.preparation,sourceTrial.preparationSha256).preserved);
for(const r of base.settings)assert.equal(await hash(r.preserved),r.sha256);
const build=await json(buildName);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);const compiled={};
for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256'])
 for(const[n,h]of Object.entries(build[group])){assert.equal(compiled[n],undefined);compiled[n]=h;assert.equal(await hash(n),h);}
assert.equal(Object.keys(compiled).length,54);assert.equal(await hash('upstream/majesty-recomp/build/recomp/pop_smoke'),build.nativeExecutableSha256);
for(const[n,h]of Object.entries(proof.journalSha256))assert.equal(await hash(join(proof.journal,n)),h);
assert.equal(await readFile(join(proof.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),proof.selectedManifest);
const stats={},io=await stoppedHeroRouteStorage(proof.journal,stats),store=new HeroRouteStore(io,proof.identity,proof.identity.contentDigest);
io.atomicWrite=async()=>{throw Error('Owner preparation may not write custody');};
const opened=[],originalOpen=io.open;io.open=async n=>{opened.push(n);return originalOpen(n);};
await mkdir(directory);const worldName=join(directory,'Selected_Home.GMP');let selected,escaped;
await store.withOwner(async value=>{
 assert.equal(value.record.manifest,proof.selectedManifest);assert.equal(value.record.revision,3);assert.deepEqual(value.owner,proof.selectedOwner);
 assert.deepEqual(value.entry.alias,{unitId:496,agentId:22});assert.deepEqual(value.entry.homeAlias,{kind:'native',unitId:469,agentId:7});
 assert.equal(value.entry.world.sha256,proof.destinationWorld.sha256);assert.equal(await checkpointSavedClock(value.source),63650);
 const hero=await checkpointActorRecords(value.source,496);assert.equal(hero.agent.agentId,22);assert.equal(hero.unit.parentUnitId,0);
 for await(const u of checkpointUnitAgentLinks(value.source))assert.ok(![481,497,498,510].includes(u.unitId)&&![497,498].includes(u.parentUnitId));
 for await(const r of checkpointAttachments(value.source))assert.ok(![497,498].includes(r.unitId));
 const entries=[];for await(const e of checkpointActorOrderEntries(value.source,496))if(e.type==='entry')entries.push(e);
 assert.deepEqual(entries.map(e=>e.kind),[2,4,7]);
 let queued=0;for await(const q of checkpointAgentQueues(value.source))if(q.type==='queued-agent'&&q.agentId===22)queued++;
 assert.equal(queued,1);
 const f=await open(worldName,'wx');let at=0;try{assert.equal(await hashCheckpointSource(value.source,async bytes=>{
  for(let i=0;i<bytes.length;){const{bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
 }),value.entry.world.sha256);await f.sync();}finally{await f.close();}
 selected={record:value.record,owner:value.owner,entry:value.entry};escaped=value.source;
});
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_0_0_0.GMP']);assert.equal(stats.peakReads,1);assert.ok(stats.largestRead<=4096);
await assert.rejects(escaped.readAt(0,16),/lease ended/);
const idsName=join(directory,'Halo_Return_Owner.ids'),ids=Buffer.alloc(28);
[0x314f5248,63650,64150,496,22,497,498].forEach((v,i)=>ids.writeUInt32LE(v,i*4));await writeFile(idsName,ids,{flag:'wx'});
const sourceSha256={};for(const n of ['scripts/prepare-native-halo-return-owner.mjs','scripts/lib/native-generation.mjs','scripts/lib/stopped-entity-io.mjs',
 'scripts/lib/stopped-hero-route-io.mjs','web/world/hero-route-store.mjs','web/world/entity-ownership.mjs','web/world/entity-home-ownership.mjs',
 'web/world/checkpoint.mjs','web/world/order-entries.mjs','web/world/saved-clock.mjs','web/world/transfer-store.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,selectedHaloReturnOwnerPrepared:true,nativeReaderReady:true,
 publicationArchive:{filename:resolve(archiveName),sha256:await hash(archiveName)},publicationProof:{filename:proofRow.preserved,sha256:proofRow.sha256},
 build:{filename:resolve(buildName),sha256:await hash(buildName)},compiledSourceSha256:compiled,
 world:{filename:worldName,...await hashNativeFile(worldName)},reloadIds:{filename:idsName,...await hashNativeFile(idsName)},
 settings:base.settings,settingsProducerExecutableSha256:sourceTrial.nativeExecutableSha256,identity:proof.identity,selected,
 journal:proof.journal,journalSha256:proof.journalSha256,ownerManifest:proof.selectedManifest,sourceSha256,
 startClock:63650,endClock:64150,actualNativeUnitIds:[496],actualAgentId:22,expiredUnitIds:[497,498],
 dormantWorldsOpened:0,ownerReaderRevoked:true,stats,ownerPublished:false,nativeProcessesStarted:0,browserUsed:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({selectedHaloReturnOwnerPrepared:true,startClock:63650,selectedRevision:3,dormantWorldsOpened:0,expiredEffectsRestored:false}));
