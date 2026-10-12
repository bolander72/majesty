#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile, writeFile, open, mkdir, chmod} from 'node:fs/promises';
import {join, basename, resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [buildArg,proofArg]=process.argv.slice(2);assert.equal(process.argv.length,4);
const buildName=resolve(buildArg),proofName=resolve(proofArg);
const generation=basename(buildName).match(/^native-world-residency-build-(\d+)\.json$/);assert(generation);
const buildId=generation[1];
const build = JSON.parse(await readFile(buildName, 'utf8')), proof = JSON.parse(await readFile(proofName, 'utf8'));
assert.equal(build.nativeBuildQualified, true); assert.equal(proof.actualOutdoorFamilyHomeRestorationQualified,true);assert.equal(proof.ordinaryGuildEntryQualified,true);
const manifest = JSON.parse(await readFile(proof.manifest, 'utf8')),reload=JSON.parse(await readFile(proof.reloadManifest,'utf8'));
assert.equal(reload.nativeSessionTerminal,true);assert.equal(reload.nativeExitCode,0);
try{process.kill(reload.nativePid,0);throw Error('Reload producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(manifest.nativeSessionTerminal, true); assert.equal(manifest.nativeExitCode, 0);
try {process.kill(manifest.nativePid, 0); throw Error('Native producer remains live');}
catch (error) {if (error.code !== 'ESRCH') throw error;}
const directory = join(workspace, `upstream/majesty-recomp/build/actor-arrival-fixture-outdoor-family-return-generation-${buildId}`);
await mkdir(directory); await mkdir(join(directory, 'evidence')); let largestWrite = 0, index = 0;
async function copy(from, name, expected, maximum = 1024 * 1024) {
  const filename = join(directory, name), f = await open(filename, 'wx'); let at = 0;
  try {
    const result = await hashNativeFile(from, {maximum, async sink(b) {
      largestWrite = Math.max(largestWrite, b.length); let used = 0;
      while (used < b.length) {const r = await f.write(b, used, b.length - used, at); assert.ok(r.bytesWritten); used += r.bytesWritten; at += r.bytesWritten;}
    }});
    if (expected) assert.equal(result.sha256, expected);
    await f.sync(); assert.deepEqual(await hashNativeFile(filename, {maximum}), result); return {filename, ...result};
  } finally {await f.close();}
}
const hashes = {...build.nativeSourceSha256, ...build.nativeHeapRuntimeSourceSha256, ...build.nativeOrderRuntimeSourceSha256};
assert.equal(Object.keys(hashes).length, 20); const sources = {}, evidence = {};
for (const [n, h] of Object.entries(hashes)) sources[n] = await copy(join(workspace, n), basename(n), h);
const nativeExecutable = await copy(join(workspace, 'upstream/majesty-recomp/build/recomp/pop_smoke'), 'pop_smoke', build.nativeExecutableSha256, 128 * 1024 * 1024);
await chmod(nativeExecutable.filename, 0o755);
const nativeSymbols = await copy(join(workspace, 'upstream/majesty-recomp/build/recomp/gen/symbols.json'), 'symbols.json', build.nativeSymbolsSha256, 32 * 1024 * 1024);
async function preserve(n, h) {
  if (evidence[n]) {if (h) assert.equal(evidence[n].sha256, h); return;}
  evidence[n] = await copy(n, join('evidence', `${String(++index).padStart(3, '0')}-${basename(n)}`), h);
}
await preserve(proof.manifest,proof.manifestSha256);await preserve(proof.reloadManifest,proof.reloadManifestSha256);
for(const m of [manifest,reload]){
  for(const n of [m.preparation,m.script,m.log,m.source,m.sourceCopy])await preserve(n);
  for(const r of [...m.records,...m.saves])await preserve(r.filename,r.sha256);
}
for(const n of [proofName,buildName,build.log])await preserve(n);
const prep=JSON.parse(await readFile(manifest.preparation,'utf8'));
for(const key of ['sourceProof','pairPublication','effectClockProof','homeRouteProof','homeRouteArchive','preparation'])await preserve(prep[key],prep[`${key}Sha256`]);
for(const r of prep.records)await preserve(r.filename,r.sha256);
await preserve(prep.source.filename,prep.source.sha256);
for(const n of ['scripts/prepare-native-outdoor-family-return.mjs','scripts/run-native-outdoor-family-return.py',
  'scripts/inspect-native-outdoor-family-return.mjs','scripts/preserve-native-outdoor-family-return-generation.mjs',
  'web/world/checkpoint.mjs','web/world/saved-clock.mjs'])await preserve(join(workspace,n));
await writeFile(join(workspace, `output/native-outdoor-family-return-generation-${buildId}-preserved.json`), JSON.stringify({version: 1,
  artifactPreserved: true, directory, sources, nativeExecutable, nativeSymbols, evidence,
  actualOutdoorFamilyHomeRestorationQualified:true,ordinaryGuildEntryQualified:true,selectedOwnerPublished:false, sourceHashes: hashes, largestRead: 4096, largestWrite,
  destinationImportQualified: false, heroTransferred: false, browserUsed: false, nativeProcessesStarted: 0}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({artifactPreserved: true, sourceInputs: 20, evidenceFiles: Object.keys(evidence).length, largestWrite}));
