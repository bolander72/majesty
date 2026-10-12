#!/usr/bin/env node
// Prepare a closed linked bundle from the immutable actual crossing evidence.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {resolve,dirname,basename,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {prepareCheckpointHaloHeroBundle} from '../web/world/halo-hero-bundle.mjs';
import {encodeHomeRecord} from '../web/world/hero-home.mjs';
import {Sha256} from '../web/world/sha256.mjs';
const[archiveName,buildName,flagAuditName,directoryName,pendingFlag]=process.argv.slice(2);
assert.ok(process.argv.length===6||process.argv.length===7);
assert.ok(pendingFlag===undefined||pendingFlag==='--pending-reader-build');
const directory=resolve(directoryName),root=resolve('.');
assert.equal(dirname(directory),join(root,'output'));assert.match(basename(directory),/^native-halo-bundle-preparation-[0-9]{3}$/);
await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const json=async name=>{assert.ok((await lstat(name)).size<=256*1024);return JSON.parse(await readFile(name,'utf8'));};
const archive=await json(archiveName);
assert.equal(archive.generation,233);assert.equal(archive.nativeOriginalActorCoreCrossingQualified,true);
assert.equal(archive.nativeSessionTerminal,true);assert.equal(archive.nativeExitCode,0);
for(const row of [...archive.sources,...archive.evidence]){
  assert.ok(resolve(row.preserved).startsWith(dirname(resolve(archiveName))+'/'));
  const h=await hashNativeFile(row.preserved);assert.equal(h.bytes,row.bytes);assert.equal(h.sha256,row.sha256);
}
const evidence=name=>{const rows=archive.evidence.filter(r=>r.original===resolve(name));assert.equal(rows.length,1);return rows[0];};
const crossing=await json(evidence('output/native-halo-crossing-002-observed.json').preserved);
const neighbor=await json(evidence('output/native-halo-region-north-001-observed.json').preserved);
const sourceRow=evidence(crossing.crossingCheckpoint.filename),destinationRow=evidence(neighbor.checkpoint.filename);
assert.equal(sourceRow.sha256,crossing.crossingCheckpoint.sha256);assert.equal(destinationRow.sha256,neighbor.checkpoint.sha256);
const northManifest=await json(evidence(neighbor.manifest).preserved);
assert.equal(northManifest.nativeSessionTerminal,true);assert.equal(northManifest.nativeExitCode,0);assert.equal(northManifest.ownedProducerAbsent,true);
const build=await json(buildName),pending=pendingFlag==='--pending-reader-build';
if(pending){
  assert.equal(build.nativeBuildQualified,false);assert.equal(build.exitCode,null);assert.ok(Number.isInteger(build.buildPid));
  assert.ok(execFileSync('ps',['-axo','pid='],{encoding:'utf8'}).trim().split(/\s+/).map(Number).includes(build.buildPid));
}else{assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);}
const compiled={};for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256'])
  for(const[name,sha256]of Object.entries(build[group])){
    assert.equal(compiled[name],undefined);compiled[name]=sha256;assert.equal((await hashNativeFile(name)).sha256,sha256);
  }
assert.equal(Object.keys(compiled).length,54);assert.ok(compiled['upstream/majesty-recomp/native_actor_profile.h']);
const audit=await json(flagAuditName);assert.equal(audit.qualified,true);assert.equal(audit.factoryKind,4);assert.equal(audit.components,1);
assert.equal(audit.checkpoint.sha256,sourceRow.sha256);
for(const[name,h]of Object.entries(audit.sourceSha256))assert.equal((await hashNativeFile(name)).sha256,h);
const registered={record:crossing.registeredHome,sha256:new Sha256().update(encodeHomeRecord(crossing.registeredHome)).hex()};
const options={heroUnitId:481,flagUnitId:492,registered,proposedUnits:[100000,100001,100002,100003],
  proposedAgents:[1000,1001,1002],regions:{version:'halo-v1',sourceRegion:'0_0',destinationRegion:'0_-1'}};
