#!/usr/bin/env node
// Actual allocator events and surviving addresses; call sites do not prove ownership.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyCompletedCheckpoint} from './check-native-completed-checkpoint.mjs';
import {parseHeapMetadata} from './check-native-world-heap.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function parseMallocAllocationEvents(log,visitCount) {
  const setup=[...log.matchAll(/^\[streaming\] World allocation observer target=0064d5dd heap-requested=12208 event-limit=1024 installed=1 result=pass$/gm)];assert.equal(setup.length,1);
  assert.equal(log.split('[streaming] World allocation observer ').length-1,1);
  const pattern=/^\[streaming\] World allocation event=(\d+) op=(alloc|free) address=([0-9a-f]{8}) (?:input=(\d+) heap-requested=12208 return-pc=([0-9a-f]{8}) direct-caller=([0-9a-f]{8}) direct-callee=([0-9a-f]{8}) )?loads=(\d+) exits=(\d+) clock=(\d+)(?: freed=1)? result=pass$/gm;
  const matches=[...log.matchAll(pattern)];assert.ok(matches.length>0&&matches.length<=1024);
  assert.equal((log.match(/^\[streaming\] World allocation event=/gm)||[]).length,matches.length,'Malformed/extra allocation event');
  const events=[];
  for(const [i,row] of matches.entries()) {
    assert.equal(Number(row[1]),i+1);assert.ok(row.index>setup[0].index);
    const address=parseInt(row[3],16),loads=Number(row[8]),exits=Number(row[9]),clock=Number(row[10]);
    assert.ok(address>=0x01000000&&address<0x10000000&&address%16===0);assert.ok(loads>=0&&loads<=visitCount&&exits>=0&&exits<=loads&&loads-exits<=1);
    if(events.length)assert.ok(loads>=events.at(-1).loads&&exits>=events.at(-1).exits,'Visit counters moved backwards');
    const event={event:i+1,op:row[2],address,loads,exits,clock,position:row.index};
    if(event.op==='alloc') {
      assert.ok(row[4]!==undefined&&Number(row[4])>=12193&&Number(row[4])<=12208);
      assert.ok(!row[0].includes('freed='));event.input=Number(row[4]);event.returnPc=parseInt(row[5],16);event.directCaller=parseInt(row[6],16);event.directCallee=parseInt(row[7],16);
      assert.ok(event.returnPc>=0x00401000&&event.returnPc<0x0067f000);
      if(event.directCaller) {assert.ok([0x64c616,0x64d59f].includes(event.directCallee));assert.equal(event.returnPc,0x0064d5c1);assert.ok(event.directCaller>=0x00401000&&event.directCaller<0x0067f000);}
    assert.equal(Boolean(event.directCaller),Boolean(event.directCallee));
    } else {assert.equal(row[4],undefined);assert.ok(row[0].endsWith('freed=1 result=pass'));}
    events.push(event);
  }
  return events;
}
async function peReader() {
  const s=await stoppedFileSource(join(workspace,'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'));
  const h=Buffer.from(await s.readAt(0,4096)),pe=h.readUInt32LE(60),count=h.readUInt16LE(pe+6),optional=h.readUInt16LE(pe+20),base=h.readUInt32LE(pe+52);
  assert.equal(base,0x400000);assert.ok(count>0&&count<=16);
  const sections=Array.from({length:count},(_,i)=>{const at=pe+24+optional+i*40;return {rva:h.readUInt32LE(at+12),bytes:h.readUInt32LE(at+16),offset:h.readUInt32LE(at+20)};});
  return async(start,n)=>{const rva=start-base,section=sections.find(s=>s.rva<=rva&&rva+n<=s.rva+s.bytes);assert.ok(section);return Buffer.from(await s.readAt(section.offset+rva-section.rva,n));};
}
export function assertMallocCallInstruction(pc,callee,bytes) {
  assert.ok([0x64c616,0x64d59f].includes(callee));assert.equal(bytes.length,5);
  assert.equal(bytes[0],0xe8,'Outer caller is not a pinned direct CALL');
  assert.equal((pc+bytes.readInt32LE(1))>>>0,callee);
}
export async function verifyMallocAllocationSites(manifestName) {
  const boundary=await verifyCompletedCheckpoint(manifestName),m=JSON.parse(await readFile(manifestName));
  assert.equal(m.worldAllocationProbe,true);assert.equal(m.allocationObservationFunction,0x64d5dd);assert.equal(m.allocationTargetRequestedBytes,12208);assert.equal(m.allocationEventLimit,1024);assert.equal(m.firstWorldLoadAllocationObserved,false);
  assert.equal(m.allocationCallerLayoutVersion,2);
  const logBytes=await readFile(m.log);assert.ok(logBytes.length<=1024*1024);assert.equal(sha(logBytes),boundary.evidenceSha256[m.log]);const log=logBytes.toString('utf8');
  const events=parseMallocAllocationEvents(log,boundary.visits.length),pe=await peReader();
  const auditName=join(workspace,'output/native-malloc-caller-layout-observed.json'),auditBytes=await readFile(auditName);assert.ok(auditBytes.length<=65536);const audit=JSON.parse(auditBytes);
  assert.equal(audit.qualified,true);assert.equal(audit.version,1);assert.equal(audit.originalExecutableSha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
  assert.equal(audit.scriptSha256,sha(await readFile(join(workspace,'scripts/audit-native-malloc-caller.py'))));
  assert.deepEqual(Object.keys(audit.fragments),['operatorNew','mallocWrapper','newHandlerMalloc','originalHeapAlloc']);
  for(const [name,start,end] of [['operatorNew',0x64c616,0x64c624],['mallocWrapper',0x64d59f,0x64d5b1],['newHandlerMalloc',0x64d5b1,0x64d5dd],['originalHeapAlloc',0x64d5dd,0x64d6d9]]) {
    assert.deepEqual([audit.fragments[name].start,audit.fragments[name].end],[start,end]);assert.equal(sha(await pe(start,end-start)),audit.fragments[name].sha256);
  }
  assert.equal(audit.contradictoryInstructionControls.length,4);assert.ok(audit.contradictoryInstructionControls.every(c=>c.refused===true));
  const callers=[];
  for(const pc of [...new Set(events.filter(e=>e.op==='alloc'&&e.directCaller).map(e=>e.directCaller))]) {
    const expected=[...new Set(events.filter(e=>e.directCaller===pc).map(e=>e.directCallee))];assert.equal(expected.length,1);
    const bytes=await pe(pc-5,5);assertMallocCallInstruction(pc,expected[0],bytes);
    callers.push({returnPc:pc,callInstruction:pc-5,callee:expected[0],instructionSha256:sha(bytes)});
  }
  const visits=[],evidence={...boundary.evidenceSha256,[auditName]:sha(auditBytes)};let at=0;const observed=new Map();
  for(const v of boundary.visits) {
    const line=`[streaming] World heap visit=${v.visit} stage=after-exit `,position=log.indexOf(line);assert.ok(position>=0);
    while(at<events.length&&events[at].position<position) {const e=events[at++];if(e.op==='alloc')observed.set(e.address,e);else observed.delete(e.address);}
    const filename=join(m.profile,`Heap_Visit_${v.visit}_after-exit.bin`),bytes=await readFile(filename);assert.ok(bytes.length<=40+8192*16);assert.equal(sha(bytes),evidence[filename]);
    const heap=parseHeapMetadata(bytes,v.visit,'after-exit');assert.equal(heap.clock,v.clock);
    const targets=heap.records.filter(r=>r.kind===0&&r.requestedBytes===12208),groups=new Map();let matched=0;
    for(const r of targets) {
      const e=observed.get(r.address);if(!e)continue;++matched;
      const pc=e.directCaller,key=String(pc),entry=groups.get(key)||{directCaller:pc,count:0,addresses:[]};++entry.count;entry.addresses.push(r.address);groups.set(key,entry);
    }
    visits.push({visit:v.visit,region:v.region,targetBlocks:targets.length,targetBytes:targets.length*12208,matchingObservedAllocations:matched,unmatchedBlocks:targets.length-matched,matchedCallSites:[...groups.values()].sort((a,b)=>b.count-a.count)});
  }
  return {qualified:true,scope:'Actual original persistence/completed-tick/heap gates requalified. Bounded delegating original CRT observations link exact rounded target blocks to allocation events and independently pinned outer operator_new/malloc calls when their stack layout matches. Partial coverage: first load, calloc/realloc and non-CRT paths are not all captured; matching surviving addresses does not establish current ownership or safe cleanup.',sourceManifest:boundary.sourceManifest,sourceManifestSha256:boundary.sourceManifestSha256,nativeExecutableSha256:boundary.nativeExecutableSha256,
    partialOriginalCrtAllocationObservationQualified:true,events,callers,visits,instructionControlsRefused:4,nativeResourceSampling:boundary.nativeResourceSampling,
    originalPerVisitSaveAndRevisitQualified:true,completedTickCheckpointBoundaryQualified:true,allocationOwnershipQualified:false,allNativeHeapAllocationOriginsQualified:false,originalBoundedRegionResidencyQualified:false,wholeBrowserMemoryBoundQualified:false,continuousTravelQualified:false,coopRegionHandoffQualified:false,browserUsed:false,nativeProcessesStarted:0,
    sourceSha256:{...boundary.sourceSha256,'scripts/check-native-malloc-sites.mjs':sha(await readFile(new URL(import.meta.url)))},evidenceSha256:evidence};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
 const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal manifest> <fresh report>');const r=await verifyMallocAllocationSites(name);
 await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,events:r.events.length,callers:r.callers,first:r.visits[0],last:r.visits.at(-1)}));
}
