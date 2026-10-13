export const HOME_ACTIONS = Object.freeze({
  play: [-306, 152], multiplayer: [-164, 152], load: [-306, 123], settings: [-164, 123],
  credits: [164, 152], scores: [306, 152], cinematic: [164, 123], mods: [-146, 58], activate: [146, 58],
});

export function menuPoint(action, width, height, nativeSize) {
  const value = HOME_ACTIONS[action];
  if (!Object.hasOwn(HOME_ACTIONS, action) || !(width > 0 && height > 0)) throw Error('Invalid home menu choice.');
  // Same minimum 800x600 and centered/bottom anchors as browser_viewport.cpp.
  const scale = Math.max(1, 800 / width, 600 / height);
  const sx = nativeSize ? width / nativeSize.width : 1 / scale;
  const sy = nativeSize ? height / nativeSize.height : 1 / scale;
  return {x: width / 2 + value[0] * sx, y: height - value[1] * sy};
}

export function homeChoices(select, doc = document) {
  const buttons = [...doc.querySelectorAll('[data-home-action]')];
  for (const b of buttons) b.addEventListener('click', () => {
    const action = b.dataset.homeAction;
    if (!Object.hasOwn(HOME_ACTIONS, action)) return;
    for (const other of buttons) other.setAttribute('aria-pressed', String(other === b));
    select(action);
  });
}

export function startNativeHome({canvas, win = window, doc = document} = {}) {
  let choice = null, ready = false, disposed = false, nativeSize = null;
  const click = async action => {
    if (disposed || !ready || !Object.hasOwn(HOME_ACTIONS, action)) return;
    const r = canvas.getBoundingClientRect(), p = menuPoint(action, r.width, r.height, nativeSize);
    const opts = {bubbles: true, clientX: r.left + p.x, clientY: r.top + p.y,
      button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true};
    canvas.focus();
    // SDL3 registers Pointer Events, including pointerType and pointerId.
    canvas.dispatchEvent(new PointerEvent('pointerenter', opts));
    canvas.dispatchEvent(new PointerEvent('pointermove', opts));
    canvas.dispatchEvent(new PointerEvent('pointerdown', {...opts, buttons: 1}));
    // Let the native input loop observe the press before releasing it.
    await new Promise(resolve => win.setTimeout(resolve, 100));
    if (!disposed) canvas.dispatchEvent(new PointerEvent('pointerup', opts));
  };
  const select = action => { if (ready) void click(action); else choice = action; };
  homeChoices(select, doc);
  const message = event => {
    if (event.origin === win.location.origin && event.source === win.parent
        && event.data?.type === 'majesty-home-choice') select(event.data.action);
  };
  const report = type => {
    if (win.parent !== win) win.parent.postMessage({type}, win.location.origin);
  };
  const runtime = event => {
    const size = /^\[viewport\] (?:initial |rebuilding )?(\d+)x(\d+)/.exec(event.detail);
    if (size && Number(size[1]) >= 800 && Number(size[2]) >= 600)
      nativeSize = {width: Number(size[1]), height: Number(size[2])};
    if (event.detail !== '[player] menu ready' || ready) return;
    // The existing canvas reveal waits two frames. Keep the art until then.
    win.requestAnimationFrame(() => win.requestAnimationFrame(() => {
      if (disposed) return;
      ready = true; doc.body.dataset.gameReady = 'true';
      report('majesty-home-ready');
      if (choice) { const action = choice; choice = null; void click(action); }
    }));
  };
  const state = event => { if (event.detail?.state === 'failed') {
    doc.querySelector('#instant-home')?.remove(); report('majesty-home-failed');
  }};
  win.addEventListener('message', message);
  doc.addEventListener('recomp-runtime-message', runtime);
  doc.addEventListener('recomp-runtime-state', state);
  win.addEventListener('pagehide', () => { disposed = true;
    win.removeEventListener('message', message);
    doc.removeEventListener('recomp-runtime-message', runtime);
    doc.removeEventListener('recomp-runtime-state', state);
  }, {once: true});
}
