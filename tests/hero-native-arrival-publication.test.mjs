import test from 'node:test';
import assert from 'node:assert/strict';
import {browserWorldStorage} from './fixtures/browser-world-storage.mjs';
import {world,source,hash} from './fixtures/registered-hero-world.mjs';
import {publishNativeHeroArrivalOwner,HERO_RETIRED_SNAPSHOT,HERO_ARRIVAL_ACK} from '../web/world/hero-native-arrival-publication.mjs';
import {nativeHeroArrivalReady} from '../web/world/hero-travel-publication.mjs';
import {realmFiles} from '../web/world/realm-store.mjs';
import {HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {afterFileClose} from './fixtures/after-file-close.mjs';

async function setup({returning=false}={}){
 const f=await browserWorldStorage({browserContent:true});
 let captured,retired,incoming,sourceRegion,region,alias,home,clock;
 if(returning){
  await f.route.commit({kind:'handoff',operationId:'2'.repeat(64),expectedManifest:f.head.manifest,regions:['0_0','1_0'],
   aliases:f.aliases,homeAliases:f.homeAliases,
   worlds:[world(0,false),world(1,true,{registration:f.registration})].map(b=>({source:source(b),sha256:hash(b)}))});
  sourceRegion='1_0';region='0_0';alias=f.aliases[1];home=f.homeAliases[1];clock=9600;
  captured=world(1,true,{registration:f.registration,savedClock:clock,variant:1});
  retired=world(1,false,{registration:f.registration,savedClock:clock,variant:2});
  incoming=world(0,true,{uid:503,gid:28,savedClock:6400,variant:3});
 }else{
  sourceRegion='0_0';region='1_0';alias=f.aliases[0];home=f.homeAliases[0];clock=6400;
  captured=world(0,true,{savedClock:clock,variant:1});retired=world(0,false,{savedClock:clock,variant:2});
  incoming=world(1,true,{registration:f.registration,savedClock:9000,variant:3});
 }
 const selected=await f.route.commit({kind:'save',operationId:'3'.repeat(64),expectedManifest:(await f.route.read()).record.manifest,
  regions:[sourceRegion],aliases:[alias],homeAliases:[home],worlds:[{source:source(captured),sha256:hash(captured)}]});
 function native(key,bytes){const names=realmFiles(key);f.putNative(names.slots[1],bytes);
  const manifest=['checkpoint-v1',1,bytes.length,hash(bytes),f.request.content,''].join('\n');
  f.putNative(names.marker,Buffer.from(manifest));return manifest;
 }
 const sourceNativeManifest=native(sourceRegion,captured);native(region,incoming);
 const prefix='native-world-'+f.world+'/',retiredPath=prefix+'frontier_'+sourceRegion+'/Documents/My Games/MajestyHD/SaveGame/'+HERO_RETIRED_SNAPSHOT;
 f.files.set(retiredPath,retired);
 const ready=nativeHeroArrivalReady({serial:1,region,clock:returning?6400:9000,unitId:returning?503:602,
  agentId:returning?28:37,homeAgentId:returning?7:45,size:incoming.length,sha256:hash(incoming)});
 const request={worldId:f.request.worldId,entityId:f.request.entityId,content:f.request.content,ready,sourceRegion,
  sourceAlias:alias,sourceHome:home,sourceClock:clock,sourceNativeManifest,sourceOwnerManifest:selected.manifest};
 return {...f,request,retiredPath,ackPath:prefix+'frontier_'+region+'/'+HERO_ARRIVAL_ACK,
  publish:(options={})=>publishNativeHeroArrivalOwner(f.profiles,f.world,request,{locks:f.locks,...options})};
}

for(const returning of [false,true])test(`profile publication selects the actual ${returning?'native-home return':'proxy-home arrival'} pair before its acknowledgement`,async()=>{
 const f=await setup({returning}),before=new Map(f.files);f.calls.length=0;
 const result=await f.publish({boundary:async phase=>assert.equal(f.files.has(f.ackPath),false,phase)});
 assert.equal(result.region,returning?'0_0':'1_0');assert.equal(result.ownerRevision,returning?3:2);
 assert.equal(result.acknowledgementWritten,true);assert.equal(result.idempotent,false);
 assert.equal(f.files.get(f.ackPath).toString(),result.acknowledgement);
 assert.equal(f.files.get(f.routePrefix+HERO_ROUTE_HEAD).toString(),result.ownerManifest);
 for(const [path,bytes] of before)if(!path.startsWith(f.routePrefix))assert.deepEqual(f.files.get(path),bytes,path);
 assert.ok(f.calls.filter(c=>c.write||c.close||c.remove).every(c=>(c.write||c.close||c.remove).startsWith(f.routePrefix)||
  (c.write||c.close)===f.ackPath));
 f.calls.length=0;const retry=await f.publish();assert.equal(retry.idempotent,true);
 assert.equal(retry.acknowledgementWritten,false);assert.equal(retry.acknowledgementUnchanged,true);
 assert.ok(!f.calls.some(c=>c.create||c.write||c.close||c.remove));f.assertBounded();
});

for(const defect of ['source-marker','target-marker','target-digest','retired-live-owner','retired-clock','ready-alias','owner-head'])
 test(`changed ${defect} cannot publish or acknowledge an arrival`,async()=>{
  const f=await setup();
  if(defect==='source-marker')f.putNative(realmFiles('0_0').marker,Buffer.from('wrong\n'));
  if(defect==='target-marker')f.putNative(realmFiles('1_0').marker,Buffer.from('wrong\n'));
  if(defect==='target-digest'){const n=f.nativePath(realmFiles('1_0').slots[1]),b=Buffer.from(f.files.get(n));b[32]^=1;f.files.set(n,b);}
  if(defect==='retired-live-owner')f.files.set(f.retiredPath,world(0,true,{savedClock:6400}));
  if(defect==='retired-clock')f.files.set(f.retiredPath,world(0,false,{savedClock:6401}));
  if(defect==='ready-alias')f.request.ready=f.request.ready.replace('|602|37|','|603|38|');
  if(defect==='owner-head')f.request.sourceOwnerManifest=f.head.manifest;
  const before=new Map(f.files);f.calls.length=0;
  await assert.rejects(f.publish());assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.write||c.close||c.remove));f.assertBounded();
 });

