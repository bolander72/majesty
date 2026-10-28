import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshCommunityScripts} from '../web/hosting/community-updates.mjs';
import {COMMUNITY_FILES} from '../web/content/community-files.mjs';

const paths = ['Data/Community_Common.bcd', 'DataMX/Community_Common.bcd'];
const prior = '9df88eb9f536155ed03b148b547ba4a88a24cc86f7212416517a213f42120d1a';
const next = 'a'.repeat(64), prefix = 'majesty-community-guilds-v1/game/';

function fixture(contents = ['old', 'old']) {
  const data = new Map(), writes = [], counts = {hash: 0, fetch: 0, recipe: 0};
  let time = 100, failClose;
  function put(path, value) {
    const blob = new Blob([value]);
    blob.lastModified = ++time;
    data.set(path, blob);
  }
  for (let i = 0; i < paths.length; i++) put(prefix + paths[i], contents[i]);
  put(prefix + '.manifest.json', JSON.stringify({files: Object.fromEntries([
    ...paths.map(p => [p, {size: 3, mtime: 10}]), ['Data/unrelated.cam', {size: 99, mtime: 7}],
  ])}));
  put('majesty/profile/player/SaveGame/keep.GMP', 'player save');
  function directory(path = '') {
    return {
      async getDirectoryHandle(name) { return directory(path + name + '/'); },
      async removeEntry(name) { data.delete(path + name); },
      async getFileHandle(name, options) {
        const full = path + name;
        if (!data.has(full)) {
          if (!options?.create) throw new DOMException('not found', 'NotFoundError');
          put(full, '');
        }
        return {
          async getFile() { return data.get(full); },
          async createWritable() {
            let pending;
            return {
              async write(value) { pending = value; },
              async close() {
                if (failClose === full) { failClose = null; throw Error('interrupted close'); }
                put(full, pending); writes.push(full);
              },
              async abort() { pending = null; },
            };
          },
        };
      },
    };
  }
  let queue = Promise.resolve();
  const options = {
    storage: {async getDirectory() { return directory(); }},
    locks: {request(name, config, fn) {
      assert.equal(name, 'majesty-automatic-game-assets');
      const work = queue.then(fn); queue = work.catch(() => {}); return work;
    }},
    files: Object.fromEntries(paths.map(p => [p, next])),
    sizes: Object.fromEntries(paths.map(p => [p, 3])),
    async hashFile(blob) {
      counts.hash++;
      return ({old: prior, new: next})[await blob.text()] || 'c'.repeat(64);
    },
    async fetchFile() { counts.fetch++; return new Response('new'); },
    async loadRecipe() {
      counts.recipe++;
      return {patches: paths.map(path => ({path, sha256: next, bytes: 3,
        url: 'https://raw.githubusercontent.com/bolander72/majesty/' + 'b'.repeat(40)
          + '/assets/content/capacity/common.bcd'}))};
    },
  };
  return {data, writes, counts, options, put, fail(path) { failClose = prefix + path; }};
}

test('updates only two known scripts, downloads once, retains profile and manifest entries', async () => {
  const f = fixture(), saved = f.data.get('majesty/profile/player/SaveGame/keep.GMP');
  assert.equal(await refreshCommunityScripts(f.options), true);
  assert.equal(f.counts.fetch, 1);
  for (const p of paths) assert.equal(await f.data.get(prefix + p).text(), 'new');
  assert.equal(f.data.get('majesty/profile/player/SaveGame/keep.GMP'), saved);
  const manifest = JSON.parse(await f.data.get(prefix + '.manifest.json').text());
  assert.deepEqual(manifest.files['Data/unrelated.cam'], {size: 99, mtime: 7});
  assert.equal(f.writes.length, 4);
});

test('unchanged verified files skip hashing, downloads, recipe requests and writes', async () => {
  const f = fixture();
  await refreshCommunityScripts(f.options);
  f.writes.length = 0; Object.keys(f.counts).forEach(k => { f.counts[k] = 0; });
  assert.equal(await refreshCommunityScripts(f.options), false);
  assert.deepEqual(f.counts, {hash: 0, fetch: 0, recipe: 0});
  assert.deepEqual(f.writes, []);
});

test('checks all installed files before downloading or changing a customized script', async () => {
  const f = fixture(['old', 'custom']);
  await assert.rejects(refreshCommunityScripts(f.options), /Customized/);
  assert.equal(f.counts.fetch, 0); assert.deepEqual(f.writes, []);
  assert.equal(await f.data.get(prefix + paths[0]).text(), 'old');
});

