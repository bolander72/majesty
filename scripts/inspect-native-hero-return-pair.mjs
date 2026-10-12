#!/usr/bin/env node
// Derive revision2 independently from the two terminal original-engine producers.
import assert from 'node:assert/strict';
import {writeFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareRegisteredHeroReturn,assertRegisteredHeroReturnInputsUnchanged} from './lib/registered-hero-return.mjs';
import {handoffJson,handoffHash} from './lib/registered-hero-handoff.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
import {openEntityRevisionStore,encodeEntityRevision} from '../web/world/entity-revisions.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function inspectNativeHeroReturnPair(name) {
 const m=await handoffJson(name);assert.deepEqual([m.version,m.actualRegisteredHeroStoppedReturnPairPublished,m.browserUsed,m.nativeProcessesStarted,m.nativeBuildPerformed],[1,true,false,0,false]);
 const sources=['scripts/publish-native-hero-return.mjs','scripts/lib/registered-hero-return.mjs',
  'scripts/inspect-native-remote-hero-departure.mjs','scripts/inspect-native-hero-return-live.mjs',
  'scripts/lib/stopped-revision-io.mjs','web/world/entity-revisions.mjs','web/world/entity-ownership.mjs','web/world/entity-home-ownership.mjs'];
 assert.deepEqual(Object.keys(m.sourceSha256).sort(),sources.sort());
 for(const [n,h]of Object.entries(m.sourceSha256))assert.equal(await handoffHash(join(workspace,n)),h);
 const p=await prepareRegisteredHeroReturn(m.departureManifest,m.liveManifest);
 for(const [n,v]of Object.entries(p.evidence))assert.equal(m[n],v);
 assert.deepEqual(m.identity,p.publication.identity);assert.equal(m.previousManifest,p.selected.record.manifest);
 const expectedState={version:2,identitySha256:p.selected.record.state.identitySha256,revision:2,previous:sha(p.selected.record.manifest),
  operationId:p.request.operationId,kind:'handoff',ownerSide:0,visitedSides:3,aliases:p.request.aliases,
  referenceBindings:p.request.referenceBindings,worlds:p.inputs.map(r=>({size:r.bytes,sha256:r.sha256})),homeAliases:p.request.homeAliases};
 const expectedMarker=['majesty-entity-revision-v1',0,2,expectedState.identitySha256,sha(encodeEntityRevision(expectedState)),''].join('\n');
 assert.equal(m.selectedManifest,expectedMarker);assert.deepEqual(m.selectedState,expectedState);
 const owner={entityId:p.publication.identity.entityId,region:'0_0',...p.request.aliases[0]};
 assert.deepEqual(m.selectedOwner,owner);assert.deepEqual(m.inputs,p.inputs);assert.deepEqual(m.worlds,expectedState.worlds);
 async function reopened(directory){const stats={},store=await openEntityRevisionStore(await stoppedRevisionStorage(directory,stats),p.publication.identity.contentDigest);
  assert.deepEqual(store.identity,p.publication.identity);const s=await store.read();
  assert.equal(s.record.manifest,expectedMarker);assert.deepEqual(s.record.state,expectedState);assert.deepEqual(s.owner,owner);
  assert.equal((await readdir(directory)).length,8);assert.ok(stats.largestRead<=4096&&stats.peakReads===1);}
 await reopened(m.fixture);assert.deepEqual(m.interruptionCases.map(c=>c.boundary),['after-source','after-state','before-publish','after-publish']);
 const directories=new Set([m.fixture]);
 for(const c of m.interruptionCases){assert.ok(!directories.has(c.fixture));directories.add(c.fixture);await reopened(c.fixture);
  const published=c.boundary==='after-publish';assert.equal(c.recoveredRevision,published?2:1);assert.deepEqual(c.recoveredOwner,published?owner:p.selected.owner);
  assert.deepEqual([c.completePairSelected,c.retryRevision,c.exactRetryWrites,c.retainedFiles],[true,2,0,8]);assert.ok(c.largestRead<=4096&&c.largestWrite<=4096&&c.peakReads===1);}
 assert.deepEqual(m.rejectedCases.map(c=>c.name),['wrong owner','changed outgoing alias','reused incoming alias','changed registered home','stale expected manifest','forged returned digest']);
 for(const c of m.rejectedCases)assert.deepEqual([c.rejected,c.selectedOriginalPairUnchanged],[true,true]);
 for(const n of ['originalSeedStoreUnchanged','originalOutwardStoreUnchanged','producerWorldsUnchanged','exactRetryIdempotent','staleOperationRejected'])assert.equal(m[n],true);
 assert.deepEqual([m.retainedFiles,m.retainedWorldSlots,m.exactRetryWrites],[8,4,0]);assert.ok(m.largestRead<=4096&&m.largestWrite<=4096&&m.peakReads===1);
 for(const n of ['heroReturnRevisionNativeReloadQualified','heroCrossingQualified','concurrentOsWritersQualified'])assert.equal(m[n],false);
 await assertRegisteredHeroReturnInputsUnchanged(p);
 return {version:1,actualRegisteredHeroStoppedReturnPairPublished:true,actualRegisteredHeroStoppedReturnPairIndependentlyQualified:true,
  scope:m.scope,publication:resolve(name),publicationSha256:await handoffHash(name),fixture:m.fixture,identity:p.publication.identity,
  selectedOwner:owner,selectedManifest:expectedMarker,selectedState:expectedState,worlds:expectedState.worlds,inputs:p.inputs,
  interruptionCases:4,rejectedCases:6,retainedFiles:8,retainedWorldSlots:4,exactRetryWrites:0,
  originalSeedStoreUnchanged:true,originalOutwardStoreUnchanged:true,producerWorldsUnchanged:true,
  heroReturnRevisionNativeReloadQualified:false,heroCrossingQualified:false,concurrentOsWritersQualified:false,browserUsed:false,nativeProcessesStarted:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <return publication> <fresh proof>');
 const r=await inspectNativeHeroReturnPair(name);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({actualRegisteredHeroStoppedReturnPairIndependentlyQualified:true,revision:2,ownerRegion:'0_0',
  interruptionCases:4,rejectedCases:6,retainedFiles:8,heroCrossingQualified:false,browserUsed:false}));
}
