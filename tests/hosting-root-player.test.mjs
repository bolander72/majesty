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

test('Lost Trail root prepares the new collection without importing over stock Majesty', async () => {
  await prepareRootPlayer({search: '?edition=lost-trail-v1&profile=lost-trail',
    openClient: async () => ({status: async id => {
      assert.equal(id, 'majesty-lost-trail'); return {status: {state: 'notFound'}};
    }, close: () => {}}), ensureAssets: async id => assert.equal(id, 'majesty-lost-trail')});
});

test('qualified default root switches only game data, retaining the ordinary game/profile identity', async () => {
  const games = [{id: 'majesty', defaultContentStorageId: 'majesty-lost-trail'}, {id: 'majesty-lost-trail'}];
  const prepared = await prepareRootPlayer({search: '', openClient: async () => ({games,
    status: async id => {assert.equal(id, 'majesty-lost-trail'); return {status: {state: 'ready'}};},
    close: () => {},
  })});
  assert.equal(prepared[0].id, 'majesty');
  assert.equal(prepared[0].contentStorageId, 'majesty-lost-trail');
  assert.equal(games[0].contentStorageId, undefined);
});

test('managed worlds retain original data even when the root has a content default', async () => {
  for (const search of ['?room=existing', '?world=existing', '?RECOMP_RULE_COOP_TEST=1']) {
    const games = [{id: 'majesty', defaultContentStorageId: 'majesty-lost-trail'}];
    assert.equal(await prepareRootPlayer({search, openClient: async () => ({games,
      status: async id => {assert.equal(id, 'majesty'); return {status: {state: 'ready'}};},
      close: () => {},
    })}), games);
  }
});

test('the default content root cannot disable its required inventory bridge', async () => {
  let closed = false;
  await assert.rejects(prepareRootPlayer({search: '?RECOMP_RULE_INVENTORY_COMPAT=0',
    openClient: async () => ({games: [{id: 'majesty', defaultContentStorageId: 'majesty-lost-trail'}],
      status: () => assert.fail('No content import or engine start'), close: () => {closed = true;},
    })}), /requires inventory compatibility/);
  assert.equal(closed, true);
});
