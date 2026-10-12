import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GuildHomeStore, encodeHomeRecord, decodeHomeRecord, prepareHomeBoundActorArrival, openGuildHomeStoreByAlias,
  MAX_HOME_RECORD_BYTES, MAX_REGISTERED_GUILD_MEMBERS} from '../web/world/hero-home.mjs';
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function seed(count = 1) {
  const worldId = 'a'.repeat(64), contentDigest = 'c'.repeat(64), checkpoint = 'b'.repeat(64);
  const origin = [worldId, contentDigest, '0_0', 469, 7, checkpoint];
  const members = Array.from({length: count}, (_, i) => ({entityId: sha(['majesty-home-member-v1', ...origin, 502 + i, 27 + i]),
    unitId: 502 + i, agentId: 27 + i})).sort((a, b) => a.entityId.localeCompare(b.entityId));
  return {version: 1, worldId, contentDigest, guildEntityId: sha(['majesty-home-guild-v1', ...origin]),
    home: {region: '0_0', unitId: 469, agentId: 7, description: 0x31564241, playerNumber: 0, originCheckpointSha256: checkpoint},
    members, revision: 0, previous: null, pending: null, lastOperation: null};
}
const identity = r => ({worldId: r.worldId, contentDigest: r.contentDigest, guildEntityId: r.guildEntityId});
function fixture(count = 1) {
  const registration = seed(count), files = new Map(), reads = [], writes = []; let locked = false;
  const io = {async withLock(mode, consume) {
    if (locked) throw Error('busy'); locked = true;
    try {return await consume();} finally {locked = false;}
  }, async open(name) {
    assert.ok(locked); reads.push(name); const data = files.get(name);
    return data ? {size: data.length, async readAt(at, n) {
      assert.ok(locked && n <= MAX_HOME_RECORD_BYTES); return Uint8Array.from(data.subarray(at, at + n));
    }} : null;
  }, async atomicWrite(name, produce) {
    assert.ok(locked); const parts = [];
    await produce({async write(data) {assert.ok(data.length <= MAX_HOME_RECORD_BYTES); parts.push(Buffer.from(data));}});
    files.set(name, Buffer.concat(parts)); writes.push(name);
  }};
  const store = () => new GuildHomeStore(io, {...identity(registration),
    homeAlias: {region: registration.home.region, unitId: 469, agentId: 7}});
  const request = state => ({heroEntityId: registration.members[0].entityId, toRegion: '1_0',
    operationId: 'd'.repeat(64), expectedSha256: state.sha256});
  return {registration, files, io, reads, writes, store, request};
}

test('persistent home and occupied slot survive reopen, reservation and exact reservation retry', async () => {
  const f = fixture(), first = await f.store().initialize(f.registration);
  const reserved = await f.store().reserveTravel(f.request(first));
  const reopened = await f.store().read();
  assert.deepEqual(reopened.record.home, first.record.home);
  assert.deepEqual(reopened.record.members, first.record.members);
  assert.equal(reopened.occupiedSlots, 1); assert.equal(reopened.record.pending.toRegion, '1_0');
  assert.equal(reopened.record.revision, 1); assert.equal(reopened.record.previous, first.sha256);
  assert.equal((await f.store().reserveTravel(f.request(first))).idempotent, true);
  assert.equal(f.files.size, 1); assert.ok([...f.files.values()].every(b => b.length <= MAX_HOME_RECORD_BYTES));
  reserved.record.home.unitId = 999; assert.equal((await f.store().read()).record.home.unitId, 469);
});

for (const boundary of ['before-publish', 'after-publish']) test(`reservation interruption at ${boundary} retains one complete roster`, async () => {
  const f = fixture(), first = await f.store().initialize(f.registration);
  await assert.rejects(f.store().reserveTravel(f.request(first), async at => {if (at === boundary) throw Error('interrupted');}), /interrupted/);
  const reopened = await f.store().read();
  assert.equal(Boolean(reopened.record.pending), boundary === 'after-publish');
  assert.equal(reopened.occupiedSlots, 1); assert.deepEqual(reopened.record.home, first.record.home);
  assert.equal((await f.store().reserveTravel(f.request(first))).idempotent, boundary === 'after-publish');
});

for (const boundary of ['before-publish', 'after-publish']) test(`cancellation interruption at ${boundary} retains home and permits exact retry`, async () => {
  const f = fixture(), first = await f.store().initialize(f.registration), reserved = await f.store().reserveTravel(f.request(first));
  const request = {operationId: 'd'.repeat(64), expectedSha256: reserved.sha256};
  await assert.rejects(f.store().cancelTravel(request, async at => {if (at === boundary) throw Error('interrupted');}), /interrupted/);
  const reopened = await f.store().read();
  assert.equal(Boolean(reopened.record.pending), boundary === 'before-publish');
  assert.equal(reopened.occupiedSlots, 1); assert.deepEqual(reopened.record.members, first.record.members);
  assert.equal((await f.store().cancelTravel(request)).idempotent, boundary === 'after-publish');
});

