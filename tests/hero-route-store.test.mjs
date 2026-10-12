import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,world,source,hash} from './fixtures/registered-hero-world.mjs';
import {HeroRouteStore,HERO_ROUTE_HEAD,HERO_ROUTE_IDENTITY} from '../web/world/hero-route-store.mjs';
import {prepareRouteRegisteredHeroArrival} from '../web/world/registered-hero-arrival.mjs';
import {readSelectedHaloHomeLeg} from '../web/world/halo-home-leg.mjs';
import {checkpointAgentRecordValues,checkpointActorRecords,checkpointAttachments,checkpointAgents} from '../web/world/checkpoint.mjs';

const native={kind:'native',unitId:469,agentId:7},proxy={kind:'proxy',unitId:0,agentId:45};
const op=n=>n.toString(16).padStart(64,'0');
const a=(unitId,agentId)=>({unitId,agentId});
async function setup(){
  const f=await fixture(),store=new HeroRouteStore(f.io,f.identity,f.identity.contentDigest);
  const bytes=f.worlds[0],request={kind:'seed',operationId:op(1),expectedManifest:null,regions:['0_0'],
    aliases:[a(502,27)],homeAliases:[native],worlds:[{source:source(bytes),sha256:hash(bytes)}]};
  const head=await store.commit(request);
  return {...f,store,head,seedRequest:request};
}
function move(f,h,from,to,previousAlias,nextAlias,{variant=0,destinationOverride=null,sourceOverride=null}={}){
  const isHome=r=>r==='0_0';
  const outgoing=sourceOverride??world(isHome(from)?0:1,false,{registration:f.registration,variant,localHomeUnitId:from==='1_0'?778:779});
  const incoming=destinationOverride??world(isHome(to)?0:1,true,{registration:f.registration,...{uid:nextAlias.unitId,gid:nextAlias.agentId},
    variant,localHomeUnitId:to==='1_0'?778:779});
  return {kind:'handoff',operationId:op(h.revision+2),expectedManifest:h.manifest,regions:[from,to],
    aliases:[previousAlias,nextAlias],homeAliases:[isHome(from)?native:proxy,isHome(to)?native:proxy],
    worlds:[outgoing,incoming].map(b=>({source:source(b),sha256:hash(b)}))};
}
function candidate(f,uid=702,gid=47){
  const b=world(1,false,{registration:f.registration,localHomeUnitId:779});
  return {source:source(b),sha256:hash(b),alias:a(uid,gid),homeAlias:proxy};
}
async function comparePrepared(records,bytes,uid){
  const s=source(bytes),actor=await checkpointActorRecords(s,uid),ranges={unit:actor.unit,agent:actor.agent};
  for await(const attachment of checkpointAttachments(s))if(attachment.unitId===uid&&attachment.kind==='CONT')ranges.container=attachment;
  for(const [name,b]of Object.entries(records)){
    assert.ok(ranges[name],name);const r=ranges[name];assert.equal(b.length,r.size);
    assert.deepEqual(Buffer.from(b),bytes.subarray(r.offset,r.offset+r.size),name);
  }
}

