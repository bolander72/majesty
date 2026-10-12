#!/usr/bin/env node
// Mutation controls over stopped exports. No native process or browser starts.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {inspectCoopWorld} from './inspect-native-coop-world.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {compareHostCheckpointGameplay, checkpointDisplayNames} from './lib/coop-host-checkpoint-state.mjs';
import {checkpointChunks, checkpointUnits} from '../web/world/checkpoint.mjs';
import {stoppedFileSource, workspace} from './lib/stopped-entity-io.mjs';

const [reportName, outputName] = process.argv.slice(2);
assert.equal(process.argv.length, 4);
const reportPath = resolve(reportName), bytes = await readFile(reportPath), report = JSON.parse(bytes);
assert.equal(report.originalHostCheckpointOfflineCopyReadExecuted, true);
assert.equal(report.hostCheckpointGameplayComparison.gameplayStateMatches, true);
assert.equal(report.savedReadbackMatches, false);
// Re-admit the actual stopped native report, not this comparison's label.
assert.equal((await inspectCoopWorld(report.report, {readbackComponent:true})).originalCleanComponentExitQualified, true);
const before = await connectedWorldState(report.before.filename);
const after = await connectedWorldState(report.after.filename);
assert.equal(before.sha256, report.before.sha256); assert.equal(after.sha256, report.after.sha256);
const actual = await compareHostCheckpointGameplay(before, after);
const source = await stoppedFileSource(after.filename), chunks = [], units = [];
for await (const c of checkpointChunks(source)) chunks.push(c);
for await (const u of checkpointUnits(source)) units.push(u);
const selected = units.find(u => u.primary.words[2] & 1);
const hostPalace = units.find(u => u.primary.description === 0x314a4241 && u.primary.words[5] === 0);
const flagAt = u => u.components.find(c => c.tag === 'PRIM').offset + 24;
const playerAt = u => u.components.find(c => c.tag === 'PRIM').offset + 36;
const globals = chunks.find(c => c.tag === 'GSGL').offset + 16;
const metadata = chunks.find(c => c.tag === 'SVGD');
const metadataBytes = Buffer.from(await source.readAt(metadata.offset + 16, metadata.size));
const names = checkpointDisplayNames(metadataBytes);
const descriptionEnd = metadataBytes.indexOf(0, metadataBytes.indexOf(0) + 1);
const original = await readFile(after.filename); assert.ok(original.length <= 2 * 1024 * 1024);
const scratch = join(workspace, 'output/coop-host-state-controls-scratch');
await mkdir(scratch); // Refuse an existing directory instead of clearing it.
const results = [];
try {
  for (const [name, change] of [
    ['extra-selected-host-palace', b => {b[flagAt(hostPalace)] |= 1;}],
    ['missing-guest-selection', b => {b[flagAt(selected)] &= 0xfe;}],
    ['selected-wrong-kingdom', b => {b.writeUInt32LE(0, playerAt(selected));}],
    ['unselected-ownership-change', b => {b.writeUInt32LE(1, playerAt(hostPalace));}],
    ['selected-non-selection-flag-change', b => {b[flagAt(selected)] ^= 2;}],
    ['unselected-non-selection-flag-change', b => {b[flagAt(hostPalace)] ^= 2;}],
    ['building-component-byte-change', b => {b[selected.offset + selected.size - 1] ^= 1;}],
    ['world-clock-change', b => {b[globals + 16] ^= 1;}],
    ['opaque-global-byte-change', b => {b[globals + 28] ^= 1;}],
    ['ui-selected-id-mismatch', b => {b.writeUInt32LE(hostPalace.primary.words[1], globals + 20);}],
    ['ui-cached-id-mismatch', b => {b.writeUInt32LE(hostPalace.primary.words[1], globals + 24);}],
    ['pane-position-outside-component-bound', b => {b.writeUInt32LE(8193, globals);}],
    ['gameplay-rng-change', b => {b[metadata.offset + 16 + descriptionEnd + 29] ^= 1;}],
    ['display-name-count-change', b => {b.writeUInt32LE(3, metadata.offset + 16 + descriptionEnd + 33);}],
    ['scenario-metadata-suffix-change', b => {b[metadata.offset + 16 + names.namesEnd] ^= 1;}],
    ['metadata-tail-change', b => {b[metadata.end - 1] ^= 1;}],
  ]) {
    const changed = Buffer.from(original); change(changed);
    const file = join(scratch, `${name}.GMP`); await writeFile(file, changed, {flag:'wx'});
    await assert.rejects(async () => compareHostCheckpointGameplay(before, await connectedWorldState(file)));
    results.push({name, refused:true});
  }
  await assert.rejects(compareHostCheckpointGameplay(after, before));
  results.push({name:'reversed-host-and-guest', refused:true});
  const stale = {...after, sha256:'0'.repeat(64)};
  await assert.rejects(compareHostCheckpointGameplay(before, stale));
  results.push({name:'changed-after-parsing', refused:true});
} finally {await rm(scratch, {recursive:true});}
const sha = b => createHash('sha256').update(b).digest('hex');
await writeFile(resolve(outputName), JSON.stringify({version:1, report:reportPath,
  reportSha256:sha(bytes), actual, results,
  comparatorSha256:sha(await readFile(join(workspace, 'scripts/lib/coop-host-checkpoint-state.mjs'))),
  controlScriptSha256:sha(await readFile(new URL(import.meta.url))),
  browserUsed:false, nativeProcessesStarted:0,
  scope:'Corruption/refusal controls on copied stopped native exports; no fabricated gameplay qualification.'}, null, 2)+'\n', {flag:'wx'});
console.log(JSON.stringify({controls:results.length, passed:true}));
