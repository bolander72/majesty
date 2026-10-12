import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {startPairedPlayer,pairedSessionConfig,PAIRED_CASES} from '../web/world/paired-session.mjs';
import {opfsPairedStorage,pairedLockName} from '../web/world/transfer-store.mjs';

const search=(trial='committed',key='999913_999914')=>new URLSearchParams({
  profile:'frontier_'+key,RECOMP_RULE_FRONTIER_REGION:key,RECOMP_RULE_FRONTIER_TRANSFER:'1',
  RECOMP_RULE_FRONTIER_RESTORE:'1',RECOMP_BROWSER_FRONTIER_TRANSFER_CASE:trial}).toString();
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
class Events {
  listeners=new Map();
  addEventListener(name,fn){const list=this.listeners.get(name)||new Set();list.add(fn);this.listeners.set(name,list);}
  removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
  emit(name,event={}){for(const fn of this.listeners.get(name)||[])fn(event);}
  get size(){return [...this.listeners.values()].reduce((n,v)=>n+v.size,0);}
}
function fixture({metadataSize=100,rootWait=null}={}) {
  const held=new Map(),calls=[],opens=[],events=new Events();
  const locks={async request(name,options,callback){
    calls.push({name,options});assert.equal(options.ifAvailable,true);
    const state=held.get(name);
    if(state&&(state.exclusive||options.mode==='exclusive'))return callback(null);
    const token={name,exclusive:options.mode==='exclusive'},tokens=state?.tokens||new Set();
    tokens.add(token);held.set(name,{exclusive:token.exclusive,tokens});
    try{return await callback(token);}finally{
      tokens.delete(token);if(!tokens.size&&held.get(name)?.tokens===tokens)held.delete(name);
    }
  }};
  const folder={async getDirectoryHandle(name,options){assert.equal(options,undefined);opens.push(name);return folder;},
    async getFileHandle(name){assert.equal(name,'Owned_Browser_Inputs.json');return {async getFile(){return {size:metadataSize};}};}};
  const storage={async getDirectory(){if(rootWait)await rootWait.promise;return folder;}};
  return {held,calls,opens,events,storage,locks,folder,
    options:{search:search(),storage,locks,events},
    // Emulates browser destruction of the lock-owning context only. This is
    // not evidence of real browser disposal or native worker shutdown.
    destroyContext(){held.clear();}};
}
test('ordinary startup requires no OPFS or locks',async()=>{
  let starts=0;
  for(const search of ['', '?RECOMP_RULE_FRONTIER_TRANSFER=0']){
    const result=await startPairedPlayer(()=>{++starts;return 'started';},{search,storage:null,locks:null,events:null});
    assert.equal(result,'started');
  }
  assert.equal(starts,2);
});
test('invalid or ambiguous pair settings reject before storage, locks or game startup',async()=>{
  const invalid=[search()+'&RECOMP_RULE_FRONTIER_TRANSFER=0',
    '?RECOMP_RULE_FRONTIER_TRANSFER=0&RECOMP_RULE_FRONTIER_TRANSFER=1',
    search()+'&profile=other',search()+'&RECOMP_PROFILE_DIR=/opfs/other',
    search()+'&RECOMP_BROWSER_FRONTIER_TRANSFER_CASE=retry',
    search()+'&world=example',
    search()+'&RECOMP_BROWSER_FRONTIER_TRANSFER_ACTION=other',
    search()+'&RECOMP_BROWSER_FRONTIER_TRANSFER_ACTION=commit&RECOMP_BROWSER_FRONTIER_TRANSFER_ACTION=initialize',
    search().replace('RESTORE=1','RESTORE=0'),search('unknown'),search('committed','0_0'),
    '?RECOMP_RULE_FRONTIER_TRANSFER=2'];
  for(const query of invalid){
    const f=fixture();let started=false;
    await assert.rejects(startPairedPlayer(()=>{started=true;},{...f.options,search:query}));
    assert.equal(started,false);assert.equal(f.calls.length,0);assert.equal(f.opens.length,0);
  }
});
test('player excludes another loader, coordinator inspection and publication before startup',async()=>{
  const f=fixture(),started=deferred();let starts=0;
  startPairedPlayer(()=>{++starts;started.resolve();},f.options);
  await started.promise;
  assert.deepEqual(f.opens,['majesty','profile','frontier_999913_999914','actor-wasm-transfer-committed']);
  assert.equal(f.events.size,0,'no listener retained once game initialization begins');
  await assert.rejects(startPairedPlayer(()=>{++starts;},f.options),/busy/);
  const io=opfsPairedStorage(f.folder,'actor-wasm-transfer-committed',f.locks);
  for(const mode of ['shared','exclusive'])await assert.rejects(io.withLock(mode,()=>assert.fail('I/O escaped busy lease')),/busy/);
  assert.equal(starts,1);assert.equal(f.held.size,1);
  assert.equal(f.calls[0].name,pairedLockName('actor-wasm-transfer-committed'));
  assert.deepEqual(f.calls[0].options,{mode:'exclusive',ifAvailable:true});
  f.destroyContext();
  assert.equal(await io.withLock('exclusive',()=>42),42);
});
test('runtime failure and pagehide do not manually release an initialized engine lease',async()=>{
  const f=fixture(),started=deferred();
  startPairedPlayer(()=>started.resolve(),f.options);await started.promise;
  for(const [name,event]of [['recomp-runtime-state',{detail:{state:'failed'}}],['pagehide',{persisted:true}],['pagehide',{persisted:false}]]){
    f.events.emit(name,event);
    await assert.rejects(startPairedPlayer(()=>assert.fail('second game started'),f.options),/busy/);
    assert.equal(f.held.size,1);
  }
  f.destroyContext();
});
test('busy publisher rejects game before OPFS directory lookup',async()=>{
  const f=fixture(),entered=deferred(),release=deferred();
  const publishing=f.locks.request(pairedLockName('actor-wasm-transfer-committed'),{mode:'exclusive',ifAvailable:true},async()=>{entered.resolve();await release.promise;});
  await entered.promise;
  await assert.rejects(startPairedPlayer(()=>assert.fail('game started during publication'),f.options),/busy/);
  assert.equal(f.opens.length,0);assert.equal(f.events.size,0);
  release.resolve();await publishing;assert.equal(f.held.size,0);
});
test('missing or unbounded fixture and pre-injection startup failure release unused lease',async()=>{
  for(const metadataSize of [0,4097,NaN]){
    const f=fixture({metadataSize});
    await assert.rejects(startPairedPlayer(()=>assert.fail('incomplete fixture launched'),f.options),/Incomplete/);
    assert.equal(f.held.size,0);assert.equal(f.events.size,0);
  }
  const f=fixture();
  f.folder.getFileHandle=async()=>{throw new Error('missing ownership metadata');};
  await assert.rejects(startPairedPlayer(()=>assert.fail('missing fixture launched'),f.options),/missing/);
  assert.equal(f.held.size,0);assert.equal(f.events.size,0);
  const g=fixture();
  await assert.rejects(startPairedPlayer(()=>{throw new Error('GPU unavailable before script injection');},g.options),/GPU unavailable/);
  assert.equal(g.held.size,0);assert.equal(g.events.size,0);
});
test('navigation during pending directory preparation prevents game injection',async()=>{
  for(const persisted of [false,true]){
    const rootWait=deferred(),f=fixture({rootWait});let starts=0;
    const running=startPairedPlayer(()=>{++starts;},f.options);
    assert.equal(f.events.size,1);
    f.events.emit('pagehide',{persisted});rootWait.resolve();
    await running;assert.equal(starts,0);assert.equal(f.held.size,0);assert.equal(f.events.size,0);
  }
});
test('separate owned cases use independent locks, either side of one pair uses the same lock',async()=>{
  const f=fixture(),one=deferred(),two=deferred(),otherEvents=new Events();
  startPairedPlayer(()=>one.resolve(),f.options);await one.promise;
  await assert.rejects(startPairedPlayer(()=>assert.fail('same pair destination escaped'),{...f.options,search:search('committed','999912_999914')}),/busy/);
  startPairedPlayer(()=>two.resolve(),{...f.options,events:otherEvents,search:search('retry')});await two.promise;
  assert.equal(f.held.size,2);f.destroyContext();
});
test('startup ownership scope matches native browser case and region allowlists',async()=>{
  const source=await readFile(new URL('../upstream/majesty-recomp/browser_frontier.cpp',import.meta.url),'utf8');
  const cases=source.match(/constexpr std::array<std::string_view, 10> cases = \{([^}]+)\}/)[1];
  assert.deepEqual([...cases.matchAll(/"([a-z-]+)"/g)].map(m=>m[1]),PAIRED_CASES);
  const keys=source.match(/region_key\(int side\) \{\s*#ifdef __EMSCRIPTEN__\s*return side \? "([0-9_]+)" : "([0-9_]+)"/);
  for(const trial of PAIRED_CASES)for(const key of [keys[1],keys[2]])
    assert.equal(pairedSessionConfig(search(trial,key)).root,'actor-wasm-transfer-'+trial);
});

function stage(source){
  const result=spawnSync('python3',['-c',"import runpy,sys; sys.stdout.write(runpy.run_path('scripts/stage-world.py')['stage_player'](sys.stdin.read()))"],{input:source,encoding:'utf8'});
  return result;
}
test('reproducible staged player awaits guard before startup and preserves ordinary startup',async()=>{
  const source=await readFile(new URL('../upstream/majesty-recomp/kit/web/player/index.html',import.meta.url),'utf8');
  const result=stage(source);assert.equal(result.status,0,result.stderr);
  const staged=result.stdout;assert.equal(stage(staged).stdout,staged,'staging is idempotent');
  assert.equal((staged.match(/import\("\.\.\/world\/paired-session.mjs"\)/g)||[]).length,1);
  const bootstrap=staged.match(/let frontierProfilePath = null, retainWorldLease = null, prepareHeroRestore = null;[\s\S]*?status\(e.message, true\)\);/)[0];
  for(const query of ['', '?RECOMP_RULE_FRONTIER_TRANSFER=1']){
    const order=[],gate=deferred();
    const result=runInNewContext(bootstrap.replace('import("../world/paired-session.mjs")','loadPairedModule()'),{
      URLSearchParams,location:{search:query},async start(){order.push('start');},status(){assert.fail('startup failed');},
      loadPairedModule(){order.push('module');return gate.promise;}});
    if(query){assert.deepEqual(order,['module']);gate.resolve({async startPairedPlayer(start){order.push('guard');await start();}});}
    await result;
    assert.deepEqual(order,query?['module','guard','start']:['start']);
  }
  assert.notEqual(stage(source.replace('start().catch((e) => status(e.message, true));','changedStartup();')).status,0,'source drift must fail closed');
});

