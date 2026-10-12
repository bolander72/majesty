// Optional view metadata: one write in flight and one latest position retained.
// Kingdom/building persistence is separate and must finish before eviction.
export class CameraCheckpointWriter {
  #store; #timer = null; #pending = null; #flight = null;
  #firstPending = null; #revision = 0; #timers; #now; #quiet; #maxWait; #report;
  #closed = false; #closing = null;
  constructor(store, {quietMs = 250, maxWaitMs = 2000, timers = globalThis,
    now = () => performance.now(), report = () => {}} = {}) {
    if (typeof store?.write !== 'function' || typeof timers?.setTimeout !== 'function' ||
        typeof timers?.clearTimeout !== 'function' || typeof now !== 'function' || typeof report !== 'function' ||
        !Number.isFinite(quietMs) || quietMs <= 0 || !Number.isFinite(maxWaitMs) || maxWaitMs < quietMs)
      throw new Error('Invalid camera checkpoint writer');
    this.#store = store; this.#timers = timers; this.#now = now;
    this.#quiet = quietMs; this.#maxWait = maxWaitMs; this.#report = report;
  }
  schedule(camera) {
    if (this.#closed) throw new Error('Camera checkpoint writer closed');
    if (!camera || ![camera.x, camera.y].every(Number.isFinite)) throw new Error('Invalid camera position');
    const now = this.#now();
    this.#firstPending ??= now;
    this.#pending = {camera: {x: camera.x, y: camera.y}, revision: ++this.#revision};
    this.#cancelTimer();
    this.#timer = this.#timers.setTimeout(() => {
      this.#timer = null;
      // Failures are reported and retained for an explicit retry or later move.
      // Do not turn a quota failure into a repeating background write loop.
      this.flush().catch(() => {});
    }, Math.max(0, Math.min(now + this.#quiet, this.#firstPending + this.#maxWait) - now));
  }
  #cancelTimer() {
    if (this.#timer !== null) this.#timers.clearTimeout(this.#timer);
    this.#timer = null;
  }
  flush() {
    if (this.#closed) return this.#closing;
    this.#cancelTimer();
    if (this.#flight) return this.#flight;
    if (!this.#pending) return Promise.resolve();
    this.#flight = this.#drain().finally(() => { this.#flight = null; });
    return this.#flight;
  }
  // View position is optional. Stop queued writes on departure, drain only an
  // already accepted transaction, then release the store and UI callback.
  close() {
    if (this.#closing) return this.#closing;
    this.#closed = true; this.#cancelTimer();
    this.#pending = null; this.#firstPending = null;
    this.#closing = (async () => {
      try { await this.#flight; } catch { /* The departed view cannot retry. */ }
      finally { this.#store = this.#timers = this.#now = this.#report = null; }
    })();
    return this.#closing;
  }
  async #drain() {
    while (this.#pending) {
      const entry = this.#pending;
      this.#pending = null; this.#firstPending = null; this.#cancelTimer();
      try { await this.#store.write('camera-v1', {...entry.camera}); }
      catch (error) {
        if (this.#closed) throw error;
        // A newer position supersedes the failed one, but neither is discarded.
        this.#pending ??= entry; this.#firstPending ??= this.#now();
        this.#cancelTimer();
        this.#report({error, camera: {...entry.camera}, latest: entry.revision === this.#revision});
        throw error;
      }
      if (!this.#closed) this.#report({error: null, camera: {...entry.camera}, latest: entry.revision === this.#revision});
    }
  }
  get pendingPositions() { return Number(this.#pending !== null); }
  get writesInFlight() { return Number(this.#flight !== null); }
}
