#!/usr/bin/env node
// Serial bounded observations of unchanged owned checkpoint copies.
import {open,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';
import {checkpointAttachments,MAX_CHECKPOINT_BYTES} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderNavigation} from '../web/world/order-navigation.mjs';
const paths=process.argv.slice(2),digest=b=>createHash('sha256').update(b).digest('hex');
if(!paths.length||paths.length>4)throw Error('Pass one to four unchanged owned stopped checkpoint fixtures');
const nativeBytes=await readFile(new URL('../output/native-order-navigation-emulated-observed.json',import.meta.url));
const native=JSON.parse(nativeBytes);
if(!native.qualified||native.completedCalls!==20||native.mappedGuestBytesAfterCleanup!==0)
  throw Error('Missing bounded original coordinate conversion evidence');
for(const [name,sha]of Object.entries(native.sourceSha256))
  if(digest(await readFile(new URL('../'+name,import.meta.url)))!==sha)throw Error('Stale native navigation evidence');
if(digest(await readFile(new URL('../output/native-order-writers-emulated-observed.json',import.meta.url)))!==native.writerEvidenceSha256)
  throw Error('Changed original writer evidence');
const prior=JSON.parse(await readFile(new URL('../output/native-order-entries-snapshots-observed.json',import.meta.url),'utf8'));
const reports=[];
for(const filename of paths){
  const handle=await open(filename,'r');
  try{
    const before=await handle.stat({bigint:true});
    if(!before.isFile()||before.size>BigInt(MAX_CHECKPOINT_BYTES))throw Error('Invalid bounded checkpoint');
    const size=Number(before.size),io={requests:0,bytes:0,largestRead:0};
    const source={size,async readAt(at,n){
      if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||n>4096||at+n>size)throw Error('Unbounded navigation read');
      if(++io.requests>16384||io.bytes+n>64*1024*1024)throw Error('Navigation diagnostic I/O budget exceeded');
      const bytes=new Uint8Array(n),result=await handle.read(bytes,0,n,at);
      io.bytes+=result.bytesRead;io.largestRead=Math.max(io.largestRead,n);
      if(result.bytesRead!==n)throw Error('Truncated navigation source');return bytes;
    }};
    const hash=createHash('sha256');for(let at=0;at<size;at+=4096)hash.update(await source.readAt(at,Math.min(4096,size-at)));
    const sha256=hash.digest('hex'),previous=prior.reports.find(r=>r.filename===basename(filename));
    if(!previous||previous.sha256!==sha256)throw Error('Requires unchanged copied structural fixtures');
    let attachments=0,pathHeaders=0,coordinatePairs=0,exhaustedPaths=0;const kinds={},spaces={},samples=[];
    for await(const attachment of checkpointAttachments(source)){
      if(attachment.kind!=='ORDR')continue;
      if(++attachments>128)throw Error('Navigation diagnostic attachment budget exceeded');
      for await(const row of checkpointActorOrderNavigation(source,attachment.unitId)){
        if(row.type==='navigation'){
          if(row.completeOrderMigration!==false)throw Error('Source inspection claimed complete migration');
          ++pathHeaders;kinds[row.kind]=(kinds[row.kind]??0)+1;
          if(row.cursor===row.count)++exhaustedPaths;
          if(samples.length<8)samples.push(row);
        }else{
          ++coordinatePairs;spaces[row.space]=(spaces[row.space]??0)+1;
          if(attachment.primary.end<row.offset+8)throw Error('Coordinate escaped source attachment');
        }
      }
    }
    const after=await handle.stat({bigint:true});
    for(const key of ['ino','size','mtimeNs','ctimeNs'])if(before[key]!==after[key])throw Error('Checkpoint changed during inspection');
    reports.push({filename:basename(filename),sha256,fileBytes:size,attachments,pathHeaders,coordinatePairs,
      exhaustedPaths,kinds,spaces,io,samples,previousFixtureHashMatched:true,fileIdentityUnchanged:true});
  }finally{await handle.close();}
}
const names=['web/world/checkpoint.mjs','web/world/order-entries.mjs','web/world/order-navigation.mjs','scripts/inspect-native-order-navigation.mjs'];
const sourceSha256={};for(const name of names)sourceSha256[name]=digest(await readFile(new URL('../'+name,import.meta.url)));
const report={qualified:true,scope:'source coordinate-space and canonical cursor inspection only',reports,sourceSha256,
  nativeEvidenceSha256:digest(nativeBytes),destinationWalkabilityQualified:false,completeCoordinateClosureQualified:false,
  activeOrderMigrationQualified:false,liveHeroCrossingQualified:false,liveNativePagingQualified:false,
  gameLaunched:false,browserUsed:false,nativeBuildRun:false,crashResolved:false,goalCompleted:false};
await writeFile(new URL('../output/native-order-navigation-snapshots-observed.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({qualified:true,attachments:reports.reduce((n,r)=>n+r.attachments,0),
  pathHeaders:reports.reduce((n,r)=>n+r.pathHeaders,0),coordinatePairs:reports.reduce((n,r)=>n+r.coordinatePairs,0),
  exhaustedPaths:reports.reduce((n,r)=>n+r.exhaustedPaths,0),gameLaunched:false}));
