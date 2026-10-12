import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NativeRealmStore,parseRealmManifest,realmFiles,opfsRealmStorage} from '../web/world/realm-store.mjs';
import {realmTerrainProvider} from '../web/world/realm-terrain.mjs';
import {NativeTerrainScene} from '../web/world/terrain-scene.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(){
  const files=new Map();let locked=false,largestRead=0,reads=0,writes=0;
  const source=bytes=>({size:bytes.length,async readAt(at,n){++reads;largestRead=Math.max(largestRead,n);return bytes.subarray(at,at+n);}});
  const io={async withLock(mode,fn){if(locked)throw new Error('world busy');locked=true;try{return await fn();}finally{locked=false;}},
    async open(name){return files.has(name)?source(files.get(name)):null;},
    async atomicWrite(name,fn){const pieces=[];await fn({write:async bytes=>pieces.push(Buffer.from(bytes))});files.set(name,Buffer.concat(pieces));++writes;}};
  const store=new NativeRealmStore(io,{content:'owned-content'});
  return {files,source,io,store,get largestRead(){return largestRead;},get reads(){return reads;},get writes(){return writes;},
    commit:(key,bytes,expectedManifest=null,boundary)=>store.commit(key,{source:source(bytes),sha256:sha(bytes),expectedManifest},boundary)};
}
function chunk(tag,version,count,...parts){
  const body=Buffer.concat(parts),head=Buffer.alloc(16);head.write(tag);head.writeUInt32LE(body.length,4);head.writeUInt32LE(version,8);head.writeUInt32LE(count,12);
  return Buffer.concat([head,body]);
}
function saved(marker){const map=Buffer.alloc(40);map.writeUInt32LE(32);map.writeUInt32LE(32,4);
  return Buffer.concat([chunk('VERS',1,0,Buffer.alloc(256)),chunk('MAP ',0,1,chunk('PRIM',2,0,map)),
    chunk('MTER',0,2,chunk('MVTX',0,1,chunk('PRIM',2,1089,Buffer.alloc(1089*9,marker))),
      chunk('MCEL',0,1,chunk('PRIM',5,1024,Buffer.alloc(1024*5,marker))))]);}

test('regional readers use the captured source that passed validation without reopening its path',async()=>{
  const f=fixture(),bytes=saved(1),record=await f.commit('0_0',bytes);
  const name=realmFiles('0_0').slots[record.slot],open=f.io.open;
  let opens=0,reader;
  f.io.open=async path=>{
    if(path!==name)return open(path);
    ++opens;
    const captured=f.files.get(path);
    return {size:captured.length,async readAt(at,n){
      const result=captured.subarray(at,at+n);
      if(at+n===captured.length)f.files.set(path,Buffer.alloc(captured.length,99));
      return result;
    }};
  };
  await f.store.withRegions(['0_0'],async selected=>{
    reader=selected.get('0_0').source;
    assert.equal(sha(await reader.readAt(0,256)),sha(bytes.subarray(0,256)));
  });
  assert.equal(opens,1);
  await assert.rejects(reader.readAt(0,1),/lease ended/);
  await assert.rejects(f.store.read('0_0'),/Damaged native realm snapshot/);
});

