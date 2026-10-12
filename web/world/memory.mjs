// Optional browser estimates, not renderer RSS or a GPU-memory accounting.
export const MAX_MEMORY_SAMPLES = 8;
export class MemorySampler {
  #pending = null;
  #samples = [];
  constructor(api, now = () => new Date().toISOString()) {
    this.api = api; this.now = now;
  }
  measure() {
    if (this.#pending) return this.#pending;
    this.#pending = (async () => {
      const result = await this.api.measureUserAgentSpecificMemory();
      if (!Number.isSafeInteger(result?.bytes) || result.bytes < 0)
        throw new Error('The browser returned an invalid memory estimate');
      // Keep only total bytes/time. Do not retain attribution URLs or a
      // browser-supplied breakdown whose size is outside our control.
      const sample = Object.freeze({bytes: result.bytes, at: this.now()});
      this.#samples.push(sample);
      if (this.#samples.length > MAX_MEMORY_SAMPLES) this.#samples.shift();
      return sample;
    })().finally(() => { this.#pending = null; });
    return this.#pending;
  }
  get samples() { return this.#samples.slice(); }
}
