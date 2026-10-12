// Reopen and derive the complete stopped publication from the actual one-process
// native saves. Pending remote owners are never admitted as ordinary exports.
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectNativeSelectedHomeSession} from '../inspect-native-selected-home-session.mjs';
import {hashNativeFile} from './native-generation.mjs';
import {workspace} from './stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './stopped-revision-io.mjs';
import {openEntityRevisionStore,encodeEntityRevision} from '../../web/world/entity-revisions.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function json(n){assert((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
export async function inspectNativeSingleSessionHomePublication(name){
  const r=await json(name);assert.equal(r.nativeSingleSessionStoppedHomeOwnershipPublished,true);
  for(const[n,h]of Object.entries(r.sourceSha256))assert.equal((await hashNativeFile(join(workspace,n))).sha256,h);
  const native=await inspectNativeSelectedHomeSession(r.nativeSessionManifest);assert.equal(native.manifestSha256,r.nativeSessionManifestSha256);
  const manifest=await json(r.nativeSessionManifest),prep=await json(manifest.preparation),captures=native.worldCaptures;
  assert.deepEqual(r.identity,prep.identity);assert.equal(r.previousManifest,prep.selectedManifest);
  const operationId=stage=>sha(JSON.stringify({stage,nativeSessionManifestSha256:native.manifestSha256,
    previousManifest:prep.selectedManifest,entityId:native.route.entityId,worlds:captures.map(c=>c.sha256)})+'\n');
  const worlds=index=>[captures[index],captures[0]].map(c=>({size:c.bytes,sha256:c.sha256}));
  const returned={...structuredClone(prep.selectedState),revision:6,previous:sha(prep.selectedManifest),kind:'handoff',
    operationId:operationId('home-handoff'),ownerSide:0,visitedSides:3,aliases:[native.freshOwner,prep.selectedState.aliases[1]],worlds:worlds(1)};
  const slot=Number(prep.selectedManifest.split('\n')[1]),marker=(state,s)=>['majesty-entity-revision-v1',s,state.revision,state.identitySha256,sha(encodeEntityRevision(state)),''].join('\n');
  assert.equal(r.returnedManifest,marker(returned,1-slot));assert.deepEqual(r.returnedState,returned);
  const final={...returned,revision:7,previous:sha(r.returnedManifest),kind:'save',operationId:operationId('home-following-save'),worlds:worlds(2)};
  assert.equal(r.selectedManifest,marker(final,slot));assert.deepEqual(r.selectedState,final);
  const adapter=await stoppedRevisionStorage(r.fixture),io={...adapter,async atomicWrite(){throw Error('Read-only native session publication');}};
  const store=await openEntityRevisionStore(io,prep.identity.contentDigest),s=await store.read();
  assert.deepEqual(store.identity,prep.identity);assert.deepEqual(s.record.state,final);assert.equal(s.record.manifest,r.selectedManifest);
  assert.deepEqual(s.owner,{entityId:native.route.entityId,region:'0_0',...native.freshOwner});assert.deepEqual(r.selectedOwner,s.owner);
  assert.deepEqual(r.worlds,s.record.worlds);assert.deepEqual(r.inputs,[captures[2],captures[0]]);
  assert.equal(r.receivingSavedClockMs,captures[0].clock);assert.equal(r.selectedHomeClockMs,captures[2].clock);
  assert.equal(r.producerCalls,1);assert.equal(r.exactRetryWrites,0);assert.equal(r.retainedFiles,8);assert.equal(r.retainedWorldSlots,4);
  assert.equal((await readdir(r.fixture)).length,8);assert(r.largestRead<=4096&&r.largestWrite<=4096);assert.equal(r.peakReads,1);
  assert.equal(r.originalSelectionUnchanged,true);
  for(const flag of ['nativeEngineOwnershipTransactionQualified','freshHomeActorImportQualified','activeRemoteContinuationQualified','seamlessHeroCrossingQualified','browserUsed','nativeBuildPerformed'])assert.equal(r[flag],false);
  assert.equal(r.nativeProcessesStarted,0);return r;
}
