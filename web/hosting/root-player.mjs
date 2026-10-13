import {launcherClient} from './launcher-client.mjs';
import {ensureAutomaticAssets} from './automatic-assets.mjs';

// Prepare the selected edition before the real player starts in this document.
// Returning players only check their completed import; no extra navigation.
export async function prepareRootPlayer({search = location.search,
  openClient = launcherClient, ensureAssets = ensureAutomaticAssets,
  signal} = {}) {
  const query = new URLSearchParams(search), selected = query.get('edition');
  const client = await openClient({signal});
  try {
    // A qualified release can add content to the ordinary root player while
    // retaining Majesty's existing profiles. Managed worlds keep their inputs.
    const managed = [...query.keys()].some(key => ['room', 'role', 'mode', 'world'].includes(key)
      || key.startsWith('RECOMP_RULE_COOP_') || key.startsWith('RECOMP_RULE_FRONTIER_')
      || key.startsWith('RECOMP_COOP_') || key.startsWith('RECOMP_FRONTIER_'));
    const useDefault = !selected && !managed &&
      client.games?.find(game => game.id === 'majesty')?.defaultContentStorageId === 'majesty-lost-trail';
    const id = selected === 'lost-trail-v1' || useDefault ? 'majesty-lost-trail' :
      selected === 'wayfinder-v1' ? 'majesty-wayfinder' : 'majesty';
    if ((await client.status(id))?.status?.state !== 'ready') {
      await ensureAssets(id, {
        status: id => client.status(id),
        importZip: (id, file) => client.importZip(id, file),
        importFiles: (id, files) => client.importFiles(id, files),
        signal, progress: () => {},
      });
    }
    signal?.throwIfAborted();
    return useDefault ? client.games.map(game => game.id === 'majesty'
      ? {...game, contentStorageId: id} : game) : client.games;
  } finally {
    client.close();
  }
}
