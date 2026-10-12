#!/usr/bin/env node
// Retain exact selected owner resume/save evidence before later runtime edits.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open,readdir} from 'node:fs/promises';
import {resolve,join,relative,dirname} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const[saveName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.equal(directoryName,'output/native-selected-halo-owner-generation-246');
await assert.rejects(lstat(directoryName),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const saved=await json(saveName),proof=await json(saved.proof.filename),m=await json(proof.manifest),p=await json(proof.selectedOwnerPreparation.filename);
assert.equal(saved.selectedOriginalHaloOwnerSavePublished,true);assert.equal(saved.selectedRevision,2);assert.equal(saved.evolvedClock,1500);
assert.equal(proof.selectedOriginalHaloOwnerReloadQualified,true);assert.equal(proof.exactRecordComparisons,22);
assert.equal(await hash(saved.proof.filename),saved.proof.sha256);assert.equal(await hash(proof.manifest),proof.manifestSha256);
assert.equal(await hash(proof.selectedOwnerPreparation.filename),proof.selectedOwnerPreparation.sha256);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);
try{process.kill(m.nativePid,0);throw Error('Native producer still live');}catch(e){if(e.code!=='ESRCH')throw e;}
for(const[n,h]of Object.entries({...saved.sourceSha256,...proof.sourceSha256,...p.sourceSha256,...m.compiledSourceSha256}))assert.equal(await hash(n),h);
assert.equal(await hash(m.privateNativeExecutable),m.nativeExecutableSha256);assert.equal(await hash(m.log),m.logSha256);
assert.equal(await readFile(join(saved.directory,'Frontier_Hero_Route.checkpoint'),'utf8'),saved.selectedManifest);
const archive=await json(p.archive.filename);assert.equal(await hash(p.archive.filename),p.archive.sha256);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
const sources=new Set(archive.sources.map(r=>r.original));
for(const n of [...Object.keys(saved.sourceSha256),...Object.keys(proof.sourceSha256),...Object.keys(p.sourceSha256),
  ...Object.keys(m.compiledSourceSha256),'scripts/preserve-native-selected-halo-owner-generation.mjs','scripts/prepare-native-selected-halo-owner.mjs',
  'scripts/run-native-halo-bundle.py','tests/hero-route-store.test.mjs'])sources.add(resolve(n));
const evidence=new Set([resolve(saveName),saved.proof.filename,proof.manifest,m.log,m.buildReport,m.buildReport.replace(/\.json$/,'.log')]);
async function files(dir){const names=[];for(const d of await readdir(dir,{withFileTypes:true})){
  assert.ok(!d.isSymbolicLink());const f=join(dir,d.name);
  if(d.isDirectory())names.push(...await files(f));else if(d.isFile())names.push(f);
}return names;}
for(const dir of [dirname(proof.selectedOwnerPreparation.filename),dirname(m.preparation),saved.directory])
  for(const f of await files(dir))evidence.add(f);
for(const r of [m.sourceCheckpoint,m.loadedCheckpoint,m.activatedCheckpoint,m.evolvedCheckpoint,m.reloadIds,...m.frames]){
  assert.equal(await hash(r.filename),r.sha256);evidence.add(r.filename);
}
for(const[n,h]of Object.entries(saved.oldWorldsPreserved))if(n.endsWith('.GMP'))assert.equal(await hash(join(saved.directory,n)),h);
await mkdir(directoryName);
async function copy(filename,kind){
  filename=resolve(filename);const rel=relative(workspace,filename);assert.ok(!rel.startsWith('..')&&!rel.startsWith('/'));
  const preserved=resolve(directoryName,kind,rel);await mkdir(dirname(preserved),{recursive:true});
  const out=await open(preserved,'wx');let at=0;
  try{const r=await hashNativeFile(filename,{maximum:4*1024*1024,sink:async bytes=>{
    for(let i=0;i<bytes.length;){const{bytesWritten}=await out.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
  }});await out.sync();assert.equal(await hash(preserved),r.sha256);return {original:filename,preserved,bytes:r.bytes,sha256:r.sha256};}
  finally{await out.close();}
}
const sourceRows=[],evidenceRows=[];
for(const f of [...sources].sort())sourceRows.push(await copy(f,'sources'));
for(const f of [...evidence].sort())evidenceRows.push(await copy(f,'evidence'));
const manifest={version:1,generation:246,sources:sourceRows,evidence:evidenceRows,
  compiledSourceSha256:m.compiledSourceSha256,compiledInputCount:Object.keys(m.compiledSourceSha256).length,
  nativeBuildQualified:true,selectedOriginalHaloOwnerReloadQualified:true,selectedOriginalHaloOwnerSavePublished:true,
  exactLoadedRecords:11,exactRecordComparisons:22,sourceClock:1000,evolvedClock:1500,retiredEffectRestored:false,
  selectedOwner:saved.selectedOwner,selectedRevision:2,dormantWorldsOpenedForOwnerExport:0,retainedCheckpointSlots:4,
  nativeExecutableRetained:m.privateNativeExecutable,nativeExecutableSha256:m.nativeExecutableSha256,
  previousArchive:p.archive,nativeProcessesStarted:0,browserUsed:false,seamlessLiveTravelQualified:false,goalComplete:false};
await writeFile(join(directoryName,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({generation:246,sources:sourceRows.length,evidence:evidenceRows.length,selectedOriginalHaloOwnerSavePublished:true}));
