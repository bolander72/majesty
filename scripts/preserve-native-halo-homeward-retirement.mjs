#!/usr/bin/env node
// Retain original running crossing and source retirement before home import.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open} from 'node:fs/promises';
import {resolve,dirname,relative,join,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [proofName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,4);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-halo-homeward-retirement-generation-\d{3}$/);
await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const retirement=await json(proofName);assert.equal(retirement.nativeHomewardSourceRetirementQualified,true);
assert.equal(retirement.sourceRetired,true);assert.equal(retirement.exactRemainingRecords,479);
assert.equal(retirement.completeScriptRootQualified,true);assert.equal(await hash(retirement.crossingProof.filename),retirement.crossingProof.sha256);
const proof=await json(retirement.crossingProof.filename);assert.equal(proof.nativeSelectedHaloHomeLegQualified,true);
assert.equal(proof.originalTicks,4);assert.equal(proof.exactLoadedRecords,482);
assert.equal(proof.exactRecordComparisons,1446);assert.equal(proof.ownerPublished,false);
assert.equal(proof.originalHomewardMovementQualified,true);assert.equal(proof.homeRegionRestored,false);
assert.equal(await hash(proof.manifest),proof.manifestSha256);
const trial=await json(proof.manifest),prep=await json(trial.preparation);
assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);
try{process.kill(trial.nativePid,0);throw Error('Eastern producer is live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(await hash(trial.privateNativeExecutable),trial.nativeExecutableSha256);
assert.equal(await hash(trial.preparation),trial.preparationSha256);
assert.equal(await hash(trial.buildReport),trial.buildReportSha256);
const build=await json(trial.buildReport);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
const generation=Number(basename(trial.buildReport).match(/^native-world-residency-build-(\d{3})\.json$/)?.[1]);
assert.equal(basename(directory),`native-halo-homeward-retirement-generation-${String(generation).padStart(3,'0')}`);
const sources=new Set(['scripts/preserve-native-halo-homeward-retirement.mjs',...Object.keys(trial.compiledSourceSha256),
 ...Object.keys(proof.sourceSha256),...Object.keys(retirement.sourceSha256),...Object.keys(prep.sourceSha256),
 'scripts/run-native-halo-home-leg.py','scripts/run-native-regional-home.py','scripts/lib/native_pair_guard.py']);
for(const[n,h]of Object.entries({...trial.compiledSourceSha256,...proof.sourceSha256,...retirement.sourceSha256,...prep.sourceSha256}))assert.equal(await hash(n),h);
for(const[n,h]of [['scripts/run-native-halo-home-leg.py',trial.runnerSha256],
 ['scripts/run-native-regional-home.py',trial.supervisorSha256],['scripts/lib/native_pair_guard.py',trial.guardSha256]])assert.equal(await hash(n),h);
const evidence=new Set([resolve(proofName),retirement.crossingProof.filename,proof.manifest,trial.preparation,trial.buildReport,trial.log,trial.script,
 prep.publicationArchive.filename,prep.publicationProof.filename]);
for(const r of [...proof.wholeWorlds,retirement.retiredWorld,...trial.frames,trial.reloadIds,trial.layoutMetadata,trial.homeLegIds,proof.nativeMoveAudit,prep.world,prep.reloadIds,
 prep.publicationArchive,prep.publicationProof]){assert.equal(await hash(r.filename),r.sha256);evidence.add(r.filename);}
for(const r of prep.settings){assert.equal(await hash(r.preserved),r.sha256);evidence.add(r.preserved);}
for(const[n,h]of Object.entries(prep.journalSha256)){const f=join(prep.journal,n);assert.equal(await hash(f),h);evidence.add(f);}
assert.equal(await readFile(join(prep.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),prep.ownerManifest);
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
await writeFile(join(directory,'manifest.json'),JSON.stringify({version:1,generation,
 nativeHomewardSourceRetirementQualified:true,nativeSelectedHaloHomeLegQualified:true,sources:sourceRows,evidence:evidenceRows,
 privateNativeExecutable:trial.privateNativeExecutable,nativeExecutableSha256:trial.nativeExecutableSha256,
 proof:{filename:resolve(proofName),sha256:await hash(proofName)},compiledInputs:54,originalTicks:4,
 selectedRevision:5,startClock:3550,endClock:3750,exactLoadedRecords:482,exactRecordComparisons:1446,
 previousPublicationArchive:prep.publicationArchive,sourceAndJournalUnchanged:true,ownerPublished:false,
 originalHomewardMovementQualified:true,sourceRetired:true,exactRemainingRecords:479,completeScriptRootQualified:true,retiredWorld:retirement.retiredWorld,crossingProof:retirement.crossingProof,homeRegionRestored:false,handoff:proof.handoff,browserUsed:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSelectedHaloHomeLegQualified:true,generation,sources:sourceRows.length,evidence:evidenceRows.length}));
