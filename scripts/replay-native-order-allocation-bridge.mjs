#!/usr/bin/env node
// Compare scoped bridge decisions with bounded original-CPU allocation frames.
import {open,readFile,stat,writeFile} from 'node:fs/promises';
import {basename} from 'node:path';
import {createHash} from 'node:crypto';
import {reserveCheckpointActorOrderStorage} from '../web/world/order-reservations.mjs';
import {createUnpublishedOrderAllocationBridge} from '../web/world/order-allocation-bridge.mjs';
const paths=process.argv.slice(2),digest=b=>createHash('sha256').update(b).digest('hex');
if(!paths.length||paths.length>4)throw Error('Pass one to four unchanged owned copied checkpoints');
async function bounded(name){
  const url=new URL('../'+name,import.meta.url),s=await stat(url);
  if(!s.isFile()||s.size>1024*1024)throw Error('Oversized bridge evidence');return readFile(url);
}
async function evidence(name){
  const bytes=await bounded(name),value=JSON.parse(bytes);if(!value.qualified)throw Error('Unqualified bridge dependency');
  for(const [source,sha]of Object.entries(value.sourceSha256))if(digest(await bounded(source))!==sha)throw Error('Stale bridge dependency source');
  for(const [dep,sha]of Object.entries(value.dependencyEvidenceSha256??{}))if(digest(await bounded(dep))!==sha)throw Error('Stale bridge evidence dependency');
  return {value,sha256:digest(bytes)};
}
const native=await evidence('output/native-reserved-order-banks-emulated-observed.json'),n=native.value;
const audit=await evidence('output/native-order-allocation-sites-audit.json');
const capture=(await evidence('output/native-order-reservation-cases.json')).value;
if(n.completedCalls!==1644||n.outcomes.length!==214||n.mappedGuestBytesAfterCleanup!==0||audit.value.sites.length!==12)
  throw Error('Incomplete original native claim evidence');
