#!/usr/bin/env node
// Independently inspect stopped recorded-recipient host load evidence.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectCoopWorld,cooperativeKingdoms} from './inspect-native-coop-world.mjs';
import {inspectRecipientProposal} from './inspect-native-coop-recipient-proposal.mjs';
import {inspectCoopProposal} from './inspect-native-coop-proposal.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {compareGeneratedKingdomGameplay} from './lib/coop-host-checkpoint-state.mjs';
import {compareGeneratedConfiguration} from './lib/coop-generated-configuration.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name,cap=2*1024*1024){const s=await stoppedFileSource(resolve(name));assert.ok(s.size<=cap);const b=Buffer.alloc(s.size);for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;}
async function copied(row,cap){const b=await bounded(row.copy??row.path,cap);assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256);return b;}
export async function inspectHostLoaded(name,{requireGameplayEquality=true}={}){
 assert.equal(typeof requireGameplayEquality,'boolean');
 const report=resolve(name),raw=await bounded(report),m=JSON.parse(raw),source=await inspectCoopWorld(report);
 assert.equal(source.originalRole,'host');assert.equal(source.scriptCompleted,true);
 for(const k of ['replayRecipientVotesRequested','nativeBeginFreshNeighborRequested','nativeLoadedTargetSnapshotRequested','originalLoadedTargetSaved','nativePauseWorldRequested','originalGuestInputWindowDelivered'])assert.equal(m[k],true,k);
 assert.equal(m.nativeReadbackWorldRequested,false);assert.equal(m.replayHostProposalRequested,false);
 assert.deepEqual(source.snapshots.map(s=>[s.frame,s.clock]),[[0,0],[11,550]]);
 assert.equal(m.referenceReplayedRecipientReadyVotes,1);assert.equal(m.referenceReplayedRecipientLoadedVotes,1);
 const root=join('output',`native-multiplayer-lobby-${String(m.attempt).padStart(3,'0')}`);
 assert.equal(sha(await bounded(resolve(root,'native_coop_proposal_replay.py'))),m.proposalReplayHelperSha256);
 assert.equal(sha(await bounded(resolve(root,'native_coop_proposal_observer.py'))),m.proposalObserverSha256);
 const inputs=m.recipientVoteReplayInputs;assert.equal(inputs.length,3);
 for(const [i,r] of inputs.entries())assert.ok(r.copy.startsWith(resolve(root,'captured-host-inputs/proposal-source-')+String(i).padStart(3,'0')));
 const recorded=JSON.parse(await copied(inputs[0]));
 const recipient=await inspectRecipientProposal(recorded.report),host=await inspectCoopProposal(recipient.hostProposalReport);
 for(const k of ['reportSha256','descriptorSha256','capturedRecipientRequests','verifierInputs'])assert.deepEqual(recorded[k],recipient[k]);
 const wires=await Promise.all(inputs.slice(1).map(r=>copied(r,2048))),descriptor=wires[0].subarray(32);
 assert.equal(sha(descriptor),recipient.descriptorSha256);assert.ok(wires[1].subarray(32).equals(descriptor));
 assert.deepEqual(m.replayedOriginalRecipientVoteBodies,recipient.capturedRecipientRequests.map((r,i)=>({action:i+2,source:r.copy,bytes:wires[i].length-20,sha256:sha(wires[i].subarray(20))})));
 const prefix=join(m.profile,'Documents/My Games/MajestyHD/SaveGame/CoopTransitions_native-terrain-fixture_0_0');
 assert.equal(m.importedAgreedSource.length,2);
 for(const [i,row] of m.importedAgreedSource.entries()){
  assert.equal(row.source,[host.sourceCheckpoint.path,host.marker.path][i]);
  assert.equal(row.copy,join(m.profile,'captured-coop-source',i?'source.checkpoint':'source_0.GMP'));
  const b=await copied(row);assert.ok(b.equals(await bounded(row.source)));
  assert.ok(b.equals(await bounded(prefix+(i?'.checkpoint':'_0.GMP'))));
 }
 const before=await connectedWorldState(source.snapshots[1].path),imported=await connectedWorldState(prefix+'_0.GMP');
 let sourceComparison=null,sourceComparisonFailure=null;
 try{sourceComparison=compareConnectedWorlds(before,imported);}catch(e){if(requireGameplayEquality||e.code!=='ERR_ASSERTION')throw e;sourceComparisonFailure=String(e.message).split('\n')[0];}
 const requestSpecs=[[2,12,0],[2,13,6],[1,12,0],[1,13,6],[1,12,1],[1,12,2],[2,12,2],[1,12,3],[2,12,3]];
 const requests=m.proposalProtocolRequests;assert.equal(requests.length,9);
 // Lane enables can interleave; each endpoint must enable both lanes before
 // any vote. The five non-enable requests retain exact original order/bodies.
 const enables=requests.filter(r=>r.action===0||r.op===13),actions=requests.filter(r=>r.op===12&&r.action>0);
 assert.deepEqual(enables.map(r=>[r.sender,r.op,r.action]).sort(),requestSpecs.slice(0,4).sort());
 assert.deepEqual(actions.map(r=>[r.sender,r.op,r.action]).slice(0,1),[[1,12,1]]);
 assert.deepEqual(actions.slice(1,3).map(r=>[r.sender,r.op,r.action]).sort(),[[1,12,2],[2,12,2]].sort());
 assert.deepEqual(actions.slice(3).map(r=>[r.sender,r.op,r.action]),[[1,12,3],[2,12,3]]);
 for(const [i,r] of requests.entries()){
  assert.equal(r.host,r.sender===1);assert.equal(r.copy,resolve(root,`owned-lobby-packets/proposal-rpc-${String(i).padStart(3,'0')}.bin`));
  const b=await copied(r,2048);assert.deepEqual(Array.from({length:6},(_,n)=>b.readUInt32LE(n*4)),[0x31525044,1,r.op,r.request,0,r.action]);assert.ok(r.request>0);
  if(r.op===12&&r.action>0){assert.equal(b.readUInt32LE(24),1);assert.equal(b.readUInt32LE(28),descriptor.length);assert.equal(b.length,32+descriptor.length);assert.ok(b.subarray(32).equals(descriptor));if(r.sender===2)assert.ok(b.subarray(20).equals(wires[r.action-2].subarray(20)));}
 }
 assert.equal(m.observedProposalEvents.length,3);
 for(const [i,r] of m.observedProposalEvents.entries()){
  assert.deepEqual([r.serial,r.stage,r.players,r.descriptorSha256],[1,i+1,[1,2],sha(descriptor)]);
  assert.equal(r.copy,resolve(root,`owned-lobby-packets/proposal-${String(i).padStart(3,'0')}.bin`));const b=await copied(r,2048);
  assert.ok(b.equals(Buffer.concat([Buffer.from(new Uint32Array([1,i+1,descriptor.length]).buffer),descriptor,Buffer.from(new Uint32Array([2,1,2]).buffer)])));
 }
 const log=(await bounded(resolve(root,'native.log'),4*1024*1024)).toString();let cursor=-1;
 const markers=[
 '[coop-source-import-fixture] Imported epoch=1 serial=1 source=0_0 revision=1 frame=11 clock=550 original-world-unmodified=1',
 '[coop-load] Begin epoch=1 serial=1 region=1_0 bytes=0',
 '[coop-load] Ready fresh epoch=1 serial=1 local-source-revision=1',
 '[coop-load] Source network buffers retired serial=1',
 '[coop-generation] Original source interface/world teardown completed serial=1 pause-held=1',
 '[coop-generation] Committed context epoch=1 serial=1 region=1_0 source-retained=1 source-disposed=1',
 '[coop-load] Committed rebuild queued epoch=1 serial=1',
 '[coop-load] Connected return bound epoch=1 serial=1 region=1_0',
 '[coop-load] Attached epoch=1 serial=1 slot=0',
 '[coop-load] Held epoch=1 serial=1 slot=0 clock=0',
 '[coop-load] Loaded epoch=1 serial=1 slot=0',
 '[coop-target-fixture] Snapshot epoch=1 serial=1 local=1 slot=0 region=1_0 frame=0 clock=0 original-writer=1 source-retained=1 coordinator-loaded=1 peer-loaded=0 resume-controls=0 live-second-engine=0'];
 for(const marker of markers){assert.equal(log.split('\n').filter(l=>l===marker).length,1,marker);const next=log.indexOf(marker);assert.ok(next>cursor,marker);cursor=next;}
 assert.ok(!/\[coop-load\] Rejected|\[coop-transfer\] Rejected|\[coop-read-fixture\]|\[coop-phase2-fixture\]/.test(log));
 const queued=log.includes('[coop-load] Resume queued epoch=1 serial=1'),resumed=log.includes('[coop-load] Resumed epoch=1 serial=1 region=1_0');
 if(queued)assert.ok(log.indexOf('[coop-load] Resume queued epoch=1 serial=1')>cursor);
 if(resumed)assert.ok(queued&&log.indexOf('[coop-load] Resumed epoch=1 serial=1 region=1_0')>log.indexOf('[coop-load] Resume queued epoch=1 serial=1'));
 const target=m.loadedTargetSnapshot;assert.equal(target.path,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Coop_World_Target.GMP'));await copied(target);
 const state=await connectedWorldState(target.path);assert.equal(state.clock,0);assert.equal(state.label,'Coop_World_Target');
 const kingdoms=await cooperativeKingdoms(target.path,[0,1]);for(const k of kingdoms)assert.ok(k.buildings.length>1);
 const configuration=await compareGeneratedConfiguration(source.snapshots[1].path,target.path,'1_0');assert.equal(state.rng,configuration.targetSeed);assert.equal(state.gameplayRng,configuration.targetSeed);
 const st=await checkpointTerrain(await stoppedFileSource(source.snapshots[1].path)),tt=await checkpointTerrain(await stoppedFileSource(target.path));
 for(let at=0;at<=128;at+=33){const count=Math.min(33,129-at),a=await st.edge('right',at,count),b=await tt.edge('left',at,count);for(let i=0;i<count;++i)assert.ok(Buffer.from(a.subarray(i*9,i*9+4)).equals(Buffer.from(b.subarray(i*9,i*9+4))));}
 const guestState=await connectedWorldState(recipient.targetSnapshot.path);
 const guestKingdoms=await cooperativeKingdoms(recipient.targetSnapshot.path,[0,1]);
 const levels=[...kingdoms,...guestKingdoms].map(k=>(k.palace[0].description>>>24)-48);assert.ok(levels.every(l=>l===levels[0]));
 let targetComparison=null,targetComparisonFailure=null;
 try{targetComparison=await compareGeneratedKingdomGameplay(state,guestState,levels[0]);}catch(e){if(requireGameplayEquality||e.code!=='ERR_ASSERTION')throw e;targetComparisonFailure=String(e.message).split('\n')[0];}
 return{version:1,verifierInputs:{...source.verifierInputs,'scripts/inspect-native-coop-host-loaded.mjs':sha(await readFile(new URL(import.meta.url))),'scripts/lib/coop-host-checkpoint-state.mjs':sha(await readFile(new URL('./lib/coop-host-checkpoint-state.mjs',import.meta.url)))},report,reportSha256:sha(raw),sourceProof:source,recipientReport:recipient.report,recipientReportSha256:recipient.reportSha256,sourceImportExact:true,sourceComparison,sourceComparisonFailure,sourceImportedLiveGameplayMatches:sourceComparison!==null,descriptorSha256:sha(descriptor),capturedHostRequests:actions.filter(r=>r.sender===1),hostCommittedGenerationRebuildLoadedQualified:true,targetSnapshot:{...target,kingdoms,configuration},sharedEdgeHeightsMatch:true,targetGameplayComparison:targetComparison,targetComparisonFailure,recordedRoleTargetGameplayEqualityQualified:targetComparison!==null,hostOriginalResumeQueued:queued,hostOriginalResumeExecuted:resumed,sharedResumeQualified:false,pairedSynchronizationQualified:false,liveSecondOriginalEngine:false,browserUsed:false,goalComplete:false,scope:'One original host executes committed fresh generation, rebuild, Loaded and original resume with inspected actual recipient votes. Full-world comparison can independently refuse equality; live paired synchronized gameplay remains unqualified.'};
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{assert.ok(process.argv.length===4||process.argv.length===5&&process.argv[4]==='--observe-divergence');const p=await inspectHostLoaded(process.argv[2],{requireGameplayEquality:process.argv.length===4});await writeFile(resolve(process.argv[3]),JSON.stringify(p,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({hostLoaded:true,sourceGameplayMatches:p.sourceImportedLiveGameplayMatches,targetGameplayEquality:p.recordedRoleTargetGameplayEqualityQualified,sourceComparisonFailure:p.sourceComparisonFailure,targetComparisonFailure:p.targetComparisonFailure,hostResumeQueued:p.hostOriginalResumeQueued,hostResumeExecuted:p.hostOriginalResumeExecuted,livePaired:false}));}catch(e){console.error(JSON.stringify({error:e.name,message:String(e.message).split('\n')[0],at:e.stack?.split('\n').filter(l=>l.trim().startsWith('at ')).slice(0,2)}));process.exitCode=1;}}
