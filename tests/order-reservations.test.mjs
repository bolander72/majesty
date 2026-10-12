import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointActorOrderStorageRequests,reserveCheckpointActorOrderStorage,MAX_ORDER_STORAGE_RESERVATIONS} from '../web/world/order-reservations.mjs';
const words=v=>{const b=Buffer.alloc(v.length*4);v.forEach((n,i)=>b.writeUInt32LE(n>>>0,i*4));return b;};
const chunk=(tag,body=Buffer.alloc(0),version=0,count=0)=>Buffer.concat([Buffer.from(tag),words([body.length,version,count]),body]);
function entry(kind,{capacity=10,count=0}={}){
  const sizes={1:33,2:44,4:35,5:44,6:44,7:28,10:30,11:50},v=Array(sizes[kind]).fill(0);
  const prefix=kind===11?[1,1,1,2,kind]:[kind===4?5:[1,2].includes(kind)?2:1,1,2,kind];v.splice(0,prefix.length,...prefix);
  if(kind===4){v[32]=capacity;v[34]=count;}if(kind===7)v[27]=count;
  return Buffer.concat([words([1,kind]),words(v),Buffer.alloc(count*8)]);
}
function save(entries=[]){
  const banks=Buffer.concat([words([1,entries.length]),...entries,words([1,0,1,0])]);
  const record=Buffer.concat([words([506]),chunk('ORDR',chunk('PRIM',banks,2),0,1)]);
  return Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('ORDR',record,1,1),chunk('CONT',undefined,1)]);
}
const source=data=>({size:data.length,async readAt(at,n){assert.ok(n<=4096);return data.subarray(at,at+n);}});
const all=()=>save([1,2,4,5,6,7,10,11].map(k=>entry(k)));
function allocator({failAt=Infinity,throwAt=Infinity,freeFailureOnce=false,delayFree}={}){
  const live=new Map(),allocated=[],freed=[];let calls=0,bump=0x100000,peak=0,failed=false;
  return {live,allocated,freed,get calls(){return calls;},get peak(){return peak;},
    async allocate(bytes,request){
      ++calls;if(calls===throwAt)throw Error('allocation refused');if(calls===failAt)return 0;
      const address=bump;bump+=(bytes+15)&~15;live.set(address,bytes);allocated.push({address,bytes,request});
      peak=Math.max(peak,[...live.values()].reduce((n,b)=>n+b,0));return address;
    },async free(address,bytes,request){
      if(freeFailureOnce&&!failed){failed=true;return false;}
      if(delayFree)await delayFree();
      assert.equal(live.get(address),bytes);assert.equal(request.address,address);
      live.delete(address);freed.push(address);
    }};
}
const reserve=(data=all(),port=allocator())=>reserveCheckpointActorOrderStorage(source(data),506,port);

test('all eight types reserve bank/head/object/path/name/node extents before exposing a journal',async()=>{
  const data=all(),before=Buffer.from(data),port=allocator(),j=await reserve(data,port);
  assert.equal(j.phase,'reserved');assert.equal(j.ownedRequestBytes,1088);assert.equal(port.peak,1088);
  assert.equal(j.requests.length,36);assert.equal(j.reservations.length,36);assert.equal(port.calls,36);
  assert.ok(Object.isFrozen(j)&&Object.isFrozen(j.requests)&&j.requests.every(Object.isFrozen));
  assert.ok(j.reservations.every(Object.isFrozen));assert.equal(j.completeOrderMigration,false);
  assert.equal(j.completeNativeMemoryBound,false);assert.deepEqual(data,before);
  for(const request of j.requests)assert.equal(j.claim(request),j.reservations.find(b=>b.role===request.role&&b.bank===request.bank&&b.index===request.index).address);
  assert.equal(j.assertFullyClaimed(),true);await j.release();assert.equal(j.phase,'released');assert.equal(port.live.size,0);
});

test('every reservation failure and allocator throw releases the exact completed prefix in reverse',async()=>{
  for(const option of ['failAt','throwAt'])for(let at=1;at<=36;++at){
    const port=allocator({[option]:at});
    await assert.rejects(reserve(all(),port),error=>{
      assert.equal(error.cleanup.phase,'released');assert.equal(error.cleanup.ownedRequestBytes,0);return true;
    });
    assert.equal(port.calls,at);assert.equal(port.live.size,0);
    assert.deepEqual(port.freed,port.allocated.map(b=>b.address).reverse());
  }
});

