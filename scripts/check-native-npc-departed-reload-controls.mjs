#!/usr/bin/env node
// Negative evidence controls on copied files; no native or browser launches.
import {mkdtemp, readFile, writeFile, mkdir, copyFile, open} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {checkpointUnits, checkpointAgents, checkpointAgentQueues} from '../web/world/checkpoint.mjs';
const run = promisify(execFile), root = resolve(new URL('../', import.meta.url).pathname);
const [manifestName, output] = process.argv.slice(2);
if (!manifestName || !output || process.argv.length !== 4) throw Error('Usage: check-native-npc-departed-reload-controls.mjs <manifest> <fresh output>');
const checker = join(root, 'scripts/check-native-npc-departed-reload.mjs');
const {stdout} = await run(process.execPath, [checker, manifestName, '--stdout'], {maxBuffer: 1024 * 1024});
const positive = JSON.parse(stdout), m = positive.fixture;
const proof = JSON.parse(await readFile(m.departedCheckpointReport, 'utf8'));
const originalSource = m.originalSourceWorld === true;
const owned = await mkdtemp(join(root, 'upstream/majesty-recomp/build/actor-arrival-fixture-' + (originalSource ? 'original-source-' : 'joint-reload-') + 'controls-'));
const profile = join(owned, 'frontier_0_0'), saves = join(profile, 'Documents/My Games/MajestyHD/SaveGame');
await mkdir(saves, {recursive: true});
for (const name of [...Object.keys(m.inputHashes), 'Documents/My Games/MajestyHD/SaveGame/Joint_Departed_Reload.GMP']) {
  const target = join(profile, name); await mkdir(resolve(target, '..'), {recursive: true});
  await copyFile(join(m.profile, name), target);
}
const log = await readFile(m.log, 'utf8'), results = [];
async function refuse(name, overrides = {}, changedLog = log) {
  const logName = join(owned, name + '.log'), reportName = join(owned, name + '.json');
  await writeFile(logName, changedLog);
  await writeFile(reportName, JSON.stringify({...m, profile, log: logName, ...overrides}));
  try {await run(process.execPath, [checker, reportName, '--stdout'], {maxBuffer: 1024 * 1024});}
  catch (error) {
    if (error.code !== 1 || !/Error:/.test(error.stderr)) throw error;
    results.push({control: name, rejected: true, reason: error.stderr.match(/Error: (.*)/)[1]});
    return;
  }
  throw Error('Invalid departed reload evidence accepted: ' + name);
}
for (const [name, field, value] of [
  ['nonterminal', 'nativeSessionTerminal', false], ['failed-native', 'nativeExitCode', 6],
  ['browser-run', 'browserUsed', true], ['nonnative', 'nativeOnly', false],
  ['not-departed-reload', 'reloadDepartedNpc', false], ['advancing-clock', 'clockMode', 'monotonic'],
  ['motion-enabled', 'observeMotion', true], ['reinsertion-enabled', 'scheduleNpc', true],
  ['second-removal-enabled', 'departNpc', true], ['scheduled-reload-enabled', 'reloadScheduledNpc', true],
  ['previous-process-reused', 'nativePid', proof.sourceManifest.nativePid],
  ['wrong-unit', 'unitId', m.unitId + 1], ['wrong-agent', 'agentId', m.agentId + 1],
]) await refuse(name, {[field]: value});
const logChanges = [
  ['missing-original-load', log.replace(/^\[streaming\] Original load end .*\n/m, '')],
  ['wrong-loaded-count', log.replace(/(Original load end .*?visits=)\d+/, '$1' + (positive.originalLoadedUnits - 1))],
  ['missing-native-proof', log.replace(/^\[streaming\] Joint departed reload .*\n/m, '')],
  ['continuing-game-fault', log + '\nSIGSEGV\n'],
  ['unexpected-reinsertion', log + '\n[streaming] Joint schedule unit=510 agent=79\n'],
];
for (const field of ['unit-absent', 'agent-absent', 'groups', 'queues-same', 'counters-same', 'hooks-same', 'roundtrip-saved'])
  logChanges.push(['native-' + field + '-missing', log.replace(new RegExp('(Joint departed reload .*?' + field + '=)1'), '$10')]);
