import test from 'node:test';
import assert from 'node:assert/strict';
import {planNativeCacheRetirement,revalidateNativeCacheRetirement,MAX_NATIVE_CACHE_NODES,
  MAX_NATIVE_CACHE_CAPTURE_BYTES} from '../web/world/native-cache-retirement.mjs';

function fixture(keys){
  const memory=new Uint8Array(256+keys.length*48).fill(0xa5),view=new DataView(memory.buffer);
  const collectionAddress=32,head=80,addresses=keys.map((_,i)=>128+i*48),reads=[];
  const word=(at,value)=>value===undefined?view.getUint32(at,true):view.setUint32(at,value,true);
  word(collectionAddress,0x68a8e8);word(collectionAddress+4,0x12345678);
  word(collectionAddress+8,head);word(collectionAddress+12,keys.length);
  word(head,addresses[0]??head);word(head+4,addresses.at(-1)??head);
  keys.forEach((key,i)=>{
    const at=addresses[i];word(at,addresses[i+1]??head);word(at+4,addresses[i-1]??head);word(at+8,0x68a8e0);
    for(let j=3;j<7;++j)word(at+4*j,0xf0000000+i*100+j);
    word(at+28,key);word(at+32,0x80ffffff-i);
  });
  async function readBytes(at,length){reads.push([at,length]);return memory.subarray(at,at+length);}
  return {memory,word,addresses,reads,head,collectionAddress,readBytes};
}
const plan=(f,retiringKeys)=>planNativeCacheRetirement(f.readBytes,{collectionAddress:f.collectionAddress,retiringKeys});
async function applyToFixture(f,p){
  await revalidateNativeCacheRetirement(f.readBytes,p);
  for(const patch of p.writes){assert.equal(f.word(patch.address),patch.expected);f.word(patch.address,patch.value);}
}
function list(f){
  const result=[];let next=f.word(f.head),previous=f.head;
  while(next!==f.head){
    assert.ok(result.length<MAX_NATIVE_CACHE_NODES);assert.equal(f.word(next+4),previous);
    result.push(next);previous=next;next=f.word(next);
  }
  assert.equal(f.word(f.head+4),previous);assert.equal(f.word(f.collectionAddress+12),result.length);return result;
}
test('retirement removes every matching duplicate and preserves every other payload',async()=>{
  const f=fixture([17,23,17,45,23,17]),before=f.memory.slice(),p=await plan(f,[17]);
  assert.deepEqual(p.retiring.map(n=>n.address),[f.addresses[0],f.addresses[2],f.addresses[5]]);
  assert.deepEqual(p.retiring.map(n=>n.valueAddress),p.retiring.map(n=>n.address+8));
  for(const retired of p.retiring){
    assert.deepEqual(retired.rectangleWords,[3,4,5,6].map(j=>f.word(retired.address+4*j)));
    assert.equal(retired.metadata,f.word(retired.address+32));assert.ok(Object.isFrozen(retired.rectangleWords));
  }
  assert.deepEqual(f.memory,before,'planning is read only');await applyToFixture(f,p);
  assert.deepEqual(list(f),[f.addresses[1],f.addresses[3],f.addresses[4]]);
  for(const at of f.addresses)assert.deepEqual(f.memory.slice(at+8,at+36),before.slice(at+8,at+36));
  const changed=new Set(p.writes.flatMap(w=>[w.address,w.address+1,w.address+2,w.address+3]));
  for(let i=0;i<before.length;++i)if(!changed.has(i))assert.equal(f.memory[i],before[i]);
});
test('all 256 eight-node retirement subsets match an independent survivor oracle',async()=>{
  for(let mask=0;mask<256;++mask){
    const f=fixture([0,1,2,3,4,5,6,7]),keys=[];
    for(let i=0;i<8;++i)if(mask&(1<<i))keys.push(i);
    const p=await plan(f,keys);await applyToFixture(f,p);
    assert.deepEqual(list(f),f.addresses.filter((_,i)=>!(mask&(1<<i))));
    assert.equal(p.retiring.length,keys.length);
  }
});
test('an empty collection and unmatched keys produce no edits',async()=>{
  for(const keys of [[],[1,1,2]]){
    const f=fixture(keys),p=await plan(f,[99]);assert.equal(p.writes.length,0);
    assert.equal(p.retiring.length,0);await revalidateNativeCacheRetirement(f.readBytes,p);
  }
});
test('the node budget bounds read size, captured bytes and plan size',async()=>{
  const f=fixture(Array.from({length:MAX_NATIVE_CACHE_NODES},(_,i)=>i)),p=await plan(f,[511]);
  assert.equal(p.capturedBytes,MAX_NATIVE_CACHE_CAPTURE_BYTES);assert.equal(f.reads.length,514);
  assert.equal(Math.max(...f.reads.map(r=>r[1])),36);assert.equal(p.capture.length,514);
  assert.ok(p.writes.length<=2*MAX_NATIVE_CACHE_NODES+3);await applyToFixture(f,p);assert.equal(list(f).length,511);
  const over=fixture([]);over.word(over.collectionAddress+12,513);
  await assert.rejects(plan(over,[]),/budget/);assert.equal(over.reads.length,1);
});
test('invalid rings, count, value type and overlapping storage are rejected without edits',async()=>{
  const corrupt=[f=>f.word(f.addresses[1]+4,f.head),f=>f.word(f.addresses[2],f.addresses[0]),
    f=>f.word(f.head+4,f.head),f=>f.word(f.collectionAddress+12,2),
    f=>f.word(f.addresses[1]+8,0x68a8f0),f=>f.word(f.head,0xfffffffc),
    f=>f.word(f.head,f.head),f=>f.word(f.collectionAddress,0x68a8f0)];
  for(const change of corrupt){
    const f=fixture([1,2,3]);change(f);const before=f.memory.slice();
    await assert.rejects(plan(f,[1]),/Invalid native cache|Incomplete native cache/);assert.deepEqual(f.memory,before);
  }
  // Valid links may still place a node inside uninitialized sentinel storage.
  const f=fixture([1]),overlap=f.head+8;
  f.memory.copyWithin(overlap,f.addresses[0],f.addresses[0]+36);
  f.word(overlap,f.head);f.word(overlap+4,f.head);f.word(f.head,overlap);f.word(f.head+4,overlap);
  await assert.rejects(plan(f,[]),/Overlapping/);
});
test('preflight rejects any changed payload, count or pointer before fixture writes',async()=>{
  for(const locate of [f=>f.addresses[1]+12,f=>f.addresses[0]+32,f=>f.collectionAddress+12,f=>f.head]){
    const f=fixture([1,2,3]),p=await plan(f,[1]),at=locate(f);f.word(at,f.word(at)^1);
    const before=f.memory.slice();await assert.rejects(applyToFixture(f,p),/changed/);assert.deepEqual(f.memory,before);
  }
});
test('plans own immutable numeric copies and reject forged preflight plans',async()=>{
  const f=fixture([1,2]),p=await plan(f,[1]);assert.ok(Object.isFrozen(p));assert.ok(Object.isFrozen(p.capture[2].words));
  assert.throws(()=>{p.writes[0].value=123;},TypeError);
  const captured=p.capture[2].words.slice();f.memory.fill(0);assert.deepEqual(p.capture[2].words,captured);
  await assert.rejects(revalidateNativeCacheRetirement(f.readBytes,{...p}),/Invalid/);
});
test('invalid keys, addresses and incomplete reads never yield a plan',async()=>{
  const f=fixture([]);
  for(const keys of [[1,1],[-1],[0x100000000],Array(513).fill(1),[NaN],['1']])
    await assert.rejects(plan(f,keys),/keys/);
  for(const address of [0,-4,33,0xfffffff8])await assert.rejects(planNativeCacheRetirement(f.readBytes,{collectionAddress:address,retiringKeys:[]}),/address/);
  await assert.rejects(planNativeCacheRetirement(async()=>new Uint8Array(15),{collectionAddress:32,retiringKeys:[]}),/Incomplete/);
});
