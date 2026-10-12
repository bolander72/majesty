import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {NativeRealmStore} from '../web/world/realm-store.mjs';
import {opfsNativeRealmStorage} from '../web/world/realm-profile.mjs';
import {savedAtlasStore} from '../web/world/native-atlas.mjs';
import {exportNativeRegion,inspectNativeRegionBackup,restoreNativeRegionBackup,regionBackupFile,
  MAX_REGION_BACKUP_HEADER,REGION_BACKUP_PAGE} from '../web/world/region-backup.mjs';
import {initializeRegionBackups,MAX_REGION_DOWNLOAD_BYTES} from '../web/world/region-backup-controls.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
function chunk(tag,version,count,body){
  const head=Buffer.alloc(16);head.write(tag);head.writeUInt32LE(body.length,4);
  head.writeUInt32LE(version,8);head.writeUInt32LE(count,12);return Buffer.concat([head,body]);
}
function kingdom(length=10001){return Buffer.concat([chunk('VERS',1,0,Buffer.alloc(256)),chunk('TEST',0,0,Buffer.alloc(length,7))]);}
function source(bytes){let largestRead=0;return {size:bytes.length,async readAt(at,n){largestRead=Math.max(largestRead,n);return bytes.subarray(at,at+n);},get largestRead(){return largestRead;}};}
function fixture(){
  const directories=new Set(['']),files=new Map(),calls=[],held=new Set();
  let failed='',aborts=0,largestRead=0,largestWrite=0;
  const missing=()=>Object.assign(new Error('missing'),{name:'NotFoundError'});
  const directory=prefix=>({
    async getDirectoryHandle(name,options){
      const pathname=prefix?prefix+'/'+name:name;calls.push({pathname,create:options?.create===true});
      if(options?.create)directories.add(pathname);
      if(!directories.has(pathname))throw missing();return directory(pathname);
    },
    async getFileHandle(name,options){
      const pathname=prefix?prefix+'/'+name:name;calls.push({pathname,create:options?.create===true});
      if(!files.has(pathname)){if(!options?.create)throw missing();files.set(pathname,new Blob([]));}
      return {async getFile(){const blob=files.get(pathname);return {size:blob.size,slice(at,end){
        largestRead=Math.max(largestRead,end-at);return blob.slice(at,end);}};},
        async createWritable(){const parts=[];return {
          async write(bytes){largestWrite=Math.max(largestWrite,bytes.length);parts.push(Uint8Array.from(bytes));},
          async close(){if(pathname.endsWith(failed)&&failed)throw new Error('storage interrupted');files.set(pathname,new Blob(parts));},
          async abort(){++aborts;parts.length=0;},
        };},
      };
    },
  });
  const locks={async request(name,options,fn){calls.push({lock:name,...options});if(held.has(name))return fn(null);
    held.add(name);try{return await fn({});}finally{held.delete(name);}}};
  const profiles=directory(''),io=world=>opfsNativeRealmStorage(profiles,world,locks),store=world=>new NativeRealmStore(io(world),{content:'owned-content'});
  return {profiles,io,store,files,directories,calls,locks,held,directory,
    get aborts(){return aborts;},get largestRead(){return largestRead;},get largestWrite(){return largestWrite;},
    failClose(suffix){failed=suffix;},async save(world,key,bytes=kingdom()){
      return store(world).commit(key,{source:source(bytes),sha256:sha(bytes),expectedManifest:null});}};
}
async function exported(f,{world='home',key='-2_3',bytes=kingdom()}={}){
  await f.save(world,key,bytes);
  const parts=[];let max=0;
  const result=await exportNativeRegion(savedAtlasStore(f.io(world)),key,{async write(page){max=Math.max(max,page.length);parts.push(Buffer.from(page));}},{world});
  return {bytes:Buffer.concat(parts),result,max};
}
function changeHeader(bytes,modify){
  const n=bytes.readUInt32LE(16),info=JSON.parse(bytes.subarray(24,24+n));modify(info);
  const header=Buffer.from(JSON.stringify(info)),prefix=Buffer.from(bytes.subarray(0,24));prefix.writeUInt32LE(header.length,16);
  return Buffer.concat([prefix,header,bytes.subarray(24+n)]);
}
test('independent kingdom export/restore preserves exact bytes, content, signed region and original profile',async()=>{
  const f=fixture(),original=kingdom(),e=await exported(f,{bytes:original});
  const before=new Map(f.files),input=source(e.bytes),checked=await inspectNativeRegionBackup(input);
  assert.equal(checked.metadata.sourceWorld,'home');assert.equal(checked.metadata.region,'-2_3');
  assert.equal(checked.metadata.content,'owned-content');assert.equal(checked.metadata.sha256,sha(original));
  assert.equal(e.result.bytes,e.bytes.length);assert.ok(e.max<=4096);assert.ok(input.largestRead<=4096);
  const result=await restoreNativeRegionBackup(f.profiles,'restored',input,{locks:f.locks});
  assert.equal(result.region,'-2_3');assert.equal((await f.store('restored').read('-2_3')).sha256,sha(original));
  const saved=f.files.get('native-world-restored/frontier_-2_3/Documents/My Games/MajestyHD/SaveGame/Frontier_-2_3.GMP');
  assert.deepEqual(Buffer.from(await saved.arrayBuffer()),original);
  for(const [path,blob]of before)assert.equal(f.files.get(path),blob);
  assert.ok(f.largestRead<=4096);assert.ok(f.largestWrite<=4096);
  assert.ok(f.calls.filter(x=>x.lock).every(x=>x.ifAvailable===true));
});
test('damaged, truncated, unsupported and malformed backups refuse before destination creation',async()=>{
  const origin=fixture(),{bytes}=await exported(origin),bad=[];
  const body=Buffer.from(bytes);body[body.length-1]^=1;bad.push(body,bytes.subarray(0,-1),Buffer.concat([bytes,Buffer.alloc(1)]));
  for(const at of [0,20]){const copy=Buffer.from(bytes);copy[at]^=1;bad.push(copy);}
  const big=Buffer.from(bytes);big.writeUInt32LE(MAX_REGION_BACKUP_HEADER+1,16);bad.push(big);
  const n=bytes.readUInt32LE(16),duplicate=Buffer.concat([Buffer.from('{"version":1,'),bytes.subarray(25,24+n)]),prefix=Buffer.from(bytes.subarray(0,24));
  prefix.writeUInt32LE(duplicate.length,16);bad.push(Buffer.concat([prefix,duplicate,bytes.subarray(24+n)]));
  for(const modify of [v=>v.version=2,v=>v.engineSha256='0'.repeat(64),v=>v.sourceWorld='../bad',v=>v.region='00_3',
    v=>v.size=String(v.size),v=>v.size=-1,v=>v.size=64*1024*1024+1,v=>v.sha256='bad',v=>v.content='\nwrong',v=>v.extra=true])bad.push(changeHeader(bytes,modify));
  // Rehashed invalid native layout cannot pass solely by matching a digest.
  const layout=Buffer.from(bytes),offset=24+layout.readUInt32LE(16);layout.writeUInt32LE(2,offset+8);
  bad.push(changeHeader(layout,v=>v.sha256=sha(layout.subarray(offset))));
  for(const bytes of bad){const f=fixture();await assert.rejects(restoreNativeRegionBackup(f.profiles,'fresh',source(bytes),{locks:f.locks}));
    assert.equal(f.calls.length,0);assert.deepEqual([...f.directories],['']);assert.equal(f.files.size,0);}
});
test('file adapter refuses oversized or out-of-bounds reads without slicing and uses at most 4KiB',async()=>{
  let reads=0;assert.throws(()=>regionBackupFile({size:64*1024*1024+1049,slice(){++reads;}}));assert.equal(reads,0);
  const f=fixture(),e=await exported(f),file=new Blob([e.bytes]);
  const input=regionBackupFile({size:file.size,slice(at,end){++reads;assert.ok(end-at<=4096);return file.slice(at,end);}});
  for(const [at,n]of [[-1,1],[0,4097],[input.size,1],[0,0]])await assert.rejects(input.readAt(at,n));assert.equal(reads,0);
  assert.equal((await inspectNativeRegionBackup(input)).metadata.region,'-2_3');assert.ok(reads>1);
});
test('existing worlds, incomplete directories and busy worlds refuse without replacing data',async()=>{
  const f=fixture(),e=await exported(f);await f.save('other','0_0');
  f.directories.add('native-world-empty');const before=new Map(f.files);
  for(const world of ['home','other','empty'])await assert.rejects(restoreNativeRegionBackup(f.profiles,world,source(e.bytes),{locks:f.locks}),/already exists/);
  f.held.add('majesty-pair-native-world-busy');const count=f.calls.length;
  await assert.rejects(restoreNativeRegionBackup(f.profiles,'busy',source(e.bytes),{locks:f.locks}),/busy/);
  assert.equal(f.calls.length,count+1);assert.equal(f.directories.has('native-world-busy'),false);
  for(const [path,blob]of before)assert.equal(f.files.get(path),blob);
});
test('interrupted body or manifest publication aborts, retains the owned directory and requires a new name',async()=>{
  const origin=fixture(),e=await exported(origin);
  for(const suffix of ['.GMP','.checkpoint']){
    const f=fixture();f.failClose(suffix);await assert.rejects(restoreNativeRegionBackup(f.profiles,'failed',source(e.bytes),{locks:f.locks}),/interrupted/);
    assert.equal(f.aborts,1);assert.equal(f.directories.has('native-world-failed'),true);
    const marker=f.files.get('native-world-failed/frontier_-2_3/Frontier_-2_3.checkpoint');assert.ok(!marker||marker.size===0);
    f.failClose('');await assert.rejects(restoreNativeRegionBackup(f.profiles,'failed',source(e.bytes),{locks:f.locks}),/already exists/);
    await restoreNativeRegionBackup(f.profiles,'retry',source(e.bytes),{locks:f.locks});assert.equal((await f.store('retry').read('-2_3')).sha256,e.result.metadata.sha256);
  }
});
test('changing a source after inspection cannot publish a selected checkpoint',async()=>{
  const origin=fixture(),e=await exported(origin),f=fixture(),bytes=Buffer.from(e.bytes),input=source(bytes);
  const request=f.locks.request;f.locks.request=async(...args)=>{bytes[bytes.length-1]^=1;return request(...args);};
  await assert.rejects(restoreNativeRegionBackup(f.profiles,'changed',input,{locks:f.locks}),/digest mismatch/);
  assert.equal(f.aborts,1);assert.equal(f.files.has('native-world-changed/frontier_-2_3/Frontier_-2_3.checkpoint'),false);
});
test('missing, busy or damaged source kingdoms do not produce a completed export',async()=>{
  const f=fixture();let writes=0;const sink={async write(){++writes;}};
  await assert.rejects(exportNativeRegion(savedAtlasStore(f.io('missing')),'0_0',sink,{world:'missing'}),/Save this kingdom/);
  assert.equal(f.directories.size,1);assert.equal(writes,0);
  await f.save('home','0_0');f.held.add('majesty-pair-native-world-home');
  await assert.rejects(exportNativeRegion(savedAtlasStore(f.io('home')),'0_0',sink,{world:'home'}),/busy/);assert.equal(writes,0);
  f.held.clear();const path='native-world-home/frontier_0_0/Documents/My Games/MajestyHD/SaveGame/Frontier_0_0.GMP';
  f.files.set(path,new Blob([kingdom(10002)]));
  await assert.rejects(exportNativeRegion(savedAtlasStore(f.io('home')),'0_0',sink,{world:'home'}),/Damaged/);assert.equal(writes,0);
});

