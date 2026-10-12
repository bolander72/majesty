import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cachedFileHashes} from '../web/hosting/content-cache.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const source = (text, modified) => ({getFile: async () => new File([text], 'asset', {lastModified: modified})});
function cache(initial = '') {
  let text = initial;
  const handle = {getFile: async () => new File([text], 'cache'),
    createWritable: async () => ({write: async value => {text = value;}, close: async () => {}, abort: async () => {}})};
  const storage = {getDirectory: async () => ({getDirectoryHandle: async () => ({getFileHandle: async () => handle})})};
  return {storage, handle, text: () => text};
}
function hashing() {
  const state = {reads: 0, instances: 0, closed: 0};
  state.makeHasher = () => {
    state.instances++;
    return {hash: async file => {state.reads++; return sha(Buffer.from(await file.arrayBuffer()));},
      close: () => {state.closed++;}};
  };
  return state;
}

test('returning solo launch reuses unchanged hashes without starting a hash worker', async () => {
  const saved = cache(), first = hashing(), second = hashing();
  const files = [['Data/unit.cam', source('units', 100)], ['empty', source('', 101)]];
  const expected = ['Data/unit.cam\0' + sha('units'), 'empty\0' + sha('')];
  assert.deepEqual(await cachedFileHashes(files, 'majesty', {...saved, ...first}), expected);
  assert.equal(first.reads, 2); assert.equal(first.closed, 1);
  assert.deepEqual(await cachedFileHashes(files, 'majesty', {...saved, ...second}), expected);
  assert.equal(second.reads, 0); assert.equal(second.instances, 0);
});

test('changed timestamps, sizes, added and deleted files update the exact content entries', async () => {
  const saved = cache();
  await cachedFileHashes([['changed', source('old', 1)], ['resized', source('a', 2)],
    ['deleted', source('gone', 3)]], 'majesty', {...saved, ...hashing()});
  const check = hashing();
  const actual = await cachedFileHashes([['changed', source('new', 4)],
    ['resized', source('longer', 2)], ['added', source('fresh', 5)]], 'majesty', {...saved, ...check});
  assert.deepEqual(actual, ['changed\0' + sha('new'), 'resized\0' + sha('longer'), 'added\0' + sha('fresh')]);
  assert.equal(check.reads, 3);
  assert.equal(Object.hasOwn(JSON.parse(saved.text()).files, 'deleted'), false);
});

test('fresh compatibility checks ignore a cache even if its digest was altered', async () => {
  const saved = cache(JSON.stringify({format: 'majesty-content-hashes-v1',
    files: {asset: {size: 5, modified: 12, sha256: sha('other')}}})), check = hashing();
  assert.deepEqual(await cachedFileHashes([['asset', source('truth', 12)]], 'majesty',
    {...saved, ...check, fresh: true}), ['asset\0' + sha('truth')]);
  assert.equal(check.reads, 1);
  assert.equal(check.closed, 1);
});

test('corrupt, unknown-format and invalid-digest caches fall back to real hashing', async () => {
  for (const payload of ['{broken', JSON.stringify({format: 'unknown', files: {}}),
    JSON.stringify({format: 'majesty-content-hashes-v1', files: {asset: {size: 1, modified: 1, sha256: 'bad'}}})]) {
    const saved = cache(payload), check = hashing();
    assert.deepEqual(await cachedFileHashes([['asset', source('x', 1)]], 'majesty',
      {...saved, ...check}), ['asset\0' + sha('x')]);
    assert.equal(check.reads, 1);
  }
});

test('missing modification times cannot produce a reusable identity', async () => {
  const saved = cache(), files = [['asset', source('x', 0)]];
  await cachedFileHashes(files, 'majesty', {...saved, ...hashing()});
  const check = hashing();
  await cachedFileHashes(files, 'majesty', {...saved, ...check});
  assert.equal(check.reads, 1);
});

test('unavailable storage and quota failures do not break a correct launch', async () => {
  const missing = {getDirectory: async () => {throw Error('storage unavailable');}};
  const saved = cache(); saved.handle.createWritable = async () => {throw Error('quota');};
  for (const storage of [missing, saved.storage])
    assert.deepEqual(await cachedFileHashes([['asset', source('x', 1)]], 'majesty',
      {storage, ...hashing()}), ['asset\0' + sha('x')]);
});

test('cancellation closes an in-flight worker and cannot return a partial identity', async () => {
  const controller = new AbortController(); let close = 0, reject;
  const makeHasher = () => ({hash: () => new Promise((_, no) => {reject = no; controller.abort();}),
    close: () => {close++; reject(Error('worker stopped'));}});
  await assert.rejects(cachedFileHashes([['asset', source('x', 1)]], 'majesty',
    {...cache(), signal: controller.signal, makeHasher}), /worker stopped/);
  assert.ok(close >= 1);
});
