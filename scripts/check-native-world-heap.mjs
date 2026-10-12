#!/usr/bin/env node
// Full allocation metadata only; no guest payload capture or ownership inference.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyWorldAllocator} from './check-native-world-allocator.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name,cap) {
  const s=await stoppedFileSource(name);assert.ok(s.size<=cap);const b=Buffer.alloc(s.size);
  for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;
}
export function parseHeapMetadata(bytes,visit,stage) {
  assert.ok(bytes.length>=40&&bytes.length<=40+8192*16);
  const words=Array.from({length:10},(_,i)=>bytes.readUInt32LE(i*4));
  const [magic,version,index,stageId,count,rounded,requested,pools,clock,hooks]=words;
  assert.deepEqual([magic,version,index,stageId],[0x50414548,2,visit,['load','before-exit','after-exit'].indexOf(stage)]);
  assert.ok(count>0&&count<=8192&&pools>0&&pools<=64);assert.equal(bytes.length,40+count*16);
  let previousEnd=0,actualRounded=0,actualRequested=0,knownBytes=0,otherBytes=0;
  const kinds=[0,0,0,0],sizes=new Map(),records=[];
  for(let i=0;i<count;++i) {
    const at=40+i*16,address=bytes.readUInt32LE(at),roundedBytes=bytes.readUInt32LE(at+4),requestedBytes=bytes.readUInt32LE(at+8),kind=bytes.readUInt32LE(at+12);
    assert.ok(address>=0x01000000&&address%16===0&&address>=previousEnd&&address+roundedBytes<=0x10000000);
    assert.equal(roundedBytes,Math.ceil(Math.max(1,requestedBytes)/16)*16);assert.ok(kind<=3);
    if(kind===1)assert.ok(requestedBytes>=pools*20&&requestedBytes<=64*20);
    if(kind===2)assert.equal(requestedBytes,0x41c4);if(kind===3)assert.equal(requestedBytes,0x100000);
    ++kinds[kind];actualRounded+=roundedBytes;actualRequested+=requestedBytes;previousEnd=address+roundedBytes;
    if(kind)knownBytes+=roundedBytes;
    else {otherBytes+=roundedBytes;const entry=sizes.get(requestedBytes)||{requestedBytes,roundedBytes,count:0,bytes:0};++entry.count;entry.bytes+=roundedBytes;sizes.set(requestedBytes,entry);}
    records.push({address,roundedBytes,requestedBytes,kind});
  }
  assert.deepEqual(kinds.slice(1),[1,pools,pools]);assert.equal(actualRounded,rounded);assert.equal(actualRequested,requested);
  return {count,rounded,requested,pools,clock,hooks,kinds,knownBytes,otherBytes,sizes:[...sizes.values()].sort((a,b)=>a.requestedBytes-b.requestedBytes),records};
}
export async function verifyWorldHeap(manifest) {
  const allocator=await verifyWorldAllocator(manifest),m=JSON.parse(await bounded(manifest,65536));assert.equal(m.worldHeapProbe,true);
  const runtime=m.nativeHeapRuntimeSourceSha256;assert.deepEqual(Object.keys(runtime).sort(),['upstream/majesty-recomp/kit/runtime/memory.cpp','upstream/majesty-recomp/kit/runtime/memory.h','upstream/majesty-recomp/kit/runtime/tests/runtime_tests.cpp']);
  for(const [name,digest] of Object.entries(runtime))assert.equal((await hashNativeFile(join(workspace,name),{maximum:1024*1024})).sha256,digest,'Heap runtime changed');
  const build=JSON.parse(await bounded(m.buildReport,65536));assert.deepEqual(build.nativeHeapRuntimeSourceSha256,runtime);
  const testName=join(workspace,'output/native-heap-inspection-tests-observed.json'),testBytes=await bounded(testName,65536),test=JSON.parse(testBytes);
  assert.equal(test.qualified,true);assert.equal(test.checks,978);assert.equal(test.failures,0);assert.equal(test.gameLoaded,false);assert.deepEqual(test.nativeHeapRuntimeSourceSha256,runtime);
  assert.equal(test.logSha256,sha(await bounded(join(workspace,'output/native-heap-inspection-focused-tests.log'),1024*1024)));
  assert.equal(test.detailsSha256,sha(await bounded(join(workspace,'output/native-heap-inspection-focused-test-details.log'),1024*1024)));
  const log=(await bounded(m.log,1024*1024)).toString('utf8');assert.equal(sha(log),allocator.evidenceSha256[m.log]);
  const pattern=/^\[streaming\] World heap visit=(\d+) stage=(load|before-exit|after-exit) file=(Heap_Visit_\d+_(?:load|before-exit|after-exit)\.bin) records=(\d+) bytes=(\d+) rounded=(\d+) requested=(\d+) known-count=(\d+) known-bytes=(\d+) pages=(\d+) largest-scan=(\d+) clock=(\d+) hooks=(\d+) world-null=([01]) complete=1 heap-same=1 clock-same=1 hooks-same=1 elapsed-us=(\d+) result=pass$/gm;
  const matches=[...log.matchAll(pattern)],count=allocator.visits.length;
  assert.equal((log.match(/^\[streaming\] World heap\b/gm)||[]).length,count*3);assert.equal(matches.length,count*3);
  const evidence={...allocator.evidenceSha256,[testName]:sha(testBytes)},visits=[],saveToExitClockGaps=[];let maxElapsedUs=0;
  for(let i=0;i<count;++i) {
    const row={visit:i,region:i%2?0:1};
    for(const [k,stage] of ['load','before-exit','after-exit'].entries()) {
      const t=matches[i*3+k];assert.equal(Number(t[1]),i);assert.equal(t[2],stage);assert.equal(t[3],`Heap_Visit_${i}_${stage}.bin`);
      const filename=join(m.profile,t[3]),bytes=await bounded(filename,40+8192*16),data=parseHeapMetadata(bytes,i,stage),a=allocator.visits[i][['loaded','beforeExit','afterExit'][k]];
      assert.deepEqual([data.count,bytes.length,data.rounded,data.requested,data.kinds.slice(1).reduce((x,y)=>x+y,0),data.knownBytes,data.clock,data.hooks],t.slice(4,10).map(Number).concat(t.slice(12,14).map(Number)));
      assert.deepEqual([data.count,data.rounded,data.pools,data.knownBytes,data.otherBytes],[a.heapBlocks,a.heapBytes,a.pools,a.knownHeapBytes,a.otherHeapBytes]);
      assert.equal(Number(t[14]),k===2?1:0);assert.equal(data.hooks,Number(matches[0][13]));
      assert.ok(Number(t[10])>0&&Number(t[10])<=256&&Number(t[11])>0&&Number(t[11])<=256);
      assert.ok(Number(t[10])*64>=data.count&&Number(t[11])>=Math.min(64,data.count));
      const elapsedUs=Number(t[15]);assert.ok(Number.isSafeInteger(elapsedUs)&&elapsedUs<=2000000);maxElapsedUs=Math.max(maxElapsedUs,elapsedUs);
      const peer=[...log.matchAll(new RegExp('^\\[streaming\\] World allocator visit='+i+' stage='+stage+' .*$', 'gm'))];assert.equal(peer.length,1);assert.ok(peer[0].index<t.index);
      if(k<2){const next=[...log.matchAll(new RegExp('^\\[streaming\\] World survivors visit='+i+' stage='+['before-exit','after-exit'][k]+' .*$', 'gm'))];assert.equal(next.length,1);assert.ok(t.index<next[0].index);}
      else if(i+1<count){const next=[...log.matchAll(new RegExp('^\\[streaming\\] World residency load='+(i+1)+' .*$', 'gm'))];assert.equal(next.length,1);assert.ok(t.index<next[0].index);}
      if(k===0){const tick=[...log.matchAll(new RegExp('^\\[streaming\\] World residency first-tick load='+i+' .*$', 'gm'))];assert.equal(tick.length,1);assert.ok(t.index<tick[0].index);}
      const {records,...summary}=data;row[['loaded','beforeExit','afterExit'][k]]={filename,sha256:sha(bytes),...summary,elapsedUs};evidence[filename]=sha(bytes);
    }
    const saved=[...log.matchAll(new RegExp('^\\[streaming\\] World persistence snapshot visit='+i+' side=\\d+ stage=after clock=(\\d+) .*$', 'gm'))];assert.equal(saved.length,1);
    saveToExitClockGaps.push({visit:i,savedClock:Number(saved[0][1]),preExitClock:row.beforeExit.clock,clockGapMs:(row.beforeExit.clock-Number(saved[0][1]))>>>0});
    visits.push(row);
  }
  const comparisons=[0,1].map(region=>{
    const subset=visits.filter(v=>v.region===region),first=subset[0].afterExit,last=subset.at(-1).afterExit,old=new Map(first.sizes.map(s=>[s.requestedBytes,s])),current=new Map(last.sizes.map(s=>[s.requestedBytes,s]));
    const changes=[...new Set([...old.keys(),...current.keys()])].map(size=>({requestedBytes:size,countDrift:(current.get(size)?.count||0)-(old.get(size)?.count||0),roundedByteDrift:(current.get(size)?.bytes||0)-(old.get(size)?.bytes||0)})).filter(s=>s.countDrift!==0).sort((a,b)=>b.roundedByteDrift-a.roundedByteDrift);
    assert.equal(changes.reduce((sum,s)=>sum+s.roundedByteDrift,0),last.otherBytes-first.otherBytes);
    return {region,visits:subset.map(v=>v.visit),otherHeapBytesDrift:last.otherBytes-first.otherBytes,otherHeapAllocationDrift:last.kinds[0]-first.kinds[0],changedRequestedSizes:changes};
  });
  return {qualified:true,scope:'Complete bounded live guest-heap allocation metadata reconciles with actual original persistence and CRT accounting. Known CRT addresses are tagged; remaining size groups locate growth without inferring ownership or safe cleanup. No payload capture.',sourceManifest:allocator.sourceManifest,sourceManifestSha256:allocator.sourceManifestSha256,nativeExecutableSha256:allocator.nativeExecutableSha256,
    heapMetadataQualified:true,visits,comparisons,maxElapsedUs,nativeResourceSampling:allocator.nativeResourceSampling,broaderRuntimeSuitePassed:false,
    saveToExitClockGaps,exactPreTeardownCheckpointQualified:false,
    originalPerVisitSaveAndRevisitQualified:true,originalBoundedRegionResidencyQualified:false,wholeBrowserMemoryBoundQualified:false,generatedAdjacentTerrainQualified:false,continuousTravelQualified:false,coopRegionHandoffQualified:false,browserUsed:false,nativeProcessesStarted:0,
    sourceSha256:{...allocator.sourceSha256,...runtime,'scripts/check-native-world-heap.mjs':sha(await readFile(new URL(import.meta.url)))},evidenceSha256:evidence};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal manifest> <fresh heap report>');
  const r=await verifyWorldHeap(name);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,visits:r.visits.length,maxElapsedUs:r.maxElapsedUs,comparisons:r.comparisons.map(c=>({...c,changedRequestedSizes:c.changedRequestedSizes.slice(0,8)}))}));
}
