import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {hashBlob,ContentHasher,HASH_READ_BYTES} from '../web/world/content-hash.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function data(size){return Uint8Array.from({length:size},(_,i)=>(i*17+31)%256);}
function mockWorker(){return {sent:[],terminations:0,postMessage(value){this.sent.push(value);},terminate(){++this.terminations;}};}
class ThreadWorker {
  constructor(){
    const url=new URL('../web/world/content-hash-worker.mjs',import.meta.url).href;
    this.thread=new Worker(`const {parentPort}=require('node:worker_threads');
      globalThis.self={postMessage:value=>parentPort.postMessage(value)};
      import(${JSON.stringify(url)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`,{eval:true});
    this.thread.on('message',data=>this.onmessage?.({data}));
    this.thread.on('error',()=>this.onerror?.({preventDefault(){}}));
  }
  postMessage(value){this.thread.postMessage(value);}
  terminate(){this.stopped=this.thread.terminate();}
}
test('incremental content hashes equal independent SHA-256 with bounded file reads',async()=>{
  for(const size of [0,1,55,56,63,64,HASH_READ_BYTES-1,HASH_READ_BYTES,HASH_READ_BYTES+1,1024*1024+3]){
    const bytes=data(size),reads=[];
    class TrackedBlob extends Blob {
      arrayBuffer(){assert.fail('whole content file must not be read');}
      slice(start,end){reads.push(end-start);return super.slice(start,end);}
    }
    assert.equal(await hashBlob(new TrackedBlob([bytes])),sha(bytes));
    assert.ok(reads.every(n=>n<=HASH_READ_BYTES));
    assert.equal(reads.reduce((n,v)=>n+v,0),size);
  }
});
test('malformed and changed content fail instead of returning an identity',async()=>{
  for(const value of [null,{},new Uint8Array(20)])await assert.rejects(hashBlob(value),/Invalid/);
  class ChangedBlob extends Blob {slice(){return new Blob();}}
  await assert.rejects(hashBlob(new ChangedBlob(['changed'])),/Content changed/);
});
test('actual module worker hashes structured-cloned blobs and can be reused serially',async()=>{
  const worker=new ThreadWorker(),hasher=new ContentHasher(()=>worker);
  try{
    for(const size of [0,65,1024*1024+11]){
      const bytes=data(size);assert.equal(await hasher.hash(new Blob([bytes])),sha(bytes));
    }
  }finally{hasher.close();await worker.stopped;}
});
test('only one file is accepted, with no queued payload, and closing cancels it',async()=>{
  const worker=mockWorker(),hasher=new ContentHasher(()=>worker),file=new Blob(['one']);
  const pending=hasher.hash(file);
  await assert.rejects(hasher.hash(new Blob(['two'])),/busy/);
  assert.equal(worker.sent.length,1);assert.equal(worker.sent[0].file,file);
  assert.ok(!('bytes' in worker.sent[0]),'no complete content buffer sent');
  hasher.close();await assert.rejects(pending,/stopped/);
  hasher.close();assert.equal(worker.terminations,1);
  await assert.rejects(hasher.hash(file),/closed/);
});
test('a worker read failure rejects its file and permits a subsequent file',async()=>{
  const worker=mockWorker(),hasher=new ContentHasher(()=>worker);
  const first=hasher.hash(new Blob(['first']));worker.onmessage({data:{id:1,error:true}});
  await assert.rejects(first,/could not be read/);
  const second=hasher.hash(new Blob(['second']));worker.onmessage({data:{id:2,sha256:sha('second')}});
  assert.equal(await second,sha('second'));hasher.close();
});
test('worker errors, clone failure, malformed responses and stale identifiers terminate pending work',async()=>{
  for(const kind of ['error','messageerror','clone','malformed','stale']){
    const worker=mockWorker();if(kind==='clone')worker.postMessage=()=>{throw new Error('cannot clone');};
    const hasher=new ContentHasher(()=>worker),result=hasher.hash(new Blob(['one']));
    if(kind==='error')worker.onerror({preventDefault(){}});
    if(kind==='messageerror')worker.onmessageerror();
    if(kind==='malformed')worker.onmessage({data:{id:1,sha256:'bad'}});
    if(kind==='stale')worker.onmessage({data:{id:2,sha256:sha('one')}});
    await assert.rejects(result);assert.equal(worker.terminations,1);
    await assert.rejects(hasher.hash(new Blob()),/closed/);
  }
});
test('invalid inputs are refused without worker messages',async()=>{
  const worker=mockWorker(),hasher=new ContentHasher(()=>worker);
  await assert.rejects(hasher.hash({size:100}),/Invalid/);assert.equal(worker.sent.length,0);hasher.close();
});

