import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointAgents, checkpointAgentQueues, checkpointUnitAgentLinks, checkpointActorRecords, checkpointFile,
  CHECKPOINT_PAGE_BYTES, MAX_GPL_NAME_BYTES, MAX_UNIT_RECORDS} from '../web/world/checkpoint.mjs';

const word = value => {const b = Buffer.alloc(4); b.writeUInt32LE(value); return b;};
const text = value => Buffer.from(value + '\0');
function chunk(tag, body = Buffer.alloc(0), version = 0, count = 0) {
  return Buffer.concat([Buffer.from(tag), word(body.length), word(version), word(count), body]);
}
function envelope(version, body) {
  return Buffer.concat([word(body.length + 16), word(version), body, word(0), word(0xffffffff)]);
}
function agent(id, {unitId = id + 500, name = '', functions = ['walk', 'rest'],
  attributes = Buffer.concat([text('level'), word(1), word(7)]), deleted = 0} = {}) {
  // Original writer 00626740: attributes envelope, function names, own ID,
  // name, native Unit ID, byte deleted, DWORD counter, two flags, footer.
  return Buffer.concat([word(id), envelope(2, Buffer.concat([
    envelope(0, Buffer.concat([word(1), attributes])), word(functions.length),
    ...functions.map(text), word(id), text(name), word(unitId), Buffer.from([deleted]),
    word(19), Buffer.from([0, 1])]))]);
}
function gpl(agents = [agent(1, {unitId: 0, name: 'root'}), agent(2)], {tail, definitions = 1} = {}) {
  const manager = envelope(2, Buffer.concat([word(definitions), text('root'), word(1), word(agents.length),
    ...agents, tail ?? Buffer.concat([word(1), word(2), word(0), Buffer.from([1])])]));
  return chunk('GPL ', envelope(3, Buffer.concat([word(123456), manager, word(400)])), 1);
}
function save(body, padding = 0) {
  return Buffer.concat([chunk('VERS', Buffer.alloc(256), 1), chunk('MTER', Buffer.alloc(padding, 0xff)), body]);
}
function source(data) {
  const requests = [];
  let inFlight = 0, peak = 0;
  return {size: data.length, requests, get peak() {return peak;}, async readAt(offset, length) {
    requests.push({offset, length}); peak = Math.max(peak, ++inFlight);
    await Promise.resolve(); --inFlight;
    return data.subarray(offset, offset + length);
  }};
}
async function collect(iterator) {return Array.fromAsync(iterator);}

test('native GPL agent spans preserve world-local IDs, names and opaque attribute ranges', async () => {
  const data = save(gpl([agent(1, {unitId: 0, name: 'root'}), agent(2, {name: 'Scout Å', deleted: 1})]));
  const records = await collect(checkpointAgents(source(data)));
  assert.deepEqual(records.map(r => [r.agentId, r.unitId, r.name, r.deleted, r.functionNameCount]),
    [[1, 0, 'root', false, 2], [2, 502, 'Scout Å', true, 2]]);
  for (const record of records) {
    assert.equal(data.readUInt32LE(record.offset), record.size);
    assert.equal(data.readUInt32LE(record.attributes.offset), record.attributes.size);
    assert.equal(record.attributes.declaredCount, 1);
    assert.equal(data.readUInt32LE(record.offset + record.size - 19), record.unitId);
  }
  assert.deepEqual(await collect(checkpointAgents(checkpointFile(new Blob([data])))), records);
});

test('GPL records and multibyte names crossing a page boundary keep distinct results', async () => {
  const base = save(gpl()).length;
  for (const padding of [4090 - 288, 4096 - base + 7]) {
    const input = source(save(gpl([agent(1, {name: 'Éowyn'}), agent(2, {name: 'second'})]), padding));
    const records = await collect(checkpointAgents(input));
    assert.deepEqual(records.map(r => r.name), ['Éowyn', 'second']);
    assert.equal(input.peak, 1);
    assert.ok(input.requests.every(r => r.length <= CHECKPOINT_PAGE_BYTES));
  }
});

test('large opaque script state and dormant terrain are skipped with bounded page I/O', async () => {
  const opaque = Buffer.concat([text('memo'), word(3), Buffer.alloc(1024 * 1024, 0x61), Buffer.from([0])]);
  const data = save(gpl([agent(1, {attributes: opaque}), agent(2)]), 1024 * 1024);
  const input = source(data), records = await collect(checkpointAgents(input));
  assert.equal(records.length, 2); assert.ok(records[0].attributes.size > 1024 * 1024);
  assert.equal(input.peak, 1);
  assert.ok(input.requests.reduce((sum, r) => sum + r.length, 0) < 64 * 1024);
  assert.ok(input.requests.every(r => r.offset % CHECKPOINT_PAGE_BYTES === 0 && r.length <= CHECKPOINT_PAGE_BYTES));
});

