#!/usr/bin/env node
// A supplied origin transform between copied checkpoints is fixture geometry,
// not proof that their terrain/content belongs to one continuous world.
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {actorRegionCoordinates, actorRegionGridCells} from '../web/world/actor-coordinates.mjs';
const root = new URL('../', import.meta.url), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const prefix = process.argv[2] ?? 'native-actor-cross-placement-v2';
if (!/^[a-z][a-z0-9-]*$/.test(prefix) || process.argv.length > 3) throw Error('Use a fresh output basename');
const pack = await readFile(new URL('output/native-actor-cross-binding-fixtures.bin', root)),
  metadata = JSON.parse(await readFile(new URL('output/native-actor-cross-binding-fixtures.json', root), 'utf8'));
if (sha(pack) !== metadata.sha256 || pack.readUInt32LE(0) !== 0x3353414e || pack.readUInt32LE(4) !== 4)
  throw Error('Changed source fixture');
let at = 8;
const cases = [];
for (const expected of metadata.cases) {
  const id = pack.readUInt32LE(at), bytes = pack.readUInt32LE(at + 4),
    requests = pack.readUInt32LE(at + 8), payload = pack.readUInt32LE(at + 12);
  at += 28;
  if (id !== expected.unitId || bytes !== 375 || pack.readUInt32LE(at + 56)) throw Error('Unsupported source actor');
  const sourceFixed = {x: pack.readInt32LE(at + 60), y: pack.readInt32LE(at + 64), z: pack.readInt32LE(at + 68)};
  const source = {originX: 0, originY: 0, widthCells: 256, heightCells: 256};
  const destination = {originX: Math.floor(sourceFixed.x / (4096 * 2048)) * 4096,
    originY: Math.floor(sourceFixed.y / (4096 * 2048)) * 4096, widthCells: 128, heightCells: 128};
  const projected = actorRegionCoordinates(sourceFixed, source, destination);
  const sourceCells = {x: pack.readInt32LE(at + 72), y: pack.readInt32LE(at + 76)};
  projected.cells = actorRegionGridCells(sourceCells, source, destination);
  cases.push({id, sourceFixed, sourceCells, source, destination, projected});
  at += bytes + requests * 20 + payload + 4 + 3 * 32 + 4 + 2 * 20;
}
const output = Buffer.alloc(12 + cases.length * 60);
output.writeUInt32LE(0x3150414e, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(cases.length, 8);
for (const [index, c] of cases.entries()) {
  const p = c.projected;
  const words = [c.id, c.sourceFixed.x, c.sourceFixed.y, c.sourceFixed.z, p.fixed.x, p.fixed.y,
    p.fixed.z, p.deltaWorld.x, p.deltaWorld.y, p.grid.x, p.grid.y,
    c.sourceCells.x, c.sourceCells.y, p.cells.x, p.cells.y];
  for (const [word, value] of words.entries()) output.writeInt32LE(value, 12 + index * 60 + word * 4);
}
await writeFile(new URL(`output/${prefix}.bin`, root), output, {flag: 'wx'});
await writeFile(new URL(`output/${prefix}.json`, root), JSON.stringify({format: 'NAP1', version: 2,
  sourcePackSha256: metadata.sha256, sha256: sha(output), bytes: output.length, cases,
  scope: 'Explicit fixture origin transforms only; preserve source Z, no terrain alignment, collision admission or activation proved'}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({cases: cases.length, bytes: output.length, grids: cases.map(c => c.projected.grid)}));
