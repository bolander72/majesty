#!/usr/bin/env node
// Independently compare stopped original full-world snapshots around NPC removal.
import {open, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, join} from 'node:path';
import {checkpointUnits, checkpointAgents, checkpointAttachments, checkpointActorRecords, checkpointAgentQueues} from '../web/world/checkpoint.mjs';

const [reloadName, output, mode] = process.argv.slice(2);
const diagnostic = mode === '--diagnostic';
if (!reloadName || !output || (mode && !diagnostic) || process.argv.length > 5) throw Error('Usage: check-native-npc-departure.mjs <qualified reload report> <fresh output> [--diagnostic using a native manifest]');
const sha = data => createHash('sha256').update(data).digest('hex');
const reloadBytes = await readFile(reloadName), proof = JSON.parse(reloadBytes), m = diagnostic ? proof : proof.fixture;
const originalSource = m.originalSourceDeparture === true;
const evolvedSource = m.departEvolvedNpc === true;
if(evolvedSource&&(originalSource||m.reloadEvolvedNpc!==true||!m.selectedRevisionExport||m.scheduleNpc||m.reloadScheduledNpc||m.clockMode!=='pinned'))
  throw Error('Require selected evolved departure mode without reinsertion');
if ((!diagnostic && (proof.qualified !== true || proof.actualOriginalFullReloadQualified !== true)) || m.departNpc !== true ||
    m.observeMotion !== false || m.nativeSessionTerminal !== true || m.nativeExitCode !== 0 || m.nativeOnly !== true || m.browserUsed !== false)
  throw Error('Require terminal native departure and original full reload qualification');
const profile = resolve(m.profile);
if (!profile.includes('/upstream/majesty-recomp/build/actor-arrival-fixture-' + (originalSource ? 'original-source-' : 'joint-reload-')) || !profile.endsWith('/frontier_0_0'))
  throw Error('Departure inspection requires the owned copied profile');
const preflightBytes = await readFile(m.departurePreflight ?? m.preflight), preflight = JSON.parse(preflightBytes);
if (sha(preflightBytes) !== (m.departurePreflightSha256 ?? m.preflightSha256) || preflight.qualified !== true || preflight.incoming.length || preflight.unsupportedOrders.length ||
    preflight.unitId !== m.unitId || preflight.agentId !== m.agentId ||
    preflight.checkpointSha256 !== m.inputHashes['Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP']) throw Error('Changed or incomplete known incoming-reference evidence');
const log = await readFile(m.log, 'utf8');
const expected = `[streaming] Joint departure unit=${m.unitId} agent=${m.agentId} deferred=1 unit-absent=1 agent-absent=1 groups=1 rendering=1 queues=1 counters=1 physical=1 reclaimed=1 hooks-same=1 before-saved=1 after-saved=1 result=pass`;
if (!diagnostic && (log.split('\n').filter(line => line === expected).length !== 1 || /result=fail|SIGSEGV|exception e06d7363/.test(log)))
  throw Error('Missing original removal, registration, queue, physical/drawing and allocator evidence');
