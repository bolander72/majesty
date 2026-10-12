import test from 'node:test';
import assert from 'node:assert/strict';
import {browserWorldStorage} from './fixtures/browser-world-storage.mjs';
import {source,hash} from './fixtures/registered-hero-world.mjs';
import {registerCheckpointGuildHome} from '../web/world/hero-home.mjs';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {opfsHeroRouteStorage} from '../web/world/hero-route-profile.mjs';
import {nativeHeroRestoreConfig,nativeHeroContentDigest,completedHeroRestoreURL} from '../web/world/hero-route-launch.mjs';
import {startNativeWorldPlayer} from '../web/world/realm-session.mjs';
import {realmFiles} from '../web/world/realm-store.mjs';
import {nativeRealmRelativePath} from '../web/world/realm-profile.mjs';
import {pairedLockName} from '../web/world/transfer-store.mjs';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {parseHeroRuntimeBinding} from '../web/world/hero-runtime-binding.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {haloTerrainCheckpoint} from './fixtures/halo-terrain-checkpoint.mjs';

function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
async function setup({terrain=null}={}){
  const f=await browserWorldStorage(),world=f.world+'-launch',contentDigest=nativeHeroContentDigest(f.request.content);
  if(terrain)f.worlds[0]=Buffer.concat([f.worlds[0],haloTerrainCheckpoint('0_0',terrain)]);
  const registration=await registerCheckpointGuildHome(source(f.worlds[0]),
    {worldId:f.request.worldId,contentDigest,region:'0_0',guildUnitId:469});
  const identity={...f.identity,contentDigest,entityId:registration.members[0].entityId,registeredHome:registration};
  const store=new HeroRouteStore(opfsHeroRouteStorage(f.profiles,world,identity.entityId,f.locks),identity,contentDigest);
  const head=await store.commit({kind:'seed',operationId:'1'.padStart(64,'0'),expectedManifest:null,regions:['0_0'],
    aliases:[{unitId:502,agentId:27}],homeAliases:[{kind:'native',unitId:469,agentId:7}],
    worlds:[{source:source(f.worlds[0]),sha256:hash(f.worlds[0])}]});
  const search='?'+new URLSearchParams({world,profile:'frontier_0_0',RECOMP_RULE_FRONTIER_REGION:'0_0',
    RECOMP_RULE_FRONTIER_RESTORE:'1',RECOMP_RULE_FRONTIER_HERO_RESTORE:'v1',
    'hero-world':f.request.worldId,'hero-entity':identity.entityId});
  const storage={async getDirectory(){return {async getDirectoryHandle(name){assert.equal(name,'majesty');
    return {async getDirectoryHandle(name){assert.equal(name,'profile');return f.profiles;}};
  }};}};
  const events={addEventListener(){},removeEventListener(){}};
  const options={search,locks:f.locks,events,storage};f.calls.length=0;
  return {...f,world,identity,head,search,options,
    path:name=>['native-world-'+world,...nativeRealmRelativePath(name)].join('/')};
}

test('owner startup refuses incomplete, ambiguous, network and session settings before any lock or storage access',async()=>{
  const f=await setup();assert.equal(nativeHeroRestoreConfig(''),null);
  const queries=[f.search+'&hero-entity='+'f'.repeat(64),f.search+'&RECOMP_RULE_FRONTIER_HERO_RESTORE=v1',
    f.search+'&room=other',f.search+'&mode=coop',f.search+'&relay=wss://example.test/rooms',
    f.search+'&RECOMP_RULE_FRONTIER_SESSION=v1',f.search+'&RECOMP_PROFILE_DIR=/opfs/other',
    f.search+'&RECOMP_FRONTIER_HERO_BINDING=forged',f.search+'&RECOMP_FRONTIER_HERO_HALO_BINDING=forged',
    '?hero-world='+'a'.repeat(64),'?RECOMP_RULE_FRONTIER_HERO_RESTORE=v1'];
  for(const key of ['world','hero-world','hero-entity','RECOMP_RULE_FRONTIER_RESTORE']){
    const q=new URLSearchParams(f.search);q.delete(key);queries.push(q.toString());
  }
  for(const search of queries){
    assert.throws(()=>nativeHeroRestoreConfig(search));
    await assert.rejects(startNativeWorldPlayer(()=>assert.fail('invalid startup'),{...f.options,search}));
  }
  assert.equal(f.calls.length,0);
});

