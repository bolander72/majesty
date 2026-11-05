#!/usr/bin/env node
// Read-only counts for a hash-bound original GMP used in owned performance trials.
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {checkpointUnits, checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';

const [input, expected, output] = process.argv.slice(2);
assert.ok(input && /^[a-f0-9]{64}$/.test(expected) && output,
  'Usage: inspect-performance-kingdom.mjs INPUT.GMP SHA256 OUTPUT.json');
const source = await stoppedFileSource(input);
const actual = createHash('sha256').update(await readFile(input)).digest('hex');
assert.equal(actual, expected, 'Preserve the bound input; do not benchmark a different save');
const rows = [];
for await (const unit of checkpointUnits(source)) {
  if (unit.primary.words[5] !== 0 || !['BLDG', 'VHCL'].includes(unit.family)) continue;
  const p = unit.components.find(part => part.tag === 'PRIM');
  assert.equal(p.version, 9);
  const word = async offset => {
    assert.ok(offset >= p.offset + 16 && offset + 4 <= p.end);
    return Buffer.from(await source.readAt(offset, 4)).readUInt32LE(0);
  };
  const optional = await word(p.offset + 64);
  assert.ok(optional <= 1);
  let at = p.offset + 76;
  if (optional) { assert.equal(await word(at), 1); at += 16; }
  assert.equal(await word(at), 1);
  const count = await word(at + 4);
  assert.ok(count <= 256 && at + 8 + count * 8 <= p.end);
  const attributes = new Map();
  let previous = -1;
  for (let i = 0; i < count; i++) {
    const key = await word(at + 8 + i * 8);
    assert.ok(key > previous); previous = key;
    attributes.set(key, await word(at + 12 + i * 8));
  }
  const names = {};
  let values = 0;
  const agent = attributes.get(0x4541);
  if (agent && attributes.get(0x00555041) > 0) for await (const value of checkpointAgentValues(source, agent)) {
    assert.ok(++values <= 2048);
    if (!value.path.length && ['title', 'type', 'subtype'].includes(value.attribute) && value.kind === 'string') {
      assert.ok(value.stringBytes <= 256);
      names[value.attribute] = Buffer.from(await source.readAt(value.offset, value.stringBytes)).toString();
    }
  }
  const resource = Buffer.alloc(4); resource.writeUInt32LE(unit.primary.description);
  rows.push({id: unit.primary.words[1], family: unit.family, resource: resource.toString(),
    hp: attributes.get(0x00555041), maxHp: attributes.get(0x01555041),
    completed: attributes.get(0x01425041), level: attributes.get(0x0b565041),
    agent, savedAiValues: values, ...names});
}
const living = rows.filter(row => row.hp > 0);
const buildings = living.filter(row => row.family === 'BLDG');
const heroes = living.filter(row => row.family === 'VHCL' && row.subtype?.toLowerCase() === 'hero');
const summary = {sha256: actual, buildings: buildings.length,
  completedBuildings: buildings.filter(row => row.completed === 1).length,
  fullHealthBuildings: buildings.filter(row => row.hp === row.maxHp).length,
  livingHeroes: heroes.length, heroesWithAi: heroes.filter(row => row.savedAiValues > 0).length,
  heroLevelRange: heroes.length ? [Math.min(...heroes.map(row => row.level)), Math.max(...heroes.map(row => row.level))] : [],
  resources: Object.fromEntries([...new Set(living.map(row => row.resource))].map(resource =>
    [resource, living.filter(row => row.resource === resource).length]))};
await writeFile(output, JSON.stringify({...summary, rows}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify(summary));
