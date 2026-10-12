// Persistent logical guild homes and travel reservations. This does not move
// native actors, publish regional checkpoints, or project a remote guild.
import {Sha256} from './sha256.mjs';
import {regionKey} from './region.mjs';
import {checkpointActorRecords, checkpointAgents, checkpointAgentValues,
  checkpointContainerEntries} from './checkpoint.mjs';
import {hashCheckpointSource} from './transfer-store.mjs';
import {prepareCheckpointActorArrival} from './arrival.mjs';

export const MAX_HOME_RECORD_BYTES = 4096;
export const MAX_REGISTERED_GUILD_MEMBERS = 8;
const hash = bytes => new Sha256().update(bytes).hex();
const digest = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const uint = (v, max = 0xffffffff) => Number.isInteger(v) && v >= 0 && v <= max;
const positive = (v, max) => uint(v, max) && v > 0;
const keys = (v, names) => v && typeof v === 'object' && !Array.isArray(v) &&
  Object.keys(v).sort().join(',') === [...names].sort().join(',');
const clone = v => JSON.parse(JSON.stringify(v));
const bytes = v => new TextEncoder().encode(JSON.stringify(v));
function region(value) {
  if (typeof value !== 'string' || value.length > 24) throw Error('Invalid registered home region');
  const xy = value.split('_').map(Number);
  if (xy.length !== 2 || regionKey(...xy) !== value) throw Error('Invalid registered home region');
  return value;
}
function identity(v) {
  if (!keys(v, ['worldId', 'contentDigest', 'guildEntityId']) ||
      !Object.values(v).every(digest)) throw Error('Invalid registered home identity');
  return clone(v);
}
function homeAlias(v) {
  if (!keys(v, ['region', 'unitId', 'agentId']) || !positive(v.unitId) || !positive(v.agentId, 0x7fffffff))
    throw Error('Invalid registered guild lookup alias');
  return {region: region(v.region), unitId: v.unitId, agentId: v.agentId};
}
export function guildHomeFilename(alias) {
  const a = homeAlias(alias);
  return `Frontier_GuildHome_${a.region}_${a.unitId}_${a.agentId}.checkpoint`;
}
const homeFilename = guildHomeFilename;
async function homeFileBytes(io, name) {
  const file = await io.open(name); if (file === null) return null;
  if (!Number.isSafeInteger(file?.size) || file.size < 1 || file.size > MAX_HOME_RECORD_BYTES || typeof file.readAt !== 'function')
    throw Error('Damaged registered home checkpoint');
  const data = await file.readAt(0, file.size);
  if (!(data instanceof Uint8Array) || data.length !== file.size) throw Error('Truncated registered home checkpoint');
  return data;
}
function canonical(o) {
  if (!keys(o, ['version', 'worldId', 'contentDigest', 'guildEntityId', 'home', 'members', 'revision', 'previous', 'pending', 'lastOperation']) ||
      o.version !== 1 || !uint(o.revision) || !(o.previous === null || digest(o.previous)) ||
      (o.revision === 0) !== (o.previous === null) || !Array.isArray(o.members) ||
      o.members.length > MAX_REGISTERED_GUILD_MEMBERS) throw Error('Invalid registered home record');
  const id = identity({worldId: o.worldId, contentDigest: o.contentDigest, guildEntityId: o.guildEntityId});
  const h = o.home;
  if (!keys(h, ['region', 'unitId', 'agentId', 'description', 'playerNumber', 'originCheckpointSha256']) ||
      !positive(h.unitId) || !positive(h.agentId, 0x7fffffff) || !positive(h.description) ||
      !uint(h.playerNumber, 7) || !digest(h.originCheckpointSha256)) throw Error('Invalid registered guild origin');
  const home = {region: region(h.region), unitId: h.unitId, agentId: h.agentId,
    description: h.description, playerNumber: h.playerNumber, originCheckpointSha256: h.originCheckpointSha256};
  const origin = [id.worldId, id.contentDigest, home.region, home.unitId, home.agentId, home.originCheckpointSha256];
  if (id.guildEntityId !== hash(bytes(['majesty-home-guild-v1', ...origin]))) throw Error('Registered guild origin identity differs');
  const seen = new Set(); let previous = '';
  const members = o.members.map(m => {
    if (!keys(m, ['entityId', 'unitId', 'agentId']) || !digest(m.entityId) || m.entityId <= previous ||
        !positive(m.unitId) || !positive(m.agentId, 0x7fffffff) || m.unitId === home.unitId ||
        m.agentId === home.agentId || seen.has('u' + m.unitId) || seen.has('a' + m.agentId))
      throw Error('Invalid registered guild member');
    previous = m.entityId; seen.add('u' + m.unitId); seen.add('a' + m.agentId);
    if (m.entityId !== hash(bytes(['majesty-home-member-v1', ...origin, m.unitId, m.agentId])))
      throw Error('Registered member origin identity differs');
    return {entityId: m.entityId, unitId: m.unitId, agentId: m.agentId};
  });
  let pending = null;
  if (o.pending !== null) {
    const p = o.pending, member = members.find(m => m.entityId === p?.heroEntityId);
    if (!keys(p, ['operationId', 'heroEntityId', 'fromRegion', 'toRegion']) || !digest(p.operationId) ||
        !member || region(p.fromRegion) !== home.region || region(p.toRegion) === home.region)
      throw Error('Invalid registered home travel reservation');
    pending = {operationId: p.operationId, heroEntityId: p.heroEntityId,
      fromRegion: p.fromRegion, toRegion: p.toRegion};
  }
  let lastOperation = null;
  if (o.revision) {
    if (!keys(o.lastOperation, ['kind', 'operationId']) || !['reserve', 'cancel'].includes(o.lastOperation.kind) ||
        !digest(o.lastOperation.operationId) || (pending !== null) !== (o.lastOperation.kind === 'reserve') ||
        (pending && pending.operationId !== o.lastOperation.operationId)) throw Error('Invalid registered home operation');
    lastOperation = {kind: o.lastOperation.kind, operationId: o.lastOperation.operationId};
  } else if (o.lastOperation !== null || pending) throw Error('Invalid registered home seed operation');
  return {version: 1, ...id, home, members, revision: o.revision, previous: o.previous, pending, lastOperation};
}
export function encodeHomeRecord(record) {
  const data = bytes(canonical(record)), sha256 = hash(data);
  const encoded = new TextEncoder().encode(`majesty-guild-home-v1\n${sha256}\n${new TextDecoder().decode(data)}\n`);
  if (encoded.length > MAX_HOME_RECORD_BYTES) throw Error('Registered home record exceeds byte budget');
  return encoded;
}
export function decodeHomeRecord(encoded, expectedIdentity) {
  const expected = identity(expectedIdentity);
  if (!(encoded instanceof Uint8Array) || encoded.length < 1 || encoded.length > MAX_HOME_RECORD_BYTES)
    throw Error('Invalid registered home bytes');
  const lines = new TextDecoder('utf-8', {fatal: true}).decode(encoded).split('\n');
  if (lines.length !== 4 || lines[0] !== 'majesty-guild-home-v1' || !digest(lines[1]) || lines[3] !== '')
    throw Error('Invalid registered home framing');
  const value = canonical(JSON.parse(lines[2])), again = encodeHomeRecord(value);
  if (JSON.stringify(expected) !== JSON.stringify(identity({worldId: value.worldId,
      contentDigest: value.contentDigest, guildEntityId: value.guildEntityId})) ||
      encoded.length !== again.length || encoded.some((v, i) => v !== again[i]))
    throw Error('Registered home identity or digest differs');
  return value;
}

