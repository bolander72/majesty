import test from 'node:test';
import assert from 'node:assert/strict';
import {readSelectedRemoteHomeTask,prepareSelectedRemoteHomeReturn} from '../web/world/remote-home-task.mjs';
import {checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {fixture,world,source,hash} from './fixtures/registered-hero-world.mjs';
const word=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0);return b;};
const chunk=(tag,b,v=0,c=0)=>Buffer.concat([Buffer.from(tag),word(b.length),word(v),word(c),b]);
function orders({target=469,callback=4099,extra=false,trailing=false}={}){
  const entry=(kind,size,version)=>{
    const b=Buffer.alloc(size);[version,1,2,kind].forEach((n,i)=>b.writeUInt32LE(n,i*4));
    if(kind===7){b.writeUInt32LE(target,36);b.writeUInt32LE(callback,40);}
    return Buffer.concat([word(1),word(kind),b]);
  };
  const payload=Buffer.concat([word(1),word(extra?3:2),entry(4,140,5),entry(7,112,1),
    ...(extra?[entry(7,112,1)]:[]),word(1),word(0),word(1),word(0),...(trailing?[word(0)]:[])]);
  return Buffer.concat([word(602),chunk('ORDR',chunk('PRIM',payload,2),0,1)]);
}
async function remote(options={},mutate=()=>{}){
  const f=await fixture(),s=f.store(),seed=await s.commit(f.request());
  const bytes=world(1,true,{registration:f.registration,...options});await mutate(bytes);
  const r=await s.commit(f.request([world(0,false),bytes],
    {kind:'handoff',ownerSide:1,visitedSides:3,expectedManifest:seed.manifest,operationId:'e'.repeat(64)}));
  return {f,s,r};
}
function returned(f){return {freshUnitId:702,freshAgentId:47,worlds:[
  world(0,true,{uid:702,gid:47}),world(1,false,{registration:f.registration})
].map(b=>({source:source(b),sha256:hash(b)}))};}
const request=r=>({expectedManifest:r.manifest,operationId:'f'.repeat(64)});
test('remote home is chosen by registration even when a neighboring building has the same numeric ID',async()=>{
  const {f,s,r}=await remote({localHomeUnitId:469}),writes=f.writes.length;
  const route=await readSelectedRemoteHomeTask(s,{expectedManifest:r.manifest});
  assert.deepEqual([route.sourceRegion,route.homeRegion,route.nativeHome.unitId,route.nativeHome.agentId],['1_0','0_0',469,7]);
  assert.deepEqual(route.owner,{entityId:f.identity.entityId,region:'1_0',unitId:602,agentId:37});
  assert.deepEqual(route.proxy,{kind:'proxy',unitId:0,agentId:45});
  assert.deepEqual([route.sourceClockMs,route.homeClockMs,route.continuation],[9000,3200,'use_building']);
  assert.equal(route.requiresNativePauseBeforeLookup,true);assert.equal(route.nativeActivationQualified,false);
  assert.equal(route.queuedHome,null);assert.equal(f.writes.length,writes);
});
test('travel continuation binds the complete Path/Queue body to the registered home entry callback',async()=>{
  const {s,r}=await remote({continuation:'travel_to',orders:orders()}),p=await readSelectedRemoteHomeTask(s,{expectedManifest:r.manifest});
  assert.equal(p.queuedHome.homeUnitId,469);assert.equal(p.queuedHome.cProcId,4099);
  assert.equal(p.queuedHome.callbackOffset-p.queuedHome.targetOffset,4);
});
test('home owners and heroes performing another task do not start remote transfers',async()=>{
  const f=await fixture(),s=f.store(),r=await s.commit(f.request());
  assert.equal(await readSelectedRemoteHomeTask(s,{expectedManifest:r.manifest}),null);
  const remoteTask=await remote({taskName:'explore',continuation:'explore'});
  assert.equal(await readSelectedRemoteHomeTask(remoteTask.s,{expectedManifest:remoteTask.r.manifest}),null);
  let calls=0;await assert.rejects(prepareSelectedRemoteHomeReturn(s,request(r),()=>{calls++;}),/No selected remote/);
  assert.equal(calls,0);
});
for(const [name,opts,pattern]of [
  ['missing queued entry',{continuation:'travel_to'},/lacks/],
  ['foreign queued building',{continuation:'travel_to',orders:orders({target:778})},/target differs/],
  ['another callback',{continuation:'travel_to',orders:orders({callback:4098})},/target differs/],
  ['duplicate queue',{continuation:'travel_to',orders:orders({extra:true})},/target differs/],
  ['missing script target',{targetRef:0},/targets another/],
  ['unsupported continuation',{continuation:'attack'},/Unsupported/],
])test(`remote return refuses ${name} before calling its producer`,async()=>{
  const {f,s,r}=await remote(opts),writes=f.writes.length;let calls=0;
  await assert.rejects(prepareSelectedRemoteHomeReturn(s,request(r),()=>{calls++;return returned(f);}),pattern);
  assert.equal(calls,0);assert.equal(f.writes.length,writes);assert.equal((await s.read()).record.manifest,r.manifest);
});
test('a malformed trailing command cannot become a selected owner world',async()=>{
  await assert.rejects(remote({continuation:'travel_to',orders:orders({trailing:true})}),/Trailing/);
});
test('executing contexts cannot be captured as stopped home tasks',async()=>{
  const {f,s,r}=await remote({},async b=>{
    for await(const v of checkpointAgentValues(source(b),37))if(v.type===8)b[v.stateOffset+16]=1;
  });
  const writes=f.writes.length;await assert.rejects(readSelectedRemoteHomeTask(s,{expectedManifest:r.manifest}),/Unsupported/);
  assert.equal(f.writes.length,writes);
});
test('producer runs under the owner lease; descriptors and route cannot mutate the prepared return',async()=>{
  const {f,s,r}=await remote(),payload=returned(f),input=request(r);let sources,calls=0;
  const pending=prepareSelectedRemoteHomeReturn(s,input,async selected=>{
    calls++;sources=selected.sources;selected.route.homeSide=1;selected.route.owner.unitId=999;
    await assert.rejects(s.read(),/busy/);return payload;
  });
  input.expectedManifest='stale';input.operationId='0'.repeat(64);
  const transfer=await pending;payload.freshUnitId=999;payload.worlds[0].sha256='0'.repeat(64);payload.worlds=[];
  await assert.rejects(sources[0].readAt(0,1),/lease ended/);await assert.rejects(sources[1].readAt(0,1),/lease ended/);
  transfer.route.homeSide=1;const committed=await transfer.commit(),writes=f.writes.length;
  assert.deepEqual(committed.owner,{entityId:f.identity.entityId,region:'0_0',unitId:702,agentId:47});
  assert.equal((await transfer.commit()).idempotent,true);assert.equal(f.writes.length,writes);assert.equal(calls,1);
});
for(const at of ['after-source','after-state','before-publish','after-publish'])test(`prepared return retries ${at} without rerunning native retirement/restoration`,async()=>{
  const {f,s,r}=await remote();let calls=0;
  const transfer=await prepareSelectedRemoteHomeReturn(s,request(r),()=>{calls++;return returned(f);});
  await assert.rejects(transfer.commit(step=>{if(step===at)throw Error('interrupted');}),/interrupted/);
  const selected=await s.read();assert.equal(selected.owner.region,at==='after-publish'?'0_0':'1_0');
  const retry=await transfer.commit();assert.equal(retry.owner.unitId,702);assert.equal(calls,1);
  const writes=f.writes.length;assert.equal((await transfer.commit()).idempotent,true);assert.equal(f.writes.length,writes);
});
test('evolving the selected owner after preparation rejects stale retirement with the newer selection intact',async()=>{
  const {f,s,r}=await remote(),transfer=await prepareSelectedRemoteHomeReturn(s,request(r),()=>returned(f));
  const newer=await s.commit(f.request([world(0,false),world(1,true,{registration:f.registration,variant:2})],
    {kind:'save',ownerSide:1,visitedSides:3,expectedManifest:r.manifest,operationId:'9'.repeat(64)}));
  const writes=f.writes.length;await assert.rejects(transfer.commit(),/Revision changed/);
  assert.equal((await s.read()).record.manifest,newer.manifest);assert.equal(f.writes.length,writes);
  let called=false;await assert.rejects(prepareSelectedRemoteHomeReturn(s,request(r),()=>{called=true;}),/revision changed/);assert.equal(called,false);
});
for(const bad of ['duplicate owner','missing owner','reused alias','leaked lease'])test(`stopped producer cannot publish ${bad}`,async()=>{
  const {f,s,r}=await remote();
  const transfer=await prepareSelectedRemoteHomeReturn(s,request(r),({sources})=>{
    const p=returned(f);
    if(bad==='duplicate owner'){const b=world(1,true,{registration:f.registration,variant:1});p.worlds[1]={source:source(b),sha256:hash(b)};}
    if(bad==='missing owner'){const b=world(0,false,{variant:1});p.worlds[0]={source:source(b),sha256:hash(b)};}
    if(bad==='reused alias')p.freshUnitId=502;
    if(bad==='leaked lease')p.worlds[1]={source:sources[1],sha256:r.worlds[1].sha256};
    return p;
  });
  const writes=f.writes.length;await assert.rejects(transfer.commit());
  assert.equal((await s.read()).record.manifest,r.manifest);assert.equal(f.writes.length,writes);
});
test('producer failure releases the lease and malformed producer IDs cannot prepare a handoff',async()=>{
  const {f,s,r}=await remote(),writes=f.writes.length;
  await assert.rejects(prepareSelectedRemoteHomeReturn(s,request(r),()=>{throw Error('native retirement failed');}),/retirement failed/);
  for(const n of [0,-1,0x80000000,NaN,2.5])await assert.rejects(prepareSelectedRemoteHomeReturn(s,request(r),()=>({...returned(f),freshUnitId:n})),/Invalid stopped/);
  assert.equal((await s.read()).record.manifest,r.manifest);assert.equal(f.writes.length,writes);
});
