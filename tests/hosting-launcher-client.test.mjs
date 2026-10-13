import test from 'node:test';
import assert from 'node:assert/strict';
import {launcherClient} from '../web/hosting/launcher-client.mjs';

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
  assert.equal(calls[0].brief, true);
  assert.equal(c.games[0].id, 'majesty');
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