// Register only the observed original native/GPL reciprocal roster. Class or
// player equality alone cannot establish a persistent home correspondence.
export async function registerCheckpointGuildHome(source, {worldId, contentDigest, region: key, guildUnitId}) {
  if (![worldId, contentDigest].every(digest)) throw Error('Invalid guild registration world');
  region(key);
  const guild = await checkpointActorRecords(source, guildUnitId);
  if (guild.unit.family !== 'BLDG' || !uint(guild.unit.playerNumber, 7) || (guild.unit.stateFlags & 4))
    throw Error('Registration requires a living player guild');
  let roster = null; const memberIds = [];
  for await (const value of checkpointAgentValues(source, guild.agent.agentId)) {
    if (value.attribute.toLowerCase() !== 'members') continue;
    if (value.path.length) {
      if (value.path.length !== 1 || value.type !== 5 || !value.targetAgentId ||
          memberIds.includes(value.targetAgentId) || memberIds.length === MAX_REGISTERED_GUILD_MEMBERS)
        throw Error('Unsupported registered guild script roster');
      memberIds.push(value.targetAgentId);
    } else {
      if (roster || value.type !== 4) throw Error('Invalid registered guild script list');
      roster = value;
    }
  }
  if (!roster || roster.childCount !== memberIds.length) throw Error('Missing registered guild script roster');
  const selected = new Map();
  for await (const agent of checkpointAgents(source)) if (memberIds.includes(agent.agentId)) {
    if (agent.deleted || !agent.unitId) throw Error('Invalid registered member script association');
    selected.set(agent.agentId, agent.unitId);
  }
  const aliases = [];
  for (const agentId of memberIds) {
    const actor = await checkpointActorRecords(source, selected.get(agentId));
    if (actor.agent.agentId !== agentId || actor.unit.family !== 'VHCL' ||
        actor.unit.playerNumber !== guild.unit.playerNumber) throw Error('Registered guild member differs');
    let home = null;
    for await (const value of checkpointAgentValues(source, agentId)) if (!value.path.length && value.attribute.toLowerCase() === 'home') {
      if (home || value.type !== 5 || value.targetAgentId !== guild.agent.agentId)
        throw Error('Registered member has a different script home');
      home = value;
    }
    if (!home) throw Error('Registered member has no script home');
    aliases.push({unitId: actor.unit.unitId, agentId});
  }
  const nativeMembers = [], parents = new Map(); let nativeGroup = null;
  for await (const entry of checkpointContainerEntries(source)) {
    if (entry.unitId === guildUnitId && entry.groupKind === 100) {
      if (entry.type === 'group') {
        if (nativeGroup || entry.groupOwnerUnitId !== guildUnitId) throw Error('Invalid native guild roster group');
        nativeGroup = entry;
      } else {
        if (!entry.targetUnitId || nativeMembers.includes(entry.targetUnitId) || nativeMembers.length === MAX_REGISTERED_GUILD_MEMBERS)
          throw Error('Invalid native guild roster member');
        nativeMembers.push(entry.targetUnitId);
      }
    }
    if (aliases.some(a => a.unitId === entry.unitId) && entry.groupKind === 101 && entry.type === 'member') {
      if (entry.groupOwnerUnitId !== entry.unitId || entry.targetUnitId !== guildUnitId || parents.has(entry.unitId))
        throw Error('Invalid registered member reciprocal parent');
      parents.set(entry.unitId, guildUnitId);
    }
  }
  if (!nativeGroup || nativeMembers.length !== aliases.length || parents.size !== aliases.length ||
      aliases.some(a => !nativeMembers.includes(a.unitId))) throw Error('Native and script guild rosters differ');
  const originCheckpointSha256 = await hashCheckpointSource(source);
  const origin = [worldId, contentDigest, key, guildUnitId, guild.agent.agentId, originCheckpointSha256];
  const guildEntityId = hash(bytes(['majesty-home-guild-v1', ...origin]));
  const members = aliases.map(a => ({entityId: hash(bytes(['majesty-home-member-v1', ...origin, a.unitId, a.agentId])), ...a}))
    .sort((a, b) => a.entityId.localeCompare(b.entityId));
  return canonical({version: 1, worldId, contentDigest, guildEntityId,
    home: {region: key, unitId: guildUnitId, agentId: guild.agent.agentId, description: guild.unit.description,
      playerNumber: guild.unit.playerNumber, originCheckpointSha256}, members, revision: 0, previous: null, pending: null, lastOperation: null});
}

