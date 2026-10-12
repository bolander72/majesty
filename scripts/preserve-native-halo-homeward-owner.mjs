#!/usr/bin/env node
// Preserve the exact reload generation and selected journal for later revisits.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open} from 'node:fs/promises';
import {resolve,dirname,relative,join,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [proofName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,4);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-halo-homeward-owner-generation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const proof=await json(proofName);assert.equal(proof.nativeSelectedHaloHomewardOwnerQualified,true);
assert.equal(proof.exactLoadedRecords,504);assert.equal(proof.exactRecordComparisons,1512);assert.equal(proof.originalTicks,10);
assert.equal(proof.actorImported,false);assert.equal(proof.postloadReplayed,false);assert.equal(proof.queueInserted,false);
assert.equal(proof.actualJournalUnchanged,true);assert.equal(proof.ownerPublished,false);
assert.equal(await hash(proof.manifest),proof.manifestSha256);
const trial=await json(proof.manifest),prep=await json(trial.preparation);
assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);
try{process.kill(trial.nativePid,0);throw Error('Native producer is live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(await hash(trial.privateNativeExecutable),trial.nativeExecutableSha256);
for(const[n,h]of [[trial.preparation,trial.preparationSha256],[trial.buildReport,trial.buildReportSha256],
 [prep.publicationProof.filename,prep.publicationProof.sha256],[prep.nativeArchive.filename,prep.nativeArchive.sha256],
 ['scripts/run-native-halo-homeward-owner.py',trial.runnerSha256],['scripts/run-native-regional-home.py',trial.supervisorSha256],
 ['scripts/lib/native_pair_guard.py',trial.guardSha256]])assert.equal(await hash(n),h);
const publication=await json(prep.publicationProof.filename),previous=await json(prep.nativeArchive.filename);
assert.equal(publication.journalOriginalHaloHomewardPublished,true);assert.equal(publication.selectedRevision,6);
for(const r of previous.sources.concat(previous.evidence))assert.equal(await hash(r.preserved),r.sha256);
const build=await json(trial.buildReport);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
const generation=Number(basename(trial.buildReport).match(/^native-world-residency-build-(\d{3})\.json$/)?.[1]);
assert.equal(basename(directory),`native-halo-homeward-owner-generation-${generation}`);
const sourceHashes={};for(const group of [trial.compiledSourceSha256,proof.sourceSha256,prep.sourceSha256,publication.sourceSha256])
 for(const[n,h]of Object.entries(group)){if(sourceHashes[n])assert.equal(sourceHashes[n],h);sourceHashes[n]=h;assert.equal(await hash(n),h);}
const sources=new Set(['scripts/preserve-native-halo-homeward-owner.mjs',...Object.keys(sourceHashes),
 'scripts/run-native-halo-homeward-owner.py','scripts/run-native-regional-home.py','scripts/lib/native_pair_guard.py']);
const evidence=new Set([resolve(proofName),proof.manifest,trial.preparation,trial.buildReport,trial.log,trial.script,
 prep.publicationProof.filename,prep.nativeArchive.filename]);
for(const r of [...proof.wholeWorlds,...trial.frames,trial.sourceCheckpoint,trial.layoutMetadata,trial.reloadIds]){
 assert.equal(await hash(r.filename),r.sha256);evidence.add(r.filename);}
for(const r of prep.settings){assert.equal(await hash(r.preserved),r.sha256);evidence.add(r.preserved);}
for(const[n,h]of Object.entries(prep.journalSha256)){const f=join(prep.journal,n);assert.equal(await hash(f),h);evidence.add(f);}
assert.equal(await readFile(join(prep.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),prep.ownerManifest);
await mkdir(directory);
async function copy(filename,kind){filename=resolve(filename);const rel=relative(workspace,filename);assert.ok(!rel.startsWith('..')&&!rel.startsWith('/'));
 const preserved=join(directory,kind,rel);await mkdir(dirname(preserved),{recursive:true});const f=await open(preserved,'wx');let at=0;
 try{const r=await hashNativeFile(filename,{maximum:4*1024*1024,sink:async bytes=>{
  for(let i=0;i<bytes.length;){const{bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
 }});await f.sync();assert.equal(await hash(preserved),r.sha256);return{original:filename,preserved,...r};}finally{await f.close();}}
const sourceRows=[],evidenceRows=[];for(const n of [...sources].sort())sourceRows.push(await copy(n,'sources'));
for(const n of [...evidence].sort())evidenceRows.push(await copy(n,'evidence'));
await writeFile(join(directory,'manifest.json'),JSON.stringify({version:1,generation,nativeSelectedHaloHomewardOwnerQualified:true,
 sources:sourceRows,evidence:evidenceRows,proof:{filename:resolve(proofName),sha256:await hash(proofName)},
 privateNativeExecutable:trial.privateNativeExecutable,nativeExecutableSha256:trial.nativeExecutableSha256,
 previousActivationArchive:prep.nativeArchive,publicationProof:prep.publicationProof,selectedRevision:6,compiledInputs:54,
 actualNativeUnitId:508,actualAgentId:25,startClock:94550,endClock:95050,originalTicks:10,exactLoadedRecords:504,exactRecordComparisons:1512,
 actorImported:false,postloadReplayed:false,queueInserted:false,originalCommandsRestored:true,
 reciprocalGuildMembershipQualified:true,enteredGuild:proof.enteredGuild,journalUnchanged:true,ownerPublished:false,browserUsed:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSelectedHaloHomewardOwnerQualified:true,generation,sources:sourceRows.length,evidence:evidenceRows.length}));