function controls(f,{pickSave,current={world:'home',x:-2,y:3},storageMissing=false}={}){
  f.directories.add('majesty');f.directories.add('majesty/profile');
  const root={async getDirectoryHandle(name){assert.equal(name,'majesty');return {async getDirectoryHandle(name){assert.equal(name,'profile');return f.profiles;}};}};
  const nodes=new Map(['kingdom-export','kingdom-restore','kingdom-file','kingdom-name','kingdom-status','kingdom-resume'].map(id=>['#'+id,{disabled:false,value:'new-world',hidden:false,textContent:'',removeAttribute(name){delete this[name];}}]));
  const downloads=[],urls=new Map(),timers=new Map();let id=0;
  const document={querySelector:key=>nodes.get(key),body:{appendChild(){}},createElement(){return {click(){downloads.push({href:this.href,name:this.download});},remove(){}};}};
  const handle=initializeRegionBackups({document,getCurrent:()=>current,base:'http://localhost:8000/world/?world=home&RECOMP_TRACE_POINTER=1',
    storage:storageMissing?null:{getDirectory:async()=>root},locks:f.locks,pickSave,
    urls:{createObjectURL(blob){const key='blob:'+(++id);urls.set(key,blob);return key;},revokeObjectURL(key){urls.delete(key);}},
    later(fn){timers.set(++id,fn);return id;},cancel(id){timers.delete(id);}});
  return {nodes,handle,downloads,urls,timers,current,save:()=>nodes.get('#kingdom-export').onclick(),restore:()=>nodes.get('#kingdom-restore').onclick()};
}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}

