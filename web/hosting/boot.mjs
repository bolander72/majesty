import {AutomaticLaunch} from './autoload.mjs';
import {ensureAutomaticAssets} from './automatic-assets.mjs';
import {launcherClient} from './launcher-client.mjs';

if (new URLSearchParams(location.search).get('setup') === '1') {
  await import('../app.js');
} else {
  const query = new URLSearchParams(location.search);
  const id = 'majesty';
  const status = document.querySelector('#boot-status'), bar = document.querySelector('#boot-progress');
  const controller = new AbortController();
  addEventListener('pagehide', () => controller.abort(), {once: true});
  let client;
  try {
    client = await launcherClient({signal: controller.signal});
    const launch = new AutomaticLaunch({href: location.href,
      status: id => client.status(id), navigate: href => {
        client.close();
        location.replace(href);
      }});
    if (!await launch.check()) {
      await ensureAutomaticAssets(id, {
        status: id => client.status(id),
        importZip: (id, file) => client.importZip(id, file),
        importFiles: (id, files) => client.importFiles(id, files),
        signal: controller.signal,
        progress: () => {}, // Keep preparation quiet.
      });
      await launch.check();
    }
  } catch (error) {
    client?.close();
    if (!controller.signal.aborted) {
      status.textContent = error.message;
      status.hidden = false;
      bar.hidden = true;
      const retry = document.querySelector('#boot-retry');
      retry.hidden = false; retry.onclick = () => location.reload();
    }
  }
}
