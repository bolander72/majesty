#!/usr/bin/env node
// Actual original recipient pause, checkpoint transfer/import and local Ready.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile, realpath} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {inspectCoopWorld, cooperativeKingdoms} from './inspect-native-coop-world.mjs';
import {inspectSavedReturnProposal} from './inspect-native-coop-saved-return-proposal.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {compareLaterProgressGameplay} from './lib/coop-later-progress-checkpoint-state.mjs';
import {compareSavedReturnGameplay} from './lib/coop-saved-return-checkpoint-state.mjs';
import {stoppedFileSource, workspace} from './lib/stopped-entity-io.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function bounded(path, cap = 2 * 1024 * 1024) {
  assert.equal(await realpath(path), path);
  const source = await stoppedFileSource(path); assert.ok(source.size <= cap);
  const bytes = Buffer.alloc(source.size);
  for (let n = 0; n < bytes.length; n += 4096)
    bytes.set(await source.readAt(n, Math.min(4096, bytes.length - n)), n);
  return bytes;
}
async function copied(row, cap) {
  assert.ok(row); const bytes = await bounded(row.copy ?? row.path, cap);
  assert.equal(bytes.length, row.bytes); assert.equal(sha(bytes), row.sha256); return bytes;
}
const words = bytes => Array.from({length: bytes.length / 4}, (_, i) => bytes.readUInt32LE(i * 4));
function lines(bytes, count) {
  const text = bytes.toString('ascii');
  assert.ok(Buffer.from(text, 'ascii').equals(bytes) && /^[\x20-\x7e\n]+$/.test(text) && text.endsWith('\n'));
  const fields = text.slice(0, -1).split('\n'); assert.equal(fields.length, count); return fields;
}
export async function inspectSavedReturnRecipient(name, {committed = false} = {}) {
  const report = resolve(name), raw = await bounded(report), m = JSON.parse(raw);
  const startup = await inspectCoopWorld(report); assert.equal(startup.originalRole, 'guest');
  for (const key of ['replaySavedReturnHostRequested', 'capturedOriginalHostLoadedDelivered',
    'capturedOriginalHostResumeDelivered', 'capturedSavedReturnBeginDelivered',
    'originalHomeCheckpointTransferCompleted', 'originalLaterTargetProgressSaved']) assert.equal(m[key], true, key);
  assert.equal(m.referenceSecondHostReadyVotesSent, committed ? 1 : 0); assert.equal(m.referenceSecondHostLoadedVotesSent, 0);
  if (committed) {
    assert.equal(m.commitSavedReturnRequested, true); assert.equal(m.capturedSavedReturnReadyDelivered, true);
  }
  assert.ok(!m.referenceError && !m.stopReason);
  const root = join(workspace, `output/native-multiplayer-lobby-${String(m.attempt).padStart(3, '0')}`);
  for (const [file, key] of [['native_coop_saved_return_replay.py', 'savedReturnReplayHelperSha256'],
    ['native_coop_saved_return_inputs.py', 'savedReturnInputHelperSha256']])
    assert.equal(sha(await bounded(join(root, file))), m[key]);
  const inputs = m.hostCompletionReplayInputs; assert.ok(inputs.length >= 23 && inputs.length <= 26);
  for (const row of inputs) {
    assert.ok(row.copy.startsWith(join(root, 'captured-host-inputs') + '/')); await copied(row);
  }
  const recorded = JSON.parse((await copied(inputs[0])).toString());
  const host = await inspectSavedReturnProposal(recorded.report);
  for (const key of ['reportSha256', 'descriptorSha256', 'capturedRequests', 'home', 'homeMarker', 'sourceClock', 'sourceFrame', 'verifierInputs'])
    assert.deepEqual(recorded[key], host[key]);
  const hostRaw = await bounded(host.report); assert.equal(sha(hostRaw), host.reportSha256);
  assert.ok((await copied(inputs[1])).equals(hostRaw));
  const h = JSON.parse(hostRaw);
  assert.equal(h.nativeExecutableSha256, m.nativeExecutableSha256);
  const stream = []; let resumed = false;
  for (const row of h.lobbyPacketMetadata) {
    const bytes = await copied(row, 65536);
    if (bytes.readUInt32LE(0) === 256 && bytes.readUInt32LE(4) === 4) {
      assert.equal(resumed, false); resumed = true;
    }
    if (resumed) stream.push({row, bytes});
  }
  assert.ok(stream.length >= 16 && stream.length <= 19);
  assert.equal(inputs.length, stream.length + 7);
  for (const [i, item] of stream.entries()) {
    assert.equal(inputs[i + 4].source, item.row.copy);
    assert.ok((await copied(inputs[i + 4])).equals(item.bytes));
  }
  assert.deepEqual(m.capturedOriginalHostResumeInputs, stream.map(s => ({bytes: s.bytes.length, sha256: sha(s.bytes)})));
  assert.ok((await copied(inputs.at(-1))).equals(await copied(host.home)));
  const secondBegin = await copied(host.capturedRequests[0], 2048), descriptor = secondBegin.subarray(32);
  assert.equal(sha(descriptor), host.descriptorSha256);
  assert.deepEqual(m.replayedSavedReturnBeginBody, {source: host.capturedRequests[0].copy,
    bytes: secondBegin.length - 20, sha256: sha(secondBegin.subarray(20))});
  const fields = lines(descriptor, 22);
  assert.equal(m.observedSavedReturnEvents.length, committed ? 2 : 1);
  const event = m.observedSavedReturnEvents[0], eventBytes = await copied(event, 2048);
  assert.equal(event.copy, join(root, 'owned-lobby-packets/saved-return-prepared-000.bin'));
  assert.deepEqual([event.serial, event.stage, event.players, event.descriptorSha256], [2, 1, [1, 2], host.descriptorSha256]);
  assert.deepEqual(words(eventBytes.subarray(0, 12)), [2, 1, descriptor.length]);
  assert.ok(eventBytes.subarray(12, 12 + descriptor.length).equals(descriptor));
  assert.deepEqual(words(eventBytes.subarray(12 + descriptor.length)), [2, 1, 2]);
  if (committed) {
    const commit = m.observedSavedReturnEvents[1], bytes = await copied(commit, 2048);
    assert.equal(commit.copy, join(root, 'owned-lobby-packets/saved-return-committed-001.bin'));
    assert.deepEqual([commit.serial,commit.stage,commit.players,commit.descriptorSha256],[2,2,[1,2],host.descriptorSha256]);
    assert.deepEqual(words(bytes.subarray(0,12)),[2,2,descriptor.length]);
    assert.ok(bytes.subarray(12,12+descriptor.length).equals(descriptor));
    assert.deepEqual(words(bytes.subarray(12+descriptor.length)),[2,1,2]);
    const ready = await copied(host.capturedRequests[1],2048);
    assert.deepEqual(m.replayedSavedReturnReadyBody,{source:host.capturedRequests[1].copy,
      bytes:ready.length-20,sha256:sha(ready.subarray(20))});
  }
  const protocol = [], transferred = [], nativeReady = [], nativeLoaded = [];
  assert.ok(m.proposalProtocolRequests.length <= 128);
  for (const [i, row] of m.proposalProtocolRequests.entries()) {
    assert.equal(row.copy, join(root, `owned-lobby-packets/proposal-rpc-${String(i).padStart(3, '0')}.bin`));
    const bytes = await copied(row, 16384 + 40);
    assert.deepEqual(words(bytes.subarray(0, 24)), [0x31525044, 1, row.op, row.request, 0, row.action]);
    assert.ok(row.request > 0 && [1, 2].includes(row.sender)); assert.equal(row.host, row.sender === 1);
    if (row.op === 12) {
      if (row.action === 0) {protocol.push([row.sender, 12, 0, 0]); continue;}
      const serial = bytes.readUInt32LE(24), length = bytes.readUInt32LE(28);
      assert.equal(bytes.length, length + 32); assert.ok([1, 2].includes(serial));
      if (serial === 2) {
        assert.ok(bytes.subarray(32).equals(descriptor));
        if (row.sender === 2 && row.action === 2) nativeReady.push(row);
        if (row.sender === 2 && row.action === 3) nativeLoaded.push(row);
      } else assert.equal(sha(bytes.subarray(32)), h.observedProposalEvents[0].descriptorSha256);
      protocol.push([row.sender, 12, row.action, serial]);
    } else {
      assert.equal(row.op, 13);
      const body = bytes.subarray(20), serial = body.readUInt32LE(4);
      if (row.action === 6) {assert.equal(serial, 0); protocol.push([row.sender, 13, 6, 0]); continue;}
      assert.equal(serial, 2);
      protocol.push([row.sender, 13, row.action, serial]);
      if (row.action === 0) {assert.equal(row.sender, 2); assert.ok(body.subarray(12).equals(descriptor));}
      else {
        assert.equal(body.readUInt32LE(8), row.sender === 1 ? 2 : 1);
        if (row.action === 1) {assert.equal(body.length, 16); assert.equal(body.readUInt32LE(12), host.home.bytes);}
        if (row.action === 2) {
          const size = body.readUInt32LE(16); assert.equal(body.length, size + 20);
          assert.equal(body.readUInt32LE(12), transferred.length + 1); transferred.push(body.subarray(20));
        }
      }
    }
  }
  const expected = [[1,12,0,0],[1,13,6,0],[2,12,0,0],[2,13,6,0],
    [1,12,1,1],[1,12,2,1],[2,12,2,1],[2,12,3,1],[1,12,3,1],[1,12,1,2],
    [2,13,0,2],[1,13,1,2],[2,13,3,2]];
  const homeBytes = await copied(host.home);
  for (let n = 0; n < Math.ceil(homeBytes.length / 16384); ++n) expected.push([1,13,2,2], [2,13,3,2]);
  expected.push([1,13,4,2], [2,13,5,2], [2,12,2,2]);
  if (committed) expected.push([1,12,2,2],[2,12,3,2]);
  assert.deepEqual(protocol, expected);
  assert.equal(nativeReady.length,1); assert.equal(nativeLoaded.length,committed ? 1 : 0);
  assert.ok(Buffer.concat(transferred).equals(homeBytes));
  assert.equal(m.originalHomeCheckpointTransferredBytes, homeBytes.length);
  assert.equal(m.originalHomeCheckpointTransferSha256, sha(homeBytes));
  const checkpointEvents = m.savedReturnCheckpointEvents;
  assert.equal(checkpointEvents.length, Math.ceil(homeBytes.length / 16384) + 3);
  for (const [i, row] of checkpointEvents.entries()) {
    assert.equal(row.copy, join(root, `owned-lobby-packets/saved-return-checkpoint-event-${String(i).padStart(3, '0')}.bin`));
    const bytes = await copied(row, 20);
    assert.deepEqual(words(bytes), i === 0 ? [0,2,2,1] :
      [i === checkpointEvents.length - 1 ? 5 : 3, 2, 2, 1, i - 1]);
  }
  const prefix = join(m.profile, 'Documents/My Games/MajestyHD/SaveGame/CoopTransitions_native-terrain-fixture_');
  assert.equal(m.savedReturnSourceFiles.length, 2);
  const current = m.savedReturnSourceFiles.find(row => row.path === prefix + '1_0_0.GMP');
  const currentMarker = m.savedReturnSourceFiles.find(row => row.path === prefix + '1_0.checkpoint');
  await copied(current);
  assert.deepEqual(lines(await copied(currentMarker, 768), 12), ['majesty-coop-checkpoint-v1', '0', fields[1], fields[8], fields[9],
    '1', '0', String(host.sourceFrame), String(host.sourceClock), '1', String(current.bytes), current.sha256]);
  const importedMarker = m.proposalSourceFiles.find(row => row.path === prefix + '0_0.checkpoint');
  const importedFields = lines(await copied(importedMarker, 768), 12);
  assert.ok(importedFields[1] === '0' || importedFields[1] === '1');
  const importedHome = m.proposalSourceFiles.find(row => row.path === prefix + '0_0_' + importedFields[1] + '.GMP');
  assert.ok((await copied(importedHome)).equals(homeBytes));
  assert.deepEqual(importedFields, ['majesty-coop-checkpoint-v1', importedFields[1], fields[1], fields[8], fields[9],
    '0', '0', '0', '550', '1', String(homeBytes.length), sha(homeBytes)]);
  await copied(m.laterTargetProgressSnapshot);
  const earlierComparison = await compareLaterProgressGameplay(await connectedWorldState(h.laterTargetProgressSnapshot.path),
    await connectedWorldState(m.laterTargetProgressSnapshot.path), 2);
  const sourceComparison = await compareSavedReturnGameplay(await connectedWorldState(host.current.path), await connectedWorldState(current.path), 2);
  const kingdoms = await cooperativeKingdoms(current.path, [0, 1]);
  assert.deepEqual(kingdoms.map(k => k.buildings.length), [4, 4]);
  assert.ok(kingdoms.every(k => k.mobileActors.length >= 1));
  const log = (await bounded(join(root, 'native.log'), 4 * 1024 * 1024)).toString();
  assert.equal(log.split('\n').filter(l => l === '[coop-load] Ready epoch=1 serial=2 imported=1 local-source-revision=1').length, 1);
  assert.ok(!/\[coop-(?:load|transfer)\] Rejected|\[coop-load\] Resumed.*serial=2/.test(log));
  if (committed) {
    for (const marker of ['[coop-load] Saved source teardown epoch=1 serial=2 pause-held=1 loaded=1',
      '[coop-load] Attached epoch=1 serial=2 slot=1','[coop-load] Held epoch=1 serial=2 slot=1 clock=550',
      '[coop-load] Loaded epoch=1 serial=2 slot=1'])
      assert.equal(log.split('\n').filter(l=>l===marker).length,1,marker);
  } else assert.ok(!/\[coop-load\] (?:Attached|Loaded).*serial=2/.test(log));
  return {version: 1, report, reportSha256: sha(raw), sourceHostReport: host.report,
    sourceHostReportSha256: host.reportSha256, descriptorSha256: host.descriptorSha256,
    originalRecipientSecondPauseCheckpointQualified: true, actualCheckpointTransferImportQualified: true,
    originalRecipientSecondReadyExecutedQualified: true, matchingPausedCurrentGameplayQualified: true,
    sourceClock: host.sourceClock, sourceFrame: host.sourceFrame, current, currentMarker, importedHome, importedMarker,
    capturedRecipientRequests: nativeReady, earlierComparison, sourceComparison, kingdoms,
    originalRecipientSavedReaderLoadedQualified: committed,
    capturedRecipientLoadedRequests: nativeLoaded,
    referenceSecondReadyVotes: committed ? 1 : 0, referenceSecondLoadedVotes: 0, savedReturnCompleted: false,
    livePairedSynchronizationQualified: false, browserUsed: false, goalComplete: false,
    verifierInputs: {...startup.verifierInputs, ...Object.fromEntries(await Promise.all([
      'scripts/inspect-native-coop-saved-return-recipient.mjs', 'scripts/inspect-native-coop-saved-return-loaded.mjs',
      'scripts/lib/coop-saved-return-checkpoint-state.mjs'
    ].map(async file => [file, sha(await readFile(join(workspace, file)))])))}
  };
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  try {
    assert.equal(process.argv.length, 4); const proof = await inspectSavedReturnRecipient(process.argv[2]);
    await writeFile(resolve(process.argv[3]), JSON.stringify(proof, null, 2) + '\n', {flag: 'wx'});
    console.log(JSON.stringify({recipientSecondReady: true, checkpointTransferred: true, sourceClock: proof.sourceClock, matchingRecordedSource: true, returnCompleted: false}));
  } catch (e) {
    console.error(JSON.stringify({error: e.name, message: String(e.message).split('\n')[0], at: e.stack?.split('\n').filter(l => l.trim().startsWith('at ')).slice(0, 2)})); process.exitCode = 1;
  }
}
