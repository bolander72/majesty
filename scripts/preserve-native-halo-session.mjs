#!/usr/bin/env node
// Freeze successful session code, qualification and private worlds before further changes.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open} from 'node:fs/promises';
import {resolve,dirname,relative,join} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [proofName,directoryName,mode]=process.argv.slice(2);const pointer=mode==='--pointer-paging',homeward=pointer||mode==='--homeward-paging';
assert.equal(process.argv.length,homeward?5:4);assert.ok(mode===undefined||homeward);
assert.equal(directoryName,pointer?'output/native-halo-pointer-session-generation-286':homeward?'output/native-halo-homeward-session-generation-286':'output/native-halo-session-generation-258');await assert.rejects(lstat(directoryName),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const proof=await json(proofName);assert.equal(pointer?proof.nativePointerDrivenRegionPagingQualified:homeward?proof.nativeHomewardRegionPagingQualified:proof.nativeHaloSessionQualified,true);
assert.equal(proof.exactRecordComparisons,pointer?1487:homeward?2469:1922);
assert.equal(proof.visits,pointer?3:5);assert.equal(proof.originalDisposals,pointer?2:4);assert.equal(await hash(proof.manifest),proof.manifestSha256);
if(pointer){assert.equal(proof.pointerEvidence.productionSessionControlsUsed,true);assert.equal(proof.pointerEvidence.originalOppositeEdgeArrivalQualified,true);}
const trial=await json(proof.manifest),prep=await json(trial.preparation);
assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);
try{process.kill(trial.nativePid,0);throw Error('Session producer still live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(await hash(trial.privateNativeExecutable),trial.nativeExecutableSha256);
assert.equal(await hash(trial.preparation),trial.preparationSha256);assert.equal(await hash(trial.buildReport),trial.buildReportSha256);
const sources=new Set(['scripts/preserve-native-halo-session.mjs',...Object.keys(trial.compiledSourceSha256),...Object.keys(proof.sourceSha256),...Object.keys(prep.sourceSha256),
 'scripts/run-native-halo-session.py','scripts/run-native-regional-home.py','scripts/lib/native_pair_guard.py']);
for(const[n,h]of Object.entries({...trial.compiledSourceSha256,...proof.sourceSha256,...prep.sourceSha256}))assert.equal(await hash(n),h);
const evidence=new Set([resolve(proofName),proof.manifest,trial.preparation,trial.buildReport,trial.log,trial.script,
 resolve(pointer?'output/native-halo-pointer-session-tests-001.log':homeward?'output/native-halo-homeward-session-tests-001.log':'output/native-halo-session-focused-tests-001.log')]);
if(homeward){assert.equal(pointer?trial.haloPointerSessionTrialCompleted:trial.haloHomewardSessionTrialCompleted,true);assert.equal(prep.selectedRevision,6);
 for(const r of [prep.publicationArchive,prep.publicationProof]){assert.equal(await hash(r.filename),r.sha256);evidence.add(r.filename);}
 const previous=await json(prep.publicationArchive.filename);assert.equal(previous.nativeSelectedHaloHomewardOwnerQualified,true);
 for(const r of previous.sources.concat(previous.evidence))assert.equal(await hash(r.preserved),r.sha256);}
for(const r of [...prep.worlds,...trial.files,...trial.frames,...trial.namedRequests.map(r=>r.packet)]){
 assert.equal(await hash(r.filename),r.sha256);evidence.add(r.filename);
}
for(const r of prep.settings){assert.equal(await hash(r.preserved),r.sha256);evidence.add(r.preserved);}
for(const[n,h]of Object.entries(prep.journalSha256)){const f=join(prep.journal,n);assert.equal(await hash(f),h);evidence.add(f);}
assert.equal(await readFile(join(prep.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),prep.selectedManifest);
await mkdir(directoryName);
async function copy(filename,kind){filename=resolve(filename);const rel=relative(workspace,filename);assert.ok(!rel.startsWith('..')&&!rel.startsWith('/'));
 const preserved=resolve(directoryName,kind,rel);await mkdir(dirname(preserved),{recursive:true});const f=await open(preserved,'wx');let at=0;
 try{const r=await hashNativeFile(filename,{maximum:4*1024*1024,sink:async bytes=>{
  for(let i=0;i<bytes.length;){const{bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
 }});await f.sync();assert.equal(await hash(preserved),r.sha256);return{original:filename,preserved,...r};}finally{await f.close();}}
const sourceRows=[],evidenceRows=[];for(const f of [...sources].sort())sourceRows.push(await copy(f,'sources'));
for(const f of [...evidence].sort())evidenceRows.push(await copy(f,'evidence'));
const manifest={version:1,generation:homeward?286:258,nativeHaloSessionQualified:!homeward,nativeHomewardRegionPagingQualified:homeward&&!pointer,nativePointerDrivenRegionPagingQualified:pointer,pointerEvidence:proof.pointerEvidence,sources:sourceRows,evidence:evidenceRows,
 privateNativeExecutable:trial.privateNativeExecutable,nativeExecutableSha256:trial.nativeExecutableSha256,compiledInputs:54,
 previousPublicationArchive:prep.publicationArchive,route:proof.route,visits:proof.visits,originalDisposals:proof.originalDisposals,freedRootsPerDisposal:8,
 exactRecordComparisons:proof.exactRecordComparisons,sharedVertexComparisons:homeward?0:12400,layoutIdentityRefusals:homeward?0:1,retainedCheckpointSlots:homeward?4:6,
 originalPlayerNameCleanup:true,nativeSessionTerminal:true,nativeExitCode:0,heroTransferred:false,ownerPublished:false,browserUsed:false,
 continuousCameraCrossingQualified:false,cooperativeRegionalOwnershipQualified:false,sustainedBrowserMemoryQualified:false,goalComplete:false};
await writeFile(join(directoryName,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeHaloSessionQualified:!homeward,nativeHomewardRegionPagingQualified:homeward&&!pointer,nativePointerDrivenRegionPagingQualified:pointer,generation:manifest.generation,sources:sourceRows.length,evidence:evidenceRows.length}));
