// Presentation-only shadows use the engine's existing profile resource overlay.
// Original game data, save identities and user-created resource overrides stay intact.
const sources = [
  ['Data/textdata.cam', '616ebc6880b50324134d7d3f9c20229bf5e1c159e738da0702be9f07a1a66642'],
  ['DataMX/mx_textdata.cam', '60ab851f56c563025ad8db0814436c50c34594ee396e27ab77c057e4b47e0b1f'],
];
const marker = new TextEncoder().encode('\x00\x0a\x00\x00\x00Version #\x00\x0b\x00\x00\x00');

export function blankVersionLabel(bytes) {
  let found = -1;
  for (let at = 0; at <= bytes.length - marker.length; at++) {
    if (marker.every((value, offset) => bytes[at + offset] === value)) {
      if (found !== -1) throw Error('Ambiguous menu version label');
      found = at;
    }
  }
  if (found < 0) throw Error('Original menu version label not found');
  const copy = bytes.slice();
  copy.fill(32, found + 5, found + 14);
  return copy;
}

export async function prepareMenuText({dataId, profilePath, storage = navigator.storage, signal} = {}) {
  if (!/^[a-zA-Z0-9_-]{1,60}$/.test(dataId) || !/^majesty\/profile(?:\/[a-zA-Z0-9_-]{1,80})*$/.test(profilePath))
    throw Error('Invalid menu presentation profile');
  signal?.throwIfAborted();
  const root = await storage.getDirectory();
  let game = await root.getDirectoryHandle(dataId);
  game = await game.getDirectoryHandle('game');
  let profile = root;
  for (const part of profilePath.split('/')) profile = await profile.getDirectoryHandle(part, {create: true});
  for (const [path, expected] of sources) {
    signal?.throwIfAborted();
    const [directory, name] = path.split('/');
    const target = await profile.getDirectoryHandle(directory, {create: true});
    try { await target.getFileHandle(name); continue; } catch (error) {
      if (error.name !== 'NotFoundError') throw error;
    }
    let source;
    try { source = await (await (await game.getDirectoryHandle(directory)).getFileHandle(name)).getFile(); }
    catch (error) { if (error.name === 'NotFoundError') continue; throw error; }
    if (source.size > 1024 * 1024) continue;
    const bytes = new Uint8Array(await source.arrayBuffer());
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map(n => n.toString(16).padStart(2, '0')).join('');
    if (hash !== expected) continue; // Preserve customized game text.
    const output = blankVersionLabel(bytes);
    signal?.throwIfAborted();
    let writer;
    try {
      const handle = await target.getFileHandle(name, {create: true});
      writer = await handle.createWritable();
      await writer.write(output);
      signal?.throwIfAborted();
      await writer.close();
    } catch (error) {
      await writer?.abort().catch(() => {});
      await target.removeEntry(name).catch(() => {});
      throw error;
    }
  }
}
