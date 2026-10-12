import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {registerCheckpointGuildHome,GuildHomeStore,guildHomeFilename} from '../web/world/hero-home.mjs';
import {EntityRevisionStore,REVISION_MANIFEST} from '../web/world/entity-revisions.mjs';
import {inspectRegisteredHomeTask,readRegisteredHomeTask} from '../web/world/hero-home-task.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const word=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0);return b;};
const string=s=>Buffer.from(s+'\0');
const chunk=(tag,b=Buffer.alloc(0),version=0,count=0)=>Buffer.concat([Buffer.from(tag),word(b.length),word(version),word(count),b]);
const env=(v,b)=>Buffer.concat([word(b.length+16),word(v),b,word(0),word(-1)]);
const value=(type,...parts)=>Buffer.concat([word(type),...parts]);
const ref=n=>value(5,word(n));
const list=values=>value(4,env(0,Buffer.concat([word(values.length),...values])));
function unit(id,gid,description,flags=512){
  const head=Buffer.alloc(60);for(const [i,n] of [[0,1],[1,id],[2,flags],[4,description]])head.writeUInt32LE(n,i*4);
  return chunk('UNIT',chunk('PRIM',Buffer.concat([head,word(1),word(1),word(0x4541),word(gid),Buffer.alloc(8)]),9),0,1);
}
function agent(id,uid,attrs){return Buffer.concat([word(id),env(2,Buffer.concat([
  env(0,Buffer.concat([word(attrs.length),...attrs.flatMap(([k,v])=>[string(k),v])])),word(0),word(id),string(''),word(uid),
  Buffer.from([0]),word(0),Buffer.from([0,0])]))]);}
function container(uid,kind,target,flags=1){return Buffer.concat([word(uid),chunk('CONT',chunk('PRIM',
  Buffer.concat([word(1),word(1),word(1),word(1),word(kind),word(uid),word(target),word(flags)]),1),0,1)]);}
function world({present=true,side=0,uid=502,gid=27,target=7,task='go_home',fn='travel_to',badScriptRoster=false,
  badNativeRoster=false,badGuildClass=false,dead=false,duplicateHome=false,variant=0}={}) {
  const home=side?570:469,hgid=side?17:7;
  const context=value(8,word(0),Buffer.alloc(16),Buffer.from([0,1]),string(fn),Buffer.from([0]));
  const attributes=[['home',ref(hgid)],['target',ref(side?hgid:target)],['taskname',value(3,string(task))],['activescript',context]];
  if(duplicateHome)attributes.push(['HOME',ref(hgid)]);
  const agents=[agent(hgid,home,[['members',list(present?[ref(badScriptRoster?99:gid)]:[])]]),
    ...(present?[agent(gid,uid,attributes)]:[])];
  const manager=env(2,Buffer.concat([word(0),word(agents.length),...agents,word(Number(present)),
    ...(present?[word(gid)]:[]),word(0),Buffer.from([0])]));
  const containers=present?[container(home,100,badNativeRoster?999:uid),container(uid,101,home)]:[];
  return Buffer.concat([chunk('VERS',Buffer.alloc(256,variant),1),chunk('GPL ',env(3,Buffer.concat([word(0),manager,word(40)])),1),
    chunk('BLDG',unit(home,hgid,badGuildClass?999:77),0,1),chunk('VHCL',present?unit(uid,gid,42,dead?516:512):Buffer.alloc(0),0,Number(present)),
    ...['GRND','RWRD','MSGF','OFMP'].map(t=>chunk(t)),chunk('ORDR',Buffer.alloc(0),1),chunk('CONT',Buffer.concat(containers),1,containers.length)]);
}
const source=b=>({size:b.length,async readAt(at,n){assert.ok(n<=4096&&at>=0&&at+n<=b.length);return Uint8Array.from(b.subarray(at,at+n));}});
async function fixture(){
  const worlds=[world(),world({side:1,present:false})],files=new Map(),reads=[],writes=[];let locked=false;
  const io={async withLock(mode,fn){if(locked)throw Error('busy');locked=true;try{return await fn();}finally{locked=false;}},
    async open(name){assert.ok(locked);reads.push(name);const b=files.get(name);return b?source(b):null;},
    async atomicWrite(name,produce){assert.ok(locked);const parts=[];await produce({async write(b){assert.ok(b.length<=4096);parts.push(Buffer.from(b));}});
      files.set(name,Buffer.concat(parts));writes.push(name);}};
  const registration=await registerCheckpointGuildHome(source(worlds[0]),{worldId:'a'.repeat(64),contentDigest:'c'.repeat(64),region:'0_0',guildUnitId:469});
  const homeAlias={region:'0_0',unitId:469,agentId:7};
  const homeStore=new GuildHomeStore(io,{worldId:registration.worldId,contentDigest:registration.contentDigest,
    guildEntityId:registration.guildEntityId,homeAlias});
  const registered=await homeStore.initialize(registration),identity={version:1,entityId:registration.members[0].entityId,
    contentDigest:registration.contentDigest,regions:['0_0','1_0'],actor:{family:'VHCL',description:42,playerNumber:0}};
  const store=new EntityRevisionStore(io,identity,identity.contentDigest),aliases=[{unitId:502,agentId:27},{unitId:602,agentId:37}];
  const request=(states,extra={})=>({worlds:states.map(b=>({source:source(b),sha256:hash(b)})),aliases,
    referenceBindings:[{source:{unitId:469,agentId:7},destination:{unitId:570,agentId:17}}],ownerSide:0,visitedSides:1,
    kind:'seed',operationId:'d'.repeat(64),expectedManifest:null,...extra});
  const selected=await store.commit(request(worlds));
  const options={worldId:registration.worldId,guildEntityId:registration.guildEntityId,homeAlias,
    expectedHomeSha256:registered.sha256,expectedManifest:selected.manifest};
  const inspect=(b=world(),extra={})=>inspectRegisteredHomeTask(source(b),{owner:{entityId:identity.entityId,region:'0_0',unitId:502,agentId:27},
    registered,worldId:registration.worldId,contentDigest:registration.contentDigest,...extra});
  return {worlds,files,reads,writes,io,registration,homeStore,registered,store,identity,aliases,selected,options,request,inspect};
}

