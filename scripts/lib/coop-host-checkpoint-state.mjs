// Read-only comparison of a host checkpoint and its original guest reload.
// Keep strict save equality separate: these audited fields belong to the local
// view/display names. Every other byte remains subject to the existing checks.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {checkpointChunks, checkpointUnits} from '../../web/world/checkpoint.mjs';
import {stoppedFileSource} from './stopped-entity-io.mjs';
import {compareConnectedWorlds} from './connected-residency.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const paneWords = [0, 4, 8, 12], selectionWords = [20, 24];
async function bytesAt(source, at, length) {
  assert.ok(length <= 2 * 1024 * 1024);
  const bytes = Buffer.alloc(length);
  for (let n = 0; n < length; n += 4096)
    bytes.set(await source.readAt(at + n, Math.min(4096, length - n)), n);
  return bytes;
}

// SVGD v10: original00436c00 emits name count at post-description+32,
// then004e6540 emits ANSI NUL or FF FE/UTF16LE NUL strings. The entire
// suffix (scenario configuration and eight flags included) stays opaque/exact.
export function checkpointDisplayNames(bytes) {
  const first = bytes.indexOf(0), second = bytes.indexOf(0, first + 1);
  assert.ok(first > 0 && first < 128 && second > first + 1 && second - first < 128);
  const start = second + 1;
  assert.ok(start + 36 <= bytes.length);
  assert.equal(bytes.readUInt32LE(start + 32), 2, 'Require the two saved party display names');
  let at = start + 36;
  const names = [];
  for (let i = 0; i < 2; ++i) {
    const begin = at;
    const wide = bytes[at] === 0xff && bytes[at + 1] === 0xfe;
    if (wide) at += 2;
    let count = 0;
    for (;;) {
      assert.ok(at + (wide ? 2 : 1) <= bytes.length && count <= 128, 'Truncated/oversized saved name');
      const word = wide ? bytes.readUInt16LE(at) : bytes[at];
      at += wide ? 2 : 1;
      if (!word) break;
      assert.ok(word >= 32 && word !== 127 && word !== 0xffff, 'Invalid saved name');
      ++count;
    }
    assert.ok(count > 0, 'Empty saved party name');
    names.push({bytes:at - begin, sha256:sha(bytes.subarray(begin, at))});
  }
  return {names, namesEnd:at,
    // Same label/calendar exclusions as connectedWorldState. Retain count,
    // clock, RNG, description, remaining metadata and configuration exactly.
    semantic:Buffer.concat([bytes.subarray(first + 1, start + 4),
      bytes.subarray(start + 20, start + 36), bytes.subarray(at)])};
}

