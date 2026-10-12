import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointHeroOrderArrivalPlan,MAX_HERO_ARRIVAL_ORDER_ENTRIES} from '../web/world/hero-order-arrival.mjs';
import {prepareCheckpointRegisteredHeroArrival} from '../web/world/arrival.mjs';
import {checkpointActorOrderRestoreBounds} from '../web/world/order-restore-bounds.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointActorOrderEntries as familyEntries} from '../web/world/family-order-entries.mjs';
import {fixture,world,source} from './fixtures/registered-hero-world.mjs';
const w=ns=>{const b=Buffer.alloc(ns.length*4);ns.forEach((n,i)=>b.writeUInt32LE(n>>>0,i*4));return b;};
const chunk=(tag,b=Buffer.alloc(0),v=0,count=0)=>Buffer.concat([Buffer.from(tag),w([b.length,v,count]),b]);
function entry(kind,{data=0,proc=0,script=0,target=0,cursor=0,count=0,capacity=10,when=3200,points=[],name=0}={}){
  const a=Array(kind===4?35:kind===7?28:24).fill(0);a.splice(0,4,kind===4?5:1,1,2,kind);
  a[5]=when;a[9]=data;a[10]=proc;a[11]=script;a[16]=name;
  if(kind===4){a[25]=target;a[26]=3401;a[27]=263;a[30]=cursor;a[32]=capacity;a[34]=count;}
  if(kind===7){a[25]=cursor;a[27]=count;}
  return Buffer.concat([w([1,kind]),w(a),w(points)]);
}
const order=(groups=[[],[],[]])=>Buffer.concat([w([502]),chunk('ORDR',chunk('PRIM',Buffer.concat(
  groups.map(es=>Buffer.concat([w([1,es.length]),...es]))),2),0,1)]);
const save=groups=>Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('ORDR',order(groups),1,1),chunk('CONT',undefined,1)]);
const clocks={sourceClockMs:3200,destinationClockMs:9000};
const home={source:{kind:'native',unitId:469},destination:{kind:'proxy',unitId:0},guildEntityId:'g'.repeat(64),homeRegion:'0_0'};
const plan=(groups,h=home,resolver=()=>{throw Error('unresolved test target');})=>checkpointHeroOrderArrivalPlan(source(save(groups)),502,clocks,h,resolver);