const player=await readFile(new URL('../upstream/majesty-recomp/kit/web/player/index.html',import.meta.url),'utf8');
const original=player.slice(player.indexOf('async function networkManifest('),player.indexOf('\nconst networkDebug'));
const staging=spawnSync('python3',['-c',"import runpy,sys; sys.stdout.write(runpy.run_path('scripts/stage-world.py')['bounded_hashing'](sys.stdin.read()))"],{input:original,encoding:'utf8'});
assert.equal(staging.status,0,staging.stderr);
const bounded=staging.stdout;
function directory(tree){
  const handles=new Map(Object.entries(tree).map(([name,value])=>[name,value instanceof Blob?
    {kind:'file',async getFile(){return value;}}:{kind:'directory',...directory(value)}]));
  return {async getFileHandle(name){if(!handles.has(name))throw new Error('missing '+name);return handles.get(name);},async *entries(){yield*handles;}};
}
function manifest(source,options={}){
  return runInNewContext(source.replace('import("../world/content-hash.mjs")','loadHashModule()')+'\nnetworkManifest',{
    URLSearchParams,TextEncoder,crypto:webcrypto,location:{search:options.search||''},
    loadHashModule:async()=>({ContentHasher:options.ContentHasher}),
  });
}
test('staged worker hashing preserves session and checkpoint fingerprints byte for byte',async()=>{
  const workers=[];
  class Hasher extends ContentHasher {constructor(){super(()=>{const worker=new ThreadWorker();workers.push(worker);return worker;});}}
  const game={sha256:'a'.repeat(64),engineSha256:'b'.repeat(64)};
  for(const query of ['', '?RECOMP_RULE_FRONTIER_RESTORE=1&RECOMP_RULE_FRONTIER_REGION=0_0']){
    const dir=directory({'.manifest.json':new Blob(['import metadata']),
      'z.cam':new Blob([data(1024*1024+7)]),'Empty':new Blob(),
      'a':{'z.txt':new Blob(['nested']),'.manifest.json':new Blob(['nested metadata is content'])},
      'a!':new Blob(['path sorting']), 'MajestyHD - Old.exe':new Blob(['pinned'])});
    const expected=await manifest(original,{search:query})(dir,game);
    const actual=await manifest(bounded,{search:query,ContentHasher:Hasher})(dir,game);
    assert.equal(actual.session,expected.session);assert.equal(actual.checkpoint,expected.checkpoint);
  }
  for(const worker of workers){assert.ok(worker.stopped,'manifest closes its worker');await worker.stopped;}
});
test('staged identity hashing never invokes a whole-file main-thread read and closes on failure',async()=>{
  class NoWholeRead extends Blob {arrayBuffer(){assert.fail('main thread cloned whole asset');}}
  const bytes=data(1024*1024+5),workers=[];
  class Hasher extends ContentHasher {constructor(){super(()=>{const worker=new ThreadWorker();workers.push(worker);return worker;});}}
  const dir=directory({'.manifest.json':new Blob(),large:new NoWholeRead([bytes])});
  await manifest(bounded,{ContentHasher:Hasher})(dir,{sha256:'a'.repeat(64),engineSha256:'b'.repeat(64)});
  await workers[0].stopped;
  let closed=0;
  class FailedHasher {hash(){throw new Error('read failed');}close(){++closed;}}
  await assert.rejects(manifest(bounded,{ContentHasher:FailedHasher})(dir,{}),/read failed/);
  assert.equal(closed,1);
});
test('mod changes still alter compatibility, host engine rebuilds do not alter checkpoint identity',async()=>{
  class LocalHasher {hash(file){return hashBlob(file);}close(){}}
  const game={sha256:'a'.repeat(64),engineSha256:'b'.repeat(64)};
  const make=value=>directory({'.manifest.json':new Blob(),asset:new Blob([value])});
  const plain=manifest(bounded,{ContentHasher:LocalHasher});
  const before=await plain(make('old'),game),after=await plain(make('new'),game);
  assert.notEqual(before.session,after.session);assert.notEqual(before.checkpoint,after.checkpoint);
  const rebuild=await plain(make('old'),{...game,engineSha256:'c'.repeat(64)});
  assert.notEqual(before.session,rebuild.session);assert.equal(before.checkpoint,rebuild.checkpoint);
  const rules=await manifest(bounded,{ContentHasher:LocalHasher,search:'?RECOMP_RULE_FRONTIER_RESTORE=1'})(make('old'),game);
  assert.notEqual(before.session,rules.session);assert.equal(before.checkpoint,rules.checkpoint);
});
