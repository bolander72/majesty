#!/usr/bin/env node
// Stopped original host saved reader/full writer/real Complete and resume.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectCoopWorld,cooperativeKingdoms} from './inspect-native-coop-world.mjs';
import {inspectSavedReturnTarget} from './inspect-native-coop-saved-return-target.mjs';
import {inspectTargetPrefixCustody} from './lib/coop-target-prefix-custody.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
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
export async function inspectSavedReturnHost(name) {
  const report=resolve(name),raw=await bounded(report),m=JSON.parse(raw),startup=await inspectCoopWorld(report);
  assert.equal(startup.originalRole,'host');assert.equal(startup.scriptCompleted,true);
  for(const k of ['replaySavedReturnRecipientRequested','requestSavedReturnAtProgress','nativeSavedReturnSnapshotRequested',
    'originalSavedReturnTargetSaved','originalCurrentReturnSourceSaved','originalLaterTargetProgressSaved']) assert.equal(m[k],true,k);
  assert.ok(!m.referenceError&&!m.stopReason);
  for(const k of ['referenceReplayedRecipientReadyVotes','referenceReplayedRecipientLoadedVotes',
    'referenceReplayedSecondRecipientReadyVotes','referenceReplayedSecondRecipientLoadedVotes'])assert.equal(m[k],1,k);
  const root=join(workspace,`output/native-multiplayer-lobby-${String(m.attempt).padStart(3,'0')}`);
  assert.equal(sha(await bounded(join(root,'native_coop_saved_return_votes.py'))),m.savedReturnRecipientReplayHelperSha256);
  const inputs=m.savedReturnRecipientReplayInputs;assert.equal(inputs.length,7);
  const data=[];
  for(const [i,r]of inputs.entries()) {
    assert.ok(r.copy.startsWith(join(root,`captured-host-inputs/return-recipient-source-${String(i).padStart(3,'0')}-`)));
    data.push(await copied(r));
  }
  const recorded=JSON.parse(data[0]);
  // Qualify the actual recipient's full held home, not merely its vote claim.
  const recipientTarget=await inspectSavedReturnTarget(recorded.report),recipient=recipientTarget.recipient;
  for(const k of ['reportSha256','descriptorSha256','capturedRecipientRequests','capturedRecipientLoadedRequests',
    'sourceClock','sourceFrame','verifierInputs'])assert.deepEqual(recorded[k],recipient[k]);
  assert.equal(sha(data[1]),recipient.reportSha256);
  const guest=JSON.parse(data[1]);assert.equal(guest.nativeExecutableSha256,m.nativeExecutableSha256);
  const rows=[...recipient.capturedRecipientRequests,...recipient.capturedRecipientLoadedRequests];
  for(let i=0;i<2;i++){assert.equal(inputs[i+2].source,rows[i].copy);assert.ok(data[i+2].equals(await copied(rows[i],2048)));}
  const descriptor=data[2].subarray(32),fields=descriptor.toString('ascii').trimEnd().split('\n');
  assert.equal(fields.length,22);assert.equal(sha(descriptor),recipient.descriptorSha256);
  assert.deepEqual(fields.slice(0,8),['majesty-coop-region-v1','native-terrain-fixture','1','0','0','0','71201','1']);
  assert.deepEqual(fields.slice(10,13),['31','1550','1']);
  assert.equal(inputs[4].source,recipient.sourceHostReport);assert.equal(sha(data[4]),recipient.sourceHostReportSha256);
  const sourceHost=JSON.parse(data[4]);
  for(let i=0;i<2;i++) {
    const r=sourceHost.savedReturnSourceFiles.find(r=>r.path===inputs[i+5].source);
    assert.ok(data[i+5].equals(await copied(r)));assert.ok(data[i+5].equals(await copied(m.importedSavedReturnSource[i])));
    assert.equal(m.importedSavedReturnSource[i].copy,join(m.profile,'captured-return-source',i?'source.checkpoint':'source_0.GMP'));
  }
  assert.equal(m.importedSavedReturnSource.length,2);
  const savePrefix=join(m.profile,'Documents/My Games/MajestyHD/SaveGame/CoopTransitions_native-terrain-fixture_');
  const current=m.savedReturnSourceFiles.find(r=>r.path===savePrefix+'1_0_0.GMP');
  const marker=m.savedReturnSourceFiles.find(r=>r.path===savePrefix+'1_0.checkpoint');
  assert.equal(m.savedReturnSourceFiles.length,2);assert.ok((await copied(current)).equals(data[5]));
  assert.ok((await copied(marker,768)).equals(data[6]));
  assert.equal(current.sha256,fields[14]);assert.equal(String(current.bytes),fields[13]);
  const home=m.proposalSourceFiles.find(r=>r.path===savePrefix+'0_0_0.GMP');
  const homeMarker=m.proposalSourceFiles.find(r=>r.path===savePrefix+'0_0.checkpoint');
  assert.equal(m.proposalSourceFiles.length,2);await copied(home);await copied(homeMarker,768);
  assert.equal(home.sha256,fields[19]);assert.equal(String(home.bytes),fields[18]);
  assert.equal(m.currentReturnSourceSnapshot.path,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Coop_World_Return_Source.GMP'));
  await copied(m.currentReturnSourceSnapshot);
  const actualSource=await connectedWorldState(m.currentReturnSourceSnapshot.path),agreedSource=await connectedWorldState(current.path);
  assert.equal(actualSource.clock,1550);assert.equal(agreedSource.clock,1550);
  const sourceComparison=compareConnectedWorlds(agreedSource,actualSource);
  const prefixCustody=await inspectTargetPrefixCustody(m);
  await copied(m.laterTargetProgressSnapshot);await copied(sourceHost.laterTargetProgressSnapshot);
  const priorProgressComparison=compareConnectedWorlds(await connectedWorldState(sourceHost.laterTargetProgressSnapshot.path),
    await connectedWorldState(m.laterTargetProgressSnapshot.path));
  assert.equal(m.savedReturnTargetSnapshot.path,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Coop_World_Return_Target.GMP'));
  await copied(m.savedReturnTargetSnapshot);
  const homeState=await connectedWorldState(home.path),targetState=await connectedWorldState(m.savedReturnTargetSnapshot.path);
  assert.equal(homeState.clock,550);assert.equal(targetState.clock,550);
  const targetComparison=compareConnectedWorlds(homeState,targetState);
  const kingdoms=await cooperativeKingdoms(m.savedReturnTargetSnapshot.path,[0,1]);assert.equal(kingdoms.length,2);
  assert.ok(kingdoms.every(k=>k.palace.length===1));
  const requests=[],enables=[],secondHostRows=[];assert.ok(m.proposalProtocolRequests.length<=64);
  for(const [i,r]of m.proposalProtocolRequests.entries()) {
    assert.equal(r.copy,join(root,`owned-lobby-packets/proposal-rpc-${String(i).padStart(3,'0')}.bin`));
    const b=await copied(r,2048);assert.equal(r.host,r.sender===1);assert.ok([1,2].includes(r.sender)&&r.request>0);
    assert.deepEqual(words(b.subarray(0,24)),[0x31525044,1,r.op,r.request,0,r.action]);
    if(r.op===12&&r.action>0) {
      const serial=b.readUInt32LE(24);assert.ok([1,2].includes(serial));
      assert.equal(b.length,32+b.readUInt32LE(28));
      if(serial===2){assert.ok(b.subarray(32).equals(descriptor));if(r.sender===2)assert.ok(b.subarray(20).equals(data[r.action].subarray(20)));else secondHostRows.push(r);}
      else assert.equal(sha(b.subarray(32)),m.observedProposalEvents[0].descriptorSha256);
      requests.push([r.sender,serial,r.action]);
    }else enables.push([r.sender,r.op,r.action]);
  }
  assert.deepEqual(enables.sort(),[[1,12,0],[1,13,6],[2,12,0],[2,13,6]].sort());
  assert.deepEqual(requests[0],[1,1,1]);assert.deepEqual(requests.slice(1,3).sort(),[[1,1,2],[2,1,2]].sort());
  assert.deepEqual(requests.slice(3),[[1,1,3],[2,1,3],[1,2,1],[1,2,2],[2,2,2],[1,2,3],[2,2,3]]);
  assert.deepEqual(m.replayedSecondRecipientVoteBodies,rows.map((r,i)=>({action:i+2,source:r.copy,bytes:data[i+2].length-20,sha256:sha(data[i+2].subarray(20))})));
  assert.equal(m.observedSavedReturnEvents.length,3);
  for(const [i,r]of m.observedSavedReturnEvents.entries()) {
    assert.deepEqual([r.serial,r.stage,r.players,r.descriptorSha256],[2,i+1,[1,2],sha(descriptor)]);
    const b=await copied(r,2048);assert.deepEqual(words(b.subarray(0,12)),[2,i+1,descriptor.length]);
    assert.ok(b.subarray(12,12+descriptor.length).equals(descriptor));assert.deepEqual(words(b.subarray(12+descriptor.length)),[2,1,2]);
  }
  const resumes=[];for(const r of m.lobbyPacketMetadata) {
    const b=await copied(r,65536);assert.deepEqual([r.sender,r.recipient],[1,2]);
    if(b.readUInt32LE(0)===256&&b.readUInt32LE(4)===4) {
      assert.equal(b.length,60);assert.deepEqual(words(Buffer.from(b.subarray(8)).map(x=>x^49)),[48,1,0,0,1,24,9,1,1,0,50,0,0]);resumes.push(r);
    }
  }
  assert.equal(resumes.length,2);
  const log=(await bounded(join(root,'native.log'),4*1024*1024)).toString();
  const markers=['[coop-return-fixture] Production west action armed epoch=1 serial=1 frame=20 clock=1000 original-actions=1',
    '[coop-return-source-import-fixture] Imported epoch=1 serial=2 source=1_0 revision=1 frame=31 clock=1550 current-original-writer=1 original-world-unmodified=1',
    '[coop-load] Saved source teardown epoch=1 serial=2 pause-held=1 loaded=1',
    '[coop-load] Attached epoch=1 serial=2 slot=0','[coop-load] Held epoch=1 serial=2 slot=0 clock=550',
    '[coop-load] Loaded epoch=1 serial=2 slot=0',
    '[coop-return-fixture] Snapshot epoch=1 serial=2 local=1 slot=0 region=0_0 frame=0 clock=550 original-writer=1 source-retained=1 coordinator-loaded=1 peer-loaded=0 resume-controls=0 live-second-engine=0',
    '[coop-load] Resume queued epoch=1 serial=2','[coop-load] Resumed epoch=1 serial=2 region=0_0'];
  let cursor=-1;for(const marker of markers){assert.equal(log.split('\n').filter(l=>l===marker).length,1,marker);assert.ok(log.indexOf(marker)>cursor);cursor=log.indexOf(marker);}
  assert.ok(!/\[coop-(?:load|transfer)\] Rejected/.test(log));
  const resources=log.split('\n').filter(l=>l.startsWith('[coop-load] Resources epoch=1 serial='));assert.equal(resources.length,2);
  return {version:1,report,reportSha256:sha(raw),startup,recipientTarget,descriptorSha256:sha(descriptor),
    originalHostSavedReaderLoadedQualified:true,originalHostSavedHomeGameplayPreservedQualified:true,
    originalPausedSourceGameplayPreservedQualified:true,actualSecondCompleteQualified:true,
    originalHostSecondResumeQueuedQualified:true,originalHostSecondResumeExecutedQualified:true,
    snapshot:m.savedReturnTargetSnapshot,currentSourceSnapshot:m.currentReturnSourceSnapshot,home,homeMarker,current,marker,
    originalClock:550,sourceClock:1550,sourceFrame:31,sourceComparison,targetComparison,priorProgressComparison,prefixCustody,
    kingdoms,capturedSecondResume:resumes[1],resourceObservations:resources,
    capturedHostSecondRequests:secondHostRows,
    verifierInputs:{...startup.verifierInputs,...recipientTarget.verifierInputs,...Object.fromEntries(await Promise.all([
      'scripts/inspect-native-coop-saved-return-host.mjs','scripts/lib/coop-target-prefix-custody.mjs'
    ].map(async p=>[p,sha(await readFile(join(workspace,p)))])))},
    bothReturningRolesResumedQualified:false,livePairedSynchronizationQualified:false,boundedRepeatedResidencyQualified:false,
    browserUsed:false,goalComplete:false};
}
if(process.argv[1]===new URL(import.meta.url).pathname) {
  try {assert.equal(process.argv.length,4);const p=await inspectSavedReturnHost(process.argv[2]);
    await writeFile(resolve(process.argv[3]),JSON.stringify(p,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({hostSavedReturnResumed:true,homeGameplayPreserved:true,currentSourceGameplayPreserved:true,bothReturningRolesResumed:false}));
  }catch(e){console.error(JSON.stringify({error:e.name,message:String(e.message).split('\n')[0],
    at:e.stack?.split('\n').filter(l=>l.trim().startsWith('at ')).slice(0,2)}));process.exitCode=1;}
}
