import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointHaloCompanionOrderPlan,checkpointHaloAttachedOrderProfile} from '../web/world/halo-companion-orders.mjs';
const words=v=>{const b=Buffer.alloc(v.length*4);v.forEach((n,i)=>b.writeUInt32LE(n>>>0,i*4));return b;};
const chunk=(tag,body=Buffer.alloc(0),version=0,count=0)=>Buffer.concat([Buffer.from(tag),words([body.length,version,count]),body]);
// Original selected1500 ARB2 snapshot: inherited animation plus retirement
// marker. Rate100 and stamp1500 differ, exposing a one-word header error.
const extended=[1,1,1,2,13,100,1500,100,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,80,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,73,0];
const marker=[1,1,2,5,100,1500,100,0,0,0,4101,0,0,0,0,0,0,0,0,0,0,0,0,0,336,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
function save(commands=[{kind:13,data:extended},{kind:5,data:marker}]){
 const banks=Buffer.concat([words([1,0,1,commands.length]),...commands.map(c=>Buffer.concat([words([1,c.kind]),words(c.data)])),words([1,0])]);
 const attachment=Buffer.concat([words([516]),chunk('ORDR',chunk('PRIM',banks,2),0,1)]);
 return Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('ORDR',attachment,1,1),chunk('CONT',undefined,1)]);
}
const source=b=>({size:b.length,async readAt(at,n){assert.ok(n<=4096);return b.subarray(at,at+n);}});
const clocks={sourceClockMs:1500,destinationClockMs:60650};
const plan=(bytes=save(),c=clocks)=>checkpointHaloCompanionOrderPlan(source(bytes),516,'arb2-extended-marker',c);
test('actual extended-animation shape preserves both command ages and opaque parameters with bounded requests',async()=>{
 const bytes=save(),original=Buffer.from(bytes),p=await plan(bytes);
 assert.deepEqual(p.dispatch.headers.map(h=>[h.kind,h.rate,h.when,h.delta,h.after,h.elapsed]),[[13,100,1500,100,60650,0],[5,100,1500,100,60650,0]]);
 assert.equal(p.patches.length,2);assert.equal(p.allocationRequestBytes,316);
 const projected=Buffer.from(bytes);for(const e of p.patches){assert.equal(projected.readUInt32LE(e.offset),e.before);projected.writeUInt32LE(e.after,e.offset);}
 for(let i=0;i<bytes.length;++i)if(!p.patches.some(e=>i>=e.offset&&i<e.offset+4))assert.equal(projected[i],bytes[i]);
 assert.equal(p.entries[0].words[45],73);assert.equal(p.entries[0].words[46],0);
 assert.equal(p.nativeActivationQualified,false);assert.equal(p.originalProjectedLifetimeQualified,false);assert.deepEqual(bytes,original);
});
test('wrap and post-dispatch boundary keep the original unsigned age without changing command parameters',async()=>{
 const e=[...extended],m=[...marker];e[6]=m[5]=0xfffffff0;
 const p=await plan(save([{kind:13,data:e},{kind:5,data:m}]),{sourceClockMs:20,destinationClockMs:0});
 assert.deepEqual(p.dispatch.headers.map(h=>[h.elapsed,h.after]),[[36,0xffffffdc],[36,0xffffffdc]]);
});
test('changed callback, timer, opaque parameters, names and due commands refuse the whole companion',async()=>{
 for(const [command,at,value]of [[0,5,101],[0,7,101],[0,8,1],[0,12,54],[0,30,4101],[0,31,54],[0,36,256],
  [0,45,74],[0,46,510],[1,10,4109],[1,11,54],[1,24,335],[1,29,4101],[1,35,256],[0,6,1400],[1,5,1400]]){
  const e=[...extended],m=[...marker];[e,m][command][at]=value;
  await assert.rejects(plan(save([{kind:13,data:e},{kind:5,data:m}])),/Unqualified|post-dispatch/);
 }
 await assert.rejects(plan(save([{kind:5,data:marker},{kind:13,data:extended}])),/command/);
 await assert.rejects(plan(save([{kind:13,data:extended}])),/banks/);
 await assert.rejects(plan(save([{kind:13,data:extended},{kind:5,data:marker},{kind:5,data:marker}])),/banks/);
});
test('selected crossing reward variant preserves1000 and dispatch age without treating it as an identity',async()=>{
 const e=[...extended],m=[...marker];e[6]=m[5]=84550;e[45]=1000;
 const bytes=save([{kind:13,data:e},{kind:5,data:m}]),original=Buffer.from(bytes);
 const unit={family:'VHCL',unitId:516,agentId:0,playerNumber:0,stateFlags:2592,size:165,description:0x32425241};
 assert.equal(await checkpointHaloAttachedOrderProfile(source(bytes),unit),'arb2-reward-1000');
 const p=await checkpointHaloCompanionOrderPlan(source(bytes),516,'arb2-reward-1000',{sourceClockMs:84550,destinationClockMs:0});
 assert.deepEqual(p.dispatch.headers.map(h=>[h.elapsed,h.after]),[[0,0],[0,0]]);assert.equal(p.entries[0].words[45],1000);
 const projected=Buffer.from(bytes);for(const patch of p.patches)projected.writeUInt32LE(patch.after,patch.offset);
 for(let i=0;i<bytes.length;i++)if(!p.patches.some(v=>i>=v.offset&&i<v.offset+4))assert.equal(projected[i],bytes[i]);
 assert.deepEqual(bytes,original);assert.equal(p.nativeActivationQualified,false);
 for(const value of [73,999,1001,496]){
  const altered=[...e];altered[45]=value;const b=save([{kind:13,data:altered},{kind:5,data:m}]);
  await assert.rejects(checkpointHaloCompanionOrderPlan(source(b),516,'arb2-reward-1000',{sourceClockMs:84550,destinationClockMs:0}),/Unqualified/);
 }
});
test('three-second ARG3 timer retains the remaining lifetime and refuses callback or type changes',async()=>{
 const wait=[1,1,2,9,3000,84500,3000,0,0,0,4109,0,0,0,0,0,0,0,0,0,0,0,0,0];
 const b=save([{kind:9,data:wait}]),unit={family:'VHCL',unitId:516,agentId:0,playerNumber:0,stateFlags:544,size:151,description:0x33475241};
 assert.equal(await checkpointHaloAttachedOrderProfile(source(b),unit),'wait-arg3');
 const p=await checkpointHaloCompanionOrderPlan(source(b),516,'wait-arg3',{sourceClockMs:84550,destinationClockMs:1000});
 assert.deepEqual(p.dispatch.headers.map(h=>[h.elapsed,h.after,h.delta]),[[50,950,3000]]);
 for(const [at,value]of [[4,1000],[6,1000],[10,4101],[11,22],[5,81550]]){
  const bad=[...wait];bad[at]=value;
  await assert.rejects(checkpointHaloCompanionOrderPlan(source(save([{kind:9,data:bad}])),516,'wait-arg3',{sourceClockMs:84550,destinationClockMs:1000}),/Unqualified|post-dispatch/);
 }
 for(const change of [{agentId:22},{size:150},{stateFlags:2592},{description:0x35475241},{playerNumber:1}])
  assert.equal(await checkpointHaloAttachedOrderProfile(source(b),{...unit,...change}),null);
});
