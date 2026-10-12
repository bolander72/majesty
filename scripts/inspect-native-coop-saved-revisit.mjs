#!/usr/bin/env node
// Inspect an actual third proposal after continued restored-home gameplay.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectCoopWorld,cooperativeKingdoms} from './inspect-native-coop-world.mjs';
import {inspectSavedReturnResume} from './inspect-native-coop-saved-return-resume.mjs';
import {inspectSavedHomeStream} from './inspect-native-coop-saved-home-stream.mjs';
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
export async function inspectSavedRevisit(name) {
  const report=resolve(name),raw=await bounded(report),m=JSON.parse(raw),startup=await inspectCoopWorld(report);
  assert.equal(startup.originalRole,'host');assert.equal(startup.scriptCompleted,true);
  assert.equal(m.replaySavedHomeGuestInputsRequested,true);assert.ok(!m.referenceError&&!m.stopReason);
  const root=join(workspace,`output/native-multiplayer-lobby-${String(m.attempt).padStart(3,'0')}`);
  assert.equal(sha(await bounded(join(root,'native_coop_saved_home_inputs.py'))),m.savedHomeInputReplayHelperSha256);
  const inputs=m.savedHomeInputReplaySources;assert.ok([7,9].includes(inputs.length));const data=[];
  for(const [i,r]of inputs.entries()) {
    assert.ok(r.copy.startsWith(join(root,`captured-host-inputs/saved-home-source-${String(i).padStart(3,'0')}-`)));data.push(await copied(r));
  }
  const recorded=JSON.parse(data[0]),extended=recorded.originalSavedHomeStreamQualified===true;
  const source=extended?await inspectSavedHomeStream(recorded.report,recorded.baselineProof):await inspectSavedReturnResume(recorded.report);
  const count=extended?7:5;assert.equal(inputs.length,2+count);const originalHost=source.host??source.baseline.host;
  for(const k of ['reportSha256','descriptorSha256','snapshot','verifierInputs'])assert.deepEqual(recorded[k],source[k]);
  assert.equal(sha(data[1]),source.reportSha256);const guest=JSON.parse(data[1]);assert.equal(guest.nativeExecutableSha256,m.nativeExecutableSha256);
  const rows=guest.lobbyPacketMetadata.slice(extended?-10:-5).slice(0,count);assert.equal(rows.length,count);
  for(let i=0;i<count;i++) {
    assert.deepEqual([rows[i].sender,rows[i].recipient],[2,1]);assert.equal(inputs[i+2].source,rows[i].copy);
    assert.ok(data[i+2].equals(await copied(rows[i],20)));
    assert.deepEqual(words(data[i+2].subarray(0,8)),[256,5]);
    assert.deepEqual(words(Buffer.from(data[i+2].subarray(8)).map(x=>x^49)),[10+i*2,0,50]);
  }
  assert.equal(m.replayedSavedHomeInputPackets.length,count);assert.equal(m.savedHomeInputServerAcks.length,count);
  for(let i=0;i<count;i++) {
    const sent=m.replayedSavedHomeInputPackets[i],ack=m.savedHomeInputServerAcks[i];
    assert.deepEqual(sent,{sequence:m.replayedGuestTargetInputPackets.at(-1).sequence+1+i,bytes:20,sha256:sha(data[i+2])});
    assert.equal(ack.sequence,sent.sequence);assert.equal(ack.copy,join(root,`owned-lobby-packets/saved-home-input-ack-${String(i).padStart(3,'0')}.bin`));
    assert.deepEqual(words(await copied(ack,24)),[0x31525044,1,108,0,0,sent.sequence]);
  }
  assert.deepEqual(m.observedSavedReturnEvents.map(r=>[r.serial,r.stage,r.players,r.descriptorSha256]),
    [1,2,3].map(stage=>[2,stage,[1,2],source.descriptorSha256]));
  const hostRaw=await bounded(originalHost.report);assert.equal(sha(hostRaw),originalHost.reportSha256);
  const priorHost=JSON.parse(hostRaw);assert.equal(priorHost.nativeExecutableSha256,m.nativeExecutableSha256);
  await copied(m.savedReturnTargetSnapshot);
  const held=await connectedWorldState(m.savedReturnTargetSnapshot.path);
  assert.equal(held.clock,550);const heldComparison=compareConnectedWorlds(await connectedWorldState(priorHost.savedReturnTargetSnapshot.path),held);
  const third=[];
  for(const [i,r]of m.proposalProtocolRequests.entries()) {
    assert.equal(r.copy,join(root,`owned-lobby-packets/proposal-rpc-${String(i).padStart(3,'0')}.bin`));
    const b=await copied(r,2048);assert.equal(r.host,r.sender===1);assert.ok(r.request>0);
    assert.deepEqual(words(b.subarray(0,24)),[0x31525044,1,r.op,r.request,0,r.action]);
    if(r.op===12&&r.action>0&&b.readUInt32LE(24)===3)third.push({row:r,wire:b});
  }
  assert.deepEqual(third.map(x=>[x.row.sender,x.row.host,x.row.op,x.row.action]),[[1,true,12,1],[1,true,12,2]]);
  const descriptor=third[0].wire.subarray(32);assert.ok(third[1].wire.subarray(32).equals(descriptor));
  const fields=descriptor.toString('ascii').trimEnd().split('\n');assert.equal(fields.length,22);
  assert.deepEqual(fields.slice(0,8),['majesty-coop-region-v1','native-terrain-fixture','0','0','1','0','71201','1']);
  assert.equal(fields[12],'2');assert.equal(fields[15],'1');assert.equal(fields[16],'1');assert.equal(fields[17],'1550');
  assert.ok(Number(fields[10])>0&&Number(fields[11])>550);assert.equal(Number(fields[11]),550+50*Number(fields[10]));
  const prefix=join(m.profile,'Documents/My Games/MajestyHD/SaveGame/CoopTransitions_native-terrain-fixture_');
  assert.equal(m.proposalSourceFiles.length,3);assert.equal(m.savedReturnSourceFiles.length,2);
  const currentMarker=m.proposalSourceFiles.find(r=>r.path===prefix+'0_0.checkpoint');
  const marker=(await copied(currentMarker,768)).toString('ascii').trimEnd().split('\n');
  assert.deepEqual(marker,['majesty-coop-checkpoint-v1','1',fields[1],fields[8],fields[9],'0','0',fields[10],fields[11],'2',fields[13],fields[14]]);
  const current=m.proposalSourceFiles.find(r=>r.path===prefix+'0_0_1.GMP');await copied(current);
  assert.equal(current.sha256,fields[14]);assert.equal(String(current.bytes),fields[13]);
  const oldHome=m.proposalSourceFiles.find(r=>r.path===prefix+'0_0_0.GMP');assert.ok((await copied(oldHome)).equals(await copied(originalHost.home)));
  const neighbor=m.savedReturnSourceFiles.find(r=>r.path===prefix+'1_0_0.GMP');
  assert.ok((await copied(neighbor)).equals(await copied(originalHost.current)));
  assert.equal(neighbor.sha256,fields[19]);assert.equal(String(neighbor.bytes),fields[18]);
  const state=await connectedWorldState(current.path);assert.equal(state.clock,Number(fields[11]));
  const kingdoms=await cooperativeKingdoms(current.path,[0,1]);assert.equal(kingdoms.length,2);
  // Home is the original level1 start: five buildings and no owned mobile
  // actors, unlike the generated level2 neighbor. Preserve its actual IDs,
  // types, ownership, positions and parent links rather than assuming the
  // neighbor's starting heroes exist here.
  const heldKingdoms=await cooperativeKingdoms(m.savedReturnTargetSnapshot.path,[0,1]);
  assert.ok(heldKingdoms.every(k=>k.palace.length===1&&k.buildings.length===5&&k.mobileActors.length===0));
  assert.deepEqual(kingdoms,heldKingdoms);
  const changedUnits=Object.keys(state.records.units).filter(id=>JSON.stringify(state.records.units[id])!==JSON.stringify(held.records.units[id])).length;assert.ok(changedUnits>0);
  assert.equal(m.observedRevisitEvents.length,1);const event=m.observedRevisitEvents[0],eventBytes=await copied(event,2048);
  assert.deepEqual([event.serial,event.stage,event.players,event.descriptorSha256],[3,1,[1,2],sha(descriptor)]);
  assert.deepEqual(words(eventBytes.subarray(0,12)),[3,1,descriptor.length]);assert.ok(eventBytes.subarray(12,12+descriptor.length).equals(descriptor));
  assert.deepEqual(words(eventBytes.subarray(12+descriptor.length)),[2,1,2]);
  const log=(await bounded(join(root,'native.log'),4*1024*1024)).toString();
  assert.ok(!/\[coop-(?:load|transfer)\] Rejected|Request refused/.test(log));
  const resume='[coop-load] Resumed epoch=1 serial=2 region=0_0',begin='[coop-load] Begin epoch=1 serial=3 region=1_0 bytes='+neighbor.bytes;
  assert.ok(log.indexOf(resume)>=0&&log.indexOf(begin)>log.indexOf(resume));
  assert.ok(log.includes(`[coop-transition] Paused epoch=1 owner=1 frame=${fields[10]} clock=${fields[11]}`));
  assert.ok(log.includes('[coop-load] Ready epoch=1 serial=3 imported=0 local-source-revision=2'));
  assert.ok(!log.includes('[coop-load] Loaded epoch=1 serial=3'));
  return {version:1,report,reportSha256:sha(raw),startup,source,heldComparison,originalSavedHomeProgressQualified:true,
    originalThirdSavedRevisitProposalQualified:true,sourceFrame:Number(fields[10]),sourceClock:state.clock,sourceRevision:2,
    descriptorSha256:sha(descriptor),current,currentMarker,neighbor,oldHome,kingdoms,changedUnits,
    capturedHostThirdRequests:third.map(x=>x.row),unchangedActualHomeInputPackets:count,actualRelayAcknowledgements:count,
    verifierInputs:{...startup.verifierInputs,...Object.fromEntries(await Promise.all([
      'scripts/inspect-native-coop-saved-revisit.mjs','scripts/inspect-native-coop-saved-return-resume.mjs','scripts/inspect-native-coop-saved-home-stream.mjs'
    ].map(async p=>[p,sha(await readFile(join(workspace,p)))])))},
    thirdSharedLoadQualified:false,repeatedCooperativeResidencyQualified:false,livePairedSynchronizationQualified:false,browserUsed:false,goalComplete:false};
}
if(process.argv[1]===new URL(import.meta.url).pathname) {
  try {assert.equal(process.argv.length,4);const p=await inspectSavedRevisit(process.argv[2]);
    await writeFile(resolve(process.argv[3]),JSON.stringify(p,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({savedHomeProgress:true,thirdSavedRevisitProposed:true,clock:p.sourceClock,thirdSharedLoad:false}));
  }catch(e){console.error(JSON.stringify({error:e.name,message:String(e.message).split('\n')[0],
    at:e.stack?.split('\n').filter(l=>l.trim().startsWith('at ')).slice(0,2)}));process.exitCode=1;}
}
