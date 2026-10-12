// Admission for a stopped original guest's incoming pause component only.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

function reviewedWindow() {
  const words = [[0, 1, 50, 48, 1, 10, 0, 1, 24, 9, 0, 1, 0, 50, 0, 0],
    ...[12, 14, 16, 18, 20].map(frame => [frame, 0, 50])];
  return words.map(body => {
    const p = Buffer.alloc(8 + body.length * 4);
    p.writeUInt32LE(0x100);p.writeUInt32LE(5, 4);
    body.forEach((word, i) => p.writeUInt32LE(word, 8 + 4 * i));
    for (let i = 8; i < p.length; ++i) p[i] ^= 0x31;
    return {bytes: p.length, sha256: createHash('sha256').update(p).digest('hex')};
  });
}
export function inspectIncomingHostPause(m, log, snapshots, {readbackComponent = false} = {}) {
  assert.equal(typeof readbackComponent, 'boolean');
  for (const key of ['nativeIncomingHostPauseObservationRequested',
    'recordedHostPauseReplayRequested', 'recordedHostReplay',
    'capturedHostPauseInputWindowDelivered', 'originalGuestReadyObserved',
    'originalGuestGoStatusObserved', 'capturedHostGoStatusDelivered'])
    assert.equal(m[key], true, key);
  for (const key of ['recordedGuestReplay', 'nativePauseWorldRequested',
    'nativeProductionPauseActionRequested',
    'liveSecondOriginalEngine', 'browserUsed']) assert.equal(m[key], false, key);
  assert.equal(m.nativeReadbackWorldRequested, readbackComponent);
  assert.deepEqual(snapshots.map(s => ({frame:s.frame, clock:s.clock})),
    [{frame:0, clock:0}, {frame:11, clock:550}]);
  assert.equal(m.pausedHostInspection.role, 'host');
  assert.equal(m.pausedHostInspection.complete, true);
  assert.deepEqual(m.pausedHostInspection.snapshots,
    [{frame:0, clock:0}, {frame:11, clock:550}]);
  assert.ok(m.replayInputs.some(input => input.source === m.replaySourceReport &&
    input.sha256 === m.pausedHostInspection.reportSha256));
  assert.deepEqual(m.capturedHostPauseInputWindow, reviewedWindow());
  for (const record of m.capturedHostPauseInputWindow)
    assert.equal(m.replayInputs.filter(input => input.bytes === record.bytes &&
      input.sha256 === record.sha256).length, 1, 'Preserve each exact host input once');
  for (const marker of [
    '[coop-pause-fixture] Settled original pause epoch=1 local=2 slot=1 owner=1 frame=11 clock=550 phase=7 pending=0 live-second-engine=0',
    '[coop-incoming-pause-fixture] Settled original host command epoch=1 local=2 slot=1 owner=1 frame=11 clock=550 phase=7 pending=0 source-party-same=1 context-bound=1 local-pause-queued=0 live-second-engine=0'])
    assert.equal(log.split('\n').filter(line => line === marker).length, 1);
  assert.ok(!log.includes('[coop-pause-fixture] Production pause action armed'));
  assert.ok(!log.includes('[coop-pause-fixture] Original pause queued'));
  return {originalGuestIncomingHostPauseSavedQualified:true,
    localNetworkPlayer:2, localKingdomSlot:1, pauseOwner:1, frame:11, clock:550};
}
