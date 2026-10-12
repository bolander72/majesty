import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointHaloOrderCoordinatePlan} from '../web/world/halo-order-navigation.mjs';
import {checkpointHeroOrderArrivalPlan} from '../web/world/hero-order-arrival.mjs';
import {prepareCheckpointHaloHeroOrders} from '../web/world/halo-hero-orders.mjs';
import {compactConsumedHaloPathRecord} from '../web/world/halo-order-compaction.mjs';
import {checkpointActorOrderNavigation} from '../web/world/order-navigation.mjs';
const words=values=>{const b=Buffer.alloc(values.length*4);values.forEach((n,i)=>b.writeUInt32LE(n>>>0,i*4));return b;};
const chunk=(tag,body=Buffer.alloc(0),version=0,count=0)=>Buffer.concat([Buffer.from(tag),words([body.length,version,count]),body]);
const source=b=>({size:b.length,async readAt(at,n){assert.ok(n<=4096);return Uint8Array.from(b.subarray(at,at+n));}});
const regions={version:'halo-v1',sourceRegion:'0_0',destinationRegion:'0_-1'};
function save({point=[3600,32],move=[3600*2048,48*2048,-12345],path=[225,3,224,2],target=0,
  flags=0,leafProc=0,baseProc=0,kind=7,when=60650}={}){
  const m=Array(44).fill(0),p=Array(35).fill(0),q=Array(28).fill(0);
  m.splice(0,4,2,1,2,2);m[4]=100;m[5]=when;m[6]=100;m[10]=baseProc;
  m[24]=flags;m[25]=target;m.splice(26,3,...move);m[29]=12288;m[30]=leafProc;
  p.splice(0,4,5,1,2,4);p[5]=60450;p.splice(26,2,...point);p[30]=1;p[32]=10;p[34]=path.length/2;
  q.splice(0,4,1,1,2,kind);q[4]=500;q[5]=60450;q[25]=1;q[27]=1;
  const body=Buffer.concat([words([1,2,1,2]),words(m),words([1,4]),words(p),words(path),
    words([1,1,1,kind]),words(q),words(point),words([1,0])]);
  return Buffer.concat([chunk('VERS',Buffer.alloc(256),1),
    chunk('ORDR',Buffer.concat([words([481]),chunk('ORDR',chunk('PRIM',body,2),0,1)]),1,1),chunk('CONT',undefined,1)]);
}
const arrival=(b,r=regions)=>checkpointHeroOrderArrivalPlan(source(b),481,
  {sourceClockMs:60650,destinationClockMs:0},null,()=>{throw Error('Unexpected target lookup');},r);
function patched(b,patches){const out=Buffer.from(b);for(const p of patches){assert.equal(out.readUInt32LE(p.offset),p.before);out.writeUInt32LE(p.after,p.offset);}return out;}

