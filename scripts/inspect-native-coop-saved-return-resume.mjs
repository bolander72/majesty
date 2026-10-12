#!/usr/bin/env node
// Qualify the original recipient's second resume using real recorded host bytes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectCoopWorld,cooperativeKingdoms} from './inspect-native-coop-world.mjs';
import {inspectSavedReturnHost} from './inspect-native-coop-saved-return-host.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {compareHostCheckpointGameplay} from './lib/coop-host-checkpoint-state.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(path,cap=2*1024*1024) {
  const s=await stoppedFileSource(path);assert.ok(s.size<=cap);const b=Buffer.alloc(s.size);
  for(let i=0;i<b.length;i+=4096)b.set(await s.readAt(i,Math.min(4096,b.length-i)),i);
  return b;
}
async function copied(r,cap) {
  assert.ok(r);const b=await bounded(r.copy??r.path,cap);assert.equal(b.length,r.bytes);assert.equal(sha(b),r.sha256);return b;
}
const words=b=>Array.from({length:b.length/4},(_,i)=>b.readUInt32LE(i*4));
export async function inspectSavedReturnResume(name) {
  const report=resolve(name),raw=await bounded(report),m=JSON.parse(raw),startup=await inspectCoopWorld(report);
  assert.equal(startup.originalRole,'guest');assert.equal(startup.scriptCompleted,true);
  for(const k of ['replaySavedReturnCompletionRequested','commitSavedReturnRequested','nativeSavedReturnSnapshotRequested',
    'originalSavedReturnTargetSaved','capturedOriginalSecondHostResumeDelivered','originalHomeCheckpointTransferCompleted'])assert.equal(m[k],true,k);
  assert.ok(!m.referenceError&&!m.stopReason);
  assert.equal(m.referenceSecondHostReadyVotesSent,1);assert.equal(m.referenceSecondHostLoadedVotesSent,1);
  const root=join(workspace,`output/native-multiplayer-lobby-${String(m.attempt).padStart(3,'0')}`);
  for(const [file,key]of [['native_coop_saved_return_resume.py','savedReturnResumeHelperSha256'],
    ['native_coop_saved_return_replay.py','savedReturnReplayHelperSha256'],['native_coop_saved_return_inputs.py','savedReturnInputHelperSha256']])
    assert.equal(sha(await bounded(join(root,file))),m[key]);
  const inputs=m.hostCompletionReplayInputs;assert.ok(inputs.length>=29&&inputs.length<=32);
  const bytes=[];
  for(const r of inputs){assert.ok(r.copy.startsWith(join(root,'captured-host-inputs')+'/'));bytes.push(await copied(r));}
  const recorded=JSON.parse(bytes.at(-6));
  const host=await inspectSavedReturnHost(recorded.report);
  for(const k of ['reportSha256','descriptorSha256','capturedHostSecondRequests','capturedSecondResume','verifierInputs'])assert.deepEqual(recorded[k],host[k]);
  assert.equal(sha(bytes.at(-5)),host.reportSha256);
  const h=JSON.parse(bytes.at(-5));assert.equal(h.nativeExecutableSha256,m.nativeExecutableSha256);
  const baseRaw=await bounded(host.recipientTarget.report);assert.equal(sha(baseRaw),host.recipientTarget.reportSha256);
  const base=JSON.parse(baseRaw);assert.equal(base.nativeExecutableSha256,m.nativeExecutableSha256);
  assert.equal(inputs.length,base.hostCompletionReplayInputs.length+6);
  // The previously qualified real transfer/load is replayed byte-for-byte;
  // only the additional actual host Loaded/resume may extend it.
  for(let i=0;i<base.hostCompletionReplayInputs.length;i++) {
    assert.equal(inputs[i].source,base.hostCompletionReplayInputs[i].source);
    assert.ok(bytes[i].equals(await copied(base.hostCompletionReplayInputs[i])));
  }
  const hostVotes=host.capturedHostSecondRequests;
  for(let i=0;i<3;i++){assert.equal(inputs.at(-4+i).source,hostVotes[i].copy);assert.ok(bytes.at(-4+i).equals(await copied(hostVotes[i],2048)));}
  assert.equal(inputs.at(-1).source,host.capturedSecondResume.copy);
  assert.ok(bytes.at(-1).equals(await copied(host.capturedSecondResume,60)));
  const descriptor=bytes.at(-2).subarray(32);assert.equal(sha(descriptor),host.descriptorSha256);
  assert.deepEqual(m.replayedSavedReturnLoadedBody,{source:hostVotes[2].copy,bytes:bytes.at(-2).length-20,sha256:sha(bytes.at(-2).subarray(20))});
  assert.deepEqual(m.capturedOriginalSecondHostResumeInputs,[{bytes:60,sha256:sha(bytes.at(-1))}]);
  assert.deepEqual(m.replayedHostPackets.slice(0,-1),base.replayedHostPackets);
  assert.equal(m.replayedHostPackets.length,base.replayedHostPackets.length+1);
  assert.deepEqual(m.replayedHostPackets.at(-1),{sequence:m.replayedHostPackets.length,bytes:60,sha256:sha(bytes.at(-1))});
  const rows=m.proposalProtocolRequests;assert.equal(rows.length,base.proposalProtocolRequests.length+1);
  for(const [i,r]of rows.entries()) {
    assert.equal(r.copy,join(root,`owned-lobby-packets/proposal-rpc-${String(i).padStart(3,'0')}.bin`));
    const wire=await copied(r,16424);assert.ok(r.request>0);assert.equal(r.host,r.sender===1);
    assert.deepEqual(words(wire.subarray(0,24)),[0x31525044,1,r.op,r.request,0,r.action]);
    if(i<rows.length-1) {
      const old=base.proposalProtocolRequests[i];assert.deepEqual([r.sender,r.host,r.op,r.action],[old.sender,old.host,old.op,old.action]);
      assert.ok(wire.subarray(20).equals((await copied(old,16424)).subarray(20)));
    }else {
      assert.deepEqual([r.sender,r.host,r.op,r.action],[1,true,12,3]);
      assert.ok(wire.subarray(20).equals(bytes.at(-2).subarray(20)));
    }
  }
  assert.equal(m.savedReturnCheckpointEvents.length,base.savedReturnCheckpointEvents.length);
  for(let i=0;i<m.savedReturnCheckpointEvents.length;i++)assert.ok((await copied(m.savedReturnCheckpointEvents[i],20)).equals(await copied(base.savedReturnCheckpointEvents[i],20)));
  assert.equal(m.originalHomeCheckpointTransferredBytes,base.originalHomeCheckpointTransferredBytes);
  assert.equal(m.originalHomeCheckpointTransferSha256,base.originalHomeCheckpointTransferSha256);
  assert.equal(m.observedSavedReturnEvents.length,3);
  for(const [i,r]of m.observedSavedReturnEvents.entries()) {
    assert.deepEqual([r.serial,r.stage,r.players,r.descriptorSha256],[2,i+1,[1,2],host.descriptorSha256]);
    const b=await copied(r,2048);assert.deepEqual(words(b.subarray(0,12)),[2,i+1,descriptor.length]);
    assert.ok(b.subarray(12,12+descriptor.length).equals(descriptor));assert.deepEqual(words(b.subarray(12+descriptor.length)),[2,1,2]);
  }
  const prefix=join(m.profile,'Documents/My Games/MajestyHD/SaveGame/CoopTransitions_native-terrain-fixture_');
  assert.equal(m.savedReturnSourceFiles.length,2);assert.equal(m.proposalSourceFiles.length,3);
  for(const group of ['savedReturnSourceFiles','proposalSourceFiles'])for(const old of base[group]) {
    const row=m[group].find(r=>r.path===prefix+old.path.split('CoopTransitions_native-terrain-fixture_').at(-1));assert.ok(row);
    const b=await copied(row),a=await copied(old);
    if(old.path.endsWith('.GMP')) {
      compareConnectedWorlds(await connectedWorldState(old.path),await connectedWorldState(row.path));
      if(old.path.endsWith('0_0_1.GMP'))assert.ok(b.equals(await copied(host.home)));
    }else {
      const before=a.toString('ascii').trimEnd().split('\n'),after=b.toString('ascii').trimEnd().split('\n');
      assert.equal(before.length,12);assert.equal(after.length,12);assert.deepEqual(after.slice(0,11),before.slice(0,11));
      const region=row.path.slice(prefix.length).replace('.checkpoint','');assert.ok(['0_0','1_0'].includes(region));
      const active=m[group].find(r=>r.path===prefix+region+'_'+after[1]+'.GMP');assert.ok(active);
      assert.equal(after[10],String(active.bytes));assert.equal(after[11],active.sha256);await copied(active);
    }
  }
  const snapshot=m.savedReturnTargetSnapshot;await copied(snapshot);
  assert.equal(snapshot.path,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Coop_World_Return_Target.GMP'));
  const target=await connectedWorldState(snapshot.path);assert.equal(target.clock,550);
  const heldGameplayComparison=compareConnectedWorlds(await connectedWorldState(base.savedReturnTargetSnapshot.path),target);
  const hostGuestGameplayComparison=await compareHostCheckpointGameplay(await connectedWorldState(h.savedReturnTargetSnapshot.path),target);
  const kingdoms=await cooperativeKingdoms(snapshot.path,[0,1]);assert.equal(kingdoms.length,2);assert.ok(kingdoms.every(k=>k.palace.length===1));
  const log=(await bounded(join(root,'native.log'),4*1024*1024)).toString();
  const markers=['[coop-load] Saved source teardown epoch=1 serial=2 pause-held=1 loaded=1',
    '[coop-load] Attached epoch=1 serial=2 slot=1','[coop-load] Held epoch=1 serial=2 slot=1 clock=550','[coop-load] Loaded epoch=1 serial=2 slot=1',
    '[coop-return-fixture] Snapshot epoch=1 serial=2 local=2 slot=1 region=0_0 frame=0 clock=550 original-writer=1 source-retained=1 coordinator-loaded=1 peer-loaded=0 resume-controls=0 live-second-engine=0',
    '[coop-load] Resumed epoch=1 serial=2 region=0_0'];
  let cursor=-1;for(const marker of markers){assert.equal(log.split('\n').filter(l=>l===marker).length,1);assert.ok(log.indexOf(marker)>cursor);cursor=log.indexOf(marker);}
  assert.ok(!/\[coop-(?:load|transfer)\] Rejected/.test(log));
  const resources=log.split('\n').filter(l=>l.startsWith('[coop-load] Resources epoch=1 serial='));assert.equal(resources.length,2);
  return {version:1,report,reportSha256:sha(raw),startup,host,descriptorSha256:host.descriptorSha256,
    originalRecipientSecondResumeExecutedQualified:true,bothRecordedReturningRolesResumedQualified:true,
    savedHomeGameplayPreservedQualified:true,heldGameplayComparison,hostGuestGameplayComparison,snapshot,kingdoms,
    originalClock:550,resourceObservations:resources,
    verifierInputs:{...startup.verifierInputs,...Object.fromEntries(await Promise.all([
      'scripts/inspect-native-coop-saved-return-resume.mjs','scripts/inspect-native-coop-saved-return-host.mjs'
    ].map(async p=>[p,sha(await readFile(join(workspace,p)))])))},
    livePairedSynchronizationQualified:false,repeatedCooperativeResidencyQualified:false,browserUsed:false,goalComplete:false};
}
if(process.argv[1]===new URL(import.meta.url).pathname) {
  try {assert.equal(process.argv.length,4);const p=await inspectSavedReturnResume(process.argv[2]);
    await writeFile(resolve(process.argv[3]),JSON.stringify(p,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({bothRecordedReturningRolesResumed:true,savedHomeGameplayPreserved:true,livePaired:false}));
  }catch(e){console.error(JSON.stringify({error:e.name,message:String(e.message).split('\n')[0],
    at:e.stack?.split('\n').filter(l=>l.trim().startsWith('at ')).slice(0,2)}));process.exitCode=1;}
}
