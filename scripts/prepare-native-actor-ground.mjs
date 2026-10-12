#!/usr/bin/env node
// Read-only four-vertex samples from pinned copied checkpoints.
import {readFile, writeFile, open, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {nativeHeightQ16} from '../web/world/native-height.mjs';
import {nativeGroundHeightQ16, sampleNativeGroundHeight} from '../web/world/terrain-ground.mjs';
const root = new URL('../', import.meta.url), sha = b => createHash('sha256').update(b).digest('hex');
const prefix = process.argv[2] ?? 'native-actor-ground-fixtures';
if (!/^[a-z][a-z0-9-]*$/.test(prefix) || process.argv.length > 3) throw Error('Use a fresh output basename');
const binding = JSON.parse(await readFile(new URL('output/native-actor-cross-binding-fixtures.json', root), 'utf8'));
const placementBytes = await readFile(new URL('output/native-actor-cross-placement-v2.json', root));
const placement = JSON.parse(placementBytes);
if (placement.sourcePackSha256 !== binding.sha256 || placement.cases.length !== 4) throw Error('Changed placement source');
let largestRead = 0;
async function sampleFile(relative, pin, destination) {
  const path = new URL(relative, root), before = await stat(path), handle = await open(path, 'r');
  try {
    const source = {size: before.size, async readAt(at, count) {
      if (count > 4096) throw Error('Ground sample read budget');
      largestRead = Math.max(largestRead, count);
      const bytes = new Uint8Array(count), {bytesRead} = await handle.read(bytes, 0, count, at);
      if (bytesRead !== count) throw Error('Truncated ground source'); return bytes;
    }};
    const hash = createHash('sha256');
    for (let at = 0; at < before.size; at += 4096) hash.update(await source.readAt(at, Math.min(4096, before.size - at)));
    if (hash.digest('hex') !== pin) throw Error('Changed copied terrain checkpoint');
    const terrain = await checkpointTerrain(source), samples = [];
    for (const c of placement.cases) {
      const position = destination ? c.projected.fixed : c.sourceFixed;
      const x = Math.floor(position.x / 65536), y = Math.floor(position.y / 65536);
      const window = await terrain.window(x, y, 1, 1), view = new DataView(window.vertices.buffer, window.vertices.byteOffset, window.vertices.length);
      const bits = [0, 9, 18, 27].map(at => view.getUint32(at, true)), heights = bits.map(nativeHeightQ16);
      const ground = nativeGroundHeightQ16({xQ16: position.x, yQ16: position.y, heights});
      if (await sampleNativeGroundHeight(terrain, position) !== ground) throw Error('Sampler disagrees');
      samples.push({id: c.id, position, cell: {x, y}, heightBits: bits, heights, groundQ16: ground});
    }
    const after = await stat(path);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw Error('Source changed during read');
    return {path: relative, sha256: pin, width: terrain.width, height: terrain.height, samples, unchanged: true};
  } finally {await handle.close();}
}
const source = await sampleFile(binding.source, binding.sourceSha256, false);
const destination = await sampleFile(binding.destination, binding.destinationSha256, true);
const cases = source.samples.map((s, i) => ({id: s.id, source: s, destination: destination.samples[i], sourceOffsetQ16: s.position.z - s.groundQ16}));
const binary = Buffer.alloc(12 + cases.length * 24);
binary.writeUInt32LE(0x3148474e, 0); binary.writeUInt32LE(1, 4); binary.writeUInt32LE(cases.length, 8);
cases.forEach((c, i) => [c.id, c.destination.position.x, c.destination.position.y, c.source.position.z, c.source.groundQ16, c.destination.groundQ16]
  .forEach((n, j) => binary.writeInt32LE(n, 12 + i * 24 + j * 4)));
await writeFile(new URL(`output/${prefix}.bin`, root), binary, {flag: 'wx'});
await writeFile(new URL(`output/${prefix}.json`, root), JSON.stringify({format: 'NGH1', version: 1, bytes: binary.length, sha256: sha(binary),
  placementMetadataSha256: sha(placementBytes), source, destination, cases, largestRead,
  sourceSha256: Object.fromEntries(await Promise.all(['web/world/terrain-ground.mjs', 'scripts/prepare-native-actor-ground.mjs']
    .map(async path => [path, sha(await readFile(new URL(path, root)))]))),
  scope: 'Read-only copied terrain heights; original CPU/native comparisons required. No actor position editing or activation.'}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({cases: cases.length, bytes: binary.length, largestRead, sourceOffsets: cases.map(c => c.sourceOffsetQ16), destinationGround: cases.map(c => c.destination.groundQ16)}));
