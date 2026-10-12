#!/usr/bin/env node
// Select actual native worlds in a disposable owner store, with interrupted
// publication recovery. No engine/browser runs or prior stores are modified.
import assert from 'node:assert/strict';
import {writeFile,lstat,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {prepareRegisteredHeroHandoff,freshRegisteredHeroStore,
 assertRegisteredHeroInputsUnchanged,handoffHash} from './lib/registered-hero-handoff.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [departure,live,seed,out]=process.argv.slice(2);
assert.equal(process.argv.length,6,'Usage: <terminal departure> <terminal live> <initial seed proof> <fresh report>');
const output=resolve(out);try{await lstat(output);throw Error('Preserve existing proof');}catch(e){if(e.code!=='ENOENT')throw e;}
const p=await prepareRegisteredHeroHandoff(departure,live,seed);
const expectedOwner={entityId:p.seed.identity.entityId,region:'1_0',...p.request.aliases[1]};
async function selected(t,manifest,owner) {
 const opened=await openEntityRevisionStore(t.io,p.seed.identity.contentDigest),s=await opened.read();
 assert.equal(s.record.manifest,manifest);assert.deepEqual(s.owner,owner);return s;
}
async function retry(t) {
 const reopened=await openEntityRevisionStore(t.io,p.seed.identity.contentDigest);
 const r=await reopened.commit(p.request),writes=t.writes();
 const again=await reopened.commit(p.request);assert.equal(again.idempotent,true);
 assert.equal(again.manifest,r.manifest);assert.equal(t.writes(),writes);
 const s=await selected(t,r.manifest,expectedOwner);assert.equal(s.record.state.revision,1);
 assert.deepEqual(s.record.state.aliases,p.request.aliases);assert.deepEqual(s.record.state.homeAliases,p.seed.homeAliases);
 assert.deepEqual(s.record.worlds,p.inputs.map(r=>({size:r.bytes,sha256:r.sha256})));
 assert.equal((await readdir(t.directory)).length,8);
 assert.ok(t.stats.largestRead<=4096&&t.stats.largestWrite<=4096&&t.stats.peakReads===1);
 return s;
}
const trial=await freshRegisteredHeroStore(p),r=await trial.store.commit(p.request);
assert.equal(r.idempotent,false);assert.equal(trial.writes(),9);
const committed=await retry(trial),cases=[];
for(const boundary of ['after-source','after-state','before-publish','after-publish']) {
 const t=await freshRegisteredHeroStore(p),interruption=Error('Owned stopped interruption at '+boundary);
 await assert.rejects(t.store.commit(p.request,at=>{if(at===boundary)throw interruption;}),e=>e===interruption);
 const published=boundary==='after-publish';
 const recovered=await selected(t,published?r.manifest:p.seed.selectedManifest,published?expectedOwner:p.seed.selectedOwner);
 assert.deepEqual(recovered.record.worlds,(published?p.inputs:p.seed.inputs).map(r=>({size:r.bytes,sha256:r.sha256})));
 const resumed=await retry(t);assert.equal(resumed.record.manifest,r.manifest);
 cases.push({boundary,fixture:t.directory,recoveredRevision:recovered.record.revision,
  recoveredOwner:recovered.owner,completePairSelected:true,retryRevision:1,exactRetryWrites:0,retainedFiles:8,
  largestRead:t.stats.largestRead,largestWrite:t.stats.largestWrite,peakReads:t.stats.peakReads});
}
const rejected=[];
for(const [name,change] of [
 ['wrong owner',q=>{q.ownerSide=0;}],['changed outgoing alias',q=>{q.aliases[0].unitId++;}],
 ['changed registered home',q=>{q.homeAliases[0].agentId++;}],['stale expected manifest',q=>{q.expectedManifest=null;}],
 ['forged destination digest',q=>{q.worlds[1].sha256='0'.repeat(64);}]
]) {
 const t=await freshRegisteredHeroStore(p),q={...p.request,aliases:structuredClone(p.request.aliases),
  homeAliases:structuredClone(p.request.homeAliases),worlds:p.request.worlds.map(w=>({...w}))};change(q);
 await assert.rejects(t.store.commit(q));await selected(t,p.seed.selectedManifest,p.seed.selectedOwner);
 rejected.push({name,rejected:true,selectedOriginalPairUnchanged:true});
}
await assert.rejects(trial.store.commit({...p.request,operationId:'0'.repeat(64)}),/Revision changed/);
assert.equal((await trial.store.read()).record.manifest,r.manifest);
await assertRegisteredHeroInputsUnchanged(p);
const result={version:1,actualRegisteredHeroStoppedPairPublished:true,
 scope:'Actual original source departure and destination6000ms original AI continuation select one registered Warrior owner in1_0 under revision1. Both full worlds publish through one stopped manifest; the guild registration retains its logical slot and the remote proxy retains home identity. Serial parent/worker interruptions and exact retries qualify these native snapshots. No continuous seam travel, return routing, fresh native paired reload, browser publication, concurrent OS writers, campaign or internet qualification.',
 ...p.evidence,fixture:trial.directory,identity:p.seed.identity,previousManifest:p.seed.selectedManifest,
 selectedManifest:r.manifest,selectedOwner:committed.owner,selectedState:committed.record.state,worlds:committed.record.worlds,
 inputs:p.inputs,seedStoreUnchanged:true,producerWorldsUnchanged:true,retainedFiles:8,retainedWorldSlots:4,
 largestRead:trial.stats.largestRead,largestWrite:trial.stats.largestWrite,peakReads:trial.stats.peakReads,
 exactRetryIdempotent:true,exactRetryWrites:0,staleOperationRejected:true,interruptionCases:cases,rejectedCases:rejected,
 heroCrossingQualified:false,heroRevisionNativeReloadQualified:false,remoteHomeRoutingQualified:false,
 browserUsed:false,nativeProcessesStarted:0,nativeBuildPerformed:false,concurrentOsWritersQualified:false,sourceSha256:{}};
for(const n of ['scripts/publish-native-hero-handoff.mjs','scripts/lib/registered-hero-handoff.mjs',
 'scripts/inspect-native-hero-departure.mjs','scripts/inspect-native-hero-live.mjs',
 'scripts/lib/stopped-revision-io.mjs','web/world/entity-revisions.mjs',
 'web/world/entity-ownership.mjs','web/world/entity-home-ownership.mjs'])result.sourceSha256[n]=await handoffHash(join(workspace,n));
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({actualRegisteredHeroStoppedPairPublished:true,revision:1,ownerRegion:'1_0',
 interruptionCases:cases.length,rejectedCases:rejected.length,exactRetryWrites:0,retainedFiles:8,browserUsed:false}));
