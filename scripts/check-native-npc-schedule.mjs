#!/usr/bin/env node
// Original saved queue membership plus bounded native AI observation; no game launch.
import {open, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, join} from 'node:path';
import {checkpointUnits, checkpointAgents, checkpointAttachments, checkpointAgentQueues} from '../web/world/checkpoint.mjs';

const [reloadName, output] = process.argv.slice(2);
if (!reloadName || !output || process.argv.length !== 4)
  throw Error('Usage: check-native-npc-schedule.mjs <qualified reload report> <fresh output|--stdout>');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const reloadBytes = await readFile(reloadName), reload = JSON.parse(reloadBytes), m = reload.fixture;
if (reload.qualified !== true || reload.actualOriginalFullReloadQualified !== true ||
    m.nativeOnly !== true || m.browserUsed !== false || m.nativeSessionTerminal !== true || m.nativeExitCode !== 0 ||
    m.scheduleNpc !== true || m.observeMotion !== true || m.clockMode !== 'monotonic')
  throw Error('Require terminal original reload and opt-in native scheduling observation');
const profile = resolve(m.profile);
if (!profile.includes('/upstream/majesty-recomp/build/actor-arrival-fixture-joint-reload-') || !profile.endsWith('/frontier_0_0'))
  throw Error('Require owned copied scheduling profile');
const log = await readFile(m.log, 'utf8');
if (/result=fail|SIGSEGV|exception e06d7363/.test(log)) throw Error('Native scheduling run failed');
const schedule = [...log.matchAll(/^\[streaming\] Joint schedule unit=(\d+) agent=(\d+) queue=([01]) before=(\d+) after=(\d+) queued=1 others-preserved=1 actor-same=1 script-same=1 scratch-released=1 before-saved=1 after-saved=1 result=pass$/gm)];
if (schedule.length !== 1) throw Error('Missing original queue insertion and unchanged actor evidence');
const [unitId, agentId, queue, oldCount, newCount] = schedule[0].slice(1).map(Number);
if (unitId !== m.unitId || agentId !== m.agentId || newCount !== oldCount + 1)
  throw Error('Wrong scheduling identity or queue count');
const ai = [...log.matchAll(/^\[streaming\] Joint script motion completed ticks=(\d+) agent-calls=(\d+) agent-returns=(\d+) contexts=(\d+) context-returns=(\d+) executed=(\d+) hooks-removed=1 result=pass$/gm)];
if (ai.length !== 1) throw Error('Missing AI execution and hook cleanup evidence');
const [ticks, agentCalls, agentReturns, contexts, contextReturns, executed] = ai[0].slice(1).map(Number);
if (ticks !== 240 || !agentCalls || agentCalls !== agentReturns || !contexts || contexts !== contextReturns || !executed || executed > contexts)
  throw Error('Incomplete or unbalanced original AI delegation');

