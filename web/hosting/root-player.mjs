import {launcherClient} from './launcher-client.mjs';
import {ensureAutomaticAssets} from './automatic-assets.mjs';

// Retired collections remain available for backups. A qualified catalog may
// mount community data while retaining Majesty's original profile identity.
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
    const contentId = game.defaultContentStorageId;
    if (contentId === 'majesty-alchemist-v1-labels2' && client.games.some(item => item.id === contentId)) {
      await ensureAssets(contentId, {
        status: id => client.status(id),
        importZip: (id, file) => client.importZip(id, file),
        importFiles: (id, files) => client.importFiles(id, files),
        signal, progress: () => {},
      });
      signal?.throwIfAborted();
      return [{...original, contentStorageId: contentId}];
    }
    return [original];
  } finally { client.close(); }
}