test('current installed content and selected owner prepare before injection while the world lease stays exclusive',async()=>{
  const f=await setup(),controller=new AbortController(),entered=deferred(),order=[];let escaped;
  const startup=startNativeWorldPlayer(async(profile,retain,prepare)=>{
    assert.equal(profile,'native-world-'+f.world+'/frontier_0_0');order.push('content');escaped=prepare;
    const result=await prepare(f.request.content,{signal:controller.signal});order.push('prepared');
    assert.equal(result.ownerRevision,0);assert.equal(result.sha256,hash(f.worlds[0]));
    assert.deepEqual(parseHeroRuntimeBinding(result.runtimeBinding),{region:'0_0',clock:await checkpointSavedClock(source(f.worlds[0])),unitId:502,agentId:27,
      description:f.identity.actor.description,playerNumber:f.identity.actor.playerNumber,homeKind:'native',
      homeUnitId:469,homeAgentId:7,homeDescription:f.identity.registeredHome.home.description,sha256:hash(f.worlds[0])});
    assert.deepEqual(f.files.get(f.path(realmFiles('0_0').slots[0])),f.worlds[0]);
    order.push('GPU');retain();order.push('inject');entered.resolve();
  },f.options);
  await entered.promise;assert.deepEqual(order,['content','prepared','GPU','inject']);
  assert.equal(f.calls.filter(c=>c.lock).length,1);
  assert.equal(f.calls.filter(c=>c.file==='native-world-'+f.world+'/hero-route/Frontier_Hero_Route_0_0_0.GMP').length,1,
    'startup selects and verifies one leased owner rather than reading it twice');
  await assert.rejects(escaped(f.request.content,{signal:controller.signal}),/before native injection/);
  await f.locks.request(pairedLockName('native-world-'+f.world),{mode:'exclusive',ifAvailable:true},lock=>assert.equal(lock,null));
  void startup;
});

test('current owner selection still refuses a different region or damaged saved kingdom before native writes',async()=>{
  for(const defect of ['region','save']){
    const f=await setup(),controller=new AbortController();
    if(defect==='region'){
      const q=new URLSearchParams(f.search);q.set('profile','frontier_1_0');q.set('RECOMP_RULE_FRONTIER_REGION','1_0');
      f.options.search=q.toString();
    }else f.files.get('native-world-'+f.world+'/hero-route/Frontier_Hero_Route_0_0_0.GMP')[40]^=1;
    await assert.rejects(startNativeWorldPlayer(async(profile,retain,prepare)=>{
      await prepare(f.request.content,{signal:controller.signal});retain();
    },f.options),/owner changed|Damaged hero route world/);
    assert.ok(!f.calls.some(c=>c.write||c.create));
    await f.locks.request(pairedLockName('native-world-'+f.world),{mode:'exclusive',ifAvailable:true},lock=>assert.ok(lock));
  }
});

test('incorrect installed content never prepares a native checkpoint or reaches injection',async()=>{
  const f=await setup(),controller=new AbortController();
  await assert.rejects(startNativeWorldPlayer(async(profile,retain,prepare)=>{
    await prepare('f'.repeat(64)+':'+'e'.repeat(64),{signal:controller.signal});retain();
  },f.options),/identity differs/);
  assert.ok(!f.calls.some(c=>c.write));
  await f.locks.request(pairedLockName('native-world-'+f.world),{mode:'exclusive',ifAvailable:true},lock=>assert.ok(lock));
});

test('injection cannot bypass owner preparation or startup cancellation',async()=>{
  for(const bypass of ['inject','return','no-signal','cancelled']){
    const f=await setup(),controller=new AbortController();
    if(bypass==='cancelled')controller.abort(new Error('page closed'));
    await assert.rejects(startNativeWorldPlayer(async(profile,retain,prepare)=>{
      if(bypass==='inject')retain();
      else if(bypass!=='return')await prepare(f.request.content,bypass==='no-signal'?{}:{signal:controller.signal});
    },f.options),/not prepared|cancellation|page closed/);
    assert.ok(!f.calls.some(c=>c.write));
    await f.locks.request(pairedLockName('native-world-'+f.world),{mode:'exclusive',ifAvailable:true},lock=>assert.ok(lock));
  }
});