test('one immutable registered hero visits three regions and returns with fresh aliases',async()=>{
  const f=await setup();let h=f.head;
  h=await f.store.commit(move(f,h,'0_0','1_0',a(502,27),a(602,37)));
  h=await f.store.commit(move(f,h,'1_0','1_1',a(602,37),a(702,47)));
  h=await f.store.commit(move(f,h,'1_1','0_0',a(702,47),a(802,57),{variant:1}));
  assert.equal(h.revision,3);
  const reopened=new HeroRouteStore(f.io,f.identity,f.identity.contentDigest),selected=await reopened.read();
  assert.deepEqual(selected.owner,{entityId:f.identity.entityId,region:'0_0',unitId:802,agentId:57});
  assert.deepEqual(reopened.identity,f.identity);
  assert.equal(f.files.get(HERO_ROUTE_IDENTITY).toString(),JSON.stringify(f.identity)+'\n');
  for(const region of ['1_0','1_1'])await reopened.withDestination(region,null,async s=>{
    assert.equal(s.regions[0],'0_0');assert.equal(s.regions[1],region);
    assert.equal(s.entries[1].homeAlias.kind,'proxy');
  });
  const checkpoints=[...f.files.keys()].filter(k=>k.endsWith('.GMP'));
  assert.equal(checkpoints.length,6); // Exactly two slots per visited region.
});
test('existing original-record arrival preparation works remote to remote without rebinding the home guild',async()=>{
  const f=await setup();const h=await f.store.commit(move(f,f.head,'0_0','1_0',a(502,27),a(602,37)));
  const writes=f.writes.length;
  const prepared=await prepareRouteRegisteredHeroArrival(f.store,'1_1',candidate(f),{
    expectedManifest:h.manifest,freshUnitId:702,freshAgentId:47});
  assert.deepEqual(prepared.regions,['1_0','1_1']);
  assert.equal(prepared.selectedOwner.entityId,f.identity.entityId);
  assert.equal(prepared.plan.registeredHome.homeRegion,'0_0');
  assert.equal(prepared.plan.registeredHome.scriptDeparture,null);
  assert.equal(prepared.plan.registeredHome.scriptArrival,null);
  assert.equal(prepared.plan.registeredHome.destinationNativeMembershipRequired,false);
  assert.deepEqual(prepared.plan.containerTransforms,[]);
  const fields=[];for await(const v of checkpointAgentRecordValues(source(prepared.records.agent)))
    if(v.type===5&&!v.path.length)fields.push([v.attribute,v.targetAgentId]);
  assert.deepEqual(fields,[['home',45],['target',45]]);
  await comparePrepared(prepared.records,world(1,true,{registration:f.registration,uid:702,gid:47,localHomeUnitId:779}),702);
  assert.equal(f.writes.length,writes);
  assert.equal((await f.store.read()).owner.region,'1_0');
});
test('visited-region inspection authenticates history without opening or retaining world checkpoints',async()=>{
  const f=await setup();let h=await f.store.commit(move(f,f.head,'0_0','1_0',a(502,27),a(602,37)));
  h=await f.store.commit(move(f,h,'1_0','1_1',a(602,37),a(702,47)));
  const opened=[],open=f.io.open;f.io.open=async name=>{opened.push(name);return open(name);};
  const writes=f.writes.length;
  for(const [region,visited]of [['0_0',true],['1_0',true],['1_1',true],['2_1',false]])
    assert.equal(await f.store.hasVisitedRegion(region),visited);
  assert.equal(opened.filter(name=>name.endsWith('.GMP')).length,0);assert.equal(f.writes.length,writes);
  const controller=new AbortController();controller.abort(Error('closed'));
  assert.throws(()=>f.store.hasVisitedRegion('0_0',{signal:controller.signal}),/closed/);
  f.files.set('Frontier_Hero_Route_Node_0.json',Buffer.from('{}\n'));
  await assert.rejects(f.store.hasVisitedRegion('2_1'));
  assert.equal(f.writes.length,writes);
});
test('ordinary AI region targets survive custody publication and reopening unchanged',async()=>{
  const f=await setup(),bytes=world(1,true,{registration:f.registration,targetRef:17,taskName:'explore'});
  const request=move(f,f.head,'0_0','1_0',a(502,27),a(602,37),{destinationOverride:bytes});
  const h=await f.store.commit(request),reopened=new HeroRouteStore(f.io,f.identity,f.identity.contentDigest);
  assert.equal((await reopened.read()).owner.region,'1_0');
  assert.deepEqual(f.files.get('Frontier_Hero_Route_1_0_0.GMP'),bytes);
  assert.equal(h.revision,1);
});
test('current owner export leases one selected world, avoids dormant checkpoints, and revokes escaped readers',async()=>{
  const f=await setup();const h=await f.store.commit(move(f,f.head,'0_0','1_0',a(502,27),a(602,37)));
  const opened=[],open=f.io.open;f.io.open=async name=>{opened.push(name);return open(name);};
  let escaped;const result=await f.store.withOwner(async value=>{
    assert.equal(value.record.manifest,h.manifest);assert.equal(value.owner.region,'1_0');
    assert.deepEqual(value.entry.alias,a(602,37));escaped=value.source;
    return hash(Buffer.from(await value.source.readAt(0,value.source.size)));
  });
  assert.equal(result,hash(f.files.get('Frontier_Hero_Route_1_0_0.GMP')));
  assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_1_0_0.GMP']);
  await assert.rejects(escaped.readAt(0,4),/owner lease ended/);
  await assert.rejects(f.store.withOwner(async()=>{throw Error('callback failed');}),/callback failed/);
  assert.equal((await f.store.read()).owner.region,'1_0');
});
test('owner export rejects a changed checkpoint and still revokes the lease',async()=>{
  const f=await setup();let escaped;
  await assert.rejects(f.store.withOwner(async value=>{
    escaped=value.source;f.files.get('Frontier_Hero_Route_0_0_0.GMP')[30]^=1;
  }),/owner source changed/);
  await assert.rejects(escaped.readAt(0,4),/owner lease ended/);
});

