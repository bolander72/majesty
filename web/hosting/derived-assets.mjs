import {WAYFINDER_FILES} from '../content/edition-session.mjs';
import {LOST_TRAIL_FILES, LOST_TRAIL_REPLACEMENTS} from '../content/lost-trail-files.mjs';
import {hashBlob} from '../world/content-hash.mjs';
import {assetUrl} from './asset-url.mjs';

export function derivedDescriptor(value, id) {
  const record = value?.games?.[id];
  const expected = id === 'majesty-lost-trail' ? LOST_TRAIL_FILES : WAYFINDER_FILES;
  if (value?.format !== 'majesty-automatic-assets-v1' || !['majesty-wayfinder', 'majesty-lost-trail'].includes(id)
      || record?.baseId !== 'majesty' || !Array.isArray(record.patches)
      || record.patches.length !== Object.keys(expected).length)
    throw Error('Invalid content asset recipe.');
  const seen = new Set();
  for (const file of record.patches) {
    if (!Object.hasOwn(expected, file.path) || seen.has(file.path) || expected[file.path] !== file.sha256
        || !Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > 1024 * 1024)
      throw Error('Content patch differs from the verified pack.');
    assetUrl(file.url);
    seen.add(file.path);
  }
  return {...record, contentSet: id === 'majesty-lost-trail' ? 'lost-trail-v1' : 'wayfinder-v1'};
}

export async function collectGameFiles(root) {
  const files = [];
  async function walk(directory, prefix = '') {
    for await (const [name, handle] of directory.entries()) {
      const path = prefix + name;
      if (handle.kind === 'directory') await walk(handle, path + '/');
      else if (!name.startsWith('.')) files.push({path, file: await handle.getFile()});
    }
  }
  await walk(root);
  return files;
}

export async function buildDerivedFiles(baseFiles, recipe, {fetchFile = fetch, signal, hashFile = hashBlob} = {}) {
  const files = new Map(baseFiles.map(file => [file.path, file]));
  if (files.size !== baseFiles.length || !files.has('MajestyHD - Old.exe'))
    throw Error('A complete original game copy is required.');
  const oldConfig = files.get('DataMX/mx_miscdata.cam');
  if (!oldConfig || await hashFile(oldConfig.file) !== '14adacc16a0340f14cf951d933cf10b9bb08b770d189e8591660aebebfac3fb3')
    throw Error('The original game configuration differs; existing content was preserved.');
  const replacements = recipe.contentSet === 'lost-trail-v1' ? LOST_TRAIL_REPLACEMENTS :
    {'DataMX/mx_miscdata.cam': '14adacc16a0340f14cf951d933cf10b9bb08b770d189e8591660aebebfac3fb3'};
  // Verify every replacement before downloading any patches. Customized source
  // collections remain untouched, and only new File handles replace this copy.
  for (const patch of recipe.patches) {
    const original = files.get(patch.path), expected = replacements[patch.path];
    if (expected ? !original || await hashFile(original.file) !== expected : original)
      throw Error('The source already includes modified content; it was preserved.');
  }
  for (const patch of recipe.patches) {
    const response = await fetchFile(patch.url, {signal, credentials: 'omit'});
    if (!response.ok) throw Error('The content could not be downloaded.');
    // These are small verified resources. Refuse oversized responses before
    // buffering; the base game's hundreds of MB remain immutable File handles.
    const reader = response.body.getReader(), chunks = [];
    let bytes = 0;
    try {
      for (;;) {
        signal?.throwIfAborted();
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.length;
        if (bytes > patch.bytes) throw Error('Content patch size differs.');
        chunks.push(next.value);
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    const file = new File(chunks, patch.path.split('/').at(-1));
    if (bytes !== patch.bytes || await hashFile(file) !== patch.sha256)
      throw Error('Content patch verification failed.');
    files.set(patch.path, {path: patch.path, file});
  }
  return [...files.values()];
}
