#!/usr/bin/env node
// Freeze the original source-retirement milestone before changing compiled inputs.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const[proofName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.equal(directoryName,'output/native-halo-return-source-generation-253');await assert.rejects(lstat(directoryName),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const proof=await json(proofName),m=await json(proof.manifest),p=await json(m.preparation);
assert.equal(proof.nativeReturnedSourceRetirementQualified,true);assert.equal(proof.exactLoadedComparisons,924);assert.equal(proof.unrelatedRecordComparisons,455);
assert.equal(proof.originalRemovalQualified,true);assert.equal(proof.sourceAndJournalUnchanged,true);
assert.equal(proof.ownerPublished,false);assert.equal(proof.seamlessLiveTravelQualified,false);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);
try{process.kill(m.nativePid,0);throw Error('Native producer is still live');}catch(e){if(e.code!=='ESRCH')throw e;}
for(const[n,h]of Object.entries({...proof.sourceSha256,...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
for(const[n,h]of [[proof.manifest,proof.manifestSha256],[m.preparation,m.preparationSha256],[m.buildReport,m.buildReportSha256],
 [m.log,m.logSha256],[m.privateNativeExecutable,m.nativeExecutableSha256],
 ['scripts/run-native-halo-return-source.py',m.runnerSha256],['scripts/run-native-regional-home.py',m.supervisorSha256],
 ['scripts/lib/native_pair_guard.py',m.guardSha256]])assert.equal(await hash(n),h);
for(const r of [p.liveArchive,p.liveProof,p.build])assert.equal(await hash(r.filename),r.sha256);
const prior=await json(p.liveArchive.filename);assert.equal(prior.generation,252);
for(const r of prior.sources.concat(prior.evidence))assert.equal(await hash(r.preserved),r.sha256);
const sourceNames=new Set([...Object.keys(proof.sourceSha256),...Object.keys(m.compiledSourceSha256),...Object.keys(p.sourceSha256),
 'scripts/run-native-halo-return-source.py','scripts/run-native-regional-home.py','scripts/lib/native_pair_guard.py',
 'scripts/prepare-native-halo-return-source.mjs','scripts/preserve-native-halo-return-source-generation.mjs']);
const evidenceNames=new Set([resolve(proofName),proof.manifest,m.preparation,m.log,m.buildReport,m.buildReport.replace(/\.json$/,'.log')]);
for(const r of [p.world,p.reloadIds,m.sourceCheckpoint,m.reloadIds,m.layoutMetadata,m.loadedCheckpoint,...m.worlds,...m.frames,p.qualifiedDestination]){
 assert.equal(await hash(r.filename),r.sha256);evidenceNames.add(r.filename);
}
for(const r of p.settings){assert.equal(await hash(r.preserved),r.sha256);evidenceNames.add(r.preserved);}
assert.equal(await readFile(join(p.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),p.ownerManifest);
for(const[n,h]of Object.entries(p.journalSha256)){const f=join(p.journal,n);assert.equal(await hash(f),h);evidenceNames.add(f);}
await mkdir(directoryName);
async function copy(filename,kind){filename=resolve(filename);const rel=relative(workspace,filename);assert.ok(!rel.startsWith('..')&&!rel.startsWith('/'));
 const preserved=resolve(directoryName,kind,rel);await mkdir(dirname(preserved),{recursive:true});const f=await open(preserved,'wx');let at=0;
 try{const r=await hashNativeFile(filename,{maximum:4*1024*1024,sink:async bytes=>{
  for(let i=0;i<bytes.length;){const{bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
 }});await f.sync();assert.equal(await hash(preserved),r.sha256);return{original:filename,preserved,...r};}finally{await f.close();}
}
const sources=[],evidence=[];for(const f of [...sourceNames].sort())sources.push(await copy(f,'sources'));
for(const f of [...evidenceNames].sort())evidence.push(await copy(f,'evidence'));
const manifest={version:1,generation:253,sources,evidence,compiledInputCount:Object.keys(m.compiledSourceSha256).length,
 nativeReturnedSourceRetirementQualified:true,exactLoadedComparisons:924,unrelatedRecordComparisons:455,removedRecords:7,
 originalRemovalQualified:true,sourceClock:1500,qualifiedDestinationClock:63650,
 nativeExecutableRetained:m.privateNativeExecutable,nativeExecutableSha256:m.nativeExecutableSha256,
 priorArchive:p.liveArchive,sourceRetired:false,ownerPublished:false,seamlessLiveTravelQualified:false,
 automaticReturnCrossingQualified:false,nativeProcessesStarted:0,browserUsed:false,goalComplete:false};
await writeFile(join(directoryName,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({generation:253,sources:sources.length,evidence:evidence.length,nativeReturnedSourceRetirementQualified:true}));
