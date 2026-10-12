import assert from 'node:assert/strict';
import {originalHomeTaskTrace} from './home-task-trace.mjs';

export function originalHomeMotionTrace(log) {
  const task = originalHomeTaskTrace(log);
  function row(label, regex) {
    const matches = [...log.matchAll(regex)];
    assert.equal(matches.length, 1); assert.equal(log.split(`[streaming] Home motion ${label} `).length - 1, 1);
    return matches[0];
  }
  function number(s, min = 0, max = 0xffffffff) {
    const n = Number(s); assert.ok(Number.isSafeInteger(n) && n >= min && n <= max); return n;
  }
  const before = row('held-before', /^\[streaming\] Home motion held-before clock=(\d+) agent=27 unit=502 position=(\d+),(\d+),(\d+),(\d+),(\d+) original-saved=1 result=pass$/gm);
  const after = row('held-after', /^\[streaming\] Home motion held-after clock=(\d+) agent=27 unit=502 command-held=(\d+) agent-held=(\d+) other-delegated=(\d+) original-saved=1 result=pass$/gm);
  const resumed = row('resumed', /^\[streaming\] Home motion resumed clock=(\d+) agent=27 unit=502 command-returned=(\d+) parent=(0|469) position=(\d+),(\d+),(\d+),(\d+),(\d+) original-saved=1 result=pass$/gm);
  assert.ok(before.index < after.index && after.index < resumed.index);
  assert.ok(log.indexOf('[streaming] Home task continuation ') < before.index);
  assert.ok(log.indexOf('[streaming] Home task gate-complete ') > resumed.index);
  const beforeClock = number(before[1], 1), afterClock = number(after[1], 1), resumedClock = number(resumed[1], 1);
  assert.equal(beforeClock, task.continuationClock);
  assert.ok(afterClock - beforeClock >= 1000 && afterClock - beforeClock <= 1050);
  assert.ok(resumedClock - afterClock >= 1000 && resumedClock - afterClock <= 1050);
  const position = before.slice(2, 7).map(s => number(s)), resumedPosition = resumed.slice(4, 9).map(s => number(s));
  for (const p of [position, resumedPosition]) {assert.ok(p[3] < 256 && p[4] < 256);}
  const parent = number(resumed[3]); assert.equal(parent, task.observedParentUnitId);
  assert.ok(parent === 469 || position.some((v, i) => v !== resumedPosition[i]), 'Hero never moved after release');
  return {task, beforeClock, afterClock, resumedClock, position, resumedPosition, resumedParentUnitId: parent,
    commandsHeld: number(after[2], 1, 4096), agentsHeld: number(after[3], 1, 4096),
    otherCommandsDelegated: number(after[4], 1, 65536), commandsReturned: number(resumed[2], 1, 4096),
    holdsNativeOrdersWithoutReset: true, arbitraryDurationSuspensionQualified: false, remoteTravelQualified: false};
}

export function verifyHeroMotionRecords(before, after, resumed, {enteredHome = false} = {}) {
  assert.equal(typeof enteredHome, 'boolean');
  assert.equal(after.clock - before.clock, 1000);
  assert.equal(resumed.clock - after.clock, 1000);
  for (const [kind, id] of [['units', '502'], ['agents', '27'], ['attachments', 'ORDR:502']]) {
    const a = before.records[kind][id], b = after.records[kind][id];
    assert.ok(a && b && a.bytes >= 56 && a.bytes <= 65536);
    assert.match(a.sha256, /^[0-9a-f]{64}$/); assert.deepEqual(a, b, `Held ${kind} changed`);
    assert.ok(resumed.records[kind][id] || (kind === 'attachments' && enteredHome), `Resumed ${kind} absent`);
  }
  assert.notEqual(resumed.records.units[502].sha256, before.records.units[502].sha256);
  return {unitBytes: before.records.units[502].bytes, agentBytes: before.records.agents[27].bytes,
    ordersBytes: before.records.attachments['ORDR:502'].bytes, completeHeldRecordsIdentical: true};
}
