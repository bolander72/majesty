import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import {startNativeWorldPlayer} from '../web/world/realm-session.mjs';
import {startMultiplayerProfilePlayer} from '../web/multiplayer/profile-session.mjs';

const raw=(await readFile('upstream/majesty-recomp/kit/web/player/index.html','utf8')).replaceAll('@APP@','MajestyRecomp');
const staged=spawnSync('python3',['-c',"import runpy,sys; sys.stdout.write(runpy.run_path('scripts/stage-world.py')['stage_player'](sys.stdin.read()))"],{input:raw,encoding:'utf8'});
assert.equal(staged.status,0,staged.stderr);
const body=staged.stdout.match(/<script>([\s\S]*?)<\/script>/)[1];
const bootstrap=body.indexOf('// Frontier startup owns its storage lease');
const startup=(body.slice(0,bootstrap)+'networkManifest = fakeManifest;\n'+body.slice(bootstrap))
  .replace('import("../world/realm-session.mjs")','loadWorldModule()')
  .replace('import("../multiplayer/profile-session.mjs")','loadProfileModule()');
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function events(){
  const listeners=new Set();
  return {listeners,addEventListener(name,fn){assert.equal(name,'pagehide');listeners.add(fn);},
    removeEventListener(name,fn){assert.equal(name,'pagehide');listeners.delete(fn);},
    hide(){for(const fn of [...listeners])fn();}};
}

test('departing during actual staged preparation prevents injection and releases only unused world leases',{timeout:10000},async()=>{
  for(const named of [false,true,'multiplayer'])for(const pause of ['games','storage','hash','adapter','device']){
    const entered=deferred(),release=deferred(),ev=events(),held=new Set(),order=[],window={};
    const wait=async(stage,value)=>{order.push(stage);if(stage===pause){entered.resolve();await release.promise;}return value;};
    const status={append(){},hidden:false},canvas={addEventListener(){},focus(){}};
    let appended=0,destroyed=0,hashSignal;
    const document={getElementById:id=>id==='canvas'?canvas:status,addEventListener(){},createElement:()=>({}),
      body:{append(){appended++;}}};
    const folder={getDirectoryHandle:async()=>folder,getFileHandle:async()=>({})};
    const device={destroy(){destroyed++;},lost:new Promise(()=>{}),addEventListener(){}};
    const adapter={features:new Set(),limits:{},requestDevice:()=>wait('device',device)};
    const navigator={storage:{getDirectory:()=>wait('storage',folder)},gpu:{requestAdapter:()=>wait('adapter',adapter)}};
    const location={search:named==='multiplayer'?'?mode=coop&profile=p2':named?'?world=example&profile=frontier_0_0&RECOMP_RULE_FRONTIER_REGION=0_0':'',pathname:'/majesty/',protocol:'http:',hostname:'localhost'};
    const locks={async request(name,options,fn){assert.ok(!held.has(name));held.add(name);try{return await fn({});}finally{held.delete(name);}}};
    const completion=runInNewContext(startup,{URLSearchParams,AbortController,location,document,window,navigator,crossOriginIsolated:true,console,
      addEventListener:ev.addEventListener,removeEventListener:ev.removeEventListener,
      fetch:()=>wait('games',{json:async()=>[{id:'majesty',title:'Majesty',executable:'Majesty.exe'}]}),
      async fakeManifest(dir,game,signal){hashSignal=signal;return wait('hash',{session:'session',checkpoint:'content'});},
      async loadWorldModule(){return {startNativeWorldPlayer:start=>startNativeWorldPlayer(start,{search:location.search,locks,events:ev})};},
      async loadProfileModule(){return {startMultiplayerProfilePlayer:start=>startMultiplayerProfilePlayer(start,{search:location.search,locks,events:ev})};}});
    await entered.promise;assert.ok(ev.listeners.size>0);if(named)assert.equal(held.size,1);
    ev.hide();release.resolve();await completion;
    assert.equal(appended,0,`${named}/${pause} injected after departure`);
    assert.equal(destroyed,pause==='device'?1:0);
    assert.equal(ev.listeners.size,0);assert.equal(held.size,0);
    if(hashSignal)assert.equal(hashSignal.aborted,true);
    if(['games','storage','hash'].includes(pause))assert.ok(!order.includes('adapter'));
    if(pause==='adapter')assert.ok(!order.includes('device'));
  }
});

const manifestCode=body.slice(body.indexOf('async function networkManifest('),body.indexOf('\nconst networkDebug'))
  .replace('import("../world/content-hash.mjs")','loadHashModule()');
