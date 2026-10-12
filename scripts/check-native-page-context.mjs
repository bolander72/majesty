#!/usr/bin/env node
// Active queue-call context only; no inference of lifetime after function return.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyPageSites} from './check-native-page-sites.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function assertQueueCallInstruction(pc,bytes) {
  assert.equal(bytes.length,5);assert.equal(bytes[0],0xe8);
  assert.equal((pc+bytes.readInt32LE(1))>>>0,0x49ff10);
}
export function parsePageContexts(log,events) {
  const pattern=/^\[streaming\] World page-context event=(\d+) queue=([0-9a-f]{8}) push-caller=([0-9a-f]{8}) prefix=([0-9a-f]{8}) count=(\d+) map=([0-9a-f]{8}) capacity=(\d+) map-bytes=(\d+) map-live=([01]) first-node=([0-9a-f]{8}) last-node=([0-9a-f]{8}) first-buffer=([0-9a-f]{8}) last-buffer=([0-9a-f]{8}) first-live=([01]) last-live=([01]) result=pass$/gm;
  const matches=[...log.matchAll(pattern)],expected=events.filter(e=>e.op==='alloc'&&e.directCaller===0x4a009a&&e.directCallee===0x64c616);
  assert.equal((log.match(/^\[streaming\] World page-context\b/gm)||[]).length,matches.length);assert.equal(matches.length,expected.length);
  const contexts=[];
  for(const [i,t]of matches.entries()) {
    const e=expected[i];assert.equal(Number(t[1]),e.event);assert.ok(e.position<t.index);
    const next=events.find(v=>v.event>e.event);if(next)assert.ok(t.index<next.position);
    const hex=n=>parseInt(t[n],16),num=n=>Number(t[n]);
    const r={event:e.event,address:e.address,loads:e.loads,exits:e.exits,clock:e.clock,queue:hex(2),pushCaller:hex(3),prefix:hex(4),count:num(5),map:hex(6),capacity:num(7),mapBytes:num(8),mapLive:num(9),firstNode:hex(10),lastNode:hex(11),firstBuffer:hex(12),lastBuffer:hex(13),firstLive:num(14),lastLive:num(15),position:t.index};
    assert.ok(r.queue>=0x01000004&&r.queue<0x10000000&&r.queue%4===0);
    assert.ok(r.pushCaller>=0x00401000&&r.pushCaller<0x0067f000);
    assert.ok(!r.map||(r.map>=0x01000000&&r.map<0x10000000&&r.map%16===0));
    assert.ok(r.mapBytes<=0x0f000000);if(!r.map)assert.equal(r.mapBytes,0);
    for(const value of [r.count,r.capacity])assert.ok(Number.isSafeInteger(value)&&value<=0xffffffff);
    if(r.mapBytes)assert.ok(r.map+r.mapBytes<=0x10000000);
    assert.equal(r.mapLive,Number(r.capacity>0&&r.capacity<=4096&&r.capacity<=Math.floor(r.mapBytes/4)));
    for(const [node,buffer,live]of [[r.firstNode,r.firstBuffer,r.firstLive],[r.lastNode,r.lastBuffer,r.lastLive]]) {
      const readable=r.mapLive&&node%4===0&&node>=r.map&&node-r.map<=r.mapBytes-4;
      if(!readable)assert.deepEqual([buffer,live],[0,0]);
      if(buffer)assert.ok(buffer>=0x01000000&&buffer<0x10000000&&buffer%16===0);else assert.equal(live,0);
    }
    contexts.push(r);
  }
  return contexts;
}
async function bounded(name,cap) {
  const s=await stoppedFileSource(name);assert.ok(s.size<=cap);const b=Buffer.alloc(s.size);
  for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;
}
export async function verifyPageContext(name) {
  const base=await verifyPageSites(name),m=JSON.parse(await bounded(name,65536));
  assert.deepEqual([m.worldPageContextProbe,m.pageContextLayoutVersion,m.pageQueueFunction,m.pageQueueAllocationReturn,m.pageQueueCallerStackOffset],[true,1,0x49ff10,0x4a009a,56]);
  const logBytes=await bounded(m.log,1024*1024);assert.equal(sha(logBytes),base.evidenceSha256[m.log]);const contexts=parsePageContexts(logBytes.toString('utf8'),base.events);
  const s=await stoppedFileSource(join(workspace,'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'));
  const h=Buffer.from(await s.readAt(0,4096)),pe=h.readUInt32LE(60),n=h.readUInt16LE(pe+6),opt=h.readUInt16LE(pe+20);
  assert.equal(h.readUInt32LE(pe+52),0x400000);assert.ok(n>0&&n<=16);
  const sections=Array.from({length:n},(_,i)=>{const at=pe+24+opt+i*40;return {rva:h.readUInt32LE(at+12),bytes:h.readUInt32LE(at+16),offset:h.readUInt32LE(at+20)};});
  async function code(start,bytes) {const rva=start-0x400000,p=sections.find(s=>s.rva<=rva&&rva+bytes<=s.rva+s.bytes);assert.ok(p);return Buffer.from(await s.readAt(p.offset+rva-p.rva,bytes));}
  const auditName=join(workspace,'output/native-page-queue-layout-observed.json'),auditBytes=await bounded(auditName,65536),a=JSON.parse(auditBytes);
  assert.deepEqual([a.qualified,a.version,a.queueFunction,a.queueCallerStackOffset,a.queueLocalBytes,a.queueSavedRegisterBytes,a.crtFrameBytes],[true,1,0x49ff10,56,16,12,28]);
  assert.equal(a.originalExecutableSha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
  assert.equal(a.scriptSha256,sha(await bounded(join(workspace,'scripts/audit-native-page-queue.py'),65536)));
  assert.deepEqual(Object.keys(a.fragments),['queuePrologue','queueEmptyAllocation']);
  for(const [key,start,end]of [['queuePrologue',0x49ff10,0x49ff39],['queueEmptyAllocation',0x4a0090,0x4a0108]]) {
    assert.deepEqual([a.fragments[key].start,a.fragments[key].end],[start,end]);assert.equal(sha(await code(start,end-start)),a.fragments[key].sha256);
  }
  assert.equal(a.contradictoryInstructionControls.length,2);assert.ok(a.contradictoryInstructionControls.every(c=>c.refused));
  const callers=[];
  for(const pc of [...new Set(contexts.map(c=>c.pushCaller))]) {
    const bytes=await code(pc-5,5);assertQueueCallInstruction(pc,bytes);
    callers.push({returnPc:pc,callInstruction:pc-5,callee:0x49ff10,instructionSha256:sha(bytes),contexts:contexts.filter(c=>c.pushCaller===pc).length});
  }
  const visits=base.visits.map(v=>({...v,queueMatches:v.matches.filter(e=>e.directCaller===0x4a009a).map(e=>{
    const c=contexts.find(c=>c.event===e.event);assert.ok(c);return {address:e.address,event:e.event,queue:c.queue,pushCaller:c.pushCaller,prefix:c.prefix,countBeforeAllocation:c.count,mapLiveBeforeAllocation:c.mapLive,lastBuffer:c.lastBuffer,lastBufferLiveBeforeAllocation:c.lastLive};
  })}));
  return {qualified:true,scope:'Actual persistence/checkpoint/heap/cache/page gates requalified. Audited active queue frames identify outer callers and bounded pre-allocation queue/map metadata for each observed004a0095 allocation. Surviving addresses link to those contexts. No logical queue lifetime after return, ownership after world disposal, or safe cleanup is established.',
    sourceManifest:base.sourceManifest,sourceManifestSha256:base.sourceManifestSha256,nativeExecutableSha256:base.nativeExecutableSha256,
    observedQueueAllocationContextQualified:true,events:base.events,contexts,callers,visits,nativeResourceSampling:base.nativeResourceSampling,
    originalPerVisitSaveAndRevisitQualified:true,completedTickCheckpointBoundaryQualified:true,
    queueRetirementQualified:false,pageAllocationOriginsQualified:false,allocationOwnershipQualified:false,originalBoundedRegionResidencyQualified:false,wholeBrowserMemoryBoundQualified:false,continuousTravelQualified:false,coopRegionHandoffQualified:false,browserUsed:false,nativeProcessesStarted:0,
    sourceSha256:{...base.sourceSha256,'scripts/audit-native-page-queue.py':sha(await bounded(join(workspace,'scripts/audit-native-page-queue.py'),65536)),'scripts/check-native-page-context.mjs':sha(await readFile(new URL(import.meta.url)))},evidenceSha256:{...base.evidenceSha256,[auditName]:sha(auditBytes)}};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
  const r=await verifyPageContext(name);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,contexts:r.contexts.length,callers:r.callers,retained:r.visits.map(({visit,queueMatches})=>({visit,queueMatches}))}));
}
