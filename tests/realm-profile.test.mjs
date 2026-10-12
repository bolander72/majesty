import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NativeRealmStore} from '../web/world/realm-store.mjs';
import {nativeRealmProfilePath,nativeRealmRelativePath,opfsNativeRealmStorage} from '../web/world/realm-profile.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const source=bytes=>({size:bytes.length,async readAt(at,n){return bytes.subarray(at,at+n);}});
function fixture(){
  const directories=new Set(['']),files=new Map(),calls=[];let held=false,deny='',failClose=false,aborts=0,largestRead=0;
  const missing=()=>Object.assign(new Error('missing'),{name:'NotFoundError'});
  const directory=prefix=>({
    async getDirectoryHandle(name,options){
      const pathname=prefix?prefix+'/'+name:name;calls.push({pathname,create:options?.create===true});
      if(pathname===deny)throw Object.assign(new Error('permission denied'),{name:'NotAllowedError'});
      if(options?.create)directories.add(pathname);
      if(!directories.has(pathname))throw missing();return directory(pathname);
    },
    async getFileHandle(name,options){
      const pathname=prefix?prefix+'/'+name:name;calls.push({pathname,create:options?.create===true});
      if(!files.has(pathname)){if(!options?.create)throw missing();files.set(pathname,new Blob([]));}
      return {
        async getFile(){const blob=files.get(pathname);return {size:blob.size,slice(at,end){largestRead=Math.max(largestRead,end-at);return blob.slice(at,end);}};},
        async createWritable(){const parts=[];return {
          async write(bytes){parts.push(Uint8Array.from(bytes));},
          async close(){if(failClose)throw new Error('close failed');files.set(pathname,new Blob(parts));},
          async abort(){++aborts;parts.length=0;},
        };},
      };
    },
  });
  const locks={request(name,options,fn){calls.push({lock:name,...options});if(held)return fn(null);
    held=true;return Promise.resolve().then(()=>fn({})).finally(()=>{held=false;});}};
  const profiles=directory(''),adapter=world=>opfsNativeRealmStorage(profiles,world,locks);
  const store=world=>new NativeRealmStore(adapter(world),{content:'owned-content'});
  return {directories,files,calls,profiles,locks,adapter,store,get largestRead(){return largestRead;},get aborts(){return aborts;},
    deny(pathname){deny=pathname;},failClose(){failClose=true;},
    commit:(store,key,bytes,expectedManifest=null)=>store.commit(key,{source:source(bytes),sha256:sha(bytes),expectedManifest})};
}

test('profile path agrees with the pinned serializer SaveGame layout and canonical region suffix',()=>{
  assert.equal(nativeRealmProfilePath('realm-one','-12_3'),'native-world-realm-one/frontier_-12_3');
  assert.deepEqual(nativeRealmRelativePath('Frontier_-12_3.checkpoint'),['frontier_-12_3','Frontier_-12_3.checkpoint']);
  for(const filename of ['Frontier_-12_3.GMP','Frontier_-12_3_Recovery.GMP'])
    assert.deepEqual(nativeRealmRelativePath(filename),['frontier_-12_3','Documents','My Games','MajestyHD','SaveGame',filename]);
});
test('named worlds isolate identical region keys and preserve personal and legacy flat saves',async()=>{
  const f=fixture(),sentinel=new Blob(['personal-save']);
  f.files.set('frontier_0_0/Documents/My Games/MajestyHD/SaveGame/Frontier_0_0.GMP',sentinel);
  f.files.set('native-world-first/Frontier_0_0.GMP',sentinel);
  const first=f.store('first'),second=f.store('second'),bytes=Buffer.alloc(9001,3);
  const old=await f.commit(first,'0_0',bytes);await f.commit(second,'0_0',Buffer.alloc(9001,5));
  await f.commit(first,'0_0',Buffer.alloc(9001,7),old.manifest);
  assert.equal((await first.read('0_0')).sha256,sha(Buffer.alloc(9001,7)));
  assert.equal((await second.read('0_0')).sha256,sha(Buffer.alloc(9001,5)));
  assert.equal(f.files.get('frontier_0_0/Documents/My Games/MajestyHD/SaveGame/Frontier_0_0.GMP'),sentinel);
  assert.equal(f.files.get('native-world-first/Frontier_0_0.GMP'),sentinel);
  assert.ok(f.files.has('native-world-first/frontier_0_0/Frontier_0_0.checkpoint'));
  assert.ok(f.files.has('native-world-first/frontier_0_0/Documents/My Games/MajestyHD/SaveGame/Frontier_0_0_Recovery.GMP'));
  assert.ok(f.largestRead<=4096);
});
test('missing native world, region and SaveGame directories are read-only and have no root fallback',async()=>{
  const f=fixture(),store=f.store('empty');assert.equal(f.calls.length,0);
  assert.equal(await store.read('0_0'),null);assert.equal(f.directories.size,1);assert.equal(f.files.size,0);
  f.directories.add('native-world-empty');f.directories.add('native-world-empty/frontier_0_0');
  assert.equal(await f.adapter('empty').open('Frontier_0_0.GMP'),null);
  assert.equal(f.directories.size,3);assert.equal(f.files.size,0);
  assert.ok(f.calls.every(call=>!call.create));
});
test('invalid names cannot traverse directories, select another profile or cause file I/O',async()=>{
  const f=fixture(),io=f.adapter('safe');
  for(const filename of ['../Frontier_0_0.GMP','Frontier_0_0/Frontier_0_0.GMP','Frontier_00_0.GMP',
    'Frontier_-0_0.GMP','Frontier_1000001_0.GMP','Frontier_0_0_Recovery.checkpoint','Frontier_0_0.identity',null]){
    await assert.rejects(io.open(filename));await assert.rejects(io.atomicWrite(filename,()=>assert.fail('unsafe write')));
  }
  for(const world of ['../safe','UPPER','',null,'x'.repeat(41)])assert.throws(()=>f.adapter(world));
  assert.equal(f.calls.length,0);assert.equal(f.files.size,0);
});
test('permission errors are not interpreted as missing regions or regenerated data',async()=>{
  const f=fixture();f.deny('native-world-private');const store=f.store('private');
  await assert.rejects(store.read('0_0'),{name:'NotAllowedError'});
  await assert.rejects(f.commit(store,'0_0',Buffer.alloc(12)),{name:'NotAllowedError'});
  assert.equal(f.files.size,0);assert.equal(f.directories.size,1);
});
test('all original-layout regions share the same world lease; a busy writer performs no path lookup',async()=>{
  const f=fixture(),store=f.store('test-world');await f.commit(store,'0_0',Buffer.alloc(12));
  await store.withRegions(['0_0'],async()=>{
    const before=f.calls.length;await assert.rejects(f.commit(f.store('test-world'),'1_0',Buffer.alloc(13)),/busy/);
    assert.equal(f.calls.length,before+1);assert.equal(f.calls.at(-1).lock,'majesty-pair-native-world-test-world');
    assert.equal(f.calls.at(-1).ifAvailable,true);
  });
});
test('a failed OPFS publication aborts its stream and preserves the selected original-layout save',async()=>{
  const f=fixture(),store=f.store('safe'),old=await f.commit(store,'0_0',Buffer.alloc(9001,1));
  f.failClose();await assert.rejects(f.commit(store,'0_0',Buffer.alloc(9001,2),old.manifest),/close failed/);
  assert.equal(f.aborts,1);assert.equal((await store.read('0_0')).manifest,old.manifest);
});
