import {hashBlob} from '../world/content-hash.mjs';
import {LOST_TRAIL_V2_FILES} from '../content/lost-trail-v2-files.mjs';
import {assetUrl} from './asset-url.mjs';

export const MAP_ART_UPDATE = Object.freeze({
  path: 'DataMX/LostTrail-menu-art.cam',
  previousSha256: 'b75ac61a93f7586d880f6708b6915fc273ad7bd4c2d9bca3bbacd5a318a9e8c4',
  previousSha256s: ['0da4389a4b50b89ad400b277680fd1020c173d7d603c0998479472db0a9d9ff3', 'd507fdb71c25ac323584f6d832ec0252be7aedf534ffe30b22b2fed985eac0c9'],
  sha256: 'e413324867b6fa4c1dbdcf040385caabeca8cad047a7b3411763eabb83088468',
  bytes: 338568,
  url: 'https://raw.githubusercontent.com/bolander72/majesty/6ecbef1d13ece4599822975be0b371a84895a034/assets/content/lost-trail-hover-v5/DataMX/LostTrail-menu-art.cam',
});

export const LODGE_ICON_UPDATE = Object.freeze({
  path: 'DataMX/Wayfinder-art.cam',
  previousSha256: '49bc70478d75d97ee1a76d28daad0f04b6ef73618a27c143f9e5f8bf63ac4647',
  sha256: 'f8d5b85b14c819e7269a8f967a6651a1e8e4d45d6df759c11e9c840a115ae00c',
  bytes: 303952,
  url: 'https://raw.githubusercontent.com/bolander72/majesty/f94522043b43fd1a7a50a7c070cf9c1ba0c482e8/assets/content/trail-lodge-ui-v3/DataMX/Wayfinder-art.cam',
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
    const handle = await data.getFileHandle(update.path.split('/')[1]);
    const old = await handle.getFile();
    if (old.size > 1024 * 1024) return {updated: false, customized: true};
    const digest = await hashFile(old);
    if (![update.sha256, update.previousSha256, ...(update.previousSha256s || [])].includes(digest)) return {updated: false, customized: true};
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

export async function updateCachedArtwork(id, options = {}) {
  const map = await updateCachedMapArt(id, options);
  const icon = await updateCachedMapArt(id, {...options, update: LODGE_ICON_UPDATE});
  return {map, icon};
}