test('many agent records retain only iterator state and read sequential pages', async () => {
  const input = source(save(gpl(Array.from({length: 1000}, (_, i) => agent(i + 1))), 1024 * 1024));
  let count = 0;
  for await (const record of checkpointAgents(input)) assert.equal(record.agentId, ++count);
  assert.equal(count, 1000); assert.equal(input.peak, 1);
  assert.ok(input.requests.reduce((sum, r) => sum + r.length, 0) < 256 * 1024);
});

test('bad envelopes, duplicate IDs, wrong versions, truncated names and invalid tails are rejected', async () => {
  const valid = save(gpl()), badMarker = Buffer.from(valid);
  badMarker.writeUInt32LE(0, badMarker.length - 4);
  const badVersion = Buffer.from(valid); badVersion.writeUInt32LE(9, 288 + 16 + 4);
  const tooShort = Buffer.from(valid); tooShort.writeUInt32LE(8, 288 + 16);
  const inconsistentKey = save(gpl([agent(1)]));
  // Known source-level fixture position: runtime header/tick + manager header,
  // one definition entry + count + the map key. Change only that map key.
  inconsistentKey.writeUInt32LE(2, 288 + 16 + 12 + 8 + 4 + 5 + 4 + 4);
  for (const data of [badMarker, badVersion, tooShort, inconsistentKey,
    save(gpl([agent(2), agent(2)])), save(gpl([agent(2), agent(1)])),
    save(gpl([agent(1, {name: 'x'.repeat(MAX_GPL_NAME_BYTES)})])),
    save(gpl([agent(1, {deleted: 2})])), save(gpl([], {definitions: MAX_UNIT_RECORDS + 1})),
    save(gpl([], {tail: Buffer.concat([word(MAX_UNIT_RECORDS + 1), word(0), Buffer.from([0])])})),
    save(gpl([], {tail: Buffer.concat([word(0), word(0), Buffer.from([2])])})),
    save(Buffer.concat([gpl(), gpl()])), save(Buffer.alloc(0))]) {
    await assert.rejects(collect(checkpointAgents(source(data))));
  }
});

test('a late malformed manager queue still invalidates previously yielded agent metadata', async () => {
  const input = source(save(gpl([agent(1)], {tail: Buffer.concat([word(2), word(1), word(0), Buffer.from([0])])})));
  const iterator = checkpointAgents(input);
  assert.equal((await iterator.next()).value.agentId, 1);
  await assert.rejects(iterator.next(), /queue|tail|Truncated/);
});

function nativeUnit(id, agentId, block = false, attributes) {
  const head = Buffer.alloc(60); head.writeUInt32LE(1); head.writeUInt32LE(id, 4);
  head.writeUInt32LE(512, 8); head.writeUInt32LE(0x12345678, 16);
  head.writeUInt32LE(Number(block), 48); head.writeUInt32LE(7, 52);
  const map = attributes ?? Buffer.concat([word(0x4541), word(agentId), word(0x5058), word(123)]);
  const primary = chunk('PRIM', Buffer.concat([head,
    ...(block ? [word(1), word(0), word(17), word(23)] : []), word(1), word(map.length / 8), map,
    Buffer.alloc(8)]), 9);
  return chunk('UNIT', primary, 0, 1);
}
function nativeSave(units) {
  const families = ['BLDG', 'VHCL', 'GRND', 'RWRD', 'MSGF', 'OFMP'];
  return save(Buffer.concat(families.map(tag => chunk(tag, tag === 'VHCL' ? Buffer.concat(units) : undefined,
    0, tag === 'VHCL' ? units.length : 0))));
}

test('native EA links map native unit IDs to script IDs with and without optional state', async () => {
  const records = await collect(checkpointUnitAgentLinks(source(nativeSave([
    nativeUnit(506, 9, true), nativeUnit(508, 10), nativeUnit(509, 0)]))));
  assert.deepEqual(records.map(r => [r.unitId, r.agentId, r.family]), [[506, 9, 'VHCL'], [508, 10, 'VHCL'], [509, 0, 'VHCL']]);
});

test('the optional-state flag precedes Unit+78 even when that following word is nonzero', async () => {
  // Numeric header observed in an owned original Brashnard checkpoint. Its
  // flag word at +48 is zero while the following saved word at +52 is one.
  const head = Buffer.concat([1, 2078, 512, 0, 827676226, 7, 0, 8945664, 11599872,
    107139, 273, 354, 0, 1, 4].map(word));
  const data = nativeSave([chunk('UNIT', chunk('PRIM', Buffer.concat([head,
    word(1), word(1), word(0x4541), word(17), Buffer.alloc(8)]), 9), 0, 1)]);
  assert.equal((await collect(checkpointUnitAgentLinks(source(data))))[0].agentId, 17);
});

