import {Sha256} from '../world/sha256.mjs';
import {derivedDescriptor, collectGameFiles, buildDerivedFiles} from './derived-assets.mjs';

export function assetDescriptor(value, id) {
  const record = value?.games?.[id];
  if (value?.format !== 'majesty-automatic-assets-v1' || !record
      || !Number.isSafeInteger(record.bytes) || record.bytes <= 0 || record.bytes > 1024 ** 3
      || !/^[a-f0-9]{64}$/.test(record.sha256)) throw Error('Automatic game assets are unavailable.');
  const url = new URL(record.url);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.public.blob.vercel-storage.com')
      || url.username || url.password || url.search || url.hash)
    throw Error('Invalid automatic game asset location.');
  return {...record, url: url.href};
}

export async function downloadAssets(record, folder, {fetchFile = fetch, signal, progress = () => {}} = {}) {
  const filename = record.sha256 + '.zip';
  const handle = await folder.getFileHandle(filename, {create: true});
  const writer = await handle.createWritable();
  let reader;
  try {
    const response = await fetchFile(record.url, {signal, credentials: 'omit'});
    if (!response.ok || !response.body) throw Error('Game assets could not be downloaded.');
    reader = response.body.getReader();
    let bytes = 0;
    const hash = new Sha256();
    for (;;) {
      signal?.throwIfAborted();
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > record.bytes) throw Error('Game asset size differs.');
      hash.update(value);
      await writer.write(value);
      progress(bytes, record.bytes);
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
  if ((await status(id))?.status?.state === 'ready') return;
  if (!locks?.request) throw Error('This browser cannot prepare the game files.');
  if (id === 'majesty-wayfinder') {
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
