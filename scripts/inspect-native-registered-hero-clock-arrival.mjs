#!/usr/bin/env node
// Exercise the selected real hero pair without launching an engine or changing
// either world. Independent original marker proof is a preparation prerequisite.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,readdir,mkdir} from 'node:fs/promises';
import {join,resolve,dirname,basename} from 'node:path';
import {workspace} from './lib/stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {inspectGeneratedHero} from './inspect-native-generated-hero.mjs';
import {inspectNativeRemoteHome} from './inspect-native-remote-home.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {prepareSelectedRegisteredHeroArrival} from '../web/world/registered-hero-arrival.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointAgentRecordValues,checkpointContainerEntries} from '../web/world/checkpoint.mjs';
import {compareNativeMarkerClocks} from './compare-native-marker-clocks.mjs';
import {Sha256} from '../web/world/sha256.mjs';
const [seedName,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <seed proof> <fresh output directory>');
assert.equal(dirname(resolve(out)),join(workspace,'output'));
assert.match(basename(out),/^registered-hero-clock-arrival-preparation-[0-9]{3}$/);
const pair=await compareNativeMarkerClocks(join(workspace,'output/native-marker-clock-attempt-004.json'),join(workspace,'output/native-marker-clock-attempt-005.json'));
assert.equal(pair.crossClockNewRecruitMarkerQualified,true);
assert.ok((await lstat(seedName)).size<65536);
const seed=JSON.parse(await readFile(seedName,'utf8'));
assert.equal(seed.initialStoppedHeroOwnerQualified,true);
for(const [n,h] of Object.entries(seed.sourceSha256))assert.equal((await hashNativeFile(join(workspace,n))).sha256,h);
const origin=await inspectGeneratedHero(seed.originManifest),remote=await inspectNativeRemoteHome(seed.remoteManifest);
assert.deepEqual(seed.inputs,[origin.save,remote.savedWorld]);
const stats={},io=await stoppedRevisionStorage(seed.fixture,stats);
io.atomicWrite=async()=>{throw Error('Read-only actual hero arrival check');};
const store=await openEntityRevisionStore(io,seed.identity.contentDigest),selected=await store.read();
assert.equal(selected.record.manifest,seed.selectedManifest);assert.deepEqual(selected.owner,seed.selectedOwner);
const before={};for(const name of await readdir(seed.fixture))before[name]=(await hashNativeFile(join(seed.fixture,name))).sha256;
const clocks=await store.withSelected(async s=>{
  const result=[];for(const input of s.sources)result.push(await checkpointSavedClock(input));return result;
});
assert.notEqual(clocks[0],clocks[1]);assert.equal(origin.attachedUnits.length,1);
const request={expectedManifest:selected.record.manifest,freshUnitId:100000,freshAgentId:1000,
  attachedUnitBindings:[{from:origin.attachedUnits[0].unitId,to:100001}]};
const prepared=await prepareSelectedRegisteredHeroArrival(store,request);
assert.deepEqual([prepared.plan.sourceClockMs,prepared.plan.destinationClockMs],clocks);
assert.equal(prepared.plan.version,2);assert.equal(prepared.ownerManifest,selected.record.manifest);
assert.equal(prepared.plan.registeredHome.guildEntityId,seed.identity.registeredHome.guildEntityId);
assert.equal(prepared.plan.registeredHome.occupiedSlots,1);
assert.deepEqual([prepared.plan.registeredHome.source.kind,prepared.plan.registeredHome.destination.kind],['native','proxy']);
assert.equal(prepared.plan.registeredHome.destination.agentId,remote.agentId);
assert.equal(prepared.plan.registeredHome.scriptDeparture.sourceAgentId,origin.home.agent.agentId);
assert.equal(prepared.plan.attachedOrders.length,1);
const marker=prepared.plan.attachedOrders[0];
assert.equal(marker.clockPolicy,'original-newrecruit-preserve-dispatch-age');
assert.equal(marker.markerClock.elapsed,0);assert.equal(marker.markerClock.effectState,0);
assert.equal(marker.markerClock.patches.length,1);assert.equal(marker.markerClock.patches[0].before,25800);
assert.equal(marker.markerClock.patches[0].after,18250);
// Independently reconstruct each untransformed original record plus its exact
// selected edits. CONT101's removal has its separately qualified structural plan.
for(const [name,range] of Object.entries(prepared.plan.ranges)) {
 if(prepared.plan.containerTransforms.some(t=>t.record===name))continue;
 const original=await store.withSelected(s=>s.sources[s.record.state.ownerSide].readAt(range.offset,range.size));
 const expected=Uint8Array.from(original),view=new DataView(expected.buffer);
 for(const e of prepared.plan.edits.filter(e=>e.record===name))view.setUint32(e.offset-range.offset,e.after,true);
 assert.deepEqual(prepared.records[name],expected);
}
assert.equal(new DataView(prepared.records.attached_order_503.buffer).getUint32(80,true),18250);
assert.equal(new DataView(prepared.records.attached_order_503.buffer).getUint32(0,true),100001);
assert.equal(new DataView(prepared.records.attached_503.buffer).getUint32(36,true),100001);
assert.equal(new DataView(prepared.records.attached_503.buffer).getUint32(56,true),100000);
const memory=bytes=>({size:bytes.length,async readAt(at,n){assert.ok(n<=4096&&at>=0&&at+n<=bytes.length);return bytes.slice(at,at+n);}});
const refs=[];
for await(const v of checkpointAgentRecordValues(memory(prepared.records.agent)))
 if(v.type===5)refs.push({attribute:v.attribute,path:v.path,bits:v.bits});
assert.deepEqual(refs,origin.typedScriptReferences.map(v=>({attribute:v.attribute,path:v.path,
 bits:v.bits===origin.actor.unit.agentId?1000:v.bits===origin.home.agent.agentId?45:v.bits})));
function chunk(tag,data=Buffer.alloc(0),version=0,count=0){const h=Buffer.alloc(16);h.write(tag);h.writeUInt32LE(data.length,4);
 h.writeUInt32LE(version,8);h.writeUInt32LE(count,12);return Buffer.concat([h,data]);}
const memberships=[];
const containerFile=Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('ORDR',undefined,1),
 chunk('CONT',prepared.records.container,1,1)]);
