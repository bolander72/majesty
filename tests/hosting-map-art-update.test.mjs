import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP_ART_UPDATE, updateCachedMapArt} from '../web/hosting/map-art-update.mjs';

function fixture(digest = MAP_ART_UPDATE.previousSha256, failure) {
  const state = {digest, downloads: 0, writes: [], data: new Blob(['old']), manifest: {files: {
    [MAP_ART_UPDATE.path]: {size: 3, mtime: 1}, 'MajestyHD - Old.exe': {size: 500, mtime: 1}}}};
  const manifest = {getFile: async () => new Blob([JSON.stringify(state.manifest)]),
    createWritable: async () => {let pending;return {write: async b => {pending = b;},
      close: async () => {state.manifest = JSON.parse(pending);state.writes.push('manifest');}, abort: async () => {}};}};
  const artwork = {getFile: async () => state.data,
    createWritable: async () => {let pending;return {write: async b => {pending = b;if(failure)throw Error('quota');},
      close: async () => {state.data = pending;state.digest = MAP_ART_UPDATE.sha256;state.writes.push('artwork');},
      abort: async () => {state.writes.push('abort');}};}};
  const data = {getFileHandle: async name => {assert.equal(name,'LostTrail-menu-art.cam');return artwork;}};
  const game = {getDirectoryHandle: async name => {assert.equal(name,'DataMX');return data;},
    getFileHandle: async name => {assert.equal(name,'.manifest.json');return manifest;}};
  const collection = {getDirectoryHandle: async name => {assert.equal(name,'game');return game;}};
  const root = {getDirectoryHandle: async name => {assert.equal(name,'majesty-lost-trail-v2');return collection;}};
  const options = {storage: {getDirectory: async () => root},
    locks: {request: async (key, options, f) => {assert.equal(key,'majesty-automatic-game-assets');return f();}},
    fetchFile: async url => {assert.equal(url,MAP_ART_UPDATE.url);state.downloads++;return new Response(new Uint8Array(MAP_ART_UPDATE.bytes));},
    hashFile: async blob => blob === state.data ? state.digest : MAP_ART_UPDATE.sha256};
  return {state, options};
}

test('cached prototype upgrades only art and its manifest entry; subsequent starts use the cache', async () => {
  const {state, options} = fixture();
  assert.deepEqual(await updateCachedMapArt('majesty-lost-trail-v2',options), {updated:true});
  assert.deepEqual(state.writes,['artwork','manifest']);
  assert.equal(state.manifest.files[MAP_ART_UPDATE.path].size,MAP_ART_UPDATE.bytes);
  assert.deepEqual(state.manifest.files['MajestyHD - Old.exe'],{size:500,mtime:1});
  assert.deepEqual(await updateCachedMapArt('majesty-lost-trail-v2',options),{updated:false});
  assert.equal(state.downloads,1);
});

test('customized assets and other editions are preserved without downloads or writes', async () => {
  const {state, options} = fixture('customized');
  assert.deepEqual(await updateCachedMapArt('majesty-lost-trail-v2',options),{updated:false,customized:true});
  await updateCachedMapArt('majesty',options);await updateCachedMapArt('majesty-lost-trail',options);
  assert.equal(state.downloads,0);assert.deepEqual(state.writes,[]);
});

test('truncated, corrupt and oversized downloads never open a writer', async () => {
  for (const type of ['truncated','corrupt','oversized']) {
    const {state, options} = fixture();
    options.fetchFile = async () => new Response(new Uint8Array(MAP_ART_UPDATE.bytes+(type==='truncated'?-1:type==='oversized'?1:0)));
    if(type==='corrupt')options.hashFile=async blob=>blob===state.data?state.digest:'bad';
    await assert.rejects(updateCachedMapArt('majesty-lost-trail-v2',options), /artwork (size differs|verification failed)/);
    assert.deepEqual(state.writes,[]);assert.equal(await state.data.text(),'old');
  }
});

test('a failed atomic write preserves the prototype and manifest', async () => {
  const {state, options} = fixture(MAP_ART_UPDATE.previousSha256,true);
  await assert.rejects(updateCachedMapArt('majesty-lost-trail-v2',options),/quota/);
  assert.deepEqual(state.writes,['abort']);assert.equal(await state.data.text(),'old');
  assert.equal(state.manifest.files[MAP_ART_UPDATE.path].size,3);
});

test('already committed art repairs interrupted manifest metadata without downloading again', async () => {
  const {state, options} = fixture(MAP_ART_UPDATE.sha256);
  state.data = new Blob([new Uint8Array(MAP_ART_UPDATE.bytes)]);
  await updateCachedMapArt('majesty-lost-trail-v2',options);
  assert.equal(state.downloads,0);assert.deepEqual(state.writes,['manifest']);
});

test('published updater matches the immutable release asset and original source binding', async () => {
  const {readFile} = await import('node:fs/promises');
  const {createHash} = await import('node:crypto');
  const release = JSON.parse(await readFile(new URL('../deploy/content-v2-release.json',import.meta.url)));
  const patch = release.patches.find(p => p.path===MAP_ART_UPDATE.path);
  assert.deepEqual(patch,{path:MAP_ART_UPDATE.path,bytes:MAP_ART_UPDATE.bytes,sha256:MAP_ART_UPDATE.sha256,url:MAP_ART_UPDATE.url});
  const png = await readFile(new URL('../content/the-lost-trail/artwork/trail-lodge-map.png',import.meta.url));
  assert.equal(createHash('sha256').update(png).digest('hex'),release.mapArtworkSourceSha256);
});
