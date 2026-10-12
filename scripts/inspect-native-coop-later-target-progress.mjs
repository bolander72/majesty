#!/usr/bin/env node
// Full original clock1000 saves; never infer equality from a clock peek.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectTargetProgress} from './inspect-native-coop-target-progress.mjs';
import {inspectExtendedTargetProgress} from './inspect-native-coop-extended-target-progress.mjs';
import {inspectExtendedTargetInputs} from './inspect-native-coop-extended-target-inputs.mjs';
import {inspectTargetInputs} from './inspect-native-coop-target-inputs.mjs';
import {cooperativeKingdoms} from './inspect-native-coop-world.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {compareLaterProgressGameplay} from './lib/coop-later-progress-checkpoint-state.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name,cap=2*1024*1024){
 const source=await stoppedFileSource(resolve(name));assert.ok(source.size<=cap);
 const bytes=Buffer.alloc(source.size);
 for(let n=0;n<bytes.length;n+=4096)bytes.set(await source.readAt(n,Math.min(4096,bytes.length-n)),n);
 return bytes;
}
export async function inspectLaterTargetProgress(name){
 const report=resolve(name),raw=await bounded(report),m=JSON.parse(raw);
 const earlier=m.replayExtendedHostCompletionRequested===true?await inspectExtendedTargetProgress(report):await inspectTargetProgress(report),host=earlier.originalRole==='host';
 const acceptedInputs=host?(m.extendedTargetGuestInputsRequested===true?await inspectExtendedTargetInputs(report):await inspectTargetInputs(report)):null;
 if(host)assert.ok(acceptedInputs.actualRelayAcceptedTargetGuestPackets>=10&&acceptedInputs.actualRelayAcceptedTargetGuestPackets<=16);
 else assert.equal(m.replayHostCompletionRequested,true);
 assert.equal(m.nativeLaterTargetProgressSnapshotRequested,true);
 assert.equal(m.originalLaterTargetProgressSaved,true);
 const row=m.laterTargetProgressSnapshot;
 assert.equal(row.path,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Coop_Target_Later_Progress.GMP'));
 const bytes=await bounded(row.path);assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);
 const state=await connectedWorldState(row.path);
 assert.equal(state.clock,1000);assert.equal(state.label,'Coop_Target_Later_Progress');
 const root=resolve(`output/native-multiplayer-lobby-${String(m.attempt).padStart(3,'0')}`);
 const log=(await bounded(join(root,'native.log'),4*1024*1024)).toString();
 const marker=`[coop-later-progress-fixture] Snapshot epoch=1 serial=1 local=${host?1:2} slot=${host?0:1} region=1_0 frame=20 clock=1000 original-writer=1 complete=1 running=1 source-retained=1 clock-input-phase-writes=0 live-second-engine=0`;
 assert.equal(log.split('\n').filter(l=>l===marker).length,1);
 assert.ok(log.indexOf(marker)>log.indexOf('[coop-progress-fixture] Snapshot'));
 const before=await connectedWorldState(earlier.snapshot.path);
 const changedUnitIds=Object.entries(state.records.units).filter(([id,r])=>JSON.stringify(r)!==JSON.stringify(before.records.units[id])).map(([id])=>Number(id));
 assert.ok(changedUnitIds.length>0,'Require actual entity progression after500');
 const kingdoms=await cooperativeKingdoms(row.path,[0,1]);
 for(const kingdom of kingdoms)assert.ok(kingdom.buildings.length>1);
 return {version:1,report,reportSha256:sha(raw),earlier,acceptedInputs,
  originalRole:earlier.originalRole,originalClock:1000,originalFrame:20,
  snapshot:row,kingdoms,changedUnitIds,actualOriginalLaterProgressSavedQualified:true,
  livePairedSynchronizationQualified:false,browserUsed:false,goalComplete:false,
  verifierInputs:Object.fromEntries(await Promise.all([
   'scripts/inspect-native-coop-later-target-progress.mjs',
   'scripts/lib/coop-later-progress-checkpoint-state.mjs'
  ].map(async p=>[p,sha(await bounded(p))]))),
  scope:'One stopped original role saves full entity progress at real clock1000 after500. The peer is recorded; no live paired simulation claim.'};
}
export async function inspectLaterTargetProgressPair(hostName,guestName){
 const host=await inspectLaterTargetProgress(hostName),guest=await inspectLaterTargetProgress(guestName);
 assert.equal(host.originalRole,'host');assert.equal(guest.originalRole,'guest');
 assert.equal(host.acceptedInputs.sourceRecordedPair.guest,guest.report);
 assert.equal(host.acceptedInputs.sourceRecordedPair.host,guest.earlier.originalResumeProof.hostReport);
 assert.equal(host.earlier.originalResumeProof.descriptorSha256,guest.earlier.originalResumeProof.descriptorSha256);
 const levels=[...host.kingdoms,...guest.kingdoms].map(k=>(k.palace[0].description>>>24)-48);
 assert.ok(levels.every(level=>level===2));
 const comparison=await compareLaterProgressGameplay(await connectedWorldState(host.snapshot.path),await connectedWorldState(guest.snapshot.path),2);
 return {version:1,host,guest,comparison,originalClock:1000,
  recordedRoleLaterFullGameplayEqualityQualified:true,
  livePairedSynchronizationQualified:false,browserUsed:false,goalComplete:false,
  scope:'Full clock1000 gameplay matches in separately executed original roles, preserving actual original commands and real relay admissions. Saved co-op return and live paired gameplay remain unqualified.'};
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{
 assert.ok(process.argv.length===4||process.argv.length===5);
 const pair=process.argv.length===5,p=pair?await inspectLaterTargetProgressPair(process.argv[2],process.argv[3]):await inspectLaterTargetProgress(process.argv[2]);
 await writeFile(resolve(process.argv[pair?4:3]),JSON.stringify(p,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({fullOriginalProgress:true,clock:1000,matchingRecordedRoles:pair,livePaired:false}));
}catch(e){console.error(JSON.stringify({error:e.name,message:String(e.message).split('\n')[0],at:e.stack?.split('\n').filter(l=>l.trim().startsWith('at ')).slice(0,2)}));process.exitCode=1;}}
