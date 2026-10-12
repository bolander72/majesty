#!/usr/bin/env node
// Publish two actual original-engine return snapshots in a fresh stopped store.
import assert from 'node:assert/strict';
import {writeFile,lstat,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {prepareRegisteredHeroReturn,freshRegisteredHeroReturnStore,assertRegisteredHeroReturnInputsUnchanged} from './lib/registered-hero-return.mjs';
import {handoffHash} from './lib/registered-hero-handoff.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
const [departure,live,out]=process.argv.slice(2);assert.equal(process.argv.length,5,'Usage: <terminal remote departure> <terminal returned AI> <fresh proof>');
const output=resolve(out);try{await lstat(output);throw Error('Preserve previous proof');}catch(e){if(e.code!=='ENOENT')throw e;}
const p=await prepareRegisteredHeroReturn(departure,live),expectedOwner={entityId:p.publication.identity.entityId,region:'0_0',...p.request.aliases[0]};
async function selected(t,manifest,owner){const s=await (await openEntityRevisionStore(t.io,p.publication.identity.contentDigest)).read();
 assert.equal(s.record.manifest,manifest);assert.deepEqual(s.owner,owner);return s;}
async function retry(t){const reopened=await openEntityRevisionStore(t.io,p.publication.identity.contentDigest),r=await reopened.commit(p.request),writes=t.writes();
 const again=await reopened.commit(p.request);assert.equal(again.idempotent,true);assert.equal(again.manifest,r.manifest);assert.equal(t.writes(),writes);
 const s=await selected(t,r.manifest,expectedOwner);assert.equal(s.record.revision,2);assert.deepEqual(s.record.state.aliases,p.request.aliases);
 assert.deepEqual(s.record.state.homeAliases,p.request.homeAliases);assert.deepEqual(s.record.worlds,p.inputs.map(r=>({size:r.bytes,sha256:r.sha256})));
 assert.equal((await readdir(t.directory)).length,8);assert.ok(t.stats.largestRead<=4096&&t.stats.largestWrite<=4096&&t.stats.peakReads===1);return s;}
const trial=await freshRegisteredHeroReturnStore(p),r=await trial.store.commit(p.request);assert.equal(r.idempotent,false);assert.equal(trial.writes(),13);
const committed=await retry(trial),cases=[];
for(const boundary of ['after-source','after-state','before-publish','after-publish']){
 const t=await freshRegisteredHeroReturnStore(p),interruption=Error('Owned stopped return interruption at '+boundary);
 await assert.rejects(t.store.commit(p.request,at=>{if(at===boundary)throw interruption;}),e=>e===interruption);
 const published=boundary==='after-publish',recovered=await selected(t,published?r.manifest:p.selected.record.manifest,published?expectedOwner:p.selected.owner);
 assert.deepEqual(recovered.record.worlds,(published?p.inputs:p.publication.inputs).map(r=>({size:r.bytes,sha256:r.sha256})));
 assert.equal((await retry(t)).record.manifest,r.manifest);
 cases.push({boundary,fixture:t.directory,recoveredRevision:recovered.record.revision,recoveredOwner:recovered.owner,
  completePairSelected:true,retryRevision:2,exactRetryWrites:0,retainedFiles:8,
  largestRead:t.stats.largestRead,largestWrite:t.stats.largestWrite,peakReads:t.stats.peakReads});
}
const rejected=[];
for(const [name,change]of [
 ['wrong owner',q=>q.ownerSide=1],['changed outgoing alias',q=>q.aliases[1].unitId++],
 ['reused incoming alias',q=>q.aliases[0]=structuredClone(p.selected.record.state.aliases[0])],
 ['changed registered home',q=>q.homeAliases[0].agentId++],['stale expected manifest',q=>q.expectedManifest=null],
 ['forged returned digest',q=>q.worlds[0].sha256='0'.repeat(64)]
]){
 const t=await freshRegisteredHeroReturnStore(p),q={...p.request,aliases:structuredClone(p.request.aliases),
  homeAliases:structuredClone(p.request.homeAliases),worlds:p.request.worlds.map(w=>({...w}))};change(q);
 await assert.rejects(t.store.commit(q));await selected(t,p.selected.record.manifest,p.selected.owner);
 rejected.push({name,rejected:true,selectedOriginalPairUnchanged:true});
}
await assert.rejects(trial.store.commit({...p.request,operationId:'0'.repeat(64)}),/Revision changed/);
assert.equal((await trial.store.read()).record.manifest,r.manifest);await assertRegisteredHeroReturnInputsUnchanged(p);
const sourceSha256={};for(const n of ['scripts/publish-native-hero-return.mjs','scripts/lib/registered-hero-return.mjs',
 'scripts/inspect-native-remote-hero-departure.mjs','scripts/inspect-native-hero-return-live.mjs',
 'scripts/lib/stopped-revision-io.mjs','web/world/entity-revisions.mjs','web/world/entity-ownership.mjs','web/world/entity-home-ownership.mjs'])sourceSha256[n]=await handoffHash(join(workspace,n));
await writeFile(output,JSON.stringify({version:1,actualRegisteredHeroStoppedReturnPairPublished:true,
 scope:'Actual remote554/GPL48 original retirement and returned504/GPL28 original AI/guild entry select one registered owner in0_0 under revision2. Both actual full worlds publish through one stopped manifest in a fresh store, preserving the logical guild slot, native home and remote proxy. Four serial interruption cases recover complete old/new pairs and exact retries write nothing. Original seed/outward stores and producer files stay unchanged. No fresh returned paired native reload, continuous seam travel, browser publication, concurrent OS writer, campaign or internet qualification.',
 ...p.evidence,fixture:trial.directory,identity:p.publication.identity,previousManifest:p.selected.record.manifest,
 selectedManifest:r.manifest,selectedOwner:committed.owner,selectedState:committed.record.state,worlds:committed.record.worlds,inputs:p.inputs,
 originalSeedStoreUnchanged:true,originalOutwardStoreUnchanged:true,producerWorldsUnchanged:true,
 retainedFiles:8,retainedWorldSlots:4,largestRead:trial.stats.largestRead,largestWrite:trial.stats.largestWrite,peakReads:trial.stats.peakReads,
 exactRetryIdempotent:true,exactRetryWrites:0,staleOperationRejected:true,interruptionCases:cases,rejectedCases:rejected,sourceSha256,
 heroReturnRevisionNativeReloadQualified:false,heroCrossingQualified:false,browserUsed:false,nativeProcessesStarted:0,nativeBuildPerformed:false,
 concurrentOsWritersQualified:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({actualRegisteredHeroStoppedReturnPairPublished:true,revision:2,ownerRegion:'0_0',
 interruptionCases:cases.length,rejectedCases:rejected.length,exactRetryWrites:0,retainedFiles:8,browserUsed:false}));
