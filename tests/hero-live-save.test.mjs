import test from 'node:test';
import assert from 'node:assert/strict';
import {browserWorldStorage} from './fixtures/browser-world-storage.mjs';
import {world,hash} from './fixtures/registered-hero-world.mjs';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {opfsHeroRouteStorage} from '../web/world/hero-route-profile.mjs';
import {realmFiles} from '../web/world/realm-store.mjs';
import {haloTerrainCheckpoint} from './fixtures/halo-terrain-checkpoint.mjs';
import {startNativeWorldPlayer,confirmNativeHeroGameReady,queueNativeHeroGameSave,
  publishNativeHeroGameSave,endNativeHeroGameSave,inspectNativeHeroTravelDestination,prepareNativeHeroTravelHome,prepareNativeHeroTravel} from '../web/world/realm-session.mjs';
import {fixture as registeredFixture} from './fixtures/registered-hero-world.mjs';
import {verifyRemoteHomeAgent} from '../web/world/remote-home.mjs';
import {checkpointActorRecords} from '../web/world/checkpoint.mjs';
import {prepareNativeHeroTravelArrival} from '../web/world/realm-session.mjs';
import {stageNativeHeroTravelArrival} from '../web/world/realm-session.mjs';
import {stageNativeHeroTravelDeparture} from '../web/world/realm-session.mjs';
import {stageNativeHeroTravelGeneration} from '../web/world/realm-session.mjs';
import {confirmNativeHeroGenerationDeparture,prepareNativeHeroGeneratedArrival} from '../web/world/realm-session.mjs';
import {nativeHeroGenerationConsumedLine} from '../web/world/hero-generation-boundary.mjs';
import {HERO_GENERATION_REQUEST,nativeRegionGenerationSeed} from '../web/world/hero-generation-request.mjs';
import {confirmNativeHeroTravelDeparture,publishNativeHeroTravelArrival,confirmNativeHeroTravelResume} from '../web/world/realm-session.mjs';
import {withNativeWorldNeighborRead} from '../web/world/realm-session.mjs';
import {nativeHeroArrivalReady} from '../web/world/hero-travel-publication.mjs';
import {HERO_RETIRED_SNAPSHOT,HERO_ARRIVAL_ACK} from '../web/world/hero-native-arrival-publication.mjs';
import {HERO_TRAVEL_REQUEST} from '../web/world/hero-travel-request.mjs';
import {restoreNativeHeroTravelHome} from '../web/world/realm-session.mjs';
import {HERO_ARRIVAL_PACKAGE,HERO_ARRIVAL_INPUT,HERO_ARRIVAL_HOME} from '../web/world/hero-arrival-staging.mjs';
import {afterFileClose} from './fixtures/after-file-close.mjs';
import {registeredHeroHome} from '../web/world/entity-home-ownership.mjs';

for(const mode of ['existing','proposal','native'])test(`held ${mode} travel stages one source request after its exact destination input`,async()=>{
 const f=mode==='native'?await nativeHomePreparationFixture({capsule:true}):
  await homePreparationFixture(mode==='proposal'?{registration:(await registeredFixture()).registration}:{},{capsule:true});
 const prepared=await f.prepareArrival(),sourceRegion=prepared.sourceRegion,targetRegion=prepared.targetRegion;
 assert.equal(prepared.home.kind,mode);
 assert.throws(()=>stageNativeHeroTravelDeparture(f.world,1,prepared,{storage:storage(f.profiles)}),/held staged arrival/);
 const staged=await f.stage(prepared),before=new Map(f.files),prefix='native-world-'+f.world+'/',name=prefix+'frontier_'+sourceRegion+'/'+HERO_TRAVEL_REQUEST;
 f.calls.length=0;
 const request=await stageNativeHeroTravelDeparture(f.world,1,prepared,{storage:storage(f.profiles)});
 assert.equal(request.serial,1);assert.equal(request.sourceRegion,sourceRegion);assert.equal(request.targetRegion,targetRegion);
 assert.equal(request.requestManifest,staged.inputManifest);assert.equal(request.requestSha256,staged.inputSha256);
 assert.deepEqual(f.files.get(name),Buffer.from(staged.inputManifest));assert.equal(request.nativeAction,'frontier-hero-travel-1');
 for(const field of ['nativeActionIssued','sourceRetired','destinationLoaded','heroImported','ownerTransferred'])assert.equal(request[field],false);
 assert.equal(Object.isFrozen(request),true);
 for(const [path,bytes] of before)assert.deepEqual(f.files.get(path),bytes,path);
 assert.deepEqual([...f.files.keys()].filter(path=>!before.has(path)),[name]);
 assert.deepEqual(f.calls.filter(c=>c.close).map(c=>c.close),[name]);
 await f.locked();f.calls.length=0;
 assert.equal((await stageNativeHeroTravelDeparture(f.world,1,prepared,{storage:storage(f.profiles)})).idempotent,true);
 assert.ok(!f.calls.some(c=>c.create||c.write||c.close||c.remove));
 await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
});

test('departure staging refuses another capability, serial, world, preparation or ended save before I/O',async()=>{
 const f=await homePreparationFixture({},{capsule:true}),prepared=await f.prepareArrival();await f.stage(prepared);f.calls.length=0;
 const options={storage:storage(f.profiles)};
 for(const [world,serial,value] of [[f.world,2,prepared],['another-world',1,prepared],[f.world,1,{...prepared}]])
  assert.throws(()=>stageNativeHeroTravelDeparture(world,serial,value,options));
 const replacement=await f.prepareArrival();f.calls.length=0;
 assert.throws(()=>stageNativeHeroTravelDeparture(f.world,1,replacement,options),/held staged arrival/);
 assert.equal(f.calls.length,0);await f.stage(replacement);await endNativeHeroGameSave(f.world,1);f.calls.length=0;
 assert.throws(()=>stageNativeHeroTravelDeparture(f.world,1,replacement,options));
 assert.equal(f.calls.length,0);await f.locked();f.assertBounded();
});

for(const defect of ['input','package','home','source','destination','owner'])test(`changed ${defect} refuses departure before writing its source request`,async()=>{
 const f=await homePreparationFixture({},{capsule:true}),prepared=await f.prepareArrival();await f.stage(prepared);
 const root='native-world-'+f.world+'/',folder=root+'frontier_1_0/',name={input:folder+HERO_ARRIVAL_INPUT,
  package:folder+HERO_ARRIVAL_PACKAGE,home:folder+HERO_ARRIVAL_HOME,
  source:root+'frontier_0_0/'+realmFiles('0_0').marker,destination:folder+realmFiles('1_0').marker,owner:f.routePrefix+HERO_ROUTE_HEAD}[defect];
 const changed=Buffer.from(f.files.get(name));changed[changed.length-1]^=1;f.files.set(name,changed);
 const before=new Map(f.files);f.calls.length=0;
 await assert.rejects(stageNativeHeroTravelDeparture(f.world,1,prepared,{storage:storage(f.profiles)}));
 assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.create||c.write||c.close||c.remove));
 await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
});

test('an altered inert source request is repaired only from its still verified destination',async()=>{
 const f=await homePreparationFixture({},{capsule:true}),prepared=await f.prepareArrival(),staged=await f.stage(prepared);
 const request=()=>stageNativeHeroTravelDeparture(f.world,1,prepared,{storage:storage(f.profiles)});await request();
 const name='native-world-'+f.world+'/frontier_0_0/'+HERO_TRAVEL_REQUEST,changed=Buffer.from(f.files.get(name));
 changed[changed.length-1]^=1;f.files.set(name,changed);const before=new Map(f.files);f.calls.length=0;
 assert.equal((await request()).idempotent,false);assert.equal(f.files.get(name).toString(),staged.inputManifest);
 for(const [path,bytes] of before)if(path!==name)assert.deepEqual(f.files.get(path),bytes);
 assert.deepEqual(f.calls.filter(c=>c.close).map(c=>c.close),[name]);
 await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
});

for(const mode of ['request-write','request-close'])test(`cancelled ${mode} drains the source request while holding the game lease`,async()=>{
 const f=await homePreparationFixture({},{capsule:true}),prepared=await f.prepareArrival();await f.stage(prepared);
 const before=new Map(f.files),gate=delayedProfiles(f.profiles,mode),controller=new AbortController();
 const operation=stageNativeHeroTravelDeparture(f.world,1,prepared,{storage:storage(gate.profiles),signal:controller.signal}),refused=assert.rejects(operation,/closed|staging ended/);
 await gate.entered;controller.abort(Error('closed'));let ended=false;
 const ending=endNativeHeroGameSave(f.world,1).then(()=>ended=true);
 await new Promise(r=>setImmediate(r));assert.equal(ended,false);await f.locked();
 assert.throws(()=>stageNativeHeroTravelDeparture(f.world,1,prepared,{storage:storage(f.profiles)}));
 gate.resume();await refused;await ending;
 for(const [path,bytes] of before)assert.deepEqual(f.files.get(path),bytes,path);
 await f.locked();f.assertBounded();
});

test('a destination package changed during request close refuses before a native action can be returned',async()=>{
 const f=await homePreparationFixture({},{capsule:true}),prepared=await f.prepareArrival();await f.stage(prepared);
 const gate=delayedProfiles(f.profiles,'request-close');
 const operation=stageNativeHeroTravelDeparture(f.world,1,prepared,{storage:storage(gate.profiles)}),refused=assert.rejects(operation,/Travel input digest changed/);
 await gate.entered;const name='native-world-'+f.world+'/frontier_1_0/'+HERO_ARRIVAL_PACKAGE,
  bytes=Buffer.from(f.files.get(name));bytes[bytes.length-1]^=1;f.files.set(name,bytes);
 await f.locked();gate.resume();await refused;await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
});

function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function storage(profiles){return {async getDirectory(){return {async getDirectoryHandle(name){
  assert.equal(name,'majesty');return {async getDirectoryHandle(name){assert.equal(name,'profile');return profiles;}};
}};}};}
async function setup({ready=true,haloLayout=false,remote=false,remoteRevisit=false}={}){
  const f=await browserWorldStorage({browserContent:true}),entered=deferred();let receipt;
  if(haloLayout){const bytes=Buffer.concat([f.worlds[0],haloTerrainCheckpoint('0_0')]);
    await f.route.commit({kind:'save',operationId:'2'.padStart(64,'0'),expectedManifest:f.head.manifest,regions:['0_0'],
      aliases:[{unitId:502,agentId:27}],homeAliases:[{kind:'native',unitId:469,agentId:7}],worlds:[{source:{size:bytes.length,
        async readAt(at,n){return Uint8Array.from(bytes.subarray(at,at+n));}},sha256:hash(bytes)}]});
  }
  if(remote||remoteRevisit){
    assert.equal(haloLayout,true);
    f.dormantHome=Buffer.concat([world(0,false,{savedClock:3200}),haloTerrainCheckpoint('0_0')]);
    const neighbor=Buffer.concat([world(1,true,{registration:f.registration,savedClock:9000}),haloTerrainCheckpoint('1_0')]);
    f.previousNeighbor=neighbor;
    await f.route.commit({kind:'handoff',operationId:'3'.padStart(64,'0'),expectedManifest:(await f.route.read()).record.manifest,
      regions:['0_0','1_0'],aliases:[{unitId:502,agentId:27},{unitId:602,agentId:37}],
      homeAliases:[{kind:'native',unitId:469,agentId:7},{kind:'proxy',unitId:0,agentId:45}],
      worlds:[f.dormantHome,neighbor].map(bytes=>({source:{size:bytes.length,
        async readAt(at,n){return Uint8Array.from(bytes.subarray(at,at+n));}},sha256:hash(bytes)}))});
    if(remoteRevisit){
      f.dormantNeighbor=Buffer.concat([world(1,false,{registration:f.registration,savedClock:9000}),haloTerrainCheckpoint('1_0')]);
      const home=Buffer.concat([world(0,true,{savedClock:3200,uid:802,gid:57}),haloTerrainCheckpoint('0_0')]);
      await f.route.commit({kind:'handoff',operationId:'4'.padStart(64,'0'),expectedManifest:(await f.route.read()).record.manifest,
        regions:['1_0','0_0'],aliases:[{unitId:602,agentId:37},{unitId:802,agentId:57}],
        homeAliases:[{kind:'proxy',unitId:0,agentId:45},{kind:'native',unitId:469,agentId:7}],
        worlds:[f.dormantNeighbor,home].map(bytes=>({source:{size:bytes.length,
          async readAt(at,n){return Uint8Array.from(bytes.subarray(at,at+n));}},sha256:hash(bytes)}))});
    }
  }
  const region=remote?'1_0':'0_0';
  const search='?'+new URLSearchParams({world:f.world,profile:'frontier_'+region,RECOMP_RULE_FRONTIER_REGION:region,
    RECOMP_RULE_FRONTIER_RESTORE:'1',RECOMP_RULE_FRONTIER_HERO_RESTORE:'v1',
    'hero-world':f.request.worldId,'hero-entity':f.request.entityId,...(haloLayout?{'hero-layout':'halo-v1'}:{})});
  const startup=startNativeWorldPlayer(async(profile,retain,prepare)=>{
    receipt=await prepare(f.request.content,{signal:new AbortController().signal});retain();entered.resolve();
  },{search,locks:f.locks,events:{addEventListener(){},removeEventListener(){}},storage:storage(f.profiles)});
  await entered.promise;void startup;
  if(ready)confirmNativeHeroGameReady(f.world,receipt.runtimeBinding);
  // This represents the native writer already holding the game's lease. It
  // changes its own alternating save and marker; publication must only read it.
  function capture(clock=6400,options={}){
    const bytes=world(0,true,{savedClock:clock,variant:1,...options}),names=realmFiles('0_0');
    f.putNative(names.slots[1],bytes);
    f.putNative(names.marker,Buffer.from(['checkpoint-v1',1,bytes.length,hash(bytes),f.request.content,''].join('\n')));
    return {serial:1,region:'0_0',clock,slot:1,size:bytes.length,sha256:hash(bytes)};
  }
  const borrowed={async request(name,options,consume){
    assert.equal(name,'majesty-pair-native-world-'+f.world);assert.equal(options.mode,'shared');
    await f.locks.request(name,{mode:'exclusive',ifAvailable:true},lock=>assert.equal(lock,null));
    return consume({});
  }};
  const reader=new HeroRouteStore(opfsHeroRouteStorage(f.profiles,f.world,f.request.entityId,borrowed),f.identity,f.identity.contentDigest);
  async function locked(){await f.locks.request('majesty-pair-native-world-'+f.world,{mode:'exclusive',ifAvailable:true},lock=>assert.equal(lock,null));}
  const publish=(boundary,options={})=>publishNativeHeroGameSave(f.world,boundary,{storage:storage(f.profiles),...options});
  return {...f,receipt,capture,reader,locked,publish};
}

