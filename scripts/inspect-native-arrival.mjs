#!/usr/bin/env node
// Prepare bounded, read-only arrival records from stopped owned checkpoints.
import {open, readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MAX_CHECKPOINT_BYTES} from '../web/world/checkpoint.mjs';
import {prepareCheckpointActorArrival} from '../web/world/arrival.mjs';

const [sourcePath, destinationPath, optionsPath, ...extra] = process.argv.slice(2);
if (!sourcePath || !destinationPath || !optionsPath || extra.length)
  throw new Error('Usage: node scripts/inspect-native-arrival.mjs <source GMP> <destination GMP> <options JSON>');
const options = JSON.parse(await readFile(optionsPath, 'utf8'));
const handles = [];
try {
  const sources = [];
  for (const filename of [sourcePath, destinationPath]) {
    const handle = await open(filename, 'r'); handles.push(handle);
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_CHECKPOINT_BYTES) throw new Error('Invalid owned checkpoint');
    const io = {reads: 0, readBytes: 0, largestRead: 0};
    const source = {size: stat.size, async readAt(offset, length) {
      if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 ||
          length < 0 || length > 4096 || offset + length > stat.size) throw new Error('Unbounded checkpoint read');
      const bytes = new Uint8Array(length), result = await handle.read(bytes, 0, length, offset);
      ++io.reads; io.readBytes += result.bytesRead; io.largestRead = Math.max(io.largestRead, length);
      return bytes.subarray(0, result.bytesRead);
    }};
    const hash = createHash('sha256');
    for (let at = 0; at < source.size; at += 4096) hash.update(await source.readAt(at, Math.min(4096, source.size - at)));
    sources.push({handle, stat, source, io, sha256: hash.digest('hex')});
  }
  const {plan, records} = await prepareCheckpointActorArrival(sources[0].source, sources[1].source, options);
  for (const {handle, stat} of sources) {
    const after = await handle.stat();
    if (stat.size !== after.size || stat.mtimeMs !== after.mtimeMs || stat.ctimeMs !== after.ctimeMs)
      throw new Error('Checkpoint changed; inspect stopped immutable saves');
  }
  console.log(JSON.stringify({source: {sha256: sources[0].sha256, bytes: sources[0].stat.size, ...sources[0].io},
    destination: {sha256: sources[1].sha256, bytes: sources[1].stat.size, ...sources[1].io}, plan,
    records: Object.fromEntries(Object.entries(records).map(([name, data]) => [name,
      {bytes: data.length, sha256: createHash('sha256').update(data).digest('hex')}])),
    limitations: 'Read-only preparation; supplied clock snapshots are caller inputs, not derived from saves. '
      + 'Destination IDs are checked proposals, not engine reservations. No native allocation, function resolution, '
      + 'container insertion, actual hero travel, source removal or transactional regional commit.'}, null, 2));
} finally {for (const handle of handles) await handle.close();}
