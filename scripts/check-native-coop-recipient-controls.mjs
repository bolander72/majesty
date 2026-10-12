#!/usr/bin/env node
// Corrupt only report copies; never starts a browser or native engine.
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {inspectRecipientProposal} from './inspect-native-coop-recipient-proposal.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';

const [name,output]=process.argv.slice(2);assert.equal(process.argv.length,4);
const raw=await readFile(resolve(name)),m=JSON.parse(raw);
const scratch=join(workspace,'output/native-multiplayer-lobby-976-observed.json'),results=[];
const cases=[
  ['proposal-replay-missing',r=>{r.replayHostProposalRequested=false;}],
  ['proposal-replay-not-boolean',r=>{r.replayHostProposalRequested='true';}],
  ['incoming-pause-missing',r=>{r.nativeIncomingHostPauseObservationRequested=false;}],
  ['host-proposal-not-delivered',r=>{r.capturedOriginalHostProposalDelivered=false;}],
  ['invented-host-loaded',r=>{r.referenceHostLoadedVotesSent=1;}],
  ['captured-host-ready-missing',r=>{r.referenceReplayedHostReadyVotes=0;}],
  ['proposal-helper-changed',r=>{r.proposalReplayHelperSha256='0'.repeat(64);}],
  ['observer-helper-changed',r=>{r.proposalObserverSha256='0'.repeat(64);}],
  ['captured-proposal-input-missing',r=>{r.proposalReplayInputs.pop();}],
  ['captured-proposal-input-corrupt',r=>{r.proposalReplayInputs[1].sha256='0'.repeat(64);}],
  ['host-body-changed',r=>{r.replayedOriginalHostProposalBodies[1].sha256='0'.repeat(64);}],
  ['host-body-borrowed',r=>{r.replayedOriginalHostProposalBodies[0].source=r.replayedOriginalHostProposalBodies[1].source;}],
  ['actual-recipient-ready-missing',r=>{r.proposalProtocolRequests.splice(6,1);}],
  ['actual-recipient-loaded-missing',r=>{r.proposalProtocolRequests.pop();}],
  ['recipient-loaded-labeled-host',r=>{r.proposalProtocolRequests[7].sender=1;r.proposalProtocolRequests[7].host=true;}],
  ['recipient-loaded-wire-corrupt',r=>{r.proposalProtocolRequests[7].sha256='0'.repeat(64);}],
  ['commit-event-missing',r=>{r.observedProposalEvents.pop();}],
  ['commit-event-completed',r=>{r.observedProposalEvents[1].stage=3;}],
  ['commit-event-roster-changed',r=>{r.observedProposalEvents[1].players=[1,3];}],
  ['commit-event-descriptor-corrupt',r=>{r.observedProposalEvents[1].descriptorSha256='0'.repeat(64);}],
  ['relay-remains-prepared',r=>{r.proposalRelaySnapshots.at(-1).state.committed=false;}],
  ['relay-missing-recipient-ready',r=>{r.proposalRelaySnapshots.at(-1).state.ready=[1];}],
  ['relay-missing-recipient-loaded',r=>{r.proposalRelaySnapshots.at(-1).state.loaded=[];}],
  ['relay-invented-host-loaded',r=>{r.proposalRelaySnapshots.at(-1).state.loaded=[1,2];}],
];
if (m.nativeLoadedTargetSnapshotRequested === true) cases.push(
  ['target-snapshot-request-missing',r=>{r.nativeLoadedTargetSnapshotRequested=false;}],
  ['target-snapshot-request-not-boolean',r=>{r.nativeLoadedTargetSnapshotRequested='true';}],
  ['target-snapshot-not-saved',r=>{r.originalLoadedTargetSaved=false;}],
  ['target-snapshot-borrowed-source',r=>{r.loadedTargetSnapshot.path=r.worldSnapshots[1].path;}],
  ['target-snapshot-hash-changed',r=>{r.loadedTargetSnapshot.sha256='0'.repeat(64);}],
  ['target-snapshot-length-changed',r=>{r.loadedTargetSnapshot.bytes-=1;}]);
for (const [label,change] of cases) {
  const changed=structuredClone(m);change(changed);
  await writeFile(scratch,JSON.stringify(changed),{flag:'wx'});
  try {await assert.rejects(inspectRecipientProposal(scratch));results.push({name:label,refused:true});}
  finally {await unlink(scratch);}
}
const actual=await inspectRecipientProposal(resolve(name));
assert.equal(actual.actualRecipientSdkLoadedExecutedQualified,true);
results.push({name:'actual-recipient-ready-committed-generation-rebuild-loaded',accepted:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
await writeFile(resolve(output),JSON.stringify({version:1,report:resolve(name),reportSha256:sha(raw),results,
  verifierSha256:sha(await readFile(new URL('./inspect-native-coop-recipient-proposal.mjs',import.meta.url))),
  controlScriptSha256:sha(await readFile(new URL(import.meta.url))),browserUsed:false,nativeProcessesStarted:0,
  targetFullSaveInspected:actual.targetFullSaveInspected,sharedResumeQualified:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({controls:results.length,passed:true}));
