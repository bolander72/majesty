import test from 'node:test';
import assert from 'node:assert/strict';
import {guardGraphicsDevice, createRuntimeStop, GPU_LIMITS} from '../web/hosting/runtime-safety.mjs';

const MiB = 1024 * 1024;
function fixture(limits = GPU_LIMITS) {
  const tasks = [], fences = [], calls = [], failures = [], behavior = {failAllocation: false, allocations: 0};
  const queue = {onSubmittedWorkDone() {
    assert.equal(this, queue);
    return new Promise((resolve, reject) => fences.push({resolve, reject}));
  }};
  for (const method of ['submit', 'writeBuffer', 'writeTexture', 'copyExternalImageToTexture'])
    queue[method] = function(...args) { assert.equal(this, queue); calls.push([method, args]); };
  const device = {queue, createTexture(d) { assert.equal(this, device); return {format: d.format}; },
    createBuffer(d) { assert.equal(this, device); behavior.allocations++;
      if (behavior.failAllocation) throw Error('native allocation'); return d; },
    createCommandEncoder() { assert.equal(this, device); return 'encoder'; }};
  const guard = guardGraphicsDevice(device, {limits, enqueue: fn => tasks.push(fn), fail: x => failures.push(x)});
  return {guard, device: guard.device, raw: device, calls, failures, fences, behavior,
    flush: () => { for (const fn of tasks.splice(0)) fn(); }};
}

test('delegates branded methods and preserves returned GPU objects without retaining them', () => {
  const f = fixture();
  assert.equal(f.device, f.raw); // WebIDL arguments must retain native identity.
  assert.equal(f.device.createCommandEncoder(), 'encoder');
  const texture = f.device.createTexture({size: [3840, 2160], format: 'rgba8unorm'});
  assert.deepEqual(texture, {format: 'rgba8unorm'});
  assert.equal(f.guard.snapshot().queuedBytes, 3840 * 2160 * 4);
  assert.equal(f.device.queue, f.device.queue);
});

test('normal 4K allocation/upload burst is admitted', async () => {
  const f = fixture(), bytes = 3840 * 2160 * 4;
  for (let i = 0; i < 6; i++) f.device.createTexture({size: [3840, 2160], format: 'bgra8unorm'});
  f.device.queue.writeBuffer({}, 0, new ArrayBuffer(32), 0, 32);
  f.device.queue.submit([]); f.flush(); f.fences[0].resolve(); await Promise.resolve();
  assert.equal(f.guard.snapshot().peakBytes, bytes * 6 + 32);
  assert.equal(f.guard.snapshot().queuedBytes, 0);
  assert.deepEqual(f.failures, []);
});

test('a completion retires only its prefix, including submissions made while waiting', async () => {
  const f = fixture();
  f.device.queue.writeBuffer({}, 0, new Uint8Array(10)); f.device.queue.submit([]); f.flush();
  f.device.queue.writeBuffer({}, 0, new Uint8Array(20)); f.device.queue.submit([]);
  assert.equal(f.fences.length, 1);
  f.fences[0].resolve(); await Promise.resolve();
  assert.equal(f.guard.snapshot().queuedBytes, 20);
  assert.equal(f.guard.snapshot().queuedSubmissions, 1);
  f.flush(); f.fences[1].resolve(); await Promise.resolve();
  assert.equal(f.guard.snapshot().queuedOperations, 0);
});

test('stalled upload queue refuses before sending the over-budget operation', () => {
  const f = fixture({...GPU_LIMITS, queuedBytes: 100});
  f.device.queue.writeBuffer({}, 0, new Uint8Array(70));
  assert.throws(() => f.device.queue.writeBuffer({}, 0, new Uint8Array(40)), /safety limit/);
  assert.equal(f.calls.length, 1); assert.equal(f.failures.length, 1);
  assert.throws(() => f.device.queue.submit([]), /stopped/);
});