test('live save publishes only the registered journal while retaining the injected game lease',async()=>{
  const f=await setup(),boundary=f.capture(),before=new Map([...f.files].filter(([n])=>!n.startsWith(f.routePrefix)));
  f.calls.length=0;queueNativeHeroGameSave(f.world,1);
  const result=await f.publish(boundary);
  assert.equal(result.clock,6400);assert.equal(result.ownerRevision,1);assert.equal(result.sha256,boundary.sha256);
  assert.ok(f.calls.filter(c=>c.write||c.close||c.remove).every(c=>(c.write||c.close||c.remove).startsWith(f.routePrefix)));
  assert.deepEqual(new Map([...f.files].filter(([n])=>!n.startsWith(f.routePrefix))),before);
  assert.equal(f.calls.filter(c=>c.lock).length,0,'publication borrows rather than reacquires the real lock');
  await f.locked();assert.throws(()=>queueNativeHeroGameSave(f.world,2));
  await endNativeHeroGameSave(f.world,1);await f.locked();
  assert.equal((await f.reader.read()).record.revision,1);f.assertBounded();
});

test('a second live save preserves newer progress and a repeated checkpoint adds no revision',async()=>{
  const f=await setup();queueNativeHeroGameSave(f.world,1);await f.publish(f.capture());await endNativeHeroGameSave(f.world,1);
  queueNativeHeroGameSave(f.world,2);const second=await f.publish({...f.capture(9600,{variant:2}),serial:2});
  assert.equal(second.ownerRevision,2);assert.equal(second.clock,9600);await endNativeHeroGameSave(f.world,2);
  queueNativeHeroGameSave(f.world,3);f.calls.length=0;
  const retry=await f.publish({...f.capture(9600,{variant:2}),serial:3});
  assert.equal(retry.ownerRevision,2);assert.equal(retry.unchanged,true);assert.ok(!f.calls.some(c=>c.write||c.create));
  await endNativeHeroGameSave(f.world,3);await f.locked();
});

test('live publication cannot start before prepared native readiness or without the next consumed serial',async()=>{
  const f=await setup({ready:false}),boundary=f.capture();f.calls.length=0;
  assert.throws(()=>queueNativeHeroGameSave(f.world,1));
  assert.throws(()=>confirmNativeHeroGameReady(f.world,f.receipt.runtimeBinding.replace('|502|','|999|')));
  assert.throws(()=>publishNativeHeroGameSave('different-world',boundary));
  confirmNativeHeroGameReady(f.world,f.receipt.runtimeBinding);
  assert.throws(()=>queueNativeHeroGameSave(f.world,2));assert.throws(()=>f.publish(boundary));
  queueNativeHeroGameSave(f.world,1);
  for(const change of [{serial:2},{region:'1_0'},{clock:0},{slot:2},{size:67108865},{extra:true}])assert.throws(()=>f.publish({...boundary,...change}));
  assert.equal(f.calls.length,0);await endNativeHeroGameSave(f.world,1);await f.locked();
});

test('different native bytes, clock, actor or marker refuse before any live journal publication',async()=>{
  for(const defect of ['digest','clock','alias','marker']){
    const f=await setup(),boundary=f.capture(6400,defect==='alias'?{uid:503,gid:28}:{});
    if(defect==='digest')boundary.sha256='f'.repeat(64);
    if(defect==='clock')boundary.clock=6401;
    if(defect==='marker')f.putNative(realmFiles('0_0').marker,Buffer.from('invalid\n'));
    const before=new Map([...f.files].map(([n,b])=>[n,Buffer.from(b)]));f.calls.length=0;
    queueNativeHeroGameSave(f.world,1);await assert.rejects(f.publish(boundary),undefined,defect);
    assert.deepEqual(f.files,before,defect);assert.ok(!f.calls.some(c=>c.write||c.create),defect);
    await endNativeHeroGameSave(f.world,1);await f.locked();
  }
});

function delayedProfiles(profiles,mode,{readRegion}={}){
  const entered=deferred(),resume=deferred();let delayed=false;
  async function wait(){if(!delayed){delayed=true;entered.resolve();await resume.promise;}}
  function decorate(folder){return {
    getDirectoryHandle:async(name,options)=>decorate(await folder.getDirectoryHandle(name,options)),
    removeEntry:name=>folder.removeEntry(name),
    async getFileHandle(name,options){
      const handle=await folder.getFileHandle(name,options),journal=name.startsWith('Frontier_Hero_Route_');
      return {async getFile(){const file=await handle.getFile();return {size:file.size,slice(at,end){const part=file.slice(at,end);
        return {async arrayBuffer(){if(mode==='read'&&journal&&name.endsWith('.GMP')&&
          (!readRegion||name.startsWith(`Frontier_Hero_Route_${readRegion}_`)))await wait();return part.arrayBuffer();}};
      }};},async createWritable(){const stream=await handle.createWritable();
        if(mode==='open'&&journal&&name.endsWith('.GMP'))await wait();
        return {async write(bytes){if(mode==='write'&&journal&&name.endsWith('.GMP')||mode==='input-write'&&name===HERO_ARRIVAL_PACKAGE||mode==='home-write'&&name==='Frontier_0_0.GMP'||mode==='request-write'&&name===HERO_TRAVEL_REQUEST||mode==='generation-write'&&name===HERO_GENERATION_REQUEST)await wait();await stream.write(bytes);},
          async close(){await stream.close();if(mode==='head'&&name===HERO_ROUTE_HEAD||mode==='input-close'&&name===HERO_ARRIVAL_INPUT||mode==='package-close'&&name===HERO_ARRIVAL_PACKAGE||mode==='home-close'&&name==='Frontier_0_0.checkpoint'||mode==='request-close'&&name===HERO_TRAVEL_REQUEST||mode==='generation-close'&&name===HERO_GENERATION_REQUEST)await wait();},abort:()=>stream.abort()};
      }};
    },
  };}
  return {profiles:decorate(profiles),entered:entered.promise,resume:resume.resolve};
}

for(const mode of ['read','open','write','head'])test(`cancelled live ${mode} I/O drains before ending its save capability and never releases the game`,async()=>{
  const f=await setup(),boundary=f.capture(),gate=delayedProfiles(f.profiles,mode),controller=new AbortController();
  const native=new Map([...f.files].filter(([n])=>!n.startsWith(f.routePrefix)));
  queueNativeHeroGameSave(f.world,1);
  const operation=f.publish(boundary,{signal:controller.signal,storage:storage(gate.profiles)}),refused=assert.rejects(operation,/closed/);
  await gate.entered;controller.abort(Error('closed'));
  let ended=false;const end=endNativeHeroGameSave(f.world,1).then(()=>ended=true);
  await new Promise(r=>setImmediate(r));assert.equal(ended,false);assert.throws(()=>queueNativeHeroGameSave(f.world,2));await f.locked();
  gate.resume();await refused;await end;assert.equal(ended,true);await f.locked();
  assert.deepEqual(new Map([...f.files].filter(([n])=>!n.startsWith(f.routePrefix))),native);
  assert.equal((await f.reader.read()).record.revision,mode==='head'?1:0);
  queueNativeHeroGameSave(f.world,2);const retry=await f.publish({...boundary,serial:2});
  assert.equal(retry.ownerRevision,1);assert.equal(retry.unchanged,mode==='head');
  await endNativeHeroGameSave(f.world,2);f.assertBounded();
});

test('abandonment cancels a pending publication, drains it and disables further saves',async()=>{
  const f=await setup(),boundary=f.capture(),gate=delayedProfiles(f.profiles,'read');
  queueNativeHeroGameSave(f.world,1);
  const publication=f.publish(boundary,{storage:storage(gate.profiles)}),refused=assert.rejects(publication,/abandoned/);
  await gate.entered;const end=endNativeHeroGameSave(f.world,1,{abandoned:true});
  assert.throws(()=>queueNativeHeroGameSave(f.world,2));await f.locked();gate.resume();await refused;await end;
  assert.equal((await f.reader.read()).record.revision,0);assert.throws(()=>queueNativeHeroGameSave(f.world,2));await f.locked();
});

function terrainCapture(f,key='0_0',options={}){
  const body=Buffer.concat([world(key==='0_0'?0:1,key==='0_0',{registration:f.registration,savedClock:key==='0_0'?6400:9000}),
    haloTerrainCheckpoint(key,options)]),names=realmFiles(key);
  f.putNative(names.slots[1],body);f.putNative(names.marker,Buffer.from(['checkpoint-v1',1,body.length,hash(body),f.request.content,''].join('\n')));
  return {serial:1,region:key,clock:key==='0_0'?6400:9000,slot:1,size:body.length,sha256:hash(body)};
}

function crossingBoundary(serial=1){return {serial,region:'0_0',target:'1_0',previousClock:6350,clock:6400,
  unitId:502,agentId:27,previous:{x:4032*2048-1,y:731*2048+13,z:821},accepted:{x:4032*2048+1,y:731*2048+13,z:821}};}