// Render the actual diagnostic template without writing its generated page or
// evidence file. Exercise its shipped handlers with controlled DOM/lock I/O.
const diagnosticResult=spawnSync('python3',['-c',
  "from pathlib import Path; import sys; p=Path('scripts/stage-browser-transfer-fixture.py').resolve(); source=p.read_text(); ns={'__file__':str(p)}; exec(source[:source.index(\"(TARGET / 'index.html').write_text(html)\")].replace('TARGET.mkdir(exist_ok=True)',''),ns); sys.stdout.write(ns['html'])"],{encoding:'utf8'});
assert.equal(diagnosticResult.status,0,diagnosticResult.stderr);
const diagnostic=diagnosticResult.stdout.match(/<script type="module">([\s\S]+)<\/script>/)[1].replace(/^import .*;\n/gm,'');
function diagnosticUI(f,spies={}){
  const nodes=new Map();
  const node=()=>({disabled:false,textContent:'',value:'committed',checked:true,append(){},replaceChildren(){}});
  for(const id of ['prepare','inspect','inputs','corrupt','publish','terrain','terrainSide','trial','publication','boundary','stopped','result','links'])nodes.set('#'+id,node());
  const controls=['prepare','inspect','inputs','corrupt','publish','terrain','terrainSide','trial','publication','boundary'].map(id=>nodes.get('#'+id));
  const handlerStart=diagnostic.indexOf("for(const[id,fn]of[['prepare',prepare]");
  assert.ok(handlerStart>0);
  const spy=()=>assert.fail('unexpected diagnostic I/O');
  const substitutions='prepare=spyPrepare; inspect=spyInspect; inspectInputs=spyInputs; damage=spyDamage; publishStopped=spyPublish;\n';
  runInNewContext(diagnostic.slice(0,handlerStart)+substitutions+diagnostic.slice(handlerStart),{
    PAIRED_CASES,pairedLockName,URL,URLSearchParams,navigator:{locks:f.locks},
    location:'http://localhost:8000/browser-transfer-fixture/',
    document:{querySelector:id=>nodes.get(id),querySelectorAll:()=>controls,createElement:node},
    spyPrepare:spies.prepare||spy,spyInspect:spies.inspect||spy,spyInputs:spies.inputs||spy,
    spyDamage:spies.corrupt||spy,spyPublish:spies.publish||spy,
  });
  return {nodes,controls,click:id=>nodes.get('#'+id).onclick(),status:()=>nodes.get('#result').textContent};
}
test('diagnostic inspection and corruption refuse an open native loader',async()=>{
  const f=fixture(),started=deferred();startPairedPlayer(()=>started.resolve(),f.options);await started.promise;
  const ui=diagnosticUI(f);
  for(const id of ['inspect','inputs','corrupt']){
    await ui.click(id);assert.match(ui.status(),/busy/);assert.ok(ui.controls.every(c=>!c.disabled));
  }
  assert.equal(f.held.size,1);f.destroyContext();
});
test('preparation owns all case locks before changing any folder; a busy case unwinds acquired locks',async()=>{
  const f=fixture(),started=deferred();
  startPairedPlayer(()=>started.resolve(),{...f.options,search:search('retry')});await started.promise;
  let prepared=0;const ui=diagnosticUI(f,{prepare(){++prepared;return {prepared:true};}});
  await ui.click('prepare');assert.match(ui.status(),/busy/);assert.equal(prepared,0);
  assert.equal(f.held.size,1);assert.ok(f.held.has(pairedLockName('actor-wasm-transfer-retry')));
  f.destroyContext();
  const successful=diagnosticUI(f,{prepare(){++prepared;assert.equal(f.held.size,PAIRED_CASES.length);return {prepared:true};}});
  await successful.click('prepare');assert.equal(prepared,1);assert.equal(f.held.size,0);
  assert.match(successful.status(),/"prepared": true/);
});
test('diagnostic retains a read lock through inspection and disables changing the selected case',async()=>{
  const f=fixture(),entered=deferred(),finish=deferred();
  const ui=diagnosticUI(f,{async inspect(){entered.resolve();await finish.promise;return {inspected:true};}});
  const inspecting=ui.click('inspect');await entered.promise;
  assert.ok(ui.controls.every(c=>c.disabled));
  await assert.rejects(startPairedPlayer(()=>assert.fail('loader escaped inspection lease'),f.options),/busy/);
  const damage=diagnosticUI(f);await damage.click('corrupt');assert.match(damage.status(),/busy/);
  finish.resolve();await inspecting;
  assert.equal(f.held.size,0);assert.ok(ui.controls.every(c=>!c.disabled));
  assert.match(ui.status(),/"inspected": true/);
});
