import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareNativeHeroOwnerRestore,prepareNativeHeroCurrentOwnerRestore} from '../web/world/hero-route-restore.mjs';
import {browserWorldStorage} from './fixtures/browser-world-storage.mjs';
import {realmFiles} from '../web/world/realm-store.mjs';
import {source,hash} from './fixtures/registered-hero-world.mjs';
import {pairedLockName} from '../web/world/transfer-store.mjs';

test('explicit manifest preparation cannot silently switch to selecting the current owner',async()=>{
  const f=await browserWorldStorage();f.calls.length=0;
  assert.throws(()=>prepareNativeHeroOwnerRestore(f.profiles,f.world,{...f.request,expectedOwnerManifest:null},{locks:f.locks}),/Invalid/);
  assert.throws(()=>prepareNativeHeroCurrentOwnerRestore(f.profiles,f.world,f.request,{locks:f.locks}),/selects its own manifest/);
  assert.equal(f.calls.length,0);
});

test('selected custody owner reaches the native loader profile under one exclusive world lease',async()=>{
  const f=await browserWorldStorage(),before=f.snapshot();f.calls.length=0;
  const r=await prepareNativeHeroOwnerRestore(f.profiles,f.world,f.request,{locks:f.locks});
  assert.equal(r.ownerRevision,0);assert.equal(r.ownerManifest,f.head.manifest);assert.equal(r.region,'0_0');
  assert.equal(r.owner.unitId,502);assert.equal(r.owner.agentId,27);assert.equal(r.clock,3200);assert.equal(r.idempotent,false);
  assert.equal(r.sha256,hash(f.worlds[0]));assert.deepEqual(f.files.get(f.nativePath(realmFiles('0_0').slots[0])),f.worlds[0]);
  assert.deepEqual(f.snapshot(),before);assert.equal(f.calls.filter(c=>c.lock).length,1);
  assert.deepEqual(f.calls.find(c=>c.lock),{lock:pairedLockName('native-world-'+f.world),mode:'exclusive',ifAvailable:true});
  assert.ok(f.calls.filter(c=>c.file?.endsWith('.GMP')).every(c=>c.file.includes('_0_0_')||c.file===f.nativePath('Frontier_0_0.GMP')));
  f.assertBounded();assert.equal((await f.realms.read('0_0')).manifest,r.nativeManifest);
});

test('retrying an already prepared owner makes no writes and preserves both manifests',async()=>{
  const f=await browserWorldStorage(),first=await prepareNativeHeroOwnerRestore(f.profiles,f.world,f.request,{locks:f.locks});
  f.calls.length=0;const second=await prepareNativeHeroOwnerRestore(f.profiles,f.world,f.request,{locks:f.locks});
  assert.equal(second.idempotent,true);assert.equal(second.nativeManifest,first.nativeManifest);
  assert.equal(second.ownerManifest,first.ownerManifest);assert.ok(!f.calls.some(c=>c.write||c.close));
});

for(const phase of ['before-publish','after-publish'])test(`native projection interrupted ${phase} recovers without custody publication`,async()=>{
  const f=await browserWorldStorage(),before=f.snapshot();
  await assert.rejects(prepareNativeHeroOwnerRestore(f.profiles,f.world,f.request,{locks:f.locks,
    boundary:async stage=>{if(stage===phase)throw Error('interrupted');}}),/interrupted/);
  assert.deepEqual(f.snapshot(),before);
  const old=await f.realms.read('0_0');assert.equal(!!old,phase==='after-publish');
  const result=await prepareNativeHeroOwnerRestore(f.profiles,f.world,f.request,{locks:f.locks});
  assert.equal(result.idempotent,phase==='after-publish');assert.deepEqual(f.snapshot(),before);
  assert.equal((await f.realms.read('0_0')).sha256,hash(f.worlds[0]));
});

test('a different or evolved native kingdom is never replaced by an older custody snapshot',async()=>{
  const f=await browserWorldStorage(),changed=Buffer.from(f.worlds[0]);changed[40]^=1;
  await f.realms.commit('0_0',{source:source(changed),sha256:hash(changed),expectedManifest:null});
  const before=new Map(f.files);f.calls.length=0;
  await assert.rejects(prepareNativeHeroOwnerRestore(f.profiles,f.world,f.request,{locks:f.locks}),/different saved kingdom/);
  assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.write||c.create));
});

test('stale owner, another region, wrong identity, corrupt source and orphan saves refuse without writes',async()=>{
  for(const defect of ['manifest','region','world','entity','content','source','orphan']){
    const f=await browserWorldStorage(),r={...f.request};
    if(defect==='manifest')r.expectedOwnerManifest='stale';if(defect==='region')r.region='1_0';
    if(defect==='world')r.worldId='f'.repeat(64);if(defect==='entity')r.entityId='f'.repeat(64);
    if(defect==='content')r.contentDigest='f'.repeat(64);
    if(defect==='source')f.files.get(f.routePrefix+'Frontier_Hero_Route_0_0_0.GMP')[40]^=1;
    if(defect==='orphan')f.putNative('Frontier_0_0.GMP',Buffer.alloc(16));
    const before=new Map([...f.files].map(([name,b])=>[name,Buffer.from(b)]));f.calls.length=0;
    await assert.rejects(prepareNativeHeroOwnerRestore(f.profiles,f.world,r,{locks:f.locks}));
    assert.deepEqual(f.files,before,defect);assert.ok(!f.calls.some(c=>c.write||c.create),defect);
  }
});

test('busy games and already cancelled requests do not start profile I/O',async()=>{
  const f=await browserWorldStorage();f.calls.length=0;f.busy(true);
  await assert.rejects(prepareNativeHeroOwnerRestore(f.profiles,f.world,f.request,{locks:f.locks}),/busy/);
  assert.ok(f.calls.every(c=>c.lock));f.busy(false);f.calls.length=0;
  const controller=new AbortController();controller.abort(new Error('page closed'));
  assert.throws(()=>prepareNativeHeroOwnerRestore(f.profiles,f.world,f.request,{locks:f.locks,signal:controller.signal}),/page closed/);
  assert.equal(f.calls.length,0);
});

test('cancellation before publication keeps the selected custody owner and permits a safe retry',async()=>{
  const f=await browserWorldStorage(),controller=new AbortController(),before=f.snapshot();
  await assert.rejects(prepareNativeHeroOwnerRestore(f.profiles,f.world,f.request,{locks:f.locks,signal:controller.signal,
    boundary:async stage=>{if(stage==='before-publish')controller.abort(new Error('page closed'));}}),/page closed/);
  assert.equal(await f.realms.read('0_0'),null);assert.deepEqual(f.snapshot(),before);
  assert.equal((await prepareNativeHeroOwnerRestore(f.profiles,f.world,f.request,{locks:f.locks})).owner.unitId,502);
});

test('caller tokens are captured before asynchronous world-lock acquisition',async()=>{
  const f=await browserWorldStorage(),request={...f.request},locks=f.locks;let enter;
  const delayed={request(name,options,consume){return new Promise((resolve,reject)=>{
    enter=()=>locks.request(name,options,consume).then(resolve,reject);
  });}};
  const pending=prepareNativeHeroOwnerRestore(f.profiles,f.world,request,{locks:delayed});
  request.region='1_0';request.expectedOwnerManifest='stale';request.worldId='f'.repeat(64);enter();
  assert.equal((await pending).region,'0_0');
});
