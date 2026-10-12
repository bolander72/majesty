import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const moduleRoot=new URL(process.env.MAJESTY_DESTINATION_STAGED==='1'?
  '../upstream/majesty-recomp/build/web-site/world/':'../web/world/',import.meta.url);
const {startNativeWorldPlayer,withNativeWorldNeighborRead,nativeRegionSessionMode}=await import(new URL('realm-session.mjs',moduleRoot));
const {checkNativeDestination}=await import(new URL('native-destination.mjs',moduleRoot));
const {completedHeroRestoreURL,nativeHeroRestoreConfig}=await import(new URL('hero-route-launch.mjs',moduleRoot));
import {realmFiles} from '../web/world/realm-store.mjs';
import {nativeRealmRelativePath} from '../web/world/realm-profile.mjs';
import {selectedRegion,atlasURL,neighboringRegionURL} from '../web/world/region.mjs';
import {selectedWorld} from '../web/world/world-name.mjs';

const content='a'.repeat(64)+':'+'b'.repeat(64);
let serial=0;
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function checkpoint(){
  const bytes=Buffer.alloc(12032);bytes.write('VERS');bytes.writeUInt32LE(256,4);bytes.writeUInt32LE(1,8);
  bytes.write('TEST',272);bytes.writeUInt32LE(bytes.length-288,276);return bytes;
}
function fixture(){
  const world='admission-'+(++serial),files=new Map(),calls=[],held=new Set();let directories=0,reads=0,largest=0,gate=null,lookupGate=null,deny=null;
  const missing=()=>Object.assign(Error('missing'),{name:'NotFoundError'});
  const directory=prefix=>({async getDirectoryHandle(name,options){
    const path=prefix?prefix+'/'+name:name;calls.push({path,create:options?.create===true});
    if(lookupGate?.path===path){const wait=lookupGate;lookupGate=null;wait.entered.resolve();await wait.resume.promise;}
    if(path===deny)throw Object.assign(Error('permission denied'),{name:'NotAllowedError'});
    if(path==='majesty'||path==='majesty/profile'||[...files.keys()].some(key=>key.startsWith(path+'/')))return directory(path);
    throw missing();
  },async getFileHandle(name,options){
    const path=prefix+'/'+name;calls.push({path,create:options?.create===true});
    if(!files.has(path))throw missing();const bytes=files.get(path);
    return {async getFile(){return {size:bytes.length,slice(at,end){
      ++reads;largest=Math.max(largest,end-at);
      return {async arrayBuffer(){if(gate&&reads===gate.read){const wait=gate;gate=null;wait.entered.resolve();await wait.resume.promise;}return Uint8Array.from(bytes.subarray(at,end)).buffer;}};
    }};}};
  }});
  const locks={async request(name,options,fn){calls.push({lock:name,...options});if(held.has(name))return fn(null);
    held.add(name);try{return await fn({});}finally{held.delete(name);}}};
  const events={addEventListener(){},removeEventListener(){}};
  const storage={async getDirectory(){++directories;return directory('');}};
  function path(key,name){return ['majesty','profile','native-world-'+world,...nativeRealmRelativePath(name)].join('/');}
  function put(key,name,bytes){files.set(path(key,name),bytes);}
  function saved(key='1_0',{bytes=checkpoint(),slot=0,identity=content,digest=createHash('sha256').update(bytes).digest('hex')}={}){
    const names=realmFiles(key);put(key,names.slots[slot],bytes);
    put(key,names.marker,Buffer.from(['checkpoint-v1',slot,bytes.length,digest,identity,''].join('\n')));return names;
  }
  async function start(mode='injected'){
    const entered=deferred();
    const startup=startNativeWorldPlayer((profile,retain)=>{
      if(mode==='before')throw Error('before injection');
      if(mode!=='preparing')retain();entered.resolve();
      if(mode==='after')throw Error('after injection');
    },{search:new URLSearchParams({world,profile:'frontier_0_0',RECOMP_RULE_FRONTIER_REGION:'0_0'}).toString(),locks,events});
    if(mode==='before'||mode==='after')await assert.rejects(startup,new RegExp(mode+' injection'));
    else await entered.promise;
  }
  return {world,files,calls,held,storage,start,path,put,saved,
    check:(key='1_0',options={})=>checkNativeDestination(world,key,{content,storage,...options}),
    delay(read=1){gate={read,entered:deferred(),resume:deferred()};return gate;},deny(path){deny=path;},
    delayLookup(path){lookupGate={path,entered:deferred(),resume:deferred()};return lookupGate;},
    get reads(){return reads;},get largest(){return largest;},get directories(){return directories;}};
}

