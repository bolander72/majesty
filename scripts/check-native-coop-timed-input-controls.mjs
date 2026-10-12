#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inspectExtendedTargetInputs} from './inspect-native-coop-extended-target-inputs.mjs';
const [name,output]=process.argv.slice(2);assert.equal(process.argv.length,4);
const m=JSON.parse(await readFile(resolve(name))),positive=await inspectExtendedTargetInputs(name);
assert.equal(positive.timedActualPeerCadenceQualified,true);
const cases=[
 ['timed-admission-disabled',r=>{r.timedTargetGuestInputsRequested=false;}],
 ['ambiguous-replay-admission',r=>{r.pacedTargetGuestInputsRequested=true;}],
 ['missing-captured-send-cadence',r=>{r.targetGuestInputSendCadence.pop();}],
 ['unqualified-input-burst',r=>{r.targetGuestInputSendCadence[1].monotonicNs=r.targetGuestInputSendCadence[0].monotonicNs+50000000;}],
 ['invented-peer-frame',r=>{r.targetGuestInputSendCadence[1].guestInputFrame=13;}],
];
const scratch=resolve('output/native-multiplayer-lobby-983-observed.json'),results=[];let created=false;
try{for(const [name,mutate]of cases){const copy=structuredClone(m);mutate(copy);
 await writeFile(scratch,JSON.stringify(copy),{flag:'wx'});created=true;
 await assert.rejects(()=>inspectExtendedTargetInputs(scratch),undefined,name);
 await unlink(scratch);created=false;results.push({name,passed:true});}}
finally{if(created)await unlink(scratch);}
await writeFile(resolve(output),JSON.stringify({controls:results.length,results,
 actualRelayAcceptedTargetGuestPackets:positive.actualRelayAcceptedTargetGuestPackets,
 originalFinalClock:positive.originalFinalClock,originalBytesPreserved:true,
 nativeProcessesStarted:0,browserUsed:false,livePairedSynchronizationQualified:false,
 goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({controls:results.length,passed:true,livePaired:false}));
