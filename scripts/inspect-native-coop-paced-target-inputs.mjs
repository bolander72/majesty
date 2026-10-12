#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inspectTargetInputs} from './inspect-native-coop-target-inputs.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name,cap=2*1024*1024){
 const source=await stoppedFileSource(resolve(name));assert.ok(source.size<=cap);
 const b=Buffer.alloc(source.size);
 for(let n=0;n<b.length;n+=4096)b.set(await source.readAt(n,Math.min(4096,b.length-n)),n);
 return b;
}
export async function inspectPacedTargetInputs(name){
 const report=resolve(name),raw=await bounded(report),m=JSON.parse(raw),base=await inspectTargetInputs(report);
 assert.equal(m.pacedTargetGuestInputsRequested,true);
 const bindings=m.targetGuestInputRequestBindings;assert.equal(bindings.length,10);assert.equal(m.targetGuestInputMaximumLookaheadPackets,1);
 let resumed=false;const requests=[];
 for(const row of m.lobbyPacketMetadata){
  const b=await bounded(row.copy,65536);assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256);
  assert.deepEqual([row.sender,row.recipient],[1,2]);
  const header=[b.readUInt32LE(0),b.readUInt32LE(4)];
  if(header[0]===256&&header[1]===4){assert.equal(resumed,false);resumed=true;}
  else if(resumed&&header[0]===256&&header[1]===5){
   assert.equal(b.length,20);const body=Buffer.from(b.subarray(8)).map(x=>x^49);
   assert.deepEqual([body.readUInt32LE(4),body.readUInt32LE(8)],[0,50]);
   requests.push({frame:body.readUInt32LE(0),sha256:row.sha256,sequence:row.sequence});
  }
 }
 assert.ok(requests.length>=9);
 for(const [i,binding]of bindings.entries()){
  const request=requests[Math.max(0,i-1)];assert.equal(request.frame,10+2*Math.max(0,i-1));
  assert.deepEqual(binding,{sequence:m.replayedGuestTargetInputPackets[i].sequence,guestInputFrame:10+i*2,originalHostRequestFrame:request.frame,originalHostRequestSha256:request.sha256});
 }
 return {version:1,report,reportSha256:sha(raw),base,actualOriginalHostRequestsBound:9,maximumLookaheadPackets:1,
  capturedGuestInputsPreserved:true,realRelayAcceptedInputs:10,originalFinalClock:base.originalFinalClock,
  browserUsed:false,livePairedSynchronizationQualified:false,goalComplete:false,
  verifierInputs:{'scripts/inspect-native-coop-paced-target-inputs.mjs':sha(await readFile(new URL(import.meta.url)))},
  scope:'Ten actual original guest inputs are consumed once by the replay fixture after actual host requests with at most one captured input of lookahead. Real relay ACKs and full500 equality are independently checked; no live peer claim.'};
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{
 assert.equal(process.argv.length,4);const p=await inspectPacedTargetInputs(process.argv[2]);
 await writeFile(resolve(process.argv[3]),JSON.stringify(p,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({actualHostRequests:9,relayAcceptedInputs:10,originalFinalClock:p.originalFinalClock,livePaired:false}));
}catch(e){console.error(JSON.stringify({error:e.name,message:String(e.message).split('\n')[0],at:e.stack?.split('\n').filter(l=>l.trim().startsWith('at ')).slice(0,2)}));process.exitCode=1;}}
