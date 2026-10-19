import {Sha256} from '../world/sha256.mjs';
import {derivedDescriptor, collectGameFiles, buildDerivedFiles} from './derived-assets.mjs';
import {assetUrl} from './asset-url.mjs';
import {refreshCommunityScripts} from './community-updates.mjs';

export function assetDescriptor(value, id) {
  const record = value?.games?.[id];
  if (value?.format !== 'majesty-automatic-assets-v1' || !record
      || !Number.isSafeInteger(record.bytes) || record.bytes <= 0 || record.bytes > 1024 ** 3
      || !/^[a-f0-9]{64}$/.test(record.sha256)) throw Error('Automatic game assets are unavailable.');
  if (record.parts !== undefined) {
    if (record.url !== undefined || !Array.isArray(record.parts) ||
        record.parts.length < 1 || record.parts.length > 64)
      throw Error('Invalid game asset parts.');
    const seen = new Set();
    let bytes = 0;
    const parts = record.parts.map(part => {
      const url = assetUrl(part.url);
      if (!Number.isSafeInteger(part.bytes) || part.bytes < 1 || part.bytes > 50 * 1024 * 1024 ||
          !/^[a-f0-9]{64}$/.test(part.sha256) || seen.has(url))
        throw Error('Invalid game asset part.');
      seen.add(url); bytes += part.bytes;
      return {...part, url};
    });
    if (bytes !== record.bytes) throw Error('Game asset parts size differs.');
    return {...record, parts};
  }
  return {...record, url: assetUrl(record.url)};
}

export async function downloadAssets(record, folder, {fetchFile = fetch, signal, progress = () => {}} = {}) {
  const filename = record.sha256 + '.zip';
  const handle = await folder.getFileHandle(filename, {create: true});
  const writer = await handle.createWritable();
  let reader;
  try {
    let bytes = 0;
    const hash = new Sha256();
    // Concatenate sequential response streams directly into one OPFS file.
    // Neither a full part nor the 570 MB archive is buffered in JS memory.
    for (const part of record.parts || [record]) {
      const response = await fetchFile(part.url, {signal, credentials: 'omit'});
      if (!response.ok || !response.body) throw Error('Game assets could not be downloaded.');
      reader = response.body.getReader();
      let partBytes = 0;
      const partHash = new Sha256();
      for (;;) {
        signal?.throwIfAborted();
        const {done, value} = await reader.read();
        if (done) break;
        bytes += value.length; partBytes += value.length;
        if (bytes > record.bytes || partBytes > part.bytes) throw Error('Game asset size differs.');
        hash.update(value); partHash.update(value);
        await writer.write(value);
        progress(bytes, record.bytes);
      }
      if (partBytes !== part.bytes || partHash.hex() !== part.sha256)
        throw Error('Game asset verification failed.');
    }
    if (bytes !== record.bytes || hash.hex() !== record.sha256)
      throw Error('Game asset verification failed.');
    await writer.close();
    return await handle.getFile();
  } catch (error) {
    await reader?.cancel().catch(() => {});
    await writer.abort().catch(() => {});
    await folder.removeEntry(filename).catch(() => {});
    throw error;
  }
}

export async function ensureAutomaticAssets(id, {
  status, importZip, importFiles, signal, progress, storage = navigator.storage, locks = navigator.locks,
  fetchFile = fetch,
}) {
  if ((await status(id))?.status?.state === 'ready') {
    if (id === 'majesty-community-guilds-v1')
      await refreshCommunityScripts({storage, locks, fetchFile, signal});
    return;
  }
  if (!locks?.request) throw Error('This browser cannot prepare the game files.');
  if (['majesty-wayfinder', 'majesty-lost-trail', 'majesty-lost-trail-v2', 'majesty-alchemist-v1-campaign3', 'majesty-alchemist-demo-v1', 'majesty-community-guilds-v1'].includes(id)) {
    const response = await fetchFile(new URL('./automatic-assets.json', import.meta.url), {signal});
    if (!response.ok) throw Error('Automatic content is unavailable.');
    const recipe = derivedDescriptor(await response.json(), id);
    if (typeof importFiles !== 'function') throw Error('Content preparation is unavailable.');
    await ensureAutomaticAssets(recipe.baseId, {status, importZip, importFiles, signal, progress, storage, locks, fetchFile});
    return locks.request('majesty-automatic-game-assets', {mode: 'exclusive', signal}, async () => {
      if ((await status(id))?.status?.state === 'ready') return;
      let game = await storage.getDirectory();
      for (const name of [recipe.baseId, 'game']) game = await game.getDirectoryHandle(name);
      const files = await buildDerivedFiles(await collectGameFiles(game), recipe, {fetchFile, signal});
      await importFiles(id, files);
      if ((await status(id))?.status?.state !== 'ready') throw Error('Content preparation did not finish.');
    });
  }
  return locks.request('majesty-automatic-game-assets', {mode: 'exclusive', signal}, async () => {
    if ((await status(id))?.status?.state === 'ready') return;
    const response = await fetchFile(new URL('./automatic-assets.json', import.meta.url), {signal});
    if (!response.ok) throw Error('Automatic game assets are not configured yet.');
    const record = assetDescriptor(await response.json(), id);
    const root = await storage.getDirectory();
    const folder = await root.getDirectoryHandle('majesty-asset-downloads', {create: true});
    const blob = await downloadAssets(record, folder, {fetchFile, signal, progress});
    try {
      signal?.throwIfAborted();
      await importZip(id, new File([blob], 'Majesty.zip', {type: 'application/zip'}));
      if ((await status(id))?.status?.state !== 'ready') throw Error('Game preparation did not finish.');
    } finally { await folder.removeEntry(record.sha256 + '.zip').catch(() => {}); }
  });
}
