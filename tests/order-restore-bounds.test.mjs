import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointActorOrderRestoreBounds,MAX_ORDER_RESTORE_REQUEST_BYTES,MAX_ORDER_RESTORE_ENTRIES} from '../web/world/order-restore-bounds.mjs';
const words=values=>{const b=Buffer.alloc(values.length*4);values.forEach((v,i)=>b.writeUInt32LE(v>>>0,i*4));return b;};
const chunk=(tag,body=Buffer.alloc(0),version=0,count=0)=>Buffer.concat([Buffer.from(tag),words([body.length,version,count]),body]);
function entry(kind,{capacity=0,count=0,nameAt,nameValue=1}={}){
  const lengths={1:33,2:44,4:35,5:44,6:44,7:28,10:30,11:50,13:47},v=Array(lengths[kind]).fill(0);
  const prefix=[11,13].includes(kind)?[1,1,1,2,kind]:[kind===4?5:[1,2].includes(kind)?2:1,1,2,kind];v.splice(0,prefix.length,...prefix);
  const token=[11,13].includes(kind)?11:10;v[token]=0x12345678;v[token+1]=22;v[token+2]=0x12345678;
  if(kind===4){v[32]=capacity;v[34]=count;}if(kind===7)v[27]=count;
  if(nameAt!==undefined)v[nameAt]=nameValue;
  return Buffer.concat([words([1,kind]),words(v),Buffer.alloc(count*8)]);
}
const order=(groups=[[],[],[]])=>Buffer.concat([words([506]),chunk('ORDR',chunk('PRIM',Buffer.concat(groups.map(g=>Buffer.concat([words([1,g.length]),...g]))),2),0,1)]);
const save=records=>Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('ORDR',Buffer.concat(records),1,records.length),chunk('CONT',undefined,1)]);
const source=data=>({size:data.length,async readAt(at,n){assert.ok(n<=4096);return data.subarray(at,at+n);}});
const plan=data=>checkpointActorOrderRestoreBounds(source(data),506);

test('inherited and base types account for objects, nodes, banks, sentinels, names and path requests without editing source',async()=>{
  const kinds=[1,2,4,5,6,7,10,11,13],data=save([order([kinds.map(k=>entry(k,{capacity:10})),[],[]])]),before=Buffer.from(data),p=await plan(data);
  assert.deepEqual(p.parts,{bankObjectBytes:60,sentinelBytes:36,orderObjectBytes:824,nodeBytes:108,pathBytes:160,baseNameBytes:9,leafNameBytes:5});
  assert.equal(p.allocationRequestBytes,1202);assert.equal(p.banks,3);assert.equal(p.entries.length,9);
  assert.equal(p.completeOrderMigration,false);assert.equal(p.completeNativeMemoryBound,false);
  assert.equal(p.namePolicy,'canonical-empty');assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.parts)&&Object.isFrozen(p.entries));
  assert.ok(p.entries.every(Object.isFrozen));assert.deepEqual(data,before);
});
test('combined request cap includes object and bank costs when spare path capacity fills the old path budget',async()=>{
  const exact=await plan(save([order([[entry(4,{capacity:4096})],[entry(4,{capacity:4055})],[]])]));
  assert.equal(exact.allocationRequestBytes,MAX_ORDER_RESTORE_REQUEST_BYTES-6);assert.equal(exact.parts.pathBytes,65208);
  // The former exactly-full profile exceeds the cap once both real NUL bytes are included.
  await assert.rejects(plan(save([order([[entry(4,{capacity:4096})],[entry(4,{capacity:4056})],[]])])),/allocation request budget/);
  await assert.rejects(plan(save([order([[entry(4,{capacity:4096})],[entry(4,{capacity:4096})],[]])])),/allocation request budget/);
  await assert.rejects(plan(save([order([[entry(4,{capacity:4096})],[entry(4,{capacity:4056})],[entry(1)]])])),/allocation request budget/);
});
test('noncanonical base and leaf names reject even when the first name byte is NUL',async()=>{
  for(const kind of [1,2,4,5,6,7,10,11,13]){
    const at=[11,13].includes(kind)?17:16;
    for(const nameValue of [1,256])await assert.rejects(plan(save([order([[entry(kind,{nameAt:at,nameValue})],[],[]])])),/name storage/);
  }
  for(const [kind,nameAt]of [[2,36],[5,35],[6,36],[11,36],[13,36]])
    await assert.rejects(plan(save([order([[entry(kind,{nameAt})],[],[]])])),/name storage/);
});
test('native path and entry limits reject before a plan is published',async()=>{
  for(const options of [{capacity:2,count:3},{capacity:4097}])
    await assert.rejects(plan(save([order([[entry(4,options)],[],[]])])),/path capacity/);
  await assert.rejects(plan(save([order([[entry(7,{count:11})],[],[]])])),/path capacity/);
  const entries=Array.from({length:MAX_ORDER_RESTORE_ENTRIES},()=>entry(1));
  assert.equal((await plan(save([order([entries,[],[]])]))).entries.length,128);
  entries.push(entry(1));await assert.rejects(plan(save([order([entries,[],[]])])),/entry budget/);
});
test('absent records request zero; canonical empty banks request 96 bytes; late corruption rejects',async()=>{
  const absent=await plan(save([]));assert.equal(absent.banks,0);assert.equal(absent.allocationRequestBytes,0);
  const empty=await plan(save([order()]));assert.equal(empty.banks,3);assert.equal(empty.allocationRequestBytes,96);
  assert.deepEqual(empty.entries,[]);
  await assert.rejects(plan(save([order([[entry(1),words([1,16])],[],[]])])),/kind: 16/);
  await assert.rejects(plan(save([order(),order()])),/Duplicate/);
  const data=save([order([[entry(1)],[],[]])]);await assert.rejects(plan(data.subarray(0,data.length-1)),/Truncated/);
});
