#!/usr/bin/env node
// Readable embedded cache storage is checked against actual heap allocation bounds.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyMallocAllocationSites} from './check-native-malloc-sites.mjs';
import {parseHeapMetadata} from './check-native-world-heap.mjs';
import {parseOwnerMetadata,parseOwnerLog,auditLayouts} from './check-native-buffer-owners.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name,limit) {
  const s=await stoppedFileSource(name);assert.ok(s.size<=limit);const bytes=Buffer.alloc(s.size);
  for(let at=0;at<bytes.length;at+=4096)bytes.set(await s.readAt(at,Math.min(4096,bytes.length-at)),at);
  return bytes;
}
export function parseCacheMetadata(bytes,visit,stage,heap,events,position) {
  assert.ok(bytes.length>=40&&bytes.length<=36904&&(bytes.length-40)%72===0);
  assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(24),72);
  const count=(bytes.length-40)/72,projection=Buffer.alloc(40+count*60);
  bytes.copy(projection,0,0,40);projection.writeUInt32LE(1,4);projection.writeUInt32LE(60,24);
  // Reuse the complete owner/event/heap coverage check, with cache fields
  // explicitly unknown in that projection. Validate all actual cache fields
  // below against the v2 storage metadata and the unprojected heap records.
  for(let i=0;i<count;++i) {
    bytes.copy(projection,40+i*60,40+i*72,40+i*72+60);
    for(const word of [8,9,10,11,12,14])projection.writeUInt32LE(0,40+i*60+word*4);
  }
  const owner=parseOwnerMetadata(projection,visit,stage,heap,events,position),rows=[];
  let referenced=0,zeroReferenceLinks=0,embeddedReadable=0,crtReadable=0,backlinked=0,unknownCacheStorage=0;
  for(let i=0;i<count;++i) {
    const r=Array.from({length:18},(_,k)=>bytes.readUInt32LE(40+i*72+k*4)),candidate=owner.rows[i];
    const [readable,available,backlink,references,dataBytes,flags,type,storageKind,storageBase,storageBytes]=r.slice(8);
    assert.ok(readable<=1&&storageKind<=2);
    if(!candidate.ownerLive||candidate.vtable!==0x688a70)assert.ok(r.slice(6).every(x=>x===0));
    if(!readable) {
      assert.ok([available,backlink,references,dataBytes,type,storageKind,storageBase,storageBytes].every(x=>x===0));
      if(candidate.node)++unknownCacheStorage;
    } else {
      assert.ok(candidate.ownerLive&&candidate.vtable===0x688a70&&candidate.node!==0);
      assert.ok(storageKind===1||storageKind===2);
      if(storageKind===1) {
        assert.equal(candidate.node%16,0);assert.equal(storageBase,candidate.node);
        assert.ok(storageBytes>=0x28&&storageBytes<=1016&&(storageBytes+8)%16===0);
        assert.equal(available,storageBytes);++crtReadable;
      } else {
        const allocation=heap.records.find(r=>r.address===storageBase);assert.ok(allocation);
        assert.equal(allocation.kind,0,'A CRT backing allocation cannot establish live embedded cache storage');
        assert.equal(storageBytes,allocation.requestedBytes);
        assert.ok(candidate.node>=storageBase&&candidate.node-storageBase+0x28<=storageBytes);
        assert.equal(available,storageBytes-(candidate.node-storageBase));++embeddedReadable;
      }
      if(candidate.ownerBuffer===candidate.buffer&&!(flags&0x10000)&&backlink===candidate.owner) {
        ++backlinked;
        const event=events.find(e=>e.event===candidate.event);assert.ok(event&&event.op==='alloc');
        // Original EBP = cache data bytes - 26 - 1032 * signed header count.
        // The count itself is not captured. This observation supports only
        // nonnegative counts whose size difference fits that pinned formula.
        const extra=dataBytes-event.input-26;
        assert.ok(extra>=0&&extra%1032===0&&extra/1032<=32767,
          'Backlinked data size contradicts the pinned resource header calculation');
        if((references|0)>0)++referenced;else if(references===0)++zeroReferenceLinks;
      }
    }
    assert.equal(flags,candidate.flags);
    rows.push({...candidate,nodeStorageReadable:readable,nodeBytes:available,backlink,references,dataBytes,type,storageKind,storageBase,storageBytes});
  }
  return {...owner,rows,referenced,zeroReferenceLinks,backlinked,embeddedReadable,crtReadable,unknownCacheStorage};
}
export function assertCacheCapture(bytes,record,heap,events) {
  const parsed=parseCacheMetadata(bytes,record.visit,record.stage,heap,events,record.position);
  for(const key of ['targets','tracked','linked','referenced','clock','hooks'])assert.equal(parsed[key],record[key]);
  assert.equal(bytes.length,record.bytes);return parsed;
}
export async function verifyBufferCache(name) {
  const base=await verifyMallocAllocationSites(name),m=JSON.parse(await bounded(name,65536));
  assert.deepEqual([m.worldOwnerProbe,m.ownerMetadataVersion,m.ownerMetadataRowBytes,m.ownerMetadataTargetLimit,m.ownerMetadataMaximumBytes],[true,2,72,512,36904]);
  const evidence={...base.evidenceSha256};await auditLayouts(evidence);
  const sizeAuditName=join(workspace,'output/native-data-buffer-size-observed.json'),sizeAuditBytes=await bounded(sizeAuditName,65536),sizeAudit=JSON.parse(sizeAuditBytes);
  assert.deepEqual([sizeAudit.qualified,sizeAudit.version,sizeAudit.resourceHeaderBytes,sizeAudit.headerEntryBytes,sizeAudit.headerCountSignedBits],[true,1,26,1032,16]);
  assert.equal(sizeAudit.originalExecutableSha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
  assert.equal(sizeAudit.scriptSha256,sha(await bounded(join(workspace,'scripts/audit-native-data-buffer-size.py'),65536)));
  assert.deepEqual(Object.keys(sizeAudit.fragments),['dataSizeCalculation']);
  assert.deepEqual([sizeAudit.fragments.dataSizeCalculation.start,sizeAudit.fragments.dataSizeCalculation.end],[0x529d1f,0x529db1]);
  assert.equal(sizeAudit.contradictoryInstructionControls.length,1);assert.equal(sizeAudit.contradictoryInstructionControls[0].refused,true);
  const peSource=await stoppedFileSource(join(workspace,'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'));
  const header=Buffer.from(await peSource.readAt(0,4096)),pe=header.readUInt32LE(60),count=header.readUInt16LE(pe+6),opt=header.readUInt16LE(pe+20);
  assert.equal(header.readUInt32LE(pe+52),0x400000);assert.ok(count>0&&count<=16);
  let sizeRaw;
  for(let i=0;i<count;++i) {
    const at=pe+24+opt+i*40,rva=header.readUInt32LE(at+12),n=header.readUInt32LE(at+16),offset=header.readUInt32LE(at+20);
    if(rva<=0x129d1f&&0x129db1<=rva+n)sizeRaw=await peSource.readAt(offset+0x129d1f-rva,0x529db1-0x529d1f);
  }
  assert.ok(sizeRaw);assert.equal(sha(sizeRaw),sizeAudit.fragments.dataSizeCalculation.sha256);evidence[sizeAuditName]=sha(sizeAuditBytes);
  const logBytes=await bounded(m.log,1024*1024);assert.equal(sha(logBytes),evidence[m.log]);const log=logBytes.toString('utf8'),captures=[];
  for(const record of parseOwnerLog(log,base.visits.length,72)) {
    const heapName=join(m.profile,`Heap_Visit_${record.visit}_${record.stage}.bin`),heapBytes=await bounded(heapName,131112);
    assert.equal(sha(heapBytes),evidence[heapName]);const heap=parseHeapMetadata(heapBytes,record.visit,record.stage);
    const filename=join(m.profile,record.filename),bytes=await bounded(filename,36904),parsed=assertCacheCapture(bytes,record,heap,base.events);
    evidence[filename]=sha(bytes);captures.push({...record,filename,sha256:sha(bytes),...parsed});
  }
  return {qualified:true,scope:'Original persisted state, completed checkpoints, heap rows, CRT allocator events and pinned reference layouts requalified. Bounded owner metadata additionally reads cache fields only in an exact live CRT payload or a complete non-CRT guest heap allocation containing the entry. Buffer and cache backlinks, input sizes and observed reference counts are reconciled. Storage reachability does not prove logical entry lifetime, all owners, safe eviction or bounded memory.',
    sourceManifest:base.sourceManifest,sourceManifestSha256:base.sourceManifestSha256,nativeExecutableSha256:base.nativeExecutableSha256,
    observedBufferCacheMetadataQualified:true,captures,maxElapsedUs:Math.max(...captures.map(c=>c.elapsedUs)),nativeResourceSampling:base.nativeResourceSampling,
    originalPerVisitSaveAndRevisitQualified:true,completedTickCheckpointBoundaryQualified:true,
    allocationOwnershipQualified:false,safeCacheEvictionQualified:false,originalBoundedRegionResidencyQualified:false,wholeBrowserMemoryBoundQualified:false,generatedAdjacentTerrainQualified:false,continuousTravelQualified:false,coopRegionHandoffQualified:false,browserUsed:false,nativeProcessesStarted:0,
    sourceSha256:{...base.sourceSha256,'scripts/check-native-buffer-owners.mjs':sha(await readFile(new URL('./check-native-buffer-owners.mjs',import.meta.url))),
      'scripts/audit-native-data-buffer-size.py':sha(await bounded(join(workspace,'scripts/audit-native-data-buffer-size.py'),65536)),
      'scripts/audit-native-data-buffer-owner.py':sha(await bounded(join(workspace,'scripts/audit-native-data-buffer-owner.py'),65536)),
      'scripts/audit-native-data-buffer-references.py':sha(await bounded(join(workspace,'scripts/audit-native-data-buffer-references.py'),65536)),
      'scripts/check-native-buffer-cache.mjs':sha(await readFile(new URL(import.meta.url)))},evidenceSha256:evidence};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
  const r=await verifyBufferCache(name);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,captures:r.captures.length,maxElapsedUs:r.maxElapsedUs,afterExit:r.captures.filter(c=>c.stage==='after-exit').map(({visit,targets,linked,backlinked,referenced,zeroReferenceLinks,embeddedReadable,unknownCacheStorage})=>({visit,targets,linked,backlinked,referenced,zeroReferenceLinks,embeddedReadable,unknownCacheStorage}))}));
}
