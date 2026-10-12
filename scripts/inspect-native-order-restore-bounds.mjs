#!/usr/bin/env node
// Read-only request accounting; never invokes constructors or publishes banks.
import {open,readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';
import {checkpointAttachments,MAX_CHECKPOINT_BYTES} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderRestoreBounds,NATIVE_ORDER_OBJECT_REQUEST_BYTES} from '../web/world/order-restore-bounds.mjs';
const paths=process.argv.slice(2),digest=b=>createHash('sha256').update(b).digest('hex');
if(!paths.length||paths.length>4)throw Error('Pass one to four unchanged owned stopped checkpoint fixtures');
async function boundedEvidence(name){
  const url=new URL('../'+name,import.meta.url),identity=await stat(url);
  if(!identity.isFile()||identity.size>1024*1024)throw Error('Oversized diagnostic dependency');
  return readFile(url);
}
const nativeBytes=await boundedEvidence('output/native-order-bank-rollback-emulated-observed.json'),native=JSON.parse(nativeBytes);
if(!native.qualified||native.completedCalls!==2524||native.copiedActorsPerFill!==89||
   !native.unpublishedInitialBankCleanupQualified||native.mappedGuestBytesAfterCleanup!==0)
  throw Error('Missing bounded original bank qualification');
for(const [name,sha]of Object.entries(native.sourceSha256))
  if(digest(await boundedEvidence(name))!==sha)throw Error('Stale native bank source');
for(const [name,sha]of Object.entries(native.dependencyEvidenceSha256))
  if(digest(await boundedEvidence(name))!==sha)throw Error('Stale native bank evidence');
const lifecycle=JSON.parse(await boundedEvidence('output/native-order-lifecycle-emulated-observed.json'));
if(!lifecycle.qualified||JSON.stringify(lifecycle.objectSizes)!==JSON.stringify(NATIVE_ORDER_OBJECT_REQUEST_BYTES))
  throw Error('Original factory allocation profile changed');
