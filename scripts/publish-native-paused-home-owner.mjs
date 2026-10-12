#!/usr/bin/env node
// Commit the exact pair while the supervised native engine is paused. The
// supervisor delivers the acknowledgement only after independent reopening.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {readSelectedRemoteHomeTask,prepareSelectedRemoteHomeReturn} from '../web/world/remote-home-task.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointActorRecords} from '../web/world/checkpoint.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
const m=JSON.parse(await readFile(name,'utf8'));assert.equal(m.nativeSessionTerminal,false);assert(m.liveOwner);
process.kill(m.nativePid,0);const startedAtMs=Date.now();
const root=await ownedDirectory(m.fixture,'actor-arrival-fixture-session-home-');
assert.equal(m.worldRoot,join(root,'actor-arrival-fixture-outdoor-family-snapshot-bridge/native-world-home'));
const directory=await ownedDirectory(m.liveOwner.directory,'actor-arrival-fixture-entity-revision-live-session-');
const prep=JSON.parse(await readFile(m.preparation,'utf8'));
assert.equal((await hashNativeFile(m.preparation)).sha256,m.preparationSha256);
for(const[n,h]of Object.entries(m.compiledSourceSha256))assert.equal((await hashNativeFile(join(workspace,n))).sha256,h);
assert.equal((await hashNativeFile(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke'))).sha256,m.nativeExecutableSha256);
const pause=await readFile(join(m.worldRoot,'Owner_Pause.txt'),'utf8'),p=pause.split('\n');
assert.equal(p.length,12);assert.deepEqual(p.slice(0,5),['native-owner-pause-v1',m.liveOwner.nonce,'1','0_0','57650']);
assert.deepEqual(p.slice(8),[sha(prep.selectedManifest),'530','31','']);
const captures=m.snapshotCaptures;assert.equal(captures.length,1);
const home=m.liveOwner.pausedCapture;assert(home);assert.equal(home.filename,join(root,'Owner_Paused_0_0.GMP'));
assert.equal(home.sha256,p[5]);assert.equal(captures[0].sha256,p[7]);assert.equal(String(captures[0].clock),p[6]);
const worlds=await Promise.all([home,captures[0]].map(async r=>{
  assert.equal((await hashNativeFile(r.filename)).sha256,r.sha256);assert.equal((await stat(r.filename)).size,r.bytes);
  const source=await stoppedFileSource(r.filename);assert.equal(await checkpointSavedClock(source),r.clock);return {source,sha256:r.sha256};
}));
const actor=await checkpointActorRecords(worlds[0].source,530);assert.equal(actor.unit.parentUnitId,0);assert.equal(actor.agent.agentId,31);
let writes=0,producerCalls=0;const stats={},adapter=await stoppedRevisionStorage(directory,stats);
const io={...adapter,async atomicWrite(n,produce){writes++;return adapter.atomicWrite(n,produce);}};
const store=await openEntityRevisionStore(io,prep.identity.contentDigest);
assert.equal((await store.read()).record.manifest,prep.selectedManifest);
const route=await readSelectedRemoteHomeTask(store,{expectedManifest:prep.selectedManifest});assert.deepEqual(route,prep.route);
const requestSha256=sha(pause),operationId=sha('native-paused-home-owner-v1\n'+requestSha256+'\n');
const transfer=await prepareSelectedRemoteHomeReturn(store,{expectedManifest:prep.selectedManifest,operationId},async selected=>{
  producerCalls++;assert.deepEqual(selected.route,route);process.kill(m.nativePid,0);
  return {freshUnitId:530,freshAgentId:31,worlds};
});
const committed=await transfer.commit();assert.equal(committed.revision,6);assert.equal(committed.owner.region,'0_0');
const beforeRetry=writes;assert.equal((await transfer.commit()).idempotent,true);assert.equal(writes,beforeRetry);assert.equal(producerCalls,1);
const reopened=await openEntityRevisionStore(io,prep.identity.contentDigest),selected=await reopened.read();
assert.equal(selected.record.manifest,committed.manifest);assert.deepEqual(selected.owner,{entityId:route.entityId,region:'0_0',unitId:530,agentId:31});
assert.deepEqual(selected.record.worlds,[home,captures[0]].map(r=>({size:r.bytes,sha256:r.sha256})));
assert(stats.largestRead<=4096&&stats.largestWrite<=4096&&stats.peakReads===1);process.kill(m.nativePid,0);
const manifestSha256=sha(committed.manifest),stateSha256=committed.manifest.split('\n')[4];
const acknowledgement=`native-owner-resume-v1\n${requestSha256}\n${manifestSha256}\n6\n${stateSha256}\n`;
const sourceSha256={};for(const n of ['scripts/publish-native-paused-home-owner.mjs','web/world/remote-home-task.mjs','web/world/entity-revisions.mjs','web/world/entity-ownership.mjs'])sourceSha256[n]=(await hashNativeFile(join(workspace,n))).sha256;
await writeFile(resolve(out),JSON.stringify({version:1,nativePausedHomeOwnerPublished:true,nativePid:m.nativePid,nativeAliveBeforeAndAfterCommit:true,
  startedAtMs,committedAtMs:Date.now(),directory,preparation:m.preparation,preparationSha256:m.preparationSha256,
  request:pause,requestSha256,operationId,previousManifest:prep.selectedManifest,selectedManifest:committed.manifest,selectedState:committed.state,
  selectedOwner:selected.owner,inputs:[home,captures[0]],producerCalls,exactRetryWrites:0,acknowledgement,manifestSha256,stateSha256,
  largestRead:stats.largestRead,largestWrite:stats.largestWrite,peakReads:stats.peakReads,sourceSha256,
  freshHomeActorImportQualified:false,browserUsed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativePausedHomeOwnerPublished:true,revision:6,owner:selected.owner,nativePid:m.nativePid,browserUsed:false}));
