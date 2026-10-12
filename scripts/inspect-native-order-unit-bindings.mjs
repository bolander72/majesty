#!/usr/bin/env node
// Membership and partial source identity plans; no native writes or activation.
import {open,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';
import {checkpointAttachments,checkpointUnits,MAX_CHECKPOINT_BYTES} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderUnitReferences,checkpointOrderUnitReferencePlan} from '../web/world/order-unit-bindings.mjs';
const paths=process.argv.slice(2),digest=b=>createHash('sha256').update(b).digest('hex');
if(!paths.length||paths.length>4)throw Error('Pass one to four owned stopped copied checkpoint fixtures');
const auditUrl=new URL('../output/native-order-unit-targets-audit.json',import.meta.url),auditBytes=await readFile(auditUrl),audit=JSON.parse(auditBytes);
if(!audit.qualified||audit.originalWriterFieldChecks!==10)throw Error('Missing pinned UNIT field audit');
for(const [name,sha]of Object.entries(audit.sourceSha256))
  if(digest(await readFile(new URL('../'+name,import.meta.url)))!==sha)throw Error('Stale UNIT field audit');
const writerBytes=await readFile(new URL('../output/native-order-writers-emulated-observed.json',import.meta.url));
if(digest(writerBytes)!==audit.writerEvidenceSha256)throw Error('Writer evidence changed');
for(const [name,sha]of Object.entries(JSON.parse(writerBytes).sourceSha256))
  if(digest(await readFile(new URL('../'+name,import.meta.url)))!==sha)throw Error('Stale writer source');
const prior=JSON.parse(await readFile(new URL('../output/native-order-entries-snapshots-observed.json',import.meta.url),'utf8'));
const reports=[];
for(const filename of paths){
  const handle=await open(filename,'r');
  try{
    const before=await handle.stat({bigint:true});
    if(!before.isFile()||before.size>BigInt(MAX_CHECKPOINT_BYTES))throw Error('Invalid bounded copied checkpoint');
    const size=Number(before.size),io={requests:0,bytes:0,largestRead:0};
    const source={size,async readAt(at,n){
      if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||n>4096||at+n>size)throw Error('Unbounded UNIT binding read');
      if(++io.requests>16384||io.bytes+n>64*1024*1024)throw Error('UNIT binding diagnostic I/O budget exceeded');
      const bytes=new Uint8Array(n),result=await handle.read(bytes,0,n,at);
      io.bytes+=result.bytesRead;io.largestRead=Math.max(io.largestRead,n);
      if(result.bytesRead!==n)throw Error('Truncated UNIT binding source');return bytes;
    }};
    const hash=createHash('sha256');for(let at=0;at<size;at+=4096)hash.update(await source.readAt(at,Math.min(4096,size-at)));
    const sha256=hash.digest('hex'),previous=prior.reports.find(r=>r.filename===basename(filename));
    if(!previous||previous.sha256!==sha256)throw Error('Requires unchanged structural checkpoint fixture');
    let attachments=0,targets=0,zero=0,resolved=0,missing=0,identityPlans=0,identitySites=0,unresolvedPlans=0;
    const kinds={},samples=[],missingSamples=[];
    for await(const attachment of checkpointAttachments(source)){
      if(attachment.kind!=='ORDR')continue;
      if(++attachments>128)throw Error('UNIT binding attachment budget exceeded');
      const bindings=new Map();
      for await(const target of checkpointActorOrderUnitReferences(source,attachment.unitId)){
        if(++targets>128)throw Error('UNIT binding target budget exceeded');
        kinds[target.kind]=(kinds[target.kind]??0)+1;
        let matches=0,family;
        if(target.targetUnitId===0)++zero;
        else{
          for await(const unit of checkpointUnits(source))if(unit.primary.words[1]===target.targetUnitId){++matches;family=unit.family;}
          if(matches>1)throw Error('Ambiguous saved UNIT identity');
          if(matches===1){++resolved;bindings.set(target.targetUnitId,target.targetUnitId);}
          else{++missing;if(missingSamples.length<8)missingSamples.push(target);}
        }
        if(samples.length<8)samples.push({...target,matches,...(family?{family}:{})});
      }
      try{
        const plan=await checkpointOrderUnitReferencePlan(source,attachment.unitId,id=>bindings.get(id));
        if(plan.completeOrderMigration!==false||plan.patches.some(p=>p.before!==p.after))throw Error('Identity plan claimed full migration or changed values');
        ++identityPlans;identitySites+=plan.patches.length;
      }catch(error){
        if(error.message!=='Unresolved order unit reference')throw error;
        ++unresolvedPlans;
      }
    }
    const after=await handle.stat({bigint:true});
    for(const key of ['ino','size','mtimeNs','ctimeNs'])if(before[key]!==after[key])throw Error('Checkpoint changed during UNIT inspection');
    reports.push({filename:basename(filename),sha256,fileBytes:size,attachments,targets,kinds,zero,resolved,missing,
      identityPlans,identitySites,unresolvedPlans,io,samples,missingSamples,fileIdentityUnchanged:true,previousFixtureHashMatched:true});
  }finally{await handle.close();}
}
const names=['web/world/checkpoint.mjs','web/world/order-entries.mjs','web/world/order-unit-bindings.mjs','scripts/inspect-native-order-unit-bindings.mjs'];
const sourceSha256={};for(const name of names)sourceSha256[name]=digest(await readFile(new URL('../'+name,import.meta.url)));
const report={qualified:true,scope:'four target fields, saved UNIT membership and partial source identity plans only',reports,sourceSha256,
  auditEvidenceSha256:digest(auditBytes),destinationBindingsQualified:false,completeReferenceClosureQualified:false,
  activeOrderMigrationQualified:false,liveHeroCrossingQualified:false,liveNativePagingQualified:false,
  gameLaunched:false,browserUsed:false,nativeBuildRun:false,crashResolved:false,goalCompleted:false};
await writeFile(new URL('../output/native-order-unit-bindings-snapshots-observed.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
const sum=key=>reports.reduce((n,r)=>n+r[key],0);
console.log(JSON.stringify({qualified:true,attachments:sum('attachments'),targets:sum('targets'),zero:sum('zero'),resolved:sum('resolved'),
  missing:sum('missing'),identityPlans:sum('identityPlans'),identitySites:sum('identitySites'),unresolvedPlans:sum('unresolvedPlans'),gameLaunched:false}));
