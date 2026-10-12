#!/usr/bin/env node
// Actual stopped original recipient completion against recorded real host data.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectCoopWorld,cooperativeKingdoms} from './inspect-native-coop-world.mjs';
import {inspectCoopProposal} from './inspect-native-coop-proposal.mjs';
import {inspectHostLoaded} from './inspect-native-coop-host-loaded.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {compareGeneratedKingdomGameplay} from './lib/coop-host-checkpoint-state.mjs';
import {compareGeneratedConfiguration} from './lib/coop-generated-configuration.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {agentSavedScalars} from './inspect-native-gpl-agent-initialization.mjs';
import {inspectTargetInputs} from './inspect-native-coop-target-inputs.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name,cap=2*1024*1024){const s=await stoppedFileSource(resolve(name));assert.ok(s.size<=cap);const b=Buffer.alloc(s.size);for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;}
async function copied(row,cap){const b=await bounded(row.copy??row.path,cap);assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256);return b;}
const words=(b)=>Array.from({length:b.length/4},(_,i)=>b.readUInt32LE(i*4));
export async function inspectExtendedRecipientResume(name){
 const report=resolve(name),raw=await bounded(report),m=JSON.parse(raw),source=await inspectCoopWorld(report);
 assert.equal(source.originalRole,'guest');assert.equal(source.scriptCompleted,true);
 for(const k of ['replayHostProposalRequested','replayHostCompletionRequested','nativeIncomingHostPauseObservationRequested','nativeLoadedTargetSnapshotRequested','originalLoadedTargetSaved','capturedOriginalHostProposalDelivered','capturedOriginalHostLoadedDelivered','capturedOriginalHostResumeDelivered'])assert.equal(m[k],true,k);
 for(const k of ['nativePauseWorldRequested','nativeReadbackWorldRequested','nativeBeginFreshNeighborRequested','replayRecipientVotesRequested'])assert.equal(m[k],false,k);
 assert.equal(m.referenceHostLoadedVotesSent,1);assert.equal(m.referenceReplayedHostReadyVotes,1);
 assert.deepEqual(source.snapshots.map(s=>[s.frame,s.clock]),[[0,0],[11,550]]);
 const parent=await inspectCoopProposal(m.replaySourceReport);
 assert.equal(m.pausedHostInspection.reportSha256,parent.reportSha256);
 assert.deepEqual(m.pausedHostInspection.verifierInputs,parent.sourceProof.verifierInputs);
 const root=resolve(`output/native-multiplayer-lobby-${String(m.attempt).padStart(3,'0')}`);
 for(const [file,key]of [['native_coop_proposal_replay.py','proposalReplayHelperSha256'],['native_coop_proposal_observer.py','proposalObserverSha256'],['native_coop_completion_replay.py','completionReplayHelperSha256']])assert.equal(sha(await bounded(join(root,file))),m[key]);
 const extended=m.replayExtendedHostCompletionRequested===true;assert.equal(extended,true);
 if(extended)assert.equal(sha(await bounded(join(root,'native_coop_extended_stream.py'))),m.hostExtendedStreamHelperSha256);
 const rows=m.hostCompletionReplayInputs;assert.ok(rows.length>=(extended?13:5)&&rows.length<=(extended?22:12));
 const copies=[];for(const [i,row]of rows.entries()){assert.ok(row.copy.startsWith(join(root,'captured-host-inputs/completion-source-')+String(i).padStart(3,'0')));copies.push(await copied(row));}
 const recorded=JSON.parse(copies[0]),host=await inspectHostLoaded(recorded.report);
 assert.equal(host.sourceImportedLiveGameplayMatches,true);assert.equal(host.recordedRoleTargetGameplayEqualityQualified,true);assert.equal(host.hostOriginalResumeExecuted,true);
 for(const k of ['reportSha256','descriptorSha256','capturedHostRequests','recipientReportSha256','verifierInputs'])assert.deepEqual(recorded[k],host[k]);
 assert.equal(host.descriptorSha256,parent.descriptorSha256);
 const hostRaw=await bounded(host.report);assert.equal(sha(hostRaw),host.reportSha256);
 const hostMetadata=JSON.parse(hostRaw);let resumedCapture=false;const originalResumeRows=[];
 let extendedHost=null;
 if(extended){extendedHost=await inspectTargetInputs(host.report);assert.equal(extendedHost.actualRelayAcceptedTargetGuestPackets,10);assert.ok(extendedHost.originalFinalClock>=900);}
 assert.ok(hostMetadata.lobbyPacketMetadata.length<=256);
 for(const row of hostMetadata.lobbyPacketMetadata){
  assert.deepEqual([row.sender,row.recipient],[1,2]);const b=await copied(row,65536);
  if(b.readUInt32LE(0)===0x100&&b.readUInt32LE(4)===4){assert.equal(resumedCapture,false);resumedCapture=true;}
  if(resumedCapture)originalResumeRows.push({row,bytes:b});
 }
 assert.ok(resumedCapture);assert.equal(originalResumeRows.length,copies.length-3);
 for(const[i,original]of originalResumeRows.entries()){
  assert.equal(rows[i+3].source,original.row.copy,'Resume input must retain its actual original host capture source');
  assert.ok(copies[i+3].equals(original.bytes),'Every resume/input byte must match actual host capture');
 }
 const descriptor=copies[1].subarray(32);assert.equal(sha(descriptor),host.descriptorSha256);assert.ok(copies[2].subarray(32).equals(descriptor));
 for(const [i,row]of host.capturedHostRequests.slice(1).entries())assert.ok(copies[i+1].equals(await copied(row,2048)));
 assert.deepEqual(m.replayedOriginalHostLoadedBody,{source:host.capturedHostRequests[2].copy,bytes:copies[2].length-20,sha256:sha(copies[2].subarray(20))});
 const resume=copies[3];assert.deepEqual(words(resume.subarray(0,8)),[0x100,4]);assert.equal(resume.length,60);
 assert.deepEqual(words(Buffer.from(resume.subarray(8),undefined).map(x=>x^0x31)),[48,1,0,0,1,24,9,1,1,0,50,0,0]);
 const targetInputs=[],originalPings=[];
 for(const [i,b]of copies.slice(4).entries()){
  if(extended&&b.length===16&&b.readUInt32LE(0)===2&&b.readUInt32LE(4)===18){assert.equal(b.readUInt32LE(8),1);assert.ok(b.readUInt32LE(12)>0);assert.ok(originalPings.length<2);originalPings.push({streamIndex:i+1,owner:1,timestamp:b.readUInt32LE(12),sha256:sha(b)});continue;}
  assert.equal(b.length,20);assert.deepEqual(words(b.subarray(0,8)),[0x100,5]);assert.deepEqual(words(Buffer.from(b.subarray(8)).map(x=>x^0x31)),[10+targetInputs.length*2,0,50]);targetInputs.push(b);
 }
 if(extended)assert.ok(targetInputs.length>=9&&targetInputs.length<=16);
 assert.deepEqual(m.capturedOriginalHostResumeInputs,copies.slice(3).map(b=>({bytes:b.length,sha256:sha(b)})));
 const originalPongs=[];
 for(const row of m.lobbyPacketMetadata){
  assert.deepEqual([row.sender,row.recipient],[2,1]);const b=await copied(row,65536);
  if(b.length===16&&b.readUInt32LE(0)===2&&b.readUInt32LE(4)===19){
   assert.equal(b.readUInt32LE(8),2);originalPongs.push({sequence:row.sequence,timestamp:b.readUInt32LE(12),sha256:sha(b)});
  }
 }
 for(const ping of originalPings)assert.equal(originalPongs.filter(p=>p.timestamp===ping.timestamp).length,1,'Require exactly one actual original recipient Pong for each preserved Ping');

 const requests=m.proposalProtocolRequests,expected=[[1,12,0],[1,13,6],[2,12,0],[2,13,6],[1,12,1],[1,12,2],[2,12,2],[2,12,3],[1,12,3]];assert.equal(requests.length,9);
 for(const [i,r]of requests.entries()){
  assert.deepEqual([r.sender,r.op,r.action],expected[i]);assert.equal(r.host,r.sender===1);assert.equal(r.copy,join(root,`owned-lobby-packets/proposal-rpc-${String(i).padStart(3,'0')}.bin`));
  const b=await copied(r,2048);assert.deepEqual(words(b.subarray(0,24)),[0x31525044,1,r.op,r.request,0,r.action]);assert.ok(r.request>0);
  if(r.op===12&&r.action>0){assert.deepEqual(words(b.subarray(24,32)),[1,descriptor.length]);assert.equal(b.length,32+descriptor.length);assert.ok(b.subarray(32).equals(descriptor));if(r.sender===1&&r.action===3)assert.ok(b.subarray(20).equals(copies[2].subarray(20)));}
 }
 assert.equal(m.observedProposalEvents.length,3);
 for(const [i,r]of m.observedProposalEvents.entries()){
  assert.deepEqual([r.serial,r.stage,r.players,r.descriptorSha256],[1,i+1,[1,2],sha(descriptor)]);assert.equal(r.copy,join(root,`owned-lobby-packets/proposal-${String(i).padStart(3,'0')}.bin`));
  const b=await copied(r,2048);assert.equal(b.length,24+descriptor.length);assert.deepEqual(words(b.subarray(0,12)),[1,i+1,descriptor.length]);assert.ok(b.subarray(12,12+descriptor.length).equals(descriptor));assert.deepEqual(words(b.subarray(12+descriptor.length)),[2,1,2]);
 }
 const prefix=join(m.profile,'Documents/My Games/MajestyHD/SaveGame/CoopTransitions_native-terrain-fixture_0_0');
 const before=await connectedWorldState(source.snapshots[1].path),captured=await connectedWorldState(prefix+'_0.GMP');const sourceComparison=compareConnectedWorlds(before,captured);
 const log=(await bounded(join(root,'native.log'),4*1024*1024)).toString();let cursor=-1;
 const markers=['[coop-load] Ready fresh epoch=1 serial=1 local-source-revision=1','[coop-load] Source network buffers retired serial=1','[coop-generation] Original source interface/world teardown completed serial=1 pause-held=1','[coop-generation] Committed context epoch=1 serial=1 region=1_0 source-retained=1 source-disposed=1','[coop-load] Committed rebuild queued epoch=1 serial=1','[coop-load] Connected return bound epoch=1 serial=1 region=1_0','[coop-load] Attached epoch=1 serial=1 slot=1','[coop-load] Held epoch=1 serial=1 slot=1 clock=0','[coop-load] Loaded epoch=1 serial=1 slot=1','[coop-target-fixture] Snapshot epoch=1 serial=1 local=2 slot=1 region=1_0 frame=0 clock=0 original-writer=1 source-retained=1 coordinator-loaded=1 peer-loaded=0 resume-controls=0 live-second-engine=0','[coop-load] Resumed epoch=1 serial=1 region=1_0'];
 for(const marker of markers){assert.equal(log.split('\n').filter(l=>l===marker).length,1,marker);const next=log.indexOf(marker);assert.ok(next>cursor);cursor=next;}
 assert.ok(!/\[coop-load\] (?:Rejected|Resume queued)|\[coop-transfer\] Rejected|\[coop-read-fixture\]|\[coop-phase2-fixture\]/.test(log));
 const target=m.loadedTargetSnapshot;assert.equal(target.path,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Coop_World_Target.GMP'));await copied(target);
 const state=await connectedWorldState(target.path),hostState=await connectedWorldState(host.targetSnapshot.path);assert.equal(state.clock,0);assert.equal(state.label,'Coop_World_Target');
 const kingdoms=await cooperativeKingdoms(target.path,[0,1]);assert.ok(kingdoms.every(k=>k.buildings.length>1));
 const configuration=await compareGeneratedConfiguration(source.snapshots[1].path,target.path,'1_0');assert.equal(state.rng,configuration.targetSeed);assert.equal(state.gameplayRng,configuration.targetSeed);
 const levels=[...kingdoms,...host.targetSnapshot.kingdoms].map(k=>(k.palace[0].description>>>24)-48);assert.ok(levels.every(l=>l===levels[0]));
 const comparison=await compareGeneratedKingdomGameplay(hostState,state,levels[0]);
 const scalars=await agentSavedScalars(target.path);assert.ok(scalars.every(r=>r.serializedNativeOffset44Value===0));
 return{version:1,report,reportSha256:sha(raw),sourceProof:source,hostReport:host.report,hostReportSha256:host.reportSha256,descriptorSha256:sha(descriptor),sourceComparison,targetSnapshot:{...target,kingdoms,configuration},matchingHeldTargetGameplayQualified:true,targetGameplayComparison:comparison,actualRecipientOriginalResumeExecutedQualified:true,bothRecordedRoleOriginalResumesExecutedQualified:true,originalHostResumeBytesPreserved:true,actualOriginalHostResumeCaptureBound:true,capturedTargetInputPackets:targetInputs.length,extendedOriginalHostCompletionQualified:extended,originalPingPacketsPreserved:originalPings,actualOriginalRecipientPongs:originalPongs,extendedHostFinalClock:extendedHost?.originalFinalClock??null,sharedResumeQualified:false,pairedSynchronizationQualified:false,liveSecondOriginalEngine:false,browserUsed:false,goalComplete:false,verifierInputs:{...source.verifierInputs,'scripts/inspect-native-coop-extended-recipient-resume.mjs':sha(await readFile(new URL(import.meta.url)))},scope:'Both original roles separately reach matching held targets and execute original resume with unchanged captured actual peer messages. A recorded peer has no continuing world. Live paired synchronization, ongoing shared gameplay, saved return and repeated co-op residency remain unqualified.'};
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{assert.equal(process.argv.length,4);const p=await inspectExtendedRecipientResume(process.argv[2]);await writeFile(resolve(process.argv[3]),JSON.stringify(p,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({recipientOriginalResume:true,bothRecordedRolesResumed:true,matchingHeldTargets:true,livePaired:false}));}catch(e){console.error(JSON.stringify({error:e.name,message:String(e.message).split('\n')[0],at:e.stack?.split('\n').filter(l=>l.trim().startsWith('at ')).slice(0,2)}));process.exitCode=1;}}