async function crossingCapture(f,crossing,options={},terrain={}){
  const bytes=Buffer.concat([world(0,true,{savedClock:crossing.clock,position:crossing.accepted,uid:crossing.unitId,gid:crossing.agentId,...options}),haloTerrainCheckpoint('0_0',terrain)]);
  const actor=await checkpointActorRecords({size:bytes.length,async readAt(at,n){return Uint8Array.from(bytes.subarray(at,at+n));}},crossing.unitId);
  bytes.writeUInt32LE(Math.floor(crossing.accepted.x/(16*2048)),actor.unit.offset+72);
  bytes.writeUInt32LE(Math.floor(crossing.accepted.y/(16*2048)),actor.unit.offset+76);
  const names=realmFiles('0_0');f.putNative(names.slots[1],bytes);
  f.putNative(names.marker,Buffer.from(['checkpoint-v1',1,bytes.length,hash(bytes),f.request.content,''].join('\n')));
  return {serial:crossing.serial,region:'0_0',clock:crossing.clock,slot:1,size:bytes.length,sha256:hash(bytes)};
}
test('crossing save verifies the exact actor position before publication and binds the destination receipt',async()=>{
  const f=await setup({haloLayout:true}),crossing=crossingBoundary(),boundary=await crossingCapture(f,crossing);terrainCapture(f,'1_0');
  queueNativeHeroGameSave(f.world,1,{crossing});crossing.accepted.x=100;crossing.target='0_1';
  const result=await f.publish(boundary);assert.equal(result.ownerRevision,2);
  assert.equal(result.travel.savedActorPositionVerified,true);assert.equal(result.travel.crossing.target,'1_0');
  assert.equal(result.travel.handoff.destinationPose.x,64*2048+1);assert.equal(result.travel.handoff.ownerPublished,false);
  f.calls.length=0;
  assert.throws(()=>inspectNativeHeroTravelDestination(f.world,1,'0_1',{layout:'halo-v1',storage:storage(f.profiles)}),/accepted crossing/);
  assert.equal(f.calls.length,0);
  const admitted=await inspectNativeHeroTravelDestination(f.world,1,'1_0',{layout:'halo-v1',storage:storage(f.profiles)});
  assert.equal(admitted.travel,result.travel);assert.equal(admitted.kind,'saved');
  assert.ok(!f.calls.some(c=>c.write||c.create));await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
});

function emptyOrderRecord(unitId){
  const words=values=>{const b=Buffer.alloc(values.length*4);values.forEach((n,i)=>b.writeUInt32LE(n,i*4));return b;};
  const chunk=(tag,bytes,version,count=0)=>Buffer.concat([Buffer.from(tag),words([bytes.length,version,count]),bytes]);
  return Buffer.concat([words([unitId]),chunk('ORDR',chunk('PRIM',words([1,0,1,0,1,0]),2),0,1)]);
}
async function homePreparationFixture(neighborOptions={}, {capsule=false,remoteRevisit=false}={}){
  const f=await setup({haloLayout:true,remoteRevisit}),crossing={...crossingBoundary(),...(remoteRevisit?{unitId:802,agentId:57}:{})},boundary=await crossingCapture(f,crossing,
    capsule?{orders:emptyOrderRecord(crossing.unitId)}:{});
  const bytes=remoteRevisit?f.previousNeighbor:Buffer.concat([world(1,false,{registration:f.registration,savedClock:9000,...neighborOptions}),haloTerrainCheckpoint('1_0')]);
  const names=realmFiles('1_0');f.putNative(names.slots[1],bytes);
  f.putNative(names.marker,Buffer.from(['checkpoint-v1',1,bytes.length,hash(bytes),f.request.content,''].join('\n')));
  queueNativeHeroGameSave(f.world,1,{crossing});await f.publish(boundary);f.calls.length=0;
  return {...f,prepare:(options={})=>prepareNativeHeroTravelHome(f.world,1,'1_0',{layout:'halo-v1',storage:storage(f.profiles),...options}),
    prepareArrival:(options={})=>prepareNativeHeroTravelArrival(f.world,1,'1_0',{layout:'halo-v1',storage:storage(f.profiles),...options}),
    departure:(prepared,options={})=>stageNativeHeroTravelDeparture(f.world,1,prepared,{storage:storage(f.profiles),...options}),
    stage:(prepared,options={})=>stageNativeHeroTravelArrival(f.world,1,prepared,{storage:storage(f.profiles),...options})};
}

async function generationPreparationFixture(){
  const f=await homePreparationFixture({},{capsule:true}),names=realmFiles('1_0');
  for(const name of [names.marker,...names.slots])f.files.delete(f.nativePath(name));
  const prepared=await f.prepareArrival();assert.equal(prepared.kind,'new');f.calls.length=0;
  return {...f,prepared,generate:(options={})=>stageNativeHeroTravelGeneration(f.world,1,prepared,
    {storage:storage(f.profiles),...options})};
}

async function generatedArrivalFixture({clock=100,ticks=2}={}){
 const f=await generationPreparationFixture(),request=await f.generate(),consumed=nativeHeroGenerationConsumedLine(request);
 confirmNativeHeroGenerationDeparture(f.world,1,request,consumed);
 const registration=(await registeredFixture()).registration,
  bytes=Buffer.concat([world(1,false,{registration,savedClock:clock}),haloTerrainCheckpoint('1_0')]),names=realmFiles('1_0');
 f.putNative(names.slots[1],bytes);f.putNative(names.marker,Buffer.from(['checkpoint-v1',1,bytes.length,hash(bytes),f.request.content,''].join('\n')));
 const line=`[frontier] Hero generation initialized serial=1 source=0_0 target=1_0 clock=${clock} slot=1 bytes=${bytes.length} sha256=${hash(bytes)} layout=halo-v1 shared-vertices=2480 original-generator=1 original-writer=1 source-roots-cleared=1 phase=7 pending=0 original-ticks=${ticks} hero-imported=0 owner-published=0`;
 return {...f,requestGeneration:request,initializedLine:line,
  prepareGenerated:(options={})=>prepareNativeHeroGeneratedArrival(f.world,1,request,line,{layout:'halo-v1',storage:storage(f.profiles),...options})};
}
test('generation consumption revokes source continuation and requires the exact staged capability',async()=>{
 const f=await generationPreparationFixture(),request=await f.generate(),line=nativeHeroGenerationConsumedLine(request);f.calls.length=0;
 for(const [r,l] of [[{...request},line],[request,line.replace('bytes='+request.requestSize,'bytes=1')]])
  assert.throws(()=>confirmNativeHeroGenerationDeparture(f.world,1,r,l));
 assert.equal(f.calls.length,0);confirmNativeHeroGenerationDeparture(f.world,1,request,line);
 assert.throws(()=>queueNativeHeroGameSave(f.world,2));assert.throws(()=>f.generate());
 await assert.rejects(endNativeHeroGameSave(f.world,1),/Departed/);
 assert.throws(()=>confirmNativeHeroGenerationDeparture(f.world,1,request,line));
 await endNativeHeroGameSave(f.world,1,{abandoned:true});await f.locked();f.assertBounded();
});
test('generated arrival verifies the real initialized save and stages only its bounded home/package inputs',async()=>{
 const f=await generatedArrivalFixture(),before=new Map(f.files);f.calls.length=0;
 const prepared=await f.prepareGenerated();assert.equal(prepared.kind,'generated');assert.equal(prepared.home.kind,'proposal');
 assert.equal(prepared.arrival.destinationClock,100);assert.equal(prepared.arrival.sourceClock,6400);
 assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.lock||c.create||c.write||c.close||c.remove));
 assert.throws(()=>f.departure(prepared));assert.throws(()=>f.stage({...prepared}));
 const staged=await f.stage(prepared),input=JSON.parse(staged.inputManifest);assert.equal(input.destinationClock,100);
 assert.equal(input.home.admission,'reserve-new');assert.equal(input.ownerManifest,f.prepared.sourceOwnerManifest);
 for(const [name,bytes] of before)assert.deepEqual(f.files.get(name),bytes,name);
 const prefix='native-world-'+f.world+'/frontier_1_0/';
 assert.deepEqual([...f.files.keys()].filter(n=>!before.has(n)).sort(),[HERO_ARRIVAL_HOME,HERO_ARRIVAL_PACKAGE,HERO_ARRIVAL_INPUT].map(n=>prefix+n).sort());
 f.calls.length=0;assert.equal((await f.stage(prepared)).idempotent,true);assert.ok(!f.calls.some(c=>c.lock||c.create||c.write||c.close||c.remove));
 await endNativeHeroGameSave(f.world,1,{abandoned:true});await f.locked();f.assertBounded();
});
test('coherent initialized clocks still require the captured hero scheduling plan',async()=>{
 const f=await generatedArrivalFixture({clock:150,ticks:3}),before=new Map(f.files);f.calls.length=0;
 await assert.rejects(f.prepareGenerated(),/captured hero scheduling/);
 assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.create||c.write||c.close||c.remove));
 await endNativeHeroGameSave(f.world,1,{abandoned:true});await f.locked();f.assertBounded();
});
test('cold, altered and copied initialized receipts refuse generated preparation before I/O',async()=>{
 const f=await generatedArrivalFixture();f.calls.length=0;
 for(const line of [f.initializedLine.replace('clock=100','clock=0'),f.initializedLine.replace('serial=1','serial=2'),
   f.initializedLine.replace('target=1_0','target=0_1'),f.initializedLine.replace('original-ticks=2','original-ticks=0'),f.initializedLine+' extra=1'])
  assert.throws(()=>prepareNativeHeroGeneratedArrival(f.world,1,f.requestGeneration,line,{layout:'halo-v1',storage:storage(f.profiles)}));
 assert.throws(()=>prepareNativeHeroGeneratedArrival(f.world,1,{...f.requestGeneration},f.initializedLine,{layout:'halo-v1',storage:storage(f.profiles)}));
 assert.equal(f.calls.length,0);await endNativeHeroGameSave(f.world,1,{abandoned:true});await f.locked();
});
for(const defect of ['native-marker','native-bytes','owner'])test(`changed generated ${defect} prevents preparation without writes`,async()=>{
 const f=await generatedArrivalFixture(),names=realmFiles('1_0');
 const name=defect==='owner'?f.routePrefix+HERO_ROUTE_HEAD:f.nativePath(defect==='native-marker'?names.marker:names.slots[1]);
 const bytes=Buffer.from(f.files.get(name));bytes[bytes.length-1]^=1;f.files.set(name,bytes);const before=new Map(f.files);f.calls.length=0;
 await assert.rejects(f.prepareGenerated());assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.create||c.write||c.close||c.remove));
 await endNativeHeroGameSave(f.world,1,{abandoned:true});await f.locked();f.assertBounded();
});
test('ending during generated-save reading drains I/O and retains the actual game lease',async()=>{
 const f=await generatedArrivalFixture(),gate=delayedProfiles(f.profiles,'read'),before=new Map(f.files);
 const operation=f.prepareGenerated({storage:storage(gate.profiles)}),refused=assert.rejects(operation,/ended|abandoned/);
 await gate.entered;let ended=false;const ending=endNativeHeroGameSave(f.world,1,{abandoned:true}).then(()=>ended=true);
 await new Promise(r=>setImmediate(r));assert.equal(ended,false);await f.locked();gate.resume();await refused;await ending;
 assert.deepEqual(f.files,before);await f.locked();f.assertBounded();
});
test('cancelled generated input close drains while recovery and all original worlds remain preserved',async()=>{
 const f=await generatedArrivalFixture(),prepared=await f.prepareGenerated(),before=new Map(f.files),gate=delayedProfiles(f.profiles,'input-close'),controller=new AbortController();
 const operation=f.stage(prepared,{storage:storage(gate.profiles),signal:controller.signal}),refused=assert.rejects(operation,/closed|ended/);
 await gate.entered;controller.abort(Error('closed'));let ended=false;
 const ending=endNativeHeroGameSave(f.world,1,{abandoned:true}).then(()=>ended=true);
 await new Promise(r=>setImmediate(r));assert.equal(ended,false);await f.locked();gate.resume();await refused;await ending;
 for(const [name,bytes] of before)assert.deepEqual(f.files.get(name),bytes,name);
 assert.throws(()=>queueNativeHeroGameSave(f.world,2));await f.locked();f.assertBounded();
});
test('unexplored crossing stages a bounded, inert generation request and preserves all saved worlds and ownership',async()=>{
  const f=await generationPreparationFixture(),before=new Map(f.files),request=await f.generate();
  const path='native-world-'+f.world+'/frontier_0_0/'+HERO_GENERATION_REQUEST;
  assert.equal(f.files.get(path).toString(),request.requestManifest);
  const input=JSON.parse(request.requestManifest);
  assert.deepEqual(input.sourceAlias,{unitId:502,agentId:27});
  assert.deepEqual(input.homeAlias,{kind:'native',unitId:469,agentId:7});
  assert.equal(input.ownerManifest,f.prepared.sourceOwnerManifest);assert.equal(input.sourceNativeManifest,f.prepared.sourceNativeManifest);
  assert.equal(input.sourceClock,6400);assert.equal(input.targetRegion,'1_0');
  assert.deepEqual(input.generation,{layout:'halo-v1',seed:494276409,nativeCells:128,coreCells:124});
  assert.equal(request.nativeAction,'frontier-hero-generate-1');
  for(const name of ['nativeActionIssued','sourceRetired','destinationGenerated','heroImported','ownerTransferred'])assert.equal(request[name],false);
  assert.equal(request.requestSha256,hash(f.files.get(path)));assert.equal(request.requestSize,f.files.get(path).length);
  assert.deepEqual(new Map([...f.files].filter(([name])=>name!==path)),before);
  assert.deepEqual(f.calls.filter(c=>c.close).map(c=>c.close),[path]);
  assert.equal(f.calls.filter(c=>c.lock).length,0);await f.locked();
  f.calls.length=0;assert.equal((await f.generate()).idempotent,true);
  assert.ok(!f.calls.some(c=>c.create||c.write||c.close||c.remove));
  for(const [key,seed] of [['0_0',1589138072],['-1_0',1349401642],['0_1',1093944695],['-1000000_1000000',248182294]])
    assert.equal(nativeRegionGenerationSeed(key),seed);
  await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
});

