#!/usr/bin/env node
// Preserve measured successes and failures before changing the compiled bridge.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,open,chmod} from 'node:fs/promises';
import {join,resolve,basename,dirname} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {sessionCompiledSourceHashes} from './lib/session-compiled-inputs.mjs';
import {workspace,ownedDirectory} from './lib/stopped-entity-io.mjs';
const [buildName,sessionName,observedName,...extraEvidence]=process.argv.slice(2);
assert.ok(process.argv.length>=5&&extraEvidence.length<=8);
const build=JSON.parse(await readFile(buildName,'utf8')),m=JSON.parse(await readFile(sessionName,'utf8')),
  observed=JSON.parse(await readFile(observedName,'utf8'));
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
try{process.kill(m.nativePid,0);throw Error('Producer remains live');}catch(error){if(error.code!=='ESRCH')throw error;}
await ownedDirectory(m.fixture,'actor-arrival-fixture-session-');
const hash=async n=>(await hashNativeFile(n)).sha256;
assert.equal(await hash(sessionName),observed.manifestSha256);assert.equal(observed.fullTypedRestorationCompared,true);
assert.equal(await hash(buildName),m.buildReportSha256);assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);
assert.equal(await hash(m.log),m.logSha256);assert.equal(await hash('scripts/run-native-region-session.py'),m.runnerSha256);
assert.equal(await hash(m.runnerSourceCopy),m.runnerSha256);
for(const[n,h]of Object.entries(observed.sourceSha256))assert.equal(await hash(n),h);
const id=basename(buildName).match(/^native-world-residency-build-(\d+)\.json$/)?.[1];assert(id);
const sessionId=basename(sessionName).match(/^native-region-session-attempt-(\d+)\.json$/)?.[1];assert(sessionId);
const artifactId=m.nativeIsolationVersion==='v1'?id+'-session-'+sessionId:id;
const directory=join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-region-restoration-generation-'+artifactId);
await mkdir(directory);await mkdir(join(directory,'evidence'));let index=0,largestWrite=0;
async function copy(from,name,expected){const filename=join(directory,name);await mkdir(dirname(filename),{recursive:true});const f=await open(filename,'wx');let at=0;
  try{const result=await hashNativeFile(from,{async sink(b){largestWrite=Math.max(largestWrite,b.length);
    for(let n=0;n<b.length;){const written=(await f.write(b,n,b.length-n,at)).bytesWritten;assert(written);at+=written;n+=written;}}});
    if(expected)assert.equal(result.sha256,expected);await f.sync();assert.equal(await hash(filename),result.sha256);return {filename,...result};
  }finally{await f.close();}}
const compiledSourceSha256=sessionCompiledSourceHashes(build);
const sourceInputs=Object.keys(compiledSourceSha256).length;const sources={},evidence={};
for(const[n,h]of Object.entries(compiledSourceSha256))sources[n]=await copy(join(workspace,n),join('sources',n),h);
const nativeExecutable=await copy(m.nativeExecutable??join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke'),'pop_smoke',m.nativeExecutableSha256);
await chmod(nativeExecutable.filename,0o755);
const nativeSymbols=await copy(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json'),'symbols.json',build.nativeSymbolsSha256);
async function preserve(n,h){n=resolve(n);if(evidence[n]){if(h)assert.equal(evidence[n].sha256,h);return;}
  evidence[n]=await copy(n,join('evidence',String(++index).padStart(3,'0')+'-'+basename(n)),h);}
for(const n of [buildName,build.log,sessionName,observedName,m.log,m.script,m.runnerSourceCopy,m.receipt,m.publicationManifest,
  'scripts/run-native-region-session.py','scripts/inspect-native-region-session.mjs','scripts/check-native-session-restoration-controls.mjs',
  'scripts/lib/connected-residency.mjs','scripts/lib/session-compiled-inputs.mjs','scripts/lib/camera-arrival-state.mjs','scripts/check-native-world-persistence.mjs','scripts/preserve-native-region-restoration-generation.mjs',
  'output/native-session-restoration-controls-002.json','output/native-region-session-restoration-001-differences.json'])await preserve(n);
for(const r of [...m.readyCaptures,...m.snapshotCaptures,...(m.restoredCaptures??[]),...m.selectedRevisionExports])await preserve(r.file??r.filename,r.sha256);
for(const r of m.restoredCaptures??[])await preserve(r.sourceFile,r.sha256);
if(m.receivedHome){
  const r=m.receivedHome;await preserve(r.report,r.reportSha256);await preserve(r.filename,r.sha256);
  const transfer=JSON.parse(await readFile(r.report,'utf8'));
  assert.equal(transfer.realCheckpointPacketTransferQualified,true);
  for(const item of transfer.frozenInputs)await preserve(item.copy,item.sha256);
  await preserve(transfer.copiedSource,transfer.sourceSha256);
  await preserve(transfer.testBinary.filename,transfer.testBinary.sha256);
  await preserve(transfer.testLog.filename,transfer.testLog.sha256);
  await preserve(transfer.log,transfer.logSha256);
  await preserve('scripts/run-native-received-checkpoint.py');
}
for(const n of extraEvidence){
  const file=resolve(n);assert.ok(file.startsWith(workspace+'/'),'Additional evidence must belong to this workspace');
  await preserve(file);
}
await writeFile(join(workspace,'output/native-region-restoration-generation-'+artifactId+'-preserved.json'),JSON.stringify({version:1,
  artifactPreserved:true,directory,sources,sourceHashes:compiledSourceSha256,nativeExecutable,nativeSymbols,evidence,
  fullTypedRestorationQualified:observed.fullTypedRestorationQualified,largestRead:4096,largestWrite,browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({artifactPreserved:true,sourceInputs,evidenceFiles:index,fullTypedRestorationQualified:observed.fullTypedRestorationQualified}));