test('submission and operation caps cover zero-byte runaway work', () => {
  const f = fixture({...GPU_LIMITS, queuedSubmissions: 2});
  f.device.queue.submit([]); f.device.queue.submit([]);
  assert.throws(() => f.device.queue.submit([]), /safety limit/);
  const g = fixture({...GPU_LIMITS, queuedOperations: 2});
  g.device.queue.writeBuffer({}, 0, new Uint8Array(0));
  g.device.queue.writeBuffer({}, 0, new Uint8Array(0));
  assert.throws(() => g.device.queue.writeBuffer({}, 0, new Uint8Array(0)), /safety limit/);
});

test('typed-array sizes use elements; a sliced WASM view is charged for the actual upload', () => {
  const f = fixture(), heap = new Uint32Array(1000);
  f.device.queue.writeBuffer({}, 0, heap, 100, 10);
  f.device.queue.writeBuffer({}, 0, heap, 998);
  f.device.queue.writeBuffer({}, 0, new DataView(new ArrayBuffer(30)), 5, 10);
  assert.equal(f.guard.snapshot().queuedBytes, 40 + 8 + 10);
});

test('texture upload charges logical extent/stride, not the whole WASM memory', () => {
  const f = fixture();
  f.device.queue.writeTexture({texture: {format: 'rgba8unorm'}}, new Uint8Array(1),
    {offset: 1000000, bytesPerRow: 256, rowsPerImage: 8}, [10, 3, 2]);
  assert.equal(f.guard.snapshot().queuedBytes, 256 * (8 + 2) + 40);
  const g = fixture();
  g.device.queue.writeTexture({texture: {format: 'bc1-rgba-unorm'}}, new Uint8Array(1), {}, [8, 8]);
  assert.equal(g.guard.snapshot().queuedBytes, 32);
});

test('counts mip chains, arrays, samples and shrinking 3D depth', () => {
  const f = fixture();
  f.device.createTexture({size: [8, 8, 2], format: 'rgba8unorm', mipLevelCount: 2});
  assert.equal(f.guard.snapshot().queuedBytes, (64 + 16) * 2 * 4);
  const g = fixture();
  g.device.createTexture({size: [8, 8, 8], dimension: '3d', format: 'r8unorm', mipLevelCount: 2});
  assert.equal(g.guard.snapshot().queuedBytes, 512 + 64);
  const h = fixture();
  h.device.createTexture({size: [4, 4], format: 'depth32float', sampleCount: 4});
  assert.equal(h.guard.snapshot().queuedBytes, 256);
});

test('oversized allocation is rejected before calling the GPU', () => {
  const f = fixture();
  assert.throws(() => f.device.createBuffer({size: 257 * MiB}), /safety limit/);
  assert.equal(f.behavior.allocations, 0);
  const g = fixture();
  assert.throws(() => g.device.createTexture({size: [2 ** 30, 2 ** 30], format: 'rgba8unorm'}), /safety limit/);
});

test('native failure rolls back reservation and a rejected fence stops once', async () => {
  const f = fixture(); f.behavior.failAllocation = true;
  assert.throws(() => f.device.createBuffer({size: 100}), /native allocation/);
  assert.equal(f.guard.snapshot().queuedBytes, 0);
  f.device.queue.submit([]); f.flush(); f.fences[0].reject(); await Promise.resolve();
  assert.equal(f.failures.length, 1); assert.equal(f.guard.snapshot().closed, true);
});

test('failure cleanup is idempotent, stops audio recovery and threads even when another cleanup throws', () => {
  const calls = [], module = {pauseMainLoop() { calls.push('pause'); throw Error('already aborted'); },
    SDL3: {audioContext: {close() { calls.push('audio'); return Promise.resolve(); }}}};
  const stop = createRuntimeStop({module, device: {destroy() {calls.push('gpu');}},
    stopAudio: () => calls.push('recovery'), stopThreads: () => calls.push('threads')});
  stop(); stop(); assert.deepEqual(calls, ['recovery', 'pause', 'threads', 'audio', 'gpu']);
});
