#!/usr/bin/env node
// Copy four matching UNIT/command records with fresh production reservations.
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {checkpointUnits} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderStorageRequests} from '../web/world/order-reservations.mjs';
import {checkpointOrderDispatchClockPlan} from '../web/world/order-dispatch-clock.mjs';
import {checkpointActorOrderUnitReferences} from '../web/world/order-unit-bindings.mjs';

const prefix=process.argv[2]??'native-actor-populated-stage-fixtures';
const clockProbe=process.argv[3]==='--clock-probe';
const targetCases=process.argv[3]==='--target-cases';
if(process.argv.length>4||(process.argv[3]&&!clockProbe&&!targetCases))throw Error('Unknown fixture option');
if(!/^[a-z][a-z0-9-]*$/.test(prefix))throw Error('Use a simple output basename');
const root=new URL('../',import.meta.url), filename=`output/checkpoint-unit-reference-browser/${targetCases?'brashnard':'scions'}.GMP`;
const raw=await readFile(new URL(filename,root));
const sha=b=>createHash('sha256').update(b).digest('hex');
const pin=targetCases?'31059d44ebf165c25bf1fd91f8ef00d5c5e3733d2d6177ca8e05956026650e13':
  '6e6a2ee125b68ce00ec25a46f205904e7cdd8f83ca009c10cf29e8e9ab76e2d1';
if(sha(raw)!==pin)throw Error('Changed copied source');
const capture=JSON.parse(await readFile(new URL('output/native-order-real-name-reservation-cases.json',root),'utf8'));
const cases=capture.cases.filter(c=>c.filename===(targetCases?'brashnard.GMP':'scions.GMP'));
const selected=new Set(targetCases?[2062,2063,2067,2073]:[497,499,501,503]);
const source={size:raw.length,async readAt(at,n){
  if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||n>4096||at+n>raw.length)
    throw Error('Unbounded copied-source read');
  return raw.subarray(at,at+n);
}};
const rows=[];
for await(const record of checkpointUnits(source)){
  const c=cases.find(c=>c.unitId===record.primary.words[1]);
  if(record.family!=='VHCL'||!c||!selected.has(c.unitId))continue;
  const primary=record.primary.words;
  if(primary[0]!==1||(primary[2]&4)||primary[6]||record.components.length!==2)
    throw Error('Requires a living parentless two-component vehicle');
  const {plan,requests}=await checkpointActorOrderStorageRequests(source,c.unitId);
  if(JSON.stringify(requests)!==JSON.stringify(c.requests)||plan.entries.length!==c.entryCount)
    throw Error('Stale copied reservation descriptors');
  const unit=raw.subarray(record.offset,record.offset+record.size);
  if(unit.toString('ascii',0,4)!=='UNIT')throw Error('Expected full UNIT record');
  const payload=Buffer.concat(c.banks.map(bank=>{
    const bytes=raw.subarray(bank.sourceOffset,bank.sourceOffset+bank.payloadBytes);
    if(sha(bytes)!==bank.payloadSha256)throw Error('Changed literal command bank');
    return bytes;
  }));
  if(unit.length>4096||payload.length>2048||requests.length>32)throw Error('Fixture budget');
  const clocks=[];
  const targets=[];
  if(targetCases){
    for await(const target of checkpointActorOrderUnitReferences(source,c.unitId)){
      let start=0,offset;
      for(const bank of c.banks){
        if(bank.bank===target.bank){
          if(target.offset<bank.sourceOffset||target.offset+4>bank.sourceOffset+bank.payloadBytes)
            throw Error('Target outside bank');
          offset=start+target.offset-bank.sourceOffset;
        }
        start+=bank.payloadBytes;
      }
      if(offset===undefined||payload.readUInt32LE(offset)!==target.targetUnitId)
        throw Error('Unmatched target field');
      targets.push({...target,payloadOffset:offset});
    }
    if(!targets.some(t=>t.targetUnitId))throw Error('Requires a nonzero saved target');
  }
  if(clockProbe){
    const plan=await checkpointOrderDispatchClockPlan(source,c.unitId,{sourceClockMs:0,destinationClockMs:0});
    for(const h of plan.headers){
      let start=0,offset;
      for(const bank of c.banks){
        if(bank.bank===h.bank){
          if(h.offset<bank.sourceOffset||h.offset+12>bank.sourceOffset+bank.payloadBytes)throw Error('Clock outside bank');
          offset=start+h.offset-bank.sourceOffset;
        }
        start+=bank.payloadBytes;
      }
      if(offset===undefined||payload.readUInt32LE(offset)!==h.when)throw Error('Unmatched clock field');
      clocks.push({offset,bank:h.bank,index:h.index,kind:h.kind,when:h.when,rate:h.rate,delta:h.delta,info:h.info});
    }
    if(clocks.length!==3||clocks.map(h=>h.kind).join(',')!=='2,4,7')throw Error('Expected three selected command clocks');
  }
  rows.push({unitId:c.unitId,unit,payload,counts:c.banks.map(b=>b.count),requests,clocks,targets});
}
if(rows.length!==4||new Set(rows.map(r=>r.unitId)).size!==4)throw Error('Expected four matching vehicles');
const targetUnits=[];
if(targetCases){
  const needed=new Set(rows.flatMap(r=>r.targets.map(t=>t.targetUnitId)).filter(Boolean));
  for await(const record of checkpointUnits(source)){
    if(!needed.has(record.primary.words[1]))continue;
    if(targetUnits.some(r=>r.unitId===record.primary.words[1]))throw Error('Ambiguous saved target identity');
    targetUnits.push({unitId:record.primary.words[1],family:record.family,
      kind:record.primary.words[0],flags:record.primary.words[2],description:record.primary.description,
      player:record.primary.words[5],parentUnitId:record.primary.words[6]});
  }
  if(targetUnits.length!==needed.size)throw Error('Missing saved target UNIT');
}
const words=v=>{const bytes=Buffer.alloc(v.length*4);v.forEach((n,i)=>bytes.writeUInt32LE(n>>>0,i*4));return bytes;};
const format=clockProbe?'NAS2':'NAS1';
const pieces=[Buffer.from(format),words([rows.length])],roles=['bank','head','order','path','node','baseName','leafName'];
for(const row of rows){
  pieces.push(words([row.unitId,row.unit.length,row.requests.length,row.payload.length,...row.counts]),row.unit);
  for(const request of row.requests)pieces.push(words([roles.indexOf(request.role),request.bank,
    request.index??0xffffffff,request.kind??0,request.bytes]));
  pieces.push(row.payload);
  if(clockProbe){
    pieces.push(words([row.clocks.length]));
    for(const h of row.clocks)pieces.push(words([h.offset,h.bank,h.index,h.kind,h.when,h.rate,h.delta,h.info]));
  }
}
const data=Buffer.concat(pieces);
if(data.length>32768)throw Error('Fixture pack budget');
await writeFile(new URL(`output/${prefix}.bin`,root),data,{flag:'wx'});
await writeFile(new URL(`output/${prefix}.json`,root),JSON.stringify({format,bytes:data.length,
  sha256:sha(data),source:filename,sourceSha256:pin,
  cases:rows.map(r=>({unitId:r.unitId,unitBytes:r.unit.length,requests:r.requests.length,
    payloadBytes:r.payload.length,counts:r.counts,...(clockProbe?{clocks:r.clocks}:{}),
    ...(targetCases?{targets:r.targets}:{})})),
  ...(targetCases?{targetUnits,destinationBindingsQualified:false,nativeRestorationQualified:false}:{}),
  browserUsed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:rows.length,bytes:data.length,sha256:sha(data)}));