test('stale, conflicting, foreign-member and reused travel requests cannot change the selected guild', async () => {
  const f = fixture(2), s = f.store(), first = await s.initialize(f.registration), request = f.request(first);
  await assert.rejects(s.reserveTravel({...request, heroEntityId: 'e'.repeat(64)}), /reservation/);
  const reserved = await s.reserveTravel(request);
  await assert.rejects(s.reserveTravel({...request, operationId: 'e'.repeat(64)}), /changed/);
  await assert.rejects(s.reserveTravel({...request, toRegion: '2_0'}), /reused/);
  await assert.rejects(s.reserveTravel({...request, expectedSha256: reserved.sha256, operationId: 'e'.repeat(64)}), /pending/);
  await assert.rejects(s.cancelTravel({operationId: 'e'.repeat(64), expectedSha256: reserved.sha256}), /changed/);
  const canceled = await s.cancelTravel({operationId: request.operationId, expectedSha256: reserved.sha256});
  assert.equal(canceled.occupiedSlots, 2);
  await assert.rejects(s.reserveTravel({...request, expectedSha256: canceled.sha256}), /reused after cancellation/);
});

test('origin identity, member aliases, world and content cannot be silently rebound', () => {
  const r = seed(), encoded = encodeHomeRecord(r);
  assert.deepEqual(decodeHomeRecord(encoded, identity(r)), r);
  for (const change of [v => v.home.unitId++, v => v.home.region = '1_0',
    v => v.home.originCheckpointSha256 = 'e'.repeat(64), v => v.members[0].agentId++,
    v => v.members[0].entityId = 'e'.repeat(64), v => v.extra = 1]) {
    const altered = structuredClone(r); change(altered); assert.throws(() => encodeHomeRecord(altered));
  }
  for (const field of ['worldId', 'contentDigest', 'guildEntityId'])
    assert.throws(() => decodeHomeRecord(encoded, {...identity(r), [field]: 'e'.repeat(64)}), /identity|digest/);
  assert.throws(() => encodeHomeRecord(seed(MAX_REGISTERED_GUILD_MEMBERS + 1)), /record/);
  const corrupted = Uint8Array.from(encoded); corrupted[25] ^= 1;
  assert.throws(() => decodeHomeRecord(corrupted, identity(r)));
});

test('damaged selected records fail without falling back to a new registration', async () => {
  const f = fixture(), s = f.store(); await s.initialize(f.registration);
  const [name] = f.files.keys(); f.files.set(name, Buffer.alloc(MAX_HOME_RECORD_BYTES + 1));
  await assert.rejects(s.read(), /Damaged/); await assert.rejects(s.initialize(f.registration), /Damaged/);
});

test('one guild lookup ignores hundreds of unrelated dormant files and excludes concurrent publication', async () => {
  const f = fixture(), s = f.store(), first = await s.initialize(f.registration);
  for (let n = 0; n < 500; n++) f.files.set(`unrelated-${n}`, Buffer.alloc(MAX_HOME_RECORD_BYTES));
  f.reads.length = 0;
  await s.withRegistered(async selected => {
    assert.equal(selected.occupiedSlots, 1);
    await assert.rejects(s.reserveTravel(f.request(first)), /busy/);
  });
  assert.equal(f.reads.length, 1); assert.equal(f.files.size, 501);
});

test('initialization captures caller data before asynchronous publication', async () => {
  const f = fixture(), s = f.store();
  await s.initialize(f.registration, async at => {if (at === 'before-publish') f.registration.home.unitId = 999;});
  assert.equal((await s.read()).record.home.unitId, 469);
});

test('remote regions and foreign worlds reject home-bound preparation before reading native bytes', async () => {
  const f = fixture(), selected = await f.store().initialize(f.registration);
  const neverRead = {size: 1, async readAt() {throw Error('native bytes unexpectedly read');}};
  const context = {selected, worldId: f.registration.worldId, contentDigest: f.registration.contentDigest,
    sourceRegion: '0_0', destinationRegion: '1_0'};
  await assert.rejects(prepareHomeBoundActorArrival(neverRead, neverRead, {}, context), /Remote native home projection/);
  await assert.rejects(prepareHomeBoundActorArrival(neverRead, neverRead, {}, {...context,
    worldId: 'e'.repeat(64)}), /identity|digest/);
});

test('saved guild alias recovers its stable ID and prevents later checkpoints from registering a second home', async () => {
  const f = fixture(), first = await f.store().initialize(f.registration);
  await f.store().reserveTravel(f.request(first)); f.reads.length = 0;
  const lookup = {worldId: f.registration.worldId, contentDigest: f.registration.contentDigest,
    region: '0_0', unitId: 469, agentId: 7};
  const reopened = await openGuildHomeStoreByAlias(f.io, lookup);
  assert.equal(f.reads.length, 1);
  const current = await reopened.read(); assert.equal(current.record.guildEntityId, f.registration.guildEntityId);
  assert.equal(current.record.members[0].entityId, f.registration.members[0].entityId);
  await assert.rejects(openGuildHomeStoreByAlias(f.io, {...lookup, worldId: 'e'.repeat(64)}), /identity|digest/);
  assert.equal(await openGuildHomeStoreByAlias(f.io, {...lookup, unitId: 470}), null);
  const changed = structuredClone(f.registration); changed.home.originCheckpointSha256 = 'f'.repeat(64);
  const origin = [changed.worldId, changed.contentDigest, '0_0', 469, 7, changed.home.originCheckpointSha256];
  changed.guildEntityId = sha(['majesty-home-guild-v1', ...origin]);
  changed.members[0].entityId = sha(['majesty-home-member-v1', ...origin, 502, 27]);
  const other = new GuildHomeStore(f.io, {...identity(changed), homeAlias: {region: '0_0', unitId: 469, agentId: 7}});
  await assert.rejects(other.initialize(changed), /identity|digest/);
  assert.equal(f.files.size, 1);
});
