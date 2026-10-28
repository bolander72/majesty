import {COMMUNITY_FILES, COMMUNITY_SIZES, COMMUNITY_STORAGE_ID} from '../content/community-files.mjs';
import {derivedDescriptor} from './derived-assets.mjs';
import {assetUrl} from './asset-url.mjs';
import {hashBlob} from '../world/content-hash.mjs';

// Only source-bound published versions of these content files may be updated.
// Profiles, saves, unrelated resources and customized content are preserved.
// Keep the first released hash as the update baseline, and admit later known
// versions so players can move directly from either prior release.
const PREVIOUS = Object.freeze({
  "Data/Community_Common.bcd": [
    "9df88eb9f536155ed03b148b547ba4a88a24cc86f7212416517a213f42120d1a",
    "d31ae1725d7f10b3dc00f63575828bb8d921b92659d0cea89daea105b07ac34e",
    "6dc93fc046c2195ab4ca51fed88f5b2e07ae9fab2c6acfc3ff1cca7481efe6ce",
    "2d710dd86725483615feca5190b9083d085c214d3caf0de4a1675ba2c757c278"
  ],
  "DataMX/Community_Common.bcd": [
    "9df88eb9f536155ed03b148b547ba4a88a24cc86f7212416517a213f42120d1a",
    "d31ae1725d7f10b3dc00f63575828bb8d921b92659d0cea89daea105b07ac34e",
    "6dc93fc046c2195ab4ca51fed88f5b2e07ae9fab2c6acfc3ff1cca7481efe6ce",
    "2d710dd86725483615feca5190b9083d085c214d3caf0de4a1675ba2c757c278"
  ],
  "Data/Community_Base.bcd": [
    "6bcf4e7b106249c212dcc3c264d98cd5faafbe90f2b41d433406c0e42bb8c4f0",
    "132349d9a66592fa07000a78af99c80f97813bfcb1066636903f1c0798b5ce61"
  ],
  "DataMX/Community_Base.bcd": [
    "6bcf4e7b106249c212dcc3c264d98cd5faafbe90f2b41d433406c0e42bb8c4f0",
    "132349d9a66592fa07000a78af99c80f97813bfcb1066636903f1c0798b5ce61"
  ],
  "Data/unittype.cam": [
    "dad06f738f0e71bc3f528f05d4953caf4d9c3156e1b94cbd9adacaec208f0048",
    "3340443dd4b61276d159d3c5f146f819c8e1a56e5724a4ac06655861ba3031f3"
  ],
  "Data/action.cam": [
    "9fa9210deb37a9fe40643125f8f2df1dafb09c36133c1b5b09e7e7ae81a620c0",
    "e5091b452752bb8d4026928d597efcef9c44b422dc3a9b2e2c4895281b99e6cb"
  ],
  "Data/sounddesc.cam": [
    "4b981c10f415ca9fccc5510c73c2d1b10aeb1acb181c9bddb9616107244279ae",
    "72f0d7de39a0b7758083a9587c677c2d95f18789ed5b534c547a79417459edf1"
  ],
  "Data/Community-main.cam": [
    "8ebaafa2c1a4ea31bbd5a85213c5e8a01160f7aee75a5be9227e5ca7be854bff",
    "4843477a418197d8576ee2648fe7397da28b6b612dcbc26455bed52193d9efb6"
  ],
  "Data/Community-audio.cam": [
    "7eed3cff385468632419c7d1428eafed414057c02083343bc7d294c99cc51c24",
    "b8c926f48dd4b542aa2e6626930c08ec360efcb79a885f4a947ff5a462be45ae"
  ]
});
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
  if (!response.ok || !response.body) throw Error('The game content update is unavailable.');
  const reader = response.body.getReader(), chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      signal?.throwIfAborted();
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > patch.bytes) throw Error('The game content update size differs.');
      chunks.push(value);
    }
    const blob = new Blob(chunks);
    if (bytes !== patch.bytes || await hashFile(blob) !== patch.sha256)
      throw Error('The game content update failed verification.');
    return blob;
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
}

export async function refreshCommunityScripts({storage, locks, fetchFile = fetch, signal,
  hashFile = hashBlob, files = COMMUNITY_FILES, sizes = COMMUNITY_SIZES,
  loadRecipe = async () => {
    const response = await fetchFile(new URL('./automatic-assets.json', import.meta.url), {signal});
    if (!response.ok) throw Error('The game content update recipe is unavailable.');
    return derivedDescriptor(await response.json(), COMMUNITY_STORAGE_ID);
  },
} = {}) {
  const changes = Object.entries(PREVIOUS).filter(([path, prior]) =>
    Object.hasOwn(files, path) && files[path] !== prior[0])
    .map(([path, priors]) => ({path, priors, sha256: files[path], bytes: sizes[path]}));
  if (!changes.length) return false;
  if (changes.some(p => !/^[a-f0-9]{64}$/.test(p.sha256) || !Number.isSafeInteger(p.bytes)
      || p.bytes < 1 || p.bytes > 32 * 1024 * 1024)) throw Error('Invalid content update binding.');
  if (!locks?.request) throw Error('This browser cannot safely update game content.');
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
        throw Error('The content update differs from its source binding.');
      patch.source = source[0];
      patch.have = await hashFile(patch.file);
      if (!patch.priors.includes(patch.have) && patch.have !== patch.sha256)
        throw Error('Customized game content was preserved; automatic update refused.');
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
