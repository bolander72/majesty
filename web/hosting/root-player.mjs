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
    const defaultId = client.games?.find(game => game.id === 'majesty')?.defaultContentStorageId;
    const useDefault = !selected && !managed &&
      ['majesty-lost-trail', 'majesty-lost-trail-v2'].includes(defaultId);
    const inventory = query.getAll('RECOMP_RULE_INVENTORY_COMPAT');
    if (useDefault && inventory.length && (inventory.length !== 1 || inventory[0] !== '1'))
      throw Error('Lost Trail requires inventory compatibility.');
    const id = useDefault ? defaultId :
      selected === 'lost-trail-v2' ? 'majesty-lost-trail-v2' :
      selected === 'lost-trail-v1' ? 'majesty-lost-trail' :
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
