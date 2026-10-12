#!/usr/bin/env node
// Qualify bounded original CRT boundary-tag observations against actual exits.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyWorldSurvivors} from './check-native-world-survivors.mjs';
import {parseWorldResidency} from './check-native-world-residency.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),sum=a=>a.reduce((x,y)=>x+y,0);
async function bounded(name,cap) {
  const source=await stoppedFileSource(name);assert.ok(source.size<=cap);
  const bytes=Buffer.alloc(source.size);for(let at=0;at<bytes.length;at+=4096)bytes.set(await source.readAt(at,Math.min(4096,bytes.length-at)),at);
  return bytes;
}
const pattern=/^\[streaming\] World allocator visit=(\d+) stage=(load|before-exit|after-exit) pools=(\d+) committed-groups=(\d+) walked=(\d+) live-count=(\d+) live-bytes=(\d+) free-bytes=(\d+) reserved-bytes=(\d+) known-heap-bytes=(\d+) other-heap-bytes=(\d+) heap-bytes=(\d+) heap-blocks=(\d+) table-bytes=(\d+) classes=([0-9,]+) world-null=([01]) heap-same=1 crt-same=1 clock-same=1 hooks-same=1 elapsed-us=(\d+) result=pass$/gm;
export function parseWorldAllocator(log,count) {
  const cycles=parseWorldResidency(log,count);
  assert.equal((log.match(/^\[streaming\] World allocator\b/gm)||[]).length,count*3);
  const matches=[...log.matchAll(pattern)];assert.equal(matches.length,count*3,'Missing or refused allocator observation');
  const visits=[];
  function marker(expression){const m=[...log.matchAll(expression)];assert.equal(m.length,1);return m[0].index;}
  for(let i=0;i<count;++i) {
    const rows={};
    for(const [k,stage] of ['load','before-exit','after-exit'].entries()) {
      const m=matches[i*3+k];assert.equal(Number(m[1]),i);assert.equal(m[2],stage);
      const [pools,committedGroups,walked,liveCount,liveBytes,freeBytes,reservedBytes,knownHeapBytes,otherHeapBytes,heapBytes,heapBlocks,tableBytes]=m.slice(3,15).map(Number);
      assert.ok(m.slice(3,15).every(v=>Number.isSafeInteger(Number(v))&&Number(v)>=0));
      assert.ok(pools>0&&pools<=64&&committedGroups>0&&committedGroups<=512&&committedGroups<=pools*32);
      assert.ok(walked>=liveCount&&walked<=600000&&liveCount>0&&heapBlocks>0);
      assert.ok(tableBytes>=pools*20&&tableBytes<=64*20);
      const raw=m[15].split(',');assert.equal(raw.length,64);raw.forEach(v=>assert.match(v,/^\d+$/));
      const classes=raw.map(Number);assert.ok(classes.every(v=>Number.isSafeInteger(v)&&v>=0&&v<=600000));
      assert.equal(sum(classes),liveCount);assert.equal(sum(classes.map((v,k)=>v*(k+1)*16)),liveBytes);
      assert.equal(liveBytes+freeBytes,committedGroups*8*0xff0);
      assert.equal(reservedBytes,pools*0x100000);
      assert.equal(knownHeapBytes,reservedBytes+pools*0x41d0+Math.ceil(tableBytes/16)*16);
      assert.equal(heapBytes,knownHeapBytes+otherHeapBytes);
      assert.equal(Number(m[16]),stage==='after-exit'?1:0);
      const elapsedUs=Number(m[17]);assert.ok(Number.isSafeInteger(elapsedUs)&&elapsedUs>=0&&elapsedUs<=2000000);
      const position=marker(new RegExp('^\\[streaming\\] World survivors visit='+i+' stage='+stage+' .*$', 'gm'));
      assert.ok(position<m.index,'Allocator observed before scripting counters');
      if(stage==='load')assert.ok(m.index<marker(new RegExp('^\\[streaming\\] World persistence snapshot visit='+i+' side=\\d+ stage=after .*$', 'gm')));
      else if(stage==='before-exit') {
        assert.ok(m.index<marker(new RegExp('^\\[streaming\\] World residency exit='+i+' .*$', 'gm')));
        assert.deepEqual([heapBytes,heapBlocks,liveCount],[cycles[i].before.heap,cycles[i].before.blocks,cycles[i].before.crt]);
      } else {
        assert.deepEqual([heapBytes,heapBlocks,liveCount],[cycles[i].after.heap,cycles[i].after.blocks,cycles[i].after.crt]);
        if(i+1<count)assert.ok(m.index<marker(new RegExp('^\\[streaming\\] World residency load='+(i+1)+' .*$', 'gm')));
      }
      rows[stage]={pools,committedGroups,walked,liveCount,liveBytes,freeBytes,reservedBytes,knownHeapBytes,otherHeapBytes,heapBytes,heapBlocks,tableBytes,classes,elapsedUs};
    }
    visits.push({visit:i,region:i%2?0:1,loaded:rows.load,beforeExit:rows['before-exit'],afterExit:rows['after-exit']});
  }
  return visits;
}
export async function verifyWorldAllocator(manifest) {
  const survivors=await verifyWorldSurvivors(manifest),m=JSON.parse(await bounded(manifest,65536));assert.equal(m.worldAllocatorProbe,true);
  const logBytes=await bounded(m.log,1024*1024);assert.equal(sha(logBytes),survivors.evidenceSha256[m.log]);
  const auditName=join(workspace,'output/native-world-crt-layout-final-observed.json'),auditBytes=await bounded(auditName,65536),audit=JSON.parse(auditBytes);
  assert.equal(audit.qualified,true);assert.equal(audit.version,1);assert.equal(audit.contradictoryInstructionControls.length,4);assert.ok(audit.contradictoryInstructionControls.every(c=>c.refused));
  assert.equal(audit.originalExecutableSha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
  assert.equal(audit.originalExecutableSha256,(await hashNativeFile(join(workspace,'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'))).sha256);
  assert.equal(audit.scriptSha256,sha(await readFile(join(workspace,'scripts/audit-native-crt-layout.py'))));
  assert.deepEqual(Object.keys(audit.fragments),['originalSmallBlockPageWalk']);
  assert.equal(audit.fragments.originalSmallBlockPageWalk.start,0x655524);assert.equal(audit.fragments.originalSmallBlockPageWalk.end,0x6555d7);
  const visits=parseWorldAllocator(logBytes.toString('utf8'),survivors.visits.length);
  const comparisons=[0,1].map(region=>{
    const indices=visits.filter(v=>v.region===region).map(v=>v.visit),first=visits[indices[0]].afterExit,last=visits[indices.at(-1)].afterExit;
    return {region,visits:indices,heapDriftBytes:last.heapBytes-first.heapBytes,knownCrtBackingDriftBytes:last.knownHeapBytes-first.knownHeapBytes,
      otherHeapDriftBytes:last.otherHeapBytes-first.otherHeapBytes,poolDrift:last.pools-first.pools,committedGroupDrift:last.committedGroups-first.committedGroups,
      liveAllocationDrift:last.liveCount-first.liveCount,liveRoundedBytesDrift:last.liveBytes-first.liveBytes,
      changedSizeClasses:last.classes.flatMap((value,k)=>value===first.classes[k]?[]:[{roundedBytes:(k+1)*16,countDrift:value-first.classes[k]}])};
  });
  return {qualified:true,scope:'Actual native persistence and scripting observations independently qualified; original CRT page boundary tags and group counters account for every observed small allocation. Live bytes include allocator tags. Backing bytes account for known CRT reservations/controls/table; other heap ownership and safe trimming remain unproved.',
    sourceManifest:survivors.sourceManifest,sourceManifestSha256:survivors.sourceManifestSha256,nativeExecutableSha256:survivors.nativeExecutableSha256,
    allocatorCountersQualified:true,visits,comparisons,observedMaxElapsedUs:Math.max(...visits.flatMap(v=>[v.loaded.elapsedUs,v.beforeExit.elapsedUs,v.afterExit.elapsedUs])),nativeResourceSampling:survivors.nativeResourceSampling,
    originalPerVisitSaveAndRevisitQualified:true,originalBoundedRegionResidencyQualified:false,wholeBrowserMemoryBoundQualified:false,
    generatedAdjacentTerrainQualified:false,continuousTravelQualified:false,coopRegionHandoffQualified:false,browserUsed:false,nativeProcessesStarted:0,
    sourceSha256:{...survivors.sourceSha256,'scripts/check-native-world-allocator.mjs':sha(await readFile(new URL(import.meta.url)))},
    evidenceSha256:{...survivors.evidenceSha256,[auditName]:sha(auditBytes)}};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal persistence manifest> <fresh allocator report>');
  const report=await verifyWorldAllocator(name);await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,visits:report.visits.length,observedMaxElapsedUs:report.observedMaxElapsedUs,comparisons:report.comparisons}));
}