test('a native marker changed after paired commit prevents acknowledgement and retains the selected journal',async()=>{
 const f=await setup();
 await assert.rejects(f.publish({boundary:async phase=>{if(phase==='after-publish')
  f.putNative(realmFiles('1_0').marker,Buffer.from('changed\n'));}}));
 assert.equal((await f.route.read()).owner.region,'1_0');assert.equal(f.files.has(f.ackPath),false);f.assertBounded();
});

test('cancellation after journal publication produces no acknowledgement and an exact retry recovers without a new revision',async()=>{
 const f=await setup(),controller=new AbortController();
 await assert.rejects(f.publish({signal:controller.signal,boundary:async phase=>{if(phase==='after-publish')controller.abort(Error('closed'));}}),/closed/);
 assert.equal(f.files.has(f.ackPath),false);assert.equal((await f.route.read()).record.revision,2);
 const retried=await f.publish();assert.equal(retried.idempotent,true);assert.equal(retried.ownerRevision,2);
 assert.equal(retried.acknowledgementWritten,true);f.assertBounded();
});

test('an open game without a borrowed lease refuses publication before any file access',async()=>{
 const f=await setup();f.busy(true);f.calls.length=0;
 await assert.rejects(f.publish(),/held world lease/);assert.equal(f.calls.filter(c=>c.file||c.directory).length,0);
 assert.equal(f.files.has(f.ackPath),false);f.busy(false);
});

test('an uncertain acknowledgement close retains the published pair and retries without journal or receipt writes',async()=>{
 const f=await setup(),controller=new AbortController();let entered,resume;
 const entering=new Promise(r=>entered=r),resuming=new Promise(r=>resume=r);
 const decorate=folder=>({
  async getDirectoryHandle(name,options){return decorate(await folder.getDirectoryHandle(name,options));},
  removeEntry:name=>folder.removeEntry(name),
  async getFileHandle(name,options){const handle=await folder.getFileHandle(name,options);return {
   getFile:()=>handle.getFile(),async createWritable(){const stream=await handle.createWritable();return {
    write:bytes=>stream.write(bytes),abort:()=>stream.abort(),async close(){await stream.close();
     if(name===HERO_ARRIVAL_ACK){entered();await resuming;}
    },
   };},
  };},
 });
 const operation=publishNativeHeroArrivalOwner(decorate(f.profiles),f.world,f.request,{locks:f.locks,signal:controller.signal}),
  refused=assert.rejects(operation,/closed/);
 await entering;assert.equal(f.files.has(f.ackPath),true);controller.abort(Error('closed'));
 await f.locks.request('majesty-pair-native-world-'+f.world,{mode:'exclusive',ifAvailable:true},lock=>assert.equal(lock,null));
 resume();await refused;assert.equal((await f.route.read()).record.revision,2);
 f.calls.length=0;const retry=await f.publish();assert.equal(retry.idempotent,true);assert.equal(retry.acknowledgementWritten,false);
 assert.ok(!f.calls.some(c=>c.create||c.write||c.close||c.remove));f.assertBounded();
});

