import test from 'node:test';
import assert from 'node:assert/strict';
import {originalHomeMotionTrace, verifyHeroMotionRecords} from '../scripts/lib/home-motion-trace.mjs';

const log = [
  '[streaming] Home task installed agent=27 unit=502 attributes=57 contexts=12 active=warrior_tree result=pass',
  '[streaming] Home task requested agent=27 unit=502 home=7 target=7 task=go_home function=use_building clock=26250 attributes=57 contexts=12 boundary=dispatch before-guard=1',
  '[streaming] Home task snapshot stage=before clock=26250 fingerprint=aafab0ffc2130a14 saved=1 result=pass',
  '[streaming] Home task snapshot stage=after clock=27250 fingerprint=aafab0ffc2130a14 saved=1 result=pass',
  '[streaming] Home task original-building agent=27 unit=502 called=1',
  '[streaming] Home task resumed agent=27 unit=502 clock=27300 held-calls=20 original-returned=1 result=pass',
  '[streaming] Home task continuation clock=27300 home=7 target=7 task=go_home function=travel_to saved=1 result=pass',
  '[streaming] Home motion held-before clock=27300 agent=27 unit=502 position=7045120,589824,126866,215,18 original-saved=1 result=pass',
  '[streaming] Home motion held-after clock=28300 agent=27 unit=502 command-held=40 agent-held=20 other-delegated=265 original-saved=1 result=pass',
  '[streaming] Home motion resumed clock=29300 agent=27 unit=502 command-returned=2 parent=469 position=7045120,589824,126866,215,18 original-saved=1 result=pass',
  '[streaming] Home task gate-complete agent=27 unit=502 home=7 parent=469 held-calls=20 resumed-calls=2 original-building-calls=2 skipped-dispatches=1 hooks-removed=1 entry-qualified=0 travel-qualified=0 result=pass',
  'all expectations met',
].join('\n');

test('requires original resume, other-unit delegation and an ordered one-second native hold', () => {
  const r = originalHomeMotionTrace(log);
  assert.deepEqual([r.commandsHeld, r.agentsHeld, r.otherCommandsDelegated, r.commandsReturned], [40, 20, 265, 2]);
  assert.equal(r.resumedParentUnitId, 469); assert.equal(r.arbitraryDurationSuspensionQualified, false);
  assert.equal(r.remoteTravelQualified, false);
});
test('missing cleanup, stalled clocks, zero calls, missing snapshots and duplicate motion events refuse', () => {
  for (const [from, to] of [['command-held=40', 'command-held=0'], ['agent-held=20', 'agent-held=0'],
    ['other-delegated=265', 'other-delegated=0'], ['command-returned=2', 'command-returned=0'],
    ['clock=28300', 'clock=27300'], ['clock=29300', 'clock=28300'], ['hooks-removed=1', 'hooks-removed=0']])
    assert.throws(() => originalHomeMotionTrace(log.replace(from, to)));
  for (const line of log.split('\n').filter(s => s.includes('Home motion '))) {
    assert.throws(() => originalHomeMotionTrace(log.replace(line, '')));
    assert.throws(() => originalHomeMotionTrace(log + '\n' + line));
  }
});
test('stationary outdoor actors and mismatched native/GPL home-entry evidence refuse', () => {
  assert.throws(() => originalHomeMotionTrace(log.replaceAll('parent=469', 'parent=0')));
  assert.throws(() => originalHomeMotionTrace(log.replace('command-returned=2 parent=469', 'command-returned=2 parent=0')));
  assert.throws(() => originalHomeMotionTrace(log.replace('126866,215,18', '126866,256,18')));
});

function state(clock) {
  return {clock, records: {units: {502: {bytes: 442, sha256: '1'.repeat(64)}},
    agents: {27: {bytes: 1850, sha256: '2'.repeat(64)}},
    attachments: {'ORDR:502': {bytes: 336, sha256: '3'.repeat(64)}}}};
}
test('requires every complete held hero record and actual resumed native state change', () => {
  const before = state(46600), after = state(47600), resumed = state(48600);
  resumed.records.units[502].sha256 = '4'.repeat(64);
  assert.deepEqual(verifyHeroMotionRecords(before, after, resumed),
    {unitBytes: 442, agentBytes: 1850, ordersBytes: 336, completeHeldRecordsIdentical: true});
  assert.throws(() => verifyHeroMotionRecords(before, after, state(48600)));
  delete resumed.records.attachments['ORDR:502'];
  assert.throws(() => verifyHeroMotionRecords(before, after, resumed));
  assert.equal(verifyHeroMotionRecords(before, after, resumed, {enteredHome: true}).completeHeldRecordsIdentical, true);
});
test('missing or changed held units, scripts and orders cannot be hidden by stable positions', () => {
  const before = state(46600), resumed = state(48600); resumed.records.units[502].sha256 = '4'.repeat(64);
  for (const [kind, id] of [['units', 502], ['agents', 27], ['attachments', 'ORDR:502']]) {
    const bad = state(47600); bad.records[kind][id].sha256 = '0'.repeat(64);
    assert.throws(() => verifyHeroMotionRecords(before, bad, resumed));
    delete bad.records[kind][id]; assert.throws(() => verifyHeroMotionRecords(before, bad, resumed));
    const gone = structuredClone(resumed); delete gone.records[kind][id];
    assert.throws(() => verifyHeroMotionRecords(before, state(47600), gone));
  }
  assert.throws(() => verifyHeroMotionRecords(before, state(46600), resumed));
  assert.throws(() => verifyHeroMotionRecords(before, state(47600), {...resumed, clock: 47600}));
});
