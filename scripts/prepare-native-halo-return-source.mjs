#!/usr/bin/env node
// Bind original source retirement to the current owner and qualified home play.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointActorRecords,checkpointUnitAgentLinks,checkpointAttachments,checkpointIncomingAgentReferences,
 checkpointAgentValues,checkpointContainerEntries,checkpointAgentQueues} from '../web/world/checkpoint.mjs';
const[archiveName,buildName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,5);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-halo-return-source-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const archive=await json(archiveName);assert.equal(archive.generation,252);assert.equal(archive.nativeReturnedHeroContinuationQualified,true);
assert.equal(archive.waitDeadlinePreserved,true);assert.equal(archive.exactRecordComparisons,1482);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
function bound(original,digest){const rows=archive.evidence.filter(r=>r.original===resolve(original));assert.equal(rows.length,1);
 if(digest!==undefined)assert.equal(rows[0].sha256,digest);return rows[0];}
const proofRow=bound('output/native-halo-return-live-001-observed.json'),proof=await json(proofRow.preserved);
const trialRow=bound(proof.manifest,proof.manifestSha256),trial=await json(trialRow.preserved),baseRow=bound(trial.preparation,trial.preparationSha256),base=await json(baseRow.preserved);
assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);assert.equal(trial.stopReason,null);
try{process.kill(trial.nativePid,0);throw Error('Destination producer still live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(proof.endClock,63650);assert.equal(proof.sourceRetired,false);assert.equal(proof.ownerPublished,false);
const evolved=bound(trial.worlds[2].filename,trial.worlds[2].sha256);
const build=await json(buildName);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);const compiled={};
for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256'])
 for(const[n,h]of Object.entries(build[group])){assert.equal(compiled[n],undefined);compiled[n]=h;assert.equal(await hash(n),h);}
assert.equal(Object.keys(compiled).length,54);assert.equal(await hash('upstream/majesty-recomp/build/recomp/pop_smoke'),build.nativeExecutableSha256);
for(const[n,h]of Object.entries(base.journalSha256))assert.equal(await hash(join(base.journal,n)),h);
assert.equal(await readFile(join(base.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),base.ownerManifest);
for(const r of base.settings)assert.equal(await hash(r.preserved),r.sha256);
const stats={},io=await stoppedHeroRouteStorage(base.journal,stats),store=new HeroRouteStore(io,base.identity,base.identity.contentDigest);
const opened=[],originalOpen=io.open;io.open=async n=>{opened.push(n);return originalOpen(n);};
await mkdir(directory);const worldName=join(directory,'Northern_Source.GMP');let selected;
await store.withOwner(async value=>{
 assert.equal(value.record.manifest,base.ownerManifest);assert.equal(value.record.revision,2);assert.equal(value.owner.region,'0_-1');
 assert.deepEqual(value.entry.alias,{unitId:510,agentId:54});assert.deepEqual(value.entry.homeAlias,{kind:'proxy',unitId:0,agentId:53});
 assert.equal(await checkpointSavedClock(value.source),1500);
 const units=new Map();for await(const u of checkpointUnitAgentLinks(value.source))if([510,511,512,513,516].includes(u.unitId))units.set(u.unitId,u);
 assert.equal(units.has(512),false);assert.equal(units.size,4);assert.equal((await checkpointActorRecords(value.source,510)).agent.agentId,54);
 for(const id of [513,516]){assert.equal(units.get(id).parentUnitId,510);assert.equal(units.get(id).agentId,0);}
 const orders=[];for await(const r of checkpointAttachments(value.source))if(r.kind==='ORDR'&&[510,513,516].includes(r.unitId))orders.push(r.unitId);
 assert.deepEqual(orders.sort((a,b)=>a-b),[513,516]);
 const incoming=await checkpointIncomingAgentReferences(value.source,54);assert.ok(incoming.sites.length);
 for(const r of incoming.sites)assert.equal(r.agentId,54,'An unrelated script still refers to the retiring hero');
 const members=[];for await(const v of checkpointAgentValues(value.source,55))if(v.attribute.toLowerCase()==='heroes')members.push(v);
 assert.equal(members.length,1);assert.equal(members[0].childCount,0);
 const relationships=[];for await(const c of checkpointContainerEntries(value.source))if(c.type==='member'&&(c.unitId===510||c.targetUnitId===510))relationships.push([c.unitId,c.groupKind,c.targetUnitId]);
 assert.deepEqual(relationships,[[510,1,513],[510,1,516]]);
 let queued=0;for await(const q of checkpointAgentQueues(value.source))if(q.type==='queued-agent'&&q.agentId===54)queued++;
 assert.equal(queued,1);
 const f=await open(worldName,'wx');let at=0;try{assert.equal(await hashCheckpointSource(value.source,async bytes=>{
  for(let i=0;i<bytes.length;){const{bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
 }),value.entry.world.sha256);await f.sync();}finally{await f.close();}
 selected={record:value.record,owner:value.owner,entry:value.entry};
});
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_0_-1_1.GMP']);assert.equal(stats.peakReads,1);assert.ok(stats.largestRead<=4096);
const idsName=join(directory,'Halo_Return_Source.ids'),ids=Buffer.alloc(36);
[0x31535248,1500,510,54,513,516,511,55,53].forEach((v,i)=>ids.writeUInt32LE(v,i*4));await writeFile(idsName,ids,{flag:'wx'});
const sourceSha256={};for(const n of ['scripts/prepare-native-halo-return-source.mjs','scripts/lib/native-generation.mjs','scripts/lib/stopped-entity-io.mjs',
 'scripts/lib/stopped-hero-route-io.mjs','web/world/hero-route-store.mjs','web/world/entity-ownership.mjs','web/world/entity-home-ownership.mjs',
 'web/world/checkpoint.mjs','web/world/saved-clock.mjs','web/world/transfer-store.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,selectedHaloReturnSourcePrepared:true,nativeReaderReady:true,
 liveArchive:{filename:resolve(archiveName),sha256:await hash(archiveName)},liveProof:{filename:proofRow.preserved,sha256:proofRow.sha256},
 qualifiedDestination:{filename:evolved.preserved,bytes:evolved.bytes,sha256:evolved.sha256},
 build:{filename:resolve(buildName),sha256:await hash(buildName)},compiledSourceSha256:compiled,
 world:{filename:worldName,...await hashNativeFile(worldName)},reloadIds:{filename:idsName,...await hashNativeFile(idsName)},
 settings:base.settings,settingsProducerExecutableSha256:trial.nativeExecutableSha256,identity:base.identity,selected,
 journal:base.journal,journalSha256:base.journalSha256,ownerManifest:base.ownerManifest,sourceSha256,
 sourceClock:1500,actualNativeUnitIds:[510,513,516],actualAgentId:54,dormantWorldsOpened:0,stats,
 sourceRetired:false,ownerPublished:false,nativeProcessesStarted:0,browserUsed:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({selectedHaloReturnSourcePrepared:true,sourceClock:1500,destinationClock:63650,dormantWorldsOpened:0}));
