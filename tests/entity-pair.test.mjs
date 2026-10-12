import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EntityPairStore,encodeEntityLedger,decodeEntityLedger,openEntityPairStore} from '../web/world/entity-pair.mjs';
import {ENTITY_LEDGER_FILE,TRANSFER_MANIFEST} from '../web/world/transfer-store.mjs';
import {exportSelectedEntityPair} from '../web/world/entity-export.mjs';
import {EntityRevisionStore,openEntityRevisionStore,REVISION_MANIFEST,REVISION_IDENTITY} from '../web/world/entity-revisions.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const w=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0);return b;};
const str=s=>Buffer.from(s+'\0');
const chunk=(tag,b=Buffer.alloc(0),v=0,n=0)=>Buffer.concat([Buffer.from(tag),w(b.length),w(v),w(n),b]);
const env=(v,b)=>Buffer.concat([w(b.length+16),w(v),b,w(0),w(-1)]);
function unit(id,gid,description){
  const head=Buffer.alloc(60);for(const [i,n] of [[0,1],[1,id],[2,514],[4,description],[5,7]])head.writeUInt32LE(n,i*4);
  return chunk('UNIT',chunk('PRIM',Buffer.concat([head,w(1),w(1),w(0x4541),w(gid),Buffer.alloc(8)]),9),0,1);
}
function agent(id,uid,ref){
  const attrs=ref?Buffer.concat([w(1),str('leader'),w(5),w(ref)]):w(0);
  return Buffer.concat([w(id),env(2,Buffer.concat([env(0,attrs),w(0),w(id),str(''),w(uid),Buffer.from([0]),w(0),Buffer.from([0,0])]))]);
}
function world(side,present,{badLink=false,unqueued=false,badRef=false,badLeader=false,badOrder=false,nativeId,agentId,variant=0}={}){
  const [baseUid,baseGid,lid,lgid]=side?[200,19,202,17]:[100,9,102,7],uid=nativeId??baseUid,gid=agentId??baseGid;
  const agents=[agent(lgid,lid),...(present?[agent(gid,uid,badRef?33:lgid)]:[])];
  const manager=env(2,Buffer.concat([w(0),w(agents.length),...agents,w(present&&!unqueued?1:0),...(present&&!unqueued?[w(gid)]:[]),w(0),Buffer.from([0])]));
  const move=Buffer.alloc(176);[2,1,2,2].forEach((v,i)=>move.writeUInt32LE(v,i*4));move.writeUInt32LE(33,25*4);
  const orders=Buffer.concat([w(1),w(Number(badOrder)),...(badOrder?[w(1),w(2),move]:[]),w(1),w(0),w(1),w(0)]);
  return Buffer.concat([chunk('VERS',Buffer.alloc(256,variant),1),chunk('GPL ',env(3,Buffer.concat([w(0),manager,w(20)])),1),
    chunk('BLDG',unit(lid,lgid,badLeader?999:77),0,1),chunk('VHCL',present?unit(uid,badLink?lgid:gid,42):Buffer.alloc(0),0,Number(present)),
    ...['GRND','RWRD','MSGF','OFMP'].map(t=>chunk(t)),
    chunk('ORDR',present?Buffer.concat([w(uid),chunk('ORDR',chunk('PRIM',orders,2),0,1)]):Buffer.alloc(0),1,Number(present)),
    chunk('CONT',Buffer.alloc(0),1)]);
}
const source=b=>({size:b.length,async readAt(at,n){assert.ok(n<=4096);return new Uint8Array(b.subarray(at,at+n));}});
const desc=b=>({size:b.length,sha256:hash(b)});
function fixture(){
  const snapshots={before:[world(0,true),world(1,false)],after:[world(0,false),world(1,true)]};
  const ledger={version:1,entityId:'e'.repeat(64),contentDigest:'c'.repeat(64),regions:['0_0','1_0'],
    actor:{family:'VHCL',description:42,playerNumber:7},aliases:[{unitId:100,agentId:9},{unitId:200,agentId:19}],
    referenceBindings:[{source:{unitId:102,agentId:7},destination:{unitId:202,agentId:17}}],
    before:snapshots.before.map(desc),after:snapshots.after.map(desc)};
  const files=new Map();let busy=false;const writes=[];
  const io={async withLock(mode,fn){if(busy)throw Error('busy');busy=true;try{return await fn();}finally{busy=false;}},
    async open(name){const b=files.get(name);return b?source(b):null;},async atomicWrite(name,produce){
      const parts=[];await produce({async write(b){assert.ok(b.length<=4096);parts.push(Buffer.from(b));}});
      files.set(name,Buffer.concat(parts));writes.push(name);
    }};
  const request=(state,expectedManifest)=>({worlds:snapshots[state].map(b=>({source:source(b),sha256:hash(b)})),expectedManifest});
  return {snapshots,ledger,files,io,writes,request,store:()=>new EntityPairStore(io,ledger,ledger.contentDigest)};
}
test('one persistent entity changes local alias and owner through the selected complete pair',async()=>{
  const f=fixture(),s=f.store();const before=await s.initialize(f.request('before'));
  assert.deepEqual((await s.read()).owner,{entityId:f.ledger.entityId,region:'0_0',unitId:100,agentId:9});
  const after=await s.publish(f.request('after',before.manifest));
  const reopened=await openEntityPairStore(f.io,f.ledger.contentDigest);
  assert.deepEqual((await reopened.read()).owner,{entityId:f.ledger.entityId,region:'1_0',unitId:200,agentId:19});
  assert.equal((await reopened.publish(f.request('after',before.manifest))).idempotent,true);
  await assert.rejects(reopened.initialize(f.request('before')),/changed/);
  assert.equal(f.writes.filter(n=>n===ENTITY_LEDGER_FILE).length,1);
  assert.ok(after.manifest.includes(hash(encodeEntityLedger(f.ledger))));
});
for(const point of ['after-source','before-publish','after-publish'])test(`failure at ${point} reopens with one complete owner`,async()=>{
  const f=fixture(),s=f.store(),before=await s.initialize(f.request('before'));
  await assert.rejects(s.publish(f.request('after',before.manifest),async at=>{if(at===point)throw Error('interrupted');}),/interrupted/);
  const selected=await(await openEntityPairStore(f.io,f.ledger.contentDigest)).read();
  assert.equal(selected.record.moved,point==='after-publish');
  assert.equal(selected.owner.unitId,point==='after-publish'?200:100);
  assert.equal((await s.publish(f.request('after',before.manifest))).idempotent,point==='after-publish');
});
test('interrupted ledger creation publishes no selected pair and accepts only the same immutable binding',async()=>{
  const f=fixture(),s=f.store();
  await assert.rejects(s.initialize(f.request('before'),async at=>{if(at==='after-binding')throw Error('interrupted');}),/interrupted/);
  assert.ok(f.files.has(ENTITY_LEDGER_FILE));assert.equal(f.files.has(TRANSFER_MANIFEST),false);assert.equal(await s.read(),null);
  const other=structuredClone(f.ledger);other.entityId='d'.repeat(64);
  await assert.rejects(new EntityPairStore(f.io,other,other.contentDigest).initialize(f.request('before')),/Damaged entity ledger/);
  await s.initialize(f.request('before'));assert.equal((await s.read()).owner.unitId,100);
});
test('ledger corruption, absence and foreign content cannot fall back to another owner',async()=>{
  const f=fixture(),s=f.store();await s.initialize(f.request('before'));const bytes=f.files.get(ENTITY_LEDGER_FILE);
  f.files.set(ENTITY_LEDGER_FILE,Buffer.from(bytes).fill(0,4,5));await assert.rejects(s.read(),/Damaged entity ledger/);
  f.files.delete(ENTITY_LEDGER_FILE);await assert.rejects(s.read(),/Missing selected entity ledger/);
  f.files.set(ENTITY_LEDGER_FILE,bytes);await assert.rejects(openEntityPairStore(f.io,'a'.repeat(64)),/identity/);
  const other=structuredClone(f.ledger);other.aliases[1].unitId=201;
  await assert.rejects(new EntityPairStore(f.io,other,other.contentDigest).read(),/manifest identity/);
});
test('canonical ledger rejects unknown fields, ambiguous references, unbounded mappings and noncanonical encodings',()=>{
  const f=fixture(),bytes=encodeEntityLedger(f.ledger);assert.deepEqual(decodeEntityLedger(bytes,f.ledger.contentDigest),f.ledger);
  for(const change of [o=>o.extra=1,o=>o.regions[1]=o.regions[0],o=>o.aliases[0].agentId=0,
    o=>o.referenceBindings.push(o.referenceBindings[0]),o=>o.referenceBindings[0].source.agentId=9,
    o=>o.after[0]=o.before[0],o=>o.referenceBindings=Array(17).fill(o.referenceBindings[0])]){
    const bad=structuredClone(f.ledger);change(bad);assert.throws(()=>encodeEntityLedger(bad));
  }
  assert.throws(()=>decodeEntityLedger(Buffer.concat([bytes,Buffer.from('\n')]),f.ledger.contentDigest),/encoding/);
});
for(const defect of ['badLink','unqueued','badRef','badLeader','badOrder'])test(`rejects ${defect} even if caller's snapshot digest matches the defective bytes`,async()=>{
  const f=fixture();f.snapshots.after[1]=world(1,true,{[defect]:true});f.ledger.after=f.snapshots.after.map(desc);
  const s=f.store(),before=await s.initialize(f.request('before'));
  await assert.rejects(s.publish(f.request('after',before.manifest)),/differs|reference/);
  assert.equal((await s.read()).owner.unitId,100);
});
test('caller mutation cannot change the captured ledger during awaited publication',async()=>{
  const f=fixture(),s=f.store(),entity=f.ledger.entityId;
  await s.initialize(f.request('before'),async at=>{if(at==='after-binding'){f.ledger.entityId='a'.repeat(64);f.ledger.aliases[0].unitId=999;}});
  assert.equal((await s.read()).owner.entityId,entity);assert.equal((await s.read()).owner.unitId,100);
  const exposed=s.ledger;exposed.aliases[0].unitId=999;assert.equal((await s.read()).owner.unitId,100);
});
test('concurrent publication stays excluded while selected readers retain revocable leases',async()=>{
  const f=fixture(),s=f.store(),before=await s.initialize(f.request('before'));let retained;
  await s.withSelected(async selected=>{
    retained=selected.sources[0];await assert.rejects(s.publish(f.request('after',before.manifest)),/busy/);
    await retained.readAt(0,16);
  });
  await assert.rejects(retained.readAt(0,1),/lease ended/);
});

