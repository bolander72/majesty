#!/usr/bin/env node
// Source-only native path storage admission against unchanged stopped copies.
import {open,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';
import {checkpointAttachments,MAX_CHECKPOINT_BYTES} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderReadBounds} from '../web/world/order-read-bounds.mjs';
const paths=process.argv.slice(2),digest=b=>createHash('sha256').update(b).digest('hex');
if(!paths.length||paths.length>4)throw Error('Pass one to four unchanged owned stopped checkpoint fixtures');
const nativeUrl=new URL('../output/native-order-readers-emulated-observed.json',import.meta.url),nativeBytes=await readFile(nativeUrl);
const native=JSON.parse(nativeBytes);
if(!native.qualified||native.roundTrips!==22||native.completedCalls!==44||native.mappedGuestBytesAfterCleanup!==0)
  throw Error('Missing bounded original reader qualification');
for(const [name,sha]of Object.entries(native.sourceSha256))
  if(digest(await readFile(new URL('../'+name,import.meta.url)))!==sha)throw Error('Stale original reader source');
const writerUrl=new URL('../output/native-order-writers-emulated-observed.json',import.meta.url);
if(digest(await readFile(writerUrl))!==native.writerEvidenceSha256)throw Error('Original writer dependency changed');
const prior=JSON.parse(await readFile(new URL('../output/native-order-entries-snapshots-observed.json',import.meta.url),'utf8'));
const reports=[];
for(const filename of paths){
  const handle=await open(filename,'r');
  try{
    const before=await handle.stat({bigint:true});
    if(!before.isFile()||before.size>BigInt(MAX_CHECKPOINT_BYTES))throw Error('Invalid bounded checkpoint');
    const size=Number(before.size),io={requests:0,bytes:0,largestRead:0};
    const source={size,async readAt(at,n){
      if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||n>4096||at+n>size)throw Error('Unbounded path storage read');
      if(++io.requests>16384||io.bytes+n>64*1024*1024)throw Error('Path storage diagnostic I/O budget exceeded');
      const bytes=new Uint8Array(n),result=await handle.read(bytes,0,n,at);
      io.bytes+=result.bytesRead;io.largestRead=Math.max(io.largestRead,n);
      if(result.bytesRead!==n)throw Error('Truncated path storage source');return bytes;
    }};
    const hash=createHash('sha256');for(let at=0;at<size;at+=4096)hash.update(await source.readAt(at,Math.min(4096,size-at)));
    const sha256=hash.digest('hex'),previous=prior.reports.find(r=>r.filename===basename(filename));
    if(!previous||previous.sha256!==sha256)throw Error('Requires unchanged copied structural fixtures');
    let attachments=0,pathEntries=0,totalPathStorageBytes=0,largestActorPathStorageBytes=0,maxKindFourCapacity=0,maxKindSevenCount=0;
    const kinds={},samples=[];
    for await(const attachment of checkpointAttachments(source)){
      if(attachment.kind!=='ORDR')continue;
      if(++attachments>128)throw Error('Path storage diagnostic attachment budget exceeded');
      const plan=await checkpointActorOrderReadBounds(source,attachment.unitId);
      if(plan.completeOrderMigration!==false)throw Error('Storage admission claimed complete migration');
      pathEntries+=plan.paths.length;totalPathStorageBytes+=plan.pathStorageBytes;
      largestActorPathStorageBytes=Math.max(largestActorPathStorageBytes,plan.pathStorageBytes);
      for(const path of plan.paths){
        kinds[path.kind]=(kinds[path.kind]??0)+1;
        if(path.kind===4)maxKindFourCapacity=Math.max(maxKindFourCapacity,path.capacity);
        else maxKindSevenCount=Math.max(maxKindSevenCount,path.count);
      }
      if(plan.paths.length&&samples.length<8)samples.push({unitId:attachment.unitId,pathStorageBytes:plan.pathStorageBytes,paths:plan.paths});
    }
    const after=await handle.stat({bigint:true});
    for(const key of ['ino','size','mtimeNs','ctimeNs'])if(before[key]!==after[key])throw Error('Checkpoint changed during inspection');
    reports.push({filename:basename(filename),sha256,fileBytes:size,attachments,pathEntries,kinds,totalPathStorageBytes,
      largestActorPathStorageBytes,maxKindFourCapacity,maxKindSevenCount,io,samples,
      previousFixtureHashMatched:true,fileIdentityUnchanged:true});
  }finally{await handle.close();}
}
const names=['web/world/checkpoint.mjs','web/world/order-entries.mjs','web/world/order-read-bounds.mjs','scripts/inspect-native-order-read-bounds.mjs'];
const sourceSha256={};for(const name of names)sourceSha256[name]=digest(await readFile(new URL('../'+name,import.meta.url)));
const report={qualified:true,scope:'path storage admission of copied stopped records only',reports,sourceSha256,
  nativeReaderEvidenceSha256:digest(nativeBytes),actualCheckpointNativeRestorationQualified:false,
  completeOrderRestorationQualified:false,allOrderReferencesQualified:false,activeOrderMigrationQualified:false,
  liveHeroCrossingQualified:false,liveNativePagingQualified:false,gameLaunched:false,browserUsed:false,nativeBuildRun:false,
  crashResolved:false,goalCompleted:false};
await writeFile(new URL('../output/native-order-read-bounds-snapshots-observed.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({qualified:true,attachments:reports.reduce((n,r)=>n+r.attachments,0),
  pathEntries:reports.reduce((n,r)=>n+r.pathEntries,0),totalPathStorageBytes:reports.reduce((n,r)=>n+r.totalPathStorageBytes,0),
  largestActorPathStorageBytes:Math.max(...reports.map(r=>r.largestActorPathStorageBytes)),gameLaunched:false}));
