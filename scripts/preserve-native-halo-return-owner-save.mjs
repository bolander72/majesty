#!/usr/bin/env node
// Preserve the selected returned-home save and each interrupted save journal.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open,readdir} from 'node:fs/promises';
import {resolve,dirname,relative,join} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const[proofName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.equal(directoryName,'output/native-halo-return-owner-save-001-preserved');await assert.rejects(lstat(directoryName),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const proof=await json(proofName);assert.equal(proof.journalSelectedReturnedHomeSavePublished,true);assert.equal(proof.selectedRevision,4);
assert.equal(proof.selectedOwner.region,'0_0');assert.equal(proof.interruptions.length,3);
assert.equal(proof.retainedCheckpointSlots,4);assert.equal(proof.idempotentRetryWithoutWrites,true);
for(const[n,h]of Object.entries(proof.sourceSha256))assert.equal(await hash(n),h);
assert.equal(await hash(proof.nativeArchive.filename),proof.nativeArchive.sha256);
const archive=await json(proof.nativeArchive.filename);assert.equal(archive.generation,255);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
for(const[n,h]of Object.entries(proof.journalSha256))assert.equal(await hash(join(proof.journal,n)),h);
assert.equal(await readFile(join(proof.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),proof.selectedManifest);
const sourceNames=new Set([...Object.keys(proof.sourceSha256),'scripts/preserve-native-halo-return-owner-save.mjs']);
const evidenceNames=new Set([resolve(proofName)]);
for(const r of [proof.nativeProof,proof.evolvedWorld]){
 assert.equal(await hash(r.filename),r.sha256);evidenceNames.add(r.filename);
}
for(const directory of [proof.journal,...proof.interruptions.map(r=>r.directory)]){
 assert.ok(directory.startsWith(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-hero-route-')));
 for(const d of await readdir(directory,{withFileTypes:true})){assert.ok(d.isFile()&&!d.isSymbolicLink());evidenceNames.add(join(directory,d.name));}
}
await mkdir(directoryName);
async function copy(filename,kind){filename=resolve(filename);const rel=relative(workspace,filename);assert.ok(!rel.startsWith('..')&&!rel.startsWith('/'));
 const preserved=resolve(directoryName,kind,rel);await mkdir(dirname(preserved),{recursive:true});const f=await open(preserved,'wx');let at=0;
 try{const r=await hashNativeFile(filename,{maximum:4*1024*1024,sink:async bytes=>{
  for(let i=0;i<bytes.length;){const{bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
 }});await f.sync();assert.equal(await hash(preserved),r.sha256);return{original:filename,preserved,...r};}finally{await f.close();}
}
const sources=[],evidence=[];for(const f of [...sourceNames].sort())sources.push(await copy(f,'sources'));
for(const f of [...evidenceNames].sort())evidence.push(await copy(f,'evidence'));
const manifest={version:1,sources,evidence,journalSelectedReturnedHomeSavePublished:true,selectedRevision:4,selectedOwner:proof.selectedOwner,
 selectedManifest:proof.selectedManifest,nativeArchive:proof.nativeArchive,identity:proof.identity,
 startClock:63650,endClock:64150,retainedCheckpointSlots:4,maximumSlotsPerRegion:2,
 interruptionRecoveries:3,idempotentRetryWithoutWrites:true,ownerReaderRevoked:true,
 nativeProcessesStarted:0,browserUsed:false,seamlessLiveTravelQualified:false,automaticReturnCrossingQualified:false,
 cooperativeRegionalOwnershipQualified:false,goalComplete:false};
await writeFile(join(directoryName,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({journalSelectedReturnedHomeSavePublished:true,sources:sources.length,evidence:evidence.length,selectedRevision:4}));