const prior=JSON.parse(await boundedEvidence('output/native-order-entries-snapshots-observed.json'));
const reports=[],seenFiles=new Set();
for(const filename of paths){
  const name=basename(filename);
  if(seenFiles.has(name))throw Error('Duplicate checkpoint fixture');seenFiles.add(name);
  const handle=await open(filename,'r');
  try{
    const before=await handle.stat({bigint:true});
    if(!before.isFile()||before.size>BigInt(MAX_CHECKPOINT_BYTES))throw Error('Invalid bounded checkpoint');
    const size=Number(before.size),io={requests:0,bytes:0,largestRead:0};
    const source={size,async readAt(at,n){
      if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||n>4096||at+n>size)throw Error('Unbounded request-admission read');
      if(++io.requests>16384||io.bytes+n>64*1024*1024)throw Error('Request-admission diagnostic I/O budget exceeded');
      const bytes=new Uint8Array(n),result=await handle.read(bytes,0,n,at);
      io.bytes+=result.bytesRead;io.largestRead=Math.max(io.largestRead,n);
      if(result.bytesRead!==n)throw Error('Truncated request-admission source');return bytes;
    }};
    const hash=createHash('sha256');for(let at=0;at<size;at+=4096)hash.update(await source.readAt(at,Math.min(4096,size-at)));
    const sha256=hash.digest('hex'),previous=prior.reports.find(r=>r.filename===name);
    if(!previous||previous.sha256!==sha256)throw Error('Requires unchanged copied structural fixtures');
    let attachments=0,banks=0,entries=0,nativeComparisons=0,totalAllocationRequestBytes=0,largestActorAllocationRequestBytes=0;
    const parts={bankObjectBytes:0,sentinelBytes:0,orderObjectBytes:0,nodeBytes:0,pathBytes:0},kinds={},samples=[],unitIds=new Set();
    for await(const attachment of checkpointAttachments(source)){
      if(attachment.kind!=='ORDR')continue;
      if(++attachments>128||unitIds.has(attachment.unitId))throw Error('Attachment count or identity budget exceeded');
      unitIds.add(attachment.unitId);
      const plan=await checkpointActorOrderRestoreBounds(source,attachment.unitId);
      if(plan.completeNativeMemoryBound!==false||plan.completeOrderMigration!==false)throw Error('Admission claimed complete migration or heap bound');
      const outcomes=native.outcomes.filter(r=>r.filename===name&&r.unitId===attachment.unitId&&
        !r.syntheticKindOne&&!r.injectedStreamFailure&&!r.bankDestructorOnlyControl);
      if(outcomes.length!==2||new Set(outcomes.map(r=>r.stackPoison)).size!==2)throw Error('Missing two original bank comparisons');
      const roles={bank:plan.banks,head:plan.banks,order:plan.entries.length,node:plan.entries.length,
        path:plan.entries.filter(r=>r.kind===4||r.kind===7).length};
      for(const outcome of outcomes){
        if(!outcome.bankRoundTripIdentical||outcome.sourceEntryCount!==plan.entries.length||
           outcome.loadedEntries!==plan.entries.length||outcome.modeledAllocationBytesPeak!==plan.allocationRequestBytes||
           outcome.liveAllocationBytesAfter!==0||Object.entries(roles).some(([key,value])=>outcome.allocationRoles[key]!==value))
          throw Error('Request plan differs from original-bank modeled allocation trace');
        ++nativeComparisons;
      }
      banks+=plan.banks;entries+=plan.entries.length;totalAllocationRequestBytes+=plan.allocationRequestBytes;
      largestActorAllocationRequestBytes=Math.max(largestActorAllocationRequestBytes,plan.allocationRequestBytes);
      for(const [key,value]of Object.entries(plan.parts))parts[key]+=value;
      for(const entry of plan.entries)kinds[entry.kind]=(kinds[entry.kind]??0)+1;
      if(samples.length<8)samples.push({unitId:attachment.unitId,banks:plan.banks,entries:plan.entries.length,
        allocationRequestBytes:plan.allocationRequestBytes,parts:plan.parts});
    }
    const after=await handle.stat({bigint:true});
    for(const key of ['ino','size','mtimeNs','ctimeNs'])if(before[key]!==after[key])throw Error('Checkpoint changed during inspection');
    reports.push({filename:name,sha256,fileBytes:size,attachments,banks,entries,nativeComparisons,kinds,
      totalAllocationRequestBytes,largestActorAllocationRequestBytes,parts,io,samples,
      previousFixtureHashMatched:true,fileIdentityUnchanged:true});
  }finally{await handle.close();}
}
const sourceSha256={};
for(const name of ['web/world/checkpoint.mjs','web/world/order-entries.mjs','web/world/order-read-bounds.mjs',
  'web/world/order-restore-bounds.mjs','scripts/inspect-native-order-restore-bounds.mjs'])
  sourceSha256[name]=digest(await boundedEvidence(name));
const report={qualified:true,scope:'initial empty-name order-bank allocation requests of copied stopped records only',
  reports,sourceSha256,nativeBankEvidenceSha256:digest(nativeBytes),
  completeNativeMemoryBound:false,completeOrderRestorationQualified:false,activeOrderMigrationQualified:false,
  liveHeroCrossingQualified:false,liveNativePagingQualified:false,gameLaunched:false,browserUsed:false,
  nativeBuildRun:false,crashResolved:false,goalCompleted:false};
await writeFile(new URL('../output/native-order-restore-bounds-snapshots-observed.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({qualified:true,attachments:reports.reduce((n,r)=>n+r.attachments,0),
  banks:reports.reduce((n,r)=>n+r.banks,0),entries:reports.reduce((n,r)=>n+r.entries,0),
  nativeComparisons:reports.reduce((n,r)=>n+r.nativeComparisons,0),
  totalAllocationRequestBytes:reports.reduce((n,r)=>n+r.totalAllocationRequestBytes,0),
  largestActorAllocationRequestBytes:Math.max(...reports.map(r=>r.largestActorAllocationRequestBytes)),
  ioBytes:reports.reduce((n,r)=>n+r.io.bytes,0),gameLaunched:false}));