test('EA decoding rejects truncated or duplicate/unordered maps and unsupported optional state', async () => {
  const duplicate = nativeSave([nativeUnit(506, 9, false, Buffer.concat([word(0x4541), word(9), word(0x4541), word(10)]))]);
  const unordered = nativeSave([nativeUnit(506, 9, false, Buffer.concat([word(0x5058), word(9), word(0x4541), word(10)]))]);
  const badBlock = nativeSave([nativeUnit(506, 9, true)]); badBlock.writeUInt32LE(9, 288 + 16 + 16 + 16 + 16 + 60);
  const missingMap = nativeSave([chunk('UNIT', chunk('PRIM', Buffer.alloc(60), 9), 0, 1)]);
  for (const data of [duplicate, unordered, badBlock, missingMap])
    await assert.rejects(collect(checkpointUnitAgentLinks(source(data))));
});

test('actor selection validates the bidirectional native/script association before returning saved ranges', async () => {
  const data = save(Buffer.concat([gpl([agent(9, {unitId: 506})]), nativeSave([nativeUnit(506, 9, true)]).subarray(288)]));
  const selected = await checkpointActorRecords(source(data), 506);
  assert.equal(selected.unit.unitId, selected.agent.unitId);
  assert.equal(selected.unit.agentId, selected.agent.agentId);
  assert.equal(data.toString('ascii', selected.unit.offset, selected.unit.offset + 4), 'UNIT');
  assert.equal(data.readUInt32LE(selected.agent.offset), selected.agent.size);
});

test('actor selection rejects invalid IDs, missing/mismatched/deleted agents and late malformed state', async () => {
  const cases = [
    [gpl([agent(10, {unitId: 506})]), [nativeUnit(506, 9)]],
    [gpl([agent(9, {unitId: 507})]), [nativeUnit(506, 9)]],
    [gpl([agent(9, {unitId: 506, deleted: 1})]), [nativeUnit(506, 9)]],
    [gpl([agent(9, {unitId: 506})]), [nativeUnit(506, 0)]],
    [gpl([agent(9, {unitId: 506})]), [nativeUnit(506, 9), nativeUnit(506, 9)]],
    [gpl([agent(9, {unitId: 506})], {tail: Buffer.concat([word(2), word(9), word(0), Buffer.from([0])])}), [nativeUnit(506, 9)]],
  ];
  for (const [script, units] of cases) await assert.rejects(checkpointActorRecords(
    source(save(Buffer.concat([script, nativeSave(units).subarray(288)]))), 506));
  for (const id of [0, -1, 0x100000000, 1.5, '506']) await assert.rejects(checkpointActorRecords(source(save(gpl())), id));
});

test('script queue inspection preserves both queue orders and the active selector with bounded reads', async () => {
  const tail = Buffer.concat([word(2), word(2), word(1), word(1), word(2), Buffer.from([1])]);
  const input = source(save(gpl(undefined, {tail}), 3700)), records = [];
  for await (const record of checkpointAgentQueues(input)) records.push(record);
  assert.deepEqual(records.filter(r => r.type === 'queued-agent').map(r => [r.queue, r.index, r.agentId]),
    [[0, 0, 2], [0, 1, 1], [1, 0, 2]]);
  assert.equal(records.at(-1).activeQueue, 1);
  assert.ok(input.requests.every(r => r.length <= CHECKPOINT_PAGE_BYTES));
  assert.equal(input.peak, 1);
});

test('script queue inspection rejects invalid IDs while ordinary agent metadata remains opaque about queue values', async () => {
  for (const id of [0, 0x80000000, 0xffffffff]) {
    const data = save(gpl(undefined, {tail: Buffer.concat([word(1), word(id), word(0), Buffer.from([0])])}));
    await assert.rejects(async () => {for await (const ignored of checkpointAgentQueues(source(data))) {}}, /queued agent/);
    const agents = []; for await (const agent of checkpointAgents(source(data))) agents.push(agent);
    assert.equal(agents.length, 2);
  }
});

test('a late invalid queue selector rejects inspection after earlier queue entries were yielded', async () => {
  const data = save(gpl(undefined, {tail: Buffer.concat([word(1), word(2), word(0), Buffer.from([2])])}));
  const iterator = checkpointAgentQueues(source(data));
  assert.equal((await iterator.next()).value.agentId, 2);
  await assert.rejects(iterator.next(), /tail/);
});
