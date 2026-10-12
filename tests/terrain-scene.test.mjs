import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NativeTerrainScene,pairedTerrainProvider,nativeVisibleWindows,MAX_NATIVE_ACTIVE_WINDOWS,MAX_NATIVE_RESIDENT_WINDOWS,MAX_NATIVE_RESIDENT_BYTES} from '../web/world/terrain-scene.mjs';
import {MAX_TERRAIN_WINDOW_BYTES} from '../web/world/terrain.mjs';
import {PairedCheckpointStore} from '../web/world/transfer-store.mjs';

function window(wx,wy,marker=0){return {x:0,y:0,width:32,height:32,realmKey:`${wx}_${wy}`,
  vertices:new Uint8Array(33*33*9).fill(marker),cells:new Uint8Array(32*32*5).fill(marker)};}
function provider(){
  const state={identity:'generation-1',reads:0,failAt:Infinity,releaseFail:false};
  state.withSnapshot=async consume=>{
    const result=await consume({identity:state.identity,async readWindow(wx,wy){
      if(++state.reads===state.failAt)throw new Error('read failed');return window(wx,wy,state.identity==='generation-1'?1:2);
    }});
    if(state.releaseFail)throw new Error('lease cleanup failed');return result;
  };
  return state;
}
function defer(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
test('closing an idle scene releases its views and rejects all future movement',async()=>{
  const source=provider(),scene=new NativeTerrainScene(source);
  await scene.move(16,16,128,128);
  const view=scene.active,iterator=view.values(),reads=source.reads;
  const closed=scene.close();assert.equal(scene.close(),closed);await closed;
  assert.equal(scene.closed,true);assert.equal(scene.identity,null);
  assert.equal(view.size,0);assert.deepEqual(iterator.next(),{done:true,value:undefined});
  assert.equal(scene.residentWindows,0);assert.equal(scene.residentBytes,0);
  await assert.rejects(scene.move(16,16,128,128),/scene closed/);
  assert.equal(source.reads,reads);
});
test('close cancels queued movement and drains the current read and provider cleanup',async()=>{
  const reading=defer(),read=defer(),cleaning=defer(),cleanup=defer();
  let gated=false,reads=0,snapshots=0;
  const scene=new NativeTerrainScene({async withSnapshot(consume){
    ++snapshots;
    try{await consume({identity:'generation-1',async readWindow(x,y){
      ++reads;if(gated){reading.resolve();await read.promise;}return window(x,y);
    }});}finally{if(gated){cleaning.resolve();await cleanup.promise;}}
  }});
  await scene.move(16,16,128,128);const old=scene.active;
  gated=true;
  const moving=scene.move(2048,2048,128,128);await reading.promise;
  const queued=scene.move(4096,4096,128,128);
  const moved=assert.rejects(moving,/scene closed/),cancelled=assert.rejects(queued,/scene closed/);
  let finished=false;const closed=scene.close();closed.then(()=>{finished=true;});
  await cancelled;
  assert.equal(scene.pendingOperations,0);assert.equal(old.size,0);assert.equal(scene.identity,null);
  assert.equal(scene.residentWindows,49,'in-flight ownership remains counted until cleanup settles');
  assert.equal(finished,false);
  read.resolve();await cleaning.promise;assert.equal(finished,false);
  assert.equal(reads,50,'no second window read starts after closure');
  cleanup.resolve();await Promise.all([moved,closed]);
  assert.equal(snapshots,2,'the queued destination never opens a snapshot');
  assert.equal(scene.active.size,0);assert.equal(scene.residentWindows,0);assert.equal(scene.residentBytes,0);
});
test('closure during staged snapshot cleanup blocks publication and drains failed cleanup',async()=>{
  const source=provider(),scene=new NativeTerrainScene(source);
  await scene.move(16,16,128,128);
  const original=source.withSnapshot,cleaning=defer(),cleanup=defer();
  source.withSnapshot=async consume=>{
    await original(consume);cleaning.resolve();await cleanup.promise;throw new Error('lease cleanup failed');
  };
  const moving=scene.move(2048,2048,128,128);await cleaning.promise;
  assert.equal(scene.residentWindows,98);
  const failed=assert.rejects(moving,/lease cleanup failed/),closed=scene.close();
  assert.equal(scene.active.size,0);assert.equal(scene.residentWindows,98);
  cleanup.resolve();await Promise.all([failed,closed]);
  assert.equal(scene.identity,null);assert.equal(scene.residentWindows,0);assert.equal(scene.residentBytes,0);
});
test('closing while snapshot acquisition waits prevents all reads when it arrives',async()=>{
  const acquisition=defer();let reads=0,cleaned=false,finished=false;
  const scene=new NativeTerrainScene({async withSnapshot(consume){
    await acquisition.promise;
    try{await consume({identity:'generation-1',async readWindow(x,y){++reads;return window(x,y);}});}
    finally{cleaned=true;}
  }});
  const moving=scene.move(16,16,128,128),rejected=assert.rejects(moving,/scene closed/);
  const closed=scene.close();closed.then(()=>{finished=true;});
  await Promise.resolve();assert.equal(finished,false);assert.equal(cleaned,false);
  acquisition.resolve();await Promise.all([rejected,closed]);
  assert.equal(reads,0);assert.equal(cleaned,true);assert.equal(scene.residentBytes,0);
});
function chunk(tag,version,count,...parts){
  const body=Buffer.concat(parts),header=Buffer.alloc(16);header.write(tag);header.writeUInt32LE(body.length,4);
  header.writeUInt32LE(version,8);header.writeUInt32LE(count,12);return Buffer.concat([header,body]);
}
function save(marker,width=64,height=64){
  const map=Buffer.alloc(40);map.writeUInt32LE(width);map.writeUInt32LE(height,4);
  return Buffer.concat([chunk('VERS',1,0,Buffer.alloc(256)),chunk('MAP ',0,1,chunk('PRIM',2,0,map)),
    chunk('MTER',0,2,chunk('MVTX',0,1,chunk('PRIM',2,(width+1)*(height+1),Buffer.alloc((width+1)*(height+1)*9,marker))),
      chunk('MCEL',0,1,chunk('PRIM',5,width*height,Buffer.alloc(width*height*5,marker))))]);
}
function diskFixture(){
  const files=new Map();let busy=false,largestRead=0;
  const source=buffer=>({size:buffer.length,async readAt(at,n){largestRead=Math.max(largestRead,n);return buffer.subarray(at,at+n);}});
  const io={async withLock(mode,consume){if(busy)throw new Error('busy');busy=true;try{return await consume();}finally{busy=false;}},
    async open(name){return files.has(name)?source(files.get(name)):null;},
    async atomicWrite(name,produce){const pieces=[];await produce({write:async bytes=>pieces.push(Buffer.from(bytes))});files.set(name,Buffer.concat(pieces));}};
  const store=new PairedCheckpointStore(io,{regions:['0_0','1_0'],content:'native-scene-fixture'});
  return {store,files,source,get largestRead(){return largestRead;},get busy(){return busy;},
    async commit(markers,expectedManifest=null){const worlds=markers.map(marker=>{const bytes=save(marker);return {source:source(bytes),sha256:createHash('sha256').update(bytes).digest('hex')};});return store.commit({worlds,moved:markers[0]!==1,expectedManifest});}};
}
test('long native-byte journeys discard old windows and stay within scene and handoff bounds',async()=>{
  const source=provider(),scene=new NativeTerrainScene(source);
  await scene.move(16,16,128,128);assert.equal(scene.active.size,49);
  const origin=scene.active.get('0,0');
  for(let i=1;i<=80;++i){
    await scene.move(i*256+16,-i*256+16,128,128);
    assert.equal(scene.active.size,49);assert.equal(scene.activeBytes,49*MAX_TERRAIN_WINDOW_BYTES);
    assert.ok(scene.residentWindows<=MAX_NATIVE_ACTIVE_WINDOWS);
  }
  assert.equal(scene.active.has('0,0'),false);
  assert.equal(scene.residentHighWater,MAX_NATIVE_RESIDENT_WINDOWS);
  assert.equal(scene.residentBytesHighWater,MAX_NATIVE_RESIDENT_WINDOWS*MAX_TERRAIN_WINDOW_BYTES);
  assert.ok(scene.residentBytesHighWater<=MAX_NATIVE_RESIDENT_BYTES);
  await scene.move(16,16,128,128);assert.notEqual(scene.active.get('0,0'),origin);
  assert.equal(scene.active.get('0,0').vertices[0],1);
  assert.equal(scene.active.set,undefined,'a consumer cannot grow the managed residency map');
  assert.equal(scene.active.clear,undefined);
});
test('retained views and iterators expire only after a successful scene handoff',async()=>{
  const source=provider(),scene=new NativeTerrainScene(source);
  await scene.move(16,16,128,128);
  const old=scene.active,shared=old.get('0,0');
  const iterators=[old.keys(),old.values(),old.entries(),old[Symbol.iterator]()];
  const begun=old.values();assert.equal(begun.next().done,false);iterators.push(begun);
  source.failAt=source.reads+1;
  await assert.rejects(scene.move(2048,2048,128,128),/read failed/);
  assert.equal(scene.active,old);assert.equal(old.size,49);assert.equal(old.get('0,0'),shared);
  assert.equal(iterators[0].next().done,false,'a failed handoff keeps the existing lease active');
  source.failAt=Infinity;source.releaseFail=true;
  await assert.rejects(scene.move(2048,2048,128,128),/lease cleanup failed/);
  assert.equal(scene.active,old);assert.equal(old.size,49);
  source.releaseFail=false;
  await scene.move(48,16,128,128);
  assert.equal(old.size,0);assert.equal(old.has('0,0'),false);assert.equal(old.get('0,0'),undefined);
  assert.deepEqual([...old],[]);assert.deepEqual([...old.keys()],[]);assert.deepEqual([...old.values()],[]);
  for(const iterator of iterators){assert.deepEqual(iterator.next(),{done:true,value:undefined});
    assert.deepEqual(iterator.next(),{done:true,value:undefined});}
  assert.equal(scene.active.size,49);assert.equal(scene.active.get('0,0'),shared,'overlap reuse survives revocation');
  assert.equal(scene.active.clear,undefined);assert.equal(scene.active.revoke,undefined);
});

test('overlapping unchanged scenes reuse windows; changed generation replaces every requested window',async()=>{
  const source=provider(),scene=new NativeTerrainScene(source);
  await scene.move(16,16,128,128);const first=scene.active.get('0,0'),reads=source.reads;
  await scene.move(16,16,128,128);assert.equal(source.reads,reads);assert.equal(scene.active.get('0,0'),first);
  await scene.move(48,16,128,128);assert.equal(source.reads,reads+7);assert.equal(scene.active.get('0,0'),first);
  source.identity='generation-2';const before=source.reads;
  await scene.move(48,16,128,128);assert.equal(source.reads,before+49);
  assert.notEqual(scene.active.get('0,0'),first);assert.equal(scene.active.get('0,0').vertices[0],2);
  assert.equal(scene.identity,'generation-2');
});
test('exact vertex seams reject either boundary mismatch before publication and preserve old buffers',async()=>{
  for(const axis of ['x','y'])for(const byte of [0,8]){
    const source=provider(),original=source.withSnapshot;
    const scene=new NativeTerrainScene(source,{seamPolicy:'exact-vertices'});
    await scene.move(16,16,128,128);const old=scene.active,origin=old.get('0,0');source.identity='generation-2';
    source.withSnapshot=consume=>original(snapshot=>consume({...snapshot,async readWindow(wx,wy){
      const value=await snapshot.readWindow(wx,wy);
      if(wx===0&&wy===0){
        const vertex=axis==='x'?32*33+32:32*33+16;value.vertices[vertex*9+byte]^=1;
      }
      return value;
    }}));
    await assert.rejects(scene.move(16,16,128,128),/seam differs/);
    assert.equal(scene.active,old);assert.equal(scene.active.get('0,0'),origin);assert.equal(scene.identity,'generation-1');
    assert.equal(scene.residentWindows,49);assert.ok(scene.residentBytesHighWater<=MAX_NATIVE_RESIDENT_BYTES);
    source.withSnapshot=original;await scene.move(16,16,128,128);assert.equal(scene.identity,'generation-2');
  }
});
test('exact seam checks leave missing regions unavailable without fabricating edge data',async()=>{
  const scene=new NativeTerrainScene({withSnapshot:consume=>consume({identity:'one-realm',async readWindow(wx,wy){
    return wx===0&&wy===0?window(wx,wy,3):null;
  }})},{seamPolicy:'exact-vertices'});
  await scene.move(16,16,128,128);assert.equal(scene.active.size,49);assert.equal(scene.active.get('1,0'),null);
  assert.equal(scene.activeBytes,MAX_TERRAIN_WINDOW_BYTES);
  assert.throws(()=>new NativeTerrainScene(provider(),{seamPolicy:'invented'}),/seam policy/);
});
test('exact seams are checked after lease cleanup so altered incoming edges cannot be published',async()=>{
  const source=provider(),scene=new NativeTerrainScene(source,{seamPolicy:'exact-vertices'});
  await scene.move(16,16,128,128);const old=scene.active,original=source.withSnapshot;source.identity='generation-2';
  source.withSnapshot=async consume=>{
    let incoming;
    await original(snapshot=>consume({...snapshot,async readWindow(wx,wy){
      const value=await snapshot.readWindow(wx,wy);if(wx===0&&wy===0)incoming=value;return value;
    }}));
    incoming.vertices[0]^=1;
  };
  await assert.rejects(scene.move(16,16,128,128),/seam differs/);
  assert.equal(scene.active,old);assert.equal(scene.identity,'generation-1');
});
test('height-byte seams distinguish geometry from recomputed shading and the opaque saved word',async()=>{
  const source=provider(),original=source.withSnapshot;
  source.withSnapshot=consume=>original(snapshot=>consume({...snapshot,async readWindow(wx,wy){
    const value=await snapshot.readWindow(wx,wy);
    if(wx===0&&wy===0){value.vertices[4]^=1;value.vertices[5]^=1;}
    return value;
  }}));
  const geometry=new NativeTerrainScene(source,{seamPolicy:'height-bytes'});
  await geometry.move(16,16,128,128);const old=geometry.active;assert.equal(geometry.active.size,49);
  const exact=new NativeTerrainScene(source,{seamPolicy:'exact-vertices'});
  await assert.rejects(exact.move(16,16,128,128),/seam differs/);assert.equal(exact.active.size,0);
  source.identity='generation-2';source.withSnapshot=consume=>original(snapshot=>consume({...snapshot,async readWindow(wx,wy){
    const value=await snapshot.readWindow(wx,wy);if(wx===0&&wy===0)value.vertices[0]^=1;return value;
  }}));
  await assert.rejects(geometry.move(16,16,128,128),/seam differs/);
  assert.equal(geometry.active,old);assert.equal(geometry.identity,'generation-1');
  assert.ok(geometry.residentHighWater<=MAX_NATIVE_RESIDENT_WINDOWS);
});
test('failed incoming reads preserve the complete old scene and identity, then permit retry',async()=>{
  const source=provider(),scene=new NativeTerrainScene(source);await scene.move(16,16,128,128);
  const old=scene.active;source.identity='generation-2';source.failAt=source.reads+4;
  await assert.rejects(scene.move(10000,10000,128,128),/read failed/);
  assert.equal(scene.active,old);assert.equal(scene.identity,'generation-1');
  assert.equal(scene.residentWindows,49);assert.equal(scene.residentBytes,49*MAX_TERRAIN_WINDOW_BYTES);
  source.failAt=Infinity;await scene.move(10000,10000,128,128);assert.notEqual(scene.active,old);
});
test('failure after extraction but before snapshot cleanup succeeds cannot publish a new scene',async()=>{
  const source=provider(),scene=new NativeTerrainScene(source);await scene.move(16,16,128,128);
  const old=scene.active;source.identity='generation-2';source.releaseFail=true;
  await assert.rejects(scene.move(10000,10000,128,128),/lease cleanup failed/);
  assert.equal(scene.active,old);assert.equal(scene.identity,'generation-1');
  source.releaseFail=false;await scene.move(10000,10000,128,128);assert.equal(scene.identity,'generation-2');
});
test('missing and repeated snapshot callbacks cannot damage the previous scene',async()=>{
  const source=provider(),scene=new NativeTerrainScene(source);await scene.move(16,16,128,128);const old=scene.active;
  source.withSnapshot=async()=>({next:new Map(),identity:'forged'});
  await assert.rejects(scene.move(32,32,128,128),/snapshot unavailable/);assert.equal(scene.active,old);
  source.withSnapshot=async consume=>{const snapshot={identity:'new',readWindow:async(wx,wy)=>window(wx,wy)};
    assert.equal(await consume(snapshot),undefined,'provider does not receive the staged residency map');await consume(snapshot);};
  await assert.rejects(scene.move(32,32,128,128),/Multiple/);assert.equal(scene.active,old);
});
test('snapshot generation is captured before asynchronous window reads',async()=>{
  const snapshot={identity:'captured',async readWindow(wx,wy){snapshot.identity='later';return window(wx,wy);}};
  const scene=new NativeTerrainScene({withSnapshot:consume=>consume(snapshot)});
  await scene.move(16,16,32,32);assert.equal(scene.identity,'captured');
});
test('thousands of pending moves retain one destination and execute only the final request',async()=>{
  const source=provider(),entered=defer(),finish=defer(),original=source.withSnapshot;let held=false;
  source.withSnapshot=async consume=>{if(!held){held=true;entered.resolve();await finish.promise;}return original(consume);};
  const scene=new NativeTerrainScene(source),first=scene.move(16,16,128,128);await entered.promise;
  const pending=scene.move(256,256,128,128);
  for(let i=1;i<=10000;++i)assert.equal(scene.move(i*256+16,i*256+16,128,128),pending);
  assert.equal(scene.pendingOperations,1);finish.resolve();await first;
  assert.deepEqual(await pending,{x:2560016,y:2560016});
  assert.equal(source.reads,98);assert.equal(scene.pendingOperations,0);assert.equal(scene.pendingHighWater,1);
});
test('invalid viewports and world positions open no snapshot',async()=>{
  let snapshots=0;const scene=new NativeTerrainScene({withSnapshot(){++snapshots;assert.fail('invalid move reached storage');}});
  for(const args of [[0,0,129,128],[0,0,128,129],[0,0,0,10],[Infinity,0,10,10],[1e20,0,10,10]])await assert.rejects(scene.move(...args));
  assert.equal(snapshots,0);assert.equal(nativeVisibleWindows(-1,-1,128,128).length,49);
});
test('malformed windows and large backing arrays cannot replace an existing scene',async()=>{
  const source=provider(),scene=new NativeTerrainScene(source);await scene.move(16,16,128,128);const old=scene.active;
  for(const mutate of [v=>v.width=31,v=>v.x=1,v=>v.realmKey='bad',
    v=>v.vertices=new Uint8Array(1),v=>v.vertices=new Uint8Array(100000).subarray(0,33*33*9),
    v=>v.cells=new Uint8Array(new SharedArrayBuffer(32*32*5))]){
    source.withSnapshot=async consume=>consume({identity:'changed',async readWindow(wx,wy){const v=window(wx,wy);mutate(v);return v;}});
    await assert.rejects(scene.move(16,16,128,128));assert.equal(scene.active,old);
  }
});
test('absent realms remain unavailable and unsupported payload fields are not retained',async()=>{
  const scene=new NativeTerrainScene({withSnapshot:consume=>consume({identity:'unchanged',async readWindow(wx,wy){
    if(wx!==0||wy!==0)return null;return {...window(wx,wy),unsupported:new Uint8Array(100000)};
  }})});
  await scene.move(16,16,128,128);assert.equal(scene.active.size,49);assert.equal(scene.activeBytes,MAX_TERRAIN_WINDOW_BYTES);
  assert.equal(scene.active.get('1,0'),null);assert.equal('unsupported' in scene.active.get('0,0'),false);
});
test('paired projection extracts either saved kingdom under a lease and reloads a published generation',async()=>{
  const f=diskFixture(),old=await f.commit([1,2]),provider=pairedTerrainProvider(f.store,{realmWidth:64,realmHeight:64});
  const scene=new NativeTerrainScene(provider);await scene.move(16,16,32,32);
  assert.equal(scene.active.get('0,0').vertices[0],1);
  await scene.move(96,16,32,32);assert.equal(scene.active.has('0,0'),false);assert.equal(scene.active.get('2,0').cells[0],2);
  await scene.move(16,16,32,32);assert.equal(scene.active.get('0,0').vertices[0],1);
  const before=scene.active.get('0,0');await f.commit([3,4],old.manifest);
  await scene.move(16,16,32,32);assert.notEqual(scene.active.get('0,0'),before);assert.equal(scene.active.get('0,0').vertices[0],3);
  assert.ok(f.largestRead<=4096);assert.equal(f.busy,false);
  const restored=new NativeTerrainScene(provider);await restored.move(96,16,32,32);assert.equal(restored.active.get('2,0').cells[0],4);
});
test('paired snapshot rejects changed layouts and expired consumers, including absent-realm lookups',async()=>{
  const f=diskFixture();await f.commit([1,2]);
  await assert.rejects(pairedTerrainProvider(f.store).withSnapshot(()=>assert.fail('wrong-sized kingdom accepted')),/dimensions/);
  for(const size of [0,33,1025])assert.throws(()=>pairedTerrainProvider(f.store,{realmWidth:size}),/layout/);
  let snapshot;
  await pairedTerrainProvider(f.store,{realmWidth:64,realmHeight:64}).withSnapshot(async value=>{
    snapshot=value;await assert.rejects(f.store.read(),/busy/);assert.equal(await value.readWindow(999,999),null);
  });
  await assert.rejects(snapshot.readWindow(0,0),/lease ended/);await assert.rejects(snapshot.readWindow(999,999),/lease ended/);
});
test('opposite-side corruption blocks all scene replacement while preserving already loaded bytes',async()=>{
  const f=diskFixture(),record=await f.commit([1,2]),scene=new NativeTerrainScene(pairedTerrainProvider(f.store,{realmWidth:64,realmHeight:64}));
  await scene.move(16,16,32,32);const old=scene.active;
  const opposite=f.files.get(`Frontier_Transfer_Destination_${record.slot}.GMP`);opposite[0]^=1;
  await assert.rejects(scene.move(32,16,32,32),/Damaged selected/);assert.equal(scene.active,old);
  assert.equal(scene.active.get('0,0').vertices[0],1);
});
test('negative realm coordinates map to local windows without translating native save bytes',async()=>{
  const bytes=save(7),source={size:bytes.length,async readAt(at,n){return bytes.subarray(at,at+n);}};
  const store={withSelected:consume=>consume({record:{regions:['-1_0','0_0'],manifest:'owned-negative-pair'},sources:[source,source]})};
  const provider=pairedTerrainProvider(store,{realmWidth:64,realmHeight:64});
  await provider.withSnapshot(async snapshot=>{
    const value=await snapshot.readWindow(-1,0);assert.equal(value.x,32);assert.equal(value.realmKey,'-1_0');assert.equal(value.vertices[0],7);
    const other=await snapshot.readWindow(0,0);assert.equal(other.x,0);assert.equal(other.realmKey,'0_0');
  });
  const farStore={withSelected:consume=>consume({record:{regions:['999913_999914','999912_999914'],manifest:'owned-browser-pair'},sources:[source,source]})};
  await pairedTerrainProvider(farStore,{realmWidth:64,realmHeight:64}).withSnapshot(async snapshot=>{
    const value=await snapshot.readWindow(999913*2,999914*2);
    assert.equal(value.realmKey,'999913_999914');assert.equal(value.x,0);assert.equal(value.y,0);
  });
});
