#!/usr/bin/env node
// Read-only saved in-flight Move points, pinned terrain and region transform.
import {readFile, open, stat, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {sampleNativeGroundHeight} from '../web/world/terrain-ground.mjs';
import {actorRegionCoordinates} from '../web/world/actor-coordinates.mjs';

const root = new URL('../', import.meta.url);
const prefix = process.argv[2] ?? 'native-inflight-move-preflight';
const stdout = prefix === '--stdout';
if ((!stdout && !/^[a-z][a-z0-9-]*$/.test(prefix)) || process.argv.length > 3) throw Error('Use a fresh output basename or --stdout');
const sha = b => createHash('sha256').update(b).digest('hex');
const binding = JSON.parse(await readFile(new URL('output/native-actor-cross-binding-fixtures.json', root)));
const placementBytes = await readFile(new URL('output/native-actor-cross-placement-v2.json', root));
const placement = JSON.parse(placementBytes);
if (placement.sourcePackSha256 !== binding.sha256 || placement.cases.length !== 4) throw Error('Changed placement provenance');
let largestRead = 0;
async function reader(relative, pin) {
  const path = new URL(relative, root), before = await stat(path), handle = await open(path, 'r');
  const source = {size: before.size, async readAt(at, count) {
    if (![at, count].every(Number.isSafeInteger) || at < 0 || count < 0 || count > 4096 || at + count > before.size)
      throw Error('Unbounded checkpoint read');
    largestRead = Math.max(largestRead, count);
    const bytes = new Uint8Array(count), {bytesRead} = await handle.read(bytes, 0, count, at);
    if (bytesRead !== count) throw Error('Truncated checkpoint');
    return bytes;
  }};
  try {
    const digest = createHash('sha256');
    for (let at = 0; at < before.size; at += 4096) digest.update(await source.readAt(at, Math.min(4096, before.size - at)));
    if (digest.digest('hex') !== pin) throw Error('Changed pinned checkpoint');
  } catch (e) {await handle.close(); throw e;}
  return {source, async close() {
    const after = await stat(path);
    await handle.close();
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs)
      throw Error('Checkpoint changed during inspection');
  }};
}
const src = await reader(binding.source, binding.sourceSha256);
let dst;
try {
  dst = await reader(binding.destination, binding.destinationSha256);
  const sourceTerrain = await checkpointTerrain(src.source), destinationTerrain = await checkpointTerrain(dst.source);
  const cases = [];
  for (const c of placement.cases) {
    let move, entries = 0;
    for await (const entry of checkpointActorOrderEntries(src.source, c.id)) {
      if (entry.type !== 'entry') continue;
      ++entries;
      if (entry.kind !== 2) continue;
      if (move || entry.bank !== 0 || entry.index !== 0 || entry.words[25] !== 0 || entry.size !== 176)
        throw Error('Unsupported in-flight Move profile');
      move = entry;
    }
    if (!move || entries !== 3) throw Error('Missing or changed selected command graph');
    const point = {x: move.words[26] | 0, y: move.words[27] | 0, z: move.words[28] | 0};
    const projected = actorRegionCoordinates(point, c.source, c.destination);
    const sourceGround = await sampleNativeGroundHeight(sourceTerrain, point);
    const destinationGround = await sampleNativeGroundHeight(destinationTerrain, projected.fixed);
    const offset = point.z - sourceGround;
    cases.push({id: c.id, bank: move.bank, index: move.index, flags: move.words[24], targetId: move.words[25],
      sourcePoint: point, sourceGround, sourceHeightOffset: offset,
      sourceCell: c.sourceCells, goalCell: {x: point.x / 32768, y: point.y / 32768},
      projectedPoint: {...projected.fixed, z: destinationGround + offset}, destinationGround,
      actorDelta: {x: c.projected.fixed.x - c.sourceFixed.x, y: c.projected.fixed.y - c.sourceFixed.y},
      remainingDelta: {x: point.x - c.sourceFixed.x, y: point.y - c.sourceFixed.y},
      savedPointOffset: move.offset + 104});
  }
  const report = {qualified: false, scope: 'Read-only in-flight Move coordinate/height evidence; original native setter, continuation and source-ground comparison remain unqualified',
    source: binding.source, sourceSha256: binding.sourceSha256, destination: binding.destination, destinationSha256: binding.destinationSha256,
    placementMetadataSha256: sha(placementBytes), largestRead, browserUsed: false, cases};
  if (stdout) console.log(JSON.stringify(report));
  else {
  await writeFile(new URL(`output/${prefix}.json`, root), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({cases: cases.length, largestRead, sourceHeightOffsets: cases.map(c => c.sourceHeightOffset),
    points: cases.map(c => ({id: c.id, goalCell: c.goalCell, sourceCell: c.sourceCell, projectedPoint: c.projectedPoint, remainingDelta: c.remainingDelta}))}));
  }
} finally {if (dst) await dst.close(); await src.close();}
