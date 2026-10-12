import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdtemp,open,rename,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Sha256} from '../web/world/sha256.mjs';
import {PairedCheckpointStore,parseTransferManifest,opfsPairedStorage,TRANSFER_MANIFEST} from '../web/world/transfer-store.mjs';
import {MAX_CHECKPOINT_BYTES,CHECKPOINT_PAGE_BYTES} from '../web/world/checkpoint.mjs';
const identity={regions:['0_0','1_0'],content:'test-content'};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const input=bytes=>({size:bytes.length,async readAt(offset,length){assert.ok(length<=CHECKPOINT_PAGE_BYTES);return bytes.subarray(offset,offset+length);}});
const pair=(a,b,moved,expectedManifest)=>({worlds:[a,b].map(bytes=>({source:input(bytes),sha256:hash(bytes)})),moved,expectedManifest});

test('selected pairs use both captured validated sources without reopening their paths',async()=>{
  const original=[Buffer.alloc(8193,1),Buffer.alloc(4097,2)];
  const names=['Frontier_Transfer_Source_0.GMP','Frontier_Transfer_Destination_0.GMP'];
  const files=new Map(names.map((name,i)=>[name,original[i]])),opens=[0,0];
  files.set(TRANSFER_MANIFEST,Buffer.from(['majesty-transfer-v1',0,0,...identity.regions,
    original[0].length,hash(original[0]),original[1].length,hash(original[1]),identity.content,''].join('\n')));
  let busy=false,readers;
  const io={async withLock(mode,consume){assert.equal(busy,false);busy=true;try{return await consume();}finally{busy=false;}},
    atomicWrite(){throw Error('Read-only fixture');},async open(name){
      const captured=files.get(name);if(!captured)return null;
      const side=names.indexOf(name);if(side>=0)++opens[side];
      return {size:captured.length,async readAt(at,n){
        assert.ok(n<=CHECKPOINT_PAGE_BYTES);
        const bytes=captured.subarray(at,at+n);
        if(side>=0&&at+n===captured.length)files.set(name,Buffer.alloc(captured.length,99));
        return bytes;
      }};
    }};
  const store=new PairedCheckpointStore(io,identity);
  await store.withSelected(async selected=>{
    readers=selected.sources;
    for(let side=0;side<2;++side)assert.equal(hash(await readers[side].readAt(0,256)),hash(original[side].subarray(0,256)));
  });
  assert.deepEqual(opens,[1,1]);assert.equal(busy,false);
  for(const reader of readers)await assert.rejects(reader.readAt(0,1),/lease ended/);
  await assert.rejects(store.read(),/Damaged selected transfer world/);
  assert.equal(busy,false);
});
// Real disk files and atomic renames exercise staging/close/abort behavior.
// The lock is a shared test fixture, not a cross-process native lock promise.
async function fixture(t){
  const root=await mkdtemp(path.join(tmpdir(),'majesty-pair-storage-'));t.after(()=>rm(root,{recursive:true,force:true}));
  let busy=false;const writes=[],reads=[];
  const io={
    async withLock(mode,fn){if(busy)throw Error('busy');busy=true;try{return await fn();}finally{busy=false;}},
    async open(name){
      let info;try{info=await stat(path.join(root,name));}catch(e){if(e.code==='ENOENT')return null;throw e;}
      if(!info.isFile())throw Error('not a regular file');
      return {size:info.size,async readAt(offset,length){reads.push(length);assert.ok(length<=CHECKPOINT_PAGE_BYTES);const f=await open(path.join(root,name),'r');try{const bytes=new Uint8Array(length),r=await f.read(bytes,0,length,offset);return bytes.subarray(0,r.bytesRead);}finally{await f.close();}}};
    },
    async atomicWrite(name,produce){
      writes.push(name);const temp=path.join(root,name+'.tmp'),f=await open(temp,'w');let position=0;
      try{await produce({async write(bytes){assert.ok(bytes.length<=CHECKPOINT_PAGE_BYTES);let at=0;while(at<bytes.length){const r=await f.write(bytes,at,bytes.length-at,position);if(!r.bytesWritten)throw Error('short write');at+=r.bytesWritten;position+=r.bytesWritten;}}});await f.sync();await f.close();await rename(temp,path.join(root,name));}
      catch(error){await f.close().catch(()=>{});await rm(temp,{force:true});throw error;}
    },
  };
  return {root,io,writes,reads,store:()=>new PairedCheckpointStore(io,identity)};
}
test('incremental hashes agree with the platform reference across padding and page boundaries',()=>{
  for(const n of [0,1,55,56,63,64,65,4095,4096,4097,1024*1024]){
    const bytes=randomBytes(n),hasher=new Sha256();
    for(let at=0;at<bytes.length;at+=137)hasher.update(bytes.subarray(at,at+137));
    assert.equal(hasher.hex(),hash(bytes));assert.throws(()=>hasher.update(new Uint8Array()),/Invalid/);
  }
  assert.equal(new Sha256().update(new TextEncoder().encode('abc')).hex(),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('both selected disk files survive a fresh store and copies stay bounded',async t=>{
  const f=await fixture(t),a=randomBytes(17003),b=randomBytes(11009);
  const first=await f.store().commit(pair(a,b,false,null));
  const {idempotent,...expected}=first;
  assert.equal(first.slot,0);assert.deepEqual(await f.store().read(),expected);
  assert.ok(f.reads.length>8);assert.ok(Math.max(...f.reads)<=CHECKPOINT_PAGE_BYTES);
});
for(const boundary of ['after-source','before-publish','after-publish'])test(`${boundary} failure selects one complete pair after reopening`,async t=>{
  const f=await fixture(t),a=randomBytes(7001),b=randomBytes(6013),c=randomBytes(8111),d=randomBytes(9021);
  const before=await f.store().commit(pair(a,b,false,null));
  await assert.rejects(f.store().commit(pair(c,d,true,before.manifest),async at=>{if(at===boundary)throw Error('interrupted boundary');}),/interrupted boundary/);
  const selected=await f.store().read(),published=boundary==='after-publish';
  assert.equal(selected.moved,published);assert.equal(selected.slot,published?1:0);
  assert.deepEqual(selected.worlds.map(w=>w.sha256),[published?c:a,published?d:b].map(hash));
  assert.ok(Math.max(...f.reads)<=4096);
  if(!published)assert.equal(selected.manifest,before.manifest);
});
test('retry is idempotent, stale writers reject, and many publications retain four slots',async t=>{
  const f=await fixture(t);let selected=await f.store().commit(pair(randomBytes(67),randomBytes(73),false,null));
  const a=randomBytes(81),b=randomBytes(83),after=await f.store().commit(pair(a,b,true,selected.manifest)),count=f.writes.length;
  const retry=await f.store().commit(pair(a,b,true,selected.manifest));assert.equal(retry.idempotent,true);assert.equal(retry.manifest,after.manifest);assert.equal(f.writes.length,count);
  await assert.rejects(f.store().commit(pair(randomBytes(5),randomBytes(6),true,selected.manifest)),/changed/);
  selected=after;
  for(let i=0;i<40;++i)selected=await f.store().commit(pair(randomBytes(67+i),randomBytes(73+i),Boolean(i%2),selected.manifest));
  const {readdir}=await import('node:fs/promises');const names=await readdir(f.root);
  assert.equal(names.length,5);assert.equal(names.filter(n=>n.endsWith('.GMP')).length,4);
  assert.equal((await f.store().read()).manifest,selected.manifest);
});
test('damaging the opposite selected world rejects the whole pair and every replacement',async t=>{
  const f=await fixture(t),first=await f.store().commit(pair(randomBytes(20),randomBytes(21),false,null));
  await writeFile(path.join(f.root,'Frontier_Transfer_Destination_0.GMP'),randomBytes(21));
  await assert.rejects(f.store().read(),/Damaged/);
  const count=f.writes.length;await assert.rejects(f.store().commit(pair(randomBytes(20),randomBytes(21),true,first.manifest)),/Damaged/);assert.equal(f.writes.length,count);
});
test('bad incoming bytes abort staging and cannot change the current manifest',async t=>{
  const f=await fixture(t),a=randomBytes(67),b=randomBytes(73),first=await f.store().commit(pair(a,b,false,null));
  const request=pair(randomBytes(8000),b,true,first.manifest);request.worlds[0].sha256=hash(a);
  await assert.rejects(f.store().commit(request),/digest mismatch/);assert.equal((await f.store().read()).manifest,first.manifest);
  request.worlds[0].source={size:8000,async readAt(){return new Uint8Array(1);}};
  await assert.rejects(f.store().commit(request),/Truncated/);assert.equal((await f.store().read()).manifest,first.manifest);
});
test('malformed or oversized head never initializes over an existing checkpoint',async t=>{
  const f=await fixture(t),bytes=new Uint8Array(512);await writeFile(path.join(f.root,TRANSFER_MANIFEST),bytes);
  await assert.rejects(f.store().read(),/manifest size/);assert.deepEqual(f.reads,[]);
  await assert.rejects(f.store().commit(pair(randomBytes(5),randomBytes(6),false,null)),/manifest size/);assert.deepEqual(f.writes,[]);
  await writeFile(path.join(f.root,TRANSFER_MANIFEST),new Uint8Array([255]));await assert.rejects(f.store().read(),/encoding/);
});
test('invalid identities, large sources, and duplicate regions reject before storage I/O',async()=>{
  const io={open(){assert.fail('unexpected I/O');},atomicWrite(){assert.fail('unexpected write');},withLock(){assert.fail('unexpected lock');}};
  for(const regions of [['0_0','0_0'],['00_0','1_0'],['0_0','1000001_0'],['-0_0','1_0']])assert.throws(()=>new PairedCheckpointStore(io,{...identity,regions}));
  const request=pair(new Uint8Array([1]),new Uint8Array([2]),false,null);request.worlds[0].source={size:MAX_CHECKPOINT_BYTES+1,readAt(){}};
  await assert.rejects(new PairedCheckpointStore(io,identity).commit(request),/Invalid transfer source/);
  assert.throws(()=>opfsPairedStorage({},'test',null),/locking/);
});
test('source growth during a staged copy stops at its original bound',async t=>{
  const f=await fixture(t),request=pair(randomBytes(8000),randomBytes(8),false,null),s=request.worlds[0].source,read=s.readAt;
  s.readAt=async(...args)=>{const bytes=await read(...args);s.size=MAX_CHECKPOINT_BYTES+1;return bytes;};
  await assert.rejects(f.store().commit(request),/source changed/);assert.equal(await f.store().read(),null);
});
test('a concurrent writer cannot enter while one staged transfer holds the fixture lock',async t=>{
  const f=await fixture(t),a=randomBytes(8000),b=randomBytes(5);let release,entered;
  const reached=new Promise(r=>{entered=r;}),held=new Promise(r=>{release=r;});
  const writing=f.store().commit(pair(a,b,false,null),async at=>{if(at==='after-source'){entered();await held;}});await reached;
  await assert.rejects(f.store().commit(pair(a,b,false,null)),/busy/);await assert.rejects(f.store().read(),/busy/);
  release();await writing;assert.ok(await f.store().read());
});
test('manifest parsing requires exact identities, canonical lengths, and bounded ASCII',()=>{
  const manifest=['majesty-transfer-v1',0,0,'0_0','1_0',1,hash(new Uint8Array([1])),1,hash(new Uint8Array([2])),'test-content',''].join('\n');
  assert.equal(parseTransferManifest(manifest,identity.regions,identity.content).slot,0);
  for(const text of [manifest.replace('\n1\n','\n01\n'),manifest.replace('test-content','wrong'),manifest.replace('0_0','00_0'),manifest.replace('majesty-transfer-v1','majesty-transfer-v2'),manifest+'\n',manifest.replace('test-content','téšt-content')])assert.throws(()=>parseTransferManifest(text,identity.regions,identity.content));
});

test('selected-world leases protect copying from concurrent publication and expire afterward',async t=>{
  const f=await fixture(t),a=randomBytes(5001),b=randomBytes(5101),first=await f.store().commit(pair(a,b,false,null));let retained;
  await f.store().withSelected(async ({record,sources})=>{
    assert.equal(record.manifest,first.manifest);retained=sources[0];
    await assert.rejects(f.store().commit(pair(randomBytes(5),randomBytes(6),true,first.manifest)),/busy/);
    assert.deepEqual(await sources[0].readAt(0,4096),new Uint8Array(a.subarray(0,4096)));
    for(const[offset,length]of[[0,4097],[-1,1],[5001,1],[NaN,1]])await assert.rejects(sources[0].readAt(offset,length),/Unbounded/);
  });
  await assert.rejects(retained.readAt(0,1),/lease ended/);
  await f.store().commit(pair(randomBytes(5),randomBytes(6),true,first.manifest));
});

test('OPFS adapter aborts a failed writable and closes successful publication before returning',async()=>{
  const events=[],locks={request(name,options,fn){events.push(['lock',name,options]);return Promise.resolve(fn({name}));}};
  const directory={async getFileHandle(name){return {async createWritable(){events.push(['open',name]);return {async write(bytes){events.push(['write',bytes.length]);},async close(){events.push(['close']);},async abort(){events.push(['abort']);}};}};}};
  const io=opfsPairedStorage(directory,'owned-world',locks);
  await io.atomicWrite(TRANSFER_MANIFEST,sink=>sink.write(new Uint8Array([1])));
  assert.deepEqual(events.slice(-3),[['open',TRANSFER_MANIFEST],['write',1],['close']]);
  await assert.rejects(io.atomicWrite(TRANSFER_MANIFEST,async sink=>{await sink.write(new Uint8Array([1]));throw Error('before close');}),/before close/);
  assert.equal(events.at(-1)[0],'abort');
  await io.withLock('exclusive',async()=>{});assert.deepEqual(events.at(-1),['lock','majesty-pair-owned-world',{mode:'exclusive',ifAvailable:true}]);
  const blocked=opfsPairedStorage(directory,'owned-world',{request(name,options,fn){return Promise.resolve().then(()=>fn(null));}});
  await assert.rejects(blocked.withLock('shared',()=>assert.fail('must not run')),/busy/);
});
