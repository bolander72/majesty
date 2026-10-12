import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointChunks, checkpointUnits, checkpointFile,
  CHECKPOINT_PAGE_BYTES, MAX_CHECKPOINT_BYTES, MAX_UNIT_RECORDS} from '../web/world/checkpoint.mjs';

const families = ['BLDG', 'VHCL', 'GRND', 'RWRD', 'MSGF', 'OFMP'];
function chunk(tag, payload = Buffer.alloc(0), version = 0, count = 0) {
  const header = Buffer.alloc(16);
  header.write(tag); header.writeUInt32LE(payload.length, 4);
  header.writeUInt32LE(version, 8); header.writeUInt32LE(count, 12);
  return Buffer.concat([header, payload]);
}
function actor(description, secondary = false) {
  const raw = Buffer.alloc(36);
  [2, 497, 512, 0, description, 17, 19].forEach((value, index) => raw.writeUInt32LE(value, index * 4));
  return chunk('UNIT', Buffer.concat([chunk('PRIM', raw, 9),
    ...(secondary ? [chunk('SECD', Buffer.from([1]), 1)] : [])]), 0, secondary ? 2 : 1);
}
function save({actors = [actor(829178433, true), actor(827610690)], prefix, groups} = {}) {
  return Buffer.concat([chunk('VERS', Buffer.alloc(256), 1),
    // Terrain data has a record count but must not be treated as child chunks.
    prefix ?? chunk('MTER', chunk('PRIM', Buffer.alloc(128, 0xff), 7, 16641), 0, 1),
    ...(groups ?? families.map(tag => chunk(tag, tag === 'GRND' ? Buffer.concat(actors) : undefined,
      0, tag === 'GRND' ? actors.length : 0)))]);
}
function source(data) {
  const requests = [];
  let inFlight = 0, peakInFlight = 0;
  return {size: data.length, requests, get peakInFlight() {return peakInFlight;}, async readAt(offset, length) {
    requests.push({offset, length}); ++inFlight; peakInFlight = Math.max(peakInFlight, inFlight);
    await Promise.resolve(); --inFlight;
    return data.subarray(offset, offset + length);
  }};
}
async function collect(iterator) { const values = []; for await (const value of iterator) values.push(value); return values; }

test('unit metadata preserves saved ranges, opaque words and descriptions while skipping terrain records', async () => {
  const data = save(), input = source(data);
  const roots = await collect(checkpointChunks(input));
  assert.deepEqual(roots.map(root => root.tag), ['VERS', 'MTER', ...families]);
  const units = await collect(checkpointUnits(input));
  assert.deepEqual(units.map(unit => unit.primary.description), [829178433, 827610690]);
  assert.deepEqual(units[0].primary.words, [2, 497, 512, 0, 829178433, 17, 19]);
  assert.deepEqual(units[0].components.map(part => part.tag), ['PRIM', 'SECD']);
  assert.equal(units[1].ordinal, 1);
  for (const unit of units) {
    assert.equal(data.toString('ascii', unit.offset, unit.offset + 4), 'UNIT');
    assert.equal(unit.size, data.readUInt32LE(unit.offset + 4) + 16);
  }
});

test('headers and primary fields crossing page boundaries are read without aliasing cached data', async () => {
  for (const firstUnitAt of [4090, 4056]) {
    // VERS + opaque padding + two empty family groups + GRND header.
    const prefixSize = firstUnitAt - 272 - 16 - 32 - 16;
    const input = source(save({prefix: chunk('MTER', Buffer.alloc(prefixSize)),
      actors: Array.from({length: 80}, (_, i) => actor(1000 + i, i === 0))}));
    const units = await collect(checkpointUnits(input));
    assert.equal(units[0].offset, firstUnitAt);
    assert.deepEqual(units.map(unit => unit.primary.description), Array.from({length: 80}, (_, i) => 1000 + i));
    assert.ok(input.requests.length >= 3);
  }
});

test('many unit records use sequential bounded page reads and do not read an entire dormant terrain payload', async () => {
  const data = save({prefix: chunk('MTER', Buffer.alloc(1024 * 1024, 0xff), 0, 16641),
    actors: Array.from({length: 1000}, (_, i) => actor(10000 + i))});
  const input = source(data);
  let count = 0;
  for await (const unit of checkpointUnits(input)) {
    assert.equal(unit.primary.description, 10000 + count++);
  }
  assert.equal(count, 1000); assert.equal(input.peakInFlight, 1);
  assert.ok(input.requests.length < 25);
  assert.ok(input.requests.every(read => read.length <= CHECKPOINT_PAGE_BYTES && read.offset % CHECKPOINT_PAGE_BYTES === 0));
  assert.ok(input.requests.reduce((sum, read) => sum + read.length, 0) < 80 * 1024);
});

