#!/usr/bin/env node
// Freeze qualified stopped evidence before further native/runtime edits.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open,readdir} from 'node:fs/promises';
import {resolve,join,relative,dirname} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [publicationName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(directoryName,/^output\/native-halo-route-generation-245$/);
await assert.rejects(lstat(directoryName),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const p=await json(publicationName),retirement=p.sourceRetirement,m=await json(retirement.manifest),prep=await json(m.preparation);
assert.equal(p.stoppedOriginalHaloHandoffPublished,true);assert.equal(p.selectedRevision,1);assert.equal(p.interruptions.length,4);assert.equal(p.corruptions.length,2);
assert.equal(retirement.nativeHaloSourceRetirementQualified,true);assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);
assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);assert.equal(p.browserUsed,false);
for(const pid of [m.nativePid])try{process.kill(pid,0);throw Error('Producer still live');}catch(e){if(e.code!=='ESRCH')throw e;}
for(const[n,h]of Object.entries({...m.compiledSourceSha256,...retirement.sourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
assert.equal(await hash(retirement.manifest),retirement.manifestSha256);
assert.equal(await hash(m.buildReport),m.buildReportSha256);assert.equal(await hash(m.preparation),m.preparationSha256);
assert.equal(await hash(m.privateNativeExecutable),m.nativeExecutableSha256);
for(const[n,h]of Object.entries(p.originalHashes))assert.equal(await hash(n),h);
const archive=await json(retirement.qualifiedDestinationArchive.filename);
assert.equal(await hash(retirement.qualifiedDestinationArchive.filename),retirement.qualifiedDestinationArchive.sha256);
for(const row of archive.sources.concat(archive.evidence))assert.equal(await hash(row.preserved),row.sha256);
const sources=new Set(archive.sources.map(r=>r.original));
for(const name of [...Object.keys(m.compiledSourceSha256),...Object.keys(retirement.sourceSha256),...Object.keys(p.sourceSha256),
  'scripts/preserve-native-halo-route-generation.mjs','tests/order-entries.test.mjs','tests/order-unit-bindings.test.mjs',
  'tests/fixtures/registered-hero-world.mjs'])sources.add(resolve(name));
const evidence=new Set([resolve(publicationName),retirement.manifest,m.log,m.buildReport,m.buildReport.replace(/\.json$/,'.log'),
  resolve('output/native-halo-source-retirement-001-observed.json'),retirement.inheritedOrderAudit.filename]);
for(const r of [m.sourceCheckpoint,m.loadedCheckpoint,m.sourceBeforeCheckpoint,m.retiredSourceCheckpoint,...m.frames]){
  assert.equal(await hash(r.filename),r.sha256);evidence.add(r.filename);
}
async function files(dir){const result=[];for(const d of await readdir(dir,{withFileTypes:true})){
  const path=join(dir,d.name);assert.ok(!d.isSymbolicLink());
  if(d.isDirectory())result.push(...await files(path));else if(d.isFile())result.push(path);
}return result;}
for(const f of await files(dirname(m.preparation)))evidence.add(f);
for(const f of await files(p.directory))evidence.add(f);
// Control profiles retain their own files; capture their metadata heads/nodes
// and the qualified receipts, not repeated copies of all checkpoint payloads.
for(const c of [...p.interruptions,...p.corruptions])for(const f of await files(c.directory))if(!f.endsWith('.GMP'))evidence.add(f);
await mkdir(directoryName,{recursive:false});
async function copy(filename,kind){
  filename=resolve(filename);const rel=relative(workspace,filename);assert.ok(!rel.startsWith('..')&&!rel.startsWith('/'));
  const preserved=resolve(directoryName,kind,rel);await mkdir(dirname(preserved),{recursive:true});
  const out=await open(preserved,'wx');let at=0;
  try{
    const checked=await hashNativeFile(filename,{maximum:4*1024*1024,sink:async bytes=>{
      for(let i=0;i<bytes.length;){const {bytesWritten}=await out.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
    }});
    await out.sync();assert.equal(await hash(preserved),checked.sha256);
    return {original:filename,preserved,bytes:checked.bytes,sha256:checked.sha256};
  }finally{await out.close();}
}
const sourceRows=[],evidenceRows=[];
for(const f of [...sources].sort())sourceRows.push(await copy(f,'sources'));
for(const f of [...evidence].sort())evidenceRows.push(await copy(f,'evidence'));
const manifest={version:1,generation:245,sources:sourceRows,evidence:evidenceRows,
  compiledInputCount:Object.keys(m.compiledSourceSha256).length,compiledSourceSha256:m.compiledSourceSha256,
  nativeBuildQualified:true,nativeSourceRetirementQualified:true,stoppedOriginalHaloHandoffPublished:true,
  immutableHomeRegistrationPreserved:true,ordinaryAiTargetPreserved:true,unrelatedRecordsPreserved:retirement.unchangedRecords,
  selectedOwner:p.selectedOwner,selectedRevision:p.selectedRevision,interruptionRecoveries:4,semanticCorruptionRefusals:2,
  nativeExecutableRetained:m.privateNativeExecutable,nativeExecutableSha256:m.nativeExecutableSha256,
  qualifiedDestinationArchive:retirement.qualifiedDestinationArchive,
  sourceRetired:true,ownershipTransferQualified:true,qualificationScope:'One stopped original northbound family; no integrated running travel',
  nativeProcessesStarted:0,browserUsed:false,seamlessLiveTravelQualified:false,goalComplete:false};
await writeFile(join(directoryName,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({generation:245,sources:sourceRows.length,evidence:evidenceRows.length,stoppedOriginalHaloHandoffPublished:true}));
