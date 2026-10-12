#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile, writeFile, stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointAttachments, checkpointUnitAgentLinks} from '../web/world/checkpoint.mjs';
import {checkpointOutdoorMarkerClockPlan} from '../web/world/outdoor-marker-clock.mjs';
import {originalOutdoorMarkerClockTrace} from './lib/outdoor-marker-clock-trace.mjs';
const [preparationName, proofName, outputName] = process.argv.slice(2); assert.equal(process.argv.length, 5);
const hash = async n => (await hashNativeFile(n)).sha256;
async function json(n) {assert.ok((await stat(n)).size <= 256 * 1024); return JSON.parse(await readFile(n, 'utf8'));}
const prep = await json(preparationName), proof = await json(proofName);
assert.equal(proof.originalOutdoorMarkerProjectedLifetimeQualified, true);
for (const [n, h] of Object.entries(proof.sourceSha256)) assert.equal(await hash(n), h);
let traceControls = 0;
for (const report of proof.reports) {
  assert.equal(await hash(report.manifest), report.manifestSha256);
  const manifest = await json(report.manifest);
  assert.equal(manifest.nativeSessionTerminal, true); assert.equal(manifest.nativeExitCode, 0);
  try {process.kill(manifest.nativePid, 0); throw Error('Native producer remains live');}
  catch (error) {if (error.code !== 'ESRCH') throw error;}
  assert.equal(await hash(manifest.log), manifest.logSha256);
  const log = await readFile(manifest.log, 'utf8');
  const altered = [
    log.replace('age=50 serialized-equal=1', 'age=0 serialized-equal=1'),
    log.replace('advance=50 clock=', 'advance=51 clock='),
    log.replace('active=1 leaves=1', 'active=1 leaves=0'),
    log.replace('reason=2 id=4101', 'reason=1 id=4101'),
    log.replace('reason=1 id=4101', 'reason=1 id=4102'),
    log.replace('completion=1 cleanup=1 flags=2596', 'completion=1 cleanup=0 flags=2596'),
    log.replace('hooks-removed=1 hero-transfer=0', 'hooks-removed=0 hero-transfer=0'),
  ];
  for (const value of altered) {assert.notEqual(value, log); assert.throws(() => originalOutdoorMarkerClockTrace(value)); ++traceControls;}
}
assert.equal(await hash(prep.source.filename), prep.source.sha256);
const stopped = await stoppedFileSource(prep.source.filename); let largestRead = 0;
const source = {size: stopped.size, async readAt(at, n) {largestRead = Math.max(largestRead, n); return stopped.readAt(at, n);}};
let child; const attachments = [];
for await (const u of checkpointUnitAgentLinks(source)) if (u.unitId === 527) {assert.ok(!child); child = u;}
for await (const a of checkpointAttachments(source)) attachments.push(a);
const order = attachments.find(a => a.unitId === 527), clocks = {sourceClockMs: 57650, destinationClockMs: 24250};
const plan = await checkpointOutdoorMarkerClockPlan(source, child, clocks);
assert.equal(plan.originalProjectedClockLifetimeQualified, true); assert.equal(plan.remainingMs, 450);
assert.equal(plan.effectSha256, prep.unitSha256); assert.equal(plan.destinationImportQualified, false);
assert.equal(plan.completeOrderMigration, false);
assert.deepEqual(plan.patches, [{offset: order.offset + 80, size: 4, before: 57600, after: 24200, bank: 1, index: 0, kind: 5}]);
assert.deepEqual((await checkpointOutdoorMarkerClockPlan(source, child, {...clocks, destinationClockMs: 57650})).patches, []);
const wrapped = await checkpointOutdoorMarkerClockPlan(source, child, {...clocks, destinationClockMs: 0});
assert.equal(wrapped.patches[0].after, (0 - 50) >>> 0); assert.equal(wrapped.originalProjectedClockLifetimeQualified, false);
let refusedControls = 0;
async function refuse(s, u = child, c = clocks) {await assert.rejects(checkpointOutdoorMarkerClockPlan(s, u, c)); ++refusedControls;}
function mutate(at, value) {
  const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, value, true);
  return {size: source.size, async readAt(offset, n) {
    const result = await source.readAt(offset, n);
    for (let i = 0; i < 4; ++i) if (at + i >= offset && at + i < offset + n) result[at + i - offset] = bytes[i];
    return result;
  }};
}
for (const changed of [{description: 0x33485241}, {description: 0x31475241}, {family: 'BLDG'},
  {agentId: 1}, {stateFlags: 2596}, {parentUnitId: 0}, {parentUnitId: 505},
  {unitId: 0}, {unitId: 528}, {size: 150}, {offset: child.offset + 1}]) await refuse(source, {...child, ...changed});
for (const at of [36, 40, 48, 56, 64, 100, 140].map(n => child.offset + n)) {
  const word = new DataView((await source.readAt(at, 4)).buffer).getUint32(0, true);
  await refuse(mutate(at, (word ^ 1) >>> 0));
}
for (let i = 0; i < 44; ++i) {
  if (i === 5) continue;
  const at = order.offset + 60 + i * 4, word = new DataView((await source.readAt(at, 4)).buffer).getUint32(0, true);
  await refuse(mutate(at, (word ^ 1) >>> 0));
}
for (const relative of [0, 8, 12, 16, 28, 32, 36, 40, 44, 48, 52, 56, 236, 240]) {
  const at = order.offset + relative, word = new DataView((await source.readAt(at, 4)).buffer).getUint32(0, true);
  await refuse(mutate(at, (word ^ 1) >>> 0));
}
await refuse(mutate(attachments.find(a => a.kind === 'ORDR' && a.unitId !== 527).offset, 527));
await refuse(mutate(attachments.find(a => a.kind === 'CONT').offset, 527));
for (const age of [0, 49, 51, 100, 101, 0xffffffff]) await refuse(source, child, {...clocks, sourceClockMs: (57600 + age) >>> 0});
for (const invalid of [-1, 0x100000000, 1.5, NaN, undefined]) {
  await refuse(source, child, {...clocks, sourceClockMs: invalid});
  await refuse(source, child, {...clocks, destinationClockMs: invalid});
}
assert.equal(await hash(prep.source.filename), prep.source.sha256); assert.ok(largestRead <= 4096);
const result = {version: 1, originalOutdoorMarkerClockPlanQualified: true, plan, refusedControls, traceControls,
  sourceUnchanged: true, largestRead, nativeProof: resolve(proofName), nativeProofSha256: await hash(proofName),
  preparation: resolve(preparationName), preparationSha256: await hash(preparationName),
  sourceSha256: Object.fromEntries(await Promise.all(['web/world/outdoor-marker-clock.mjs',
    'scripts/check-native-outdoor-marker-plan.mjs'].map(async n => [n, await hash(n)]))),
  heroTransferred: false, browserUsed: false, nativeProcessesStarted: 0};
await writeFile(outputName, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({originalOutdoorMarkerClockPlanQualified: true, refusedControls, traceControls, largestRead}));
