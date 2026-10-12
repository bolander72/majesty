#!/usr/bin/env node
// Freeze the complete return reader/model/roster proof before runtime edits.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open,readdir} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const[proofName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.equal(directoryName,'output/native-halo-return-import-generation-249');await assert.rejects(lstat(directoryName),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const proof=await json(proofName),m=await json(proof.manifest),p=await json(m.preparation),c=await json(p.capsule.filename);
assert.equal(proof.nativeHaloReturnImportQualified,true);assert.equal(proof.savedRecordComparisons,7);
assert.equal(proof.unrelatedRecordComparisons,485);assert.equal(proof.cleanupRecordComparisons,487);
assert.equal(proof.originalCleanupQualified,true);assert.equal(proof.nativeActivationQualified,false);assert.equal(proof.ownerPublished,false);
assert.equal(await hash(proof.manifest),proof.manifestSha256);assert.equal(await hash(m.preparation),m.preparationSha256);
assert.equal(await hash(p.capsule.filename),p.capsule.sha256);assert.equal(await hash(m.buildReport),m.buildReportSha256);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);
try{process.kill(m.nativePid,0);throw Error('Native producer still live');}catch(e){if(e.code!=='ESRCH')throw e;}
for(const[n,h]of Object.entries({...proof.sourceSha256,...m.compiledSourceSha256,...p.sourceSha256,...c.sourceSha256}))assert.equal(await hash(n),h);
assert.equal(await hash(m.privateNativeExecutable),m.nativeExecutableSha256);assert.equal(await hash(m.log),m.logSha256);
assert.equal(await readFile(join(p.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),p.ownerManifest);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
const modelAuditName='output/native-halo-return-model-001-audit.json',audit=await json(modelAuditName);
assert.equal(audit.executableSha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
assert.ok(audit.slots.some(s=>s.table==='0068b4d4'&&s.slot===4&&s.target==='005b54d0'));
const sourceNames=new Set([...Object.keys(proof.sourceSha256),...Object.keys(m.compiledSourceSha256),...Object.keys(p.sourceSha256),...Object.keys(c.sourceSha256),
 'scripts/run-native-halo-return-import.py','scripts/run-native-regional-home.py','scripts/lib/native_pair_guard.py',
 'scripts/preserve-native-halo-return-import-generation.mjs','scripts/audit-native-actor-postload.py','scripts/audit-native-actor-pair.py']);
const evidenceNames=new Set([resolve(proofName),proof.manifest,m.log,m.buildReport,m.buildReport.replace(/\.json$/,'.log'),resolve(modelAuditName)]);
async function files(dir){for(const d of await readdir(dir,{withFileTypes:true})){
 assert.ok(!d.isSymbolicLink());const f=join(dir,d.name);
 if(d.isDirectory())await files(f);else if(d.isFile())evidenceNames.add(f);
}}
for(const dir of [dirname(m.preparation),dirname(p.capsule.filename),p.journal])await files(dir);
for(const r of [m.sourceCheckpoint,m.pack,m.layoutMetadata,m.loadedCheckpoint,...m.worlds,...m.frames,...proof.records]){
 assert.equal(await hash(r.filename),r.sha256);evidenceNames.add(r.filename);
}
for(const n of ['Halo_Return_Guild_Before.GPL','Halo_Return_Guild_Imported.GPL','Halo_Return_Guild_Cleaned.GPL'])evidenceNames.add(join(m.profile,n));
await mkdir(directoryName);
async function copy(filename,kind){filename=resolve(filename);const rel=relative(workspace,filename);assert.ok(!rel.startsWith('..')&&!rel.startsWith('/'));
 const preserved=resolve(directoryName,kind,rel);await mkdir(dirname(preserved),{recursive:true});const f=await open(preserved,'wx');let at=0;
 try{const r=await hashNativeFile(filename,{maximum:4*1024*1024,sink:async bytes=>{
  for(let i=0;i<bytes.length;){const{bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
 }});await f.sync();assert.equal(await hash(preserved),r.sha256);return{original:filename,preserved,...r};}finally{await f.close();}
}
const sources=[],evidence=[];for(const f of [...sourceNames].sort())sources.push(await copy(f,'sources'));
for(const f of [...evidenceNames].sort())evidence.push(await copy(f,'evidence'));
const manifest={version:1,generation:249,sources,evidence,compiledInputCount:Object.keys(m.compiledSourceSha256).length,
 nativeHaloReturnImportQualified:true,standaloneRecordComparisons:7,savedRecordComparisons:7,unrelatedRecordComparisons:485,cleanupRecordComparisons:487,
 originalCleanupQualified:true,freedCommandReservations:23,sourceClock:1500,destinationClock:60650,
 nativeExecutableRetained:m.privateNativeExecutable,nativeExecutableSha256:m.nativeExecutableSha256,
 priorArchive:p.archive,storageGate:p.storageGate,sourceRetired:false,ownerPublished:false,nativeActivationQualified:false,
 automaticReturnCrossingQualified:false,nativeProcessesStarted:0,browserUsed:false,goalComplete:false};
await writeFile(join(directoryName,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({generation:249,sources:sources.length,evidence:evidence.length,nativeHaloReturnImportQualified:true}));
