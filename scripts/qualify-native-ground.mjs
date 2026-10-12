#!/usr/bin/env node
// Match the actual JS adapter against immutable original CPU observations.
import assert from 'node:assert/strict';
import {readFile, writeFile, open, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {nativeGroundHeightQ16, sampleNativeGroundHeight} from '../web/world/terrain-ground.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
const root = new URL('../', import.meta.url), sha = b => createHash('sha256').update(b).digest('hex');
const cpuBytes = await readFile(new URL('output/native-ground-emulated-observed.json', root)), cpu = JSON.parse(cpuBytes);
const fixtureBytes = await readFile(new URL('output/native-actor-ground-fixtures.json', root)), fixture = JSON.parse(fixtureBytes);
assert.equal(cpu.executableSha256, '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
assert.ok(cpu.qualified && cpu.unpinnedInputRejectedBeforePeDecode && cpu.terrainAndSentinelsUnchanged);
assert.equal(cpu.fixtureMetadataSha256, sha(fixtureBytes));
assert.equal(cpu.mappedGuestBytesAfterCleanup, 0);
assert.equal(cpu.vectors.length, 66); assert.equal(cpu.copiedTerrainSamples.length, 8);
for (const vector of cpu.vectors) assert.equal(nativeGroundHeightQ16(vector), vector.observedQ16);
let largestRead = 0, samples = 0;
for (const label of ['source', 'destination']) {
  const copied = fixture[label], path = new URL(copied.path, root), before = await stat(path), handle = await open(path, 'r');
  try {
    const source = {size: before.size, async readAt(at, count) {
      assert.ok(count <= 4096); largestRead = Math.max(largestRead, count);
      const bytes = new Uint8Array(count), read = await handle.read(bytes, 0, count, at);
      assert.equal(read.bytesRead, count); return bytes;
    }};
    const hash = createHash('sha256');
    for (let at = 0; at < before.size; at += 4096) hash.update(await source.readAt(at, Math.min(4096, before.size - at)));
    assert.equal(hash.digest('hex'), copied.sha256);
    const terrain = await checkpointTerrain(source);
    for (const sample of copied.samples) {
      const observed = cpu.copiedTerrainSamples.find(c => c.id === sample.id && c.checkpoint === label);
      assert.deepEqual(observed.position, sample.position);
      assert.deepEqual(observed.heights, sample.heights);
      assert.equal(await sampleNativeGroundHeight(terrain, sample.position), observed.observedQ16);
      ++samples;
    }
    const after = await stat(path);
    assert.deepEqual([before.size, before.mtimeMs, before.ctimeMs], [after.size, after.mtimeMs, after.ctimeMs]);
  } finally {await handle.close();}
}
const sources = Object.fromEntries(await Promise.all(['web/world/terrain-ground.mjs', 'web/world/native-height.mjs', 'web/world/terrain.mjs', 'scripts/qualify-native-ground.mjs']
  .map(async path => [path, sha(await readFile(new URL(path, root)))])));
const report = {qualified: true, originalCpuEvidenceSha256: sha(cpuBytes), fixtureMetadataSha256: sha(fixtureBytes),
  originalMachineCodeVectors: cpu.vectors.length, actualCopiedTerrainSamples: samples, largestRead,
  sourceSha256: sources, gameLaunches: 0, browserLaunches: 0,
  scope: 'Actual JavaScript ground interpolation and bounded sampler match pinned original CPU evidence; no actor elevation policy or activation'};
await writeFile(new URL('output/native-ground-js-qualified.json', root), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({qualified: true, originalMachineCodeVectors: cpu.vectors.length, samples, largestRead}));
