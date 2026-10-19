// Bound work owned by this device, not the browser's process-wide JS heap.
// Queue fences retire an exact prefix: newer uploads cannot be forgotten by an
// older completion. No GPU object is retained here, so release/GC still works.
const MiB = 1024 * 1024;
export const GPU_LIMITS = Object.freeze({resourceBytes: 256 * MiB,
  queuedBytes: 512 * MiB, queuedOperations: 4096, queuedSubmissions: 128});

function dimension(value, fallback = 1) {
  value ??= fallback;
  if (!Number.isSafeInteger(value) || value < 0) throw Error('Invalid graphics size');
  return value;
}

function extent(value = {}) {
  return Array.isArray(value) ? [dimension(value[0]), dimension(value[1]), dimension(value[2])]
    : [dimension(value.width), dimension(value.height), dimension(value.depthOrArrayLayers)];
}

function block(format = '') {
  const bc = /^bc([1-7])/.exec(format);
  if (bc) return [4, 4, ['1', '4'].includes(bc[1]) ? 8 : 16];
  const astc = /^astc-(\d+)x(\d+)-/.exec(format);
  if (astc) return [+astc[1], +astc[2], 16];
  if (/^(etc2|eac)-/.test(format))
    return [4, 4, /^(etc2-rgb8|etc2-rgb8a1|eac-r11)-/.test(format) ? 8 : 16];
  const plain = /^(r|rg|rgba|bgra)(8|16|32)/.exec(format);
  if (plain) return [1, 1, ({r: 1, rg: 2, rgba: 4, bgra: 4})[plain[1]] * +plain[2] / 8];
  if (format === 'stencil8') return [1, 1, 1];
  if (format === 'depth16unorm') return [1, 1, 2];
  if (/^(depth|rgb10|rgb9)/.test(format)) return [1, 1, format === 'depth32float-stencil8' ? 8 : 4];
  // Conservative for a newly introduced format; native validation still owns
  // descriptor validity. Never underestimate an unknown uncompressed format.
  return [1, 1, 16];
}

function textureBytes(descriptor) {
  let [w, h, d] = extent(descriptor.size), total = 0;
  const [bw, bh, bytes] = block(descriptor.format);
  const levels = dimension(descriptor.mipLevelCount), samples = dimension(descriptor.sampleCount);
  if (levels > 32) throw Error('Invalid graphics mip count');
  for (let level = 0; level < levels; ++level) {
    total += Math.ceil(w / bw) * Math.ceil(h / bh) * d * bytes * samples;
    w = Math.max(1, Math.floor(w / 2)); h = Math.max(1, Math.floor(h / 2));
    if (descriptor.dimension === '3d') d = Math.max(1, Math.floor(d / 2));
  }
  return total;
}

function bufferWriteBytes(data, offset = 0, size) {
  const unit = data.BYTES_PER_ELEMENT || 1;
  return size === undefined ? Math.max(0, data.byteLength - offset * unit) : size * unit;
}

function textureWriteBytes(destination, layout, size) {
  const [w, h, d] = extent(size), [bw, bh, bytes] = block(destination.texture.format);
  if (!w || !h || !d) return 0;
  const rows = Math.ceil(h / bh), lastRow = Math.ceil(w / bw) * bytes;
  const pitch = layout.bytesPerRow ?? lastRow;
  return pitch * ((layout.rowsPerImage ?? rows) * (d - 1) + rows - 1) + lastRow;
}

// This bounds submitted uploads/allocation bursts, not total GPU memory or OS
// health. A browser/driver leak after completed fences cannot be measured here.
export function guardGraphicsDevice(device, {fail, limits = GPU_LIMITS,
  enqueue = queueMicrotask} = {}) {
  let closed = false, scheduled = false, waiting = false;
  let bytes = 0, operations = 0, submissions = 0;
  let peakBytes = 0, peakOperations = 0, peakSubmissions = 0;
  const queue = device.queue;
  const failure = reason => {
    if (!closed) { closed = true; fail?.(reason); }
    throw Error(reason);
  };
  const drain = () => {
    scheduled = false;
    if (closed || waiting || !operations) return;
    waiting = true;
    const prefix = {bytes, operations, submissions};
    let done;
    try { done = queue.onSubmittedWorkDone(); }
    catch { waiting = false; failure('The graphics queue could not complete.'); return; }
    Promise.resolve(done).then(() => {
      waiting = false;
      if (closed) return;
      bytes -= prefix.bytes; operations -= prefix.operations; submissions -= prefix.submissions;
      schedule();
    }, () => {
      waiting = false;
      if (!closed) { closed = true; fail?.('The graphics queue stopped responding.'); }
    });
  };
  const schedule = () => {
    if (!closed && !scheduled && !waiting && operations) { scheduled = true; enqueue(drain); }
  };
  const charge = (amount = 0, submitted = 0, resource = false) => {
    if (closed) throw Error('The graphics session has stopped.');
    if (!Number.isSafeInteger(amount) || amount < 0 ||
        (resource && amount > limits.resourceBytes) || bytes + amount > limits.queuedBytes ||
        operations + 1 > limits.queuedOperations || submissions + submitted > limits.queuedSubmissions)
      failure('Graphics work exceeded the safety limit.');
    bytes += amount; operations++; submissions += submitted;
    peakBytes = Math.max(peakBytes, bytes); peakOperations = Math.max(peakOperations, operations);
    peakSubmissions = Math.max(peakSubmissions, submissions);
    schedule();
    return () => { bytes -= amount; operations--; submissions -= submitted; };
  };
  const invoke = (method, args, amount = 0, submitted = 0, resource = false) => {
    const undo = charge(amount, submitted, resource);
    try { return method(...args); } catch (error) { undo(); throw error; }
  };
  // Keep the genuine WebIDL identities: GPUCanvasContext.configure rejects a
  // Proxy passed as its device even when every proxied method is bound.
  const wrap = (target, name, replacement) => {
    const original = target[name].bind(target);
    Object.defineProperty(target, name, {value: replacement(original), configurable: true});
  };
  wrap(queue, 'submit', original => (...args) => invoke(original, args, 0, 1));
  wrap(queue, 'writeBuffer', original => (...args) => invoke(original, args,
    bufferWriteBytes(args[2], args[3], args[4])));
  wrap(queue, 'writeTexture', original => (...args) => invoke(original, args,
    textureWriteBytes(args[0], args[2], args[3])));
  wrap(queue, 'copyExternalImageToTexture', original => (...args) => {
    const [w, h, d] = extent(args[2]); return invoke(original, args, w * h * d * 4);
  });
  wrap(device, 'createBuffer', original => descriptor => invoke(original, [descriptor],
    descriptor.size, 0, true));
  wrap(device, 'createTexture', original => descriptor => invoke(original, [descriptor],
    textureBytes(descriptor), 0, true));
  return {device, stop: () => { closed = true; }, snapshot: () =>
    ({closed, queuedBytes: bytes, queuedOperations: operations, queuedSubmissions: submissions,
      peakBytes, peakOperations, peakSubmissions})};
}

// Failure is terminal: stop callbacks before closing their native resources.
// Do not attempt an emergency save from a corrupt or still-running guest.
export function createRuntimeStop({module, device, stopAudio = () => {},
  stopThreads = () => {}}) {
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const attempt = fn => { try { fn(); } catch { /* Finish all other cleanup. */ } };
    attempt(stopAudio);
    attempt(() => module.pauseMainLoop?.());
    attempt(stopThreads);
    attempt(() => module.SDL3?.audioContext?.close()?.catch(() => {}));
    attempt(() => device.destroy());
  };
}
