import test from 'node:test';
import assert from 'node:assert/strict';
import {originalHomeTaskTrace} from '../scripts/lib/home-task-trace.mjs';

const lines = [
  '[streaming] Home task installed agent=27 unit=502 attributes=57 contexts=12 active=warrior_tree result=pass',
  '[streaming] Home task requested agent=27 unit=502 home=7 target=7 task=go_home function=use_building clock=45550 attributes=57 contexts=12 boundary=dispatch before-guard=1',
  '[streaming] Home task snapshot stage=before clock=45550 fingerprint=7218a22ceb4f9cd4 saved=1 result=pass',
  '[streaming] Home task snapshot stage=after clock=46550 fingerprint=7218a22ceb4f9cd4 saved=1 result=pass',
  '[streaming] Home task original-building agent=27 unit=502 called=1',
  '[streaming] Home task resumed agent=27 unit=502 clock=46600 held-calls=20 original-returned=1 result=pass',
  '[streaming] Home task continuation clock=46600 home=7 target=7 task=go_home function=travel_to saved=1 result=pass',
  '[streaming] Home task gate-complete agent=27 unit=502 home=7 parent=0 held-calls=20 resumed-calls=1 original-building-calls=1 skipped-dispatches=1 hooks-removed=1 entry-qualified=0 travel-qualified=0 result=pass',
  'all expectations met',
];
const log = lines.join('\n');
test('checks the ordered script hold and original resume without qualifying physical travel', () => {
  const r = originalHomeTaskTrace(log);
  assert.equal(r.afterClock - r.beforeClock, 1000);
  assert.equal(r.heldCalls, 20); assert.equal(r.hooksRemoved, true);
  assert.equal(r.observedParentUnitId, 0);
  assert.equal(r.buildingEntryQualified, false); assert.equal(r.remoteTravelQualified, false);
});
test('missing, duplicated, malformed or reordered boundary events cannot qualify', () => {
  for (let i = 0; i < lines.length; ++i) {
    assert.throws(() => originalHomeTaskTrace(lines.filter((_, j) => i !== j).join('\n')));
    if (i < lines.length - 1) assert.throws(() => originalHomeTaskTrace(log + '\n' + lines[i]));
  }
  const reordered = [...lines]; [reordered[4], reordered[5]] = [reordered[5], reordered[4]];
  assert.throws(() => originalHomeTaskTrace(reordered.join('\n')));
  assert.throws(() => originalHomeTaskTrace(log.replace('boundary=dispatch', 'boundary=unknown')));
});
test('changed targets, fingerprints, clocks, counts and missing cleanup fail closed', () => {
  for (const [from, to] of [['target=7', 'target=8'], ['clock=46550', 'clock=46000'],
    ['clock=46600', 'clock=46500'], ['held-calls=20', 'held-calls=0'],
    ['skipped-dispatches=1', 'skipped-dispatches=17'], ['hooks-removed=1', 'hooks-removed=0'],
    ['original-returned=1', 'original-returned=0'], ['parent=0', 'parent=42'],
    ['entry-qualified=0', 'entry-qualified=1']]) assert.throws(() => originalHomeTaskTrace(log.replace(from, to)));
  assert.throws(() => originalHomeTaskTrace(log.replace('stage=after clock=46550 fingerprint=7218a22ceb4f9cd4',
    'stage=after clock=46550 fingerprint=7218a22ceb4f9cd5')));
  assert.throws(() => originalHomeTaskTrace(log + '\nresult=fail'));
  assert.throws(() => originalHomeTaskTrace('x'.repeat(1024 * 1024 + 1)));
});
