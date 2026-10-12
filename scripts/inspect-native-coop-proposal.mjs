#!/usr/bin/env node
// Independently inspect a stopped production Begin/local-Ready component.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile, realpath} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {inspectCoopWorld} from './inspect-native-coop-world.mjs';
import {connectedWorldState, compareConnectedWorlds} from './lib/connected-residency.mjs';
import {stoppedFileSource, workspace} from './lib/stopped-entity-io.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
async function bounded(path, cap) {
  assert.equal(await realpath(path), path);
  const source = await stoppedFileSource(path); assert.ok(source.size <= cap);
  const bytes = Buffer.alloc(source.size);
  for (let n = 0; n < bytes.length; n += 4096)
    bytes.set(await source.readAt(n, Math.min(4096, bytes.length - n)), n);
  return bytes;
}
function lines(bytes, length) {
  const text = bytes.toString('ascii');
  assert.equal(Buffer.from(text, 'ascii').equals(bytes), true);
  assert.ok(/^[\x20-\x7e\n]+$/.test(text) && text.endsWith('\n'));
  const fields = text.slice(0, -1).split('\n'); assert.equal(fields.length, length);
  return fields;
}
export async function inspectCoopProposal(reportName) {
  const reportPath = resolve(reportName), raw = await bounded(reportPath, 1024 * 1024);
  const m = JSON.parse(raw), proof = await inspectCoopWorld(reportPath);
  assert.equal(proof.originalRole, 'host'); assert.equal(proof.scriptCompleted, true);
  assert.equal(m.nativeBeginFreshNeighborRequested, true);
  assert.equal(m.referenceProposalObserverEnabled, true);
  assert.equal(m.referenceProposalReadyVotesSent, 0); assert.equal(m.referenceProposalLoadedVotesSent, 0);
  assert.equal(m.nativeReadbackWorldRequested, false);
  assert.deepEqual(proof.snapshots.map(s => [s.frame, s.clock]), [[0, 0], [11, 550]]);
  const root = join(workspace, `output/native-multiplayer-lobby-${String(m.attempt).padStart(3, '0')}`);
  const log = (await bounded(join(root, 'native.log'), 4 * 1024 * 1024)).toString();
  for (const marker of [
    '[coop-begin-fixture] Prepared epoch=1 serial=1 local=1 slot=0 source=0_0 target=1_0 source-revision=1 frame=11 clock=550 original-source-capture=1 production-begin=1 peer-ready=0 peer-loaded=0 live-second-engine=0',
    '[coop-load] Begin epoch=1 serial=1 region=1_0 bytes=0',
    '[coop-load] Ready fresh epoch=1 serial=1 local-source-revision=1',
    '[coop-load] Source publication frozen epoch=1 serial=1 stage=1 local=1 retained=1',
    '[coop-transition] Checkpoint refused epoch=1'])
    assert.equal(log.split('\n').filter(line => line === marker).length, 1, marker);
  assert.ok(!/\[coop-load\] (?:Rejected|Attached|Loaded|Resumed|Resume queued|Committed rebuild queued)/.test(log));
  assert.ok(!/\[coop-transfer\] Rejected|\[coop-read-fixture\]|\[coop-phase2-fixture\]/.test(log));
  assert.equal(m.observedProposalEvents.length, 1, 'Require the unchanged prepared proposal');
  const event = m.observedProposalEvents[0];
  assert.deepEqual([event.serial, event.stage, event.players], [1, 1, [1, 2]]);
  assert.equal(event.copy, join(root, 'owned-lobby-packets/proposal-000.bin'));
  const eventBytes = await bounded(event.copy, 2048);
  assert.equal(eventBytes.length, event.bytes); assert.equal(sha(eventBytes), event.sha256);
  const length = eventBytes.readUInt32LE(8);
  assert.ok(length > 0 && length <= 1024 && eventBytes.length === length + 24);
  assert.deepEqual([eventBytes.readUInt32LE(0), eventBytes.readUInt32LE(4),
    eventBytes.readUInt32LE(12 + length), eventBytes.readUInt32LE(16 + length),
    eventBytes.readUInt32LE(20 + length)], [1, 1, 2, 1, 2]);
  const descriptor = eventBytes.subarray(12, 12 + length);
  assert.equal(sha(descriptor), event.descriptorSha256);
  const fields = lines(descriptor, 22);
  const rules = sha(Buffer.from('native-lobby-observation-only-v1:RULE_FRONTIER_CHAPTER=1:RULE_COOP_REGION_GENERATION=v1:RULE_COOP_WORLD=native-terrain-fixture:RULE_COOP_REGION=0_0:RULE_GAME_INVENTORY_ADAPTER=1'));
  assert.equal(m.configuredCoopChapter, 1); assert.equal(m.configuredCoopRegion, '0_0');
  const prefix = join(m.profile, 'Documents/My Games/MajestyHD/SaveGame/CoopTransitions_native-terrain-fixture_0_0');
  assert.ok(m.proposalSourceFiles.length === 2 || m.proposalSourceFiles.length === 3);
  const records = new Map(m.proposalSourceFiles.map(r => [r.path, r]));
  assert.equal(records.size, m.proposalSourceFiles.length);
  const saved = records.get(prefix + '_0.GMP'), marker = records.get(prefix + '.checkpoint');
  assert.ok(saved && marker);
  const savedBytes = await bounded(saved.path, 2 * 1024 * 1024), markerBytes = await bounded(marker.path, 768);
  assert.equal(savedBytes.length, saved.bytes); assert.equal(sha(savedBytes), saved.sha256);
  assert.equal(markerBytes.length, marker.bytes); assert.equal(sha(markerBytes), marker.sha256);
  assert.equal(lines(markerBytes, 12)[9], fields[12], 'Source checkpoint was republished after Begin');
  assert.equal(records.size, 2, 'First source capture left an unexpected second save slot');
  assert.deepEqual(lines(markerBytes, 12), ['majesty-coop-checkpoint-v1', '0', 'native-terrain-fixture',
    m.nativeFixtureContentIdentity, rules, '0', '0', '11', '550', '1', String(saved.bytes), saved.sha256]);
  assert.deepEqual(fields, ['majesty-coop-region-v1', 'native-terrain-fixture', '0', '0', '1', '0',
    '71201', '1', m.nativeFixtureContentIdentity, rules, '11', '550', '1', String(saved.bytes),
    saved.sha256, '0', '0', '0', '0', '-', '0', '0']);
  const before = await connectedWorldState(proof.snapshots[1].path);
  const captured = await connectedWorldState(saved.path);
  const sourceComparison = compareConnectedWorlds(before, captured);
  assert.ok(m.proposalRelaySnapshots.length >= 1 && m.proposalRelaySnapshots.length <= 8);
  for (const snapshot of m.proposalRelaySnapshots) {
    assert.ok(snapshot.sampledAtMs >= m.startedAtMs && snapshot.sampledAtMs <= m.finishedAtMs);
    assert.equal(snapshot.state.serial, 1); assert.equal(snapshot.state.committed, false);
    assert.deepEqual(snapshot.state.players, [1, 2]); assert.deepEqual(snapshot.state.loaded, []);
    assert.ok([[], [1]].some(value => JSON.stringify(value) === JSON.stringify(snapshot.state.ready)));
    assert.equal(snapshot.state.descriptorSha256, sha(descriptor));
  }
  assert.deepEqual(m.proposalRelaySnapshots.at(-1).state.ready, [1], 'Real host local Ready was not observed');
  assert.ok(m.proposalProtocolRequests.length >= 4 && m.proposalProtocolRequests.length <= 64);
  const nativeActions = [];
  const capturedRequests = [];
  for (const [i, row] of m.proposalProtocolRequests.entries()) {
    assert.equal(row.copy, join(root, `owned-lobby-packets/proposal-rpc-${String(i).padStart(3, '0')}.bin`));
    const wire = await bounded(row.copy, 2048);
    assert.equal(wire.length, row.bytes); assert.equal(sha(wire), row.sha256);
    assert.deepEqual([wire.readUInt32LE(0), wire.readUInt32LE(4), wire.readUInt32LE(8),
      wire.readUInt32LE(12), wire.readUInt32LE(16), wire.readUInt32LE(20)],
      [0x31525044, 1, row.op, row.request, 0, row.action]);
    assert.ok(Number.isSafeInteger(row.request) && row.request > 0);
    assert.ok(row.sender === 1 || row.sender === 2);
    assert.equal(row.host, row.sender === 1);
    if (row.op === 12) {
      if (row.action === 1 || row.action === 2) {
        assert.equal(row.sender, 1, 'Observer must not originate proposal votes');
        assert.equal(wire.readUInt32LE(24), 1);
        assert.equal(wire.readUInt32LE(28), descriptor.length);
        assert.equal(wire.length, descriptor.length + 32);
        assert.ok(wire.subarray(32).equals(descriptor));
        nativeActions.push(row.action); capturedRequests.push(row);
      } else assert.equal(row.action, 0, 'No Loaded/cancellation may be invented');
    } else {
      assert.equal(row.op, 13); assert.equal(row.action, 6);
      assert.equal(wire.readUInt32LE(24), 0);
    }
  }
  assert.deepEqual(nativeActions, [1, 2], 'Require captured original SDK Begin and local Ready bytes');
  return {version:1, originalSourceCheckpointPublicationQualified:true,
    productionFreshNeighborBeginExecutedQualified:true, productionHostLocalReadyExecutedQualified:true,
    exactSourceGameplayRetainedQualified:true, peerReadyVotes:0, peerLoadedVotes:0,
    sourceComparison, report:reportPath, reportSha256:sha(raw), sourceProof:proof,
    sourcePublicationFrozenQualified:true, originalSdkProposalRequestsPreservedQualified:true,
    capturedRequests, descriptorSha256:sha(descriptor), sourceCheckpoint:saved, marker, before, captured,
    verifierInputs:{...proof.verifierInputs,
      'scripts/inspect-native-coop-proposal.mjs':sha(await readFile(new URL(import.meta.url)))},
    peakSampledNativeRssBytes:proof.peakSampledNativeRssBytes,
    browserUsed:false, liveSecondOriginalEngine:false, committedSharedReaderCoordinatorExecuted:false,
    targetGenerated:false, sharedResumeQualified:false, pairedSynchronizationQualified:false, goalComplete:false,
    scope:'One original paused host publishes its exact full source and proposes a fresh east neighbor through production Begin/local Ready. Passive peer enables transport only and never votes. No committed generation, target load, shared resume or paired gameplay.'};
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  assert.equal(process.argv.length, 4);
  const proof = await inspectCoopProposal(process.argv[2]);
  await writeFile(resolve(process.argv[3]), JSON.stringify(proof, null, 2) + '\n', {flag:'wx'});
  console.log(JSON.stringify({productionFreshNeighborBeginExecutedQualified:true,
    productionHostLocalReadyExecutedQualified:true, exactSourceGameplayRetainedQualified:true,
    peerReadyVotes:0, peerLoadedVotes:0}));
}
