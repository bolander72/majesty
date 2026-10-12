#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {parsePageEvents} from './check-native-page-sites.mjs';
import {parsePageContexts} from './check-native-page-context.mjs';
import {parsePageOwners} from './inspect-native-page-owners.mjs';
import {parsePageRegistrations} from './inspect-native-page-registration.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {verifyEntityOwnership} from '../web/world/entity-ownership.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),hash=async n=>(await hashNativeFile(n)).sha256;
async function bounded(n,cap){const s=await stoppedFileSource(n);assert.ok(s.size<=cap);const b=Buffer.alloc(s.size);
 for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;}
function rows(log,type,keys,hexKeys){const hex=new Set(hexKeys.split(' '));return [...log.matchAll(new RegExp(`^\\[streaming\\] World queue-release ${type} .*$`,'gm'))].map(t=>{
 const r={position:t.index},tokens=t[0].slice(`[streaming] World queue-release ${type} `.length).split(' '),names=keys.split(' ');assert.equal(tokens.length,names.length);
 tokens.forEach((v,i)=>{const at=v.indexOf('='),k=v.slice(0,at),x=v.slice(at+1);assert.equal(k,names[i]);
 if(k==='result')r[k]=x;else{assert.match(x,hex.has(k)?/^[0-9a-f]{8}$/:/^\d+$/);r[k]=parseInt(x,hex.has(k)?16:10);assert.ok(Number.isSafeInteger(r[k]));}});assert.equal(r.result,'pass');return r;});}
