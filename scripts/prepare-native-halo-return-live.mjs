#!/usr/bin/env node
// Export the qualified home import unchanged for a fresh original-engine load.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointActorRecords,checkpointUnitAgentLinks,checkpointAttachments,checkpointContainerEntries,checkpointAgentValues,checkpointAgentQueues} from '../web/world/checkpoint.mjs';
const[archiveName,buildName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,5);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-halo-return-live-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const archive=await json(archiveName);assert.equal(archive.generation,249);assert.equal(archive.nativeHaloReturnImportQualified,true);
assert.equal(archive.originalCleanupQualified,true);assert.equal(archive.savedRecordComparisons,7);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
function bound(original,digest){const rows=archive.evidence.filter(r=>r.original===resolve(original));assert.equal(rows.length,1);
 if(digest!==undefined)assert.equal(rows[0].sha256,digest);return rows[0];}
const proofRow=bound('output/native-halo-return-import-001-observed.json'),proof=await json(proofRow.preserved);
const trialRow=bound(proof.manifest,proof.manifestSha256),trial=await json(trialRow.preserved),prepRow=bound(trial.preparation,trial.preparationSha256),cold=await json(prepRow.preserved);
assert.equal(proof.nativeHaloReturnImportQualified,true);assert.equal(proof.nativeActivationQualified,false);assert.equal(proof.ownerPublished,false);
assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);assert.equal(trial.stopReason,null);
try{process.kill(trial.nativePid,0);throw Error('Cold producer still live');}catch(e){if(e.code!=='ESRCH')throw e;}
const imported=trial.worlds[1];assert.equal(basename(imported.filename),'Halo_Return_Imported.GMP');const sourceRow=bound(imported.filename,imported.sha256);
const source=await stoppedFileSource(sourceRow.preserved);assert.equal(await checkpointSavedClock(source),60650);
const[hero,effect1,effect2]=proof.actualNativeUnitIds,agent=proof.actualAgentId;
assert.deepEqual([hero,effect1,effect2,agent],[496,497,498,22]);
const units=new Map();for await(const u of checkpointUnitAgentLinks(source))if([hero,effect1,effect2].includes(u.unitId))units.set(u.unitId,u);
assert.equal(units.size,3);
for(const[id,description,flags,parent]of [[hero,0x314c5641,512,0],[effect1,0x34475241,544,hero],[effect2,0x32425241,2592,hero]]){
 const u=units.get(id);assert.equal(u.description,description);assert.equal(u.stateFlags,flags);assert.equal(u.parentUnitId,parent);
 if(id===hero)assert.equal((await checkpointActorRecords(source,id)).agent.agentId,agent);else assert.equal(u.agentId,0);
}
const orders=[];for await(const r of checkpointAttachments(source))if(r.kind==='ORDR'&&[hero,effect1,effect2].includes(r.unitId))orders.push(r.unitId);
assert.deepEqual(orders.sort((a,b)=>a-b),[effect1,effect2]);
const members=[];for await(const v of checkpointAgentValues(source,7))if(v.attribute==='members')members.push(v);
assert.equal(members.find(v=>!v.path.length).childCount,1);assert.equal(members.find(v=>v.path.length).targetAgentId,agent);
for await(const q of checkpointAgentQueues(source))if(q.type==='queued-agent')assert.notEqual(q.agentId,agent);
const relationships=[];for await(const c of checkpointContainerEntries(source))if(c.type==='member')relationships.push([c.unitId,c.groupKind,c.targetUnitId]);
for(const row of [[469,100,hero],[hero,101,469],[hero,1,effect1],[hero,1,effect2]])assert.ok(relationships.some(r=>JSON.stringify(r)===JSON.stringify(row)));
const build=await json(buildName);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);const compiled={};
for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256'])
 for(const[n,h]of Object.entries(build[group])){assert.equal(compiled[n],undefined);compiled[n]=h;assert.equal(await hash(n),h);}
assert.equal(Object.keys(compiled).length,54);assert.equal(await hash('upstream/majesty-recomp/build/recomp/pop_smoke'),build.nativeExecutableSha256);
for(const[n,h]of Object.entries(cold.journalSha256))assert.equal(await hash(join(cold.journal,n)),h);
assert.equal(await readFile(join(cold.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),cold.ownerManifest);
for(const r of cold.settings)assert.equal(await hash(r.preserved),r.sha256);
await mkdir(directory);const worldName=join(directory,'Imported_Home.GMP'),f=await open(worldName,'wx');let at=0;
try{assert.equal((await hashNativeFile(sourceRow.preserved,{sink:async bytes=>{
 for(let i=0;i<bytes.length;){const{bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
}})).sha256,sourceRow.sha256);await f.sync();}finally{await f.close();}
const idsName=join(directory,'Halo_Return_Live.ids'),ids=Buffer.alloc(28);
[0x314c5248,60650,63650,hero,agent,effect1,effect2].forEach((v,i)=>ids.writeUInt32LE(v,4*i));await writeFile(idsName,ids,{flag:'wx'});
const sourceSha256={};for(const n of ['scripts/prepare-native-halo-return-live.mjs','scripts/lib/native-generation.mjs','scripts/lib/stopped-entity-io.mjs',
 'web/world/checkpoint.mjs','web/world/saved-clock.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,selectedHaloReturnLivePrepared:true,nativeReaderReady:true,coldArchive:{filename:resolve(archiveName),sha256:await hash(archiveName)},
 coldProof:{filename:proofRow.preserved,sha256:proofRow.sha256},build:{filename:resolve(buildName),sha256:await hash(buildName)},compiledSourceSha256:compiled,
 world:{filename:worldName,...await hashNativeFile(worldName)},reloadIds:{filename:idsName,...await hashNativeFile(idsName)},
 settings:cold.settings,settingsProducerExecutableSha256:trial.nativeExecutableSha256,identity:cold.identity,
 journal:cold.journal,journalSha256:cold.journalSha256,ownerManifest:cold.ownerManifest,sourceSha256,
 actualNativeUnitIds:[hero,effect1,effect2],actualAgentId:agent,startClock:60650,endClock:63650,
 sourceRetired:false,ownerPublished:false,nativeProcessesStarted:0,browserUsed:false,nativeActivationQualified:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({selectedHaloReturnLivePrepared:true,startClock:60650,endClock:63650,importedAgain:false}));
