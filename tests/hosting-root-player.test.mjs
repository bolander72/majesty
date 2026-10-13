import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRootPlayer} from '../web/hosting/root-player.mjs';

test('completed local import starts directly and closes the preparation worker', async () => {
  let closed = 0;
  const games = [{id: 'majesty'}];
  const prepared = await prepareRootPlayer({search: '', openClient: async () => ({
    games,
    status: async id => {assert.equal(id, 'majesty'); return {status: {state: 'ready'}};},
    close: () => closed++,
  }), ensureAssets: () => assert.fail('Should reuse the completed import')});
  assert.equal(closed, 1);
  assert.equal(prepared, games);
});

test('fresh visitor prepares the selected edition without navigating', async () => {
  let closed = 0, imported = 0;
  await prepareRootPlayer({search: '?edition=wayfinder-v1', openClient: async () => ({
    status: async () => ({status: {state: 'notFound'}}),
    importFiles: async (id, files) => {assert.equal(id, 'majesty-wayfinder'); imported++;},
    close: () => closed++,
  }), ensureAssets: async (id, options) => {
    assert.equal(id, 'majesty-wayfinder'); await options.importFiles(id, []);
  }});
  assert.equal(imported, 1); assert.equal(closed, 1);
});

test('failed preparation releases its worker', async () => {
  let closed = false;
  await assert.rejects(prepareRootPlayer({search: '', openClient: async () => ({
    status: async () => {throw Error('Storage unavailable');}, close: () => {closed = true;},
  })}), /Storage unavailable/);
  assert.equal(closed, true);
});
