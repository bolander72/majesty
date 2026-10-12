// Independently bind a bounded actual peer-input prefix; never synthesize packets.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {inspectExtendedTargetProgressPair} from '../inspect-native-coop-extended-target-progress.mjs';
import {stoppedFileSource} from './stopped-entity-io.mjs';
const sha = b => createHash('sha256').update(b).digest('hex');
async function copied(row, maximum = 2 * 1024 * 1024) {
  const source = await stoppedFileSource(row.copy ?? row.path); assert.ok(source.size <= maximum);
  const bytes = Buffer.alloc(source.size);
  for (let n = 0; n < bytes.length; n += 4096) bytes.set(await source.readAt(n, Math.min(4096, bytes.length - n)), n);
  assert.equal(bytes.length, row.bytes); assert.equal(sha(bytes), row.sha256); return bytes;
}
function frame(bytes) {
  assert.equal(bytes.length, 20); assert.deepEqual([bytes.readUInt32LE(0), bytes.readUInt32LE(4)], [256, 5]);
  const data = Buffer.from(bytes.subarray(8)).map(x => x ^ 49);
  assert.deepEqual([data.readUInt32LE(4), data.readUInt32LE(8)], [0, 50]); return data.readUInt32LE(0);
}
export async function inspectTargetPrefixCustody(m) {
  assert.equal(m.targetGuestInputPrefix, 14);
  assert.equal(m.extendedTargetGuestInputsRequested, true); assert.equal(m.timedTargetGuestInputsRequested, true);
  assert.equal(m.pacedTargetGuestInputsRequested, false); assert.equal(m.originalGuestTargetInputsDelivered, true);
  assert.equal(m.targetGuestInputCadenceMs, 100);
  const root = resolve(`output/native-multiplayer-lobby-${String(m.attempt).padStart(3, '0')}`);
  const rows = m.targetGuestInputReplaySources; assert.equal(rows.length, 16);
  const data = [];
  for (const [i, row] of rows.entries()) {
    assert.ok(row.copy.startsWith(join(root, 'captured-host-inputs', `target-guest-source-${String(i).padStart(3, '0')}-`)));
    data.push(await copied(row));
  }
  const recorded = JSON.parse(data[0]), pair = await inspectExtendedTargetProgressPair(recorded.host.report, recorded.guest.report);
  for (const side of ['host', 'guest']) for (const key of ['reportSha256', 'snapshot', 'verifierInputs'])
    assert.deepEqual(recorded[side][key], pair[side][key]);
  assert.equal(pair.guest.originalResumeProof.descriptorSha256, m.observedProposalEvents[0].descriptorSha256);
  assert.equal(rows[1].source, pair.guest.report); assert.equal(sha(data[1]), pair.guest.reportSha256);
  const guest = JSON.parse(data[1]); assert.equal(guest.nativeExecutableSha256, m.nativeExecutableSha256);
  assert.equal(guest.networkManifestSha256, m.networkManifestSha256);
  assert.ok(guest.lobbyPacketMetadata.length <= 128);
  const originals = [];
  for (const [i, row] of guest.lobbyPacketMetadata.entries()) {
    assert.deepEqual([row.sender, row.recipient, row.sequence], [2, 1, i + 1]);
    const bytes = await copied(row, 65536);
    if (bytes.readUInt32LE(0) === 256 && bytes.readUInt32LE(4) === 5) originals.push({row, bytes, frame: frame(bytes)});
  }
  const count = originals.length - 6;
  assert.ok(count >= 14 && count <= 32); assert.equal(m.targetGuestInputSourceFrameCount, count);
  assert.deepEqual(originals.map(x => x.frame), [10,12,14,16,18,20, ...Array.from({length: count}, (_, i) => 10 + 2 * i)]);
  for (const [i, item] of originals.slice(6, 20).entries()) {
    assert.equal(rows[i + 2].source, item.row.copy); assert.ok(data[i + 2].equals(item.bytes));
  }
  const sent = m.replayedGuestTargetInputPackets, acks = m.targetGuestInputServerAcks, cadence = m.targetGuestInputSendCadence;
  assert.equal(sent.length, 14); assert.equal(acks.length, 14); assert.equal(cadence.length, 14);
  const sourceTail = m.replayedGuestInputPackets.at(-1).sequence;
  for (let i = 0; i < 14; ++i) {
    const sequence = sourceTail + i + 1;
    assert.deepEqual(sent[i], {sequence, bytes: data[i + 2].length, sha256: sha(data[i + 2])});
    assert.equal(acks[i].sequence, sequence);
    assert.equal(acks[i].copy, join(root, `owned-lobby-packets/target-input-ack-${String(i).padStart(3, '0')}.bin`));
    const bytes = await copied(acks[i], 24); assert.equal(bytes.length, 24);
    assert.deepEqual(Array.from({length: 6}, (_, n) => bytes.readUInt32LE(n * 4)), [0x31525044,1,108,0,0,sequence]);
    assert.equal(cadence[i].sequence, sequence); assert.equal(cadence[i].guestInputFrame, 10 + 2 * i);
    assert.ok(Number.isInteger(cadence[i].monotonicNs) && cadence[i].monotonicNs > 0);
    if (i) assert.ok(cadence[i].monotonicNs - cadence[i - 1].monotonicNs >= 99000000);
  }
  assert.deepEqual(m.originalGuestTargetInputFrames, Array.from({length: 14}, (_, i) => 10 + i * 2));
  return {actualSourceFrames: count, admittedUnchangedPrefixPackets: 14, actualRelayAcknowledgements: 14,
    sourceRecordedPair: {host: pair.host.report, guest: pair.guest.report}, originalBytesPreserved: true};
}