test('corrupt and oversized downloads never replace an installed script', async () => {
  for (const payload of ['bad', 'oversized']) {
    const f = fixture(); f.options.fetchFile = async () => new Response(payload);
    await assert.rejects(refreshCommunityScripts(f.options), /size differs|verification/);
    assert.deepEqual(f.writes, []);
  }
});

test('an interrupted second write resumes without rewriting the already verified first file', async () => {
  const f = fixture(); f.fail(paths[1]);
  await assert.rejects(refreshCommunityScripts(f.options), /interrupted/);
  assert.equal(await f.data.get(prefix + paths[0]).text(), 'new');
  assert.equal(await f.data.get(prefix + paths[1]).text(), 'old');
  const first = f.data.get(prefix + paths[0]);
  assert.equal(await refreshCommunityScripts(f.options), true);
  assert.equal(f.data.get(prefix + paths[0]), first);
  assert.equal(await f.data.get(prefix + paths[1]).text(), 'new');
});

test('concurrent startup requests share the lock and apply one update', async () => {
  const f = fixture();
  assert.deepEqual(await Promise.all([refreshCommunityScripts(f.options), refreshCommunityScripts(f.options)]),
    [true, false]);
  assert.equal(f.counts.fetch, 1);
});

function resourceFixture(custom = false) {
  const f = fixture(), path = 'Data/unittype.cam', target = 'd'.repeat(64);
  f.put(prefix + path, custom ? 'custom' : 'resold');
  const manifest = {files: Object.fromEntries([
    ...paths.map(p => [p, {size: 3, mtime: 10}]), [path, {size: 6, mtime: 11}],
    ['Data/unrelated.cam', {size: 99, mtime: 7}],
  ])};
  f.put(prefix + '.manifest.json', JSON.stringify(manifest));
  f.options.files[path] = target; f.options.sizes[path] = 6;
  const hash = f.options.hashFile, fetchFile = f.options.fetchFile, recipe = f.options.loadRecipe;
  f.options.hashFile = async blob => {
    const text = await blob.text();
    if (text === 'resold' || text === 'resnew') {
      f.counts.hash++;
      return text === 'resold' ? COMMUNITY_FILES[path] : target;
    }
    return hash(blob);
  };
  f.options.fetchFile = async url => {
    if (url.endsWith('unittype.cam')) { f.counts.fetch++; return new Response('resnew'); }
    return fetchFile(url);
  };
  f.options.loadRecipe = async () => ({patches: [
    ...(await recipe()).patches,
    {path, sha256: target, bytes: 6, url: 'https://raw.githubusercontent.com/bolander72/majesty/'
      + 'b'.repeat(40) + '/assets/content/resources/unittype.cam'},
  ]});
  return {...f, path};
}

test('admits both previously published Common bytecodes', async () => {
  const f = fixture(['current', 'current']), hash = f.options.hashFile;
  f.options.hashFile = async blob => await blob.text() === 'current'
    ? 'd31ae1725d7f10b3dc00f63575828bb8d921b92659d0cea89daea105b07ac34e' : hash(blob);
  assert.equal(await refreshCommunityScripts(f.options), true);
  assert.equal(await f.data.get(prefix + paths[0]).text(), 'new');
});

test('updates bound native resources with scripts and preserves unrelated files', async () => {
  const f = resourceFixture(), saved = f.data.get('majesty/profile/player/SaveGame/keep.GMP');
  assert.equal(await refreshCommunityScripts(f.options), true);
  assert.equal(f.counts.fetch, 2);
  assert.equal(await f.data.get(prefix + f.path).text(), 'resnew');
  assert.equal(f.data.get('majesty/profile/player/SaveGame/keep.GMP'), saved);
  const manifest = JSON.parse(await f.data.get(prefix + '.manifest.json').text());
  assert.equal(manifest.files[f.path].size, 6);
  assert.deepEqual(manifest.files['Data/unrelated.cam'], {size: 99, mtime: 7});
  f.writes.length = 0; Object.keys(f.counts).forEach(k => { f.counts[k] = 0; });
  assert.equal(await refreshCommunityScripts(f.options), false);
  assert.deepEqual(f.counts, {hash: 0, fetch: 0, recipe: 0});
  assert.deepEqual(f.writes, []);
});

