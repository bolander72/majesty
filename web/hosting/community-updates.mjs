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
  ],
  "DataMX/mx_Unittype.cam": [
    "acda26fc5b35ec80f9e8de39bf99ba174517a13df115fb6bd5538acaeaf916f2"
  ],
  "DataMX/mx_action.cam": [
    "2488afeaf0f6fcd51852bf6f2590bace6838824e0868ed95de87126fc27af8f0"
  ],
  "DataMX/Community-main.cam": [
    "8ebaafa2c1a4ea31bbd5a85213c5e8a01160f7aee75a5be9227e5ca7be854bff"
  ],
  "Data/Community-interface.cam": [
    "8625dd23f263283efb504fd93437c82a3a0e1f5b5d4cfac611e9027ed354a36b"
  ],
  "DataMX/Community-interface.cam": [
    "8625dd23f263283efb504fd93437c82a3a0e1f5b5d4cfac611e9027ed354a36b"
  ],
  "DataMX/Community-audio.cam": [
    "7eed3cff385468632419c7d1428eafed414057c02083343bc7d294c99cc51c24"
  ],
  "Data/textdata.cam": [
    "9db43f20e7e6ff150b44c761d6beada13b34498f15b9388e54c3c245ac90dcb5"
  ],
  "Data/Community-textdata.cam": [
    "bb205a93cbb7e46f3edd4393352897807d59daa567b551c619476fc43e4c24c4"
  ],
  "Data/gpltext.cam": [
    "7d684ef93be8e91d4bb508534af66eea56212624be7041bec3b643a1ee8033ec"
  ],
  "Data/Community-gpltext.cam": [
    "5b3069151d6fc83791f43849855cf5ef046a29754e6e3f9a89175a152122c640"
  ],
  "Data/miscdata.cam": [
    "8036b0c5ee3f172278fa91b09a4d05a0a2b81eba1170a2c2a74def3c24dc80c6"
  ],
  "Data/Community_Expansion.bcd": [
    "9581cf08a4a936a93ea52fb41de6ff492a92e1c1788e01262340169f57494dfa"
  ],
  "DataMX/mx_textdata.cam": [
    "6f84dc4447447d5c1af6460e54ebd4c7cd041c4d22d7681a869d4e5a3010e0fd"
  ],
  "DataMX/Community-textdata.cam": [
    "71ade0c1d8d0c073773f1e5f160510ae647bfcb96e38355caaac7584262d9aff"
  ],
  "DataMX/mx_gpltext.cam": [
    "d20bd0b235140ff134f708e9dcc5a7ffc3b8c1a785c02dae0b11b3448e61fc00"
  ],
  "DataMX/Community-gpltext.cam": [
    "693bc741d266d252ee43351596d32c8898af8b6e33cc9722433fdd11b449fa48"
  ],
  "DataMX/mx_miscdata.cam": [
    "325b03b936c0d8fa4e96295309b1cc0b290f07ba1d6890f8e996003fce6268b8"
  ],
  "DataMX/Community_Expansion.bcd": [
    "9581cf08a4a936a93ea52fb41de6ff492a92e1c1788e01262340169f57494dfa"
  ]
});
const MARKER = '.community-script-revision.json';
const FORMAT = 'majesty-community-script-revision-v1';
const ADDED = new Set(['Data/MMMIntentText.bin', 'DataMX/MMMIntentText.bin']);

async function fileHandle(root, path, create = false) {
  const parts = path.split('/'), name = parts.pop();
  for (const part of parts) root = await root.getDirectoryHandle(part);
  return root.getFileHandle(name, {create});
}

async function removeCreatedFile(root, path) {
  const parts = path.split('/'), name = parts.pop();
  for (const part of parts) root = await root.getDirectoryHandle(part);
  await root.removeEntry(name);
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
  for (const path of ADDED) if (Object.hasOwn(files, path))
    changes.push({path, priors: [], sha256: files[path], bytes: sizes[path], added: true});
  if (!changes.length) return false;
  if (changes.some(p => !/^[a-f0-9]{64}$/.test(p.sha256) || !Number.isSafeInteger(p.bytes)
      || p.bytes < 1 || p.bytes > 64 * 1024 * 1024)) throw Error('Invalid content update binding.');
  if (!locks?.request) throw Error('This browser cannot safely update game content.');
  return locks.request('majesty-automatic-game-assets', {mode: 'exclusive', signal}, async () => {
    signal?.throwIfAborted();
    let game = await storage.getDirectory();
    for (const part of [COMMUNITY_STORAGE_ID, 'game']) game = await game.getDirectoryHandle(part);
    const revision = JSON.stringify(changes.map(p => [p.path, p.sha256]));
    let marker;
    try {
      const file = await (await game.getFileHandle(MARKER)).getFile();
      if (file.size <= 64 * 1024) marker = JSON.parse(await file.text());
    } catch { /* An older or interrupted installation has no trusted marker. */ }
    const current = [];
    for (const patch of changes) {
      let handle = null, file = null;
      try {
        handle = await fileHandle(game, patch.path);
        file = await handle.getFile();
      } catch (error) {
        if (!patch.added || error.name !== 'NotFoundError') throw error;
      }
      current.push({...patch, handle, file});
    }
    if (marker?.format === FORMAT && marker.revision === revision && current.every(p =>
      p.file && p.file.lastModified > 0 && p.file.size === p.bytes && marker.files?.[p.path]?.size === p.file.size
        && marker.files[p.path].modified === p.file.lastModified)) return false;
    const manifestHandle = await game.getFileHandle('.manifest.json');
    const manifestFile = await manifestHandle.getFile();
    if (manifestFile.size > 1024 * 1024) throw Error('Game manifest is oversized; it was preserved.');
    const manifest = JSON.parse(await manifestFile.text());
    const recipe = await loadRecipe();
    // Validate every existing file before fetching or replacing any of them.
    for (const patch of current) {
      if (!manifest.files?.[patch.path] && !patch.added)
        throw Error('Incomplete game manifest; it was preserved.');
      const source = recipe.patches.filter(p => p.path === patch.path);
      if (source.length !== 1 || source[0].sha256 !== patch.sha256 || source[0].bytes !== patch.bytes)
        throw Error('The content update differs from its source binding.');
      patch.source = source[0];
      patch.have = patch.file ? await hashFile(patch.file) : null;
      if (!patch.file && patch.added) continue;
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
      const created = !patch.handle;
      if (created) patch.handle = await fileHandle(game, patch.path, true);
      try {
        if (patch.have !== patch.sha256) await write(patch.handle, blobs.get(patch.sha256), signal);
      } catch (error) {
        // Remove only a resource this locked update created. Existing files
        // retain the ordinary resumable known-hash update behavior.
        if (created) await removeCreatedFile(game, patch.path).catch(() => {});
        throw error;
      }
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