test('a failing startup drains its exact pending preparation before releasing the real world lease',async()=>{
  const f=await setup(),gate=deferred(),started=deferred(),controller=new AbortController();let preparation,escaped;
  const storage=f.options.storage;
  f.options.storage={async getDirectory(){started.resolve();await gate.promise;return storage.getDirectory();}};
  const startup=startNativeWorldPlayer(async(profile,retain,prepare)=>{
    escaped=prepare;preparation=prepare(f.request.content,{signal:controller.signal});
    preparation.catch(()=>{});throw Error('startup failed');
  },f.options);
  const rejected=assert.rejects(startup,/startup failed/);await started.promise;
  await f.locks.request(pairedLockName('native-world-'+f.world),{mode:'exclusive',ifAvailable:true},lock=>assert.equal(lock,null));
  gate.resolve();await rejected;await preparation;
  await assert.rejects(escaped(f.request.content,{signal:controller.signal}),/before native injection/);
  await f.locks.request(pairedLockName('native-world-'+f.world),{mode:'exclusive',ifAvailable:true},lock=>assert.ok(lock));
});

test('a ready owner consumes bootstrap parameters while preserving ordinary native restore and world selection',async()=>{
  const f=await setup(),url=completedHeroRestoreURL('http://localhost:8000/majesty/'+f.search);
  assert.equal(url.searchParams.get('world'),f.world);assert.equal(url.searchParams.get('RECOMP_RULE_FRONTIER_RESTORE'),'1');
  for(const key of ['hero-world','hero-entity','RECOMP_RULE_FRONTIER_HERO_RESTORE'])assert.equal(url.searchParams.has(key),false);
  assert.equal(completedHeroRestoreURL(url.href),null);
});

test('explicit halo startup validates the selected save under one lease before writing native slots',async()=>{
  const f=await setup({terrain:{}}),controller=new AbortController();f.options.search=f.search+'&hero-layout=halo-v1';
  await assert.rejects(startNativeWorldPlayer(async(profile,retain,prepare)=>{
    const receipt=await prepare(f.request.content,{signal:controller.signal});
    assert.equal(receipt.haloLayout.verifiedVertices,16641);assert.equal(receipt.haloLayout.sharedVertices,2480);
    assert.equal(receipt.haloLayout.key,'0_0');
    const firstWrite=f.calls.findIndex(c=>c.create||c.write);
    assert.ok(firstWrite>0);assert.ok(f.calls.slice(0,firstWrite).filter(c=>c.read&&c.n===1161).length>=129);
    // Deliberately stop before GPU or injection so this fixture releases its lease.
    throw Error('preflight verified');
  },f.options),/preflight verified/);
  assert.equal(f.calls.filter(c=>c.lock).length,1);f.assertBounded();
  const url=completedHeroRestoreURL('http://localhost:8000/majesty/'+f.options.search);
  assert.equal(url.searchParams.has('hero-layout'),false);
});

test('incompatible halo startup preserves the journal and refuses before native slot creation',async()=>{
  for(const terrain of [null,{legacy:true},{width:127},{defect:{x:4,y:31}}]){
    const f=await setup({terrain}),before=new Map([...f.files].map(([n,b])=>[n,Buffer.from(b)]));
    f.options.search=f.search+'&hero-layout=halo-v1';
    await assert.rejects(startNativeWorldPlayer(async(profile,retain,prepare)=>{
      await prepare(f.request.content,{signal:new AbortController().signal});assert.fail('incompatible map reached injection');
    },f.options));
    assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.create||c.write));f.assertBounded();
  }
  const f=await setup();f.calls.length=0;
  for(const search of [f.search+'&hero-layout=legacy',f.search+'&hero-layout=halo-v1&hero-layout=halo-v1','?hero-layout=halo-v1']){
    assert.throws(()=>nativeHeroRestoreConfig(search));
    await assert.rejects(startNativeWorldPlayer(()=>assert.fail('invalid layout injected'),{...f.options,search}));
  }
  assert.equal(f.calls.length,0);
});

