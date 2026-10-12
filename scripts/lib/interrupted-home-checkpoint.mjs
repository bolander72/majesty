// Export only the actual durable owner committed before the supervised native
// interruption. A receipt or a replayed prepared world alone is insufficient.
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectNativeSelectedHomeSession} from '../inspect-native-selected-home-session.mjs';
import {hashNativeFile} from './native-generation.mjs';
import {workspace} from './stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './stopped-revision-io.mjs';
import {openEntityRevisionStore} from '../../web/world/entity-revisions.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
export async function inspectInterruptedHomeCheckpoint(name){
  assert((await stat(name)).size<=65536);const r=JSON.parse(await readFile(name,'utf8'));
  assert.deepEqual([r.version,r.nativeInterruptedHomeCheckpointQualified,r.browserUsed],[1,true,false]);
  const observed=await inspectNativeSelectedHomeSession(r.nativeSessionManifest,{interruptedBeforeResume:true});
  assert.equal(observed.nativeInterruptedHomeOwnershipQualified,true);assert.equal(observed.freshHomeActorImportQualified,true);
  assert.equal(await hash(r.nativeSessionManifest),r.nativeSessionManifestSha256);
  assert.equal(observed.manifestSha256,r.nativeSessionManifestSha256);
  const m=JSON.parse(await readFile(r.nativeSessionManifest,'utf8')),prep=JSON.parse(await readFile(m.preparation,'utf8'));
  const pub=JSON.parse(await readFile(m.liveOwner.publication.filename,'utf8'));
  assert.equal(r.fixture,m.liveOwner.directory);assert.deepEqual(r.identity,prep.identity);
  assert.equal(r.selectedManifest,pub.selectedManifest);assert.deepEqual(r.selectedState,pub.selectedState);
  assert.deepEqual(r.selectedOwner,pub.selectedOwner);assert.deepEqual(r.inputs,pub.inputs);
  assert.equal(r.previousManifest,prep.selectedManifest);assert.equal(r.sourcePreparation,m.preparation);
  assert.equal(r.sourcePreparationSha256,m.preparationSha256);assert.equal(r.originalEngineAcknowledgementDelivered,false);
  assert.equal(r.originalEngineExitCode,-15);assert.equal(r.freshHomeActorImportQualified,true);
  for(const[n,h]of Object.entries(r.sourceSha256))assert.equal(await hash(join(workspace,n)),h);
  const selected=await (await openEntityRevisionStore(await stoppedRevisionStorage(r.fixture),r.identity.contentDigest)).read();
  assert.equal(selected.record.manifest,r.selectedManifest);assert.deepEqual(selected.record.state,r.selectedState);assert.deepEqual(selected.owner,r.selectedOwner);
  return {report:r,observed,manifest:resolve(name),manifestSha256:await hash(name)};
}
