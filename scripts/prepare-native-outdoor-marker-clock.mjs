#!/usr/bin/env node
// Original ARH2 animation attached to the stopped outdoor registered hero.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, stat} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointAttachments, checkpointUnitAgentLinks} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {Sha256} from '../web/world/sha256.mjs';
const [waitPreparationName, directory] = process.argv.slice(2); assert.equal(process.argv.length, 4);
const hash = async name => (await hashNativeFile(name)).sha256;
async function json(name) {assert.ok((await stat(name)).size <= 256 * 1024); return JSON.parse(await readFile(name, 'utf8'));}
const previous = await json(waitPreparationName);
assert.equal(previous.waitEffectClockPreparationQualified, true);
assert.equal(await hash(previous.sourceProof), previous.sourceProofSha256);
const proof = await json(previous.sourceProof);
assert.equal(proof.originalHeroOutdoorDepartureStateQualified, true);
assert.equal(await hash('scripts/inspect-native-region-session.mjs'), proof.sourceSha256['scripts/inspect-native-region-session.mjs']);
const manifest = await json(proof.manifest); assert.equal(await hash(proof.manifest), proof.manifestSha256);
assert.equal(manifest.nativeSessionTerminal, true); assert.equal(manifest.nativeExitCode, 0);
try {process.kill(manifest.nativePid, 0); throw Error('Native source producer remains live');}
catch (error) {if (error.code !== 'ESRCH') throw error;}
assert.equal(await hash(previous.source.filename), previous.source.sha256);
const source = await stoppedFileSource(previous.source.filename), units = new Map();
for await (const unit of checkpointUnitAgentLinks(source)) if ([504, 527].includes(unit.unitId)) {
  assert.ok(!units.has(unit.unitId)); units.set(unit.unitId, unit);
}
const child = units.get(527), hero = units.get(504);
assert.deepEqual([child.family, child.parentUnitId, child.agentId, child.stateFlags, child.description, child.size],
  ['VHCL', 504, 0, 2592, 0x32485241, 151]);
assert.equal(hero.parentUnitId, 0); assert.equal(hero.agentId, 28);
let attachment;
for await (const a of checkpointAttachments(source)) if (a.unitId === 527) {
  assert.equal(a.kind, 'ORDR'); assert.ok(!attachment); attachment = a;
}
assert.equal(attachment.size, 244); assert.equal(attachment.primary.size, 208);
const banks = [], entries = [];
for await (const row of checkpointActorOrderEntries(source, 527)) {
  if (row.type === 'bank') banks.push([row.bank, row.version, row.count]);
  else if (row.type === 'entry') entries.push(row);
}
assert.deepEqual(banks, [[0, 1, 0], [1, 1, 1], [2, 1, 0]]); assert.equal(entries.length, 1);
const expected = Array(44).fill(0);
for (const [index, value] of [[0, 1], [1, 1], [2, 2], [3, 5], [4, 100], [5, 57600], [6, 100], [10, 4101], [24, 336], [28, 1]]) expected[index] = value;
assert.deepEqual([...entries[0].words], expected);
const raw = await source.readAt(child.offset, child.size), canonical = Uint8Array.from(raw);
const view = new DataView(canonical.buffer); view.setUint32(36, 0, true); view.setUint32(56, 0, true);
const out = resolve(directory); await mkdir(out);
const payloadName = join(out, 'Outdoor_Marker_Input_Orders.bin');
await writeFile(payloadName, await source.readAt(attachment.primary.offset + 16, 208), {flag: 'wx'});
for (const [name, expectedHash] of Object.entries(previous.inputHashes))
  assert.equal(await hash(join(previous.settingsProfile, name)), expectedHash);
const result = {version: 1, outdoorMarkerClockPreparationQualified: true,
  source: previous.source, sourceClockMs: 57650, destinationClockMs: 24250,
  unitId: 527, heroUnitId: 504, child, hero,
  canonicalUnitSha256: new Sha256().update(canonical).hex(),
  unitSha256: new Sha256().update(raw).hex(),
  orderPayload: {filename: payloadName, bytes: 208, sha256: await hash(payloadName)},
  sourceProof: previous.sourceProof, sourceProofSha256: previous.sourceProofSha256,
  settingsProfile: previous.settingsProfile, inputHashes: previous.inputHashes,
  sourceSha256: Object.fromEntries(await Promise.all([
    'scripts/prepare-native-outdoor-marker-clock.mjs', 'web/world/order-entries.mjs'
  ].map(async name => [name, await hash(name)]))),
  effectLifetimeQualified: false, destinationImportQualified: false, heroTransferred: false,
  browserUsed: false, nativeProcessesStarted: 0};
await writeFile(join(out, 'prepared.json'), JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({outdoorMarkerClockPreparationQualified: true,
  effectClass: 'ARH2', age: 50, canonicalUnitSha256: result.canonicalUnitSha256}));
