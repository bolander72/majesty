import {AutomaticLaunch} from './autoload.mjs';
import {ensureAutomaticAssets} from './automatic-assets.mjs';

await import('../app.js');
if (new URLSearchParams(location.search).get('setup') !== '1') {
  const query = new URLSearchParams(location.search);
  const id = query.get('edition') === 'wayfinder-v1' ? 'majesty-wayfinder' : 'majesty';
  const status = document.querySelector('#boot-status'), bar = document.querySelector('#boot-progress');
  const controller = new AbortController();
  addEventListener('pagehide', () => controller.abort(), {once: true});
  const launch = new AutomaticLaunch({href: location.href,
    status: id => window.recompLauncher.status(id), navigate: href => location.replace(href)});
  try {
    if (!await launch.check()) {
      await ensureAutomaticAssets(id, {
        status: id => window.recompLauncher.status(id),
        importZip: (id, file) => window.recompLauncher.importZip(id, file),
        signal: controller.signal,
        progress: (bytes, total) => { bar.hidden = false; bar.max = total; bar.value = bytes; },
      });
      status.textContent = 'Loading Majesty…';
      await launch.check();
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      status.textContent = error.message;
      bar.hidden = true;
      const retry = document.querySelector('#boot-retry');
      retry.hidden = false; retry.onclick = () => location.reload();
    }
  }
}
