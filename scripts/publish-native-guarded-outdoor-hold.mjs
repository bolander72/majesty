#!/usr/bin/env node
// Preserve the actual held receiving state after the stopped outward handoff.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {inspectGuardedOutdoorPublication,prepareGuardedOutdoorHandoff,freshGuardedOutdoorStore,guardedHandoffHash} from './lib/guarded-outdoor-handoff.mjs';
const [publicationName,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <guarded handoff publication> <fresh held-save proof>');
const output=resolve(out);try{await lstat(output);throw Error('Preserve previous held-save proof');}catch(e){if(e.code!=='ENOENT')throw e;}
const publication=await inspectGuardedOutdoorPublication(publicationName),p=await prepareGuardedOutdoorHandoff(publication.previousPublication,
  publication.receivingProof,publication.homeProof,publication.homeArchive);
const inputs=[publication.inputs[0],p.receiving.worlds.Held],worlds=[];
for(const r of inputs){assert.equal(await guardedHandoffHash(r.filename),r.sha256);worlds.push({source:await stoppedFileSource(r.filename),sha256:r.sha256});}
assert.equal(await checkpointSavedClock(worlds[1].source),p.receiving.endClockMs);
assert(p.receiving.homeRequest.requestClockMs<=p.receiving.endClockMs);
const evidence={previousPublication:resolve(publicationName),previousPublicationSha256:await guardedHandoffHash(publicationName)};
const request={worlds,aliases:publication.selectedState.aliases,homeAliases:publication.selectedState.homeAliases,
  referenceBindings:publication.selectedState.referenceBindings,ownerSide:1,visitedSides:publication.selectedState.visitedSides,
  kind:'save',expectedManifest:publication.selectedManifest,
  operationId:createHash('sha256').update(JSON.stringify({evidence,worlds:inputs.map(r=>r.sha256)})+'\n').digest('hex')};
async function fresh(){const t=await freshGuardedOutdoorStore(p),r=await t.store.commit(p.request);
  assert.equal(r.manifest,publication.selectedManifest);assert.deepEqual((await t.store.read()).record.state,publication.selectedState);return t;}
async function selected(t,manifest){const store=await openEntityRevisionStore(t.io,publication.identity.contentDigest),s=await store.read();
  assert.equal(s.record.manifest,manifest);assert.deepEqual(s.owner,publication.selectedOwner);return s;}
async function retry(t){const store=await openEntityRevisionStore(t.io,publication.identity.contentDigest),r=await store.commit(request),writes=t.writes();
  assert.equal((await store.commit(request)).idempotent,true);assert.equal(t.writes(),writes);
  const s=await selected(t,r.manifest);assert.equal(s.record.revision,5);
  assert.deepEqual(s.record.worlds,inputs.map(r=>({size:r.bytes,sha256:r.sha256})));
  assert.equal((await readdir(t.directory)).length,8);assert(t.stats.largestRead<=4096&&t.stats.largestWrite<=4096&&t.stats.peakReads===1);return s;}
const trial=await fresh(),committed=await trial.store.commit(request),final=await retry(trial),interruptions=[];
for(const boundary of ['after-source','after-state','before-publish','after-publish']){
  const t=await fresh(),failure=Error('Stopped receiving hold save interruption at '+boundary);
  await assert.rejects(t.store.commit(request,at=>{if(at===boundary)throw failure;}),e=>e===failure);
  const published=boundary==='after-publish',s=await selected(t,published?committed.manifest:publication.selectedManifest);
  assert.deepEqual(s.record.worlds,published?final.record.worlds:publication.worlds);
  assert.equal((await retry(t)).record.manifest,committed.manifest);
  interruptions.push({boundary,fixture:t.directory,recoveredRevision:s.record.revision,completePairSelected:true,retryRevision:5,exactRetryWrites:0});
}
const rejected=[];
for(const [name,change]of [
  ['actually retired receiving hero',async q=>q.worlds[1]={source:await stoppedFileSource(p.receiving.worlds.Departed.filename),sha256:p.receiving.worlds.Departed.sha256}],
  ['changed dormant source',async q=>q.worlds[0]={source:await stoppedFileSource(p.stillOwnedSource.filename),sha256:p.stillOwnedSource.sha256}],
  ['changed receiving alias',q=>q.aliases[1].agentId++],['stale manifest',q=>q.expectedManifest=null]
]){
  const t=await fresh(),q={...request,aliases:structuredClone(request.aliases),worlds:request.worlds.map(w=>({...w}))};await change(q);
  await assert.rejects(t.store.commit(q));await selected(t,publication.selectedManifest);rejected.push({name,rejected:true,previousSelectionUnchanged:true});
}
await inspectGuardedOutdoorPublication(publicationName);for(const r of inputs)assert.equal(await guardedHandoffHash(r.filename),r.sha256);
const sourceSha256={};for(const n of ['scripts/publish-native-guarded-outdoor-hold.mjs','scripts/lib/guarded-outdoor-handoff.mjs',
  'web/world/entity-revisions.mjs','web/world/entity-ownership.mjs','web/world/entity-home-ownership.mjs'])sourceSha256[n]=await guardedHandoffHash(join(workspace,n));
await writeFile(output,JSON.stringify({version:1,actualGuardedOutdoorHoldSavePublished:true,
  scope:'Actual guarded receiving evolution from24250 to25300 selects the same hero561/GPL49 under stopped revision5, preserving the retired dormant source, logical identity and homes. The selected world now includes the already emitted home request and other actors evolution. Native family bodies remain held; no ordinary unguarded/browser activation or continuous crossing is qualified.',
  ...evidence,fixture:trial.directory,identity:publication.identity,previousManifest:publication.selectedManifest,
  selectedManifest:committed.manifest,selectedOwner:final.owner,selectedState:final.record.state,worlds:final.record.worlds,inputs,
  selectedReceivingClockMs:p.receiving.endClockMs,homeRequest:p.receiving.homeRequest,pauseAnchorClockMs:p.receiving.homeRequest.pauseAnchorClockMs,
  guardedHomeRequestPending:true,guardsRequired:publication.guardsRequired,originalSelectionUnchanged:true,producerWorldsUnchanged:true,
  retainedFiles:8,retainedWorldSlots:4,largestRead:trial.stats.largestRead,largestWrite:trial.stats.largestWrite,peakReads:trial.stats.peakReads,
  exactRetryIdempotent:true,exactRetryWrites:0,interruptionCases:interruptions,rejectedCases:rejected,sourceSha256,
  nativeEngineOwnershipActivationQualified:false,ordinaryUnguardedLaunchQualified:false,activeRemoteContinuationQualified:false,
  seamlessHeroCrossingQualified:false,browserUsed:false,nativeProcessesStarted:0,nativeBuildPerformed:false,concurrentOsWritersQualified:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({actualGuardedOutdoorHoldSavePublished:true,revision:5,ownerRegion:'1_0',receivingClockMs:p.receiving.endClockMs,
  interruptionCases:interruptions.length,rejectedCases:rejected.length,browserUsed:false}));
