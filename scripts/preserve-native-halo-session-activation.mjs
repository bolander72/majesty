#!/usr/bin/env node
// Freeze independently qualified live activation before custody can change.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open} from 'node:fs/promises';
import {resolve,dirname,relative,join,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [proofName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,4);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-halo-session-activation-generation-\d{3}$/);
await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const proof=await json(proofName);assert.equal(proof.nativeRunningActorActivationQualified,true);
assert.equal(proof.completeActivationRootsQualified,true);assert.equal(proof.originalTicks,70);
assert.equal(proof.expiredEffectsAbsent,true);assert.equal(proof.ownerPublished,false);
assert.equal(await hash(proof.manifest),proof.manifestSha256);
const trial=await json(proof.manifest),prep=await json(trial.preparation);
assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);
try{process.kill(trial.nativePid,0);throw Error('Activation producer is live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(await hash(trial.privateNativeExecutable),trial.nativeExecutableSha256);
assert.equal(await hash(trial.preparation),trial.preparationSha256);
assert.equal(await hash(trial.buildReport),trial.buildReportSha256);
const build=await json(trial.buildReport);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
assert.equal(build.nativeExecutableSha256,trial.nativeExecutableSha256);
const generation=Number(basename(trial.buildReport).match(/^native-world-residency-build-(\d{3})\.json$/)?.[1]);
assert.equal(basename(directory),`native-halo-session-activation-generation-${String(generation).padStart(3,'0')}`);
assert.equal(await hash(proof.arrivalProof.filename),proof.arrivalProof.sha256);
const arrival=await json(proof.arrivalProof.filename);assert.equal(arrival.nativeRunningActorArrivalQualified,true);
assert.equal(arrival.manifestSha256,proof.manifestSha256);
assert.equal(await hash(arrival.proxyProof.filename),arrival.proxyProof.sha256);
const proxy=await json(arrival.proxyProof.filename);assert.equal(proxy.nativeRunningSourceRetirementQualified,true);
assert.equal(proxy.manifestSha256,proof.manifestSha256);assert.equal(proxy.sourceUnloaded,true);
const sources=new Set(['scripts/preserve-native-halo-session-activation.mjs',...Object.keys(trial.compiledSourceSha256),
 ...Object.keys(proof.sourceSha256),...Object.keys(prep.sourceSha256),
 'scripts/run-native-halo-session.py','scripts/run-native-regional-home.py','scripts/lib/native_pair_guard.py']);
for(const[n,h]of Object.entries({...trial.compiledSourceSha256,...proof.sourceSha256,...prep.sourceSha256}))assert.equal(await hash(n),h);
const evidence=new Set([resolve(proofName),proof.arrivalProof.filename,arrival.proxyProof.filename,proof.manifest,
 trial.preparation,trial.buildReport,trial.log,trial.script]);
const rows=[...prep.worlds,...trial.files,...trial.frames,trial.actorIds];
for(const name of ['actorHeldRequest','actorRetirementRequest','actorPagingRequest','homeProxyRequest',
 'destinationEpochRequest','actorArrivalRequest','actorActivationRequest']){
 const request=trial[name];assert.ok(request);
 for(const r of Object.values(request))if(r&&typeof r==='object'&&r.filename&&r.sha256)rows.push(r);
}
const arrivalPreparation=await json(trial.actorArrivalRequest.preparation.filename);
rows.push(arrivalPreparation.proof,...Object.values(arrivalPreparation.records),arrivalPreparation.pack);
for(const r of rows){assert.equal(await hash(r.filename),r.sha256);evidence.add(r.filename);}
for(const r of prep.settings){assert.equal(await hash(r.preserved),r.sha256);evidence.add(r.preserved);}
for(const[n,h]of Object.entries(prep.journalSha256)){const f=join(prep.journal,n);assert.equal(await hash(f),h);evidence.add(f);}
assert.equal(await readFile(join(prep.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),prep.selectedManifest);
await mkdir(directory);
async function copy(filename,kind){filename=resolve(filename);const rel=relative(workspace,filename);
 assert.ok(!rel.startsWith('..')&&!rel.startsWith('/'));
 const preserved=join(directory,kind,rel);await mkdir(dirname(preserved),{recursive:true});
 const f=await open(preserved,'wx');let at=0;
 try{const r=await hashNativeFile(filename,{maximum:4*1024*1024,sink:async bytes=>{
  for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
 }});await f.sync();assert.equal(await hash(preserved),r.sha256);return {original:filename,preserved,...r};}
 finally{await f.close();}}
const sourceRows=[],evidenceRows=[];
for(const f of [...sources].sort())sourceRows.push(await copy(f,'sources'));
for(const f of [...evidence].sort())evidenceRows.push(await copy(f,'evidence'));
const manifest={version:1,generation,nativeRunningActorActivationQualified:true,completeActivationRootsQualified:true,
 sources:sourceRows,evidence:evidenceRows,privateNativeExecutable:trial.privateNativeExecutable,nativeExecutableSha256:trial.nativeExecutableSha256,
 proof:{filename:resolve(proofName),sha256:await hash(proofName)},compiledInputs:54,originalTicks:70,
 previousPublicationArchive:prep.publicationArchive,destinationAliases:proof.destinationAliases,
 sourceClock:proxy.retirement.sourceClock,destinationClock:3550,sourceRetired:true,sourceUnloaded:true,destinationActivated:true,
 sourceAndJournalUnchanged:true,ownerPublished:false,browserUsed:false,goalComplete:false};
await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeRunningActorActivationQualified:true,generation,sources:sourceRows.length,evidence:evidenceRows.length}));
