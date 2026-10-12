#!/usr/bin/env node
// Export the current selected home and retired northern world without changing custody.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointActorRecords} from '../web/world/checkpoint.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [archiveName,buildName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,5);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-halo-session-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const archive=await json(archiveName);assert.equal(archive.journalSelectedReturnedHomeSavePublished,true);assert.equal(archive.selectedRevision,4);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
function bound(a,name,digest){const rows=a.evidence.filter(r=>r.original===resolve(name));assert.equal(rows.length,1);
 if(digest!==undefined)assert.equal(rows[0].sha256,digest);return rows[0];}
const proofRow=bound(archive,'output/native-halo-return-owner-save-001-observed.json'),proof=await json(proofRow.preserved);
assert.equal(proof.journalSelectedReturnedHomeSavePublished,true);assert.equal(proof.selectedRevision,4);assert.equal(proof.endClock,64150);
assert.deepEqual(proof.selectedOwner,{entityId:proof.identity.entityId,region:'0_0',unitId:496,agentId:22});
assert.equal(await hash(proof.nativeArchive.filename),proof.nativeArchive.sha256);
const nativeArchive=await json(proof.nativeArchive.filename);assert.equal(nativeArchive.generation,255);
for(const r of nativeArchive.sources.concat(nativeArchive.evidence))assert.equal(await hash(r.preserved),r.sha256);
const nativePrep=await json(bound(nativeArchive,'output/native-halo-return-owner-preparation-002/preparation.json').preserved);
for(const r of nativePrep.settings)assert.equal(await hash(r.preserved),r.sha256);
const nativeProofRows=nativeArchive.evidence.filter(r=>r.preserved===resolve(proof.nativeProof.filename));assert.equal(nativeProofRows.length,1);
assert.equal(nativeProofRows[0].sha256,proof.nativeProof.sha256);const nativeProof=await json(nativeProofRows[0].preserved);
assert.equal(nativeProof.journalSelectedReturnedHomeReloadQualified,true);assert.equal(nativeProof.nativeSessionTerminal,true);assert.equal(nativeProof.nativeExitCode,0);
const build=await json(buildName);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);const compiled={};
for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256'])
 for(const[n,h]of Object.entries(build[group])){assert.equal(compiled[n],undefined);compiled[n]=h;assert.equal(await hash(n),h);}
assert.equal(Object.keys(compiled).length,54);assert.equal(await hash('upstream/majesty-recomp/build/recomp/pop_smoke'),build.nativeExecutableSha256);
for(const[n,h]of Object.entries(proof.journalSha256))assert.equal(await hash(join(proof.journal,n)),h);
assert.equal(await readFile(join(proof.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),proof.selectedManifest);
const stats={},io=await stoppedHeroRouteStorage(proof.journal,stats),store=new HeroRouteStore(io,proof.identity,proof.identity.contentDigest);
io.atomicWrite=async()=>{throw Error('Session preparation may not change custody');};
await mkdir(directory);const worlds=[];let escaped,actorCrossing;
await store.withDestination('0_-1',null,async value=>{
 assert.equal(value.record.revision,4);assert.equal(value.record.manifest,proof.selectedManifest);assert.deepEqual(value.owner,proof.selectedOwner);
 assert.deepEqual(value.regions,['0_0','0_-1']);
 assert.deepEqual(value.entries[0].alias,{unitId:496,agentId:22});assert.deepEqual(value.entries[0].homeAlias,{kind:'native',unitId:469,agentId:7});
 assert.deepEqual(value.entries[1].alias,{unitId:510,agentId:54});assert.equal(value.entries[1].homeAlias.kind,'proxy');
 for(const [i,source]of value.sources.entries()){
  const clock=await checkpointSavedClock(source);assert.equal(clock,[64150,1500][i]);
  if(i===0){const actor=await checkpointActorRecords(source,value.entries[0].alias.unitId);
   assert.equal(actor.agent.agentId,value.entries[0].alias.agentId);assert.equal(actor.unit.family,'VHCL');assert.equal(actor.unit.parentUnitId,0);
   const raw=await source.readAt(actor.unit.offset+60,12),view=new DataView(raw.buffer,raw.byteOffset,12),pose=[0,4,8].map(at=>view.getInt32(at,true));
   for(const n of pose.slice(0,2))assert.ok(n>=64*2048&&n<4032*2048);
   actorCrossing={unitId:actor.unit.unitId,agentId:actor.agent.agentId,sourceClock:clock,guild:value.entries[0].homeAlias,
    initialPose:pose,bountyPoint:[4064,32],reward:1000};
  }
  const filename=join(directory,`Region_${value.regions[i]}.GMP`),f=await open(filename,'wx');let at=0;
  try{assert.equal(await hashCheckpointSource(source,async bytes=>{
   for(let j=0;j<bytes.length;){const{bytesWritten}=await f.write(bytes,j,bytes.length-j,at);assert.ok(bytesWritten);j+=bytesWritten;at+=bytesWritten;}
  }),value.entries[i].world.sha256);await f.sync();}finally{await f.close();}
  worlds.push({region:value.regions[i],clock,entry:value.entries[i],filename,...await hashNativeFile(filename)});
 }escaped=value.sources;
});
assert.equal(stats.peakReads,1);assert.ok(stats.largestRead<=4096);
for(const source of escaped)await assert.rejects(source.readAt(0,16),/lease ended/);
for(const[n,h]of Object.entries(proof.journalSha256))assert.equal(await hash(join(proof.journal,n)),h);
const sourceSha256={};for(const n of ['scripts/prepare-native-halo-session.mjs','scripts/lib/native-generation.mjs','scripts/lib/stopped-entity-io.mjs',
 'scripts/lib/stopped-hero-route-io.mjs','web/world/hero-route-store.mjs','web/world/checkpoint-lease.mjs','web/world/entity-ownership.mjs',
 'web/world/entity-home-ownership.mjs','web/world/checkpoint.mjs','web/world/saved-clock.mjs','web/world/transfer-store.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,haloSessionPrepared:true,publicationArchive:{filename:resolve(archiveName),sha256:await hash(archiveName)},
 publicationProof:{filename:proofRow.preserved,sha256:proofRow.sha256},build:{filename:resolve(buildName),sha256:await hash(buildName)},
 compiledSourceSha256:compiled,identity:proof.identity,selectedOwner:proof.selectedOwner,selectedManifest:proof.selectedManifest,selectedRevision:4,
 journal:proof.journal,journalSha256:proof.journalSha256,worlds,actorCrossing,settings:nativePrep.settings,
 settingsProducerExecutableSha256:nativePrep.settingsProducerExecutableSha256,sourceSha256,stats,readersRevoked:true,
 route:['0_0','0_-1','0_0','1_0','0_0'],freshRegion:'1_0',nativeProcessesStarted:0,browserUsed:false,ownerPublished:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({haloSessionPrepared:true,selectedRevision:4,regions:worlds.map(w=>w.region),readersRevoked:true}));