async function inspect(label) {
  const filename = join(profile, 'Documents/My Games/MajestyHD/SaveGame', label + '.GMP');
  const handle = await open(filename, 'r'), initial = await handle.stat();
  try {
    if (!initial.isFile() || initial.size <= 0 || initial.size > 64 * 1024 * 1024) throw Error('Invalid saved scheduling world');
    let largestRead = 0;
    const source = {size: initial.size, async readAt(at, count) {
      if (![at, count].every(Number.isSafeInteger) || at < 0 || count < 0 || count > 4096 || at + count > initial.size)
        throw Error('Unbounded scheduling read');
      largestRead = Math.max(largestRead, count);
      const bytes = new Uint8Array(count), {bytesRead} = await handle.read(bytes, 0, count, at);
      if (bytesRead !== count) throw Error('Truncated scheduling world');
      return bytes;
    }};
    async function hashRecord(record) {
      const h = createHash('sha256');
      for (let at = 0; at < record.size; at += 4096)
        h.update(await source.readAt(record.offset + at, Math.min(4096, record.size - at)));
      return {bytes: record.size, sha256: h.digest('hex')};
    }
    const records = {units: {}, agents: {}, attachments: {}};
    for (const [kind, iterator, key, cap] of [
      ['units', checkpointUnits(source), r => String(r.primary.words[1]), 481],
      ['agents', checkpointAgents(source), r => String(r.agentId), 11],
      ['attachments', checkpointAttachments(source), r => r.kind + ':' + r.unitId, 12],
    ]) {
      let count = 0;
      for await (const record of iterator) {
        const id = key(record);
        if (++count > cap || records[kind][id]) throw Error('Unexpected or duplicate saved ' + kind);
        records[kind][id] = await hashRecord(record);
        if (kind === 'attachments' && id === 'ORDR:' + unitId) {
          const expected = await readFile(join(profile, 'Joint_Reload_Orders.bin'));
          const size = record.primary.end - record.primary.offset - 16;
          if (size > 2048 || size !== expected.length || sha(await source.readAt(record.primary.offset + 16, size)) !== sha(expected))
            throw Error('Scheduling changed original actor commands');
        }
      }
      if (count !== cap) throw Error('Incomplete saved ' + kind);
    }
    for (const [kind, id, writer] of [['units', unitId, 'Unit'], ['agents', agentId, 'GPL']]) {
      const bytes = await readFile(join(profile, `Joint_Reload_${writer}.bin`));
      if (bytes.length > 4096 || records[kind][id]?.sha256 !== sha(bytes)) throw Error('Scheduling changed original actor ' + writer);
    }
    const queues = [[], []], seen = new Set();
    let activeQueue;
    for await (const entry of checkpointAgentQueues(source)) {
      if (entry.type === 'queue-selector') {
        if (activeQueue !== undefined) throw Error('Duplicate manager queue selector');
        activeQueue = entry.activeQueue;
      } else {
        if (seen.size >= 11 || seen.has(entry.agentId) || !records.agents[entry.agentId])
          throw Error('Duplicate, missing or excessive queued agent');
        seen.add(entry.agentId);
        queues[entry.queue].push(entry.agentId);
      }
    }
    if (activeQueue === undefined) throw Error('Missing saved manager queue selector');
    const h = createHash('sha256');
    for (let at = 0; at < initial.size; at += 4096) h.update(await source.readAt(at, Math.min(4096, initial.size - at)));
    const final = await handle.stat();
    if (initial.size !== final.size || initial.mtimeMs !== final.mtimeMs || initial.ctimeMs !== final.ctimeMs)
      throw Error('Scheduling world changed during inspection');
    return {filename, bytes: initial.size, sha256: h.digest('hex'), largestRead, records, queues, activeQueue};
  } finally {await handle.close();}
}
const before = await inspect('Joint_Schedule_Before'), after = await inspect('Joint_Schedule_After');
for (const kind of Object.keys(before.records))
  if (JSON.stringify(before.records[kind]) !== JSON.stringify(after.records[kind]))
    throw Error('Scheduling mutated saved ' + kind);
if (before.queues.flat().includes(agentId) || after.queues[queue].at(-1) !== agentId ||
    before.queues[queue].length !== oldCount || after.queues[queue].length !== newCount ||
    before.activeQueue !== after.activeQueue)
  throw Error('Wrong persisted scheduling membership or selector');
for (let index = 0; index < 2; ++index)
  if (JSON.stringify(before.queues[index]) !== JSON.stringify(after.queues[index].filter(id => id !== agentId)))
    throw Error('Scheduling changed another saved queue entry');
const result = {qualified: true, scope: 'One relocated NPC appended by original queue routine; all 504 entity records unchanged, typed saved queues and 240 native AI ticks. Fresh scheduled-world reload and continuous region ownership remain unqualified.',
  sourceReloadReport: resolve(reloadName), sourceReloadReportSha256: sha(reloadBytes),
  fixture: m, unitId, agentId, before, after, scheduledQueue: queue,
  unchangedEntityRecords: 504, originalQueueInsertionQualified: true, savedQueueMembershipQualified: true,
  aiObservation: {ticks, agentCalls, agentReturns, contexts, contextReturns, executed, hooksRemoved: true},
  freshScheduledWorldReloadQualified: false, continuousPagingQualified: false, wholeBrowserMemoryBoundQualified: false,
  browserUsed: false, nativeProcessesStarted: 0};
if (output === '--stdout') console.log(JSON.stringify(result));
else {
  await writeFile(output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({qualified: true, unchangedEntityRecords: 504, queuesBefore: before.queues, queuesAfter: after.queues, executed}));
}
