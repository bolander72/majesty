import {launcherClient} from './launcher-client.mjs';
import {ensureAutomaticAssets} from './automatic-assets.mjs';

// Prepare the selected edition before the real player starts in this document.
// Returning players only check their completed import; no extra navigation.
export async function prepareRootPlayer({search = location.search,
  openClient = launcherClient, ensureAssets = ensureAutomaticAssets,
  signal} = {}) {
  const id = new URLSearchParams(search).get('edition') === 'wayfinder-v1'
    ? 'majesty-wayfinder' : 'majesty';
  const client = await openClient({signal});
  try {
    if ((await client.status(id))?.status?.state !== 'ready') {
      await ensureAssets(id, {
        status: id => client.status(id),
        importZip: (id, file) => client.importZip(id, file),
        importFiles: (id, files) => client.importFiles(id, files),
        signal, progress: () => {},
      });
    }
    signal?.throwIfAborted();
  } finally {
    client.close();
  }
}