test('closing backup controls releases downloads and prevents retained handlers from starting I/O',async()=>{
  const f=fixture();await f.save('home','-2_3');const ui=controls(f);
  await ui.save();assert.equal(ui.urls.size,1);
  const save=ui.nodes.get('#kingdom-export').onclick,restore=ui.nodes.get('#kingdom-restore').onclick;
  const lateTimer=ui.timers.values().next().value,calls=f.calls.length;
  const closing=ui.handle.close();assert.equal(ui.handle.close(),closing);
  assert.equal(ui.urls.size,0);assert.equal(ui.timers.size,0);
  assert.equal(ui.nodes.get('#kingdom-export').onclick,null);assert.equal(ui.nodes.get('#kingdom-restore').onclick,null);
  assert.equal(ui.nodes.get('#kingdom-export').disabled,true);assert.equal(ui.nodes.get('#kingdom-file').disabled,true);
  await closing;await save();await restore();lateTimer();ui.handle.refresh();ui.handle.dispose();
  assert.equal(f.calls.length,calls);assert.equal(ui.downloads.length,1);
});

test('departure during a picker or sink open drains it without starting export or committing the sink',async()=>{
  for(const stage of ['picker','sink']){
    const f=fixture();await f.save('home','-2_3');const blocked=deferred(),entered=deferred();
    let created=0,aborted=0;
    const chosen={async createWritable(){++created;entered.resolve();await blocked.promise;return {
      async write(){assert.fail('late export write');},async close(){assert.fail('late export commit');},async abort(){++aborted;}};}};
    const ui=controls(f,{pickSave:async()=>{if(stage==='picker'){entered.resolve();await blocked.promise;}return chosen;}});
    const calls=f.calls.length,job=ui.save();await entered.promise;
    const status=ui.nodes.get('#kingdom-status').textContent;let finished=false;
    const close=ui.handle.close();close.then(()=>{finished=true;});
    await Promise.resolve();assert.equal(finished,false);blocked.resolve();await job;await close;
    assert.equal(created,stage==='sink'?1:0);assert.equal(aborted,stage==='sink'?1:0);
    assert.equal(f.calls.length,calls);assert.equal(ui.nodes.get('#kingdom-status').textContent,status);
    assert.equal(ui.downloads.length,0);assert.equal(ui.urls.size,0);
  }
});

