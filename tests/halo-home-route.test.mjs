import test from 'node:test';
import assert from 'node:assert/strict';
import {planHaloHomeLeg,checkpointHaloHomeLeg} from '../web/world/halo-home-route.mjs';
import {planHaloActorHandoff} from '../web/world/halo-region-layout.mjs';
import {checkpointActorRecords,checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {fixture,world,source} from './fixtures/registered-hero-world.mjs';
const Q=2048,pose=(x=70,y=272)=>({x:x*Q,y:y*Q,z:84309});
test('negative local home goal routes through an original west crossing without teleporting',()=>{
  const before=pose(),route=planHaloHomeLeg(before,{x:-608,y:160},'1_0','0_0');
  assert.deepEqual(route.movementPoint,{x:32,y:272});assert.equal(route.nextRegion,'0_0');
  assert.deepEqual(route.globalGoal,{x:3296,y:96});assert.deepEqual(before,pose());
  assert.equal(planHaloActorHandoff(before,pose(65),'1_0'),null);
  const crossing=planHaloActorHandoff(before,pose(63),'1_0');assert.equal(crossing.destinationRegion,route.nextRegion);
  assert.equal(crossing.destinationPose.x,4031*Q);assert.equal(crossing.destinationPose.z,before.z);
});
test('a distant diagonal guild uses one cardinal leg then recomputes from the next region',()=>{
  const first=planHaloHomeLeg(pose(128),{x:8000,y:8000},'0_0','2_2');assert.equal(first.nextRegion,'1_0');
  assert.deepEqual(first.movementPoint,{x:4064,y:272});
  const second=planHaloHomeLeg(pose(128),{x:64,y:8000},'2_0','2_2');assert.equal(second.nextRegion,'2_1');
  assert.deepEqual(second.movementPoint,{x:128,y:4064});
});
test('northward return uses a valid physical point while retaining the signed global goal',()=>{
  const route=planHaloHomeLeg(pose(272,70),{x:160,y:-608},'0_1','0_0');assert.equal(route.direction,'north');
  assert.deepEqual(route.movementPoint,{x:272,y:32});assert.equal(route.nextRegion,'0_0');
});
test('stale regional poses, foreign goals and local-home requests refuse routing',()=>{
  assert.throws(()=>planHaloHomeLeg(pose(63),{x:-608,y:160},'1_0','0_0'),/regional owner/);
  assert.throws(()=>planHaloHomeLeg(pose(),{x:100,y:160},'1_0','0_0'),/registered home/);
  assert.throws(()=>planHaloHomeLeg(pose(),{x:Infinity,y:160},'1_0','0_0'),/signed/);
  assert.throws(()=>planHaloHomeLeg(pose(),{x:100,y:160},'0_0','0_0'),/local navigation/);
});
async function remote(opts={},mutate=()=>{}){
  const f=await fixture(),bytes=world(1,true,{registration:f.registration,continuation:'travel_to',destination:{x:-608,y:160},...opts});
  const actor=await checkpointActorRecords(source(bytes),602);
  [70*Q,272*Q,84309].forEach((n,i)=>bytes.writeInt32LE(n,actor.unit.offset+60+i*4));
  await mutate(bytes);
  return {bytes,options:{identity:f.identity,alias:{unitId:602,agentId:37},homeAlias:{kind:'proxy',unitId:0,agentId:45},region:'1_0'}};
}
test('checkpoint route resolves the registered pure guild, ignoring a local building with its numeric ID',async()=>{
  const {bytes,options}=await remote({localHomeUnitId:469}),copy=Buffer.from(bytes);
  const route=await checkpointHaloHomeLeg(source(bytes),options);
  assert.equal(route.nextRegion,'0_0');assert.equal(route.homeAlias.agentId,45);
  assert.deepEqual(route.movementPoint,{x:32,y:272});assert.deepEqual(route.globalGoal,{x:3296,y:96});
  assert.deepEqual(bytes,copy);assert.equal(route.taskPreserved,true);assert.equal(route.ownerPublished,false);
});
test('another live task does not trigger a guild route',async()=>{
  const {bytes,options}=await remote({taskName:'explore',continuation:'explore'});
  assert.equal(await checkpointHaloHomeLeg(source(bytes),options),null);
});
for(const [name,opts,error]of [
  ['a different guild target',{targetRef:17},/another guild/],
  ['a goal in another region',{destination:{x:100,y:160}},/registered home/],
  ['a native parent borrowed from this region',{parent:469},/outdoor/],
  ['an executing building continuation',{continuation:'use_building'},/continuation/],
  ['an impure guild proxy',{proxyBacklink:true},/backlink/],
])test(`checkpoint routing refuses ${name}`,async()=>{
  const {bytes,options}=await remote(opts);await assert.rejects(checkpointHaloHomeLeg(source(bytes),options),error);
});
test('an executing script context cannot prepare a stopped route',async()=>{
  const {bytes,options}=await remote({},async b=>{
    for await(const v of checkpointAgentValues(source(b),37))if(v.attribute.toLowerCase()==='activescript')b[v.stateOffset+16]=1;
  });
  await assert.rejects(checkpointHaloHomeLeg(source(bytes),options),/continuation/);
});