export class GuildHomeStore {
  #io; #identity; #name; #alias;
  constructor(io, expectedIdentity) {
    if (!io || !['open', 'atomicWrite', 'withLock'].every(k => typeof io[k] === 'function')) throw Error('Invalid registered home storage');
    this.#identity = identity({worldId: expectedIdentity?.worldId, contentDigest: expectedIdentity?.contentDigest,
      guildEntityId: expectedIdentity?.guildEntityId}); this.#io = io;
    this.#alias = homeAlias(expectedIdentity?.homeAlias); this.#name = homeFilename(this.#alias);
  }
  async #read() {
    const data = await homeFileBytes(this.#io, this.#name); if (data === null) return null;
    const record = decodeHomeRecord(data, this.#identity);
    if (record.home.region !== this.#alias.region || record.home.unitId !== this.#alias.unitId || record.home.agentId !== this.#alias.agentId)
      throw Error('Registered guild lookup alias differs');
    return {record, sha256: hash(data), occupiedSlots: record.members.length};
  }
  read() {return this.#io.withLock('shared', () => this.#read());}
  withRegistered(consume) {
    if (typeof consume !== 'function') throw Error('Invalid registered home consumer');
    return this.#io.withLock('shared', async () => consume(await this.#read()));
  }
  async #write(record, boundary) {
    const data = encodeHomeRecord(record), sha256 = hash(data);
    await boundary('before-publish');
    await this.#io.atomicWrite(this.#name, sink => sink.write(data));
    const actual = await this.#read(); if (!actual || actual.sha256 !== sha256) throw Error('Registered home publication differs');
    await boundary('after-publish'); return {...actual, idempotent: false};
  }
  initialize(registration, boundary = async () => {}) {
    const data = encodeHomeRecord(registration), record = decodeHomeRecord(data, this.#identity);
    if (record.revision || record.pending) throw Error('Registered home initialization requires an original seed');
    if (record.home.region !== this.#alias.region || record.home.unitId !== this.#alias.unitId || record.home.agentId !== this.#alias.agentId)
      throw Error('Registered guild lookup alias differs');
    return this.#io.withLock('exclusive', async () => {
      const old = await this.#read();
      if (old) {if (old.sha256 !== hash(data)) throw Error('Registered guild already exists'); return {...old, idempotent: true};}
      return this.#write(record, boundary);
    });
  }
  reserveTravel({heroEntityId, toRegion, operationId, expectedSha256}, boundary = async () => {}) {
    if (![heroEntityId, operationId, expectedSha256].every(digest)) throw Error('Invalid registered travel request');
    region(toRegion);
    return this.#io.withLock('exclusive', async () => {
      const old = await this.#read(); if (!old) throw Error('Missing registered guild');
      const r = old.record;
      if (r.pending?.operationId === operationId) {
        if (r.pending.heroEntityId !== heroEntityId || r.pending.toRegion !== toRegion || r.previous !== expectedSha256)
          throw Error('Travel operation ID reused for different state');
        return {...old, idempotent: true};
      }
      if (r.lastOperation?.operationId === operationId) throw Error('Travel operation ID reused after cancellation');
      if (old.sha256 !== expectedSha256) throw Error('Registered guild changed; reload before reserving');
      if (r.pending) throw Error('Guild travel reservation already pending');
      if (r.revision === 0xffffffff) throw Error('Registered home revision exhausted');
      const next = canonical({...r, revision: r.revision + 1, previous: old.sha256,
        pending: {operationId, heroEntityId, fromRegion: r.home.region, toRegion}, lastOperation: {kind: 'reserve', operationId}});
      return this.#write(next, boundary);
    });
  }
  cancelTravel({operationId, expectedSha256}, boundary = async () => {}) {
    if (![operationId, expectedSha256].every(digest)) throw Error('Invalid registered travel cancellation');
    return this.#io.withLock('exclusive', async () => {
      const old = await this.#read();
      if (old?.record.lastOperation?.kind === 'cancel' && old.record.lastOperation.operationId === operationId &&
          old.record.previous === expectedSha256) return {...old, idempotent: true};
      if (!old || old.sha256 !== expectedSha256 || old.record.pending?.operationId !== operationId)
        throw Error('Registered travel reservation changed');
      if (old.record.revision === 0xffffffff) throw Error('Registered home revision exhausted');
      return this.#write({...old.record, revision: old.record.revision + 1, previous: old.sha256, pending: null,
        lastOperation: {kind: 'cancel', operationId}}, boundary);
    });
  }
}