const files=new Map(),reports=[],samples=[];let scenarios=0,frames=0,failedReadScenarios=0,zeroFailedReadRequests=0;
async function replay(source,unitId,caseInfo){
  let bump=0x100000;const live=new Map();
  const journal=await reserveCheckpointActorOrderStorage(source,unitId,{
    allocate(bytes){const address=bump;bump+=(bytes+7)&~7;live.set(address,bytes);return address;},
    free(address,bytes){if(live.get(address)!==bytes)throw Error('Duplicate or unknown bridge cleanup');live.delete(address);}});
  const bridge=createUnpublishedOrderAllocationBridge(journal);let consumed=0,failedRead=false;
  try{
    if(!Array.isArray(caseInfo.mallocClaims)||caseInfo.mallocClaims.length>32)throw Error('Missing bounded original allocation frames');
    for(const phase of caseInfo.phases){
      if(!['constructbank','readbank','writebank'].includes(phase.phase))throw Error('Unexpected original phase');
      if(phase.phase==='writebank')continue;
      const scope=phase.phase==='constructbank'?bridge.beginConstruction(phase.bank):bridge.beginRead(phase.bank);
      const claims=caseInfo.mallocClaims.filter(r=>r.phase===phase.phase&&r.bank===phase.bank);
      for(const frame of claims){
        const decision=bridge.intercept({token:scope.token,...frame});
        if(decision.action!=='return'||decision.argBytes!==0||decision.eax!==frame.address)
          throw Error('Bridge return differs from original reservation trace');
        if(decision.failedReadZeroRequest)++zeroFailedReadRequests;
        ++consumed;++frames;
      }
      if(phase.phase==='constructbank')bridge.endConstruction(phase.returnValue);
      else if(!bridge.endRead(phase.returnValue))failedRead=true;
    }
    if(consumed!==caseInfo.mallocClaims.length||failedRead!==caseInfo.injectedStreamFailure)
      throw Error('Original claim trace was incomplete or misclassified');
    if(failedRead){
      ++failedReadScenarios;let rejected=false;try{bridge.assertComplete();}catch{rejected=true;}
      if(!rejected)throw Error('Failed original read could complete bridge');
    }else bridge.assertComplete();
    if(samples.length<8)samples.push({filename:caseInfo.filename,unitId:caseInfo.unitId,stackPoison:caseInfo.stackPoison,
      allocationFrames:consumed,allocationRequestBytes:journal.plan.allocationRequestBytes,failedRead});
    ++scenarios;
  }finally{bridge.close();await journal.release();if(live.size)throw Error('Bridge journal retained modeled storage');}
}
try{
  for(const filename of paths){
    const name=basename(filename);if(files.has(name))throw Error('Duplicate bridge fixture');
    const previous=capture.reports.find(r=>r.filename===name);if(!previous)throw Error('Unknown bridge fixture');
    const handle=await open(filename,'r'),before=await handle.stat({bigint:true});
    const size=Number(before.size),io={requests:0,bytes:0,largestRead:0};
    const record={handle,before,name,previous,io};files.set(name,record);
    if(!before.isFile()||size!==previous.fileBytes)throw Error('Changed bridge fixture');
    record.source={size,async readAt(at,bytes){
      if(!Number.isSafeInteger(at)||!Number.isSafeInteger(bytes)||at<0||bytes<0||bytes>4096||at+bytes>size)
        throw Error('Unbounded bridge source read');
      if(++io.requests>32768||io.bytes+bytes>64*1024*1024)throw Error('Bridge I/O budget exceeded');
      const data=new Uint8Array(bytes),result=await handle.read(data,0,bytes,at);
      io.bytes+=result.bytesRead;io.largestRead=Math.max(io.largestRead,bytes);
      if(result.bytesRead!==bytes)throw Error('Truncated bridge source');return data;
    }};
    const hash=createHash('sha256');for(let at=0;at<size;at+=4096)hash.update(await record.source.readAt(at,Math.min(4096,size-at)));
    if(hash.digest('hex')!==previous.sha256)throw Error('Bridge fixture content changed');
  }
  const writers=(await evidence('output/native-order-writers-emulated-observed.json')).value;
  const w=values=>{const b=Buffer.alloc(values.length*4);values.forEach((n,i)=>b.writeUInt32LE(n>>>0,i*4));return b;},
    chunk=(tag,body=Buffer.alloc(0),version=0,count=0)=>Buffer.concat([Buffer.from(tag),w([body.length,version,count]),body]);
  const body=w([1,1,1,1,...writers.replays.find(r=>r.kind===1).words,1,0,1,0]);
  const synthetic=Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('ORDR',Buffer.concat([
    w([506]),chunk('ORDR',chunk('PRIM',body,2),0,1)]),1,1),chunk('CONT',undefined,1)]);
  const syntheticSource={size:synthetic.length,async readAt(at,n){if(n>4096)throw Error('Unbounded synthetic read');return synthetic.subarray(at,at+n);}};
  for(const result of n.outcomes){
    if(result.reservationFailureBeforeNativeCalls)continue;
    if(result.syntheticKindOne)await replay(syntheticSource,506,result);
    else{
      const file=files.get(result.filename);if(!file)throw Error('Missing required copied fixture');
      await replay(file.source,result.unitId,result);
    }
  }
  if(scenarios!==186||frames!==1280||failedReadScenarios!==6||zeroFailedReadRequests!==2)
    throw Error('Incomplete original claim replay coverage');
  for(const {handle,before,name,previous,io}of files.values()){
    const after=await handle.stat({bigint:true});for(const key of ['ino','size','mtimeNs','ctimeNs'])
      if(before[key]!==after[key])throw Error('Bridge fixture changed during replay');
    reports.push({filename:name,sha256:previous.sha256,fileBytes:previous.fileBytes,io,fileIdentityUnchanged:true});
  }
}finally{for(const {handle}of files.values())await handle.close();}
const sourceSha256={};for(const name of ['web/world/order-allocation-bridge.mjs','web/world/order-reservations.mjs',
  'web/world/order-restore-bounds.mjs','web/world/order-entries.mjs','web/world/order-read-bounds.mjs','web/world/checkpoint.mjs',
  'scripts/replay-native-order-allocation-bridge.mjs'])sourceSha256[name]=digest(await bounded(name));
const report={qualified:true,scope:'scoped JavaScript cdecl claim decisions compared with original-CPU reservation frames',
  scenarios,allocationFrames:frames,failedReadScenarios,zeroFailedReadRequests,reports,samples,sourceSha256,
  nativeClaimEvidenceSha256:native.sha256,siteAuditEvidenceSha256:audit.sha256,
  nativeHookRegistered:false,nativeHookReturnExecuted:false,nativeRuntimeAdapterInstalled:false,
  completeActorRollbackQualified:false,activeOrderMigrationQualified:false,liveHeroCrossingQualified:false,
  gameLaunched:false,browserUsed:false,nativeBuildRun:false,crashResolved:false,goalCompleted:false};
await writeFile(new URL('../output/native-order-allocation-bridge-replay-observed.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({qualified:true,scenarios,allocationFrames:frames,failedReadScenarios,zeroFailedReadRequests,nativeHookRegistered:false}));
