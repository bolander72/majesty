#!/usr/bin/env node
// Read copied stopped saves serially; resolve this one qualified field only.
import {open,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';
import {checkpointAttachments,checkpointUnits,MAX_CHECKPOINT_BYTES} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderUnitTargets} from '../web/world/order-entries.mjs';

const paths=process.argv.slice(2),digest=data=>createHash('sha256').update(data).digest('hex');
if(!paths.length||paths.length>4)throw new Error('Pass one to four owned, stopped checkpoint copies');
const auditUrl=new URL('../output/native-follow-target-audit.json',import.meta.url);
const audit=JSON.parse(await readFile(auditUrl,'utf8'));
if(!audit.qualified||audit.serializedBodyWord!==25||audit.orderObjectOffset!==0x38)
  throw new Error('Missing pinned Follow Unit field audit');
for(const [name,sha]of Object.entries(audit.sourceSha256))
  if(digest(await readFile(new URL('../'+name,import.meta.url)))!==sha)throw new Error('Stale target audit');
const writersUrl=new URL('../output/native-order-writers-emulated-observed.json',import.meta.url);
const writerBytes=await readFile(writersUrl),writers=JSON.parse(writerBytes);
if(digest(writerBytes)!==audit.writerEvidenceSha256)throw new Error('Writer audit dependency changed');
for(const [name,sha]of Object.entries(writers.sourceSha256))
  if(digest(await readFile(new URL('../'+name,import.meta.url)))!==sha)throw new Error('Stale original writer source');
const prior=JSON.parse(await readFile(new URL('../output/native-order-entries-snapshots-observed.json',import.meta.url),'utf8'));
const reports=[];
for(const filename of paths){
  const handle=await open(filename,'r');
  try{
    const before=await handle.stat({bigint:true});
    if(!before.isFile()||before.size>BigInt(MAX_CHECKPOINT_BYTES))throw new Error('Invalid bounded checkpoint');
    const size=Number(before.size),io={requests:0,bytes:0,largestRead:0};
    const source={size,async readAt(at,n){
      if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||n>4096||at+n>size)
        throw new Error('Unbounded checkpoint read');
      if(++io.requests>16384||io.bytes+n>64*1024*1024)throw new Error('Target diagnostic I/O budget exceeded');
      const bytes=new Uint8Array(n),result=await handle.read(bytes,0,n,at);
      io.bytes+=result.bytesRead;io.largestRead=Math.max(io.largestRead,n);
      if(result.bytesRead!==n)throw new Error('Truncated checkpoint');
      return bytes;
    }};
    const hash=createHash('sha256');
    for(let at=0;at<size;at+=4096)hash.update(await source.readAt(at,Math.min(4096,size-at)));
    const sha256=hash.digest('hex'),previous=prior.reports.find(r=>r.filename===basename(filename));
    if(!previous||previous.sha256!==sha256)throw new Error('Requires the unchanged structural-checkpoint fixture');
    let attachments=0,targets=0,resolved=0,missing=0,zero=0;const samples=[];
    for await(const attachment of checkpointAttachments(source)){
      if(attachment.kind!=='ORDR')continue;
      if(++attachments>128)throw new Error('Diagnostic attachment budget exceeded');
      for await(const target of checkpointActorOrderUnitTargets(source,attachment.unitId)){
        if(++targets>128)throw new Error('Diagnostic target budget exceeded');
        let matches=0,family;
        if(target.targetUnitId===0)++zero;
        else{
          // Exhaust metadata each time; keep no regional ID catalogue.
          for await(const unit of checkpointUnits(source))if(unit.primary.words[1]===target.targetUnitId){
            ++matches;family=unit.family;
          }
          if(matches>1)throw new Error('Ambiguous target unit identity');
          if(matches===1)++resolved;else ++missing;
        }
        if(samples.length<8)samples.push({...target,matches,...(family?{family}:{})});
      }
    }
    const after=await handle.stat({bigint:true});
    for(const key of ['ino','size','mtimeNs','ctimeNs'])if(before[key]!==after[key])throw new Error('Checkpoint changed during inspection');
    reports.push({filename:basename(filename),sha256,fileBytes:size,attachments,targets,resolved,missing,zero,
      io,samples,fileIdentityUnchanged:true,previousFixtureHashMatched:true});
  }finally{await handle.close();}
}
const names=['web/world/checkpoint.mjs','web/world/order-entries.mjs','scripts/inspect-native-order-targets.mjs'];
const sourceSha256={};for(const name of names)sourceSha256[name]=digest(await readFile(new URL('../'+name,import.meta.url)));
const report={qualified:true,scope:'read-only kind 6 target inspection and saved UNIT membership',reports,sourceSha256,
  auditEvidenceSha256:digest(await readFile(auditUrl)),allOrderReferencesQualified:false,
  destinationRemappingQualified:false,activeOrderMigrationQualified:false,liveHeroCrossingQualified:false,
  liveNativePagingQualified:false,gameLaunched:false,browserUsed:false,nativeBuildRun:false,crashResolved:false,goalCompleted:false};
await writeFile(new URL('../output/native-order-targets-snapshots-observed.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({qualified:true,files:reports.length,attachments:reports.reduce((n,r)=>n+r.attachments,0),
  targets:reports.reduce((n,r)=>n+r.targets,0),resolved:reports.reduce((n,r)=>n+r.resolved,0),
  missing:reports.reduce((n,r)=>n+r.missing,0),zero:reports.reduce((n,r)=>n+r.zero,0),
  largestRead:Math.max(...reports.map(r=>r.io.largestRead)),gameLaunched:false}));
