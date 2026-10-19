import {COMMUNITY_FILES, COMMUNITY_SIZES, COMMUNITY_STORAGE_ID} from '../content/community-files.mjs';
import {derivedDescriptor} from './derived-assets.mjs';
import {assetUrl} from './asset-url.mjs';
import {hashBlob} from '../world/content-hash.mjs';

// Only these previously qualified scripts can be replaced in an installed pack.
// Profiles, saves, original collections and customized scripts are preserved.
const PREVIOUS = Object.freeze(Object.fromEntries(['Data', 'DataMX'].map(folder =>
  [folder + '/Community_Common.bcd', '9df88eb9f536155ed03b148b547ba4a88a24cc86f7212416517a213f42120d1a'])));
const MARKER = '.community-script-revision.json';
const FORMAT = 'majesty-community-script-revision-v1';

async function fileHandle(root, path) {
  const parts = path.split('/'), name = parts.pop();
  for (const part of parts) root = await root.getDirectoryHandle(part);
  return root.getFileHandle(name);
}

async function write(handle, data, signal) {
  const writer = await handle.createWritable();
  try {
    signal?.throwIfAborted();
    await writer.write(data);
    signal?.throwIfAborted();
    await writer.close();
  } catch (error) { await writer.abort().catch(() => {}); throw error; }
}

async function patchBlob(patch, fetchFile, hashFile, signal) {
  const response = await fetchFile(assetUrl(patch.url), {signal, credentials: 'omit'});
  if (!response.ok || !response.body) throw Error('The game script update is unavailable.');
  const reader = response.body.getReader(), chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      signal?.throwIfAborted();
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > patch.bytes) throw Error('The game script update size differs.');
      chunks.push(value);
    }
    const blob = new Blob(chunks);
    if (bytes !== patch.bytes || await hashFile(blob) !== patch.sha256)
      throw Error('The game script update failed verification.');
    return blob;
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
}

export async function refreshCommunityScripts({storage, locks, fetchFile = fetch, signal,
  hashFile = hashBlob, files = COMMUNITY_FILES, sizes = COMMUNITY_SIZES,
  loadRecipe = async () => {
    const response = await fetchFile(new URL('./automatic-assets.json', import.meta.url), {signal});
    if (!response.ok) throw Error('The game script update recipe is unavailable.');
    return derivedDescriptor(await response.json(), COMMUNITY_STORAGE_ID);
  },
} = {}) {
  const changes = Object.entries(PREVIOUS).filter(([path, prior]) => files[path] !== prior)
    .map(([path, prior]) => ({path, prior, sha256: files[path], bytes: sizes[path]}));
  if (!changes.length) return false;
  if (changes.some(p => !/^[a-f0-9]{64}$/.test(p.sha256) || !Number.isSafeInteger(p.bytes)
      || p.bytes < 1 || p.bytes > 32 * 1024 * 1024)) throw Error('Invalid script update binding.');
  if (!locks?.request) throw Error('This browser cannot safely update game scripts.');
  return locks.request('majesty-automatic-game-assets', {mode: 'exclusive', signal}, async () => {
    signal?.throwIfAborted();
    let game = await storage.getDirectory();
    for (const part of [COMMUNITY_STORAGE_ID, 'game']) game = await game.getDirectoryHandle(part);
    const revision = JSON.stringify(changes.map(p => [p.path, p.sha256]));
    let marker;
    try {
      const file = await (await game.getFileHandle(MARKER)).getFile();
      if (file.size <= 4096) marker = JSON.parse(await file.text());
    } catch { /* An older or interrupted installation has no trusted marker. */ }
    const current = [];
    for (const patch of changes) {
      const handle = await fileHandle(game, patch.path);
      current.push({...patch, handle, file: await handle.getFile()});
    }
    if (marker?.format === FORMAT && marker.revision === revision && current.every(p =>
      p.file.lastModified > 0 && p.file.size === p.bytes && marker.files?.[p.path]?.size === p.file.size
        && marker.files[p.path].modified === p.file.lastModified)) return false;
    const manifestHandle = await game.getFileHandle('.manifest.json');
    const manifestFile = await manifestHandle.getFile();
    if (manifestFile.size > 1024 * 1024) throw Error('Game manifest is oversized; it was preserved.');
    const manifest = JSON.parse(await manifestFile.text());
    const recipe = await loadRecipe();
    // Validate every existing file before fetching or replacing any of them.
    for (const patch of current) {
      if (!manifest.files?.[patch.path]) throw Error('Incomplete game manifest; it was preserved.');
      const source = recipe.patches.filter(p => p.path === patch.path);
      if (source.length !== 1 || source[0].sha256 !== patch.sha256 || source[0].bytes !== patch.bytes)
        throw Error('The script update differs from its source binding.');
      patch.source = source[0];
      patch.have = await hashFile(patch.file);
      if (patch.have !== patch.prior && patch.have !== patch.sha256)
        throw Error('Customized game scripts were preserved; automatic update refused.');
    }
    const blobs = new Map();
    for (const patch of current) {
      if (patch.have !== patch.sha256 && !blobs.has(patch.sha256))
        blobs.set(patch.sha256, await patchBlob(patch.source, fetchFile, hashFile, signal));
    }
    const stamps = {};
    for (const patch of current) {
      if (patch.have !== patch.sha256) await write(patch.handle, blobs.get(patch.sha256), signal);
      const file = await patch.handle.getFile();
      manifest.files[patch.path] = {...manifest.files[patch.path], size: file.size, mtime: file.lastModified};
      stamps[patch.path] = {size: file.size, modified: file.lastModified};
    }
    await write(manifestHandle, JSON.stringify(manifest), signal);
    await write(await game.getFileHandle(MARKER, {create: true}),
      JSON.stringify({format: FORMAT, revision, files: stamps}), signal);
    return true;
  });
}
