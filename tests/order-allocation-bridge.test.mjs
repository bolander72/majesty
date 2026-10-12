import test from 'node:test';
import assert from 'node:assert/strict';
import {reserveCheckpointActorOrderStorage} from '../web/world/order-reservations.mjs';
import {createUnpublishedOrderAllocationBridge,NATIVE_ORDER_ALLOCATION_SITES,NATIVE_ORDER_NAME_ALLOCATION_SITE} from '../web/world/order-allocation-bridge.mjs';
const words=v=>{const b=Buffer.alloc(v.length*4);v.forEach((n,i)=>b.writeUInt32LE(n>>>0,i*4));return b;};
const chunk=(tag,body=Buffer.alloc(0),version=0,count=0)=>Buffer.concat([Buffer.from(tag),words([body.length,version,count]),body]);
function entry(kind,capacity=10){
  const sizes={1:33,2:44,4:35,5:44,6:44,7:28,10:30,11:50},v=Array(sizes[kind]).fill(0);
  const prefix=kind===11?[1,1,1,2,kind]:[kind===4?5:[1,2].includes(kind)?2:1,1,2,kind];v.splice(0,prefix.length,...prefix);
  if(kind===4)v[32]=capacity;return Buffer.concat([words([1,kind]),words(v)]);
}
function save(kinds=[1,2,4,5,6,7,10,11],capacity=10){
  const body=Buffer.concat([words([1,kinds.length]),...kinds.map(k=>entry(k,capacity)),words([1,0,1,0])]);
  const record=Buffer.concat([words([506]),chunk('ORDR',chunk('PRIM',body,2),0,1)]);
  return Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('ORDR',record,1,1),chunk('CONT',undefined,1)]);
}
async function fixture(kinds,capacity){
  const data=save(kinds,capacity),source={size:data.length,async readAt(at,n){assert.ok(n<=4096);return data.subarray(at,at+n);}};
  let bump=0x100000;const live=new Map();
  const journal=await reserveCheckpointActorOrderStorage(source,506,{
    allocate(n){const at=bump;bump+=(n+7)&~7;live.set(at,n);return at;},
    free(at,n){assert.equal(live.get(at),n);live.delete(at);}});
  return {journal,bridge:createUnpublishedOrderAllocationBridge(journal),live};
}
const site=(role,kind=null)=>NATIVE_ORDER_ALLOCATION_SITES.find(s=>s.role===role&&s.kind===kind);
const frame=(scope,call,bytes=call.bytes,esi=0,streamStatus=0)=>({token:scope.token,callerPc:call.callerPc,bytes,esi,streamStatus});
const nodeFrame=(journal,scope,status=0)=>frame(scope,site('node'),12,journal.reservations.find(r=>r.role==='head'&&r.bank===scope.bank).address,status);
function constructors(journal,bridge){
  for(let bank=0;bank<journal.plan.banks;++bank){
    const scope=bridge.beginConstruction(bank),result=bridge.intercept(frame(scope,site('head'),12,scope.address));
    assert.equal(result.argBytes,0);assert.equal(result.eax,journal.reservations.find(b=>b.bank===bank&&b.role==='head').address);
    bridge.endConstruction(scope.address);
  }
}
function factory(journal,bridge,scope,index){
  const request=journal.requests.find(r=>r.role==='order'&&r.bank===scope.bank&&r.index===index);
  const result=bridge.intercept(frame(scope,site('order',request.kind)));return {request,address:result.eax};
}

const nameFrame=(scope,orderAddress,kind,role='baseName')=>({token:scope.token,
  callerPc:NATIVE_ORDER_NAME_ALLOCATION_SITE.callerPc,bytes:1,
  ebx:orderAddress+(role==='baseName'?36:[2,6].includes(kind)?76:72)});
function names(journal,bridge,scope,order){
  for(const role of ['baseName','leafName']){
    const request=journal.requests.find(r=>r.role===role&&r.bank===scope.bank&&r.index===order.request.index);
    if(!request)continue;
    const decision=bridge.interceptName(nameFrame(scope,order.address,order.request.kind,role));
    assert.deepEqual(decision,{action:'return',argBytes:0,
      eax:journal.reservations.find(r=>r.role===role&&r.bank===scope.bank&&r.index===request.index).address});
  }
}

