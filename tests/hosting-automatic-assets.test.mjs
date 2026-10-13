import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assetDescriptor, downloadAssets, ensureAutomaticAssets} from '../web/hosting/automatic-assets.mjs';

const raw = new TextEncoder().encode('test game data');
const record = {url: 'https://example.public.blob.vercel-storage.com/game.zip',
  bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex')};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const github = 'https://raw.githubusercontent.com/bolander72/majesty/' + 'a'.repeat(40) + '/assets/';
const pieces = [raw.subarray(0, 5), raw.subarray(5)];
const split = {bytes: raw.length, sha256: record.sha256,
  parts: pieces.map((bytes, n) => ({url: github + `part-${n}.bin`, bytes: bytes.length, sha256: digest(bytes)}))};

function storage() {
  const state = {writes: [], closed: false, aborted: false, removed: false};
  const folder = {
    getFileHandle: async () => ({
      createWritable: async () => ({
        write: async b => state.writes.push(b), close: async () => { state.closed = true; },
        abort: async () => { state.aborted = true; },
      }),
      getFile: async () => new Blob(state.writes),
    }),
    removeEntry: async () => { state.removed = true; },
  };
  return {state, folder};
}

test('automatic loading accepts only pinned, bounded, public asset locations', () => {
  assert.equal(assetDescriptor({format: 'majesty-automatic-assets-v1', games: {majesty: record}}, 'majesty').url,
    record.url);
  for (const change of [{url: 'http://example.com/game.zip'}, {url: record.url + '?secret=token'},
    {bytes: 2 ** 31}, {sha256: 'invalid'}]) {
    assert.throws(() => assetDescriptor({format: 'majesty-automatic-assets-v1',
      games: {majesty: {...record, ...change}}}, 'majesty'));
  }
});

test('download is streamed to storage and verified before import', async () => {
  const {state, folder} = storage();
  const blob = await downloadAssets(record, folder, {fetchFile: async () => new Response(raw)});
  assert.equal(await blob.text(), 'test game data');
  assert.equal(state.closed, true);
  assert.equal(state.aborted, false);
});

test('corrupt or truncated assets are removed and never accepted', async () => {
  for (const bytes of [raw.subarray(0, 4), new Uint8Array(raw.length)]) {
    const {state, folder} = storage();
    await assert.rejects(downloadAssets(record, folder, {fetchFile: async () => new Response(bytes)}),
      /verification failed/);
    assert.equal(state.aborted, true);
    assert.equal(state.removed, true);
    assert.equal(state.closed, false);
  }
});

test('an oversized response is stopped before storing the unexpected bytes', async () => {
  const {state, folder} = storage();
  await assert.rejects(downloadAssets(record, folder, {
    fetchFile: async () => new Response(new Uint8Array(raw.length + 1)),
  }), /size differs/);
  assert.equal(state.writes.length, 0);
  assert.equal(state.removed, true);
});

test('returning players use their cached game without fetching assets again', async () => {
  await ensureAutomaticAssets('majesty', {status: async () => ({status: {state: 'ready'}}),
    importZip: () => assert.fail(), fetchFile: () => assert.fail(), storage: null, locks: null});
});

test('GitHub parts require immutable project URLs, unique parts and an exact total size', () => {
  const descriptor = value => assetDescriptor({format: 'majesty-automatic-assets-v1', games: {majesty: value}}, 'majesty');
  assert.equal(descriptor(split).parts.length, 2);
  for (const edit of [r => {r.parts[0].url = github.replace('a'.repeat(40), 'main') + 'file';},
    r => {r.parts[0].url = github.replace('bolander72', 'unrelated') + 'file';},
    r => {r.parts[0].url += '?token=secret';}, r => {r.parts[0].sha256 = 'invalid';},
    r => {r.parts[0].bytes++;}, r => {r.parts[0].bytes = 100 * 1024 * 1024;},
    r => {r.parts[1] = r.parts[0];}, r => {r.url = record.url;}, r => {r.parts = [];}]) {
    const bad = structuredClone(split); edit(bad); assert.throws(() => descriptor(bad));
  }
});

test('parts concatenate in order with bounded writes and preserve the original ZIP digest', async () => {
  const {state, folder} = storage(); let at = 0;
  const blob = await downloadAssets(split, folder, {fetchFile: async url => {
    assert.equal(url, split.parts[at].url); return new Response(pieces[at++]);
  }});
  assert.equal(await blob.text(), 'test game data');
  assert.equal(at, 2); assert.equal(state.closed, true);
});

test('corruption, truncation, reordered parts and a wrong complete digest never finish the download', async () => {
  for (const problem of ['corrupt', 'truncated', 'reordered', 'complete']) {
    const {state, folder} = storage(); let at = 0; const plan = structuredClone(split);
    if (problem === 'reordered') plan.parts.reverse();
    if (problem === 'complete') plan.sha256 = '0'.repeat(64);
    await assert.rejects(downloadAssets(plan, folder, {fetchFile: async () => {
      const index = problem === 'reordered' ? 1 - at++ : at++;
      const bytes = index === 1 && problem === 'corrupt' ? new Uint8Array(pieces[1].length) :
        index === 1 && problem === 'truncated' ? pieces[1].subarray(1) : pieces[index];
      return new Response(bytes);
    }}), /verification failed/);
    assert.equal(state.closed, false); assert.equal(state.aborted, true); assert.equal(state.removed, true);
  }
});
