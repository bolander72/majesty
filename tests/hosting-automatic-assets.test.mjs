import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assetDescriptor, downloadAssets, ensureAutomaticAssets} from '../web/hosting/automatic-assets.mjs';

const raw = new TextEncoder().encode('test game data');
const record = {url: 'https://example.public.blob.vercel-storage.com/game.zip',
  bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex')};

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