test('selected export holds both leases through both copies and publishes one complete receipt last',async()=>{
  const f=fixture(),s=f.store(),before=await s.initialize(f.request('before'));
  await s.publish(f.request('after',before.manifest));const copies=[],events=[];let escaped;
  const receipt=await exportSelectedEntityPair(s,async(side,descriptor,produce)=>{
    events.push('world'+side);escaped=produce;
    await assert.rejects(s.publish(f.request('after',before.manifest)),/busy/);
    const pages=[];await produce({async write(bytes){assert.ok(bytes.length<=4096);pages.push(Buffer.from(bytes));}});
    copies.push(Buffer.concat(pages));assert.equal(hash(copies[side]),descriptor.sha256);
  },async r=>{events.push('receipt');assert.equal(copies.length,2);assert.equal(r.owner.unitId,200);});
  assert.deepEqual(events,['world0','world1','receipt']);assert.deepEqual(copies,f.snapshots.after);
  assert.equal(receipt.version,1);assert.equal(receipt.manifest,(await s.read()).record.manifest);
  await assert.rejects(escaped({write(){}}),/lifetime/);
});
for(const failAt of [0,1])test(`selected export failure copying side ${failAt} never publishes a receipt`,async()=>{
  const f=fixture(),s=f.store();await s.initialize(f.request('before'));let published=false;
  await assert.rejects(exportSelectedEntityPair(s,async(side,desc,produce)=>{
    if(side===failAt)throw Error('disk failure');await produce({async write(){}});
  },async()=>{published=true;}),/disk failure/);
  assert.equal(published,false);assert.equal((await s.read()).owner.unitId,100);
});
test('selected export rejects bytes changed after validation before publishing',async()=>{
  const f=fixture(),s=f.store();await s.initialize(f.request('before'));let published=false;
  await assert.rejects(exportSelectedEntityPair(s,async(side,desc,produce)=>{
    if(side===0)f.files.get('Frontier_Transfer_Source_0.GMP')[20]^=1;
    await produce({async write(){}});
  },async()=>{published=true;}),/digest mismatch/);
  assert.equal(published,false);
});
test('selected export rejects skipped and unfinished asynchronous writes',async()=>{
  const f=fixture(),s=f.store();await s.initialize(f.request('before'));let task,published=false;
  await assert.rejects(exportSelectedEntityPair(s,async()=>{},async()=>{published=true;}),/did not finish/);
  await assert.rejects(exportSelectedEntityPair(s,async(side,desc,produce)=>{
    task=produce({async write(){}});task.catch(()=>{});
  },async()=>{published=true;}),/did not finish/);
  await assert.rejects(task,/lifetime ended|lease ended/);assert.equal(published,false);
});
test('empty selected export refuses to publish a receipt',async()=>{
  const f=fixture();let published=false;
  await assert.rejects(exportSelectedEntityPair(f.store(),async()=>{},async()=>{published=true;}),/No selected/);
  assert.equal(published,false);
});

