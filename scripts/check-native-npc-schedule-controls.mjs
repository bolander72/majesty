#!/usr/bin/env node
// Mutate copied evidence only; no native processes or browser launches.
import {mkdtemp, readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {checkpointAgentQueues, checkpointUnits} from '../web/world/checkpoint.mjs';
const run = promisify(execFile);
const [sourceReport, output] = process.argv.slice(2);
if (!sourceReport || !output || process.argv.length !== 4) throw Error('Usage: check-native-npc-schedule-controls.mjs <reload report> <fresh output>');
const checker = resolve('scripts/check-native-npc-schedule.mjs');
await run(process.execPath, [checker, sourceReport, '--stdout']);
const proof = JSON.parse(await readFile(sourceReport, 'utf8')), m = proof.fixture;
const owned = await mkdtemp(resolve('upstream/majesty-recomp/build/actor-arrival-fixture-joint-reload-controls-'));
const profile = join(owned, 'frontier_0_0'), saves = join(profile, 'Documents/My Games/MajestyHD/SaveGame');
await mkdir(saves, {recursive: true});
for (const name of ['Joint_Reload_Unit.bin', 'Joint_Reload_GPL.bin', 'Joint_Reload_Orders.bin'])
  await copyFile(join(m.profile, name), join(profile, name));
for (const name of ['Joint_Schedule_Before', 'Joint_Schedule_After'])
  await copyFile(join(m.profile, 'Documents/My Games/MajestyHD/SaveGame', name + '.GMP'), join(saves, name + '.GMP'));
const log = await readFile(m.log, 'utf8'), afterName = join(saves, 'Joint_Schedule_After.GMP');
const after = await readFile(afterName), before = await readFile(join(saves, 'Joint_Schedule_Before.GMP'));
const results = [];
async function refuse(name, overrides = {}, changedLog = log, bytes = after) {
  await writeFile(afterName, bytes);
  const logName = join(owned, name + '.log'), reportName = join(owned, name + '.json');
  await writeFile(logName, changedLog);
  await writeFile(reportName, JSON.stringify({...proof, fixture: {...m, profile, log: logName, ...overrides}}));
  try {await run(process.execPath, [checker, reportName, '--stdout']);}
  catch (error) {
    if (error.code !== 1 || !/Error:/.test(error.stderr)) throw error;
    results.push({control: name, rejected: true, reason: error.stderr.match(/Error: (.*)/)[1]});
    return;
  }
  throw Error('Invalid scheduling evidence accepted: ' + name);
}
for (const [name, field, value] of [['nonterminal', 'nativeSessionTerminal', false], ['failed-native', 'nativeExitCode', 6],
  ['browser-run', 'browserUsed', true], ['scheduling-disabled', 'scheduleNpc', false], ['pinned-clock', 'clockMode', 'pinned']])
  await refuse(name, {[field]: value});
for (const [name, changed] of [
  ['missing-insertion', log.replace(/^\[streaming\] Joint schedule unit=.*\n/m, '')],
  ['missing-ai-completion', log.replace(/^\[streaming\] Joint script motion completed .*\n/m, '')],
  ['unbalanced-ai', log.replace(/(Joint script motion completed .*?agent-returns=)\d+/, '$10')],
  ['unbalanced-context', log.replace(/(Joint script motion completed .*?context-returns=)\d+/, '$10')],
  ['no-script-actions', log.replace(/(Joint script motion completed .*?executed=)\d+/, '$10')],
  ['hooks-retained', log.replace(/(Joint script motion completed .*?hooks-removed=)1/, '$10')],
]) {
  if (changed === log) throw Error('Control failed to change evidence: ' + name);
  await refuse(name, {}, changed);
}
const source = {size: after.length, async readAt(at, count) {return new Uint8Array(after.subarray(at, at + count));}};
const entries = [];
for await (const entry of checkpointAgentQueues(source)) entries.push(entry);
const actor = entries.find(e => e.type === 'queued-agent' && e.agentId === m.agentId);
const first = entries.find(e => e.type === 'queued-agent'), selector = entries.find(e => e.type === 'queue-selector');
if (!actor || !first || !selector) throw Error('Missing typed control offsets');
for (const [name, offset, value] of [['duplicate-queued-actor', first.offset, m.agentId], ['unknown-queued-agent', actor.offset, 137]]) {
  const bytes = Buffer.from(after); bytes.writeUInt32LE(value, offset);
  await refuse(name, {}, log, bytes);
}
const wrongSelector = Buffer.from(after); wrongSelector[selector.offset] ^= 1;
await refuse('changed-queue-selector', {}, log, wrongSelector);
await refuse('unscheduled-save', {}, log, before);
const reordered = Buffer.from(after);
reordered.writeUInt32LE(first.agentId, actor.offset); reordered.writeUInt32LE(actor.agentId, first.offset);
await refuse('changed-queue-order', {}, log, reordered);
let other;
for await (const unit of checkpointUnits(source)) if (unit.primary.words[1] === 497) {other = unit; break;}
if (!other) throw Error('Missing unrelated UNIT control');
const changedUnit = Buffer.from(after); changedUnit[other.offset + 60] ^= 1;
await refuse('unrelated-unit-mutated', {}, log, changedUnit);
await writeFile(afterName, after);
await writeFile(output, JSON.stringify({qualified: true, rejected: results.length, controls: results,
  nativeProcessesStarted: 0, browserUsed: false, originalEvidenceModified: false}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({rejected: results.length, nativeProcessesStarted: 0}));
