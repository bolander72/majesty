import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareCheckpointRegisteredHeroArrival} from '../web/world/arrival.mjs';
import {checkpointHeroOrderArrivalPlan} from '../web/world/hero-order-arrival.mjs';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {prepareRouteRegisteredHeroArrival} from '../web/world/registered-hero-arrival.mjs';
import {checkpointActorRecords,checkpointAttachments} from '../web/world/checkpoint.mjs';
import {fixture,world,source,hash} from './fixtures/registered-hero-world.mjs';
const words=ns=>{const b=Buffer.alloc(ns.length*4);ns.forEach((n,i)=>b.writeUInt32LE(n>>>0,i*4));return b;};
const chunk=(tag,body,version=0,count=0)=>Buffer.concat([Buffer.from(tag),words([body.length,version,count]),body]);
function orders({guild=469,procedure=0x1003,script=0}={}){
  const body=Array(28).fill(0);body.splice(0,4,1,1,2,7);body[5]=9000;body[9]=guild;body[10]=procedure;body[11]=script;body[25]=1;body[27]=1;
  const entry=Buffer.concat([words([1,7]),words(body),words([3401,263])]);
  return Buffer.concat([words([602]),chunk('ORDR',chunk('PRIM',Buffer.concat([words([1,0,1,1]),entry,words([1,0])]),2),0,1)]);
}
async function remoteInput(options={}){
  const f=await fixture(),queue=orders(options);
  const saved=world(1,true,{registration:f.registration,uid:602,gid:37,orders:queue,continuation:'travel_to'});
  return {...f,saved,queue};
}
async function prepare(f,returnHome=false){
  const destination=returnHome?world(0,false,{savedClock:10000}):world(1,false,{registration:f.registration,savedClock:10000});
  const context={identity:f.identity,aliases:[{unitId:602,agentId:37},{unitId:100000,agentId:1000}],
    homeAliases:[{kind:'proxy',unitId:0,agentId:45},returnHome?f.homeAliases[0]:f.homeAliases[1]],
    referenceBindings:[],ownerSide:0,regions:['1_0',returnHome?'0_0':'2_0']};
  const result=await prepareCheckpointRegisteredHeroArrival(source(f.saved),source(destination),
    {unitId:602,freshUnitId:100000,freshAgentId:1000,sourceClockMs:9000,destinationClockMs:10000,unitBindings:[]},context);
  return {result,destination,context};
}
test('a second remote hop preserves the original guild completion and consumed Queue waypoint',async()=>{
  const f=await remoteInput(),before=Buffer.from(f.saved),{result:r}=await prepare(f);
  const expected=Buffer.from(f.queue);expected.writeUInt32LE(100000,0);expected.writeUInt32LE(10000,80);
  assert.deepEqual(Buffer.from(r.records.order),expected);assert.deepEqual(f.saved,before);
  assert.equal(r.plan.registeredHome.source.kind,'proxy');assert.equal(r.plan.registeredHome.destination.kind,'proxy');
  assert.equal(r.plan.registeredHome.registeredNativeHomeUnitId,469);
  assert.deepEqual(r.plan.heroOrders.deferredNativeHomeReferences.map(x=>[x.before,x.homeRegion,x.guildEntityId]),[[469,'0_0',f.registration.guildEntityId]]);
  assert.deepEqual(r.plan.orderBanks.map(b=>b.count),[0,1,0]);assert.equal(r.plan.heroOrders.waypointCount,1);
  assert.equal(r.plan.registeredHome.heroCrossingQualified,false);assert.equal(r.plan.nativeActivationQualified,false);
});
test('returning from a proxy region resolves the same completion to the actual registered guild',async()=>{
  const f=await remoteInput(),{result:r}=await prepare(f,true);
  assert.deepEqual(r.plan.heroOrders.deferredNativeHomeReferences,[]);
  assert.deepEqual(r.plan.heroOrders.patches.filter(p=>p.procedureId).map(p=>[p.before,p.after]),[[469,469]]);
  assert.equal(r.plan.registeredHome.destination.kind,'native');assert.equal(r.plan.registeredHome.destination.unitId,469);
  assert.equal(r.plan.registeredHome.destinationNativeMembershipRequired,true);
  assert.equal(r.plan.containerTransforms.length,1);assert.deepEqual(r.plan.containerTransforms[0].insertWords,[469,1]);
});
test('remote Queue references require the registered native ID, never a proxy or a convenient local guild',async()=>{
  const f=await remoteInput();const home={source:{kind:'proxy',unitId:0},destination:{kind:'proxy',unitId:0},
    guildEntityId:f.registration.guildEntityId,homeRegion:'0_0'};
  const plan=h=>checkpointHeroOrderArrivalPlan(source(f.saved),602,{sourceClockMs:9000,destinationClockMs:10000},h,()=>{throw Error('unbound');});
  for(const registeredNativeHomeUnitId of [undefined,0,-1,1.5,0x100000000,45,778])
    await assert.rejects(plan({...home,registeredNativeHomeUnitId}),/user-data reference/);
  await assert.rejects(plan({...home,source:{kind:'proxy',unitId:469},registeredNativeHomeUnitId:469}),/user-data reference/);
});
test('home-aware repeated preparation rejects wrong native references, callbacks and forged registrations',async()=>{
  for(const options of [{guild:778},{guild:45},{procedure:0},{procedure:0x1004},{script:37}])
    await assert.rejects(prepare(await remoteInput(options)),/user-data reference|callback/);
  const f=await remoteInput();f.identity=structuredClone(f.identity);f.identity.registeredHome.home.unitId=778;
  await assert.rejects(prepare(f),/proxy|identity|registered/i);
});
test('journal-selected repeated travel uses the same immutable home without publishing during preparation',async()=>{
  const f=await remoteInput(),store=new HeroRouteStore(f.io,f.identity,f.identity.contentDigest);
  const native=f.homeAliases[0],proxy=f.homeAliases[1];
  let selected=await store.commit({kind:'seed',operationId:'1'.repeat(64),expectedManifest:null,regions:['0_0'],
    aliases:[f.aliases[0]],homeAliases:[native],worlds:[{source:source(f.worlds[0]),sha256:hash(f.worlds[0])}]});
  selected=await store.commit({kind:'handoff',operationId:'2'.repeat(64),expectedManifest:selected.manifest,regions:['0_0','1_0'],
    aliases:f.aliases,homeAliases:[native,proxy],worlds:[world(0,false),f.saved].map(b=>({source:source(b),sha256:hash(b)}))});
  const candidate=world(1,false,{registration:f.registration,savedClock:10000}),writes=f.writes.length;
  const prepared=await prepareRouteRegisteredHeroArrival(store,'2_0',{source:source(candidate),sha256:hash(candidate),
    alias:{unitId:100000,agentId:1000},homeAlias:proxy},{expectedManifest:selected.manifest,freshUnitId:100000,freshAgentId:1000});
  assert.deepEqual(prepared.regions,['1_0','2_0']);assert.equal(prepared.plan.heroOrders.deferredNativeHomeReferences[0].before,469);
  assert.equal(prepared.selectedOwner.entityId,f.identity.entityId);assert.equal(f.writes.length,writes);
  assert.equal((await store.read()).owner.region,'1_0');
  const incoming=world(1,true,{registration:f.registration,uid:100000,gid:1000,savedClock:10000,
    orders:Buffer.from(prepared.records.order),continuation:'travel_to'}),incomingSource=source(incoming);
  const actor=await checkpointActorRecords(incomingSource,100000),ranges={unit:actor.unit,agent:actor.agent};
  for await(const a of checkpointAttachments(incomingSource))if(a.unitId===100000)ranges[a.kind==='ORDR'?'order':'container']=a;
  for(const[name,bytes]of Object.entries(prepared.records)){
    const range=ranges[name];assert.ok(range);assert.deepEqual(Buffer.from(bytes),incoming.subarray(range.offset,range.offset+range.size));
  }
  selected=await store.commit({kind:'handoff',operationId:'3'.repeat(64),expectedManifest:selected.manifest,regions:['1_0','2_0'],
    aliases:[{unitId:602,agentId:37},{unitId:100000,agentId:1000}],homeAliases:[proxy,proxy],
    worlds:[world(1,false,{registration:f.registration}),incoming].map(b=>({source:source(b),sha256:hash(b)}))});
  assert.equal((await store.read()).owner.region,'2_0');const writesAfterHop=f.writes.length;
  const returned=await prepareRouteRegisteredHeroArrival(store,'0_0',null,{expectedManifest:selected.manifest,freshUnitId:100002,freshAgentId:1002});
  assert.equal(returned.plan.registeredHome.destinationNativeMembershipRequired,true);assert.deepEqual(returned.plan.heroOrders.deferredNativeHomeReferences,[]);
  assert.equal(f.writes.length,writesAfterHop);assert.equal((await store.read()).owner.region,'2_0');
});