test('a customized native resource blocks all writes and downloads', async () => {
  const f = resourceFixture(true);
  await assert.rejects(refreshCommunityScripts(f.options), /Customized/);
  assert.equal(f.counts.fetch, 0);
  assert.deepEqual(f.writes, []);
  assert.equal(await f.data.get(prefix + paths[0]).text(), 'old');
});

test('failed resource download verification leaves even valid scripts untouched', async () => {
  const f = resourceFixture(), fetchFile = f.options.fetchFile;
  f.options.fetchFile = async url => url.endsWith('unittype.cam')
    ? new Response('badbad') : fetchFile(url);
  await assert.rejects(refreshCommunityScripts(f.options), /verification/);
  assert.deepEqual(f.writes, []);
  assert.equal(await f.data.get(prefix + paths[0]).text(), 'old');
});

test('interrupted resource update retries without rewriting verified scripts', async () => {
  const f = resourceFixture(); f.fail(f.path);
  await assert.rejects(refreshCommunityScripts(f.options), /interrupted/);
  assert.equal(await f.data.get(prefix + paths[0]).text(), 'new');
  const first = f.data.get(prefix + paths[0]);
  assert.equal(await refreshCommunityScripts(f.options), true);
  assert.equal(f.data.get(prefix + paths[0]), first);
  assert.equal(await f.data.get(prefix + f.path).text(), 'resnew');
});

function intentFixture() {
  const f = fixture(), added = ['Data/MMMIntentText.bin', 'DataMX/MMMIntentText.bin'];
  const target = 'e'.repeat(64), recipe = f.options.loadRecipe;
  const hash = f.options.hashFile, fetchFile = f.options.fetchFile;
  for (const path of added) {
    f.options.files[path] = target;
    f.options.sizes[path] = 3;
  }
  f.options.hashFile = async blob => await blob.text() === 'txt' ? target : hash(blob);
  f.options.fetchFile = async url => {
    if (url.endsWith('intent.bin')) { f.counts.fetch++; return new Response('txt'); }
    return fetchFile(url);
  };
  f.options.loadRecipe = async () => ({patches: [
    ...(await recipe()).patches,
    ...added.map(path => ({path, sha256: target, bytes: 3,
      url: 'https://raw.githubusercontent.com/bolander72/majesty/' + 'b'.repeat(40)
        + '/assets/content/resources/intent.bin'})),
  ]});
  return {...f, added};
}

test('adds both bound intent registries to an older collection and keeps saves', async () => {
  const f = intentFixture(), saved = f.data.get('majesty/profile/player/SaveGame/keep.GMP');
  assert.equal(await refreshCommunityScripts(f.options), true);
  const manifest = JSON.parse(await f.data.get(prefix + '.manifest.json').text());
  for (const path of f.added) {
    assert.equal(await f.data.get(prefix + path).text(), 'txt');
    assert.equal(manifest.files[path].size, 3);
  }
  assert.equal(f.data.get('majesty/profile/player/SaveGame/keep.GMP'), saved);
  assert.equal(f.counts.fetch, 2);
});

test('an unknown pre-existing intent file blocks all writes and downloads', async () => {
  const f = intentFixture(); f.put(prefix + f.added[0], 'custom');
  await assert.rejects(refreshCommunityScripts(f.options), /Customized/);
  assert.deepEqual(f.writes, []);
  assert.equal(f.counts.fetch, 0);
  assert.equal(f.data.has(prefix + f.added[1]), false);
});

test('an interrupted new registry is removed and retries without replacing completed scripts', async () => {
  const f = intentFixture(); f.fail(f.added[0]);
  await assert.rejects(refreshCommunityScripts(f.options), /interrupted/);
  assert.equal(f.data.has(prefix + f.added[0]), false);
  const completed = f.data.get(prefix + paths[0]);
  assert.equal(await refreshCommunityScripts(f.options), true);
  assert.equal(f.data.get(prefix + paths[0]), completed);
  for (const path of f.added) assert.equal(await f.data.get(prefix + path).text(), 'txt');
});

test('a completed exact registry survives retry before its manifest was committed', async () => {
  const f = intentFixture(); f.put(prefix + f.added[0], 'txt');
  const completed = f.data.get(prefix + f.added[0]);
  assert.equal(await refreshCommunityScripts(f.options), true);
  assert.equal(f.data.get(prefix + f.added[0]), completed);
  const manifest = JSON.parse(await f.data.get(prefix + '.manifest.json').text());
  assert.equal(manifest.files[f.added[0]].size, 3);
});
