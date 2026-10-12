// Experimental world storage. No original Majesty state is altered here.
export const TILE = 16, SIDE = 32, REGION = TILE * SIDE, MAX_ACTIVE = 49, MAX_PENDING = 32, MAX_RESIDENT = MAX_ACTIVE * 2;
const LIMIT = 1000000;
export const key = (x, y) => `${x},${y}`;
function coordinate(v) {
  if (!Number.isSafeInteger(v) || Math.abs(v) > LIMIT) throw new Error('World boundary reached');
  return v;
}
export function hash(seed, x, y) {
  let h = Math.imul(seed ^ x, 0x45d9f3b) ^ Math.imul(y, 0x27d4eb2d);
  h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b); return (h ^ (h >>> 16)) >>> 0;
}
export function generate(seed, x, y) {
  coordinate(x); coordinate(y);
  const tiles = new Uint8Array(SIDE * SIDE);
  for (let j = 0; j < SIDE; j++) for (let i = 0; i < SIDE; i++) {
    const gx = x * SIDE + i, gy = y * SIDE + j;
    const n = hash(seed, Math.floor(gx / 5), Math.floor(gy / 5)) % 100;
    tiles[j * SIDE + i] = n < 13 ? 2 : n < 34 ? 1 : 0;
  }
  return {x, y, tiles, buildings: [], dirty: false};
}
export function visibleRegions(cx, cy, width, height) {
  if (![cx, cy, width, height].every(Number.isFinite) || width <= 0 || height <= 0 || width > 2048 || height > 2048)
    throw new Error('Invalid camera bounds');
  coordinate(Math.floor(cx/REGION));coordinate(Math.floor(cy/REGION));
  const out = [];
  for (let y = Math.max(-LIMIT,Math.floor((cy - height / 2) / REGION) - 1); y <= Math.min(LIMIT,Math.floor((cy + height / 2) / REGION) + 1); y++)
    for (let x = Math.max(-LIMIT,Math.floor((cx - width / 2) / REGION) - 1); x <= Math.min(LIMIT,Math.floor((cx + width / 2) / REGION) + 1); x++)
      out.push([coordinate(x), coordinate(y)]);
  if (out.length > MAX_ACTIVE) throw new Error('Active region budget exceeded');
  return out;
}
export class RegionStream {
  #jobs = [];
  #running = false;
  #staged = 0;
  #closed = false;
  #closing = null;
  #finishClose;
  constructor(store, seed = 71201) {
    this.store = store; this.seed = seed; this.active = new Map();
    this.highWater = 0; this.residentHighWater = 0; this.pendingHighWater = 0;
  }
  #enqueue(kind, data) {
    if (this.#closed) return Promise.reject(new Error('World stream closed'));
    const last = this.#jobs.at(-1);
    // Superseded destinations share one promise and one queued payload.
    // Never coalesce across an accepted building edit: its order matters.
    if (kind === 'move' && last?.kind === 'move') {
      last.data = data;
      return last.promise;
    }
    if (this.#jobs.length >= MAX_PENDING)
      return Promise.reject(new Error('World action queue is full; retry after travel settles'));
    const job = {kind, data};
    job.promise = new Promise((resolve, reject) => { job.resolve = resolve; job.reject = reject; });
    this.#jobs.push(job);
    this.pendingHighWater = Math.max(this.pendingHighWater, this.#jobs.length);
    this.#run();
    return job.promise;
  }
  async #run() {
    if (this.#running) return;
    this.#running = true;
    try { while (this.#jobs.length) {
      const job = this.#jobs.shift();
      try {
        job.resolve(await (job.kind === 'move' ? this.#move(job.data) : this.#tower(job.data)));
      } catch (error) { job.reject(error); }
    } } finally {
      this.#running = false;
      if (this.#closed) this.#release();
    }
  }
  // Stop admission immediately. An accepted storage operation may finish;
  // retain its state until then, but never publish a late destination scene.
  close() {
    if (this.#closing) return this.#closing;
    this.#closed = true;
    this.#closing = new Promise(resolve => { this.#finishClose = resolve; });
    for (const job of this.#jobs.splice(0)) job.reject(new Error('World stream closed'));
    if (!this.#running) this.#release();
    return this.#closing;
  }
  #release() {
    this.active.clear();this.#staged = 0;this.store = null;
    this.#finishClose();this.#finishClose = null;
  }
  #requireOpen() { if (this.#closed) throw new Error('World stream closed'); }
  move(cx, cy, width, height) {
    try {
      return this.#enqueue('move', {cx, cy, wanted: visibleRegions(cx, cy, width, height)});
    } catch (error) { return Promise.reject(error); }
  }
  async #move({cx, cy, wanted}) {
    this.#requireOpen();
    const keep = new Set(wanted.map(([x, y]) => key(x, y)));
    // Persist outgoing edits while the complete current scene stays resident.
    for (const [id, region] of this.active) if (!keep.has(id) && region.dirty) {
      await this.store.write(id, this.snapshot(region));
      region.dirty = false;
      this.#requireOpen();
    }
    const next = new Map();
    let loaded;
    try {
      const missing = wanted.map(([x,y]) => key(x,y)).filter(id => !this.active.has(id));
      // One bounded storage snapshot, rather than a transaction per region.
      // Stores without a bulk API retain the sequential adapter contract.
      if (missing.length && this.store.readMany) {
        loaded = await this.store.readMany(missing);
        this.#requireOpen();
        if (!(loaded instanceof Map) || loaded.size !== missing.length || missing.some(id => !loaded.has(id)))
          throw new Error('Incomplete region read batch');
      }
      for (const [x, y] of wanted) {
        this.#requireOpen();
        const id = key(x, y), existing = this.active.get(id);
        if (existing) { next.set(id, existing); continue; }
        const saved = loaded ? loaded.get(id) : await this.store.read(id);
        this.#requireOpen();
        loaded?.delete(id);
        let buildings = [];
        if (saved) {
          if (saved.version !== 1 || saved.seed !== this.seed || saved.x !== x || saved.y !== y ||
              !Array.isArray(saved.buildings) || saved.buildings.length > 64 ||
              saved.buildings.some(b => !b || !Number.isInteger(b.x) || !Number.isInteger(b.y) ||
                b.x < 0 || b.y < 0 || b.x >= SIDE || b.y >= SIDE || b.kind !== 'tower'))
            throw new Error('Invalid saved region');
          // Retain only supported entity fields, not arbitrary stored payloads.
          buildings = saved.buildings.map(({kind, x, y}) => ({kind, x, y}));
          if (new Set(buildings.map(b => key(b.x, b.y))).size !== buildings.length)
            throw new Error('Invalid saved region');
        }
        const region = generate(this.seed, x, y);
        region.buildings = buildings;
        next.set(id, region);
        ++this.#staged;
        this.residentHighWater = Math.max(this.residentHighWater, this.residentRegions);
      }
      // Publish only a fully loaded scene. Failed reads retain the old view.
      this.active = next;
      this.highWater = Math.max(this.highWater, this.active.size);
      return {x: cx, y: cy};
    } finally { if (loaded instanceof Map) loaded.clear(); this.#staged = 0; }
  }
  snapshot(r) { return {version: 1, seed: this.seed, x: r.x, y: r.y, buildings: r.buildings.map(({kind, x, y}) => ({kind, x, y}))}; }
  tower(wx, wy) {
    if (![wx, wy].every(Number.isFinite)) return Promise.reject(new Error('Invalid building location'));
    return this.#enqueue('tower', {wx, wy});
  }
  async #tower({wx, wy}) {
    this.#requireOpen();
    const x = Math.floor(wx / REGION), y = Math.floor(wy / REGION), id = key(x, y);
    const r = this.active.get(id);
    if (!r) throw new Error('Region is not loaded');
    const tx = Math.floor((wx - x * REGION) / TILE), ty = Math.floor((wy - y * REGION) / TILE);
    if (r.tiles[ty * SIDE + tx] === 2) throw new Error('Choose dry land');
    if (r.buildings.some(b => b.x === tx && b.y === ty)) throw new Error('A tower already stands here');
    if (r.buildings.length >= 64) throw new Error('This region has reached its building limit');
    const next = this.snapshot(r);
    next.buildings.push({kind: 'tower', x: tx, y: ty});
    await this.store.write(id, next);
    r.buildings = next.buildings;
  }
  get pendingOperations() { return this.#jobs.length; }
  get closed() { return this.#closed; }
  get residentRegions() { return this.active.size + this.#staged; }
  get terrainBytes() { return this.active.size * SIDE * SIDE; }
  get residentTerrainBytes() { return this.residentRegions * SIDE * SIDE; }
}
export class BrowserRegionStore {
  constructor() { this.readTransactions = 0; }
  static async open(world = 'frontier-v1', {nativeWorld=false} = {}) {
    if (!/^[a-z0-9-]{1,40}$/.test(world)) throw new Error('Invalid world name');
    const storageName=`majesty-${nativeWorld?'native-world-':''}${world}`;
    // This prototype is single-player. A browser lock prevents two tabs
    // from silently overwriting one another's saved regional changes.
    if (!navigator.locks) throw new Error('This browser lacks world storage locking');
    let unlock;
    await new Promise((resolve, reject) => {
      navigator.locks.request(storageName, {ifAvailable: true}, async lock => {
        if (!lock) { reject(new Error('This world is already open in another tab')); return; }
        const held = new Promise(release => { unlock = release; });
        resolve(); await held;
      }).catch(reject);
    });
    let db;
    try { db = await new Promise((resolve, reject) => {
      const r = indexedDB.open(storageName, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('regions');
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error('Close older world tabs before opening this world'));
    }); } catch (error) { unlock(); throw error; }
    const store = new BrowserRegionStore(); store.db = db;
    let closed=false;
    store.close = () => {
      if(closed)return;closed=true;
      removeEventListener('pagehide',store.close);
      db.close();unlock();
    };
    db.onversionchange = store.close;
    addEventListener('pagehide', store.close, {once: true});
    return store;
  }
  read(id) {
    return new Promise((resolve, reject) => {
      const t = this.db.transaction('regions', 'readonly'), r = t.objectStore('regions').get(id);
      ++this.readTransactions;
      let value; r.onsuccess = () => { value = r.result; };
      t.oncomplete = () => resolve(value); t.onabort = () => reject(t.error || new Error('Storage read failed'));
    });
  }
  readMany(ids) {
    if (!Array.isArray(ids) || ids.length > MAX_ACTIVE || new Set(ids).size !== ids.length ||
        ids.some(id => {
          if (typeof id !== 'string' || id.length > 25) return true;
          const parts = id.split(',').map(Number);
          return parts.length !== 2 || parts.some(n => !Number.isSafeInteger(n) || Math.abs(n) > LIMIT) || key(...parts) !== id;
        })) return Promise.reject(new Error('Invalid region read batch'));
    if (!ids.length) return Promise.resolve(new Map());
    return new Promise((resolve, reject) => {
      const t = this.db.transaction('regions', 'readonly'), values = new Map();
      ++this.readTransactions;
      const objectStore = t.objectStore('regions');
      for (const id of ids) {
        const request = objectStore.get(id);
        request.onsuccess = () => { values.set(id, request.result); };
      }
      // A successful request is not a successful transaction. Never publish
      // partial results when another request or the transaction aborts.
      t.oncomplete = () => resolve(values);
      t.onabort = () => reject(t.error || new Error('Storage read failed'));
    });
  }
  write(id, value) {
    return new Promise((resolve, reject) => {
      const t = this.db.transaction('regions', 'readwrite'); t.objectStore('regions').put(value, id);
      t.oncomplete = () => resolve(); t.onabort = () => reject(t.error || new Error('Storage write failed'));
    });
  }
}
