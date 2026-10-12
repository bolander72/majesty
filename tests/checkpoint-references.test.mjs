import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointAttachments, checkpointContainerEntries, checkpointInventory,
  checkpointFile, MAX_UNIT_RECORDS, CHECKPOINT_PAGE_BYTES} from '../web/world/checkpoint.mjs';

function words(values) {
  const data = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => data.writeUInt32LE(value, index * 4)); return data;
}
function chunk(tag, data = Buffer.alloc(0), version = 0, count = 0) {
  const h = words([0, data.length, version, count]); h.write(tag);
  return Buffer.concat([h, data]);
}
function binding(tag, id, data, version = tag === 'CONT' ? 1 : 2) {
  return Buffer.concat([words([id]), chunk(tag, chunk('PRIM', data, version), 0, 1)]);
}
function world(roots = []) { return Buffer.concat([chunk('VERS', Buffer.alloc(256), 1), ...roots]); }
function source(data) {
  const requests = [];
  return {size: data.length, requests, async readAt(offset, length) {
    requests.push({offset, length}); return data.subarray(offset, offset + length);
  }};
}
function globalState(items, definitions = [0x316c4241], tail = Buffer.from([0xff])) {
  return chunk('GSGL', Buffer.concat([Buffer.alloc(19 * 4), words([definitions.length, ...definitions,
    items.length, ...items.flatMap(item => [item.item, item.ownerUnitId])]), tail]), 6);
}
async function collect(iterator) {const out = []; for await (const value of iterator) out.push(value); return out;}
function containers(payload, id = 502) {
  return world([chunk('ORDR', undefined, 1), chunk('CONT', binding('CONT', id, payload), 1, 1)]);
}

test('attachment ranges include their saved-ID prefix and keep order contents opaque', async () => {
  const order = binding('ORDR', 497, words([0xffeeddcc, 502]));
  const container = binding('CONT', 502, words([1, 0]));
  const data = world([chunk('ORDR', order, 1, 1), chunk('CONT', container, 1, 1)]);
  const records = await collect(checkpointAttachments(source(data)));
  assert.deepEqual(records.map(record => [record.kind, record.unitId]), [['ORDR', 497], ['CONT', 502]]);
  assert.equal(records[0].size, order.length);
  assert.equal(data.readUInt32LE(records[0].offset), 497);
  assert.equal(records[0].primary.version, 2); assert.equal(records[1].primary.version, 1);
  assert.equal(Object.hasOwn(records[0], 'targetUnitId'), false);
});

test('container groups and members expose saved-ID flags without treating opaque values as pointers', async () => {
  const data = containers(words([1, 2, 1, 2, 100, 502, 506, 1, 508, 3,
    1, 1, 101, 506, 0xffeeddcc, 0]));
  const entries = await collect(checkpointContainerEntries(source(data)));
  const groups = entries.filter(entry => entry.type === 'group');
  assert.deepEqual(groups.map(group => [group.groupKind, group.groupOwnerUnitId, group.memberCount]),
    [[100, 502, 2], [101, 506, 1]]);
  const members = entries.filter(entry => entry.type === 'member');
  assert.deepEqual(members.map(member => [member.value, member.flags, member.targetUnitId]),
    [[506, 1, 506], [508, 3, 508], [0xffeeddcc, 0, null]]);
  assert.ok(entries.every(entry => entry.unitId === 502));
});

test('inventory starts after the counted definition set and preserves duplicate legacy items on different owners', async () => {
  const items = [{item: 0x01564e49, ownerUnitId: 2133}, {item: 0x01564e49, ownerUnitId: 2112}];
  const data = world([globalState(items, [7, 8, 9])]);
  const entries = await collect(checkpointInventory(source(data)));
  assert.deepEqual(entries.map(({item, ownerUnitId}) => ({item, ownerUnitId})), items);
  assert.equal(entries[0].offset, 272 + 16 + 76 + 4 + 12 + 4);
  assert.equal(entries[1].offset, entries[0].offset + 8);
});

test('File/Blob adapters preserve attachment, member and inventory metadata', async () => {
  const data = Buffer.concat([containers(words([1, 1, 1, 1, 100, 502, 506, 1])),
    globalState([{item: 0x01564e49, ownerUnitId: 506}])]);
  for (const iterator of [checkpointAttachments, checkpointContainerEntries, checkpointInventory])
    assert.deepEqual(await collect(iterator(checkpointFile(new Blob([data])))), await collect(iterator(source(data))));
});