for (const [field, value] of [['entries', 11], ['queued', 11], ['native-counter', m.unitId - 1], ['script-counter', m.agentId - 1]])
  logChanges.push(['native-' + field + '-wrong', log.replace(new RegExp('(Joint departed reload .*?' + field + '=)\\d+'), '$1' + value)]);
for (const [name, changed] of logChanges) {
  if (changed === log) throw Error('Control failed to change evidence: ' + name);
  await refuse(name, {}, changed);
}
const afterName = join(saves, 'Joint_Departed_Reload.GMP');
const originalAfter = join(m.profile, 'Documents/My Games/MajestyHD/SaveGame/Joint_Departed_Reload.GMP');
const h = await open(afterName, 'r'), units = [], agents = [], entries = [];
try {
  const size = (await h.stat()).size;
  const source = {size, async readAt(at, count) {
    if (count > 4096) throw Error('Unbounded copied control read');
    const bytes = new Uint8Array(count), {bytesRead} = await h.read(bytes, 0, count, at);
    if (bytesRead !== count) throw Error('Truncated copied control'); return bytes;
  }};
  for await (const r of checkpointUnits(source)) if (r.primary.words[1] === 497) units.push(r);
  for await (const r of checkpointAgents(source)) if (r.agentId === 1) agents.push(r);
  for await (const r of checkpointAgentQueues(source)) entries.push(r);
} finally {await h.close();}
const queued = entries.filter(e => e.type === 'queued-agent'), selector = entries.find(e => e.type === 'queue-selector');
if (units.length !== 1 || agents.length !== 1 || queued.length !== proof.differences.agents.after || !selector) throw Error('Missing typed survivor control offsets');
for (const [name, edits] of [
  ['changed-unit', [[units[0].offset + 60, 1, 'xor']]],
  ['changed-agent', [[agents[0].offset + agents[0].size - 19, 1, 'xor']]],
  ['queued-removed-agent', [[queued[0].offset, m.agentId]]],
  ['duplicate-queued-agent', [[queued[0].offset, queued[1].agentId]]],
  ['reordered-queue', [[queued[0].offset, queued[1].agentId], [queued[1].offset, queued[0].agentId]]],
  ['changed-selector', [[selector.offset, 1, 'xor']]],
]) {
  await copyFile(originalAfter, afterName);
  const handle = await open(afterName, 'r+');
  try {
    for (const [at, value, mode] of edits) {
      const bytes = Buffer.alloc(mode === 'xor' ? 1 : 4);
      if (mode === 'xor') {await handle.read(bytes, 0, 1, at); bytes[0] ^= value;}
      else bytes.writeUInt32LE(value);
      await handle.write(bytes, 0, bytes.length, at);
    }
  } finally {await handle.close();}
  await refuse(name);
}
await copyFile(originalAfter, afterName);
await copyFile(proof.before.filename, afterName);
await refuse('resurrected-npc-world');
await copyFile(originalAfter, afterName);
const expectedName = join(profile, 'Joint_Reload_Expected.bin'), expected = await readFile(expectedName);
const wrongVersion = Buffer.from(expected); wrongVersion.writeUInt32LE(1, 4);
await writeFile(expectedName, wrongVersion);
const inputHashes = {...m.inputHashes, 'Joint_Reload_Expected.bin': createHash('sha256').update(wrongVersion).digest('hex')};
await refuse('live-actor-fixture-version', {inputHashes});
await writeFile(expectedName, expected);
await writeFile(output, JSON.stringify({qualified: true, rejected: results.length, controls: results,
  nativeProcessesStarted: 0, browserUsed: false, originalEvidenceModified: false}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({rejected: results.length, nativeProcessesStarted: 0}));