async function compareLocalKingdomGameplay(before, after, palaceDescription) {
  const states = [structuredClone(before), structuredClone(after)];
  const views = [], names = [];
  for (let side = 0; side < 2; ++side) {
    const state = states[side], source = await stoppedFileSource(state.filename);
    assert.equal(source.size, state.bytes);
    assert.equal(sha(await bytesAt(source, 0, source.size)), state.sha256, 'Stopped world changed after parsing');
    const units = [];
    for await (const unit of checkpointUnits(source)) units.push(unit);
    const selected = units.filter(unit => unit.primary.words[2] & 1);
    assert.equal(selected.length, 1, 'Shared reload must have one selected palace');
    const palace = selected[0], expectedSlot = side;
    assert.equal(palace.family, 'BLDG');
    assert.equal(palace.primary.description, palaceDescription, 'Require the independently typed original palace level');
    assert.equal(palace.primary.words[5], expectedSlot, 'Selected palace belongs to the wrong kingdom');
    const selectionOffsets = [];
    for (const unit of units) {
      const primary = unit.components.find(c => c.tag === 'PRIM');
      const flagAt = primary.offset + 16 + 8;
      if (unit.primary.words[2] & 1) {
        selectionOffsets.push(flagAt);
        const record = await bytesAt(source, unit.offset, unit.size);
        record[flagAt - unit.offset] &= 0xfe;
        state.records.units[unit.primary.words[1]] = {bytes:unit.size, sha256:sha(record)};
      }
    }
    let metadata = 0, globals = 0;
    let rootIndex = 0;
    for await (const chunk of checkpointChunks(source)) {
      const root = state.roots[rootIndex++];
      assert.deepEqual([root.tag, root.version, root.count], [chunk.tag, chunk.version, chunk.count]);
      if (chunk.tag === 'BLDG') {
        const bytes = await bytesAt(source, chunk.offset + 16, chunk.size);
        for (const offset of selectionOffsets) {
          assert.ok(offset >= chunk.offset + 16 && offset < chunk.end);
          bytes[offset - chunk.offset - 16] &= 0xfe;
        }
        root.sha256 = sha(bytes);
      } else if (chunk.tag === 'GSGL') {
        assert.deepEqual([chunk.version, chunk.count], [6, 0]);
        assert.ok(chunk.size >= 76 && chunk.size <= 65536);
        const bytes = await bytesAt(source, chunk.offset + 16, chunk.size);
        assert.equal(bytes.readUInt32LE(20), palace.primary.words[1], 'UI selected ID differs from palace selection');
        assert.ok([0, palace.primary.words[1]].includes(bytes.readUInt32LE(24)), 'Unexpected original UI cached selection');
        const fields = [...paneWords, ...selectionWords].map(offset => ({offset, value:bytes.readUInt32LE(offset)}));
        for (const offset of paneWords) assert.ok(bytes.readUInt32LE(offset) <= 8192, 'Unsupported original pane position');
        for (const {offset} of fields) bytes.writeUInt32LE(0, offset);
        root.sha256 = sha(bytes);
        views.push({selectedPalace:palace.primary.words[1], kingdomSlot:expectedSlot, fields});
        ++globals;
      } else if (chunk.tag === 'SVGD') {
        assert.deepEqual([chunk.version, chunk.count], [10, 0]);
        assert.ok(chunk.size <= 1024);
        const parsed = checkpointDisplayNames(await bytesAt(source, chunk.offset + 16, chunk.size));
        root.sha256 = sha(parsed.semantic); root.bytes = parsed.semantic.length;
        names.push(parsed.names); ++metadata;
      }
    }
    assert.equal(rootIndex, state.roots.length);
    assert.equal(metadata, 1); assert.equal(globals, 1);
  }
  const comparison = compareConnectedWorlds(...states);
  return {gameplayStateMatches:true, correctLocalPalaceSelection:true,
    localViewDifferences:views,
    savedPlayerDisplayNamesMatch:JSON.stringify(names[0]) === JSON.stringify(names[1]),
    savedPlayerDisplayNameDigests:names,
    ...comparison,
    scope:'Stopped host-to-guest original checkpoint component only; exact gameplay bytes with audited local selection/pane fields and saved display names reported separately. Strict save equality is unchanged. No shared resume or paired simulation.'};
}


export async function compareHostCheckpointGameplay(before, after) {
  return compareLocalKingdomGameplay(before, after, 0x314a4241);
}

// Generated targets have independent starting settlements. Only the same
// original ABJ palace level on both sides can use the audited local-view mask.
export async function compareGeneratedKingdomGameplay(before, after, level) {
  assert.ok(Number.isInteger(level) && level >= 1 && level <= 3);
  assert.equal(before.clock, 0); assert.equal(after.clock, 0);
  assert.equal(before.rng, after.rng);
  assert.equal(before.gameplayRng, after.gameplayRng);
  return compareLocalKingdomGameplay(before, after, 0x304a4241 + level * 0x1000000);
}

// A full saved-reader result at a positive clock must preserve every advisor
// record byte. This uses only the existing audited local selection/pane/name
// differences; it deliberately adds no notification-clock normalization.
export async function compareLoadedKingdomGameplay(before, after, level) {
  assert.ok(Number.isInteger(level) && level >= 1 && level <= 3);
  assert.ok(Number.isInteger(before.clock) && before.clock >= 0 && before.clock <= 0xffffffff);
  assert.equal(after.clock, before.clock);
  assert.equal(after.rng, before.rng);
  assert.equal(after.gameplayRng, before.gameplayRng);
  return compareLocalKingdomGameplay(before, after, 0x304a4241 + level * 0x1000000);
}
