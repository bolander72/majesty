#!/usr/bin/env node
// Literal bank capture from immutable owned copies; no player save edits.
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
      if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||n>4096||at+n>size)throw Error('Unbounded bank capture read');
      if(++io.requests>16384||io.bytes+n>64*1024*1024)throw Error('Bank capture diagnostic I/O budget exceeded');
      const bytes=new Uint8Array(n),result=await handle.read(bytes,0,n,at);
      io.bytes+=result.bytesRead;io.largestRead=Math.max(io.largestRead,n);
      if(result.bytesRead!==n)throw Error('Truncated bank capture');return bytes;
    }};
    const hash=createHash('sha256');for(let at=0;at<size;at+=4096)hash.update(await source.readAt(at,Math.min(4096,size-at)));
    const snapshotSha256=hash.digest('hex'),previous=prior.reports.find(r=>r.filename===basename(filename));
    if(!previous||previous.sha256!==snapshotSha256)throw Error('Requires unchanged copied structural fixtures');
    let attachments=0,entries=0;
    for await(const attachment of checkpointAttachments(source)){
      if(attachment.kind!=='ORDR')continue;
      if(++attachments>128||cases.length>=128)throw Error('Bank capture case budget exceeded');
      const admission=await checkpointActorOrderReadBounds(source,attachment.unitId);
      if(admission.paths.some(p=>p.capacity>10))throw Error('Bank path capacity exceeds tiny fixture');
      const banks=[];let current,entryCount=0;
      for await(const row of checkpointActorOrderEntries(source,attachment.unitId)){
        if(row.type==='bank'){
          if(row.count>4)throw Error('Bank capture entry budget exceeded');
          current={bank:row.bank,sourceOffset:row.offset,count:row.count,words:[row.version,row.count]};banks.push(current);
        }else if(row.type==='entry'){
          if(!current||current.bank!==row.bank||row.prefixOffset!==current.sourceOffset+current.words.length*4)
            throw Error('Unassociated bank entry');
          if(++entryCount>8)throw Error('Actor bank capture entry budget exceeded');
          current.words.push(1,row.kind,...row.words);
        }else{
          if(!current||current.bank!==row.bank||row.offset!==current.sourceOffset+current.words.length*4)
            throw Error('Unassociated bank point');
          current.words.push(row.firstWord,row.secondWord);
        }
      }
      if(banks.length!==3)throw Error('Missing native bank');
      for(const bank of banks){
        bank.payloadBytes=bank.words.length*4;
        if(bank.payloadBytes>2048)throw Error('Bank payload exceeds tiny fixture');
        const literal=await source.readAt(bank.sourceOffset,bank.payloadBytes),view=new DataView(literal.buffer,literal.byteOffset,literal.byteLength);
        for(let i=0;i<bank.words.length;i++)if(view.getUint32(i*4,true)!==bank.words[i])throw Error('Literal bank differs from parse');
        bank.payloadSha256=digest(literal);
      }
      entries+=entryCount;
      cases.push({filename:basename(filename),snapshotSha256,unitId:attachment.unitId,entryCount,banks,normalizations:[]});
    }
    const after=await handle.stat({bigint:true});
    for(const key of ['ino','size','mtimeNs','ctimeNs'])if(before[key]!==after[key])throw Error('Checkpoint changed during bank capture');
    reports.push({filename:basename(filename),sha256:snapshotSha256,fileBytes:size,attachments,entries,io,
      previousFixtureHashMatched:true,fileIdentityUnchanged:true});
  }finally{await handle.close();}
}
const names=['web/world/checkpoint.mjs','web/world/order-entries.mjs','web/world/order-read-bounds.mjs','scripts/prepare-native-order-bank-cases.mjs'];
const sourceSha256={};for(const name of names)sourceSha256[name]=digest(await readFile(new URL('../'+name,import.meta.url)));
const report={qualified:true,scope:'literal copied bank payloads only',reports,cases,sourceSha256,literalPayloadsMatched:true,
  completeNativeCheckpointRestorationQualified:false,activeOrderMigrationQualified:false,gameLaunched:false,browserUsed:false,nativeBuildRun:false,crashResolved:false};
const json=JSON.stringify(report,null,2)+'\n';if(Buffer.byteLength(json)>1024*1024)throw Error('Bank capture exceeds one MiB');
await writeFile(new URL('../output/native-order-bank-cases.json',import.meta.url),json);
console.log(JSON.stringify({qualified:true,actors:cases.length,banks:cases.length*3,entries:reports.reduce((n,r)=>n+r.entries,0),fixtureBytes:Buffer.byteLength(json),gameLaunched:false}));
