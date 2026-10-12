#!/usr/bin/env node
// Use the frozen producer generation after changing current native sources.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {prepareCheckpointHaloCompanionOrders} from '../web/world/halo-companion-orders.mjs';
const[anchorName,buildName,auditName,outputPrefix]=process.argv.slice(2);
assert.equal(process.argv.length,6);assert.match(outputPrefix,/^output\/native-halo-companion-orders-[0-9]{3}$/);
const output=resolve(outputPrefix+'.json');await assert.rejects(lstat(output),e=>e.code==='ENOENT');
const json=async name=>{assert.ok((await lstat(name)).size<=256*1024);return JSON.parse(await readFile(name,'utf8'));};
const check=async row=>{const h=await hashNativeFile(row.preserved??row.filename);assert.equal(h.bytes,row.bytes);assert.equal(h.sha256,row.sha256);};
const anchor=await json(anchorName),oldName=anchor.nativeSourceGeneration.filename;
assert.equal((await hashNativeFile(oldName)).sha256,anchor.nativeSourceGeneration.sha256);
const frozen=await json(oldName);assert.equal(frozen.generation,233);assert.equal(frozen.nativeSessionTerminal,true);
for(const row of [...frozen.sources,...frozen.evidence]){
  assert.ok(resolve(row.preserved).startsWith(dirname(resolve(oldName))+'/'));await check(row);
}
const evidence=original=>{const rows=frozen.evidence.filter(r=>r.original===resolve(original));assert.equal(rows.length,1);return rows[0];};
const crossing=await json(evidence('output/native-halo-crossing-002-observed.json').preserved);
const neighbor=await json(evidence('output/native-halo-region-north-001-observed.json').preserved);
assert.equal(crossing.nativeOriginalActorCoreCrossingQualified,true);assert.equal(crossing.nativeExitCode,0);
assert.equal(neighbor.region,'0_-1');
const neighborManifestRow=evidence(neighbor.manifest),neighborManifest=await json(neighborManifestRow.preserved);
assert.equal(neighborManifestRow.sha256,neighbor.manifestSha256);
assert.equal(neighborManifest.nativeExitCode,0);assert.equal(neighborManifest.nativeSessionTerminal,true);
assert.equal(neighborManifest.ownedProducerAbsent,true);
const sourceRow=evidence(crossing.crossingCheckpoint.filename),destinationRow=evidence(neighbor.checkpoint.filename);
assert.equal(sourceRow.sha256,crossing.crossingCheckpoint.sha256);assert.equal(destinationRow.sha256,neighbor.checkpoint.sha256);
const build=await json(buildName);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
const compiled={};for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256'])
  for(const[name,sha256]of Object.entries(build[group])){assert.equal(compiled[name],undefined);compiled[name]=sha256;assert.equal((await hashNativeFile(name)).sha256,sha256);}
assert.equal(Object.keys(compiled).length,54);
assert.ok(compiled['upstream/majesty-recomp/native_actor_profile.h']);
const audit=await json(auditName);assert.equal(audit.qualified,true);assert.equal(audit.completedCalls,2);
assert.equal(audit.objectBytes,72);assert.equal(audit.frameStatePreservationQualified,true);
for(const[name,sha256]of Object.entries(audit.sourceSha256))assert.equal((await hashNativeFile(name)).sha256,sha256);
const sources=await Promise.all([sourceRow,destinationRow].map(r=>stoppedFileSource(r.preserved)));
const prepared=await prepareCheckpointHaloCompanionOrders(...sources,481,492);
assert.deepEqual(prepared.records.map(r=>[r.unitId,r.payload.length,r.plan.allocationRequestBytes]),
  [[492,332,287],[494,128,161],[495,128,161]]);
assert.deepEqual(prepared.records.map(r=>r.plan.dispatch.headers.map(h=>h.elapsed)),[[50,0],[200],[200]]);
const names=prepared.records.map(r=>resolve(`${outputPrefix}-${r.unitId}.bin`));
for(const name of names)await assert.rejects(lstat(name),e=>e.code==='ENOENT');
const records=prepared.records.map((r,i)=>({unitId:r.unitId,profile:r.profile,plan:r.plan,
  payload:{filename:names[i],bytes:r.payload.length,sha256:r.plan.payloadSha256}}));
for(const r of [sourceRow,destinationRow])await check(r);
const sourceNames=['scripts/prepare-native-halo-companion-orders.mjs','web/world/halo-companion-orders.mjs',
  'web/world/checkpoint.mjs','web/world/reward-membership.mjs','web/world/order-entries.mjs',
  'web/world/order-dispatch-clock.mjs','web/world/order-restore-bounds.mjs','web/world/saved-clock.mjs',
  'web/world/sha256.mjs','scripts/lib/stopped-entity-io.mjs','scripts/lib/native-generation.mjs'];
const report={version:1,originalCrossingCompanionPayloadsPrepared:true,
  producerGeneration:233,readerBuild:resolve(buildName),readerBuildSha256:(await hashNativeFile(buildName)).sha256,
  compiledSourceSha256:compiled,proofs:await Promise.all([anchorName,oldName,auditName].map(async filename=>({filename:resolve(filename),...(await hashNativeFile(filename))}))),
  sourceCheckpoint:sourceRow,destinationCheckpoint:destinationRow,hero:{unitId:481,agentId:17},flag:{unitId:492,agentId:21},
  sourceClockMs:60650,destinationClockMs:0,records,
  sourceSha256:Object.fromEntries(await Promise.all(sourceNames.map(async name=>[name,(await hashNativeFile(name)).sha256]))),
  maximumReadBytes:4096,nativeProcessesStarted:0,browserUsed:false,
  nativeReaderExecuted:false,originalProjectedLifetimeQualified:false,actorRewardBundleComplete:false,
  sourceRetired:false,ownershipTransferQualified:false,goalComplete:false};
for(let i=0;i<records.length;++i)await writeFile(names[i],prepared.records[i].payload,{flag:'wx'});
await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({originalCrossingCompanionPayloadsPrepared:true,records:records.length,
  payloadBytes:prepared.records.reduce((n,r)=>n+r.payload.length,0),nativeReaderExecuted:false,sourceRetired:false}));
