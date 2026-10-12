import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointActorOrderCallbacks,checkpointOrderCallbackAgentPlan,MAX_ORDER_CALLBACK_AGENT_SITES} from '../web/world/order-callbacks.mjs';
const words=values=>{const b=Buffer.alloc(values.length*4);values.forEach((v,i)=>b.writeUInt32LE(v>>>0,i*4));return b;};
const chunk=(tag,body=Buffer.alloc(0),version=0,count=0)=>Buffer.concat([Buffer.from(tag),words([body.length,version,count]),body]);
function entry(kind,baseId=0,leafId=0){
  const lengths={1:33,2:44,4:35,5:44,6:44,7:28,10:30,11:50,13:47},v=Array(lengths[kind]).fill(0);
  const prefix=[11,13].includes(kind)?[1,1,1,2,kind]:[kind===4?5:[1,2].includes(kind)?2:1,1,2,kind];v.splice(0,prefix.length,...prefix);
  const base=[11,13].includes(kind)?11:10;v[base]=4097;v[base+1]=baseId;
  const leaf={2:30,5:29,6:30,11:30,13:30}[kind];if(leaf!==undefined){v[leaf]=4096;v[leaf+1]=leafId;}
  return Buffer.concat([words([1,kind]),words(v)]);
}
const order=(groups=[[],[],[]],id=506)=>Buffer.concat([words([id]),chunk('ORDR',chunk('PRIM',Buffer.concat(groups.map(g=>Buffer.concat([words([1,g.length]),...g]))),2),0,1)]);
const save=records=>Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('ORDR',Buffer.concat(records),1,records.length),chunk('CONT',undefined,1)]);
function source(data){let active=0,peak=0;return {size:data.length,get peak(){return peak;},async readAt(at,n){
  assert.ok(n<=4096);peak=Math.max(peak,++active);await Promise.resolve();--active;return data.subarray(at,at+n);
}};}
async function inspect(input){const rows=[];for await(const row of checkpointActorOrderCallbacks(input,506))rows.push(row);return rows;}

test('callback script fields remain distinct from procedures, targets and names across all supported layouts',async()=>{
  const kinds=[1,2,4,5,6,7,10,11,13],commands=kinds.map(k=>entry(k,k===2?48:17,0));
  // A UNIT target equal to an agent ID must remain a separate field.
  commands[4].writeUInt32LE(17,8+25*4);
  const data=save([order([commands.slice(0,3),commands.slice(3,6),commands.slice(6)])]),input=source(data);
  const rows=await inspect(input),roles=rows.map(r=>[r.kind,r.role]);
  assert.deepEqual(roles,[[1,'base'],[2,'base'],[2,'missile'],[4,'base'],[5,'base'],[5,'marker'],
    [6,'base'],[6,'follow'],[7,'base'],[10,'base'],[11,'base'],[11,'marker'],[13,'base'],[13,'marker']]);
  const calls=[],plan=await checkpointOrderCallbackAgentPlan(source(data),506,id=>{calls.push(id);return id+1000;});
  assert.deepEqual(calls,[17,48]);assert.equal(plan.patches.length,9);assert.equal(plan.completeOrderMigration,false);
  for(const patch of plan.patches){
    assert.equal(data.readUInt32LE(patch.offset),patch.before);assert.equal(patch.after,patch.before+1000);
    assert.ok(rows.some(r=>r.scriptIdOffset===patch.offset));
    assert.equal(data.readUInt32LE(patch.offset-4),patch.role==='base'?4097:4096);
    assert.ok(Object.isFrozen(patch));
  }
  assert.ok(Object.isFrozen(plan)&&Object.isFrozen(plan.patches));assert.equal(input.peak,1);
  assert.equal(commands[4].readUInt32LE(8+25*4),17);
});
test('opaque callback name and reserved words are immutable copies and never become remapping sites',async()=>{
  const command=entry(11,17,0),base=11,leaf=30;
  for(const start of [base,leaf])for(let i=2;i<14;i++)command.writeUInt32LE(i===6?17:0xfedcba98,8+(start+i)*4);
  const data=save([order([[command],[],[]])]),rows=await inspect(source(data));
  assert.deepEqual(rows[0].reservedWords,Array(4).fill(0xfedcba98));
  assert.deepEqual(rows[0].nameWords,[17,...Array(7).fill(0xfedcba98)]);
  assert.ok(Object.isFrozen(rows[0])&&Object.isFrozen(rows[0].reservedWords)&&Object.isFrozen(rows[0].nameWords));
  const plan=await checkpointOrderCallbackAgentPlan(source(data),506,id=>id+1);
  assert.equal(plan.patches.length,1);assert.equal(plan.patches[0].offset,rows[0].scriptIdOffset);
  data.fill(0,rows[0].offset,rows[0].offset+56);assert.equal(rows[0].nameWords[0],17);
});
test('full traversal precedes binding calls when late data or identities are invalid',async()=>{
  let calls=0;const resolve=id=>{++calls;return id+1;};
  for(const records of [[order([[entry(5,17),words([1,16])],[],[]])],
    [order([[entry(5,17)],[],[]]),order()],
    [order([[entry(5,17),entry(6,0xffffffff)],[],[]])],
    [order([[entry(5,17),entry(6,0,17)],[],[]])],
    [order([[entry(5,17),entry(13,0,54)],[],[]])]]){
    await assert.rejects(checkpointOrderCallbackAgentPlan(source(save(records)),506,resolve));assert.equal(calls,0);
  }
});
test('unknown, invalid, and conflated destination agent bindings reject the entire plan',async()=>{
  const data=save([order([[entry(5,17),entry(6,48)],[],[]])]);
  for(const invalid of [undefined,null,0,-1,1.5,0x80000000,NaN,'1000'])
    await assert.rejects(checkpointOrderCallbackAgentPlan(source(data),506,()=>invalid),/Unresolved/);
  await assert.rejects(checkpointOrderCallbackAgentPlan(source(data),506,()=>1000),/Ambiguous/);
  await assert.rejects(checkpointOrderCallbackAgentPlan(source(data),506,null),/resolver required/);
  await assert.rejects(checkpointOrderCallbackAgentPlan(source(data),506,()=>{throw new Error('missing');}),/missing/);
});
test('site limits bound plans independently of native record limits and rejection invokes no resolver',async()=>{
  const commands=Array.from({length:MAX_ORDER_CALLBACK_AGENT_SITES},()=>entry(10,17));let calls=0;
  const plan=await checkpointOrderCallbackAgentPlan(source(save([order([commands,[],[]])])),506,async id=>{++calls;return id;});
  assert.equal(plan.patches.length,MAX_ORDER_CALLBACK_AGENT_SITES);assert.equal(calls,1);
  commands.push(entry(10,17));calls=0;
  await assert.rejects(checkpointOrderCallbackAgentPlan(source(save([order([commands,[],[]])])),506,id=>{++calls;return id;}),/budget/);
  assert.equal(calls,0);
});
test('zero script IDs, empty and absent banks do not consult the resolver',async()=>{
  for(const records of [[],[order()],[order([[entry(5),entry(6)],[],[]])]]){
    const result=await checkpointOrderCallbackAgentPlan(source(save(records)),506,()=>{throw Error('zero');});
    assert.deepEqual(result.patches,[]);assert.equal(result.completeOrderMigration,false);
  }
});
