#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointQueueEntryTargetPlan} from '../web/world/queue-entry-target.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
const [preparationName, outputName] = process.argv.slice(2); assert.equal(process.argv.length, 4);
const hash = async n => (await hashNativeFile(n)).sha256;
const prep = JSON.parse(await readFile(preparationName, 'utf8'));
assert.equal(prep.queueEntryPreparationQualified, true);
assert.equal(await hash(prep.targetAudit), prep.targetAuditSha256);
const audit = JSON.parse(await readFile(prep.targetAudit, 'utf8'));
assert.equal(audit.queueEntryTargetProvenanceQualified, true);
for (const [n, h] of Object.entries(audit.sourceSha256)) assert.equal(await hash(n), h);
assert.equal(await hash(prep.source.filename), prep.source.sha256);
const source = await stoppedFileSource(prep.source.filename); let entry;
for await (const row of checkpointActorOrderEntries(source, 504)) if (row.type === 'entry' && row.kind === 7) entry = row;
let resolverCalls = 0;
const plan = await checkpointQueueEntryTargetPlan(source, 504, async id => {assert.equal(id, 469); ++resolverCalls; return 90001;});
assert.equal(resolverCalls, 1);
assert.deepEqual(plan.patches, [{offset: entry.offset + 36, size: 4, before: 469, bank: 1,
  index: 0, kind: 7, field: '_userData', cProcId: 4099, after: 90001}]);
assert.equal(plan.destinationImportQualified, false); assert.equal(plan.dormantHomeRoutingQualified, false);
assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.patches));
function mutate(at, value) {
  const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, value, true);
  return {size: source.size, async readAt(offset, n) {
    const bytes = await source.readAt(offset, n);
    for (let i = 0; i < 4; ++i) if (at + i >= offset && at + i < offset + n) bytes[at + i - offset] = b[i];
    return bytes;
  }};
}
let refusedControls = 0, opaqueControls = 0;
for (const bad of [0, -1, 0x100000000, 1.5, undefined]) {
  await assert.rejects(checkpointQueueEntryTargetPlan(source, 504, async () => bad), /Unresolved/); ++refusedControls;
}
for (let word = 11; word < 24; ++word) {
  let calls = 0;
  await assert.rejects(checkpointQueueEntryTargetPlan(mutate(entry.offset + word * 4, 1), 504,
    async () => {++calls; return 90001;}), /Unqualified/);
  assert.equal(calls, 0); ++refusedControls;
}
for (const proc of [0, 4101, 4109]) {
  const untouched = await checkpointQueueEntryTargetPlan(mutate(entry.offset + 40, proc), 504,
    async () => {throw Error('Opaque data must not be resolved');});
  assert.deepEqual(untouched.patches, []); ++opaqueControls;
}
const nullTarget = await checkpointQueueEntryTargetPlan(mutate(entry.offset + 36, 0), 504,
  async () => {throw Error('Null data must not be resolved');});
assert.deepEqual(nullTarget.patches, []); ++opaqueControls;
assert.equal(await hash(prep.source.filename), prep.source.sha256);
await writeFile(outputName, JSON.stringify({version: 1, queueEntryTargetPlanQualified: true,
  plan, refusedControls, opaqueControls, sourceUnchanged: true,
  targetAudit: prep.targetAudit, targetAuditSha256: prep.targetAuditSha256,
  sourceSha256: Object.fromEntries(await Promise.all(['web/world/queue-entry-target.mjs',
    'scripts/check-native-queue-entry-target.mjs'].map(async n => [n, await hash(n)]))),
  destinationImportQualified: false, browserUsed: false, nativeProcessesStarted: 0}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({queueEntryTargetPlanQualified: true, refusedControls, opaqueControls, sourceUnchanged: true}));
