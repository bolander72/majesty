import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSelectedActorFamilyClocks} from '../web/world/actor-family-clocks.mjs';
import {checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {fixture,world,source} from './fixtures/registered-hero-world.mjs';
async function seeded({src=3200,dst=9000,state=[500,3000,2,0],running=0,parent=0}={}){
  const f=await fixture(),data=world(0,true,{savedClock:src,parent,physicalGroups:parent?[{kind:2,owner:469,members:[502]}]:[]});
  for await(const v of checkpointAgentValues(source(data),27))if(v.type===8){state.forEach((n,i)=>data.writeUInt32LE(n>>>0,v.stateOffset+i*4));data[v.stateOffset+16]=running;}
  const s=f.store(),r=await s.commit(f.request([data,world(1,false,{registration:f.registration,savedClock:dst})]));
  return {f,s,r,data};
}
test('all clock bases come from the leased selected worlds and eligibility stays at the same time',async()=>{
  const {f,s,r,data}=await seeded(),original=Buffer.from(data),writes=f.writes.length;
  const p=await prepareSelectedActorFamilyClocks(s,{expectedManifest:r.manifest}),c=p.contexts[0];
  assert.deepEqual([p.sourceClockMs,p.destinationClockMs,c.elapsed,c.after],[3200,9000,200,8800]);
  for(const advance of [0,299,300,301,1000,0x7fffffff]){
    const before=((p.sourceClockMs+advance-c.state[1])>>>0)>=c.state[0];
    const after=((p.destinationClockMs+advance-c.after)>>>0)>=c.state[0];assert.equal(before,after);
  }
  const record=p.records[0],expected=Buffer.from(original.subarray(record.range.offset,record.range.offset+record.range.size));
  expected.writeUInt32LE(8800,p.patches[0].relativeOffset);assert.deepEqual(Buffer.from(record.bytes),expected);
  assert.deepEqual(data,original);assert.equal(f.writes.length,writes);assert.equal((await s.read()).record.manifest,r.manifest);
  assert.equal(p.nativeActivationQualified,false);assert.equal(p.completeOrderMigration,false);
});
test('captured request cannot be changed while its selected lease is pending',async()=>{
  const {s,r}=await seeded(),request={expectedManifest:r.manifest},pending=prepareSelectedActorFamilyClocks(s,request);
  request.expectedManifest='stale';assert.equal((await pending).ownerManifest,r.manifest);
});
test('zero-valued inactive and paused contexts remain byte identical',async()=>{
  for(const state of [[0,0,0,0],[500,3000,130,375]]){
    const {s,r}=await seeded({state}),p=await prepareSelectedActorFamilyClocks(s,{expectedManifest:r.manifest});
    assert.deepEqual(p.patches,[]);assert.equal(p.records[0].sourceSha256,p.records[0].sha256);assert.deepEqual(p.contexts[0].state,state);
  }
});
test('unsigned wrap keeps active script age',async()=>{
  const {s,r}=await seeded({src:20,dst:200,state:[500,0xfffffff0,2,0]}),p=await prepareSelectedActorFamilyClocks(s,{expectedManifest:r.manifest});
  assert.equal(p.contexts[0].elapsed,36);assert.equal(p.contexts[0].after,164);
});
for(const[name,options,pattern]of [
  ['executing context',{running:1},/Executing/],['zero scheduler sentinel',{state:[500,0,2,0]},/zero sentinel/],
  ['future script stamp',{state:[500,3201,2,0]},/Ambiguous/],['unsupported flags',{state:[500,3000,4,0]},/flags/],
  ['projection onto zero sentinel',{dst:200},/zero sentinel/],['physical building residence',{parent:469},/outdoor hero/],
])test(`whole family plan refuses ${name} without writing selected state`,async()=>{
  const {f,s,r}=await seeded(options),writes=f.writes.length;
  await assert.rejects(prepareSelectedActorFamilyClocks(s,{expectedManifest:r.manifest}),pattern);
  assert.equal(f.writes.length,writes);assert.equal((await s.read()).record.manifest,r.manifest);
});
test('stale owner and caller-supplied clock overrides cannot produce a capsule',async()=>{
  const {s,r}=await seeded();await assert.rejects(prepareSelectedActorFamilyClocks(s,{expectedManifest:'stale'}),/revision changed/);
  assert.throws(()=>prepareSelectedActorFamilyClocks(s,{expectedManifest:r.manifest,sourceClockMs:1}),/request/);
  assert.throws(()=>prepareSelectedActorFamilyClocks({},{}),/registered selected owner/);
});
