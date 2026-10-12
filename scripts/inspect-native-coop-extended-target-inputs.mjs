#!/usr/bin/env node
// Require captured guest bytes, real relay acknowledgements and original progress.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectTargetProgress} from './inspect-native-coop-target-progress.mjs';
import {inspectExtendedTargetProgressPair} from './inspect-native-coop-extended-target-progress.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {compareProgressGameplay} from './lib/coop-progress-checkpoint-state.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name,cap=2*1024*1024){const s=await stoppedFileSource(resolve(name));assert.ok(s.size<=cap);const b=Buffer.alloc(s.size);for(let n=0;n<b.length;n+=4096)b.set(await s.readAt(n,Math.min(4096,b.length-n)),n);return b;}
async function copied(row,cap){const b=await bounded(row.copy??row.path,cap);assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256);return b;}
const words=b=>Array.from({length:b.length/4},(_,i)=>b.readUInt32LE(i*4));
const frame=b=>{assert.equal(b.length,20);assert.deepEqual(words(b.subarray(0,8)),[256,5]);const w=words(Buffer.from(b.subarray(8)).map(x=>x^49));assert.deepEqual(w.slice(1),[0,50]);return w[0];};

export async function inspectExtendedTargetInputs(name){
 const report=resolve(name),raw=await bounded(report),m=JSON.parse(raw),progress=await inspectTargetProgress(report);
 assert.equal(progress.originalRole,'host');assert.equal(m.extendedTargetGuestInputsRequested,true);const timed=m.timedTargetGuestInputsRequested===true;assert.equal(Number(timed)+Number(m.pacedTargetGuestInputsRequested===true),1);
 for(const key of ['replayTargetGuestInputsRequested','originalGuestTargetInputsQueued','originalGuestTargetInputsDelivered'])assert.equal(m[key],true,key);
 const root=resolve(`output/native-multiplayer-lobby-${String(m.attempt).padStart(3,'0')}`);
 assert.equal(sha(await bounded(join(root,'native_coop_target_inputs.py'))),m.targetGuestInputReplayHelperSha256);
 const rows=m.targetGuestInputReplaySources;const count=rows.length-2;assert.ok(count>=10&&count<=16);const data=[];
 for(const [i,row]of rows.entries()){assert.ok(row.copy.startsWith(join(root,'captured-host-inputs',`target-guest-source-${String(i).padStart(3,'0')}-`)));data.push(await copied(row));}
 const recorded=JSON.parse(data[0]),pair=await inspectExtendedTargetProgressPair(recorded.host.report,recorded.guest.report);
 for(const side of ['host','guest'])for(const key of ['reportSha256','snapshot','verifierInputs'])assert.deepEqual(recorded[side][key],pair[side][key]);
 assert.equal(pair.guest.originalResumeProof.descriptorSha256,progress.originalResumeProof.descriptorSha256);
 assert.equal(rows[1].source,pair.guest.report);assert.equal(sha(data[1]),pair.guest.reportSha256);
 const guest=JSON.parse(data[1]);assert.equal(guest.nativeExecutableSha256,m.nativeExecutableSha256);assert.equal(guest.networkManifestSha256,m.networkManifestSha256);
 const originals=[];
 for(const [i,row]of guest.lobbyPacketMetadata.entries()){
  assert.deepEqual([row.sender,row.recipient,row.sequence],[2,1,i+1]);const b=await copied(row,65536);
  if(b.readUInt32LE(0)===256&&b.readUInt32LE(4)===5)originals.push({row,bytes:b,frame:frame(b)});
 }
 assert.deepEqual(originals.map(x=>x.frame),[10,12,14,16,18,20,...Array.from({length:count},(_,i)=>10+2*i)]);
 for(const [i,original]of originals.slice(6).entries()){assert.equal(rows[i+2].source,original.row.copy);assert.ok(data[i+2].equals(original.bytes));}
 const sent=m.replayedGuestTargetInputPackets,acks=m.targetGuestInputServerAcks;assert.equal(sent.length,count);assert.equal(acks.length,count);
 const sourceInputTail=m.replayedGuestInputPackets.at(-1).sequence;
 for(const [i,s]of sent.entries()){
  assert.deepEqual(s,{sequence:sourceInputTail+1+i,bytes:data[i+2].length,sha256:sha(data[i+2])});
  const ack=acks[i];assert.equal(ack.sequence,s.sequence);assert.equal(ack.copy,join(root,`owned-lobby-packets/target-input-ack-${String(i).padStart(3,'0')}.bin`));
  const b=await copied(ack,24);assert.equal(b.length,24);assert.deepEqual(words(b),[0x31525044,1,108,0,0,s.sequence]);
 }
 assert.deepEqual(m.originalGuestTargetInputFrames,Array.from({length:count},(_,i)=>10+2*i));
 assert.equal(m.originalGuestTargetInputAdmission,'actual-target-writer-return+real-Complete+original-Resumed+actual-frame10');
 let resumed=false,resumeRequest,firstInput;
 for(const row of m.lobbyPacketMetadata){const b=await copied(row,65536);if(b.readUInt32LE(0)===256&&b.readUInt32LE(4)===4){assert.equal(resumed,false);resumed=true;resumeRequest=row;}else if(resumed&&!firstInput&&b.readUInt32LE(0)===256&&b.readUInt32LE(4)===5){assert.equal(frame(b),10);firstInput=row;}}
 assert.ok(resumeRequest&&firstInput);assert.equal(m.originalHostTargetResumeRequestSha256,resumeRequest.sha256);assert.equal(m.originalHostTargetInputTriggerSha256,firstInput.sha256);
 if(timed){
  assert.equal(m.targetGuestInputCadenceMs,100);const cadence=m.targetGuestInputSendCadence;assert.equal(cadence.length,count);
  for(const [i,row]of cadence.entries()){assert.equal(row.sequence,sent[i].sequence);assert.equal(row.guestInputFrame,10+2*i);assert.ok(Number.isInteger(row.monotonicNs)&&row.monotonicNs>0);if(i)assert.ok(row.monotonicNs-cadence[i-1].monotonicNs>=99000000,'Timed original peer inputs must retain the bounded50ms two-frame cadence');}
 }else{
 assert.equal(m.targetGuestInputMaximumLookaheadPackets,1);
 const bindings=m.targetGuestInputRequestBindings;assert.equal(bindings.length,count);
 const hostRequests=[];let hostResumed=false;
 for(const row of m.lobbyPacketMetadata){const b=await copied(row,65536);if(b.readUInt32LE(0)===256&&b.readUInt32LE(4)===4)hostResumed=true;else if(hostResumed&&b.readUInt32LE(0)===256&&b.readUInt32LE(4)===5)hostRequests.push({frame:frame(b),sha256:row.sha256});}
 assert.ok(hostRequests.length>=count-1);
 for(const [i,binding]of bindings.entries()){const request=hostRequests[Math.max(0,i-1)];assert.equal(request.frame,10+2*Math.max(0,i-1));assert.deepEqual(binding,{sequence:sent[i].sequence,guestInputFrame:10+2*i,originalHostRequestFrame:request.frame,originalHostRequestSha256:request.sha256});}
 }
 const comparison=await compareProgressGameplay(await connectedWorldState(progress.snapshot.path),await connectedWorldState(pair.guest.snapshot.path),2);
 const log=(await bounded(join(root,'native.log'),4*1024*1024)).toString();
 const peeks=[...log.matchAll(/^\[smoke\] peek 0071c6a8\+4:\n    0071c6a8  ([0-9a-f]{2}) ([0-9a-f]{2}) ([0-9a-f]{2}) ([0-9a-f]{2})\s*$/gm)];assert.equal(peeks.length,1);
 const finalClock=Buffer.from(peeks[0].slice(1).map(x=>Number.parseInt(x,16))).readUInt32LE(0);assert.ok(finalClock>=1000&&finalClock<=2500&&finalClock%50===0);assert.ok(peeks[0].index>log.indexOf('[coop-progress-fixture] Snapshot epoch=1 serial=1 local=1 slot=0 region=1_0 frame=10 clock=500'));
 return {version:1,report,reportSha256:sha(raw),progress,sourceRecordedPair:{host:pair.host.report,guest:pair.guest.report},
  originalTargetGuestPacketBytesPreserved:true,actualRelayAcceptedTargetGuestPackets:count,timedActualPeerCadenceQualified:timed,
  currentHostMatchesRecordedRecipientFullGameplayAt500:true,comparison,originalFinalClock:finalClock,
  actualOriginalTargetTicksAtFinalPeek:finalClock/50,post500FullWorldEqualityQualified:false,
  livePairedSynchronizationQualified:false,browserUsed:false,goalComplete:false,
  scope:'One original host receives the bounded unchanged actual extended guest target inputs, acknowledged by the real authenticated relay. Its full state matches at clock500 and original clock advances beyond that; no later full-state or live paired synchronization claim.',
  verifierInputs:{'scripts/inspect-native-coop-extended-target-inputs.mjs':sha(await readFile(new URL(import.meta.url)))}};
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{assert.equal(process.argv.length,4);const p=await inspectExtendedTargetInputs(process.argv[2]);await writeFile(resolve(process.argv[3]),JSON.stringify(p,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({actualRelayAcceptedGuestPackets:p.actualRelayAcceptedTargetGuestPackets,matchingGameplayAt500:true,originalFinalClock:p.originalFinalClock,livePaired:false}));}catch(e){console.error(JSON.stringify({error:e.name,message:String(e.message).split('\n')[0],at:e.stack?.split('\n').filter(l=>l.trim().startsWith('at ')).slice(0,2)}));process.exitCode=1;}}