test('all initial types consume exact scoped reservations with cdecl returns',async()=>{
  const {journal:j,bridge:b,live}=await fixture();constructors(j,b);
  for(let bank=0;bank<3;++bank){
    const scope=b.beginRead(bank);
    for(const request of j.requests.filter(r=>r.role==='order'&&r.bank===bank)){
      const order=factory(j,b,scope,request.index);
      const path=j.requests.find(r=>r.role==='path'&&r.bank===bank&&r.index===request.index);
      if(path)assert.equal(b.intercept(frame(scope,site('path',request.kind),path.bytes,order.address)).argBytes,0);
      names(j,b,scope,order);b.intercept(nodeFrame(j,scope));
    }
    assert.equal(b.endRead(0),true);
  }
  assert.equal(b.assertComplete(),true);assert.equal(b.completeOrderMigration,false);b.close();await j.release();assert.equal(live.size,0);
});

test('foreign and inactive allocation frames delegate; owned sentinel frames check the actual bank address',async()=>{
  const {journal:j,bridge:b}=await fixture([]);
  assert.deepEqual(b.intercept(),{action:'delegate'});
  const scope=b.beginConstruction(0);
  assert.deepEqual(b.intercept({token:Symbol('foreign'),callerPc:0,bytes:-1}),{action:'delegate'});
  assert.throws(()=>b.intercept(frame(scope,site('head'),12,scope.address+4)),/sentinel allocation context/);
  assert.equal(b.failed,true);assert.throws(()=>b.intercept(frame(scope,site('head'),12,scope.address)),/scope is invalid/);
  b.close();await j.release();assert.deepEqual(b.intercept(frame(scope,site('head'))),{action:'delegate'});
});

test('equal-sized factory types cannot borrow each other’s reservations',async()=>{
  const {journal:j,bridge:b}=await fixture([2]);constructors(j,b);const scope=b.beginRead(0);
  assert.throws(()=>b.intercept(frame(scope,site('order',5))),/factory kind/);assert.equal(b.failed,true);
  b.close();await j.release();
});

test('path allocation must use the pending order and correct phase',async()=>{
  const {journal:j,bridge:b}=await fixture([7]);constructors(j,b);const scope=b.beginRead(0),order=factory(j,b,scope,0);
  assert.throws(()=>b.intercept(frame(scope,site('path',7),80,order.address+4)),/path allocation owner/);
  b.close();await j.release();
  const second=await fixture([7]);const construction=second.bridge.beginConstruction(0);
  assert.throws(()=>second.bridge.intercept(frame(construction,site('order',7))),/outside native read/);
  second.bridge.close();await second.journal.release();
  const third=await fixture([1]);constructors(third.journal,third.bridge);const s=third.bridge.beginRead(0);
  const thirdOrder=factory(third.journal,third.bridge,s,0);names(third.journal,third.bridge,s,thirdOrder);
  assert.throws(()=>third.bridge.intercept({...nodeFrame(third.journal,s),esi:0}),/node list owner/);
  third.bridge.close();await third.journal.release();
});

test('missing nodes, premature nodes, repeated claims and incomplete bank sequences stop completion',async()=>{
  for(const mode of ['missing-node','premature-node','repeat-head','incomplete-read']){
    const {journal:j,bridge:b}=await fixture([7]);
    if(mode==='repeat-head'){
      const s=b.beginConstruction(0);b.intercept(frame(s,site('head'),12,s.address));
      assert.throws(()=>b.intercept(frame(s,site('head'),12,s.address)),/sentinel allocation context/);
    }else{
      assert.throws(()=>b.beginRead(0),/sequence/);constructors(j,b);const s=b.beginRead(0);
      if(mode==='incomplete-read')assert.throws(()=>b.endRead(0),/reported success/);
      else{
        factory(j,b,s,0);
        if(mode==='missing-node')assert.throws(()=>b.endRead(0),/unlinked order/);
        else assert.throws(()=>b.intercept(nodeFrame(j,s)),/before path readiness/);
      }
    }
    assert.throws(()=>b.assertComplete(),/incomplete/);b.close();await j.release();
  }
});

test('failed kind-4 capacity reading returns zero while the unused reserved path stays owned for rollback',async()=>{
  const {journal:j,bridge:b,live}=await fixture([4]);constructors(j,b);const s=b.beginRead(0),order=factory(j,b,s,0);
  const decision=b.intercept(frame(s,site('path',4),0,order.address,7));
  assert.deepEqual(decision,{action:'return',eax:0,argBytes:0,failedReadZeroRequest:true});
  b.intercept(nodeFrame(j,s,7));assert.equal(b.endRead(7),false);
  assert.equal(j.ownedRequestBytes,289);assert.throws(()=>j.assertFullyClaimed(),/Unconsumed/);
  assert.throws(()=>b.beginRead(1),/cannot begin/);assert.throws(()=>b.assertComplete(),/incomplete/);
  b.close();await j.release();assert.equal(live.size,0);
});

