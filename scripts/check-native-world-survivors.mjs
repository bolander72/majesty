#!/usr/bin/env node
// Read-only counters for the original scripting managers that survive world exit.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyWorldPersistence} from './check-native-world-persistence.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const sum=a=>a.reduce((x,y)=>x+y,0);
async function bounded(name,cap) {
  const source=await stoppedFileSource(name);assert.ok(source.size<=cap);
  const bytes=Buffer.alloc(source.size);for(let at=0;at<bytes.length;at+=4096)bytes.set(await source.readAt(at,Math.min(4096,bytes.length-at)),at);
  return bytes;
}
const rowPattern=/^\[streaming\] World survivors visit=(\d+) stage=(load|before-exit|after-exit) runtime=([0-9a-f]{8}) managers=([0-9a-f,]+) trees=([0-9,]+) batch-used=(\d+) batch-cap=(\d+) free-used=([0-9,]+) free-cap=([0-9,]+) vector-bytes=(\d+) world-null=([01]) heap-same=1 crt-same=1 clock-same=1 hooks-same=1 result=pass$/gm;
function csv(text,length,hex=false) {
  const values=text.split(',');assert.equal(values.length,length,'Wrong fixed counter length');
  values.forEach(v=>assert.match(v,hex?/^[0-9a-f]{8}$/:/^\d+$/));
  const numbers=values.map(v=>hex?parseInt(v,16):Number(v));
  assert.ok(numbers.every(v=>Number.isSafeInteger(v)&&v>=0&&v<=0xffffffff));return numbers;
}
export function parseWorldSurvivors(log,count) {
  assert.ok(Number.isInteger(count)&&count>=3&&count<=32);
  assert.equal((log.match(/^\[streaming\] World survivors\b/gm)||[]).length,count*3,'Missing, extra or malformed survivor rows');
  const matches=[...log.matchAll(rowPattern)];assert.equal(matches.length,count*3,'Refused or malformed survivor observation');
  const first=matches[0],visits=[];
  for(let i=0;i<count;++i) {
    const rows={};
    for(const [n,stage] of ['load','before-exit','after-exit'].entries()) {
      const m=matches[i*3+n];assert.equal(Number(m[1]),i);assert.equal(m[2],stage);
      assert.equal(m[3],first[3],'Runtime changed');
      assert.equal(csv(m[4],6,true)[5],csv(first[4],6,true)[5],'Surviving value pool changed');
      assert.equal(m[4],matches[i*3][4],'Manager changed during world lifetime');
      const runtime=parseInt(m[3],16),managers=csv(m[4],6,true),trees=csv(m[5],10);
      assert.ok(runtime>0&&managers.every((v,k)=>v>0||k===1||k===2));
      const present=managers.filter(v=>v>0);assert.equal(new Set(present).size,present.length);
      assert.ok(trees.every(v=>v<=100000));
      if(!managers[1])assert.deepEqual(trees.slice(1,5),[0,0,0,0]);
      if(!managers[2])assert.deepEqual(trees.slice(5,7),[0,0]);
      const allocatedBatches=Number(m[6]),batchCapacity=Number(m[7]),freeUsed=csv(m[8],9),freeCapacity=csv(m[9],9),vectorBytes=Number(m[10]);
      assert.ok(Number.isSafeInteger(allocatedBatches)&&allocatedBatches>=0&&allocatedBatches<=batchCapacity);
      assert.ok(Number.isSafeInteger(batchCapacity)&&batchCapacity<=262144);
      for(let k=0;k<9;++k)assert.ok(freeUsed[k]<=freeCapacity[k]);
      assert.equal(vectorBytes,4*(batchCapacity+sum(freeCapacity)));assert.ok(vectorBytes<=1024*1024);
      assert.equal(Number(m[11]),stage==='after-exit'?1:0,'Wrong world lifetime');
      rows[stage]={runtime,managers,trees,allocatedBatches,batchCapacity,freeUsed,freeCapacity,vectorBytes,
        reusableValues:sum(freeUsed)};
    }
    const position=pattern=>{const found=[...log.matchAll(pattern)];assert.equal(found.length,1,'Missing or duplicate lifetime marker');return found[0].index;};
    const beforeSave=position(new RegExp('^\\[streaming\\] World persistence snapshot visit='+i+' side=\\d+ stage=before\\b.*$','gm'));
    const afterSave=position(new RegExp('^\\[streaming\\] World persistence snapshot visit='+i+' side=\\d+ stage=after\\b.*$','gm'));
    const request=position(new RegExp('^\\[streaming\\] World residency request='+i+' .*$', 'gm'));
    const exit=position(new RegExp('^\\[streaming\\] World residency exit='+i+' .*$', 'gm'));
    const [loadRow,beforeRow,afterRow]=matches.slice(i*3,i*3+3).map(m=>m.index);
    assert.ok(beforeSave<loadRow&&loadRow<afterSave&&afterSave<request&&request<beforeRow&&beforeRow<exit&&exit<afterRow,'Survivor lifetime order differs');
    if(i+1<count){const nextLoad=position(new RegExp('^\\[streaming\\] World residency load='+(i+1)+' .*$', 'gm'));assert.ok(afterRow<nextLoad);}
    visits.push({visit:i,region:i%2?0:1,loaded:rows.load,beforeExit:rows['before-exit'],afterExit:rows['after-exit']});
  }
  return visits;
}
export async function verifyWorldSurvivors(manifest) {
  const persistence=await verifyWorldPersistence(manifest),m=persistence.fixture;
  assert.equal(m.worldSurvivorProbe,true,'Require actual opt-in native observation');
  const auditName=join(workspace,'output/native-world-value-pool-reload-observed.json'),auditBytes=await bounded(auditName,65536),audit=JSON.parse(auditBytes);
  assert.equal(audit.qualified,true);assert.equal(audit.version,1);
  assert.equal(audit.originalExecutableSha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
  assert.equal(audit.originalExecutableSha256,(await hashNativeFile(join(workspace,'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'))).sha256);
  assert.equal(audit.scriptSha256,sha(await readFile(join(workspace,'scripts/audit-native-value-pool.py'))));
  assert.deepEqual(Object.keys(audit.fragments).sort(),['registryInitialization','registryReconstruction','typeOneBatchCreation']);
  assert.equal(audit.fragments.registryReconstruction.start,0x62868d);assert.equal(audit.fragments.registryReconstruction.end,0x6287cb);
  assert.equal(audit.fragments.registryInitialization.start,0x628a96);assert.equal(audit.fragments.registryInitialization.end,0x628adf);
  assert.equal(audit.fragments.typeOneBatchCreation.start,0x62ac80);assert.equal(audit.fragments.typeOneBatchCreation.end,0x62ad0e);
  assert.equal(audit.contradictoryInstructionControls.length,3);assert.ok(audit.contradictoryInstructionControls.every(c=>c.refused));
  const bytes=await bounded(m.log,1024*1024);
  assert.equal(sha(bytes),persistence.evidenceSha256[m.log]);
  const visits=parseWorldSurvivors(bytes.toString('utf8'),persistence.cycles.length);
  const comparisons=[0,1].map(region=>{
    const indices=visits.filter(v=>v.region===region).map(v=>v.visit),first=visits[indices[0]].afterExit,last=visits[indices.at(-1)].afterExit;
    return {region,visits:indices,postUnloadHeapDriftBytes:persistence.cycles[indices.at(-1)].after.heap-persistence.cycles[indices[0]].after.heap,
      postUnloadCrtDriftAllocations:persistence.cycles[indices.at(-1)].after.crt-persistence.cycles[indices[0]].after.crt,
      registryCountDrift:last.trees.map((v,k)=>v-first.trees[k]),allocatedBatchDrift:last.allocatedBatches-first.allocatedBatches,
      reusableValueDrift:last.reusableValues-first.reusableValues,
      pointerVectorBackingDriftBytes:last.vectorBytes-first.vectorBytes};
  });
  return {qualified:true,scope:'Actual original native save/unload/revisit qualified independently, with read-only counters for six surviving scripting managers. Counts and pointer-vector backing describe these managers, not total transitive ownership or a memory bound.',
    sourceManifest:persistence.sourceManifest,sourceManifestSha256:persistence.sourceManifestSha256,nativeExecutableSha256:m.nativeExecutableSha256AtLaunch,
    survivorCountersQualified:true,visits,comparisons,nativeResourceSampling:persistence.nativeResourceSampling,
    observedRegistryReplacements:visits.slice(1).map(v=>({visit:v.visit,replacedSlots:v.loaded.managers.slice(0,5).flatMap((pointer,k)=>pointer!==visits[v.visit-1].afterExit.managers[k]?[8+4*k]:[])})),
    originalPerVisitSaveAndRevisitQualified:true,originalBoundedRegionResidencyQualified:false,wholeBrowserMemoryBoundQualified:false,
    generatedAdjacentTerrainQualified:false,continuousTravelQualified:false,coopRegionHandoffQualified:false,browserUsed:false,nativeProcessesStarted:0,
    sourceSha256:{...persistence.sourceSha256,'scripts/check-native-world-survivors.mjs':sha(await readFile(new URL(import.meta.url)))},
    evidenceSha256:{...persistence.evidenceSha256,[auditName]:sha(auditBytes)}};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal persistence manifest> <fresh survivor report>');
  const report=await verifyWorldSurvivors(name);await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,visits:report.visits.length,comparisons:report.comparisons}));
}
