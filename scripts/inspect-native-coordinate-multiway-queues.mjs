#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {parsePageEvents} from './check-native-page-sites.mjs';
import {parsePageContexts} from './check-native-page-context.mjs';
import {inspectRepeatedQueueRetirementTrace,parseRepeatedPageOwners} from './lib/repeated-hero-travel.mjs';
import {parsePageRegistrations} from './inspect-native-page-registration.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {verifyEntityOwnership} from '../web/world/entity-ownership.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),hash=async n=>(await hashNativeFile(n)).sha256;
async function bounded(n,cap){const s=await stoppedFileSource(n);assert.ok(s.size<=cap);const b=Buffer.alloc(s.size);
 for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;}
export async function inspectMultiwayQueueRetirement(heapName){
 const raw=await bounded(heapName,1024*1024),h=JSON.parse(raw);assert.equal(h.actualSavedKingdomHeapMetadataQualified,true);assert.equal(h.actualRegisteredHeroSameProcessRegionReturnQualified,true);
 assert.equal(h.scriptSha256,await hash(join(workspace,'scripts/inspect-native-coordinate-multiway-heap.mjs')));
 const manifestRaw=await bounded(h.sourceManifest,256*1024);assert.equal(sha(manifestRaw),h.sourceManifestSha256);const m=JSON.parse(manifestRaw),visitCount=m.coordinateRoute.length,build=JSON.parse(await bounded(m.buildReport,256*1024));
 assert.equal(m.orphanQueueReleaseVersion,'v1');assert.equal(m.worldPageRegistrationVersion,1);assert.equal(await hash(m.buildReport),m.buildReportSha256);await verifyConnectedNativeArtifact(m,build);
 assert.equal(h.automaticOriginalRegionLifecycleQualified,true);assert.equal(h.requestDrivenOriginalRegionLifecycleQualified,true);
 for(const [n,d]of Object.entries(h.sourceSha256))assert.equal(await hash(join(workspace,n)),d);
 for(const [n,d]of Object.entries(h.evidenceSha256))assert.equal(await hash(n),d);
 const logRaw=await bounded(m.log,(visitCount===8?2:1)*1024*1024);assert.equal(sha(logRaw),m.logSha256);const log=logRaw.toString('utf8');
 const events=parsePageEvents(log,visitCount),contexts=parsePageContexts(log,events),owners=parseRepeatedPageOwners(log,events,contexts,visitCount),registration=parsePageRegistrations(log,owners),retirement=inspectRepeatedQueueRetirementTrace(log,events,owners,registration,visitCount);
 const auditRaw=await bounded(m.orphanQueueReleaseAudit,65536);assert.equal(sha(auditRaw),m.orphanQueueReleaseAuditSha256);const a=JSON.parse(auditRaw);
 assert.deepEqual([a.qualified,a.version,a.originalMessageQueueDestructor,a.originalDescriptorDelete],[true,4,0x497cf0,0x645bc0]);
 assert.equal(a.scriptSha256,await hash(join(workspace,'scripts/audit-native-orphan-queue-retirement.py')));assert.equal(a.contradictoryInstructionControls.length,13);assert.ok(a.contradictoryInstructionControls.every(c=>c.refused));
 const peName=join(workspace,'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe');assert.equal(await hash(peName),a.originalExecutableSha256);
 const pe=await stoppedFileSource(peName),header=Buffer.from(await pe.readAt(0,4096)),at=header.readUInt32LE(60),count=header.readUInt16LE(at+6),opt=header.readUInt16LE(at+20);assert.ok(count>0&&count<=16);
 const sections=Array.from({length:count},(_,i)=>{const p=at+24+opt+i*40;return {rva:header.readUInt32LE(p+12),size:header.readUInt32LE(p+16),offset:header.readUInt32LE(p+20)};});
 for(const f of Object.values(a.fragments)){const rva=f.start-0x400000,s=sections.find(s=>s.rva<=rva&&rva+f.end-f.start<=s.rva+s.size);assert.ok(s);assert.equal(sha(await pe.readAt(s.offset+rva-s.rva,f.end-f.start)),f.sha256);}
 const autoRaw=await bounded(m.automaticRegionLoadAudit,65536);assert.equal(sha(autoRaw),m.automaticRegionLoadAuditSha256);const autoAudit=JSON.parse(autoRaw);
 assert.deepEqual([autoAudit.qualified,autoAudit.version,autoAudit.originalExecutableSha256],[true,1,a.originalExecutableSha256]);
 assert.equal(autoAudit.scriptSha256,await hash(join(workspace,'scripts/audit-native-auto-region-load.py')));assert.equal(Object.keys(autoAudit.fragments).length,6);assert.equal(autoAudit.contradictoryInstructionControls.length,9);assert.ok(autoAudit.contradictoryInstructionControls.every(c=>c.refused));
 for(const f of Object.values(autoAudit.fragments)){const rva=f.start-0x400000,s=sections.find(s=>s.rva<=rva&&rva+f.end-f.start<=s.rva+s.size);assert.ok(s);assert.equal(sha(await pe.readAt(s.offset+rva-s.rva,f.end-f.start)),f.sha256);}
 const receipt=JSON.parse(await bounded(m.receipt,256*1024));assert.equal(await hash(m.receipt),m.receiptSha256);
 const latest=[join(m.profile,'Residency_Initial_0.GMP'),join(m.profile,'Residency_Initial_1.GMP'),join(m.profile,'Residency_Initial_0_1.GMP'),...(visitCount===8?[join(m.profile,'Residency_Initial_0_-1.GMP')]:[])],posts=[],evidence={...h.evidenceSha256,[m.orphanQueueReleaseAudit]:sha(auditRaw),[m.automaticRegionLoadAudit]:sha(autoRaw)};
 for(let visit=0;visit<visitCount;visit++){
  const side=m.loadSequence[visit],before=await connectedWorldState(join(m.profile,`Residency_Visit_${visit}_After.GMP`),{unscheduledAgents:side===1?[45]:[]});
  const post=await connectedWorldState(join(m.profile,`Residency_Visit_${visit}_PostQueueRelease.GMP`),{unscheduledAgents:side===1?[45]:[]});
  const comparison=compareConnectedWorlds(before,post);assert.equal(post.rawTerrainSha256,before.rawTerrainSha256);assert.equal(post.label,'Joint_Evolved');
  latest[side]=post.filename;
  await verifyEntityOwnership(receipt.identity,receipt.state.aliases,receipt.state.referenceBindings,await Promise.all(latest.slice(0,2).map(async n=>({source:await stoppedFileSource(n)}))),0,receipt.state.homeAliases);
  evidence[post.filename]=post.sha256;posts.push({visit,filename:post.filename,sha256:post.sha256,clock:post.clock,counts:post.counts,comparison,rawTerrainSame:true,committedPairSingleHeroOwnerQualified:true,region:m.coordinateRoute[visit]});
 }
 assert.equal(h.pageVisits.length,visitCount);assert.deepEqual(h.pageVisits.map(v=>v.matchedObservedAllocations),Array(visitCount).fill(1));assert.ok(h.pageVisits.every(v=>v.unknownOrigins===v.blocks-1));
 return {version:1,actualOriginalOrphanQueueRetirementQualified:true,actualSavedKingdomHeapMetadataQualified:true,automaticOriginalRegionLifecycleQualified:true,requestDrivenOriginalRegionLifecycleQualified:true,
  scope:`Native-only original queue destruction/deletion for ${visitCount-1} observed replaced queues. Current registered/default queues remain. ${visitCount} post-cleanup original saves preserve compared state, terrain and committed-pair single hero ownership. One current observed queue backing remains per exit; other allocations and sustained browser/native memory bounds remain unqualified.`,
  heapReport:resolve(heapName),heapReportSha256:sha(raw),sourceManifest:h.sourceManifest,sourceManifestSha256:h.sourceManifestSha256,
  nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,...retirement,postCleanupSaves:posts,pageVisits:h.pageVisits,evidenceSha256:evidence,
  reclaimedObservedPageBytes:retirement.retired.length*4096,limitedQueueFamilyBoundQualified:true,qualifiedVisitCount:visitCount,multiWayNativeCoordinateTravelQualified:true,ordinaryPageGroupConstant:h.pageVisits.every(v=>v.blocks===h.pageVisits[0].blocks),sustainedNativeMemoryBoundQualified:false,browserMemoryBoundQualified:false,
  cooperativeMessageRetirementQualified:false,browserUsed:false,nativeProcessesStarted:0,scriptSha256:await hash(new URL(import.meta.url))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);const r=await inspectMultiwayQueueRetirement(name);
 await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({actualOriginalOrphanQueueRetirementQualified:true,retired:r.retired.length,reclaimedObservedPageBytes:r.reclaimedObservedPageBytes,
  postCleanupSaves:r.postCleanupSaves.length,afterExitPageBlocks:r.pageVisits.map(v=>v.blocks)}));}
