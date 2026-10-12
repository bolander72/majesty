#!/usr/bin/env node
// Read saved associations without mutating a checkpoint or activating units.
import {open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {checkpointAttachments, checkpointContainerEntries, checkpointInventory, checkpointPlacements} from '../web/world/checkpoint.mjs';

const filename = process.argv[2];
if (!filename) throw new Error('Usage: node scripts/inspect-native-unit-references.mjs <owned native GMP>');
const handle = await open(filename, 'r');
try {
  const before = await handle.stat(), phases = {};
  let current;
  const source = {size: before.size, async readAt(offset, length) {
    const data = new Uint8Array(length);
    const {bytesRead} = await handle.read(data, 0, length, offset);
    ++current.readRequests; current.readBytes += bytesRead;
    current.largestRead = Math.max(current.largestRead, length);
    return data.subarray(0, bytesRead);
  }};
  for (const [name, iterator] of Object.entries({attachments: checkpointAttachments,
    containers: checkpointContainerEntries, inventory: checkpointInventory, placements: checkpointPlacements})) {
    const hash = createHash('sha256');
    current = {records: 0, kinds: {}, readRequests: 0, readBytes: 0, largestRead: 0, samples: []};
    for await (const record of iterator(source)) {
      ++current.records;
      const kind = record.kind ?? record.type ?? record.family ?? 'item';
      current.kinds[kind] = (current.kinds[kind] ?? 0) + 1;
      hash.update(JSON.stringify(record) + '\n');
      if (current.samples.length < 32) current.samples.push(record);
    }
    current.metadataSha256 = hash.digest('hex'); phases[name] = current;
  }
  const after = await handle.stat();
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs)
    throw new Error('Checkpoint changed during inspection; retry with the game stopped');
  console.log(JSON.stringify({fileBytes: before.size, phases,
    limitations: 'World-local saved IDs, ownership, raw placement and associations only. Parent-dependent positions are unresolved. Order targets and remaining GPL, navigation, '
      + 'kingdom and global data are opaque. No cross-region activation or stable portable identity.'}, null, 2));
} finally {await handle.close();}
