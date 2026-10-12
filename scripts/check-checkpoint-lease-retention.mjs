// Bounded, in-memory ownership probe. No OPFS, browser, game or native build.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {setImmediate} from 'node:timers/promises';
import {NativeRealmStore,realmFiles} from '../web/world/realm-store.mjs';
import {PairedCheckpointStore,TRANSFER_MANIFEST} from '../web/world/transfer-store.mjs';

const output=new URL('../output/checkpoint-lease-retention-observed.json',import.meta.url);
await rm(output,{force:true});
assert.equal(typeof global.gc,'function','Run this probe with node --expose-gc');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const seed=new Uint8Array(4096).fill(77),digest=sha(seed),content='lease-retention-fixture';
const weak=[],expired=[],fixtureFiles=new Map();let busy=false,largestRead=0;
const io={async withLock(mode,fn){assert.equal(busy,false);busy=true;try{return await fn();}finally{busy=false;}},
  async open(name){
    const value=fixtureFiles.get(name);if(value===undefined)return null;
    const bytes=value==='data'?seed.slice():new TextEncoder().encode(value);
    const file={size:bytes.length,async readAt(at,n){largestRead=Math.max(largestRead,n);return bytes.slice(at,at+n);}};
    if(value==='data')weak.push(new WeakRef(file));return file;
  },atomicWrite(){throw new Error('Retention probe is read-only');}};
for(let i=0;i<49;++i){const names=realmFiles(`${i}_0`);
  fixtureFiles.set(names.marker,['checkpoint-v1',0,seed.length,digest,content,''].join('\n'));
  fixtureFiles.set(names.slots[0],'data');}
fixtureFiles.set(TRANSFER_MANIFEST,['majesty-transfer-v1',0,0,'0_0','1_0',seed.length,digest,seed.length,digest,content,''].join('\n'));
for(const side of ['Source','Destination'])fixtureFiles.set(`Frontier_Transfer_${side}_0.GMP`,'data');

// Hold the old closure shape as a negative control: rejecting future reads
// without clearing its captured file should keep that file reachable.
function legacyControl(){
  const file={size:4096,readAt(){return seed.slice();}},ref=new WeakRef(file);let active=false;
  return {ref,reader:{async readAt(){if(!active)throw new Error('lease ended');return file.readAt();}}};
}
const legacy=legacyControl();
for(let cycle=0;cycle<4;++cycle){
  const realms=new NativeRealmStore(io,{content}),paired=new PairedCheckpointStore(io,{content,regions:['0_0','1_0']});
  const fail=cycle%2===1;
  const take=async sources=>{expired.push(...sources);assert.equal((await sources[0].readAt(0,4096)).length,4096);
    if(fail)throw new Error('consumer failed');};
  const regional=realms.withRegions(Array.from({length:49},(_,i)=>`${i}_0`),selected=>take([...selected.values()].map(v=>v.source)));
  if(fail)await assert.rejects(regional,/consumer failed/);else await regional;
  const shared=paired.withSelected(selected=>take(selected.sources));
  if(fail)await assert.rejects(shared,/consumer failed/);else await shared;
}
assert.equal(expired.length,204);assert.equal(weak.length,204);assert.equal(busy,false);assert.ok(largestRead<=4096);
for(const reader of expired)await assert.rejects(reader.readAt(0,1),/lease ended/);
await assert.rejects(legacy.reader.readAt(),/lease ended/);
let collected=0,passes=0;
for(;passes<8;++passes){
  await setImmediate();global.gc();await setImmediate();
  collected=weak.filter(ref=>ref.deref()===undefined).length;
  if(collected===weak.length){++passes;break;}
}
assert.equal(collected,204,'Expired actual-store readers retained backing sources');
assert.notEqual(legacy.ref.deref(),undefined,'Negative control must remain reachable');
// Keep the readers reachable through the complete GC observation.
assert.equal(expired[203].size,4096);assert.equal(typeof legacy.reader.readAt,'function');
const files=['web/world/checkpoint-lease.mjs','web/world/realm-store.mjs','web/world/transfer-store.mjs',
  'web/world/terrain-scene.mjs','scripts/check-checkpoint-lease-retention.mjs'];
const hashes={};for(const file of files)hashes[file]=sha(await readFile(new URL('../'+file,import.meta.url)));
const evidence={qualified:true,scope:'in-memory backing-source reachability after actual store lease cleanup',
  nodeVersion:process.versions.node,v8Version:process.versions.v8,
  cycles:4,realmsPerCycle:49,pairedWorldsPerCycle:2,retainedExpiredReaders:expired.length,
  backingSourcesObserved:weak.length,collectedBackingSources:collected,gcPasses:passes,
  legacyExpiredClosureStillRetainsBackingSource:true,consumerSuccessAndFailureChecked:true,
  largestReadBytes:largestRead,fixturePayloadBytes:seed.length,sourceSha256:hashes,
  gameLaunched:false,browserInspected:false,opfsAccessed:false,nativeBuildRun:false,
  liveBrowserMemoryMeasured:false,crashResolved:false,liveNativePagingQualified:false};
await writeFile(output,JSON.stringify(evidence,null,2)+'\n');
console.log(`${collected} backing sources collected with ${expired.length} expired readers retained; old closure control remains reachable.`);
