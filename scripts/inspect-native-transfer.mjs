#!/usr/bin/env node
// Inspect the two-region prototype's jointly published full native worlds.
// Serial I/O stays at 4096 bytes; no whole GMP or visited-world cache is built.
import {open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkpointUnits, checkpointAgents, checkpointAgentReferencePlan,
  checkpointAgentValues, checkpointContainerEntries, MAX_CHECKPOINT_BYTES} from '../web/world/checkpoint.mjs';

async function readManifest(marker) {
  const handle = await open(marker, 'r'); let text;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || !stat.size || stat.size >= 512) throw new Error('Invalid transfer manifest size');
    const bytes = Buffer.alloc(512), result = await handle.read(bytes, 0, 512, 0);
    if (result.bytesRead !== stat.size) throw new Error('Truncated transfer manifest');
    if (bytes.subarray(0, result.bytesRead).some(value => value !== 10 && (value < 32 || value > 126)))
      throw new Error('Invalid transfer manifest encoding');
    text = bytes.subarray(0, result.bytesRead).toString('ascii');
  } finally { await handle.close(); }
  return text;
}

export async function inspectNativeTransfer(directory) {
  const marker = path.join(directory, 'Frontier_Transfer.checkpoint');
  const text = await readManifest(marker);
  const lines = text.split('\n');
  if (lines.length !== 11 || lines[10] !== '' || lines[0] !== 'majesty-transfer-v1' ||
      !/^[01]$/.test(lines[1]) || !/^[01]$/.test(lines[2]) || lines[3] !== '0_0' || lines[4] !== '1_0' ||
      lines[9].length > 192 || /[^\x20-\x7e]/.test(lines[9])) throw new Error('Invalid transfer manifest');
  const moved = lines[2] === '1', results = [];
  for (let side = 0; side < 2; ++side) {
    const rawSize = lines[5 + side * 2], expectedHash = lines[6 + side * 2], size = Number(rawSize);
    if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_CHECKPOINT_BYTES || String(size) !== rawSize ||
        !/^[0-9a-f]{64}$/.test(expectedHash)) throw new Error('Invalid transfer file identity');
    const filename = path.join(directory, `Frontier_Transfer_${side ? 'Destination' : 'Source'}_${lines[1]}.GMP`);
    const file = await open(filename, 'r');
    try {
      const before = await file.stat();
      if (!before.isFile() || before.size !== size) throw new Error('Transfer world size mismatch');
      let reads = 0, largestRead = 0;
      const source = {size, async readAt(offset, length) {
        if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 ||
            length > 4096 || offset + length > size) throw new Error('Unbounded transfer inspection');
        const bytes = new Uint8Array(length), result = await file.read(bytes, 0, length, offset);
        ++reads; largestRead = Math.max(largestRead, length);
        if (result.bytesRead !== length) throw new Error('Truncated transfer world');
        return bytes;
      }};
      const hash = createHash('sha256');
      for (let at = 0; at < size; at += 4096) hash.update(await source.readAt(at, Math.min(4096, size - at)));
      if (hash.digest('hex') !== expectedHash) throw new Error('Transfer world digest mismatch');
      const unitId = side ? 802 : 506, agentId = side ? 207 : 9;
      const homeId = side ? 531 : 502, homeAgentId = side ? 6 : 7, present = side ? moved : !moved;
      let unit = null, agent = null, home = null, homeAgent = null, units = 0, agents = 0, existingGuard = null;
      const incoming = [], rosters = [], memberships = [];
      for await (const value of checkpointUnits(source)) {
        ++units;
        if (value.primary.words[1] === unitId) { if (unit) throw new Error('Duplicate transferred unit'); unit = value; }
        if (value.primary.words[1] === homeId) home = value;
        if (side && value.primary.words[1] === 536) existingGuard = value;
      }
      for await (const value of checkpointAgents(source)) {
        ++agents;
        if (value.agentId === agentId) { if (agent) throw new Error('Duplicate transferred agent'); agent = value; }
        if (value.agentId === homeAgentId) homeAgent = value;
        for (const ref of await checkpointAgentReferencePlan(source, value.agentId, id => id)) if (ref.before === agentId) {
          if (incoming.length >= 8192) throw new Error('Too many incoming transfer references');
          incoming.push({agentId: value.agentId, attribute: ref.attribute, path: ref.path});
        }
      }
      for await (const value of checkpointAgentValues(source, homeAgentId))
        if (['Guards', 'Waiting_Guards'].includes(value.attribute) && value.type === 5) rosters.push(value);
      for await (const entry of checkpointContainerEntries(source))
        if (entry.type === 'member' && ((entry.unitId === homeId && entry.targetUnitId === unitId) ||
            (entry.unitId === unitId && entry.targetUnitId === homeId))) memberships.push(entry);
      if (!home || !homeAgent || homeAgent.unitId !== homeId || homeAgent.deleted ||
          Boolean(unit) !== present || Boolean(agent) !== present || (side && !existingGuard))
        throw new Error('Transfer actor/home occupancy mismatch');
      if (present && (unit.family !== 'VHCL' || unit.primary.words[6] !== homeId || agent.unitId !== unitId || agent.deleted))
        throw new Error('Invalid transferred actor links');
      for (const key of ['Guards', 'Waiting_Guards'])
        if (rosters.filter(value => value.attribute === key && value.bits === agentId).length !== Number(present))
          throw new Error('Transfer script roster mismatch');
      for (const [owner, kind, target] of [[homeId, 100, unitId], [homeId, 2, unitId], [unitId, 101, homeId]])
        if (memberships.filter(value => value.unitId === owner && value.groupKind === kind && value.targetUnitId === target).length !== Number(present))
          throw new Error('Transfer native membership mismatch');
      if (!present && incoming.length) throw new Error('Stale incoming transfer reference');
      if (present && (incoming.length !== 3 ||
          !incoming.some(value => value.agentId === homeAgentId && value.attribute === 'Guards') ||
          !incoming.some(value => value.agentId === homeAgentId && value.attribute === 'Waiting_Guards') ||
          !incoming.some(value => value.agentId === agentId && value.attribute === 'activescript')))
        throw new Error('Invalid incoming transfer references');
      const after = await file.stat();
      if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs)
        throw new Error('Transfer world changed during inspection');
      results.push({side: side ? 'destination' : 'source', filename, size, sha256: expectedHash, units, agents,
        transferredActorPresent: present, unitId, agentId, homeId, homeAgentId, incoming, reads, largestRead});
    } finally { await file.close(); }
  }
  if (await readManifest(marker) !== text) throw new Error('Transfer selection changed during inspection');
  if (results.filter(value => value.transferredActorPresent).length !== 1) throw new Error('Transferred actor must exist in exactly one world');
  return {version: 1, slot: Number(lines[1]), moved, content: lines[9], exactlyOneTransferredActor: true, worlds: results,
    limitations: 'Trusted two-region saved-state publication. Full engine reload, writer exclusivity, actual region travel, browser storage, expanding native terrain, GPU memory and multiplayer still need independent qualification.'};
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  if (process.argv.length !== 3) throw new Error('Usage: node scripts/inspect-native-transfer.mjs <owned paired world directory>');
  console.log(JSON.stringify(await inspectNativeTransfer(process.argv[2]), null, 2));
}
