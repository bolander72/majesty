import assert from 'node:assert/strict';
import {test} from 'node:test';
import {inspectIncomingHostPause} from '../scripts/lib/incoming-host-pause.mjs';

// Original packet fingerprints from stopped native102/103. Only the admission
// record/log below is synthetic; this suite makes no game execution claim.
const hashes = ['10872ad1b6407a85f1a30b88f5bc8c33d9cb4d1901e661203b3261ea23f7a2cb',
  'f6ca94d8abe567d742241613576be7242a54c7e3d93a958cba995582c5b1630f',
  '1e087d54ac53fb37303084a59458399c89bca8ef7bb7a6c0f3394766487bf3bc',
  '913fc4aa9e3e1c075be0d69dd016980c3a5ceeca40ff3967f22eba92f37fef41',
  '4f40ecd161421769a45067944b77b49aa370dc81bbae1dee982dd4b74fb6d03e',
  '7c77f9b90e4917b48f4f0b847e524e31041190f12bea40af20ef6e39df269aad'];
const snapshots = [{frame:0, clock:0}, {frame:11, clock:550}];
const log = '[coop-pause-fixture] Settled original pause epoch=1 local=2 slot=1 owner=1 frame=11 clock=550 phase=7 pending=0 live-second-engine=0\n' +
  '[coop-incoming-pause-fixture] Settled original host command epoch=1 local=2 slot=1 owner=1 frame=11 clock=550 phase=7 pending=0 source-party-same=1 context-bound=1 local-pause-queued=0 live-second-engine=0\n';
function fixture() {
  const window = hashes.map((sha256, i) => ({bytes:i ? 20 : 72, sha256}));
  return {nativeIncomingHostPauseObservationRequested:true,
    recordedHostPauseReplayRequested:true, recordedHostReplay:true,
    capturedHostPauseInputWindowDelivered:true, originalGuestReadyObserved:true,
    originalGuestGoStatusObserved:true, capturedHostGoStatusDelivered:true,
    recordedGuestReplay:false, nativePauseWorldRequested:false,
    nativeProductionPauseActionRequested:false, nativeReadbackWorldRequested:false,
    liveSecondOriginalEngine:false, browserUsed:false,
    pausedHostInspection:{role:'host', complete:true, snapshots:structuredClone(snapshots),
      reportSha256:'a'.repeat(64)}, replaySourceReport:'/synthetic/source.json',
    replayInputs:[{source:'/synthetic/source.json',sha256:'a'.repeat(64)}, ...window],
    capturedHostPauseInputWindow:window};
}
test('admit precisely bound synthetic guest pause evidence', () => {
  assert.equal(inspectIncomingHostPause(fixture(), log, snapshots)
    .originalGuestIncomingHostPauseSavedQualified, true);
});
test('refuse missing or non-boolean admission and foreign execution scopes', () => {
  const base = fixture();
  for (const key of Object.keys(base).filter(key => typeof base[key] === 'boolean'))
    for (const value of [undefined, !base[key], Number(base[key])]) {
      const m = fixture();m[key] = value;
      assert.throws(() => inspectIncomingHostPause(m, log, snapshots), key);
    }
});
test('refuse wrong kingdom, owner, context, phase and command source log', () => {
  for (const [before, after] of [['local=2','local=1'], ['slot=1','slot=0'],
    ['owner=1','owner=2'], ['phase=7','phase=3'], ['pending=0','pending=7'],
    ['context-bound=1','context-bound=0'], ['local-pause-queued=0','local-pause-queued=1']])
    assert.throws(() => inspectIncomingHostPause(fixture(), log.replaceAll(before,after), snapshots));
  assert.throws(() => inspectIncomingHostPause(fixture(), log + log, snapshots));
  assert.throws(() => inspectIncomingHostPause(fixture(), log +
    '[coop-pause-fixture] Production pause action armed', snapshots));
});
test('refuse reordered, changed, duplicated or unpreserved original inputs', () => {
  for (const mutate of [m => m.capturedHostPauseInputWindow.reverse(),
    m => m.capturedHostPauseInputWindow[0].sha256 = 'b'.repeat(64),
    m => m.capturedHostPauseInputWindow.pop(),
    m => m.replayInputs.pop(), m => m.replayInputs.push(m.replayInputs[1]),
    m => m.pausedHostInspection.reportSha256 = 'b'.repeat(64),
    m => m.pausedHostInspection.complete = false]) {
    const m = fixture();mutate(m);
    assert.throws(() => inspectIncomingHostPause(m, log, snapshots));
  }
});
test('refuse a snapshot before settled pause or a different clock/frame', () => {
  for (const after of [{frame:10,clock:500}, {frame:11,clock:500}, {frame:12,clock:550}])
    assert.throws(() => inspectIncomingHostPause(fixture(), log, [snapshots[0],after]));
});
test('component admission is explicit and never substitutes for complete startup', () => {
  const m = fixture();m.nativeReadbackWorldRequested = true;
  assert.throws(() => inspectIncomingHostPause(m, log, snapshots));
  assert.equal(inspectIncomingHostPause(m, log, snapshots, {readbackComponent:true})
    .originalGuestIncomingHostPauseSavedQualified, true);
  for (const readbackComponent of [1,'true',null])
    assert.throws(() => inspectIncomingHostPause(m, log, snapshots, {readbackComponent}));
});
