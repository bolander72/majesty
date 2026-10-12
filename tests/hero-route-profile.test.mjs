import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,world,source,hash} from './fixtures/registered-hero-world.mjs';
import {HeroRouteStore,HERO_ROUTE_HEAD,HERO_ROUTE_IDENTITY,openHeroRouteStore} from '../web/world/hero-route-store.mjs';
import {opfsHeroRouteStorage,openNativeHeroRouteStore,heroRouteDirectory,heroRouteFilename} from '../web/world/hero-route-profile.mjs';
import {pairedLockName} from '../web/world/transfer-store.mjs';

let next=0;
const operation=n=>n.toString(16).padStart(64,'0');
async function setup(){
  const f=await fixture(),name='custody-'+(++next),files=new Map(),folders=new Set(['']),calls=[];
  let held=null,creationFailure=false,closeFailure=false;
  const missing=()=>Object.assign(Error('missing'),{name:'NotFoundError'});
  const directory=prefix=>({
    async getDirectoryHandle(name,options){
      const path=prefix?prefix+'/'+name:name;calls.push({directory:path,create:!!options?.create});
      if(!folders.has(path)){if(!options?.create)throw missing();folders.add(path);}return directory(path);
    },
    async getFileHandle(name,options){
      const path=prefix+'/'+name;calls.push({file:path,create:!!options?.create});
      if(!files.has(path)){if(!options?.create)throw missing();files.set(path,Buffer.alloc(0));}
      return {
        async getFile(){const bytes=Buffer.from(files.get(path));return {size:bytes.length,slice(at,end){
          calls.push({read:path,at,n:end-at});return {async arrayBuffer(){return Uint8Array.from(bytes.subarray(at,end)).buffer;}};
        }};},
        async createWritable(){
          if(creationFailure)throw Error('stream creation failed');let parts=[],closed=false;
          return {
            async write(bytes){assert.ok(!closed);calls.push({write:path,n:bytes.length});parts.push(Buffer.from(bytes));},
            async close(){
              if(closeFailure===true)throw Error('stream close failed');assert.ok(!closed);
              files.set(path,Buffer.concat(parts));closed=true;parts=[];calls.push({close:path});
              if(closeFailure===name+':after')throw Error('close receipt lost');
            },
            async abort(){closed=true;parts=[];calls.push({abort:path});},
          };
        },
      };
    },
    async removeEntry(name){files.delete(prefix+'/'+name);calls.push({remove:prefix+'/'+name});},
  });
  const locks={async request(lock,options,consume){
    calls.push({lock,...options});if(held!==null)return consume(null);
    held=lock;try{return await consume({});}finally{held=null;}
  }};
  const profiles=directory(''),io=opfsHeroRouteStorage(profiles,name,f.identity.entityId,locks);
  const store=new HeroRouteStore(io,f.identity,f.identity.contentDigest);
  const request={kind:'seed',operationId:operation(1),expectedManifest:null,regions:['0_0'],
    aliases:[{unitId:502,agentId:27}],homeAliases:[{kind:'native',unitId:469,agentId:7}],
    worlds:[{source:source(f.worlds[0]),sha256:hash(f.worlds[0])}]};
  const expected={worldId:f.identity.registeredHome.worldId,entityId:f.identity.entityId,contentDigest:f.identity.contentDigest};
  const base='native-world-'+name+'/'+heroRouteDirectory(f.identity.entityId);
  return {...f,name,files,folders,calls,profiles,locks,io,store,request,expected,base,
    setBusy(value){held=value;},failCreation(value){creationFailure=value;},failClose(value){closeFailure=value;},
    path:file=>base+'/'+file};
}

test('opening a stored route reads only its canonical identity under the world lock',async()=>{
  const f=await setup();await f.store.commit(f.request);f.calls.length=0;
  const reopened=await openNativeHeroRouteStore(f.profiles,f.name,f.expected,{locks:f.locks});
  assert.deepEqual(reopened.identity,f.identity);
  assert.deepEqual(f.calls.filter(c=>c.read).map(c=>c.read),[f.path(HERO_ROUTE_IDENTITY)]);
  assert.ok(f.calls.every(c=>!c.create));
  assert.deepEqual(f.calls.filter(c=>c.lock),[{lock:pairedLockName('native-world-'+f.name),mode:'shared',ifAvailable:true}]);
  const selected=await reopened.read();assert.equal(selected.owner.region,'0_0');
  assert.ok(f.calls.filter(c=>c.read).every(c=>c.n<=4096));
});