test('generation refuses copied, saved, replaced, wrong-serial and ended capabilities before storage I/O',async()=>{
  const f=await generationPreparationFixture();
  for(const [serial,prepared] of [[1,{...f.prepared}],[2,f.prepared],[1,{...f.prepared,kind:'saved'}]])
    assert.throws(()=>stageNativeHeroTravelGeneration(f.world,serial,prepared,{storage:storage(f.profiles)}));
  assert.equal(f.calls.length,0);
  const old=f.prepared,next=await f.prepareArrival();f.calls.length=0;
  assert.throws(()=>stageNativeHeroTravelGeneration(f.world,1,old,{storage:storage(f.profiles)}));
  assert.equal(f.calls.length,0);
  await endNativeHeroGameSave(f.world,1);
  assert.throws(()=>stageNativeHeroTravelGeneration(f.world,1,next,{storage:storage(f.profiles)}));
  await f.locked();
});

for(const defect of ['owner-head','source-save','target-marker','target-primary','target-recovery','target-empty'])
test(`generation preserves ${defect} changed after preparation and refuses before writes`,async()=>{
  const f=await generationPreparationFixture(),sourceNames=realmFiles('0_0'),targetNames=realmFiles('1_0');
  const name=defect==='owner-head'?f.routePrefix+HERO_ROUTE_HEAD:
    defect==='source-save'?f.nativePath(sourceNames.slots[1]):
    f.nativePath(defect==='target-marker'?targetNames.marker:targetNames.slots[defect==='target-recovery'?1:0]);
  const bytes=defect==='target-empty'?Buffer.alloc(0):Buffer.from(f.files.get(name)??'preserve orphaned neighbor');
  if(bytes.length)bytes[bytes.length-1]^=1;f.files.set(name,bytes);
  const before=new Map(f.files);f.calls.length=0;await assert.rejects(f.generate());
  assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.create||c.write||c.close||c.remove));
  await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
});

for(const mode of ['generation-write','generation-close'])test(`cancelled ${mode} drains before ending the held crossing`,async()=>{
  const f=await generationPreparationFixture(),before=new Map(f.files),gate=delayedProfiles(f.profiles,mode),controller=new AbortController();
  const pending=f.generate({storage:storage(gate.profiles),signal:controller.signal}),refused=assert.rejects(pending,/closed|staging ended/);
  await gate.entered;controller.abort(Error('closed'));
  let ended=false;const ending=endNativeHeroGameSave(f.world,1).then(()=>ended=true);
  await new Promise(r=>setImmediate(r));assert.equal(ended,false);await f.locked();
  gate.resume();await refused;await ending;
  for(const [name,bytes] of before)assert.deepEqual(f.files.get(name),bytes,name);
  await f.locked();f.assertBounded();
});

test('a neighbor save appearing during generation close prevents native action authorization',async()=>{
  const f=await generationPreparationFixture(),gate=delayedProfiles(f.profiles,'generation-close');
  const pending=f.generate({storage:storage(gate.profiles)}),refused=assert.rejects(pending,/unregistered save data/);
  await gate.entered;const orphan=realmFiles('1_0').slots[1],bytes=Buffer.from('preserve incoming data');f.putNative(orphan,bytes);
  gate.resume();await refused;assert.deepEqual(f.files.get(f.nativePath(orphan)),bytes);
  await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
});

async function nativeHomePreparationFixture({homeBytes,capsule=false}={}){
  const f=await setup({haloLayout:true,remote:true});
  const crossing={serial:1,region:'1_0',target:'0_0',previousClock:9550,clock:9600,unitId:602,agentId:37,
    previous:{x:64*2048+1,y:731*2048+13,z:821},accepted:{x:64*2048-1,y:731*2048+13,z:821}};
  function emptyOrder(){
    const words=values=>{const b=Buffer.alloc(values.length*4);values.forEach((n,i)=>b.writeUInt32LE(n,i*4));return b;};
    const chunk=(tag,bytes,version,count=0)=>Buffer.concat([Buffer.from(tag),words([bytes.length,version,count]),bytes]);
    return Buffer.concat([words([602]),chunk('ORDR',chunk('PRIM',words([1,0,1,0,1,0]),2),0,1)]);
  }
  const captured=Buffer.concat([world(1,true,{registration:f.registration,savedClock:9600,position:crossing.accepted,
    ...(capsule?{orders:emptyOrder()}: {})}),
    haloTerrainCheckpoint('1_0')]);
  {const actor=await checkpointActorRecords({size:captured.length,
    async readAt(at,n){return Uint8Array.from(captured.subarray(at,at+n));}},602);
    captured.writeUInt32LE(Math.floor(crossing.accepted.x/(16*2048)),actor.unit.offset+72);
    captured.writeUInt32LE(Math.floor(crossing.accepted.y/(16*2048)),actor.unit.offset+76);
  }
  function native(key,bytes){const names=realmFiles(key);f.putNative(names.slots[1],bytes);
    f.putNative(names.marker,Buffer.from(['checkpoint-v1',1,bytes.length,hash(bytes),f.request.content,''].join('\n')));}
  native('1_0',captured);native('0_0',homeBytes?homeBytes(f):f.dormantHome);
  queueNativeHeroGameSave(f.world,1,{crossing});
  const published=await f.publish({serial:1,region:'1_0',clock:9600,slot:1,size:captured.length,sha256:hash(captured)});
  f.calls.length=0;
  return {...f,published,prepare:(options={})=>prepareNativeHeroTravel(f.world,1,'0_0',
    {layout:'halo-v1',storage:storage(f.profiles),...options}),
    prepareArrival:(options={})=>prepareNativeHeroTravelArrival(f.world,1,'0_0',
      {layout:'halo-v1',storage:storage(f.profiles),...options}),
    restore:(options={})=>restoreNativeHeroTravelHome(f.world,1,'0_0',
      {layout:'halo-v1',storage:storage(f.profiles),...options}),
    stage:(prepared,options={})=>stageNativeHeroTravelArrival(f.world,1,prepared,{storage:storage(f.profiles),...options})};
}

function consumedDeparture(request){return `[frontier] Hero departure request consumed serial=${request.serial} source=${request.sourceRegion} target=${request.targetRegion} bytes=${request.requestSize} selected-owner-verified=1 crossing-verified=1 destination-input-verified=1 source-retired=1 phase=7 pending=0`;}
function loadedArrival(f,prepared){
  const returning=prepared.targetRegion==='0_0',sourceSide=returning?1:0;
  const retired=Buffer.concat([world(sourceSide,false,{registration:f.registration,savedClock:prepared.arrival.sourceClock}),
    haloTerrainCheckpoint(prepared.sourceRegion)]);
  const retiredPath='native-world-'+f.world+'/frontier_'+prepared.sourceRegion+'/Documents/My Games/MajestyHD/SaveGame/'+HERO_RETIRED_SNAPSHOT;
  f.files.set(retiredPath,retired);
  const clock=prepared.arrival.destinationClock,unitId=returning?503:602,agentId=returning?28:37;
  const active=Buffer.concat([world(returning?0:1,true,{registration:f.registration,savedClock:clock,uid:unitId,gid:agentId,variant:3}),
    haloTerrainCheckpoint(prepared.targetRegion)]),names=realmFiles(prepared.targetRegion);
  f.putNative(names.slots[0],active);f.putNative(names.marker,Buffer.from(['checkpoint-v1',0,active.length,hash(active),f.request.content,''].join('\n')));
  return nativeHeroArrivalReady({serial:1,region:prepared.targetRegion,clock,unitId,agentId,
    homeAgentId:prepared.home.agentId,size:active.length,sha256:hash(active)});
}

for(const returning of [false,true])test(`injected arrival publication borrows the game lease for a ${returning?'native return':'remote home'} without replacing native saves`,async()=>{
  const f=returning?await nativeHomePreparationFixture({capsule:true}):await homePreparationFixture({},{capsule:true});
  const prepared=await f.prepareArrival();await f.stage(prepared);
  const departure=await stageNativeHeroTravelDeparture(f.world,1,prepared,{storage:storage(f.profiles)});
  assert.throws(()=>publishNativeHeroTravelArrival(f.world,1,departure,'missing',{storage:storage(f.profiles)}),/consumed native departure/);
  confirmNativeHeroTravelDeparture(f.world,1,departure,consumedDeparture(departure));
  const ready=loadedArrival(f,prepared),before=new Map(f.files);f.calls.length=0;
  assert.throws(()=>queueNativeHeroGameSave(f.world,2));
  const result=await publishNativeHeroTravelArrival(f.world,1,departure,ready,{storage:storage(f.profiles)});
  assert.equal(result.region,prepared.targetRegion);assert.equal(result.home.kind,returning?'native':'proxy');
  assert.equal(f.calls.filter(c=>c.lock).length,0);await f.locked();
  const ack='native-world-'+f.world+'/frontier_'+prepared.targetRegion+'/'+HERO_ARRIVAL_ACK;
  assert.equal(f.files.get(ack).toString(),result.acknowledgement);
  for(const [path,bytes] of before)if(!path.startsWith(f.routePrefix))assert.deepEqual(f.files.get(path),bytes,path);
  f.calls.length=0;
  const retry=await publishNativeHeroTravelArrival(f.world,1,departure,ready,{storage:storage(f.profiles)});
  assert.equal(retry.idempotent,true);assert.equal(retry.acknowledgementWritten,false);
  assert.ok(!f.calls.some(c=>c.create||c.write||c.close));
  const resumed=`[frontier] Hero travel resumed serial=1 region=${result.region} unit=${result.owner.unitId} agent=${result.owner.agentId} home=${result.home.kind}/${result.home.unitId}/${result.home.agentId} clock=${result.clock} manifest-sha256=${result.ownerManifestSha256} original-resume=1 fresh-binding=1 phase=3 pending=0`;
  for(const [serial,request,line] of [[2,departure,resumed],[1,{...departure},resumed],
    [1,departure,resumed.replace('fresh-binding=1','fresh-binding=0')],[1,departure,resumed.replace(`unit=${result.owner.unitId}`,'unit=502')]])
    assert.throws(()=>confirmNativeHeroTravelResume(f.world,serial,request,line));
  const entered=deferred(),resume=deferred();
  const oldRead=withNativeWorldNeighborRead(f.world,prepared.targetRegion,async io=>{
    const reader=await io.open(realmFiles(prepared.targetRegion).slots[0]);entered.resolve();await resume.promise;
    await reader.readAt(0,16);
  },{storage:storage(f.profiles)}),revoked=assert.rejects(oldRead,/Native neighbor read lease ended/);
  await entered.promise;
  const receipt=confirmNativeHeroTravelResume(f.world,1,departure,resumed);resume.resolve();await revoked;
  assert.equal(receipt.region,prepared.targetRegion);assert.equal(receipt.haloLayout.key,prepared.targetRegion);
  assert.equal(receipt.owner.unitId,result.owner.unitId);assert.equal(receipt.sha256,result.sha256);
  confirmNativeHeroGameReady(f.world,receipt.runtimeBinding);
  assert.throws(()=>confirmNativeHeroTravelResume(f.world,1,departure,resumed));
  assert.throws(()=>publishNativeHeroTravelArrival(f.world,1,departure,ready,{storage:storage(f.profiles)}));
  queueNativeHeroGameSave(f.world,2);
  const current=await f.publish({serial:2,region:result.region,clock:result.clock,slot:0,size:result.size,sha256:result.sha256});
  assert.equal(current.unchanged,true);assert.equal(current.owner.unitId,result.owner.unitId);
  await endNativeHeroGameSave(f.world,2);await f.locked();f.assertBounded();
});

