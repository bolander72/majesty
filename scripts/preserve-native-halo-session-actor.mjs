#!/usr/bin/env node
// Freeze the selected-hero boundary evidence before altering its running adapter.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open} from 'node:fs/promises';
import {resolve,dirname,relative,join,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const[proofName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,4);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-halo-session-(actor-crossing|retirement|actor-paging|proxy)-generation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const proof=await json(proofName);assert.equal(proof.nativeSelectedHeroCoreCrossingQualified,true);assert.equal(proof.completeHeldWorldQualified,true);
const crossing=proof.crossing??proof,retirement=proof.nativeRunningSourceRetirementQualified===true,paging=proof.nativeRunningActorPagingQualified===true,proxy=proof.nativeRunningDestinationProxyQualified===true;
assert.equal(basename(directory).startsWith('native-halo-session-retirement-'),retirement&&!paging);
assert.equal(basename(directory).startsWith('native-halo-session-actor-paging-'),paging&&!proxy);
assert.equal(basename(directory).startsWith('native-halo-session-proxy-'),proxy);
assert.equal(await hash(proof.manifest),proof.manifestSha256);const trial=await json(proof.manifest),prep=await json(trial.preparation);
assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);
try{process.kill(trial.nativePid,0);throw Error('Actor producer still live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(await hash(trial.privateNativeExecutable),trial.nativeExecutableSha256);assert.equal(await hash(trial.preparation),trial.preparationSha256);
assert.equal(await hash(trial.buildReport),trial.buildReportSha256);
const sources=new Set(['scripts/preserve-native-halo-session-actor.mjs',...Object.keys(trial.compiledSourceSha256),...Object.keys(proof.sourceSha256),...Object.keys(prep.sourceSha256),
 'scripts/run-native-halo-session.py','scripts/run-native-regional-home.py','scripts/lib/native_pair_guard.py']);
for(const[n,h]of Object.entries({...trial.compiledSourceSha256,...proof.sourceSha256,...prep.sourceSha256}))assert.equal(await hash(n),h);
const evidence=new Set([resolve(proofName),proof.manifest,trial.preparation,trial.buildReport,trial.log,trial.script]);
for(const r of [...prep.worlds,...trial.files,...trial.frames,trial.actorIds,trial.actorHeldRequest.crossed,trial.actorHeldRequest.packet]){
 assert.equal(await hash(r.filename),r.sha256);evidence.add(r.filename);}
if(retirement){assert.equal(trial.haloSessionActorRetirementTrialCompleted,true);assert.equal(proof.sourceRetired,true);
 for(const k of ['preparation','ids','packet']){const r=trial.actorRetirementRequest[k];assert.equal(await hash(r.filename),r.sha256);evidence.add(r.filename);}}
if(paging){assert.equal(trial.haloSessionActorPagingTrialCompleted,true);assert.equal(proof.sourceUnloaded,true);assert.equal(proof.destinationAttached,true);
 const r=trial.actorPagingRequest.packet;assert.equal(await hash(r.filename),r.sha256);evidence.add(r.filename);}
if(proxy){assert.equal(trial.haloSessionHomeProxyTrialCompleted,true);
 for(const k of ['preparation','proposal','packet']){const r=trial.homeProxyRequest[k];assert.equal(await hash(r.filename),r.sha256);evidence.add(r.filename);}}
if(proof.destinationEpochQualified){assert.equal(trial.haloSessionDestinationEpochTrialCompleted,true);
 for(const k of ['held','packet']){const r=trial.destinationEpochRequest[k];assert.equal(await hash(r.filename),r.sha256);evidence.add(r.filename);}}
for(const r of prep.settings){assert.equal(await hash(r.preserved),r.sha256);evidence.add(r.preserved);}
for(const[n,h]of Object.entries(prep.journalSha256)){const f=join(prep.journal,n);assert.equal(await hash(f),h);evidence.add(f);}
assert.equal(await readFile(join(prep.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),prep.selectedManifest);
await mkdir(directory);
async function copy(filename,kind){filename=resolve(filename);const rel=relative(workspace,filename);assert.ok(!rel.startsWith('..')&&!rel.startsWith('/'));
 const preserved=join(directory,kind,rel);await mkdir(dirname(preserved),{recursive:true});const f=await open(preserved,'wx');let at=0;
 try{const r=await hashNativeFile(filename,{maximum:4*1024*1024,sink:async bytes=>{
  for(let i=0;i<bytes.length;){const{bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
 }});await f.sync();assert.equal(await hash(preserved),r.sha256);return{original:filename,preserved,...r};}finally{await f.close();}}
const sourceRows=[],evidenceRows=[];for(const f of [...sources].sort())sourceRows.push(await copy(f,'sources'));
for(const f of [...evidence].sort())evidenceRows.push(await copy(f,'evidence'));
const manifest={version:1,nativeSelectedHeroCoreCrossingQualified:true,completeHeldWorldQualified:true,sources:sourceRows,evidence:evidenceRows,
 privateNativeExecutable:trial.privateNativeExecutable,nativeExecutableSha256:trial.nativeExecutableSha256,compiledInputs:54,
 previousPublicationArchive:prep.publicationArchive,selectedOwner:crossing.selectedOwner,handoff:crossing.handoff,
 exactRecordComparisons:crossing.exactRecordComparisons,sharedVertexComparisons:crossing.sharedVertexComparisons,
 nativeRunningSourceRetirementQualified:retirement,unrelatedRecordComparisons:proof.unrelatedRecordComparisons??null,removedRecords:proof.removedRecords??[],
 nativeSessionTerminal:true,nativeExitCode:0,originalActorAiPreserved:true,actualJournalUnchanged:true,
 destinationEpochQualified:proof.destinationEpochQualified??false,destinationClock:proof.destinationClock??0,
 nativeRunningDestinationProxyQualified:proxy,proxyAgentId:proof.proxyAgentId??null,proxyUnrelatedRecordComparisons:proof.proxyUnrelatedRecordComparisons??null,
 nativeRunningActorPagingQualified:paging,sourceUnloaded:paging,destinationAttached:paging,destinationActorImported:false,
 destinationActivated:false,sourceRetired:retirement,ownerPublished:false,browserUsed:false,goalComplete:false};
await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSelectedHeroCoreCrossingQualified:true,sources:sourceRows.length,evidence:evidenceRows.length}));