test('malformed owned frames and stream failure hidden by a successful completion poison the bridge',async()=>{
  for(const options of [{callerPc:0x1234},{bytes:1.5},{streamStatus:-1},{esi:0x100000000}]){
    const {journal:j,bridge:b}=await fixture([]),s=b.beginConstruction(0);
    assert.throws(()=>b.intercept({...frame(s,site('head'),12,s.address),...options}));assert.equal(b.failed,true);
    b.close();await j.release();
  }
  const {journal:j,bridge:b}=await fixture([1]);constructors(j,b);const s=b.beginRead(0),order=factory(j,b,s,0);
  b.intercept(nodeFrame(j,s,7));assert.throws(()=>b.endRead(0),/reported success/);
  b.close();await j.release();
});

test('a canonical zero-capacity kind-4 path can complete without handing out storage',async()=>{
  const {journal:j,bridge:b,live}=await fixture([4],0);constructors(j,b);
  const s=b.beginRead(0),order=factory(j,b,s,0);
  assert.deepEqual(b.intercept(frame(s,site('path',4),0,order.address)),{action:'return',eax:0,argBytes:0});
  names(j,b,s,order);b.intercept(nodeFrame(j,s));assert.equal(b.endRead(0),true);
  for(const bank of [1,2]){b.beginRead(bank);b.endRead(0);}assert.equal(b.assertComplete(),true);
  b.close();await j.release();assert.equal(live.size,0);
});

test('name allocations delegate outside their exact scope and cannot use another order field',async()=>{
  const {journal:j,bridge:b,live}=await fixture([2,5]);
  assert.deepEqual(b.interceptName(),{action:'delegate'});constructors(j,b);
  const s=b.beginRead(0),order=factory(j,b,s,0);
  assert.deepEqual(b.interceptName({token:Symbol('foreign'),bytes:-1}),{action:'delegate'});
  names(j,b,s,order);b.intercept(nodeFrame(j,s));
  const next=factory(j,b,s,1);
  assert.throws(()=>b.interceptName(nameFrame(s,order.address,2)),/name allocation field/);
  assert.equal(b.failed,true);assert.throws(()=>b.interceptName(nameFrame(s,next.address,5)),/scope is invalid/);
  b.close();await j.release();assert.equal(live.size,0);
  assert.deepEqual(b.interceptName(nameFrame(s,next.address,5)),{action:'delegate'});
});

test('owned names reject unknown callers, wrong sizes, wrong fields and duplicate exposure',async()=>{
  for(const mode of ['caller','size','field','invalid-field','duplicate','missing-base','missing-leaf']){
    const {journal:j,bridge:b,live}=await fixture([2]);constructors(j,b);
    const s=b.beginRead(0),order=factory(j,b,s,0),frame=nameFrame(s,order.address,2);
    if(mode==='missing-base')assert.throws(()=>b.intercept(nodeFrame(j,s)),/name readiness/);
    else if(mode==='missing-leaf'){
      b.interceptName(frame);assert.throws(()=>b.intercept(nodeFrame(j,s)),/name readiness/);
    }else if(mode==='duplicate'){
      b.interceptName(frame);assert.throws(()=>b.interceptName(frame),/already claimed/);
    }else{
      const patch={caller:{callerPc:0x1234},size:{bytes:2},field:{ebx:order.address+72},
        'invalid-field':{ebx:0x100000000}}[mode];
      assert.throws(()=>b.interceptName({...frame,...patch}),/name allocation/);
    }
    assert.equal(b.failed,true);assert.throws(()=>b.assertComplete(),/incomplete/);
    b.close();await j.release();assert.equal(live.size,0);
  }
});

test('name claims require a pending unlinked read entry; failed reads retain unclaimed names for cleanup',async()=>{
  for(const phase of ['construct','before-factory','after-node']){
    const {journal:j,bridge:b,live}=await fixture([1]);
    let s;
    if(phase==='construct')s=b.beginConstruction(0);
    else{
      constructors(j,b);s=b.beginRead(0);
      if(phase==='after-node'){
        const order=factory(j,b,s,0);names(j,b,s,order);b.intercept(nodeFrame(j,s));
      }
    }
    assert.throws(()=>b.interceptName(nameFrame(s,0x100000,1)),/outside pending/);
    b.close();await j.release();assert.equal(live.size,0);
  }
  const {journal:j,bridge:b,live}=await fixture([2]);constructors(j,b);
  const s=b.beginRead(0);factory(j,b,s,0);b.intercept(nodeFrame(j,s,7));
  assert.equal(b.endRead(7),false);assert.throws(()=>j.assertFullyClaimed(),/Unconsumed/);
  assert.throws(()=>b.assertComplete(),/incomplete/);b.close();await j.release();assert.equal(live.size,0);
});
