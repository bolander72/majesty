#!/usr/bin/env node
// Compare three unsafe original bank inputs with existing source admission.
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
const nativeUrl=new URL('../output/native-order-bank-failures-emulated-observed.json',import.meta.url);
if((await stat(nativeUrl)).size>64*1024)throw Error('Unbounded native bank fixture evidence');
const nativeBytes=await readFile(nativeUrl),native=JSON.parse(nativeBytes);
if(!native.qualified||native.completedCalls!==28||native.controlledFaultCases!==2||native.outcomes.length!==16)
  throw Error('Missing bounded original bank control-flow evidence');
for(const [name,sha]of Object.entries(native.sourceSha256))
  if(digest(await readFile(new URL('../'+name,import.meta.url)))!==sha)throw Error('Stale original bank fixture source');
const words=values=>{
  const b=Buffer.alloc(values.length*4);values.forEach((n,i)=>b.writeUInt32LE(n,i*4));return b;
};
const chunk=(tag,body=Buffer.alloc(0),version=0,count=0)=>Buffer.concat([Buffer.from(tag),words([body.length,version,count]),body]);
const controls=[['unchecked-bank-version',/Unsupported native order bank/],
  ['unchecked-entry-version',/Unsupported native order entry prefix/],
  ['unknown-kind-with-no-body',/Unsupported native order kind: 99/]],observations=[];
for(const [name,expected]of controls){
  const fixture=native.outcomes.find(o=>o.name===name&&o.stackPoison===0x5a);
  if(!fixture||fixture.readerReturn!==0||fixture.nullNodeWriteCaught||!Array.isArray(fixture.inputBankWords)||
     fixture.inputBankWords.length>26||fixture.inputBankWords.length!==fixture.inputWordCount||
     fixture.inputBankWords.some(n=>!Number.isInteger(n)||n<0||n>0xffffffff))throw Error('Invalid native admission control');
  const body=Buffer.concat([words(fixture.inputBankWords),words([1,0,1,0])]);
  const record=Buffer.concat([words([506]),chunk('ORDR',chunk('PRIM',body,2),0,1)]);
  const data=Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('ORDR',record,1,1),chunk('CONT',undefined,1)]);
  const io={requests:0,bytes:0,largestRead:0};let rejection;
  const source={size:data.length,async readAt(at,n){
    if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||n>4096||at+n>data.length)
      throw Error('Unbounded bank admission control read');
    if(++io.requests>32||io.bytes+n>8192)throw Error('Bank admission control I/O budget exceeded');
    io.bytes+=n;io.largestRead=Math.max(io.largestRead,n);return data.subarray(at,at+n);
  }};
  try{for await(const _ of checkpointActorOrderEntries(source,506)){/* Full traversal required. */}}
  catch(error){rejection=error.message;}
  if(!rejection||!expected.test(rejection))throw Error('Existing source admission did not reject the unsafe bank control: '+name);
  observations.push({name,originalBankReturn:fixture.readerReturn,sourceAdmissionRejected:true,rejection,io});
}
const names=['web/world/checkpoint.mjs','web/world/order-entries.mjs','scripts/check-order-bank-admission-controls.mjs'];
const sourceSha256={};for(const name of names)sourceSha256[name]=digest(await readFile(new URL('../'+name,import.meta.url)));
const report={qualified:true,scope:'three synthetic bank version/kind admission controls only',observations,sourceSha256,
  nativeEvidenceSha256:digest(nativeBytes),nativeLeafFailureRollbackQualified:false,completeBankRestorationQualified:false,
  gameLaunched:false,browserUsed:false,nativeBuildRun:false,crashResolved:false};
await writeFile(new URL('../output/order-bank-admission-controls-observed.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({qualified:true,originalSuccessInputsRejected:observations.length,gameLaunched:false}));
