#!/usr/bin/env node
// Recipient third Complete/resume with independently preserved held gameplay.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectCoopWorld,cooperativeKingdoms} from './inspect-native-coop-world.mjs';
import {inspectSavedRevisitHost} from './inspect-native-coop-saved-revisit-host.mjs';
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
export async function inspectSavedRevisitResume(name,baselineName) {
  const report=resolve(name),raw=await bounded(report),m=JSON.parse(raw),startup=await inspectCoopWorld(report);
  assert.equal(startup.originalRole,'guest');assert.equal(startup.scriptCompleted,true);assert.ok(!m.referenceError&&!m.stopReason);
  for(const key of ['replaySavedRevisitCompletionRequested','nativeLaterTravelSnapshotRequested',
    'capturedOriginalThirdHostResumeDelivered','capturedSavedRevisitLoadedDelivered'])assert.equal(m[key],true,key);
  assert.equal(m.referenceThirdHostReadyVotesSent,1);assert.equal(m.referenceThirdHostLoadedVotesSent,1);
  const baselineProof=resolve(baselineName),baselineRaw=await bounded(baselineProof),recordedBaseline=JSON.parse(baselineRaw);
  const baseline=await inspectSavedRevisitTarget(recordedBaseline.report,recordedBaseline.baselineProof);assert.deepEqual(recordedBaseline,baseline);
  const base=JSON.parse(await bounded(baseline.report));assert.equal(base.nativeExecutableSha256,m.nativeExecutableSha256);
  const root=join(workspace,`output/native-multiplayer-lobby-${String(m.attempt).padStart(3,'0')}`);
  assert.equal(sha(await bounded(join(root,'native_coop_saved_revisit_resume.py'))),m.savedRevisitResumeHelperSha256);
  const inputs=m.hostCompletionReplayInputs;assert.equal(inputs.length,base.hostCompletionReplayInputs.length+6);
  for(let i=0;i<base.hostCompletionReplayInputs.length;i++) {
    assert.equal(inputs[i].source,base.hostCompletionReplayInputs[i].source);
    assert.ok((await copied(inputs[i])).equals(await copied(base.hostCompletionReplayInputs[i])));
  }
  const recorded=JSON.parse(await copied(inputs.at(-6))),host=await inspectSavedRevisitHost(recorded.report,recorded.baselineProof);
  assert.deepEqual(recorded,host);assert.equal(host.descriptorSha256,baseline.descriptorSha256);
  assert.equal(inputs.at(-5).source,host.report);assert.equal(sha(await copied(inputs.at(-5))),host.reportSha256);
  const hostReport=JSON.parse(await bounded(host.report));assert.equal(hostReport.nativeExecutableSha256,m.nativeExecutableSha256);
  for(let i=0;i<3;i++) {
    assert.equal(inputs.at(-4+i).source,host.capturedHostThirdRequests[i].copy);
    assert.ok((await copied(inputs.at(-4+i),2048)).equals(await copied(host.capturedHostThirdRequests[i],2048)));
  }
  assert.equal(inputs.at(-1).source,host.capturedThirdResume.copy);assert.ok((await copied(inputs.at(-1),60)).equals(await copied(host.capturedThirdResume,60)));
  const descriptor=(await copied(inputs.at(-2),2048)).subarray(32);assert.equal(sha(descriptor),baseline.descriptorSha256);
  assert.deepEqual(m.replayedSavedRevisitLoadedBody,{source:host.capturedHostThirdRequests[2].copy,bytes:descriptor.length+12,
    sha256:sha((await copied(inputs.at(-2),2048)).subarray(20))});
  // Preserve every earlier actual checkpoint RPC and SDK vote body.
  assert.equal(m.proposalProtocolRequests.length,base.proposalProtocolRequests.length+1);
  for(let i=0;i<base.proposalProtocolRequests.length;i++) {
    const actual=m.proposalProtocolRequests[i],prior=base.proposalProtocolRequests[i];
    assert.deepEqual([actual.sender,actual.host,actual.op,actual.action],[prior.sender,prior.host,prior.op,prior.action]);
    assert.ok((await copied(actual,65536)).subarray(20).equals((await copied(prior,65536)).subarray(20)));
  }
  const last=m.proposalProtocolRequests.at(-1),lastBytes=await copied(last,2048);
  assert.deepEqual([last.sender,last.host,last.op,last.action],[1,true,12,3]);
  assert.deepEqual(words(lastBytes.subarray(0,32)),[0x31525044,1,12,last.request,0,3,3,descriptor.length]);
  assert.ok(lastBytes.subarray(20).equals((await copied(inputs.at(-2),2048)).subarray(20)));
  assert.equal(m.originalNeighborCheckpointTransferCompleted,true);assert.equal(m.originalNeighborCheckpointTransferSha256,base.originalNeighborCheckpointTransferSha256);
  for(const key of ['observedProposalEvents','observedSavedReturnEvents']) {
    assert.equal(m[key].length,3);for(let i=0;i<3;i++)assert.ok((await copied(m[key][i],2048)).equals(await copied(base[key][i],2048)));
  }
  assert.equal(m.observedSavedRevisitEvents.length,3);
  for(const [i,row]of m.observedSavedRevisitEvents.entries()) {
    assert.equal(row.copy,join(root,`owned-lobby-packets/saved-revisit-event-${String(i).padStart(3,'0')}.bin`));
    assert.deepEqual([row.serial,row.stage,row.players,row.descriptorSha256],[3,i+1,[1,2],sha(descriptor)]);
    assert.ok((await copied(row,2048)).equals(await copied(hostReport.observedRevisitEvents[i],2048)));
  }
  assert.equal(m.laterTravelTargetSnapshots.length,1);const target=m.laterTravelTargetSnapshots[0];
  assert.equal(target.path,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Coop_World_Travel_Target_3.GMP'));await copied(target);
  const targetState=await connectedWorldState(target.path);assert.equal(targetState.clock,1550);
  const baselineTargetComparison=compareConnectedWorlds(await connectedWorldState(baseline.targetFullSnapshot.path),targetState);
  const hostTargetComparison=await compareLoadedKingdomGameplay(await connectedWorldState(host.snapshot.path),targetState,2);
  const kingdoms=await cooperativeKingdoms(target.path,[0,1]);assert.deepEqual(kingdoms,host.kingdoms);
  const prefix=join(m.profile,'Documents/My Games/MajestyHD/SaveGame/CoopTransitions_native-terrain-fixture_');
  assert.equal(m.proposalSourceFiles.length,3);assert.equal(m.savedReturnSourceFiles.length,3);
  const homeMarker=m.proposalSourceFiles.find(r=>r.path===prefix+'0_0.checkpoint'),fields=(await copied(homeMarker,768)).toString('ascii').trimEnd().split('\n');
  assert.equal(fields.length,12);assert.deepEqual(fields.slice(5,10),['0','0','22','1650','2']);
  const current=m.proposalSourceFiles.find(r=>r.path===prefix+'0_0_'+fields[1]+'.GMP');await copied(current);
  assert.equal(fields[10],String(current.bytes));assert.equal(fields[11],current.sha256);
  const homeComparison=compareConnectedWorlds(await connectedWorldState(baseline.current.path),await connectedWorldState(current.path));
  const oldHome=m.proposalSourceFiles.find(r=>r.path===prefix+'0_0_'+(1-Number(fields[1]))+'.GMP');
  const baseOld=base.proposalSourceFiles.find(r=>r.path.endsWith('_0_0_'+(1-Number(fields[1]))+'.GMP'));
  assert.ok((await copied(oldHome)).equals(await copied(baseOld)));
  const neighborMarker=m.savedReturnSourceFiles.find(r=>r.path===prefix+'1_0.checkpoint'),neighborFields=(await copied(neighborMarker,768)).toString('ascii').trimEnd().split('\n');
  const neighbor=m.savedReturnSourceFiles.find(r=>r.path===prefix+'1_0_'+neighborFields[1]+'.GMP');
  assert.ok((await copied(neighbor)).equals(await copied(baseline.target)));assert.equal(neighborFields[8],'1550');assert.equal(neighborFields[9],'1');
  assert.deepEqual(m.capturedOriginalThirdHostResumeInputs,[{bytes:60,sha256:host.capturedThirdResume.sha256}]);
  const log=(await bounded(join(root,'native.log'),4*1024*1024)).toString();
  const pattern=/^\[coop-travel-target-fixture\] Snapshot epoch=1 serial=3 local=2 slot=1 region=1_0 saved=1 frame=0 clock=1550 original-writer=1 source-retained=1 coordinator-loaded=1 peer-loaded=0 resume-controls=0 live-second-engine=0 heap-bytes=(\d+) blocks=(\d+)$/gm;
  const matches=[...log.matchAll(pattern)];assert.equal(matches.length,1);assert.ok(Number(matches[0][1])>0&&Number(matches[0][2])>0);
  const loaded='[coop-load] Loaded epoch=1 serial=3 slot=1',resumed='[coop-load] Resumed epoch=1 serial=3 region=1_0';
  assert.equal(log.split('\n').filter(l=>l===loaded).length,1);assert.equal(log.split('\n').filter(l=>l===resumed).length,1);
  assert.ok(log.indexOf(loaded)<matches[0].index&&matches[0].index<log.indexOf(resumed));
  assert.ok(!/\[coop-(?:load|transfer)\] Rejected|Request refused/.test(log));
  const resources=log.split('\n').filter(l=>l.startsWith('[coop-load] Resources epoch=1 serial='));assert.equal(resources.length,3);
  return {version:1,report,reportSha256:sha(raw),startup,baselineProof,baselineProofSha256:sha(baselineRaw),baseline,host,
    descriptorSha256:host.descriptorSha256,snapshot:target,current,homeMarker,neighbor,neighborMarker,
    baselineTargetComparison,hostTargetComparison,homeComparison,kingdoms,resourceObservations:resources,
    originalRecipientThirdHeldWorldPreservedQualified:true,actualRecipientThirdCompleteQualified:true,
    originalRecipientThirdResumeExecutedQualified:true,bothThirdRecordedRolesResumedQualified:true,
    livePairedSynchronizationQualified:false,boundedRepeatedResidencyQualified:false,browserUsed:false,goalComplete:false,
    verifierInputs:{...startup.verifierInputs,...host.verifierInputs,...baseline.verifierInputs,
      'scripts/inspect-native-coop-saved-revisit-resume.mjs':sha(await readFile(new URL(import.meta.url)))}};
}
if(process.argv[1]===new URL(import.meta.url).pathname) {
  try {assert.equal(process.argv.length,5);const p=await inspectSavedRevisitResume(process.argv[2],process.argv[3]);
    await writeFile(resolve(process.argv[4]),JSON.stringify(p,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({thirdRecipientResumed:true,bothThirdRecordedRolesResumed:true,livePaired:false}));
  }catch(e){console.error(JSON.stringify({error:e.name,message:String(e.message).split('\n')[0],at:e.stack?.split('\n').filter(l=>l.trim().startsWith('at ')).slice(0,2)}));process.exitCode=1;}
}
