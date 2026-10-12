#!/usr/bin/env node
// Capture small literal entry payloads from owned stopped copies for CPU trials.
import {open,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';
import {checkpointAttachments,MAX_CHECKPOINT_BYTES} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointActorOrderReadBounds} from '../web/world/order-read-bounds.mjs';

const paths=process.argv.slice(2),digest=b=>createHash('sha256').update(b).digest('hex');
if(!paths.length||paths.length>4)throw Error('Pass one to four owned stopped copied checkpoint fixtures');
const prior=JSON.parse(await readFile(new URL('../output/native-order-entries-snapshots-observed.json',import.meta.url),'utf8'));
const cases=[],reports=[];
for(const filename of paths){
  const handle=await open(filename,'r');
  try{
    const before=await handle.stat({bigint:true});
    if(!before.isFile()||before.size>BigInt(MAX_CHECKPOINT_BYTES))throw Error('Invalid bounded checkpoint');
    const size=Number(before.size),io={requests:0,bytes:0,largestRead:0};
    const source={size,async readAt(at,n){
      if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||n>4096||at+n>size)throw Error('Unbounded native entry capture');
      if(++io.requests>16384||io.bytes+n>64*1024*1024)throw Error('Entry capture diagnostic I/O budget exceeded');
      const bytes=new Uint8Array(n),result=await handle.read(bytes,0,n,at);
      io.bytes+=result.bytesRead;io.largestRead=Math.max(io.largestRead,n);
      if(result.bytesRead!==n)throw Error('Truncated native entry capture');return bytes;
    }};
    const hash=createHash('sha256');for(let at=0;at<size;at+=4096)hash.update(await source.readAt(at,Math.min(4096,size-at)));
    const snapshotSha256=hash.digest('hex'),previous=prior.reports.find(r=>r.filename===basename(filename));
    if(!previous||previous.sha256!==snapshotSha256)throw Error('Requires unchanged copied structural fixtures');
    let attachments=0,entries=0;
    for await(const attachment of checkpointAttachments(source)){
      if(attachment.kind!=='ORDR')continue;
      if(++attachments>128)throw Error('Capture attachment budget exceeded');
      const plan=await checkpointActorOrderReadBounds(source,attachment.unitId);
      if(plan.paths.some(p=>p.capacity>10))throw Error('Path storage exceeds tiny CPU fixture capacity');
      let selected,values;
      const capture=async()=>{
        if(!selected)return;
        const bytes=selected.serializedSize??selected.size;
        if(bytes>512||values.length*4!==bytes)throw Error('Native entry capture payload budget exceeded');
        if(cases.length>=256)throw Error('Native entry capture case budget exceeded');
        const literal=await source.readAt(selected.offset,bytes),view=new DataView(literal.buffer,literal.byteOffset,literal.byteLength);
        // Compare the parser's immutable numeric copies to the exact file range.
        for(let i=0;i<values.length;i++)if(view.getUint32(i*4,true)!==values[i])throw Error('Literal payload differs from structural parse');
        ++entries;
        cases.push({kind:selected.kind,count:selected.waypointCount??0,poison:0x5a,words:values,
          normalizations:[],filename:basename(filename),snapshotSha256,unitId:selected.unitId,bank:selected.bank,index:selected.index,
          sourceOffset:selected.offset,payloadBytes:bytes,payloadSha256:digest(literal)});
      };
      for await(const value of checkpointActorOrderEntries(source,attachment.unitId)){
        if(value.type==='waypoint'){
          if(!selected||value.bank!==selected.bank||value.index!==selected.index)throw Error('Detached native path capture');
          values.push(value.firstWord,value.secondWord);continue;
        }
        await capture();selected=undefined;values=undefined;
        if(value.type==='entry'){selected=value;values=[...value.words];}
      }
      await capture();
    }
    const after=await handle.stat({bigint:true});
    for(const key of ['ino','size','mtimeNs','ctimeNs'])if(before[key]!==after[key])throw Error('Checkpoint changed during capture');
    reports.push({filename:basename(filename),sha256:snapshotSha256,fileBytes:size,attachments,entries,io,
      previousFixtureHashMatched:true,fileIdentityUnchanged:true});
  }finally{await handle.close();}
}
const names=['web/world/checkpoint.mjs','web/world/order-entries.mjs','web/world/order-read-bounds.mjs','scripts/prepare-native-order-reader-cases.mjs'];
const sourceSha256={};for(const name of names)sourceSha256[name]=digest(await readFile(new URL('../'+name,import.meta.url)));
const report={qualified:true,scope:'literal current entry payload capture from unchanged stopped save copies',reports,cases,sourceSha256,
  literalPayloadsMatched:true,wholeNativeCheckpointRestorationQualified:false,completeOrderRestorationQualified:false,
  activeOrderMigrationQualified:false,gameLaunched:false,browserUsed:false,nativeBuildRun:false,crashResolved:false};
const json=JSON.stringify(report,null,2)+'\n';
if(Buffer.byteLength(json)>1024*1024)throw Error('Native entry capture artifact exceeds one MiB');
await writeFile(new URL('../output/native-order-reader-cases.json',import.meta.url),json);
console.log(JSON.stringify({qualified:true,files:reports.length,attachments:reports.reduce((n,r)=>n+r.attachments,0),
  entries:cases.length,largestPayloadBytes:Math.max(...cases.map(c=>c.payloadBytes)),fixtureBytes:Buffer.byteLength(json),gameLaunched:false}));
