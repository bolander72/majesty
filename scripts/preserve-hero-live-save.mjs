#!/usr/bin/env node
// Preserve current source and bounded evidence without copying game assets or
// launching a browser/game. Native and controlled-storage proofs stay distinct.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open} from 'node:fs/promises';
import {join,relative,dirname} from 'node:path';
import {workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';

const destination=join(workspace,'output/hero-live-save-generation-304');
await assert.rejects(lstat(destination),e=>e.code==='ENOENT');
async function json(name){const path=join(workspace,name);assert.ok((await lstat(path)).size<256*1024);return JSON.parse(await readFile(path,'utf8'));}
const digest=async name=>(await hashNativeFile(join(workspace,name))).sha256;
const build=await json('output/native-world-residency-build-304.json');
assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
const compiled={};
for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256']){
  for(const [name,hash] of Object.entries(build[group])){assert.equal(Object.hasOwn(compiled,name),false);compiled[name]=hash;assert.equal(await digest(name),hash,name);}
}
assert.equal(Object.keys(compiled).length,54);
assert.equal(await digest('upstream/majesty-recomp/build/recomp/pop_smoke'),build.nativeExecutableSha256);
assert.equal(await digest('upstream/majesty-recomp/build/recomp/gen/symbols.json'),build.nativeSymbolsSha256);
for(const [attempt,result] of [[10,'saved'],[11,'failed']]){
  const proof=await json(`output/native-hero-binding-attempt-${String(attempt).padStart(3,'0')}.json`);
  assert.equal(proof.selectedHeroBindingTrialQualified,true);assert.equal(proof.nativeHeroSaveHandshakeQualified,true);
  assert.equal(proof.publicationResult,result);assert.equal(proof.nativeSessionTerminal,true);assert.equal(proof.nativeExitCode,0);
  assert.equal(proof.stopReason,null);assert.equal(proof.ownedProducerAbsent,true);assert.deepEqual(proof.compiledSourceSha256,compiled);
  try{process.kill(proof.nativePid,0);assert.fail('Native producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
  assert.equal(await digest(relative(workspace,proof.log)),proof.logSha256);
  assert.equal(await digest(relative(workspace,proof.heldSave.checkpoint.filename)),proof.heldSave.sha256);
}
const startup=await json('output/hero-route-startup-original-009.json');
for(const [name,hash] of Object.entries(startup.sourceSha256))assert.equal(await digest(name),hash,name);
const live=await json('output/hero-live-save-original-002.json');
assert.equal(live.originalNativeHeldCheckpointLivePublicationQualified,true);assert.equal(live.worldLeaseRetained,true);
assert.equal(live.originalFilesUnchanged,true);assert.equal(live.realOPFSDurabilityQualified,false);
assert.equal(live.publication.ownerRevision,2);assert.equal(live.publication.clock,115900);
assert.equal(live.stats.activeIO,0);assert.equal(live.stats.peakIO,1);assert.ok(live.stats.largestRead<=4096&&live.stats.largestWrite<=4096);
const regression=await readFile(join(workspace,'output/hero-live-save-regression-001.log'),'utf8');
assert.match(regression,/ℹ pass 249\nℹ fail 0\n/);assert.match(regression,/ℹ skipped 3\n/);
const overlay=await json('output/hero-live-save-site-001/manifest.json');
assert.equal(overlay.stagingIdempotent,true);assert.equal(overlay.browserUsed,false);assert.equal(overlay.wasmIncluded,false);
for(const [name,hash] of Object.entries(overlay.files))assert.equal(await digest('output/hero-live-save-site-001/'+name),hash,name);
for(const [name,hash] of Object.entries(overlay.servedPagesUnchanged))assert.equal(await digest(name),hash,name);
const previous=await json('output/hero-runtime-binding-generation-303/manifest.json');
const sourceNames=new Set(previous.sources.map(r=>relative(workspace,r.source)));
for(const name of ['docs/hero-live-save.md','web/world/hero-save-session.mjs','tests/hero-save-session.test.mjs',
  'tests/hero-live-save.test.mjs','tests/hero-live-save-original.test.mjs','tests/fixtures/file-profile-storage.mjs',
  'tests/native-destination.test.mjs','scripts/preserve-hero-live-save.mjs'])sourceNames.add(name);
const evidenceNames=['output/native-world-residency-build-304.json','output/native-world-residency-build-304.log',
  'output/hero-live-save-tests-001.log','output/hero-live-save-tests-002.log','output/hero-live-save-tests-003.log','output/hero-live-save-tests-004.log',
  'output/hero-live-save-regression-001.log','output/native-hero-binding-attempt-008.json','output/native-hero-binding-attempt-008.log',
  'output/native-hero-binding-attempt-009.json','output/native-hero-binding-attempt-009.log',
  'output/native-hero-binding-attempt-010.json','output/native-hero-binding-attempt-010.log',
  'output/native-hero-binding-attempt-011.json','output/native-hero-binding-attempt-011.log',
  'output/hero-route-startup-original-008.json','output/hero-route-startup-original-009.json','output/hero-route-startup-original-009.tests.log',
  'output/hero-live-save-original-001.json','output/hero-live-save-original-002.json','output/hero-live-save-original-002.tests.log',
  'output/hero-live-save-site-001/manifest.json'];
await mkdir(destination);let largestWrite=0;
async function preserve(name,kind){
  assert.ok(name&&!name.startsWith('..')&&!name.startsWith('/')&&!name.includes('/original/'));
  const from=join(workspace,name),to=join(destination,kind,name);await mkdir(dirname(to),{recursive:true});
  const handle=await open(to,'wx');let at=0;
  try{
    const hash=await hashNativeFile(from,{maximum:8*1024*1024,async sink(bytes){largestWrite=Math.max(largestWrite,bytes.length);
      let offset=0;while(offset<bytes.length){const {bytesWritten}=await handle.write(bytes,offset,bytes.length-offset,at);assert.ok(bytesWritten);offset+=bytesWritten;at+=bytesWritten;}
    }});
    await handle.close();assert.equal((await hashNativeFile(to)).sha256,hash.sha256);
    return {kind,source:from,preserved:to,sha256:hash.sha256,bytes:hash.bytes};
  }catch(e){await handle.close().catch(()=>{});throw e;}
}
const sources=[],evidence=[];
for(const name of [...sourceNames].sort())sources.push(await preserve(name,'source'));
for(const name of evidenceNames)evidence.push(await preserve(name,'evidence'));
await writeFile(join(destination,'manifest.json'),JSON.stringify({version:1,compiledInputs:54,compiledSourceSha256:compiled,
  nativeHeroPauseSaveResumeQualified:true,nativeFailedPublicationResumeQualified:true,
  originalNativeHeldCheckpointLivePublicationQualified:true,currentNativeAttempts:[10,11],sources,evidence,
  javascriptTestsPassed:249,javascriptOptionalTestsSkipped:3,separateOriginalDataChecksPassed:2,
  largestRead:4096,largestWrite,browserUsed:false,nativeProcessesStarted:0,realOPFSDurabilityQualified:false,
  liveHeroCrossingQualified:false,cooperativeMatchesQualified:false,internetMatchesQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({sources:sources.length,evidence:evidence.length,compiledInputs:54,browserUsed:false,goalComplete:false}));
