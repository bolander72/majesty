import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointActorOrderNavigation,MAX_ORDER_NAVIGATION_HEADERS} from '../web/world/order-navigation.mjs';
const words=v=>{const b=Buffer.alloc(v.length*4);v.forEach((n,i)=>b.writeUInt32LE(n>>>0,i*4));return b;};
const chunk=(tag,body=Buffer.alloc(0),version=0,count=0)=>Buffer.concat([Buffer.from(tag),words([body.length,version,count]),body]);
function entry(kind,{cursor=0,count=0,capacity=count,points=[],dst=[-17,33],fixed=[-1,2147483647,-2147483648]}={}){
  const v=Array(kind===2?44:kind===4?35:28).fill(0),prefix=[kind===4?5:kind===2?2:1,1,2,kind];v.splice(0,4,...prefix);
  if(kind===2){v[26]=fixed[0];v[27]=fixed[1];v[28]=fixed[2];}
  if(kind===4){v[26]=dst[0];v[27]=dst[1];v[30]=cursor;v[32]=capacity;v[34]=count;}
  else if(kind===7){v[25]=cursor;v[27]=count;}
  return Buffer.concat([words([1,kind]),words(v),words(points)]);
}
const order=(entries=[])=>Buffer.concat([words([506]),chunk('ORDR',chunk('PRIM',Buffer.concat([words([1,entries.length]),...entries,words([1,0,1,0])]),2),0,1)]);
const save=records=>Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('ORDR',Buffer.concat(records),1,records.length),chunk('CONT',undefined,1)]);
const source=data=>({size:data.length,async readAt(at,n){assert.ok(n<=4096);return data.subarray(at,at+n);}});
async function read(data){const rows=[];for await(const row of checkpointActorOrderNavigation(source(data),506))rows.push(row);return rows;}

test('native destination, route cells and queued world points retain distinct signed coordinate spaces',async()=>{
  const data=save([order([entry(4,{count:2,cursor:1,capacity:10,points:[0xffffffff,2,3,0x80000000]}),
    entry(7,{count:1,cursor:1,points:[1872,2064]})])]),before=Buffer.from(data),rows=await read(data);
  assert.deepEqual(rows.filter(r=>r.type==='navigation').map(r=>[r.kind,r.cursor,r.count,r.capacity,r.pointSpace]),
    [[4,1,2,10,'navigation-grid'],[7,1,1,10,'native-world']]);
  assert.deepEqual(rows.filter(r=>r.type==='coordinate').map(r=>[r.field,r.space,r.x,r.y]),
    [['destination','native-world',-17,33],['waypoint','navigation-grid',-1,2],
      ['waypoint','navigation-grid',3,-2147483648],['waypoint','native-world',1872,2064]]);
  for(const r of rows){assert.ok(Object.isFrozen(r));if(r.type==='coordinate'){
    assert.equal(data.readInt32LE(r.offset),r.x);assert.equal(data.readInt32LE(r.offset+4),r.y);
  }else assert.equal(r.completeOrderMigration,false);}
  assert.deepEqual(data,before);
});
test('empty and exhausted canonical paths are admitted without inventing a waypoint',async()=>{
  assert.deepEqual(await read(save([])),[]);
  assert.deepEqual(await read(save([order()])),[]);
  const rows=await read(save([order([entry(4),entry(7)])]));
  assert.equal(rows.filter(r=>r.type==='navigation').length,2);
  assert.equal(rows.filter(r=>r.type==='coordinate').length,1);
  assert.equal((await read(save([order([entry(7,{count:10,cursor:10,points:Array(20).fill(0)})])]))).length,11);
});
test('in-flight Move exposes its signed fixed vector separately from Path world destinations',async()=>{
  const data=save([order([entry(2),entry(4)])]),rows=await read(data);
  assert.equal(rows.length,3);
  assert.deepEqual([rows[0].space,rows[0].x,rows[0].y,rows[0].z,rows[0].size],
    ['native-fixed',-1,2147483647,-2147483648,12]);
  for(let axis=0;axis<3;++axis)assert.equal(data.readInt32LE(rows[0].offset+axis*4),rows[0][['x','y','z'][axis]]);
  assert.equal(rows[2].space,'native-world');
});
test('negative and noncanonical cursors, undersized capacity and kind-seven overflow reject',async()=>{
  for(const kind of [4,7])for(const cursor of [-1,2,0x80000000])
    await assert.rejects(read(save([order([entry(kind,{count:1,cursor,points:[1,2]})])])),/cursor/);
  await assert.rejects(read(save([order([entry(4,{count:1,capacity:0,points:[1,2]})])])),/storage bounds/);
  await assert.rejects(read(save([order([entry(4,{capacity:4097})])])),/storage bounds/);
  await assert.rejects(read(save([order([entry(7,{count:11,points:Array(22).fill(0)})])])),/storage bounds/);
});
test('full traversal exposes late corruption, duplicates and the exact header budget',async()=>{
  await assert.rejects(read(save([order([entry(4),words([1,16])])])),/kind: 16/);
  await assert.rejects(read(save([order(),order()])),/Duplicate/);
  const data=save([order([entry(4)])]);await assert.rejects(read(data.subarray(0,data.length-1)),/Truncated/);
  const entries=Array.from({length:MAX_ORDER_NAVIGATION_HEADERS},()=>entry(7));
  assert.equal((await read(save([order(entries)]))).length,128);
  entries.push(entry(7));await assert.rejects(read(save([order(entries)])),/budget/);
});