test('independent regions use native checkpoint manifests, bound reads and reuse two slots',async()=>{
  const f=fixture();let head=await f.commit('0_0',saved(1));await f.commit('1_0',saved(2));const other=await f.store.read('1_0');
  for(let marker=3;marker<=20;++marker)head=await f.commit('0_0',saved(marker),head.manifest);
  assert.equal(f.files.size,5,'two data slots + marker for edited realm; one slot + marker for other realm');
  assert.deepEqual(await f.store.read('1_0'),other);assert.ok(f.largestRead<=4096);
  const writes=f.writes;assert.equal((await f.commit('0_0',saved(20),null)).idempotent,true);assert.equal(f.writes,writes);
  await assert.rejects(f.commit('0_0',saved(21),null),/changed/);
  assert.equal(parseRealmManifest(head.manifest,'owned-content').sha256,sha(saved(20)));
});
test('failure before publication preserves old region; failure after publication is recovered idempotently',async()=>{
  for(const fault of ['before-publish','after-publish']){
    const f=fixture(),old=await f.commit('0_0',saved(1));
    await assert.rejects(f.commit('0_0',saved(2),old.manifest,at=>{if(at===fault)throw new Error(fault);}),new RegExp(fault));
    const fresh=new NativeRealmStore(f.io,{content:'owned-content'}),selected=await fresh.read('0_0');
    assert.equal(selected.sha256,sha(saved(fault==='before-publish'?1:2)));
    const writes=f.writes;if(fault==='after-publish'){assert.equal((await f.commit('0_0',saved(2),old.manifest)).idempotent,true);assert.equal(f.writes,writes);}
  }
});
test('digest failure cannot replace an existing region checkpoint',async()=>{
  const f=fixture(),old=await f.commit('0_0',saved(1));
  await assert.rejects(f.store.commit('0_0',{source:f.source(saved(2)),sha256:sha(saved(3)),expectedManifest:old.manifest}),/digest mismatch/);
  assert.deepEqual(await f.store.read('0_0'),parseRealmManifest(old.manifest,'owned-content'));
});
test('world lease protects all selected regions, excludes a different-region writer, and expires readers',async()=>{
  const f=fixture();await f.commit('0_0',saved(1));let reader,record;
  await f.store.withRegions(['0_0','1_0'],async selected=>{
    assert.equal(selected.get('1_0'),null);reader=selected.get('0_0').source;record=selected.get('0_0').record;
    assert.equal(Object.isFrozen(record),true);assert.equal((await reader.readAt(0,4)).length,4);
    await assert.rejects(f.commit('2_0',saved(2)),/busy/);await assert.rejects(reader.readAt(0,4097),/bounds/);
  });
  await assert.rejects(reader.readAt(0,4),/lease ended/);assert.equal(record.sha256,sha(saved(1)));
});
test('invalid keys, excessive sets and malformed predecessor metadata perform no file I/O',async()=>{
  const f=fixture();
  for(const key of ['../0_0','00_0','-0_0','1000001_0'])await assert.rejects(f.commit(key,saved(1)));
  for(const keys of [null,['0_0','0_0'],['bad'],Array.from({length:50},(_,i)=>`${i}_0`)])
    await assert.rejects(f.store.withRegions(keys,()=>assert.fail('bad request accepted')));
  await assert.rejects(f.commit('0_0',saved(1),'bad manifest'));
  assert.equal(f.reads,0);assert.equal(f.writes,0);
});
test('manifest length, content and selected-file corruption are rejected before callback or replacement',async()=>{
  const f=fixture(),old=await f.commit('0_0',saved(1)),names=realmFiles('0_0');
  for(const text of [old.manifest.replace('owned-content','other'),old.manifest.replace('\n0\n','\n9\n'),old.manifest.replace('checkpoint-v1','checkpoint-v2')])
    assert.throws(()=>parseRealmManifest(text,'owned-content'));
  const marker=f.files.get(names.marker);f.files.set(names.marker,Buffer.alloc(512));const before=f.reads;
  await assert.rejects(f.store.read('0_0'),/manifest size/);assert.equal(f.reads,before);
  f.files.set(names.marker,marker);f.files.get(names.slots[old.slot])[0]^=1;
  await assert.rejects(f.store.withRegions(['0_0'],()=>assert.fail('damaged world entered')),/Damaged/);
  await assert.rejects(f.commit('0_0',saved(2),old.manifest),/Damaged/);
});
test('realm terrain covers more than two saves, discovers new saved realms and reuses unchanged neighbours',async()=>{
  const f=fixture();for(let x=0;x<3;++x)await f.commit(`${x}_0`,saved(x+1));
  const scene=new NativeTerrainScene(realmTerrainProvider(f.store,{realmWidth:32,realmHeight:32}));
  await scene.move(16,16,32,32);const neighbour=scene.active.get('1,0');assert.equal(scene.active.get('0,0').cells[0],1);
  await scene.move(80,16,32,32);assert.equal(scene.active.get('1,0'),neighbour);assert.equal(scene.active.get('2,0').cells[0],3);
  assert.equal(scene.active.get('3,0'),null);await f.commit('3_0',saved(4));
  await scene.move(80,16,32,32);assert.equal(scene.active.get('1,0'),neighbour);assert.equal(scene.active.get('3,0').vertices[0],4);
  const before=scene.active.get('2,0'),record=await f.store.read('2_0');await f.commit('2_0',saved(7),record.manifest);
  await scene.move(80,16,32,32);assert.notEqual(scene.active.get('2,0'),before);assert.equal(scene.active.get('1,0'),neighbour);
  const fresh=new NativeTerrainScene(realmTerrainProvider(new NativeRealmStore(f.io,{content:'owned-content'}),{realmWidth:32,realmHeight:32}));
  await fresh.move(80,16,32,32);assert.equal(fresh.active.get('3,0').vertices[0],4);assert.equal(fresh.active.get('2,0').vertices[0],7);
});
test('a full scene reads only its bounded realm set and retains no directory catalogue',async()=>{
  const f=fixture();for(let y=-3;y<=3;++y)for(let x=-3;x<=3;++x)await f.commit(`${x}_${y}`,saved(1));
  const original=f.store.withRegions.bind(f.store);let largestSet=0;
  f.store.withRegions=(keys,consume)=>{largestSet=Math.max(largestSet,keys.length);return original(keys,consume);};
  const scene=new NativeTerrainScene(realmTerrainProvider(f.store,{realmWidth:32,realmHeight:32}));
  await scene.move(16,16,128,128);assert.equal(scene.active.size,49);assert.equal(scene.activeBytes,731129);assert.equal(largestSet,49);
  await scene.move(10000,10000,128,128);assert.equal(scene.activeBytes,0);assert.equal(scene.active.size,49);assert.equal(largestSet,49);
  await scene.move(16,16,128,128);assert.equal(scene.activeBytes,731129);assert.ok(scene.residentWindows<=98);
});
test('realm snapshots reject requests outside their captured scene and expire every accessor',async()=>{
  const f=fixture();await f.commit('0_0',saved(1));const provider=realmTerrainProvider(f.store,{realmWidth:32,realmHeight:32});let captured;
  await provider.withSnapshot(async snapshot=>{
    captured=snapshot;assert.throws(()=>snapshot.windowIdentity(1,0),/outside/);await assert.rejects(snapshot.readWindow(1,0),/outside/);
    assert.equal((await snapshot.readWindow(0,0)).cells[0],1);
  },{windows:[[0,0]]});
  assert.throws(()=>captured.windowIdentity(0,0),/lease ended/);await assert.rejects(captured.readWindow(0,0),/lease ended/);
  for(const windows of [null,[[0,0],[0,0]],[[0,0,1]],Array.from({length:50},(_,i)=>[i,0])])await assert.rejects(provider.withSnapshot(()=>{}, {windows}));
});
test('world-scoped OPFS adapter uses an immediate shared/exclusive lock without queued requests',async()=>{
  const calls=[],locks={request(name,options,fn){calls.push({name,options});return fn({});}};
  const io=opfsRealmStorage({getFileHandle(){}},'test-world',locks);await io.withLock('shared',()=>42);
  assert.deepEqual(calls,[{name:'majesty-pair-native-world-test-world',options:{mode:'shared',ifAvailable:true}}]);
  assert.throws(()=>opfsRealmStorage({},'../world',locks));
});
test('incomplete and excessive adapter results do not publish a partially regenerated scene',async()=>{
  for(const result of [new Map(),new Map([['0_0',null],['1_0',null]])]){
    const provider=realmTerrainProvider({withRegions:(keys,consume)=>consume(result)},{realmWidth:32,realmHeight:32});
    await assert.rejects(provider.withSnapshot(()=>assert.fail('bad set accepted'),{windows:[[0,0]]}),/Incomplete/);
  }
});
test('unmarked files are preserved; an identical first-publication retry reuses its staged bytes',async()=>{
  const f=fixture(),names=realmFiles('0_0'),legacy=saved(1);f.files.set(names.slots[0],legacy);
  await assert.rejects(f.commit('0_0',saved(2)),/Unregistered/);assert.equal(f.files.get(names.slots[0]),legacy);assert.equal(f.writes,0);
  const g=fixture();g.files.set(names.slots[1],legacy);
  await assert.rejects(g.commit('0_0',legacy),/Unregistered/);assert.equal(g.files.get(names.slots[1]),legacy);assert.equal(g.writes,0);
  const h=fixture();await assert.rejects(h.commit('0_0',legacy,null,at=>{if(at==='before-publish')throw new Error('interrupted');}),/interrupted/);
  const before=h.writes;await h.commit('0_0',legacy);assert.equal(h.writes,before+1,'retry writes only the marker');
  assert.equal((await h.store.read('0_0')).sha256,sha(legacy));
});