test('departure during original checkpoint validation cancels further reads, aborts the sink and releases its lease',async()=>{
  const f=fixture();await f.save('home','-2_3');const path='native-world-home/frontier_-2_3/Documents/My Games/MajestyHD/SaveGame/Frontier_-2_3.GMP';
  const original=f.files.get(path),entered=deferred(),blocked=deferred();let reads=0,aborted=0;
  f.files.set(path,{size:original.size,slice(at,end){return {async arrayBuffer(){++reads;entered.resolve();await blocked.promise;return original.slice(at,end).arrayBuffer();}};}});
  const ui=controls(f,{pickSave:async()=>({async createWritable(){return {
    async write(){assert.fail('unvalidated download');},async close(){assert.fail('cancelled sink commit');},async abort(){++aborted;}};}})});
  const job=ui.save();await entered.promise;assert.equal(f.held.size,1);
  const status=ui.nodes.get('#kingdom-status').textContent,close=ui.handle.close();
  assert.equal(f.held.size,1,'lease stays held until the accepted read drains');
  blocked.resolve();await job;await close;
  assert.equal(reads,1);assert.equal(aborted,1);assert.equal(f.held.size,0);
  assert.equal(ui.nodes.get('#kingdom-status').textContent,status);assert.equal(ui.downloads.length,0);
});

