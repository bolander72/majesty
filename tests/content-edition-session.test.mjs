import test from 'node:test';
import assert from 'node:assert/strict';
import {editionFor, prepareEditionProfile, startEditionPlayer} from '../web/content/edition-session.mjs';

test('ordinary games retain their original import and profile selection', () => {
  assert.equal(editionFor('?profile=my-campaign'), null);
});

test('Wayfinder requires a distinct named save profile', () => {
  const plan = editionFor('?edition=wayfinder-v1&profile=wayfinder-scouts');
  assert.equal(plan.storageId, 'majesty-wayfinder');
  assert.equal(plan.profile, 'wayfinder-scouts');
  for (const query of ['?edition=wayfinder-v1', '?edition=wayfinder-v1&profile=repair388-host',
    '?edition=wayfinder-v1&profile=wayfinder&profile=original',
    '?edition=wayfinder-v1&edition=other&profile=wayfinder']) {
    assert.throws(() => editionFor(query));
  }
});

test('Lost Trail uses an independent backed-up profile and cannot disable inventory support', () => {
  const plan = editionFor('?edition=lost-trail-v1&profile=lost-trail-browser745');
  assert.equal(plan.storageId, 'majesty-lost-trail');
  assert.equal(plan.id, 'lost-trail-v1');
  for (const query of ['?edition=lost-trail-v1&profile=wayfinder',
    '?edition=lost-trail-v1&profile=original', '?edition=lost-trail-v1',
    '?edition=lost-trail-v1&profile=lost-trail&RECOMP_RULE_INVENTORY_COMPAT=0',
    '?edition=lost-trail-v1&profile=lost-trail&RECOMP_RULE_INVENTORY_COMPAT=1&RECOMP_RULE_INVENTORY_COMPAT=1'])
    assert.throws(() => editionFor(query));
});

test('managed worlds cannot silently lose their content selection during travel', () => {
  for (const field of ['world=old', 'room=old', 'mode=coop', 'RECOMP_RULE_FRONTIER_CHAPTER=3',
    'RECOMP_RULE_COOP_WORLD=old', 'RECOMP_PROFILE_DIR=original',
    'RECOMP_FRONTIER_SESSION=old', 'RECOMP_COOP_RESUME=old']) {
    assert.throws(() => editionFor('?edition=wayfinder-v1&profile=wayfinder&' + field));
  }
});

test('corrupt imported resource is refused before any profile is created', async () => {
  let created = false;
  const resource = {getFileHandle: async () => ({getFile: async () => new Blob(['wrong-resource'])})};
  const game = {getFileHandle: async () => ({}), getDirectoryHandle: async () => resource};
  const storage = {getDirectoryHandle: async (name, options) => {
    if (options.create) created = true;
    return name === 'majesty-wayfinder' ? {getDirectoryHandle: async () => game} : {};
  }};
  await assert.rejects(prepareEditionProfile(storage, editionFor('?edition=wayfinder-v1&profile=wayfinder')),
    /verified Wayfinder game ZIP/);
  assert.equal(created, false);
});

test('a busy edition profile prevents storage writes and engine startup', async () => {
  let started = false, read = false;
  const events = new EventTarget();
  await assert.rejects(startEditionPlayer(() => { started = true; }, {
    search: '?edition=wayfinder-v1&profile=wayfinder', events,
    storage: {getDirectory: async () => { read = true; }},
    locks: {request: async (name, options, callback) => {
      assert.equal(name, 'majesty-native-profile:majesty:wayfinder');
      assert.equal(options.ifAvailable, true);
      return callback(null);
    }},
  }), /already open/);
  assert.equal(started, false);
  assert.equal(read, false);
});

test('an ordinary game starts without edition storage or locks', async () => {
  let started = false;
  await startEditionPlayer(() => { started = true; }, {
    search: '?profile=existing', storage: null, locks: null, events: new EventTarget(),
  });
  assert.equal(started, true);
});
