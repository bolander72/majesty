#!/usr/bin/env node
// Refusal controls on copies of stopped reports; never starts an engine.
import assert from 'node:assert/strict';
import {readFile, writeFile, unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, join} from 'node:path';
import {inspectCoopProposal} from './inspect-native-coop-proposal.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';

const [name, output] = process.argv.slice(2); assert.equal(process.argv.length, 4);
const bytes = await readFile(resolve(name)), report = JSON.parse(bytes);
assert.equal(report.nativeBeginFreshNeighborRequested, true);
const scratch = join(workspace, 'output/native-multiplayer-lobby-977-observed.json');
const results = [];
for (const [label, change] of [
  ['missing-proposal-request', m => {m.nativeBeginFreshNeighborRequested = false;}],
  ['non-boolean-proposal-request', m => {m.nativeBeginFreshNeighborRequested = 'true';}],
  ['observer-not-enabled', m => {m.referenceProposalObserverEnabled = false;}],
  ['peer-ready-vote-invented', m => {m.referenceProposalReadyVotesSent = 1;}],
  ['peer-loaded-vote-invented', m => {m.referenceProposalLoadedVotesSent = 1;}],
  ['proposal-event-missing', m => {m.observedProposalEvents = [];}],
  ['proposal-event-committed', m => {m.observedProposalEvents[0].stage = 2;}],
  ['proposal-event-hash-changed', m => {m.observedProposalEvents[0].sha256 = '0'.repeat(64);}],
  ['descriptor-hash-changed', m => {m.observedProposalEvents[0].descriptorSha256 = '0'.repeat(64);}],
  ['source-publication-missing', m => {m.proposalSourceFiles = [];}],
  ['source-publication-borrowed', m => {m.proposalSourceFiles[0].path = m.worldSnapshots[1].path;}],
  ['source-publication-hash-changed', m => {m.proposalSourceFiles[0].sha256 = '0'.repeat(64);}],
  ['relay-state-missing', m => {m.proposalRelaySnapshots = [];}],
  ['relay-state-committed', m => {m.proposalRelaySnapshots.at(-1).state.committed = true;}],
  ['relay-state-peer-ready', m => {m.proposalRelaySnapshots.at(-1).state.ready = [1, 2];}],
  ['relay-state-peer-loaded', m => {m.proposalRelaySnapshots.at(-1).state.loaded = [2];}],
  ['relay-state-local-ready-missing', m => {m.proposalRelaySnapshots.at(-1).state.ready = [];}],
  ['actual-protocol-request-missing', m => {m.proposalProtocolRequests = [];}],
  ['actual-protocol-request-hash-changed', m => {m.proposalProtocolRequests[0].sha256 = '0'.repeat(64);}],
  ['native-local-ready-mislabeled-as-peer', m => {
    m.proposalProtocolRequests.find(row => row.op === 12 && row.action === 2).sender = 2;
  }],
]) {
  const changed = structuredClone(report); change(changed);
  await writeFile(scratch, JSON.stringify(changed), {flag:'wx'});
  try {await assert.rejects(inspectCoopProposal(scratch));results.push({name:label, refused:true});}
  finally {await unlink(scratch);}
}
const actual = await inspectCoopProposal(resolve(name));
assert.equal(actual.sourcePublicationFrozenQualified, true);
results.push({name:'actual-original-begin-local-ready-frozen-source', accepted:true});
const sha = b => createHash('sha256').update(b).digest('hex');
await writeFile(resolve(output), JSON.stringify({version:1, report:resolve(name), reportSha256:sha(bytes), results,
  verifierSha256:sha(await readFile(new URL('./inspect-native-coop-proposal.mjs', import.meta.url))),
  controlScriptSha256:sha(await readFile(new URL(import.meta.url))),
  browserUsed:false, nativeProcessesStarted:0, sharedResumeQualified:false}, null, 2)+'\n', {flag:'wx'});
console.log(JSON.stringify({controls:results.length, passed:true}));
