import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointActorOrderRestoreBounds} from '../web/world/order-restore-bounds.mjs';
import {checkpointOrderDispatchClockPlan} from '../web/world/order-dispatch-clock.mjs';
import {checkpointActorOrderCallbacks} from '../web/world/order-callbacks.mjs';
import {checkpointHaloCompanionOrderPlan} from '../web/world/halo-companion-orders.mjs';
const words=v=>{const b=Buffer.alloc(v.length*4);v.forEach((n,i)=>b.writeUInt32LE(n>>>0,i*4));return b;};
const chunk=(tag,body=Buffer.alloc(0),version=0,count=0)=>Buffer.concat([Buffer.from(tag),words([body.length,version,count]),body]);
function fixture({marker=false,frame=0,repetitions=1}={}){
  const body=Array(29).fill(0);body.splice(0,4,1,1,2,12);body[4]=150;body[5]=60600;body[6]=150;body[10]=0x2002;
  body.splice(24,5,2,0,3,frame,repetitions);
  const m=Array(44).fill(0);m.splice(0,4,1,1,2,5);m[4]=100;m[5]=60650;m[6]=100;m[24]=80;m[28]=1;
  return Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('ORDR',Buffer.concat([words([492]),
    chunk('ORDR',chunk('PRIM',Buffer.concat([words([1,0,1,marker?2:1,1,12]),words(body),
      ...(marker?[words([1,5]),words(m)]:[]),words([1,0])]),2),0,1)]),1,1),chunk('CONT',undefined,1)]);
}
const source=b=>({size:b.length,async readAt(at,n){assert.ok(n<=4096);return Uint8Array.from(b.subarray(at,at+n));}});
const entries=async b=>{const rows=[];for await(const e of checkpointActorOrderEntries(source(b),492))rows.push(e);return rows;};
test('frame-state words remain exact; common callback stays a callback, not a script or native target',async()=>{
  const b=fixture(),original=Buffer.from(b),rows=await entries(b),e=rows.find(r=>r.type==='entry');
  assert.equal(e.kind,12);assert.equal(e.size,116);assert.deepEqual(e.words.slice(24),[2,0,3,0,1]);
  const callbacks=[];for await(const c of checkpointActorOrderCallbacks(source(b),492))callbacks.push(c);
  assert.equal(callbacks.length,1);assert.equal(callbacks[0].cProcId,0x2002);assert.equal(callbacks[0].scriptId,0);
  assert.deepEqual(b,original);
});
test('restoring one frame command reserves its object, node, name and three empty bank roots',async()=>{
  const r=await checkpointActorOrderRestoreBounds(source(fixture()),492);
  assert.equal(r.allocationRequestBytes,181);assert.equal(r.entries[0].objectBytes,72);
  assert.equal(r.parts.pathBytes,0);assert.equal(r.parts.leafNameBytes,0);assert.equal(r.parts.baseNameBytes,1);
});
test('dispatch age rebasing edits only the common stamp and preserves the frame counters and interval',async()=>{
  const b=fixture(),p=await checkpointOrderDispatchClockPlan(source(b),492,{sourceClockMs:60650,destinationClockMs:0});
  assert.equal(p.headers[0].elapsed,50);assert.equal(p.headers[0].dispatchDue,false);
  assert.equal(p.patches.length,1);const out=Buffer.from(b),e=p.patches[0];out.writeUInt32LE(e.after,e.offset);
  const expected=Buffer.from(b);expected.writeUInt32LE(0xffffffce,368);
  assert.deepEqual(out,expected);assert.deepEqual((await entries(out)).find(r=>r.type==='entry').words.slice(24),[2,0,3,0,1]);
});
test('truncated, corrupt-version and nonempty-name frame commands refuse before restore admission',async()=>{
  const b=fixture();await assert.rejects(entries(b.subarray(0,b.length-1)),/Truncated/);
  const bad=Buffer.from(b);bad.writeUInt32LE(2,348);await assert.rejects(entries(bad),/layout/);
  const named=Buffer.from(b);named.writeUInt32LE(1,348+64);
  await assert.rejects(checkpointActorOrderRestoreBounds(source(named),492),/name storage/);
});
test('Explore companion plan preserves an advanced frame and repetition counter with both live dispatch ages',async()=>{
  const b=fixture({marker:true,frame:2,repetitions:2}),original=Buffer.from(b);
  const p=await checkpointHaloCompanionOrderPlan(source(b),492,'explore-flag',{sourceClockMs:60650,destinationClockMs:0});
  assert.deepEqual(p.entries.map(e=>e.kind),[12,5]);assert.deepEqual(p.entries[0].words.slice(24),[2,0,3,2,2]);
  assert.deepEqual(p.dispatch.headers.map(h=>h.elapsed),[50,0]);assert.equal(p.allocationRequestBytes,287);
  assert.equal(p.patches.length,2);assert.deepEqual(b,original);assert.equal(p.nativeActivationQualified,false);
});
test('flag command/callback corruption, stale dispatch and invalid animation counters refuse preparation',async()=>{
  for(const options of [{frame:4},{repetitions:0}])await assert.rejects(checkpointHaloCompanionOrderPlan(
    source(fixture({marker:true,...options})),492,'explore-flag',{sourceClockMs:60650,destinationClockMs:0}),/frame state/);
  const b=fixture({marker:true});b.writeUInt32LE(0x2003,348+40);
  await assert.rejects(checkpointHaloCompanionOrderPlan(source(b),492,'explore-flag',
    {sourceClockMs:60650,destinationClockMs:0}),/callback/);
  await assert.rejects(checkpointHaloCompanionOrderPlan(source(fixture({marker:true})),492,'explore-flag',
    {sourceClockMs:60750,destinationClockMs:0}),/post-dispatch/);
  await assert.rejects(checkpointHaloCompanionOrderPlan(source(fixture()),492,'explore-flag',
    {sourceClockMs:60650,destinationClockMs:0}),/banks/);
});
function waitFixture(interval){
  const body=Array(24).fill(0);body.splice(0,4,1,1,2,9);body[4]=interval;body[5]=60450;body[6]=interval;body[10]=4109;
  return Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('ORDR',Buffer.concat([words([494]),
    chunk('ORDR',chunk('PRIM',Buffer.concat([words([1,0,1,1,1,9]),words(body),words([1,0])]),2),0,1)]),1,1),chunk('CONT',undefined,1)]);
}
test('both current Wait profiles preserve age200 and their own interval, without restarting expiry',async()=>{
  for(const[profile,interval]of [['wait-arg1',1000],['wait-arg4',2500]]){
    const b=waitFixture(interval),p=await checkpointHaloCompanionOrderPlan(source(b),494,profile,
      {sourceClockMs:60650,destinationClockMs:0});
    assert.equal(p.dispatch.headers[0].elapsed,200);assert.equal(p.dispatch.headers[0].delta,interval);
    assert.equal(p.patches[0].after,0xffffff38);assert.equal(p.allocationRequestBytes,161);
    await assert.rejects(checkpointHaloCompanionOrderPlan(source(b),494,profile,
      {sourceClockMs:60450+interval,destinationClockMs:0}),/post-dispatch/);
  }
  await assert.rejects(checkpointHaloCompanionOrderPlan(source(waitFixture(1000)),494,'wait-arg4',
    {sourceClockMs:60650,destinationClockMs:0}),/callback, timer/);
});
