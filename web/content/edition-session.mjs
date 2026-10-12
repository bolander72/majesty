import {hashBlob} from '../world/content-hash.mjs';

export const WAYFINDER_FILES = Object.freeze({
  'DataMX/Wayfinder.bcd': '61a51da7b5a069a9839dc63ee97e50e77e47cf7d0243611f19db66faeeb19037',
  'DataMX/Wayfinder-units.cam': 'f79c8de2e7eaa844f0afb8594cdea69638a2d5cdcfa0573b00c8aa90fdad3c38',
  'DataMX/Wayfinder-interface.cam': '84892eb8d8b8999be2f65718ad1912f9d0a8ff9c5dc4500536c14054b27b9595',
  'DataMX/mx_miscdata.cam': '2a983bf59b21dd644f02fb11dbacdbe39ad9589eedf5206157d47db86b2046dc',
});

export function editionFor(search) {
  const query = new URLSearchParams(search), editions = query.getAll('edition');
  if (!editions.length) return null;
  if (editions.length !== 1 || editions[0] !== 'wayfinder-v1')
    throw Error('Choose a supported content edition.');
  const profiles = query.getAll('profile');
  if (profiles.length !== 1 || !/^wayfinder(?:-[a-zA-Z0-9_-]{1,30})?$/.test(profiles[0]))
    throw Error('Choose a separate Wayfinder save profile, such as wayfinder or wayfinder-scouts.');
  if ([...query.keys()].some(key => ['room', 'role', 'mode', 'world', 'RECOMP_PROFILE_DIR'].includes(key)
      || key.startsWith('RECOMP_RULE_COOP_') || key.startsWith('RECOMP_RULE_FRONTIER_')
      || key.startsWith('RECOMP_COOP_') || key.startsWith('RECOMP_FRONTIER_')))
    throw Error('Start this content edition as a separate single-player kingdom.');
  return Object.freeze({id: 'wayfinder-v1', storageId: 'majesty-wayfinder', profile: profiles[0]});
}

async function directory(parent, path, create = false) {
  for (const name of path) parent = await parent.getDirectoryHandle(name, {create});
  return parent;
}

export async function prepareEditionProfile(root, edition) {
  const game = await directory(root, [edition.storageId, 'game']);
  await game.getFileHandle('.manifest.json');
  for (const [path, expected] of Object.entries(WAYFINDER_FILES)) {
    const parts = path.split('/'), dir = await directory(game, parts.slice(0, -1));
    const file = await (await dir.getFileHandle(parts.at(-1))).getFile();
    if (file.size > 16 * 1024 * 1024 || await hashBlob(file) !== expected)
      throw Error('Import the verified Wayfinder game ZIP before playing this edition.');
  }
  // Keep new saves under Majesty's existing backup root; only game data has
  // its own import namespace. Refuse reuse of a pre-existing unrelated profile.
  const profile = await directory(root, ['majesty', 'profile', edition.profile], true);
  const marker = 'content-edition.json';
  const binding = {format: 'majesty-content-edition-v1', edition: edition.id, profile: edition.profile};
  let handle;
  try { handle = await profile.getFileHandle(marker); }
  catch (error) { if (error.name !== 'NotFoundError') throw error; }
  if (handle) {
    const file = await handle.getFile();
    if (file.size > 4096) throw Error('This save profile belongs to another content edition.');
    const previous = JSON.parse(await file.text());
    if (previous.format !== binding.format || previous.edition !== binding.edition || previous.profile !== binding.profile)
      throw Error('This save profile belongs to another content edition.');
  } else {
    for await (const _ of profile.entries())
      throw Error('This save profile already contains another kingdom. Choose a new Wayfinder profile.');
    handle = await profile.getFileHandle(marker, {create: true});
    const writer = await handle.createWritable();
    try { await writer.write(JSON.stringify(binding) + '\n'); await writer.close(); }
    catch (error) { await writer.abort?.(); throw error; }
  }
  return binding;
}

export async function startEditionPlayer(start, {
  search = location.search, storage = navigator.storage, locks = navigator.locks,
  events = globalThis,
} = {}) {
  const edition = editionFor(search);
  if (!edition) return start();
  if (!locks?.request) throw Error('This browser cannot protect the edition save profile.');
  let finish;
  const lifetime = new Promise(resolve => { finish = resolve; });
  events.addEventListener('pagehide', finish, {once: true});
  try {
    return await locks.request(`majesty-native-profile:majesty:${edition.profile}`,
      {mode: 'exclusive', ifAvailable: true}, async lock => {
        if (!lock) throw Error('This Wayfinder kingdom is already open. Close its other game tab.');
        await prepareEditionProfile(await storage.getDirectory(), edition);
        await start();
        // Native startup injects the engine script and returns. Retain ownership
        // until the owned page closes, including a later runtime failure.
        await lifetime;
      });
  } finally { events.removeEventListener('pagehide', finish); }
}
