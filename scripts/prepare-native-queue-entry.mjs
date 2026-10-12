#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointAttachments} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderRestoreBounds} from '../web/world/order-restore-bounds.mjs';
import {checkpointQueueEntryTargetPlan} from '../web/world/queue-entry-target.mjs';
const [sourcePreparation, directory] = process.argv.slice(2); assert.equal(process.argv.length, 4);
const hash = async n => (await hashNativeFile(n)).sha256;
const prep = JSON.parse(await readFile(sourcePreparation, 'utf8'));
const auditName = 'output/native-queue-entry-target-001-audit.json';
const audit = JSON.parse(await readFile(auditName, 'utf8'));
assert.equal(audit.queueEntryTargetProvenanceQualified, true);
for (const [n, h] of Object.entries(audit.sourceSha256)) assert.equal(await hash(n), h);
assert.equal(await hash(prep.source.filename), prep.source.sha256);
assert.equal(await hash(prep.sourceProof), prep.sourceProofSha256);
const proof = JSON.parse(await readFile(prep.sourceProof, 'utf8'));
assert.equal(proof.originalHeroOutdoorDepartureStateQualified, true);
const manifest = JSON.parse(await readFile(proof.manifest, 'utf8'));
assert.equal(await hash(proof.manifest), proof.manifestSha256);
assert.equal(manifest.nativeSessionTerminal, true); assert.equal(manifest.nativeExitCode, 0);
try {process.kill(manifest.nativePid, 0); throw Error('Native source remains live');}
catch (error) {if (error.code !== 'ESRCH') throw error;}
const source = await stoppedFileSource(prep.source.filename);
const target = await checkpointQueueEntryTargetPlan(source, 504, async id => {assert.equal(id, 469); return id;});
assert.equal(target.patches.length, 1); assert.equal(target.patches[0].before, 469);
// A remote pure GPL home has native ID0. Refuse it before any preparation writes.
await assert.rejects(checkpointQueueEntryTargetPlan(source, 504, async () => 0), /Unresolved/);
let attachment; for await (const a of checkpointAttachments(source)) if (a.unitId === 504 && a.kind === 'ORDR') attachment = a;
assert.equal(attachment.size, 336); assert.equal(attachment.primary.size, 300);
const bounds = await checkpointActorOrderRestoreBounds(source, 504);
assert.deepEqual(bounds.entries.map(e => [e.kind, e.capacity, e.count]), [[4, 10, 0], [7, 10, 1]]);
assert.equal(bounds.allocationRequestBytes, 454);
const out = resolve(directory); await mkdir(out);
const payloadName = join(out, 'Queue_Entry_Input_Orders.bin');
await writeFile(payloadName, await source.readAt(attachment.primary.offset + 16, 300), {flag: 'wx'});
const result = {version: 1, queueEntryPreparationQualified: true,
  source: prep.source, sourceProof: prep.sourceProof, sourceProofSha256: prep.sourceProofSha256,
  settingsProfile: prep.settingsProfile, inputHashes: prep.inputHashes,
  sourceClockMs: 57650, destinationClockMs: 24250,
  unitId: 504, homeUnitId: 469, homeAgentId: 7, heroAgentId: 28,
  targetPlan: target, restoreBounds: bounds, orderPayload: {filename: payloadName, bytes: 300, sha256: await hash(payloadName)},
  targetAudit: resolve(auditName), targetAuditSha256: await hash(auditName),
  sourceSha256: Object.fromEntries(await Promise.all(['scripts/prepare-native-queue-entry.mjs',
    'web/world/queue-entry-target.mjs'].map(async n => [n, await hash(n)]))),
  nativeConsumerExecuted: false, destinationImportQualified: false, browserUsed: false};
await writeFile(join(out, 'prepared.json'), JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({queueEntryPreparationQualified: true, nativeTarget: 469, pureHomeProxyRefused: true,
  orderRequestedBytes: bounds.allocationRequestBytes}));