test('populated registered arrival preserves every byte except independently expected IDs, clocks and home roster',async()=>{
  const f=await fixture(),orders=order([[entry(4)],[entry(7,{data:469,proc:0x1003,cursor:1,count:1,points:[3401,263]})],[]]);
  const before=world(0,true,{orders}),destination=f.worlds[1],originals=[Buffer.from(before),Buffer.from(destination)];
  const {records,plan:p}=await prepareCheckpointRegisteredHeroArrival(source(before),source(destination),
    {unitId:502,freshUnitId:100000,freshAgentId:1000,unitBindings:[],...clocks},
    {identity:f.identity,aliases:f.aliases,homeAliases:f.homeAliases,referenceBindings:[],ownerSide:0});
  // Expected command offsets are fixture construction offsets, not planner edits.
  const expected=Buffer.from(orders);expected.writeUInt32LE(100000,0);
  expected.writeUInt32LE(9000,72);expected.writeUInt32LE(9000,228);
  assert.deepEqual(Buffer.from(records.order),expected);assert.equal(expected.readUInt32LE(244),469);
  assert.deepEqual(p.orderBanks.map(b=>b.count),[1,1,0]);assert.equal(p.heroOrders.waypointCount,1);
  assert.equal(p.heroOrders.deferredNativeHomeReferences.length,1);assert.equal(p.nativeActivationQualified,false);
  assert.ok(p.requirements.includes('intercept procedure1003 before original native home lookup'));
  assert.deepEqual([before,destination],originals);
});
test('typed path targets are rebound, but opaque nonmatching user data is never treated as an ID',async()=>{
  const p=await plan([[entry(4,{target:700})],[],[]],home,id=>{assert.equal(id,700);return 900;});
  assert.deepEqual(p.patches.filter(x=>x.field==='_targetID').map(x=>[x.before,x.after]),[[700,900]]);
  await assert.rejects(plan([[entry(4,{data:469})],[],[]]),/user-data reference/);
  await assert.rejects(plan([[],[entry(7,{data:470,proc:0x1003})],[]]),/user-data reference/);
  await assert.rejects(plan([[],[entry(7,{data:469})],[]]),/user-data reference/);
});
test('an actual native home receives a remapped completion reference, never a deferred one',async()=>{
  const p=await plan([[],[entry(7,{data:469,proc:0x1003})],[]],{...home,destination:{kind:'native',unitId:800}});
  assert.deepEqual(p.deferredNativeHomeReferences,[]);
  assert.deepEqual(p.patches.filter(x=>x.procedureId).map(x=>[x.before,x.after]),[[469,800]]);
});
test('unknown callbacks, positive script callbacks, names and unresolved targets refuse the whole capsule',async()=>{
  for(const o of [{proc:0x1010},{script:27},{name:1}])await assert.rejects(plan([[entry(4,o)],[],[]]),/callback/);
  await assert.rejects(plan([[entry(4,{target:700})],[],[]]),/unresolved test target/);
  await assert.rejects(plan([[],[entry(7,{data:469,proc:0x1003})],[]],null),/user-data reference/);
});
test('paths remain byte-for-byte source data and metadata does not retain a second waypoint catalogue',async()=>{
  const points=Array.from({length:8192},(_,i)=>i),data=save([[entry(4,{count:4096,capacity:4096,cursor:4096,points})],[],[]]),before=Buffer.from(data);
  const p=await checkpointHeroOrderArrivalPlan(source(data),502,clocks,home,()=>0);
  assert.equal(p.waypointCount,4096);assert.equal(p.navigation.length,2);
  assert.equal(p.coordinatePolicy,'preserve-source-until-destination-navigation-reconciliation');
  assert.deepEqual(data,before);
  for(const options of [{cursor:-1},{count:1,capacity:0,points:[0,0]}])
    await assert.rejects(plan([[entry(4,options)],[],[]]),/cursor|capacity/);
});
test('entry budget and a late unknown command prevent partial preparation',async()=>{
  const es=Array.from({length:MAX_HERO_ARRIVAL_ORDER_ENTRIES},()=>entry(7));
  assert.equal((await plan([es,[],[]])).entries.length,128);
  es.push(entry(7));await assert.rejects(plan([es,[],[]]),/populated hero/);
  await assert.rejects(plan([[entry(4),entry(9)],[],[]]),/populated hero/);
});
test('Wait9 shares one parser and requests exactly its pinned original object storage',async()=>{
  assert.equal(familyEntries,checkpointActorOrderEntries);
  const p=await checkpointActorOrderRestoreBounds(source(save([[],[entry(9)],[]])),502);
  assert.equal(p.entries[0].objectBytes,52);assert.equal(p.allocationRequestBytes,161);
});
test('a cached waypoint changing between planning and copying invalidates populated arrival',async()=>{
  const f=await fixture(),orders=order([[entry(4)],[entry(7,{data:469,proc:0x1003,cursor:1,count:1,points:[3401,263]})],[]]);
  const before=world(0,true,{orders}),normal=source(before),offset=before.indexOf(orders);assert.ok(offset>0);
  let completeReads=0;
  const changing={size:before.length,async readAt(at,n){
    const b=await normal.readAt(at,n);
    if(at===offset&&n===orders.length&&++completeReads>=2)b[320]^=1;
    return b;
  }};
  await assert.rejects(prepareCheckpointRegisteredHeroArrival(changing,source(f.worlds[1]),
    {unitId:502,freshUnitId:100000,freshAgentId:1000,unitBindings:[],...clocks},
    {identity:f.identity,aliases:f.aliases,homeAliases:f.homeAliases,referenceBindings:[],ownerSide:0}),/record changed after planning/);
});