test('only the injected owning document may check a canonical neighbor under its existing exclusive lock',async()=>{
  const f=fixture();
  await assert.rejects(f.check(),/initialized world/);assert.equal(f.directories,0);
  await f.start('preparing');await assert.rejects(f.check(),/initialized world/);assert.equal(f.directories,0);
  const own=fixture();await own.start();
  for(const key of ['0_0','2_0','1_1','01_0','-0_1','1000001_0'])await assert.rejects(own.check(key));
  await assert.rejects(checkNativeDestination('other-world','1_0',{content,storage:own.storage}),/initialized world/);
  assert.equal(own.directories,0);
  assert.deepEqual(await own.check(),{key:'1_0',kind:'new'});
  assert.equal(own.calls.filter(c=>c.lock).length,1,'read borrows the game lock instead of reacquiring it');
  assert.equal(own.held.size,1,'checking must not release the injected game');
  assert.ok(own.calls.every(c=>!c.create));assert.equal(own.files.size,0);
});
test('startup failure before injection grants no read capability; failure after injection retains the engine lease',async()=>{
  const before=fixture();await before.start('before');assert.equal(before.held.size,0);
  await assert.rejects(before.check(),/initialized world/);
  const after=fixture();await after.start('after');assert.equal(after.held.size,1);
  assert.deepEqual(await after.check(),{key:'1_0',kind:'new'});assert.equal(after.held.size,1);
});
for(const slot of [0,1])test(`valid committed slot ${slot} admits return, including an empty inactive slot`,async()=>{
  const f=fixture();await f.start();const names=f.saved('1_0',{slot});f.put('1_0',names.slots[1-slot],Buffer.alloc(0));
  const originals=[...f.files];assert.deepEqual(await f.check(),{key:'1_0',kind:'saved'});
  assert.deepEqual([...f.files],originals);assert.ok(f.largest<=4096);
  assert.equal(f.calls.filter(c=>c.lock).length,1);assert.ok(f.calls.every(c=>!c.create));
  assert.ok(f.calls.filter(c=>c.path?.includes('Frontier_')).every(c=>c.path===f.path('1_0',names.marker)||c.path===f.path('1_0',names.slots[slot])));
});
for(const [slot,length] of [[0,0],[0,10],[1,0],[1,9000]])test(`marker absence preserves orphan slot ${slot} of size ${length}`,async()=>{
  const f=fixture();await f.start();const name=realmFiles('1_0').slots[slot],bytes=Buffer.alloc(length);f.put('1_0',name,bytes);
  await assert.rejects(f.check(),/unregistered save data/);assert.equal(f.files.get(f.path('1_0',name)),bytes);assert.equal(f.reads,0);
});
for(const fault of ['content','digest','missing-slot','header','boundary','truncated-root','root-budget','marker','oversized-marker','empty-marker','oversized-slot'])
test(`existing ${fault} failure refuses without modifying saved data`,async()=>{
  const f=fixture();await f.start();let bytes=checkpoint();
  if(fault==='header')bytes.writeUInt32LE(2,8);
  if(fault==='boundary')bytes.writeUInt32LE(bytes.length,276);
  if(fault==='truncated-root')bytes=Buffer.concat([bytes,Buffer.alloc(1)]);
  if(fault==='root-budget'){
    const empty=Buffer.alloc(16);empty.write('TEST');bytes=Buffer.concat([bytes,...Array(127).fill(empty)]);
  }
  const names=f.saved('1_0',{bytes,identity:fault==='content'?'other-mods':content,digest:fault==='digest'?'0'.repeat(64):undefined});
  if(fault==='missing-slot')f.files.delete(f.path('1_0',names.slots[0]));
  if(fault==='marker')f.put('1_0',names.marker,Buffer.from('checkpoint-v1\n'));
  if(fault==='oversized-marker')f.put('1_0',names.marker,Buffer.alloc(512));
  if(fault==='empty-marker')f.put('1_0',names.marker,Buffer.alloc(0));
  if(fault==='oversized-slot'){
    const size=64*1024*1024+1;f.files.set(f.path('1_0',names.slots[0]),{length:size,subarray(){assert.fail('oversized body read');}});
    f.put('1_0',names.marker,Buffer.from(['checkpoint-v1',0,size,'0'.repeat(64),content,''].join('\n')));
  }
  const originals=[...f.files];await assert.rejects(f.check());assert.deepEqual([...f.files],originals);
  assert.ok(f.largest<=4096);assert.equal(f.held.size,1);assert.ok(f.calls.every(c=>!c.create));
});
test('unreadable destination is not mistaken for unexplored terrain',async()=>{
  const f=fixture();await f.start();f.saved();const originals=[...f.files];
  f.deny('majesty/profile/native-world-'+f.world+'/frontier_1_0');
  await assert.rejects(f.check(),/permission denied/);assert.deepEqual([...f.files],originals);assert.ok(f.calls.every(c=>!c.create));
});
test('borrowed reader refuses writes, other regions, large reads and use after callback completion',async()=>{
  const f=fixture();await f.start();const names=f.saved();let escaped,reader;
  await withNativeWorldNeighborRead(f.world,'1_0',async io=>{
    escaped=io;await assert.rejects(io.atomicWrite(names.marker,()=>{}),/read-only/);
    await assert.rejects(io.withLock('exclusive',()=>assert.fail('writer entered')),/read-only/);
    await assert.rejects(io.open(realmFiles('0_0').marker),/outside destination/);
    reader=await io.open(names.slots[0]);await assert.rejects(reader.readAt(0,4097),/out of bounds/);
    assert.equal((await reader.readAt(0,16)).length,16);
  },{storage:f.storage});
  const reads=f.reads;await assert.rejects(reader.readAt(0,16),/lease ended/);
  await assert.rejects(escaped.open(names.marker),/lease ended/);
  await assert.rejects(escaped.withLock('shared',()=>assert.fail('escaped lease entered')),/lease ended/);
  assert.equal(f.reads,reads);assert.equal(f.held.size,1);
});
for(const read of [1,2,3])test(`cancellation drains pending read ${read}, skips further hashing and preserves the engine lock`,async()=>{
  const f=fixture();await f.start();f.saved();const wait=f.delay(read),controller=new AbortController();
  const operation=f.check('1_0',{signal:controller.signal});await wait.entered.promise;
  const rejected=assert.rejects(operation,/cancelled/);controller.abort(Error('travel cancelled'));
  assert.equal(f.held.size,1);let settled=false;operation.catch(()=>settled=true);await Promise.resolve();assert.equal(settled,false);
  wait.resume.resolve();await rejected;assert.equal(f.reads,read);assert.equal(f.held.size,1);
  assert.deepEqual(await f.check(),{key:'1_0',kind:'saved'});
});
test('already cancelled requests do no storage I/O',async()=>{
  const f=fixture();await f.start();const controller=new AbortController();controller.abort(Error('already cancelled'));
  await assert.rejects(f.check('1_0',{signal:controller.signal}),/already cancelled/);assert.equal(f.directories,0);
});

