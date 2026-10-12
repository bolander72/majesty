import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,world,source,hash} from './fixtures/registered-hero-world.mjs';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {publishHeldHeroOwnerCheckpoint} from '../web/world/hero-owner-checkpoint-publication.mjs';
const op=n=>n.toString(16).padStart(64,'0');
async function setup(side=0){
 const f=await fixture(),store=new HeroRouteStore(f.io,f.identity,f.identity.contentDigest),region=side?'1_0':'0_0';
 const alias=side?{unitId:602,agentId:37}:{unitId:502,agentId:27},homeAlias=side?{kind:'proxy',unitId:0,agentId:45}:{kind:'native',unitId:469,agentId:7};
 const bytes=world(0,true,{registration:f.registration,savedClock:1000});
 let previous=await store.commit({kind:'seed',operationId:op(1),expectedManifest:null,regions:['0_0'],aliases:[{unitId:502,agentId:27}],homeAliases:[{kind:'native',unitId:469,agentId:7}],worlds:[{source:source(bytes),sha256:hash(bytes)}]});
 if(side){const pair=[world(0,false,{registration:f.registration,savedClock:1000}),world(1,true,{registration:f.registration,savedClock:1000})];
  previous=await store.commit({kind:'handoff',operationId:op(10),expectedManifest:previous.manifest,regions:['0_0',region],
   aliases:[{unitId:502,agentId:27},alias],homeAliases:[{kind:'native',unitId:469,agentId:7},homeAlias],worlds:pair.map(b=>({source:source(b),sha256:hash(b)}))});}
 const continued=world(side,true,{registration:f.registration,savedClock:1300,variant:1});
 const request={operationId:op(2),expectedManifest:previous.manifest,region,alias,homeAlias,clock:1300,sha256:hash(continued),source:source(continued)};
 return {...f,store,request,previous};
}
for(const side of [0,1])test(`continued ${side?'remote':'native'} owner checkpoint persists the exact clock and retries without another write`,async()=>{
 const f=await setup(side),r=await publishHeldHeroOwnerCheckpoint(f.store,f.request);
 assert.equal(r.ownerRevision,f.previous.revision+1);assert.equal(r.clock,1300);assert.deepEqual(r.owner,f.request.alias);assert.deepEqual(r.home,f.request.homeAlias);
 const before=new Map(f.files),writes=f.writes.length;
 const retry=await publishHeldHeroOwnerCheckpoint(f.store,f.request);assert.equal(retry.idempotent,true);assert.deepEqual(f.files,before);assert.equal(f.writes.length,writes);
 const reopened=new HeroRouteStore(f.io,f.identity,f.identity.contentDigest);assert.equal((await reopened.read()).record.manifest,r.ownerManifest);
});
test('wrong owner, guild, clock, checksum and a rollback preserve every journal byte',async()=>{
 for(const change of [{alias:{unitId:999,agentId:27}},{homeAlias:{kind:'native',unitId:470,agentId:7}},
  {clock:1301},{sha256:'0'.repeat(64)},
  {clock:900,source:null}]){
  const f=await setup(),before=new Map(f.files);
  if(change.source===null){const b=world(0,true,{registration:f.registration,savedClock:900});change.source=source(b);change.sha256=hash(b);}
  await assert.rejects(publishHeldHeroOwnerCheckpoint(f.store,{...f.request,...change}));assert.deepEqual(f.files,before);
 }
});
test('a different operation cannot save against the previous head after publication',async()=>{
 const f=await setup();await publishHeldHeroOwnerCheckpoint(f.store,f.request);const before=new Map(f.files);
 await assert.rejects(publishHeldHeroOwnerCheckpoint(f.store,{...f.request,operationId:op(9)}));assert.deepEqual(f.files,before);
});
for(const phase of ['after-source','before-publish','after-publish'])test(`cancelled ${phase} checkpoint drains and retries from the complete selected owner`,async()=>{
 const f=await setup(),controller=new AbortController();
 await assert.rejects(publishHeldHeroOwnerCheckpoint(f.store,f.request,{signal:controller.signal,boundary:async at=>{
  if(at===phase)controller.abort(Error('page closed'));
 }}),/page closed/);
 assert.equal((await f.store.read()).record.revision,phase==='after-publish'?1:0);
 const r=await publishHeldHeroOwnerCheckpoint(f.store,f.request);assert.equal(r.ownerRevision,1);assert.equal(r.idempotent,phase==='after-publish');
});
test('the checkpoint source given to the journal is revoked after publication',async()=>{
 const f=await setup(),commit=f.store.commit.bind(f.store);let escaped;
 f.store.commit=async(request,...rest)=>{escaped=request.worlds[0].source;return commit(request,...rest);};
 await publishHeldHeroOwnerCheckpoint(f.store,f.request);await assert.rejects(escaped.readAt(0,16),/read ended/);
});
test('a cancelled or malformed request begins no checkpoint reads',async()=>{
 const f=await setup(),controller=new AbortController();controller.abort(Error('page closed'));let reads=0;
 const request={...f.request,source:{...f.request.source,async readAt(){reads++;throw Error('Unexpected read');}}};
 await assert.rejects(publishHeldHeroOwnerCheckpoint(f.store,request,{signal:controller.signal}),/page closed/);
 await assert.rejects(publishHeldHeroOwnerCheckpoint(f.store,{...request,extra:true}),/Invalid held/);assert.equal(reads,0);
});
