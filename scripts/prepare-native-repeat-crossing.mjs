#!/usr/bin/env node
// Prepare the NEXT crossing from actual continued gameplay and its save commit.
import {readFile,writeFile,lstat,mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {prepareNativeRevisionSave} from './publish-native-entity-revision.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {workspace,stoppedFileSource,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {compileNativeCrossing} from './lib/native-crossing-plan.mjs';
import {crossingDeparturePreflight} from './lib/native-crossing-preflight.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const MAX_REPEAT_PLAN_BYTES=32768;
const CODE=['scripts/lib/native-generation.mjs','scripts/prepare-native-repeat-crossing.mjs','scripts/lib/native-crossing-plan.mjs','scripts/lib/native-crossing-preflight.mjs',
  'scripts/lib/native-crossing-order-entries.mjs','scripts/audit-native-order-kind9.py','scripts/check-native-order-writers.py',
  'scripts/publish-native-entity-revision.mjs','scripts/check-native-return-revision-reload.mjs','scripts/export-native-entity-revision.mjs',
  'scripts/lib/native-return-checkpoint.mjs','scripts/lib/native-return-motion.mjs','scripts/lib/stopped-entity-io.mjs',
  'web/world/actor-coordinates.mjs','web/world/order-unit-bindings.mjs','web/world/order-dispatch-clock.mjs','web/world/checkpoint.mjs',
  'web/world/terrain-ground.mjs','web/world/terrain.mjs','web/world/native-height.mjs','web/world/order-entries.mjs',
  'web/world/order-reservations.mjs','web/world/order-restore-bounds.mjs','web/world/order-read-bounds.mjs',
  'web/world/entity-revisions.mjs','web/world/entity-ownership.mjs','web/world/transfer-store.mjs','web/world/checkpoint-lease.mjs'];
async function metadata(name,cap=65536) {
  const s=await stoppedFileSource(name);if(s.size>cap)throw Error('Repeated crossing metadata exceeds bound');
  const b=Buffer.alloc(s.size);for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);
  return {value:JSON.parse(b),sha256:sha(b)};
}
export async function prepareRepeatCrossing(receiptName,publicationName,{requireCurrent=true}={}) {
  if(typeof requireCurrent!=='boolean')throw Error('Invalid repeated crossing receipt mode');
  const rb=await metadata(receiptName,8192),pb=await metadata(publicationName),r=rb.value,pub=pb.value;
  if(pub.qualified!==true||pub.originalEvolvedSavePublicationQualified!==true||pub.dormantWorldUnchanged!==true||r.state.ownerSide!==0||
    r.identity.regions.join(',')!=='0_0,1_0')throw Error('Require published original returned gameplay continuation');
  const p=await prepareNativeRevisionSave(pub.reloadReport,pub.captureReport),c=p.capture;
  assert.equal(pub.reloadReportSha256,p.reloadSha256);assert.equal(pub.captureReportSha256,p.captureSha256);
  assert.equal(pub.previousReceipt,p.oldReceipt);assert.equal(pub.previousRevision,p.receipt.state.revision);
  assert.equal(r.manifest,pub.manifest);assert.deepEqual(r.identity,p.store.identity);assert.equal(r.revisionDirectory,p.receipt.revisionDirectory);
  assert.equal(r.state.revision,p.receipt.state.revision+1);assert.equal(pub.revision,r.state.revision);assert.equal(r.state.kind,'save');
  assert.equal(r.state.previous,sha(Buffer.from(p.receipt.manifest)));assert.equal(r.state.operationId,p.request.operationId);
  assert.equal(r.state.visitedSides,p.request.visitedSides);assert.deepEqual(r.state.aliases,p.request.aliases);
  assert.deepEqual(r.state.referenceBindings,p.request.referenceBindings);assert.deepEqual(r.owner,pub.owner);
  assert.equal(pub.originalClock,c.clock);assert.deepEqual(pub.position,c.after.actor.position);assert.deepEqual(pub.counts,c.after.counts);
  const descriptors=p.request.worlds.map(w=>({size:w.source.size,sha256:w.sha256}));
  assert.deepEqual(r.state.worlds,descriptors);assert.deepEqual(pub.worlds,descriptors);
  assert.equal(c.after.sha256,r.worlds[0].sha256);assert.equal(c.after.size,r.worlds[0].size);
  const auditName=join(workspace,'output/native-order-kind9-audit-observed.json'),audit=await metadata(auditName);
  assert.deepEqual([audit.value.qualified,audit.value.kind,audit.value.fixedBodyBytes,audit.value.completedCalls,audit.value.noLeafUnitTargetField],
    [true,9,96,2,true]);
  assert.deepEqual(audit.value.replays.map(v=>[v.kind,v.fixedBytes,v.payloadBytes,v.words.length]),[[9,96,96,24],[9,96,96,24]]);
  assert.deepEqual(audit.value.replays[0].words,audit.value.replays[1].words);assert.deepEqual(audit.value.replays[0].words.slice(0,4),[1,1,2,9]);
  for(const name of ['scripts/audit-native-order-kind9.py','scripts/check-native-order-writers.py'])
    assert.equal(audit.value.sourceSha256[name],sha(await readFile(join(workspace,name))));
  assert.equal(await hashCheckpointSource(await stoppedFileSource(join(workspace,'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'))),audit.value.executableSha256);
  assert.equal(audit.value.executableSha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
  const exports=[];for(let side=0;side<2;++side)exports.push(await verifyRevisionExport(receiptName,side,r.worlds[side].sha256,{requireCurrent}));
  let reads=0,largestRead=0,activeReads=0,peakReads=0;const sources=[];
  for(const w of exports) {
    const file=await stoppedFileSource(w.filename);sources.push({size:file.size,async readAt(at,n) {
      if(n>4096)throw Error('Unbounded repeated crossing read');++reads;largestRead=Math.max(largestRead,n);peakReads=Math.max(peakReads,++activeReads);
      try{return await file.readAt(at,n);}finally{--activeReads;}
    }});
  }
  const departure=await crossingDeparturePreflight(sources[0],r.state.aliases[0]);
  if(!departure.qualified)throw Error('Repeated crossing has known incoming references or unsupported world commands: '+JSON.stringify({incoming:departure.incoming,unsupported:departure.unsupportedOrders}));
  const compiled=await compileNativeCrossing(r,sources,c.after,c.clock,
    [{originX:0,originY:0,widthCells:256,heightCells:256},{originX:4096,originY:0,widthCells:128,heightCells:128}]);
  const records=compiled.records;
  const plan={version:1,entityId:r.identity.entityId,revision:r.state.revision,manifest:r.manifest,receipt:resolve(receiptName),receiptSha256:rb.sha256,
    publicationReport:resolve(publicationName),publicationReportSha256:pb.sha256,captureReport:pub.captureReport,captureReportSha256:pub.captureReportSha256,
    sourceClock:c.clock,sourceSide:r.state.ownerSide,destinationSide:1-r.state.ownerSide,
    sourceAlias:r.state.aliases[0],retiredDestinationAlias:r.state.aliases[1],sourceWorld:exports[0].sha256,destinationWorld:exports[1].sha256,
    referenceBindings:r.state.referenceBindings,departure,kind9Audit:{filename:auditName,sha256:audit.sha256},
    ...Object.fromEntries(Object.entries(compiled).filter(([k])=>k!=='records')),
    records:Object.fromEntries(Object.entries(records).map(([k,b])=>[k,{size:b.length,sha256:sha(b)}])),
    pending:['Reserve original receiving IDs above both live counters and retired aliases; resolve every symbolic field at that boundary.',
      'Generalize native restoration for this direction, actual receiving leader bindings and 256 navigation grid; rebuild routes through original methods.',
      'Remove outgoing owner through original engine routines, preserve others, resume incoming gameplay and commit both worlds together.'],
    nativeIdsReserved:false,patchesApplied:false,nativeCrossingQualified:false,repeatedGameplayCrossingsQualified:false,
    completeReferenceClosureQualified:false,terrainAdjacencyQualified:false,wholeBrowserMemoryBoundQualified:false};
  const planBytes=Buffer.from(JSON.stringify(plan)+'\n');if(planBytes.length>MAX_REPEAT_PLAN_BYTES)throw Error('Repeated crossing plan exceeds bound');
  for(let side=0;side<2;++side)await verifyRevisionExport(receiptName,side,r.worlds[side].sha256,{requireCurrent});
  return {plan,planBytes,records,io:{reads,largestRead,peakReads}};
}
export async function verifyRepeatCrossingCapsule(reportName,{requireCurrent=true}={}) {
  const {value:r}=await metadata(reportName);
  if(r.qualified!==true||r.nativeCrossingQualified!==false||r.nativeProcessesStarted!==0||r.browserUsed!==false||r.nativeBuildPerformed!==false)
    throw Error('Invalid repeated crossing preparation');
  const dir=await ownedDirectory(r.directory,'actor-arrival-fixture-repeat-crossing-'),p=await prepareRepeatCrossing(r.plan.receipt,r.plan.publicationReport,{requireCurrent});
  assert.deepEqual(r.plan,p.plan);assert.equal(r.planBytes,p.planBytes.length);assert.equal(r.planSha256,sha(p.planBytes));assert.deepEqual(r.io,p.io);
  assert.deepEqual(Object.keys(r.sourceSha256).sort(),[...CODE].sort());
  // These exact stopped-checker versions produced the preserved incoming run.
  // Compiler/native/web dependencies and every plan/record byte remain exact;
  // fresh launches must use current checker code and current receipt guards.
  const historical={
    'scripts/lib/native-generation.mjs':['530e3a4be97f34fe40cb6776a529cb62ee16cd8a5fba89dd1c8a194e9d8fecca','4d38b02afffb5c302b070271bc200f65990ceb42b3686ca174f1e6e606978f5b'],
    'scripts/prepare-native-repeat-crossing.mjs':['b23c4bc8ea97fd9558d1ef1145deac5eaa569ab80b3abb61c2d4fe6c5c62f5b0','4add8a3ef8692ba8dd6b505e804682bf1469c3b7f6e0020e53640a51eebbd036']};
  for(const name of CODE) {
    const current=sha(await readFile(join(workspace,name)));
    if(!requireCurrent&&historical[name]?.includes(r.sourceSha256[name]))continue;
    assert.equal(r.sourceSha256[name],current,'Repeated crossing code provenance differs');
  }
  const stored=await stoppedFileSource(join(dir,'Crossing_Plan.json'));assert.equal(stored.size,p.planBytes.length);
  const bytes=Buffer.alloc(stored.size);for(let at=0;at<bytes.length;at+=4096)bytes.set(await stored.readAt(at,Math.min(4096,bytes.length-at)),at);
  assert.ok(bytes.equals(p.planBytes),'Stored crossing plan bytes differ');
  for(const [name,b] of Object.entries(p.records)) {
    const s=await stoppedFileSource(join(dir,name+'.bin'));assert.equal(s.size,b.length);
    assert.ok(Buffer.from(await s.readAt(0,s.size)).equals(Buffer.from(b)),'Stored crossing '+name+' bytes differ');
  }
  return {qualified:true,entityId:r.plan.entityId,revision:r.plan.revision,planSha256:r.planSha256,nativeCrossingQualified:false};
}
if(resolve(process.argv[1]||'')===resolve(new URL(import.meta.url).pathname)) {
  if(process.argv[2]==='--verify') {
    if(process.argv.length!==4)throw Error('Usage: --verify <current repeated crossing capsule>');console.log(JSON.stringify(await verifyRepeatCrossingCapsule(process.argv[3])));
  } else {
    const [receipt,publication,basename]=process.argv.slice(2);if(process.argv.length!==5||! /^[a-z][a-z0-9-]*$/.test(basename))throw Error('Usage: <current save receipt> <save publication> <fresh output basename>');
    const out=join(workspace,'output',basename+'.json');try{await lstat(out);throw Error('Preserve prior repeated crossing preparations');}catch(e){if(e.code!=='ENOENT')throw e;}
    const p=await prepareRepeatCrossing(receipt,publication),dir=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-repeat-crossing-'));
    for(const [k,b] of Object.entries(p.records))await writeFile(join(dir,k+'.bin'),b,{flag:'wx'});await writeFile(join(dir,'Crossing_Plan.json'),p.planBytes,{flag:'wx'});
    const sourceSha256={};for(const name of CODE)sourceSha256[name]=sha(await readFile(join(workspace,name)));
    await writeFile(out,JSON.stringify({qualified:true,scope:'Read-only next NPC crossing from committed original continuation: exact current records, known departure references, typed relocations/clock ages and receiving ground. Original runtime restoration, IDs, ownership handoff and repeated gameplay crossings remain unqualified.',
      directory:dir,plan:p.plan,planBytes:p.planBytes.length,planSha256:sha(p.planBytes),io:p.io,sourceSha256,
      nativeCrossingQualified:false,browserUsed:false,nativeProcessesStarted:0,nativeBuildPerformed:false},null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({qualified:true,revision:p.plan.revision,sourceClock:p.plan.sourceClock,sourceAlias:p.plan.sourceAlias,
      edits:p.plan.edits.length,records:p.plan.records,largestRead:p.io.largestRead,nativeCrossingQualified:false}));
  }
}
