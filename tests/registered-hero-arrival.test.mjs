import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,world,source} from './fixtures/registered-hero-world.mjs';
import {prepareSelectedRegisteredHeroArrival} from '../web/world/registered-hero-arrival.mjs';
import {checkpointRegisteredHeroArrivalPlan,prepareCheckpointRegisteredHeroArrival} from '../web/world/arrival.mjs';
import {checkpointActorRecords,checkpointAttachments,checkpointAgentRecordValues} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const options={freshUnitId:100000,freshAgentId:1000};
const context=f=>({identity:f.identity,aliases:f.aliases,homeAliases:f.homeAliases,referenceBindings:[],ownerSide:0});
const direct={...options,unitId:502,unitBindings:[],sourceClockMs:3200,destinationClockMs:9000};
async function fields(bytes) {
  const result=[];for await(const v of checkpointAgentRecordValues(source(bytes)))
    if(v.type===5&&!v.path.length)result.push([v.attribute,v.targetAgentId]);
  return result;
}
// Assemble a synthetic receiving checkpoint from separately expected fixture
// layout, then replace its actor records with the actual prepared capsule.
async function receiving(f,side,uid,gid,records) {
  const bytes=world(side,true,{registration:f.registration,uid,gid});
  const file=source(bytes),actor=await checkpointActorRecords(file,uid),ranges={unit:actor.unit,agent:actor.agent};
  for await(const a of checkpointAttachments(file))if(a.unitId===uid&&a.kind==='CONT')ranges.container=a;
  for(const [name,record] of Object.entries(records)) {
    assert.ok(ranges[name]);assert.equal(record.length,ranges[name].size);
    assert.deepEqual(Buffer.from(record),bytes.subarray(ranges[name].offset,ranges[name].offset+ranges[name].size));
    bytes.set(record,ranges[name].offset);
  }
  return bytes;
}
test('selected arrival derives both saved clocks and prepares pure remote home without borrowing a building',async()=>{
  const f=await fixture(),s=f.store(),seed=await s.commit(f.request()),writes=f.writes.length;
  const prepared=await prepareSelectedRegisteredHeroArrival(s,{...options,expectedManifest:seed.manifest});
  assert.equal(prepared.ownerManifest,seed.manifest);assert.equal(prepared.plan.version,2);
  assert.deepEqual([prepared.plan.sourceClockMs,prepared.plan.destinationClockMs],[3200,9000]);
  assert.deepEqual(await fields(prepared.records.agent),[['home',45],['target',45]]);
  assert.equal(prepared.plan.registeredHome.guildEntityId,f.registration.guildEntityId);
  assert.equal(prepared.plan.registeredHome.occupiedSlots,1);
  assert.equal(prepared.plan.registeredHome.scriptDeparture.sourceAgentId,7);
  assert.equal(prepared.plan.registeredHome.nativeDeparture.previousUnitId,502);
  assert.equal(prepared.plan.registeredHome.scriptArrival,null);
  assert.equal(prepared.plan.registeredHome.nativeArrival,null);
  assert.equal(prepared.plan.registeredHome.destinationNativeMembershipRequired,false);
  assert.equal(prepared.plan.memberships.length,0);
  assert.equal(prepared.plan.reciprocalScriptMemberships,undefined);
  assert.equal(prepared.plan.containerTransforms[0].removeBytes,8);
  await receiving(f,1,100000,1000,prepared.records);
  assert.equal(f.writes.length,writes);assert.equal((await s.read()).owner.region,'0_0');
  assert.ok(Object.values(prepared.records).reduce((n,b)=>n+b.length,0)<4096);
});
test('actual prepared capsule participates in synthetic outward and return publications under one logical owner',async()=>{
  const f=await fixture(),s=f.store();let selected=await s.commit(f.request());
  const outward=await prepareSelectedRegisteredHeroArrival(s,{...options,expectedManifest:selected.manifest});
  const remote=await receiving(f,1,100000,1000,outward.records),aliases=[f.aliases[0],{unitId:100000,agentId:1000}];
  selected=await s.commit(f.request([world(0,false),remote],{aliases,kind:'handoff',ownerSide:1,visitedSides:3,
    operationId:'e'.repeat(64),expectedManifest:selected.manifest}));
  const inward=await prepareSelectedRegisteredHeroArrival(s,{freshUnitId:100002,freshAgentId:1002,expectedManifest:selected.manifest});
  assert.deepEqual(await fields(inward.records.agent),[['home',7],['target',7]]);
  assert.equal(inward.plan.registeredHome.scriptDeparture,null);
  assert.equal(inward.plan.registeredHome.destinationNativeMembershipRequired,true);
  assert.deepEqual(inward.plan.registeredHome.scriptArrival,{destinationUnitId:469,destinationAgentId:7,
    destinationAttribute:'members',destinationMemberCount:0,arrivingAgentId:1002});
  assert.deepEqual(inward.plan.registeredHome.nativeArrival,{destinationUnitId:469,groupKind:100,arrivingUnitId:100002,flags:1});
  assert.equal(inward.plan.registeredHome.occupiedSlots,1);
  assert.deepEqual(inward.plan.containerTransforms[0].insertWords,[469,1]);
  const returned=await receiving(f,0,100002,1002,inward.records);
  selected=await s.commit(f.request([returned,world(1,false,{registration:f.registration})],{
    aliases:[{unitId:100002,agentId:1002},aliases[1]],kind:'handoff',ownerSide:0,visitedSides:3,
    operationId:'f'.repeat(64),expectedManifest:selected.manifest}));
  const owner=(await s.read()).owner;
  assert.equal(owner.entityId,f.identity.entityId);assert.equal(owner.region,'0_0');assert.equal(owner.agentId,1002);
  assert.deepEqual(s.identity.registeredHome,f.registration);assert.equal(f.files.size,8);
});
test('selected preparation refuses stale owner and caller-chosen clocks before exposing records',async()=>{
  const f=await fixture(),s=f.store(),seed=await s.commit(f.request());
  await assert.rejects(prepareSelectedRegisteredHeroArrival(s,{...options,expectedManifest:'stale'}),/revision changed/);
  assert.throws(()=>prepareSelectedRegisteredHeroArrival(s,{...options,expectedManifest:seed.manifest,sourceClockMs:9000}),/request/);
  const old={...f.identity,version:1};delete old.registeredHome;
  assert.throws(()=>prepareSelectedRegisteredHeroArrival({identity:old},{}),/version2/);
});
for(const [option,message] of [[{freshUnitId:778},/native ID is occupied/],
  [{freshAgentId:45},/rebound|borrowed/],[{unitBindings:[{from:469,to:778}]},/rebound|borrowed/],
  [{attachedUnitBindings:[{from:503,to:100001}]},/attached/]])
  test(`registered arrival refuses invalid destination or dependency ${JSON.stringify(option)}`,async()=>{
    const f=await fixture();await assert.rejects(prepareCheckpointRegisteredHeroArrival(source(f.worlds[0]),source(f.worlds[1]),
      {...direct,...option},context(f)),message);
  });
