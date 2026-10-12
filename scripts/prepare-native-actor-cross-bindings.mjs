#!/usr/bin/env node
// Explicit private binding fixture across two unchanged copied kingdoms.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {checkpointUnits} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderStorageRequests} from '../web/world/order-reservations.mjs';
import {checkpointOrderUnitReferencePlan} from '../web/world/order-unit-bindings.mjs';
import {checkpointOrderDispatchClockPlan} from '../web/world/order-dispatch-clock.mjs';

const prefix=process.argv[2]??'native-actor-cross-binding-fixtures';
if(!/^[a-z][a-z0-9-]*$/.test(prefix)||process.argv.length>3)throw Error('Use a fresh simple output basename');
const root=new URL('../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
const sourceName='output/checkpoint-unit-reference-browser/brashnard.GMP',destName='output/checkpoint-unit-reference-browser/scions.GMP';
const sourceBytes=await readFile(new URL(sourceName,root)),destBytes=await readFile(new URL(destName,root));
const sourceSha='31059d44ebf165c25bf1fd91f8ef00d5c5e3733d2d6177ca8e05956026650e13',
  destinationSha='6e6a2ee125b68ce00ec25a46f205904e7cdd8f83ca009c10cf29e8e9ab76e2d1';
if(sha(sourceBytes)!==sourceSha||sha(destBytes)!==destinationSha)throw Error('Changed copied kingdom');
const bounded=bytes=>({size:bytes.length,async readAt(at,n){
  if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||n>4096||at+n>bytes.length)throw Error('Unbounded fixture read');
  return bytes.subarray(at,at+n);
}}),source=bounded(sourceBytes),dest=bounded(destBytes);
const ids=[2101,2105,2122,2136],records=new Map();let sourceUnits=0,destinationUnits=0,sourceTarget,destinationTarget;
for await(const r of checkpointUnits(source)){
  ++sourceUnits;const id=r.primary.words[1];
  if(ids.includes(id)){if(records.has(id))throw Error('Duplicate source identity');records.set(id,r);}
  if(id===2073){if(sourceTarget)throw Error('Duplicate target identity');sourceTarget=r;}
}
for await(const r of checkpointUnits(dest)){
  ++destinationUnits;if(r.primary.words[1]===497){if(destinationTarget)throw Error('Duplicate destination identity');destinationTarget=r;}
}
if(sourceUnits!==1960||destinationUnits!==480||records.size!==4||!sourceTarget||!destinationTarget)throw Error('Unexpected fixture membership');
const sw=sourceTarget.primary.words,dw=destinationTarget.primary.words;
if(sourceTarget.family!=='VHCL'||destinationTarget.family!=='VHCL'||sw[0]!==1||dw[0]!==1||
  sw[4]!==dw[4]||sw[5]!==dw[5]||(sw[2]&4)||(dw[2]&4)||sw[6]||dw[6])throw Error('Incompatible explicit fixture target');
const old=JSON.parse(await readFile(new URL('output/native-order-real-name-reservation-cases.json',root),'utf8'));
const rows=[];
for(const id of ids){
  const record=records.get(id),w=record.primary.words;
  if(record.family!=='VHCL'||w[0]!==1||(w[2]&4)||w[6]||record.components.length!==2)throw Error('Unsupported actor profile');
  const capture=old.cases.find(c=>c.filename==='brashnard.GMP'&&c.unitId===id);
  const {requests,plan}=await checkpointActorOrderStorageRequests(source,id);
  if(!capture||JSON.stringify(requests)!==JSON.stringify(capture.requests)||plan.entries.length!==3||requests.length>32)throw Error('Stale source reservations');
  const payload=Buffer.concat(capture.banks.map(b=>{
    const data=sourceBytes.subarray(b.sourceOffset,b.sourceOffset+b.payloadBytes);
    if(sha(data)!==b.payloadSha256)throw Error('Changed bank payload');return data;
  }));
  const offset=(bank,at,n)=>{
    let start=0;
    for(const b of capture.banks){
      if(b.bank===bank){if(at<b.sourceOffset||at+n>b.sourceOffset+b.payloadBytes)throw Error('Field outside bank');return start+at-b.sourceOffset;}
      start+=b.payloadBytes;
    }
    throw Error('Missing source bank');
  };
  const refs=await checkpointOrderUnitReferencePlan(source,id,src=>{
    if(src!==2073)throw Error('Unmapped target');return 497;
  });
  const targets=refs.patches.map(p=>({...p,offset:offset(p.bank,p.offset,4)}));
  const clocks=(await checkpointOrderDispatchClockPlan(source,id,{sourceClockMs:0,destinationClockMs:0})).headers
    .map(h=>({...h,offset:offset(h.bank,h.offset,12)}));
  if(targets.length!==2||targets.map(t=>t.kind).join(',')!=='4,6'||clocks.map(h=>h.kind).join(',')!=='2,4,6')throw Error('Unexpected selected fields');
  for(const t of targets)if(payload.readUInt32LE(t.offset)!==t.before)throw Error('Stale target value');
  const unit=sourceBytes.subarray(record.offset,record.offset+record.size);
  if(unit.length>4096||payload.length>2048)throw Error('Actor fixture budget');
  rows.push({unitId:id,unit,payload,requests,counts:capture.banks.map(b=>b.count),targets,clocks});
}
const words=v=>{const b=Buffer.alloc(v.length*4);v.forEach((n,i)=>b.writeUInt32LE(n>>>0,i*4));return b;};
const roles=['bank','head','order','path','node','baseName','leafName'],pieces=[Buffer.from('NAS3'),words([4])];
for(const r of rows){
  pieces.push(words([r.unitId,r.unit.length,r.requests.length,r.payload.length,...r.counts]),r.unit);
  for(const q of r.requests)pieces.push(words([roles.indexOf(q.role),q.bank,q.index??0xffffffff,q.kind??0,q.bytes]));
  pieces.push(r.payload,words([3]));
  for(const h of r.clocks)pieces.push(words([h.offset,h.bank,h.index,h.kind,h.when,h.rate,h.delta,h.info]));
  pieces.push(words([2]));
  for(const t of r.targets)pieces.push(words([t.offset,t.bank,t.index,t.kind,t.before]));
}
pieces.push(words([2073,497,sw[0],sw[4],sw[5]]));
for(const [r,raw]of [[sourceTarget,sourceBytes],[destinationTarget,destBytes]]){
  if(r.size>4096)throw Error('Target record budget');pieces.push(words([r.size]),raw.subarray(r.offset,r.offset+r.size));
}
const bytes=Buffer.concat(pieces);if(bytes.length>32768)throw Error('Pack budget');
await writeFile(new URL(`output/${prefix}.bin`,root),bytes,{flag:'wx'});
await writeFile(new URL(`output/${prefix}.json`,root),JSON.stringify({format:'NAS3',bytes:bytes.length,sha256:sha(bytes),
  source:sourceName,sourceSha256:sourceSha,destination:destName,destinationSha256:destinationSha,
  sourceUnits,destinationUnits,binding:{before:2073,after:497,kind:sw[0],description:sw[4],player:sw[5]},
  cases:rows.map(r=>({unitId:r.unitId,unitBytes:r.unit.length,requests:r.requests.length,payloadBytes:r.payload.length,
    counts:r.counts,targets:r.targets,clocks:r.clocks})),
  suppliedFixtureBindingOnly:true,entityContinuityQualified:false,destinationNavigationQualified:false,
  actorActivationQualified:false,browserUsed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({actors:rows.length,bytes:bytes.length,sha256:sha(bytes),binding:[2073,497]}));
