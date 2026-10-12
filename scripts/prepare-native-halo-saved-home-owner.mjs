#!/usr/bin/env node
// Export the selected returned home for an original full-world reload.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [publicationName,buildName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,5);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-halo-saved-home-owner-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const proof=await json(publicationName);assert.equal(proof.journalOriginalSavedRoundtripPublished,true);
assert.equal(proof.selectedRevision,8);assert.equal(proof.destinationClock,113500);assert.equal(proof.interruptions.length,8);
assert.equal(proof.refusals.length,5);assert.equal(proof.nativeProcessesStarted,0);assert.equal(proof.browserUsed,false);
assert.deepEqual(proof.selectedOwner,{entityId:proof.identity.entityId,region:'0_0',unitId:513,agentId:29});
for(const[n,h]of Object.entries(proof.sourceSha256))assert.equal(await hash(n),h);
assert.equal(await hash(proof.nativeArchive.filename),proof.nativeArchive.sha256);const archive=await json(proof.nativeArchive.filename);
assert.equal(archive.nativeSavedHomeOriginalGameplayQualified,true);assert.equal(archive.homeGameplayTicks,200);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
function bound(name,digest){const rows=archive.evidence.filter(r=>r.original===resolve(name));assert.equal(rows.length,1);
 if(digest!==undefined)assert.equal(rows[0].sha256,digest);return rows[0];}
const nativeProof=await json(bound(archive.homeActivationProof.filename,archive.homeActivationProof.sha256).preserved);
const trial=await json(bound(nativeProof.manifest,nativeProof.manifestSha256).preserved);
assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);
try{process.kill(trial.nativePid,0);throw Error('Original producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
const base=await json(bound(trial.preparation,trial.preparationSha256).preserved);
for(const row of base.settings)assert.equal(await hash(row.preserved),row.sha256);
const build=await json(buildName);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);const compiled={};
for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256'])
 for(const[n,h]of Object.entries(build[group])){assert.equal(compiled[n],undefined);compiled[n]=h;assert.equal(await hash(n),h);}
assert.equal(Object.keys(compiled).length,54);assert.equal(await hash('upstream/majesty-recomp/build/recomp/pop_smoke'),build.nativeExecutableSha256);
for(const[n,h]of Object.entries(proof.journalSha256))assert.equal(await hash(join(proof.journal,n)),h);
assert.equal(await readFile(join(proof.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),proof.selectedManifest);
const stats={},io=await stoppedHeroRouteStorage(proof.journal,stats),store=new HeroRouteStore(io,proof.identity,proof.identity.contentDigest);
io.atomicWrite=async()=>{throw Error('Owner preparation cannot publish custody');};
const opened=[],originalOpen=io.open;io.open=async n=>{opened.push(n);return originalOpen(n);};
await mkdir(directory);const filename=join(directory,'Selected_Home.GMP');let selected,escaped;
await store.withOwner(async v=>{
 assert.equal(v.record.manifest,proof.selectedManifest);assert.equal(v.record.revision,8);assert.deepEqual(v.owner,proof.selectedOwner);
 assert.deepEqual(v.entry.alias,{unitId:513,agentId:29});assert.deepEqual(v.entry.homeAlias,{kind:'native',unitId:469,agentId:7});
 assert.equal(v.entry.world.sha256,proof.destinationWorld.sha256);assert.equal(await checkpointSavedClock(v.source),113500);
 const kinds=[];for await(const e of checkpointActorOrderEntries(v.source,513))if(e.type==='entry')kinds.push(e.kind);
 assert.deepEqual(kinds,[2,4,7]);
 const f=await open(filename,'wx');let at=0;try{assert.equal(await hashCheckpointSource(v.source,async bytes=>{
  for(let i=0;i<bytes.length;){const{bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
 }),v.entry.world.sha256);await f.sync();}finally{await f.close();}
 selected={record:v.record,owner:v.owner,entry:v.entry};escaped=v.source;
});
await assert.rejects(escaped.readAt(0,16),/lease ended/);assert.equal(stats.peakReads,1);assert.ok(stats.largestRead<=4096);
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_0_0_1.GMP']);
const idsName=join(directory,'Halo_Saved_Home_Owner.ids'),ids=Buffer.alloc(36);
[0x3153484f,1,113500,114000,513,29,469,7,8].forEach((v,i)=>ids.writeUInt32LE(v,i*4));await writeFile(idsName,ids,{flag:'wx'});
for(const[n,h]of Object.entries(proof.journalSha256))assert.equal(await hash(join(proof.journal,n)),h);
const sourceSha256={};for(const n of ['scripts/prepare-native-halo-saved-home-owner.mjs','scripts/lib/native-generation.mjs','scripts/lib/stopped-entity-io.mjs',
 'scripts/lib/stopped-hero-route-io.mjs','web/world/hero-route-store.mjs','web/world/entity-ownership.mjs','web/world/entity-home-ownership.mjs',
 'web/world/checkpoint.mjs','web/world/order-entries.mjs','web/world/checkpoint-lease.mjs','web/world/saved-clock.mjs','web/world/transfer-store.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,selectedHaloSavedHomeOwnerPrepared:true,publicationProof:{filename:resolve(publicationName),sha256:await hash(publicationName)},
 nativeArchive:proof.nativeArchive,build:{filename:resolve(buildName),sha256:await hash(buildName)},compiledSourceSha256:compiled,
 identity:proof.identity,selected,ownerManifest:proof.selectedManifest,journal:proof.journal,journalSha256:proof.journalSha256,
 world:{filename,...await hashNativeFile(filename)},reloadIds:{filename:idsName,...await hashNativeFile(idsName)},
 settings:base.settings,settingsProducerExecutableSha256:base.settingsProducerExecutableSha256,sourceSha256,stats,
 ownerExportDormantWorldsOpened:0,ownerReaderRevoked:true,startClock:113500,endClock:114000,
 nativeProcessesStarted:0,browserUsed:false,ownerPublished:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({selectedHaloSavedHomeOwnerPrepared:true,selectedRevision:8,ownerExportDormantWorldsOpened:0}));