test('a physical guild parent is never cleared and quest inventory is never silently lost',async()=>{
  const f=await fixture();
  await assert.rejects(prepareCheckpointRegisteredHeroArrival(source(world(0,true,{parent:469,physicalGroups:[{kind:2,owner:469,members:[502]}]})),source(f.worlds[1]),direct,context(f)),/physical building/);
  await assert.rejects(prepareCheckpointRegisteredHeroArrival(source(world(0,true,{inventory:true})),source(f.worlds[1]),direct,context(f)),/quest inventory/);
  await assert.rejects(prepareCheckpointRegisteredHeroArrival(source(world(0,true,{extraRef:17})),source(f.worlds[1]),direct,context(f)),/Undeclared/);
});
test('all home-bound record bytes are copy preconditions, including opaque native state',async()=>{
  const f=await fixture(),normal=source(f.worlds[0]);
  const first=await checkpointRegisteredHeroArrivalPlan(normal,source(f.worlds[1]),direct,context(f));
  for(const name of ['unit','agent','container']) {
    const range=first.ranges[name];let reads=0;
    const changed={size:normal.size,async readAt(at,n){
      const b=await normal.readAt(at,n);if(at!==range.offset||n!==range.size||++reads<2)return b;
      const copy=Uint8Array.from(b);copy[copy.length-1]^=1;return copy;
    }};
    await assert.rejects(prepareCheckpointRegisteredHeroArrival(changed,source(f.worlds[1]),direct,context(f)),/record changed|precondition|GPL|container|marker/);
  }
});
test('context and proposal mutation during awaited reads cannot silently rebind a registered home',async()=>{
  const f=await fixture(),c=context(f),o={...direct};
  const pending=prepareCheckpointRegisteredHeroArrival(source(f.worlds[0]),source(f.worlds[1]),o,c);
  c.homeAliases[1].agentId=17;o.freshAgentId=17;c.identity.entityId='e'.repeat(64);
  const prepared=await pending;assert.deepEqual(await fields(prepared.records.agent),[['home',45],['target',45]]);
  assert.equal(prepared.plan.freshAgentId,1000);
});
test('selected preparation holds its storage lock through every source read and releases on refusal',async()=>{
  const f=await fixture(),s=f.store(),seed=await s.commit(f.request());
  let release,entered;const gate=new Promise(r=>release=r),ready=new Promise(r=>entered=r);
  const open=f.io.open;let held=false;
  f.io.open=async name=>{const file=await open(name);if(!file||!name.endsWith('.GMP'))return file;
    return {size:file.size,async readAt(at,n){if(!held){held=true;entered();await gate;}return file.readAt(at,n);}};};
  const pending=prepareSelectedRegisteredHeroArrival(s,{...options,expectedManifest:seed.manifest});
  await ready;await assert.rejects(f.io.withLock('exclusive',()=>{}),/busy/);release();await pending;
  await f.io.withLock('exclusive',()=>{});
  await assert.rejects(prepareSelectedRegisteredHeroArrival(s,{freshUnitId:778,freshAgentId:1000,expectedManifest:seed.manifest}),/occupied/);
  await f.io.withLock('exclusive',()=>{});
});
test('saved clock decoder requires one complete original SVGD and exhausts later chunks',async()=>{
  const f=await fixture();assert.equal(await checkpointSavedClock(source(f.worlds[0])),3200);
  const original=f.worlds[0],at=original.indexOf(Buffer.from('SVGD')),size=original.readUInt32LE(at+4)+16;
  const duplicated=Buffer.concat([original,original.subarray(at,at+size)]);
  await assert.rejects(checkpointSavedClock(source(duplicated)),/Unsupported/);
  const absent=Buffer.concat([original.subarray(0,at),original.subarray(at+size)]);
  await assert.rejects(checkpointSavedClock(source(absent)),/Missing/);
  const bad=Buffer.from(original);bad.writeUInt32LE(11,at+8);
  await assert.rejects(checkpointSavedClock(source(bad)),/Unsupported/);
  await assert.rejects(checkpointSavedClock(source(Buffer.concat([original,Buffer.from([1])]))),/Truncated|chunk/);
});
test('halo arrival preserves a moving hero anchor independently of its fractional pose',async()=>{
  const f=await fixture(),bytes=Buffer.from(f.worlds[0]),actor=await checkpointActorRecords(source(bytes),502);
  for(const [offset,value] of [[60,8261479],[64,258194],[68,116930],[72,252],[76,8]])
    bytes.writeUInt32LE(value,actor.unit.offset+offset);
  const prepared=await prepareCheckpointRegisteredHeroArrival(source(bytes),source(f.worlds[1]),
    {...direct,haloRegions:{version:'halo-v1',sourceRegion:'0_0',destinationRegion:'1_0'}},context(f));
  const unit=Buffer.from(prepared.records.unit),placement=prepared.plan.haloPlacement;
  assert.deepEqual([60,64,68,72,76].map(at=>unit.readUInt32LE(at)),[135015,258194,116930,4,8]);
  assert.equal(Math.floor(unit.readUInt32LE(64)/32768),7);
  assert.deepEqual(placement.sourceGrid,{x:252,y:8});
  assert.deepEqual(placement.destinationGrid,{x:4,y:8});
  assert.equal(placement.destinationCollisionQualified,false);
});
test('halo arrival still refuses saved anchors outside either physical map',async()=>{
  const f=await fixture();
  for(const x of [256,247]){
    const bytes=Buffer.from(f.worlds[0]),actor=await checkpointActorRecords(source(bytes),502);
    for(const [offset,value] of [[60,8261479],[64,258194],[68,116930],[72,x],[76,8]])
      bytes.writeUInt32LE(value,actor.unit.offset+offset);
    await assert.rejects(prepareCheckpointRegisteredHeroArrival(source(bytes),source(f.worlds[1]),
      {...direct,haloRegions:{version:'halo-v1',sourceRegion:'0_0',destinationRegion:'1_0'}},context(f)),/navigation cell is outside/);
  }
});
test('outward home request retains its global destination outside the active neighbor',async()=>{
  const f=await fixture(),bytes=world(0,true,{destination:{x:2000,y:128},continuation:'travel_to'});
  const actor=await checkpointActorRecords(source(bytes),502);
  for(const [offset,value] of [[60,8261479],[64,258194],[68,116930],[72,252],[76,8]])bytes.writeUInt32LE(value,actor.unit.offset+offset);
  const prepared=await prepareCheckpointRegisteredHeroArrival(source(bytes),source(f.worlds[1]),
    {...direct,haloRegions:{version:'halo-v1',sourceRegion:'0_0',destinationRegion:'1_0'}},context(f));
  const points=[];for await(const v of checkpointAgentRecordValues(source(prepared.records.agent)))
    if(v.attribute==='destination')points.push(v.words.map(n=>n|0));
  assert.deepEqual(points,[[-1968,128]]);
  assert.equal(prepared.plan.haloPlacement.remoteHomeRoutingRequired,true);
  assert.deepEqual(prepared.plan.haloPlacement.destinationFixed,{x:135015,y:258194,z:116930});
  const invalid=world(0,true,{destination:{x:2000,y:128},taskName:'explore',continuation:'travel_to'}),unit=await checkpointActorRecords(source(invalid),502);
  for(const [offset,value] of [[60,8261479],[64,258194],[72,252],[76,8]])invalid.writeUInt32LE(value,unit.unit.offset+offset);
  await assert.rejects(prepareCheckpointRegisteredHeroArrival(source(invalid),source(f.worlds[1]),
    {...direct,haloRegions:{version:'halo-v1',sourceRegion:'0_0',destinationRegion:'1_0'}},context(f)),/outside the destination region/);
});
test('homeward leg restores a logical home goal that is outside the departing map',async()=>{
  const f=await fixture(),east=world(1,true,{registration:f.registration,destination:{x:-1968,y:128},continuation:'travel_to'});
  const actor=await checkpointActorRecords(source(east),602);
  for(const [offset,value] of [[60,125384],[64,258194],[68,116930],[72,3],[76,8]])east.writeUInt32LE(value,actor.unit.offset+offset);
  const prepared=await prepareCheckpointRegisteredHeroArrival(source(east),source(world(0,false)),
    {...direct,unitId:602,sourceClockMs:9000,destinationClockMs:3200,haloRegions:{version:'halo-v1',sourceRegion:'1_0',destinationRegion:'0_0'}},
    {...context(f),ownerSide:1});
  const points=[];for await(const v of checkpointAgentRecordValues(source(prepared.records.agent)))
    if(v.attribute==='destination')points.push(v.words.map(n=>n|0));
  assert.deepEqual(points,[[2000,128]]);
  assert.equal(prepared.plan.haloPlacement.remoteHomeRoutingRequired,false);
  assert.equal(prepared.plan.haloPlacement.destinationGrid.x,251);
});
