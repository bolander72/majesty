#!/usr/bin/env node
// Export only the selected returned home and retired east for repeated paging.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointActorRecords} from '../web/world/checkpoint.mjs';
import {registeredHeroHome} from '../web/world/entity-home-ownership.mjs';
import {prepareOrReuseRemoteHomeAgent} from '../web/world/remote-home-cache.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [archiveName,buildName,directoryName,mode]=process.argv.slice(2),crossing=mode==='--actor-crossing';
assert.equal(process.argv.length,crossing?6:5);assert.ok(mode===undefined||crossing);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-halo-homeward-session-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const archive=await json(archiveName);assert.equal(archive.nativeSelectedHaloHomewardOwnerQualified,true);assert.equal(archive.selectedRevision,6);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
function bound(name,digest){const rows=archive.evidence.filter(r=>r.original===resolve(name));assert.equal(rows.length,1);
 if(digest!==undefined)assert.equal(rows[0].sha256,digest);return rows[0];}
const ownerProof=await json(bound(archive.proof.filename,archive.proof.sha256).preserved);
assert.equal(ownerProof.nativeSelectedHaloHomewardOwnerQualified,true);assert.equal(ownerProof.exactRecordComparisons,1512);
const trial=await json(bound(ownerProof.manifest,ownerProof.manifestSha256).preserved);
assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);
try{process.kill(trial.nativePid,0);throw Error('Owner producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
const nativePrep=await json(bound(trial.preparation,trial.preparationSha256).preserved);
const proofRow=bound(archive.publicationProof.filename,archive.publicationProof.sha256),proof=await json(proofRow.preserved);
assert.equal(proof.journalOriginalHaloHomewardPublished,true);assert.equal(proof.selectedRevision,6);
assert.deepEqual(proof.selectedOwner,{entityId:proof.identity.entityId,region:'0_0',unitId:508,agentId:25});
for(const[n,h]of Object.entries(proof.sourceSha256))assert.equal(await hash(n),h);
for(const row of nativePrep.settings)assert.equal(await hash(row.preserved),row.sha256);
const build=await json(buildName);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);const compiled={};
for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256'])
 for(const[n,h]of Object.entries(build[group])){assert.equal(compiled[n],undefined);compiled[n]=h;assert.equal(await hash(n),h);}
assert.equal(Object.keys(compiled).length,54);assert.equal(await hash('upstream/majesty-recomp/build/recomp/pop_smoke'),build.nativeExecutableSha256);
for(const[n,h]of Object.entries(proof.journalSha256))assert.equal(await hash(join(proof.journal,n)),h);
assert.equal(await readFile(join(proof.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),proof.selectedManifest);
const stats={},io=await stoppedHeroRouteStorage(proof.journal,stats),store=new HeroRouteStore(io,proof.identity,proof.identity.contentDigest);
io.atomicWrite=async()=>{throw Error('Paging preparation may not publish custody');};
const opened=[],originalOpen=io.open;io.open=async n=>{opened.push(n);return originalOpen(n);};
await mkdir(directory);const worlds=[];let escaped,actorCrossing,savedActorDestination;
await store.withDestination('1_0',null,async v=>{
 assert.equal(v.record.revision,6);assert.equal(v.record.manifest,proof.selectedManifest);assert.deepEqual(v.owner,proof.selectedOwner);
 assert.deepEqual(v.regions,['0_0','1_0']);assert.deepEqual(v.entries.map(e=>e.alias),[{unitId:508,agentId:25},{unitId:532,agentId:35}]);
 assert.deepEqual(v.entries.map(e=>e.homeAlias),[{kind:'native',unitId:469,agentId:7},{kind:'proxy',unitId:0,agentId:34}]);
 for(const[i,source]of v.sources.entries()){
  const clock=await checkpointSavedClock(source);assert.equal(clock,[94550,3750][i]);
  assert.equal(v.entries[i].world.sha256,[proof.destinationWorld,proof.sourceWorld][i].sha256);
  if(crossing&&i===0){
   const actor=await checkpointActorRecords(source,v.entries[0].alias.unitId);
   assert.equal(actor.agent.agentId,v.entries[0].alias.agentId);assert.equal(actor.unit.family,'VHCL');assert.equal(actor.unit.parentUnitId,0);
   const raw=await source.readAt(actor.unit.offset+60,12),view=new DataView(raw.buffer,raw.byteOffset,12),pose=[0,4,8].map(at=>view.getInt32(at,true));
   for(const n of pose.slice(0,2))assert.ok(n>=64*2048&&n<4032*2048);
   actorCrossing={unitId:actor.unit.unitId,agentId:actor.agent.agentId,sourceClock:clock,guild:v.entries[0].homeAlias,
    initialPose:pose,bountyPoint:[4064,32],reward:1000};
  }
  if(crossing&&i===1){
   // A visited neighbor already carries the immutable home projection. Reuse
   // its original pure agent and saved clock instead of allocating another
   // guild projection or treating the restored kingdom as a fresh epoch.
   const registered=registeredHeroHome(proof.identity),prepared=await prepareOrReuseRemoteHomeAgent(source,registered,
    {worldId:registered.record.worldId,contentDigest:registered.record.contentDigest,destinationRegion:v.regions[i],freshAgentId:1000});
   assert.equal(prepared.plan.admission,'reuse-existing');assert.equal(prepared.plan.proposedAgentId,v.entries[i].homeAlias.agentId);
   assert.equal(prepared.plan.recordBytes,453);
   savedActorDestination={region:v.regions[i],clock,worldSha256:v.entries[i].world.sha256,
    homeAlias:v.entries[i].homeAlias,homePlan:prepared.plan,heroPresent:false};
  }
  const filename=join(directory,`Region_${v.regions[i]}.GMP`),f=await open(filename,'wx');let at=0;
  try{assert.equal(await hashCheckpointSource(source,async bytes=>{
   for(let j=0;j<bytes.length;){const{bytesWritten}=await f.write(bytes,j,bytes.length-j,at);assert.ok(bytesWritten);j+=bytesWritten;at+=bytesWritten;}
  }),v.entries[i].world.sha256);await f.sync();}finally{await f.close();}
  worlds.push({region:v.regions[i],clock,entry:v.entries[i],filename,...await hashNativeFile(filename)});
 }escaped=v.sources;
});
for(const source of escaped)await assert.rejects(source.readAt(0,16),/lease ended/);
assert.equal(stats.peakReads,1);assert.ok(stats.largestRead<=4096);
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_0_0_1.GMP','Frontier_Hero_Route_1_0_1.GMP']);
for(const[n,h]of Object.entries(proof.journalSha256))assert.equal(await hash(join(proof.journal,n)),h);
const sourceSha256={};for(const n of ['scripts/prepare-native-halo-homeward-session.mjs','scripts/lib/native-generation.mjs','scripts/lib/stopped-entity-io.mjs',
 'scripts/lib/stopped-hero-route-io.mjs','web/world/hero-route-store.mjs','web/world/checkpoint-lease.mjs','web/world/entity-ownership.mjs',
 'web/world/entity-home-ownership.mjs','web/world/remote-home-cache.mjs','web/world/remote-home.mjs','web/world/hero-home.mjs',
 'web/world/sha256.mjs','web/world/checkpoint.mjs','web/world/saved-clock.mjs','web/world/transfer-store.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,haloSessionPrepared:true,homewardSessionPrepared:true,publicationArchive:{filename:resolve(archiveName),sha256:await hash(archiveName)},
 publicationProof:{filename:proofRow.preserved,sha256:proofRow.sha256},build:{filename:resolve(buildName),sha256:await hash(buildName)},
 compiledSourceSha256:compiled,identity:proof.identity,selectedOwner:proof.selectedOwner,selectedManifest:proof.selectedManifest,selectedRevision:6,
 journal:proof.journal,journalSha256:proof.journalSha256,worlds,actorCrossing,savedActorDestination,settings:nativePrep.settings,
 settingsProducerExecutableSha256:nativePrep.settingsProducerExecutableSha256,sourceSha256,stats,readersRevoked:true,
 route:['0_0','1_0','0_0','1_0','0_0'],freshRegion:null,heroTransferred:false,nativeProcessesStarted:0,browserUsed:false,ownerPublished:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({homewardSessionPrepared:true,selectedRevision:6,regions:worlds.map(w=>w.region),readersRevoked:true}));
