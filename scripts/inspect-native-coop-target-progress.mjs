#!/usr/bin/env node
// Inspect stopped full-world progression after actual recorded co-op resume.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectHostLoaded} from './inspect-native-coop-host-loaded.mjs';
import {inspectRecipientResume} from './inspect-native-coop-recipient-resume.mjs';
import {cooperativeKingdoms} from './inspect-native-coop-world.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {compareProgressGameplay} from './lib/coop-progress-checkpoint-state.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name,cap=2*1024*1024){
 const s=await stoppedFileSource(resolve(name));assert.ok(s.size<=cap);const b=Buffer.alloc(s.size);
 for(let n=0;n<b.length;n+=4096)b.set(await s.readAt(n,Math.min(4096,b.length-n)),n);return b;
}
export async function inspectTargetProgress(name){
 const report=resolve(name),raw=await bounded(report),m=JSON.parse(raw);
 const host=m.replayRecipientVotesRequested===true;
 const resume=host?await inspectHostLoaded(report):await inspectRecipientResume(report);
 assert.equal(host?resume.hostOriginalResumeExecuted:resume.actualRecipientOriginalResumeExecutedQualified,true);
 assert.equal(m.nativeTargetProgressSnapshotRequested,true);assert.equal(m.originalTargetProgressSaved,true);
 assert.equal(m.nativeExitCode,0);assert.equal(m.producerAbsent,true);assert.equal(m.fixtureStopped,true);
 const root=resolve(`output/native-multiplayer-lobby-${String(m.attempt).padStart(3,'0')}`);
 const log=(await bounded(join(root,'native.log'),4*1024*1024)).toString();
 const matches=[...log.matchAll(/^\[coop-progress-fixture\] Snapshot epoch=1 serial=1 local=(\d) slot=(\d) region=1_0 frame=(\d+) clock=500 original-writer=1 complete=1 running=1 source-retained=1 clock-input-phase-writes=0 live-second-engine=0$/gm)];
 assert.equal(matches.length,1);const marker=matches[0];
 assert.deepEqual(marker.slice(1,3).map(Number),host?[1,0]:[2,1]);
 const frame=Number(marker[3]);assert.ok(frame>0&&frame<=32);
 assert.ok(marker.index>log.indexOf('[coop-load] Resumed epoch=1 serial=1 region=1_0'));
 const row=m.targetProgressSnapshot;
 assert.equal(row.path,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Coop_Target_Progress.GMP'));
 const bytes=await bounded(row.path);assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);
 const state=await connectedWorldState(row.path);assert.equal(state.clock,500);assert.equal(state.label,'Coop_Target_Progress');
 const held=await connectedWorldState(m.loadedTargetSnapshot.path);assert.equal(held.clock,0);
 const changedUnitIds=Object.entries(state.records.units).filter(([id,r])=>JSON.stringify(r)!==JSON.stringify(held.records.units[id])).map(([id])=>Number(id));
 assert.ok(changedUnitIds.length>0,'Require actual saved entity progress beyond advancing the clock');
 const kingdoms=await cooperativeKingdoms(row.path,[0,1]);for(const k of kingdoms)assert.ok(k.buildings.length>1);
 return {version:1,report,reportSha256:sha(raw),originalRole:host?'host':'guest',originalResumeProof:resume,
  originalClock:500,originalFrame:frame,snapshot:row,kingdoms,changedUnitIds,
  actualOriginalPostResumeProgressSavedQualified:true,livePairedSynchronizationQualified:false,
  browserUsed:false,goalComplete:false,verifierInputs:Object.fromEntries(await Promise.all([
   'scripts/inspect-native-coop-target-progress.mjs','scripts/lib/coop-progress-checkpoint-state.mjs'
  ].map(async p=>[p,await hashCheckpointSource(await stoppedFileSource(resolve(p)))]))),
  scope:'One stopped original role advances to actual clock500 after real Complete and original resume. The peer is recorded and has no continuing simulation.'};
}
export async function inspectTargetProgressPair(hostName,guestName){
 const host=await inspectTargetProgress(hostName),guest=await inspectTargetProgress(guestName);
 assert.equal(host.originalRole,'host');assert.equal(guest.originalRole,'guest');
 assert.equal(guest.originalResumeProof.hostReport,host.report);
 assert.equal(guest.originalResumeProof.hostReportSha256,host.reportSha256);
 assert.equal(host.originalFrame,guest.originalFrame);
 const levels=[...host.kingdoms,...guest.kingdoms].map(k=>(k.palace[0].description>>>24)-48);
 assert.ok(levels.every(l=>l===levels[0]));
 const comparison=await compareProgressGameplay(await connectedWorldState(host.snapshot.path),await connectedWorldState(guest.snapshot.path),levels[0]);
 return {version:1,host,guest,comparison,recordedRolePostResumeGameplayEqualityQualified:true,
  originalClock:500,livePairedSynchronizationQualified:false,browserUsed:false,goalComplete:false,
  scope:'Two separately executed original roles have matching full gameplay after real recorded resume at clock500. Live paired simulation, continued shared inputs and saved cooperative return remain unqualified.'};
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{
 assert.ok(process.argv.length===4||process.argv.length===5);
 const pair=process.argv.length===5,p=pair?await inspectTargetProgressPair(process.argv[2],process.argv[3]):await inspectTargetProgress(process.argv[2]);
 await writeFile(resolve(process.argv[pair?4:3]),JSON.stringify(p,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({postResumeProgress:true,matchingRecordedRoles:pair,clock:500,livePaired:false}));
}catch(e){console.error(JSON.stringify({error:e.name,message:String(e.message).split('\n')[0],at:e.stack?.split('\n').filter(l=>l.trim().startsWith('at ')).slice(0,2)}));process.exitCode=1;}}
