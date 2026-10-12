#!/usr/bin/env node
// Corrupt copied evidence; never launch a game or modify original snapshots.
import {readFile, writeFile, mkdtemp, mkdir, copyFile, open} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve, join} from 'node:path';
import {checkpointUnits, checkpointAgentQueues} from '../web/world/checkpoint.mjs';

const [proofName, output] = process.argv.slice(2);
if (!proofName || !output || process.argv.length !== 4) throw Error('Usage: check-native-npc-departure-controls.mjs <reload report> <fresh output>');
const root = resolve(new URL('../', import.meta.url).pathname), script = join(root, 'scripts/check-native-npc-departure.mjs');
const proof = JSON.parse(await readFile(proofName, 'utf8')), originalLog = await readFile(proof.fixture.log, 'utf8');
const owned = await mkdtemp(join(root, 'output/native-npc-departure-controls-'));
execFileSync(process.execPath, [script, proofName, join(owned, 'positive.json')], {stdio: 'pipe', maxBuffer: 16384});
const results = [];
async function refuse(name, changed) {
  const input = join(owned, name + '.json');
  await writeFile(input, JSON.stringify(changed), {flag: 'wx'});
  try {execFileSync(process.execPath, [script, input, join(owned, name + '-result.json')], {stdio: 'pipe', maxBuffer: 16384});}
  catch (e) {
    if (e.status !== 1) throw e;
    results.push({control: name, rejected: true});
    return;
  }
  throw Error('Invalid departure evidence accepted: ' + name);
}
for (const [name, field, bad] of [['nonterminal', 'nativeSessionTerminal', false], ['failed-process', 'nativeExitCode', 6],
  ['browser-run', 'browserUsed', true], ['not-departure', 'departNpc', false], ['simultaneous-motion', 'observeMotion', true]]) {
  const changed = structuredClone(proof); changed.fixture[field] = bad; await refuse(name, changed);
}
const changes = [['missing-removal', originalLog.replace(/^\[streaming\] Joint departure unit=.*\n/m, '')],
  ['missing-resource-witness', originalLog.replace(/^\[streaming\] Joint departure resources .*\n/m, '')],
  ['crt-not-reclaimed', originalLog.replace(/crt-live=\d+,\d+/, 'crt-live=136315,136315')],
  ['wrong-queue-delta', originalLog.replace(/actor-queued=[01]/, 'actor-queued=' + (proof.fixture.reloadScheduledNpc === true || proof.fixture.originalSourceDeparture === true || proof.fixture.departEvolvedNpc === true ? '0' : '1'))]];
for (const [name, field] of [['unit-still-live', 'unit-absent'], ['script-still-live', 'agent-absent'], ['stale-registry', 'groups'],
  ['stale-drawing', 'rendering'], ['stale-queue', 'queues'], ['counter-rewind', 'counters'], ['stale-physical', 'physical'],
  ['allocator-failure', 'reclaimed'], ['hooks-left', 'hooks-same'], ['missing-after-save', 'after-saved']])
  changes.push([name, originalLog.replace(new RegExp(`(Joint departure unit=.*?${field}=)1`), '$10')]);
for (const [name, log] of changes) {
  if (log === originalLog) throw Error('Control did not change evidence: ' + name);
  const filename = join(owned, name + '.log'); await writeFile(filename, log, {flag: 'wx'});
  const changed = structuredClone(proof); changed.fixture.log = filename; await refuse(name, changed);
}
// Mutate only an owned copy of an unrelated UNIT in the after snapshot.
const run = await mkdtemp(join(root, 'upstream/majesty-recomp/build/actor-arrival-fixture-' + (proof.fixture.originalSourceDeparture === true ? 'original-source-' : 'joint-reload-') + 'controls-'));
const profile = join(run, 'frontier_0_0'), saves = join(profile, 'Documents/My Games/MajestyHD/SaveGame');
await mkdir(saves, {recursive: true});
for (const label of ['Joint_Departure_Before', 'Joint_Departure_After'])
  await copyFile(join(proof.fixture.profile, 'Documents/My Games/MajestyHD/SaveGame', label + '.GMP'), join(saves, label + '.GMP'));
for (const kind of ['Unit', 'GPL', 'Orders']) await copyFile(join(proof.fixture.profile, `Joint_Reload_${kind}.bin`), join(profile, `Joint_Reload_${kind}.bin`));
const file = await open(join(saves, 'Joint_Departure_After.GMP'), 'r+');
try {
  const size = (await file.stat()).size;
  const source = {size, async readAt(at, count) {
    if (count > 4096) throw Error('Unbounded copied control read');
    const b = new Uint8Array(count), r = await file.read(b, 0, count, at);
    if (r.bytesRead !== count) throw Error('Truncated copied control'); return b;
  }};
  let offset;
  for await (const unit of checkpointUnits(source)) if (unit.primary.words[1] === 497) offset = unit.offset + 60;
  if (offset === undefined) throw Error('Missing unrelated control actor');
  const byte = await source.readAt(offset, 1); byte[0] ^= 1; await file.write(byte, 0, 1, offset);
} finally {await file.close();}
const changed = structuredClone(proof); changed.fixture.profile = profile;
await refuse('unrelated-native-unit-mutated', changed);
const afterName = join(saves, 'Joint_Departure_After.GMP');
const originalAfter = join(proof.fixture.profile, 'Documents/My Games/MajestyHD/SaveGame/Joint_Departure_After.GMP');
await copyFile(originalAfter, afterName);
const queueFile = await open(afterName, 'r');
const entries = [];
try {
  const size = (await queueFile.stat()).size;
  const source = {size, async readAt(at, count) {
    if (count > 4096) throw Error('Unbounded copied queue read');
    const bytes = new Uint8Array(count), {bytesRead} = await queueFile.read(bytes, 0, count, at);
    if (bytesRead !== count) throw Error('Truncated queue control'); return bytes;
  }};
  for await (const entry of checkpointAgentQueues(source)) entries.push(entry);
} finally {await queueFile.close();}
const queued = entries.filter(e => e.type === 'queued-agent'), selector = entries.find(e => e.type === 'queue-selector');
if (queued.length < 2 || !selector) throw Error('Missing typed queue controls');
const controls = [
  ['saved-unknown-agent', [[queued[0].offset, 137]]],
  ['saved-duplicate-agent', [[queued[0].offset, queued[1].agentId]]],
  ['saved-queue-reordered', [[queued[0].offset, queued[1].agentId], [queued[1].offset, queued[0].agentId]]],
  ['saved-selector-changed', [[selector.offset, selector.activeQueue ^ 1, 1]]],
];
for (const [name, edits] of controls) {
  await copyFile(originalAfter, afterName);
  const handle = await open(afterName, 'r+');
  try {
    for (const [at, value, count = 4] of edits) {
      const bytes = Buffer.alloc(count); if (count === 4) bytes.writeUInt32LE(value); else bytes[0] = value;
      await handle.write(bytes, 0, count, at);
    }
  } finally {await handle.close();}
  await refuse(name, changed);
}
await copyFile(originalAfter, afterName);
const report = {qualified: true, rejected: results.length, controls: results, nativeProcessesStarted: 0,
  browserUsed: false, originalEvidenceModified: false};
await writeFile(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({rejected: results.length, nativeProcessesStarted: 0}));
