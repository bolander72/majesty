#!/usr/bin/env node
// Freeze the qualified session before changing its compiled ownership bridge.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,open,chmod} from 'node:fs/promises';
import {join,basename,resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
import {inspectNativeSelectedHomeSession} from './inspect-native-selected-home-session.mjs';
const [buildName,sessionName,mode]=process.argv.slice(2);assert([4,5].includes(process.argv.length));assert(mode===undefined||mode==='--interrupted');
const observed=await inspectNativeSelectedHomeSession(sessionName,{interruptedBeforeResume:mode==='--interrupted'}),m=JSON.parse(await readFile(sessionName,'utf8'));
const build=JSON.parse(await readFile(buildName,'utf8')),id=basename(buildName).match(/^native-world-residency-build-(\d+)\.json$/)?.[1];assert(id);
assert.equal(build.nativeExecutableSha256,observed.nativeExecutableSha256);
const directory=join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-selected-home-session-generation-'+id);
await mkdir(directory);await mkdir(join(directory,'evidence'));let index=0,largestWrite=0;
async function copy(from,name,expected){const filename=join(directory,name),f=await open(filename,'wx');let at=0;
  try{const result=await hashNativeFile(from,{async sink(b){largestWrite=Math.max(largestWrite,b.length);for(let n=0;n<b.length;){const r=await f.write(b,n,b.length-n,at);assert(r.bytesWritten);n+=r.bytesWritten;at+=r.bytesWritten;}}});
    if(expected)assert.equal(result.sha256,expected);await f.sync();assert.equal((await hashNativeFile(filename)).sha256,result.sha256);return {filename,...result};
  }finally{await f.close();}}
const sources={},evidence={};for(const[n,h]of Object.entries(observed.compiledSourceSha256))sources[n]=await copy(join(workspace,n),basename(n),h);
const nativeExecutable=await copy(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke'),'pop_smoke',m.nativeExecutableSha256);await chmod(nativeExecutable.filename,0o755);
const nativeSymbols=await copy(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json'),'symbols.json',m.nativeSymbolsSha256);
async function preserve(n,h){n=resolve(n);if(evidence[n]){if(h)assert.equal(evidence[n].sha256,h);return;}evidence[n]=await copy(n,join('evidence',String(++index).padStart(3,'0')+'-'+basename(n)),h);}
for(const n of [buildName,build.log,sessionName,m.log,m.preparation,m.homeProof,m.homeArchive,m.receivingArchive,m.script])await preserve(n);
for(const r of [...m.snapshotCaptures,...m.familySaves,...m.familyRecords,...m.proposals,m.reloadIdentity])await preserve(r.filename,r.sha256);
if(m.liveOwner){
  for(const r of [m.liveOwner.pausedCapture,m.liveOwner.pauseRequest,m.liveOwner.publication])await preserve(r.filename,r.sha256);
  for(const n of ['scripts/publish-native-paused-home-owner.mjs','scripts/lib/native-paused-home-owner.mjs','scripts/check-native-paused-home-owner-controls.mjs',
    'output/native-selected-home-session-003-observed.json','output/native-paused-home-owner-001-controls.json'])await preserve(n);
}
if(m.liveImport){
  await preserve(m.liveImport.preparation.filename,m.liveImport.preparation.sha256);
  for(const r of [...m.liveImport.records,...m.liveImport.saves])await preserve(r.filename,r.sha256);
  for(const n of ['scripts/prepare-native-session-home-import.mjs','scripts/lib/native-session-home-import.mjs','scripts/check-native-session-home-import-controls.mjs',
    'output/native-selected-home-session-004-observed.json','output/native-session-home-import-001-controls.json','output/native-paused-home-owner-002-controls.json'])await preserve(n);
}
if(mode==='--interrupted'){
  for(const n of ['scripts/lib/interrupted-home-checkpoint.mjs','scripts/qualify-native-interrupted-home-checkpoint.mjs','scripts/run-native-interrupted-home-recovery.py','scripts/inspect-native-interrupted-home-recovery.mjs',
    'output/native-interrupted-home-checkpoint-001-qualified.json','output/native-interrupted-home-checkpoint-001-exported.json','output/native-interrupted-home-recovery-attempt-001.json','output/native-interrupted-home-recovery-001-observed.json',
    'scripts/publish-native-recovered-home-progress.mjs','scripts/lib/recovered-home-progress.mjs','output/native-recovered-home-progress-001-published.json'])await preserve(n);
  const recovery=JSON.parse(await readFile(join(workspace,'output/native-interrupted-home-recovery-attempt-001.json'),'utf8'));
  for(const n of [recovery.log,recovery.script,recovery.receipt])await preserve(n);
  for(const r of [recovery.readyCapture,...recovery.snapshotCaptures,...recovery.selectedRevisionExports])await preserve(r.filename,r.sha256);
}
for(const[n,h]of Object.entries({...m.controllerDependencies,...observed.sourceSha256}))await preserve(join(workspace,n),h);
for(const n of ['output/native-selected-home-session-001-observed.json','output/native-selected-home-session-001-published.json','output/native-selected-home-session-001-exported.json','output/native-selected-home-session-002-controls.json'])await preserve(n);
for(const n of ['scripts/publish-native-selected-home-session.mjs','scripts/lib/single-session-home-publication.mjs','scripts/export-native-entity-revision.mjs','scripts/preserve-native-selected-home-session-generation.mjs'])await preserve(n);
await writeFile(join(workspace,'output/native-selected-home-session-generation-'+id+'-preserved.json'),JSON.stringify({version:1,artifactPreserved:true,directory,sources,sourceHashes:observed.compiledSourceSha256,nativeExecutable,nativeSymbols,evidence,largestRead:4096,largestWrite,browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({artifactPreserved:true,sourceInputs:20,evidenceFiles:index,largestWrite}));
