import test from 'node:test';
import assert from 'node:assert/strict';
import {browserWorldStorage} from './fixtures/browser-world-storage.mjs';
import {world,source,hash} from './fixtures/registered-hero-world.mjs';
import {publishNativeHeroOwnerSave,publishNativeHeroCurrentOwnerSave} from '../web/world/hero-route-native-save.mjs';
import {prepareNativeHeroCurrentOwnerRestore} from '../web/world/hero-route-restore.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';

async function setup(clock=3300,options={}){
  const f=await browserWorldStorage({browserContent:true}),bytes=world(0,true,{variant:1,savedClock:clock,...options});
  const native=await f.realms.commit('0_0',{source:source(bytes),sha256:hash(bytes),expectedManifest:null});
  const request={worldId:f.request.worldId,entityId:f.request.entityId,content:f.request.content,region:'0_0',
    expectedOwnerManifest:f.head.manifest,expectedNativeManifest:native.manifest,operationId:'2'.padStart(64,'0')};
  f.calls.length=0;
  const publish=(r=request,options={})=>publishNativeHeroOwnerSave(f.profiles,f.world,r,{locks:f.locks,...options});
  return {...f,bytes,native,request,publish};
}

test('stopped native gameplay save advances custody and is ready for a later owner restore',async()=>{
  const f=await setup(),before=new Map([...f.files].filter(([name])=>!name.startsWith(f.routePrefix)));
  const r=await f.publish();assert.equal(r.ownerRevision,1);assert.equal(r.clock,3300);assert.equal(r.unchanged,false);
  assert.equal(r.idempotent,false);assert.equal(r.sha256,hash(f.bytes));assert.equal(f.calls.filter(c=>c.lock).length,1);
  assert.deepEqual(new Map([...f.files].filter(([name])=>!name.startsWith(f.routePrefix))),before);
  assert.equal(await f.route.withOwner(v=>checkpointSavedClock(v.source)),3300);
  assert.equal((await f.route.read()).record.manifest,r.ownerManifest);
  const restore=await prepareNativeHeroCurrentOwnerRestore(f.profiles,f.world,{worldId:f.request.worldId,
    entityId:f.request.entityId,contentDigest:f.identity.contentDigest,content:f.request.content,region:'0_0'},{locks:f.locks});
  assert.equal(restore.idempotent,true);assert.equal(restore.ownerRevision,1);assert.equal(restore.sha256,r.sha256);
  f.assertBounded();
});

test('lost publication acknowledgement retries the identical operation without adding a revision or writes',async()=>{
  const f=await setup();
  await assert.rejects(f.publish(f.request,{boundary:async phase=>{if(phase==='after-publish')throw Error('lost result');}}),/lost result/);
  assert.equal((await f.route.read()).record.revision,1);f.calls.length=0;
  const retry=await f.publish();assert.equal(retry.idempotent,true);assert.equal(retry.ownerRevision,1);
  assert.equal(retry.unchanged,false);assert.ok(!f.calls.some(c=>c.write||c.close));
});

for(const phase of ['after-source','before-publish'])test(`stopped native save interrupted ${phase} preserves the prior owner and recovers`,async()=>{
  const f=await setup();
  await assert.rejects(f.publish(f.request,{boundary:async at=>{if(at===phase)throw Error('interrupted');}}),/interrupted/);
  assert.equal((await f.route.read()).record.manifest,f.head.manifest);
  assert.equal((await f.realms.read('0_0')).manifest,f.native.manifest);
  assert.equal((await f.publish()).ownerRevision,1);f.assertBounded();
});

test('an unchanged native checkpoint creates no custody revision',async()=>{
  const f=await setup();
  const native=await f.realms.commit('0_0',{source:source(f.worlds[0]),sha256:hash(f.worlds[0]),expectedManifest:f.native.manifest});
  f.calls.length=0;const result=await f.publish({...f.request,expectedNativeManifest:native.manifest});
  assert.equal(result.unchanged,true);assert.equal(result.idempotent,true);assert.equal(result.ownerRevision,0);
  assert.equal(result.ownerManifest,f.head.manifest);assert.ok(!f.calls.some(c=>c.write||c.create));
});

test('rollback, stale tokens, incompatible content and changed hero ownership all refuse without writing',async()=>{
  for(const defect of ['clock','owner','native','content','region','alias','missing','corrupt','operation']){
    const f=await setup(defect==='clock'?3100:3300,defect==='alias'?{uid:503,gid:28}:{}),r={...f.request};
    if(defect==='owner')r.expectedOwnerManifest='stale';
    if(defect==='native')r.expectedNativeManifest=r.expectedNativeManifest.replace(hash(f.bytes),'0'.repeat(64));
    if(defect==='content')r.content='f'.repeat(64)+':'+'e'.repeat(64);
    if(defect==='region')r.region='1_0';
    if(defect==='missing')for(const name of [...f.files.keys()])if(!name.startsWith(f.routePrefix))f.files.delete(name);
    if(defect==='corrupt')f.files.get(f.nativePath('Frontier_0_0.GMP'))[40]^=1;
    if(defect==='operation'){
      await f.publish();r.operationId=f.request.operationId;r.expectedOwnerManifest='different intent';
    }
    const before=new Map([...f.files].map(([n,b])=>[n,Buffer.from(b)]));f.calls.length=0;
    await assert.rejects(async()=>f.publish(r),undefined,defect);
    assert.deepEqual(f.files,before,defect);assert.ok(!f.calls.some(c=>c.write||c.create),defect);
  }
});