test('return-home task resolves from one selected owner/home scope and retains stable guild identity',async()=>{
  const f=await fixture();for(let i=0;i<500;i++)f.files.set('dormant-'+i,Buffer.alloc(4096));
  f.reads.length=0;const before=f.writes.length,result=await readRegisteredHomeTask(f.store,f.options);
  assert.equal(result.request.kind,'local-home');assert.equal(result.request.heroEntityId,f.identity.entityId);
  assert.equal(result.request.guildEntityId,f.registration.guildEntityId);assert.equal(result.request.continuation,'travel_to');
  assert.deepEqual(result.request.owner,{entityId:f.identity.entityId,region:'0_0',unitId:502,agentId:27});
  assert.equal(result.request.occupiedSlots,1);assert.equal(result.ownerManifest,f.selected.manifest);
  assert.equal(f.reads.filter(n=>n===guildHomeFilename(f.options.homeAlias)).length,1);
  assert.ok(f.reads.every(n=>!n.startsWith('dormant-')));assert.equal(f.writes.length,before);
  result.request.owner.unitId=999;assert.equal((await readRegisteredHomeTask(f.store,f.options)).request.owner.unitId,502);
});
test('both captured native continuations resolve; a completed local task produces no new request',async()=>{
  const f=await fixture();assert.equal((await f.inspect(world({fn:'use_building'}))).continuation,'use_building');
  assert.equal(await f.inspect(world({task:'',fn:'Rest_at_guild'})),null);
});
test('foreign owners/worlds and remote owner aliases cannot be inferred from matching class or player',async()=>{
  const f=await fixture(),never={size:1,readAt(){throw Error('unexpected native read');}};
  for(const owner of [{entityId:'e'.repeat(64),region:'0_0',unitId:502,agentId:27},
    {entityId:f.identity.entityId,region:'1_0',unitId:602,agentId:37}])
    await assert.rejects(inspectRegisteredHomeTask(never,{owner,registered:f.registered,worldId:f.registration.worldId,
      contentDigest:f.registration.contentDigest}),/registered home member|Remote native home/);
  await assert.rejects(f.inspect(undefined,{worldId:'e'.repeat(64)}),/identity|digest/);
  await assert.rejects(f.inspect(undefined,{registered:{...f.registered,sha256:'e'.repeat(64)}}),/selection changed/);
});
for(const [defect,message] of [['target',/target its registered/],['badScriptRoster',/reciprocal script/],
  ['badNativeRoster',/reciprocal native/],['badGuildClass',/guild differs/],['dead',/owner differs/],
  ['duplicateHome',/Duplicate/],['fn',/continuation/]])test(`return-home task refuses ${defect} without a publication`,async()=>{
  const f=await fixture(),writes=f.writes.length;
  await assert.rejects(f.inspect(world({[defect]:defect==='target'?17:defect==='fn'?'attack':true})),message);
  assert.equal(f.writes.length,writes);
});
test('fresh current aliases on returning home resolve without rewriting registered origin member IDs',async()=>{
  const f=await fixture();let s=await f.store.commit(f.request([world({present:false}),world({side:1,uid:602,gid:37})],
    {kind:'handoff',ownerSide:1,visitedSides:3,expectedManifest:f.selected.manifest,operationId:'e'.repeat(64)}));
  await assert.rejects(readRegisteredHomeTask(f.store,{...f.options,expectedManifest:s.manifest}),/Remote native home/);
  const aliases=[{unitId:702,agentId:47},f.aliases[1]];
  s=await f.store.commit(f.request([world({uid:702,gid:47}),world({side:1,present:false})],
    {aliases,kind:'handoff',ownerSide:0,visitedSides:3,expectedManifest:s.manifest,operationId:'f'.repeat(64)}));
  const result=await readRegisteredHomeTask(f.store,{...f.options,expectedManifest:s.manifest});
  assert.equal(result.request.owner.unitId,702);assert.equal(result.request.owner.agentId,47);
  assert.deepEqual((await f.homeStore.read()).record.members,f.registration.members);
  assert.equal(result.request.heroEntityId,f.identity.entityId);
});
test('stale home/owner revision tokens and missing, oversized or damaged home metadata refuse selection',async()=>{
  const f=await fixture(),filename=guildHomeFilename(f.options.homeAlias),bytes=Buffer.from(f.files.get(filename));
  await assert.rejects(readRegisteredHomeTask(f.store,{...f.options,expectedManifest:'stale'}),/owner revision changed/);
  await assert.rejects(readRegisteredHomeTask(f.store,{...f.options,expectedHomeSha256:'e'.repeat(64)}),/home revision changed/);
  f.files.delete(filename);await assert.rejects(readRegisteredHomeTask(f.store,f.options),/home revision changed/);
  f.files.set(filename,Buffer.alloc(4097));await assert.rejects(readRegisteredHomeTask(f.store,f.options),/oversized/);
  const bad=Buffer.from(bytes);bad[100]^=1;f.files.set(filename,bad);
  await assert.rejects(readRegisteredHomeTask(f.store,{...f.options,expectedHomeSha256:hash(bad)}));
  f.files.set(filename,bytes);await f.homeStore.reserveTravel({heroEntityId:f.identity.entityId,toRegion:'1_0',
    operationId:'9'.repeat(64),expectedSha256:f.registered.sha256});
  await assert.rejects(readRegisteredHomeTask(f.store,f.options),/home revision changed/);
  await assert.rejects(readRegisteredHomeTask(f.store,{...f.options,expectedHomeSha256:(await f.homeStore.read()).sha256}),/already pending/);
});
test('metadata scope excludes publications, copies bytes, revokes native sources and releases lock on error',async()=>{
  const f=await fixture(),filename=guildHomeFilename(f.options.homeAlias);let escaped;
  await f.store.withSelectedMetadata(filename,async selected=>{
    escaped=selected.sources[0];selected.metadata[0]^=1;
    await assert.rejects(f.homeStore.reserveTravel({heroEntityId:f.identity.entityId,toRegion:'1_0',operationId:'e'.repeat(64),
      expectedSha256:f.registered.sha256}),/busy/);
    await assert.rejects(f.store.commit(f.request(f.worlds)),/busy/);
  });
  await assert.rejects(escaped.readAt(0,1),/lease ended/);
  assert.equal((await readRegisteredHomeTask(f.store,f.options)).request.kind,'local-home');
  await assert.rejects(f.store.withSelectedMetadata(filename,async()=>{throw Error('consumer failed');}),/consumer failed/);
  assert.ok(await f.store.read());
  for(const name of ['../secret','a/b.json','a..json','', 'x'.repeat(129)])
    await assert.rejects(f.store.withSelectedMetadata(name,()=>{}),/filename/);
  const empty=new EntityRevisionStore({...f.io,async open(name){return name===REVISION_MANIFEST?null:f.io.open(name);}},f.identity,f.identity.contentDigest);
  await assert.rejects(readRegisteredHomeTask(empty,f.options),/Missing selected/);
});
