#!/usr/bin/env node
// Publish the existing selected hero's ordinary native outdoor save, not a handoff.
import assert from 'node:assert/strict';
import {writeFile,lstat,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {prepareOutdoorOwnerSave,freshOutdoorOwnerStore,assertOutdoorSaveInputsUnchanged,
  outdoorHash,inspectOutdoorOwnerPublication} from './lib/registered-hero-outdoor-save.mjs';
const [publication,proof,out]=process.argv.slice(2);assert.equal(process.argv.length,5,
  'Usage: <prior return publication> <verified outdoor session> <fresh output>');
const output=resolve(out);try{await lstat(output);throw Error('Preserve previous outdoor publication');}catch(e){if(e.code!=='ENOENT')throw e;}
const p=await prepareOutdoorOwnerSave(publication,proof);
async function selected(t,manifest){
  const store=await openEntityRevisionStore(t.io,p.publication.identity.contentDigest),s=await store.read();
  assert.equal(s.record.manifest,manifest);assert.deepEqual(s.owner,p.selected.owner);return s;
}
const trial=await freshOutdoorOwnerStore(p),commit=await trial.store.commit(p.request);
assert.equal(commit.idempotent,false);assert.equal(trial.writes(),9);
async function retry(t){
  const store=await openEntityRevisionStore(t.io,p.publication.identity.contentDigest),r=await store.commit(p.request),writes=t.writes();
  assert.equal((await store.commit(p.request)).idempotent,true);assert.equal(t.writes(),writes);
  const s=await selected(t,r.manifest);assert.equal(s.record.revision,3);
  assert.deepEqual(s.record.worlds,p.inputs.map(i=>({size:i.bytes,sha256:i.sha256})));
  assert.equal((await readdir(t.directory)).length,8);
  assert(t.stats.largestRead<=4096&&t.stats.largestWrite<=4096&&t.stats.peakReads===1);return s;
}
const committed=await retry(trial),interruptions=[];
for(const boundary of ['after-source','after-state','before-publish','after-publish']){
  const t=await freshOutdoorOwnerStore(p),interruption=Error('Stopped outdoor save interruption at '+boundary);
  await assert.rejects(t.store.commit(p.request,at=>{if(at===boundary)throw interruption;}),e=>e===interruption);
  const published=boundary==='after-publish',s=await selected(t,published?commit.manifest:p.selected.record.manifest);
  assert.deepEqual(s.record.worlds,published?committed.record.worlds:p.selected.record.worlds);
  assert.equal((await retry(t)).record.manifest,commit.manifest);
  interruptions.push({boundary,fixture:t.directory,recoveredRevision:s.record.revision,completePairSelected:true,retryRevision:3,exactRetryWrites:0});
}
const rejected=[];
for(const [name,change]of [
  ['changed hero alias',q=>q.aliases[0].unitId++],['changed home',q=>q.homeAliases[0].agentId++],
  ['changed owner',q=>q.ownerSide=1],['changed dormant world',q=>q.worlds[1]=q.worlds[0]],
  ['unchanged active world',async q=>q.worlds[0]={source:await stoppedFileSource(p.publication.inputs[0].filename),
    sha256:p.selected.record.worlds[0].sha256}],
  ['stale manifest',q=>q.expectedManifest=null],['forged outdoor digest',q=>q.worlds[0].sha256='0'.repeat(64)]
]){
  const t=await freshOutdoorOwnerStore(p),q={...p.request,aliases:structuredClone(p.request.aliases),
    homeAliases:structuredClone(p.request.homeAliases),worlds:p.request.worlds.map(w=>({...w}))};
  await change(q);
  const writes=t.writes();await assert.rejects(t.store.commit(q));assert.equal(t.writes(),writes);
  await selected(t,p.selected.record.manifest);rejected.push({name,rejected:true,originalSelectionUnchanged:true,writes:0});
}
await assertOutdoorSaveInputsUnchanged(p);
const sourceSha256={};for(const n of ['scripts/publish-native-outdoor-owner.mjs','scripts/lib/registered-hero-outdoor-save.mjs',
  'scripts/inspect-native-region-session.mjs','scripts/lib/stopped-revision-io.mjs','web/world/entity-revisions.mjs',
  'web/world/entity-ownership.mjs','web/world/entity-home-ownership.mjs'])sourceSha256[n]=await outdoorHash(join(workspace,n));
await writeFile(output,JSON.stringify({version:1,actualRegisteredHeroOutdoorSavePublished:true,
  scope:'Ordinary native evolution selects the same registered hero504/GPL28 outdoors under revision3 in a fresh stopped copy of the actual revision2 store. The dormant region, logical identity, aliases and home are preserved. This is a save; no family transfer, browser activation or seamless crossing is qualified.',
  ...p.evidence,fixture:trial.directory,identity:p.publication.identity,previousManifest:p.selected.record.manifest,
  selectedManifest:commit.manifest,selectedOwner:committed.owner,selectedState:committed.record.state,
  worlds:committed.record.worlds,inputs:p.inputs,startClockMs:p.initialClockMs,endClockMs:57650,
  originalSelectionUnchanged:true,producerWorldsUnchanged:true,retainedFiles:8,retainedWorldSlots:4,
  largestRead:trial.stats.largestRead,largestWrite:trial.stats.largestWrite,peakReads:trial.stats.peakReads,
  exactRetryIdempotent:true,exactRetryWrites:0,interruptionCases:interruptions,rejectedCases:rejected,sourceSha256,
  heroTransferred:false,seamlessHeroCrossingQualified:false,browserUsed:false,nativeProcessesStarted:0,
  nativeBuildPerformed:false,concurrentOsWritersQualified:false},null,2)+'\n',{flag:'wx'});
await inspectOutdoorOwnerPublication(output);
console.log(JSON.stringify({actualRegisteredHeroOutdoorSavePublished:true,revision:3,heroId:504,agentId:28,
  interruptedCases:interruptions.length,rejectedCases:rejected.length,exactRetryWrites:0,retainedFiles:8,browserUsed:false}));
