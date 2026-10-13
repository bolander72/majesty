import {AutomaticLaunch} from './autoload.mjs';
import {ensureAutomaticAssets} from './automatic-assets.mjs';
import {launcherClient} from './launcher-client.mjs';
import {homeChoices} from './home-menu.mjs';

if (new URLSearchParams(location.search).get('setup') === '1') {
  await import('../app.js');
} else {
  const query = new URLSearchParams(location.search);
  const id = query.get('edition') === 'wayfinder-v1' ? 'majesty-wayfinder' : 'majesty';
  const status = document.querySelector('#boot-status'), bar = document.querySelector('#boot-progress');
  const controller = new AbortController();
  addEventListener('pagehide', () => controller.abort(), {once: true});
  let frame, client, choice = null;
  homeChoices(action => { choice = action; });
  const reveal = event => {
    if (event.origin !== location.origin || event.source !== frame?.contentWindow) return;
    if (event.data?.type === 'majesty-home-exit') { location.replace('https://boland.co'); return; }
    if (!['majesty-home-ready', 'majesty-home-failed'].includes(event.data?.type)) return;
    document.body.dataset.gameReady = 'true';
    frame.focus();
    if (event.data.type === 'majesty-home-ready' && choice) {
      const action = choice; choice = null;
      frame.contentWindow.postMessage({type: 'majesty-home-choice', action}, location.origin);
    }
  };
  addEventListener('message', reveal);
  try {
    client = await launcherClient({signal: controller.signal});
    const launch = new AutomaticLaunch({href: location.href,
      status: id => client.status(id), navigate: href => {
        client.close();
        frame = document.createElement('iframe');
        frame.id = 'native-player'; frame.title = 'Majesty'; frame.allow = 'autoplay; fullscreen';
        frame.src = href; document.body.append(frame);
      }});
    if (!await launch.check()) {
      await ensureAutomaticAssets(id, {
        status: id => client.status(id),
        importZip: (id, file) => client.importZip(id, file),
        importFiles: (id, files) => client.importFiles(id, files),
        signal: controller.signal,
        progress: () => {}, // Keep asset preparation behind the native menu.
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
