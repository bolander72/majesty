#!/usr/bin/env node
// Independently compare the stopped capsule against the actual original
// Warrior records. This checks preparation, never original actor activation.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {stoppedFileSource,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {checkpointActorRecords,checkpointUnitAgentLinks,checkpointAttachments,
  checkpointContainerEntries,checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const [preparation,auditName,outputName]=process.argv.slice(2);assert.equal(process.argv.length,5);
const hash=async p=>(await hashNativeFile(p)).sha256;
async function json(p){assert.ok((await stat(p)).size<=256*1024);return JSON.parse(await readFile(p,'utf8'));}
const p=await json(preparation),audit=await json(auditName);
assert.equal(p.originalOutdoorHeroGeneratedRegionCapsulePrepared,true);
assert.equal(audit.qualified,true);assert.deepEqual([audit.kind,audit.procedureId,audit.savedBodyWord],[7,0x1003,9]);
for(const proof of [p,audit])for(const [name,h]of Object.entries(proof.sourceSha256))assert.equal(await hash(name),h);
assert.equal(await hash(p.producerArchive),p.producerArchiveSha256);
assert.equal(await hash(p.sourceProof),p.sourceProofSha256);assert.equal(await hash(p.regionalProof),p.regionalProofSha256);
assert.equal(await hash(p.source.file),p.source.sha256);assert.equal(await hash(p.destination.filename),p.destination.sha256);
const directory=await ownedDirectory(p.directory,'actor-arrival-fixture-hero-route-');
const source=await stoppedFileSource(p.source.file),destination=await stoppedFileSource(p.destination.filename);
assert.deepEqual([await checkpointSavedClock(source),await checkpointSavedClock(destination)],[57650,8750]);
assert.equal(p.registeredHomeAgentId,23);
assert.deepEqual(p.attachedUnitBindings,[{from:527,to:100001},{from:528,to:100002},{from:529,to:100003}]);
const actor=await checkpointActorRecords(source,504),ranges={unit:actor.unit,agent:actor.agent};
const ids=new Map([[504,100000],[527,100001],[528,100002],[529,100003]]);
for await(const u of checkpointUnitAgentLinks(source))if(ids.has(u.unitId)&&u.unitId!==504){
  assert.equal(u.parentUnitId,504);assert.equal(u.agentId,0);ranges[`attached_${u.unitId}`]=u;
}
for await(const a of checkpointAttachments(source))if(ids.has(a.unitId)){
  if(a.unitId===504)ranges[a.kind==='ORDR'?'order':'container']=a;
  else {assert.equal(a.kind,'ORDR');ranges[`attached_order_${a.unitId}`]=a;}
}
assert.deepEqual(Object.keys(p.records).sort(),Object.keys(ranges).sort());assert.equal(Object.keys(ranges).length,10);
async function copy(range){
  assert.ok(range.size<=65536);const bytes=Buffer.alloc(range.size);
  for(let at=0;at<bytes.length;at+=4096)bytes.set(await source.readAt(range.offset+at,Math.min(4096,bytes.length-at)),at);
  return bytes;
}
const expected={};for(const [name,range]of Object.entries(ranges))expected[name]=await copy(range);
const set=(name,at,before,after)=>{assert.equal(expected[name].readUInt32LE(at),before);expected[name].writeUInt32LE(after>>>0,at);};
// Exact native writer sites of this pinned outdoor checkpoint; preserve all
// opaque movement, position, health and animation state around these words.
assert.equal(expected.unit.length,442);set('unit',36,504,100000);set('unit',120,28,1000);
for(const [id,to]of [...ids].slice(1)){set(`attached_${id}`,36,id,to);set(`attached_${id}`,56,504,100000);}
assert.equal(actor.agent.agentId,28);
set('agent',actor.agent.size-24-new TextEncoder().encode(actor.agent.name).length,28,1000);
set('agent',actor.agent.size-19,504,100000);
const agentIds=new Map([[28,1000],[7,23]]);
for await(const v of checkpointAgentValues(source,28)){
  if(v.type===5&&v.targetAgentId!==null){assert.ok(agentIds.has(v.bits));set('agent',v.offset-actor.agent.offset,v.bits,agentIds.get(v.bits));}
  if(v.type===8){const at=v.stateOffset-actor.agent.offset,stamp=expected.agent.readUInt32LE(at+4),flags=expected.agent.readUInt32LE(at+8);
    if(flags&0x7f&&!(flags&0x80))set('agent',at+4,stamp,(8750-((57650-stamp)>>>0))>>>0);}
}
// Independent framing constants from the saved bank layout. Leave destinations,
// cached points, cursors, rates, callbacks and the deferred guild469 untouched.
assert.equal(expected.order.length,336);set('order',0,504,100000);set('order',72,57650,8750);set('order',228,57650,8750);
assert.equal(expected.order.readUInt32LE(244),469);assert.equal(expected.order.readUInt32LE(248),0x1003);
const remaining=[450,700,2700];
for(const [i,id]of [527,528,529].entries()){
  const name=`attached_order_${id}`,before=id===527?57600:57350,after=id===527?8700:8450;
  assert.equal(expected[name].length,id===527?244:164);set(name,0,id,ids.get(id));set(name,80,before,after);
  const interval=id===527?500:id===528?1000:3000;
  assert.equal(interval-((8750-after)>>>0),remaining[i]);
}
const c=ranges.container;let homeMember;
set('container',0,504,100000);
for await(const e of checkpointContainerEntries(source))if(e.unitId===504){
  const at=e.offset-c.offset;
  if(e.type==='group'){
    set('container',at+12,504,100000);
    if(e.groupKind===101){assert.equal(e.memberCount,1);set('container',at+4,1,0);}
  }else if(e.groupKind===101){assert.equal(e.targetUnitId,469);assert.equal(homeMember,undefined);homeMember=at;}
  else {assert.ok(ids.has(e.targetUnitId));set('container',at,e.targetUnitId,ids.get(e.targetUnitId));}
}
assert.ok(Number.isInteger(homeMember));
set('container',8,expected.container.readUInt32LE(8),expected.container.readUInt32LE(8)-8);
const sizeAt=c.primary.offset-c.offset+4;
set('container',sizeAt,expected.container.readUInt32LE(sizeAt),expected.container.readUInt32LE(sizeAt)-8);
expected.container=Buffer.concat([expected.container.subarray(0,homeMember),expected.container.subarray(homeMember+8)]);
let total=0;
for(const [name,b]of Object.entries(expected)){
  const r=p.records[name];assert.ok(resolve(r.filename).startsWith(directory+'/'));
  assert.equal(r.bytes,b.length);assert.equal(await hash(r.filename),r.sha256);
  assert.deepEqual(await readFile(r.filename),b,`Unexpected copied record bytes: ${name}`);total+=b.length;
}
assert.equal(total,3753);assert.equal(p.totalRecordBytes,total);
assert.equal(p.plan.nativeActivationQualified,false);assert.equal(p.plan.heroOrders.nativeActivationQualified,false);
assert.equal(p.plan.heroOrders.deferredNativeHomeReferences.length,1);
assert.equal(p.plan.heroOrders.deferredNativeHomeReferences[0].before,469);
assert.equal(p.plan.outdoorEffects.originalProjectedEffectLifetimesQualified,false); //8750 not replayed yet.
assert.equal(p.heroImported,false);assert.equal(p.ownerPublished,false);assert.equal(p.continuousPositionQualified,false);
assert.equal(await hash(p.source.file),p.source.sha256);assert.equal(await hash(p.destination.filename),p.destination.sha256);
await writeFile(outputName,JSON.stringify({version:1,originalOutdoorHeroCapsuleBytesQualified:true,
  preparation:resolve(preparation),preparationSha256:await hash(preparation),audit:resolve(auditName),auditSha256:await hash(auditName),
  records:10,totalRecordBytes:total,commandKinds:[4,7,5,9,9],effectRemainingMs:remaining,
  sourceAndDestinationUnchanged:true,pendingNativeHomeReferences:1,
  originalDestinationEffectLifetimeQualified:false,nativeActivationQualified:false,continuousPositionQualified:false,
  heroImported:false,ownerPublished:false,browserUsed:false,nativeProcessesStarted:0,goalComplete:false,
  sourceSha256:{'scripts/check-native-regional-hero.mjs':await hash(new URL(import.meta.url).pathname)}},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({originalOutdoorHeroCapsuleBytesQualified:true,records:10,totalRecordBytes:total,
  effectRemainingMs:remaining,pendingNativeHomeReferences:1,nativeActivationQualified:false}));
