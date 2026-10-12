#!/usr/bin/env node
// Read actual stopped records; mutations exist only in bounded read wrappers.
import assert from 'node:assert/strict';
import {readFile, writeFile, stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointAttachments, checkpointUnitAgentLinks} from '../web/world/checkpoint.mjs';
import {checkpointWaitEffectClockPlan} from '../web/world/wait-effect-clock.mjs';

const [preparationName, proofName, outputName] = process.argv.slice(2);
assert.equal(process.argv.length, 5);
const hash = async name => (await hashNativeFile(name)).sha256;
async function json(name) {
  assert.ok((await stat(name)).size <= 256 * 1024);
  return JSON.parse(await readFile(name, 'utf8'));
}
const preparation = await json(preparationName), proof = await json(proofName);
assert.equal(preparation.waitEffectClockPreparationQualified, true);
assert.equal(proof.originalWaitEffectProjectedLifetimeQualified, true);
assert.equal(await hash('scripts/inspect-native-wait-effect-clock.mjs'),
  proof.sourceSha256['scripts/inspect-native-wait-effect-clock.mjs']);
for (const report of proof.reports) {
  assert.equal(await hash(report.manifest), report.manifestSha256);
  const manifest = await json(report.manifest);
  assert.equal(manifest.nativeSessionTerminal, true);
  assert.equal(manifest.nativeExitCode, 0);
  assert.equal(manifest.nativePid, report.nativePid);
  try { process.kill(manifest.nativePid, 0); throw Error('Native producer remains live'); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
  assert.equal(await hash(manifest.log), report.logSha256);
  assert.deepEqual(report.effects.map(e => [e.unitId, e.elapsed, e.remainingMs,
    e.completeOriginalRecordsCompared]), [[528, 300, 700, true], [529, 300, 2700, true]]);
}
assert.equal(await hash(preparation.source.filename), preparation.source.sha256);
const stopped = await stoppedFileSource(preparation.source.filename);
let largestRead = 0;
const source = {size: stopped.size, async readAt(at, n) {
  largestRead = Math.max(largestRead, n); return stopped.readAt(at, n);
}};
const units = new Map(), attachments = [];
for await (const unit of checkpointUnitAgentLinks(source))
  if ([528, 529].includes(unit.unitId)) {
    assert.ok(!units.has(unit.unitId)); units.set(unit.unitId, unit);
  }
for await (const attachment of checkpointAttachments(source)) attachments.push(attachment);
const clocks = {sourceClockMs: 57650, destinationClockMs: 24250}, plans = [];
let refusedControls = 0, arithmeticControls = 0;
async function refuse(readSource, child, options = clocks) {
  await assert.rejects(checkpointWaitEffectClockPlan(readSource, child, options)); ++refusedControls;
}
function mutatedWord(at, value) {
  const replacement = new Uint8Array(4); new DataView(replacement.buffer).setUint32(0, value, true);
  return {size: source.size, async readAt(offset, n) {
    const bytes = await source.readAt(offset, n);
    for (let i = 0; i < 4; ++i) if (at + i >= offset && at + i < offset + n)
      bytes[at + i - offset] = replacement[i];
    return bytes;
  }};
}
for (const expected of preparation.effects) {
  const child = units.get(expected.unitId), attachment = attachments.find(a => a.unitId === child.unitId);
  const plan = await checkpointWaitEffectClockPlan(source, child, clocks);
  assert.equal(plan.effectSha256, expected.unitSha256);
  assert.equal(plan.remainingMs, expected.interval - 300);
  assert.equal(plan.originalProjectedClockLifetimeQualified, true);
  assert.equal(plan.destinationImportQualified, false);
  assert.equal(plan.completeOrderMigration, false);
  assert.equal(plan.storage.requestedBytes, 161);
  assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.patches) && Object.isFrozen(plan.storage));
  assert.deepEqual(plan.patches, [{offset: attachment.offset + 80, size: 4,
    before: 57350, after: 23950, bank: 1, index: 0, kind: 9}]);
  plans.push(plan);
  const baseline = await checkpointWaitEffectClockPlan(source, child,
    {...clocks, destinationClockMs: clocks.sourceClockMs});
  assert.deepEqual(baseline.patches, []); assert.equal(baseline.originalProjectedClockLifetimeQualified, true);
  for (const destinationClockMs of [0, 1, 299, 300, 0xffffffff]) {
    const projected = await checkpointWaitEffectClockPlan(source, child, {...clocks, destinationClockMs});
    assert.equal((destinationClockMs - projected.patches[0].after) >>> 0, 300);
    assert.equal(projected.originalProjectedClockLifetimeQualified, false); ++arithmeticControls;
  }
  for (const changed of [{description: 0x31485241}, {description: 0x32485241},
    {agentId: 1}, {stateFlags: 2596}, {unitId: 0}, {unitId: child.unitId + 1},
    {parentUnitId: 0}, {parentUnitId: child.parentUnitId + 1}, {size: 150},
    {offset: child.offset + 1}, {family: 'BLDG'}])
    await refuse(source, {...child, ...changed});
  for (const at of [36, 40, 48, 56, 64, 100, 140]) {
    const word = new DataView((await source.readAt(child.offset + at, 4)).buffer).getUint32(0, true);
    await refuse(mutatedWord(child.offset + at, (word ^ 1) >>> 0), child);
  }
  // Every body word except the timestamp is fixed by the original profile:
  // reject callback, name, script, target/reserved and interval mutations.
  for (let i = 0; i < 24; ++i) {
    if (i === 5) continue;
    const at = attachment.offset + 60 + i * 4;
    const word = new DataView((await source.readAt(at, 4)).buffer).getUint32(0, true);
    await refuse(mutatedWord(at, (word ^ 1) >>> 0), child);
  }
  for (const relative of [0, 8, 12, 16, 28, 32, 36, 40, 44, 48, 52, 56, 156, 160]) {
    const at = attachment.offset + relative;
    const word = new DataView((await source.readAt(at, 4)).buffer).getUint32(0, true);
    await refuse(mutatedWord(at, (word ^ 1) >>> 0), child);
  }
  const duplicate = attachments.find(a => a.kind === 'ORDR' && a.unitId !== child.unitId);
  const container = attachments.find(a => a.kind === 'CONT');
  await refuse(mutatedWord(duplicate.offset, child.unitId), child);
  await refuse(mutatedWord(container.offset, child.unitId), child);
  for (const age of [0, 299, 301, expected.interval, expected.interval + 1, 0xffffffff])
    await refuse(source, child, {...clocks, sourceClockMs: (57350 + age) >>> 0});
  for (const bad of [-1, 0x100000000, 1.5, NaN, undefined]) {
    await refuse(source, child, {...clocks, sourceClockMs: bad});
    await refuse(source, child, {...clocks, destinationClockMs: bad});
  }
  await refuse({size: source.size, async readAt(at, n) {
    const bytes = await source.readAt(at, n);
    return at === child.offset && n === 151 ? bytes.subarray(0, 150) : bytes;
  }}, child);
  await refuse({size: source.size, async readAt(at, n) {
    const bytes = await source.readAt(at, n);
    return at === attachment.offset && n === 164 ? bytes.subarray(0, 163) : bytes;
  }}, child);
}
assert.equal(await hash(preparation.source.filename), preparation.source.sha256);
assert.ok(largestRead <= 4096);
const report = {version: 1, originalWaitEffectClockPlanQualified: true,
  preparation: resolve(preparationName), preparationSha256: await hash(preparationName),
  nativeProof: resolve(proofName), nativeProofSha256: await hash(proofName),
  sourceSha256: Object.fromEntries(await Promise.all([
    'web/world/wait-effect-clock.mjs', 'scripts/check-native-wait-effect-plan.mjs'
  ].map(async name => [name, await hash(name)]))), plans, refusedControls, arithmeticControls,
  largestRead, sourceUnchanged: true, browserUsed: false, nativeProcessesStarted: 0,
  destinationImportQualified: false, heroTransferred: false};
await writeFile(outputName, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({originalWaitEffectClockPlanQualified: true, effects: plans.length,
  refusedControls, arithmeticControls, largestRead, sourceUnchanged: true}));
