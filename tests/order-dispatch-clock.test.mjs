import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointOrderDispatchClockPlan,MAX_ORDER_DISPATCH_CLOCK_SITES} from '../web/world/order-dispatch-clock.mjs';
const words=values=>{const b=Buffer.alloc(values.length*4);values.forEach((v,i)=>b.writeUInt32LE(v>>>0,i*4));return b;};
const chunk=(tag,body=Buffer.alloc(0),version=0,count=0)=>Buffer.concat([Buffer.from(tag),words([body.length,version,count]),body]);
function entry(kind,when,delta,info=0){
  const lengths={1:33,2:44,4:35,5:44,6:44,7:28,10:30,11:50,13:47},v=Array(lengths[kind]).fill(0x12345678);
  const prefix=[11,13].includes(kind)?[1,1,1,2,kind]:[kind===4?5:[1,2].includes(kind)?2:1,1,2,kind];v.splice(0,prefix.length,...prefix);
  const at=[11,13].includes(kind)?6:5;v[at]=when;v[at+1]=delta;v[at+2]=info;
  if(kind===4)v[34]=0;if(kind===7)v[27]=0;
  return Buffer.concat([words([1,kind]),words(v)]);
}
const order=(groups=[[],[],[]])=>Buffer.concat([words([506]),chunk('ORDR',chunk('PRIM',Buffer.concat(groups.map(g=>Buffer.concat([words([1,g.length]),...g]))),2),0,1)]);
const save=records=>Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('ORDR',Buffer.concat(records),1,records.length),chunk('CONT',undefined,1)]);
const source=data=>({size:data.length,async readAt(at,n){assert.ok(n<=4096);return data.subarray(at,at+n);}});
const opts={sourceClockMs:1000,destinationClockMs:9000};

test('all supported header layouts preserve common dispatch age without editing rate, flags or delay',async()=>{
  const kinds=[1,2,4,5,6,7,10,11,13],data=save([order([kinds.map(k=>entry(k,901,100)),[],[]])]);
  const plan=await checkpointOrderDispatchClockPlan(source(data),506,opts);
  assert.equal(plan.headers.length,9);assert.equal(plan.patches.length,9);assert.equal(plan.completeOrderMigration,false);
  for(const h of plan.headers){
    assert.equal(h.elapsed,99);assert.equal(h.after,8901);assert.equal(h.dispatchDue,false);
    assert.equal(data.readUInt32LE(h.offset),901);assert.equal(data.readUInt32LE(h.offset+4),100);assert.equal(h.rate,0x12345678);
    for(const advance of [0,1,50,0xffffffff])assert.equal(((opts.destinationClockMs+advance-h.after)>>>0),((opts.sourceClockMs+advance-h.when)>>>0));
    assert.ok(Object.isFrozen(h));
  }
  assert.ok(Object.isFrozen(plan)&&Object.isFrozen(plan.headers)&&Object.isFrozen(plan.patches));
  assert.equal(plan.patches.at(-1).offset,plan.headers.at(-1).offset);
});
test('zero timestamps and clock wrap retain their ordinary unsigned dispatch age',async()=>{
  const samples=[{when:0,src:100,dst:0,elapsed:100},{when:0xffffffff,src:0,dst:0xffffffff,elapsed:1},
    {when:10,src:0,dst:9000,elapsed:0xfffffff6}];
  for(const s of samples){
    const plan=await checkpointOrderDispatchClockPlan(source(save([order([[entry(6,s.when,s.elapsed)],[],[]])])),506,
      {sourceClockMs:s.src,destinationClockMs:s.dst});
    const h=plan.headers[0];assert.equal(h.elapsed,s.elapsed);assert.equal(h.dispatchDue,true);
    assert.equal((s.dst-h.after)>>>0,s.elapsed);
  }
});
test('paused dispatch and strict delay boundaries survive clock rebasing',async()=>{
  for(const [when,delta,info,due]of [[900,100,0,true],[901,100,0,false],[900,100,1,false],[1000,0,0,true],[1000,0xffffffff,0,false]]){
    const plan=await checkpointOrderDispatchClockPlan(source(save([order([[entry(10,when,delta,info)],[],[]])])),506,opts);
    const h=plan.headers[0];assert.equal(h.dispatchDue,due);assert.equal(h.dispatchSkipped,Boolean(info&1));
    assert.equal(h.delta,delta);assert.equal(h.info,info);
  }
});
test('unchanged clocks, absent and empty records produce no timestamp edits',async()=>{
  for(const records of [[],[order()],[order([[entry(6,0,50),entry(11,999,20)],[],[]])]]){
    const plan=await checkpointOrderDispatchClockPlan(source(save(records)),506,{sourceClockMs:1000,destinationClockMs:1000});
    assert.deepEqual(plan.patches,[]);
  }
});
test('invalid clocks, late malformed records and site overflow reject the whole plan',async()=>{
  const data=save([order([[entry(6,900,100)],[],[]])]);
  for(const bad of [undefined,-1,0x100000000,NaN,1.5,'1000']){
    await assert.rejects(checkpointOrderDispatchClockPlan(source(data),506,{sourceClockMs:bad,destinationClockMs:0}),/clock snapshots/);
    await assert.rejects(checkpointOrderDispatchClockPlan(source(data),506,{sourceClockMs:0,destinationClockMs:bad}),/clock snapshots/);
  }
  await assert.rejects(checkpointOrderDispatchClockPlan(source(save([order([[entry(6,900,100),words([1,16])],[],[]])])),506,opts),/kind: 16/);
  await assert.rejects(checkpointOrderDispatchClockPlan(source(save([order(),order()])),506,opts),/Duplicate/);
  const entries=Array.from({length:MAX_ORDER_DISPATCH_CLOCK_SITES},()=>entry(6,900,100));
  assert.equal((await checkpointOrderDispatchClockPlan(source(save([order([entries,[],[]])])),506,opts)).headers.length,128);
  entries.push(entry(6,900,100));await assert.rejects(checkpointOrderDispatchClockPlan(source(save([order([entries,[],[]])])),506,opts),/budget/);
});