function revisions() {
  const f=fixture(),identity={version:1,entityId:f.ledger.entityId,contentDigest:f.ledger.contentDigest,regions:f.ledger.regions,actor:f.ledger.actor};
  const store=()=>new EntityRevisionStore(f.io,identity,identity.contentDigest);
  const request=(state,{expectedManifest=null,kind='seed',ownerSide=0,visitedSides=1,operationId='1'.repeat(64),aliases=f.ledger.aliases}={})=>({
    worlds:state.map(b=>({source:source(b),sha256:hash(b)})),expectedManifest,kind,ownerSide,visitedSides,operationId,aliases,referenceBindings:f.ledger.referenceBindings});
  return {...f,identity,store,request};
}
test('evolved revisions persist one identity, preserve dormant state and reject stale/reused operations',async()=>{
  const f=revisions(),s=f.store();const seed=await s.commit(f.request(f.snapshots.before));
  const evolved=[world(0,true,{variant:1}),f.snapshots.before[1]],r=f.request(evolved,{kind:'save',expectedManifest:seed.manifest,operationId:'2'.repeat(64)});
  const next=await s.commit(r),reopened=await openEntityRevisionStore(f.io,f.identity.contentDigest);
  assert.equal((await reopened.read()).record.revision,1);assert.equal((await reopened.read()).owner.entityId,f.identity.entityId);
  assert.equal((await reopened.commit(r)).idempotent,true);
  await assert.rejects(s.commit(f.request(f.snapshots.before,{kind:'save',expectedManifest:seed.manifest,operationId:'3'.repeat(64)})),/changed/);
  await assert.rejects(s.commit({...r,worlds:f.snapshots.before.map(b=>({source:source(b),sha256:hash(b)}))}),/operation ID reused/);
  await assert.rejects(s.commit(f.request([world(0,true,{variant:2}),world(1,false,{variant:2})],{kind:'save',expectedManifest:next.manifest,operationId:'4'.repeat(64)})),/dormant/);
  assert.equal((await s.read()).record.revision,1);
});
for(const point of ['after-source','after-state','before-publish','after-publish'])test(`revision failure at ${point} selects the complete old or new evolved state`,async()=>{
  const f=revisions(),s=f.store(),seed=await s.commit(f.request(f.snapshots.before));
  const r=f.request([world(0,true,{variant:1}),f.snapshots.before[1]],{kind:'save',expectedManifest:seed.manifest,operationId:'2'.repeat(64)});
  await assert.rejects(s.commit(r,async at=>{if(at===point)throw Error('interrupted');}),/interrupted/);
  const selected=await(await openEntityRevisionStore(f.io,f.identity.contentDigest)).read();
  assert.equal(selected.record.revision,point==='after-publish'?1:0);
  assert.equal(selected.owner.entityId,f.identity.entityId);
  assert.equal((await s.commit(r)).idempotent,point==='after-publish');
});
test('64 changing-owner revisions bound retained slots and require fresh local IDs on return',async()=>{
  const f=revisions(),s=f.store();let selected=await s.commit(f.request(f.snapshots.before)),aliases=structuredClone(f.ledger.aliases),ownerSide=0;
  for(let i=1;i<=64;++i) {
    ownerSide=1-ownerSide;
    if(i>1)aliases[ownerSide]={unitId:(ownerSide?2000:1000)+i,agentId:(ownerSide?200:100)+i};
    const states=[0,1].map(side=>world(side,side===ownerSide,{nativeId:aliases[side].unitId,agentId:aliases[side].agentId}));
    selected=await s.commit(f.request(states,{kind:'handoff',expectedManifest:selected.manifest,operationId:i.toString(16).padStart(64,'0'),ownerSide,visitedSides:3,aliases}));
    assert.equal(selected.revision,i);assert.ok(f.files.size<=8);
    const read=await s.read();assert.equal(read.owner.entityId,f.identity.entityId);assert.equal(read.owner.unitId,aliases[ownerSide].unitId);
  }
  assert.equal(f.files.size,8);assert.equal(f.writes.filter(n=>n===REVISION_IDENTITY).length,1);
  const to=1-ownerSide,reused=aliases.map(a=>({...a}));
  const states=[0,1].map(side=>world(side,side===to,{nativeId:reused[side].unitId,agentId:reused[side].agentId}));
  await assert.rejects(s.commit(f.request(states,{kind:'handoff',expectedManifest:selected.manifest,operationId:'f'.repeat(64),ownerSide:to,visitedSides:3,aliases:reused})),/fresh incoming/);
});
test('revision leases exclude writers through export and revoke escaped readers afterward',async()=>{
  const f=revisions(),s=f.store(),seed=await s.commit(f.request(f.snapshots.before));let escaped;
  await s.withSelected(async selected=>{
    escaped=selected.sources[0];await escaped.readAt(0,16);
    await assert.rejects(s.commit(f.request([world(0,true,{variant:1}),f.snapshots.before[1]],{kind:'save',expectedManifest:seed.manifest,operationId:'2'.repeat(64)})),/busy/);
  });
  await assert.rejects(escaped.readAt(0,1),/lease ended/);
  const copies=[];await exportSelectedEntityPair(s,async(i,d,p)=>{await p({async write(b){copies.push(b.length);}});},async r=>{assert.equal(r.owner.entityId,f.identity.entityId);});
  assert.ok(copies.every(n=>n<=4096));
});
test('damaged selected revisions, manifests and immutable identity refuse recovery to stale data',async()=>{
  for(const file of [REVISION_IDENTITY,REVISION_MANIFEST,'Frontier_Revision_State_0.json','Frontier_Revision_Source_0.GMP']) {
    const f=revisions(),s=f.store();await s.commit(f.request(f.snapshots.before));const b=f.files.get(file);b[0]^=1;
    await assert.rejects(s.read());
  }
});
test('revision staging rechecks ownership if an input changes after its initial typed validation',async()=>{
  const f=revisions(),s=f.store(),seed=await s.commit(f.request(f.snapshots.before));
  const good=world(0,true,{variant:1}),bad=world(0,true,{variant:1,badLink:true});let swapped=false;
  const writer=f.io.atomicWrite;
  f.io.atomicWrite=async(name,produce)=>{if(name==='Frontier_Revision_Source_1.GMP')swapped=true;return writer(name,produce);};
  const r=f.request([good,f.snapshots.before[1]],{kind:'save',expectedManifest:seed.manifest,operationId:'2'.repeat(64)});
  r.worlds[0]={sha256:hash(bad),source:{size:bad.length,async readAt(at,n){return new Uint8Array((swapped?bad:good).subarray(at,at+n));}}};
  await assert.rejects(s.commit(r),/state differs/);assert.equal((await s.read()).record.revision,0);
});
test('interrupted revision identity initialization cannot overwrite a conflicting orphan',async()=>{
  const f=revisions(),s=f.store();await assert.rejects(s.commit(f.request(f.snapshots.before),async p=>{if(p==='after-identity')throw Error('interrupted');}),/interrupted/);
  assert.equal(await s.read(),null);assert.equal(f.files.has(REVISION_MANIFEST),false);
  const other={...f.identity,entityId:'a'.repeat(64)};
  await assert.rejects(new EntityRevisionStore(f.io,other,other.contentDigest).commit(f.request(f.snapshots.before)),/Damaged/);
  await s.commit(f.request(f.snapshots.before));assert.equal((await s.read()).owner.entityId,f.identity.entityId);
});