test('saved-ID prefixes crossing a page boundary are copied correctly', async () => {
  // VERS + padding header/payload + ORDR header -> saved ID at 4095.
  const padding = Buffer.alloc(4095 - 272 - 16 - 16);
  const data = world([chunk('JUNK', padding), chunk('ORDR', binding('ORDR', 0x12345678, words([0])), 1, 1),
    chunk('CONT', undefined, 1)]);
  const records = await collect(checkpointAttachments(source(data)));
  assert.equal(records[0].offset, 4095); assert.equal(records[0].unitId, 0x12345678);
});

test('large container lists stream members while skipping dormant terrain and keeping read requests bounded', async () => {
  const payload = words([1, 1, 1, 1000, 100, 502, ...Array.from({length: 1000}, (_, i) => [10000 + i, 1]).flat()]);
  const data = world([chunk('MTER', Buffer.alloc(1024 * 1024, 0xff), 0, 16641),
    chunk('ORDR', undefined, 1), chunk('CONT', binding('CONT', 502, payload), 1, 1)]);
  const input = source(data); let members = 0;
  for await (const entry of checkpointContainerEntries(input)) {
    if (entry.type === 'member') assert.equal(entry.targetUnitId, 10000 + members++);
  }
  assert.equal(members, 1000); assert.ok(input.requests.length < 8);
  assert.ok(input.requests.every(request => request.length <= CHECKPOINT_PAGE_BYTES));
  assert.ok(input.requests.reduce((sum, request) => sum + request.length, 0) < 16 * 1024);
});

test('absent, duplicated or incorrectly counted attachment groups reject inspection', async () => {
  for (const roots of [[chunk('ORDR', undefined, 1)],
    [chunk('ORDR', undefined, 1), chunk('CONT', undefined, 1), chunk('ORDR', undefined, 1)],
    [chunk('ORDR', binding('ORDR', 1, words([0])), 1, 0), chunk('CONT', undefined, 1)],
    [chunk('ORDR', undefined, 1, MAX_UNIT_RECORDS + 1), chunk('CONT', undefined, 1)]])
    await assert.rejects(collect(checkpointAttachments(source(world(roots)))), /Incomplete native attachment|Invalid native attachment|count does not match/);
});

test('null IDs, wrong component versions and missing primary attachment state reject inspection', async () => {
  const missing = Buffer.concat([words([1]), chunk('ORDR', chunk('SECD'), 0, 1)]);
  for (const record of [binding('ORDR', 0, words([0])), binding('ORDR', 1, words([0]), 1), missing])
    await assert.rejects(collect(checkpointAttachments(source(world([chunk('ORDR', record, 1, 1),
      chunk('CONT', undefined, 1)])))), /Unsupported native attachment|Incomplete native attachment/);
});

test('truncated, unsupported and excessive container entries reject before unbounded iteration', async () => {
  for (const payload of [words([2, 0]), words([1, MAX_UNIT_RECORDS + 1]), words([1, 1]),
    words([1, 1, 2, 0, 100, 502]), words([1, 1, 1, MAX_UNIT_RECORDS + 1, 100, 502]),
    words([1, 1, 1, 1, 100, 502, 506]), words([1, 0, 99])])
    await assert.rejects(collect(checkpointContainerEntries(source(containers(payload)))),
      /Unsupported native container|Truncated native container|Invalid native container|count does not match/);
});

test('inventory rejects unsupported globals, duplicate globals, count overflow and truncated pair tables', async () => {
  const valid = globalState([]), badVersion = Buffer.from(valid); badVersion.writeUInt32LE(5, 8);
  const defsOverflow = Buffer.concat([Buffer.alloc(76), words([MAX_UNIT_RECORDS + 1])]);
  const itemsOverflow = Buffer.concat([Buffer.alloc(76), words([0, MAX_UNIT_RECORDS + 1])]);
  const truncated = Buffer.concat([Buffer.alloc(76), words([0, 1, 0x01564e49])]);
  for (const roots of [[badVersion], [valid, valid], [], [chunk('GSGL', defsOverflow, 6)],
    [chunk('GSGL', itemsOverflow, 6)], [chunk('GSGL', truncated, 6)]])
    await assert.rejects(collect(checkpointInventory(source(world(roots)))),
      /Unsupported native global|Missing native global|Too many native definition|Invalid native inventory/);
});

test('empty original attachment and inventory groups complete without fabricating units or items', async () => {
  const data = world([chunk('ORDR', undefined, 1), chunk('CONT', undefined, 1), globalState([])]);
  for (const iterator of [checkpointAttachments, checkpointContainerEntries, checkpointInventory])
    assert.deepEqual(await collect(iterator(source(data))), []);
});