for(const returning of [false,true])test(`injected ${returning?'return':'outward'} arrival retries uncertain close after native advancement and saves the newer state`,async()=>{
  const f=returning?await nativeHomePreparationFixture({capsule:true}):await homePreparationFixture({},{capsule:true});
  const prepared=await f.prepareArrival();await f.stage(prepared);
  const departure=await stageNativeHeroTravelDeparture(f.world,1,prepared,{storage:storage(f.profiles)});
  confirmNativeHeroTravelDeparture(f.world,1,departure,consumedDeparture(departure));
  const ready=loadedArrival(f,prepared),clock=prepared.arrival.destinationClock,region=prepared.targetRegion,
    unitId=returning?503:602,agentId=returning?28:37,names=realmFiles(region);
  const next=Buffer.concat([world(returning?0:1,true,{registration:f.registration,savedClock:clock+50,uid:unitId,gid:agentId,variant:4}),
    haloTerrainCheckpoint(region)]);
  const profiles=afterFileClose(f.profiles,HERO_ARRIVAL_ACK,async()=>{
    f.putNative(names.slots[1],next);
    f.putNative(names.marker,Buffer.from(['checkpoint-v1',1,next.length,hash(next),f.request.content,''].join('\n')));
    throw Error('uncertain arrival close');
  });
  await assert.rejects(publishNativeHeroTravelArrival(f.world,1,departure,ready,{storage:storage(profiles)}),/uncertain arrival close/);
  await f.locked();assert.throws(()=>queueNativeHeroGameSave(f.world,2));
  const before=new Map(f.files);f.calls.length=0;
  const result=await publishNativeHeroTravelArrival(f.world,1,departure,ready,{storage:storage(f.profiles)});
  assert.equal(result.recoveredAcknowledgement,true);assert.equal(result.clock,clock);
  assert.equal(result.haloLayout.key,region);assert.deepEqual(f.files,before);
  assert.equal(f.calls.filter(c=>c.lock).length,0);
  assert.ok(!f.calls.some(c=>c.create||c.write||c.close||c.remove));await f.locked();
  const resumed=`[frontier] Hero travel resumed serial=1 region=${region} unit=${unitId} agent=${agentId} home=${result.home.kind}/${result.home.unitId}/${result.home.agentId} clock=${clock} manifest-sha256=${result.ownerManifestSha256} original-resume=1 fresh-binding=1 phase=3 pending=0`;
  const receipt=confirmNativeHeroTravelResume(f.world,1,departure,resumed);
  assert.equal(receipt.owner.unitId,unitId);assert.equal(receipt.haloLayout.key,region);
  queueNativeHeroGameSave(f.world,2);
  const saved=await f.publish({serial:2,region,clock:clock+50,slot:1,size:next.length,sha256:hash(next)});
  assert.equal(saved.clock,clock+50);assert.equal(saved.owner.unitId,unitId);assert.equal(saved.unchanged,false);
  await endNativeHeroGameSave(f.world,2);await f.locked();f.assertBounded();
});

test('native departure confirmation rejects copied requests and wrong consumed fields before disabling the current source',async()=>{
  const f=await homePreparationFixture({},{capsule:true}),prepared=await f.prepareArrival();await f.stage(prepared);
  const departure=await f.departure(prepared),line=consumedDeparture(departure);f.calls.length=0;
  for(const [world,serial,request,text] of [['another',1,departure,line],[f.world,2,departure,line],[f.world,1,{...departure},line],
    [f.world,1,departure,line.replace('target=1_0','target=0_1')],[f.world,1,departure,line.replace('source-retired=1','source-retired=0')],
    [f.world,1,departure,line+' extra=1']])assert.throws(()=>confirmNativeHeroTravelDeparture(world,serial,request,text));
  assert.equal(f.calls.length,0);confirmNativeHeroTravelDeparture(f.world,1,departure,line);
  assert.throws(()=>confirmNativeHeroTravelDeparture(f.world,1,departure,line));
  const ready=loadedArrival(f,prepared);f.calls.length=0;
  for(const [serial,request,text] of [[2,departure,ready],[1,{...departure},ready],[1,departure,ready.replace('|9000|','|9001|')],
    [1,departure,ready.replace('|45|','|46|')],[1,departure,ready.replace('|1_0|','|0_1|')]])
    assert.throws(()=>publishNativeHeroTravelArrival(f.world,serial,request,text,{storage:storage(f.profiles)}));
  assert.equal(f.calls.length,0);await endNativeHeroGameSave(f.world,1,{abandoned:true});await f.locked();f.assertBounded();
});

test('cancelled arrival publication drains journal I/O before ending the capability and keeps the injected lease',async()=>{
  const f=await homePreparationFixture({},{capsule:true}),prepared=await f.prepareArrival();await f.stage(prepared);
  const departure=await f.departure(prepared);confirmNativeHeroTravelDeparture(f.world,1,departure,consumedDeparture(departure));
  const ready=loadedArrival(f,prepared),gate=delayedProfiles(f.profiles,'write'),controller=new AbortController();
  const operation=publishNativeHeroTravelArrival(f.world,1,departure,ready,{storage:storage(gate.profiles),signal:controller.signal}),
    refused=assert.rejects(operation,/closed|capability ended/);
  await gate.entered;controller.abort(Error('closed'));let ended=false;
  const ending=endNativeHeroGameSave(f.world,1,{abandoned:true}).then(()=>ended=true);
  await new Promise(r=>setImmediate(r));assert.equal(ended,false);await f.locked();
  assert.throws(()=>publishNativeHeroTravelArrival(f.world,1,departure,ready,{storage:storage(f.profiles)}));
  gate.resume();await refused;await ending;
  assert.equal(f.files.has('native-world-'+f.world+'/frontier_1_0/'+HERO_ARRIVAL_ACK),false);
  await f.locked();f.assertBounded();
});
test('abandoning an uncertain arrival close drains I/O and revokes its prepared recovery capability',async()=>{
  const f=await homePreparationFixture({},{capsule:true}),prepared=await f.prepareArrival();await f.stage(prepared);
  const departure=await f.departure(prepared);confirmNativeHeroTravelDeparture(f.world,1,departure,consumedDeparture(departure));
  const ready=loadedArrival(f,prepared),entered=deferred(),resume=deferred();
  const profiles=afterFileClose(f.profiles,HERO_ARRIVAL_ACK,async()=>{entered.resolve();await resume.promise;});
  const operation=publishNativeHeroTravelArrival(f.world,1,departure,ready,{storage:storage(profiles)}),
    refused=assert.rejects(operation,/Native hero held read ended/);
  await entered.promise;
  assert.equal(f.files.has('native-world-'+f.world+'/frontier_1_0/'+HERO_ARRIVAL_ACK),true);
  let ended=false;const ending=endNativeHeroGameSave(f.world,1,{abandoned:true}).then(()=>ended=true);
  await new Promise(r=>setImmediate(r));assert.equal(ended,false);await f.locked();
  assert.throws(()=>publishNativeHeroTravelArrival(f.world,1,departure,ready,{storage:storage(f.profiles)}));
  resume.resolve();await refused;await ending;await f.locked();f.calls.length=0;
  assert.throws(()=>publishNativeHeroTravelArrival(f.world,1,departure,ready,{storage:storage(f.profiles)}));
  assert.throws(()=>queueNativeHeroGameSave(f.world,2));assert.equal(f.calls.length,0);f.assertBounded();
});

