#!/usr/bin/env node
// Observe the growing size group through the existing delegating CRT/free hooks.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyBufferCache} from './check-native-buffer-cache.mjs';
import {parseMallocAllocationEvents,assertMallocCallInstruction} from './check-native-malloc-sites.mjs';
import {parseHeapMetadata} from './check-native-world-heap.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function parsePageEvents(log,visits) {
  const rows=[...log.matchAll(/^\[streaming\] World page .*$/gm)];
  const setup=rows.filter(r=>r[0]==='[streaming] World page observer target=0064d5dd heap-requested=4096 event-limit=1024 installed=1 result=pass');assert.equal(setup.length,1);
  const originals=rows.filter(r=>r[0].startsWith('[streaming] World page event='));
  assert.equal(rows.length,originals.length+1);assert.ok(originals.length<=1024);
  for(const row of originals)if(row[0].includes('heap-requested='))assert.match(row[0],/heap-requested=4096 /);
  if(!originals.length)return [];
  // The independently tested caller/ordinal parser is size-invariant. Project
  // only this observer's lines into its target class, restoring real inputs and
  // original log positions afterwards. No other trace lines enter the projection.
  const projected=rows.map(r=>r[0].replace('World page ','World allocation ')
    .replace('heap-requested=4096','heap-requested=12208')
    .replace(/input=(\d+)/,(_,n)=>`input=${Number(n)+8112}`)).join('\n');
  const events=parseMallocAllocationEvents(projected,visits);assert.equal(events.length,originals.length);
  return events.map((e,i)=>({...e,position:originals[i].index,...(e.op==='alloc'?{input:e.input-8112}:{})}));
}
async function bounded(name,cap) {
  const s=await stoppedFileSource(name);assert.ok(s.size<=cap);const bytes=Buffer.alloc(s.size);
  for(let at=0;at<bytes.length;at+=4096)bytes.set(await s.readAt(at,Math.min(4096,bytes.length-at)),at);
  return bytes;
}
export async function verifyPageSites(name) {
  const base=await verifyBufferCache(name),m=JSON.parse(await bounded(name,65536));
  assert.deepEqual([m.worldPageAllocationProbe,m.pageObservationFunction,m.pageTargetRequestedBytes,m.pageEventLimit,m.firstWorldLoadPageAllocationObserved],[true,0x64d5dd,4096,1024,false]);
  const logBytes=await bounded(m.log,1024*1024);assert.equal(sha(logBytes),base.evidenceSha256[m.log]);const log=logBytes.toString('utf8');
  const count=base.captures.length/3,events=parsePageEvents(log,count),callers=[],visits=[];
  const original=await stoppedFileSource(join(workspace,'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'));
  const h=Buffer.from(await original.readAt(0,4096)),pe=h.readUInt32LE(60),n=h.readUInt16LE(pe+6),opt=h.readUInt16LE(pe+20);
  assert.equal(h.readUInt32LE(pe+52),0x400000);assert.ok(n>0&&n<=16);
  const sections=Array.from({length:n},(_,i)=>{const at=pe+24+opt+i*40;return {rva:h.readUInt32LE(at+12),bytes:h.readUInt32LE(at+16),offset:h.readUInt32LE(at+20)};});
  for(const pc of [...new Set(events.filter(e=>e.op==='alloc'&&e.directCaller).map(e=>e.directCaller))]) {
    const expected=[...new Set(events.filter(e=>e.directCaller===pc).map(e=>e.directCallee))];assert.equal(expected.length,1);
    const rva=pc-5-0x400000,section=sections.find(s=>s.rva<=rva&&rva+5<=s.rva+s.bytes);assert.ok(section);
    const bytes=Buffer.from(await original.readAt(section.offset+rva-section.rva,5));assertMallocCallInstruction(pc,expected[0],bytes);
    callers.push({returnPc:pc,callInstruction:pc-5,callee:expected[0],instructionSha256:sha(bytes),allocations:events.filter(e=>e.op==='alloc'&&e.directCaller===pc).length});
  }
  let at=0;const observed=new Map();
  for(let visit=0;visit<count;++visit) {
    const position=log.indexOf(`[streaming] World heap visit=${visit} stage=after-exit `);assert.ok(position>=0);
    while(at<events.length&&events[at].position<position) {const e=events[at++];if(e.op==='alloc')observed.set(e.address,e);else observed.delete(e.address);}
    const filename=join(m.profile,`Heap_Visit_${visit}_after-exit.bin`),bytes=await bounded(filename,131112);assert.equal(sha(bytes),base.evidenceSha256[filename]);
    const heap=parseHeapMetadata(bytes,visit,'after-exit'),targets=heap.records.filter(r=>r.kind===0&&r.requestedBytes===4096),matches=targets.flatMap(r=>observed.has(r.address)?[{address:r.address,...observed.get(r.address)}]:[]),groups=new Map();
    for(const e of matches)groups.set(e.directCaller,(groups.get(e.directCaller)||0)+1);
    visits.push({visit,region:visit%2?0:1,targetBlocks:targets.length,targetBytes:targets.length*4096,addresses:targets.map(r=>r.address),matchingObservedAllocations:matches.length,unmatchedBlocks:targets.length-matches.length,matchedCallSites:[...groups].map(([directCaller,count])=>({directCaller,count})),matches});
  }
  return {qualified:true,scope:'Original persisted state, completed checkpoints, heap metadata and buffer/cache gates requalified. The existing delegating CRT observer additionally links surviving 4096-byte blocks to bounded allocation/free events and independently pinned outer CALL instructions. Partial coverage excludes the first load and unobserved realloc/calloc/non-CRT paths. Matching addresses and call sites do not establish ownership, safe cleanup or bounded memory.',
    sourceManifest:base.sourceManifest,sourceManifestSha256:base.sourceManifestSha256,nativeExecutableSha256:base.nativeExecutableSha256,
    observedOriginalPageCallSitesQualified:true,events,callers,visits,nativeResourceSampling:base.nativeResourceSampling,
    originalPerVisitSaveAndRevisitQualified:true,completedTickCheckpointBoundaryQualified:true,
    pageAllocationOriginsQualified:false,allocationOwnershipQualified:false,safeCacheEvictionQualified:false,originalBoundedRegionResidencyQualified:false,wholeBrowserMemoryBoundQualified:false,generatedAdjacentTerrainQualified:false,continuousTravelQualified:false,coopRegionHandoffQualified:false,browserUsed:false,nativeProcessesStarted:0,
    sourceSha256:{...base.sourceSha256,'scripts/check-native-page-sites.mjs':sha(await readFile(new URL(import.meta.url)))},evidenceSha256:base.evidenceSha256};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
  const r=await verifyPageSites(name);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,events:r.events.length,callers:r.callers,visits:r.visits.map(({visit,targetBlocks,matchingObservedAllocations,unmatchedBlocks,matchedCallSites})=>({visit,targetBlocks,matchingObservedAllocations,unmatchedBlocks,matchedCallSites}))}));
}
