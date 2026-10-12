#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inspectExtendedRecipientResume} from './inspect-native-coop-extended-recipient-resume.mjs';
const [name,output]=process.argv.slice(2);assert.equal(process.argv.length,4);
const m=JSON.parse(await readFile(resolve(name))),positive=await inspectExtendedRecipientResume(name);
assert.equal(positive.extendedOriginalHostCompletionQualified,true);
assert.equal(positive.originalPingPacketsPreserved.length,1);
const pong=positive.actualOriginalRecipientPongs.find(r=>r.timestamp===positive.originalPingPacketsPreserved[0].timestamp);
assert.ok(pong);
const cases=[
 ['extended-replay-disabled',r=>{r.replayExtendedHostCompletionRequested=false;}],
 ['altered-extended-helper',r=>{r.hostExtendedStreamHelperSha256='0'.repeat(64);}],
 ['missing-original-ping',r=>{r.hostCompletionReplayInputs=r.hostCompletionReplayInputs.filter(x=>x.bytes!==16);}],
 ['altered-original-ping-custody',r=>{r.hostCompletionReplayInputs.find(x=>x.bytes===16).sha256='0'.repeat(64);}],
 ['missing-original-pong',r=>{r.lobbyPacketMetadata=r.lobbyPacketMetadata.filter(x=>x.sequence!==pong.sequence);}],
 ['altered-original-pong-custody',r=>{r.lobbyPacketMetadata.find(x=>x.sequence===pong.sequence).sha256='0'.repeat(64);}],
 ['borrowed-original-ping-source',r=>{const x=r.hostCompletionReplayInputs.find(x=>x.bytes===16);x.source=r.hostCompletionReplayInputs[4].source;}],
];
const scratch=resolve('output/native-multiplayer-lobby-981-observed.json'),results=[];let created=false;
try{for(const [name,mutate]of cases){const copy=structuredClone(m);mutate(copy);
 await writeFile(scratch,JSON.stringify(copy),{flag:'wx'});created=true;
 await assert.rejects(()=>inspectExtendedRecipientResume(scratch),undefined,name);
 await unlink(scratch);created=false;results.push({name,passed:true});}}
finally{if(created)await unlink(scratch);}
await writeFile(resolve(output),JSON.stringify({controls:results.length,results,
 originalPingBytesPreserved:true,actualOriginalPongQualified:true,
 nativeProcessesStarted:0,browserUsed:false,livePairedSynchronizationQualified:false,
 goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({controls:results.length,passed:true,livePaired:false}));
