// Independent check of durable ownership while the original native tick was
// held. The archived actor import is still an input, not a live birth proof.
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {workspace,ownedDirectory,stoppedFileSource} from './stopped-entity-io.mjs';
import {hashNativeFile} from './native-generation.mjs';
import {stoppedRevisionStorage} from './stopped-revision-io.mjs';
import {openEntityRevisionStore,encodeEntityRevision} from '../../web/world/entity-revisions.mjs';
import {verifyEntityOwnership} from '../../web/world/entity-ownership.mjs';
import {checkpointSavedClock} from '../../web/world/saved-clock.mjs';
import {checkpointActorRecords} from '../../web/world/checkpoint.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),hash=async n=>(await hashNativeFile(n)).sha256;
export async function verifyNativePausedHomeOwner(m,prep,log,{interruptedBeforeResume=false}={}){
  assert.equal(typeof interruptedBeforeResume,"boolean");
  const live=m.liveOwner;assert(live&&live.publication&&live.pausedCapture);
  assert(/^[a-f0-9]{64}$/.test(live.nonce));
  const directory=await ownedDirectory(live.directory,'actor-arrival-fixture-entity-revision-live-session-');
  const home=live.pausedCapture,remote=m.snapshotCaptures[0];
  assert.equal(home.filename,join(m.fixture,'Owner_Paused_0_0.GMP'));assert.equal(await hash(home.filename),home.sha256);
  assert.equal((await stat(home.filename)).size,home.bytes);assert.equal(home.clock,57650);
  const homeSource=await stoppedFileSource(home.filename),remoteSource=await stoppedFileSource(remote.filename);
  assert.equal(await checkpointSavedClock(homeSource),57650);assert.equal(await checkpointSavedClock(remoteSource),remote.clock);
  const actor=await checkpointActorRecords(homeSource,530);assert.equal(actor.unit.parentUnitId,0);assert.equal(actor.agent.agentId,31);
  const request=`native-owner-pause-v1\n${live.nonce}\n1\n0_0\n57650\n${home.sha256}\n${remote.clock}\n${remote.sha256}\n${sha(prep.selectedManifest)}\n530\n31\n`;
  assert.equal(live.pauseRequest.filename,join(m.worldRoot,'Owner_Pause.txt'));assert.equal(await readFile(live.pauseRequest.filename,'utf8'),request);
  assert.equal(live.pauseRequest.packet,request);assert.equal(live.pauseRequest.sha256,sha(request));
  const receipt=live.publication;assert.equal(receipt.filename,join(m.fixture,'Paused_Owner_Publication.json'));
  assert.equal(await hash(receipt.filename),receipt.sha256);const pub=JSON.parse(await readFile(receipt.filename,'utf8'));
  assert.deepEqual([pub.version,pub.nativePausedHomeOwnerPublished,pub.nativePid,pub.nativeAliveBeforeAndAfterCommit,pub.browserUsed],
    [1,true,m.nativePid,true,false]);assert.equal(receipt.nativeAliveAtDelivery,!interruptedBeforeResume);
  const delivery=interruptedBeforeResume?receipt.interruptedAtMs:receipt.deliveredAtMs;
  if(interruptedBeforeResume)assert.equal(receipt.committedNativeAlive,true);
  assert(m.startedAtMs<=pub.startedAtMs&&pub.startedAtMs<=pub.committedAtMs&&pub.committedAtMs<=delivery&&delivery<=m.finishedAtMs);
  assert.equal(pub.preparation,m.preparation);assert.equal(pub.preparationSha256,m.preparationSha256);
  assert.equal(pub.directory,directory);assert.equal(pub.request,request);assert.equal(pub.requestSha256,sha(request));
  assert.equal(pub.previousManifest,prep.selectedManifest);assert.deepEqual(pub.inputs,[home,remote]);
  assert.equal(pub.producerCalls,1);assert.equal(pub.exactRetryWrites,0);assert(pub.largestRead<=4096&&pub.largestWrite<=4096&&pub.peakReads===1);
  for(const[n,h]of Object.entries(pub.sourceSha256))assert.equal(await hash(join(workspace,n)),h);
  const previous=prep.selectedState,operationId=sha('native-paused-home-owner-v1\n'+sha(request)+'\n');
  const state={...previous,revision:6,previous:sha(prep.selectedManifest),operationId,kind:'handoff',ownerSide:0,visitedSides:3,
    aliases:[{unitId:530,agentId:31},previous.aliases[1]],worlds:[home,remote].map(r=>({size:r.bytes,sha256:r.sha256}))};
  const stateSha256=sha(encodeEntityRevision(state));
  const selectedManifest=`majesty-entity-revision-v1\n0\n6\n${previous.identitySha256}\n${stateSha256}\n`;
  assert.equal(pub.operationId,operationId);assert.deepEqual(pub.selectedState,state);assert.equal(pub.selectedManifest,selectedManifest);
  assert.equal(pub.manifestSha256,sha(selectedManifest));assert.equal(pub.stateSha256,stateSha256);
  const ack=`native-owner-resume-v1\n${sha(request)}\n${sha(selectedManifest)}\n6\n${stateSha256}\n`;
  assert.equal(pub.acknowledgement,ack);
  if(interruptedBeforeResume){assert.equal(live.acknowledgement,null);assert.equal(m.intentionalOwnerInterruption,true);
    assert.equal(await readFile(join(m.worldRoot,'Owner_Resume.txt'),'utf8'),`native-owner-resume-v1\n${sha(request)}\n${'0'.repeat(64)}\n6\n${'0'.repeat(64)}\n`);
  }else{assert.equal(live.acknowledgement,ack);assert.equal(await readFile(join(m.worldRoot,'Owner_Resume.txt'),'utf8'),ack);}
  const selected=await (await openEntityRevisionStore(await stoppedRevisionStorage(directory),prep.identity.contentDigest)).read();
  assert.equal(selected.record.manifest,selectedManifest);assert.deepEqual(selected.record.state,state);assert.deepEqual(selected.owner,pub.selectedOwner);
  await verifyEntityOwnership(prep.identity,state.aliases,state.referenceBindings,[{source:homeSource},{source:remoteSource}],0,state.homeAliases);
  assert.equal(live.negativeAcknowledgements.length,2);
  for(const [i,n]of live.negativeAcknowledgements.entries()){
    const requestHash=i?sha(request):'0'.repeat(64);
    assert.equal(n.kind,['wrong-request','unpublished-owner'][i]);
    assert.equal(n.packet,`native-owner-resume-v1\n${requestHash}\n${'0'.repeat(64)}\n6\n${'0'.repeat(64)}\n`);
    assert(n.publishedAtMs<pub.startedAtMs);
  }
  const paused=`[frontier] Owner paused serial=1 region=0_0 clock=57650 home-hash=${home.sha256} source-clock=${remote.clock} source-hash=${remote.sha256} request-hash=${sha(request)}`;
  const pa=log.indexOf(paused);assert(pa>log.indexOf('[frontier] Region 0_0 ready'));
  const refusal='[frontier] Owner acknowledgement refused serial=1 region=0_0 clock=57650';
  const first=log.indexOf(refusal,pa),second=log.indexOf(refusal,first+1);assert(first>pa&&second>first);
  const resumed=log.match(/\[frontier\] Owner resumed serial=1 region=0_0 clock=57650 revision=6 skipped=(\d+) request-hash=([a-f0-9]{64}) manifest-hash=([a-f0-9]{64})/);
  if(interruptedBeforeResume){assert.equal(resumed,null);assert(!log.includes('[frontier] Session checkpoint serial=2'));
    assert.equal(m.nativeExitCode,-15);assert.equal(m.stopReason,'intentional-interruption-after-owner-commit');
  }else{assert(resumed&&Number(resumed[1])>2);assert.equal(resumed[2],sha(request));assert.equal(resumed[3],sha(selectedManifest));
    assert(resumed.index>second&&resumed.index<log.indexOf('[frontier] Session checkpoint serial=2'));}
  assert.equal(pub.freshHomeActorImportQualified,false);
  return {nativePausedOwnershipPublicationQualified:!interruptedBeforeResume,nativeInterruptedOwnershipCheckpointQualified:interruptedBeforeResume,ownerPublicationRevision:6,pausedHomeClockMs:57650,
    requestSha256:sha(request),selectedManifestSha256:sha(selectedManifest),skippedGameplayTicks:resumed?Number(resumed[1]):null,refusedAcknowledgements:2,
    publication:receipt.filename,publicationSha256:receipt.sha256,selectedManifest,selectedState:state};
}
