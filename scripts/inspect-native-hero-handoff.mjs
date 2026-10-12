#!/usr/bin/env node
// Independently reopen the published pair and all recovered stopped stores.
import assert from 'node:assert/strict';
import {writeFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareRegisteredHeroHandoff,assertRegisteredHeroInputsUnchanged,handoffJson,handoffHash} from './lib/registered-hero-handoff.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
import {openEntityRevisionStore,encodeEntityRevision} from '../web/world/entity-revisions.mjs';
import {verifyRegisteredHeroProducerSources} from './lib/registered-hero-source-artifact.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function inspectNativeHeroHandoff(name) {
 const m=await handoffJson(name);
 assert.deepEqual([m.version,m.actualRegisteredHeroStoppedPairPublished,m.browserUsed,m.nativeProcessesStarted,m.nativeBuildPerformed],[1,true,false,0,false]);
 await verifyRegisteredHeroProducerSources(m,name);
 const p=await prepareRegisteredHeroHandoff(m.departureManifest,m.liveManifest,m.seedManifest);
 for(const [n,v] of Object.entries(p.evidence))assert.equal(m[n],v);
 assert.deepEqual(m.identity,p.seed.identity);assert.equal(m.previousManifest,p.seed.selectedManifest);
 const expectedState={version:2,identitySha256:p.seedSelected.record.state.identitySha256,
  revision:1,previous:sha(p.seed.selectedManifest),operationId:p.request.operationId,kind:'handoff',ownerSide:1,visitedSides:3,
  aliases:p.request.aliases,referenceBindings:p.request.referenceBindings,worlds:p.inputs.map(r=>({size:r.bytes,sha256:r.sha256})),
  homeAliases:p.request.homeAliases};
 const expectedMarker=['majesty-entity-revision-v1',1,1,expectedState.identitySha256,sha(encodeEntityRevision(expectedState)),''].join('\n');
 assert.equal(m.selectedManifest,expectedMarker);assert.deepEqual(m.selectedState,expectedState);
 const owner={entityId:p.seed.identity.entityId,region:'1_0',...p.request.aliases[1]};
 assert.deepEqual(m.selectedOwner,owner);assert.deepEqual(m.inputs,p.inputs);assert.deepEqual(m.worlds,expectedState.worlds);
 async function reopened(directory) {
  const stats={},store=await openEntityRevisionStore(await stoppedRevisionStorage(directory,stats),p.seed.identity.contentDigest);
  assert.deepEqual(store.identity,p.seed.identity);const s=await store.read();
  assert.equal(s.record.manifest,expectedMarker);assert.deepEqual(s.record.state,expectedState);assert.deepEqual(s.owner,owner);
  assert.equal((await readdir(directory)).length,8);assert.ok(stats.largestRead<=4096&&stats.peakReads===1);
 }
 await reopened(m.fixture);
 assert.deepEqual(m.interruptionCases.map(c=>c.boundary),['after-source','after-state','before-publish','after-publish']);
 const directories=new Set([m.fixture]);
 for(const c of m.interruptionCases) {
  assert.ok(!directories.has(c.fixture));directories.add(c.fixture);await reopened(c.fixture);
  const published=c.boundary==='after-publish';assert.equal(c.recoveredRevision,published?1:0);
  assert.deepEqual(c.recoveredOwner,published?owner:p.seed.selectedOwner);
  assert.deepEqual([c.completePairSelected,c.retryRevision,c.exactRetryWrites,c.retainedFiles],[true,1,0,8]);
  assert.ok(c.largestRead<=4096&&c.largestWrite<=4096&&c.peakReads===1);
 }
 assert.deepEqual(m.rejectedCases.map(c=>c.name),['wrong owner','changed outgoing alias','changed registered home','stale expected manifest','forged destination digest']);
 for(const c of m.rejectedCases)assert.deepEqual([c.rejected,c.selectedOriginalPairUnchanged],[true,true]);
 for(const n of ['seedStoreUnchanged','producerWorldsUnchanged','exactRetryIdempotent','staleOperationRejected'])assert.equal(m[n],true);
 assert.deepEqual([m.retainedFiles,m.retainedWorldSlots,m.exactRetryWrites],[8,4,0]);
 assert.ok(m.largestRead<=4096&&m.largestWrite<=4096&&m.peakReads===1);
 for(const n of ['heroCrossingQualified','heroRevisionNativeReloadQualified','remoteHomeRoutingQualified','concurrentOsWritersQualified'])assert.equal(m[n],false);
 await assertRegisteredHeroInputsUnchanged(p);
 return {version:1,actualRegisteredHeroStoppedPairPublished:true,actualRegisteredHeroStoppedPairIndependentlyQualified:true,
  scope:m.scope,publication:resolve(name),publicationSha256:await handoffHash(name),fixture:m.fixture,
  identity:p.seed.identity,selectedOwner:owner,selectedManifest:expectedMarker,selectedState:expectedState,
  worlds:expectedState.worlds,inputs:p.inputs,interruptionCases:4,rejectedCases:5,
  retainedFiles:8,retainedWorldSlots:4,exactRetryWrites:0,seedStoreUnchanged:true,producerWorldsUnchanged:true,
  heroCrossingQualified:false,heroRevisionNativeReloadQualified:false,remoteHomeRoutingQualified:false,
  concurrentOsWritersQualified:false,browserUsed:false,nativeProcessesStarted:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
 const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <publication proof> <fresh independent report>');
 const r=await inspectNativeHeroHandoff(name);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({actualRegisteredHeroStoppedPairIndependentlyQualified:true,ownerRegion:'1_0',revision:1,
  interruptionCases:4,retainedFiles:8,heroCrossingQualified:false,browserUsed:false}));
}
