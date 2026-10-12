// Join actual remote retirement and original returned AI under one stopped owner revision.
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectNativeRemoteHeroDeparture} from '../inspect-native-remote-hero-departure.mjs';
import {inspectNativeHeroReturnLive} from '../inspect-native-hero-return-live.mjs';
import {handoffJson,handoffHash,prepareRegisteredHeroHandoff,freshRegisteredHeroStore,
 assertRegisteredHeroInputsUnchanged} from './registered-hero-handoff.mjs';
import {stoppedFileSource} from './stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './stopped-revision-io.mjs';
import {openEntityRevisionStore} from '../../web/world/entity-revisions.mjs';
export async function prepareRegisteredHeroReturn(departureName,liveName) {
 const departure=await inspectNativeRemoteHeroDeparture(resolve(departureName));
 const live=await inspectNativeHeroReturnLive(resolve(liveName));
 assert.equal(departure.actualSelectedRemoteHeroOriginalDepartureQualified,true);
 assert.equal(live.actualReturnedHeroOriginalGuildEntryQualified,true);
 assert.equal(live.publication,departure.publication);assert.equal(live.publicationSha256,departure.publicationSha256);
 const publication=await handoffJson(departure.publication);
 const prior=await prepareRegisteredHeroHandoff(publication.departureManifest,publication.liveManifest,publication.seedManifest);
 const io=await stoppedRevisionStorage(publication.fixture);io.atomicWrite=async()=>{throw Error('Preserve actual outward owner store');};
 const selected=await (await openEntityRevisionStore(io,publication.identity.contentDigest)).read();
 assert.equal(selected.record.manifest,publication.selectedManifest);assert.deepEqual(selected.record.state,publication.selectedState);
 assert.deepEqual(selected.owner,publication.selectedOwner);assert.equal(selected.record.revision,1);
 assert.equal(selected.record.manifest,departure.selectedManifest);assert.deepEqual(selected.owner,departure.selectedOwner);
 assert.deepEqual(selected.record.worlds,publication.worlds);assert.deepEqual(publication.identity,prior.seed.identity);
 const files=await readdir(publication.fixture);assert.equal(files.length,8);const priorFiles={};
 for(const n of files)priorFiles[n]=await handoffHash(join(publication.fixture,n));
 const inputs=[live.evolvedWorld,departure.afterWorld],worlds=[];
 for(const r of inputs){assert.equal(await handoffHash(r.filename),r.sha256);worlds.push({source:await stoppedFileSource(r.filename),sha256:r.sha256});}
 const aliases=[{unitId:live.heroId,agentId:live.agentId},{unitId:departure.heroId,agentId:departure.agentId}];
 assert.deepEqual(aliases[1],selected.record.state.aliases[1]);assert.deepEqual([aliases[0].unitId,aliases[0].agentId],[504,28]);
 const evidence={departureManifest:departure.sourceManifest,departureManifestSha256:departure.sourceManifestSha256,
  liveManifest:live.sourceManifest,liveManifestSha256:live.sourceManifestSha256,
  previousPublication:departure.publication,previousPublicationSha256:departure.publicationSha256};
 const operationId=createHash('sha256').update(JSON.stringify({evidence,worlds:inputs.map(r=>r.sha256),aliases})+'\n').digest('hex');
 const request={worlds,aliases,homeAliases:selected.record.state.homeAliases,referenceBindings:selected.record.state.referenceBindings,
  ownerSide:0,visitedSides:3,kind:'handoff',operationId,expectedManifest:selected.record.manifest};
 return {departure,live,publication,prior,selected,priorFiles,inputs,evidence,request};
}
export async function freshRegisteredHeroReturnStore(p) {
 const t=await freshRegisteredHeroStore(p.prior),outward=await t.store.commit(p.prior.request);
 assert.equal(outward.manifest,p.selected.record.manifest);assert.deepEqual((await t.store.read()).owner,p.selected.owner);
 assert.equal(t.writes(),9);return t;
}
export async function assertRegisteredHeroReturnInputsUnchanged(p) {
 await assertRegisteredHeroInputsUnchanged(p.prior);
 const io=await stoppedRevisionStorage(p.publication.fixture);io.atomicWrite=async()=>{throw Error('Read-only actual outward store');};
 assert.deepEqual(await (await openEntityRevisionStore(io,p.publication.identity.contentDigest)).read(),p.selected);
 assert.deepEqual((await readdir(p.publication.fixture)).sort(),Object.keys(p.priorFiles).sort());
 for(const [n,h]of Object.entries(p.priorFiles))assert.equal(await handoffHash(join(p.publication.fixture,n)),h);
 for(const r of p.inputs)assert.equal(await handoffHash(r.filename),r.sha256);
 for(const [n,h]of Object.entries(p.evidence))if(!n.endsWith('Sha256'))assert.equal(await handoffHash(h),p.evidence[n+'Sha256']);
}
