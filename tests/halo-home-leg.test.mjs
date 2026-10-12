import test from 'node:test';
import assert from 'node:assert/strict';
import {planHaloHomeLeg,readSelectedHaloHomeLeg} from '../web/world/halo-home-leg.mjs';
import {planHaloActorHandoff} from '../web/world/halo-region-layout.mjs';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {checkpointPlacements} from '../web/world/checkpoint.mjs';
import {fixture,world,source,hash} from './fixtures/registered-hero-world.mjs';
const Q=2048,native={kind:'native',unitId:469,agentId:7},proxy={kind:'proxy',unitId:0,agentId:45};
const pose={x:135015,y:258194,z:116930};
const op=n=>n.toString(16).padStart(64,'0');
const word=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
const chunk=(tag,b,v=0,c=0)=>Buffer.concat([Buffer.from(tag),word(b.length),word(v),word(c),b]);
function existingOrders(){
  const path=Buffer.alloc(140);[5,1,2,4].forEach((n,i)=>path.writeUInt32LE(n,i*4));
  const payload=Buffer.concat([word(1),word(1),word(1),word(4),path,word(1),word(0),word(1),word(0)]);
  return Buffer.concat([word(602),chunk('ORDR',chunk('PRIM',payload,2),0,1)]);
}

for(const[key,direction,next]of [['1_0','west','0_0'],['-1_0','east','0_0'],['0_1','north','0_0'],['0_-1','south','0_0']])
  test(`home leg ${direction} crosses a core edge with valid source and destination margins`,()=>{
    const plan=planHaloHomeLeg(pose,key,'0_0');assert.equal(plan.direction,direction);assert.equal(plan.destinationRegion,next);
    assert.equal(plan.remainingRegionHops,1);
    const proposed={...plan.localGoal,z:pose.z},handoff=planHaloActorHandoff(pose,proposed,key);
    assert.equal(handoff.destinationRegion,next);
    for(const p of [handoff.sourceGrid,handoff.destinationGrid])assert.ok([p.x,p.y].every(n=>n>=2&&n<254));
    assert.equal(plan.requiresAcceptedCrossingBeforeHandoff,true);assert.equal(plan.ownerPublished,false);
  });
test('a far home yields one cardinal leg rather than a retained multi-region route',()=>{
  const plan=planHaloHomeLeg(pose,'1000000_-1000000','-1000000_1000000');
  assert.equal(plan.destinationRegion,'999999_-1000000');assert.equal(plan.remainingRegionHops,4000000);
  assert.ok(JSON.stringify(plan).length<1024);assert.equal(plan.localGoal.y,pose.y);
  assert.equal(plan.sourcePose.z,pose.z);assert.equal(plan.requiresOriginalTerrainSample,true);
});
test('local home delegates to the original building-use continuation',()=>{
  assert.equal(planHaloHomeLeg(pose,'0_0','0_0'),null);
});
test('a pose outside its selected core cannot be converted into a home leg',()=>{
  for(const p of [{...pose,x:64*Q-1},{...pose,y:4032*Q},{...pose,x:NaN},{...pose,z:0x80000000}])
    assert.throws(()=>planHaloHomeLeg(p,'1_0','0_0'),/selected halo core/);
  assert.throws(()=>planHaloHomeLeg(pose,'01_0','0_0'));
});

async function remote({taskName='go_home',continuation='use_building',targetRef=45,orders=Buffer.alloc(0)}={}){
  const f=await fixture(),store=new HeroRouteStore(f.io,f.identity,f.identity.contentDigest);
  const head=await store.commit({kind:'seed',operationId:op(1),expectedManifest:null,regions:['0_0'],
    aliases:[{unitId:502,agentId:27}],homeAliases:[native],worlds:[{source:source(f.worlds[0]),sha256:hash(f.worlds[0])}]});
  const incoming=world(1,true,{registration:f.registration,taskName,continuation,targetRef,orders});
  for await(const u of checkpointPlacements(source(incoming)))if(u.unitId===602)
    [pose.x,pose.y,pose.z].forEach((n,i)=>incoming.writeInt32LE(n,u.offset+60+i*4));
  const outgoing=world(0,false,{registration:f.registration});
  const selected=await store.commit({kind:'handoff',operationId:op(2),expectedManifest:head.manifest,regions:['0_0','1_0'],
    aliases:[{unitId:502,agentId:27},{unitId:602,agentId:37}],homeAliases:[native,proxy],
    worlds:[outgoing,incoming].map(b=>({source:source(b),sha256:hash(b)}))});
  return {...f,store,selected,incoming};
}
test('selected route preserves real guild identity and fractional pose, opens only the owner, and writes nothing',async()=>{
  const f=await remote(),opened=[],original=f.io.open,before=f.writes.length;
  f.io.open=async n=>{opened.push(n);return original(n);};
  const plan=await readSelectedHaloHomeLeg(f.store,{expectedManifest:f.selected.manifest});
  assert.equal(plan.destinationRegion,'0_0');assert.equal(plan.nativeHome.unitId,469);assert.equal(plan.nativeHome.agentId,7);
  assert.equal(plan.guildEntityId,f.registration.guildEntityId);assert.equal(plan.owner.unitId,602);assert.equal(plan.proxy.agentId,45);
  assert.deepEqual(plan.sourcePose,pose);assert.deepEqual(plan.localGoal,{x:48*Q,y:pose.y});
  assert.equal(plan.sourceClockMs,9000);assert.equal(plan.sourceWorld.sha256,hash(f.incoming));
  assert.equal(plan.nativeMovementQualified,false);assert.equal(f.writes.length,before);
  assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_1_0_0.GMP']);
});
test('stale revision and a request for a different action never arm a home leg',async()=>{
  const f=await remote(),before=f.writes.length;
  await assert.rejects(readSelectedHaloHomeLeg(f.store,{expectedManifest:'stale'}),/revision changed/);
  const exploring=await remote({taskName:'explore',targetRef:17});
  assert.equal(await readSelectedHaloHomeLeg(exploring.store,{expectedManifest:exploring.selected.manifest}),null);
  const travel=await remote({continuation:'travel_to'});
  await assert.rejects(readSelectedHaloHomeLeg(travel.store,{expectedManifest:travel.selected.manifest}),/held original/);
  const other=await remote({targetRef:17});
  await assert.rejects(readSelectedHaloHomeLeg(other.store,{expectedManifest:other.selected.manifest}),/another script/);
  assert.equal(f.writes.length,before);
});
test('request options are captured before asynchronous checkpoint access',async()=>{
  const f=await remote(),options={expectedManifest:f.selected.manifest};
  const pending=readSelectedHaloHomeLeg(f.store,options);options.expectedManifest='changed';
  assert.equal((await pending).ownerManifest,f.selected.manifest);
  await assert.rejects(async()=>readSelectedHaloHomeLeg(f.store,{expectedManifest:f.selected.manifest,extra:1}),/Invalid selected/);
});
test('home routing cannot clear or replace an existing native movement bank',async()=>{
  const f=await remote({orders:existingOrders()}),before=f.writes.length;
  await assert.rejects(readSelectedHaloHomeLeg(f.store,{expectedManifest:f.selected.manifest}),/replace existing native orders/);
  assert.equal(f.writes.length,before);
  assert.equal((await f.store.read()).record.manifest,f.selected.manifest);
});
