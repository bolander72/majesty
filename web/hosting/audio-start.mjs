// Resume the game's existing audio context; preserve native volume/mute settings.
// A browser that blocks autoplay still requires a trusted click, tap or key.
export function installGameAudio(module, {
  events = window, schedule = setTimeout, cancel = clearTimeout,
  now = () => performance.now(),
} = {}) {
  let stopped = false, timer;
  const deadline = now() + 20000;
  const resume = () => {
    if (stopped) return;
    const context = module.SDL3?.audioContext;
    if (context?.state === 'suspended' || context?.state === 'interrupted') {
      try { context.resume()?.catch(() => {}); } catch { /* Retain gesture recovery. */ }
    }
  };
  const observe = () => {
    if (stopped) return;
    if (module.SDL3?.audioContext) resume();
    else if (now() < deadline) timer = schedule(observe, 100);
  };
  const interactions = ['pointerdown', 'touchend', 'keydown'];
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancel(timer);
    for (const event of interactions) events.removeEventListener(event, resume, true);
    events.removeEventListener('pagehide', stop);
  };
  for (const event of interactions) events.addEventListener(event, resume, {capture: true, passive: true});
  events.addEventListener('pagehide', stop, {once: true});
  observe();
  return stop;
}
