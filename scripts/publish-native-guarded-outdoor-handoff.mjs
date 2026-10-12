#!/usr/bin/env node
// Select one stopped remote owner; its pending home task still requires guards.
import assert from 'node:assert/strict';
import {writeFile,lstat,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {prepareGuardedOutdoorHandoff,freshGuardedOutdoorStore,guardedHandoffHash,inspectGuardedOutdoorPublication} from './lib/guarded-outdoor-handoff.mjs';
const [publication,receiving,home,archive,out]=process.argv.slice(2);assert.equal(process.argv.length,7,
  'Usage: <outdoor publication> <receiving full-load proof> <home return proof> <frozen home archive> <fresh output>');
const output=resolve(out);try{await lstat(output);throw Error('Preserve earlier handoff proof');}catch(e){if(e.code!=='ENOENT')throw e;}
const p=await prepareGuardedOutdoorHandoff(publication,receiving,home,archive);
const expectedOwner={entityId:p.publication.identity.entityId,region:'1_0',...p.request.aliases[1]};
async function selected(t,manifest,owner){const store=await openEntityRevisionStore(t.io,p.publication.identity.contentDigest),s=await store.read();
  assert.equal(s.record.manifest,manifest);assert.deepEqual(s.owner,owner);return s;}
const trial=await freshGuardedOutdoorStore(p),committed=await trial.store.commit(p.request);
assert.equal(committed.idempotent,false);
async function retry(t){const store=await openEntityRevisionStore(t.io,p.publication.identity.contentDigest),r=await store.commit(p.request),writes=t.writes();
  assert.equal((await store.commit(p.request)).idempotent,true);assert.equal(t.writes(),writes);
  const s=await selected(t,r.manifest,expectedOwner);assert.equal(s.record.revision,4);
  assert.deepEqual(s.record.worlds,p.inputs.map(r=>({size:r.bytes,sha256:r.sha256})));
  assert.equal((await readdir(t.directory)).length,8);assert(t.stats.largestRead<=4096&&t.stats.largestWrite<=4096&&t.stats.peakReads===1);return s;}
const final=await retry(trial),interruptions=[];
for(const boundary of ['after-source','after-state','before-publish','after-publish']){
  const t=await freshGuardedOutdoorStore(p),failure=Error('Stopped guarded handoff interruption at '+boundary);
  await assert.rejects(t.store.commit(p.request,at=>{if(at===boundary)throw failure;}),e=>e===failure);
  const published=boundary==='after-publish',s=await selected(t,published?committed.manifest:p.publication.selectedManifest,
    published?expectedOwner:p.publication.selectedOwner);
  assert.deepEqual(s.record.worlds,published?final.record.worlds:p.publication.worlds);
  assert.equal((await retry(t)).record.manifest,committed.manifest);
  interruptions.push({boundary,fixture:t.directory,recoveredRevision:s.record.revision,recoveredOwner:s.owner,completePairSelected:true,retryRevision:4,exactRetryWrites:0});
}
const rejected=[];
for(const [name,change]of [
  ['source still owns hero',async q=>q.worlds[0]={source:await stoppedFileSource(p.stillOwnedSource.filename),sha256:p.stillOwnedSource.sha256}],
  ['destination missing hero',async q=>q.worlds[1]={source:await stoppedFileSource(p.missingReceiving.filename),sha256:p.missingReceiving.sha256}],
  ['wrong owner',q=>q.ownerSide=0],['changed outgoing alias',q=>q.aliases[0].unitId++],
  ['reused receiving alias',q=>q.aliases[1]=structuredClone(p.publication.selectedState.aliases[1])],
  ['changed source home',q=>q.homeAliases[0].agentId++],['stale manifest',q=>q.expectedManifest=null],
  ['forged receiving digest',q=>q.worlds[1].sha256='0'.repeat(64)]
]){
  const t=await freshGuardedOutdoorStore(p),q={...p.request,aliases:structuredClone(p.request.aliases),
    homeAliases:structuredClone(p.request.homeAliases),worlds:p.request.worlds.map(w=>({...w}))};await change(q);
  if(['source still owns hero','destination missing hero'].includes(name))assert(q.worlds.every((w,i)=>w.sha256!==p.publication.worlds[i].sha256),
    'The invalid-world cases must reach ownership validation, not the unchanged-digest check');
  await assert.rejects(t.store.commit(q));await selected(t,p.publication.selectedManifest,p.publication.selectedOwner);
  rejected.push({name,rejected:true,previousSelectionUnchanged:true});
}
// Reopen the existing publication through its checked path; no original store
// or captured native world is mutated by any trial above.
const checked=await (await import('./lib/registered-hero-outdoor-save.mjs')).inspectOutdoorOwnerPublication(publication);
assert.equal(checked.selectedManifest,p.publication.selectedManifest);
for(const r of p.inputs)assert.equal(await guardedHandoffHash(r.filename),r.sha256);
const sourceSha256={};for(const n of ['scripts/publish-native-guarded-outdoor-handoff.mjs','scripts/lib/guarded-outdoor-handoff.mjs',
  'web/world/entity-revisions.mjs','web/world/entity-ownership.mjs','web/world/entity-home-ownership.mjs'])sourceSha256[n]=await guardedHandoffHash(join(workspace,n));
await writeFile(output,JSON.stringify({version:1,actualGuardedOutdoorFamilyStoppedHandoffPublished:true,
  scope:'Actual original source retirement and freshly fully loaded receiving-family saves select one stopped registered hero561/GPL49 in1_0 under revision4. Complete payload normalization binds it to source504/GPL28. The pending remote-home task still requires both native guards; ordinary unguarded launch, browser ownership activation and continuous crossing are unqualified.',
  ...p.evidence,...p.evidenceCounts,fixture:trial.directory,identity:p.publication.identity,previousManifest:p.publication.selectedManifest,
  selectedManifest:committed.manifest,selectedOwner:final.owner,selectedState:final.record.state,worlds:final.record.worlds,inputs:p.inputs,
  pendingHomeRequest:p.receiving.homeRequest,guardedHomeRequestPending:true,guardsRequired:['original-agent-update','original-command-update'],
  retainedFiles:8,retainedWorldSlots:4,largestRead:trial.stats.largestRead,largestWrite:trial.stats.largestWrite,peakReads:trial.stats.peakReads,
  originalSelectionUnchanged:true,producerWorldsUnchanged:true,exactRetryIdempotent:true,exactRetryWrites:0,interruptionCases:interruptions,rejectedCases:rejected,sourceSha256,
  nativeEngineOwnershipActivationQualified:false,ordinaryUnguardedLaunchQualified:false,activeRemoteContinuationQualified:false,
  seamlessHeroCrossingQualified:false,browserUsed:false,nativeProcessesStarted:0,nativeBuildPerformed:false,concurrentOsWritersQualified:false},null,2)+'\n',{flag:'wx'});
await inspectGuardedOutdoorPublication(output);
console.log(JSON.stringify({actualGuardedOutdoorFamilyStoppedHandoffPublished:true,revision:4,ownerRegion:'1_0',heroId:561,agentId:49,
  interruptionCases:interruptions.length,rejectedCases:rejected.length,guardedHomeRequestPending:true,browserUsed:false}));