test('current Move, complete Path and Queue shift together; cursors, elevation, flags and dispatch ages survive',async()=>{
  const b=save(),before=Buffer.from(b),p=await arrival(b),out=patched(b,p.patches),expected=Buffer.from(b);
  // Independently encoded body positions: Move340, Path524, Queue696.
  expected.writeUInt32LE(0,340+20);expected.writeUInt32LE((-200)>>>0,524+20);expected.writeUInt32LE((-200)>>>0,696+20);
  expected.writeInt32LE((48+3968)*2048,340+108);
  expected.writeInt32LE(4000,524+108);
  expected.writeInt32LE(251,524+140+4);expected.writeInt32LE(250,524+140+12);
  expected.writeInt32LE(4000,696+112+4);
  assert.deepEqual(out,expected);assert.deepEqual(b,before);
  assert.deepEqual(p.entries.map(e=>e.kind),[2,4,7]);assert.equal(p.haloNavigation.coordinates,5);
  assert.equal(p.haloNavigation.patches.length,5);assert.equal(p.waypointCount,3);
  assert.deepEqual(p.dispatch.headers.map(h=>h.elapsed),[0,200,200]);
  assert.equal(p.nativeActivationQualified,false);assert.equal(p.completeOrderMigration,false);
});
test('all four cardinal origin changes and their return preserve each original command byte',async()=>{
  for(const[destinationRegion,point,move,path]of [
    ['0_-1',[3600,32],[3600*2048+7,48*2048+11,110],[225,3,224,2]],
    ['0_1',[3600,4032],[3600*2048+7,4016*2048+11,110],[225,251,224,250]],
    ['-1_0',[32,3600],[48*2048+7,3600*2048+11,110],[3,225,2,224]],
    ['1_0',[4032,3600],[4016*2048+7,3600*2048+11,110],[251,225,250,224]]]){
    const b=save({point,move,path}),r={...regions,destinationRegion};
    const outbound=await checkpointHaloOrderCoordinatePlan(source(b),481,r),out=patched(b,outbound.patches);
    const inbound=await checkpointHaloOrderCoordinatePlan(source(out),481,{...r,sourceRegion:destinationRegion,destinationRegion:'0_0'});
    assert.deepEqual(patched(out,inbound.patches),b);
  }
});
test('layout ambiguity, non-neighbors and large origins refuse before preparing coordinates',async()=>{
  for(const r of [{...regions,version:'v1'},{...regions,destinationRegion:'0_0'},
    {...regions,destinationRegion:'1_1'},{...regions,destinationRegion:'2_0'},
    {...regions,sourceRegion:'0_00'},{...regions,sourceRegion:'999999999_0'}])
    await assert.rejects(checkpointHaloOrderCoordinatePlan(source(save()),481,r));
});
test('current/future points and other goals outside either map refuse without clipping or inventing a route',async()=>{
  for(const options of [{move:[-1,98304,0]},{move:[7372800,200*2048,0]},
    {point:[3600,200]},{path:[225,3,224,8]},{path:[-1,3,224,2]},{point:[3600,-1]}])
    await assert.rejects(arrival(save(options)),/outside/);
});
test('only an out-of-map consumed Path prefix is omitted; cursor, current/future points and other bank bytes survive',async()=>{
 const b=save({path:[225,8,224,2]}),p=await arrival(b),patchedSource=patched(b,p.patches);
 const original=b.subarray(p.attachment.offset,p.attachment.offset+p.attachment.size);
 const edited=patchedSource.subarray(p.attachment.offset,p.attachment.offset+p.attachment.size);
 const out=compactConsumedHaloPathRecord(edited,p.attachment,p.haloNavigation);
 assert.equal(p.haloNavigation.consumedPathPrefixes.length,1);
 assert.equal(out.length,original.length-8);
 assert.deepEqual(b,save({path:[225,8,224,2]}));
 const enveloped=Buffer.concat([b.subarray(0,p.attachment.offset),out,b.subarray(p.attachment.offset+p.attachment.size)]);
 // The checkpoint group's size wraps all attachment records; the capsule
 // transform adjusts only its two internal headers, never a source GMP.
 enveloped.writeUInt32LE(b.readUInt32LE(p.attachment.offset-12)-8,p.attachment.offset-12);
 const nav=[];for await(const r of checkpointActorOrderNavigation(source(enveloped),481))nav.push(r);
 const path=nav.find(r=>r.type==='navigation'&&r.kind===4);
 assert.equal(path.cursor,0);assert.equal(path.count,1);assert.equal(path.capacity,10);
 assert.deepEqual(nav.filter(r=>r.kind===4&&r.field==='waypoint').map(r=>[r.x,r.y]),[[224,250]]);
 const queue=nav.find(r=>r.type==='navigation'&&r.kind===7);assert.equal(queue.cursor,1);assert.equal(queue.count,1);
 assert.deepEqual(Buffer.from(out.subarray(-8)),words([1,0]));
 for(const change of [{removedPoints:2},{destinationCursor:1},{size:16},{kind:7},{offset:p.attachment.offset}])
  assert.throws(()=>compactConsumedHaloPathRecord(edited,p.attachment,{consumedPathPrefixes:[{...p.haloNavigation.consumedPathPrefixes[0],...change}]}),/Invalid/);
});
test('target-relative movement, unknown flags, callbacks and late unsupported commands refuse',async()=>{
  await assert.rejects(arrival(save({target:469})),/Target-relative/);
  await assert.rejects(arrival(save({flags:1})),/Move flags/);
  for(const option of [{leafProc:0x1007},{baseProc:0x1007}])await assert.rejects(arrival(save(option)),/callback/);
  await assert.rejects(arrival(save({kind:16})),/kind: 16/);
  await assert.rejects(arrival(save(),null),/populated hero/);
});
function terrainSave(b,clock=60650,height=0,width=128){
  const map=Buffer.alloc(40);map.writeUInt32LE(width,0);map.writeUInt32LE(128,4);
  const vertices=Buffer.alloc((width+1)*129*9);
  for(let at=0;at<vertices.length;at+=9)vertices.writeFloatLE(height,at);
  return Buffer.concat([b,
    chunk('SVGD',Buffer.concat([Buffer.from('Fixture\0Freestyle\0'),words([clock]),Buffer.alloc(28)]),10),
    chunk('MAP ',chunk('PRIM',map,2),0,1),chunk('MTER',Buffer.concat([
      chunk('MVTX',chunk('PRIM',vertices,2,(width+1)*129),0,1),
      chunk('MCEL',chunk('PRIM',Buffer.alloc(width*128*5),5,width*128),0,1)]),0,2)]);
}
test('original reader payload excludes outer identity/framing and retains the exact final bank',async()=>{
  const before=terrainSave(save({move:[7372800,98304,0]})),destination=terrainSave(save(),0);
  const r=await prepareCheckpointHaloHeroOrders(source(before),source(destination),481,regions);
  assert.equal(r.payload.length,500);assert.equal(r.preparedAttachment.length,536);
  assert.deepEqual(Buffer.from(r.payload).subarray(-8),words([1,0]));
  assert.equal(r.plan.groundSamples,5);assert.equal(r.plan.moveGoals,1);
  assert.equal(r.plan.destinationCollisionQualified,false);assert.equal(r.plan.sourceRetired,false);
});
test('saved ground discontinuity, non-ground Move elevation and wrong dimensions prevent payload preparation',async()=>{
  const before=terrainSave(save({move:[7372800,98304,0]}));
  await assert.rejects(prepareCheckpointHaloHeroOrders(source(before),source(terrainSave(save(),0,1)),481,regions),/ground differs/);
  await assert.rejects(prepareCheckpointHaloHeroOrders(source(terrainSave(save())),source(terrainSave(save(),0)),481,regions),/goal differs/);
  await assert.rejects(prepareCheckpointHaloHeroOrders(source(before),source(terrainSave(save(),0,0,127)),481,regions),/dimensions/);
});
test('changing an opaque command word after the initial copy refuses the complete prepared payload',async()=>{
  const b=terrainSave(save({move:[7372800,98304,0]})),normal=source(b);let copies=0;
  const changing={size:b.length,async readAt(at,n){const bytes=await normal.readAt(at,n);
    if(at===288&&n===536&&++copies>=2)bytes[340+24-288]^=1;
    return bytes;
  }};
  await assert.rejects(prepareCheckpointHaloHeroOrders(changing,source(terrainSave(save(),0)),481,regions),/changed during preparation/);
});