const resourceRows = [...log.matchAll(/^\[streaming\] Joint departure resources entries=(\d+),(\d+) queued=(\d+),(\d+) deferred=(\d+) heap-bytes=(\d+),(\d+) heap-blocks=(\d+),(\d+) crt-live=(\d+),(\d+) crt-valid=1 actor-queued=(\d+)$/gm)];
let resources;
if (!diagnostic) {
  if (resourceRows.length !== 1) throw Error('Missing exact queue membership and allocator observations');
  const [entriesBefore, entriesAfter, queuedBefore, queuedAfter, deferred, heapBytesBefore, heapBytesAfter,
    heapBlocksBefore, heapBlocksAfter, crtBefore, crtAfter, actorQueued] = resourceRows[0].slice(1).map(Number);
  if (entriesBefore !== entriesAfter + 1 || actorQueued !== (m.reloadScheduledNpc === true || originalSource || evolvedSource ? 1 : 0) || queuedBefore !== queuedAfter + actorQueued || deferred !== 0 ||
      heapBytesAfter > heapBytesBefore || heapBlocksAfter > heapBlocksBefore || crtAfter >= crtBefore)
    throw Error('Incomplete logical reclamation or original queue cleanup');
  resources = {entriesBefore, entriesAfter, queuedBefore, queuedAfter, actorQueued, deferred, heapBytesBefore, heapBytesAfter,
    heapBlocksBefore, heapBlocksAfter, crtBefore, crtAfter, reclaimedCrtAllocations: crtBefore - crtAfter};
}
async function inspect(label, present) {
  const filename = join(profile, 'Documents/My Games/MajestyHD/SaveGame', label + '.GMP');
  const handle = await open(filename, 'r'), before = await handle.stat();
  try {
    if (!before.isFile() || before.size <= 0 || before.size > 64 * 1024 * 1024) throw Error('Invalid departure checkpoint bound');
    let largestRead = 0;
    const source = {size: before.size, async readAt(at, count) {
      if (![at, count].every(Number.isSafeInteger) || at < 0 || count < 0 || count > 4096 || at + count > before.size)
        throw Error('Unbounded departure checkpoint read');
      largestRead = Math.max(largestRead, count);
      const bytes = new Uint8Array(count), {bytesRead} = await handle.read(bytes, 0, count, at);
      if (bytesRead !== count) throw Error('Truncated departure checkpoint');
      return bytes;
    }};
    async function hashRecord(record) {
      const h = createHash('sha256');
      for (let at = 0; at < record.size; at += 4096) h.update(await source.readAt(record.offset + at, Math.min(4096, record.size - at)));
      return {bytes: record.size, sha256: h.digest('hex')};
    }
    const records = {units: {}, agents: {}, attachments: {}};
    for await (const record of checkpointUnits(source)) {
      const key = String(record.primary.words[1]);
      if (records.units[key]) throw Error('Duplicate native UNIT');
      records.units[key] = await hashRecord(record);
    }
    for await (const record of checkpointAgents(source)) {
      const key = String(record.agentId);
      if (records.agents[key]) throw Error('Duplicate native GPL');
      records.agents[key] = await hashRecord(record);
    }
    let orders;
    for await (const record of checkpointAttachments(source)) {
      const key = record.kind + ':' + record.unitId;
      if (records.attachments[key]) throw Error('Duplicate native attachment');
      records.attachments[key] = await hashRecord(record);
      if (key === 'ORDR:' + m.unitId) orders = record;
    }
    if (present) {
      const {unit, agent} = await checkpointActorRecords(source, m.unitId);
      if (unit.agentId !== m.agentId || agent.unitId !== m.unitId || !orders) throw Error('Missing complete source actor');
      for (const [kind, record] of [['Unit', unit], ['GPL', agent]]) {
        const expected = await readFile(join(profile, `Joint_Reload_${kind}.bin`));
        if (record.size !== expected.length || sha(expected) !== (await hashRecord(record)).sha256)
          throw Error('Before-departure original actor record changed');
      }
      const expected = await readFile(join(profile, 'Joint_Reload_Orders.bin'));
      const count = orders.primary.end - orders.primary.offset - 16;
      if (count !== expected.length || count > 2048 || sha(await source.readAt(orders.primary.offset + 16, count)) !== sha(expected))
        throw Error('Before-departure commands changed');
    } else if (records.units[m.unitId] || records.agents[m.agentId] || orders) throw Error('Departed actor persists in original checkpoint');
    const queues = [[], []], seenQueued = new Set();
    let activeQueue;
    for await (const entry of checkpointAgentQueues(source)) {
      if (entry.type === 'queue-selector') activeQueue = entry.activeQueue;
      else {
        if (seenQueued.size >= (evolvedSource ? preflight.agents : originalSource ? 71 : 11) || seenQueued.has(entry.agentId) || !records.agents[entry.agentId])
          throw Error('Duplicate or missing saved queued agent');
        seenQueued.add(entry.agentId); queues[entry.queue].push(entry.agentId);
      }
    }
    const h = createHash('sha256');
    for (let at = 0; at < before.size; at += 4096) h.update(await source.readAt(at, Math.min(4096, before.size - at)));
    const after = await handle.stat();
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw Error('Checkpoint changed during inspection');
    return {filename, bytes: before.size, sha256: h.digest('hex'), largestRead, records, queues, activeQueue};
  } finally {await handle.close();}
}
const before = await inspect('Joint_Departure_Before', true), after = await inspect('Joint_Departure_After', false);
if (!diagnostic) {
  const ownedBefore = before.queues.flat().filter(id => id === m.agentId).length;
  if (ownedBefore !== (m.reloadScheduledNpc === true || originalSource || evolvedSource ? 1 : 0) || after.queues.flat().includes(m.agentId) || before.activeQueue !== after.activeQueue)
    throw Error('Wrong saved departure queue membership or selector');
  for (let i = 0; i < 2; ++i)
    if (JSON.stringify(before.queues[i].filter(id => id !== m.agentId)) !== JSON.stringify(after.queues[i]))
      throw Error('Departure mutated another saved queue entry');
}
const differences = {};
for (const kind of ['units', 'agents', 'attachments']) {
  const old = before.records[kind], next = after.records[kind], changed = [], removed = [], added = [];
  let unchanged = 0;
  for (const key of Object.keys(old)) {
    if (!next[key]) removed.push(key);
    else if (old[key].sha256 !== next[key].sha256) changed.push(key);
    else ++unchanged;
  }
  for (const key of Object.keys(next)) if (!old[key]) added.push(key);
  const expected = kind === 'units' ? [String(m.unitId)] : kind === 'agents' ? [String(m.agentId)] : ['ORDR:' + m.unitId];
  if (!diagnostic && (added.length || changed.length || JSON.stringify(removed) !== JSON.stringify(expected))) throw Error('Departure mutated unrelated original ' + kind);
  differences[kind] = {before: Object.keys(old).length, after: Object.keys(next).length, unchanged, removed, added, changed};
}
const observedCounts=[differences.units.before, differences.units.after, differences.agents.before, differences.agents.after, differences.attachments.before, differences.attachments.after];
if(evolvedSource) {
  const evolvedBytes=await readFile(m.evolvedCheckpointReport),evolved=JSON.parse(evolvedBytes);
  if(sha(evolvedBytes)!==m.evolvedCheckpointReportSha256||evolved.originalEvolvedFullSaveQualified!==true||preflight.evolvedSource!==true||
    evolved.after.sha256!==preflight.checkpointSha256||preflight.units!==evolved.after.counts.units||preflight.agents!==evolved.after.counts.agents)
    throw Error('Evolved removal membership provenance differs');
  const {units,agents,attachments}=evolved.after.counts;
  if(observedCounts.join(',')!==[units,units-1,agents,agents-1,attachments,attachments-1].join(','))throw Error('Evolved removal did not preserve current world membership');
} else if (observedCounts.join(',') !== (originalSource ? '1960,1959,71,70,83,82' : '481,480,11,10,12,11'))
  throw Error('Unexpected original full-world membership');
