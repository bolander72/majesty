#!/usr/bin/env node
// Preserve original saved-region activation and the observed guild-return leg.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open} from 'node:fs/promises';
import {resolve,dirname,relative,join} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [activationName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.equal(directoryName,'output/native-halo-saved-activation-generation-291');await assert.rejects(lstat(directoryName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const activation=await json(activationName);assert.equal(activation.nativeSavedNeighborActorActivationQualified,true);assert.equal(activation.nativeSavedNeighborHomeLegQualified,true);assert.equal(activation.exactActivationRecords,483);assert.equal(activation.exactRouteRecords,482);
const proofName=activation.arrivalProof.filename;assert.equal(await hash(proofName),activation.arrivalProof.sha256);const proof=await json(proofName);
const producerTrial=await json(proof.manifest),capsuleName=producerTrial.savedActorArrivalRequest.preparation.filename,capsule=await json(capsuleName),route=await json(producerTrial.savedActorActivationRequest.preparation.filename);
assert.equal(proof.nativeSavedNeighborActorArrivalQualified,true);assert.equal(proof.exactImportedRecordComparisons,4);assert.equal(proof.unrelatedRecordComparisons,479);assert.equal(proof.paging.exactCheckpointRecordComparisons,1463);
assert.equal(proof.destinationActorImported,true);assert.equal(proof.destinationClock,3750);assert.equal(proof.ownerPublished,false);
assert.equal(capsule.savedNeighborArrivalCapsulePrepared,true);assert.equal(capsule.totalRecordBytes,2760);assert.equal(capsule.heroImported,false);
assert.equal(capsule.livePreparation,true);assert.equal(proof.preparation.filename,resolve(capsuleName));assert.equal(proof.preparation.sha256,await hash(capsuleName));assert.equal(await hash(capsule.proof.filename),capsule.proof.sha256);
assert.equal(await hash(proof.manifest),proof.manifestSha256);const trial=await json(proof.manifest),prep=await json(trial.preparation);
assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);
try{process.kill(trial.nativePid,0);throw Error('Saved-neighbor producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(await hash(trial.privateNativeExecutable),trial.nativeExecutableSha256);
assert.equal(await hash(trial.preparation),trial.preparationSha256);assert.equal(await hash(trial.buildReport),trial.buildReportSha256);
const sources=new Set(['scripts/preserve-native-halo-saved-activation.mjs','scripts/run-native-halo-session.py',
 'tests/halo-home-route.test.mjs','scripts/inspect-native-halo-saved-activation.mjs','scripts/run-native-regional-home.py','scripts/lib/native_pair_guard.py','scripts/inspect-native-halo-saved-arrival.mjs','scripts/inspect-native-halo-saved-actor-paging.mjs','tests/registered-hero-arrival.test.mjs','tests/fixtures/registered-hero-world.mjs']);
for(const map of [trial.compiledSourceSha256,prep.sourceSha256,proof.sourceSha256,capsule.sourceSha256,activation.sourceSha256,route.sourceSha256])
 for(const[n,h]of Object.entries(map)){assert.equal(await hash(n),h);sources.add(n);}
const evidence=new Set([resolve(activationName),resolve(proofName),resolve(capsuleName),proof.manifest,trial.preparation,trial.buildReport,trial.log,trial.script,
 resolve('output/native-halo-saved-activation-focused-tests-001.log'),capsule.proof.filename,capsule.pack.filename,route.producer.filename,route.packet.filename,producerTrial.savedActorActivationRequest.preparation.filename]);
const request=trial.actorRetirementRequest;
for(const row of [prep.publicationArchive,prep.publicationProof,...prep.worlds,...trial.files,...trial.frames,
 trial.actorIds,trial.savedActorIds,trial.actorHeldRequest.crossed,trial.actorHeldRequest.packet,
 request.preparation,request.ids,request.packet,trial.actorPagingRequest.retired,trial.actorPagingRequest.packet,
 capsule.sourceWorld,capsule.destinationWorld,...Object.values(capsule.records),trial.savedArrivalGate,
 trial.savedActorArrivalRequest.preparation,trial.savedActorArrivalRequest.pack,trial.savedActorArrivalRequest.packet,
 trial.savedActorActivationRequest.preparation,trial.savedActorActivationRequest.packet,trial.savedActivationGate]){
 assert.equal(await hash(row.filename),row.sha256);evidence.add(row.filename);
}
for(const row of prep.settings){assert.equal(await hash(row.preserved),row.sha256);evidence.add(row.preserved);}
for(const[n,h]of Object.entries(prep.journalSha256)){const name=join(prep.journal,n);assert.equal(await hash(name),h);evidence.add(name);}
assert.equal(await readFile(join(prep.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),prep.selectedManifest);
const owner=await json(prep.publicationArchive.filename);assert.equal(owner.nativeSelectedHaloHomewardOwnerQualified,true);
for(const row of owner.sources.concat(owner.evidence))assert.equal(await hash(row.preserved),row.sha256);
const gate=await json(trial.savedArrivalGate.filename);assert.equal(gate.generation,288);
for(const row of gate.sources.concat(gate.evidence))assert.equal(await hash(row.preserved),row.sha256);
const priorImport=await json(trial.savedActivationGate.filename);assert.equal(priorImport.generation,290);
for(const row of priorImport.sources.concat(priorImport.evidence))assert.equal(await hash(row.preserved),row.sha256);
const tests=await readFile('output/native-halo-saved-activation-focused-tests-001.log','utf8');assert.match(tests,/tests 119/);assert.match(tests,/pass 119/);assert.match(tests,/fail 0/);
await mkdir(directoryName);
async function copy(filename,kind){filename=resolve(filename);const rel=relative(workspace,filename);assert.ok(!rel.startsWith('..')&&!rel.startsWith('/'));
 const preserved=resolve(directoryName,kind,rel);await mkdir(dirname(preserved),{recursive:true});const f=await open(preserved,'wx');let at=0;
 try{const row=await hashNativeFile(filename,{maximum:4*1024*1024,sink:async bytes=>{
  for(let i=0;i<bytes.length;){const{bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
 }});await f.sync();assert.equal(await hash(preserved),row.sha256);return{original:filename,preserved,...row};}finally{await f.close();}}
const sourceRows=[],evidenceRows=[];for(const n of [...sources].sort())sourceRows.push(await copy(n,'sources'));
for(const n of [...evidence].sort())evidenceRows.push(await copy(n,'evidence'));
const manifest={version:1,generation:291,nativeSavedNeighborActorActivationQualified:true,nativeSavedNeighborHomeLegQualified:true,nativeSavedNeighborActorArrivalQualified:true,nativeSavedActorDestinationPagingQualified:true,savedNeighborArrivalCapsulePrepared:true,
 activationProof:{filename:resolve(activationName),sha256:await hash(activationName)},proof:{filename:resolve(proofName),sha256:await hash(proofName)},capsule:{filename:resolve(capsuleName),sha256:await hash(capsuleName)},
 sources:sourceRows,evidence:evidenceRows,privateNativeExecutable:trial.privateNativeExecutable,nativeExecutableSha256:trial.nativeExecutableSha256,
 compiledInputs:54,previousPublicationArchive:prep.publicationArchive,previousSavedPagingArchive:trial.savedArrivalGate,previousSavedImportArchive:trial.savedActivationGate,selectedRevision:6,route:['0_0','1_0'],originalDisposals:1,freedRootsPerDisposal:8,
 destinationClock:3750,crossingClock:activation.crossingClock,existingHomeProxy:34,exactActivationRecords:483,exactRouteRecords:482,acceptedCrossing:activation.acceptedCrossing,counts:activation.counts,exactCheckpointRecordComparisons:1463,exactImportedRecordComparisons:4,unrelatedRecordComparisons:479,importedArrivalRecords:4,totalArrivalRecordBytes:2760,
 nativeSessionTerminal:true,nativeExitCode:0,ownedProducerAbsent:true,sourceRetired:true,sourceUnloaded:true,destinationSimulationHeldAtImport:true,continuationHeldAtCrossing:true,
 originalMovementRequestQualified:true,automaticHeroDepartureQualified:false,destinationActorImported:true,destinationActivated:true,
 ownerPublished:false,browserUsed:false,sustainedBrowserMemoryQualified:false,goalComplete:false};
await writeFile(join(directoryName,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSavedNeighborActorActivationQualified:true,nativeSavedNeighborHomeLegQualified:true,generation:291,sources:sourceRows.length,evidence:evidenceRows.length}));
