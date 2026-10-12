import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {nativeWorldSessionConfig,startNativeWorldPlayer,nativeRegionSessionMode,advanceNativeWorldRegion,withNativeWorldNeighborRead} from '../web/world/realm-session.mjs';
import {opfsNativeRealmStorage} from '../web/world/realm-profile.mjs';
import {selectedWorld} from '../web/world/world-name.mjs';
import {nativeRegionURL,atlasURL} from '../web/world/region.mjs';
import {BrowserRegionStore} from '../web/world/stream.mjs';

const search=(world='example',key='0_0')=>new URLSearchParams({world,profile:'frontier_'+key,RECOMP_RULE_FRONTIER_REGION:key,RECOMP_RULE_FRONTIER_RESTORE:'1'}).toString();
const sessionSearch=(world='session-owner')=>search(world)+'&RECOMP_RULE_FRONTIER_SESSION=v1&RECOMP_RULE_FRONTIER_SEEDED_GENERATION=1&RECOMP_RULE_FRONTIER_CONNECTED_TERRAIN=v1';
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function fixture(){
  const held=new Set(),calls=[],listeners=new Set();
  const events={addEventListener(name,fn){assert.equal(name,'pagehide');listeners.add(fn);},removeEventListener(name,fn){listeners.delete(fn);},
    hide(){for(const fn of listeners)fn();}};
  const locks={async request(name,options,fn){calls.push({name,options});if(held.has(name))return fn(null);
    held.add(name);try{return await fn({});}finally{held.delete(name);}}};
  return {held,calls,listeners,events,locks,options:{search:search(),locks,events}};
}
test('named-world settings reject ambiguity, profile overrides and paired/co-op settings before locking',async()=>{
  assert.deepEqual(nativeWorldSessionConfig(search()),{world:'example',profile:'native-world-example/frontier_0_0',lock:'majesty-pair-native-world-example'});
  for(const query of [search()+'&world=other',search('../escape'),search(''),search('A'),search()+'&RECOMP_PROFILE_DIR=/opfs/other',
    search()+'&RECOMP_RULE_FRONTIER_CHAPTER=1',search()+'&profile=personal',search()+'&RECOMP_RULE_FRONTIER_TRANSFER=1',
    search()+'&RECOMP_RULE_FRONTIER_TRANSFER=0&RECOMP_RULE_FRONTIER_TRANSFER=0',search()+'&RECOMP_BROWSER_FRONTIER_TRANSFER_CASE=committed',
    search()+'&RECOMP_BROWSER_FRONTIER_TRANSFER_ACTION=commit','world=example']){
    const f=fixture();await assert.rejects(startNativeWorldPlayer(()=>assert.fail('invalid startup'),{...f.options,search:query}));
    assert.equal(f.calls.length,0);assert.equal(f.listeners.size,0);
  }
  assert.ok(nativeWorldSessionConfig(search()+'&RECOMP_RULE_FRONTIER_TRANSFER=0'));
});
test('world identity survives atlas and game travel without changing game rule values',()=>{
  const game=nativeRegionURL(-2,3,'http://localhost:8000/world/?world=example&RECOMP_MEMORY_DEBUG=1&relay=private');
  assert.equal(selectedWorld(game.search),'example');assert.equal(game.searchParams.get('profile'),'frontier_-2_3');
  assert.equal(atlasURL(game.href).href,'http://localhost:8000/world/?world=example&RECOMP_MEMORY_DEBUG=1&at=-2_3');
  assert.equal(game.searchParams.has('relay'),false);assert.equal(game.searchParams.has('RECOMP_RULE_WORLD'),false);
  assert.equal(selectedWorld(''),null);
  for(const query of ['world=','world=../bad','world=one&world=two'])
    assert.throws(()=>nativeRegionURL(0,0,'http://localhost/world/?'+query));
});
test('ordinary player startup does not require world APIs or receive a new profile',async()=>{
  assert.equal(await startNativeWorldPlayer((...args)=>{assert.equal(args.length,0);return 42;},{search:'',locks:null,events:null}),42);
});
test('game lifetime owns the same world lease as stopped readers and publishers across all regions',async()=>{
  const f=fixture(),entered=deferred();let profile;
  startNativeWorldPlayer(value=>{profile=value;entered.resolve();},f.options);await entered.promise;
  assert.equal(profile,'native-world-example/frontier_0_0');assert.equal(f.listeners.size,0);
  const io=opfsNativeRealmStorage({getDirectoryHandle(){assert.fail('busy operation performed path I/O');}},'example',f.locks);
  for(const mode of ['shared','exclusive'])await assert.rejects(io.withLock(mode,()=>assert.fail('busy operation entered')),/busy/);
  await assert.rejects(startNativeWorldPlayer(()=>assert.fail('second region started'),{...f.options,search:search('example','1_0')}),/busy/);
  const other=deferred();startNativeWorldPlayer(()=>other.resolve(),{...f.options,search:search('other')});await other.promise;
  assert.equal(f.held.size,2);assert.deepEqual(f.calls[0].options,{mode:'exclusive',ifAvailable:true});
  f.events.hide();assert.equal(f.held.size,2,'navigation does not release a live engine');f.held.clear();
});
test('busy locks and pre-injection failures release unused lease and navigation prevents queued startup',async()=>{
  const f=fixture();f.held.add('majesty-pair-native-world-example');
  await assert.rejects(startNativeWorldPlayer(()=>assert.fail('busy startup'),f.options),/busy/);assert.equal(f.listeners.size,0);
  f.held.clear();await assert.rejects(startNativeWorldPlayer(()=>{throw Error('no GPU before injection');},f.options),/no GPU/);
  assert.equal(f.held.size,0);assert.equal(f.listeners.size,0);
  const gate=deferred(),original=f.locks.request;f.locks.request=async(...args)=>{await gate.promise;return original(...args);};
  const startup=startNativeWorldPlayer(()=>assert.fail('navigated document injected script'),f.options);
  f.events.hide();gate.resolve();await startup;assert.equal(f.held.size,0);assert.equal(f.listeners.size,0);
  await assert.rejects(startNativeWorldPlayer(()=>{}, {...f.options,locks:{request(){throw Error('synchronous API failure');}}}),/API failure/);
  assert.equal(f.listeners.size,0);
});
test('a failure after injection is reported while its native world lease remains held',async()=>{
  const f=fixture();
  await assert.rejects(startNativeWorldPlayer((profile,retain)=>{retain();throw Error('injected failure');},f.options),/injected failure/);
  assert.equal(f.held.size,1);assert.equal(f.listeners.size,0);
  await assert.rejects(startNativeWorldPlayer(()=>assert.fail('failed engine lease escaped'),f.options),/busy/);
  f.held.clear();
});
test('native session settings reject incomplete, ambiguous and network configuration before injection',async()=>{
  assert.equal(nativeRegionSessionMode(search()),false);assert.equal(nativeRegionSessionMode(sessionSearch()),true);
  for(const query of [sessionSearch()+'&RECOMP_RULE_FRONTIER_SESSION=v1',sessionSearch().replace('SESSION=v1','SESSION=0'),
    sessionSearch().replace('GENERATION=1','GENERATION=0'),sessionSearch().replace('TERRAIN=v1','TERRAIN=0'),
    sessionSearch()+'&RECOMP_RULE_FRONTIER_SEEDED_GENERATION=1',sessionSearch()+'&RECOMP_RULE_FRONTIER_CONNECTED_TERRAIN=v1',
    sessionSearch().replace('world=session-owner&',''),sessionSearch()+'&room=room',sessionSearch()+'&mode=coop',sessionSearch()+'&relay=wss://relay.test']){
    const f=fixture();await assert.rejects(startNativeWorldPlayer(()=>assert.fail('invalid mode injected'),{...f.options,search:query}));assert.equal(f.calls.length,0);
  }
  assert.throws(()=>nativeWorldSessionConfig(sessionSearch()+'&RECOMP_RULE_FRONTIER_TRANSFER=1'));
});
test('acknowledged region moves revoke old read capabilities without releasing the live world lease',async()=>{
  const f=fixture(),entered=deferred(),world='session-capability';
  startNativeWorldPlayer((_profile,retain)=>{retain();entered.resolve();},{...f.options,search:sessionSearch(world)});await entered.promise;
  const directory={async getDirectoryHandle(){return directory;}},storage={async getDirectory(){return directory;}};
  const borrow=(key,fn=()=>42)=>withNativeWorldNeighborRead(world,key,io=>io.withLock('shared',fn),{storage});
  const gate=deferred(),reading=deferred();const pending=borrow('1_0',async()=>{reading.resolve();await gate.promise;return 42;});await reading.promise;
  for(const [source,target,serial]of [['0_0','2_0',1],['1_0','2_0',1],['0_0','1_0',0],['0_0','01_0',1]])
    assert.throws(()=>advanceNativeWorldRegion(world,source,target,serial));
  advanceNativeWorldRegion(world,'0_0','1_0',1);gate.resolve();await assert.rejects(pending,/lease ended/);
  assert.equal(await borrow('2_0'),42);assert.equal(await borrow('0_0'),42);await assert.rejects(borrow('1_0'),/initialized world/);
  assert.throws(()=>advanceNativeWorldRegion(world,'0_0','1_0',1));assert.throws(()=>advanceNativeWorldRegion(world,'1_0','2_0',1));
  advanceNativeWorldRegion(world,'1_0','1_0',2);advanceNativeWorldRegion(world,'1_0','0_0',3);
  assert.equal(await borrow('-1_0'),42);await assert.rejects(borrow('2_0'),/initialized world/);
  assert.equal(f.calls.length,1,'all capability moves retain the original exact game lock');f.events.hide();assert.equal(f.held.size,1);f.held.clear();
});
test('region capability cannot advance an uninjected or ordinary named game',async()=>{
  assert.throws(()=>advanceNativeWorldRegion('no-session','0_0','1_0',1));
  const f=fixture(),entered=deferred(),world='ordinary-capability';
  startNativeWorldPlayer((_profile,retain)=>{retain();entered.resolve();},{...f.options,search:search(world)});await entered.promise;
  assert.throws(()=>advanceNativeWorldRegion(world,'0_0','1_0',1));assert.equal(f.held.size,1);f.held.clear();
});
function stage(source){return spawnSync('python3',['-c',"import runpy,sys; sys.stdout.write(runpy.run_path('scripts/stage-world.py')['stage_player'](sys.stdin.read()))"],{input:source,encoding:'utf8'});}
test('staged native preRun selects only the guarded profile and marks injection before append',async()=>{
  const raw=await readFile('upstream/majesty-recomp/kit/web/player/index.html','utf8'),result=stage(raw);
  assert.equal(result.status,0,result.stderr);const staged=result.stdout;assert.equal(stage(staged).stdout,staged);
  const bootstrap=staged.match(/let frontierProfilePath = null, retainWorldLease = null, prepareHeroRestore = null;[\s\S]*?status\(e.message, true\)\);/)[0];
  const preRun=staged.match(/preRun: \[\(\) => \{([\s\S]*?)\n    \}\],/)[1];
  for(const query of ['',search()]){
    const calls=[],env={};const fixtureProfile='native-world-example/frontier_0_0';
    const retained=()=>calls.push('retain');
    const code=bootstrap.replace('import("../world/realm-session.mjs")','loadWorldModule()')+'\n';
    await runInNewContext(code,{URLSearchParams,location:{search:query},async start(){calls.push('start');},status(){assert.fail('startup failed');},
      async loadWorldModule(){calls.push('module');return {async startNativeWorldPlayer(start){calls.push('guard');return start(fixtureProfile,retained);}};}});
    assert.deepEqual(calls,query?['module','guard','start']:['start']);
    runInNewContext(preRun,{Module:{ENV:env},URLSearchParams,location:{search:query,protocol:'http:',hostname:'localhost'},
      id:'majesty',game:{},contentIdentity:{session:'session',checkpoint:'content'},heroRuntimeBinding:null,heroHaloBinding:null,heroRestoreReceipt:null,multiplayerProfile:null,frontierProfilePath:query?fixtureProfile:null});
    assert.equal(env.RECOMP_PROFILE_DIR,query?'/opfs/majesty/profile/'+fixtureProfile:'/opfs/majesty/profile');
  }
  const injection=staged.match(/  if \(retainWorldLease\) retainWorldLease\(\);\n  document.body.append\(script\);/)[0];
  const order=[];runInNewContext(injection,{retainWorldLease:()=>order.push('retain'),document:{body:{append:()=>order.push('append')}},script:{}});
  assert.deepEqual(order,['retain','append']);
  assert.ok(staged.includes('if (frontierProfilePath && id !== "majesty") throw'));
  for(const replaced of [raw.replace('  document.body.append(script);','changedInjection();'),raw.replace('m.ENV.RECOMP_PROFILE_DIR =','differentProfile =')])
    assert.notEqual(stage(replaced).status,0,'template drift must fail closed');
  const oldBootstrap='// Frontier paired startup owns its storage lease before native initialization.\n'+
    '(new URLSearchParams(location.search).has("RECOMP_RULE_FRONTIER_TRANSFER")\n'+
    '  ? import("../world/paired-session.mjs").then(({startPairedPlayer}) => startPairedPlayer(start))\n'+
    '  : start()).catch((e) => status(e.message, true));';
  assert.equal(stage(raw.replace('start().catch((e) => status(e.message, true));',oldBootstrap)).stdout,staged,'existing staged guard upgrades reproducibly');
});
test('named atlas storage stays isolated even when its name equals the legacy default',async()=>{
  const original=Object.getOwnPropertyDescriptors(globalThis),calls=[];
  const locks={request(name,options,fn){calls.push(['lock',name]);return fn({});}};
  const indexedDB={open(name){calls.push(['db',name]);const request={result:{close(){},createObjectStore(){}}};
    queueMicrotask(()=>request.onsuccess());return request;}};
  try{
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks}});
    globalThis.indexedDB=indexedDB;globalThis.addEventListener=()=>{};globalThis.removeEventListener=()=>{};
    const legacy=await BrowserRegionStore.open();legacy.close();
    const named=await BrowserRegionStore.open('frontier-v1',{nativeWorld:true});named.close();
    assert.deepEqual(calls,[['lock','majesty-frontier-v1'],['db','majesty-frontier-v1'],
      ['lock','majesty-native-world-frontier-v1'],['db','majesty-native-world-frontier-v1']]);
  }finally{
    for(const key of ['navigator','indexedDB','addEventListener','removeEventListener']){
      if(original[key])Object.defineProperty(globalThis,key,original[key]);else delete globalThis[key];
    }
  }
});