test('already cancelled owner, destination and preparation reads perform no storage work',async()=>{
  const f=await setup(),controller=new AbortController(),reason=new Error('page closed');
  const writes=f.writes.length;let opens=0,locks=0;
  const open=f.io.open,lock=f.io.withLock;
  f.io.open=(...args)=>{++opens;return open(...args);};
  f.io.withLock=(...args)=>{++locks;return lock(...args);};
  controller.abort(reason);const options={signal:controller.signal};
  for(const call of [()=>f.store.read(options),()=>f.store.withOwner(()=>assert.fail('consumer ran'),options),
    ()=>f.store.withDestination('1_1',candidate(f),()=>assert.fail('consumer ran'),options),
    ()=>prepareRouteRegisteredHeroArrival(f.store,'1_1',candidate(f),{
      expectedManifest:f.head.manifest,freshUnitId:702,freshAgentId:47},options),
    ()=>readSelectedHaloHomeLeg(f.store,{expectedManifest:f.head.manifest},options)])
    assert.throws(call,error=>error===reason);
  assert.equal(opens,0);assert.equal(locks,0);assert.equal(f.writes.length,writes);
});

for(const [name,stage]of [[HERO_ROUTE_HEAD,'open'],[HERO_ROUTE_HEAD,'read'],
  [HERO_ROUTE_IDENTITY,'read'],['Frontier_Hero_Route_Node_0.json','read'],
  ['Frontier_Hero_Route_0_0_0.GMP','open'],['Frontier_Hero_Route_0_0_0.GMP','read']])
  test(`cancellation during owner ${name} ${stage} prevents further I/O or consumer invocation`,async()=>{
    const f=await setup(),controller=new AbortController(),reason=new Error('view replaced');
    const writes=f.writes.length,open=f.io.open;let entered,finish,opens=0,reads=0;
    const waiting=new Promise(resolve=>{entered=resolve;});
    const gate=()=>{entered();return new Promise(resolve=>{finish=resolve;});};
    f.io.open=async fileName=>{
      ++opens;const file=await open(fileName);if(fileName===name&&stage==='open')await gate();
      if(!file)return null;
      return {size:file.size,async readAt(at,n){
        ++reads;const bytes=await file.readAt(at,n);
        if(fileName===name&&stage==='read')await gate();return bytes;
      }};
    };
    const operation=f.store.withOwner(()=>assert.fail('consumer ran'),{signal:controller.signal});
    const rejected=assert.rejects(operation,error=>error===reason);await waiting;
    const stoppedAt={opens,reads};controller.abort(reason);finish();await rejected;
    assert.deepEqual({opens,reads},stoppedAt);assert.equal(f.writes.length,writes);
    f.io.open=open;assert.equal((await f.store.read()).owner.region,'0_0');
  });

