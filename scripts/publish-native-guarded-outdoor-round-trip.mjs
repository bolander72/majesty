#!/usr/bin/env node
// Complete the stopped receiving hold -> home restoration -> ordinary guild entry.
import assert from 'node:assert/strict';
import {writeFile,lstat,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {guardedHandoffHash} from './lib/guarded-outdoor-handoff.mjs';
import {prepareGuardedOutdoorReturn,freshGuardedReturnStore,inspectGuardedOutdoorRoundTrip} from './lib/guarded-outdoor-return.mjs';
const [publicationName,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <held receiving publication> <fresh round-trip proof>');
const output=resolve(out);try{await lstat(output);throw Error('Preserve previous round-trip proof');}catch(e){if(e.code!=='ENOENT')throw e;}
const p=await prepareGuardedOutdoorReturn(publicationName),expectedOwner={entityId:p.publication.identity.entityId,region:'0_0',...p.returnRequest.aliases[0]};
async function selected(t,manifest,owner){const store=await openEntityRevisionStore(t.io,p.publication.identity.contentDigest),s=await store.read();
  assert.equal(s.record.manifest,manifest);assert.deepEqual(s.owner,owner);return s;}
const trial=await freshGuardedReturnStore(p),returned=await trial.store.commit(p.returnRequest);
p.entryRequest.expectedManifest=returned.manifest;
const committed=await trial.store.commit(p.entryRequest);
async function retry(t,req,manifest,revision){const store=await openEntityRevisionStore(t.io,p.publication.identity.contentDigest),r=await store.commit(req),writes=t.writes();
  assert.equal(r.manifest,manifest);assert.equal((await store.commit(req)).idempotent,true);assert.equal(t.writes(),writes);
  const s=await selected(t,manifest,expectedOwner);assert.equal(s.record.revision,revision);
  assert.deepEqual(s.record.worlds,req.worlds.map(w=>({size:w.source.size,sha256:w.sha256})));
  assert.equal((await readdir(t.directory)).length,8);assert(t.stats.largestRead<=4096&&t.stats.largestWrite<=4096&&t.stats.peakReads===1);return s;}
const final=await retry(trial,p.entryRequest,committed.manifest,7),interruptions=[];
for(const stage of ['return','guild-entry'])for(const boundary of ['after-source','after-state','before-publish','after-publish']){
  const t=await freshGuardedReturnStore(p),req=stage==='return'?p.returnRequest:p.entryRequest;
  if(stage==='guild-entry')assert.equal((await t.store.commit(p.returnRequest)).manifest,returned.manifest);
  const failure=Error('Stopped round-trip '+stage+' interruption at '+boundary);
  await assert.rejects(t.store.commit(req,at=>{if(at===boundary)throw failure;}),e=>e===failure);
  const published=boundary==='after-publish',manifest=stage==='return'?(published?returned.manifest:p.publication.selectedManifest):(published?committed.manifest:returned.manifest);
  const s=await selected(t,manifest,stage==='return'&&!published?p.publication.selectedOwner:expectedOwner);
  assert.deepEqual(s.record.worlds,stage==='return'?(published?returned.worlds:p.publication.worlds):(published?final.record.worlds:returned.worlds));
  await retry(t,req,stage==='return'?returned.manifest:committed.manifest,stage==='return'?6:7);
  interruptions.push({stage,boundary,fixture:t.directory,recoveredRevision:s.record.revision,completePairSelected:true,exactRetryWrites:0});
}
const rejected=[];
for(const[name,change]of [
  ['actual receiving owner still present',async q=>q.worlds[1]={source:await stoppedFileSource(p.receiving.worlds.Ready.filename),sha256:p.receiving.worlds.Ready.sha256}],
  ['actual home world lacks returned owner',async q=>q.worlds[0]={source:await stoppedFileSource(p.home.worlds.Source.filename),sha256:p.home.worlds.Source.sha256}],
  ['wrong owner',q=>q.ownerSide=1],['changed outgoing alias',q=>q.aliases[1].agentId++],
  ['reused home alias',q=>q.aliases[0]=structuredClone(p.publication.selectedState.aliases[0])],
  ['changed remote proxy home',q=>q.homeAliases[1].agentId++],['stale manifest',q=>q.expectedManifest=p.outward.selectedManifest]
]){
  const t=await freshGuardedReturnStore(p),q={...p.returnRequest,aliases:structuredClone(p.returnRequest.aliases),homeAliases:structuredClone(p.returnRequest.homeAliases),worlds:p.returnRequest.worlds.map(w=>({...w}))};
  await change(q);if(name.startsWith('actual '))assert(q.worlds.every((w,i)=>w.sha256!==p.publication.worlds[i].sha256),'Actual invalid worlds must reach owner validation');
  await assert.rejects(t.store.commit(q));await selected(t,p.publication.selectedManifest,p.publication.selectedOwner);
  rejected.push({name,rejected:true,previousSelectionUnchanged:true});
}
for(const r of [...p.returnInputs,...p.entryInputs])assert.equal(await guardedHandoffHash(r.filename),r.sha256);
const sourceSha256={};for(const n of ['scripts/publish-native-guarded-outdoor-round-trip.mjs','scripts/lib/guarded-outdoor-return.mjs',
  'scripts/lib/guarded-outdoor-handoff.mjs','web/world/entity-revisions.mjs','web/world/entity-ownership.mjs','web/world/entity-home-ownership.mjs'])sourceSha256[n]=await guardedHandoffHash(join(workspace,n));
await writeFile(output,JSON.stringify({version:1,actualGuardedOutdoorRoundTripPublished:true,
  scope:'Stopped revision5 receiving Held emits the checked home request. Actual receiving retirement and native142 fully loaded home restoration select sole home owner530/GPL31 under revision6; ordinary native guild entry selects revision7. Payload, effects, script and pause-anchor order ages match the selected held family. This connects existing original native runs through immutable stopped saves; it is not an active engine transaction, browser activation or seamless spatial crossing.',
  ...p.evidence,...p.evidenceCounts,fixture:trial.directory,identity:p.publication.identity,previousManifest:p.publication.selectedManifest,
  returnedManifest:returned.manifest,returnedState:returned.state,selectedManifest:committed.manifest,selectedOwner:final.owner,
  selectedState:final.record.state,worlds:final.record.worlds,inputs:p.entryInputs,consumedHomeRequest:p.publication.homeRequest,
  guardedHomeRequestPending:false,actualOrdinaryGuildEntrySelected:true,selectedHomeClockMs:p.home.endClockMs,dormantReceivingClockMs:25300,
  retainedFiles:8,retainedWorldSlots:4,largestRead:trial.stats.largestRead,largestWrite:trial.stats.largestWrite,peakReads:trial.stats.peakReads,
  originalSelectionUnchanged:true,producerWorldsUnchanged:true,exactRetryWrites:0,interruptionCases:interruptions,rejectedCases:rejected,sourceSha256,
  nativeEngineOwnershipActivationQualified:false,ordinaryUnguardedLaunchQualified:false,activeRemoteContinuationQualified:false,
  seamlessHeroCrossingQualified:false,browserUsed:false,nativeProcessesStarted:0,nativeBuildPerformed:false,concurrentOsWritersQualified:false},null,2)+'\n',{flag:'wx'});
await inspectGuardedOutdoorRoundTrip(output);
console.log(JSON.stringify({actualGuardedOutdoorRoundTripPublished:true,revision:7,ownerRegion:'0_0',heroId:p.home.heroId,agentId:p.home.agentId,
  ordinaryGuildEntrySelected:true,interruptionCases:interruptions.length,rejectedCases:rejected.length,browserUsed:false}));