test('cancellation during directory resolution starts no later lookup or file open',async()=>{
  const f=fixture();await f.start();f.saved();const wait=f.delayLookup('majesty/profile/native-world-'+f.world+'/frontier_1_0');
  const controller=new AbortController(),operation=f.check('1_0',{signal:controller.signal});await wait.entered.promise;
  const count=f.calls.length,rejected=assert.rejects(operation,/cancelled/);controller.abort(Error('lookup cancelled'));
  wait.resume.resolve();await rejected;assert.equal(f.calls.length,count);assert.equal(f.reads,0);assert.equal(f.held.size,1);
});

const controlsSource=await readFile(new URL('native.mjs',moduleRoot),'utf8');
function actualControls(f,extra={}){
  const elements=[],events=new Map(),navigations=[],journeys=[],replacements=[];
  const createElement=tag=>{const node={tag,style:{},disabled:false,textContent:'',setAttribute(){},appendChild(child){return child;}};elements.push(node);return node;};
  const document={createElement,body:createElement('body'),addEventListener:(name,fn)=>events.set(name,fn)};
  const search='?'+new URLSearchParams({world:f.world,profile:'frontier_0_0',RECOMP_RULE_FRONTIER_REGION:'0_0',...extra});
  const location={search,href:'http://localhost:8000/majesty/'+search,replace:value=>navigations.push(value)};
  const history={replaceState(state,title,value){const url=new URL(value);replacements.push(url.href);location.href=url.href;location.search=url.search;}};
  runInNewContext(controlsSource.replace(/^import .*;\n/gm,''),{selectedRegion,selectedWorld,atlasURL,neighboringRegionURL,nativeRegionSessionMode,completedHeroRestoreURL,nativeHeroRestoreConfig,
    document,location,history,URL,URLSearchParams,AbortController,addEventListener:(name,fn)=>events.set(name,fn),Module:{ENV:{RECOMP_CONTENT_IDENTITY:content}},
    checkNativeDestination:(world,key,options)=>checkNativeDestination(world,key,{...options,storage:f.storage}),
    recordJourneyArrival:()=>Promise.resolve(),recordJourney:destination=>{journeys.push(destination);return Promise.resolve();}});
  return {elements,navigations,journeys,replacements,location,status:elements.find(e=>e.tag==='output'),
    click:()=>elements.find(e=>e.textContent==='Save and travel east').onclick(),
    message:line=>events.get('recomp-runtime-message')({detail:line}),hide:()=>events.get('pagehide')(),
    poll(){const event={detail:{name:'frontier-checkpoint'}};events.get('recomp-action-poll')(event);return event.detail.pending===true;}};
}
test('actual controls consume owner bootstrap only when the selected native region becomes ready',async()=>{
  const f=fixture();await f.start();
  const extra={RECOMP_RULE_FRONTIER_RESTORE:'1',RECOMP_RULE_FRONTIER_HERO_RESTORE:'v1',
    'hero-world':'c'.repeat(64),'hero-entity':'d'.repeat(64)},ui=actualControls(f,extra);
  for(const message of ['restoring checkpoint','checkpoint restored']){
    ui.message('[frontier] Region 0_0 '+message);
    assert.equal(ui.replacements.length,0);
    assert.equal(new URL(ui.location.href).searchParams.get('hero-entity'),extra['hero-entity']);
  }
  ui.message('[frontier] Region 1_0 ready');assert.equal(ui.replacements.length,0);
  ui.message('[frontier] Region 0_0 ready');assert.equal(ui.replacements.length,1);
  const url=new URL(ui.location.href);
  assert.equal(url.searchParams.get('world'),f.world);
  assert.equal(url.searchParams.get('RECOMP_RULE_FRONTIER_RESTORE'),'1');
  for(const key of ['hero-world','hero-entity','RECOMP_RULE_FRONTIER_HERO_RESTORE']){
    assert.equal(url.searchParams.has(key),false);
    for(const node of ui.elements.filter(e=>e.tag==='a'&&e.href)){
      const link=new URL(node.href,url);
      if(node.textContent==='Restore previous checkpoint')assert.equal(link.searchParams.get(key),extra[key],'resume prepares the current saved hero again');
      else assert.equal(link.searchParams.has(key),false);
    }
  }
  ui.message('[frontier] Region 0_0 ready');assert.equal(ui.replacements.length,1);
  assert.equal(f.calls.filter(c=>c.lock).length,1);assert.equal(f.held.size,1);
});
for(const kind of ['new','saved','damaged'])test(`shipped travel adapter and actual owned OPFS admission handle a ${kind} neighbor`,async()=>{
  const f=fixture();await f.start();
  if(kind!=='new')f.saved('1_0',{digest:kind==='damaged'?'0'.repeat(64):undefined});
  const ui=actualControls(f),before=[...f.files];ui.message('[frontier] Region 0_0 ready');
  const operation=ui.click();assert.equal(ui.poll(),false);await operation;assert.deepEqual([...f.files],before);
  if(kind==='damaged'){
    assert.equal(ui.poll(),false);assert.match(ui.status.textContent,/Travel unavailable.*Damaged/);
    ui.message('[frontier] Region 0_0 checkpoint saved');assert.equal(ui.navigations.length,0);assert.equal(ui.journeys.length,0);
  }else{
    assert.equal(ui.poll(),true);assert.equal(ui.navigations.length,0);
    ui.message('[frontier] Region 0_0 checkpoint saved');await new Promise(resolve=>setImmediate(resolve));
    assert.equal(ui.navigations.length,1);assert.equal(ui.journeys.length,1);
    const url=new URL(ui.navigations[0]);assert.equal(url.searchParams.get('world'),f.world);assert.equal(url.searchParams.get('RECOMP_RULE_FRONTIER_REGION'),'1_0');
  }
  assert.equal(f.calls.filter(c=>c.lock).length,1);assert.equal(f.held.size,1);assert.ok(f.calls.every(c=>!c.create));
});
test('shipped pagehide aborts actual OPFS digest I/O without releasing the live engine lease',async()=>{
  const f=fixture();await f.start();f.saved();const wait=f.delay(2),ui=actualControls(f);
  ui.message('[frontier] Region 0_0 ready');const operation=ui.click();await wait.entered.promise;
  ui.hide();assert.equal(f.held.size,1);wait.resume.resolve();await operation;
  assert.equal(f.reads,2);assert.equal(ui.poll(),false);assert.equal(ui.navigations.length,0);assert.equal(ui.journeys.length,0);
  for(const node of ui.elements.filter(e=>e.tag==='button'))assert.equal(node.disabled,true);
  assert.equal(f.held.size,1);
});
