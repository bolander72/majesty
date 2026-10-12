#!/usr/bin/env node
// Consume the actual held home request into records for its original home world.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {inspectNativeOutdoorFamilyHomeRoute} from './inspect-native-outdoor-family-home-route.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointActorRecords,checkpointAgentRecord,checkpointAgentRecordValues,checkpointAttachments} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const [proofName,directory]=process.argv.slice(2);assert.equal(process.argv.length,4);
const hash=async n=>(await hashNativeFile(n)).sha256;
const proof=JSON.parse(await readFile(proofName,'utf8'));
assert.deepEqual(await inspectNativeOutdoorFamilyHomeRoute(proof.manifest),proof);
const archiveName=resolve('output/native-outdoor-family-home-route-generation-139-preserved.json');
const archive=JSON.parse(await readFile(archiveName,'utf8'));
assert.equal(archive.artifactPreserved,true);assert.equal(archive.nativeExecutable.sha256,proof.nativeExecutableSha256);
assert.equal(archive.evidence[resolve(proofName)].sha256,await hash(proofName));
const m=JSON.parse(await readFile(proof.manifest,'utf8')),base=JSON.parse(await readFile(m.preparation,'utf8'));
assert.equal(await hash(base.basePreparation),base.basePreparationSha256);
const originalPreparation=JSON.parse(await readFile(base.basePreparation,'utf8'));
const source=await stoppedFileSource(base.source.filename);
assert.equal(await hash(base.source.filename),base.source.sha256);assert.equal(await checkpointSavedClock(source),57650);
const request=proof.homeRequest;
assert.deepEqual([request.homeRegion,request.homeUnitId,request.homeAgentId,request.pauseAnchorClockMs],['0_0',469,7,24250]);
assert.equal(request.entityId,JSON.parse(await readFile(base.pairPublication,'utf8')).identity.entityId);
const hero=await checkpointActorRecords(source,504),guild=await checkpointActorRecords(source,469);
assert.deepEqual([hero.agent.agentId,guild.agent.agentId,guild.unit.description],[28,7,0x31564241]);
const out=resolve(directory);await mkdir(out);const records=[];
async function emit(name,b,detail={}){
  const filename=join(out,name);await writeFile(filename,b,{flag:'wx'});
  const f=await hashNativeFile(filename);records.push({filename,bytes:f.bytes,sha256:f.sha256,...detail});
}
const held=async suffix=>{
  const filename=join(m.profile,'Family_Route_After_'+suffix),r=m.records.find(r=>r.filename===filename);
  assert(r);assert.equal(await hash(filename),r.sha256);assert.equal(archive.evidence[filename].sha256,r.sha256);
  return readFile(filename);
};
const sourceIds=[504,527,528,529],receivingIds=[proof.heroId,...proof.effectIds];
const attachments=new Map();for await(const a of checkpointAttachments(source))if(sourceIds.includes(a.unitId))attachments.set(`${a.kind}:${a.unitId}`,a);
for(let i=0;i<4;++i){
  const b=Buffer.from(await held(sourceIds[i]+'.UNIT'));
  assert.equal(b.readUInt32LE(36),receivingIds[i]);b.writeUInt32LE(sourceIds[i],36);
  assert.equal(b.readUInt32LE(56),i?proof.heroId:0);b.writeUInt32LE(i?504:0,56);
  if(!i){
    let at=92+(b.readUInt32LE(80)?16:0);assert.equal(b.readUInt32LE(at),1);const count=b.readUInt32LE(at+4);at+=8;let found=0;
    for(let k=0;k<count;++k,at+=8)if(b.readUInt32LE(at)===0x4541){assert.equal(b.readUInt32LE(at+4),proof.agentId);b.writeUInt32LE(28,at+4);found++;}
    assert.equal(found,1);
  }
  const original=i?base.units.find(u=>u.unitId===sourceIds[i]):hero.unit;
  assert.deepEqual(b,Buffer.from(await source.readAt(original.offset,original.size)));
  await emit(`Family_Proposal_${sourceIds[i]}.UNIT`,b,{kind:'UNIT',heldUnitId:receivingIds[i]});
  const orders=Buffer.from(await held(sourceIds[i]+'_Orders.bin'));
  const a=attachments.get(`ORDR:${sourceIds[i]}`);assert(a);
  const originalOrders=Buffer.from(await source.readAt(a.primary.offset+16,a.primary.size));
  const baseOrder=originalPreparation.records.find(r=>basename(r.filename)===`Family_Proposal_${sourceIds[i]}_Orders.bin`);assert(baseOrder);
  const patches=[];
  for(const p of baseOrder.clockPatches){
    const offset=p.offset-(a.primary.offset+16);assert.equal(orders.readUInt32LE(offset),p.after);
    // The actor was held at24250. World25300 must not age its saved effects.
    const after=(57650-((request.pauseAnchorClockMs-p.after)>>>0))>>>0;
    assert.equal(after,p.before);orders.writeUInt32LE(after,offset);patches.push({offset,before:p.after,after});
  }
  assert.deepEqual(orders,originalOrders);
  await emit(`Family_Proposal_${sourceIds[i]}_Orders.bin`,orders,{kind:'ORDR',clockPatches:patches});
}
const script=Buffer.from(await held('Agent.GPL')),mem={size:script.length,async readAt(at,n){return Uint8Array.from(script.subarray(at,at+n));}};
const agent=await checkpointAgentRecord(mem);assert.deepEqual([agent.agentId,agent.unitId],[proof.agentId,proof.heroId]);
const contexts=[];for await(const v of checkpointAgentRecordValues(mem)){
  if(v.type===5&&v.targetAgentId){assert([proof.agentId,45].includes(v.targetAgentId));script.writeUInt32LE(v.targetAgentId===proof.agentId?28:7,v.offset);}
  if(v.type===8){const state=Array.from({length:4},(_,i)=>script.readUInt32LE(v.stateOffset+i*4));contexts.push({attribute:v.attribute,state,functions:v.functions.map(f=>f.name)});}
}
assert.equal(contexts.length,12);const active=contexts.filter(c=>c.state[2]);assert.equal(active.length,1);
assert.deepEqual(active[0],{attribute:'activescript',state:[300,57650,2,0],functions:['travel_to']});
for(const c of contexts.filter(c=>!c.state[2]))assert.deepEqual(c.state,[0,0,0,0]);
script.writeUInt32LE(28,script.length-24-Buffer.byteLength(agent.name));script.writeUInt32LE(504,script.length-19);
assert.deepEqual(script,Buffer.from(await source.readAt(hero.agent.offset,hero.agent.size)));
await emit('Family_Proposal_Agent.GPL',script,{kind:'GPL',contexts});
const cont=attachments.get('CONT:504');assert(cont);const full=Buffer.from(await source.readAt(cont.primary.offset+16,cont.primary.size));
assert.deepEqual(Array.from({length:18},(_,i)=>full.readUInt32LE(i*4)),[1,2,1,1,101,504,469,1,1,3,1,504,527,1,528,1,529,1]);
const internal=Buffer.from(await held('Container.bin'));internal.writeUInt32LE(504,20);
for(let i=1;i<4;i++){assert.equal(internal.readUInt32LE(16+i*8),receivingIds[i]);internal.writeUInt32LE(sourceIds[i],16+i*8);}
assert.deepEqual(internal.subarray(8),full.subarray(32));
await emit('Family_Proposal_Container.bin',full,{kind:'CONT-home-and-children'});
await emit('Family_Source_Container.bin',full,{kind:'CONT-pending-home'});
const binding=Buffer.alloc(48);[0x31525246,1,57650,504,28,469,7,24250,proof.heroId,proof.agentId,0,0].forEach((v,i)=>binding.writeUInt32LE(v,i*4));
await emit('Family_Return_Binding.bin',binding,{kind:'registered-home-return-binding'});
await emit('Family_Return_Request.json',Buffer.from(JSON.stringify(request)+'\n'),{kind:'ordinary-native-home-request'});
const result={version:1,outdoorFamilyPreparationQualified:true,homeReturnPreparationQualified:true,
  source:base.source,destination:base.source,sourceClockMs:24250,destinationClockMs:57650,
  scriptClockAnchorMs:57650,scriptContexts:contexts,scriptClockChanged:false,request,
  homeRouteProof:resolve(proofName),homeRouteProofSha256:await hash(proofName),
  homeRouteArchive:archiveName,homeRouteArchiveSha256:await hash(archiveName),
  preparation:m.preparation,preparationSha256:m.preparationSha256,
  sourceProof:base.sourceProof,sourceProofSha256:base.sourceProofSha256,
  pairPublication:base.pairPublication,pairPublicationSha256:base.pairPublicationSha256,
  effectClockProof:base.effectClockProof,effectClockProofSha256:base.effectClockProofSha256,
  settingsProfile:base.settingsProfile,inputHashes:base.inputHashes,records,
  sourceSha256:Object.fromEntries(await Promise.all(['scripts/prepare-native-outdoor-family-return.mjs','web/world/checkpoint.mjs'].map(async n=>[n,await hash(n)]))),
  nativeHomeRestorationQualified:false,ordinaryGuildEntryQualified:false,selectedOwnerPublished:false,browserUsed:false};
await writeFile(join(out,'prepared.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({homeReturnPreparationQualified:true,records:records.length,pausedOrderAgePreserved:true,scriptClockAnchorMs:57650}));
