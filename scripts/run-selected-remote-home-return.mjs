#!/usr/bin/env node
// Exercise the runtime home-task selector with checked original native saves.
// The producer here reuses stopped captures; no live engine is activated.
import assert from 'node:assert/strict';
import {lstat,writeFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareSelectedRemoteHomeReturn,readSelectedRemoteHomeTask} from '../web/world/remote-home-task.mjs';
import {openEntityRevisionStore,encodeEntityRevision} from '../web/world/entity-revisions.mjs';
import {prepareGuardedOutdoorReturn,freshGuardedReturnStore,expectedGuardedReturnState} from './lib/guarded-outdoor-return.mjs';
import {guardedHandoffHash} from './lib/guarded-outdoor-handoff.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [publicationName,out]=process.argv.slice(2);
assert.equal(process.argv.length,4,'Usage: <held receiving publication> <fresh runtime return report>');
const output=resolve(out);
try{await lstat(output);throw Error('Preserve previous runtime report');}catch(e){if(e.code!=='ENOENT')throw e;}
const p=await prepareGuardedOutdoorReturn(publicationName),trial=await freshGuardedReturnStore(p);
const route=await readSelectedRemoteHomeTask(trial.store,{expectedManifest:p.publication.selectedManifest});
const native=p.publication.homeRequest;
assert.deepEqual([route.entityId,route.guildEntityId,route.worldId,route.contentDigest,route.sourceRegion,route.homeRegion],
  [native.entityId,native.guildEntityId,native.worldId,native.contentDigest,native.receivingRegion,native.homeRegion]);
assert.deepEqual([route.owner.unitId,route.owner.agentId,route.nativeHome.unitId,route.nativeHome.agentId,route.proxy.agentId,route.proxy.unitId],
  [native.heroId,native.agentId,native.homeUnitId,native.homeAgentId,native.proxyAgentId,native.proxyNativeId]);
assert.deepEqual([route.ownerRevision,route.sourceClockMs,route.homeClockMs,route.continuation,route.queuedHome.cProcId,route.queuedHome.homeUnitId],
  [5,25300,57650,'travel_to',4099,469]);
assert.deepEqual([route.sourceWorld,route.homeWorld],[p.publication.worlds[1],p.publication.worlds[0]]);
let producerCalls=0,leasedSources;
const transfer=await prepareSelectedRemoteHomeReturn(trial.store,
  {expectedManifest:p.publication.selectedManifest,operationId:p.returnRequest.operationId},async selected=>{
    producerCalls++;assert.deepEqual(selected.route,route);leasedSources=selected.sources;
    // prepareGuardedOutdoorReturn checked original native retirement,
    // full-world home restoration, payloads, effects, references and clock ages.
    // Bind those captured results to the route chosen under the selected lease.
    assert.equal(selected.route.homeRegion,'0_0');assert.equal(selected.route.sourceRegion,'1_0');
    return {freshUnitId:p.home.heroId,freshAgentId:p.home.agentId,worlds:p.returnRequest.worlds};
  });
for(const s of leasedSources)await assert.rejects(s.readAt(0,1),/lease ended/);
const returned=await transfer.commit();
const expected=expectedGuardedReturnState(p.publication.selectedState,p.returnRequest,6,p.publication.selectedManifest);
const stateSha256=createHash('sha256').update(encodeEntityRevision(expected)).digest('hex');
assert.deepEqual(returned.state,expected);
assert.equal(returned.manifest,['majesty-entity-revision-v1',0,6,expected.identitySha256,stateSha256,''].join('\n'));
const writes=trial.writes();assert.equal((await transfer.commit()).idempotent,true);assert.equal(trial.writes(),writes);assert.equal(producerCalls,1);
const reopened=await openEntityRevisionStore(trial.io,p.publication.identity.contentDigest);
assert.deepEqual((await reopened.read()).owner,{entityId:route.entityId,region:route.homeRegion,unitId:p.home.heroId,agentId:p.home.agentId});
assert.equal(await readSelectedRemoteHomeTask(reopened,{expectedManifest:returned.manifest}),null);
const entryRequest={...p.entryRequest,expectedManifest:returned.manifest},entered=await reopened.commit(entryRequest);
assert.deepEqual(entered.state,expectedGuardedReturnState(returned.state,entryRequest,7,returned.manifest));
const selected=await reopened.read();assert.equal(selected.record.manifest,entered.manifest);
assert.deepEqual(selected.record.worlds,p.entryRequest.worlds.map(w=>({size:w.source.size,sha256:w.sha256})));
assert.equal((await readdir(trial.directory)).length,8);
assert(trial.stats.largestRead<=4096&&trial.stats.largestWrite<=4096&&trial.stats.peakReads===1);
for(const file of [...p.returnInputs,...p.entryInputs])assert.equal(await guardedHandoffHash(file.filename),file.sha256);
const sourceSha256={};
for(const n of ['scripts/run-selected-remote-home-return.mjs','web/world/remote-home-task.mjs','web/world/family-order-entries.mjs',
  'web/world/entity-revisions.mjs','web/world/entity-home-ownership.mjs','scripts/lib/guarded-outdoor-return.mjs'])
  sourceSha256[n]=await guardedHandoffHash(join(workspace,n));
await writeFile(output,JSON.stringify({version:1,runtimeSelectedRemoteHomeReturn:true,
  scope:'The runtime selector reads the original guarded receiving go_home task, validates its complete Path/Queue4099 home target and chooses the registered home region under the selected ownership lease. The stopped native producer restores one home owner and retires the receiving owner. Runtime handoff selects revision6; ordinary native guild entry selects revision7. Existing original captures are reused; no live engine transaction or browser activation is qualified.',
  ...p.evidence,route,fixture:trial.directory,previousManifest:p.publication.selectedManifest,returnedManifest:returned.manifest,
  selectedManifest:selected.record.manifest,selectedState:selected.record.state,selectedOwner:selected.owner,
  worlds:selected.record.worlds,returnInputs:p.returnInputs,entryInputs:p.entryInputs,producerCalls,exactRetryWrites:0,
  retainedFiles:8,retainedWorldSlots:4,largestRead:trial.stats.largestRead,largestWrite:trial.stats.largestWrite,peakReads:trial.stats.peakReads,
  nativeEngineOwnershipActivationQualified:false,activeRemoteContinuationQualified:false,seamlessHeroCrossingQualified:false,
  browserUsed:false,nativeProcessesStarted:0,nativeBuildPerformed:false,sourceSha256},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({runtimeSelectedRemoteHomeReturn:true,selectedRevision:7,ownerRegion:selected.owner.region,
  heroId:selected.owner.unitId,producerCalls,exactRetryWrites:0,browserUsed:false}));
