#!/usr/bin/env node
import {readFile, writeFile, mkdtemp, open, chmod, lstat} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {hashNativeFile, NATIVE_SOURCES} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
import {inspectNativeHomeMotion} from './inspect-native-home-motion.mjs';
const out = join(workspace, 'output/native-home-motion-generation-057-preserved.json');
try {await lstat(out); throw Error('Preserve previous archive');} catch (e) {if (e.code !== 'ENOENT') throw e;}
const proof = await inspectNativeHomeMotion(join(workspace, 'output/native-home-task-attempt-011.json'));
assert.equal(proof.nativeExecutableSha256, 'aff0b44f9f3548601ce21fe457d69ce260ecc1d6d7854d1cd19505b5621acc56');
const build = JSON.parse(await readFile(join(workspace, 'output/native-world-residency-build-057.json'), 'utf8'));
const directory = await mkdtemp(join(workspace, 'upstream/majesty-recomp/build/actor-arrival-fixture-native-generation-'));
let largestWrite = 0;
async function copy(from, name, maximum) {
  const filename = join(directory, name), f = await open(filename, 'wx'); let at = 0;
  try {
    const h = await hashNativeFile(from, {maximum, async sink(b) {
      largestWrite = Math.max(largestWrite, b.length); let used = 0;
      while (used < b.length) {const {bytesWritten} = await f.write(b, used, b.length - used, at);
        assert.ok(bytesWritten); used += bytesWritten; at += bytesWritten;}
    }});
    await f.sync(); assert.deepEqual(await hashNativeFile(filename, {maximum}), h);
    return {filename, ...h};
  } finally {await f.close();}
}
const sources = {};
for (const n of NATIVE_SOURCES) {sources[n] = await copy(join(workspace, n), n.split('/').at(-1), 1024 * 1024);
  assert.equal(sources[n].sha256, proof.nativeSourceSha256[n]);}
const nativeExecutable = await copy(join(workspace, 'upstream/majesty-recomp/build/recomp/pop_smoke'), 'pop_smoke', 128 * 1024 * 1024);
assert.equal(nativeExecutable.sha256, proof.nativeExecutableSha256); await chmod(nativeExecutable.filename, 0o755);
const nativeSymbols = await copy(join(workspace, 'upstream/majesty-recomp/build/recomp/gen/symbols.json'), 'symbols.json', 32 * 1024 * 1024);
assert.equal(nativeSymbols.sha256, build.nativeSymbolsSha256);
await writeFile(out, JSON.stringify({version: 1, artifactPreserved: true, directory, sources,
  nativeSourceSha256: proof.nativeSourceSha256, nativeExecutable, nativeSymbols,
  evidence: {[proof.sourceManifest]: proof.sourceManifestSha256},
  scope: 'Exact independently verified native057 one-second Warrior script/command hold with identical native/script/order/attached records and natural local guild entry after release. Arbitrary-duration suspension, damage/effect coordination and regional hero travel are unqualified.',
  nativeHeroCommandHoldQualified: true, localGuildEntryAfterHoldQualified: true, playerHeroCrossingQualified: false,
  largestRead: 4096, largestWrite, browserUsed: false, nativeProcessesStarted: 0}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({artifactPreserved: true, largestWrite}));
