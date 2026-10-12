#!/usr/bin/env node
// Refuse incomplete or mislabeled stopped rebuild evidence; no game launches.
import assert from 'node:assert/strict';
import {readFile, writeFile, unlink} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectCoopWorld} from './inspect-native-coop-world.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';

const [componentName, guestName, outputName] = process.argv.slice(2);
assert.equal(process.argv.length, 5);
const component = resolve(componentName), guest = resolve(guestName);
const bytes = await readFile(component), report = JSON.parse(bytes);
assert.equal(report.nativeReadbackRebuildMethodRequested, true);
const scratch = join(workspace, 'output/native-multiplayer-lobby-978-observed.json');
const results = [];
for (const [name, change] of [
  ['missing-reader-request', m => {m.nativeReadbackWorldRequested = false;}],
  ['missing-attached-save', m => {m.originalAttachedWorldReadbackSaved = false;}],
  ['abnormal-native-exit', m => {m.nativeExitCode = 6;}],
  ['live-producer', m => {m.nativePid = process.pid;}],
  ['rebuild-mislabeled-as-reader-only', m => {m.nativeReadbackRebuildMethodRequested = false;}],
  ['invalid-rebuild-request-type', m => {m.nativeReadbackRebuildMethodRequested = 'true';}],
  ['opposite-phase2-label', m => {m.nativeReadbackPhase2Requested = !m.nativeReadbackPhase2Requested;}],
  ['invalid-phase2-request-type', m => {m.nativeReadbackPhase2Requested = 'true';}],
  ['invalid-paused-tick-request-type', m => {m.nativeReadbackPausedTicksRequested = 'true';}],
  ['opposite-paused-tick-label', m => {m.nativeReadbackPausedTicksRequested = !m.nativeReadbackPausedTicksRequested;}],
  ...(report.recordedHostReplay ? [
    ['missing-incoming-pause-observation', m => {m.nativeIncomingHostPauseObservationRequested = false;}],
    ['guest-mislabeled-as-host', m => {
      m.recordedHostReplay = false;m.recordedGuestReplay = true;
      m.nativeIncomingHostPauseObservationRequested = false;
    }],
    ['changed-original-host-pause', m => {m.capturedHostPauseInputWindow[0].sha256 = '0'.repeat(64);}],
    ['missing-original-host-inspection', m => {m.pausedHostInspection = null;}],
  ] : []),
  ...(report.nativeHostCheckpointReadRequested ? [
    ['host-checkpoint-mislabeled-as-own', m => {m.nativeHostCheckpointReadRequested = false;}],
    ['missing-imported-host-checkpoint', m => {m.importedHostCheckpoint = null;}],
    ['changed-imported-host-checkpoint-hash', m => {m.importedHostCheckpoint.sha256 = '0'.repeat(64);}],
    ['unpreserved-imported-host-checkpoint', m => {m.importedHostCheckpointUnchanged = false;}],
    ['borrowed-host-checkpoint-source', m => {m.importedHostCheckpoint.source = m.worldSnapshots[1].path;}],
  ] : []),
]) {
  const altered = structuredClone(report);change(altered);
  await writeFile(scratch, JSON.stringify(altered), {flag:'wx'});
  try {
    await assert.rejects(inspectCoopWorld(scratch, {readbackComponent:true}));
    results.push({name, refused:true});
  } finally {await unlink(scratch);}
}
await assert.rejects(inspectCoopWorld(component));
results.push({name:'component-cannot-qualify-complete-startup', refused:true});
assert.equal((await inspectCoopWorld(component, {readbackComponent:true})).originalCleanComponentExitQualified, true);
results.push({name:'complete-owned-method-component', accepted:true});
assert.equal((await inspectCoopWorld(guest)).scriptCompleted, true);
results.push({name:'ordinary-original-guest', accepted:true});
const sha = b => createHash('sha256').update(b).digest('hex');
await writeFile(resolve(outputName), JSON.stringify({version:1, results,
  component, componentSha256:sha(bytes), guest, guestSha256:sha(await readFile(guest)),
  verifierSha256:sha(await readFile(join(workspace, 'scripts/inspect-native-coop-world.mjs'))),
  controlScriptSha256:sha(await readFile(new URL(import.meta.url))),
  browserUsed:false, nativeProcessesStarted:0, sharedResumeQualified:false}, null, 2)+'\n', {flag:'wx'});
console.log(JSON.stringify({controls:results.length, passed:true}));
