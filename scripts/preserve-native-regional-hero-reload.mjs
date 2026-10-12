#!/usr/bin/env node
// Freeze the qualified reload's inputs; retain its existing private executable.
import assert from 'node:assert/strict';
import {readFile,writeFile,open,mkdir} from 'node:fs/promises';
import {join,resolve,basename,dirname} from 'node:path';
import {workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {inspectNativeRegionalHeroReload} from './inspect-native-regional-hero-reload.mjs';
const[proofArg]=process.argv.slice(2);assert.equal(process.argv.length,3);
const proofName=resolve(proofArg),proof=JSON.parse(await readFile(proofName,'utf8'));
assert.deepEqual(await inspectNativeRegionalHeroReload(proof.manifest),proof);
const m=JSON.parse(await readFile(proof.manifest,'utf8')),build=JSON.parse(await readFile(m.buildReport,'utf8'));
const id=basename(m.buildReport).match(/^native-world-residency-build-(\d+)\.json$/)?.[1];assert.ok(id);
const root=join(workspace,`output/native-regional-reload-generation-${id}`);await mkdir(root);
const sources=[],evidence=[];let index=0,largestWrite=0;
async function copy(original,preserved,expected){
  await mkdir(dirname(preserved),{recursive:true});const f=await open(preserved,'wx');let at=0;
  try{
    const info=await hashNativeFile(original,{maximum:64*1024*1024,async sink(b){largestWrite=Math.max(largestWrite,b.length);let used=0;
      while(used<b.length){const r=await f.write(b,used,b.length-used,at);assert.ok(r.bytesWritten);used+=r.bytesWritten;at+=r.bytesWritten;}}});
    if(expected)assert.equal(info.sha256,expected);await f.sync();assert.deepEqual(await hashNativeFile(preserved,{maximum:64*1024*1024}),info);
    return {original,preserved,sha256:info.sha256,bytes:info.bytes};
  }finally{await f.close();}
}
const sourceHashes={...m.compiledSourceSha256};assert.equal(Object.keys(sourceHashes).length,53);
for(const n of ['scripts/run-native-regional-hero.py','scripts/run-native-regional-home.py','scripts/lib/native_pair_guard.py',
  'scripts/inspect-native-regional-hero.mjs','scripts/inspect-native-regional-hero-reload.mjs','scripts/preserve-native-regional-hero-reload.mjs',
  'scripts/lib/native-generation.mjs','scripts/lib/stopped-entity-io.mjs','web/world/checkpoint.mjs','web/world/saved-clock.mjs',
  'scripts/prepare-native-regional-hero-effects.mjs','scripts/prepare-native-regional-hero-runtime.mjs',
  'AGENTS.md','docs/native-regional-hero.md','CHANGELOG.md','upstream/majesty-recomp/docs/analysis.md',
  'upstream/majesty-recomp/docs/testing.md','upstream/majesty-recomp/CHANGELOG.md'])sourceHashes[n]=(await hashNativeFile(join(workspace,n))).sha256;
for(const[n,h]of Object.entries(sourceHashes))sources.push(await copy(join(workspace,n),join(root,'sources',n),h));
const seen=new Set();async function preserve(n,h){if(seen.has(n))return;seen.add(n);evidence.push(await copy(n,join(root,'evidence',`${String(++index).padStart(3,'0')}-${basename(n)}`),h));}
for(const[n,h]of [[proofName,null],[proof.manifest,proof.manifestSha256],[m.buildReport,m.buildReportSha256],[build.log,build.logSha256],
  [m.preparation,m.preparationSha256],[m.reloadProof,m.reloadProofSha256],[m.script,m.scriptSha256],[m.log,m.logSha256],
  [m.source,m.sourceSha256],[m.sourceCopy,m.sourceSha256],[m.donor,m.donorSha256],[m.frame.filename,m.frame.sha256]])await preserve(n,h);
for(const r of m.records)await preserve(r.filename,r.sha256);
for(const r of m.proposals){await preserve(r.filename,r.sha256);await preserve(r.copied,r.sha256);}
const p=JSON.parse(await readFile(m.preparation,'utf8'));
for(const k of ['basePreparation','checkedCapsule','capsulePreparation','originalGeneratedManifest'])await preserve(p[k],p[k+'Sha256']);
const savedProof=JSON.parse(await readFile(m.reloadProof,'utf8'));
await preserve(savedProof.manifest,savedProof.manifestSha256);
for(const n of ['output/native-regional-hero-025-reload-order-regression.log','output/native-regional-hero-026-reload-supervisor-regression.log'])await preserve(join(workspace,n));
assert.equal((await hashNativeFile(m.privateNativeExecutable)).sha256,m.nativeExecutableSha256);
const parentArchive=join(workspace,'output/native-regional-moved-save-generation-211/manifest.json');
const result={version:1,artifactPreserved:true,originalMovedHeroFreshReloadQualified:true,sources,evidence,
  nativeExecutable:{filename:m.privateNativeExecutable,sha256:m.nativeExecutableSha256,copied:false},
  priorSavedGeneration:{filename:parentArchive,sha256:(await hashNativeFile(parentArchive)).sha256},
  largestRead:4096,largestWrite,nativeProcessesStarted:0,browserUsed:false,ownerPublished:false,goalComplete:false};
await writeFile(join(root,'manifest.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({artifactPreserved:true,sources:sources.length,evidence:evidence.length,largestWrite}));
