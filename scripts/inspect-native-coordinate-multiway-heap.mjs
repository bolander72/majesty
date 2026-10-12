#!/usr/bin/env node
// Actual saved-kingdom qualification plus bounded allocation metadata, no payload.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectNativeCoordinateMultiway} from './inspect-native-coordinate-multiway.mjs';
import {parseHeapMetadata} from './check-native-world-heap.mjs';
import {parsePageEvents} from './check-native-page-sites.mjs';
import {assertMallocCallInstruction} from './check-native-malloc-sites.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
const sha=b=>createHash('sha256').update(b).digest('hex');
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function bytes(n,maximum){const s=await stoppedFileSource(n);assert.ok(s.size<=maximum);const b=Buffer.alloc(s.size);
 for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;}
function fields(line,prefix){assert.ok(line.startsWith(prefix));const result={};
 for(const token of line.slice(prefix.length).split(' ')){const p=token.indexOf('=');assert.ok(p>0);const k=token.slice(0,p),v=token.slice(p+1);assert.ok(v&&!Object.hasOwn(result,k));result[k]=v;}
 return result;}
function number(row,key){assert.match(row[key],/^\d+$/);const n=Number(row[key]);assert.ok(Number.isSafeInteger(n));return n;}
function sameKeys(row,keys){assert.deepEqual(Object.keys(row).sort(),keys.split(' ').sort());}
function allocatorSummary(row,h){
 sameKeys(row,'visit stage pools committed-groups walked live-count live-bytes free-bytes reserved-bytes known-heap-bytes other-heap-bytes heap-bytes heap-blocks table-bytes classes world-null heap-same crt-same clock-same hooks-same elapsed-us result');
 for(const k of ['heap-same','crt-same','clock-same','hooks-same'])assert.equal(row[k],'1');assert.equal(row.result,'pass');
 assert.equal(number(row,'pools'),h.pools);assert.equal(number(row,'reserved-bytes'),h.pools*0x100000);
 assert.equal(number(row,'known-heap-bytes'),h.knownBytes);assert.equal(number(row,'other-heap-bytes'),h.otherBytes);
 assert.equal(number(row,'heap-bytes'),h.rounded);assert.equal(number(row,'heap-blocks'),h.count);
 const groups=number(row,'committed-groups');assert.ok(groups>0&&groups<=512);
 assert.ok(number(row,'walked')>0&&number(row,'walked')<=600000);
 assert.ok(number(row,'table-bytes')>=h.pools*20&&number(row,'table-bytes')<=64*20);
 assert.ok(number(row,'elapsed-us')<=2000000);
 const classes=row.classes.split(',').map(v=>{assert.match(v,/^\d+$/);return Number(v);});assert.equal(classes.length,64);
 assert.equal(classes.reduce((n,c)=>n+c,0),number(row,'live-count'));
 assert.equal(classes.reduce((n,c,i)=>n+c*(i+1)*16,0),number(row,'live-bytes'));
 assert.equal(number(row,'live-bytes')+number(row,'free-bytes'),groups*8*0xff0);
 return {liveCount:number(row,'live-count'),liveBytes:number(row,'live-bytes'),freeBytes:number(row,'free-bytes'),classes};
}
function compareReturns(captures,route){
 return [...new Set(route)].filter(key=>route.indexOf(key)!==route.lastIndexOf(key)).map(region=>{
  const begin=route.indexOf(region),end=route.lastIndexOf(region);
  const first=captures[begin*3+2],last=captures[end*3+2],a=first.heap,b=last.heap;
  const old=new Map(a.sizes.map(s=>[s.requestedBytes,s])),current=new Map(b.sizes.map(s=>[s.requestedBytes,s]));
  const sizes=[...new Set([...old.keys(),...current.keys()])].map(size=>({requestedBytes:size,
   countDrift:(current.get(size)?.count??0)-(old.get(size)?.count??0),
   byteDrift:(current.get(size)?.bytes??0)-(old.get(size)?.bytes??0)})).filter(s=>s.countDrift).sort((a,b)=>b.byteDrift-a.byteDrift);
  assert.equal(sizes.reduce((n,s)=>n+s.byteDrift,0),b.otherBytes-a.otherBytes);
  const classes=first.allocator.classes.map((c,i)=>({roundedBytes:(i+1)*16,countDrift:last.allocator.classes[i]-c}))
   .filter(c=>c.countDrift);
  assert.equal(classes.reduce((n,c)=>n+c.countDrift*c.roundedBytes,0),last.allocator.liveBytes-first.allocator.liveBytes);
  assert.equal((b.otherBytes-a.otherBytes)+(b.knownBytes-a.knownBytes),b.rounded-a.rounded);
  return {region,visits:[begin,end],postUnloadHeapByteDrift:b.rounded-a.rounded,
   knownBackingByteDrift:b.knownBytes-a.knownBytes,ordinaryHeapByteDrift:b.otherBytes-a.otherBytes,ordinaryAllocationDrift:b.kinds[0]-a.kinds[0],
   ordinarySizeChanges:sizes,crtLiveCountDrift:last.allocator.liveCount-first.allocator.liveCount,
   crtLiveByteDrift:last.allocator.liveBytes-first.allocator.liveBytes,crtClassChanges:classes};
 });
}
const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal heap-enabled hero travel manifest> <fresh report>');
const m=await json(name),build=await json(m.buildReport),visitCount=m.coordinateRoute.length;assert.ok(visitCount===6||visitCount===8);
for(const k of ['worldHeapProbe','worldSurvivorProbe','worldAllocatorProbe','worldPageProbe'])assert.equal(m[k],true);
assert.equal(m.heapMetadataMaximumBytes,40+8192*16);
assert.deepEqual(m.nativeHeapRuntimeSourceSha256,build.nativeHeapRuntimeSourceSha256);
const runtimeNames=['upstream/majesty-recomp/kit/runtime/memory.cpp','upstream/majesty-recomp/kit/runtime/memory.h','upstream/majesty-recomp/kit/runtime/tests/runtime_tests.cpp'];
assert.deepEqual(Object.keys(m.nativeHeapRuntimeSourceSha256).sort(),runtimeNames);
for(const [n,d]of Object.entries(m.nativeHeapRuntimeSourceSha256))assert.equal(await hash(join(workspace,n)),d);
const nativeTestName=join(workspace,'output/native-heap-inspection-tests-observed.json'),nativeTest=await json(nativeTestName);
assert.deepEqual([nativeTest.qualified,nativeTest.checks,nativeTest.failures,nativeTest.gameLoaded],[true,978,0,false]);
assert.deepEqual(nativeTest.nativeHeapRuntimeSourceSha256,m.nativeHeapRuntimeSourceSha256);
assert.equal(await hash(join(workspace,'output/native-heap-inspection-focused-tests.log')),nativeTest.logSha256);
assert.equal(await hash(join(workspace,'output/native-heap-inspection-focused-test-details.log')),nativeTest.detailsSha256);
const saved=await inspectNativeCoordinateMultiway(name);
const logBytes=await bytes(m.log,(visitCount===8?2:1)*1024*1024);assert.equal(sha(logBytes),m.logSha256);const log=logBytes.toString('utf8');
const heapRows=[...log.matchAll(/^\[streaming\] World heap .*$/gm)],allocatorRows=[...log.matchAll(/^\[streaming\] World allocator .*$/gm)];
assert.equal(heapRows.length,visitCount*3);assert.equal(allocatorRows.length,visitCount*3);
const captures=[],evidence={[nativeTestName]:await hash(nativeTestName)};
for(let i=0;i<visitCount*3;i++){
 const visit=Math.floor(i/3),stage=['load','before-exit','after-exit'][i%3];
 const row=fields(heapRows[i][0],'[streaming] World heap '),a=fields(allocatorRows[i][0],'[streaming] World allocator ');
 sameKeys(row,'visit stage file records bytes rounded requested known-count known-bytes pages largest-scan clock hooks world-null complete heap-same clock-same hooks-same elapsed-us result');
 for(const r of [row,a])assert.deepEqual([number(r,'visit'),r.stage],[visit,stage]);
 assert.equal(row.file,`Heap_Visit_${visit}_${stage}.bin`);assert.equal(row.result,'pass');
 for(const k of ['complete','heap-same','clock-same','hooks-same'])assert.equal(row[k],'1');
 const filename=join(m.profile,row.file),raw=await bytes(filename,m.heapMetadataMaximumBytes),h=parseHeapMetadata(raw,visit,stage);
 assert.equal(raw.length,number(row,'bytes'));assert.equal(number(row,'records'),h.count);
 assert.equal(number(row,'rounded'),h.rounded);assert.equal(number(row,'requested'),h.requested);
 assert.equal(number(row,'known-count'),h.pools*2+1);assert.equal(number(row,'known-bytes'),h.knownBytes);
 assert.equal(number(row,'clock'),h.clock);assert.equal(number(row,'hooks'),h.hooks);
 assert.equal(h.hooks,number(fields(heapRows[0][0],'[streaming] World heap '),'hooks'));
 assert.ok(number(row,'pages')>0&&number(row,'pages')<=256&&number(row,'pages')*64>=h.count);
 assert.ok(number(row,'largest-scan')>0&&number(row,'largest-scan')<=256);assert.ok(number(row,'elapsed-us')<=2000000);
 assert.equal(number(row,'world-null'),stage==='after-exit'?1:0);assert.equal(a['world-null'],row['world-null']);
 assert.ok(allocatorRows[i].index<heapRows[i].index);if(i)assert.ok(heapRows[i-1].index<allocatorRows[i].index);
 const expectedClock=i%3?saved.visits[visit].after.clock:saved.visits[visit].before.clock;assert.equal(h.clock,expectedClock);
 const exit=log.indexOf(`[streaming] World residency exit=${visit} `),checkpoint=log.indexOf(`[streaming] World checkpoint completed visit=${visit} `);
 if(stage==='load'){
  assert.ok(log.indexOf(`[streaming] World residency load=${visit} `)<heapRows[i].index);
  assert.ok(heapRows[i].index<log.indexOf(`[streaming] World residency first-tick load=${visit} `));
 }else if(stage==='before-exit')assert.ok(checkpoint<heapRows[i].index&&heapRows[i].index<exit);
 else{
  assert.ok(exit<heapRows[i].index);
  if(visit<5)assert.ok(heapRows[i].index<log.indexOf(`[streaming] World residency load=${visit+1} `));
  assert.equal(h.rounded,saved.cycles[visit].postUnloadHeapBytes);assert.equal(h.count,saved.cycles[visit].postUnloadHeapBlocks);
  for(const root of saved.cycles[visit].roots)assert.ok(!h.records.some(r=>r.address===root));
 }
 const allocator=allocatorSummary(a,h);if(stage==='after-exit')assert.equal(allocator.liveCount,saved.cycles[visit].postUnloadCrtAllocations);
 evidence[filename]=sha(raw);captures.push({visit,stage,filename,sha256:sha(raw),heap:h,allocator,position:heapRows[i].index});
}
const comparisons=compareReturns(captures,m.coordinateRoute),events=parsePageEvents(log,visitCount),live=new Map(),pageVisits=[];
const peName=join(workspace,'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe');
assert.equal(await hash(peName),'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
const pe=await stoppedFileSource(peName),header=Buffer.from(await pe.readAt(0,4096)),peAt=header.readUInt32LE(60),sectionCount=header.readUInt16LE(peAt+6),optional=header.readUInt16LE(peAt+20);
assert.equal(header.readUInt32LE(peAt+52),0x400000);assert.ok(sectionCount>0&&sectionCount<=16);
const sections=Array.from({length:sectionCount},(_,i)=>{const at=peAt+24+optional+i*40;return {rva:header.readUInt32LE(at+12),size:header.readUInt32LE(at+16),offset:header.readUInt32LE(at+20)};});
const callSites=[];
for(const pc of new Set(events.filter(e=>e.op==='alloc'&&e.directCaller).map(e=>e.directCaller))){
 const targets=new Set(events.filter(e=>e.directCaller===pc).map(e=>e.directCallee));assert.equal(targets.size,1);const callee=[...targets][0];
 const rva=pc-5-0x400000,s=sections.find(s=>s.rva<=rva&&rva+5<=s.rva+s.size);assert.ok(s);
 const raw=Buffer.from(await pe.readAt(s.offset+rva-s.rva,5));assertMallocCallInstruction(pc,callee,raw);
 callSites.push({returnPc:pc,callee,instructionSha256:sha(raw)});
}
let next=0;
for(const capture of captures.filter(c=>c.stage==='after-exit')){
 while(next<events.length&&events[next].position<capture.position){const e=events[next++];if(e.op==='alloc')live.set(e.address,e);else live.delete(e.address);}
 const targets=capture.heap.records.filter(r=>r.kind===0&&r.requestedBytes===4096),groups=new Map();
 const matched=targets.filter(r=>live.has(r.address));for(const r of matched){const pc=live.get(r.address).directCaller;groups.set(pc,(groups.get(pc)??0)+1);}
 pageVisits.push({visit:capture.visit,region:m.coordinateRoute[capture.visit],blocks:targets.length,bytes:targets.length*4096,
  matchedObservedAllocations:matched.length,unknownOrigins:targets.length-matched.length,matchedCallSites:[...groups].map(([returnPc,count])=>({returnPc,count}))});
}
for(const v of saved.visits)for(const state of [v.before,v.after])evidence[state.filename]=state.sha256;
for(const n of [m.script,m.log])evidence[n]=await hash(n);
const sourceSha256={};for(const n of ['scripts/inspect-native-coordinate-multiway.mjs','scripts/lib/auto-multiway-region-load.mjs','scripts/lib/requested-region-cycles.mjs','scripts/lib/multiway-coordinate-travel.mjs','scripts/check-native-world-heap.mjs','scripts/check-native-page-sites.mjs'])sourceSha256[n]=await hash(join(workspace,n));
const result={version:1,multiWayNativeCoordinateTravelQualified:true,coordinateDrivenNativeTrialQualified:true,sourceSha256,automaticOriginalRegionLifecycleQualified:true,requestDrivenOriginalRegionLifecycleQualified:true,actualRegisteredHeroSameProcessRegionReturnQualified:true,actualSavedKingdomHeapMetadataQualified:true,
 scope:`${visitCount} coordinate-driven visits through ${new Set(m.coordinateRoute).size} actual kingdoms preserve compared saved state and original disposal. ${visitCount*3} bounded heap metadata captures reconcile with saved clocks, CRT accounting and teardown totals. Observed 4096-byte origins reconcile to original CALL bytes. Other allocation growth and sustained native/browser bounds remain unqualified.`,
 sourceManifest:saved.sourceManifest,sourceManifestSha256:saved.sourceManifestSha256,nativeExecutableSha256:m.nativeExecutableSha256,
 nativeSourceSha256:m.nativeSourceSha256,nativeHeapRuntimeSourceSha256:m.nativeHeapRuntimeSourceSha256,
 savedKingdomEvidence:saved,captures:captures.map(({heap:{records,...heap},position,...c})=>({...c,heap})),comparisons,
 pageAllocationEvents:events.length,pageCallSites:callSites,pageVisits,evidenceSha256:evidence,
 sustainedNativeMemoryBoundQualified:false,browserMemoryBoundQualified:false,safeEvictionQualified:false,browserUsed:false,nativeProcessesStarted:0,
 scriptSha256:await hash(new URL(import.meta.url))};
await writeFile(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({actualSavedKingdomHeapMetadataQualified:true,captures:visitCount*3,comparisons,pageAllocationEvents:events.length,pageVisits}));
