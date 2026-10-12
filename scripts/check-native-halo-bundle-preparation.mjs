#!/usr/bin/env node
// Exercise bounded stopped-reader corruption controls; never mutate game saves.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {prepareCheckpointHaloHeroBundle} from '../web/world/halo-hero-bundle.mjs';
import {checkpointUnits} from '../web/world/checkpoint.mjs';
const[preparationName,outputName]=process.argv.slice(2);assert.equal(process.argv.length,4);
const output=resolve(outputName);assert.match(outputName,/^output\/native-halo-bundle-controls-[0-9]{3}\.json$/);
await assert.rejects(lstat(output),e=>e.code==='ENOENT');
assert.ok((await lstat(preparationName)).size<256*1024);
const prep=JSON.parse(await readFile(preparationName,'utf8'));
for(const[n,h]of Object.entries(prep.sourceSha256))assert.equal((await hashNativeFile(n)).sha256,h);
for(const row of [prep.sourceCheckpoint,prep.destinationCheckpoint])assert.equal((await hashNativeFile(row.preserved)).sha256,row.sha256);
const source=await stoppedFileSource(prep.sourceCheckpoint.preserved),destination=await stoppedFileSource(prep.destinationCheckpoint.preserved);
const positive=await prepareCheckpointHaloHeroBundle(source,destination,prep.options);
assert.equal(positive.records.length,13);
for(const r of prep.records){
  const actual=positive.records.find(a=>a.name===r.name);assert.ok(actual);
  const h=new Uint8Array(await readFile(r.file.filename));assert.deepEqual(actual.bytes,h);
}
function overlay(at,value,size=4){
  const b=new Uint8Array(size);if(size===4)new DataView(b.buffer).setUint32(0,value,true);else b[0]=value;
  return {size:source.size,async readAt(offset,n){const bytes=Uint8Array.from(await source.readAt(offset,n));
    for(let i=0;i<size;++i)if(at+i>=offset&&at+i<offset+n)bytes[at+i-offset]=b[i];return bytes;}};
}
const unit=(i)=>prep.plan.sourceRecords[i].record;
const hero=prep.records.find(r=>r.type==='agent'&&r.sourceUnitId===481),flag=prep.records.find(r=>r.type==='agent'&&r.sourceUnitId===492);
const home=hero.plan.patches.find(p=>p.reason==='script:home');
const active=hero.plan.patches.find(p=>p.reason==='script dispatch age:activescript');
const heroes=flag.plan.patches.find(p=>p.reason==='script:heroes');
assert.ok(home&&active&&heroes);
let occupied;for await(const u of checkpointUnits(destination)){occupied=u.primary.words[1];break;}
const controls=[];
async function refuse(name,input,options,pattern){
  await assert.rejects(prepareCheckpointHaloHeroBundle(input,destination,options),pattern);controls.push({name,refused:true});
}
await refuse('dead reward',overlay(unit(1).offset+40,549),prep.options,/record shape|living/);
await refuse('foreign effect',overlay(unit(3).offset+52,1),prep.options,/effect/);
await refuse('effect navigation disagrees with parent',overlay(unit(3).offset+76,4),prep.options,/effect navigation/);
await refuse('hero borrows flag as home',overlay(home.offset,21),prep.options,/home differs/);
await refuse('reward script roster points at guild',overlay(heroes.offset,7),prep.options,/script membership/);
await refuse('executing hero script',overlay(active.offset+12,1,1),prep.options,/Executing/);
await refuse('zero dispatch stamp',overlay(active.offset,0),prep.options,/context clock/);
await refuse('guild also owns flag',overlay(prep.plan.sourceGuildRetirement.nativeMembership.offset,492),prep.options,/external.*native reference/);
await refuse('occupied destination native ID',source,{...prep.options,proposedUnits:[occupied,100001,100002,100003]},/Occupied/);
await refuse('occupied destination home agent',source,{...prep.options,proposedAgents:[7,1001,1002]},/Occupied/);
let reads=0;const effect=unit(3);
const changed={size:source.size,async readAt(at,n){const b=Uint8Array.from(await source.readAt(at,n));
  if(at===effect.offset&&n===effect.size&&++reads===2)b[68]^=1;return b;}};
await refuse('source changes after copying',changed,prep.options,/changed during preparation/);
for(const row of [prep.sourceCheckpoint,prep.destinationCheckpoint])assert.equal((await hashNativeFile(row.preserved)).sha256,row.sha256);
const report={version:1,stoppedLinkedBundlePreparationQualified:true,originalReaderExecuted:false,nativeActivationQualified:false,
  preparation:{filename:resolve(preparationName),...(await hashNativeFile(preparationName))},
  recordsMatched:13,controls,sourceUnchanged:true,destinationUnchanged:true,
  sourceSha256:{...prep.sourceSha256,'scripts/check-native-halo-bundle-preparation.mjs':(await hashNativeFile('scripts/check-native-halo-bundle-preparation.mjs')).sha256},
  nativeProcessesStarted:0,browserUsed:false,goalComplete:false};
await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({recordsMatched:13,refusalControls:controls.length,sourceUnchanged:true,nativeProcessesStarted:0}));
