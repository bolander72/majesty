import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointPlacements, checkpointUnits, checkpointFile, CHECKPOINT_PAGE_BYTES} from '../web/world/checkpoint.mjs';

function chunk(tag, payload = Buffer.alloc(0), version = 0, count = 0) {
  const header = Buffer.alloc(16); header.write(tag);
  header.writeUInt32LE(payload.length, 4); header.writeUInt32LE(version, 8); header.writeUInt32LE(count, 12);
  return Buffer.concat([header, payload]);
}
function actor({id = 502, owner = 0, parent = 0, flags = 512, x = 2949120, y = 327680, z = 29120} = {}) {
  const payload = Buffer.alloc(40);
  [1, id, flags, 0, 829243969, owner >>> 0, parent].forEach((value, index) => payload.writeUInt32LE(value, index * 4));
  [x, y, z].forEach((value, index) => payload.writeInt32LE(value, 28 + index * 4));
  return chunk('UNIT', chunk('PRIM', payload, 9), 0, 1);
}
function world(actors, prefix = chunk('MTER')) {
  return Buffer.concat([chunk('VERS', Buffer.alloc(256), 1), prefix,
    ...['BLDG', 'VHCL', 'GRND', 'RWRD', 'MSGF', 'OFMP'].map(tag => chunk(tag,
      tag === 'VHCL' ? Buffer.concat(actors) : undefined, 0, tag === 'VHCL' ? actors.length : 0))]);
}
function source(data) {
  const requests = [];
  return {size: data.length, requests, async readAt(offset, length) {
    requests.push({offset, length}); return data.subarray(offset, offset + length);
  }};
}
async function collect(iterator) {const result = []; for await (const record of iterator) result.push(record); return result;}

test('saved placement maps owner and physical parent separately while preserving original unit metadata', async () => {
  const data = world([actor()]);
  const records = await collect(checkpointPlacements(source(data)));
  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {family: 'VHCL', unitId: 502, playerNumber: 0, description: 829243969,
    parentUnitId: 0, stateFlags: 512, fixedPosition: {x: 2949120, y: 327680, z: 29120},
    requiresParentPosition: false, mapPosition: {x: 1440, y: 160}, offset: 320, size: 72});
  const [unit] = await collect(checkpointUnits(source(data)));
  assert.deepEqual(unit.primary, {description: 829243969, words: [1, 502, 512, 0, 829243969, 0, 0]});
});

test('negative owners and signed fixed coordinates survive parsing and match original arithmetic shifts', async () => {
  const data = world([actor({owner: -1, x: -1, y: -2049, z: -2147483648})]);
  const [record] = await collect(checkpointPlacements(source(data)));
  assert.equal(record.playerNumber, -1);
  assert.deepEqual(record.fixedPosition, {x: -1, y: -2049, z: -2147483648});
  assert.deepEqual(record.mapPosition, {x: -1, y: -2});
});

test('parent-dependent positions remain unresolved; the original flag can select an independent position', async () => {
  const data = world([actor({id: 506, parent: 502}), actor({id: 508, parent: 502, flags: 512 | 0x80})]);
  const [attached, independent] = await collect(checkpointPlacements(source(data)));
  assert.equal(attached.parentUnitId, 502); assert.equal(attached.requiresParentPosition, true);
  assert.equal(attached.mapPosition, null);
  assert.equal(independent.parentUnitId, 502); assert.equal(independent.requiresParentPosition, false);
  assert.deepEqual(independent.mapPosition, {x: 1440, y: 160});
});

test('fixed coordinates crossing a page boundary read all three signed components correctly', async () => {
  // VERS + prefix + BLDG header + VHCL header + UNIT/PRIM headers + 28 bytes.
  const prefixBytes = 4092 - 272 - 16 - 16 - 16 - 16 - 16 - 28;
  const data = world([actor({x: -8193, y: 2147483647, z: -12345})], chunk('MTER', Buffer.alloc(prefixBytes)));
  const [record] = await collect(checkpointPlacements(source(data)));
  assert.deepEqual(record.fixedPosition, {x: -8193, y: 2147483647, z: -12345});
  assert.deepEqual(record.mapPosition, {x: -5, y: 1048575});
});

test('many placements stream with bounded reads and skip large terrain payloads', async () => {
  const data = world(Array.from({length: 1000}, (_, i) => actor({id: 10000 + i, x: i * 2048})),
    chunk('MTER', Buffer.alloc(1024 * 1024, 0xff), 0, 16641));
  const input = source(data); let count = 0;
  for await (const record of checkpointPlacements(input)) {
    assert.equal(record.unitId, 10000 + count); assert.equal(record.mapPosition.x, count++);
  }
  assert.equal(count, 1000); assert.ok(input.requests.length < 25);
  assert.ok(input.requests.every(request => request.length <= CHECKPOINT_PAGE_BYTES));
  assert.ok(input.requests.reduce((sum, request) => sum + request.length, 0) < 90 * 1024);
});

test('File/Blob placement adapter matches random-access reads', async () => {
  const data = world([actor(), actor({id: 507, owner: 7, parent: 502})]);
  assert.deepEqual(await collect(checkpointPlacements(checkpointFile(new Blob([data])))),
    await collect(checkpointPlacements(source(data))));
});

test('a primary record that lacks its final coordinate cannot complete placement inspection', async () => {
  const short = Buffer.alloc(36); short.writeUInt32LE(502, 4);
  const data = world([chunk('UNIT', chunk('PRIM', short, 9), 0, 1)]);
  assert.equal((await collect(checkpointUnits(source(data)))).length, 1, 'basic metadata alone needs fewer bytes');
  await assert.rejects(collect(checkpointPlacements(source(data))), /Truncated native unit position/);
});
