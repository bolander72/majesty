#!/usr/bin/env node
// Inspect actual second-trip Begin and retained full saves after the engine stops.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile, realpath} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {inspectCoopWorld, cooperativeKingdoms} from './inspect-native-coop-world.mjs';
import {inspectLaterTargetProgressPair} from './inspect-native-coop-later-target-progress.mjs';
import {connectedWorldState, compareConnectedWorlds} from './lib/connected-residency.mjs';
import {stoppedFileSource, workspace} from './lib/stopped-entity-io.mjs';
import {inspectTargetPrefixCustody} from './lib/coop-target-prefix-custody.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function bounded(path, cap = 2 * 1024 * 1024) {
  assert.equal(await realpath(path), path);
  const source = await stoppedFileSource(path); assert.ok(source.size <= cap);
  const bytes = Buffer.alloc(source.size);
  for (let n = 0; n < bytes.length; n += 4096)
    bytes.set(await source.readAt(n, Math.min(4096, bytes.length - n)), n);
  return bytes;
}
async function retained(row, cap) {
  assert.ok(row); const bytes = await bounded(row.path ?? row.copy, cap);
  assert.equal(bytes.length, row.bytes); assert.equal(sha(bytes), row.sha256);
  return bytes;
}
function lines(bytes, count) {
  const text = bytes.toString('ascii');
  assert.ok(Buffer.from(text, 'ascii').equals(bytes) && /^[\x20-\x7e\n]+$/.test(text) && text.endsWith('\n'));
  const fields = text.slice(0, -1).split('\n'); assert.equal(fields.length, count);
  return fields;
}
async function event(row, root, serial, stage, name) {
  assert.deepEqual([row.serial, row.stage, row.players], [serial, stage, [1, 2]]);
  assert.equal(row.copy, join(root, 'owned-lobby-packets', name));
  const bytes = await retained(row, 2048), length = bytes.readUInt32LE(8);
  assert.ok(length > 0 && length <= 1024 && bytes.length === length + 24);
  assert.deepEqual([bytes.readUInt32LE(0), bytes.readUInt32LE(4),
    bytes.readUInt32LE(12 + length), bytes.readUInt32LE(16 + length), bytes.readUInt32LE(20 + length)],
    [serial, stage, 2, 1, 2]);
  const descriptor = bytes.subarray(12, 12 + length);
  assert.equal(sha(descriptor), row.descriptorSha256);
  return descriptor;
}

