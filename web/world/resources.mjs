import {MemorySampler, MAX_MEMORY_SAMPLES} from './memory.mjs';

// Explicit local diagnostics. No periodic sampler, upload or hidden heap probe.
if (new URLSearchParams(location.search).get('RECOMP_MEMORY_DEBUG') === '1') {
  const panel = document.body.appendChild(document.createElement('details'));
  panel.id = 'resource-diagnostics';
  panel.style.cssText = 'position:fixed;right:8px;top:8px;max-width:min(380px,95vw);max-height:40vh;overflow:auto;background:#162425ef;color:#eee8d0;padding:10px;border:1px solid #9da882;border-radius:6px;font:13px system-ui;z-index:10';
  panel.appendChild(document.createElement('summary')).textContent = 'Resource diagnostics';
  const help = panel.appendChild(document.createElement('p'));
  help.textContent = 'Browser memory estimate, not process or GPU total. Compare samples in the same browser version. Sampling may trigger garbage collection and take a while.';
  const button = panel.appendChild(document.createElement('button'));
  button.textContent = 'Measure browser memory';
  button.style.cssText = 'padding:8px;min-height:44px';
  const status = panel.appendChild(document.createElement('output'));
  status.setAttribute('role', 'status'); status.style.cssText = 'display:block;margin-top:8px';
  const history = panel.appendChild(document.createElement('pre'));
  history.id = 'memory-samples'; history.style.cssText = 'white-space:pre-wrap';
  if (!isSecureContext || !crossOriginIsolated) {
    button.disabled = true; status.textContent = 'Memory estimates need a secure, isolated page.';
  } else if (typeof performance.measureUserAgentSpecificMemory !== 'function') {
    button.disabled = true; status.textContent = 'Memory estimates are unavailable in this browser.';
  } else {
    const sampler = new MemorySampler(performance);
    status.textContent = `Ready; keeps at most ${MAX_MEMORY_SAMPLES} samples locally.`;
    button.onclick = async () => {
      if (button.disabled) return;
      button.disabled = true; status.textContent = 'Measuring browser memory…';
      try {
        await sampler.measure();
        history.textContent = sampler.samples.map(s => `${s.at} · ${s.bytes} bytes (${(s.bytes / 1048576).toFixed(2)} MiB)`).join('\n');
        status.textContent = 'Memory estimate recorded locally.';
      } catch (error) { status.textContent = `Memory estimate unavailable: ${error.message}`; }
      finally { button.disabled = false; }
    };
  }
}
