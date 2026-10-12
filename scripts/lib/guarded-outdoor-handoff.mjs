// Join actual stopped snapshots; a pending remote-home owner must stay guarded.
import assert from 'node:assert/strict';
import {readFile,stat,readdir} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {workspace,ownedDirectory,stoppedFileSource} from './stopped-entity-io.mjs';
import {hashNativeFile} from './native-generation.mjs';
import {inspectNativeOutdoorFamilyReload} from '../inspect-native-outdoor-family-reload.mjs';
import {inspectOutdoorOwnerPublication,prepareOutdoorOwnerSave,freshOutdoorOwnerStore} from './registered-hero-outdoor-save.mjs';
import {checkpointUnitAgentLinks,checkpointAgents,checkpointAttachments,checkpointAgentRecordValues} from '../../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../../web/world/saved-clock.mjs';
import {openEntityRevisionStore} from '../../web/world/entity-revisions.mjs';
import {stoppedRevisionStorage} from './stopped-revision-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const guardedHandoffHash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function rows(source,iterator,key){const out=new Map();for await(const r of iterator(source)){const id=key(r);assert(!out.has(id));out.set(id,r);}return out;}
async function bytes(source,r){assert(r&&r.size<=65536);const b=Buffer.alloc(r.size);
  for(let at=0;at<r.size;at+=4096)b.set(await source.readAt(r.offset+at,Math.min(4096,r.size-at)),at);return b;}
