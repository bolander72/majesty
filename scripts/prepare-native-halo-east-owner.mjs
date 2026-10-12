#!/usr/bin/env node
// Export only the selected eastern owner for original-engine reload.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {checkpointActorRecords,checkpointUnits,checkpointAttachments,checkpointAgentQueues} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
import {readSelectedHaloHomeLeg} from '../web/world/halo-home-leg.mjs';
const [archiveName,buildName,directoryName,mode]=process.argv.slice(2);
const retiring=mode==='--home-leg-retire',homeLeg=mode==='--home-leg'||retiring;
assert.equal(process.argv.length,homeLeg?6:5);assert.ok(mode===undefined||homeLeg);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),retiring?/^native-halo-home-leg-retire-preparation-\d{3}$/:homeLeg?/^native-halo-home-leg-preparation-\d{3}$/:/^native-halo-east-owner-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
let homeLegArchive=null;if(retiring){const filename=resolve('output/native-halo-home-leg-generation-276/manifest.json'),a=await json(filename);
 assert.equal(a.generation,276);assert.equal(a.nativeSelectedHaloHomeLegQualified,true);assert.equal(a.originalHomewardMovementQualified,true);
 assert.equal(a.ownerPublished,false);assert.equal(a.homeRegionRestored,false);assert.equal(a.selectedRevision,5);
 for(const r of a.sources.concat(a.evidence))assert.equal(await hash(r.preserved),r.sha256);
 homeLegArchive={filename,sha256:await hash(filename)};}
const archive=await json(archiveName);assert.equal(archive.journalRunningHaloHandoffPublished,true);assert.equal(archive.selectedRevision,5);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
function bound(a,name,digest){const rows=a.evidence.filter(r=>r.original===resolve(name));assert.equal(rows.length,1);
 if(digest!==undefined)assert.equal(rows[0].sha256,digest);return rows[0];}
const proofRow=bound(archive,'output/native-halo-session-activation-publication-001-observed.json'),proof=await json(proofRow.preserved);
assert.equal(proof.journalRunningHaloHandoffPublished,true);assert.equal(proof.selectedRevision,5);assert.equal(proof.destinationClock,3550);
assert.deepEqual(proof.selectedOwner,{entityId:proof.identity.entityId,region:'1_0',unitId:532,agentId:35});
assert.equal(await hash(proof.nativeArchive.filename),proof.nativeArchive.sha256);const nativeArchive=await json(proof.nativeArchive.filename);
assert.equal(nativeArchive.generation,272);assert.equal(nativeArchive.nativeRunningActorActivationQualified,true);
for(const r of nativeArchive.sources.concat(nativeArchive.evidence))assert.equal(await hash(r.preserved),r.sha256);
const activation=await json(bound(nativeArchive,'output/native-halo-session-activation-001-observed.json').preserved);
const trial=await json(bound(nativeArchive,activation.manifest,activation.manifestSha256).preserved);
assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);
try{process.kill(trial.nativePid,0);throw Error('Native producer is live');}catch(e){if(e.code!=='ESRCH')throw e;}
const base=await json(bound(nativeArchive,trial.preparation,trial.preparationSha256).preserved);
for(const r of base.settings)assert.equal(await hash(r.preserved),r.sha256);
const build=await json(buildName);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);const compiled={};
for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256'])
 for(const[n,h]of Object.entries(build[group])){assert.equal(compiled[n],undefined);compiled[n]=h;assert.equal(await hash(n),h);}
