import test from 'node:test';
import assert from 'node:assert/strict';
import {HOME_ACTIONS, menuPoint, startNativeHome} from '../web/hosting/home-menu.mjs';
import {launcherClient} from '../web/hosting/launcher-client.mjs';

test('menu choices retain native centered/bottom anchors, including a small viewport', () => {
  assert.deepEqual(menuPoint('play', 1280, 633), {x: 334, y: 481});
  assert.deepEqual(menuPoint('settings', 1920, 1080), {x: 796, y: 957});
  assert.deepEqual(menuPoint('play', 1280, 720, {width: 3840, height: 2160}),
    {x: 538, y: 720 - 152 / 3});
  for (const action of Object.keys(HOME_ACTIONS)) {
    const p = menuPoint(action, 390, 844);
    assert.ok(p.x > 0 && p.x < 390 && p.y > 0 && p.y < 844);
  }
  assert.throws(() => menuPoint('__proto__', 1280, 633));
});

function nativeFixture() {
  const buttons = ['play', 'settings'].map(action => {
    const b = new EventTarget(); b.dataset = {homeAction: action}; b.setAttribute = () => {}; return b;
  });
  const doc = new EventTarget(); doc.body = {dataset: {}};
  doc.querySelectorAll = () => buttons; doc.querySelector = () => null;
  const win = new EventTarget(), frames = [], messages = [], clicks = [];
  win.location = {origin: 'https://majesty.test'};
  win.parent = {postMessage: (...a) => messages.push(a)};
  win.requestAnimationFrame = f => frames.push(f);
  win.setTimeout = f => { f(); };
  const canvas = {focus() {}, getBoundingClientRect: () => ({left: 0, top: 0, width: 1280, height: 633}),
    dispatchEvent: e => clicks.push(e)};
  return {doc, win, canvas, buttons, frames, messages, clicks};
}
const detail = (type, value) => Object.assign(new Event(type), {detail: value});

test('an early choice waits for the native menu and is consumed exactly once', async () => {
  const before = globalThis.PointerEvent;
  globalThis.PointerEvent = class {constructor(type, options) {this.type = type; Object.assign(this, options);}};
  try {
    const f = nativeFixture(); startNativeHome(f);
    f.buttons[0].dispatchEvent(new Event('click'));
    assert.equal(f.clicks.length, 0);
    f.doc.dispatchEvent(detail('recomp-runtime-message', '[player] menu ready'));
    f.frames.shift()(); f.frames.shift()(); await Promise.resolve();
    assert.equal(f.doc.body.dataset.gameReady, 'true');
    assert.deepEqual(f.clicks.map(e => e.type), ['pointerenter', 'pointermove', 'pointerdown', 'pointerup']);
    assert.equal(f.clicks[2].clientX, 334); assert.equal(f.clicks[2].clientY, 481);
    assert.equal(f.clicks[2].pointerType, 'mouse'); assert.equal(f.clicks[2].buttons, 1);
    f.doc.dispatchEvent(detail('recomp-runtime-message', '[player] menu ready'));
    assert.equal(f.clicks.length, 4);
  } finally { globalThis.PointerEvent = before; }
});

test('foreign messages cannot select a native menu item; leaving cancels the handoff', () => {
  const f = nativeFixture(); startNativeHome(f);
  f.win.dispatchEvent(Object.assign(new Event('message'), {origin: 'https://other.test', source: f.win.parent,
    data: {type: 'majesty-home-choice', action: 'play'}}));
  f.doc.dispatchEvent(detail('recomp-runtime-message', '[player] menu ready'));
  f.win.dispatchEvent(new Event('pagehide'));
  f.frames.shift()(); f.frames.shift()();
  assert.equal(f.clicks.length, 0); assert.equal(f.messages.length, 0);
});

test('automatic launcher asks only for the selected edition and releases its worker', async () => {
  const calls = []; let worker;
  class FakeWorker {
    constructor() { worker = this; }
    postMessage(m) { calls.push(m); queueMicrotask(() => this.onmessage({data: {id: m.id, result: {status: {state: 'ready'}}}})); }
    terminate() { this.closed = true; }
  }
  const c = await launcherClient({WorkerClass: FakeWorker, fetchFile: async () => new Response(JSON.stringify([
    {id: 'majesty'}, {id: 'majesty-wayfinder'},
  ]))});
  await c.status('majesty'); assert.equal(calls.length, 1); assert.equal(calls[0].game.id, 'majesty');
  c.close(); assert.equal(worker.closed, true); await assert.rejects(c.status('majesty'), /cancelled/);
});

test('launcher abort rejects outstanding work and failed imports do not become ready', async () => {
  let worker;
  class FakeWorker {constructor() {worker = this;} postMessage(m) {this.last = m;} terminate() {this.closed = true;}}
  const abort = new AbortController();
  const c = await launcherClient({signal: abort.signal, WorkerClass: FakeWorker,
    fetchFile: async () => new Response('[{"id":"majesty"}]')});
  const pending = c.status('majesty'); abort.abort(); await assert.rejects(pending, /cancelled/);
  assert.equal(worker.closed, true);
  const d = await launcherClient({WorkerClass: FakeWorker, fetchFile: async () => new Response('[{"id":"majesty"}]')});
  const imported = d.importZip('majesty', new Blob());
  worker.onmessage({data: {id: worker.last.id, result: {result: 'failed', error: 'broken zip'}}});
  await assert.rejects(imported, /broken zip/); d.close();
});
