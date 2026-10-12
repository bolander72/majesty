#!/usr/bin/env node
// Publish the stopped results of the actual single-process home session through
// the runtime home-task selector. Original selected stores remain read-only.
import assert from 'node:assert/strict';
import {readFile,writeFile,open,mkdtemp,lstat,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectNativeSelectedHomeSession} from './inspect-native-selected-home-session.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {prepareSelectedRemoteHomeReturn,readSelectedRemoteHomeTask} from '../web/world/remote-home-task.mjs';
const [manifestName,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <completed native home session> <fresh publication>');
const output=resolve(out);try{await lstat(output);throw Error('Preserve previous publication');}catch(e){if(e.code!=='ENOENT')throw e;}
const observed=await inspectNativeSelectedHomeSession(manifestName),m=JSON.parse(await readFile(manifestName,'utf8'));
const prep=JSON.parse(await readFile(m.preparation,'utf8')),pub=JSON.parse(await readFile(prep.publication,'utf8'));
const sourceIo=await stoppedRevisionStorage(pub.fixture),sourceStore=await openEntityRevisionStore(sourceIo,prep.identity.contentDigest);
const original=await sourceStore.read();assert.equal(original.record.manifest,prep.selectedManifest);
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-native-session-'));
const names=await readdir(pub.fixture);assert.equal(names.length,8);
await sourceIo.withLock('shared',async()=>{
  for(const name of names){const source=await sourceIo.open(name),f=await open(join(directory,name),'wx');
    try{for(let at=0;at<source.size;at+=4096){const b=await source.readAt(at,Math.min(4096,source.size-at));
      for(let n=0;n<b.length;){const r=await f.write(b,n,b.length-n,at+n);assert(r.bytesWritten);n+=r.bytesWritten;}}await f.sync();}
    finally{await f.close();}
  }
});
let writes=0;const stats={},adapter=await stoppedRevisionStorage(directory,stats);
const io={...adapter,async atomicWrite(name,produce){writes++;return adapter.atomicWrite(name,produce);}};
const store=await openEntityRevisionStore(io,prep.identity.contentDigest);
assert.deepEqual(await store.read(),original);
const route=await readSelectedRemoteHomeTask(store,{expectedManifest:prep.selectedManifest});assert.deepEqual(route,observed.route);
const captures=observed.worldCaptures,worlds=async homeIndex=>Promise.all([captures[homeIndex],captures[0]].map(async r=>({source:await stoppedFileSource(r.filename),sha256:r.sha256})));
const operationId=stage=>createHash('sha256').update(JSON.stringify({stage,nativeSessionManifestSha256:observed.manifestSha256,
  previousManifest:prep.selectedManifest,entityId:route.entityId,worlds:captures.map(r=>r.sha256)})+'\n').digest('hex');
let producerCalls=0,escaped;
const transfer=await prepareSelectedRemoteHomeReturn(store,{expectedManifest:prep.selectedManifest,operationId:operationId('home-handoff')},async selected=>{
  producerCalls++;assert.deepEqual(selected.route,route);escaped=selected.sources;
  return {freshUnitId:observed.freshOwner.unitId,freshAgentId:observed.freshOwner.agentId,worlds:await worlds(1)};
});
for(const source of escaped)await assert.rejects(source.readAt(0,1),/lease ended/);
const returned=await transfer.commit();assert.equal(returned.revision,6);assert.equal(returned.owner.region,'0_0');
const afterReturnWrites=writes;assert.equal((await transfer.commit()).idempotent,true);assert.equal(writes,afterReturnWrites);assert.equal(producerCalls,1);
assert.equal(await readSelectedRemoteHomeTask(store,{expectedManifest:returned.manifest}),null);
const latest={worlds:await worlds(2),aliases:returned.state.aliases,homeAliases:returned.state.homeAliases,
  referenceBindings:returned.state.referenceBindings,ownerSide:0,visitedSides:3,kind:'save',
  expectedManifest:returned.manifest,operationId:operationId('home-following-save')};
const final=await store.commit(latest);assert.equal(final.revision,7);
const selected=await store.read();assert.deepEqual(selected.owner,{entityId:route.entityId,region:route.homeRegion,...observed.freshOwner});
assert.deepEqual(selected.record.worlds,[captures[2],captures[0]].map(r=>({size:r.bytes,sha256:r.sha256})));
const afterSaveWrites=writes;assert.equal((await store.commit(latest)).idempotent,true);assert.equal(writes,afterSaveWrites);
const reopened=await openEntityRevisionStore(io,prep.identity.contentDigest);assert.deepEqual(await reopened.read(),selected);
assert.deepEqual(await sourceStore.read(),original);assert.equal((await readdir(directory)).length,8);
assert(stats.largestRead<=4096&&stats.largestWrite<=4096&&stats.peakReads===1);
const sourceSha256={};for(const n of ['scripts/publish-native-selected-home-session.mjs','scripts/inspect-native-selected-home-session.mjs',
  'web/world/remote-home-task.mjs','web/world/entity-revisions.mjs','web/world/entity-ownership.mjs'])sourceSha256[n]=(await hashNativeFile(join(workspace,n))).sha256;
await writeFile(output,JSON.stringify({version:1,nativeSingleSessionStoppedHomeOwnershipPublished:true,
  nativeSessionManifest:resolve(manifestName),nativeSessionManifestSha256:observed.manifestSha256,fixture:directory,identity:prep.identity,
  previousManifest:prep.selectedManifest,returnedManifest:returned.manifest,returnedState:returned.state,
  selectedManifest:final.manifest,selectedState:final.state,selectedOwner:selected.owner,worlds:selected.record.worlds,
  inputs:[captures[2],captures[0]],receivingSavedClockMs:captures[0].clock,selectedHomeClockMs:captures[2].clock,
  producerCalls,exactRetryWrites:0,retainedFiles:8,retainedWorldSlots:4,largestRead:stats.largestRead,largestWrite:stats.largestWrite,peakReads:stats.peakReads,
  originalSelectionUnchanged:true,sourceSha256,
  scope:'One original native session performs remote retirement, saves its latest receiving world before disposal, restores the archived home preparation and ordinarily enters the real guild. The runtime selector consumes that session’s new receiving26500/home59300 saves and publishes stopped home ownership under revision6; the following home60950 save selects revision7. Original selected inputs are preserved. Publication occurs after the native process stops; this is not an atomic transaction inside an active engine.',
  nativeEngineOwnershipTransactionQualified:false,freshHomeActorImportQualified:false,activeRemoteContinuationQualified:false,
  seamlessHeroCrossingQualified:false,browserUsed:false,nativeProcessesStarted:0,nativeBuildPerformed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSingleSessionStoppedHomeOwnershipPublished:true,revision:7,owner:selected.owner,
  receivingClockMs:captures[0].clock,homeClockMs:captures[2].clock,producerCalls,exactRetryWrites:0,browserUsed:false}));
