#!/usr/bin/env node
// Read-only association and range qualification; no script activation/export.
import {open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {checkpointAgents, checkpointUnitAgentLinks, checkpointActorRecords} from '../web/world/checkpoint.mjs';

const filename = process.argv[2], requested = process.argv[3];
if (!filename || (requested !== undefined && !/^[1-9][0-9]*$/.test(requested)))
  throw new Error('Usage: node scripts/inspect-native-agents.mjs <owned GMP> [native unit ID]');
const handle = await open(filename, 'r');
try {
  const before = await handle.stat();
  let readBytes = 0, readRequests = 0, largestRead = 0;
  const source = {size: before.size, async readAt(offset, length) {
    const data = new Uint8Array(length);
    const {bytesRead} = await handle.read(data, 0, length, offset);
    ++readRequests; readBytes += bytesRead; largestRead = Math.max(largestRead, length);
    return data.subarray(0, bytesRead);
  }};
  const unitHash = createHash('sha256'), agentHash = createHash('sha256');
  let units = 0, assignedUnits = 0, agents = 0, boundAgents = 0, candidate;
  const unitSamples = [], agentSamples = [];
  for await (const record of checkpointUnitAgentLinks(source)) {
    ++units; assignedUnits += Number(record.agentId !== 0);
    unitHash.update(JSON.stringify(record) + '\n');
    if (record.family === 'VHCL' && record.agentId && unitSamples.length < 32) unitSamples.push(record);
    if (!candidate && record.family === 'VHCL' && record.playerNumber === 0 && record.agentId) candidate = record.unitId;
  }
  for await (const record of checkpointAgents(source)) {
    ++agents; boundAgents += Number(record.unitId !== 0);
    agentHash.update(JSON.stringify(record) + '\n');
    if (agentSamples.length < 32) agentSamples.push(record);
  }
  const selectedUnitId = requested === undefined ? candidate : Number(requested);
  const selected = selectedUnitId ? await checkpointActorRecords(source, selectedUnitId) : null;
  const after = await handle.stat();
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs)
    throw new Error('Checkpoint changed during inspection; retry with the game stopped');
  console.log(JSON.stringify({fileBytes: before.size, readBytes, readRequests, largestRead,
    units, assignedUnits, agents, boundAgents, selected, unitSamples, agentSamples,
    unitLinksSha256: unitHash.digest('hex'), agentMetadataSha256: agentHash.digest('hex'),
    limitations: 'Selected UNIT and separate GPL agent ranges with bidirectional world-local IDs. '
      + 'Attribute counts are declared; attribute values and script function identities remain opaque. '
      + 'No hero classification, full actor package, external reference remapping, timers, activation or cross-region travel.'}, null, 2));
} finally {await handle.close();}
