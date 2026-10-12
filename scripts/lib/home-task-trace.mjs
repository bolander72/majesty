import assert from 'node:assert/strict';

// This checks an owned native script-gate trial. It never qualifies movement,
// building entry, a remote home or browser execution.
export function originalHomeTaskTrace(log) {
  assert.ok(typeof log === 'string' && log.length <= 1024 * 1024, 'Unbounded task log');
  assert.ok(log.includes('all expectations met'));
  assert.ok(!/result=fail|SIGSEGV|abort from|undeliverable call(?!s: none)/i.test(log));
  function one(label, pattern) {
    const matches = [...log.matchAll(pattern)];
    assert.equal(matches.length, 1, label);
    assert.equal(log.split(`[streaming] Home task ${label} `).length - 1, 1, label);
    return matches[0];
  }
  function integer(value, minimum = 0, maximum = 0xffffffff) {
    const n = Number(value);
    assert.ok(Number.isSafeInteger(n) && n >= minimum && n <= maximum);
    return n;
  }
  const installed = one('installed', /^\[streaming\] Home task installed agent=27 unit=502 attributes=57 contexts=12 active=warrior_tree result=pass$/gm);
  const request = one('requested', /^\[streaming\] Home task requested agent=27 unit=502 home=7 target=7 task=go_home function=use_building clock=(\d+) attributes=57 contexts=12 boundary=dispatch before-guard=1$/gm);
  const snapshots = [...log.matchAll(/^\[streaming\] Home task snapshot stage=(before|after) clock=(\d+) fingerprint=([0-9a-f]{16}) saved=1 result=pass$/gm)];
  assert.equal(log.split('[streaming] Home task snapshot ').length - 1, 2);
  assert.deepEqual(snapshots.map(r => r[1]), ['before', 'after']);
  const building = one('original-building', /^\[streaming\] Home task original-building agent=27 unit=502 called=1$/gm);
  const resumed = one('resumed', /^\[streaming\] Home task resumed agent=27 unit=502 clock=(\d+) held-calls=(\d+) original-returned=1 result=pass$/gm);
  const continuation = one('continuation', /^\[streaming\] Home task continuation clock=(\d+) home=7 target=7 task=go_home function=travel_to saved=1 result=pass$/gm);
  const complete = one('gate-complete', /^\[streaming\] Home task gate-complete agent=27 unit=502 home=7 parent=(0|469) held-calls=(\d+) resumed-calls=(\d+) original-building-calls=(\d+) skipped-dispatches=(\d+) hooks-removed=1 entry-qualified=0 travel-qualified=0 result=pass$/gm);
  const sequence = [installed, request, ...snapshots, building, resumed, continuation, complete];
  for (let i = 1; i < sequence.length; ++i) assert.ok(sequence[i].index > sequence[i - 1].index, 'Task event order');
  const requestClock = integer(request[1], 1), beforeClock = integer(snapshots[0][2], 1);
  const afterClock = integer(snapshots[1][2], 1), resumeClock = integer(resumed[1], 1);
  assert.ok(beforeClock >= requestClock && beforeClock - requestClock <= 50);
  assert.ok(afterClock - beforeClock >= 1000 && afterClock - beforeClock <= 1050);
  assert.ok(resumeClock >= afterClock && resumeClock - afterClock <= 50);
  const continuationClock = integer(continuation[1], 1);
  assert.ok(continuationClock >= resumeClock && continuationClock - resumeClock <= 50);
  assert.equal(snapshots[0][3], snapshots[1][3], 'Held context fingerprint changed');
  const heldCalls = integer(resumed[2], 1, 4096);
  assert.equal(integer(complete[2], 1, 4096), heldCalls);
  const resumedCalls = integer(complete[3], 1, 4096);
  const originalBuildingCalls = integer(complete[4], 1, 4096);
  const skippedDispatches = integer(complete[5], 1, 16);
  return {requestClock, beforeClock, afterClock, resumeClock, continuationClock, fingerprint: snapshots[0][3],
    heldCalls, resumedCalls, originalBuildingCalls, skippedDispatches,
    observedParentUnitId: integer(complete[1]), hooksRemoved: true,
    buildingEntryQualified: false, remoteTravelQualified: false};
}
