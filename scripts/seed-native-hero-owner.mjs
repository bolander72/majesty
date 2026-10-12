#!/usr/bin/env node
// Publish an initial stopped owner from independently checked original saves.
// No hero is imported, removed, scheduled or moved by this preparation.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,lstat,readdir} from 'node:fs/promises';
import {join,resolve,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectGeneratedHero} from './inspect-native-generated-hero.mjs';
import {inspectNativeRemoteHome} from './inspect-native-remote-home.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {EntityRevisionStore,openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
const [out]=process.argv.slice(2);
assert.equal(process.argv.length,3,'Usage: <fresh output/native-hero-owner-seed-NNN-observed.json>');
const output=resolve(out);
assert.equal(dirname(output),join(workspace,'output'));
assert.match(basename(output),/^native-hero-owner-seed-[0-9]{3}-observed\.json$/);
try{await lstat(output);throw Error('Preserve prior seed report');}catch(e){if(e.code!=='ENOENT')throw e;}
const registrationProof=join(workspace,'output/hero-home-registration-002/registration-observed.json');
assert.ok((await lstat(registrationProof)).size<=65536);
const proof=JSON.parse(await readFile(registrationProof,'utf8'));
const origin=await inspectGeneratedHero(proof.sourceManifest);
const remoteManifest=join(workspace,'output/native-remote-home-attempt-002.json');
const remote=await inspectNativeRemoteHome(remoteManifest);
assert.equal(remote.originalRemoteHomeReloadQualified,true);
const r=proof.registration,member=r.members.find(m=>m.unitId===origin.hero.unitId&&m.agentId===origin.actor.unit.agentId);
assert.ok(member);assert.equal(r.home.originCheckpointSha256,origin.save.sha256);
assert.equal(r.guildEntityId,remote.guildEntityId);
const identity={version:2,entityId:member.entityId,contentDigest:r.contentDigest,regions:['0_0','1_0'],
  actor:{family:origin.hero.family,description:origin.hero.description,playerNumber:origin.hero.playerNumber},registeredHome:r};
const aliases=[{unitId:origin.hero.unitId,agentId:origin.actor.unit.agentId},{unitId:100000,agentId:1000}];
const homeAliases=[{kind:'native',unitId:r.home.unitId,agentId:r.home.agentId},{kind:'proxy',unitId:0,agentId:remote.agentId}];
const inputs=[origin.save,remote.savedWorld],worlds=[];
for(const input of inputs)worlds.push({source:await stoppedFileSource(input.filename),sha256:input.sha256});
const operationId=createHash('sha256').update(JSON.stringify({identity,aliases,homeAliases,worlds:inputs.map(w=>w.sha256)})).digest('hex');
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-'));
const stats={},io=await stoppedRevisionStorage(directory,stats),store=new EntityRevisionStore(io,identity,identity.contentDigest);
const request={worlds,aliases,homeAliases,referenceBindings:[],ownerSide:0,visitedSides:1,kind:'seed',operationId,expectedManifest:null};
let writes=0;const originalWrite=io.atomicWrite;
io.atomicWrite=async(...args)=>{writes++;return originalWrite(...args);};
const seed=await store.commit(request);assert.equal(seed.revision,0);assert.equal(writes,5);
const reopened=await openEntityRevisionStore(io,identity.contentDigest),selected=await reopened.read();
assert.equal(selected.record.manifest,seed.manifest);assert.equal(selected.owner.entityId,member.entityId);
assert.equal(selected.owner.region,r.home.region);assert.deepEqual(selected.record.state.homeAliases,homeAliases);
assert.deepEqual(selected.record.worlds.map(w=>w.sha256),inputs.map(w=>w.sha256));
const writesBeforeRetry=writes;assert.equal((await reopened.commit(request)).idempotent,true);
assert.equal(writes,writesBeforeRetry);assert.equal((await readdir(directory)).length,5);
for(const input of inputs)assert.equal((await hashNativeFile(input.filename)).sha256,input.sha256);
assert.ok(stats.largestRead<=4096&&stats.largestWrite<=4096&&stats.peakReads===1);
const report={version:1,scope:'Stopped original recruited Warrior in0_0 and independently qualified original remote-home save in1_0 select one initial hero owner under explicit identity version2. Both full GMP files remain byte-identical. Future destination actor aliases are unreserved proposals. No original hero import/departure, cross-clock effect migration, remote task routing, native revision reload or browser qualification.',
  selectedNativeHeroOwnerPublished:true,initialStoppedHeroOwnerQualified:true,fixture:directory,identity,
  aliases,homeAliases,selectedOwner:selected.owner,selectedManifest:selected.record.manifest,
  inputs,registrationProof,registrationProofSha256:(await hashNativeFile(registrationProof)).sha256,
  originManifest:proof.sourceManifest,originManifestSha256:origin.sourceManifestSha256,
  remoteManifest,remoteManifestSha256:remote.sourceManifestSha256,revision:0,
  largestRead:stats.largestRead,largestWrite:stats.largestWrite,peakReads:stats.peakReads,
  retainedFiles:5,retainedWorldSlots:2,idempotentRetryQualified:true,idempotentRetryWrites:0,
  nativeProcessesStarted:0,nativeBuildPerformed:false,browserUsed:false,
  remoteHomeRoutingQualified:false,heroCrossingQualified:false,heroRevisionNativeReloadQualified:false,
  completeReferenceClosureQualified:false,concurrentOsWritersQualified:false,sourceSha256:{}};
for(const name of ['scripts/seed-native-hero-owner.mjs','scripts/lib/stopped-revision-io.mjs',
  'web/world/entity-revisions.mjs','web/world/entity-ownership.mjs','web/world/entity-home-ownership.mjs'])
  report.sourceSha256[name]=(await hashNativeFile(join(workspace,name))).sha256;
await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({initialStoppedHeroOwnerQualified:true,region:selected.owner.region,revision:0,
  retainedFiles:5,largestRead:stats.largestRead,largestWrite:stats.largestWrite,browserUsed:false,nativeProcessesStarted:0}));