const source=await stoppedFileSource(sourceRow.preserved);
const prepared=await prepareCheckpointHaloHeroBundle(source,await stoppedFileSource(destinationRow.preserved),options);
assert.equal(prepared.records.length,13);assert.equal(prepared.plan.sourceClockMs,60650);assert.equal(prepared.plan.destinationClockMs,0);
assert.deepEqual(prepared.plan.sourceUnitIds,[481,492,494,495]);
const record=id=>prepared.records.find(r=>r.sourceUnitId===id&&r.type==='unit');
assert.equal(new DataView(record(481).bytes.buffer).getInt32(64,true),8248988);
assert.equal(new DataView(record(492).bytes.buffer).getInt32(64,true),8192000);
for(const[i,id]of [[2,494],[3,495]]){
  assert.deepEqual(Array.from(record(id).bytes.slice(60,72)),
    Array.from(await source.readAt(prepared.plan.sourceRecords[i].record.offset+60,12)));
  assert.equal(new DataView(record(id).bytes.buffer).getUint32(76,true),251);
}
const sourceNames=['scripts/prepare-native-halo-hero-bundle.mjs','web/world/halo-hero-bundle.mjs','web/world/checkpoint.mjs',
  'web/world/halo-hero-orders.mjs','web/world/halo-companion-orders.mjs','web/world/halo-order-navigation.mjs',
  'web/world/hero-order-arrival.mjs','web/world/order-navigation.mjs','web/world/order-entries.mjs',
  'web/world/order-dispatch-clock.mjs','web/world/order-restore-bounds.mjs','web/world/reward-membership.mjs',
  'web/world/remote-home.mjs','web/world/hero-home.mjs','web/world/saved-clock.mjs','web/world/halo-region-layout.mjs',
  'web/world/actor-coordinates.mjs','web/world/terrain.mjs','web/world/terrain-ground.mjs','web/world/sha256.mjs',
  'scripts/lib/stopped-entity-io.mjs','scripts/lib/native-generation.mjs'];
const sourceSha256=Object.fromEntries(await Promise.all(sourceNames.map(async n=>[n,(await hashNativeFile(n)).sha256])));
for(const row of [sourceRow,destinationRow])assert.equal((await hashNativeFile(row.preserved)).sha256,row.sha256);
await mkdir(directory);
// A draft binds the live build's current input snapshot, not a mutable build
// result. The native controller refuses it; regenerate after a successful build.
const boundBuildName=pending?join(directory,'Pending_Reader_Build.json'):resolve(buildName);
if(pending)await writeFile(boundBuildName,JSON.stringify(build,null,2)+'\n',{flag:'wx'});
const records=[];
for(const r of prepared.records){
  const filename=join(directory,r.name);await writeFile(filename,r.bytes,{flag:'wx'});
  const{bytes,...metadata}=r;records.push({...metadata,file:{filename,...(await hashNativeFile(filename))}});
}
const word=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
const tags={unit:0,agent:1,container:2,orders:3,proxy:4};
const pack=Buffer.concat([...[0x3142484d,1,13,60650,0,4877].map(word),
  ...prepared.records.flatMap(r=>[word(tags[r.type]),word(r.sourceUnitId??0),word(r.bytes.length),r.bytes])]);
assert.equal(pack.length,5057);
const packName=join(directory,'Halo_Bundle.pack');await writeFile(packName,pack,{flag:'wx'});
const report={version:1,closedHaloHeroBundlePrepared:true,producerGeneration:233,
  archive:{filename:resolve(archiveName),...(await hashNativeFile(archiveName))},
  build:{filename:boundBuildName,...(await hashNativeFile(boundBuildName))},compiledSourceSha256:compiled,
  readerBuildStatus:pending?'pending':'qualified',nativeReaderReady:!pending,
  flagClassAudit:{filename:resolve(flagAuditName),...(await hashNativeFile(flagAuditName))},
  sourceCheckpoint:sourceRow,destinationCheckpoint:destinationRow,registered,options,records,
  pack:{filename:packName,...(await hashNativeFile(packName))},plan:prepared.plan,sourceSha256,
  maximumReadBytes:4096,nativeProcessesStarted:0,browserUsed:false,nativeReaderExecuted:false,
  actorRewardBundleActivated:false,sourceRetired:false,ownerPublished:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({closedHaloHeroBundlePrepared:true,records:records.length,
  bytes:prepared.records.reduce((n,r)=>n+r.bytes.length,0),nativeReaderExecuted:false,ownerPublished:false}));