test('cancelled dormant-region lookup never opens its next journal node or any world',async()=>{
  const f=await setup();let h=await f.store.commit(move(f,f.head,'0_0','1_0',a(502,27),a(602,37)));
  h=await f.store.commit(move(f,h,'1_0','1_1',a(602,37),a(702,47)));
  const controller=new AbortController(),reason=new Error('travel replaced'),open=f.io.open,opened=[];
  const stable=Buffer.from(f.files.get(HERO_ROUTE_HEAD)),writes=f.writes.length;
  f.io.open=async name=>{
    opened.push(name);const file=await open(name);
    if(name!=='Frontier_Hero_Route_Node_1.json')return file;
    return {size:file.size,async readAt(at,n){const bytes=await file.readAt(at,n);controller.abort(reason);return bytes;}};
  };
  await assert.rejects(f.store.withDestination('0_0',null,()=>assert.fail('consumer ran'),{signal:controller.signal}),error=>error===reason);
  assert.ok(opened.includes('Frontier_Hero_Route_Node_1.json'));
  assert.ok(!opened.includes('Frontier_Hero_Route_Node_0.json'));
  assert.ok(!opened.some(name=>name.endsWith('.GMP')));
  assert.equal(f.writes.length,writes);assert.deepEqual(f.files.get(HERO_ROUTE_HEAD),stable);
  f.io.open=open;assert.equal((await f.store.read()).owner.region,'1_1');
});

test('cancelling a selected source/destination callback rejects escaped readers and its result',async()=>{
  const f=await setup(),controller=new AbortController(),reason=new Error('travel cancelled');
  const writes=f.writes.length,stable=Buffer.from(f.files.get(HERO_ROUTE_HEAD));let escaped;
  await assert.rejects(f.store.withDestination('1_1',candidate(f),async selected=>{
    escaped=selected.sources;controller.abort(reason);
    for(const reader of escaped)await assert.rejects(reader.readAt(0,4),error=>error===reason);
    return 'obsolete arrival';
  },{signal:controller.signal}),error=>error===reason);
  for(const reader of escaped)await assert.rejects(reader.readAt(0,4),/lease ended/);
  assert.equal(f.writes.length,writes);assert.deepEqual(f.files.get(HERO_ROUTE_HEAD),stable);
  assert.equal((await f.store.read()).owner.region,'0_0');
});

test('cancellation before a delayed world lock is granted performs no metadata or checkpoint I/O',async()=>{
  const f=await setup(),controller=new AbortController(),reason=new Error('document closed');
  const lock=f.io.withLock,open=f.io.open;let enter,opens=0;
  f.io.withLock=(mode,fn)=>new Promise((resolve,reject)=>{enter=()=>lock(mode,fn).then(resolve,reject);});
  f.io.open=(...args)=>{++opens;return open(...args);};
  const rejected=assert.rejects(f.store.read({signal:controller.signal}),error=>error===reason);
  controller.abort(reason);enter();await rejected;assert.equal(opens,0);
  f.io.withLock=lock;assert.equal((await f.store.read()).owner.region,'0_0');
});

