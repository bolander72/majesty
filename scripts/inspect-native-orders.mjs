#!/usr/bin/env node
// Bounded structural checks; no order activation, migration or engine launch.
import {open,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';
import {checkpointAttachments,MAX_CHECKPOINT_BYTES} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';

const paths=process.argv.slice(2);
if(!paths.length||paths.length>4)throw new Error('Usage: node scripts/inspect-native-orders.mjs <owned stopped GMP> [up to four total]');
const evidenceUrl=new URL('../output/native-order-writers-emulated-observed.json',import.meta.url);
const writers=JSON.parse(await readFile(evidenceUrl,'utf8'));
if(!writers.qualified||writers.completedCalls!==20)throw new Error('Run check-native-order-writers.py first');
for(const [name,digest]of Object.entries(writers.sourceSha256))
  if(createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex')!==digest)
    throw new Error('Original writer evidence is stale');
const word=n=>{const bytes=new Uint8Array(4);new DataView(bytes.buffer).setUint32(0,n,true);return bytes;};
const concat=parts=>{const result=new Uint8Array(parts.reduce((sum,p)=>sum+p.length,0));let at=0;for(const p of parts){result.set(p,at);at+=p.length;}return result;};
const words=values=>concat(values.map(word));
const chunk=(tag,body=new Uint8Array(),version=0,count=0)=>concat([new TextEncoder().encode(tag),word(body.length),word(version),word(count),body]);
let originalPayloadChecks=0;
for(const replay of writers.replays){
  const banks=concat([words([1,1,1,replay.kind]),words(replay.words),words([1,0,1,0])]);
  const data=concat([chunk('VERS',new Uint8Array(256),1),chunk('ORDR',concat([word(506),chunk('ORDR',chunk('PRIM',banks,2),0,1)]),1,1),chunk('CONT',undefined,1)]);
  const source={size:data.length,async readAt(at,n){return data.subarray(at,at+n);}};
  let selected;const points=[];
  for await(const value of checkpointActorOrderEntries(source,506)){
    if(value.type==='entry')selected=value;
    if(value.type==='waypoint')points.push(value.firstWord,value.secondWord);
  }
  if(!selected||selected.size!==replay.fixedBytes||
      JSON.stringify([...selected.words,...points])!==JSON.stringify(replay.words))
    throw new Error('Parser differs from original emitted payload');
  ++originalPayloadChecks;
}
const reports=[];
for(const filename of paths){
  const handle=await open(filename,'r');
  try{
    const before=await handle.stat({bigint:true});
    if(!before.isFile()||before.size>BigInt(MAX_CHECKPOINT_BYTES))throw new Error('Invalid bounded native snapshot');
    const size=Number(before.size),io={requests:0,bytes:0,largestRead:0};
    const source={size,async readAt(at,n){
      if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||n>4096||at+n>size)
        throw new Error('Unbounded native snapshot read');
      if(++io.requests>16384||io.bytes+n>64*1024*1024)throw new Error('Diagnostic I/O budget exceeded');
      const bytes=new Uint8Array(n),result=await handle.read(bytes,0,n,at);
      io.bytes+=result.bytesRead;io.largestRead=Math.max(io.largestRead,n);return bytes.subarray(0,result.bytesRead);
    }};
    const hash=createHash('sha256');for(let at=0;at<size;at+=4096)hash.update(await source.readAt(at,Math.min(4096,size-at)));
    let orderAttachments=0,fullyParsed=0,entries=0,waypoints=0;const unsupportedKinds={},entryKinds={},samples=[];
    for await(const attachment of checkpointAttachments(source)){
      if(attachment.kind!=='ORDR')continue;
      if(++orderAttachments>128)throw new Error('Diagnostic attachment budget exceeded');
      let recordEntries=0,recordWaypoints=0,recordKinds={},sample;
      try{
        for await(const value of checkpointActorOrderEntries(source,attachment.unitId)){
          if(value.type==='waypoint'){++recordWaypoints;continue;}
          if(value.type!=='entry')continue;
          ++recordEntries;recordKinds[value.kind]=(recordKinds[value.kind]??0)+1;
          sample??={unitId:value.unitId,bank:value.bank,kind:value.kind,entryBytes:value.size};
        }
      }catch(error){
        if(error.code!=='NATIVE_ORDER_KIND_UNSUPPORTED')throw error;
        unsupportedKinds[error.kind]=(unsupportedKinds[error.kind]??0)+1;continue;
      }
      ++fullyParsed;entries+=recordEntries;waypoints+=recordWaypoints;
      for(const [kind,count]of Object.entries(recordKinds))entryKinds[kind]=(entryKinds[kind]??0)+count;
      if(sample&&samples.length<8)samples.push(sample);
    }
    const after=await handle.stat({bigint:true});
    for(const key of ['ino','size','mtimeNs','ctimeNs'])if(before[key]!==after[key])throw new Error('Snapshot changed during inspection');
    reports.push({filename:basename(filename),sha256:hash.digest('hex'),fileBytes:size,io,orderAttachments,
      fullyParsed,entries,waypoints,entryKinds,unsupportedKinds,samples,fileIdentityUnchanged:true});
  }finally{await handle.close();}
}
const names=['web/world/checkpoint.mjs','web/world/order-entries.mjs','scripts/inspect-native-orders.mjs'];
const sourceSha256=Object.fromEntries(await Promise.all(names.map(async name=>
  [name,createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex')])));
const report={qualified:true,scope:'structural parsing of current writer layouts for kinds 1,2,4,5,6,7,10,11 only',originalPayloadChecks,reports,sourceSha256,
  writerEvidenceSha256:createHash('sha256').update(await readFile(evidenceUrl)).digest('hex'),
  referenceSemanticsQualified:false,activeOrderMigrationQualified:false,liveHeroCrossingQualified:false,
  liveNativePagingQualified:false,gameLaunched:false,browserUsed:false,nativeBuildRun:false,crashResolved:false,goalCompleted:false};
await writeFile(new URL('../output/native-order-entries-snapshots-observed.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({qualified:true,originalPayloadChecks,files:reports.length,
  fullyParsed:reports.reduce((sum,r)=>sum+r.fullyParsed,0),entries:reports.reduce((sum,r)=>sum+r.entries,0),
  unsupportedRecords:reports.reduce((sum,r)=>sum+Object.values(r.unsupportedKinds).reduce((a,b)=>a+b,0),0),
  largestRead:Math.max(...reports.map(r=>r.io.largestRead)),gameLaunched:false}));