test('halo travel refuses an activated save without its validated geometry before journal or acknowledgement writes',async()=>{
 const f=await setup(),before=new Map(f.files);f.calls.length=0;
 await assert.rejects(f.publish({haloLayout:'halo-v1'}));assert.deepEqual(f.files,before);
 assert.ok(!f.calls.some(c=>c.write||c.close||c.remove));f.assertBounded();
});

async function interruptedArrival(f){
 let recovery;
 const profiles=afterFileClose(f.profiles,HERO_ARRIVAL_ACK,async()=>{throw Error('uncertain arrival close');});
 await assert.rejects(publishNativeHeroArrivalOwner(profiles,f.world,f.request,
  {locks:f.locks,onRecovery:value=>recovery=value}),/uncertain arrival close/);
 assert.ok(recovery);assert.equal(Object.isFrozen(recovery),true);assert.deepEqual(Object.keys(recovery),[]);
 return recovery;
}
function nextNativeCapture(f){
 const returning=f.request.sourceRegion==='1_0',region=returning?'0_0':'1_0';
 const bytes=world(returning?0:1,true,{registration:f.registration,uid:returning?503:602,gid:returning?28:37,
  savedClock:returning?6450:9050,variant:4}),names=realmFiles(region);
 f.putNative(names.slots[0],bytes);
 f.putNative(names.marker,Buffer.from(['checkpoint-v1',0,bytes.length,hash(bytes),f.request.content,''].join('\n')));
}
for(const returning of [false,true])test(`uncertain ${returning?'return':'outward'} receipt recovers after the native save advances without writes`,async()=>{
 const f=await setup({returning}),recovery=await interruptedArrival(f);nextNativeCapture(f);
 const before=new Map(f.files);f.calls.length=0;
 const result=await f.publish({recovery});
 assert.equal(result.recoveredAcknowledgement,true);assert.equal(result.idempotent,true);
 assert.equal(result.ownerRevision,returning?3:2);assert.equal(result.acknowledgementWritten,false);
 assert.equal(result.acknowledgementUnchanged,true);assert.deepEqual(f.files,before);
 assert.ok(!f.calls.some(c=>c.create||c.write||c.close||c.remove));
 assert.ok(!f.calls.some(c=>c.read&&!c.read.startsWith(f.routePrefix)&&c.read!==f.ackPath));f.assertBounded();
});
for(const defect of ['missing-receipt','wrong-receipt','changed-owner','changed-selected-save','changed-dormant-save','copied-capability','changed-request','changed-layout'])
 test(`advanced arrival recovery refuses ${defect} without writes`,async()=>{
  const f=await setup();let recovery=await interruptedArrival(f);nextNativeCapture(f);
  if(defect==='missing-receipt')f.files.delete(f.ackPath);
  if(defect==='wrong-receipt'){const bytes=Buffer.from(f.files.get(f.ackPath));bytes[bytes.length-2]^=1;f.files.set(f.ackPath,bytes);}
  if(defect==='changed-owner')f.files.set(f.routePrefix+HERO_ROUTE_HEAD,Buffer.from(f.head.manifest));
  if(defect==='changed-selected-save'||defect==='changed-dormant-save'){
   const head=JSON.parse(f.files.get(f.routePrefix+HERO_ROUTE_HEAD)),node=JSON.parse(f.files.get(f.routePrefix+`Frontier_Hero_Route_Node_${head.revision}.json`));
   const owner=defect==='changed-selected-save'?node.changes.at(-1):node.changes[0],name=f.routePrefix+`Frontier_Hero_Route_${owner.region}_${owner.slot}.GMP`,bytes=Buffer.from(f.files.get(name));
   bytes[32]^=1;f.files.set(name,bytes);
  }
  if(defect==='copied-capability')recovery={...recovery};
  if(defect==='changed-request')f.request.ready=f.request.ready.replace('|9000|','|9001|');
  const before=new Map(f.files);f.calls.length=0;
  await assert.rejects(async()=>f.publish({recovery,...(defect==='changed-layout'?{haloLayout:'halo-v1'}:{})}));
  assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.create||c.write||c.close||c.remove));f.assertBounded();
 });
