#!/usr/bin/env node
// Extract bounded exact expected original actor writer ranges into an owned fixture.
import {open, readFile, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';
import {checkpointActorRecords, checkpointAttachments} from '../web/world/checkpoint.mjs';
const [preflightName, profileName] = process.argv.slice(2), root = resolve(new URL('../', import.meta.url).pathname);
if (!preflightName || !profileName || process.argv.length !== 4) throw Error('Usage: prepare-native-original-source-writers.mjs <preflight> <owned profile>');
const p = JSON.parse(await readFile(preflightName, 'utf8')), profile = resolve(profileName);
if (!p.qualified || !p.originalSource || p.unitId !== 2101 || p.agentId !== 37 || p.incoming.length || p.unsupportedOrders.length ||
    !profile.startsWith(join(root, 'upstream/majesty-recomp/build/actor-arrival-fixture-original-source-')) || !profile.endsWith('/frontier_0_0'))
  throw Error('Require owned original-source fixture and typed preflight');
const handle = await open(p.checkpoint, 'r'), before = await handle.stat();
try {
  if (before.size !== 1298525) throw Error('Changed original source extent');
  const source = {size: before.size, async readAt(at, count) {
    if (![at,count].every(Number.isSafeInteger) || at < 0 || count < 0 || count > 4096 || at + count > before.size) throw Error('Unbounded original source read');
    const bytes = new Uint8Array(count), {bytesRead} = await handle.read(bytes, 0, count, at);
    if (bytesRead !== count) throw Error('Truncated original source'); return bytes;
  }};
  const hash = createHash('sha256');
  for (let at = 0; at < before.size; at += 4096) hash.update(await source.readAt(at, Math.min(4096, before.size - at)));
  if (hash.digest('hex') !== p.checkpointSha256) throw Error('Changed original source hash');
  const {unit, agent} = await checkpointActorRecords(source, p.unitId);
  let orders;
  for await (const r of checkpointAttachments(source)) if (r.kind === 'ORDR' && r.unitId === p.unitId) {
    if (orders) throw Error('Duplicate original source commands'); orders = r;
  }
  if (!orders || unit.agentId !== p.agentId || agent.unitId !== p.unitId) throw Error('Incomplete original actor');
  const ranges = [['Unit', unit.offset, unit.size], ['GPL', agent.offset, agent.size],
    ['Orders', orders.primary.offset + 16, orders.primary.end - orders.primary.offset - 16]];
  const output = {};
  for (const [kind, offset, count] of ranges) {
    if (count < 1 || count > 2048) throw Error('Unsupported original writer extent');
    const bytes = await source.readAt(offset, count);
    await writeFile(join(profile, `Script_Composed_${kind}_2101_0.bin`), bytes, {flag: 'wx'});
    output[kind] = {bytes: count, sha256: createHash('sha256').update(bytes).digest('hex')};
  }
  const after = await handle.stat();
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw Error('Original source changed during extraction');
  console.log(JSON.stringify(output));
} finally {await handle.close();}
