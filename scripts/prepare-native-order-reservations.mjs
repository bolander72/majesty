#!/usr/bin/env node
// Bind real empty-name descriptors to validated literal bank payloads.
// Preserve the older controlled-name capture consumed by historical CPU fixtures.
import {open,readFile,stat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';
import {checkpointActorOrderStorageRequests} from '../web/world/order-reservations.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex'),paths=process.argv.slice(2);
if(!paths.length||paths.length>4)throw Error('Pass one to four unchanged owned copied checkpoints');
async function bounded(name){
  const url=new URL('../'+name,import.meta.url),s=await stat(url);
  if(!s.isFile()||s.size>1024*1024)throw Error('Oversized reservation dependency');return readFile(url);
}
const bankName='output/native-order-bank-cases.json',bankBytes=await bounded(bankName),bankCapture=JSON.parse(bankBytes);
if(!bankCapture.qualified||!bankCapture.literalPayloadsMatched||bankCapture.cases.length!==89)throw Error('Missing literal bank capture');
for(const [name,sha]of Object.entries(bankCapture.sourceSha256))if(digest(await bounded(name))!==sha)throw Error('Stale literal bank source');
const cases=[],reports=[],names=new Set();
for(const filename of paths){
  const name=basename(filename);if(names.has(name))throw Error('Duplicate copied fixture');names.add(name);
  const previous=bankCapture.reports.find(r=>r.filename===name);if(!previous)throw Error('Unknown copied bank fixture');
  const handle=await open(filename,'r');
  try{
    const before=await handle.stat({bigint:true});
    if(!before.isFile()||before.size!==BigInt(previous.fileBytes))throw Error('Changed copied bank fixture');
    const size=Number(before.size),io={requests:0,bytes:0,largestRead:0};
    const source={size,async readAt(at,n){
      if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||n>4096||at+n>size)throw Error('Unbounded reservation source read');
      if(++io.requests>16384||io.bytes+n>64*1024*1024)throw Error('Reservation diagnostic I/O budget exceeded');
      const data=new Uint8Array(n),result=await handle.read(data,0,n,at);io.bytes+=result.bytesRead;io.largestRead=Math.max(io.largestRead,n);
      if(result.bytesRead!==n)throw Error('Truncated reservation source');return data;
    }};
    const hash=createHash('sha256');for(let at=0;at<size;at+=4096)hash.update(await source.readAt(at,Math.min(4096,size-at)));
    const sha256=hash.digest('hex');if(sha256!==previous.sha256)throw Error('Copied fixture content changed');
    let actors=0,requestCount=0,allocationRequestBytes=0;
    for(const item of bankCapture.cases.filter(r=>r.filename===name)){
      if(++actors>128||cases.length>=128)throw Error('Reservation case budget exceeded');
      const {plan,requests}=await checkpointActorOrderStorageRequests(source,item.unitId);
      if(plan.banks!==3||plan.entries.length!==item.entryCount||plan.allocationRequestBytes>2048||requests.length>32)
        throw Error('Reservation profile exceeds tiny original-CPU fixture');
      cases.push({...item,requests,allocationRequestBytes:plan.allocationRequestBytes});
      requestCount+=requests.length;allocationRequestBytes+=plan.allocationRequestBytes;
    }
    const after=await handle.stat({bigint:true});for(const key of ['ino','size','mtimeNs','ctimeNs'])
      if(before[key]!==after[key])throw Error('Copied fixture changed during reservation capture');
    reports.push({filename:name,sha256,fileBytes:size,actors,requestCount,allocationRequestBytes,io,
      previousFixtureHashMatched:true,fileIdentityUnchanged:true});
  }finally{await handle.close();}
}
const sourceSha256={};for(const name of ['web/world/checkpoint.mjs','web/world/order-entries.mjs',
  'web/world/order-read-bounds.mjs','web/world/order-restore-bounds.mjs','web/world/order-reservations.mjs',
  'scripts/prepare-native-order-reservations.mjs'])sourceSha256[name]=digest(await bounded(name));
const report={qualified:true,scope:'real empty-name reservation descriptors and literal copied bank payloads only',
  allocationProfile:'real-empty-name-v1',originalNativeConsumptionQualified:false,
  cases,reports,sourceSha256,dependencyEvidenceSha256:{[bankName]:digest(bankBytes)},literalPayloadsMatched:true,
  completeOrderRestorationQualified:false,activeOrderMigrationQualified:false,gameLaunched:false,browserUsed:false,nativeBuildRun:false,crashResolved:false};
const json=JSON.stringify(report,null,2)+'\n';if(Buffer.byteLength(json)>1024*1024)throw Error('Reservation capture exceeds one MiB');
await writeFile(new URL('../output/native-order-real-name-reservation-cases.json',import.meta.url),json);
console.log(JSON.stringify({qualified:true,actors:cases.length,requests:reports.reduce((n,r)=>n+r.requestCount,0),
  allocationRequestBytes:reports.reduce((n,r)=>n+r.allocationRequestBytes,0),fixtureBytes:Buffer.byteLength(json),gameLaunched:false}));
