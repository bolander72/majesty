#!/usr/bin/env node
// Offline inspection only; no save mutation or activation of actor records.
import {open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {checkpointChunks, checkpointUnits} from '../web/world/checkpoint.mjs';

const filename = process.argv[2];
if (!filename) throw new Error('Usage: node scripts/inspect-native-checkpoint.mjs <owned native GMP>');
const handle = await open(filename, 'r');
try {
  const before = await handle.stat();
  let readBytes = 0, largestRead = 0, readRequests = 0;
  const source = {size: before.size, async readAt(offset, length) {
    const data = new Uint8Array(length);
    const {bytesRead} = await handle.read(data, 0, length, offset);
    ++readRequests; readBytes += bytesRead; largestRead = Math.max(largestRead, length);
    return data.subarray(0, bytesRead);
  }};
  const chunks = [];
  for await (const chunk of checkpointChunks(source)) chunks.push(chunk);
  const families = {}, samples = [];
  const metadataHash = createHash('sha256');
  let units = 0;
  for await (const record of checkpointUnits(source)) {
    ++units; families[record.family] = (families[record.family] || 0) + 1;
    metadataHash.update(JSON.stringify(record) + '\n');
    if (samples.length < 32) samples.push(record);
  }
  const after = await handle.stat();
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs)
    throw new Error('Checkpoint changed during inspection; retry with the game stopped');
  console.log(JSON.stringify({fileBytes: before.size, readBytes, largestRead, readRequests,
    units, families, chunks, samples, retainedSamples: samples.length, metadataSha256: metadataHash.digest('hex'),
    limitations: 'Opaque unit words and saved ranges; no stable actor identity, reference remapping or cross-region activation.'}, null, 2));
} finally { await handle.close(); }
