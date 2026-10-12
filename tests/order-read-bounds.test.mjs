import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointActorOrderReadBounds,NATIVE_KIND_SEVEN_PATH_CAPACITY,MAX_ORDER_PATH_STORAGE_BYTES} from '../web/world/order-read-bounds.mjs';
const words=values=>{const b=Buffer.alloc(values.length*4);values.forEach((v,i)=>b.writeUInt32LE(v>>>0,i*4));return b;};
const chunk=(tag,body=Buffer.alloc(0),version=0,count=0)=>Buffer.concat([Buffer.from(tag),words([body.length,version,count]),body]);
function entry(kind,count=0,capacity=0){
  const v=Array(kind===4?35:28).fill(0);v.splice(0,4,kind===4?5:1,1,2,kind);
  if(kind===4){v[32]=capacity;v[34]=count;}else v[27]=count;
  return Buffer.concat([words([1,kind]),words(v),Buffer.alloc(count*8)]);
}
const order=(groups=[[],[],[]])=>Buffer.concat([words([506]),chunk('ORDR',chunk('PRIM',Buffer.concat(groups.map(g=>Buffer.concat([words([1,g.length]),...g]))),2),0,1)]);
const save=records=>Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('ORDR',Buffer.concat(records),1,records.length),chunk('CONT',undefined,1)]);
function source(data){let active=0,peak=0;return {size:data.length,get peak(){return peak;},async readAt(at,n){assert.ok(n<=4096);peak=Math.max(peak,++active);await Promise.resolve();--active;return data.subarray(at,at+n);}};}

test('kind seven accepts the original ten-point boundary and rejects a structurally valid eleventh point',async()=>{
  assert.equal(NATIVE_KIND_SEVEN_PATH_CAPACITY,10);
  const data=save([order([[entry(7,10)],[],[]])]),input=source(data),plan=await checkpointActorOrderReadBounds(input,506);
  assert.equal(plan.pathStorageBytes,80);assert.equal(plan.paths[0].count,10);assert.equal(plan.paths[0].capacity,10);
  assert.equal(Object.hasOwn(plan.paths[0],'capacityOffset'),false);assert.equal(input.peak,1);
  await assert.rejects(checkpointActorOrderReadBounds(source(save([order([[entry(7,11)],[],[]])])),506),/capacity/);
});
test('kind four rejects undersized, excessive and signed-negative capacities before proposing allocation',async()=>{
  for(const capacity of [0,2,4097,0xffffffff,0x1100005c])
    await assert.rejects(checkpointActorOrderReadBounds(source(save([order([[entry(4,3,capacity)],[],[]])])),506),/capacity/);
  const data=save([order([[entry(4,3,10)],[],[]])]),plan=await checkpointActorOrderReadBounds(source(data),506);
  const path=plan.paths[0];assert.equal(path.bytes,80);assert.equal(data.readUInt32LE(path.capacityOffset),10);
  assert.equal(data.readUInt32LE(path.countOffset),3);assert.equal(plan.completeOrderMigration,false);
  assert.ok(Object.isFrozen(plan)&&Object.isFrozen(plan.paths)&&Object.isFrozen(path));
  data.writeUInt32LE(1,path.capacityOffset);assert.equal(path.capacity,10);
});
test('aggregate storage limits include spare capacity even when there are no serialized points',async()=>{
  const data=save([order([[entry(4,0,4096)],[entry(4,0,4096)],[]])]);
  const plan=await checkpointActorOrderReadBounds(source(data),506);
  assert.equal(plan.pathStorageBytes,MAX_ORDER_PATH_STORAGE_BYTES);assert.equal(plan.paths.length,2);
  await assert.rejects(checkpointActorOrderReadBounds(source(save([order([[entry(4,0,4096)],[entry(4,0,4096)],[entry(7,0)]])])),506),/storage budget/);
});
test('zero and absent paths have distinct storage requirements and plans publish only after exhaustion',async()=>{
  assert.equal((await checkpointActorOrderReadBounds(source(save([order([[entry(4,0,0),entry(7,0)],[],[]])])),506)).pathStorageBytes,80);
  assert.deepEqual((await checkpointActorOrderReadBounds(source(save([])),506)).paths,[]);
  await assert.rejects(checkpointActorOrderReadBounds(source(save([order([[entry(7,1),words([1,16])],[],[]])])),506),/kind: 16/);
  await assert.rejects(checkpointActorOrderReadBounds(source(save([order(),order()])),506),/Duplicate/);
  await assert.rejects(checkpointActorOrderReadBounds(source(save([order([[entry(4,1,1).subarray(0,150)],[],[]])])),506));
});