test('owner cancellation rejects an obsolete callback result without its final digest pass',async()=>{
  const f=await setup(),controller=new AbortController(),reason=new Error('owner replaced');
  const open=f.io.open;let reads=0,escaped,stoppedAt;
  f.io.open=async name=>{
    const file=await open(name);if(!file)return null;
    return {size:file.size,async readAt(at,n){++reads;return file.readAt(at,n);}};
  };
  await assert.rejects(f.store.withOwner(async selected=>{
    escaped=selected.source;stoppedAt=reads;controller.abort(reason);
    await assert.rejects(escaped.readAt(0,4),error=>error===reason);return 'obsolete owner';
  },{signal:controller.signal}),error=>error===reason);
  assert.equal(reads,stoppedAt);await assert.rejects(escaped.readAt(0,4),/lease ended/);
  f.io.open=open;assert.equal((await f.store.read()).owner.region,'0_0');
});
test('region targets reject missing/deleted agents, broken backlinks and undeclared references before publication',async()=>{
  for(const defect of ['missing','deleted','backlink','extra']){
    const f=await setup(),stable=Buffer.from(f.files.get(HERO_ROUTE_HEAD));
    const bytes=world(1,true,{registration:f.registration,targetRef:defect==='missing'?999:17,
      badGuildAgent:defect==='backlink',extraRef:defect==='extra'?17:0});
    if(defect==='deleted')for await(const agent of checkpointAgents(source(bytes)))if(agent.agentId===17)
      bytes[agent.nativeIdOffset+4]=1;
    await assert.rejects(f.store.commit(move(f,f.head,'0_0','1_0',a(502,27),a(602,37),{destinationOverride:bytes})),
      /region target|Region target|Undeclared/);
    assert.deepEqual(f.files.get(HERO_ROUTE_HEAD),stable);
    assert.equal((await f.store.read()).owner.region,'0_0');
  }
});
test('return preparation derives actual native home membership from the selected dormant home',async()=>{
  const f=await setup();let h=await f.store.commit(move(f,f.head,'0_0','1_0',a(502,27),a(602,37)));
  h=await f.store.commit(move(f,h,'1_0','1_1',a(602,37),a(702,47)));
  const prepared=await prepareRouteRegisteredHeroArrival(f.store,'0_0',null,{
    expectedManifest:h.manifest,freshUnitId:802,freshAgentId:57});
  assert.deepEqual(prepared.regions,['1_1','0_0']);
  assert.equal(prepared.plan.registeredHome.destinationNativeMembershipRequired,true);
  assert.equal(prepared.plan.registeredHome.nativeArrival.destinationUnitId,469);
  assert.equal(prepared.plan.registeredHome.scriptArrival.destinationAgentId,7);
  await comparePrepared(prepared.records,world(0,true,{registration:f.registration,uid:802,gid:57}),802);
});
for(const stage of ['after-source','after-destination','before-publish','after-publish'])
  test(`third-region publication interruption ${stage} retains one selected owner`,async()=>{
    const f=await setup();const h=await f.store.commit(move(f,f.head,'0_0','1_0',a(502,27),a(602,37)));
    const request=move(f,h,'1_0','1_1',a(602,37),a(702,47));
    await assert.rejects(f.store.commit(request,async at=>{if(at===stage)throw Error('interrupt');}),/interrupt/);
    const selected=await new HeroRouteStore(f.io,f.identity,f.identity.contentDigest).read();
    assert.equal(selected.owner.region,stage==='after-publish'?'1_1':'1_0');
    const retry=await f.store.commit(request);
    assert.equal(retry.idempotent,stage==='after-publish');
    assert.equal((await f.store.read()).owner.region,'1_1');
  });
