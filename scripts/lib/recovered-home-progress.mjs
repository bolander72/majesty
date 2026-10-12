// Persist the actual recovery save with its unchanged dormant peer. Preserve the
// original interruption checkpoint and receipts in their read-only store.
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectNativeInterruptedHomeRecovery} from '../inspect-native-interrupted-home-recovery.mjs';
import {inspectInterruptedHomeCheckpoint} from './interrupted-home-checkpoint.mjs';
import {workspace} from './stopped-entity-io.mjs';
import {hashNativeFile} from './native-generation.mjs';
import {stoppedRevisionStorage} from './stopped-revision-io.mjs';
import {openEntityRevisionStore,encodeEntityRevision} from '../../web/world/entity-revisions.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),hash=async n=>(await hashNativeFile(n)).sha256;
export async function inspectRecoveredHomeProgress(name){
  assert((await stat(name)).size<=65536);const r=JSON.parse(await readFile(name,'utf8'));
  assert.deepEqual([r.version,r.nativeRecoveredHomeProgressPublished,r.browserUsed],[1,true,false]);
  assert.equal(await hash(r.recoveryManifest),r.recoveryManifestSha256);
  const observed=await inspectNativeInterruptedHomeRecovery(r.recoveryManifest),m=JSON.parse(await readFile(r.recoveryManifest,'utf8'));
  assert.equal(observed.nativeInterruptedHomeOrdinaryRecoveryQualified,true);
  const prior=(await inspectInterruptedHomeCheckpoint(m.publication)).report;
  const home=m.snapshotCaptures.at(-1),peer=m.selectedRevisionExports[1];
  const operationId=sha('native-recovered-home-save-v1\n'+observed.manifestSha256+'\n');
  const state={...prior.selectedState,revision:7,previous:sha(prior.selectedManifest),operationId,kind:'save',
    worlds:[home,peer].map(r=>({size:r.bytes,sha256:r.sha256}))};
  const stateSha256=sha(encodeEntityRevision(state)),manifest=`majesty-entity-revision-v1\n1\n7\n${state.identitySha256}\n${stateSha256}\n`;
  assert.deepEqual(r.identity,prior.identity);assert.equal(r.previousManifest,prior.selectedManifest);assert.deepEqual(r.selectedOwner,prior.selectedOwner);
  assert.equal(r.selectedManifest,manifest);assert.deepEqual(r.selectedState,state);assert.deepEqual(r.inputs,[home,peer]);
  assert.equal(r.selectedHomeClockMs,home.clock);assert.equal(r.exactRetryWrites,0);assert.equal(r.retainedFiles,8);assert.equal(r.retainedWorldSlots,4);
  assert(r.largestRead<=4096&&r.largestWrite<=4096&&r.peakReads===1);
  assert.equal(r.originalInterruptedSelectionUnchanged,true);
  for(const[n,h]of Object.entries(r.sourceSha256))assert.equal(await hash(join(workspace,n)),h);
  const selected=await (await openEntityRevisionStore(await stoppedRevisionStorage(r.fixture),r.identity.contentDigest)).read();
  assert.equal(selected.record.manifest,manifest);assert.deepEqual(selected.record.state,state);assert.deepEqual(selected.owner,r.selectedOwner);
  return {report:r,observed};
}