export async function inspectSavedReturnProposal(name) {
  const report = resolve(name), raw = await bounded(report), m = JSON.parse(raw);
  const startup = await inspectCoopWorld(report);
  assert.equal(startup.originalRole, 'host'); assert.equal(startup.scriptCompleted, true);
  assert.equal(m.observeSavedReturnProposalRequested, true);
  assert.equal(m.nativeLaterTargetProgressSnapshotRequested, true);
  assert.equal(m.originalLaterTargetProgressSaved, true);
  assert.equal(m.originalGuestTargetInputsDelivered, true);
  const prefixCustody = m.targetGuestInputPrefix === 14 ? await inspectTargetPrefixCustody(m) : null;
  assert.equal(m.referenceReplayedRecipientReadyVotes, 1);
  assert.equal(m.referenceReplayedRecipientLoadedVotes, 1);
  assert.ok(!m.referenceError && !m.stopReason);
  const root = join(workspace, `output/native-multiplayer-lobby-${String(m.attempt).padStart(3, '0')}`);
  for (const [file, key] of [['native_coop_proposal_replay.py', 'proposalReplayHelperSha256'],
    ['native_coop_target_inputs.py', 'targetGuestInputReplayHelperSha256']])
    assert.equal(sha(await bounded(join(root, file))), m[key]);
  assert.equal(m.observedProposalEvents.length, 3);
  const first = await event(m.observedProposalEvents[0], root, 1, 1, 'proposal-000.bin');
  for (let i = 1; i < 3; ++i)
    assert.ok((await event(m.observedProposalEvents[i], root, 1, i + 1,
      `proposal-${String(i).padStart(3, '0')}.bin`)).equals(first));
  assert.equal(m.observedSavedReturnEvents.length, 1);
  const descriptor = await event(m.observedSavedReturnEvents[0], root, 2, 1, 'saved-return-prepared-000.bin');
  const fields = lines(descriptor, 22), previous = lines(first, 22);
  assert.deepEqual(fields.slice(0, 8), ['majesty-coop-region-v1', 'native-terrain-fixture', '1', '0', '0', '0', '71201', '1']);
  assert.deepEqual(fields.slice(8, 10), previous.slice(8, 10));
  assert.equal(fields[8], m.nativeFixtureContentIdentity);
  const saves = join(m.profile, 'Documents/My Games/MajestyHD/SaveGame');
  const prefix = join(saves, 'CoopTransitions_native-terrain-fixture_');
  function pair(rows, region) {
    assert.equal(rows.length, 2);
    const records = new Map(rows.map(row => [row.path, row])); assert.equal(records.size, 2);
    return [records.get(prefix + region + '_0.GMP'), records.get(prefix + region + '.checkpoint')];
  }
  const [home, homeMarker] = pair(m.proposalSourceFiles, '0_0');
  const [current, currentMarker] = pair(m.savedReturnSourceFiles, '1_0');
  await retained(home); await retained(current);
  const homeFields = lines(await retained(homeMarker, 768), 12);
  const currentFields = lines(await retained(currentMarker, 768), 12);
  assert.deepEqual(homeFields, ['majesty-coop-checkpoint-v1', '0', fields[1], fields[8], fields[9],
    '0', '0', '11', '550', '1', String(home.bytes), home.sha256]);
  assert.deepEqual(currentFields, ['majesty-coop-checkpoint-v1', '0', fields[1], fields[8], fields[9],
    '1', '0', fields[10], fields[11], fields[12], String(current.bytes), current.sha256]);
  for (const row of [home, homeMarker]) {
    const imported = m.importedAgreedSource.filter(source => source.bytes === row.bytes && source.sha256 === row.sha256);
    assert.equal(imported.length, 1); await retained(imported[0]);
  }
  const homeState = await connectedWorldState(home.path), currentState = await connectedWorldState(current.path);
  assert.equal(homeState.clock, 550);
  assert.ok(currentState.clock >= 1000 && currentState.clock <= 1900 && currentState.clock % 50 === 0);
  assert.equal(+fields[10] * 50, currentState.clock); assert.equal(+fields[11], currentState.clock);
  assert.deepEqual(fields.slice(12), ['1', String(current.bytes), current.sha256, '1', '1',
    '550', String(home.bytes), home.sha256, String(homeState.rng), String(homeState.gameplayRng)]);
  let reference;
  if (m.savedReturnReferencePair) {
    assert.equal(m.savedReturnReferencePair.copy, join(root, 'saved-return-reference-pair.json'));
    const recorded = JSON.parse((await retained(m.savedReturnReferencePair)).toString());
    reference = await inspectLaterTargetProgressPair(recorded.host.report, recorded.guest.report);
    assert.deepEqual(recorded, reference, 'Explicit reference must still independently qualify');
    const referencedHost = JSON.parse(await bounded(reference.host.report));
    assert.equal(referencedHost.nativeExecutableSha256, m.nativeExecutableSha256);
  } else {
    // Historical445 reports used this fixed qualified pair. New runs carry
    // their own copied reference; no new-build proof can inherit this fallback.
    assert.equal(m.buildReport, join(workspace, 'output/native-world-residency-build-445.json'));
    reference = await inspectLaterTargetProgressPair(
      join(workspace, 'output/native-multiplayer-lobby-200-observed.json'),
      join(workspace, 'output/native-multiplayer-lobby-197-observed.json'));
  }
  assert.equal(reference.host.earlier.originalResumeProof.descriptorSha256, sha(first));
  await retained(m.laterTargetProgressSnapshot);
  const later = await connectedWorldState(m.laterTargetProgressSnapshot.path);
  const progressComparison = compareConnectedWorlds(await connectedWorldState(reference.host.snapshot.path), later);
  const terrain = state => {
    const roots = state.roots.filter(root => root.tag === 'MTER');
    assert.equal(roots.length, 1); return roots[0];
  };
  assert.deepEqual(terrain(currentState), terrain(later));
  const kingdoms = await cooperativeKingdoms(current.path, [0, 1]);
  assert.deepEqual(kingdoms.map(k => k.buildings.length), [4, 4]);
  assert.ok(kingdoms.every(k => k.mobileActors.length >= 1));
  const actions = [];
  assert.ok(m.proposalProtocolRequests.length <= 64);
  for (const [i, row] of m.proposalProtocolRequests.entries()) {
    assert.equal(row.copy, join(root, `owned-lobby-packets/proposal-rpc-${String(i).padStart(3, '0')}.bin`));
    const wire = await retained(row, 2048);
    assert.deepEqual(Array.from({length: 6}, (_, n) => wire.readUInt32LE(n * 4)),
      [0x31525044, 1, row.op, row.request, 0, row.action]);
    assert.ok(row.sender === 1 || row.sender === 2); assert.equal(row.host, row.sender === 1);
    if (row.op === 12 && row.action > 0) {
      const serial = wire.readUInt32LE(24), size = wire.readUInt32LE(28);
      assert.equal(wire.length, size + 32);
      assert.ok(wire.subarray(32).equals(serial === 1 ? first : descriptor));
      actions.push([row.sender, serial, row.action]);
    } else assert.ok((row.op === 12 && row.action === 0) || (row.op === 13 && row.action === 6));
  }
  assert.deepEqual(actions, [[1,1,1], [2,1,2], [1,1,2], [1,1,3], [2,1,3], [1,2,1], [1,2,2]]);
  const log = (await bounded(join(root, 'native.log'), 4 * 1024 * 1024)).toString();
  const requestMarker = m.requestSavedReturnAtProgress === true ?
    '[coop-return-fixture] Production west action armed epoch=1 serial=1 frame=20 clock=1000 original-actions=1' :
    '[smoke] named action coop-travel-west: queued';
  for (const marker of [requestMarker,
    `[coop-transition] Paused epoch=1 owner=1 frame=${fields[10]} clock=${fields[11]}`,
    `[coop-transition] Checkpoint epoch=1 revision=1 frame=${fields[10]} clock=${fields[11]} bytes=${current.bytes} digest=${current.sha256}`,
    `[coop-load] Begin epoch=1 serial=2 region=0_0 bytes=${home.bytes}`,
    '[coop-load] Ready epoch=1 serial=2 imported=0 local-source-revision=1'])
    assert.equal(log.split('\n').filter(line => line === marker).length, 1, marker);
  assert.ok(!/\[coop-load\] (?:Rejected|Attached.*serial=2|Loaded.*serial=2|Resumed.*serial=2)/.test(log));
  return {version: 1, report, reportSha256: sha(raw), startup,
    productionSavedReturnBeginQualified: true, actualSecondPauseCheckpointQualified: true,
    originalHomeCheckpointUnchangedQualified: true, priorClock1000GameplayMatchesQualified: true,
    descriptorSha256: sha(descriptor), sourceFrame: +fields[10], sourceClock: currentState.clock,
    home, homeMarker, current, currentMarker, kingdoms, progressComparison, prefixCustody,
    capturedRequests: m.proposalProtocolRequests.filter((_, i) => i >= m.proposalProtocolRequests.length - 2),
    verifierInputs: {...startup.verifierInputs,
      'scripts/lib/coop-target-prefix-custody.mjs': sha(await readFile(join(workspace, 'scripts/lib/coop-target-prefix-custody.mjs'))),
      'scripts/inspect-native-coop-saved-return-proposal.mjs': sha(await readFile(new URL(import.meta.url)))},
    peerSecondReadyVotes: 0, peerSecondLoadedVotes: 0, savedReturnCompleted: false,
    livePairedSynchronizationQualified: false, browserUsed: false, goalComplete: false};
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  try {
    assert.equal(process.argv.length, 4);
    const proof = await inspectSavedReturnProposal(process.argv[2]);
    await writeFile(resolve(process.argv[3]), JSON.stringify(proof, null, 2) + '\n', {flag: 'wx'});
    console.log(JSON.stringify({savedReturnProposed: true, sourceClock: proof.sourceClock, homeUnchanged: true, returnCompleted: false}));
  } catch (e) {
    console.error(JSON.stringify({error: e.name, message: String(e.message).split('\n')[0], at: e.stack?.split('\n').filter(l => l.trim().startsWith('at ')).slice(0, 2)}));
    process.exitCode = 1;
  }
}