// Recover the stable home ID from exactly one file in the caller's owned
// world directory. A later save must reuse this registration, not derive a
// new identity from the later checkpoint's bytes or scan every dormant guild.
export function openGuildHomeStoreByAlias(io, {worldId, contentDigest, region: key, unitId, agentId}) {
  if (![worldId, contentDigest].every(digest)) throw Error('Invalid registered home lookup world');
  const alias = homeAlias({region: key, unitId, agentId});
  return io.withLock('shared', async () => {
    const data = await homeFileBytes(io, homeFilename(alias)); if (data === null) return null;
    const lines = new TextDecoder('utf-8', {fatal: true}).decode(data).split('\n');
    if (lines.length !== 4) throw Error('Invalid registered home framing');
    const raw = JSON.parse(lines[2]);
    const record = decodeHomeRecord(data, {worldId, contentDigest, guildEntityId: raw.guildEntityId});
    if (record.home.region !== key || record.home.unitId !== unitId || record.home.agentId !== agentId)
      throw Error('Registered guild lookup alias differs');
    return new GuildHomeStore(io, {worldId, contentDigest, guildEntityId: record.guildEntityId, homeAlias: alias});
  });
}

// Use the registered home in preparation without claiming a remote native
// projection. Other regions must acquire a qualified runtime representation;
// a similar local building is never a substitute for the registered guild.
export async function prepareHomeBoundActorArrival(source, destination, options, context) {
  const {selected, worldId, contentDigest, sourceRegion, destinationRegion} = context ?? {};
  if (!selected?.record) throw Error('Missing registered home selection');
  const encoded = encodeHomeRecord(selected.record), record = decodeHomeRecord(encoded,
    {worldId, contentDigest, guildEntityId: selected.record.guildEntityId});
  if (hash(encoded) !== selected.sha256) throw Error('Registered home selection changed');
  if (record.pending && destinationRegion !== record.pending.toRegion)
    throw Error('Destination differs from the registered travel reservation');
  if (region(sourceRegion) !== record.home.region || region(destinationRegion) !== record.home.region)
    throw Error('Remote native home projection and owner transfer are not qualified');
  const member = record.members.find(m => m.unitId === options?.unitId);
  if (!member) throw Error('Arriving actor is not a registered guild member');
  const actor = await checkpointActorRecords(source, member.unitId);
  if (actor.agent.agentId !== member.agentId) throw Error('Registered hero native alias differs');
  const guildBinding = options.unitBindings?.filter(b => b.from === record.home.unitId) ?? [];
  if (guildBinding.length !== 1 || guildBinding[0].to !== record.home.unitId)
    throw Error('Registered guild cannot be rebound to another building');
  const guild = await checkpointActorRecords(source, record.home.unitId);
  if (guild.agent.agentId !== record.home.agentId || guild.unit.family !== 'BLDG' ||
      guild.unit.description !== record.home.description || guild.unit.playerNumber !== record.home.playerNumber)
    throw Error('Registered guild native alias differs');
  const prepared = await prepareCheckpointActorArrival(source, destination, options);
  const membership = prepared.plan.reciprocalScriptMemberships?.filter(m => m.sourceUnitId === record.home.unitId &&
    m.sourceAgentId === record.home.agentId && m.sourceAttribute.toLowerCase() === 'members') ?? [];
  if (membership.length !== 1 || membership[0].destinationAgentId !== record.home.agentId)
    throw Error('Registered guild script membership differs');
  prepared.plan.persistentHome = {guildEntityId: record.guildEntityId, heroEntityId: member.entityId,
    region: record.home.region, registrySha256: selected.sha256, registryRevision: record.revision,
    occupiedSlots: record.members.length, reservationOperationId: record.pending?.operationId ?? null,
    remoteNativeHomeQualified: false};
  return prepared;
}
