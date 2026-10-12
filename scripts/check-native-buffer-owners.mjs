#!/usr/bin/env node
// Bounded owner metadata reconciled with actual heap rows and allocation events.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyMallocAllocationSites} from './check-native-malloc-sites.mjs';
import {parseHeapMetadata} from './check-native-world-heap.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const stages=['load','before-exit','after-exit'];
const address=x=>x>=0x01000000&&x<0x10000000&&x%16===0;
const payload=x=>x===0||(x>=8&&x<=1016&&(x+8)%16===0);
async function bounded(name,limit) {
  const s=await stoppedFileSource(name);assert.ok(s.size<=limit);
  const bytes=Buffer.alloc(s.size);
  for(let at=0;at<bytes.length;at+=4096)bytes.set(await s.readAt(at,Math.min(4096,bytes.length-at)),at);
  return bytes;
}
export function parseOwnerMetadata(bytes,visit,stage,heap,events,position) {
  assert.ok(bytes.length>=40&&bytes.length<=30760&&(bytes.length-40)%60===0);
  const header=Array.from({length:10},(_,i)=>bytes.readUInt32LE(i*4));
  assert.deepEqual(header.slice(0,7),[0x524e574f,1,visit,stages.indexOf(stage),12208,512,60]);
  assert.deepEqual(header.slice(7,9),[heap.clock,heap.hooks]);
  const prior=events.filter(e=>e.position<position);
  assert.equal(header[9],prior.at(-1)?.event||0);
  const active=new Map();
  for(const e of prior)if(e.op==='alloc')active.set(e.address,e);else active.delete(e.address);
  const rows=[];let tracked=0,linked=0,referenced=0,zeroReferenceLinks=0,deadCandidates=0,unknownCandidates=0;
  for(let at=40;at<bytes.length;at+=60) {
    const r=Array.from({length:15},(_,i)=>bytes.readUInt32LE(at+i*4));
    const [buffer,event,owner,ownerLive,ownerBytes,vtable,ownerBuffer,node,nodeLive,nodeBytes,backlink,references,dataBytes,flags,type]=r;
    assert.ok(address(buffer));assert.ok(!owner||address(owner));
    assert.ok(payload(ownerBytes)&&payload(nodeBytes));
    assert.equal(ownerLive,Number(ownerBytes>=0x38));assert.equal(nodeLive,Number(nodeBytes>=0x28));
    const observed=active.get(buffer);
    assert.equal(event,observed?.event||0,'Buffer event differs from the actual surviving observation');
    if(event) {
      ++tracked;
      if(owner)assert.deepEqual([observed.directCaller,observed.directCallee],[0x529e70,0x64d59f]);
    } else assert.ok(r.slice(2).every(x=>x===0),'Unobserved baseline must remain unknown');
    if(!owner)assert.equal(ownerBytes,0);
    if(!ownerLive)assert.ok(r.slice(5).every(x=>x===0),'Dead owner fields must not be read');
    else if(vtable!==0x688a70)assert.ok(r.slice(6).every(x=>x===0),'Different owner type fields must not be interpreted');
    else {
      // Cache nodes can be embedded in an allocation and need only word
      // alignment. This probe reads fields only for exact live CRT blocks;
      // interior nodes remain unqualified rather than guessed live.
      assert.ok(!node||(node>=0x01000000&&node<0x10000000&&node%4===0));if(!node)assert.equal(nodeBytes,0);
      if(!nodeLive)assert.ok([backlink,references,dataBytes,type].every(x=>x===0));
      if(ownerBuffer===buffer&&!(flags&0x10000)) {
        ++linked;
        if(nodeLive&&backlink===owner) {
          if((references|0)>0)++referenced;
          else if(references===0)++zeroReferenceLinks;
        }
      }
    }
    if(!owner)++unknownCandidates;else if(!ownerLive)++deadCandidates;
    rows.push({buffer,event,owner,ownerLive,ownerBytes,vtable,ownerBuffer,node,nodeLive,nodeBytes,backlink,references,dataBytes,flags,type});
  }
  assert.deepEqual(rows.map(r=>r.buffer),heap.records.filter(r=>r.requestedBytes===12208).map(r=>r.address),'Owner coverage must equal the actual target heap rows in order');
  return {clock:header[7],hooks:header[8],allocationEvents:header[9],targets:rows.length,tracked,linked,referenced,zeroReferenceLinks,deadCandidates,unknownCandidates,rows};
}
export function parseOwnerLog(log,visits,rowBytes=60) {
  assert.ok([60,72].includes(rowBytes));
  const pattern=/^\[streaming\] World owners visit=(\d+) stage=(load|before-exit|after-exit) file=(Owners_Visit_\d+_(?:load|before-exit|after-exit)\.bin) targets=(\d+) tracked=(\d+) linked=(\d+) referenced=(\d+) bytes=(\d+) clock=(\d+) hooks=(\d+) world-null=([01]) heap-same=1 clock-same=1 hooks-same=1 elapsed-us=(\d+) result=pass$/gm;
  const matches=[...log.matchAll(pattern)];
  assert.equal((log.match(/^\[streaming\] World owners\b/gm)||[]).length,visits*3);
  assert.equal(matches.length,visits*3);
  return matches.map((m,i)=>{
    const visit=Math.floor(i/3),stage=stages[i%3],filename=`Owners_Visit_${visit}_${stage}.bin`;
    assert.deepEqual([Number(m[1]),m[2],m[3]],[visit,stage,filename]);
    const targets=Number(m[4]),tracked=Number(m[5]),linked=Number(m[6]),referenced=Number(m[7]);
    assert.ok(targets<=512&&tracked<=targets&&linked<=tracked&&referenced<=linked);
    assert.equal(Number(m[8]),40+targets*rowBytes);assert.equal(Number(m[11]),Number(stage==='after-exit'));
    assert.ok(Number(m[12])<=2000000);
    const previous=log.lastIndexOf(`[streaming] World heap visit=${visit} stage=${stage} `,m.index);
    assert.ok(previous>=0);assert.equal(log.indexOf('\n',previous)+1,m.index,'Owner capture must immediately follow matching heap capture');
    return {visit,stage,filename,targets,tracked,linked,referenced,bytes:Number(m[8]),clock:Number(m[9]),hooks:Number(m[10]),elapsedUs:Number(m[12]),position:m.index};
  });
}
export async function auditLayouts(evidence) {
  const s=await stoppedFileSource(join(workspace,'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'));
  const h=Buffer.from(await s.readAt(0,4096)),pe=h.readUInt32LE(60),count=h.readUInt16LE(pe+6),opt=h.readUInt16LE(pe+20);
  assert.equal(h.readUInt32LE(pe+52),0x400000);assert.ok(count>0&&count<=16);
  const sections=Array.from({length:count},(_,i)=>{const at=pe+24+opt+i*40;return {rva:h.readUInt32LE(at+12),bytes:h.readUInt32LE(at+16),offset:h.readUInt32LE(at+20)};});
  const fragments=[
    ['native-data-buffer-owner-layout-observed.json','audit-native-data-buffer-owner.py',[
      ['dataLoadInstall',0x529e59,0x529eb1],['dataSetter',0x558d80,0x558dc7],['scalarDestructor',0x5588a0,0x558924]]],
    ['native-data-buffer-references-observed.json','audit-native-data-buffer-references.py',[
      ['cacheAcquire',0x529d41,0x529d59],['cacheBacklinks',0x52a079,0x52a089],['cacheRelease',0x527c60,0x527c9d],['ownerRelease',0x558930,0x55894a],['heapSaveEsi',0x64d5dd,0x64d600],['heapRestoreEsi',0x64d6d4,0x64d6d9]]]];
  for(const [name,script,ranges] of fragments) {
    const filename=join(workspace,'output',name),bytes=await bounded(filename,65536),audit=JSON.parse(bytes);
    assert.equal(audit.qualified,true);assert.equal(audit.version,1);
    assert.equal(audit.originalExecutableSha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
    assert.equal(audit.scriptSha256,sha(await bounded(join(workspace,'scripts',script),65536)));
    assert.deepEqual(Object.keys(audit.fragments),ranges.map(r=>r[0]));
    assert.equal(audit.contradictoryInstructionControls.length,ranges.length);assert.ok(audit.contradictoryInstructionControls.every(c=>c.refused));
    if(audit.dependencySha256)assert.equal(audit.dependencySha256,sha(await bounded(join(workspace,'scripts/audit-native-data-buffer-owner.py'),65536)));
    const extra=script==='audit-native-data-buffer-references.py'?[['ownerVtable',0x688a70,0x688a7c]]:[];
    for(const [key,start,end] of [...ranges,...extra]) {
      const entry=key==='ownerVtable'?audit.ownerVtable:audit.fragments[key];
      assert.deepEqual([entry.start,entry.end],[start,end]);
      const rva=start-0x400000,section=sections.find(s=>s.rva<=rva&&rva+end-start<=s.rva+s.bytes);assert.ok(section);
      assert.equal(sha(await s.readAt(section.offset+rva-section.rva,end-start)),entry.sha256);
    }
    evidence[filename]=sha(bytes);
  }
}
export async function verifyBufferOwners(name) {
  const base=await verifyMallocAllocationSites(name),m=JSON.parse(await bounded(name,65536));
  assert.deepEqual([m.worldOwnerProbe,m.ownerMetadataVersion,m.ownerMetadataRowBytes,m.ownerMetadataTargetLimit,m.ownerMetadataMaximumBytes],[true,1,60,512,30760]);
  const evidence={...base.evidenceSha256};await auditLayouts(evidence);
  const logBytes=await bounded(m.log,1024*1024);assert.equal(sha(logBytes),evidence[m.log]);const log=logBytes.toString('utf8');
  const captures=[];
  for(const record of parseOwnerLog(log,base.visits.length)) {
    const heapName=join(m.profile,`Heap_Visit_${record.visit}_${record.stage}.bin`),heapBytes=await bounded(heapName,131112);
    assert.equal(sha(heapBytes),evidence[heapName]);const heap=parseHeapMetadata(heapBytes,record.visit,record.stage);
    const filename=join(m.profile,record.filename),bytes=await bounded(filename,30760);
    const parsed=parseOwnerMetadata(bytes,record.visit,record.stage,heap,base.events,record.position);
    for(const key of ['targets','tracked','linked','referenced','clock','hooks'])assert.equal(parsed[key],record[key]);
    assert.equal(bytes.length,record.bytes);evidence[filename]=sha(bytes);
    captures.push({...record,filename,sha256:sha(bytes),...parsed});
  }
  return {qualified:true,scope:'Actual original persistence, completed checkpoint, heap and allocation-event gates requalified. Bounded metadata observes CRT-allocated candidate owners, buffer slots, cache backlinks and reference counts at each boundary. Partial coverage; recycled or converted objects and unobserved paths remain unknown. No resource eviction or buffer payload capture.',
    sourceManifest:base.sourceManifest,sourceManifestSha256:base.sourceManifestSha256,nativeExecutableSha256:base.nativeExecutableSha256,
    observedBufferOwnerMetadataQualified:true,captures,maxElapsedUs:Math.max(...captures.map(c=>c.elapsedUs)),nativeResourceSampling:base.nativeResourceSampling,
    originalPerVisitSaveAndRevisitQualified:true,completedTickCheckpointBoundaryQualified:true,
    allocationOwnershipQualified:false,safeCacheEvictionQualified:false,originalBoundedRegionResidencyQualified:false,wholeBrowserMemoryBoundQualified:false,generatedAdjacentTerrainQualified:false,continuousTravelQualified:false,coopRegionHandoffQualified:false,browserUsed:false,nativeProcessesStarted:0,
    sourceSha256:{...base.sourceSha256,'scripts/audit-native-data-buffer-owner.py':sha(await bounded(join(workspace,'scripts/audit-native-data-buffer-owner.py'),65536)),
      'scripts/audit-native-data-buffer-references.py':sha(await bounded(join(workspace,'scripts/audit-native-data-buffer-references.py'),65536)),
      'scripts/check-native-buffer-owners.mjs':sha(await readFile(new URL(import.meta.url)))},evidenceSha256:evidence};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
  const r=await verifyBufferOwners(name);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,captures:r.captures.length,maxElapsedUs:r.maxElapsedUs,afterExit:r.captures.filter(c=>c.stage==='after-exit').map(({visit,targets,tracked,linked,referenced,zeroReferenceLinks,deadCandidates,unknownCandidates})=>({visit,targets,tracked,linked,referenced,zeroReferenceLinks,deadCandidates,unknownCandidates}))}));
}