test('ordinary Majesty inventory default has the same multiplayer identity as explicit enablement',async()=>{
  class Hasher {async hash(){return 'a'.repeat(64);}close(){}}
  const folder={getFileHandle:async()=>({}),async *entries(){yield ['asset',{kind:'file',getFile:async()=>new Blob(['asset'])}];}};
  const game={id:'majesty',engineSha256:'b'.repeat(64),sha256:'c'.repeat(64)};
  const identity=async(search,id='majesty')=>{
    const manifest=runInNewContext(manifestCode+'\nnetworkManifest',{URLSearchParams,TextEncoder,crypto:webcrypto,location:{search},
      loadHashModule:async()=>({ContentHasher:Hasher})});
    return manifest(folder,{...game,id},new AbortController().signal);
  };
  const implicit=await identity(''),explicit=await identity('?RECOMP_RULE_INVENTORY_COMPAT=1');
  assert.equal(implicit.session,explicit.session);
  const legacy=await identity('?RECOMP_RULE_INVENTORY_COMPAT=0');
  assert.notEqual(implicit.session,legacy.session);
  assert.equal(implicit.checkpoint,legacy.checkpoint,'rule changes do not relabel original content bytes');
  assert.notEqual(implicit.session,(await identity('','other-game')).session);
  await assert.rejects(identity('?RECOMP_RULE_INVENTORY_COMPAT=1&RECOMP_RULE_INVENTORY_COMPAT=0'),/duplicate/);
});
test('actual staged hashing terminates its pending worker on departure and removes the abort listener',async()=>{
  const pending=deferred(),controller=new AbortController();let terminated=0,hashes=0,closed=false,aborts=0;
  const add=controller.signal.addEventListener.bind(controller.signal),remove=controller.signal.removeEventListener.bind(controller.signal);
  controller.signal.addEventListener=(...args)=>{aborts++;add(...args);};
  controller.signal.removeEventListener=(...args)=>{aborts--;remove(...args);};
  let rejectHash;
  class Hasher{
    hash(){hashes++;pending.resolve();return new Promise((_,reject)=>{rejectHash=reject;});}
    close(){if(closed)return;closed=true;terminated++;rejectHash?.(Error('worker stopped'));}
  }
  const manifest=runInNewContext(manifestCode+'\nnetworkManifest',{URLSearchParams,TextEncoder,crypto:webcrypto,location:{search:''},
    loadHashModule:async()=>({ContentHasher:Hasher})});
  const folder={getFileHandle:async()=>({}),async *entries(){yield ['asset',{kind:'file',getFile:async()=>new Blob(['asset'])}];}};
  const result=manifest(folder,{},controller.signal);await pending.promise;controller.abort();
  await assert.rejects(result,/worker stopped/);assert.equal(hashes,1);assert.equal(terminated,1);assert.equal(aborts,0);
});

test('departure during a delayed file open starts no hash and preserves the original file',async()=>{
  const opened=deferred(),release=deferred(),controller=new AbortController();let hashes=0,closed=0,stopped=false;
  class Hasher{hash(){hashes++;assert.fail('departed file was sent to worker');}close(){if(!stopped){stopped=true;closed++;}}}
  const file=new Blob(['original asset']);
  const folder={getFileHandle:async()=>({}),async *entries(){yield ['asset',{kind:'file',async getFile(){opened.resolve();await release.promise;return file;}}];}};
  const manifest=runInNewContext(manifestCode+'\nnetworkManifest',{URLSearchParams,TextEncoder,crypto:webcrypto,location:{search:''},
    loadHashModule:async()=>({ContentHasher:Hasher})});
  const result=manifest(folder,{},controller.signal);await opened.promise;controller.abort();release.resolve();
  await assert.rejects(result,{name:'AbortError'});assert.equal(hashes,0);assert.equal(closed,1);
  assert.equal(await file.text(),'original asset');
});

test('cancellation staging is idempotent and refuses a partially removed guard',()=>{
  const stage=input=>spawnSync('python3',['-c',"import runpy,sys; sys.stdout.write(runpy.run_path('scripts/stage-world.py')['stage_player'](sys.stdin.read()))"],{input,encoding:'utf8'});
  assert.equal(stage(staged.stdout).stdout,staged.stdout);
  assert.notEqual(stage(staged.stdout.replace('device.destroy(); signal.throwIfAborted();','signal.throwIfAborted();')).status,0);
});