test('stale plans, duplicate owners, reused aliases and operation changes cannot publish',async()=>{
  const f=await setup(),h=await f.store.commit(move(f,f.head,'0_0','1_0',a(502,27),a(602,37)));
  const stable=Buffer.from(f.files.get(HERO_ROUTE_HEAD));
  await assert.rejects(f.store.commit({...move(f,f.head,'0_0','1_1',a(502,27),a(702,47)),operationId:op(90)}),/changed/);
  await assert.rejects(f.store.commit(move(f,h,'1_0','1_1',a(602,37),a(702,47),{
    sourceOverride:world(1,true,{registration:f.registration,uid:602,gid:37,variant:1})})),/membership|Retired/);
  await assert.rejects(f.store.commit(move(f,h,'1_0','0_0',a(602,37),a(502,27),{variant:1})),/fresh aliases/);
  await assert.rejects(f.store.commit({...move(f,h,'1_0','1_1',a(602,37),a(702,47)),operationId:op(2)}),/operation ID/);
  assert.deepEqual(f.files.get(HERO_ROUTE_HEAD),stable);
});
test('a staged departure damaged before publication leaves the complete old owner selected',async()=>{
  const f=await setup(),stable=Buffer.from(f.files.get(HERO_ROUTE_HEAD));
  const request=move(f,f.head,'0_0','1_0',a(502,27),a(602,37));
  await assert.rejects(f.store.commit(request,async stage=>{
    if(stage==='before-publish')f.files.get('Frontier_Hero_Route_0_0_1.GMP')[30]^=1;
  }),/Damaged hero route world/);
  assert.deepEqual(f.files.get(HERO_ROUTE_HEAD),stable);
  assert.equal((await f.store.read()).owner.region,'0_0');
});
test('saved owner can evolve without collecting dormant worlds and escaped readers are revoked',async()=>{
  const f=await setup();const bytes=world(0,true,{variant:1});
  const h=await f.store.commit({...f.seedRequest,kind:'save',operationId:op(2),expectedManifest:f.head.manifest,
    worlds:[{source:source(bytes),sha256:hash(bytes)}]});
  assert.equal(h.revision,1);let escaped;
  await f.store.withDestination('1_1',candidate(f),async selected=>{escaped=selected.sources;});
  for(const reader of escaped)await assert.rejects(reader.readAt(0,4),/lease ended/);
  const count=f.writes.length;
  await assert.rejects(prepareRouteRegisteredHeroArrival(f.store,'1_1',candidate(f),{
    expectedManifest:f.head.manifest,freshUnitId:702,freshAgentId:47}),/revision changed/);
  assert.equal(f.writes.length,count);
});
test('visited destinations reject replacement candidates; damaged selected worlds and journal links fail closed',async()=>{
  const f=await setup(),h=await f.store.commit(move(f,f.head,'0_0','1_0',a(502,27),a(602,37)));
  await assert.rejects(f.store.withDestination('0_0',candidate(f),async()=>{}),/selected checkpoint/);
  const file='Frontier_Hero_Route_1_0_0.GMP';f.files.get(file)[30]^=1;
  await assert.rejects(f.store.read(),/Damaged hero route world/);
  f.files.get(file)[30]^=1;
  const n='Frontier_Hero_Route_Node_0.json',damaged=JSON.parse(f.files.get(n));damaged.operationId=op(77);
  f.files.set(n,Buffer.from(JSON.stringify(damaged)+'\n'));
  await assert.rejects(f.store.withDestination('1_1',candidate(f),async()=>{}),/metadata|node/);
  assert.equal(JSON.parse(f.files.get(HERO_ROUTE_HEAD)).revision,h.revision);
});
test('90 movements retain only two checkpoint slots per region and bounded metadata reads',async()=>{
  const f=await setup();let h=f.head,from='0_0',previousAlias=a(502,27);
  for(let i=0;i<90;i++){
    const to=['1_0','1_1','0_0'][i%3],nextAlias=a(602+i*100,37+i*10);
    h=await f.store.commit(move(f,h,from,to,previousAlias,nextAlias,{variant:i+1}));
    from=to;previousAlias=nextAlias;
  }
  assert.equal(h.revision,90);
  assert.equal([...f.files.keys()].filter(k=>k.endsWith('.GMP')).length,6);
  const nodes=[...f.files.entries()].filter(([k])=>k.includes('_Node_'));
  assert.equal(nodes.length,91);assert.ok(nodes.every(([,b])=>b.length<=4096));
  // An unknown destination requires traversing all journal metadata, but the
  // callback still receives exactly two leases rather than a visited-world map.
  await f.store.withDestination('2_1',candidate(f,10002,977),async selected=>{
    assert.equal(selected.entries.length,2);assert.equal(selected.sources.length,2);
    assert.equal(selected.owner.unitId,previousAlias.unitId);
  });
});
test('new destination admission checks pure-home identity and source bytes under the same lease',async()=>{
  const f=await setup();
  const bad=world(1,false,{registration:f.registration,queuedProxy:true});
  await assert.rejects(f.store.withDestination('1_1',{...candidate(f),source:source(bad),sha256:hash(bad)},async()=>{}),/queued/);
  const c=candidate(f);c.sha256='f'.repeat(64);
  await assert.rejects(f.store.withDestination('1_1',c,async()=>{}),/digest differs/);
  assert.throws(()=>f.store.withDestination('00_0',null,async()=>{}),/region/);
  assert.equal((await f.store.read()).owner.region,'0_0');
});
