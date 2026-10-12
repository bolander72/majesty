import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointActorOrderUnitReferences,checkpointOrderUnitReferencePlan,MAX_ORDER_UNIT_REFERENCE_SITES} from '../web/world/order-unit-bindings.mjs';
const words=values=>{const b=Buffer.alloc(values.length*4);values.forEach((v,i)=>b.writeUInt32LE(v>>>0,i*4));return b;};
const chunk=(tag,body=Buffer.alloc(0),version=0,count=0)=>Buffer.concat([Buffer.from(tag),words([body.length,version,count]),body]);
function entry(kind,id=0){
  const sizes={2:44,4:35,5:44,6:44,11:50},v=Array(sizes[kind]).fill(0x12345678);
  const prefix=kind===11?[1,1,1,2,kind]:[kind===4?5:kind===2?2:1,1,2,kind];v.splice(0,prefix.length,...prefix);
  if(kind===4)v[34]=0;
  if(kind!==5)v[kind===11?46:25]=id;
  return Buffer.concat([words([1,kind]),words(v)]);
}
const order=(groups=[[],[],[]])=>Buffer.concat([words([506]),chunk('ORDR',chunk('PRIM',Buffer.concat(groups.map(g=>Buffer.concat([words([1,g.length]),...g]))),2),0,1)]);
const save=records=>Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('ORDR',Buffer.concat(records),1,records.length),chunk('CONT',undefined,1)]);
function source(data){let active=0,peak=0;return {size:data.length,get peak(){return peak;},async readAt(at,n){assert.ok(n<=4096);peak=Math.max(peak,++active);await Promise.resolve();--active;return data.subarray(at,at+n);}};}
async function inspect(input){const rows=[];for await(const r of checkpointActorOrderUnitReferences(input,506))rows.push(r);return rows;}

test('only qualified fields across movement, follow and inherited action orders become UNIT sites',async()=>{
  const data=save([order([[entry(2,531),entry(5)],[entry(4,531),entry(6,0xffffffff)],[entry(11,9000)]])]),input=source(data),rows=await inspect(input);
  assert.deepEqual(rows.map(r=>[r.kind,r.targetUnitId]),[[2,531],[4,531],[6,0xffffffff],[11,9000]]);
  for(const r of rows){assert.equal(data.readUInt32LE(r.offset),r.targetUnitId);assert.ok(Object.isFrozen(r));}
  const calls=[],plan=await checkpointOrderUnitReferencePlan(source(data),506,id=>{calls.push(id);return new Map([[531,100001],[0xffffffff,0xfffffffe],[9000,100002]]).get(id);});
  assert.deepEqual(calls,[531,0xffffffff,9000]);assert.equal(plan.patches.length,4);assert.equal(plan.completeOrderMigration,false);
  assert.ok(Object.isFrozen(plan)&&Object.isFrozen(plan.patches));assert.equal(input.peak,1);
  for(const p of plan.patches){assert.ok(Object.isFrozen(p));assert.equal(data.readUInt32LE(p.offset),p.before);assert.ok(rows.some(r=>r.offset===p.offset));}
  // Identical opaque callback/action/coordinate integers are never searched.
  assert.equal(plan.patches.some(p=>p.before===0x12345678),false);
});
test('inherited target offsets and copied identities remain stable after source mutation',async()=>{
  const data=save([order([[entry(11,17)],[],[]])]),rows=await inspect(source(data)),plan=await checkpointOrderUnitReferencePlan(source(data),506,id=>id+1);
  assert.equal(rows.length,1);assert.equal(rows[0].kind,11);assert.equal(plan.patches[0].offset,rows[0].offset);
  data.writeUInt32LE(99,rows[0].offset);assert.equal(rows[0].targetUnitId,17);assert.equal(plan.patches[0].before,17);
});
test('later unknown kinds, malformed versions, duplicates and truncation reject before resolution',async()=>{
  const malformed=entry(2,531);malformed.writeUInt32LE(9,8);
  const groups=[[order([[entry(6,531),words([1,16])],[],[]])],
    [order([[entry(6,531)],[],[]]),order()],
    [order([[entry(6,531),malformed],[],[]])],
    [order([[entry(2,531).subarray(0,100)],[],[]])]];
  for(const records of groups){let called=false;await assert.rejects(checkpointOrderUnitReferencePlan(source(save(records)),506,()=>{called=true;return 1000;}));assert.equal(called,false);}
});
test('missing, invalid and aliased destination UNIT bindings reject the partial plan',async()=>{
  const data=save([order([[entry(2,531),entry(11,600)],[],[]])]);
  for(const value of [undefined,null,0,-1,1.5,0x100000000,NaN,'1000'])
    await assert.rejects(checkpointOrderUnitReferencePlan(source(data),506,()=>value),/Unresolved/);
  await assert.rejects(checkpointOrderUnitReferencePlan(source(data),506,()=>1000),/Ambiguous/);
  await assert.rejects(checkpointOrderUnitReferencePlan(source(data),506,null),/resolver required/);
});
test('site budget is checked before resolvers run, and zero targets require no binding',async()=>{
  const commands=Array.from({length:MAX_ORDER_UNIT_REFERENCE_SITES},()=>entry(6,531));let calls=0;
  const plan=await checkpointOrderUnitReferencePlan(source(save([order([commands,[],[]])])),506,async id=>{++calls;return id;});
  assert.equal(plan.patches.length,128);assert.equal(calls,1);
  commands.push(entry(6,531));calls=0;
  await assert.rejects(checkpointOrderUnitReferencePlan(source(save([order([commands,[],[]])])),506,id=>{++calls;return id;}),/budget/);
  assert.equal(calls,0);
  for(const records of [[],[order()],[order([[entry(2),entry(4),entry(6),entry(11)],[],[]])]])
    assert.deepEqual((await checkpointOrderUnitReferencePlan(source(save(records)),506,()=>{throw Error('zero');})).patches,[]);
});
