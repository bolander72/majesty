import {COMMUNITY_FILES, COMMUNITY_SIZES, COMMUNITY_STORAGE_ID} from '../content/community-files.mjs';
import {derivedDescriptor} from './derived-assets.mjs';
import {assetUrl} from './asset-url.mjs';
import {hashBlob} from '../world/content-hash.mjs';

// Only source-bound published versions of these content files may be updated.
// Profiles, saves, unrelated resources and customized content are preserved.
// Keep the first released hash as the update baseline, and admit later known
// versions so players can move directly from either prior release.
const PREVIOUS = Object.freeze({
  "Data/alchemist_interfacedata.cam": [
    "74837f9a1b17e18bfd34b7d12f750d0aea0f4bfe96b1d8b3b287f28a55cbdccf"
  ],
  "DataMX/alchemist_interfacedata.cam": [
    "74837f9a1b17e18bfd34b7d12f750d0aea0f4bfe96b1d8b3b287f28a55cbdccf"
  ],
  "Data/Community_Common.bcd": [
    "9df88eb9f536155ed03b148b547ba4a88a24cc86f7212416517a213f42120d1a",
    "d31ae1725d7f10b3dc00f63575828bb8d921b92659d0cea89daea105b07ac34e",
    "6dc93fc046c2195ab4ca51fed88f5b2e07ae9fab2c6acfc3ff1cca7481efe6ce",
    "2d710dd86725483615feca5190b9083d085c214d3caf0de4a1675ba2c757c278",
    "7eab75a6c4d9dcbb28f6eac4c9ba09a0a56694579fa27ce6bec39151fe854bc2"
  ],
  "DataMX/Community_Common.bcd": [
    "9df88eb9f536155ed03b148b547ba4a88a24cc86f7212416517a213f42120d1a",
    "d31ae1725d7f10b3dc00f63575828bb8d921b92659d0cea89daea105b07ac34e",
    "6dc93fc046c2195ab4ca51fed88f5b2e07ae9fab2c6acfc3ff1cca7481efe6ce",
    "2d710dd86725483615feca5190b9083d085c214d3caf0de4a1675ba2c757c278",
    "7eab75a6c4d9dcbb28f6eac4c9ba09a0a56694579fa27ce6bec39151fe854bc2"
  ],
  "Data/Community_Base.bcd": [
    "6bcf4e7b106249c212dcc3c264d98cd5faafbe90f2b41d433406c0e42bb8c4f0",
    "132349d9a66592fa07000a78af99c80f97813bfcb1066636903f1c0798b5ce61",
    "7471a89a833839f740217680dadb6f7472da702ea3d3e1f7dea0f3417d8f5d76",
    "91f9d457fbf3b2d677973be2bc5618229f70a3e2bad09f21a1646c4e266fec1a"
  ],
  "DataMX/Community_Base.bcd": [
    "6bcf4e7b106249c212dcc3c264d98cd5faafbe90f2b41d433406c0e42bb8c4f0",
    "132349d9a66592fa07000a78af99c80f97813bfcb1066636903f1c0798b5ce61",
    "7471a89a833839f740217680dadb6f7472da702ea3d3e1f7dea0f3417d8f5d76",
    "91f9d457fbf3b2d677973be2bc5618229f70a3e2bad09f21a1646c4e266fec1a"
  ],
  "Data/unittype.cam": [
    "dad06f738f0e71bc3f528f05d4953caf4d9c3156e1b94cbd9adacaec208f0048",
    "3340443dd4b61276d159d3c5f146f819c8e1a56e5724a4ac06655861ba3031f3",
    "bc35215e9a64fabba05ef97001557f4e6ee4935225fa7ade23041502e85ea0e3",
    "63dc93d596f7caf1dad81f9cee5674642e97d937bb069fba26dcb880601070d7",
    "5e515ef108cfe04bc748e063796170d8f1d1b3a8008cf59f84d0eb301601fe6f"
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
    "4843477a418197d8576ee2648fe7397da28b6b612dcbc26455bed52193d9efb6",
    "29ca407ad666f2d26371904474464e16acbbcfc5507077a36894f06a1a304ac4",
    "d7a1c9ed5c70e4b9241b254b427a2f9194796e7537cc8e1b2b2a3db08f46742e",
    "822d2ac2a0952f39df9f341aab46508f8d5f6b0b11b211dc316161383e1d71fd",
    "4373aa668e66a0771110203993048e78b0faf0d62c90d1c15a89826a30695d95",
    "4dd8b31b004297469f02ce59172f34cce5aa778696746666aac73e8fcd52adce",
    "924863c608b5c9b8965c262cca642de79c247300ae64b0868e7e6e5c16ff551d",
    "a7156bc97a3c730575721035ea65b963b853f4134b6ef2e567c91d3ea1a59b23",
    "984d74b11e14679fa0672af9a15222bb4033eea0b6bdf545d4948d89f11920b3",
    "bef440b70c7444828c9acfea48dc847f55f64370014afec7fd7eb9ef0d78cf54",
    "75c7051fc96748fe7f9bb11496beab2bdef4a327d5e09fd925c71f309b57e850",
    "6134932c967ffb670233ff38412f80a7a06203e74f430271b5d39ee7fffee40d"
  ],
  "Data/Community-audio.cam": [
    "7eed3cff385468632419c7d1428eafed414057c02083343bc7d294c99cc51c24",
    "b8c926f48dd4b542aa2e6626930c08ec360efcb79a885f4a947ff5a462be45ae"
  ],
  "DataMX/mx_Unittype.cam": [
    "acda26fc5b35ec80f9e8de39bf99ba174517a13df115fb6bd5538acaeaf916f2",
    "b2b42031c56fbd89fa6cd3e87eefedfbd778aadb1d91400f17a1a3fc812f9faf",
    "5de6b5afa75fae94c70b914c8f3ca1a6cb449c0308bfbb17d06723b310bf20a2",
    "3134fabc37c378928670f99d4d1f505a5fc08ffa71a8798cc19e4dc2cee6bb2a",
    "92c30062b764de1b034913f1a130bb32b0463298ddcae779e64a7b85a736f999"
  ],
  "DataMX/mx_action.cam": [
    "2488afeaf0f6fcd51852bf6f2590bace6838824e0868ed95de87126fc27af8f0"
  ],
  "DataMX/Community-main.cam": [
    "8ebaafa2c1a4ea31bbd5a85213c5e8a01160f7aee75a5be9227e5ca7be854bff",
    "29ca407ad666f2d26371904474464e16acbbcfc5507077a36894f06a1a304ac4",
    "d7a1c9ed5c70e4b9241b254b427a2f9194796e7537cc8e1b2b2a3db08f46742e",
    "822d2ac2a0952f39df9f341aab46508f8d5f6b0b11b211dc316161383e1d71fd",
    "4373aa668e66a0771110203993048e78b0faf0d62c90d1c15a89826a30695d95",
    "4dd8b31b004297469f02ce59172f34cce5aa778696746666aac73e8fcd52adce",
    "924863c608b5c9b8965c262cca642de79c247300ae64b0868e7e6e5c16ff551d",
    "a7156bc97a3c730575721035ea65b963b853f4134b6ef2e567c91d3ea1a59b23",
    "984d74b11e14679fa0672af9a15222bb4033eea0b6bdf545d4948d89f11920b3",
    "bef440b70c7444828c9acfea48dc847f55f64370014afec7fd7eb9ef0d78cf54",
    "75c7051fc96748fe7f9bb11496beab2bdef4a327d5e09fd925c71f309b57e850",
    "6134932c967ffb670233ff38412f80a7a06203e74f430271b5d39ee7fffee40d"
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
    "9db43f20e7e6ff150b44c761d6beada13b34498f15b9388e54c3c245ac90dcb5",
    "30166dfff1abd4cca0d1108aef3765963dc888e3203fae203df5838137198e25",
    "9c7655d123c7bf00ce58d7ab096a14012fd85b52f4fde72e599b2650b11d555e",
    "28224402b9b3d46a8b384e8dfdbc4967dfabb747da6f04f8feb17a1bfa202d69",
    "13c2197d05794b3cef507ab4be4efc51c75c54392a2cf7e3222ecf565eb602ae"
  ],
  "Data/Community-textdata.cam": [
    "bb205a93cbb7e46f3edd4393352897807d59daa567b551c619476fc43e4c24c4",
    "c93067dd67c2afb54dcbeb9aaa03ad04e7fccbfdb36e7a726254fef52a80fc1a",
    "e57d073ba9a5233d9b4f8da558ad2ac09c110f8bf9b2a9ce4009f968e1fd2794",
    "b22ac4143f00d5026a56b79a060fc0748757f9d676939f92525c3efd79c06b9b",
    "3e778bed11f2e8eae2cbe6faac49de5ad8d3007b592f1797733fbe72931a7919"
  ],
  "Data/gpltext.cam": [
    "7d684ef93be8e91d4bb508534af66eea56212624be7041bec3b643a1ee8033ec",
    "daf706a17afd953280226c58973c51bab7b50031a5dbaea006a3890e80ee625e"
  ],
  "Data/Community-gpltext.cam": [
    "5b3069151d6fc83791f43849855cf5ef046a29754e6e3f9a89175a152122c640",
    "f45a6a272ecbfd9095a17c89ea4c646eb9e0cc982ee9a2b4c08d52ea7231a5b9"
  ],
  "Data/miscdata.cam": [
    "8036b0c5ee3f172278fa91b09a4d05a0a2b81eba1170a2c2a74def3c24dc80c6",
    "0ecc187003bcc26cf7cf8cb187c60cb767362b32c6ee4592197b9e810136953e"
  ],
  "Data/Community_Expansion.bcd": [
    "9581cf08a4a936a93ea52fb41de6ff492a92e1c1788e01262340169f57494dfa",
    "3f71f7b3f75fc187a1d289c8d9f9aaf27e79e9f20f88bdb159f55318cef6f679",
    "15655276e460588cba30bfb7cb554a4c09c0804e969f19489d4fdc25731581a2",
    "c0fd542491288a20311bfb24517ae793ba13ec7daeeacf41908d0b374fec8ffb"
  ],
  "DataMX/mx_textdata.cam": [
    "6f84dc4447447d5c1af6460e54ebd4c7cd041c4d22d7681a869d4e5a3010e0fd",
    "dd145bc3edac3015fa80aedb41bbbc1ff18ff0a9f747b2fccf3fd2de02fd5dbf",
    "2568073d5a382cc335b13ad1b25141203fd3a26eef75ad8de0a1f022ad984e20",
    "8eedf9dc5709a6650f07136e32ae1e08c44c5d768333b7bd8f1a6b0d0428798e",
    "787a6d987a0eb2970e40cb66884d2e254d46367bf29b5cf4549d4d4a09fbcaf9"
  ],
  "DataMX/Community-textdata.cam": [
    "71ade0c1d8d0c073773f1e5f160510ae647bfcb96e38355caaac7584262d9aff",
    "783dd17921fa59532e44cbd8c1d6edd3504ecbb7bb43ea83776ade001b32ca58",
    "85fbcd265a1b18192294f035e20d925d8e848ff6cf14a260bf3ede5ac5fa3b9e",
    "8401e9405b0a9efe2df067fa07f97d2f21ee36485224cab02283ea52b807fbab",
    "6d0cce91e57ca77ea80559ac494cadfa62e12b76717653b81251a0cc7bbfb01f"
  ],
  "DataMX/mx_gpltext.cam": [
    "d20bd0b235140ff134f708e9dcc5a7ffc3b8c1a785c02dae0b11b3448e61fc00"
  ],
  "DataMX/Community-gpltext.cam": [
    "693bc741d266d252ee43351596d32c8898af8b6e33cc9722433fdd11b449fa48"
  ],
  "DataMX/mx_miscdata.cam": [
    "325b03b936c0d8fa4e96295309b1cc0b290f07ba1d6890f8e996003fce6268b8",
    "a52d44d784394074711337a4f8a1d6e59f76c0c906200688c419bcef04197f32"
  ],
  "DataMX/Community_Expansion.bcd": [
    "9581cf08a4a936a93ea52fb41de6ff492a92e1c1788e01262340169f57494dfa",
    "3f71f7b3f75fc187a1d289c8d9f9aaf27e79e9f20f88bdb159f55318cef6f679",
    "15655276e460588cba30bfb7cb554a4c09c0804e969f19489d4fdc25731581a2",
    "c0fd542491288a20311bfb24517ae793ba13ec7daeeacf41908d0b374fec8ffb"
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
