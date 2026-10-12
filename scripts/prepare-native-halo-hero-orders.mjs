#!/usr/bin/env node
// Prepare the actual crossing's original-reader banks without starting a game.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inspectNativeHaloCrossing} from './inspect-native-halo-crossing.mjs';
import {inspectNativeHaloRegion} from './inspect-native-halo-region.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {prepareCheckpointHaloHeroOrders} from '../web/world/halo-hero-orders.mjs';
import {checkpointUnitAgentLinks,checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';

const[crossingName,neighborName,auditName,outputPrefix]=process.argv.slice(2);
assert.equal(process.argv.length,6);
assert.match(outputPrefix,/^output\/native-halo-orders-[0-9]{3}$/);
const output=resolve(outputPrefix+'.json'),payloadName=resolve(outputPrefix+'.bin');
for(const name of [output,payloadName])await assert.rejects(lstat(name),e=>e.code==='ENOENT');
const readJson=async name=>{assert.ok((await lstat(name)).size<=256*1024);return JSON.parse(await readFile(name,'utf8'));};
const crossing=await readJson(crossingName),neighbor=await readJson(neighborName),audit=await readJson(auditName);
assert.deepEqual(await inspectNativeHaloCrossing(crossing.manifest),crossing);
assert.deepEqual(await inspectNativeHaloRegion(neighbor.manifest),neighbor);
assert.equal(crossing.nativeOriginalActorCoreCrossingQualified,true);assert.equal(neighbor.region,'0_-1');
assert.equal(audit.qualified,true);assert.equal(audit.verifiedInstructionAnchors,18);
assert.equal(audit.executableSha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
assert.equal((await hashNativeFile('upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')).sha256,audit.executableSha256);
const writers=await readJson('output/native-order-writers-emulated-observed.json');assert.equal(writers.qualified,true);
assert.equal(writers.executableSha256,audit.executableSha256);
for(const[name,sha256]of Object.entries(writers.sourceSha256))assert.equal((await hashNativeFile(name)).sha256,sha256);
const moves=writers.replays.filter(r=>r.kind===2);assert.equal(moves.length,2);
for(const r of moves)assert.deepEqual(r.words.slice(26,29),[0x1100003c,0x11000040,0x11000044]);
const sources=await Promise.all([crossing.crossingCheckpoint,neighbor.checkpoint].map(r=>stoppedFileSource(r.filename)));
const result=await prepareCheckpointHaloHeroOrders(...sources,481,
  {version:'halo-v1',sourceRegion:'0_0',destinationRegion:'0_-1'});
const p=result.plan,v=new DataView(result.payload.buffer,result.payload.byteOffset,result.payload.length);
assert.equal(result.payload.length,564);assert.equal(result.preparedAttachment.length,600);
assert.deepEqual(p.banks.map(b=>b.count),[2,1,0]);assert.deepEqual(p.entries.map(e=>e.kind),[2,4,7]);
assert.equal(p.patches.length,16);assert.equal(p.haloNavigation.coordinates,13);assert.equal(p.groundSamples,13);
assert.equal(p.sourceClockMs,60650);assert.equal(p.destinationClockMs,0);assert.equal(p.allocationRequestBytes,560);
// Expected original-reader offsets are independently derived from the actual
// native framing: three banks, three prefixes, fixed176/140/112, ten+one points.
assert.deepEqual([v.getInt32(120,true),v.getInt32(124,true),v.getInt32(128,true)],[7372800,8224768,106240]);
assert.deepEqual([v.getInt32(304,true),v.getInt32(308,true)],[3072,4000]);
assert.deepEqual([v.getInt32(320,true),v.getUint32(328,true),v.getUint32(336,true)],[1,10,10]);
const expectedPath=[[226,252],[225,251],[224,250],[223,250],[222,250],[221,250],[220,250],[219,250],[218,250],[217,250]];
for(let i=0;i<10;++i)assert.deepEqual([v.getInt32(340+i*8,true),v.getInt32(344+i*8,true)],expectedPath[i]);
assert.deepEqual([v.getInt32(548,true),v.getInt32(552,true)],[3072,4000]);
assert.deepEqual([v.getUint32(36,true),v.getUint32(220,true),v.getUint32(456,true)],[0,0xffffff38,0xffffff38]);
const original=await sources[0].readAt(p.attachment.offset,p.attachment.size),editedBytes=new Set();
for(const edit of p.patches)for(let n=0;n<4;++n)editedBytes.add(edit.offset-p.attachment.offset+n);
for(let n=0;n<original.length;++n)if(!editedBytes.has(n))assert.equal(result.preparedAttachment[n],original[n]);
for(let i=0;i<sources.length;++i){const r=i?neighbor.checkpoint:crossing.crossingCheckpoint;
  assert.equal((await hashNativeFile(r.filename)).sha256,r.sha256);}
const attachedEffects=[];
for await(const unit of checkpointUnitAgentLinks(sources[0]))if(unit.parentUnitId===481){
  assert.equal(unit.agentId,0);assert.equal(unit.family,'VHCL');const commands=[];
  for await(const e of checkpointActorOrderEntries(sources[0],unit.unitId))if(e.type==='entry')
    commands.push({kind:e.kind,bank:e.bank,index:e.index,when:e.words[5],delta:e.words[6],
      rate:e.words[4],callback:e.words[10],elapsed:(p.sourceClockMs-e.words[5])>>>0});
  attachedEffects.push({unitId:unit.unitId,description:unit.description,stateFlags:unit.stateFlags,
    parentUnitId:unit.parentUnitId,bytes:unit.size,commands});
}
assert.deepEqual(attachedEffects.map(e=>[e.unitId,e.description,e.commands[0].rate,e.commands[0].elapsed]),
  [[494,0x31475241,1000,200],[495,0x34475241,2500,200]]);
let rewardOrderRefusal;
try{for await(const e of checkpointActorOrderEntries(sources[0],crossing.flag.unitId)){} }
catch(e){if(e.code!=='NATIVE_ORDER_KIND_UNSUPPORTED')throw e;
  rewardOrderRefusal={code:e.code,kind:e.kind,offset:e.offset};}
assert.equal(rewardOrderRefusal?.kind,12);
const scriptReferences=[];
for(const agentId of [17,21])for await(const v of checkpointAgentValues(sources[0],agentId))
  if(v.type===5&&v.targetAgentId)scriptReferences.push({agentId,attribute:v.attribute,path:v.path,targetAgentId:v.targetAgentId});
const sourceNames=['scripts/prepare-native-halo-hero-orders.mjs','scripts/audit-native-inflight-move.py',
  'scripts/inspect-native-halo-crossing.mjs','scripts/inspect-native-halo-region.mjs',
  'scripts/lib/stopped-entity-io.mjs','scripts/lib/native-generation.mjs','web/world/checkpoint.mjs',
  'web/world/order-entries.mjs','web/world/order-navigation.mjs','web/world/order-unit-bindings.mjs',
  'web/world/order-dispatch-clock.mjs','web/world/order-callbacks.mjs','web/world/order-restore-bounds.mjs',
  'web/world/hero-order-arrival.mjs','web/world/halo-order-navigation.mjs','web/world/halo-hero-orders.mjs',
  'web/world/halo-region-layout.mjs','web/world/actor-coordinates.mjs','web/world/terrain.mjs',
  'web/world/terrain-ground.mjs','web/world/native-height.mjs','web/world/saved-clock.mjs','web/world/sha256.mjs'];
const report={version:1,originalCrossingNavigationPayloadPrepared:true,
  proofs:await Promise.all([crossingName,neighborName,auditName,'output/native-order-writers-emulated-observed.json']
    .map(async name=>({filename:resolve(name),...(await hashNativeFile(name))}))),
  sourceCheckpoint:crossing.crossingCheckpoint,destinationCheckpoint:neighbor.checkpoint,
  hero:{unitId:481,agentId:17},registeredHome:crossing.registeredHome,plan:p,
  bundleDependencies:{reward:{...crossing.flag,orderRefusal:rewardOrderRefusal},attachedEffects,scriptReferences},
  expectedPath,payload:{filename:payloadName,bytes:result.payload.length,sha256:p.payloadSha256},
  sourceSha256:Object.fromEntries(await Promise.all(sourceNames.map(async name=>[name,(await hashNativeFile(name)).sha256]))),
  maximumReadBytes:4096,nativeProcessesStarted:0,browserUsed:false,
  nativeReaderExecuted:false,actorRewardBundleComplete:false,destinationCollisionQualified:false,
  sourceRetired:false,ownershipTransferQualified:false,goalComplete:false};
await writeFile(payloadName,result.payload,{flag:'wx'});
await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({originalCrossingNavigationPayloadPrepared:true,bytes:result.payload.length,
  originalCommands:3,groundSamples:p.groundSamples,coordinateEdits:p.haloNavigation.patches.length,
  nativeReaderExecuted:false,sourceRetired:false}));
