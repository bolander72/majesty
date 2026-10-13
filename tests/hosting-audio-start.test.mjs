import test from 'node:test';
import assert from 'node:assert/strict';
import {installGameAudio} from '../web/hosting/audio-start.mjs';

test('existing suspended game audio is resumed automatically without changing volume', () => {
  const events = new EventTarget(); let calls = 0;
  const context = {state: 'suspended', resume() {calls++; this.state = 'running'; return Promise.resolve();}};
  const module = {SDL3: {audioContext: context, volume: 0.4}};
  const stop = installGameAudio(module, {events, schedule: () => assert.fail('No polling after context exists')});
  assert.equal(calls, 1); assert.equal(module.SDL3.volume, 0.4);
  events.dispatchEvent(new Event('keydown')); assert.equal(calls, 1);
  stop();
});

test('blocked autoplay retries on interaction and releases listeners on page exit', () => {
  const events = new EventTarget(); let calls = 0;
  const context = {state: 'suspended', resume() {calls++; return new Promise(() => {});}};
  installGameAudio({SDL3: {audioContext: context}}, {events});
  assert.equal(calls, 1);
  events.dispatchEvent(new Event('pointerdown')); assert.equal(calls, 2);
  events.dispatchEvent(new Event('pagehide'));
  events.dispatchEvent(new Event('pointerdown')); assert.equal(calls, 2);
});

test('late engine context is discovered once and timer is bounded', () => {
  const events = new EventTarget(), module = {}; let scheduled, count = 0, clock = 0;
  const stop = installGameAudio(module, {events, now: () => clock,
    schedule: fn => {scheduled = fn; count++; return 1;}, cancel: () => {}});
  assert.equal(count, 1);
  module.SDL3 = {audioContext: {state: 'suspended', resume: () => Promise.resolve()}};
  scheduled(); assert.equal(count, 1); stop();
  delete module.SDL3;
  clock = 0;
  const stopMissing = installGameAudio(module, {events, now: () => clock,
    schedule: fn => {scheduled = fn; count++;}, cancel: () => {}});
  clock = 21000; const before = count; scheduled(); assert.equal(count, before); stopMissing();
});