const report = {qualified: !diagnostic, diagnostic, scope: diagnostic ? 'Diagnostic checkpoint differences only; original removal qualification failed' : 'One isolated original complete NPC removal, full before/after checkpoint and501 unchanged other records; fresh departed-world reload, general reference closure and two-world handoff unqualified',
  sourceReloadReport: resolve(reloadName), sourceReloadReportSha256: sha(reloadBytes), sourceManifest: m,
  before, after, differences, resources, scriptSchedulingPerformed: false,
  savedScriptSchedulingRestored: m.reloadScheduledNpc === true, savedQueueRemovalQualified: !diagnostic,
  originalUnitAndAgentRemovalQualified: !diagnostic, originalActivePhysicalAndDrawingRemovalQualified: !diagnostic,
  monotonicIdentityCountersPreserved: !diagnostic, relocatedNpcDeparturePerformed: !originalSource,
  originalBrashnardSourceDeparturePerformed: originalSource, freshDepartedWorldReloadQualified: false,
  completeReferenceClosureQualified: false, sourceDestinationOwnershipHandoffQualified: false,
  continuousPagingQualified: false, wholeBrowserMemoryBoundQualified: false, browserUsed: false, nativeProcessesStarted: 0};
if (originalSource) report.scope = 'One original Brashnard NPC removal and full snapshots preserving 2111 other entity records and all other queues; original-source fresh reload, complete reference closure and paired ownership handoff unqualified';
if(evolvedSource) {
  report.evolvedNpcDeparturePerformed=true;report.savedScriptSchedulingRestored=true;
  report.scope='Original removal of the selected evolved NPC and full before/after saves preserving all other current entity records and queues; fresh departed reload, opaque reference closure and paired ownership publication unqualified.';
}
if (output === '--stdout') console.log(JSON.stringify(report));
else {
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({qualified: !diagnostic, differences, freshDepartedWorldReloadQualified: false}));
}
