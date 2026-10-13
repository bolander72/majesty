import {hashBlob} from '../world/content-hash.mjs';
import {LOST_TRAIL_V2_FILES} from '../content/lost-trail-v2-files.mjs';
import {assetUrl} from './asset-url.mjs';

export const MAP_ART_UPDATE = Object.freeze({
  path: 'DataMX/LostTrail-menu-art.cam',
  previousSha256: 'd507fdb71c25ac323584f6d832ec0252be7aedf534ffe30b22b2fed985eac0c9',
  sha256: 'b75ac61a93f7586d880f6708b6915fc273ad7bd4c2d9bca3bbacd5a318a9e8c4',
  bytes: 335244,
  url: 'https://raw.githubusercontent.com/bolander72/majesty/3b3c6e21680a9d6737b8b947c67bbc61b14880c1/assets/content/lost-trail-map-art-v3/DataMX/LostTrail-menu-art.cam',
});

async function writeAtomic(handle, data) {
  const writer = await handle.createWritable();
  try { await writer.write(data); await writer.close(); }
  catch (error) { await writer.abort().catch(() => {}); throw error; }
}

// One small art-only upgrade before the engine mounts its files. Never reimport
// the game, touch a profile, or replace customized art. OPFS writable close is
// atomic, and every downloaded byte is verified before creating a writer.
export async function updateCachedMapArt(id, {signal, storage = globalThis.navigator?.storage,
  locks = globalThis.navigator?.locks, fetchFile = fetch, hashFile = hashBlob,
  update = MAP_ART_UPDATE} = {}) {
  if (id !== 'majesty-lost-trail-v2') return {updated: false};
  if (!storage || !locks?.request) throw Error('Map artwork storage is unavailable.');
  if (update.sha256 !== LOST_TRAIL_V2_FILES[update.path]) throw Error('Map artwork binding differs.');
  return locks.request('majesty-automatic-game-assets', {mode: 'exclusive', signal}, async () => {
    let game = await storage.getDirectory();
    for (const part of [id, 'game']) game = await game.getDirectoryHandle(part);
    const data = await game.getDirectoryHandle('DataMX');
    const handle = await data.getFileHandle('LostTrail-menu-art.cam');
    const old = await handle.getFile();
    if (old.size > 1024 * 1024) return {updated: false, customized: true};
    const digest = await hashFile(old);
    if (![update.sha256, update.previousSha256].includes(digest)) return {updated: false, customized: true};
    const manifestHandle = await game.getFileHandle('.manifest.json');
    const manifest = JSON.parse(await (await manifestHandle.getFile()).text());
    if (!manifest.files?.[update.path]) throw Error('Map artwork import is incomplete.');
    let changed = false;
    if (digest !== update.sha256) {
      const response = await fetchFile(assetUrl(update.url), {signal, credentials: 'omit'});
      if (!response.ok || !response.body) throw Error('Map artwork download is unavailable.');
      const reader = response.body.getReader(), chunks = []; let bytes = 0;
      try {
        for (;;) {
          signal?.throwIfAborted();
          const next = await reader.read(); if (next.done) break;
          bytes += next.value.length;
          if (bytes > update.bytes) throw Error('Map artwork size differs.');
          chunks.push(next.value);
        }
      } catch (error) { await reader.cancel().catch(() => {}); throw error; }
      const file = new Blob(chunks);
      if (bytes !== update.bytes || await hashFile(file) !== update.sha256)
        throw Error('Map artwork verification failed.');
      signal?.throwIfAborted();
      await writeAtomic(handle, file); changed = true;
    }
    // Also recover metadata if a previous tab closed after the asset commit.
    const current = await handle.getFile();
    if (changed || manifest.files[update.path].size !== current.size) {
      manifest.files[update.path] = {size: current.size, mtime: current.lastModified};
      await writeAtomic(manifestHandle, JSON.stringify(manifest));
    }
    return {updated: changed};
  });
}