test('return restores the selected dormant home, preserves its live departure slot and stages the actual package',async()=>{
  const live=Buffer.concat([world(0,true,{savedClock:3200}),haloTerrainCheckpoint('0_0')]);
  const f=await nativeHomePreparationFixture({capsule:true,homeBytes:()=>live}),before=new Map(f.files),names=realmFiles('0_0');
  await assert.rejects(f.prepareArrival(),/selected dormant kingdom/);
  f.calls.length=0;const restored=await f.restore();
  assert.equal(restored.homeRestored,true);assert.equal(restored.clock,3200);assert.equal(restored.idempotent,false);
  for(const key of ['sourceRetired','sourceUnloaded','heroImported','ownerTransferred'])assert.equal(restored[key],false);
  assert.equal(restored.previousNativeManifest,before.get(f.nativePath(names.marker)).toString());
  assert.equal(restored.destinationNativeManifest,f.files.get(f.nativePath(names.marker)).toString());
  assert.deepEqual(f.files.get(f.nativePath(names.slots[0])),f.dormantHome);
  assert.deepEqual(f.files.get(f.nativePath(names.slots[1])),live);
  const allowed=new Set([names.marker,names.slots[0]].map(f.nativePath));
  assert.deepEqual(new Map([...f.files].filter(([n])=>!allowed.has(n))),new Map([...before].filter(([n])=>!allowed.has(n))));
  assert.ok(f.calls.filter(c=>c.write||c.close||c.create&&c.file).every(c=>allowed.has(c.write||c.close||c.file)));
  assert.ok(f.calls.filter(c=>c.create&&c.directory).every(c=>c.directory==='native-world-'+f.world||c.directory.startsWith('native-world-'+f.world+'/frontier_0_0')));
  assert.ok(!f.calls.some(c=>c.lock||c.remove));await f.locked();
  f.calls.length=0;assert.equal((await f.restore()).idempotent,true);
  assert.ok(!f.calls.some(c=>c.write||c.create||c.close||c.remove||c.lock));
  const prepared=await f.prepareArrival();assert.equal(prepared.destinationNativeManifest,restored.destinationNativeManifest);
  assert.equal(prepared.arrival.destinationClock,3200);assert.equal((await f.stage(prepared)).destinationLoaded,false);
  assert.deepEqual(f.files.get(f.nativePath(names.slots[1])),live);
  await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
});
test('dormant home restoration preserves newer progress, another guild and incompatible old aliases',async()=>{
  for(const defect of ['newer','other-guild','other-alias','corrupt','orphan','changed-source','changed-owner']){
    const homeBytes=()=>Buffer.concat([world(0,true,defect==='newer'?{savedClock:3250}:
      defect==='other-guild'?{badGuildAgent:true}:defect==='other-alias'?{uid:503,gid:28}:{}),haloTerrainCheckpoint('0_0')]);
    const f=await nativeHomePreparationFixture({homeBytes}),names=realmFiles('0_0');
    if(defect==='corrupt')f.putNative(names.marker,Buffer.from('invalid\n'));
    if(defect==='orphan')f.files.delete(f.nativePath(names.marker));
    if(defect==='changed-source')f.putNative(realmFiles('1_0').marker,Buffer.from('invalid\n'));
    if(defect==='changed-owner')f.files.set(f.routePrefix+HERO_ROUTE_HEAD,Buffer.from(f.head.manifest));
    const before=new Map(f.files);f.calls.length=0;await assert.rejects(f.restore(),undefined,defect);
    assert.deepEqual(f.files,before,defect);assert.ok(!f.calls.some(c=>c.write||c.create||c.close||c.remove),defect);
    await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
  }
});
test('home restoration requires its exact pending crossing and invalidates earlier package preparation',async()=>{
  const f=await nativeHomePreparationFixture({capsule:true}),prepared=await f.prepareArrival();f.calls.length=0;
  const options={layout:'halo-v1',storage:storage(f.profiles)};
  for(const [world,serial,target] of [[f.world,2,'0_0'],[f.world,1,'1_1'],['other-world',1,'0_0']])
    assert.throws(()=>restoreNativeHeroTravelHome(world,serial,target,options),/held published crossing/);
  const controller=new AbortController();controller.abort(Error('closed'));
  assert.throws(()=>f.restore({signal:controller.signal}),/closed/);assert.equal(f.calls.length,0);
  assert.equal((await f.restore()).idempotent,true);
  assert.throws(()=>f.stage(prepared),/held prepared return/);
  await f.stage(await f.prepareArrival());await endNativeHeroGameSave(f.world,1);
  f.calls.length=0;assert.throws(()=>f.restore(),/held published crossing/);assert.equal(f.calls.length,0);await f.locked();
});
for(const mode of ['home-write','home-close'])test(`cancelled ${mode} restoration drains and preserves the previous home slot`,async()=>{
  const live=Buffer.concat([world(0,true,{savedClock:3200}),haloTerrainCheckpoint('0_0')]);
  const f=await nativeHomePreparationFixture({homeBytes:()=>live}),before=new Map(f.files),names=realmFiles('0_0');
  const gate=delayedProfiles(f.profiles,mode),controller=new AbortController();
  const operation=f.restore({storage:storage(gate.profiles),signal:controller.signal}),refused=assert.rejects(operation,/closed|restoration ended/);
  await gate.entered;controller.abort(Error('closed'));let ended=false;
  const ending=endNativeHeroGameSave(f.world,1).then(()=>ended=true);
  await new Promise(r=>setImmediate(r));assert.equal(ended,false);await f.locked();
  assert.throws(()=>f.restore(),/held published crossing/);gate.resume();await refused;await ending;
  assert.deepEqual(f.files.get(f.nativePath(names.slots[1])),live);
  const allowed=new Set([names.marker,names.slots[0]].map(f.nativePath));
  assert.deepEqual(new Map([...f.files].filter(([n])=>!allowed.has(n))),new Map([...before].filter(([n])=>!allowed.has(n))));
  if(mode==='home-write')assert.deepEqual(f.files.get(f.nativePath(names.marker)),before.get(f.nativePath(names.marker)));
  else assert.equal(f.files.get(f.nativePath(names.marker)).toString().split('\n')[3],hash(f.dormantHome));
  assert.equal(f.calls.filter(c=>c.lock).length,1,'only the explicit test probe requests a lock');
  assert.ok(!f.calls.some(c=>c.remove));await f.locked();f.assertBounded();
});
test('foreign crossing home restoration performs no native writes or custody changes',async()=>{
  const f=await homePreparationFixture(),before=new Map(f.files);f.calls.length=0;
  const result=await restoreNativeHeroTravelHome(f.world,1,'1_0',{layout:'halo-v1',storage:storage(f.profiles)});
  assert.equal(result.kind,'foreign');assert.equal(result.homeRestored,false);assert.deepEqual(f.files,before);
  assert.ok(!f.calls.some(c=>c.write||c.create||c.close||c.remove||c.lock));
  assert.equal((await f.prepare()).kind,'saved');await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
});
test('revisiting a remote kingdom restores its retired save, preserves departure and stages its existing proxy',async()=>{
  const f=await homePreparationFixture({},{capsule:true,remoteRevisit:true}),names=realmFiles('1_0');
  await assert.rejects(f.prepareArrival(),/selected dormant kingdom/);
  const owner=(await f.reader.read()).record.manifest,before=new Map(f.files);
  const restored=await restoreNativeHeroTravelHome(f.world,1,'1_0',{layout:'halo-v1',storage:storage(f.profiles)});
  assert.equal(restored.regionRestored,true);assert.equal(restored.homeRestored,false);assert.equal(restored.clock,9000);
  const targetPath=name=>'native-world-'+f.world+'/frontier_1_0/'+(name.endsWith('.GMP')?'Documents/My Games/MajestyHD/SaveGame/':'')+name;
  assert.deepEqual(f.files.get(targetPath(names.slots[0])),f.dormantNeighbor);
  assert.deepEqual(f.files.get(targetPath(names.slots[1])),f.previousNeighbor);
  const allowed=new Set([names.marker,names.slots[0]].map(targetPath));
  assert.deepEqual(new Map([...f.files].filter(([name])=>!allowed.has(name))),new Map([...before].filter(([name])=>!allowed.has(name))));
  f.calls.length=0;
  assert.equal((await restoreNativeHeroTravelHome(f.world,1,'1_0',{layout:'halo-v1',storage:storage(f.profiles)})).idempotent,true);
  assert.ok(!f.calls.some(c=>c.write||c.create||c.close||c.remove));
  const prepared=await f.prepareArrival();assert.equal(prepared.kind,'saved');assert.equal(prepared.home.kind,'existing');
  assert.equal(prepared.home.agentId,45);assert.equal(prepared.home.plan.admission,'reuse-existing');
  assert.equal(prepared.arrival.destinationClock,9000);await f.stage(prepared);await f.departure(prepared);
  assert.equal((await f.reader.read()).record.manifest,owner);
  await endNativeHeroGameSave(f.world,1,{abandoned:true});await f.locked();f.assertBounded();
});
test('a selected dormant home can seed an absent native loader checkpoint without touching custody',async()=>{
  const f=await nativeHomePreparationFixture({capsule:true}),names=realmFiles('0_0');
  for(const name of [names.marker,...names.slots])f.files.delete(f.nativePath(name));
  const before=new Map(f.files);f.calls.length=0;const restored=await f.restore();
  assert.equal(restored.previousNativeManifest,null);assert.equal(restored.idempotent,false);
  assert.deepEqual(f.files.get(f.nativePath(names.slots[0])),f.dormantHome);
  const allowed=new Set([names.marker,names.slots[0]].map(f.nativePath));
  assert.deepEqual(new Map([...f.files].filter(([n])=>!allowed.has(n))),before);
  assert.equal((await f.stage(await f.prepareArrival())).heroImported,false);
  await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
});
for(const mode of ['home-write','home-close'])test(`an interrupted ${mode} restoration retries from the selected checkpoint`,async()=>{
  const live=Buffer.concat([world(0,true,{savedClock:3200}),haloTerrainCheckpoint('0_0')]);
  const f=await nativeHomePreparationFixture({homeBytes:()=>live}),gate=delayedProfiles(f.profiles,mode),controller=new AbortController();
  const operation=f.restore({storage:storage(gate.profiles),signal:controller.signal}),refused=assert.rejects(operation,/closed/);
  await gate.entered;controller.abort(Error('closed'));gate.resume();await refused;
  f.calls.length=0;const retry=await f.restore();assert.equal(retry.idempotent,mode==='home-close');
  if(mode==='home-close')assert.ok(!f.calls.some(c=>c.write||c.create||c.close||c.remove));
  assert.deepEqual(f.files.get(f.nativePath(realmFiles('0_0').slots[1])),live);
  assert.equal((await f.prepare()).home.destinationSha256,hash(f.dormantHome));
  await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
});
test('return preparation admits only the selected dormant native guild under the existing game lease',async()=>{
  const f=await nativeHomePreparationFixture(),before=new Map(f.files),prepared=await f.prepare();
  assert.equal(prepared.kind,'saved');assert.deepEqual(prepared.home,{kind:'native',clock:3200,unitId:469,agentId:7,
    guildEntityId:f.registration.guildEntityId,worldId:f.request.worldId,ownerManifest:f.published.ownerManifest,
    destinationSha256:hash(f.dormantHome),destinationSize:f.dormantHome.length,requiresOriginalGuildArrival:true});
  assert.equal(prepared.sourceRetired,false);assert.equal(prepared.destinationActivated,false);assert.equal(prepared.ownerTransferred,false);
  assert.ok(Object.isFrozen(prepared.home));assert.equal(prepared.home.record,undefined);
  assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.write||c.create||c.close||c.remove||c.lock));
  await f.locked();await endNativeHeroGameSave(f.world,1);assert.throws(()=>f.prepare());f.assertBounded();
});
test('return preparation refuses departure snapshots and other saved guilds without writes',async()=>{
  for(const defect of ['old-live-hero','other-guild','newer-unselected-home']){
    const f=await nativeHomePreparationFixture({homeBytes:()=>Buffer.concat([world(0,defect==='old-live-hero',
      defect==='other-guild'?{badGuildAgent:true}:defect==='newer-unselected-home'?{savedClock:3250}:{}),haloTerrainCheckpoint('0_0')])});
    const before=new Map(f.files);await assert.rejects(f.prepare(),/selected dormant kingdom/);
    assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.write||c.create||c.close||c.remove));
    await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
  }
});
test('cancelled return preparation drains the selected dormant read while retaining the game lease',async()=>{
  const f=await nativeHomePreparationFixture(),gate=delayedProfiles(f.profiles,'read',{readRegion:'0_0'}),controller=new AbortController();
  const operation=f.prepare({storage:storage(gate.profiles),signal:controller.signal}),refused=assert.rejects(operation,/closed/);
  await gate.entered;controller.abort(Error('closed'));let ended=false;
  const ending=endNativeHeroGameSave(f.world,1).then(()=>ended=true);
  await new Promise(r=>setImmediate(r));assert.equal(ended,false);await f.locked();gate.resume();
  await refused;await ending;assert.ok(!f.calls.some(c=>c.write||c.create||c.close||c.remove));await f.locked();f.assertBounded();
});
test('browser return prepares a bounded original-importer capsule without retaining readers or writing worlds',async()=>{
  const f=await nativeHomePreparationFixture({capsule:true}),before=new Map(f.files),prepared=await f.prepareArrival(),a=prepared.arrival;
  assert.equal(a.kind,'native-home');assert.equal(a.sourceClock,9600);assert.equal(a.destinationClock,3200);
  const pack=a.pack;assert.equal(pack.length,a.size);assert.ok(pack.length<=256*1024);assert.equal(hash(pack),a.sha256);
  const view=new DataView(pack.buffer,pack.byteOffset,pack.byteLength);
  assert.deepEqual(Array.from({length:12},(_,i)=>view.getUint32(i*4,true)),
    [0x3141484d,1,4,9600,3200,602,37,7,100000,1000,0,pack.length-96]);
  let at=48;for(let kind=0;kind<4;kind++){
    assert.equal(view.getUint32(at,true),kind);assert.equal(view.getUint32(at+4,true),602);
    at+=12+view.getUint32(at+8,true);
  }
  assert.equal(at,pack.length);assert.equal(a.plan.registeredHome.destinationNativeMembershipRequired,true);
  assert.equal(a.plan.registeredHome.scriptArrival.destinationAgentId,7);
  assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.plan.registeredHome));
  pack.fill(0);assert.equal(hash(a.pack),a.sha256);
  assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.write||c.create||c.close||c.remove||c.lock));
  await endNativeHeroGameSave(f.world,1);assert.equal(hash(a.pack),a.sha256,'capsule owns bounded bytes after readers revoke');
  assert.throws(()=>f.prepareArrival());await f.locked();f.assertBounded();
});
test('a return missing an original command record cannot expose a partial capsule',async()=>{
  const f=await nativeHomePreparationFixture(),before=new Map(f.files);
  await assert.rejects(f.prepareArrival(),/four original records/);
  assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.write||c.create||c.close||c.remove));
  await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
});
test('browser return stages only its two fixed original-importer inputs under the injected world lease',async()=>{
  const f=await nativeHomePreparationFixture({capsule:true}),prepared=await f.prepareArrival(),before=new Map(f.files);
  const inputPrefix='native-world-'+f.world+'/frontier_0_0/',allowed=new Set([HERO_ARRIVAL_PACKAGE,HERO_ARRIVAL_INPUT].map(n=>inputPrefix+n));
  f.calls.length=0;const staged=await f.stage(prepared);
  assert.equal(staged.serial,1);assert.equal(staged.targetRegion,'0_0');assert.equal(staged.packageSha256,prepared.arrival.sha256);
  assert.equal(staged.sourceRetired,false);assert.equal(staged.destinationLoaded,false);assert.equal(staged.heroImported,false);assert.equal(staged.ownerTransferred,false);
  assert.deepEqual(new Map([...f.files].filter(([n])=>!allowed.has(n))),before);
  assert.equal(hash(f.files.get(inputPrefix+HERO_ARRIVAL_PACKAGE)),prepared.arrival.sha256);
  assert.equal(f.files.get(inputPrefix+HERO_ARRIVAL_INPUT).toString(),staged.inputManifest);
  const request=JSON.parse(staged.inputManifest);assert.equal(request.kind,'majesty-hero-native-home-input-v1');
  assert.equal(request.ownerManifest,f.published.ownerManifest);assert.equal(request.sourceNativeManifest,prepared.sourceNativeManifest);
  assert.equal(request.destinationNativeManifest,prepared.destinationNativeManifest);
  assert.deepEqual(request.sourceAlias,{unitId:602,agentId:37});assert.deepEqual(request.homeAlias,{kind:'native',unitId:469,agentId:7});
  assert.equal(hash(Buffer.from(staged.inputManifest)),staged.inputSha256);
  assert.equal(staged.idempotent,false);
  assert.ok(f.calls.filter(c=>c.write||c.close||c.create).every(c=>allowed.has(c.write||c.close||c.file)));
  assert.ok(!f.calls.some(c=>c.lock||c.remove));await f.locked();f.calls.length=0;
  const retry=await f.stage(prepared);assert.equal(retry.idempotent,true);assert.equal(retry.inputManifest,staged.inputManifest);
  assert.ok(!f.calls.some(c=>c.write||c.create||c.close||c.remove||c.lock));
  await endNativeHeroGameSave(f.world,1);f.assertBounded();
});
test('browser input staging refuses a copied capability, wrong serial and an ended boundary before storage I/O',async()=>{
  const f=await nativeHomePreparationFixture({capsule:true}),prepared=await f.prepareArrival();f.calls.length=0;
  assert.throws(()=>f.stage({...prepared}),/held prepared return/);
  assert.throws(()=>stageNativeHeroTravelArrival(f.world,2,prepared,{storage:storage(f.profiles)}),/held prepared return/);
  assert.throws(()=>stageNativeHeroTravelArrival('another-world',1,prepared,{storage:storage(f.profiles)}),/held prepared return/);
  const controller=new AbortController();controller.abort(Error('closed'));
  assert.throws(()=>f.stage(prepared,{signal:controller.signal}),/closed/);assert.equal(f.calls.length,0);
  await endNativeHeroGameSave(f.world,1);assert.throws(()=>f.stage(prepared),/held prepared return/);await f.locked();
});
test('changed source, destination or owner refuses before any browser input writes',async()=>{
  for(const defect of ['source','destination','owner']){
    const f=await nativeHomePreparationFixture({capsule:true}),prepared=await f.prepareArrival();
    if(defect==='owner')f.files.set(f.routePrefix+HERO_ROUTE_HEAD,Buffer.from(f.head.manifest));
    else f.putNative(realmFiles(defect==='source'?'1_0':'0_0').marker,Buffer.from('invalid\n'));
    const before=new Map(f.files);f.calls.length=0;await assert.rejects(f.stage(prepared));
    assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.write||c.create||c.close||c.remove));
    await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
  }
});
test('a source changed after package staging cannot replace the prior input manifest',async()=>{
  const f=await nativeHomePreparationFixture({capsule:true}),prepared=await f.prepareArrival(),prefix='native-world-'+f.world+'/frontier_0_0/';
  const old=Buffer.from('{"version":1,"kind":"majesty-hero-native-home-input-v1","serial":0}\n');
  f.files.set(prefix+HERO_ARRIVAL_INPUT,old);
  const gate=delayedProfiles(f.profiles,'package-close'),operation=f.stage(prepared,{storage:storage(gate.profiles)}),refused=assert.rejects(operation);
  await gate.entered;f.putNative(realmFiles('1_0').marker,Buffer.from('invalid\n'));gate.resume();await refused;
  assert.equal(hash(f.files.get(prefix+HERO_ARRIVAL_PACKAGE)),prepared.arrival.sha256);
  assert.deepEqual(f.files.get(prefix+HERO_ARRIVAL_INPUT),old);
  await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
});
for(const mode of ['input-write','input-close'])test(`cancelled ${mode} staging drains without authorizing a browser handoff`,async()=>{
  const f=await nativeHomePreparationFixture({capsule:true}),prepared=await f.prepareArrival(),gate=delayedProfiles(f.profiles,mode),controller=new AbortController();
  const before=new Map(f.files),operation=f.stage(prepared,{storage:storage(gate.profiles),signal:controller.signal}),refused=assert.rejects(operation,/closed|staging ended/);
  await gate.entered;controller.abort(Error('closed'));let ended=false;
  const ending=endNativeHeroGameSave(f.world,1).then(()=>ended=true);
  await new Promise(r=>setImmediate(r));assert.equal(ended,false);await f.locked();
  assert.throws(()=>f.stage(prepared),/held prepared return/);gate.resume();await refused;await ending;
  const inputPrefix='native-world-'+f.world+'/frontier_0_0/',allowed=new Set([HERO_ARRIVAL_PACKAGE,HERO_ARRIVAL_INPUT].map(n=>inputPrefix+n));
  assert.deepEqual(new Map([...f.files].filter(([n])=>!allowed.has(n))),before);
  assert.ok(!f.calls.some(c=>c.remove));await f.locked();f.assertBounded();
});
for(const fresh of [false,true])test(`outward travel prepares and stages all four hero records with a ${fresh?'proposed':'reused'} guild reference`,async()=>{
  const other=fresh?await registeredFixture():null;
  const f=await homePreparationFixture(other?{registration:other.registration}:{},{capsule:true});
  const before=new Map(f.files),prepared=await f.prepareArrival(),a=prepared.arrival,id=fresh?100:45;
  assert.equal(a.kind,'proxy-home');assert.equal(a.sourceClock,6400);assert.equal(a.destinationClock,9000);
  assert.equal(prepared.home.kind,fresh?'proposal':'existing');assert.equal(prepared.home.agentId,id);
  assert.equal(a.plan.registeredHome.destinationNativeMembershipRequired,false);
  assert.equal(a.plan.registeredHome.destination.agentId,id);
  assert.equal(a.plan.registeredHome.scriptArrival,null);
  assert.equal(a.plan.registeredHome.nativeArrival,null);
  assert.equal(prepared.home.plan.admission,fresh?'reserve-new':'reuse-existing');
  assert.equal(prepared.sourceRetired,false);assert.equal(prepared.destinationActivated,false);assert.equal(prepared.ownerTransferred,false);
  if(fresh){
    assert.equal(a.homeProjection.agentId,id);assert.equal(a.homeProjection.insertedBytes,prepared.home.size+4);
    assert.equal(a.homeProjection.projectedSize,a.homeProjection.sourceSize+prepared.home.size+4);
    assert.equal(a.homeProjection.retainedPatchBytes,20);assert.equal(a.homeProjection.nativeHomeRegistered,false);
    assert.equal(a.homeProjection.worldWritten,false);assert.ok(Object.isFrozen(a.homeProjection));
  }else assert.equal(a.homeProjection,undefined);
  const pack=a.pack,view=new DataView(pack.buffer,pack.byteOffset,pack.byteLength);
  assert.equal(pack.length,a.size);assert.ok(pack.length<=256*1024);assert.equal(hash(pack),a.sha256);
  assert.deepEqual(Array.from({length:12},(_,i)=>view.getUint32(i*4,true)),
    [0x3141484d,1,4,6400,9000,502,27,id,100000,1000,0,pack.length-96]);
  let at=48;for(let kind=0;kind<4;kind++){
    assert.equal(view.getUint32(at,true),kind);assert.equal(view.getUint32(at+4,true),502);
    at+=12+view.getUint32(at+8,true);
  }assert.equal(at,pack.length);
  pack.fill(0);prepared.home.record.fill(0);assert.equal(hash(a.pack),a.sha256);
  assert.equal(hash(prepared.home.record),prepared.home.sha256);assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.plan.registeredHome));
  assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.write||c.create||c.close||c.remove||c.lock));
  const prefix='native-world-'+f.world+'/frontier_1_0/',allowed=new Set([HERO_ARRIVAL_HOME,HERO_ARRIVAL_PACKAGE,HERO_ARRIVAL_INPUT].map(n=>prefix+n));
  f.calls.length=0;const staged=await f.stage(prepared),request=JSON.parse(staged.inputManifest);
  assert.equal(request.kind,'majesty-hero-proxy-home-input-v1');assert.equal(request.serial,1);
  assert.deepEqual(request.sourceAlias,{unitId:502,agentId:27});assert.deepEqual(request.homeAlias,{kind:'proxy',unitId:0,agentId:id});
  assert.deepEqual(request.home,{filename:HERO_ARRIVAL_HOME,admission:prepared.home.plan.admission,
    size:prepared.home.size,sha256:prepared.home.sha256});
  assert.equal(request.ownerManifest,prepared.sourceOwnerManifest);assert.equal(request.sourceNativeManifest,prepared.sourceNativeManifest);
  assert.equal(request.destinationNativeManifest,prepared.destinationNativeManifest);
  assert.equal(hash(f.files.get(prefix+HERO_ARRIVAL_HOME)),prepared.home.sha256);
  assert.equal(hash(f.files.get(prefix+HERO_ARRIVAL_PACKAGE)),a.sha256);
  assert.equal(f.files.get(prefix+HERO_ARRIVAL_INPUT).toString(),staged.inputManifest);
  assert.equal(hash(Buffer.from(staged.inputManifest)),staged.inputSha256);
  assert.deepEqual(new Map([...f.files].filter(([n])=>!allowed.has(n))),before);
  assert.deepEqual(f.calls.filter(c=>c.close).map(c=>c.close),[HERO_ARRIVAL_HOME,HERO_ARRIVAL_PACKAGE,HERO_ARRIVAL_INPUT].map(n=>prefix+n));
  assert.ok(f.calls.filter(c=>c.write||c.close||c.create).every(c=>allowed.has(c.write||c.close||c.file)));
  for(const key of ['sourceRetired','destinationLoaded','heroImported','ownerTransferred'])assert.equal(staged[key],false,key);
  await f.locked();f.calls.length=0;assert.equal((await f.stage(prepared)).idempotent,true);
  assert.ok(!f.calls.some(c=>c.write||c.create||c.close||c.remove||c.lock));
  await endNativeHeroGameSave(f.world,1);assert.equal(hash(a.pack),a.sha256);
  assert.throws(()=>f.stage(prepared),/held prepared return/);await f.locked();f.assertBounded();
});
test('outward travel refuses an incomplete original record set without publishing a capsule',async()=>{
  const f=await homePreparationFixture(),before=new Map(f.files);
  await assert.rejects(f.prepareArrival(),/four original records/);
  assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.write||c.create||c.close||c.remove));
  await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
});
test('outward staging refuses copied capabilities and changed saved kingdoms or owner heads before writes',async()=>{
  for(const defect of ['capability','source','destination','owner']){
    const f=await homePreparationFixture({},{capsule:true}),prepared=await f.prepareArrival();
    if(defect==='owner')f.files.set(f.routePrefix+HERO_ROUTE_HEAD,Buffer.from(f.head.manifest));
    else if(defect!=='capability')f.putNative(realmFiles(defect==='source'?'0_0':'1_0').marker,Buffer.from('invalid\n'));
    const before=new Map(f.files);f.calls.length=0;
    if(defect==='capability')assert.throws(()=>f.stage({...prepared}),/held prepared return/);
    else await assert.rejects(f.stage(prepared));
    assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.write||c.create||c.close||c.remove));
    await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
  }
});
test('changed source after outward package close cannot publish the new input manifest',async()=>{
  const f=await homePreparationFixture({},{capsule:true}),prepared=await f.prepareArrival();
  const prefix='native-world-'+f.world+'/frontier_1_0/',old=Buffer.from('{"version":1,"serial":0}\n');
  f.files.set(prefix+HERO_ARRIVAL_INPUT,old);
  const gate=delayedProfiles(f.profiles,'package-close'),operation=f.stage(prepared,{storage:storage(gate.profiles)}),refused=assert.rejects(operation);
  await gate.entered;f.putNative(realmFiles('0_0').marker,Buffer.from('invalid\n'));gate.resume();await refused;
  assert.equal(hash(f.files.get(prefix+HERO_ARRIVAL_HOME)),prepared.home.sha256);
  assert.equal(hash(f.files.get(prefix+HERO_ARRIVAL_PACKAGE)),prepared.arrival.sha256);
  assert.deepEqual(f.files.get(prefix+HERO_ARRIVAL_INPUT),old);
  await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
});
for(const mode of ['input-write','input-close'])test(`cancelled outward ${mode} drains while preserving both kingdoms and the selected owner`,async()=>{
  const other=await registeredFixture(),f=await homePreparationFixture({registration:other.registration},{capsule:true});
  const prepared=await f.prepareArrival(),gate=delayedProfiles(f.profiles,mode),controller=new AbortController(),before=new Map(f.files);
  const operation=f.stage(prepared,{storage:storage(gate.profiles),signal:controller.signal}),refused=assert.rejects(operation,/closed|staging ended/);
  await gate.entered;controller.abort(Error('closed'));let ended=false;
  const ending=endNativeHeroGameSave(f.world,1).then(()=>ended=true);
  await new Promise(r=>setImmediate(r));assert.equal(ended,false);await f.locked();
  assert.throws(()=>f.stage(prepared),/held prepared return/);gate.resume();await refused;await ending;
  const prefix='native-world-'+f.world+'/frontier_1_0/',allowed=new Set([HERO_ARRIVAL_HOME,HERO_ARRIVAL_PACKAGE,HERO_ARRIVAL_INPUT].map(n=>prefix+n));
  assert.deepEqual(new Map([...f.files].filter(([n])=>!allowed.has(n))),before);
  assert.ok(!f.calls.some(c=>c.remove));await f.locked();f.assertBounded();
});
test('held home preparation reuses the exact immutable guild projection without changing source or destination',async()=>{
  const f=await homePreparationFixture(),before=new Map(f.files),prepared=await f.prepare();
  assert.equal(prepared.kind,'saved');assert.equal(prepared.home.kind,'existing');assert.equal(prepared.home.agentId,45);
  assert.equal(prepared.home.clock,9000);assert.equal(prepared.home.plan.guildEntityId,f.registration.guildEntityId);
  assert.equal(prepared.home.plan.worldId,f.request.worldId);assert.equal(prepared.ownerTransferred,false);
  assert.equal(prepared.sourceRetired,false);assert.equal(prepared.destinationActivated,false);
  const bytes=prepared.home.record;
  await verifyRemoteHomeAgent({size:bytes.length,async readAt(at,n){return bytes.slice(at,at+n);}},registeredHeroHome(f.identity),45);
  assert.equal(hash(bytes),prepared.home.sha256);bytes.fill(0);
  assert.equal(hash(prepared.home.record),prepared.home.sha256,'returned copies cannot mutate the retained proposal');
  assert.ok(Object.isFrozen(prepared.home.plan.home));
  assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.write||c.create));await f.locked();
  await endNativeHeroGameSave(f.world,1);assert.throws(()=>f.prepare());f.assertBounded();
});
test('a foreign logical guild remains unchanged while a fresh bounded home record is proposed',async()=>{
  const other=await registeredFixture(),f=await homePreparationFixture({registration:other.registration});
  const before=new Map(f.files),prepared=await f.prepare();
  assert.equal(prepared.home.kind,'proposal');assert.equal(prepared.home.agentId,100);
  assert.ok(prepared.home.size<=1024);assert.equal(prepared.home.plan.guildEntityId,f.registration.guildEntityId);
  assert.notEqual(prepared.home.plan.guildEntityId,other.registration.guildEntityId);
  const bytes=prepared.home.record;
  await verifyRemoteHomeAgent({size:bytes.length,async readAt(at,n){return bytes.slice(at,at+n);}},registeredHeroHome(f.identity),100);
  assert.equal(prepared.home.plan.nativeHomeProjectionQualified,false);
  assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.write||c.create));
  await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
});
test('queued, native-associated and corrupt same-guild projections refuse instead of borrowing another home',async()=>{
  for(const options of [{queuedProxy:true},{proxyBacklink:true},{wrongProxy:true}]){
    const f=await homePreparationFixture(options),before=new Map(f.files);
    await assert.rejects(f.prepare());assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.write||c.create));
    await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
  }
});
test('home preparation refuses a manual save, another target, missing terrain and a missing destination before any write',async()=>{
  const manual=await setup({haloLayout:true});queueNativeHeroGameSave(manual.world,1);await manual.publish(terrainCapture(manual));
  manual.calls.length=0;assert.throws(()=>prepareNativeHeroTravelHome(manual.world,1,'1_0',{layout:'halo-v1',storage:storage(manual.profiles)}),/actual verified crossing/);
  assert.equal(manual.calls.length,0);await endNativeHeroGameSave(manual.world,1);
  const f=await homePreparationFixture();
  assert.throws(()=>prepareNativeHeroTravelHome(f.world,1,'0_1',{layout:'halo-v1',storage:storage(f.profiles)}),/accepted crossing/);
  assert.throws(()=>f.prepare({layout:undefined}),/held published/);
  const names=realmFiles('1_0');for(const name of [names.marker,...names.slots])f.files.delete(f.nativePath(name));
  await assert.rejects(f.prepare(),/Generate and pause/);
  const empty=await prepareNativeHeroTravel(f.world,1,'1_0',{layout:'halo-v1',storage:storage(f.profiles)});
  assert.equal(empty.kind,'new');assert.equal(empty.home,null);assert.equal(empty.sourceRetired,false);assert.equal(empty.ownerTransferred,false);
  assert.ok(!f.calls.some(c=>c.write||c.create));await endNativeHeroGameSave(f.world,1);await f.locked();
});
test('home preparation drains a cancelled owner read and retains the exclusive game lease',async()=>{
  const f=await homePreparationFixture(),gate=delayedProfiles(f.profiles,'read'),controller=new AbortController();
  const pending=f.prepare({storage:storage(gate.profiles),signal:controller.signal}),refused=assert.rejects(pending,/closed/);
  await gate.entered;assert.throws(()=>f.prepare(),/held published/);
  let ended=false;controller.abort(Error('closed'));const ending=endNativeHeroGameSave(f.world,1).then(()=>ended=true);
  await new Promise(r=>setImmediate(r));assert.equal(ended,false);await f.locked();
  gate.resume();await refused;await ending;assert.equal(ended,true);
  assert.ok(!f.calls.some(c=>c.write||c.create));await f.locked();f.assertBounded();
});
test('unprepared geometry or stale crossing identities cannot consume a save serial',async()=>{
  for(const layout of [false,true]){
    const f=await setup({haloLayout:layout}),crossing=crossingBoundary();f.calls.length=0;
    for(const change of layout?[{serial:2},{unitId:503},{agentId:28},{previousClock:3199},{target:'0_1'}]:[{}])
      assert.throws(()=>queueNativeHeroGameSave(f.world,1,{crossing:{...crossing,...change}}));
    assert.equal(f.calls.length,0);
    queueNativeHeroGameSave(f.world,1,layout?{crossing}:{});await endNativeHeroGameSave(f.world,1);await f.locked();
  }
});
test('crossing capture clock, position, life and physical parent refuse before writing custody',async()=>{
  for(const defect of ['clock','position','height','parent','dead','layout']){
    const f=await setup({haloLayout:true}),crossing=crossingBoundary();
    const options={...(defect==='position'?{position:{...crossing.accepted,x:crossing.accepted.x+1}}:{}),
      ...(defect==='height'?{position:{...crossing.accepted,z:crossing.accepted.z+1}}:{}),
      ...(defect==='parent'?{parent:469}:{}),...(defect==='dead'?{heroState:516}:{})};
    const boundary=await crossingCapture(f,crossing,options,defect==='layout'?{legacy:true}:{});if(defect==='clock')boundary.clock++;
    queueNativeHeroGameSave(f.world,1,{crossing});
    const before=new Map([...f.files].map(([n,b])=>[n,Buffer.from(b)]));f.calls.length=0;
    if(defect==='clock')assert.throws(()=>f.publish(boundary),/accepted crossing tick/);
    else await assert.rejects(f.publish(boundary),/accepted position|living outdoor|explicit halo layout/);
    assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.write||c.create));
    await endNativeHeroGameSave(f.world,1);await f.locked();f.assertBounded();
  }
});
test('held hero travel admits only one saved or empty halo neighbor using the published source',async()=>{
  for(const saved of [false,true]){
    const f=await setup(),boundary=terrainCapture(f);if(saved)terrainCapture(f,'1_0');
    queueNativeHeroGameSave(f.world,1);const publication=await f.publish(boundary),before=new Map([...f.files].map(([n,b])=>[n,Buffer.from(b)]));
    f.calls.length=0;
    const result=await inspectNativeHeroTravelDestination(f.world,1,'1_0',{layout:'halo-v1',storage:storage(f.profiles)});
    assert.equal(result.kind,saved?'saved':'new');assert.equal(result.sourceOwnerManifest,publication.ownerManifest);
    assert.equal(result.sourceRegion,'0_0');assert.equal(result.targetRegion,'1_0');assert.equal(result.layout.verifiedVertices,16641);
    if(saved){assert.equal(result.destinationLayout.verifiedVertices,16641);assert.ok(result.destinationNativeManifest);}
    else assert.equal(result.destinationNativeManifest,null);
    assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.write||c.create));
    assert.equal(f.calls.filter(c=>c.lock).length,0);await f.locked();
    await endNativeHeroGameSave(f.world,1);
    assert.throws(()=>inspectNativeHeroTravelDestination(f.world,1,'1_0',{layout:'halo-v1',storage:storage(f.profiles)}));f.assertBounded();
  }
});
test('travel admission requires completed publication, its exact serial and an explicit cardinal layout before file I/O',async()=>{
  const f=await setup(),boundary=terrainCapture(f);f.calls.length=0;
  const inspect=(serial=1,target='1_0',layout='halo-v1')=>inspectNativeHeroTravelDestination(f.world,serial,target,{layout,storage:storage(f.profiles)});
  assert.throws(()=>inspect());queueNativeHeroGameSave(f.world,1);assert.throws(()=>inspect());assert.equal(f.calls.length,0);
  await f.publish(boundary);f.calls.length=0;
  for(const args of [[2,'1_0','halo-v1'],[1,'0_0','halo-v1'],[1,'1_1','halo-v1'],[1,'2_0','halo-v1'],[1,'1_0','v1']])assert.throws(()=>inspect(...args));
  const controller=new AbortController();controller.abort(Error('closed'));
  assert.throws(()=>inspectNativeHeroTravelDestination(f.world,1,'1_0',{layout:'halo-v1',signal:controller.signal,storage:storage(f.profiles)}),/closed/);
  assert.throws(()=>inspectNativeHeroTravelDestination(f.world,1,'1_0',{layout:'halo-v1',signal:{throwIfAborted(){}},storage:storage(f.profiles)}),/cancellation/);
  assert.equal(f.calls.length,0);await endNativeHeroGameSave(f.world,1);await f.locked();
});
test('unregistered neighbor files, legacy terrain and replaced source saves refuse without changing either kingdom',async()=>{
  for(const defect of ['orphan','legacy-source','legacy-destination','changed-source','bad-height']){
    const f=await setup(),boundary=terrainCapture(f,'0_0',defect==='legacy-source'?{legacy:true}:{});
    if(defect==='orphan')f.putNative(realmFiles('1_0').slots[0],Buffer.alloc(0));
    else terrainCapture(f,'1_0',defect==='legacy-destination'?{legacy:true}:defect==='bad-height'?{defect:{x:70,y:70}}:{});
    queueNativeHeroGameSave(f.world,1);await f.publish(boundary);
    if(defect==='changed-source')f.putNative(realmFiles('0_0').marker,Buffer.from('invalid\n'));
    const before=new Map([...f.files].map(([n,b])=>[n,Buffer.from(b)]));f.calls.length=0;
    await assert.rejects(inspectNativeHeroTravelDestination(f.world,1,'1_0',{layout:'halo-v1',storage:storage(f.profiles)}));
    assert.deepEqual(f.files,before,defect);assert.ok(!f.calls.some(c=>c.write||c.create));await endNativeHeroGameSave(f.world,1);await f.locked();
  }
});
test('ending the native held state drains in-flight layout I/O and cannot release the injected world lock',async()=>{
  const f=await setup(),boundary=terrainCapture(f);queueNativeHeroGameSave(f.world,1);await f.publish(boundary);
  const entered=deferred(),resume=deferred();let delayed=false;
  const decorate=folder=>({getDirectoryHandle:async(name,options)=>decorate(await folder.getDirectoryHandle(name,options)),
    async getFileHandle(name,options){const handle=await folder.getFileHandle(name,options);
      return {async getFile(){const file=await handle.getFile();return {size:file.size,slice(at,end){const part=file.slice(at,end);
        return {async arrayBuffer(){if(!delayed&&end-at===1161){delayed=true;entered.resolve();await resume.promise;}return part.arrayBuffer();}};
      }};}};
    },
  });
  const operation=inspectNativeHeroTravelDestination(f.world,1,'1_0',{layout:'halo-v1',storage:storage(decorate(f.profiles))});
  const refused=assert.rejects(operation,/held read ended/);await entered.promise;
  assert.throws(()=>inspectNativeHeroTravelDestination(f.world,1,'1_0',{layout:'halo-v1',storage:storage(f.profiles)}));
  let finished=false;const end=endNativeHeroGameSave(f.world,1).then(()=>finished=true);
  await new Promise(r=>setImmediate(r));assert.equal(finished,false);await f.locked();resume.resolve();await refused;await end;
  assert.equal(finished,true);await f.locked();assert.equal((await f.reader.read()).record.revision,1);f.assertBounded();
});
