#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inspectTargetInputs} from './inspect-native-coop-target-inputs.mjs';
const [name,output]=process.argv.slice(2);assert.equal(process.argv.length,4);
const m=JSON.parse(await readFile(resolve(name))),positive=await inspectTargetInputs(name);
assert.equal(positive.actualRelayAcceptedTargetGuestPackets,10);
const cases=[
 ['target-input-replay-disabled',r=>{r.replayTargetGuestInputsRequested=false;}],
 ['target-inputs-not-queued',r=>{r.originalGuestTargetInputsQueued=false;}],
 ['target-inputs-not-acknowledged',r=>{r.originalGuestTargetInputsDelivered=false;}],
 ['changed-replay-helper',r=>{r.targetGuestInputReplayHelperSha256='0'.repeat(64);}],
 ['changed-captured-input-custody',r=>{r.targetGuestInputReplaySources[2].sha256='0'.repeat(64);}],
 ['borrowed-captured-source',r=>{r.targetGuestInputReplaySources[2].source=r.targetGuestInputReplaySources[3].source;}],
 ['changed-delivered-input',r=>{r.replayedGuestTargetInputPackets[0].sha256='0'.repeat(64);}],
 ['missing-authenticated-ack',r=>{r.targetGuestInputServerAcks.pop();}],
 ['repeated-authenticated-ack',r=>{r.targetGuestInputServerAcks[1]=r.targetGuestInputServerAcks[0];}],
 ['changed-authenticated-ack-custody',r=>{r.targetGuestInputServerAcks[0].sha256='0'.repeat(64);}],
 ['changed-original-resume',r=>{r.originalHostTargetResumeRequestSha256='0'.repeat(64);}],
 ['changed-original-input-request',r=>{r.originalHostTargetInputTriggerSha256='0'.repeat(64);}],
 ['invented-target-frame',r=>{r.originalGuestTargetInputFrames[0]=11;}],
];
const scratch=resolve('output/native-multiplayer-lobby-980-observed.json'),results=[];let created=false;
try{for(const [name,mutate]of cases){const copy=structuredClone(m);mutate(copy);await writeFile(scratch,JSON.stringify(copy),{flag:'wx'});created=true;
 await assert.rejects(()=>inspectTargetInputs(scratch),undefined,name);await unlink(scratch);created=false;results.push({name,passed:true});}}
finally{if(created)await unlink(scratch);}
await writeFile(resolve(output),JSON.stringify({controls:results.length,results,actualRelayAcceptedGuestPackets:10,
 originalFinalClock:positive.originalFinalClock,post500FullWorldEqualityQualified:false,livePairedSynchronizationQualified:false,
 nativeProcessesStarted:0,browserUsed:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({controls:results.length,passed:true,livePaired:false}));
