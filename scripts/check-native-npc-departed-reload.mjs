#!/usr/bin/env node
// Fresh original reload of a departed world, followed by original full save.
import {open, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {checkpointUnits, checkpointAgents, checkpointAttachments, checkpointAgentQueues} from '../web/world/checkpoint.mjs';
const run = promisify(execFile), root = resolve(new URL('../', import.meta.url).pathname);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
// Return activation happens only AFTER Joint_Departed_Reload was captured.
// Opt in explicitly to checking that pre-stage snapshot; the ordinary CLI
// must continue to reject an activated actor or an advancing-clock fixture.
export async function verifyDepartedReload(manifestName, {beforeReturnActivation = false} = {}) {
const manifestBytes = await readFile(manifestName), m = JSON.parse(manifestBytes);
const originalSource = m.originalSourceWorld === true;
const activeReturn = m.activateReturnedNpc === true;
if (beforeReturnActivation && (!activeReturn || !originalSource || m.restoreReturnCommands !== true ||
    m.observeReturnMotion !== true || m.captureReturnEvolved !== true))
  throw Error('Require explicit original-source return activation mode');
if (!beforeReturnActivation && activeReturn) throw Error('Activated return requires its own qualification');
if (m.nativeOnly !== true || m.browserUsed !== false || m.nativeSessionTerminal !== true || m.nativeExitCode !== 0 ||
    m.reloadDepartedNpc !== true || m.clockMode !== (beforeReturnActivation ? 'monotonic' : 'pinned') || m.observeMotion || m.departNpc || m.scheduleNpc || m.reloadScheduledNpc)
  throw Error('Require separate terminal native departed-world reload');
const profile = resolve(m.profile);
if (!profile.startsWith(join(root, 'upstream/majesty-recomp/build/actor-arrival-fixture-' + (originalSource ? 'original-source-' : 'joint-reload-'))) || !profile.endsWith('/frontier_0_0'))
  throw Error('Require owned copied departed-world profile');
const proofBytes = await readFile(m.departedCheckpointReport), proof = JSON.parse(proofBytes);
if (sha(proofBytes) !== m.departedCheckpointReportSha256 || proof.qualified !== true || proof.diagnostic ||
    proof.originalUnitAndAgentRemovalQualified !== true || proof.savedQueueRemovalQualified !== true)
  throw Error('Changed or incomplete original departure proof');
const {stdout} = await run(process.execPath, [join(root, 'scripts/check-native-npc-departure.mjs'), proof.sourceReloadReport, '--stdout'], {maxBuffer: 1024 * 1024});
if (JSON.stringify(JSON.parse(stdout)) !== JSON.stringify(proof)) throw Error('Independent departure proof differs');
const old = proof.sourceManifest;
const evolvedSource=proof.evolvedNpcDeparturePerformed===true;
if(evolvedSource&&(originalSource||m.evolvedDepartedReload!==true||old.departEvolvedNpc!==true))throw Error('Require explicit evolved departed-world reload');
if(!evolvedSource&&m.evolvedDepartedReload)throw Error('Unexpected evolved departed-world mode');
if (old.nativePid === m.nativePid || resolve(old.profile) === profile || [old.unitId, old.agentId].join(',') !== [m.unitId, m.agentId].join(','))
  throw Error('Require separate process/profile and the exact removed identities');
if (originalSource && proof.originalBrashnardSourceDeparturePerformed !== true) throw Error('Expected original Brashnard departure');
for (const key of originalSource ? ['sourceProof','preflight'] : ['sourceManifest', 'sourceCheckpointReport', 'sourceIdentityReport'])
  if (m[key] !== old[key] || m[key + 'Sha256'] !== old[key + 'Sha256'] || sha(await readFile(m[key])) !== m[key + 'Sha256'])
    throw Error('Changed or different original producer evidence');
for (const [name, digest] of Object.entries(m.inputHashes))
  if (sha(await readFile(join(profile, name))) !== digest) throw Error('Departed reload input changed');
const expected = await readFile(join(profile, 'Joint_Reload_Expected.bin'));
if (expected.length !== 16 || [0, 4, 8, 12].map(at => expected.readUInt32LE(at)).join(',') !== [0x31524a4e, 2, m.unitId, m.agentId].join(','))
  throw Error('Wrong removed-identity fixture version');
const log = await readFile(m.log, 'utf8');
if (!log.includes('all expectations met') || /result=fail|SIGSEGV|exception e06d7363|undeliverable call(?!s: none)/i.test(log))
  throw Error('Original reload or continuing native game failed');
const loaded = [...log.matchAll(/^\[streaming\] Original load end result=00000000 visits=(\d+) retained=\d+ sample-bytes=\d+$/gm)];
const loadedUnits = evolvedSource ? proof.differences.units.after : originalSource ? 1959 : 480,
  agentCount = evolvedSource ? proof.differences.agents.after : originalSource ? 70 : 10,
  attachmentCount = evolvedSource ? proof.differences.attachments.after : originalSource ? 82 : 11;
if(evolvedSource&&(![loadedUnits,agentCount,attachmentCount].every(n=>Number.isInteger(n)&&n>0&&n<5000)||
  loadedUnits!==proof.differences.units.before-1||agentCount!==proof.differences.agents.before-1||attachmentCount!==proof.differences.attachments.before-1))
  throw Error('Invalid evolved removal counts');
if (loaded.length !== 1 || Number(loaded[0][1]) !== loadedUnits) throw Error('Missing complete original departed-world load');
if (/^\[streaming\] Joint (schedule unit|scheduled reload|departure unit|reload unit)=?/m.test(log) ||
    !beforeReturnActivation && /^\[streaming\] Joint motion begin/m.test(log))
  throw Error('Unexpected insertion, deletion or actor activation during departed reload');
if (beforeReturnActivation && (log.indexOf('[streaming] Joint departed reload ') >= log.indexOf('[streaming] Return active ') ||
    log.indexOf('[streaming] Return active ') >= log.indexOf('[streaming] Joint motion begin ')))
  throw Error('Receiving snapshot must precede return activation and observation');
const native = [...log.matchAll(/^\[streaming\] Joint departed reload unit=(\d+) agent=(\d+) unit-absent=1 agent-absent=1 entries=(\d+) queued=(\d+) groups=1 queues-same=1 counters-same=1 native-counter=(\d+) script-counter=(\d+) hooks-same=1 roundtrip-saved=1 result=pass$/gm)];
if (native.length !== 1) throw Error('Missing native absence, queues, counters, registry or original full writer');
const [unitId, agentId, entries, queued, nativeCounter, scriptCounter] = native[0].slice(1).map(Number);
if ([unitId, agentId, entries, queued].join(',') !== [m.unitId, m.agentId, agentCount, agentCount].join(',') || nativeCounter < unitId || scriptCounter < agentId)
  throw Error('Wrong native identities, membership or reused counter range');

async function inspect(label) {
  const filename = join(profile, 'Documents/My Games/MajestyHD/SaveGame', label + '.GMP');
  const handle = await open(filename, 'r'), initial = await handle.stat();
  try {
    if (!initial.isFile() || initial.size <= 0 || initial.size > 64 * 1024 * 1024) throw Error('Invalid departed-world snapshot');
    let largestRead = 0;
    const source = {size: initial.size, async readAt(at, count) {
      if (![at, count].every(Number.isSafeInteger) || at < 0 || count < 0 || count > 4096 || at + count > initial.size)
        throw Error('Unbounded departed-world read');
      largestRead = Math.max(largestRead, count);
      const bytes = new Uint8Array(count), {bytesRead} = await handle.read(bytes, 0, count, at);
      if (bytesRead !== count) throw Error('Truncated departed-world snapshot'); return bytes;
    }};
    async function hashRecord(record) {
      const h = createHash('sha256');
      for (let at = 0; at < record.size; at += 4096)
        h.update(await source.readAt(record.offset + at, Math.min(4096, record.size - at)));
      return {bytes: record.size, sha256: h.digest('hex')};
    }
    const records = {units: {}, agents: {}, attachments: {}};
    for (const [kind, iterator, key, cap] of [
      ['units', checkpointUnits(source), r => String(r.primary.words[1]), loadedUnits],
      ['agents', checkpointAgents(source), r => String(r.agentId), agentCount],
      ['attachments', checkpointAttachments(source), r => r.kind + ':' + r.unitId, attachmentCount],
    ]) {
      let count = 0;
      for await (const record of iterator) {
        const id = key(record);
        if (++count > cap || records[kind][id]) throw Error('Unexpected or duplicate surviving ' + kind);
        records[kind][id] = await hashRecord(record);
      }
      if (count !== cap) throw Error('Incomplete surviving ' + kind);
    }
    if (records.units[unitId] || records.agents[agentId] || records.attachments['ORDR:' + unitId])
      throw Error('Removed NPC resurrected in saved state');
    const queues = [[], []], seen = new Set();
    let activeQueue;
    for await (const entry of checkpointAgentQueues(source)) {
      if (entry.type === 'queue-selector') {
        if (activeQueue !== undefined) throw Error('Duplicate saved queue selector');
        activeQueue = entry.activeQueue;
      } else {
        if (seen.size >= agentCount || seen.has(entry.agentId) || !records.agents[entry.agentId]) throw Error('Invalid surviving queued agent');
        seen.add(entry.agentId); queues[entry.queue].push(entry.agentId);
      }
    }
    if (activeQueue === undefined || seen.size !== agentCount) throw Error('Incomplete saved script queues');
    const h = createHash('sha256');
    for (let at = 0; at < initial.size; at += 4096) h.update(await source.readAt(at, Math.min(4096, initial.size - at)));
    const final = await handle.stat();
    if (initial.size !== final.size || initial.mtimeMs !== final.mtimeMs || initial.ctimeMs !== final.ctimeMs)
      throw Error('Departed world changed during inspection');
    return {filename, bytes: initial.size, sha256: h.digest('hex'), largestRead, records, queues, activeQueue};
  } finally {await handle.close();}
}
const input = await inspect('Joint_Reload'), roundtrip = await inspect('Joint_Departed_Reload');
if (input.sha256 !== proof.after.sha256 || input.bytes !== proof.after.bytes) throw Error('Loaded another departed checkpoint');
for (const value of [input, roundtrip]) {
  for (const kind of Object.keys(value.records))
    if (JSON.stringify(value.records[kind]) !== JSON.stringify(proof.after.records[kind]))
      throw Error('Original departed reload changed surviving ' + kind);
  if (JSON.stringify(value.queues) !== JSON.stringify(proof.after.queues) || value.activeQueue !== proof.after.activeQueue)
    throw Error('Original departed reload changed saved script queues');
}
const result = {qualified: true, scope: 'One fresh original departed-world reload; removed NPC stays absent, all 501 surviving entity records and queues match a new original full save. General transfer, paired ownership commits, continuous paging and browser resources unqualified.',
  fixture: m, sourceManifest: resolve(manifestName), sourceManifestSha256: sha(manifestBytes),
  sourceDepartureReport: m.departedCheckpointReport, sourceDepartureReportSha256: m.departedCheckpointReportSha256,
  input, roundtrip, originalLoadedUnits: loadedUnits, unchangedSurvivingEntityRecords: loadedUnits + agentCount + attachmentCount,
  nativeCounters: {nativeCounter, scriptCounter}, freshDepartedWorldReloadQualified: true,
  departedNpcAbsenceAfterReloadQualified: true, savedQueuesAfterReloadQualified: true,
  actualOriginalFullReloadQualified: true, originalFullRoundtripQualified: true,
  sourceDestinationOwnershipHandoffQualified: false, continuousPagingQualified: false,
  wholeBrowserMemoryBoundQualified: false, browserUsed: false, nativeProcessesStarted: 0};
if (originalSource) {
  result.scope = 'Fresh original Brashnard source reload; removed 2101/37 remain absent, all 2111 surviving entity records and queues match a new original full save. Paired ownership commit, continuous paging and browser resources unqualified.';
  result.originalBrashnardSourceReloadQualified = true;
}
if(evolvedSource) {
  result.evolvedDepartedWorldReloadQualified=true;
  result.scope=`Fresh original evolved departed-world reload; all ${result.unchangedSurvivingEntityRecords} surviving records/queues preserved and removed NPC absent. Paired return publication, opaque reference closure and browser resources unqualified.`;
}
if (beforeReturnActivation) result.scope = 'Original receiving-world reload and pre-return full save only: all 2111 surviving records and queues preserved before later activation. No claim about the post-activation world.';
return result;
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
const [manifestName, output] = process.argv.slice(2);
if (!manifestName || !output || process.argv.length !== 4)
  throw Error('Usage: check-native-npc-departed-reload.mjs <terminal manifest> <fresh output|--stdout>');
const result = await verifyDepartedReload(manifestName);
if (output === '--stdout') console.log(JSON.stringify(result));
else {
  await writeFile(output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({qualified: true, originalLoadedUnits: result.originalLoadedUnits, unchangedSurvivingEntityRecords: result.unchangedSurvivingEntityRecords, freshDepartedWorldReloadQualified: true}));
}
}
