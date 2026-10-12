import test from 'node:test';
import assert from 'node:assert/strict';
import {coordinateTravelReady,coordinateTravelRequest} from '../web/world/coordinate-travel.mjs';
function ready({x=0,y=0,serial=1,clock=31800,finish=false}={}){
  const words=[0x32565254,2,serial,x,y,x,y,clock,finish?2:0],bytes=Buffer.alloc(36);
  words.forEach((value,i)=>bytes.writeUInt32LE(value>>>0,i*4));return bytes;
}
test('signed coordinate request preserves source, serial and initial clock and selects any cardinal neighbor',()=>{
  const raw=ready({x:-127,y:845,serial:9,clock:0xffffffff}),before=Buffer.from(raw);
  for(const target of [{x:-126,y:845},{x:-128,y:845},{x:-127,y:844},{x:-127,y:846}]){
    const packet=coordinateTravelRequest(raw,target);assert.equal(packet.length,36);
    const view=new DataView(packet.buffer);assert.equal(view.getUint32(8,true),9);assert.equal(view.getUint32(28,true),0xffffffff);
    assert.equal(view.getInt32(12,true),-127);assert.equal(view.getInt32(16,true),845);
    assert.equal(view.getInt32(20,true),target.x);assert.equal(view.getInt32(24,true),target.y);assert.equal(view.getUint32(32,true),1);
  }
  assert.deepEqual(raw,before);
});
test('wire works with an offset view and refuses unsupported, truncated or trailing records',()=>{
  const file=Buffer.concat([Buffer.alloc(7),ready(),Buffer.alloc(8)]);
  assert.equal(coordinateTravelReady(file.subarray(7,43)).source.x,0);
  for(const bytes of [file,ready().subarray(0,35),new Uint8Array(37),null])assert.throws(()=>coordinateTravelReady(bytes));
  for(const [at,value]of [[0,0],[4,1],[8,0],[20,1],[24,1],[32,1]]){
    const changed=ready();changed.writeUInt32LE(value,at);assert.throws(()=>coordinateTravelReady(changed));
  }
});
test('world bounds and adjacency prevent overflow, diagonal, stationary and distant requests',()=>{
  for(const target of [{x:0,y:0},{x:1,y:1},{x:2,y:0},{x:0.5,y:0},{x:NaN,y:0},null])assert.throws(()=>coordinateTravelRequest(ready(),target));
  const edge=ready({x:1000000,y:-1000000});assert.throws(()=>coordinateTravelRequest(edge,{x:1000001,y:-1000000}));
  assert.doesNotThrow(()=>coordinateTravelRequest(edge,{x:999999,y:-1000000}));
  assert.throws(()=>coordinateTravelReady(ready({x:0x7fffffff})));assert.throws(()=>coordinateTravelReady(ready({y:-1000001})));
});
test('final stop names only the current region and cannot be mistaken for travel',()=>{
  const raw=ready({x:-7,y:12,finish:true});assert.equal(coordinateTravelReady(raw).finishOnly,true);
  const packet=coordinateTravelRequest(raw,{x:-7,y:12},{finish:true});assert.equal(new DataView(packet.buffer).getUint32(32,true),2);
  assert.throws(()=>coordinateTravelRequest(raw,{x:-6,y:12},{finish:true}));assert.throws(()=>coordinateTravelRequest(raw,{x:-6,y:12}));
  assert.throws(()=>coordinateTravelRequest(ready(),{x:0,y:0},{finish:true}));
});
test('a changing destination object cannot change validated coordinates or mutate the captured readiness',()=>{
  const raw=ready();let calls=0;
  const packet=coordinateTravelRequest(raw,{get x(){++calls;raw.writeUInt32LE(99,8);return calls===1?1:1000001;},y:0});
  assert.equal(calls,1);const view=new DataView(packet.buffer);assert.equal(view.getUint32(8,true),1);assert.equal(view.getInt32(20,true),1);
});