test('failed cleanup remains owned and retryable on the failure handle',async()=>{
  const port=allocator({failAt:3,freeFailureOnce:true});let failure;
  try{await reserve(all(),port);}catch(error){failure=error;}
  assert.ok(failure.cleanupError);const j=failure.cleanup;
  assert.equal(j.phase,'cleanup-pending');assert.equal(port.live.size,1);
  assert.equal(j.ownedRequestBytes,[...port.live.values()][0]);assert.throws(()=>j.claim(j.requests[0]),/not reserved/);
  await j.release();assert.equal(j.phase,'released');assert.equal(j.ownedRequestBytes,0);assert.equal(port.live.size,0);
  await j.release();assert.equal(port.freed.length,2);
});

test('claims verify role/bank/index/kind/size and may consume each reservation only once',async()=>{
  const port=allocator(),j=await reserve(all(),port),request=j.requests.find(r=>r.role==='order'&&r.kind===2);
  for(const patch of [{role:'path'},{bank:2},{index:127},{kind:5},{bytes:88}])
    assert.throws(()=>j.claim({...request,...patch}),/Unexpected/);
  assert.throws(()=>j.assertFullyClaimed(),/Unconsumed/);j.claim(request);
  assert.throws(()=>j.claim(request),/already claimed/);
  // Unpublished partially constructed graphs release all reserved storage;
  // cleanup never walks list pointers or depends on claimed membership.
  await j.release();assert.equal(port.live.size,0);assert.equal(port.freed.length,36);
  assert.throws(()=>j.claim(j.requests[0]),/not reserved/);
});

test('concurrent release shares cleanup and prevents claims while a free is pending',async()=>{
  let proceed;const gate=new Promise(resolve=>{proceed=resolve;}),port=allocator({delayFree:()=>gate}),j=await reserve(all(),port);
  const first=j.release(),second=j.release();assert.equal(first,second);assert.equal(j.phase,'releasing');
  assert.throws(()=>j.claim(j.requests[0]),/not reserved/);proceed();await first;
  assert.equal(port.freed.length,36);await j.release();assert.equal(port.freed.length,36);
});

test('zero-sized path claims allocate nothing, and empty/absent attachments retain their distinct requests',async()=>{
  const port=allocator(),j=await reserve(save([entry(4,{capacity:0})]),port);
  const zero=j.requests.find(r=>r.role==='path');assert.equal(j.claim(zero),0);assert.equal(port.calls,9);
  assert.equal(j.ownedRequestBytes,209);await j.release();assert.equal(port.live.size,0);
  const empty=await reserve(save(),allocator());assert.equal(empty.ownedRequestBytes,96);await empty.release();
  const absent=Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('ORDR',undefined,1),chunk('CONT',undefined,1)]);
  const none=await reserve(absent,allocator());assert.equal(none.requests.length,0);assert.equal(none.assertFullyClaimed(),true);await none.release();
});

test('whole-record refusal happens before allocation, and the exact 518-descriptor limit fits',async()=>{
  for(const data of [save([entry(1),words([1,99])]),save([entry(7,{count:11})]),save([entry(4,{capacity:4097})])]){
    const port=allocator();await assert.rejects(reserve(data,port));assert.equal(port.calls,0);
  }
  const profile=await checkpointActorOrderStorageRequests(source(save(Array.from({length:128},()=>entry(7)))),506);
  assert.equal(profile.requests.length,MAX_ORDER_STORAGE_RESERVATIONS);assert.equal(profile.requests.length,518);
});

test('overlapping allocator results are reported as a contract violation, without double-freeing a known prefix',async()=>{
  const port=allocator(),original=port.allocate.bind(port);let calls=0;
  port.allocate=async(bytes,request)=>++calls===2?0x100000:original(bytes,request);
  await assert.rejects(reserve(all(),port),error=>{
    assert.match(error.cause.message,/overlapping/);assert.equal(error.cleanup.phase,'allocator-contract-violated');
    assert.ok(error.cleanup.untrustedAllocation);assert.ok(error.cleanupError);return true;
  });
  assert.deepEqual(port.freed,[0x100000]);assert.equal(port.live.size,0);
});
