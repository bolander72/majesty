import test from 'node:test';
import assert from 'node:assert/strict';
import {savedUnitWindows,ATLAS_POSITION_SCALE,ATLAS_MARKER_WORDS,MAX_ATLAS_WINDOW_MARKERS,MAX_ATLAS_WINDOW_MARKER_BYTES} from '../web/world/atlas-units.mjs';
import {NativeTerrainScene,MAX_NATIVE_RESIDENT_BYTES} from '../web/world/terrain-scene.mjs';
import {realmTerrainProvider} from '../web/world/realm-terrain.mjs';
import {paintNativeAtlas} from '../web/world/native-atlas.mjs';

function chunk(tag,version=0,count=0,...parts){
  const body=Buffer.concat(parts),head=Buffer.alloc(16);head.write(tag);head.writeUInt32LE(body.length,4);head.writeUInt32LE(version,8);head.writeUInt32LE(count,12);
  return Buffer.concat([head,body]);
}
function actor({family='VHCL',id=1,owner=0,x=8,y=8,parent=0,flags=0}={}){
  const bytes=Buffer.alloc(40);
  [1,id,flags,0,123,owner>>>0,parent].forEach((word,i)=>bytes.writeUInt32LE(word,i*4));
  bytes.writeInt32LE(x*ATLAS_POSITION_SCALE,28);bytes.writeInt32LE(y*ATLAS_POSITION_SCALE,32);
  return {family,bytes:chunk('UNIT',0,1,chunk('PRIM',9,0,bytes))};
}
function world(actors=[]){
  const map=Buffer.alloc(40);map.writeUInt32LE(128);map.writeUInt32LE(128,4);
  return Buffer.concat([chunk('VERS',1,0,Buffer.alloc(256)),chunk('MAP ',0,1,chunk('PRIM',2,0,map)),
    chunk('MTER',0,2,chunk('MVTX',0,1,chunk('PRIM',2,129*129,Buffer.alloc(129*129*9))),
      chunk('MCEL',0,1,chunk('PRIM',5,128*128,Buffer.alloc(128*128*5)))),
    ...['BLDG','VHCL','GRND','RWRD','MSGF','OFMP'].map(family=>{
      const units=actors.filter(a=>a.family===family);return chunk(family,0,units.length,...units.map(a=>a.bytes));
    })]);
}
function source(bytes){let largestRead=0;return {size:bytes.length,async readAt(at,n){largestRead=Math.max(largestRead,n);return bytes.subarray(at,at+n);},get largestRead(){return largestRead;}};}

