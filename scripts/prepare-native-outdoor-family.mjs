#!/usr/bin/env node
// Actual outdoor records for original restoration in a copied receiving kingdom.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointActorRecords,checkpointUnitAgentLinks,checkpointAttachments,
  checkpointContainerEntries,checkpointAgents,checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointActorOrderEntries} from './lib/native-crossing-order-entries.mjs';
const [directory]=process.argv.slice(2); assert.equal(process.argv.length,3);
const hash=async n=>(await hashNativeFile(n)).sha256;
const sourcePrepName='output/native-queue-entry-preparation-001/prepared.json';
const sourcePrep=JSON.parse(await readFile(sourcePrepName,'utf8'));
assert.equal(await hash(sourcePrep.source.filename),sourcePrep.source.sha256);
assert.equal(await hash(sourcePrep.sourceProof),sourcePrep.sourceProofSha256);
const proof=JSON.parse(await readFile(sourcePrep.sourceProof,'utf8'));
assert.equal(proof.originalHeroOutdoorDepartureStateQualified,true);
assert.equal(await hash(proof.manifest),proof.manifestSha256);
const manifest=JSON.parse(await readFile(proof.manifest,'utf8'));
assert.equal(manifest.nativeSessionTerminal,true);assert.equal(manifest.nativeExitCode,0);
try {process.kill(manifest.nativePid,0);throw Error('Source producer still live');}
catch(error){if(error.code!=='ESRCH')throw error;}
const pairName='output/native-hero-return-pair-001-published.json';
const pair=JSON.parse(await readFile(pairName,'utf8'));
assert.equal(pair.actualRegisteredHeroStoppedReturnPairPublished,true);
const destination=pair.inputs[1];assert.equal(await hash(destination.filename),destination.sha256);
const source=await stoppedFileSource(sourcePrep.source.filename),receiving=await stoppedFileSource(destination.filename);
assert.equal(await checkpointSavedClock(source),57650);assert.equal(await checkpointSavedClock(receiving),24250);
let proxy;for await(const a of checkpointAgents(receiving))if(a.agentId===45)proxy=a;
assert(proxy);assert.equal(proxy.unitId,0);assert.equal(proxy.deleted,false);
// UNIT IDs are local to each region; source IDs can already name unrelated
// receiving actors. Require the retired logical owner's aliases absent, and
// let original receiving constructors reserve fresh identities for this family.
for await(const u of checkpointUnitAgentLinks(receiving))assert(![554,555].includes(u.unitId));
const hero=await checkpointActorRecords(source,504);assert.equal(hero.agent.agentId,28);assert.equal(hero.unit.size,442);
const ids=[504,527,528,529],descriptions=[0x314c5641,0x32485241,0x31475241,0x33475241];
const units=[hero.unit];for await(const u of checkpointUnitAgentLinks(source))if(ids.slice(1).includes(u.unitId))units.push(u);
units.sort((a,b)=>ids.indexOf(a.unitId)-ids.indexOf(b.unitId));assert.equal(units.length,4);
for(let i=0;i<4;++i){assert.equal(units[i].description,descriptions[i]);assert.equal(units[i].parentUnitId,i?504:0);}
for await(const v of checkpointAgentValues(source,28))if(v.type===5&&v.targetAgentId)assert([7,28].includes(v.targetAgentId));
const effectProofName='output/native-hero-effect-clocks-001-observed.json';
const effectProof=JSON.parse(await readFile(effectProofName,'utf8'));
assert.equal(effectProof.originalOutdoorHeroEffectClocksQualified,true);
for(const[n,h]of Object.entries(effectProof.sourceSha256))assert.equal(await hash(n),h);
const out=resolve(directory);await mkdir(out);const records=[];
async function emit(name,bytes,detail={}){
  const filename=join(out,name);await writeFile(filename,bytes,{flag:'wx'});
  const file=await hashNativeFile(filename);records.push({filename,bytes:file.bytes,sha256:file.sha256,...detail});
}
for(const u of units)await emit(`Family_Proposal_${u.unitId}.UNIT`,await source.readAt(u.offset,u.size),{unitId:u.unitId,kind:'UNIT'});
await emit('Family_Proposal_Agent.GPL',await source.readAt(hero.agent.offset,hero.agent.size),{agentId:28,kind:'GPL'});
const attachments=new Map();for await(const a of checkpointAttachments(source))if(ids.includes(a.unitId)&&a.kind==='ORDR'){
  assert(!attachments.has(a.unitId));attachments.set(a.unitId,a);
}
for(let i=0;i<4;++i){
  const id=ids[i],a=attachments.get(id);assert(a);const payload=Buffer.from(await source.readAt(a.primary.offset+16,a.primary.size));
  const entries=[];for await(const e of checkpointActorOrderEntries(source,id))if(e.type==='entry')entries.push(e);
  const patches=[];
  if(i===0){assert.deepEqual(entries.map(e=>e.kind),[4,7]);for(const e of entries){assert.equal(e.words[5],57650);patches.push({offset:e.offset+20,before:57650,after:24250});}}
  else patches.push(...effectProof.plan.effects.find(e=>e.unitId===id).plan.patches);
  for(const p of patches){const at=p.offset-(a.primary.offset+16);assert.equal(payload.readUInt32LE(at),p.before);payload.writeUInt32LE(p.after,at);}
  await emit(`Family_Proposal_${id}_Orders.bin`,payload,{unitId:id,kind:'ORDR',sourceSha256:await hash(sourcePrep.source.filename),clockPatches:patches});
}
let container;for await(const a of checkpointAttachments(source))if(a.kind==='CONT'&&a.unitId===504)container=a;
assert(container);const rows=[];for await(const row of checkpointContainerEntries(source))if(row.unitId===504)rows.push(row);
assert.deepEqual(rows.filter(r=>r.type==='group').map(r=>[r.groupKind,r.memberCount]),[[101,1],[1,3]]);
assert.deepEqual(rows.filter(r=>r.type==='member').map(r=>r.targetUnitId),[469,527,528,529]);
await emit('Family_Source_Container.bin',await source.readAt(container.primary.offset+16,container.primary.size),{kind:'CONT-pending-home'});
const internal=Buffer.alloc(48);[1,1,1,3,1,504,527,1,528,1,529,1].forEach((v,i)=>internal.writeUInt32LE(v,i*4));
await emit('Family_Proposal_Container.bin',internal,{kind:'CONT-internal'});
const result={version:1,outdoorFamilyPreparationQualified:true,source:sourcePrep.source,destination,
  sourceProof:sourcePrep.sourceProof,sourceProofSha256:sourcePrep.sourceProofSha256,
  pairPublication:resolve(pairName),pairPublicationSha256:await hash(pairName),effectClockProof:resolve(effectProofName),effectClockProofSha256:await hash(effectProofName),
  sourceClockMs:57650,destinationClockMs:24250,sourceHero:hero,units,records,
  settingsProfile:sourcePrep.settingsProfile,inputHashes:sourcePrep.inputHashes,
  sourceSha256:Object.fromEntries(await Promise.all(['scripts/prepare-native-outdoor-family.mjs',
    'scripts/lib/native-crossing-order-entries.mjs','web/world/checkpoint.mjs'].map(async n=>[n,await hash(n)]))),
  deferredHome:{region:'0_0',unitId:469,agentId:7,receivingProxyAgentId:45,proxyNativeUnitId:0},
  completeReferenceClosureQualified:false,destinationActivationQualified:false,heroTransferred:false,browserUsed:false};
await writeFile(join(out,'prepared.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({outdoorFamilyPreparationQualified:true,unitRecords:4,scriptBytes:hero.agent.size,records:records.length,homeRoutingDeferred:true}));