test('actual staged startup acquires the world lease before content hashing and GPU calls',async()=>{
  const raw=(await readFile('upstream/majesty-recomp/kit/web/player/index.html','utf8')).replaceAll('@APP@','MajestyRecomp'),staged=stage(raw).stdout;
  let script=staged.match(/<script>([\s\S]*?)<\/script>/)[1];
  const bootstrap=script.indexOf('// Frontier startup owns its storage lease');assert.ok(bootstrap>0);
  // Compatibility bytes are qualified separately. Replace that function only;
  // run the shipped start(), bootstrap, preRun and injection ordering together.
  script=script.slice(0,bootstrap)+'networkManifest = fakeManifest;\n'+script.slice(bootstrap);
  script=script.replace('import("../world/realm-session.mjs")','loadWorldModule()');
  for(const mode of ['start','legacy-inventory','explicit-inventory','busy','invalid','invalid-session','pre-injection-failure','post-injection-failure']){
    const f=fixture(),order=[],messages=[],finished=deferred(),window={},env={},status={append(){},hidden:false};
    if(mode==='busy')f.held.add('majesty-pair-native-world-example');
    const location={search:mode==='invalid-session'?sessionSearch().replace('world=session-owner&',''):mode==='invalid'?search()+'&RECOMP_PROFILE_DIR=/opfs/other':search(),pathname:'/majesty/',protocol:'http:',hostname:'localhost'};
    if(mode==='legacy-inventory')location.search+='&RECOMP_RULE_INVENTORY_COMPAT=0';
    if(mode==='explicit-inventory')location.search+='&RECOMP_RULE_INVENTORY_COMPAT=1';
    const canvas={addEventListener(){},focus(){}};
    const document={getElementById:id=>id==='canvas'?canvas:status,addEventListener(){},createElement:()=>({}),body:{append(node){
      assert.ok(f.held.has('majesty-pair-native-world-example'));assert.equal(node.src,'MajestyRecomp.js');order.push('append');
      if(mode==='post-injection-failure')throw Error('append failed after injection boundary');
      window.Module.ENV=env;for(const fn of window.Module.preRun)fn();finished.resolve();
    }}};
    Object.defineProperty(status,'textContent',{set(value){messages.push(value);if(/busy|dedicated solo|versioned solo|before injection|after injection/.test(value))finished.resolve(value);}});
    const folder={async getDirectoryHandle(){return folder;},async getFileHandle(){return {};}};
    const navigator={storage:{getDirectory:async()=>folder},gpu:{async requestAdapter(){
      assert.equal(f.held.size,1);order.push('GPU');
      if(mode==='pre-injection-failure')throw Error('GPU unavailable before injection');
      return {features:new Set(),limits:{},requestDevice:async()=>({lost:new Promise(()=>{}),addEventListener(){}})};
    }}};
    runInNewContext(script,{URLSearchParams,location,document,window,navigator,crossOriginIsolated:true,console,AbortController,
      addEventListener(){},removeEventListener(){},
      fetch:async()=>({json:async()=>[{id:'majesty',title:'Majesty',executable:'Majesty.exe'}]}),
      async fakeManifest(){assert.equal(f.held.size,1);order.push('hash');return {session:'session',checkpoint:'content'};},
      async loadWorldModule(){return {startNativeWorldPlayer:start=>startNativeWorldPlayer(start,{...f.options,search:location.search})};}});
    let timer;
    try{await Promise.race([finished.promise,new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(Error(JSON.stringify({mode,order,messages}))),1000);
    })]);}finally{clearTimeout(timer);}
    if(['start','legacy-inventory','explicit-inventory'].includes(mode)){
      assert.deepEqual(order,['hash','GPU','append']);assert.equal(env.RECOMP_PROFILE_DIR,'/opfs/majesty/profile/native-world-example/frontier_0_0');
      assert.equal(f.held.size,1);
      assert.equal(env.RECOMP_RULE_INVENTORY_COMPAT,mode==='legacy-inventory'?'0':'1');
    }else if(mode==='post-injection-failure'){
      assert.deepEqual(order,['hash','GPU','append']);assert.equal(f.held.size,1);
    }else if(mode==='pre-injection-failure'){
      assert.deepEqual(order,['hash','GPU']);assert.equal(f.held.size,0);
    }else{assert.deepEqual(order,[]);assert.equal(f.held.size,mode==='busy'?1:0);}
    assert.equal(f.listeners.size,0);f.held.clear();
  }
});
