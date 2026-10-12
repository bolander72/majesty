#!/usr/bin/env node
// Locate persistent 4 KiB guest allocations without attributing an unobserved origin.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyBufferCache} from './check-native-buffer-cache.mjs';
import {parseHeapMetadata} from './check-native-world-heap.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
const base=await verifyBufferCache(name),m=JSON.parse(await readFile(name)),visits=[];
let previous=new Set();
for(const capture of base.captures.filter(c=>c.stage==='after-exit')) {
  const filename=join(m.profile,`Heap_Visit_${capture.visit}_after-exit.bin`),source=await stoppedFileSource(filename);
  assert.ok(source.size<=131112);const bytes=Buffer.alloc(source.size);
  for(let at=0;at<bytes.length;at+=4096)bytes.set(await source.readAt(at,Math.min(4096,bytes.length-at)),at);
  assert.equal(sha(bytes),base.evidenceSha256[filename]);
  const heap=parseHeapMetadata(bytes,capture.visit,'after-exit');
  const addresses=heap.records.filter(r=>r.kind===0&&r.requestedBytes===4096).map(r=>r.address),current=new Set(addresses);
  const added=addresses.filter(a=>!previous.has(a)),removed=[...previous].filter(a=>!current.has(a));
  visits.push({visit:capture.visit,region:capture.visit%2?0:1,count:addresses.length,bytes:addresses.length*4096,addresses,added,removed});
  previous=current;
}
const first=visits[0],last=visits.at(-1),r={qualified:true,
  scope:'Complete actual heap metadata and original persistence/checkpoint/cache gates requalified. Address-set differences identify a retained4096-byte allocation group across world teardowns. An unchanged address does not prove allocation identity without its allocation/free events. No payload inspection, origin attribution or eviction.',
  sourceManifest:base.sourceManifest,sourceManifestSha256:base.sourceManifestSha256,nativeExecutableSha256:base.nativeExecutableSha256,
  observedRetainedPageAddressSetsQualified:true,visits,countDrift:last.count-first.count,byteDrift:last.bytes-first.bytes,
  addressRemovalsObserved:visits.slice(1).reduce((n,v)=>n+v.removed.length,0),pageAllocationOriginsQualified:false,
  originalBoundedRegionResidencyQualified:false,wholeBrowserMemoryBoundQualified:false,browserUsed:false,nativeProcessesStarted:0,
  sourceSha256:{...base.sourceSha256,'scripts/check-native-retained-pages.mjs':sha(await readFile(new URL(import.meta.url)))},evidenceSha256:base.evidenceSha256};
await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,countDrift:r.countDrift,byteDrift:r.byteDrift,addressRemovalsObserved:r.addressRemovalsObserved,visits:visits.map(({visit,count,added,removed})=>({visit,count,added:added.length,removed:removed.length}))}));
