import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {NativeRealmCatalog,openNativeRealmCatalog,MAX_CATALOG_ITEMS,MAX_CATALOG_SCAN} from '../web/world/realm-catalog.mjs';
import {initializeRealmCatalog} from '../web/world/realm-catalog-controls.mjs';

function fixture({count=10000,noise=0,key=i=>`${i}_-2`,world='expanding',size=64*1024*1024}={}){
  const calls=[],overrides=new Map(),missingBodies=new Set();let held=false,denied='',iterated=0,reads=0,missingWorld=false,cursors=0,peakCursors=0,failClosing=false;
  const missing=()=>Object.assign(new Error('missing'),{name:'NotFoundError'});
  const directory=prefix=>({kind:'directory',
    async getDirectoryHandle(name,options){
      assert.ok(held,'directory work is under the world lease');assert.equal(options,undefined,'listing cannot create directories');
      const path=prefix?prefix+'/'+name:name;calls.push({directory:path});
      if(path===denied)throw Object.assign(new Error('denied'),{name:'NotAllowedError'});
      if(path===`native-world-${world}`&&missingWorld)throw missing();
      assert.ok(path.startsWith(`native-world-${world}`),'no lookup in other or personal worlds');return directory(path);
    },
    entries(){assert.equal(prefix,`native-world-${world}`);return (async function*(){
      ++cursors;peakCursors=Math.max(peakCursors,cursors);try{for(let i=0;i<noise+count;++i){assert.ok(held,'iterator advances only under a shared lease');++iterated;
        if(i<noise)yield [`ignored-${i}`,{kind:'file'}];else yield [`frontier_${key(i-noise)}`,{kind:'directory'}];
      }}finally{--cursors;if(failClosing)throw new Error('cursor close failed');}
    })();},
    async getFileHandle(name,options){
      assert.ok(held);assert.equal(options,undefined);const path=prefix+'/'+name;calls.push({file:path});
      if(path===denied)throw Object.assign(new Error('denied'),{name:'NotAllowedError'});
      const selected=path.split('/')[1].slice(9);
      if(name.endsWith('.checkpoint')){
        const bytes=overrides.has(selected)?overrides.get(selected):Buffer.from(`checkpoint-v1\n0\n${size}\n${'a'.repeat(64)}\nowned-content\n`);
        if(bytes===null)throw missing();
        return {getFile:async()=>({size:bytes.length,slice(at,end){return {async arrayBuffer(){assert.ok(held);assert.ok(end-at<=511);++reads;return Uint8Array.from(bytes.subarray(at,end)).buffer;}};}})};
      }
      if(missingBodies.has(selected))throw missing();
      return {getFile:async()=>({size,slice(){assert.fail('listing read dormant GMP bytes');}})};
    },
  });
  const locks={async request(name,options,fn){calls.push({lock:name,...options});if(held)return fn(null);
    held=true;try{return await fn({});}finally{held=false;}}};
  const profiles=directory(''),catalog=new NativeRealmCatalog(profiles,world,{locks});
  return {world,profiles,catalog,locks,calls,overrides,missingBodies,get iterated(){return iterated;},get reads(){return reads;},
    deny(path){denied=path;},setMissing(value){missingWorld=value;},failClosing(value){failClosing=value;},get cursors(){return cursors;},get peakCursors(){return peakCursors;},
    busy:fn=>locks.request('majesty-pair-native-world-'+world,{mode:'exclusive'},fn)};
}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
test('terminal catalog close releases its cursor and permanently refuses more work',async()=>{
  const f=fixture();await f.catalog.page();assert.equal(f.cursors,1);
  const closing=f.catalog.close();assert.equal(f.catalog.close(),closing);await closing;
  assert.equal(f.cursors,0);const before={reads:f.reads,iterated:f.iterated,calls:f.calls.length};
  await assert.rejects(f.catalog.page(),/list closed/);await assert.rejects(f.catalog.reset(),/list closed/);
  assert.deepEqual({reads:f.reads,iterated:f.iterated,calls:f.calls.length},before);
});
for(const phase of ['lock','directory','iterator','marker','marker-read','body-stat']){
  test(`catalog close during ${phase} drains the current operation without publishing or starting another read`,async()=>{
    const f=fixture(),entered=deferred(),resume=deferred();let paused=false,held=false,reads=0,opens=0;
    async function pause(at){if(at===phase&&!paused){paused=true;entered.resolve();await resume.promise;}}
    function wrap(directory,prefix=''){
      return {async getDirectoryHandle(name,options){
        const next=await directory.getDirectoryHandle(name,options);
        await pause('directory');return wrap(next,prefix+'/'+name);
      },entries(){const iterator=directory.entries();return {[Symbol.asyncIterator](){return this;},
        async next(){const value=await iterator.next();await pause('iterator');return value;},
        return:()=>iterator.return()};},async getFileHandle(name,options){
        ++opens;const file=await directory.getFileHandle(name,options);
        await pause(name.endsWith('.checkpoint')?'marker':'body-stat');
        return {async getFile(){const blob=await file.getFile();return {size:blob.size,
          slice(at,end){const part=blob.slice(at,end);return {async arrayBuffer(){
            ++reads;const raw=await part.arrayBuffer();await pause('marker-read');return raw;
          }};}};}};
      }};
    }
    const locks={request:(name,options,fn)=>f.locks.request(name,options,async lock=>{
      held=true;try{await pause('lock');return await fn(lock);}finally{held=false;}
    })};
    const catalog=new NativeRealmCatalog(wrap(f.profiles),'expanding',{locks});
    const reading=assert.rejects(catalog.page(),/list closed/);await entered.promise;
    const counts={reads,opens,iterated:f.iterated};let finished=false;
    const closing=catalog.close().then(()=>{finished=true;});
    await Promise.resolve();assert.equal(finished,false);assert.equal(held,true);
    resume.resolve();await Promise.all([reading,closing]);
    assert.equal(held,false);assert.equal(f.cursors,0);
    assert.deepEqual({reads,opens,iterated:f.iterated},counts);
  });
}
test('failed iterator close still makes a catalog terminal',async()=>{
  const f=fixture();await f.catalog.page();f.failClosing(true);
  const closing=f.catalog.close();await assert.rejects(closing,/cursor close failed/);
  assert.equal(f.catalog.close(),closing);assert.equal(f.cursors,0);
  await assert.rejects(f.catalog.reset(),/list closed/);await assert.rejects(f.catalog.page(),/list closed/);
});
test('large explored world yields eight metadata destinations under one lease without reading any GMP body',async()=>{
  const f=fixture(),page=await f.catalog.page();assert.equal(page.items.length,MAX_CATALOG_ITEMS);assert.equal(page.scanned,8);assert.equal(page.done,false);
  assert.deepEqual(page.items.map(x=>x.key),Array.from({length:8},(_,i)=>`${i}_-2`));assert.equal(f.reads,8);assert.equal(f.iterated,8);
  assert.ok(page.items.every(x=>x.state==='saved'&&x.size===64*1024*1024&&x.content==='owned-content'));
  assert.ok(f.calls.filter(x=>x.lock).every(x=>x.mode==='shared'&&x.ifAvailable===true));assert.equal(f.calls.filter(x=>x.lock).length,1);
  const next=await f.catalog.page();assert.equal(next.items[0].key,'8_-2');assert.equal(f.iterated,16);
  assert.equal(f.reads,16);assert.equal(f.calls.filter(x=>x.lock).length,2);
});
test('sparse or malformed directory pages have a fixed 128-entry work cap and no body reads',async()=>{
  const f=fixture({count:2,noise:300}),first=await f.catalog.page();assert.equal(first.items.length,0);assert.equal(first.done,false);
  assert.equal(first.scanned,MAX_CATALOG_SCAN);assert.equal(f.iterated,128);assert.equal(f.reads,0);
  const second=await f.catalog.page();assert.equal(second.items.length,0);assert.equal(second.scanned,128);
  const third=await f.catalog.page();assert.equal(third.items.length,2);assert.equal(third.done,true);assert.equal(f.iterated,302);
  const f2=fixture({count:5,key:i=>['../bad','00_0','-0_0','1000001_0','-1000000_1000000'][i]}),page=await f2.catalog.page();
  assert.deepEqual(page.items.map(x=>x.key),['-1000000_1000000']);assert.equal(f2.reads,1);
});
test('busy world admission does not advance the cursor and retry resumes the next exact page',async()=>{
  const f=fixture();await f.catalog.page();const before=f.iterated,reads=f.reads;
  await f.busy(async()=>{await assert.rejects(f.catalog.page(),/busy/);assert.equal(f.iterated,before);assert.equal(f.reads,reads);});
  assert.equal((await f.catalog.page()).items[0].key,'8_-2');
});
test('one catalogue operation runs at a time; overlapping calls or reset cannot discard an active page',async()=>{
  const f=fixture(),job=f.catalog.page();await assert.rejects(f.catalog.page(),/busy/);await assert.rejects(f.catalog.reset(),/busy/);
  assert.equal((await job).items.length,8);assert.equal(f.iterated,8);
});
test('unpublished directories are omitted; malformed or missing checkpoint bodies show unavailable metadata',async()=>{
  const f=fixture({count:4});f.overrides.set('0_-2',null);f.overrides.set('1_-2',Buffer.alloc(512));
  f.overrides.set('2_-2',Buffer.from('checkpoint-v1\n0\n12\nbad\ncontent\n'));f.missingBodies.add('3_-2');
  const page=await f.catalog.page();assert.deepEqual(page.items.map(x=>[x.key,x.state]),[['1_-2','unavailable'],['2_-2','unavailable'],['3_-2','unavailable']]);
  assert.equal(f.reads,2);assert.equal(page.done,true);
});
test('read permission failures require a fresh cursor rather than silently losing an interrupted page',async()=>{
  const f=fixture();f.deny('native-world-expanding/frontier_2_-2/Frontier_2_-2.checkpoint');
  await assert.rejects(f.catalog.page(),{name:'NotAllowedError'});assert.equal(f.iterated,3);
  await assert.rejects(f.catalog.page(),/Refresh/);assert.equal(f.iterated,3);
  f.deny('');await f.catalog.reset();const page=await f.catalog.page();assert.equal(page.items[0].key,'0_-2');assert.equal(page.items.length,8);assert.equal(f.peakCursors,1);
});
test('missing worlds remain empty and refresh sees later saves without creation or personal-profile fallback',async()=>{
  const f=fixture({count:2});f.setMissing(true);assert.deepEqual(await f.catalog.page(),{items:[],scanned:0,done:true});assert.equal(f.reads,0);
  f.setMissing(false);assert.equal((await f.catalog.page()).items.length,0);await f.catalog.reset();assert.equal((await f.catalog.page()).items.length,2);
  assert.throws(()=>new NativeRealmCatalog(f.profiles,'../unsafe',{locks:f.locks}),/world name/);
});
test('failed cursor cleanup refuses reuse until explicit reset completes',async()=>{
  const f=fixture();await f.catalog.page();assert.equal(f.cursors,1);f.failClosing(true);
  await assert.rejects(f.catalog.reset(),/cursor close failed/);assert.equal(f.cursors,0);
  await assert.rejects(f.catalog.page(),/Refresh/);f.failClosing(false);await f.catalog.reset();
  assert.equal((await f.catalog.page()).items[0].key,'0_-2');assert.equal(f.peakCursors,1);await f.catalog.reset();
});
test('browser opener reads only the chosen game container and absent containers remain empty',async()=>{
  const f=fixture({count:1}),paths=[];
  const storage={async getDirectory(){return {async getDirectoryHandle(name,options){assert.equal(options,undefined);paths.push(name);
    return {async getDirectoryHandle(name,options){assert.equal(options,undefined);paths.push(name);return f.profiles;}};}};}};
  const opened=await openNativeRealmCatalog('expanding',{storage,locks:f.locks});assert.equal((await opened.page()).items.length,1);assert.deepEqual(paths,['majesty','profile']);
  const missing={getDirectory:async()=>({getDirectoryHandle:async()=>{throw Object.assign(new Error('absent'),{name:'NotFoundError'});}})};
  const empty=await openNativeRealmCatalog('fresh',{storage:missing,locks:f.locks});assert.deepEqual(await empty.page(),{items:[],scanned:0,done:true});
  await assert.rejects(openNativeRealmCatalog('expanding',{storage:{getDirectory:async()=>{throw Object.assign(new Error('denied'),{name:'NotAllowedError'});}},locks:f.locks}),{name:'NotAllowedError'});
});
function controls(f,{world=f.world,onSelect=async()=>{},open=async()=>f.catalog}={}){
  class Node{constructor(){this.children=[];this.disabled=false;this.textContent='';}appendChild(child){this.children.push(child);}replaceChildren(...children){this.children=children;}}
  const nodes=new Map(['kingdom-list-next','kingdom-list-refresh','kingdom-list','kingdom-list-status'].map(id=>['#'+id,new Node()]));
  const document={querySelector:id=>nodes.get(id),createElement:()=>new Node()};
  const handle=initializeRealmCatalog({document,getWorld:()=>world,onSelect,open});
  return {nodes,handle,next:()=>nodes.get('#kingdom-list-next').onclick(),refresh:()=>nodes.get('#kingdom-list-refresh').onclick(),
    get buttons(){return nodes.get('#kingdom-list').children.map(li=>li.children[0]);},get status(){return nodes.get('#kingdom-list-status').textContent;}};
}
test('shipped controls replace each eight-row page, make destination requests and retain no prior DOM pages',async()=>{
  const f=fixture(),selected=[],ui=controls(f,{onSelect:async(x,y)=>selected.push([x,y])});
  assert.equal(f.iterated,0);await ui.next();assert.equal(ui.buttons.length,8);assert.equal(f.iterated,8);
  assert.match(ui.buttons[0].textContent,/0, -2/);await ui.buttons[0].onclick();assert.deepEqual(selected,[[0,-2]]);
  assert.match(ui.status,/Showing saved region/);
  for(let page=1;page<200;++page){await ui.next();assert.equal(ui.buttons.length,8);assert.match(ui.buttons[0].textContent,new RegExp(`${page*8}, -2`));}
  assert.equal(f.iterated,1600);assert.equal(f.reads,1600);
  await ui.refresh();assert.match(ui.buttons[0].textContent,/0, -2/);assert.equal(ui.buttons.length,8);assert.equal(f.cursors,1);assert.equal(f.peakCursors,1);
  await ui.handle.dispose();assert.equal(f.cursors,0);assert.equal(ui.buttons.length,0);await ui.next();assert.match(ui.buttons[0].textContent,/0, -2/);assert.equal(f.peakCursors,1);
});
test('terminal control close detaches current buttons and rejects retained old callbacks',async()=>{
  const f=fixture(),selected=[],ui=controls(f,{onSelect:async(...args)=>selected.push(args)});
  await ui.next();const button=ui.buttons[0],oldSelect=button.onclick,oldNext=ui.nodes.get('#kingdom-list-next').onclick;
  const closing=ui.handle.close();assert.equal(ui.handle.close(),closing);await closing;
  assert.equal(f.cursors,0);assert.equal(ui.buttons.length,0);assert.equal(button.onclick,null);assert.equal(button.disabled,true);
  assert.equal(ui.nodes.get('#kingdom-list-next').onclick,null);assert.equal(ui.nodes.get('#kingdom-list-refresh').onclick,null);
  const calls=f.calls.length;await oldSelect();await oldNext();assert.equal(f.calls.length,calls);assert.deepEqual(selected,[]);
});
test('terminal control close during opening drains and closes the late catalog without reading a page',async()=>{
  const f=fixture(),entered=deferred(),resume=deferred();
  const ui=controls(f,{open:async()=>{entered.resolve();await resume.promise;return f.catalog;}});
  const reading=ui.next();await entered.promise;let closed=false;const closing=ui.handle.close().then(()=>{closed=true;});
  await Promise.resolve();assert.equal(closed,false);resume.resolve();await Promise.all([reading,closing]);
  assert.equal(f.reads,0);assert.equal(f.iterated,0);assert.equal(ui.buttons.length,0);
  await assert.rejects(f.catalog.page(),/list closed/);
});
test('terminal control close during a page or selection publishes no late rows or status',async()=>{
  for(const phase of ['page','selection']){
    const f=fixture(),entered=deferred(),resume=deferred();
    const original=f.catalog.page.bind(f.catalog);
    if(phase==='page')f.catalog.page=async()=>{const result=await original();entered.resolve();await resume.promise;return result;};
    const ui=controls(f,{onSelect:async()=>{entered.resolve();await resume.promise;}});
    const reading=phase==='page'?ui.next():(await ui.next(),ui.buttons[0].onclick());
    await entered.promise;const status=ui.status;let closed=false;const closing=ui.handle.close().then(()=>{closed=true;});
    await Promise.resolve();assert.equal(closed,false);assert.equal(ui.buttons.length,0);
    resume.resolve();await Promise.all([reading,closing]);assert.equal(ui.status,status);assert.equal(f.cursors,0);
    assert.equal(ui.nodes.get('#kingdom-list-next').disabled,true);
  }
});
test('retained callbacks from a replaced metadata page cannot activate an old row',async()=>{
  const f=fixture(),selected=[],ui=controls(f,{onSelect:async(...args)=>selected.push(args)});
  await ui.next();const button=ui.buttons[0],callback=button.onclick;await ui.next();
  assert.equal(button.onclick,null);assert.equal(button.disabled,true);await callback();assert.deepEqual(selected,[]);
});
test('failed page preserves the visible page, and unavailable saves cannot request terrain/game activation',async()=>{
  const f=fixture(),selected=[],ui=controls(f,{onSelect:async(...args)=>selected.push(args)});await ui.next();const previous=ui.nodes.get('#kingdom-list').children;
  f.deny('native-world-expanding/frontier_8_-2/Frontier_8_-2.checkpoint');await ui.next();assert.equal(ui.nodes.get('#kingdom-list').children,previous);assert.match(ui.status,/Refresh/);
  f.deny('');f.overrides.set('0_-2',Buffer.alloc(512));await ui.refresh();assert.equal(ui.buttons[0].disabled,true);await ui.buttons[0].onclick();assert.equal(selected.length,0);
});
test('unnamed worlds do no I/O; slow selection serializes controls and failure preserves listed destinations',async()=>{
  const f=fixture(),unnamed=controls(f,{world:null});assert.equal(unnamed.nodes.get('#kingdom-list-next').disabled,true);await unnamed.next();assert.equal(f.iterated,0);
  let release;const slow=new Promise(resolve=>release=resolve),ui=controls(f,{onSelect:()=>slow});await ui.next();
  const selected=ui.buttons[0].onclick();assert.equal(ui.nodes.get('#kingdom-list-next').disabled,true);await ui.next();await ui.refresh();assert.equal(f.iterated,8);
  release();await selected;assert.equal(ui.nodes.get('#kingdom-list-next').disabled,false);
  const failed=controls(f,{onSelect:async()=>{throw new Error('damaged saved terrain');}});await failed.next();const rows=failed.nodes.get('#kingdom-list').children;
  await failed.buttons[0].onclick();assert.match(failed.status,/saved files are preserved/);assert.equal(failed.nodes.get('#kingdom-list').children,rows);
});
test('end-of-list disables Next until explicit refresh and sparse batches remain resumable',async()=>{
  const f=fixture({count:2}),ui=controls(f);await ui.next();assert.equal(ui.nodes.get('#kingdom-list-next').disabled,true);assert.equal(ui.nodes.get('#kingdom-list-refresh').disabled,false);
  const before=f.reads;await ui.next();assert.equal(f.reads,before);await ui.refresh();assert.equal(ui.buttons.length,2);
  const sparse=controls(fixture({count:1,noise:200}));await sparse.next();assert.match(sparse.status,/Continue with Next/);assert.equal(sparse.nodes.get('#kingdom-list-next').disabled,false);
  await sparse.next();assert.equal(sparse.buttons.length,1);
});
test('shipped HTML explains metadata-only discovery and keeps list controls disabled until initialization',async()=>{
  const html=await readFile(new URL('../web/world/index.html',import.meta.url),'utf8');
  assert.match(html,/id="kingdom-list-next" disabled/);assert.match(html,/id="kingdom-list-refresh" disabled/);
  assert.match(html,/Loading the list reads save metadata/);assert.match(html,/id="kingdom-list-status" aria-live="polite"/);
});
