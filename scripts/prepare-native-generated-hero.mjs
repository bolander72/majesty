#!/usr/bin/env node
// Persist bounded preparation records from an independently verified stopped
// recruitment capture. Same-checkpoint probe only; never start or mutate a game.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {join, resolve, dirname, basename} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectGeneratedHero} from './inspect-native-generated-hero.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {stoppedFileSource, workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {prepareCheckpointActorArrival, MAX_ARRIVAL_TOTAL_RECORD_BYTES} from '../web/world/arrival.mjs';

export async function prepareGeneratedHero(manifestName) {
  const capture = await inspectGeneratedHero(manifestName);
  assert.equal(capture.independentlyPlacedOutsideHome, true,
    'Original building exit is required before preparing this hero for travel');
  const {clock} = await connectedWorldState(capture.save.filename);
  const input = await stoppedFileSource(capture.save.filename);
  const io = {reads: 0, largestRead: 0, inFlight: 0, peakInFlight: 0};
  const source = {size: input.size, async readAt(at, n) {
    io.reads++; io.largestRead = Math.max(io.largestRead, n);
    io.peakInFlight = Math.max(io.peakInFlight, ++io.inFlight);
    try {return await input.readAt(at, n);} finally {io.inFlight--;}
  }};
  const options = {unitId: capture.hero.unitId, freshUnitId: 100000, freshAgentId: 1000,
    unitBindings: [{from: capture.home.unit.unitId, to: capture.home.unit.unitId}],
    attachedUnitBindings: capture.attachedUnits.map((u, i) => ({from: u.unitId, to: 100001 + i})),
    sourceClockMs: clock, destinationClockMs: clock};
  const result = await prepareCheckpointActorArrival(source, source, options);
  assert.equal((await hashNativeFile(capture.save.filename)).sha256, capture.save.sha256);
  const totalBytes = Object.values(result.records).reduce((n, b) => n + b.length, 0);
  assert.ok(totalBytes <= MAX_ARRIVAL_TOTAL_RECORD_BYTES);
  assert.ok(io.largestRead <= 4096); assert.equal(io.peakInFlight, 1);
  return {...result, capture, io, totalBytes, options};
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const [manifest, out] = process.argv.slice(2);
  assert.equal(process.argv.length, 4, 'Usage: <terminal recruitment manifest> <fresh output directory>');
  const directory = resolve(out);
  assert.equal(dirname(directory), join(workspace, 'output'));
  assert.match(basename(directory), /^hero-arrival-preparation-[0-9]{3}$/);
  const result = await prepareGeneratedHero(manifest);
  await mkdir(directory); // Existing packages are never overwritten.
  const records = {};
  for (const [key, data] of Object.entries(result.records)) {
    assert.match(key, /^(unit|agent|container|order|attached_[0-9]+|attached_order_[0-9]+)$/);
    const filename = join(directory, key + '.bin');
    await writeFile(filename, data, {flag: 'wx'});
    records[key] = {filename, bytes: data.length,
      sha256: createHash('sha256').update(data).digest('hex')};
  }
  const preparationSourceSha256 = {};
  for (const name of ['web/world/arrival.mjs', 'web/world/checkpoint.mjs', 'scripts/prepare-native-generated-hero.mjs'])
    preparationSourceSha256[name] = (await hashNativeFile(join(workspace, name))).sha256;
  const report = {version: 1, stoppedDependencyPreparationQualified: true,
    scope: 'Same-checkpoint structural preparation probe with retained guild binding and unchanged simulation clock. '
      + 'No destination kingdom, global home projection, original allocation, activation, source removal or transfer commit.',
    sourceManifest: result.capture.sourceManifest, sourceManifestSha256: result.capture.sourceManifestSha256,
    sourceSave: result.capture.save, sourceClockMs: result.options.sourceClockMs,
    destinationIsSameCheckpoint: true, sourceUnchanged: true,
    options: result.options, plan: result.plan, records, totalRecordBytes: result.totalBytes,
    io: result.io, preparationSourceSha256, arrivalSourceSha256: preparationSourceSha256['web/world/arrival.mjs'],
    attachedOrderRuntimeQualified: false, completeReferenceClosureQualified: false,
    heroCrossingQualified: false, nativeProcessesStarted: 0, browserUsed: false};
  await writeFile(join(directory, 'arrival-preparation.json'), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({stoppedDependencyPreparationQualified: true, records: Object.keys(records).length,
    totalRecordBytes: report.totalRecordBytes, sourceClockMs: report.sourceClockMs,
    heroCrossingQualified: false, nativeProcessesStarted: 0, browserUsed: false}));
}
