#!/usr/bin/env node
// Read-only comparison against owned, stopped native snapshots; no game launch.
import {open,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';
import {checkpointAttachments,MAX_CHECKPOINT_BYTES} from '../web/world/checkpoint.mjs';
import {checkpointEmptyActorOrders} from '../web/world/orders.mjs';

const filenames=process.argv.slice(2);
if(!filenames.length||filenames.length>4)throw new Error('Usage: node scripts/inspect-native-empty-orders.mjs <owned stopped GMP> [up to four total]');
const reports=[];
for(const filename of filenames){
  const handle=await open(filename,'r');
  try{
    const before=await handle.stat({bigint:true});
    if(!before.isFile()||before.size>BigInt(MAX_CHECKPOINT_BYTES))throw new Error('Invalid bounded native snapshot');
    const size=Number(before.size),io={requests:0,bytes:0,largestRead:0};
    const source={size,async readAt(at,n){
      if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||n>4096||at+n>size)
        throw new Error('Unbounded native snapshot read');
      const bytes=new Uint8Array(n),result=await handle.read(bytes,0,n,at);
      ++io.requests;io.bytes+=result.bytesRead;io.largestRead=Math.max(io.largestRead,n);
      return bytes.subarray(0,result.bytesRead);
    }};
    const hash=createHash('sha256');
    for(let at=0;at<size;at+=4096)hash.update(await source.readAt(at,Math.min(4096,size-at)));
    let orders=0,canonicalEmpty=0,otherShapeOrState=0,selected=null;
    for await(const attachment of checkpointAttachments(source)){
      if(attachment.kind!=='ORDR')continue;
      ++orders;
      if(attachment.components.length!==1||attachment.primary.size!==24){++otherShapeOrState;continue;}
      const bytes=await source.readAt(attachment.primary.offset+16,24);
      if(bytes.length!==24)throw new Error('Truncated snapshot order banks');
      const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
      const values=Array.from({length:6},(_,i)=>view.getUint32(i*4,true));
      if(values.some((value,i)=>value!==(i%2?0:1))){++otherShapeOrState;continue;}
      ++canonicalEmpty;selected??=attachment.unitId;
    }
    const checked=selected===null?null:await checkpointEmptyActorOrders(source,selected);
    const after=await handle.stat({bigint:true});
    for(const key of ['ino','size','mtimeNs','ctimeNs'])if(before[key]!==after[key])throw new Error('Snapshot changed during inspection');
    reports.push({filename:basename(filename),sha256:hash.digest('hex'),fileBytes:size,io,orders,
      canonicalEmpty,otherShapeOrState,selectedEmptyUnitId:selected,
      selectedEmptyRecordBytes:checked?.attachment.size??null,selectedBankWords:checked?checked.banks.flatMap(bank=>[bank.version,bank.count]):null,
      fileIdentityUnchanged:true});
  }finally{await handle.close();}
}
const sourceNames=['web/world/orders.mjs','scripts/inspect-native-empty-orders.mjs'];
const sourceSha256=Object.fromEntries(await Promise.all(sourceNames.map(async name=>
  [name,createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex')])));
const report={qualified:reports.some(report=>report.canonicalEmpty>0),scope:'read-only canonical empty order representation in stopped native snapshots',reports,sourceSha256,
  heroClassificationQualified:false,nativeOrderRestoreQualified:false,liveHeroCrossingQualified:false,
  gameLaunched:false,browserUsed:false,nativeBuildRun:false,crashResolved:false,goalCompleted:false};
await writeFile(new URL('../output/native-empty-orders-snapshots-observed.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({qualified:report.qualified,files:reports.length,orders:reports.reduce((sum,r)=>sum+r.orders,0),
  canonicalEmpty:reports.reduce((sum,r)=>sum+r.canonicalEmpty,0),largestRead:Math.max(...reports.map(r=>r.io.largestRead)),gameLaunched:false}));
