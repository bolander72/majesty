#!/usr/bin/env node
// Use the runtime selected-family planner on the actual native outdoor saves.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {inspectOutdoorOwnerPublication,outdoorHash} from './lib/registered-hero-outdoor-save.mjs';
import {prepareSelectedActorFamilyClocks} from '../web/world/actor-family-clocks.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {checkpointAttachments} from '../web/world/checkpoint.mjs';
const [publicationName,baseName,directory]=process.argv.slice(2);assert.equal(process.argv.length,5);
const publication=await inspectOutdoorOwnerPublication(publicationName),base=JSON.parse(await readFile(baseName,'utf8'));
assert.equal(base.outdoorFamilyPreparationQualified,true);
assert.equal(base.source.sha256,publication.inputs[0].sha256);assert.equal(base.destination.sha256,publication.inputs[1].sha256);
for(const[n,h]of Object.entries(base.sourceSha256))assert.equal(await outdoorHash(n),h);
for(const r of base.records)assert.equal(await outdoorHash(r.filename),r.sha256);
const io=await stoppedRevisionStorage(publication.fixture);io.atomicWrite=async()=>{throw Error('Read-only actual outdoor owner');};
const store=await openEntityRevisionStore(io,publication.identity.contentDigest),before=await store.read();
const plan=await prepareSelectedActorFamilyClocks(store,{expectedManifest:publication.selectedManifest});
assert.deepEqual([plan.sourceClockMs,plan.destinationClockMs,plan.unitIds],[57650,24250,[504,527,528,529]]);
assert.equal(plan.contexts.length,12);assert.equal(plan.patches.length,6);
assert.deepEqual(plan.contexts.filter(c=>c.active).map(c=>({attribute:c.attribute,state:c.state,after:c.after,elapsed:c.elapsed})),[
  {attribute:'activescript',state:[300,57650,2,0],after:24250,elapsed:0}]);
for(const c of plan.contexts.filter(c=>!c.active))assert.deepEqual(c.state,[0,0,0,0]);
assert.deepEqual(plan.headers.map(h=>[h.unitId,h.kind,h.when,h.after]),[
  [504,4,57650,24250],[504,7,57650,24250],[527,5,57600,24200],[528,9,57350,23950],[529,9,57350,23950]]);
const source=await stoppedFileSource(base.source.filename),attachments=new Map();
for await(const a of checkpointAttachments(source))if(a.kind==='ORDR'&&plan.unitIds.includes(a.unitId))attachments.set(a.unitId,a);
for(const r of plan.records.filter(r=>r.kind==='ORDR')){
  const a=attachments.get(r.unitId),offset=a.primary.offset+16-r.range.offset;
  const original=base.records.find(p=>basename(p.filename)===`Family_Proposal_${r.unitId}_Orders.bin`);assert(original);
  assert.deepEqual(Buffer.from(r.bytes.subarray(offset,offset+a.primary.size)),await readFile(original.filename));
}
// Only the active script stamp changes relative to the previous proposal.
const script=plan.records.find(r=>r.kind==='GPL'),original=base.records.find(r=>basename(r.filename)==='Family_Proposal_Agent.GPL');
const oldScript=await readFile(original.filename),restored=Buffer.from(script.bytes),patch=plan.patches.find(p=>p.kind==='GPL');
assert.equal(patch.before,57650);assert.equal(patch.after,24250);restored.writeUInt32LE(patch.before,patch.relativeOffset);assert.deepEqual(restored,oldScript);
assert.deepEqual(await store.read(),before);
const out=resolve(directory);await mkdir(out);const records=[];
for(const r of base.records){
  const filename=join(out,basename(r.filename)),b=basename(r.filename)==='Family_Proposal_Agent.GPL'?script.bytes:await readFile(r.filename);
  await writeFile(filename,b,{flag:'wx'});records.push({...r,filename,sha256:await outdoorHash(filename),bytes:b.length});
}
const sourceSha256={...base.sourceSha256};for(const n of ['scripts/prepare-native-outdoor-family-clock-projection.mjs','web/world/actor-family-clocks.mjs','web/world/family-order-entries.mjs'])sourceSha256[n]=await outdoorHash(join(workspace,n));
await writeFile(join(out,'prepared.json'),JSON.stringify({...base,records,sourceSha256,
  selectedPublication:resolve(publicationName),selectedPublicationSha256:await outdoorHash(publicationName),ownerManifest:publication.selectedManifest,
  basePreparation:resolve(baseName),basePreparationSha256:await outdoorHash(baseName),familyClockProjectionPrepared:true,
  scriptClockProjection:{source:57650,destination:24250,patches:plan.patches.filter(p=>p.kind==='GPL'),inactiveContextsPreserved:11},
  clockPlan:{...plan,records:plan.records.map(({bytes,...r})=>r)},
  destinationActivationQualified:false,completeOrderMigration:false,heroTransferred:false,browserUsed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({familyClockProjectionPrepared:true,scriptStampBefore:57650,scriptStampAfter:24250,orderClockSites:5,inactiveContextsPreserved:11,records:records.length,browserUsed:false}));
