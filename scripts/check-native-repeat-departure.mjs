#!/usr/bin/env node
// Original current outgoing load/removal; compare every saved surviving record.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifiedNativeSources} from './lib/native-generation.mjs';
import {verifyRepeatCrossingCapsule} from './prepare-native-repeat-crossing.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {repeatReceivingMembership} from './check-native-repeat-return.mjs';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name,cap=65536){const s=await stoppedFileSource(name);if(s.size>cap)throw Error('Departure metadata exceeds bound');const b=Buffer.alloc(s.size);for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;}
export async function verifyRepeatDeparture(manifestName) {
  const mb=await bounded(manifestName),m=JSON.parse(mb),sources=await verifiedNativeSources(m);
  if(m.repeatOutgoingDeparture!==true||m.observeMotion!==false||m.reloadScheduledNpc!==true||m.activateReturnedNpc!==false||m.departNpc!==true||
    m.scheduleNpc!==false||m.reloadDepartedNpc!==false||m.clockMode!=='pinned'||m.physicalGridExtent!==512)throw Error('Require original outgoing removal mode');
  const profile=await ownedDirectory(m.profile,'actor-arrival-fixture-joint-reload-');assert.equal(profile,join(m.fixture,'frontier_0_0'));
  const cb=await bounded(m.crossingCapsule,32768),capsule=JSON.parse(cb),p=capsule.plan;assert.equal(sha(cb),m.crossingCapsuleSha256);
  await verifyRepeatCrossingCapsule(m.crossingCapsule,{requireCurrent:false});assert.deepEqual([m.unitId,m.agentId],[p.sourceAlias.unitId,p.sourceAlias.agentId]);
  assert.equal(p.geometry.from.widthCells*2,512);assert.equal(p.geometry.from.heightCells*2,512);
  const selected=await verifyRevisionExport(p.receipt,0,p.sourceWorld,{requireCurrent:false});assert.deepEqual(m.selectedRevisionExport,selected);
  const captureBytes=await bounded(m.sourceCaptureReport),capture=JSON.parse(captureBytes);assert.equal(sha(captureBytes),m.sourceCaptureReportSha256);
  assert.equal(m.sourceCaptureReport,p.captureReport);assert.equal(m.sourceCaptureReportSha256,p.captureReportSha256);
  const producer=capture.fixture;assert.notEqual(m.nativePid,producer.nativePid);assert.notEqual(profile,producer.profile);
  const buildBytes=await bounded(m.buildReport),build=JSON.parse(buildBytes);assert.equal(sha(buildBytes),m.buildReportSha256);
  assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);assert.deepEqual(build.nativeSourceSha256,sources);assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256AtLaunch);
  const settings=['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav'],worldName='Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP',
    writerNames=['Unit','GPL','Orders'].map(k=>`Script_Composed_${k}_2101_0.bin`),evidence={};
  assert.deepEqual(Object.keys(m.inputHashes).sort(),[...settings,worldName,'Joint_Reload_Expected.bin',...writerNames].sort());
  for(const [name,digest] of Object.entries(m.inputHashes)){const file=join(profile,name);assert.equal(await hashCheckpointSource(await stoppedFileSource(file)),digest);evidence[file]=digest;if(settings.includes(name))assert.equal(digest,producer.inputHashes[name]);}
  assert.equal(m.inputHashes[worldName],p.sourceWorld);
  const header=await bounded(join(profile,'Joint_Reload_Expected.bin'),16);assert.equal(header.length,16);assert.deepEqual(Array.from({length:4},(_,i)=>header.readUInt32LE(i*4)),[0x31524a4e,1,m.unitId,m.agentId]);
  for(const kind of ['Unit','GPL','Orders']){
    const input=await bounded(join(profile,`Script_Composed_${kind}_2101_0.bin`),2048),file=join(profile,`Joint_Reload_${kind}.bin`),writer=await bounded(file,2048);
    assert.equal(input.length,p.records[kind].size);assert.equal(sha(input),p.records[kind].sha256);assert.deepEqual(writer,input);evidence[file]=sha(writer);
  }
  const input=await repeatReceivingMembership(join(profile,worldName)),directory=join(profile,'Documents/My Games/MajestyHD/SaveGame'),
    before=await repeatReceivingMembership(join(directory,'Joint_Departure_Before.GMP')),after=await repeatReceivingMembership(join(directory,'Joint_Departure_After.GMP'),p.sourceAlias);
  for(const key of ['counts','records','queues','activeQueue'])assert.deepEqual(before[key],input[key],'Original loaded state changed before removal');
  assert.deepEqual(before.counts,{units:p.departure.units,agents:p.departure.agents,attachments:p.departure.attachments});
  const differences={};
  for(const kind of Object.keys(before.records)){
    const wanted={...before.records[kind]},own=kind==='units'?m.unitId:kind==='agents'?m.agentId:'ORDR:'+m.unitId;
    if(!wanted[own])throw Error('Missing original owned record');delete wanted[own];assert.deepEqual(after.records[kind],wanted,'Original removal changed another record');
    assert.equal(after.counts[kind],before.counts[kind]-1);differences[kind]={before:before.counts[kind],after:after.counts[kind],unchanged:after.counts[kind],removed:String(own)};
  }
  assert.equal(before.queues.flat().filter(id=>id===m.agentId).length,1);assert.deepEqual(after.queues,before.queues.map(q=>q.filter(id=>id!==m.agentId)));assert.equal(after.activeQueue,before.activeQueue);
  const log=(await bounded(m.log,1024*1024)).toString('utf8');if(!log.includes('all expectations met')||/result=fail|SIGSEGV|exception e06d7363|undeliverable call(?!s: none)/i.test(log)||
    /^\[streaming\] (Return active|Private return|Joint motion|Joint schedule unit|Joint departed reload)/m.test(log))throw Error('Failed or wrong outgoing native execution');
  const once=line=>assert.equal(log.split('\n').filter(l=>l===line).length,1);
  once(`[streaming] Joint reload unit=${m.unitId} agent=${m.agentId} links=1 unit-written=1 script-written=1 commands-equal=1 scratch-released=1 result=pass`);
  once(`[streaming] Joint scheduled reload unit=${m.unitId} agent=${m.agentId} queued=1 queue-mutated=0 result=pass`);
  once(`[streaming] Joint departure unit=${m.unitId} agent=${m.agentId} deferred=1 unit-absent=1 agent-absent=1 groups=1 rendering=1 queues=1 counters=1 physical=1 reclaimed=1 hooks-same=1 before-saved=1 after-saved=1 result=pass`);
  const loaded=[...log.matchAll(/^\[streaming\] Original load end result=00000000 visits=(\d+) retained=\d+ sample-bytes=\d+$/gm)];assert.equal(loaded.length,1);assert.equal(Number(loaded[0][1]),before.counts.units);
  const resourceRows=[...log.matchAll(/^\[streaming\] Joint departure resources entries=(\d+),(\d+) queued=(\d+),(\d+) deferred=(\d+) heap-bytes=(\d+),(\d+) heap-blocks=(\d+),(\d+) crt-live=(\d+),(\d+) crt-valid=1 actor-queued=(\d+)$/gm)];assert.equal(resourceRows.length,1);
  const [entriesBefore,entriesAfter,queuedBefore,queuedAfter,deferred,heapBytesBefore,heapBytesAfter,heapBlocksBefore,heapBlocksAfter,crtBefore,crtAfter,actorQueued]=resourceRows[0].slice(1).map(Number);
  assert.deepEqual([entriesBefore,entriesAfter,queuedBefore,queuedAfter,deferred,actorQueued],[before.counts.agents,after.counts.agents,before.counts.agents,after.counts.agents,0,1]);
  if(heapBytesAfter>heapBytesBefore||heapBlocksAfter>heapBlocksBefore||crtAfter>=crtBefore)throw Error('Original outgoing resources not reclaimed');
  for(const value of [before,after])evidence[value.filename]=value.sha256;
  for(const name of ['scripts/check-native-repeat-departure.mjs','scripts/run-native-repeat-departure.py','scripts/lib/native-generation.mjs'])sources[name]=sha(await readFile(join(workspace,name)));
  return {qualified:true,scope:'Actual current revision5 outgoing NPC original load and deferred removal on512 grid: exact input writers/saved schedule, three owned records removed, every other record/queue preserved, original physical/drawing/registry/allocator cleanup. Fresh departed reload, paired publication and bounded original region residency remain unqualified.',
    sourceManifest:resolve(manifestName),sourceManifestSha256:sha(mb),fixture:m,identity:p.sourceAlias,before,after,differences,
    resources:{entriesBefore,entriesAfter,queuedBefore,queuedAfter,deferred,heapBytesBefore,heapBytesAfter,heapBlocksBefore,heapBlocksAfter,crtBefore,crtAfter,reclaimedCrtAllocations:crtBefore-crtAfter},
    originalOutgoingRemovalQualified:true,unchangedOtherRecords:Object.values(after.counts).reduce((a,b)=>a+b,0),otherQueuesPreserved:true,originalFootprintDrawingRegistryCleanupQualified:true,
    freshDepartedReloadQualified:false,pairedOwnershipHandoffQualified:false,wholeBrowserMemoryBoundQualified:false,browserUsed:false,nativeProcessesStarted:0,sourceSha256:sources,evidenceSha256:{...evidence,[resolve(manifestName)]:sha(mb),[m.log]:sha(Buffer.from(log))}};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  const [manifest,output]=process.argv.slice(2);if(!manifest||!output||process.argv.length!==4)throw Error('Usage: <terminal outgoing manifest> <fresh output|--stdout>');const r=await verifyRepeatDeparture(manifest);
  if(output==='--stdout')console.log(JSON.stringify(r));else{await writeFile(output,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,identity:r.identity,unchangedOtherRecords:r.unchangedOtherRecords,originalOutgoingRemovalQualified:true}));}
}
