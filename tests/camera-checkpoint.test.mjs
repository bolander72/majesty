import test from 'node:test';
import assert from 'node:assert/strict';
import {CameraCheckpointWriter} from '../web/world/camera-checkpoint.mjs';

function fixture(write = async () => {}) {
  let clock = 0, sequence = 0;
  const timers = new Map(), writes = [], reports = [];
  const writer = new CameraCheckpointWriter({async write(key, value) {
    writes.push({key, value}); await write(key, value);
  }}, {now: () => clock, report: result => reports.push(result), timers: {
    setTimeout(fn, delay) { const id = ++sequence; timers.set(id, {fn, due: clock + delay}); return id; },
    clearTimeout(id) { timers.delete(id); }
  }});
  return {writer, timers, writes, reports, async advance(ms) {
    clock += ms;
    for (const [id, timer] of [...timers]) if (timer.due <= clock) { timers.delete(id); timer.fn(); }
    await new Promise(resolve => setImmediate(resolve));
  }};
}
function gate() { let resolve; const promise = new Promise(r => {resolve = r;}); return {promise, resolve}; }

test('a burst of camera positions uses one timer and writes only the last immutable position', async () => {
  const f = fixture();
  for (let x = 0; x < 1000; ++x) {
    const position = {x, y: -x, unused: new Uint8Array(4096)};
    f.writer.schedule(position); position.x = 99999;
    assert.equal(f.writer.pendingPositions, 1); assert.equal(f.timers.size, 1);
  }
  await f.advance(249); assert.equal(f.writes.length, 0);
  await f.advance(1);
  assert.deepEqual(f.writes, [{key: 'camera-v1', value: {x: 999, y: -999}}]);
  assert.equal(f.writer.pendingPositions, 0); assert.equal(f.writer.writesInFlight, 0);
});

test('continuous motion periodically saves instead of indefinitely resetting the idle timer', async () => {
  const f = fixture();
  for (let step = 0; step < 20; ++step) { f.writer.schedule({x: step, y: 0}); await f.advance(100); }
  assert.deepEqual(f.writes, [{key: 'camera-v1', value: {x: 19, y: 0}}]);
  f.writer.schedule({x: 20, y: 0}); await f.writer.flush();
  assert.equal(f.writes.length, 2); assert.equal(f.timers.size, 0);
});

test('slow storage retains only one later position and serializes explicit flushes', async () => {
  const blocked = gate(); let active = 0, maximum = 0;
  const f = fixture(async () => { maximum = Math.max(maximum, ++active); await blocked.promise; --active; });
  f.writer.schedule({x: 1, y: 1}); const first = f.writer.flush();
  for (let x = 2; x <= 1000; ++x) f.writer.schedule({x, y: 1});
  const second = f.writer.flush(); assert.equal(first, second);
  assert.equal(f.writer.writesInFlight, 1); assert.equal(f.writer.pendingPositions, 1);
  assert.equal(f.writes.length, 1); blocked.resolve(); await second;
  assert.equal(maximum, 1); assert.equal(f.writes.length, 2);
  assert.deepEqual(f.writes[1].value, {x: 1000, y: 1});
  assert.deepEqual(f.reports.map(x => x.latest), [false, true]);
  assert.equal(f.timers.size, 0); assert.equal(f.writer.pendingPositions, 0);
});

test('quota failure is reported without a repeating retry and explicit retry preserves the latest view', async () => {
  let fail = true;
  const f = fixture(async () => { if (fail) throw new Error('quota'); });
  f.writer.schedule({x: 8, y: 9}); await f.advance(250);
  assert.equal(f.reports[0].error.message, 'quota'); assert.equal(f.reports[0].latest, true);
  assert.equal(f.timers.size, 0); assert.equal(f.writer.pendingPositions, 1);
  await f.advance(10000); assert.equal(f.writes.length, 1);
  fail = false; await f.writer.flush();
  assert.deepEqual(f.writes[1].value, {x: 8, y: 9});
  assert.equal(f.reports[1].error, null); assert.equal(f.writer.pendingPositions, 0);
});

test('a failed slow write does not replace a newer position with its stale snapshot', async () => {
  const blocked = gate(); let fail = true;
  const f = fixture(async () => { await blocked.promise; if (fail) throw new Error('quota'); });
  f.writer.schedule({x: 1, y: 1}); const attempt = f.writer.flush();
  f.writer.schedule({x: 2, y: 2}); blocked.resolve(); await assert.rejects(attempt, /quota/);
  assert.equal(f.reports[0].latest, false); assert.equal(f.timers.size, 0);
  fail = false; await f.writer.flush(); assert.deepEqual(f.writes[1].value, {x: 2, y: 2});
});

test('invalid camera input cannot displace accepted pending metadata', async () => {
  const f = fixture(); f.writer.schedule({x: 10, y: 20});
  for (const value of [null, {}, {x: Infinity, y: 0}, {x: 0, y: NaN}]) assert.throws(() => f.writer.schedule(value), /Invalid camera/);
  await f.writer.flush(); assert.deepEqual(f.writes[0].value, {x: 10, y: 20});
});

test('departure cancels queued camera metadata and retained timer callbacks cannot restart writes', async () => {
  const f = fixture(); f.writer.schedule({x: 10, y: 20});
  const callback = f.timers.values().next().value.fn;
  const closing = f.writer.close(); assert.equal(f.writer.close(), closing);
  assert.equal(f.timers.size, 0); assert.equal(f.writer.pendingPositions, 0);
  await closing; callback(); await f.advance(10000); await f.writer.flush();
  assert.equal(f.writes.length, 0); assert.equal(f.reports.length, 0);
  assert.throws(() => f.writer.schedule({x: 1, y: 2}), /writer closed/);
});

test('departure drains an accepted camera transaction without writing a later position or reporting late UI results', async () => {
  for (const fail of [false, true]) {
    const blocked = gate();
    const f = fixture(async () => { await blocked.promise; if (fail) throw Error('quota'); });
    f.writer.schedule({x: 1, y: 1});
    const flight = f.writer.flush();
    const result = flight.then(() => null, error => error);
    f.writer.schedule({x: 2, y: 2});
    let stopped = false; const closing = f.writer.close();
    closing.then(() => { stopped = true; });
    await Promise.resolve(); assert.equal(stopped, false);
    assert.equal(f.writer.pendingPositions, 0); assert.equal(f.timers.size, 0);
    blocked.resolve(); await closing;
    assert.equal(Boolean(await result), fail);
    assert.equal(f.writes.length, 1); assert.equal(f.writer.writesInFlight, 0);
    assert.equal(f.reports.length, 0); await f.writer.flush();
  }
});
