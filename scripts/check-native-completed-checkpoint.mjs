#!/usr/bin/env node
// Require actual completed ticks and an unchanged save/exit clock, plus full persistence/heap gates.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {verifyWorldHeap} from './check-native-world-heap.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function parseCompletedTickLog(log,visits) {
  const completed=[...log.matchAll(/^\[streaming\] World checkpoint completed visit=(\d+) clock=(\d+) tick=(\d+) entry-tick=(\d+) completed-ticks=(\d+) hook-depth=(\d+) baton=(\d+) result=pass$/gm)];
  const exits=[...log.matchAll(/^\[streaming\] World checkpoint exit visit=(\d+) clock=(\d+) tick=(\d+) saved-clock=(\d+) saved-tick=(\d+) result=pass$/gm)];
  const first=[...log.matchAll(/^\[streaming\] World residency first-tick load=(\d+) tick=(\d+) phase=3 pending=0$/gm)];
  const snapshots=[...log.matchAll(/^\[streaming\] World persistence snapshot visit=(\d+) side=(\d+) stage=after clock=(\d+) .* result=pass$/gm)];
  assert.equal(completed.length,visits.length);assert.equal(exits.length,visits.length);
  assert.equal(first.length,visits.length);assert.equal(snapshots.length,visits.length);
  for(const prefix of ['completed','exit'])assert.equal(log.split('[streaming] World checkpoint '+prefix+' ').length-1,visits.length,'Malformed/extra boundary observation');
  const rows=[];
  for(let i=0;i<visits.length;++i) {
    const c=completed[i],e=exits[i],f=first[i],s=snapshots[i];
    const [visit,clock,tick,entryTick,ticks,depth,baton]=c.slice(1).map(Number);
    assert.deepEqual([visit,ticks,depth,baton],[i,20,0,1]);assert.equal(entryTick+1,tick);
    assert.deepEqual(f.slice(1).map(Number),[i,tick-20]);
    assert.deepEqual(s.slice(1,4).map(Number),[i,(i+1)%2,clock]);
    assert.equal(clock-visits[i].loaded.clock,1000);
    assert.deepEqual(e.slice(1).map(Number),[i,clock,tick,clock,tick]);
    assert.equal(visits[i].beforeExit.clock,clock);assert.equal(visits[i].afterExit.clock,clock);
    const request=log.indexOf(`[streaming] World residency request=${i} `);
    const observe=log.indexOf(`[streaming] World survivors visit=${i} stage=before-exit `);
    assert.ok(f.index<s.index&&s.index<c.index&&c.index<request&&request<e.index&&e.index<observe,'Completed save/exit ordering');
    if(i+1<visits.length)assert.ok(e.index<first[i+1].index);
    rows.push({visit:i,region:visits[i].region,clock,tick,entryTick,completedTicks:ticks,clockGapMs:0,tickGap:0});
  }
  return rows;
}
export async function verifyCompletedCheckpoint(manifestName) {
  const heap=await verifyWorldHeap(manifestName),m=JSON.parse(await readFile(manifestName));
  assert.equal(m.completedWorldTickProbe,true);
  const logBytes=await readFile(m.log);assert.ok(logBytes.length<=1024*1024);assert.equal(sha(logBytes),heap.evidenceSha256[m.log]);
  const rows=parseCompletedTickLog(logBytes.toString('utf8'),heap.visits);
  assert.deepEqual(heap.saveToExitClockGaps.map(r=>r.clockGapMs),Array(rows.length).fill(0));
  const auditName=join(workspace,'output/native-checkpoint-boundary-layout-observed.json'),auditBytes=await readFile(auditName);assert.ok(auditBytes.length<=65536);const audit=JSON.parse(auditBytes);
  assert.equal(audit.qualified,true);assert.equal(audit.version,1);assert.equal(audit.browserUsed,false);assert.equal(audit.nativeProcessesStarted,0);
  assert.equal(audit.originalExecutableSha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
  assert.equal(audit.originalExecutableSha256,(await hashNativeFile(join(workspace,'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'))).sha256);
  assert.equal(audit.scriptSha256,sha(await readFile(join(workspace,'scripts/audit-native-checkpoint-boundary.py'))));
  assert.deepEqual(Object.keys(audit.fragments),['dispatcher','phaseRequest','originalTick']);
  for(const [name,start,end] of [['dispatcher',0x415e40,0x415eeb],['phaseRequest',0x416050,0x4160a0],['originalTick',0x417730,0x417be9]])assert.deepEqual([audit.fragments[name].start,audit.fragments[name].end],[start,end]);
  assert.deepEqual(audit.jumpTables.dispatcher.targets,[0x415e6c,0x415e78,0x415e81,0x415e8a,0x415e93,0x415e8a,0x415e81,0x415e81]);
  assert.deepEqual(audit.jumpTables.request.targets,[0x416083,0x4160a0,0x4160be,0x41612c,0x41612c,0x41612c,0x4160fc,0x416114,0x4160e5]);
  assert.deepEqual(audit.jumpTables.currentPhase.targets,[0x416129,0x41612c,0x41612c,0x416093,0x416129,0x41612c,0x41612c,0x416093,0x416129]);
  assert.equal(audit.contradictoryInstructionControls.length,6);assert.ok(audit.contradictoryInstructionControls.every(c=>c.refused===true));
  return {qualified:true,scope:'Full original saved-state/revisit and heap accounting gates pass. At each actual native visit the diagnostic checkpoint follows return from the original complete tick, with no clock/tick advance through dispatch to teardown. Original pending-exit path and exact surgical adapter addition are audited. Does not prove save-payload purity, every transient reference, continuous world travel, co-op or browser safety.',
    sourceManifest:heap.sourceManifest,sourceManifestSha256:heap.sourceManifestSha256,nativeExecutableSha256:heap.nativeExecutableSha256,
    completedTickCheckpointBoundaryQualified:true,saveToExitClockGapClosed:true,visits:rows,instructionControlsRefused:6,
    heapVisitClocks:heap.visits.map(v=>({visit:v.visit,region:v.region,loaded:{clock:v.loaded.clock},beforeExit:{clock:v.beforeExit.clock},afterExit:{clock:v.afterExit.clock}})),
    heapComparisons:heap.comparisons,nativeResourceSampling:heap.nativeResourceSampling,
    originalPerVisitSaveAndRevisitQualified:true,exactPreTeardownCheckpointQualified:false,originalBoundedRegionResidencyQualified:false,wholeBrowserMemoryBoundQualified:false,
    continuousTravelQualified:false,generatedAdjacentTerrainQualified:false,coopRegionHandoffQualified:false,browserUsed:false,nativeProcessesStarted:0,
    sourceSha256:{...heap.sourceSha256,'scripts/check-native-completed-checkpoint.mjs':sha(await readFile(new URL(import.meta.url))),'scripts/lib/completed-tick-adapter.mjs':sha(await readFile(join(workspace,'scripts/lib/completed-tick-adapter.mjs')))},
    evidenceSha256:{...heap.evidenceSha256,[auditName]:sha(auditBytes)}};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal manifest> <fresh report>');
  const r=await verifyCompletedCheckpoint(name);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,visits:r.visits.length,saveToExitClockGapClosed:r.saveToExitClockGapClosed,heapComparisons:r.heapComparisons}));
}