test('a live world lease refuses offline save publication before file I/O',async()=>{
  const f=await setup();f.busy(true);
  await assert.rejects(f.publish(),/busy/);assert.ok(f.calls.every(c=>c.lock));
});

test('cancellation drains publication under its lock and permits retry at the durable head boundary',async()=>{
  for(const phase of ['after-source','before-publish','after-publish']){
    const f=await setup(),controller=new AbortController();
    await assert.rejects(f.publish(f.request,{signal:controller.signal,boundary:async at=>{
      if(at===phase)controller.abort(Error('page closed'));
    }}),/page closed/);
    assert.equal((await f.route.read()).record.revision,phase==='after-publish'?1:0);
    const retry=await f.publish();assert.equal(retry.ownerRevision,1);assert.equal(retry.idempotent,phase==='after-publish');
  }
});

test('already cancelled or malformed publication starts no profile I/O',async()=>{
  const f=await setup(),controller=new AbortController();controller.abort(Error('closed'));
  assert.throws(()=>f.publish(f.request,{signal:controller.signal}),/closed/);
  for(const key of ['operationId','expectedOwnerManifest','expectedNativeManifest','content','worldId','entityId','region']){
    const r={...f.request};delete r[key];assert.throws(()=>f.publish(r));
  }
  assert.equal(f.calls.length,0);
});

function currentRequest(f){
  const {expectedOwnerManifest,...r}=f.request;
  return {...r,expectedOwner:{unitId:502,agentId:27},expectedHome:{kind:'native',unitId:469,agentId:7},expectedClock:3300};
}
test('current-owner publication selects the durable head after an uncertain acknowledgement without duplicating it',async()=>{
  const f=await setup(),r=currentRequest(f);
  await assert.rejects(publishNativeHeroCurrentOwnerSave(f.profiles,f.world,r,{locks:f.locks,boundary:async phase=>{
    if(phase==='after-publish')throw Error('lost acknowledgement');
  }}),/lost acknowledgement/);
  f.calls.length=0;
  const retry=await publishNativeHeroCurrentOwnerSave(f.profiles,f.world,r,{locks:f.locks});
  assert.equal(retry.ownerRevision,1);assert.equal(retry.unchanged,true);assert.equal(retry.idempotent,true);
  assert.ok(!f.calls.some(c=>c.write||c.create));
});
test('current-owner publication verifies held clock and loaded hero/home aliases before any journal writes',async()=>{
  for(const change of [{expectedClock:3301},{expectedOwner:{unitId:999,agentId:27}},
    {expectedHome:{kind:'native',unitId:470,agentId:7}},{expectedHome:{kind:'proxy',unitId:469,agentId:7}}]){
    const f=await setup(),before=new Map([...f.files].map(([n,b])=>[n,Buffer.from(b)]));
    await assert.rejects(async()=>publishNativeHeroCurrentOwnerSave(f.profiles,f.world,{...currentRequest(f),...change},{locks:f.locks}));
    assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.write||c.create));
  }
});

test('cancelled pending custody reads and writes drain before releasing the exclusive world lease',async()=>{
  for(const mode of ['read','write']){
    const f=await setup(),controller=new AbortController();let unblock,started;
    const gate=new Promise(resolve=>unblock=resolve),entered=new Promise(resolve=>started=resolve);
    let delayed=false;
    const decorate=folder=>({
      getDirectoryHandle:async(name,options)=>decorate(await folder.getDirectoryHandle(name,options)),
      removeEntry:name=>folder.removeEntry(name),
      async getFileHandle(name,options){
        const handle=await folder.getFileHandle(name,options);
        if(!name.startsWith('Frontier_Hero_Route_')||!name.endsWith('.GMP'))return handle;
        async function wait(){if(!delayed){delayed=true;started();await gate;}}
        return {...handle,async getFile(){const file=await handle.getFile();return {size:file.size,slice(at,end){
          const part=file.slice(at,end);return {async arrayBuffer(){if(mode==='read')await wait();return part.arrayBuffer();}};
        }};},async createWritable(){const stream=await handle.createWritable();return {...stream,
          async write(bytes){if(mode==='write')await wait();await stream.write(bytes);}};
        }};
      },
    });
    const pending=publishNativeHeroOwnerSave(decorate(f.profiles),f.world,f.request,{locks:f.locks,signal:controller.signal});
    const refused=assert.rejects(pending,/closed/);await entered;controller.abort(Error('closed'));
    let settled=false;pending.catch(()=>settled=true);await Promise.resolve();assert.equal(settled,false);
    await f.locks.request('majesty-pair-native-world-'+f.world,{mode:'exclusive',ifAvailable:true},lock=>assert.equal(lock,null));
    unblock();await refused;
    assert.equal((await f.route.read()).record.manifest,f.head.manifest);
    assert.equal((await f.publish()).ownerRevision,1);
  }
});