test('standard Blob slicing returns the same metadata as a random-access file source', async () => {
  const data = save();
  assert.deepEqual(await collect(checkpointUnits(checkpointFile(new Blob([data])))),
    await collect(checkpointUnits(source(data))));
});

test('invalid sizes and oversized files are rejected before any I/O', async () => {
  for (const size of [undefined, NaN, -1, 0, 15, 16.5, MAX_CHECKPOINT_BYTES + 1, Number.MAX_SAFE_INTEGER]) {
    const input = {size, readAt() {assert.fail('must validate before I/O');}};
    await assert.rejects(collect(checkpointUnits(input)), /out of bounds/);
    await assert.rejects(collect(checkpointChunks(input)), /out of bounds/);
  }
});

test('short physical reads and truncated chunk boundaries are rejected', async () => {
  const data = save();
  const short = {size: data.length, async readAt(offset, length) {return data.subarray(offset, offset + length - 1);}};
  await assert.rejects(collect(checkpointUnits(short)), /Truncated/);
  await assert.rejects(collect(checkpointUnits(source(data.subarray(0, data.length - 1)))), /Truncated/);
  const oversizedChunk = Buffer.from(data); oversizedChunk.writeUInt32LE(data.length, 4);
  await assert.rejects(collect(checkpointUnits(source(oversizedChunk))), /boundary/);
  const trailing = Buffer.concat([data, Buffer.from([1])]);
  await assert.rejects(collect(checkpointUnits(source(trailing))), /Truncated native chunk header/);
});

test('unsupported save and unit versions are rejected', async () => {
  const badSave = save(); badSave.writeUInt32LE(2, 8);
  await assert.rejects(collect(checkpointUnits(source(badSave))), /Unsupported native checkpoint/);
  const badUnit = actor(1); badUnit.writeUInt32LE(1, 8);
  await assert.rejects(collect(checkpointUnits(source(save({actors: [badUnit]})))), /Unsupported native unit/);
  const badPrimary = actor(1); badPrimary.writeUInt32LE(10, 16 + 8);
  await assert.rejects(collect(checkpointUnits(source(save({actors: [badPrimary]})))), /Unsupported native primary/);
});

test('missing, duplicate and incorrectly counted family groups cannot complete inspection', async () => {
  const empty = families.map(tag => chunk(tag));
  for (const groups of [empty.slice(1), [...empty, chunk('BLDG')],
    empty.map(part => part.subarray(0, 4).toString() === 'GRND' ? chunk('GRND', actor(1), 0, 0) : part),
    empty.map(part => part.subarray(0, 4).toString() === 'GRND' ? chunk('GRND', actor(1), 0, 2) : part)]) {
    await assert.rejects(collect(checkpointUnits(source(save({groups})))), /Incomplete native unit groups|Invalid native unit group|count does not match|Truncated/);
  }
});

test('missing or duplicated primary state and invalid component counts cannot complete inspection', async () => {
  const primary = actor(1).subarray(16);
  for (const badUnit of [chunk('UNIT', chunk('SECD', Buffer.from([1]), 1), 0, 1),
    chunk('UNIT', Buffer.concat([primary, primary]), 0, 2),
    chunk('UNIT', primary, 0, 0), chunk('UNIT', primary, 0, 9),
    chunk('UNIT', Buffer.concat([primary, Buffer.from([0])]), 0, 1)]) {
    await assert.rejects(collect(checkpointUnits(source(save({actors: [badUnit]})))), /Incomplete native unit|Duplicate native unit|Unsupported native unit/);
  }
});

test('unit-count and root-count limits reject excessive metadata', async () => {
  const tooMany = families.map(tag => chunk(tag, undefined, 0, tag === 'GRND' ? MAX_UNIT_RECORDS + 1 : 0));
  await assert.rejects(collect(checkpointUnits(source(save({groups: tooMany})))), /Invalid native unit group/);
  const roots = Buffer.concat([chunk('VERS', Buffer.alloc(256), 1),
    ...Array.from({length: 128}, () => chunk('JUNK'))]);
  await assert.rejects(collect(checkpointChunks(source(roots))), /Too many native root chunks/);
});
