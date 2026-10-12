#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile, writeFile, open, mkdir, chmod} from 'node:fs/promises';
import {join, basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const buildName = join(workspace, 'output/native-world-residency-build-132.json');
const proofName = join(workspace, 'output/native-queue-entry-002-observed.json');
const build = JSON.parse(await readFile(buildName, 'utf8')), proof = JSON.parse(await readFile(proofName, 'utf8'));
assert.equal(build.nativeBuildQualified, true); assert.equal(proof.originalQueueGuildEntryQualified, true);
const manifest = JSON.parse(await readFile(proof.manifest, 'utf8'));
assert.equal(manifest.nativeSessionTerminal, true); assert.equal(manifest.nativeExitCode, 0);
try {process.kill(manifest.nativePid, 0); throw Error('Native producer remains live');}
catch (error) {if (error.code !== 'ESRCH') throw error;}
const directory = join(workspace, 'upstream/majesty-recomp/build/actor-arrival-fixture-queue-entry-generation-132');
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
assert.equal(Object.keys(hashes).length, 19); const sources = {}, evidence = {};
for (const [n, h] of Object.entries(hashes)) sources[n] = await copy(join(workspace, n), basename(n), h);
const nativeExecutable = await copy(join(workspace, 'upstream/majesty-recomp/build/recomp/pop_smoke'), 'pop_smoke', build.nativeExecutableSha256, 128 * 1024 * 1024);
await chmod(nativeExecutable.filename, 0o755);
const nativeSymbols = await copy(join(workspace, 'upstream/majesty-recomp/build/recomp/gen/symbols.json'), 'symbols.json', build.nativeSymbolsSha256, 32 * 1024 * 1024);
async function preserve(n, h) {
  if (evidence[n]) {if (h) assert.equal(evidence[n].sha256, h); return;}
  evidence[n] = await copy(n, join('evidence', `${String(++index).padStart(3, '0')}-${basename(n)}`), h);
}
await preserve(proof.manifest, proof.manifestSha256);
for (const n of [proofName, buildName, build.log, manifest.preparation, manifest.script, manifest.log,
  manifest.source, manifest.sourceCopy, join(workspace, 'output/native-queue-entry-target-plan-001-observed.json')]) await preserve(n);
for (const r of manifest.records) await preserve(r.filename, r.sha256);
const prep = JSON.parse(await readFile(manifest.preparation, 'utf8'));
await preserve(prep.targetAudit, prep.targetAuditSha256); await preserve(prep.sourceProof, prep.sourceProofSha256);
await preserve(prep.orderPayload.filename, prep.orderPayload.sha256);
for (const n of ['scripts/audit-native-queue-entry-target.py', 'scripts/prepare-native-queue-entry.mjs',
  'scripts/run-native-queue-entry.py', 'scripts/inspect-native-queue-entry.mjs',
  'scripts/check-native-queue-entry-target.mjs', 'web/world/queue-entry-target.mjs']) await preserve(join(workspace, n));
await writeFile(join(workspace, 'output/native-queue-entry-generation-132-preserved.json'), JSON.stringify({version: 1,
  artifactPreserved: true, directory, sources, nativeExecutable, nativeSymbols, evidence,
  originalQueueGuildEntryQualified: true, sourceHashes: hashes, largestRead: 4096, largestWrite,
  destinationImportQualified: false, heroTransferred: false, browserUsed: false, nativeProcessesStarted: 0}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({artifactPreserved: true, sourceInputs: 19, evidenceFiles: Object.keys(evidence).length, largestWrite}));
