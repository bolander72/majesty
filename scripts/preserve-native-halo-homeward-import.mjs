#!/usr/bin/env node
// Freeze the held import or independently qualified original AI continuation.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open} from 'node:fs/promises';
import {resolve,dirname,relative,join,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [proofName,directoryName,mode]=process.argv.slice(2);const activate=mode==='--activate';
assert.ok(process.argv.length===(activate?5:4));assert.ok(mode===undefined||activate);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),activate?/^native-halo-homeward-activation-generation-\d{3}$/:/^native-halo-homeward-import-generation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const activation=activate?await json(proofName):null;
if(activation){assert.equal(activation.nativeHaloHomewardActivationQualified,true);assert.equal(activation.homewardGameplayResumed,true);
 assert.equal(activation.exactActivationRecords,494);assert.equal(activation.completeActivationRootsQualified,true);assert.equal(activation.originalTicks,200);
 assert.equal(await hash(activation.importProof.filename),activation.importProof.sha256);assert.equal(activation.ownerPublished,false);}
const proof=await json(activate?activation.importProof.filename:proofName);assert.equal(proof.nativeHaloHomewardImportQualified,true);
assert.equal(proof.completeScriptRootsQualified,true);assert.equal(proof.savedRecordComparisons,4);
assert.equal(proof.unrelatedRecordComparisons,488);assert.equal(proof.cleanupRecordComparisons,activate?0:490);
assert.equal(proof.nativeActivationQualified,false);assert.equal(proof.ownerPublished,false);
assert.equal(await hash(proof.manifest),proof.manifestSha256);
const trial=await json(proof.manifest),prep=await json(trial.preparation),capsule=await json(prep.capsule.filename);
assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);
try{process.kill(trial.nativePid,0);throw Error('Original producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(await hash(trial.privateNativeExecutable),trial.nativeExecutableSha256);
for(const[n,h]of [[trial.preparation,trial.preparationSha256],[trial.buildReport,trial.buildReportSha256],[prep.capsule.filename,prep.capsule.sha256],
 ['scripts/run-native-halo-homeward-import.py',trial.runnerSha256],['scripts/run-native-regional-home.py',trial.supervisorSha256],
 ['scripts/lib/native_pair_guard.py',trial.guardSha256]])assert.equal(await hash(n),h);
const build=await json(trial.buildReport);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
const generation=Number(basename(trial.buildReport).match(/^native-world-residency-build-(\d{3})\.json$/)?.[1]);
assert.equal(basename(directory),`native-halo-homeward-${activate?'activation':'import'}-generation-${generation}`);
if(activation){assert.equal(activation.manifest,proof.manifest);assert.equal(activation.manifestSha256,proof.manifestSha256);
 assert.equal(trial.selectedHaloHomewardActivationTrialCompleted,true);}
const sourceHashes={};for(const rows of [trial.compiledSourceSha256,proof.sourceSha256,prep.sourceSha256,capsule.sourceSha256,activation?.sourceSha256??{}])
 for(const[n,h]of Object.entries(rows)){if(sourceHashes[n])assert.equal(sourceHashes[n],h);sourceHashes[n]=h;assert.equal(await hash(n),h);}
const sources=new Set(['scripts/preserve-native-halo-homeward-import.mjs',...Object.keys(sourceHashes),
 'scripts/run-native-halo-homeward-import.py','scripts/run-native-regional-home.py','scripts/lib/native_pair_guard.py']);
assert.equal(await hash(prep.archive.filename),prep.archive.sha256);const archive=await json(prep.archive.filename);
assert.equal(archive.nativeHomewardSourceRetirementQualified,true);
for(const row of archive.sources.concat(archive.evidence))assert.equal(await hash(row.preserved),row.sha256);
const evidence=new Set([resolve(proofName),proof.manifest,trial.preparation,trial.buildReport,trial.log,trial.script,
 prep.capsule.filename,prep.archive.filename,capsule.retirementProof.filename]);
if(activation){evidence.add(activation.importProof.filename);assert.equal(await hash(prep.activationGate.filename),prep.activationGate.sha256);evidence.add(prep.activationGate.filename);}
for(const row of [...proof.records,...proof.wholeWorlds,...(activate?trial.activationWorlds:[]),trial.loadedCheckpoint,...trial.frames,trial.sourceCheckpoint,trial.pack,trial.layoutMetadata,
 prep.homeWorld,prep.pack,...prep.records,capsule.sourceWorld,capsule.retiredWorld,capsule.orderPayload]){
 assert.equal(await hash(row.filename),row.sha256);evidence.add(row.filename);}
for(const row of prep.settings){assert.equal(await hash(row.preserved),row.sha256);evidence.add(row.preserved);}
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
await writeFile(join(directory,'manifest.json'),JSON.stringify({version:1,generation,nativeHaloHomewardImportQualified:true,
 sources:sourceRows,evidence:evidenceRows,proof:{filename:resolve(proofName),sha256:await hash(proofName)},
 privateNativeExecutable:trial.privateNativeExecutable,nativeExecutableSha256:trial.nativeExecutableSha256,
 compiledInputs:54,previousRetirementArchive:prep.archive,selectedRevision:5,sourceClock:3750,destinationClock:84550,
 actualNativeUnitId:proof.actualNativeUnitId,actualAgentId:proof.actualAgentId,standaloneRecordComparisons:4,savedRecordComparisons:4,
 unrelatedRecordComparisons:488,cleanupRecordComparisons:activate?0:490,completeScriptRootsQualified:true,reciprocalGuildMembershipQualified:true,
 nativeHaloHomewardActivationQualified:activate,exactActivationRecords:activate?494:0,originalTicks:activate?200:0,
 evolvedClock:activate?94550:null,enteredGuild:activate?activation.enteredGuild:false,
 sourceRetired:true,journalUnchanged:true,ownerPublished:false,nativeActivationQualified:activate,homewardGameplayResumed:activate,
 browserUsed:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeHaloHomewardImportQualified:true,generation,sources:sourceRows.length,evidence:evidenceRows.length}));
