#!/usr/bin/env node
// Original third host load, held writer, real Complete and executed resume.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectCoopWorld,cooperativeKingdoms} from './inspect-native-coop-world.mjs';
import {inspectSavedReturnHost} from './inspect-native-coop-saved-return-host.mjs';
import {inspectSavedRevisitTarget} from './inspect-native-coop-saved-revisit-target.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {compareLoadedKingdomGameplay} from './lib/coop-host-checkpoint-state.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const words=b=>Array.from({length:b.length/4},(_,i)=>b.readUInt32LE(i*4));
async function bounded(name,cap=2*1024*1024) {
  const s=await stoppedFileSource(name);assert.ok(s.size<=cap);const b=Buffer.alloc(s.size);
  for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;
}
async function copied(row,cap) {
  assert.ok(row);const b=await bounded(row.copy??row.path,cap);assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256);return b;
}
export async function inspectSavedRevisitHost(name,baselineName) {
  const report=resolve(name),raw=await bounded(report),m=JSON.parse(raw),startup=await inspectCoopWorld(report);
  assert.equal(startup.originalRole,'host');assert.equal(startup.scriptCompleted,true);assert.ok(!m.referenceError&&!m.stopReason);
  for(const key of ['replaySavedRevisitRecipientRequested','nativeLaterTravelSnapshotRequested',
    'originalCurrentRevisitSourceSaved','replaySavedHomeGuestInputsRequested'])assert.equal(m[key],true,key);
  assert.equal(m.referenceReplayedThirdRecipientReadyVotes,1);assert.equal(m.referenceReplayedThirdRecipientLoadedVotes,1);
  const baselineProof=resolve(baselineName),baselineRaw=await bounded(baselineProof),recordedBaseline=JSON.parse(baselineRaw);
  const baseline=await inspectSavedReturnHost(recordedBaseline.report);
  assert.deepEqual(recordedBaseline,baseline);
  const previous=JSON.parse(await bounded(baseline.report));assert.equal(previous.nativeExecutableSha256,m.nativeExecutableSha256);
  const root=join(workspace,`output/native-multiplayer-lobby-${String(m.attempt).padStart(3,'0')}`);
  assert.equal(sha(await bounded(join(root,'native_coop_saved_revisit_votes.py'))),m.savedRevisitRecipientReplayHelperSha256);
  const inputs=m.savedRevisitRecipientReplayInputs;assert.equal(inputs.length,7);const data=[];
  for(const [i,row]of inputs.entries()) {
    assert.ok(row.copy.startsWith(join(root,`captured-host-inputs/revisit-recipient-source-${String(i).padStart(3,'0')}-`)));
    data.push(await copied(row));
  }
  const recorded=JSON.parse(data[0]),recipient=await inspectSavedRevisitTarget(recorded.report,recorded.baselineProof);
  assert.deepEqual(recorded,recipient);assert.equal(sha(data[1]),recipient.reportSha256);
  assert.equal(JSON.parse(data[1]).nativeExecutableSha256,m.nativeExecutableSha256);
  for(let i=0;i<2;i++) {
    assert.equal(inputs[i+2].source,recipient.capturedRecipientThirdRequests[i].copy);
    assert.ok(data[i+2].equals(await copied(recipient.capturedRecipientThirdRequests[i],2048)));
  }
  const proposal=recipient.host,descriptor=data[2].subarray(32),fields=descriptor.toString('ascii').trimEnd().split('\n');
  assert.equal(fields.length,22);assert.equal(sha(descriptor),proposal.descriptorSha256);
  assert.equal(inputs[4].source,proposal.report);assert.equal(sha(data[4]),proposal.reportSha256);
  assert.equal(inputs[5].source,proposal.current.path);assert.equal(inputs[6].source,proposal.currentMarker.path);
  assert.ok(data[5].equals(await copied(proposal.current)));assert.ok(data[6].equals(await copied(proposal.currentMarker,768)));
  assert.equal(m.importedSavedRevisitSource.length,2);
  for(let i=0;i<2;i++) {
    assert.equal(m.importedSavedRevisitSource[i].copy,join(m.profile,'captured-travel-source-3',i?'source.checkpoint':'source_1.GMP'));
    assert.ok((await copied(m.importedSavedRevisitSource[i])).equals(data[i+5]));
  }
  // Earlier actual SDK requests and completion events must remain unchanged.
  const earlier=m.proposalProtocolRequests.filter(r=>r.op===12&&r.action>0);
  const prior=previous.proposalProtocolRequests.filter(r=>r.op===12&&r.action>0);assert.ok(earlier.length>prior.length);
  const seen=new Set();
  for(const row of earlier.slice(0,prior.length)) {
    const body=(await copied(row,2048)).subarray(20),serial=body.readUInt32LE(4),key=`${row.sender}:${serial}:${row.action}`;
    assert.ok([1,2].includes(serial));assert.ok(!seen.has(key));seen.add(key);
    const matches=[];
    for(const old of prior)if(old.sender===row.sender&&old.action===row.action&&
      (await copied(old,2048)).subarray(20).equals(body))matches.push(old);
    assert.equal(matches.length,1);
  }
  for(const key of ['observedProposalEvents','observedSavedReturnEvents']) {
    assert.equal(m[key].length,3);
    for(let i=0;i<3;i++)assert.ok((await copied(m[key][i],2048)).equals(await copied(previous[key][i],2048)));
  }
  for(const key of ['savedReturnRecipientReplayInputs','savedHomeInputReplaySources']) {
    const reference=key==='savedHomeInputReplaySources'?JSON.parse(data[4]):previous;
    assert.equal(m[key].length,reference[key].length);
    for(let i=0;i<m[key].length;i++) {
      assert.equal(m[key][i].source,reference[key][i].source);
      assert.ok((await copied(m[key][i])).equals(await copied(reference[key][i])));
    }
  }
  const originalProposal=JSON.parse(data[4]);assert.equal(m.replayedSavedHomeInputPackets.length,7);assert.equal(m.savedHomeInputServerAcks.length,7);
  for(let i=0;i<7;i++) {
    const sent=m.replayedSavedHomeInputPackets[i],ack=m.savedHomeInputServerAcks[i];
    assert.deepEqual(sent,originalProposal.replayedSavedHomeInputPackets[i]);
    const payload=await copied(m.savedHomeInputReplaySources[i+2],20);
    assert.equal(sent.bytes,payload.length);assert.equal(sent.sha256,sha(payload));
    assert.equal(ack.sequence,sent.sequence);assert.deepEqual(words(await copied(ack,24)),[0x31525044,1,108,0,0,sent.sequence]);
  }
  const prefix=join(m.profile,'Documents/My Games/MajestyHD/SaveGame/CoopTransitions_native-terrain-fixture_');
  assert.equal(m.proposalSourceFiles.length,3);assert.equal(m.savedReturnSourceFiles.length,2);
  const current=m.proposalSourceFiles.find(r=>r.path===prefix+'0_0_1.GMP');
  const currentMarker=m.proposalSourceFiles.find(r=>r.path===prefix+'0_0.checkpoint');
  assert.ok((await copied(current)).equals(data[5]));assert.ok((await copied(currentMarker,768)).equals(data[6]));
  const oldHome=m.proposalSourceFiles.find(r=>r.path===prefix+'0_0_0.GMP');assert.ok((await copied(oldHome)).equals(await copied(proposal.oldHome)));
  const neighbor=m.savedReturnSourceFiles.find(r=>r.path===prefix+'1_0_0.GMP');
  assert.ok((await copied(neighbor)).equals(await copied(proposal.neighbor)));
  const neighborMarker=m.savedReturnSourceFiles.find(r=>r.path===prefix+'1_0.checkpoint');
  assert.ok((await copied(neighborMarker,768)).equals(await copied(baseline.marker,768)));
  assert.equal(m.currentRevisitSourceSnapshot.path,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Coop_World_Travel_Source_3.GMP'));
  await copied(m.currentRevisitSourceSnapshot);
  const liveSource=await connectedWorldState(m.currentRevisitSourceSnapshot.path),sourceState=await connectedWorldState(current.path);
  assert.equal(liveSource.clock,1650);assert.equal(sourceState.clock,1650);const sourceComparison=compareConnectedWorlds(sourceState,liveSource);
  assert.equal(m.laterTravelTargetSnapshots.length,1);const target=m.laterTravelTargetSnapshots[0];
  assert.equal(target.path,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Coop_World_Travel_Target_3.GMP'));await copied(target);
  const targetState=await connectedWorldState(target.path),savedState=await connectedWorldState(neighbor.path);
  assert.equal(targetState.clock,1550);const targetComparison=compareConnectedWorlds(savedState,targetState);
  const crossRoleComparison=await compareLoadedKingdomGameplay(targetState,await connectedWorldState(recipient.targetFullSnapshot.path),2);
  const kingdoms=await cooperativeKingdoms(target.path,[0,1]);assert.deepEqual(kingdoms,recipient.targetKingdoms);
  const third=earlier.slice(prior.length);assert.deepEqual(third.map(r=>[r.sender,r.action]),[[1,1],[1,2],[2,2],[1,3],[2,3]]);
  for(const r of third) {
    const b=await copied(r,2048);assert.deepEqual(words(b.subarray(0,32)),[0x31525044,1,12,r.request,0,r.action,3,descriptor.length]);
    assert.ok(b.subarray(32).equals(descriptor));
    if(r.sender===2)assert.ok(b.subarray(20).equals(data[r.action].subarray(20)));
  }
  assert.equal(m.observedRevisitEvents.length,3);
  for(const [i,row]of m.observedRevisitEvents.entries()) {
    assert.equal(row.copy,join(root,`owned-lobby-packets/revisit-${String(i).padStart(3,'0')}.bin`));
    assert.deepEqual([row.serial,row.stage,row.players,row.descriptorSha256],[3,i+1,[1,2],sha(descriptor)]);
    const b=await copied(row,2048);assert.deepEqual(words(b.subarray(0,12)),[3,i+1,descriptor.length]);
    assert.ok(b.subarray(12,12+descriptor.length).equals(descriptor));assert.deepEqual(words(b.subarray(12+descriptor.length)),[2,1,2]);
  }
  const resumes=[];
  for(const row of m.lobbyPacketMetadata) {
    const b=await copied(row,65536);assert.deepEqual([row.sender,row.recipient],[1,2]);
    if(b.readUInt32LE(0)===256&&b.readUInt32LE(4)===4) {
      assert.equal(b.length,60);assert.deepEqual(words(Buffer.from(b.subarray(8)).map(x=>x^49)),[48,1,0,0,1,24,9,1,1,0,50,0,0]);resumes.push(row);
    }
  }
  assert.equal(resumes.length,3);
  const log=(await bounded(join(root,'native.log'),4*1024*1024)).toString();
  const markers=['[coop-travel-source-import-fixture] Imported epoch=1 serial=3 source=0_0 revision=2 frame=22 clock=1650 current-original-writer=1 original-world-unmodified=1',
    '[coop-load] Saved source teardown epoch=1 serial=3 pause-held=1 loaded=1','[coop-load] Attached epoch=1 serial=3 slot=0',
    '[coop-load] Held epoch=1 serial=3 slot=0 clock=1550','[coop-load] Loaded epoch=1 serial=3 slot=0'];
  let at=-1;for(const marker of markers){assert.equal(log.split('\n').filter(l=>l===marker).length,1,marker);assert.ok(log.indexOf(marker)>at);at=log.indexOf(marker);}
  const pattern=/^\[coop-travel-target-fixture\] Snapshot epoch=1 serial=3 local=1 slot=0 region=1_0 saved=1 frame=0 clock=1550 original-writer=1 source-retained=1 coordinator-loaded=1 peer-loaded=0 resume-controls=0 live-second-engine=0 heap-bytes=(\d+) blocks=(\d+)$/gm;
  const matches=[...log.matchAll(pattern)];assert.equal(matches.length,1);assert.ok(matches[0].index>at);
  assert.ok(Number(matches[0][1])>0&&Number(matches[0][2])>0);at=matches[0].index;
  for(const marker of ['[coop-load] Resume queued epoch=1 serial=3','[coop-load] Resumed epoch=1 serial=3 region=1_0']) {
    assert.equal(log.split('\n').filter(l=>l===marker).length,1);assert.ok(log.indexOf(marker)>at);at=log.indexOf(marker);
  }
  assert.ok(!/\[coop-(?:load|transfer)\] Rejected|Request refused/.test(log));
  const resources=log.split('\n').filter(l=>l.startsWith('[coop-load] Resources epoch=1 serial='));assert.equal(resources.length,3);
  return {version:1,report,reportSha256:sha(raw),startup,baselineProof,baselineProofSha256:sha(baselineRaw),baseline,recipient,
    descriptorSha256:sha(descriptor),current,currentMarker,oldHome,neighbor,neighborMarker,snapshot:target,
    currentSourceSnapshot:m.currentRevisitSourceSnapshot,sourceComparison,targetComparison,crossRoleComparison,kingdoms,
    originalHostThirdSavedReaderLoadedQualified:true,originalHostThirdHeldWorldPreservedQualified:true,
    originalPausedThirdSourceGameplayPreservedQualified:true,actualThirdCompleteQualified:true,
    originalHostThirdResumeQueuedQualified:true,originalHostThirdResumeExecutedQualified:true,
    capturedHostThirdRequests:third.filter(r=>r.sender===1),capturedThirdResume:resumes[2],resourceObservations:resources,
    thirdHeldResources:{heapBytes:Number(matches[0][1]),blocks:Number(matches[0][2])},
    bothThirdRolesResumedQualified:false,livePairedSynchronizationQualified:false,boundedRepeatedResidencyQualified:false,browserUsed:false,goalComplete:false,
    verifierInputs:{...startup.verifierInputs,...recipient.verifierInputs,'scripts/inspect-native-coop-saved-revisit-host.mjs':sha(await readFile(new URL(import.meta.url)))}};
}
if(process.argv[1]===new URL(import.meta.url).pathname) {
  try {assert.equal(process.argv.length,5);const p=await inspectSavedRevisitHost(process.argv[2],process.argv[3]);
    await writeFile(resolve(process.argv[4]),JSON.stringify(p,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({thirdHostResumed:true,thirdSourceAndTargetPreserved:true,bothThirdRolesResumed:false}));
  }catch(e){console.error(JSON.stringify({error:e.name,message:String(e.message).split('\n')[0],at:e.stack?.split('\n').filter(l=>l.trim().startsWith('at ')).slice(0,2)}));process.exitCode=1;}
}
