#!/usr/bin/env node
// Independent stopped evidence for the original recipient's third saved load.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectCoopWorld,cooperativeKingdoms} from './inspect-native-coop-world.mjs';
import {inspectSavedRevisit} from './inspect-native-coop-saved-revisit.mjs';
import {inspectSavedReturnResume} from './inspect-native-coop-saved-return-resume.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const words=b=>Array.from({length:b.length/4},(_,i)=>b.readUInt32LE(i*4));
async function bounded(path,cap=2*1024*1024) {
  const source=await stoppedFileSource(path);assert.ok(source.size<=cap);const b=Buffer.alloc(source.size);
  for(let i=0;i<b.length;i+=4096)b.set(await source.readAt(i,Math.min(4096,b.length-i)),i);return b;
}
async function copied(r,cap) {
  assert.ok(r);const b=await bounded(r.copy??r.path,cap);assert.equal(b.length,r.bytes);assert.equal(sha(b),r.sha256);return b;
}
export async function inspectSavedRevisitRecipient(name,baselineName) {
  const report=resolve(name),raw=await bounded(report),m=JSON.parse(raw),startup=await inspectCoopWorld(report);
  assert.equal(startup.originalRole,'guest');assert.equal(startup.scriptCompleted,true);assert.ok(!m.referenceError&&!m.stopReason);
  for(const k of ['replaySavedRevisitHostRequested','capturedSavedRevisitBeginDelivered','capturedSavedRevisitReadyDelivered',
    'originalNeighborCheckpointTransferCompleted','capturedOriginalSecondHostResumeDelivered'])assert.equal(m[k],true,k);
  assert.equal(m.referenceThirdHostReadyVotesSent,1);assert.equal(m.referenceThirdHostLoadedVotesSent,0);
  const root=join(workspace,`output/native-multiplayer-lobby-${String(m.attempt).padStart(3,'0')}`);
  for(const [f,k]of [['native_coop_saved_revisit_replay.py','savedRevisitReplayHelperSha256'],
    ['native_coop_saved_return_replay.py','savedReturnReplayHelperSha256'],['native_coop_saved_return_resume.py','savedReturnResumeHelperSha256']])
    assert.equal(sha(await bounded(join(root,f))),m[k]);
  const baselineProof=resolve(baselineName),priorRaw=await bounded(baselineProof),prior=JSON.parse(priorRaw);
  const baseline=await inspectSavedReturnResume(prior.report);
  for(const k of ['reportSha256','descriptorSha256','snapshot','verifierInputs'])assert.deepEqual(prior[k],baseline[k]);
  const baseRaw=await bounded(baseline.report);assert.equal(sha(baseRaw),baseline.reportSha256);const base=JSON.parse(baseRaw);
  assert.equal(m.nativeExecutableSha256,base.nativeExecutableSha256);
  const inputs=m.hostCompletionReplayInputs;assert.equal(inputs.length,base.hostCompletionReplayInputs.length+18);
  for(const [i,r]of inputs.entries()) {
    assert.ok(r.copy.startsWith(join(root,`captured-host-inputs/completion-source-${String(i).padStart(3,'0')}-`)));await copied(r);
    if(i<base.hostCompletionReplayInputs.length) {
      assert.equal(r.source,base.hostCompletionReplayInputs[i].source);assert.ok((await copied(r)).equals(await copied(base.hostCompletionReplayInputs[i])));
    }
  }
  const offset=base.hostCompletionReplayInputs.length,recorded=JSON.parse(await copied(inputs[offset]));
  const host=await inspectSavedRevisit(recorded.report);
  for(const k of ['reportSha256','descriptorSha256','capturedHostThirdRequests','neighbor','verifierInputs'])assert.deepEqual(recorded[k],host[k]);
  const hostRaw=await bounded(host.report);assert.ok((await copied(inputs[offset+1])).equals(hostRaw));const h=JSON.parse(hostRaw);
  assert.equal(h.nativeExecutableSha256,m.nativeExecutableSha256);
  const begin=await copied(host.capturedHostThirdRequests[0],2048),ready=await copied(host.capturedHostThirdRequests[1],2048);
  for(const [i,b]of [begin,ready].entries())assert.ok((await copied(inputs[offset+2+i])).equals(b));
  const descriptor=begin.subarray(32);assert.equal(sha(descriptor),host.descriptorSha256);assert.ok(ready.subarray(32).equals(descriptor));
  const neighbor=await copied(host.neighbor);assert.ok((await copied(inputs[offset+4])).equals(neighbor));
  const sourcePackets=h.lobbyPacketMetadata.slice(-13);
  for(let i=0;i<13;i++)assert.ok((await copied(inputs[offset+5+i])).equals(await copied(sourcePackets[i],65536)));
  assert.deepEqual(m.capturedOriginalSecondHostResumeInputs,sourcePackets.map(r=>({bytes:r.bytes,sha256:r.sha256})));
  assert.deepEqual(m.replayedHostPackets.slice(0,base.replayedHostPackets.length),base.replayedHostPackets);
  assert.equal(m.replayedHostPackets.length,base.replayedHostPackets.length+12);
  for(let i=1;i<13;i++)assert.deepEqual(m.replayedHostPackets[base.replayedHostPackets.length+i-1],
    {sequence:base.replayedHostPackets.length+i,bytes:sourcePackets[i].bytes,sha256:sourcePackets[i].sha256});
  const inputStart=m.savedRevisitRecipientInputStart;assert.ok(Number.isInteger(inputStart)&&inputStart>=0&&inputStart<=m.lobbyPacketMetadata.length);
  const homeFrames=[];
  for(const [i,r]of m.lobbyPacketMetadata.entries()) {
    assert.deepEqual([r.sequence,r.sender,r.recipient],[i+1,2,1]);const b=await copied(r,65536);
    if(i>=inputStart&&b.length===20&&b.readUInt32LE(0)===256&&b.readUInt32LE(4)===5) {
      const w=words(Buffer.from(b.subarray(8)).map(x=>x^49));assert.deepEqual(w.slice(1),[0,50]);homeFrames.push(w[0]);
    }
  }
  assert.deepEqual(homeFrames.slice(0,7),[10,12,14,16,18,20,22]);
  const protocol=[],chunks=[],thirdVotes=[];
  for(const [i,r]of m.proposalProtocolRequests.entries()) {
    assert.equal(r.copy,join(root,`owned-lobby-packets/proposal-rpc-${String(i).padStart(3,'0')}.bin`));
    const b=await copied(r,16424);assert.ok(r.request>0);assert.equal(r.host,r.sender===1);
    assert.deepEqual(words(b.subarray(0,24)),[0x31525044,1,r.op,r.request,0,r.action]);
    if(i<base.proposalProtocolRequests.length) {
      const old=base.proposalProtocolRequests[i];assert.deepEqual([r.sender,r.host,r.op,r.action],[old.sender,old.host,old.op,old.action]);
      assert.ok(b.subarray(20).equals((await copied(old,16424)).subarray(20)));continue;
    }
    assert.equal(b.readUInt32LE(24),3);protocol.push([r.sender,r.op,r.action]);
    if(r.op===12) {
      assert.equal(b.length,32+b.readUInt32LE(28));assert.ok(b.subarray(32).equals(descriptor));thirdVotes.push(r);
    }else {
      assert.equal(r.op,13);
      if(r.action===0)assert.ok(b.subarray(32).equals(descriptor));
      else {
        assert.equal(b.readUInt32LE(28),r.sender===1?2:1);
        if(r.action===1)assert.deepEqual(words(b.subarray(32)),[neighbor.length]);
        if(r.action===2) {
          assert.equal(b.readUInt32LE(32),chunks.length+1);assert.equal(b.length,40+b.readUInt32LE(36));chunks.push(b.subarray(40));
        }
      }
    }
  }
  const expected=[[1,12,1],[2,13,0],[1,13,1],[2,13,3]];
  for(let i=0;i<Math.ceil(neighbor.length/16384);i++)expected.push([1,13,2],[2,13,3]);
  expected.push([1,13,4],[2,13,5],[2,12,2],[1,12,2],[2,12,3]);assert.deepEqual(protocol,expected);
  assert.ok(Buffer.concat(chunks).equals(neighbor));assert.equal(m.originalNeighborCheckpointTransferredBytes,neighbor.length);
  assert.equal(m.originalNeighborCheckpointTransferSha256,sha(neighbor));
  const checkpointEvents=m.savedRevisitCheckpointEvents;assert.equal(checkpointEvents.length,chunks.length+3);
  for(const [i,r]of checkpointEvents.entries()) {
    assert.equal(r.copy,join(root,`owned-lobby-packets/saved-revisit-checkpoint-event-${String(i).padStart(3,'0')}.bin`));
    assert.deepEqual(words(await copied(r,20)),i===0?[0,3,2,1]:[i===checkpointEvents.length-1?5:3,3,2,1,i-1]);
  }
  assert.deepEqual(m.observedSavedReturnEvents.map(r=>[r.serial,r.stage,r.players,r.descriptorSha256]),
    base.observedSavedReturnEvents.map(r=>[r.serial,r.stage,r.players,r.descriptorSha256]));
  for(let i=0;i<3;i++)assert.ok((await copied(m.observedSavedReturnEvents[i],2048)).equals(await copied(base.observedSavedReturnEvents[i],2048)));
  assert.equal(m.observedSavedRevisitEvents.length,2);
  for(const [i,r]of m.observedSavedRevisitEvents.entries()) {
    assert.equal(r.copy,join(root,`owned-lobby-packets/saved-revisit-event-${String(i).padStart(3,'0')}.bin`));
    assert.deepEqual([r.serial,r.stage,r.players,r.descriptorSha256],[3,i+1,[1,2],host.descriptorSha256]);
    assert.ok((await copied(r,2048)).equals(Buffer.concat([Buffer.from(new Uint32Array([3,i+1,descriptor.length]).buffer),descriptor,Buffer.from(new Uint32Array([2,1,2]).buffer)])));
  }
  await copied(m.savedReturnTargetSnapshot);const held=await connectedWorldState(m.savedReturnTargetSnapshot.path);
  assert.equal(held.clock,550);const heldComparison=compareConnectedWorlds(await connectedWorldState(base.savedReturnTargetSnapshot.path),held);
  const fields=descriptor.toString('ascii').trimEnd().split('\n'),prefix=join(m.profile,'Documents/My Games/MajestyHD/SaveGame/CoopTransitions_native-terrain-fixture_');
  assert.equal(fields.length,22);assert.equal(m.proposalSourceFiles.length,3);assert.equal(m.savedReturnSourceFiles.length,3);
  const homeMarker=m.proposalSourceFiles.find(r=>r.path===prefix+'0_0.checkpoint');
  const homeFields=(await copied(homeMarker,768)).toString('ascii').trimEnd().split('\n');assert.equal(homeFields.length,12);
  const current=m.proposalSourceFiles.find(r=>r.path===prefix+'0_0_'+homeFields[1]+'.GMP');await copied(current);
  assert.deepEqual(homeFields,['majesty-coop-checkpoint-v1',homeFields[1],fields[1],fields[8],fields[9],'0','0','22','1650','2',String(current.bytes),current.sha256]);
  const homeState=await connectedWorldState(current.path);assert.equal(homeState.clock,1650);
  const kingdoms=await cooperativeKingdoms(current.path,[0,1]);assert.deepEqual(kingdoms,await cooperativeKingdoms(m.savedReturnTargetSnapshot.path,[0,1]));
  const oldHome=m.proposalSourceFiles.find(r=>r.path===prefix+'0_0_'+(1-Number(homeFields[1]))+'.GMP');
  // Retain the authoritative home exactly. The local neighbor is freshly
  // serialized in this run; compare gameplay through the existing audited
  // view/calendar rules rather than requiring identical writer timestamps.
  const basePrefix=join(base.profile,'Documents/My Games/MajestyHD/SaveGame/CoopTransitions_native-terrain-fixture_');
  const priorHomeMarker=base.proposalSourceFiles.find(r=>r.path===basePrefix+'0_0.checkpoint');
  const priorHomeFields=(await copied(priorHomeMarker,768)).toString('ascii').trimEnd().split('\n');
  const priorHome=base.proposalSourceFiles.find(r=>r.path===basePrefix+'0_0_'+priorHomeFields[1]+'.GMP');
  assert.ok((await copied(oldHome)).equals(await copied(priorHome)));
  const priorNeighbor=base.savedReturnSourceFiles.find(r=>r.path===basePrefix+'1_0_0.GMP');
  const localNeighbor=m.savedReturnSourceFiles.find(r=>r.path===prefix+'1_0_0.GMP');
  await copied(localNeighbor);await copied(priorNeighbor);
  const retainedNeighborComparison=compareConnectedWorlds(await connectedWorldState(priorNeighbor.path),await connectedWorldState(localNeighbor.path));
  const targetMarker=m.savedReturnSourceFiles.find(r=>r.path===prefix+'1_0.checkpoint');
  const targetFields=(await copied(targetMarker,768)).toString('ascii').trimEnd().split('\n');
  const target=m.savedReturnSourceFiles.find(r=>r.path===prefix+'1_0_'+targetFields[1]+'.GMP');
  assert.ok((await copied(target)).equals(neighbor));
  // browser_frontier checkpoint_ready imports frame0: the transition wire
  // has no target frame. The original saved bytes and clock stay exact.
  assert.deepEqual(targetFields,['majesty-coop-checkpoint-v1',targetFields[1],fields[1],fields[8],fields[9],'1','0','0','1550','1',String(neighbor.length),sha(neighbor)]);
  const log=(await bounded(join(root,'native.log'),4*1024*1024)).toString();assert.ok(!/\[coop-(?:load|transfer)\] Rejected|Request refused/.test(log));
  const markers=['[coop-load] Resumed epoch=1 serial=2 region=0_0',
'[coop-load] Ready epoch=1 serial=3 imported=1 local-source-revision=2',
    '[coop-load] Saved source teardown epoch=1 serial=3 pause-held=1 loaded=1','[coop-load] Attached epoch=1 serial=3 slot=1',
    '[coop-load] Held epoch=1 serial=3 slot=1 clock=1550','[coop-load] Loaded epoch=1 serial=3 slot=1'];
  let at=-1;for(const marker of markers) {assert.equal(log.split('\n').filter(l=>l===marker).length,1,marker);const next=log.indexOf(marker);assert.ok(next>at);at=next;}
  assert.ok(!log.includes('[coop-load] Resumed epoch=1 serial=3'));
  return {version:1,report,reportSha256:sha(raw),startup,baselineProof,baselineProofSha256:sha(priorRaw),host,
    descriptorSha256:host.descriptorSha256,heldComparison,retainedNeighborComparison,current,homeMarker,target,targetMarker,kingdoms,
    capturedRecipientThirdRequests:thirdVotes.filter(r=>r.sender===2),
    originalRecipientThirdPauseCheckpointQualified:true,originalRecipientUpdatedHomeSavedQualified:true,
    actualThirdCheckpointTransferImportQualified:true,originalRecipientThirdSavedReaderLoadedQualified:true,
    originalRecipientThirdReadyLoadedExecutedQualified:true,sourceClock:1650,targetClock:1550,sourceRevision:2,
    fullThirdLoadedGameplayComparisonQualified:false,thirdSharedResumeQualified:false,repeatedCooperativeResidencyQualified:false,
    livePairedSynchronizationQualified:false,browserUsed:false,goalComplete:false,
    verifierInputs:{...startup.verifierInputs,...Object.fromEntries(await Promise.all([
      'scripts/inspect-native-coop-saved-revisit-recipient.mjs','scripts/inspect-native-coop-saved-revisit.mjs','scripts/inspect-native-coop-saved-return-resume.mjs'
    ].map(async f=>[f,sha(await readFile(join(workspace,f)))])))}};
}
if(process.argv[1]===new URL(import.meta.url).pathname) {
  try {assert.equal(process.argv.length,5);const p=await inspectSavedRevisitRecipient(process.argv[2],process.argv[3]);
    await writeFile(resolve(process.argv[4]),JSON.stringify(p,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({thirdRecipientLoaded:true,homeClock:p.sourceClock,targetClock:p.targetClock,thirdResume:false}));
  }catch(e){console.error(JSON.stringify({error:e.name,message:String(e.message).split('\n')[0],at:e.stack?.split('\n').filter(l=>l.trim().startsWith('at ')).slice(0,2)}));process.exitCode=1;}
}