for await(const e of checkpointContainerEntries(memory(containerFile)))memberships.push(e);
assert.ok(memberships.every(e=>e.unitId===100000&&e.groupOwnerUnitId===100000));
assert.deepEqual(memberships.filter(e=>e.type==='group').map(e=>[e.groupKind,e.memberCount]).sort((a,b)=>a[0]-b[0]),[[1,1],[101,0]]);
assert.deepEqual(memberships.filter(e=>e.type==='member').map(e=>[e.groupKind,e.targetUnitId,e.flags]),[[1,100001,1]]);
await mkdir(out,{recursive:false});const records={};let total=0;
for(const [name,bytes] of Object.entries(prepared.records)) {
 assert.ok(bytes.length<=65536);total+=bytes.length;
 const filename=join(resolve(out),name+'.bin');await writeFile(filename,bytes,{flag:'wx'});
 records[name]={filename,bytes:bytes.length,sha256:new Sha256().update(bytes).hex()};
 assert.deepEqual(Uint8Array.from(await readFile(filename)),bytes);
}
assert.ok(total<=256*1024);
for(const [name,h] of Object.entries(before))assert.equal((await hashNativeFile(join(seed.fixture,name))).sha256,h);
assert.deepEqual(await readdir(seed.fixture),Object.keys(before));assert.ok(stats.largestRead<=4096&&stats.peakReads===1);
const report={version:1,scope:'Real selected recruited source002 hero and Newrecruit effect prepare for native059 neighboring pure guild proxy using actual clocks25800/18250. Full inert original actor/effect/order records preserve qualified animation state, rebased timestamp, registered home and one logical slot. No native destination reservation/import, source departure or ownership publication.',
  selectedRealHeroPairChecked:true,sourceClocksMs:clocks,owner:selected.owner,ownerManifest:selected.record.manifest,
  preparedRealRegisteredHeroCapsuleQualified:true,plan:prepared.plan,records,totalRecordBytes:total,
  markerClockPair:pair,attachedUnitId:origin.attachedUnits[0].unitId,retainedFiles:Object.keys(before).length,
  sourceWorldsUnchanged:true,selectedOwnerUnchanged:true,largestRead:stats.largestRead,peakReads:stats.peakReads,
  seedProof:resolve(seedName),seedProofSha256:(await hashNativeFile(seedName)).sha256,
  originManifest:seed.originManifest,remoteManifest:seed.remoteManifest,sourceSha256:{},
  nativeProcessesStarted:0,nativeBuildPerformed:false,browserUsed:false,
  crossClockAttachedMarkerPreparationQualified:true,destinationEffectImportQualified:false,heroCrossingQualified:false,remoteHomeRoutingQualified:false};
for(const name of ['web/world/arrival.mjs','web/world/registered-hero-arrival.mjs','web/world/saved-clock.mjs',
  'scripts/inspect-native-registered-hero-clock-arrival.mjs','web/world/newrecruit-marker-clock.mjs'])report.sourceSha256[name]=(await hashNativeFile(join(workspace,name))).sha256;
await writeFile(join(out,'arrival-preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({preparedRealRegisteredHeroCapsuleQualified:true,sourceClocksMs:clocks,totalRecordBytes:total,sourceWorldsUnchanged:true,heroCrossingQualified:false,browserUsed:false}));