test('saved markers preserve fractional Q11 positions, kingdom colors and building/unit types for selected windows',async()=>{
  const input=source(world([actor({family:'BLDG',id:10,x:40.5,y:12,owner:1}),actor({id:11,x:63.99998474121094,y:31,owner:0}),
    actor({id:12,x:64,y:12}),actor({family:'GRND',id:13}),actor({id:14,parent:10}),
    actor({id:15,parent:10,flags:128,x:35,y:5}),actor({id:16,x:-1}),actor({id:17,x:128})]));
  const result=await savedUnitWindows(input,[[32,0]],128,128);
  assert.equal(result.size,1);const window=result.get('32,0');
  assert.deepEqual([...window.markers],[10,1,1,8.5*ATLAS_POSITION_SCALE,12*ATLAS_POSITION_SCALE,
    11,0,2,32*ATLAS_POSITION_SCALE-1,31*ATLAS_POSITION_SCALE,15,0,2,3*ATLAS_POSITION_SCALE,5*ATLAS_POSITION_SCALE]);
  assert.equal(window.omittedMarkers,0);assert.ok(input.largestRead<=4096);
});
test('crowded saved windows retain a fixed marker budget and count omitted units without allocating more markers',async()=>{
  const input=source(world(Array.from({length:1000},(_,i)=>actor({id:i+1}))));
  const [window]=[...(await savedUnitWindows(input,[[0,0],[32,0]],128,128)).values()];
  assert.equal(window.markers.byteLength,MAX_ATLAS_WINDOW_MARKER_BYTES);
  assert.equal(window.markers.length,MAX_ATLAS_WINDOW_MARKERS*ATLAS_MARKER_WORDS);
  assert.equal(window.omittedMarkers,936);assert.ok(input.largestRead<=4096);
});
test('duplicate, malformed and excessive requested windows reject before reading a save',async()=>{
  const input={size:100,async readAt(){assert.fail('invalid request read save');}};
  for(const windows of [[[0,0],[0,0]],[[-32,0]],[[1,0]],[[128,0]],Array.from({length:50},()=>[0,0])])
    await assert.rejects(savedUnitWindows(input,windows,128,128));
});
test('actual saved-realm provider reads marker positions within its lease and retains no source after snapshot cleanup',async()=>{
  const bytes=world([actor({family:'BLDG',id:10,x:20,y:20}),actor({id:11,x:40,y:20,owner:1})]);
  let live=false,reads=0,escaped;
  const store={async withRegions(keys,consume){live=true;try{
    const selected=new Map(keys.map(key=>[key,key==='0_0'?{record:{manifest:'identity'},source:{size:bytes.length,async readAt(at,n){assert.ok(live);++reads;return bytes.subarray(at,at+n);}}}:null]));
    return await consume(selected);
  }finally{live=false;}}};
  const provider=realmTerrainProvider(store,{includeUnits:true});
  const scene=new NativeTerrainScene(provider);await scene.move(32,32,32,32);
  assert.equal(live,false);assert.ok(reads>0);
  const markers=[...scene.active.values()].filter(Boolean).flatMap(w=>[...w.markers]);
  assert.equal(markers.length,2*ATLAS_MARKER_WORDS);
  const expected=[...scene.active.values()].filter(Boolean).reduce((n,w)=>n+w.vertices.length+w.cells.length+w.markers.byteLength,0);
  assert.equal(scene.activeBytes,expected);assert.ok(scene.residentBytesHighWater<=MAX_NATIVE_RESIDENT_BYTES);
  const ctx={rects:[],fillRect(x,y,w,h){this.rects.push({x,y,w,h,color:this.fillStyle});},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){}};
  const drawn=paintNativeAtlas(ctx,scene,{x:128,y:128},256,256);
  const markerRects=ctx.rects.slice(drawn.cells);
  assert.equal(markerRects.length,2);assert.equal(markerRects[0].w,6);assert.equal(markerRects[1].w,3);
  assert.notEqual(markerRects[0].color,markerRects[1].color);
  const previous=scene.active;await scene.move(10000,10000,32,32);
  assert.equal(previous.size,0);assert.equal(scene.activeBytes,0);await scene.close();assert.equal(scene.residentBytes,0);
  await provider.withSnapshot(snapshot=>{escaped=snapshot;},{windows:[[0,0]]});
  await assert.rejects(escaped.readWindow(0,0),/lease ended/);
});
test('unreadable saved unit records preserve the complete previous scene before publication',async()=>{
  const good=world([actor()]);let bytes=good,manifest='identity';
  const store={async withRegions(keys,consume){return consume(new Map(keys.map(key=>[key,key==='0_0'?{record:{manifest},source:source(bytes)}:null])));}};
  const scene=new NativeTerrainScene(realmTerrainProvider(store,{includeUnits:true}));await scene.move(16,16,32,32);
  const previous=scene.active;bytes=world([{family:'VHCL',bytes:chunk('UNIT',0,1,chunk('PRIM',9,0,Buffer.alloc(36)))}]);
  manifest='changed';
  await assert.rejects(scene.move(16,16,32,32),/Truncated native unit position/);
  assert.equal(scene.active,previous);assert.equal(scene.active.get('0,0').markers[0],1);
  await scene.close();
});

test('dense marker windows stay within complete scene byte accounting over distant handoffs and reject malformed payloads',async()=>{
  let bad=false;
  const provider={async withSnapshot(consume){return consume({identity:bad?'bad':'dense',async readWindow(wx,wy){
    const markers=new Int32Array(MAX_ATLAS_WINDOW_MARKERS*ATLAS_MARKER_WORDS);
    for(let at=0;at<markers.length;at+=ATLAS_MARKER_WORDS)markers.set([1,0,2,1,1],at);
    if(bad)markers[3]=-1;
    return {x:0,y:0,width:32,height:32,realmKey:'0_0',vertices:new Uint8Array(33*33*9),cells:new Uint8Array(32*32*5),markers,omittedMarkers:0};
  }});}};
  const scene=new NativeTerrainScene(provider);await scene.move(16,16,128,128);
  for(let i=1;i<=50;++i)await scene.move(i*1024+16,-i*1024+16,128,128);
  assert.equal(scene.residentBytesHighWater,MAX_NATIVE_RESIDENT_BYTES);
  const old=scene.active;bad=true;await assert.rejects(scene.move(16,16,128,128),/unit position/);
  assert.equal(scene.active,old);await scene.close();assert.equal(scene.residentBytes,0);
});