assert.equal(Object.keys(compiled).length,54);assert.equal(await hash('upstream/majesty-recomp/build/recomp/pop_smoke'),build.nativeExecutableSha256);
for(const[n,h]of Object.entries(proof.journalSha256))assert.equal(await hash(join(proof.journal,n)),h);
assert.equal(await readFile(join(proof.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),proof.selectedManifest);
const stats={},io=await stoppedHeroRouteStorage(proof.journal,stats),store=new HeroRouteStore(io,proof.identity,proof.identity.contentDigest);
io.atomicWrite=async()=>{throw Error('Eastern owner preparation may not write custody');};
const opened=[],originalOpen=io.open;io.open=async n=>{opened.push(n);return originalOpen(n);};
const leg=homeLeg?await readSelectedHaloHomeLeg(store,{expectedManifest:proof.selectedManifest}):null;
if(homeLeg){assert.ok(leg);assert.equal(leg.ownerRevision,5);assert.equal(leg.destinationRegion,'0_0');
 assert.deepEqual(leg.sourcePose,{x:135015,y:258194,z:116930});assert.deepEqual(leg.localGoal,{x:98304,y:258194});}
await mkdir(directory);const filename=join(directory,'Selected_East.GMP');let selected,escaped;
await store.withOwner(async v=>{
 assert.equal(v.record.revision,5);assert.equal(v.record.manifest,proof.selectedManifest);assert.deepEqual(v.owner,proof.selectedOwner);
 assert.deepEqual(v.entry.alias,{unitId:532,agentId:35});assert.deepEqual(v.entry.homeAlias,{kind:'proxy',unitId:0,agentId:34});
 assert.equal(v.entry.world.sha256,proof.destinationWorld.sha256);assert.equal(await checkpointSavedClock(v.source),3550);
 const hero=await checkpointActorRecords(v.source,532);assert.equal(hero.agent.agentId,35);assert.equal(hero.unit.parentUnitId,0);
 for await(const u of checkpointUnits(v.source))assert.ok(![533,534,535].includes(u.primary.words[1]));
 for await(const r of checkpointAttachments(v.source))assert.ok(![533,534,535].includes(r.unitId)&&!(r.kind==='ORDR'&&r.unitId===532));
 let queued=0;for await(const q of checkpointAgentQueues(v.source)){if(q.type==='queued-agent'&&q.agentId===35)queued++;assert.notEqual(q.agentId,34);}
 assert.equal(queued,1);
 const f=await open(filename,'wx');let at=0;try{assert.equal(await hashCheckpointSource(v.source,async bytes=>{
  for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
 }),v.entry.world.sha256);await f.sync();}finally{await f.close();}
 selected={record:v.record,owner:v.owner,entry:v.entry};escaped=v.source;
});
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),Array(homeLeg?2:1).fill('Frontier_Hero_Route_1_0_0.GMP'));
await assert.rejects(escaped.readAt(0,16),/lease ended/);assert.equal(stats.peakReads,1);assert.ok(stats.largestRead<=4096);
const ids=Buffer.alloc(32);[0x314f4548,1,3550,4050,532,35,34,5].forEach((n,i)=>ids.writeUInt32LE(n,i*4));
const idsName=join(directory,'Halo_East_Owner.ids');await writeFile(idsName,ids,{flag:'wx'});
let homeLegIds=null;if(homeLeg){const b=Buffer.alloc(56);
 [0x314c4848,1,3550,13550,532,35,34,5,Math.floor(leg.localGoal.x/2048),Math.floor(leg.localGoal.y/2048),1,0,0,0]
  .forEach((n,i)=>b.writeUInt32LE(n,i*4));
 const filename=join(directory,'Halo_Home_Leg.ids');await writeFile(filename,b,{flag:'wx'});homeLegIds={filename,...await hashNativeFile(filename)};}
const sourceSha256={};for(const n of ['scripts/prepare-native-halo-east-owner.mjs','scripts/lib/native-generation.mjs','scripts/lib/stopped-entity-io.mjs',
 'scripts/lib/stopped-hero-route-io.mjs','web/world/hero-route-store.mjs','web/world/checkpoint-lease.mjs','web/world/entity-ownership.mjs',
 'web/world/entity-home-ownership.mjs','web/world/checkpoint.mjs','web/world/saved-clock.mjs','web/world/transfer-store.mjs',
 'web/world/halo-home-leg.mjs','web/world/halo-region-layout.mjs','web/world/actor-coordinates.mjs','web/world/region.mjs',
 'web/world/hero-home.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,selectedHaloEastOwnerPrepared:true,publicationArchive:{filename:resolve(archiveName),sha256:await hash(archiveName)},
 publicationProof:{filename:proofRow.preserved,sha256:proofRow.sha256},build:{filename:resolve(buildName),sha256:await hash(buildName)},
 compiledSourceSha256:compiled,identity:proof.identity,selected,ownerManifest:proof.selectedManifest,selectedRevision:5,
 journal:proof.journal,journalSha256:proof.journalSha256,world:{filename,...await hashNativeFile(filename)},
 reloadIds:{filename:idsName,...await hashNativeFile(idsName)},settings:base.settings,settingsProducerExecutableSha256:base.settingsProducerExecutableSha256,
 sourceSha256,stats,ownerExportDormantWorldsOpened:0,ownerReaderRevoked:true,startClock:3550,endClock:4050,
 selectedHaloHomeLegPrepared:homeLeg,selectedHaloHomeLegRetirementPrepared:retiring,homeLegArchive,homeLeg:leg,homeLegIds,
 nativeProcessesStarted:0,browserUsed:false,ownerPublished:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({selectedHaloEastOwnerPrepared:true,selectedRevision:5,region:'1_0',ownerExportDormantWorldsOpened:0,ownerReaderRevoked:true}));