test('browser route publication, interruption and retry preserve one owner and two slots per region',async()=>{
  for(const boundary of ['after-source','after-destination','before-publish','after-publish']){
    const f=await setup(),h=await f.store.commit(f.request);
    const bytes=[world(0,false,{registration:f.registration}),world(1,true,{registration:f.registration})];
    const request={kind:'handoff',operationId:operation(2),expectedManifest:h.manifest,regions:['0_0','1_0'],
      aliases:[{unitId:502,agentId:27},{unitId:602,agentId:37}],
      homeAliases:[{kind:'native',unitId:469,agentId:7},{kind:'proxy',unitId:0,agentId:45}],
      worlds:bytes.map(b=>({source:source(b),sha256:hash(b)}))};
    await assert.rejects(f.store.commit(request,async stage=>{if(stage===boundary)throw Error('interrupted');}),/interrupted/);
    const reopened=await openNativeHeroRouteStore(f.profiles,f.name,f.expected,{locks:f.locks});
    assert.equal((await reopened.read()).owner.region,boundary==='after-publish'?'1_0':'0_0');
    const result=await reopened.commit(request);assert.equal(result.idempotent,boundary==='after-publish');
    assert.equal((await reopened.read()).owner.region,'1_0');
    assert.equal([...f.files.keys()].filter(name=>name.endsWith('.GMP')).length,3);
    assert.ok(f.calls.filter(c=>c.write).every(c=>c.n<=4096));
    assert.ok([...f.files.keys()].every(name=>name.startsWith(f.base+'/')));
  }
});

test('wrong world, hero or content and replaced identities refuse before any checkpoint read',async()=>{
  const f=await setup();await f.store.commit(f.request);
  for(const key of ['worldId','entityId','contentDigest']){
    f.calls.length=0;
    await assert.rejects(openHeroRouteStore(f.io,{...f.expected,[key]:'f'.repeat(64)}),/identity differs/);
    assert.ok(!f.calls.some(c=>c.read?.endsWith('.GMP')));
  }
  const reopened=await openHeroRouteStore(f.io,f.expected),bytes=f.files.get(f.path(HERO_ROUTE_IDENTITY));
  f.files.set(f.path(HERO_ROUTE_IDENTITY),Buffer.from(bytes.toString().replace(f.identity.contentDigest,'f'.repeat(64))));
  await assert.rejects(reopened.read(),/identity|registered|origin/i);
  f.files.set(f.path(HERO_ROUTE_IDENTITY),bytes);assert.equal((await reopened.read()).owner.region,'0_0');
});

test('another hero cannot create a separate kingdom history inside the same named world',async()=>{
  const f=await setup();await f.store.commit(f.request);const paths=[...f.files.keys()];
  const other=opfsHeroRouteStorage(f.profiles,f.name,'f'.repeat(64),f.locks);
  await assert.rejects(openHeroRouteStore(other,{...f.expected,entityId:'f'.repeat(64)}),/identity differs/);
  assert.deepEqual([...f.files.keys()],paths);assert.equal(f.folders.size,3);
  assert.equal(heroRouteDirectory(f.identity.entityId),heroRouteDirectory('f'.repeat(64)));
});

test('missing, oversized, malformed and noncanonical identities do not create directories or files',async()=>{
  const f=await setup();
  await assert.rejects(openNativeHeroRouteStore(f.profiles,f.name,f.expected,{locks:f.locks}),/metadata/);
  assert.equal(f.files.size,0);assert.equal(f.folders.size,1);
  await f.store.commit(f.request);const original=f.files.get(f.path(HERO_ROUTE_IDENTITY));
  for(const bytes of [Buffer.alloc(4097),Buffer.from('{'),Buffer.from(original.toString().trim())]){
    f.files.set(f.path(HERO_ROUTE_IDENTITY),bytes);f.calls.length=0;
    await assert.rejects(openHeroRouteStore(f.io,f.expected));assert.ok(f.calls.every(c=>!c.create));
    assert.ok(!f.calls.some(c=>c.read?.endsWith('.GMP')));
  }
});

test('a live world lease refuses custody reads and writes before OPFS lookup',async()=>{
  const f=await setup();f.setBusy(pairedLockName('native-world-'+f.name));
  await assert.rejects(openHeroRouteStore(f.io,f.expected),/busy/);
  await assert.rejects(f.store.commit(f.request),/busy/);
  assert.ok(f.calls.every(c=>c.lock));assert.equal(f.files.size,0);
});

