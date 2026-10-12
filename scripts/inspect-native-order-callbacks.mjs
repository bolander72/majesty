#!/usr/bin/env node
// Narrow field inspection and identity plans against owned stopped save copies.
import {open,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';
import {checkpointAttachments,checkpointAgents,MAX_CHECKPOINT_BYTES} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderCallbacks,checkpointOrderCallbackAgentPlan} from '../web/world/order-callbacks.mjs';
const paths=process.argv.slice(2),digest=b=>createHash('sha256').update(b).digest('hex');
if(!paths.length||paths.length>4)throw Error('Pass one to four owned stopped checkpoint fixture copies');
const auditUrl=new URL('../output/native-order-callbacks-audit.json',import.meta.url);
const audit=JSON.parse(await readFile(auditUrl,'utf8'));
if(!audit.qualified||!audit.baseScriptAgentProvenanceQualified||audit.leafScriptAgentProvenanceQualified)
  throw Error('Missing pinned callback scope audit');
for(const [name,sha]of Object.entries(audit.sourceSha256))
  if(digest(await readFile(new URL('../'+name,import.meta.url)))!==sha)throw Error('Stale callback audit');
const writerBytes=await readFile(new URL('../output/native-order-writers-emulated-observed.json',import.meta.url));
if(digest(writerBytes)!==audit.writerEvidenceSha256)throw Error('Writer evidence changed');
const writers=JSON.parse(writerBytes);
for(const [name,sha]of Object.entries(writers.sourceSha256))
  if(digest(await readFile(new URL('../'+name,import.meta.url)))!==sha)throw Error('Stale writer source');
const prior=JSON.parse(await readFile(new URL('../output/native-order-entries-snapshots-observed.json',import.meta.url),'utf8'));
const reports=[];
for(const filename of paths){
  const handle=await open(filename,'r');
  try{
    const before=await handle.stat({bigint:true});
    if(!before.isFile()||before.size>BigInt(MAX_CHECKPOINT_BYTES))throw Error('Invalid bounded checkpoint');
    const size=Number(before.size),io={requests:0,bytes:0,largestRead:0};
    const source={size,async readAt(at,n){
      if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||n>4096||at+n>size)throw Error('Unbounded callback read');
      if(++io.requests>16384||io.bytes+n>64*1024*1024)throw Error('Callback diagnostic I/O budget exceeded');
      const bytes=new Uint8Array(n),result=await handle.read(bytes,0,n,at);
      io.bytes+=result.bytesRead;io.largestRead=Math.max(io.largestRead,n);
      if(result.bytesRead!==n)throw Error('Truncated callback source');return bytes;
    }};
    const hash=createHash('sha256');for(let at=0;at<size;at+=4096)hash.update(await source.readAt(at,Math.min(4096,size-at)));
    const sha256=hash.digest('hex'),previous=prior.reports.find(r=>r.filename===basename(filename));
    if(!previous||previous.sha256!==sha256)throw Error('Requires unchanged copied structural fixtures');
    let attachments=0,callbacks=0,baseCallbacks=0,leafCallbacks=0,nonzeroProcedures=0,
      nonzeroBaseScripts=0,nonzeroLeafScripts=0,resolved=0,missing=0,deleted=0,identityPlans=0,identitySites=0;
    const samples=[];
    for await(const attachment of checkpointAttachments(source)){
      if(attachment.kind!=='ORDR')continue;
      if(++attachments>128)throw Error('Callback diagnostic attachment budget exceeded');
      const bindings=new Map();let recordCallbacks=0;
      for await(const callback of checkpointActorOrderCallbacks(source,attachment.unitId)){
        if(++recordCallbacks>1024||++callbacks>1024)throw Error('Callback diagnostic field budget exceeded');
        if(callback.role==='base')++baseCallbacks;else ++leafCallbacks;
        if(callback.cProcId!==0)++nonzeroProcedures;
        if(callback.scriptId===0)continue;
        if(callback.role!=='base'){++nonzeroLeafScripts;continue;}
        if(++nonzeroBaseScripts>128)throw Error('Callback diagnostic script budget exceeded');
        let matches=0,isDeleted=false,associatedUnitId;
        // Complete the manager scan; preserve only per-actor referenced IDs.
        for await(const agent of checkpointAgents(source))if(agent.agentId===callback.scriptId){
          ++matches;isDeleted=agent.deleted;associatedUnitId=agent.unitId;
        }
        if(matches>1)throw Error('Ambiguous callback script identity');
        if(matches===0)++missing;
        else if(isDeleted)++deleted;
        else{++resolved;bindings.set(callback.scriptId,callback.scriptId);}
        if(samples.length<8)samples.push({unitId:callback.unitId,bank:callback.bank,index:callback.index,
          kind:callback.kind,role:callback.role,cProcId:callback.cProcId,scriptId:callback.scriptId,
          scriptIdOffset:callback.scriptIdOffset,matches,isDeleted,...(associatedUnitId===undefined?{}:{associatedUnitId})});
      }
      const plan=await checkpointOrderCallbackAgentPlan(source,attachment.unitId,id=>bindings.get(id));
      if(plan.completeOrderMigration!==false)throw Error('Partial callback plan claimed complete migration');
      if(plan.patches.some(p=>p.before!==p.after||p.role!=='base'))throw Error('Identity plan changed a field');
      ++identityPlans;identitySites+=plan.patches.length;
    }
    const after=await handle.stat({bigint:true});
    for(const key of ['ino','size','mtimeNs','ctimeNs'])if(before[key]!==after[key])throw Error('Checkpoint changed during inspection');
    reports.push({filename:basename(filename),sha256,fileBytes:size,attachments,callbacks,baseCallbacks,leafCallbacks,
      nonzeroProcedures,nonzeroBaseScripts,nonzeroLeafScripts,resolved,missing,deleted,identityPlans,identitySites,io,samples,
      previousFixtureHashMatched:true,fileIdentityUnchanged:true});
  }finally{await handle.close();}
}
const names=['web/world/checkpoint.mjs','web/world/order-entries.mjs','web/world/order-callbacks.mjs','scripts/inspect-native-order-callbacks.mjs'];
const sourceSha256={};for(const name of names)sourceSha256[name]=digest(await readFile(new URL('../'+name,import.meta.url)));
const report={qualified:true,scope:'callback layout, base GPL membership and source identity plans only',reports,sourceSha256,
  auditEvidenceSha256:digest(await readFile(auditUrl)),destinationBindingsQualified:false,leafScriptReferencesQualified:false,
  allOrderReferencesQualified:false,activeOrderMigrationQualified:false,orderReaderRestoreQualified:false,
  liveHeroCrossingQualified:false,liveNativePagingQualified:false,gameLaunched:false,browserUsed:false,nativeBuildRun:false,
  crashResolved:false,goalCompleted:false};
await writeFile(new URL('../output/native-order-callbacks-snapshots-observed.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
const sum=key=>reports.reduce((n,r)=>n+r[key],0);
console.log(JSON.stringify({qualified:true,attachments:sum('attachments'),callbacks:sum('callbacks'),
  nonzeroBaseScripts:sum('nonzeroBaseScripts'),resolved:sum('resolved'),missing:sum('missing'),deleted:sum('deleted'),
  identityPlans:sum('identityPlans'),identitySites:sum('identitySites'),gameLaunched:false}));