export function inspectQueueRetirementTrace(log,events,owners,registration){
 const candidates=rows(log,'candidate','visit event queue buffer parent recipient allocation-load current-load registered default-match map front message vtable message-bytes nested admitted result','queue buffer parent map front message vtable nested');
 const retired=rows(log,'retired','visit event queue buffer original-destructor original-delete empty buffer-freed map-freed descriptor-freed tree-same clock-same world-same hooks-same requested-before requested-after result','queue buffer original-destructor original-delete');
 const sweeps=rows(log,'sweep','visit observed retained eligible released clock hook-depth baton result','');
 assert.equal(sweeps.length,4);assert.equal(candidates.length,3);assert.equal(retired.length,3);
 assert.equal((log.match(/^\[streaming\] World queue-release /gm)||[]).length,sweeps.length+candidates.length+retired.length);
 const identities=new Map(owners.identities.map(e=>[e.event,e]));
 for(let visit=0;visit<4;visit++){
  const sweep=sweeps[visit];assert.deepEqual([sweep.visit,sweep.observed,sweep.retained,sweep.eligible,sweep.released,sweep['hook-depth'],sweep.baton],[visit,visit?2:1,1,visit?1:0,visit?1:0,0,1]);
  const checkpoint=log.indexOf(`[streaming] World checkpoint completed visit=${visit} `);assert.ok(sweep.position<checkpoint);
  const boundary=owners.captures.find(c=>c.visit===visit&&c.stage==='before-exit');assert.equal(boundary.rows.length,1);
  assert.ok(sweep.position<boundary.rows[0].position);
  const active=registration.captures.find(c=>c.visit===visit&&c.stage==='after-exit');assert.equal(active.rows.length,1);
  assert.deepEqual([active.rows[0]['queue-references'],active.rows[0]['default-match']],[1,0]);
  if(!visit)continue;
  const c=candidates[visit-1],r=retired[visit-1],id=identities.get(c.event);assert.ok(id);
  assert.deepEqual([c.visit,c['allocation-load'],c['current-load'],c.registered,c['default-match'],c.admitted],[visit,visit,visit+1,0,0,1]);
  for(const k of ['event','queue','buffer','parent','recipient'])assert.equal(c[k],id[k]);
  assert.equal(id.allocationVisit,visit-1);assert.ok(c.front>=c.buffer&&c.front-c.buffer<=4088&&c.front%8===0);
  assert.deepEqual([c.vtable,c['message-bytes']],[0x682d04,40]);for(const k of ['map','message','nested'])assert.ok(c[k]>=0x1000000&&c[k]<0x10000000&&c[k]%16===0);
  for(const k of ['visit','event','queue','buffer'])assert.equal(r[k],c[k]);assert.ok(c.position<r.position&&r.position<sweep.position);
  assert.deepEqual([r['original-destructor'],r['original-delete']],[0x497cf0,0x645bc0]);
  for(const k of ['empty','buffer-freed','map-freed','descriptor-freed','tree-same','clock-same','world-same','hooks-same'])assert.equal(r[k],1);
  assert.ok(r['requested-before']-r['requested-after']>=4096);
  const frees=events.filter(e=>e.op==='free'&&e.address===c.buffer&&c.position<e.position&&e.position<r.position);assert.equal(frees.length,1);
  const old=registration.samples.filter(t=>t.event===c.event&&t.position<c.position).at(-1);assert.ok(old);
  assert.deepEqual([old.visit,old.stage,old['queue-references'],old['default-match']],[visit,'load',0,0]);
  assert.equal(old['recipient-queue'],active.rows[0].queue);assert.notEqual(old['recipient-queue'],c.queue);
 }
 return {candidates,retired,sweeps};
}
export async function inspectQueueRetirement(heapName){
 const raw=await bounded(heapName,512*1024),h=JSON.parse(raw);assert.equal(h.actualSavedKingdomHeapMetadataQualified,true);assert.equal(h.actualRegisteredHeroSameProcessRegionReturnQualified,true);
 assert.equal(h.scriptSha256,await hash(join(workspace,'scripts/inspect-native-hero-region-heap.mjs')));
 const manifestRaw=await bounded(h.sourceManifest,256*1024);assert.equal(sha(manifestRaw),h.sourceManifestSha256);const m=JSON.parse(manifestRaw),build=JSON.parse(await bounded(m.buildReport,256*1024));
 assert.equal(m.orphanQueueReleaseVersion,'v1');assert.equal(m.worldPageRegistrationVersion,1);assert.equal(await hash(m.buildReport),m.buildReportSha256);await verifyConnectedNativeArtifact(m,build);
 for(const [n,d]of Object.entries(h.evidenceSha256))assert.equal(await hash(n),d);
 const logRaw=await bounded(m.log,1024*1024);assert.equal(sha(logRaw),m.logSha256);const log=logRaw.toString('utf8');
 const events=parsePageEvents(log,4),contexts=parsePageContexts(log,events),owners=parsePageOwners(log,events,contexts),registration=parsePageRegistrations(log,owners),retirement=inspectQueueRetirementTrace(log,events,owners,registration);
 const auditRaw=await bounded(m.orphanQueueReleaseAudit,65536);assert.equal(sha(auditRaw),m.orphanQueueReleaseAuditSha256);const a=JSON.parse(auditRaw);
 assert.deepEqual([a.qualified,a.version,a.originalMessageQueueDestructor,a.originalDescriptorDelete],[true,4,0x497cf0,0x645bc0]);
 assert.equal(a.scriptSha256,await hash(join(workspace,'scripts/audit-native-orphan-queue-retirement.py')));assert.equal(a.contradictoryInstructionControls.length,13);assert.ok(a.contradictoryInstructionControls.every(c=>c.refused));
 const peName=join(workspace,'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe');assert.equal(await hash(peName),a.originalExecutableSha256);
 const pe=await stoppedFileSource(peName),header=Buffer.from(await pe.readAt(0,4096)),at=header.readUInt32LE(60),count=header.readUInt16LE(at+6),opt=header.readUInt16LE(at+20);assert.ok(count>0&&count<=16);
 const sections=Array.from({length:count},(_,i)=>{const p=at+24+opt+i*40;return {rva:header.readUInt32LE(p+12),size:header.readUInt32LE(p+16),offset:header.readUInt32LE(p+20)};});
 for(const f of Object.values(a.fragments)){const rva=f.start-0x400000,s=sections.find(s=>s.rva<=rva&&rva+f.end-f.start<=s.rva+s.size);assert.ok(s);assert.equal(sha(await pe.readAt(s.offset+rva-s.rva,f.end-f.start)),f.sha256);}
 const receipt=JSON.parse(await bounded(m.receipt,256*1024));assert.equal(await hash(m.receipt),m.receiptSha256);
 const latest=[0,1].map(side=>join(m.profile,`Residency_Initial_${side}.GMP`)),posts=[],evidence={...h.evidenceSha256,[m.orphanQueueReleaseAudit]:sha(auditRaw)};
 for(let visit=0;visit<4;visit++){
  const side=visit%2,before=await connectedWorldState(join(m.profile,`Residency_Visit_${visit}_After.GMP`),{unscheduledAgents:side?[45]:[]});
  const post=await connectedWorldState(join(m.profile,`Residency_Visit_${visit}_PostQueueRelease.GMP`),{unscheduledAgents:side?[45]:[]});
  const comparison=compareConnectedWorlds(before,post);assert.equal(post.rawTerrainSha256,before.rawTerrainSha256);assert.equal(post.label,'Joint_Evolved');
  latest[side]=post.filename;
  await verifyEntityOwnership(receipt.identity,receipt.state.aliases,receipt.state.referenceBindings,await Promise.all(latest.map(async n=>({source:await stoppedFileSource(n)}))),0,receipt.state.homeAliases);
  evidence[post.filename]=post.sha256;posts.push({visit,filename:post.filename,sha256:post.sha256,clock:post.clock,counts:post.counts,comparison,rawTerrainSame:true,singleHeroOwnerQualified:true});
 }
 assert.deepEqual(h.pageVisits.map(v=>v.blocks),[9,9,9,9]);assert.deepEqual(h.pageVisits.map(v=>v.matchedObservedAllocations),[1,1,1,1]);assert.ok(h.pageVisits.every(v=>v.unknownOrigins===8));
 return {version:1,actualOriginalOrphanQueueRetirementQualified:true,actualSavedKingdomHeapMetadataQualified:true,
  scope:'Native-only retirement trial uses original queue destruction then original descriptor deletion for three observed replaced recipient queues. Current registered/default queues remain untouched. Actual original page frees reconcile; four post-cleanup full saves preserve compared state, terrain and single hero ownership. Ordinary4096-byte group stays9 across four exits. Other allocations and sustained browser/native memory bounds remain unqualified.',
  heapReport:resolve(heapName),heapReportSha256:sha(raw),sourceManifest:h.sourceManifest,sourceManifestSha256:h.sourceManifestSha256,
  nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,...retirement,postCleanupSaves:posts,pageVisits:h.pageVisits,evidenceSha256:evidence,
  reclaimedObservedPageBytes:retirement.retired.length*4096,limitedFourVisitQueueGroupBoundQualified:true,sustainedNativeMemoryBoundQualified:false,browserMemoryBoundQualified:false,
  cooperativeMessageRetirementQualified:false,browserUsed:false,nativeProcessesStarted:0,scriptSha256:await hash(new URL(import.meta.url))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);const r=await inspectQueueRetirement(name);
 await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({actualOriginalOrphanQueueRetirementQualified:true,retired:r.retired.length,reclaimedObservedPageBytes:r.reclaimedObservedPageBytes,
  postCleanupSaves:r.postCleanupSaves.length,afterExitPageBlocks:r.pageVisits.map(v=>v.blocks)}));}