test('unlocked operations, shared writes, traversal names and expired readers refuse',async()=>{
  const f=await setup();await f.store.commit(f.request);
  await assert.rejects(f.io.open(HERO_ROUTE_HEAD),/world lock/);
  await assert.rejects(f.io.atomicWrite(HERO_ROUTE_HEAD,()=>{}),/world lock/);
  for(const name of ['../profile/Frontier_Hero_Route.checkpoint','Frontier_0_0.GMP',
    'Frontier_Hero_Route_Node_01.json','Frontier_Hero_Route_Node_4294967296.json',
    'Frontier_Hero_Route_-0_0_0.GMP','Frontier_Hero_Route_01_0_0.GMP','Frontier_Hero_Route_1000001_0_0.GMP'])
    assert.throws(()=>heroRouteFilename(name));
  let escaped;
  await f.io.withLock('shared',async()=>{
    await assert.rejects(f.io.atomicWrite(HERO_ROUTE_HEAD,()=>{}),/world lock/);
    escaped=await f.io.open(HERO_ROUTE_IDENTITY);
    await assert.rejects(escaped.readAt(0,4097),/Unbounded/);
  });
  await assert.rejects(escaped.readAt(0,4),/world lock|lease ended/);
  await f.io.withLock('shared',async()=>assert.rejects(escaped.readAt(0,4),/lease ended/));
});

test('failed new writes remove their empty handle and preserve a pre-existing selected file',async()=>{
  const f=await setup();await f.store.commit(f.request);
  const selected=Buffer.from(f.files.get(f.path(HERO_ROUTE_HEAD)));
  for(const name of [HERO_ROUTE_HEAD,'Frontier_Hero_Route_Node_99.json']){
    await assert.rejects(f.io.withLock('exclusive',()=>f.io.atomicWrite(name,async sink=>{
      await sink.write(new Uint8Array([1,2,3]));throw Error('write failed');
    })),/write failed/);
  }
  assert.deepEqual(f.files.get(f.path(HERO_ROUTE_HEAD)),selected);
  assert.ok(!f.files.has(f.path('Frontier_Hero_Route_Node_99.json')));
  f.failCreation(true);
  await assert.rejects(f.io.withLock('exclusive',()=>f.io.atomicWrite('Frontier_Hero_Route_Node_99.json',()=>{})),/creation failed/);
  assert.ok(!f.files.has(f.path('Frontier_Hero_Route_Node_99.json')));
  f.failCreation(false);
  await assert.rejects(f.io.withLock('exclusive',()=>f.io.atomicWrite('Frontier_Hero_Route_Node_99.json',async sink=>{
    await sink.write(new Uint8Array(4096));await sink.write(new Uint8Array(1));
  })),/Unbounded/);
  assert.ok(!f.files.has(f.path('Frontier_Hero_Route_Node_99.json')));
  assert.equal((await f.store.read()).owner.region,'0_0');
});

test('already cancelled discovery performs no OPFS lookup or lock acquisition',async()=>{
  const f=await setup(),controller=new AbortController();controller.abort(new Error('page closed'));
  assert.throws(()=>openNativeHeroRouteStore(f.profiles,f.name,f.expected,{locks:f.locks,signal:controller.signal}),/page closed/);
  assert.equal(f.calls.length,0);
});

test('uncertain close preserves potentially published files and journal retry selects the actual owner',async()=>{
  const f=await setup(),h=await f.store.commit(f.request);
  const bytes=[world(0,false,{registration:f.registration}),world(1,true,{registration:f.registration})];
  const request={kind:'handoff',operationId:operation(2),expectedManifest:h.manifest,regions:['0_0','1_0'],
    aliases:[{unitId:502,agentId:27},{unitId:602,agentId:37}],
    homeAliases:[{kind:'native',unitId:469,agentId:7},{kind:'proxy',unitId:0,agentId:45}],
    worlds:bytes.map(b=>({source:source(b),sha256:hash(b)}))};
  f.failClose(HERO_ROUTE_HEAD+':after');await assert.rejects(f.store.commit(request),/receipt lost/);
  f.failClose(false);const reopened=await openNativeHeroRouteStore(f.profiles,f.name,f.expected,{locks:f.locks});
  assert.equal((await reopened.read()).owner.region,'1_0');
  const writes=f.calls.filter(c=>c.write).length;assert.equal((await reopened.commit(request)).idempotent,true);
  assert.equal(f.calls.filter(c=>c.write).length,writes);
  f.failClose('Frontier_Hero_Route_Node_99.json:after');
  await assert.rejects(f.io.withLock('exclusive',()=>f.io.atomicWrite('Frontier_Hero_Route_Node_99.json',
    sink=>sink.write(new Uint8Array([1,2,3])))),/receipt lost/);
  assert.deepEqual(f.files.get(f.path('Frontier_Hero_Route_Node_99.json')),Buffer.from([1,2,3]));
});
