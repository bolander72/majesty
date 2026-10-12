import {ContentHasher} from '../world/content-hash.mjs';

const FORMAT = 'majesty-content-hashes-v1';
const MAX_BYTES = 1024 * 1024;
const MAX_FILES = 8192;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

// This cache belongs to the site's immutable game data, never to player saves.
// Multiplayer and managed-world startup still request a fresh byte check.
export async function cachedFileHashes(files, key, {
  signal, fresh = false, storage = navigator.storage,
  makeHasher = () => new ContentHasher(),
} = {}) {
  signal?.throwIfAborted();
  let handle, cached = {}, hasher;
  const enabled = !fresh && /^[a-zA-Z0-9_-]{1,60}$/.test(key || '') && files.length <= MAX_FILES;
  if (enabled) {
    try {
      const root = await storage.getDirectory();
      const dir = await root.getDirectoryHandle('majesty-startup-cache', {create: true});
      handle = await dir.getFileHandle(key + '.json', {create: true});
      const file = await handle.getFile();
      if (file.size && file.size <= MAX_BYTES) {
        const value = JSON.parse(await file.text());
        if (value?.format === FORMAT && value.files && typeof value.files === 'object'
            && !Array.isArray(value.files) && Object.keys(value.files).length <= MAX_FILES)
          cached = value.files;
      }
    } catch { /* An unavailable cache must not prevent launching the game. */ }
  }
  const next = Object.create(null), entries = [];
  const cancel = () => hasher?.close();
  signal?.addEventListener('abort', cancel, {once: true});
  try {
    for (const [name, source] of files) {
      signal?.throwIfAborted();
      const file = await source.getFile();
      signal?.throwIfAborted();
      const modified = file.lastModified;
      const previous = Object.hasOwn(cached, name) ? cached[name] : null;
      const reusable = enabled && Number.isSafeInteger(modified) && modified > 0
        && previous?.size === file.size && previous?.modified === modified && digest(previous.sha256);
      let sha256 = reusable ? previous.sha256 : null;
      if (!sha256) {
        hasher ??= makeHasher();
        sha256 = await hasher.hash(file);
        if (!digest(sha256)) throw Error('Invalid content hash result');
      }
      entries.push(name + '\0' + sha256);
      if (Number.isSafeInteger(modified) && modified > 0)
        next[name] = {size: file.size, modified, sha256};
    }
    signal?.throwIfAborted();
  } finally {
    signal?.removeEventListener('abort', cancel);
    hasher?.close();
  }
  if (handle) {
    const text = JSON.stringify({format: FORMAT, files: next});
    if (new TextEncoder().encode(text).length <= MAX_BYTES) {
      let writer;
      try {
        writer = await handle.createWritable();
        signal?.throwIfAborted();
        await writer.write(text);
        signal?.throwIfAborted();
        await writer.close();
      } catch { await writer?.abort().catch(() => {}); }
    }
  }
  signal?.throwIfAborted();
  return entries;
}
