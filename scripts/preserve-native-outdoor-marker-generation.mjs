#!/usr/bin/env node
// Freeze exact native129 inputs and original writer output before the next build.
import assert from 'node:assert/strict';
import {readFile, writeFile, open, chmod, mkdir, stat} from 'node:fs/promises';
import {join, basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';

const output = join(workspace, 'output/native-outdoor-marker-generation-129-preserved.json');
const directory = join(workspace, 'upstream/majesty-recomp/build/actor-arrival-fixture-outdoor-marker-generation-129');
const hash = async filename => (await hashNativeFile(filename)).sha256;
async function json(filename) {
  assert.ok((await stat(filename)).size <= 256 * 1024);
  return JSON.parse(await readFile(filename, 'utf8'));
}
const buildName = join(workspace, 'output/native-world-residency-build-129.json');
const proofName = join(workspace, 'output/native-outdoor-marker-clock-001-observed.json');
const planName = join(workspace, 'output/native-outdoor-marker-plan-001-observed.json');
const build = await json(buildName), proof = await json(proofName), plan = await json(planName);
assert.equal(build.nativeBuildQualified, true);
assert.equal(proof.originalOutdoorMarkerProjectedLifetimeQualified, true);
assert.equal(plan.originalOutdoorMarkerClockPlanQualified, true);
assert.equal(plan.nativeProofSha256, await hash(proofName));
for (const [name, expected] of Object.entries({...proof.sourceSha256, ...plan.sourceSha256}))
  assert.equal(await hash(join(workspace, name)), expected);
try {await stat(output); throw Error('Preserve existing archive report');}
catch (error) {if (error.code !== 'ENOENT') throw error;}
await mkdir(directory); await mkdir(join(directory, 'evidence'));
let largestWrite = 0, evidenceIndex = 0;
async function copy(from, name, expected, maximum = 1024 * 1024) {
  const filename = join(directory, name), file = await open(filename, 'wx'); let at = 0;
  try {
    const result = await hashNativeFile(from, {maximum, async sink(bytes) {
      largestWrite = Math.max(largestWrite, bytes.length); let used = 0;
      while (used < bytes.length) {
        const {bytesWritten} = await file.write(bytes, used, bytes.length - used, at);
        assert.ok(bytesWritten); used += bytesWritten; at += bytesWritten;
      }
    }});
    if (expected) assert.equal(result.sha256, expected);
    await file.sync(); assert.deepEqual(await hashNativeFile(filename, {maximum}), result);
    return {filename, ...result};
  } finally {await file.close();}
}
const sourceHashes = {...build.nativeSourceSha256, ...build.nativeHeapRuntimeSourceSha256,
  ...build.nativeOrderRuntimeSourceSha256};
assert.equal(Object.keys(sourceHashes).length, 19);
const sources = {};
for (const [name, expected] of Object.entries(sourceHashes))
  sources[name] = await copy(join(workspace, name), basename(name), expected);
const nativeExecutable = await copy(join(workspace, 'upstream/majesty-recomp/build/recomp/pop_smoke'),
  'pop_smoke', build.nativeExecutableSha256, 128 * 1024 * 1024);
await chmod(nativeExecutable.filename, 0o755);
const nativeSymbols = await copy(join(workspace, 'upstream/majesty-recomp/build/recomp/gen/symbols.json'),
  'symbols.json', build.nativeSymbolsSha256, 32 * 1024 * 1024);
const evidence = {};
async function preserve(from, expected) {
  if (evidence[from]) {if (expected) assert.equal(evidence[from].sha256, expected); return;}
  evidence[from] = await copy(from, join('evidence', `${String(++evidenceIndex).padStart(3, '0')}-${basename(from)}`), expected);
}
for (const name of [buildName, build.log, proofName, planName, plan.preparation]) await preserve(name);
const preparation = await json(plan.preparation);
await preserve(preparation.source.filename, preparation.source.sha256);
await preserve(preparation.sourceProof, preparation.sourceProofSha256);
for (const effect of [preparation]) await preserve(effect.orderPayload.filename, effect.orderPayload.sha256);
for (const report of proof.reports) {
  assert.equal(report.nativeExecutableSha256, nativeExecutable.sha256);
  await preserve(report.manifest, report.manifestSha256);
  const manifest = await json(report.manifest);
  assert.equal(manifest.nativeSessionTerminal, true); assert.equal(manifest.nativeExitCode, 0);
  try {process.kill(manifest.nativePid, 0); throw Error('Native producer remains live');}
  catch (error) {if (error.code !== 'ESRCH') throw error;}
  await preserve(manifest.log, manifest.logSha256);
  await preserve(manifest.script, manifest.scriptSha256);
  await preserve(manifest.sourceCopy, manifest.sourceSha256);
  assert.equal(manifest.records.length, 31);
  for (const record of manifest.records) await preserve(record.filename, record.sha256);
}
for (const name of ['scripts/build-native-world-residency.py',
  'scripts/prepare-native-outdoor-marker-clock.mjs', 'scripts/run-native-outdoor-marker-clock.py',
  'scripts/inspect-native-outdoor-marker-clock.mjs', 'scripts/check-native-outdoor-marker-plan.mjs',
  'scripts/lib/outdoor-marker-clock-trace.mjs', 'web/world/outdoor-marker-clock.mjs',
  'upstream/majesty-recomp/tests/native_order_allocation_tests.cpp',
  'upstream/majesty-recomp/tests/native_order_storage_tests.cpp',
  'output/native-kind9-allocation-tests-003.log', 'output/native-kind9-storage-tests-001.log'])
  await preserve(join(workspace, name));
await writeFile(output, JSON.stringify({version: 1, artifactPreserved: true, directory,
  sources, nativeSourceSha256: build.nativeSourceSha256,
  nativeHeapRuntimeSourceSha256: build.nativeHeapRuntimeSourceSha256,
  nativeOrderRuntimeSourceSha256: build.nativeOrderRuntimeSourceSha256,
  nativeExecutable, nativeSymbols, evidence, largestRead: 4096, largestWrite,
  originalOutdoorMarkerProjectedLifetimeQualified: true,
  destinationImportQualified: false, heroTransferred: false, browserUsed: false,
  nativeProcessesStarted: 0}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({artifactPreserved: true, sourceInputs: Object.keys(sources).length,
  evidenceFiles: Object.keys(evidence).length, largestWrite}));
