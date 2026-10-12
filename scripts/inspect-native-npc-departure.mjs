#!/usr/bin/env node
// Inspect known typed incoming references in one stopped copied NPC world.
import {open, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnits, checkpointAgents, checkpointAgentReferencePlan, checkpointUnitAgentLinks,
  checkpointContainerEntries, checkpointAttachments, checkpointActorRecords, checkpointAgentQueues} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderUnitReferences} from '../web/world/order-unit-bindings.mjs';

const [proofName, output, mode] = process.argv.slice(2), originalSource = mode === '--original-source', evolvedSource = mode === '--evolved';
if (!proofName || !output || (mode && !originalSource && !evolvedSource) || process.argv.length > 5) throw Error('Usage: inspect-native-npc-departure.mjs <checkpoint proof> <fresh output|--stdout> [--original-source|--evolved]');
const proofBytes = await readFile(proofName), inputProof = JSON.parse(proofBytes);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
let proof = inputProof;
if (evolvedSource) {
  const root=resolve(new URL('../',import.meta.url).pathname);
  if(proof.qualified!==true||proof.originalEvolvedFullSaveQualified!==true||proof.unitId!==510||proof.agentId!==79)
    throw Error('Require the qualified evolved NPC save');
  const {stdout}=await promisify(execFile)(process.execPath,[resolve(root,'scripts/check-native-npc-evolved.mjs'),proof.sourceManifest,'--stdout'],{cwd:root,maxBuffer:2*1024*1024});
  if(JSON.stringify(JSON.parse(stdout))!==JSON.stringify(proof))throw Error('Evolved departure proof changed');
  if(proof.fixture.nativeSessionTerminal!==true||proof.fixture.nativeExitCode!==0||!Number.isInteger(proof.fixture.nativePid)||proof.fixture.nativePid<=0)
    throw Error('Require terminal original evolved save');
  try{process.kill(proof.fixture.nativePid,0);throw Error('Native evolved source is still live');}catch(e){if(e.code!=='ESRCH')throw e;}
  proof={...proof,after:{...proof.after,bytes:proof.after.size}};
}
if (originalSource) {
  const m = proof.fixture;
  if (proof.qualified !== true || proof.originalWorldLoadVisits !== 1960 || !proof.actors.includes(2101) ||
      m.crossSource !== true || m.nativeOnly !== true || m.browserUsed !== false || m.nativeSessionTerminal !== true || m.nativeExitCode !== 0)
    throw Error('Require qualified original Brashnard source evidence');
  const packBytes = await readFile(m.packMetadata), pack = JSON.parse(packBytes);
  const root = resolve(new URL('../', import.meta.url).pathname), key = resolve(m.packMetadata).slice(root.length + 1);
  if (sha(packBytes) !== proof.evidenceSha256[key] || pack.sourceSha256 !== '31059d44ebf165c25bf1fd91f8ef00d5c5e3733d2d6177ca8e05956026650e13' || pack.sourceUnits !== 1960)
    throw Error('Changed pinned original source binding evidence');
  proof = {unitId: 2101, after: {filename: resolve(root, pack.source), bytes: 1298525, sha256: pack.sourceSha256}};
} else if (proof.qualified !== true || proof.unitId !== 510 || proof.agentId !== 79) throw Error('Require the qualified copied NPC world');
const handle = await open(proof.after.filename, 'r'), before = await handle.stat();
let largestRead = 0;
try {
  if (before.size !== proof.after.bytes || before.size > 64 * 1024 * 1024) throw Error('Changed or oversized copied world');
  const evolvedFile=evolvedSource?await stoppedFileSource(proof.after.filename):null;
  const source = {size: before.size, async readAt(at, count) {
    if (![at, count].every(Number.isSafeInteger) || at < 0 || count < 0 || count > 4096 || at + count > before.size)
      throw Error('Unbounded departure inspection');
    largestRead = Math.max(largestRead, count);
    if(evolvedFile)return evolvedFile.readAt(at,count);
    const bytes = new Uint8Array(count), {bytesRead} = await handle.read(bytes, 0, count, at);
    if (bytesRead !== count) throw Error('Truncated departure world');
    return bytes;
  }};
  const hash = createHash('sha256');
  for (let at = 0; at < before.size; at += 4096) hash.update(await source.readAt(at, Math.min(4096, before.size - at)));
  if (hash.digest('hex') !== proof.after.sha256) throw Error('Changed pinned full-world checkpoint');
  if (originalSource) {
    const {unit, agent} = await checkpointActorRecords(source, proof.unitId);
    if (unit.size !== 375 || unit.parentUnitId || agent.unitId !== proof.unitId || agent.deleted)
      throw Error('Changed original grounded source NPC');
    proof.agentId = agent.agentId;
  }
  let units = 0, agents = 0, orderAttachments = 0, orderTargets = 0, selfReferences = 0;
  const incoming = [], unsupportedOrders = [], actor = [], script = [];
  for await (const unit of checkpointUnits(source)) {
    ++units;
    if (unit.primary.words[1] === proof.unitId) actor.push(unit);
    if (unit.primary.words[6] === proof.unitId) incoming.push({kind: 'parent', unitId: unit.primary.words[1]});
  }
  for await (const agent of checkpointAgents(source)) {
    ++agents;
    if (agent.agentId === proof.agentId) script.push(agent);
    for (const ref of await checkpointAgentReferencePlan(source, agent.agentId, id => id)) {
      if (ref.before !== proof.agentId) continue;
      if (agent.agentId === proof.agentId) ++selfReferences;
      else incoming.push({kind: 'script', agentId: agent.agentId, attribute: ref.attribute, path: ref.path});
    }
    if (agent.unitId === proof.unitId && agent.agentId !== proof.agentId)
      incoming.push({kind: 'script-native-link', agentId: agent.agentId});
  }
  for await (const unit of checkpointUnitAgentLinks(source))
    if (unit.agentId === proof.agentId && unit.unitId !== proof.unitId)
      incoming.push({kind: 'native-script-link', unitId: unit.unitId});
  for await (const member of checkpointContainerEntries(source))
    if (member.type === 'member' && (member.targetUnitId === proof.unitId || member.unitId === proof.unitId))
      incoming.push({kind: 'container', unitId: member.unitId, targetUnitId: member.targetUnitId});
  for await (const attachment of checkpointAttachments(source)) {
    if (attachment.kind !== 'ORDR') continue;
    ++orderAttachments;
    try {
      for await (const ref of checkpointActorOrderUnitReferences(source, attachment.unitId)) {
        ++orderTargets;
        if (ref.targetUnitId === proof.unitId && attachment.unitId !== proof.unitId)
          incoming.push({kind: 'order', unitId: attachment.unitId, bank: ref.bank, index: ref.index, orderKind: ref.kind});
      }
    } catch (e) {
      if (e.code !== 'NATIVE_ORDER_KIND_UNSUPPORTED') throw e;
      unsupportedOrders.push({unitId: attachment.unitId, kind: e.kind});
    }
  }
  if (actor.length !== 1 || script.length !== 1 || actor[0].primary.words[6] !== 0 || script[0].unitId !== proof.unitId || selfReferences !== 2)
    throw Error('Changed supported actor/script/parent profile');
  let queuedActor = 0, queuedAgents = 0;
  for await (const entry of checkpointAgentQueues(source)) {
    if (entry.type !== 'queued-agent') continue;
    if (++queuedAgents > 4096) throw Error('Excessive script queue preflight');
    queuedActor += entry.agentId === proof.agentId;
  }
  if (queuedActor > 1) throw Error('Duplicate owned source scheduling entry');
  const after = await handle.stat();
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || (!evolvedSource && before.ctimeMs !== after.ctimeMs)) throw Error('World changed during inspection');
  const report = {qualified: incoming.length === 0 && unsupportedOrders.length === 0,
    scope: 'Known typed source-NPC incoming references only; other opaque native/script state and general reference closure unqualified',
    checkpoint: proof.after.filename, checkpointSha256: proof.after.sha256, unitId: proof.unitId, agentId: proof.agentId,
    units, agents, orderAttachments, orderTargets, selfReferences, incoming, unsupportedOrders, largestRead,
    originalSource, ...(evolvedSource?{evolvedSource:true}:{}), queuedActor, queuedAgents,
    sourceProof: resolve(proofName), sourceProofSha256: sha(proofBytes),
    completeReferenceClosureQualified: false, browserUsed: false, nativeProcessesStarted: 0};
  if (output === '--stdout') console.log(JSON.stringify(report));
  else {
    await writeFile(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
    console.log(JSON.stringify({qualified: report.qualified, unitId: proof.unitId, agentId: proof.agentId, units, agents, incoming: incoming.length, unsupportedOrders, queuedActor, largestRead}));
  }
} finally {await handle.close();}