const memory=b=>({size:b.length,async readAt(at,n){assert(n<=4096&&at>=0&&at+n<=b.length);return Uint8Array.from(b.subarray(at,at+n));}});
async function exact(a,b,iterator,key,omit=new Set(),sameCount=false){
  const before=await rows(a,iterator,key),after=await rows(b,iterator,key);if(sameCount)assert.equal(before.size,after.size);let count=0;
  for(const [id,r]of before)if(!omit.has(id)){assert(after.has(id));assert.deepEqual(await bytes(a,r),await bytes(b,after.get(id)));count++;}return count;
}
async function frozenHomeReturn(proofName,archiveName){
  const proof=await json(proofName),archive=await json(archiveName);
  assert.equal(proof.actualOutdoorFamilyHomeRestorationQualified,true);assert.equal(proof.ordinaryGuildEntryQualified,true);
  assert.equal(archive.artifactPreserved,true);assert.equal(archive.nativeExecutable.sha256,proof.nativeExecutableSha256);
  const directory=await ownedDirectory(archive.directory,'actor-arrival-fixture-outdoor-family-return-generation-');
  assert.equal(archive.nativeExecutable.filename,join(directory,'pop_smoke'));
  assert.equal(await guardedHandoffHash(archive.nativeExecutable.filename),proof.nativeExecutableSha256);
  assert.equal(Object.keys(archive.sourceHashes).length,20);
  for(const [n,h]of Object.entries(archive.sourceHashes)){
    assert.equal(archive.sources[n].filename,join(directory,basename(n)));assert.equal(await guardedHandoffHash(archive.sources[n].filename),h);
  }
  for(const n of [resolve(proofName),proof.manifest,proof.reloadManifest]){
    assert(archive.evidence[n]);assert.equal(await guardedHandoffHash(n),archive.evidence[n].sha256);
    assert.equal(await guardedHandoffHash(archive.evidence[n].filename),archive.evidence[n].sha256);
  }
  for(const [n,h]of Object.entries(proof.sourceSha256)){
    assert.equal(archive.evidence[join(workspace,n)].sha256,h);
    assert.equal(await guardedHandoffHash(archive.evidence[join(workspace,n)].filename),h);
  }
  for(const [n,h]of [[proof.manifest,proof.manifestSha256],[proof.reloadManifest,proof.reloadManifestSha256]]){
    assert.equal(await guardedHandoffHash(n),h);const m=await json(n);
    assert.deepEqual([m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.stopReason],[true,false,true,0,null]);
    try{process.kill(m.nativePid,0);throw Error('Frozen home producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
    assert.deepEqual({...m.nativeSourceSha256,...m.nativeHeapRuntimeSourceSha256,...m.nativeOrderRuntimeSourceSha256},archive.sourceHashes);
  }
  for(const r of Object.values(proof.worlds)){
    const a=await hashNativeFile(r.filename);assert.equal(a.sha256,r.sha256);assert.equal(a.bytes,r.bytes);
    assert.equal(archive.evidence[r.filename].sha256,r.sha256);assert.equal(await guardedHandoffHash(archive.evidence[r.filename].filename),r.sha256);
  }
  return proof;
}

export async function prepareGuardedOutdoorHandoff(publicationName,receivingProofName,homeProofName,homeArchiveName){
  const publication=await inspectOutdoorOwnerPublication(publicationName);
  const receiving=await json(receivingProofName),observed=await inspectNativeOutdoorFamilyReload(receiving.manifest);
  assert.deepEqual(receiving,observed);assert.equal(receiving.selectedOwnerPublished,false);
  const home=await frozenHomeReturn(homeProofName,homeArchiveName);
  assert.deepEqual(receiving.homeRequest,home.request);
  assert.equal(receiving.homeRequest.entityId,publication.identity.entityId);
  const prior=await prepareOutdoorOwnerSave(publication.previousPublication,publication.sessionProof);
  const original=await stoppedFileSource(publication.inputs[0].filename),source=await stoppedFileSource(home.worlds.Source.filename),departed=await stoppedFileSource(home.worlds.Departed.filename);
  const sourceUnitsExact=await exact(original,source,checkpointUnitAgentLinks,r=>r.unitId,new Set(),true);
  const sourceAgentsExact=await exact(original,source,checkpointAgents,r=>r.agentId,new Set(),true);
  const sourceAttachmentsExact=await exact(original,source,checkpointAttachments,r=>`${r.kind}:${r.unitId}`,new Set(),true);
  assert.equal(await checkpointSavedClock(source),57650);assert.equal(await checkpointSavedClock(departed),57650);
  const sourceIds=[504,527,528,529],toIds=[receiving.heroId,...receiving.effectIds];
  const originalUnits=await rows(original,checkpointUnitAgentLinks,r=>r.unitId),originalAgents=await rows(original,checkpointAgents,r=>r.agentId);
  const otherSourceUnitsPreserved=await exact(source,departed,checkpointUnitAgentLinks,r=>r.unitId,new Set(sourceIds));
  const otherSourceAgentsPreserved=await exact(source,departed,checkpointAgents,r=>r.agentId,new Set([7,28]));
  const beforeUnits=await rows(source,checkpointUnitAgentLinks,r=>r.unitId),afterUnits=await rows(departed,checkpointUnitAgentLinks,r=>r.unitId);
  const beforeAgents=await rows(source,checkpointAgents,r=>r.agentId),afterAgents=await rows(departed,checkpointAgents,r=>r.agentId);
  assert.equal(beforeUnits.size-afterUnits.size,4);assert.equal(beforeAgents.size-afterAgents.size,1);
  for(const id of sourceIds)assert(!afterUnits.has(id));assert(!afterAgents.has(28));
  const incoming=await stoppedFileSource(receiving.worlds.Ready.filename),held=await stoppedFileSource(receiving.worlds.Held.filename);
  const remoteUnits=await rows(held,checkpointUnitAgentLinks,r=>r.unitId),remoteAgents=await rows(held,checkpointAgents,r=>r.agentId);
  // Normalize only established fields, never search/replace numeric matches.
  for(let i=0;i<4;i++){
    const b=await bytes(held,remoteUnits.get(toIds[i]));assert.equal(b.readUInt32LE(36),toIds[i]);b.writeUInt32LE(sourceIds[i],36);
    assert.equal(b.readUInt32LE(56),i?toIds[0]:0);b.writeUInt32LE(i?504:0,56);
    if(!i){let at=92+(b.readUInt32LE(80)?16:0),count=b.readUInt32LE(at+4),found=0;at+=8;
      assert(count<=128);for(let k=0;k<count;k++,at+=8)if(b.readUInt32LE(at)===0x4541){
        assert.equal(b.readUInt32LE(at+4),receiving.agentId);b.writeUInt32LE(28,at+4);found++;}assert.equal(found,1);}
    assert.deepEqual(b,await bytes(original,originalUnits.get(sourceIds[i])));
  }
  const script=await bytes(held,remoteAgents.get(receiving.agentId));
  for await(const v of checkpointAgentRecordValues(memory(script)))if(v.type===5&&v.targetAgentId){
    assert([receiving.agentId,45].includes(v.targetAgentId));script.writeUInt32LE(v.targetAgentId===45?7:28,v.offset);}
  assert.equal(remoteAgents.get(receiving.agentId).name,'');assert.equal(script.readUInt32LE(script.length-24),receiving.agentId);
  assert.equal(script.readUInt32LE(script.length-19),receiving.heroId);script.writeUInt32LE(28,script.length-24);script.writeUInt32LE(504,script.length-19);
  assert.deepEqual(script,await bytes(original,originalAgents.get(28)));
  const native=await json(receiving.manifest),prep=await json(native.preparation),attachments=await rows(held,checkpointAttachments,r=>`${r.kind}:${r.unitId}`);
  for(let i=0;i<4;i++){
    const proposal=prep.records.find(r=>basename(r.filename)===`Family_Proposal_${sourceIds[i]}_Orders.bin`);assert(proposal);
    assert.equal(await guardedHandoffHash(proposal.filename),proposal.sha256);const a=attachments.get(`ORDR:${toIds[i]}`);assert(a&&a.primary.size<=4096);
    assert.deepEqual(Buffer.from(await held.readAt(a.primary.offset+16,a.primary.size)),await readFile(proposal.filename));
  }
  const inputs=[home.worlds.Departed,receiving.worlds.Ready],worlds=[{source:departed,sha256:inputs[0].sha256},{source:incoming,sha256:inputs[1].sha256}];
  const aliases=[publication.selectedState.aliases[0],{unitId:receiving.heroId,agentId:receiving.agentId}];
  const evidence={previousPublication:resolve(publicationName),previousPublicationSha256:await guardedHandoffHash(publicationName),
    receivingProof:resolve(receivingProofName),receivingProofSha256:await guardedHandoffHash(receivingProofName),
    homeProof:resolve(homeProofName),homeProofSha256:await guardedHandoffHash(homeProofName),
    homeArchive:resolve(homeArchiveName),homeArchiveSha256:await guardedHandoffHash(homeArchiveName)};
  const request={worlds,aliases,homeAliases:publication.selectedState.homeAliases,referenceBindings:publication.selectedState.referenceBindings,
    ownerSide:1,visitedSides:publication.selectedState.visitedSides,kind:'handoff',expectedManifest:publication.selectedManifest,
    operationId:sha(JSON.stringify({evidence,worlds:inputs.map(r=>r.sha256),aliases})+'\n')};
  const evidenceCounts={sourceUnitsExact,sourceAgentsExact,sourceAttachmentsExact,otherSourceUnitsPreserved,otherSourceAgentsPreserved,
    normalizedRemoteUnitRecords:4,normalizedRemoteScriptRecords:1,remoteOrderPayloadsExact:4};
  return {publication,prior,request,inputs,evidence,evidenceCounts,receiving,
    stillOwnedSource:home.worlds.Source,missingReceiving:receiving.worlds.Departed};
}
export async function freshGuardedOutdoorStore(p){
  const t=await freshOutdoorOwnerStore(p.prior);const save=await t.store.commit(p.prior.request);
  assert.equal(save.manifest,p.publication.selectedManifest);assert.deepEqual((await t.store.read()).record.state,p.publication.selectedState);return t;
}
export async function inspectGuardedOutdoorPublication(name){
  const r=await json(name);assert.equal(r.actualGuardedOutdoorFamilyStoppedHandoffPublished,true);
  for(const [n,h]of Object.entries(r.sourceSha256))assert.equal(await guardedHandoffHash(join(workspace,n)),h);
  const p=await prepareGuardedOutdoorHandoff(r.previousPublication,r.receivingProof,r.homeProof,r.homeArchive);
  for(const [n,v]of Object.entries({...p.evidence,...p.evidenceCounts}))assert.deepEqual(r[n],v);
  assert.deepEqual(r.identity,p.publication.identity);assert.deepEqual(r.inputs,p.inputs);
  assert.equal(r.previousManifest,p.publication.selectedManifest);
  await ownedDirectory(r.fixture,'actor-arrival-fixture-entity-revision-');
  const io=await stoppedRevisionStorage(r.fixture);io.atomicWrite=async()=>{throw Error('Read-only guarded publication');};
  const store=await openEntityRevisionStore(io,r.identity.contentDigest);assert.deepEqual(store.identity,r.identity);
  const selected=await store.read();assert.equal(selected.record.manifest,r.selectedManifest);
  const expected={...p.publication.selectedState,revision:4,kind:'handoff',previous:sha(p.publication.selectedManifest),
    operationId:p.request.operationId,ownerSide:1,aliases:p.request.aliases,worlds:p.inputs.map(i=>({size:i.bytes,sha256:i.sha256}))};
  assert.deepEqual(selected.record.state,expected);assert.deepEqual(r.selectedState,expected);
  assert.deepEqual(selected.owner,{entityId:r.identity.entityId,region:'1_0',...p.request.aliases[1]});
  assert.deepEqual(r.selectedOwner,selected.owner);assert.deepEqual(r.worlds,selected.record.worlds);
  assert.equal((await readdir(r.fixture)).length,8);assert.deepEqual(r.pendingHomeRequest,p.receiving.homeRequest);
  assert.equal(r.guardedHomeRequestPending,true);assert.equal(r.ordinaryUnguardedLaunchQualified,false);
  assert.equal(r.nativeEngineOwnershipActivationQualified,false);assert.equal(r.browserUsed,false);return r;
}