test('actual staged player prepares the selected owner after content hashing and before GPU/WASM injection',async()=>{
  const f=await setup({terrain:{}}),order=[],finished=deferred(),window={};
  f.search+='&hero-layout=halo-v1';f.options.search=f.search;
  const raw=(await readFile('upstream/majesty-recomp/kit/web/player/index.html','utf8')).replaceAll('@APP@','MajestyRecomp');
  const staged=spawnSync('python3',['-c',"import runpy,sys;sys.stdout.write(runpy.run_path('scripts/stage-world.py')['stage_player'](sys.stdin.read()))"],{input:raw,encoding:'utf8'});
  assert.equal(staged.status,0,staged.stderr);
  let script=staged.stdout.match(/<script>([\s\S]*?)<\/script>/)[1];
  const at=script.indexOf('// Frontier startup owns its storage lease');
  script=script.slice(0,at)+'networkManifest = fakeManifest;\n'+script.slice(at);
  script=script.replace('import("../world/realm-session.mjs")','loadWorldModule()');
  const gameFolder={async getFileHandle(){return {};},async getDirectoryHandle(){return gameFolder;}};
  const storage={async getDirectory(){return {async getDirectoryHandle(name){
    assert.equal(name,'majesty');return {async getDirectoryHandle(name){return name==='profile'?f.profiles:gameFolder;}};
  }};}};
  f.options.storage=storage;
  const status={append(){},hidden:false},canvas={addEventListener(){},focus(){}};
  const document={getElementById:id=>id==='canvas'?canvas:status,addEventListener(){},createElement:()=>({}),body:{append(node){
    assert.equal(node.src,'MajestyRecomp.js');order.push('inject');
    window.Module.ENV={};for(const fn of window.Module.preRun)fn();
    assert.equal(window.Module.ENV.RECOMP_PROFILE_DIR,'/opfs/majesty/profile/native-world-'+f.world+'/frontier_0_0');
    const binding=parseHeroRuntimeBinding(window.Module.ENV.RECOMP_FRONTIER_HERO_BINDING);
    assert.deepEqual([binding.unitId,binding.agentId,binding.homeUnitId,binding.homeAgentId],[502,27,469,7]);
    assert.equal(binding.sha256,hash(f.worlds[0]));
    assert.equal(window.Module.ENV.RECOMP_FRONTIER_HERO_HALO_BINDING,'majesty-hero-halo-v1|0_0|'+binding.sha256);
    assert.equal(window.Module.ENV.RECOMP_RULE_FRONTIER_HERO_GENERATION,'v1');
    assert.equal(window.Module.ENV.RECOMP_RULE_FRONTIER_SEEDED_GENERATION,'1');
    assert.equal(window.Module.ENV.RECOMP_RULE_FRONTIER_CONNECTED_TERRAIN,'v1');
    finished.resolve();
  }}};
  Object.defineProperty(status,'textContent',{set(message){if(/failed|unavailable|requires|differs/.test(message))finished.resolve(new Error(message));}});
  const navigator={storage,gpu:{async requestAdapter(){
    assert.deepEqual(f.files.get(f.path('Frontier_0_0.GMP')),f.worlds[0]);order.push('GPU');
    return {features:new Set(),limits:{},requestDevice:async()=>({lost:new Promise(()=>{}),addEventListener(){}})};
  }}};
  runInNewContext(script,{URLSearchParams,AbortController,document,window,navigator,crossOriginIsolated:true,console,
    location:{search:f.search,pathname:'/majesty/',protocol:'http:',hostname:'localhost'},
    addEventListener(){},removeEventListener(){},fetch:async()=>({json:async()=>[{id:'majesty',title:'Majesty',executable:'Majesty.exe'}]}),
    fakeManifest:async()=>{order.push('content');return {session:'session',checkpoint:f.request.content};},
    loadWorldModule:async()=>({startNativeWorldPlayer:start=>startNativeWorldPlayer(start,f.options)})});
  const result=await finished.promise;if(result instanceof Error)throw result;
  assert.deepEqual(order,['content','GPU','inject']);assert.equal(f.calls.filter(c=>c.lock).length,1);
});
