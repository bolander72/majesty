import {launcherClient} from './launcher-client.mjs';
import {ensureAutomaticAssets} from './automatic-assets.mjs';

// Retired content remains in player storage for backups, but live launches use
// the original game collection. Never delete or reimport a player's profiles.
export async function prepareRootPlayer({search = location.search,
  openClient = launcherClient, ensureAssets = ensureAutomaticAssets, signal} = {}) {
  const client = await openClient({signal});
  try {
    const game = client.games?.find(game => game.id === 'majesty');
    if (!game) throw Error('The original game configuration is unavailable.');
    if ((await client.status('majesty'))?.status?.state !== 'ready') {
      await ensureAssets('majesty', {
        status: id => client.status(id),
        importZip: (id, file) => client.importZip(id, file),
        importFiles: (id, files) => client.importFiles(id, files),
        signal, progress: () => {},
      });
    }
    signal?.throwIfAborted();
    const {contentStorageId, defaultContentStorageId, ...original} = game;
    return [original];
  } finally { client.close(); }
}
