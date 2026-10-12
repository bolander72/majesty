#!/usr/bin/env node
// Extend the qualified original saved-home recipient with actual host inputs.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectCoopWorld} from './inspect-native-coop-world.mjs';
import {inspectSavedReturnResume} from './inspect-native-coop-saved-return-resume.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(path,cap=2*1024*1024) {
  const s=await stoppedFileSource(path);assert.ok(s.size<=cap);const b=Buffer.alloc(s.size);
  for(let i=0;i<b.length;i+=4096)b.set(await s.readAt(i,Math.min(4096,b.length-i)),i);return b;
}
async function copied(r,cap) {
  const b=await bounded(r.copy??r.path,cap);assert.equal(b.length,r.bytes);assert.equal(sha(b),r.sha256);return b;
}
const words=b=>Array.from({length:b.length/4},(_,i)=>b.readUInt32LE(i*4));
export async function inspectSavedHomeStream(name,baselineName) {
  const report=resolve(name),raw=await bounded(report),m=JSON.parse(raw),startup=await inspectCoopWorld(report);
  assert.equal(startup.originalRole,'guest');assert.equal(startup.scriptCompleted,true);
  assert.equal(m.replaySavedHomeHostInputsRequested,true);assert.equal(m.capturedOriginalSecondHostResumeDelivered,true);
  assert.ok(!m.referenceError&&!m.stopReason);
  const baselineProof=resolve(baselineName),priorRaw=await bounded(baselineProof),prior=JSON.parse(priorRaw);
  const baseline=await inspectSavedReturnResume(prior.report);
  for(const k of ['reportSha256','descriptorSha256','snapshot','verifierInputs'])assert.deepEqual(prior[k],baseline[k]);
  const baseRaw=await bounded(baseline.report);assert.equal(sha(baseRaw),baseline.reportSha256);const base=JSON.parse(baseRaw);
  assert.equal(base.nativeExecutableSha256,m.nativeExecutableSha256);
  const root=join(workspace,`output/native-multiplayer-lobby-${String(m.attempt).padStart(3,'0')}`);
  assert.equal(sha(await bounded(join(root,'native_coop_saved_return_resume.py'))),m.savedReturnResumeHelperSha256);
  const inputs=m.hostCompletionReplayInputs;assert.equal(inputs.length,base.hostCompletionReplayInputs.length+5);
  for(let i=0;i<base.hostCompletionReplayInputs.length;i++) {
    assert.equal(inputs[i].source,base.hostCompletionReplayInputs[i].source);
    assert.ok((await copied(inputs[i])).equals(await copied(base.hostCompletionReplayInputs[i])));
  }
  const hostRaw=await bounded(baseline.host.report);assert.equal(sha(hostRaw),baseline.host.reportSha256);const host=JSON.parse(hostRaw);
  const resumeAt=host.lobbyPacketMetadata.findIndex(r=>r.copy===baseline.host.capturedSecondResume.copy);
  assert.ok(resumeAt>=0&&host.lobbyPacketMetadata.length<=128);
  const hostRows=host.lobbyPacketMetadata.slice(resumeAt+1,resumeAt+6);assert.equal(hostRows.length,5);const homePackets=[];
  for(let i=0;i<5;i++) {
    const r=inputs[base.hostCompletionReplayInputs.length+i];assert.equal(r.source,hostRows[i].copy);
    const b=await copied(r,20);assert.ok(b.equals(await copied(hostRows[i],20)));
    assert.deepEqual([hostRows[i].sender,hostRows[i].recipient],[1,2]);assert.deepEqual(words(b.subarray(0,8)),[256,5]);
    assert.deepEqual(words(Buffer.from(b.subarray(8)).map(x=>x^49)),[10+2*i,0,50]);homePackets.push(b);
  }
  assert.deepEqual(m.replayedHostPackets.slice(0,base.replayedHostPackets.length),base.replayedHostPackets);
  assert.equal(m.replayedHostPackets.length,base.replayedHostPackets.length+5);
  assert.deepEqual(m.capturedOriginalSecondHostResumeInputs,[...base.capturedOriginalSecondHostResumeInputs,
    ...homePackets.map(b=>({bytes:20,sha256:sha(b)}))]);
  for(let i=0;i<5;i++)assert.deepEqual(m.replayedHostPackets[base.replayedHostPackets.length+i],
    {sequence:base.replayedHostPackets.length+1+i,bytes:20,sha256:sha(homePackets[i])});
  assert.equal(m.proposalProtocolRequests.length,base.proposalProtocolRequests.length);
  for(let i=0;i<m.proposalProtocolRequests.length;i++) {
    const r=m.proposalProtocolRequests[i],old=base.proposalProtocolRequests[i],b=await copied(r,16424);
    assert.equal(r.copy,join(root,`owned-lobby-packets/proposal-rpc-${String(i).padStart(3,'0')}.bin`));
    assert.deepEqual([r.sender,r.host,r.op,r.action],[old.sender,old.host,old.op,old.action]);
    assert.deepEqual(words(b.subarray(0,24)),[0x31525044,1,r.op,r.request,0,r.action]);
    assert.ok(b.subarray(20).equals((await copied(old,16424)).subarray(20)));
  }
  assert.equal(m.savedReturnCheckpointEvents.length,base.savedReturnCheckpointEvents.length);
  for(let i=0;i<m.savedReturnCheckpointEvents.length;i++)assert.ok((await copied(m.savedReturnCheckpointEvents[i],20)).equals(await copied(base.savedReturnCheckpointEvents[i],20)));
  assert.deepEqual(m.observedSavedReturnEvents.map(r=>[r.serial,r.stage,r.players,r.descriptorSha256]),
    base.observedSavedReturnEvents.map(r=>[r.serial,r.stage,r.players,r.descriptorSha256]));
  for(let i=0;i<3;i++)assert.ok((await copied(m.observedSavedReturnEvents[i],2048)).equals(await copied(base.observedSavedReturnEvents[i],2048)));
  assert.equal(m.referenceSecondHostLoadedVotesSent,1);assert.equal(m.originalHomeCheckpointTransferSha256,base.originalHomeCheckpointTransferSha256);
  await copied(m.savedReturnTargetSnapshot);
  const target=await connectedWorldState(m.savedReturnTargetSnapshot.path);assert.equal(target.clock,550);
  const comparison=compareConnectedWorlds(await connectedWorldState(base.savedReturnTargetSnapshot.path),target);
  const frames=[],homeRows=[];
  for(const [i,r]of m.lobbyPacketMetadata.entries()) {
    assert.deepEqual([r.sequence,r.sender,r.recipient],[i+1,2,1]);const b=await copied(r,65536);
    if(b.readUInt32LE(0)===256&&b.readUInt32LE(4)===5) {
      assert.equal(b.length,20);const w=words(Buffer.from(b.subarray(8)).map(x=>x^49));assert.deepEqual(w.slice(1),[0,50]);frames.push(w[0]);homeRows.push(r);
    }
  }
  assert.deepEqual(frames,[10,12,14,16,18,20,...Array.from({length:16},(_,i)=>10+2*i),...Array.from({length:10},(_,i)=>10+2*i)]);
  const log=(await bounded(join(root,'native.log'),4*1024*1024)).toString();
  assert.ok(!/\[coop-(?:load|transfer)\] Rejected/.test(log));assert.ok(log.includes('[coop-load] Resumed epoch=1 serial=2 region=0_0'));
  const peeks=[...log.matchAll(/\[smoke\] peek 0071c6a8\+4:\n\s+0071c6a8\s+([0-9a-f]{2})\s+([0-9a-f]{2})\s+([0-9a-f]{2})\s+([0-9a-f]{2})/g)];
  assert.equal(peeks.length,1);const originalClock=Buffer.from(peeks[0].slice(1).map(x=>parseInt(x,16))).readUInt32LE();assert.equal(originalClock,1550);
  return {version:1,report,reportSha256:sha(raw),baselineProof,baselineProofSha256:sha(priorRaw),startup,baseline,
    descriptorSha256:baseline.descriptorSha256,snapshot:m.savedReturnTargetSnapshot,heldHomeComparison:comparison,
    bothRecordedReturningRolesResumedQualified:true,savedHomeGameplayPreservedQualified:true,originalSavedHomeStreamQualified:true,
    actualOriginalClock:originalClock,originalHomeHostInputPackets:5,capturedHomeRecipientInputPackets:homeRows.slice(-10),
    postProgressFullWorldComparisonQualified:false,
    verifierInputs:{...startup.verifierInputs,...Object.fromEntries(await Promise.all([
      'scripts/inspect-native-coop-saved-home-stream.mjs','scripts/inspect-native-coop-saved-return-resume.mjs'
    ].map(async p=>[p,sha(await readFile(join(workspace,p)))])))},
    thirdSharedLoadQualified:false,repeatedCooperativeResidencyQualified:false,livePairedSynchronizationQualified:false,browserUsed:false,goalComplete:false};
}
if(process.argv[1]===new URL(import.meta.url).pathname) {
  try {assert.equal(process.argv.length,5);const p=await inspectSavedHomeStream(process.argv[2],process.argv[3]);
    await writeFile(resolve(process.argv[4]),JSON.stringify(p,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({originalHomeClock:p.actualOriginalClock,actualRecipientHomePackets:10,thirdSharedLoad:false}));
  }catch(e){console.error(JSON.stringify({error:e.name,message:String(e.message).split('\n')[0],
    at:e.stack?.split('\n').filter(l=>l.trim().startsWith('at ')).slice(0,2)}));process.exitCode=1;}
}
