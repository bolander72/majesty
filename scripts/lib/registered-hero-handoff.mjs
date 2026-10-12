// Actual stopped source retirement and destination AI continuation, joined
// under one owner revision. This helper never changes the initial seed store.
import assert from 'node:assert/strict';
import {readFile,stat,mkdtemp,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {workspace,stoppedFileSource} from './stopped-entity-io.mjs';
import {hashNativeFile} from './native-generation.mjs';
import {stoppedRevisionStorage} from './stopped-revision-io.mjs';
import {EntityRevisionStore,openEntityRevisionStore} from '../../web/world/entity-revisions.mjs';
import {inspectNativeHeroDeparture} from '../inspect-native-hero-departure.mjs';
import {inspectNativeHeroLive} from '../inspect-native-hero-live.mjs';
export const handoffHash=async name=>(await hashNativeFile(name)).sha256;
export async function handoffJson(name) {
 assert.ok((await stat(name)).size<=256*1024);return JSON.parse(await readFile(name,'utf8'));
}
export async function prepareRegisteredHeroHandoff(departureName,liveName,seedName) {
 const departure=await inspectNativeHeroDeparture(resolve(departureName));
 const live=await inspectNativeHeroLive(resolve(liveName));
 assert.equal(departure.originalRegisteredHeroSourceDepartureQualified,true);
 assert.equal(live.originalRegisteredRemoteHomeRequestGateQualified,true);
 const seed=await handoffJson(seedName);
 assert.deepEqual([seed.version,seed.initialStoppedHeroOwnerQualified,seed.identity.version],[1,true,2]);
 const stats={},oldIo=await stoppedRevisionStorage(seed.fixture,stats);
 const oldStore=await openEntityRevisionStore(oldIo,seed.identity.contentDigest),selected=await oldStore.read();
 assert.deepEqual(oldStore.identity,seed.identity);assert.equal(selected.record.manifest,seed.selectedManifest);
 assert.deepEqual(selected.owner,seed.selectedOwner);assert.equal(selected.record.state.revision,0);
 assert.equal(selected.record.state.ownerSide,0);assert.deepEqual(selected.record.state.aliases,seed.aliases);
 assert.deepEqual(selected.record.state.homeAliases,seed.homeAliases);
 assert.deepEqual(selected.record.worlds,seed.inputs.map(r=>({size:r.bytes,sha256:r.sha256})));
 assert.equal(departure.sourceWorld.sha256,seed.inputs[0].sha256);
 assert.equal(departure.sourceWorld.filename,seed.inputs[0].filename);
 assert.deepEqual(live.selectedOwner,selected.owner);assert.equal(live.selectedOwnerManifest,selected.record.manifest);
 assert.equal(seed.identity.registeredHome.home.agentId,departure.guildAgentId);
 assert.equal(seed.identity.registeredHome.home.unitId,departure.guildId);
 assert.equal(seed.homeAliases[1].agentId,live.proxyId);
 const seededWorlds=[];for(const r of seed.inputs) {
  assert.equal(await handoffHash(r.filename),r.sha256);
  seededWorlds.push({source:await stoppedFileSource(r.filename),sha256:r.sha256});
 }
 const files=(await readdir(seed.fixture)).sort();assert.equal(files.length,5);
 const seedFiles={};for(const name of files)seedFiles[name]=await handoffHash(join(seed.fixture,name));
 const seedState=selected.record.state;
 const seedRequest={worlds:seededWorlds,aliases:seedState.aliases,homeAliases:seedState.homeAliases,
  referenceBindings:seedState.referenceBindings,ownerSide:0,visitedSides:1,
  operationId:seedState.operationId,kind:'seed',expectedManifest:null};
 const inputs=[departure.afterWorld,live.evolvedWorld],worlds=[];
 for(const r of inputs){assert.equal(await handoffHash(r.filename),r.sha256);worlds.push({source:await stoppedFileSource(r.filename),sha256:r.sha256});}
 const aliases=[{unitId:departure.heroId,agentId:departure.agentId},{unitId:live.heroId,agentId:live.agentId}];
 const evidence={departureManifest:departure.sourceManifest,departureManifestSha256:departure.sourceManifestSha256,
  liveManifest:live.sourceManifest,liveManifestSha256:live.sourceManifestSha256,
  seedManifest:resolve(seedName),seedManifestSha256:await handoffHash(seedName)};
 const operationId=createHash('sha256').update(JSON.stringify({evidence,worlds:inputs.map(r=>r.sha256),aliases})+'\n').digest('hex');
 const request={worlds,aliases,homeAliases:seed.homeAliases,referenceBindings:seedState.referenceBindings,
  ownerSide:1,visitedSides:3,operationId,kind:'handoff',expectedManifest:seed.selectedManifest};
 return {departure,live,seed,seedRequest,request,inputs,evidence,seedFiles,seedSelected:selected};
}
export async function freshRegisteredHeroStore(p) {
 const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-'));
 const stats={},io=await stoppedRevisionStorage(directory,stats);let writes=0;
 const original=io.atomicWrite;io.atomicWrite=async(...args)=>{writes++;return original(...args);};
 const store=new EntityRevisionStore(io,p.seed.identity,p.seed.identity.contentDigest);
 const seed=await store.commit(p.seedRequest);assert.equal(seed.manifest,p.seed.selectedManifest);assert.equal(writes,5);
 return {directory,stats,io,store,writes:()=>writes};
}
export async function assertRegisteredHeroInputsUnchanged(p) {
 const old=await openEntityRevisionStore(await stoppedRevisionStorage(p.seed.fixture),p.seed.identity.contentDigest);
 assert.deepEqual(await old.read(),p.seedSelected);
 assert.deepEqual((await readdir(p.seed.fixture)).sort(),Object.keys(p.seedFiles));
 for(const [name,h] of Object.entries(p.seedFiles))assert.equal(await handoffHash(join(p.seed.fixture,name)),h);
 for(const r of [...p.seed.inputs,...p.inputs])assert.equal(await handoffHash(r.filename),r.sha256);
 for(const [key,h] of [['departureManifest',p.evidence.departureManifestSha256],['liveManifest',p.evidence.liveManifestSha256],['seedManifest',p.evidence.seedManifestSha256]])
  assert.equal(await handoffHash(p.evidence[key]),h);
}