test('departure during an export sink write starts no later write or commit',async()=>{
  const f=fixture();await f.save('home','-2_3');const entered=deferred(),blocked=deferred();let writes=0,aborted=0;
  const ui=controls(f,{pickSave:async()=>({async createWritable(){return {
    async write(){++writes;entered.resolve();await blocked.promise;},async close(){assert.fail('late sink commit');},async abort(){++aborted;}};}})});
  const job=ui.save();await entered.promise;const close=ui.handle.close();blocked.resolve();await job;await close;
  assert.equal(writes,1);assert.equal(aborted,1);assert.equal(f.held.size,0);assert.equal(ui.downloads.length,0);
});

test('an admitted restore finishes atomically after departure without publishing a late resume link',async()=>{
  const f=fixture(),backup=await exported(f),ui=controls(f),entered=deferred(),blocked=deferred();
  const blob=new Blob([backup.bytes]);let reads=0;
  ui.nodes.get('#kingdom-file').files=[{size:blob.size,slice(at,end){return {async arrayBuffer(){if(++reads===1){entered.resolve();await blocked.promise;}return blob.slice(at,end).arrayBuffer();}};}}];
  const job=ui.restore();await entered.promise;const status=ui.nodes.get('#kingdom-status').textContent;
  let closed=false;const close=ui.handle.close();close.then(()=>{closed=true;});
  await Promise.resolve();assert.equal(closed,false);blocked.resolve();await job;await close;
  const restored=(await f.store('new-world').read('-2_3')).sha256;
  assert.equal(restored,backup.result.metadata.sha256);assert.equal(f.held.size,0);
  assert.equal(ui.nodes.get('#kingdom-status').textContent,status);
  assert.equal(ui.nodes.get('#kingdom-resume').hidden,true);assert.equal(ui.nodes.get('#kingdom-resume').href,undefined);
});
test('shipped controls download one bounded backup and restore to a new world without auto-launch',async()=>{
  const f=fixture();await f.save('home','-2_3');const ui=controls(f);
  await ui.save();assert.equal(ui.downloads.length,1);assert.equal(ui.downloads[0].name,'home--2_3.majesty-region');
  assert.match(ui.nodes.get('#kingdom-status').textContent,/exported/);
  const blob=ui.urls.values().next().value;ui.nodes.get('#kingdom-file').files=[blob];
  await ui.restore();assert.match(ui.nodes.get('#kingdom-status').textContent,/Restored saved kingdom into new-world/);
  const link=ui.nodes.get('#kingdom-resume'),url=new URL(link.href);
  assert.equal(link.hidden,false);assert.equal(url.pathname,'/majesty/');assert.equal(url.searchParams.get('world'),'new-world');
  assert.equal(url.searchParams.get('profile'),'frontier_-2_3');assert.equal(url.searchParams.get('RECOMP_RULE_FRONTIER_RESTORE'),'1');
  assert.equal(url.searchParams.has('RECOMP_TRACE_POINTER'),false);assert.equal(ui.downloads.length,1);
  await ui.restore();assert.match(ui.nodes.get('#kingdom-status').textContent,/already exists/);assert.equal(link.hidden,true);assert.equal(link.href,undefined);
  ui.handle.dispose();assert.equal(ui.urls.size,0);assert.equal(ui.timers.size,0);
});
test('direct file saving invokes the picker before storage, serializes actions and aborts failed export',async()=>{
  const f=fixture();await f.save('home','-2_3');let pick=0,finish,closed=0,aborted=0,writes=[];
  const chosen=new Promise(resolve=>finish=resolve),count=f.calls.length;
  const ui=controls(f,{pickSave(){++pick;return chosen;}}),job=ui.save();
  assert.equal(pick,1);assert.equal(f.calls.length,count);assert.equal(ui.nodes.get('#kingdom-restore').disabled,true);
  await ui.save();await ui.restore();assert.equal(pick,1);
  finish({async createWritable(){return {async write(bytes){writes.push(bytes.length);},async close(){++closed;},async abort(){++aborted;}};}});
  await job;assert.equal(closed,1);assert.equal(aborted,0);assert.ok(writes.every(n=>n<=4096));assert.equal(ui.downloads.length,0);
  const failed=controls(f,{pickSave:async()=>({createWritable:async()=>({write:async()=>{throw new Error('disk full');},close:async()=>assert.fail('published failed export'),abort:async()=>++aborted})})});
  await failed.save();assert.equal(aborted,1);assert.match(failed.nodes.get('#kingdom-status').textContent,/disk full/);
  assert.equal(failed.nodes.get('#kingdom-export').disabled,false);
});
test('fallback limits archive size and keeps only one temporary download URL',async()=>{
  const f=fixture();await f.save('home','-2_3');const ui=controls(f);await ui.save();await ui.save();
  assert.equal(ui.urls.size,1);assert.equal(ui.timers.size,1);ui.timers.values().next().value();assert.equal(ui.urls.size,0);
  const big=fixture();await big.save('home','-2_3',kingdom(MAX_REGION_DOWNLOAD_BYTES));const large=controls(big);
  await large.save();assert.match(large.nodes.get('#kingdom-status').textContent,/direct file saving/);
  assert.equal(large.urls.size,0);assert.equal(large.downloads.length,0);
});
test('unnamed export, picker cancellation, missing file and invalid restore name preserve saves',async()=>{
  const f=fixture();await f.save('home','-2_3');const before=new Map(f.files);
  const unnamed=controls(f,{current:{world:null,x:0,y:0}});assert.equal(unnamed.nodes.get('#kingdom-export').disabled,true);await unnamed.save();
  const cancel=controls(f,{pickSave:async()=>{throw Object.assign(new Error('cancelled'),{name:'AbortError'});}});
  await cancel.save();assert.equal(cancel.nodes.get('#kingdom-status').textContent,'Export cancelled.');
  const ui=controls(f);await ui.restore();assert.match(ui.nodes.get('#kingdom-status').textContent,/Choose a kingdom backup file/);
  ui.nodes.get('#kingdom-name').value='../bad';await ui.restore();assert.match(ui.nodes.get('#kingdom-status').textContent,/Invalid native world name/);
  assert.equal(f.directories.has('native-world-new-world'),false);
  for(const [path,blob]of before)assert.equal(f.files.get(path),blob);
});
test('shipped page exposes the backup controls with explicit limits and starts them disabled',async()=>{
  const html=await readFile(new URL('../web/world/index.html',import.meta.url),'utf8');
  for(const id of ['kingdom-export','kingdom-file','kingdom-name','kingdom-restore'])assert.match(html,new RegExp('id="'+id+'"[^>]*disabled'));
  assert.match(html,/Stop the game first/);assert.match(html,/excludes co-op continuation, region transfers, campaign progress/);
  assert.match(html,/id="kingdom-resume" hidden/);assert.match(html,/max-height:calc\(100dvh - 32px\);overflow:auto/);
});
