#!/usr/bin/env node
// Complete original effect/hero/order writer comparison at both clock bases.
import assert from 'node:assert/strict';
import {readFile, writeFile, stat} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {ownedDirectory, stoppedFileSource, workspace} from './lib/stopped-entity-io.mjs';
import {originalOutdoorMarkerClockTrace} from './lib/outdoor-marker-clock-trace.mjs';
import {checkpointUnitAgentLinks} from '../web/world/checkpoint.mjs';
import {Sha256} from '../web/world/sha256.mjs';
const [baselineName, rebasedName, outputName] = process.argv.slice(2); assert.equal(process.argv.length, 5);
const hash = async name => (await hashNativeFile(name)).sha256;
async function json(name) {assert.ok((await stat(name)).size <= 256 * 1024); return JSON.parse(await readFile(name, 'utf8'));}
const reports = [];
for (const [phase, name] of [['baseline', baselineName], ['rebased', rebasedName]]) {
  const m = await json(name);
  assert.deepEqual([m.nativeOnly, m.browserUsed, m.nativeSessionTerminal, m.nativeExitCode,
    m.outdoorMarkerClockTrialCompleted, m.stopReason], [true, false, true, 0, true, null]);
  try {process.kill(m.nativePid, 0); throw Error('Native producer remains live');}
  catch (error) {if (error.code !== 'ESRCH') throw error;}
  const fixture = await ownedDirectory(m.fixture, 'actor-arrival-fixture-outdoor-marker-clock-');
  assert.equal(m.worldRoot, join(fixture, 'native-world-outdoor-marker-clock'));
  assert.equal(m.profile, join(m.worldRoot, 'frontier_0_0'));
  assert.equal(await hash(m.buildReport), m.buildReportSha256); const build = await json(m.buildReport);
  assert.equal(build.nativeBuildQualified, true); assert.equal(await hash(build.log), build.logSha256);
  for (const group of ['nativeSourceSha256', 'nativeHeapRuntimeSourceSha256', 'nativeOrderRuntimeSourceSha256']) {
    assert.deepEqual(m[group], build[group]);
    for (const [n, h] of Object.entries(m[group])) assert.equal(await hash(join(workspace, n)), h);
  }
  assert.equal(await hash(join(workspace, 'upstream/majesty-recomp/build/recomp/pop_smoke')), m.nativeExecutableSha256);
  assert.equal(build.nativeExecutableSha256, m.nativeExecutableSha256);
  assert.equal(await hash(join(workspace, 'upstream/majesty-recomp/build/recomp/gen/symbols.json')), m.nativeSymbolsSha256);
  assert.equal(await hash('scripts/run-native-outdoor-marker-clock.py'), m.runnerSha256);
  assert.equal(await hash(m.preparation), m.preparationSha256); const prep = await json(m.preparation);
  assert.equal(prep.outdoorMarkerClockPreparationQualified, true);
  assert.equal(await hash(prep.sourceProof), prep.sourceProofSha256);
  for (const [n, h] of Object.entries(prep.sourceSha256)) assert.equal(await hash(n), h);
  assert.equal(m.source, prep.source.filename); assert.equal(await hash(m.source), prep.source.sha256);
  assert.equal(await hash(m.sourceCopy), prep.source.sha256);
  for (const field of ['originalSourceUnchanged', 'sourceCopyUnchanged', 'originalSettingsUnchanged', 'proposalsUnchanged'])
    assert.equal(m[field], true);
  for (const [n, h] of Object.entries(prep.inputHashes)) assert.equal(await hash(join(prep.settingsProfile, n)), h);
  assert.equal(await hash(m.script), m.scriptSha256);
  assert.equal(await readFile(m.script, 'utf8'), 'wait 12000\ndump outdoor_marker_clock_completed\n');
  assert.equal(await hash(m.log), m.logSha256); assert.ok((await stat(m.log)).size <= 1024 * 1024);
  const trace = originalOutdoorMarkerClockTrace(await readFile(m.log, 'utf8'));
  assert.equal(trace.phase, phase); assert.ok(m.startedAtMs >= build.finishedAtMs);
  const source = await stoppedFileSource(m.source), units = new Map();
  for await (const u of checkpointUnitAgentLinks(source)) if ([504, 527].includes(u.unitId)) units.set(u.unitId, u);
  assert.deepEqual(units.get(527), prep.child); assert.deepEqual(units.get(504), prep.hero);
  const records = new Map(); assert.equal(m.records.length, trace.steps.length * 3 + 1);
  for (const r of m.records) {
    assert.ok(!records.has(r.filename)); assert.equal(r.filename, join(m.profile, r.filename.split('/').at(-1)));
    assert.ok(r.bytes <= 4096); const actual = await hashNativeFile(r.filename, {maximum: 4096});
    assert.equal(actual.sha256, r.sha256); assert.equal(actual.bytes, r.bytes); records.set(r.filename, r);
  }
  const originalOrder = Buffer.from(await readFile(prep.orderPayload.filename));
  assert.equal(await hash(prep.orderPayload.filename), prep.orderPayload.sha256);
  assert.equal(await hash(join(m.profile, 'Outdoor_Marker_Input_Orders.bin')), prep.orderPayload.sha256);
  const samples = [];
  for (const step of trace.steps) {
    const row = {...step};
    for (const [part, suffix, id] of [['effect', 'Effect.UNIT', 527], ['hero', 'Hero.UNIT', 504], ['orders', 'Orders.bin', 0]]) {
      const filename = join(m.profile, `Outdoor_Marker_${String(step.index).padStart(3, '0')}_${suffix}`);
      const record = records.get(filename); assert.ok(record); row[part] = record;
      const bytes = await readFile(filename);
      if (part === 'orders') {
        const expected = step.active ? Buffer.from(originalOrder) : Buffer.alloc(24);
        if (step.active) expected.writeUInt32LE(trace.baseClock - 50 + step.leaves * 100, 44);
        else for (let i = 0; i < 3; ++i) expected.writeUInt32LE(1, i * 8);
        assert.deepEqual(bytes, expected, 'Original whole order bank differs');
      } else {
        const unit = units.get(id);
        assert.equal(bytes.length, unit.size); assert.equal(bytes.readUInt32LE(36), id);
        if (!step.index) assert.deepEqual(bytes, Buffer.from(await source.readAt(unit.offset, unit.size)));
        if (part === 'effect') {
          assert.equal(bytes.readUInt32LE(40), step.flags); assert.equal(bytes.readUInt32LE(48), 0x32485241);
          assert.equal(bytes.readUInt32LE(56), 504);
          const canonical = Uint8Array.from(bytes), v = new DataView(canonical.buffer);
          v.setUint32(36, 0, true); v.setUint32(56, 0, true);
          row.canonicalEffectSha256 = new Sha256().update(canonical).hex();
        }
      }
    }
    samples.push(row);
  }
  assert.ok(m.resourceSamples.length && m.resourceSamples.every(s => s.pid === m.nativePid && s.rssBytes <= m.rssCeilingBytes));
  reports.push({phase, manifest: resolve(name), manifestSha256: await hash(name),
    nativePid: m.nativePid, nativeExecutableSha256: m.nativeExecutableSha256, trace, samples,
    maximumSampledRssBytes: Math.max(...m.resourceSamples.map(s => s.rssBytes))});
}
const [a, b] = reports;
assert.notEqual(a.nativePid, b.nativePid); assert.equal(a.nativeExecutableSha256, b.nativeExecutableSha256);
assert.equal(a.trace.steps.length, b.trace.steps.length); assert.equal(a.trace.completionAdvance, b.trace.completionAdvance);
for (let i = 0; i < a.samples.length; ++i) {
  const x = a.samples[i], y = b.samples[i];
  for (const key of ['index', 'advance', 'active', 'leaves', 'callbacks', 'completion', 'cleanup', 'flags'])
    assert.equal(x[key], y[key]);
  assert.equal(x.effect.sha256, y.effect.sha256); assert.equal(x.hero.sha256, y.hero.sha256);
  const before = await readFile(x.orders.filename), after = Buffer.from(await readFile(y.orders.filename));
  if (x.active) after.writeUInt32LE(after.readUInt32LE(44) + 57650 - 24250, 44);
  assert.deepEqual(before, after, 'Projected whole original order differs');
}
const result = {version: 1, originalOutdoorMarkerProjectedLifetimeQualified: true, reports,
  sourceSha256: Object.fromEntries(await Promise.all([
    'scripts/inspect-native-outdoor-marker-clock.mjs', 'scripts/lib/outdoor-marker-clock-trace.mjs'
  ].map(async n => [n, await hash(n)]))),
  scope: 'Actual ARH2 effect527: original full dispatch/animation/callback retirement at source57650 and projected24250. Complete original effect/hero/order records match except the common timestamp. No destination import, navigation migration, hero crossing or browser activation.',
  destinationImportQualified: false, heroTransferred: false, browserUsed: false};
await writeFile(outputName, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({originalOutdoorMarkerProjectedLifetimeQualified: true,
  steps: a.trace.steps.length, completionAdvance: a.trace.completionAdvance, originalLeafCalls: a.trace.leaves}));
