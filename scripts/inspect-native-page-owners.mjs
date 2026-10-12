#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {parsePageEvents} from './check-native-page-sites.mjs';
import {parsePageContexts,assertQueueCallInstruction} from './check-native-page-context.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const hash=async n=>(await hashNativeFile(n)).sha256;
async function bounded(n,cap){const s=await stoppedFileSource(n);assert.ok(s.size<=cap);const b=Buffer.alloc(s.size);
 for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;}
export function parsePageOwners(log,events,contexts){
 const parents=[...log.matchAll(/^\[streaming\] World page-parent queue=([0-9a-f]{8}) parent=([0-9a-f]{8}) global=([0-9a-f]{8}) vtable=([0-9a-f]{8}) bytes=(\d+) lock=([0-9a-f]{8}) reference=([0-9a-f]{8}) message=([0-9a-f]{8}) admitted=([01]) result=pass$/gm)];
 assert.equal(parents.length,contexts.length);assert.equal((log.match(/^\[streaming\] World page-parent /gm)||[]).length,parents.length);
 const activeParents=new Map();
 parents.forEach((t,i)=>{const c=contexts[i],e=events.find(e=>e.event===c.event),hex=n=>parseInt(t[n],16),p=hex(2);
  assert.equal(hex(1),c.queue);assert.equal(hex(3),p);assert.equal(hex(4),0x682bc4);assert.equal(Number(t[5]),696);
  assert.equal(hex(6),p+0x138);assert.equal(t[9],'1');assert.ok(t.index<e.position);
  assert.ok(p>=0x1000000&&p<0x10000000&&p%16===0);assert.ok(hex(7)>=0x1000000&&hex(7)<0x10000000&&hex(7)%4===0);
  assert.ok(hex(8)>=0x1000000&&hex(8)<0x10000000&&hex(8)%16===0);activeParents.set(c.event,p);
 });
 const keys='event visit stage buffer queue parent recipient queue-freed parent-freed queue-live parent-live count map capacity map-bytes map-live first-buffer last-buffer default-queue tree-head tree-count buffer-live result'.split(' ');
 const hex=new Set('buffer queue parent map first-buffer last-buffer default-queue tree-head'.split(' '));
 const rows=[...log.matchAll(/^\[streaming\] World page-owner .*$/gm)].map(t=>{
  const r={position:t.index};const tokens=t[0].slice('[streaming] World page-owner '.length).split(' ');assert.equal(tokens.length,keys.length);
  tokens.forEach((v,i)=>{const p=v.indexOf('=');assert.equal(v.slice(0,p),keys[i]);const value=v.slice(p+1),k=keys[i];
   if(k==='stage'||k==='result')r[k]=value;else {assert.match(value,hex.has(k)?/^[0-9a-f]{8}$/:/^\d+$/);r[k]=parseInt(value,hex.has(k)?16:10);assert.ok(Number.isSafeInteger(r[k])&&r[k]<=0xffffffff);}});
  assert.equal(r.result,'pass');assert.ok(['allocation','load','before-exit','after-exit','before-queue-free','before-parent-free'].includes(r.stage));
  for(const k of ['queue-freed','parent-freed','queue-live','parent-live','map-live','buffer-live'])assert.ok(r[k]===0||r[k]===1);
  assert.equal(r['buffer-live'],1);assert.equal(r['queue-live'],1-r['queue-freed']);assert.equal(r['parent-live'],1-r['parent-freed']);
  assert.ok(r.buffer>=0x1000000&&r.buffer<0x10000000&&r.buffer%16===0);assert.ok(r.queue%16===0&&r.parent%16===0);
  if(!r['queue-live'])assert.deepEqual([r.count,r.map,r.capacity,r['map-bytes'],r['map-live'],r['first-buffer'],r['last-buffer']],[0,0,0,0,0,0,0]);
  if(!r['parent-live'])assert.deepEqual([r['default-queue'],r['tree-head'],r['tree-count']],[0,0,0]);
  assert.equal(r['map-live'],Number(r['queue-live']&&r.capacity>0&&r.capacity<=4096&&r.capacity<=Math.floor(r['map-bytes']/4)));
  if(!r['map-live'])assert.deepEqual([r['first-buffer'],r['last-buffer']],[0,0]);
  return r;
 });assert.ok(rows.length>0&&rows.length<=1024);
 const byEvent=new Map(contexts.map(c=>[c.event,c])),live=new Map(),identities=new Map();
 const actions=[...events.map(e=>({...e,kind:'page'})),...rows.map(r=>({...r,kind:'owner'}))].sort((a,b)=>a.position-b.position);
 for(const r of actions){
  if(r.kind==='page'){if(r.op==='alloc'){if(byEvent.has(r.event))live.set(r.address,{event:r.event,queue:byEvent.get(r.event).queue,parent:0,recipient:0,queueFreed:0,parentFreed:0});}else live.delete(r.address);continue;}
  const e=live.get(r.buffer);assert.ok(e,'Owner sample has no observed live allocation');assert.equal(e.event,r.event);assert.equal(e.queue,r.queue);
  if(r.stage==='allocation'){
   assert.equal(e.parent,0);e.parent=r.parent;e.recipient=r.recipient;
   const c=byEvent.get(e.event);assert.equal(c.pushCaller,0x5a4e12);assert.equal(c.prefix,0x41);assert.equal(c.count,0);
   assert.equal(r.parent,activeParents.get(e.event));
   assert.deepEqual([r.count,r.map,r.capacity,r['map-bytes'],r['map-live'],r['first-buffer'],r['last-buffer']],[c.count,c.map,c.capacity,c.mapBytes,c.mapLive,c.firstBuffer,c.lastBuffer]);
   const p=events.find(v=>v.event===e.event);assert.equal(r.visit,p.exits);assert.ok(c.position<r.position);
   identities.set(e.event,{event:e.event,buffer:r.buffer,queue:r.queue,parent:r.parent,recipient:r.recipient,allocationVisit:r.visit});
  }
  assert.ok(e.parent);assert.equal(r.parent,e.parent);assert.equal(r.recipient,e.recipient);
  assert.equal(r['queue-freed'],e.queueFreed);assert.equal(r['parent-freed'],e.parentFreed);
  if(r.stage==='before-queue-free')for(const q of live.values())if(q.queue===r.queue)q.queueFreed=1;
  if(r.stage==='before-parent-free')for(const q of live.values())if(q.parent===r.parent)q.parentFreed=1;
 }
 assert.equal(identities.size,contexts.length);assert.equal(new Set([...identities.values()].map(r=>r.parent)).size,1);
 const captures=[];
 for(let visit=0;visit<4;visit++)for(const stage of ['load','before-exit','after-exit']){
  const marker=log.indexOf(`[streaming] World allocator visit=${visit} stage=${stage} `);assert.ok(marker>=0);
  const actual=rows.filter(r=>r.visit===visit&&r.stage===stage),expected=new Map();
  for(const e of events){if(e.position>=marker)break;if(e.op==='alloc'){if(byEvent.has(e.event))expected.set(e.address,e.event);}else expected.delete(e.address);}
  assert.deepEqual(actual.map(r=>[r.buffer,r.event]).sort(),[...expected].sort());
  assert.ok(actual.every(r=>r.position<marker));
  if(stage==='before-exit'||stage==='after-exit')for(const r of actual){
   assert.deepEqual([r['queue-live'],r['parent-live'],r.count,r['map-live'],r['map-bytes'],r.capacity],[1,1,1,1,8,2]);
   assert.equal(r['first-buffer'],r.buffer);assert.equal(r['last-buffer'],r.buffer);
  }
  if(visit<3||stage!=='after-exit'){const next=log.indexOf('[streaming] World allocator ',marker+1);if(next>=0)assert.ok(actual.every(r=>r.position<next));}
  captures.push({visit,stage,rows:actual});
 }
 return {identities:[...identities.values()],samples:rows,captures,queueFreeSamples:rows.filter(r=>r.stage==='before-queue-free'),parentFreeSamples:rows.filter(r=>r.stage==='before-parent-free')};
}
export async function inspectPageOwners(heapName){
 const raw=await bounded(heapName,512*1024),h=JSON.parse(raw);assert.equal(h.actualSavedKingdomHeapMetadataQualified,true);
 assert.equal(h.actualRegisteredHeroSameProcessRegionReturnQualified,true);assert.equal(h.scriptSha256,await hash(join(workspace,'scripts/inspect-native-hero-region-heap.mjs')));
 const manifest=await bounded(h.sourceManifest,256*1024);assert.equal(sha(manifest),h.sourceManifestSha256);const m=JSON.parse(manifest);
 assert.deepEqual([m.worldPageContextProbe,m.worldPageOwnerVersion],[true,1]);const build=JSON.parse(await bounded(m.buildReport,256*1024));
 assert.equal(await hash(m.buildReport),m.buildReportSha256);await verifyConnectedNativeArtifact(m,build);
 for(const [n,d]of Object.entries(h.evidenceSha256))assert.equal(await hash(n),d);
 const logRaw=await bounded(m.log,1024*1024);assert.equal(sha(logRaw),m.logSha256);const log=logRaw.toString('utf8');
 const events=parsePageEvents(log,4),contexts=parsePageContexts(log,events),owners=parsePageOwners(log,events,contexts);
 const auditName=join(workspace,'output/native-page-owner-lifetime-layout-001-observed.json'),auditRaw=await bounded(auditName,65536),a=JSON.parse(auditRaw);
 assert.deepEqual([a.qualified,a.savedCallerEsiOffset,a.savedCallerEdiOffset,a.messageReferenceOffset],[true,32,28,60]);
 assert.deepEqual([a.version,a.managerFinalVtable,a.recipientTreeCountOffset],[2,0x682bc4,0x58]);
 assert.equal(a.scriptSha256,await hash(join(workspace,'scripts/audit-native-page-owner-lifetime.py')));assert.equal(a.contradictoryInstructionControls.length,9);
 assert.ok(a.contradictoryInstructionControls.every(c=>c.refused));
 const peName=join(workspace,'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe');assert.equal(await hash(peName),a.originalExecutableSha256);
 const pe=await stoppedFileSource(peName),header=Buffer.from(await pe.readAt(0,4096)),at=header.readUInt32LE(60),n=header.readUInt16LE(at+6),opt=header.readUInt16LE(at+20);
 assert.ok(n>0&&n<=16);const sections=Array.from({length:n},(_,i)=>{const p=at+24+opt+i*40;return {rva:header.readUInt32LE(p+12),size:header.readUInt32LE(p+16),offset:header.readUInt32LE(p+20)};});
 for(const f of Object.values(a.fragments)){const rva=f.start-0x400000,s=sections.find(s=>s.rva<=rva&&rva+f.end-f.start<=s.rva+s.size);assert.ok(s);
  assert.equal(sha(await pe.readAt(s.offset+rva-s.rva,f.end-f.start)),f.sha256);}
 const pc=0x5a4e12,rva=pc-5-0x400000,s=sections.find(s=>s.rva<=rva&&rva+5<=s.rva+s.size);assertQueueCallInstruction(pc,Buffer.from(await pe.readAt(s.offset+rva-s.rva,5)));
 const captures=[];
 for(const c of owners.captures){const hc=h.captures.find(v=>v.visit===c.visit&&v.stage===c.stage);assert.ok(hc);
  const heap=await bounded(hc.filename,m.heapMetadataMaximumBytes);assert.equal(sha(heap),hc.sha256);
  const addresses=new Set();for(let at=40;at<heap.length;at+=16)if(heap.readUInt32LE(at+8)===4096&&heap.readUInt32LE(at+12)===0)addresses.add(heap.readUInt32LE(at));
  assert.ok(c.rows.every(r=>addresses.has(r.buffer)));captures.push({...c,ordinaryPageBlocks:addresses.size});}
 return {version:1,actualSavedKingdomHeapMetadataQualified:true,observedMessageQueueOwnerQualified:true,
  scope:'Actual four-visit saved kingdoms and heap captures independently qualified. Audited active caller registers identify the message manager. Observed free events invalidate descriptors before subsequent bounded samples. Allocation identities and retained ordinary4096-byte buffers reconcile at all12 captures. Descriptor allocation lifetime and reciprocal iterator/map links qualify; current recipient-tree ownership is not observed. Safe retirement and sustained memory bounds remain unqualified.',
  rawWord54LoggingCorrection:'Native090 log label tree-count reads manager+54. The pinned constructor proves count at+58. Treat every reported tree-count solely as a raw word; no count or recipient-tree membership is qualified.',
  heapReport:resolve(heapName),heapReportSha256:sha(raw),sourceManifest:h.sourceManifest,sourceManifestSha256:h.sourceManifestSha256,
  nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,...owners,captures,
  evidenceSha256:{[auditName]:sha(auditRaw),[m.log]:sha(logRaw)},safeQueueRetirementQualified:false,sustainedNativeMemoryBoundQualified:false,
  browserMemoryBoundQualified:false,browserUsed:false,nativeProcessesStarted:0,scriptSha256:await hash(new URL(import.meta.url))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);const r=await inspectPageOwners(name);
 await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({observedMessageQueueOwnerQualified:true,identities:r.identities.length,samples:r.samples.length,
  queueFrees:r.queueFreeSamples.length,parentFrees:r.parentFreeSamples.length,afterExit:r.captures.filter(c=>c.stage==='after-exit').map(c=>({visit:c.visit,blocks:c.ordinaryPageBlocks,queues:c.rows.map(r=>({queue:r.queue,recipient:r.recipient,count:r.count,freed:r['queue-freed'],parentLive:r['parent-live']}))}))}));
}
