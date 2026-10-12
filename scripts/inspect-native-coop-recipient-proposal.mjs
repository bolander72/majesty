#!/usr/bin/env node
// Stopped evidence for an actual recipient's committed fresh load and Loaded.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile, realpath} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {inspectCoopWorld, cooperativeKingdoms} from './inspect-native-coop-world.mjs';
import {inspectCoopProposal} from './inspect-native-coop-proposal.mjs';
import {connectedWorldState, compareConnectedWorlds} from './lib/connected-residency.mjs';
import {stoppedFileSource, workspace} from './lib/stopped-entity-io.mjs';
import {compareGeneratedConfiguration} from './lib/coop-generated-configuration.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
async function bounded(path, cap = 2 * 1024 * 1024) {
  assert.equal(await realpath(path), path);
  const s = await stoppedFileSource(path); assert.ok(s.size > 0 && s.size <= cap);
  const out = Buffer.alloc(s.size);
  for (let n = 0; n < out.length; n += 4096)
    out.set(await s.readAt(n, Math.min(4096, out.length - n)), n);
  return out;
}
async function copied(row, cap = 2048) {
  const b = await bounded(row.copy, cap);
  assert.equal(b.length, row.bytes); assert.equal(sha(b), row.sha256);
  return b;
}
export async function inspectRecipientProposal(name) {
  const reportPath = resolve(name), raw = await bounded(reportPath), m = JSON.parse(raw);
  const source = await inspectCoopWorld(reportPath), host = await inspectCoopProposal(m.replaySourceReport);
  assert.equal(source.originalRole, 'guest'); assert.equal(source.scriptCompleted, true);
  for (const k of ['replayHostProposalRequested', 'nativeIncomingHostPauseObservationRequested',
    'capturedOriginalHostProposalDelivered', 'referenceProposalObserverEnabled']) assert.equal(m[k], true, k);
  for (const k of ['nativePauseWorldRequested', 'nativeBeginFreshNeighborRequested',
    'nativeReadbackWorldRequested']) assert.equal(m[k], false, k);
  assert.equal(m.referenceReplayedHostReadyVotes, 1); assert.equal(m.referenceHostLoadedVotesSent, 0);
  assert.equal(m.configuredCoopChapter, 1); assert.equal(m.configuredCoopRegion, '0_0');
  assert.deepEqual(source.snapshots.map(s => [s.frame, s.clock]), [[0, 0], [11, 550]]);
  assert.equal(m.pausedHostInspection.reportSha256, host.reportSha256);
  assert.deepEqual(m.pausedHostInspection.verifierInputs, host.sourceProof.verifierInputs);
  const root = join(workspace, `output/native-multiplayer-lobby-${String(m.attempt).padStart(3, '0')}`);
  assert.equal(sha(await bounded(join(root, 'native_coop_proposal_observer.py'))), m.proposalObserverSha256);
  assert.equal(sha(await bounded(join(root, 'native_coop_proposal_replay.py'))), m.proposalReplayHelperSha256);
  assert.equal(m.proposalReplayInputs.length, 3);
  const inputBytes = [];
  for (const [i, row] of m.proposalReplayInputs.entries()) {
    assert.ok(row.copy.startsWith(join(root, 'captured-host-inputs/proposal-source-')));
    assert.ok(row.copy.includes(String(i).padStart(3, '0')));
    inputBytes.push(await copied(row, 2 * 1024 * 1024));
  }
  const recordedHost = JSON.parse(inputBytes[0]);
  assert.equal(recordedHost.reportSha256, host.reportSha256);
  assert.deepEqual(recordedHost.capturedRequests, host.capturedRequests);
  assert.equal(recordedHost.descriptorSha256, host.descriptorSha256);
  const descriptor = inputBytes[1].subarray(32);
  assert.equal(sha(descriptor), host.descriptorSha256);
  assert.ok(inputBytes[2].subarray(32).equals(descriptor));
  assert.equal(m.replayedOriginalHostProposalBodies.length, 2);
  for (const [i, row] of m.replayedOriginalHostProposalBodies.entries()) {
    const wire = inputBytes[i + 1];
    assert.equal(sha(wire), host.capturedRequests[i].sha256);
    assert.equal(row.source, host.capturedRequests[i].copy);
    assert.deepEqual([row.action, row.bytes, row.sha256], [i + 1, wire.length - 20, sha(wire.subarray(20))]);
  }
  const requests = m.proposalProtocolRequests;
  assert.equal(requests.length, 8);
  const expected = [[1,12,0],[1,13,6],[2,12,0],[2,13,6],[1,12,1],[1,12,2],[2,12,2],[2,12,3]];
  for (const [i, row] of requests.entries()) {
    assert.deepEqual([row.sender, row.op, row.action], expected[i]);
    assert.equal(row.host, row.sender === 1);
    assert.equal(row.copy, join(root, `owned-lobby-packets/proposal-rpc-${String(i).padStart(3, '0')}.bin`));
    const b = await copied(row);
    assert.ok(Number.isSafeInteger(row.request) && row.request > 0);
    assert.deepEqual(Array.from({length:6}, (_, n) => b.readUInt32LE(n*4)),
      [0x31525044,1,row.op,row.request,0,row.action]);
    if (row.op === 12 && row.action > 0) {
      assert.equal(b.readUInt32LE(24), 1); assert.equal(b.length, descriptor.length + 32);
      assert.equal(b.readUInt32LE(28), descriptor.length); assert.ok(b.subarray(32).equals(descriptor));
      if (row.sender === 1) assert.ok(b.subarray(20).equals(inputBytes[row.action].subarray(20)),
        'Recorded host body must remain exact despite connection-local request IDs');
    }
  }
  assert.equal(m.observedProposalEvents.length, 2);
  for (const [i, event] of m.observedProposalEvents.entries()) {
    assert.deepEqual([event.serial,event.stage,event.players], [1,i+1,[1,2]]);
    assert.equal(event.copy, join(root, `owned-lobby-packets/proposal-${String(i).padStart(3, '0')}.bin`));
    const b = await copied(event);
    assert.equal(b.length, descriptor.length + 24);
    assert.deepEqual([b.readUInt32LE(0),b.readUInt32LE(4),b.readUInt32LE(8)], [1,i+1,descriptor.length]);
    assert.ok(b.subarray(12,12+descriptor.length).equals(descriptor));
    assert.deepEqual(Array.from({length:3}, (_, n) => b.readUInt32LE(12+descriptor.length+n*4)), [2,1,2]);
    assert.equal(event.descriptorSha256, sha(descriptor));
  }
  assert.ok(m.proposalRelaySnapshots.length > 0 && m.proposalRelaySnapshots.length <= 8);
  let previousReady = 0, previousLoaded = 0, committed = false;
  for (const row of m.proposalRelaySnapshots) {
    assert.ok(row.sampledAtMs >= m.startedAtMs && row.sampledAtMs <= m.finishedAtMs);
    const s = row.state;
    assert.equal(s.serial,1); assert.equal(s.descriptorSha256,sha(descriptor));
    assert.deepEqual(s.players,[1,2]);
    assert.ok([[],[1],[1,2]].some(a => JSON.stringify(a) === JSON.stringify(s.ready)));
    assert.ok([[],[2]].some(a => JSON.stringify(a) === JSON.stringify(s.loaded)));
    assert.ok(s.ready.length >= previousReady && s.loaded.length >= previousLoaded);
    assert.equal(typeof s.committed,'boolean'); assert.ok(!committed || s.committed);
    if (s.committed) assert.deepEqual(s.ready,[1,2]);
    if (s.loaded.length) assert.equal(s.committed,true);
    previousReady=s.ready.length;previousLoaded=s.loaded.length;committed=s.committed;
  }
  assert.deepEqual(m.proposalRelaySnapshots.at(-1).state,
    {serial:1,committed:true,players:[1,2],ready:[1,2],loaded:[2],descriptorSha256:sha(descriptor)});
  const log = (await bounded(join(root,'native.log'),4*1024*1024)).toString();
  let cursor = -1;
  for (const marker of [
    '[coop-load] Ready fresh epoch=1 serial=1 local-source-revision=1',
    '[coop-load] Source network buffers retired serial=1',
    '[coop-generation] Original source interface/world teardown completed serial=1 pause-held=1',
    '[coop-generation] Committed context epoch=1 serial=1 region=1_0 source-retained=1 source-disposed=1',
    '[coop-load] Committed rebuild queued epoch=1 serial=1',
    '[coop-load] Connected return bound epoch=1 serial=1 region=1_0',
    '[coop-load] Attached epoch=1 serial=1 slot=1',
    '[coop-load] Held epoch=1 serial=1 slot=1 clock=0',
    '[coop-load] Loaded epoch=1 serial=1 slot=1']) {
    assert.equal(log.split('\n').filter(l => l === marker).length,1,marker);
    const next=log.indexOf(marker);assert.ok(next>cursor);cursor=next;
  }
  assert.ok(!/\[coop-load\] (?:Rejected|Resumed|Resume queued)|\[coop-transfer\] Rejected|\[coop-read-fixture\]|\[coop-phase2-fixture\]/.test(log));
  assert.equal(log.split('\n').filter(l => l === 'guest exit code:    0').length,1);
  const prefix=join(m.profile,'Documents/My Games/MajestyHD/SaveGame/CoopTransitions_native-terrain-fixture_0_0');
  const sourcePath=prefix+'_0.GMP', markerPath=prefix+'.checkpoint';
  const sourceBytes=await bounded(sourcePath),markerBytes=await bounded(markerPath,768);
  const fields=descriptor.toString('ascii').trimEnd().split('\n');assert.equal(fields.length,22);
  assert.equal(markerBytes.toString('ascii'), ['majesty-coop-checkpoint-v1','0','native-terrain-fixture',
    m.nativeFixtureContentIdentity,fields[9],'0','0','11','550','1',String(sourceBytes.length),sha(sourceBytes),''].join('\n'));
  const captured=await connectedWorldState(sourcePath),before=await connectedWorldState(source.snapshots[1].path);
  const sourceComparison=compareConnectedWorlds(before,captured);
  let targetSnapshot = null;
  if (m.nativeLoadedTargetSnapshotRequested !== undefined)
    assert.equal(typeof m.nativeLoadedTargetSnapshotRequested,'boolean');
  if (m.nativeLoadedTargetSnapshotRequested === true) {
    assert.equal(m.originalLoadedTargetSaved,true);
    const row=m.loadedTargetSnapshot;
    assert.equal(row.path,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Coop_World_Target.GMP'));
    const bytes=await bounded(row.path);assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);
    const state=await connectedWorldState(row.path);
    assert.equal(state.label,'Coop_World_Target');assert.equal(state.clock,0);
    const kingdoms=await cooperativeKingdoms(row.path,[0,1]);
    for (const kingdom of kingdoms) {
      assert.ok(kingdom.buildings.length>1,'Each generated kingdom must retain buildings beyond its palace');
    }
    const configuration=await compareGeneratedConfiguration(source.snapshots[1].path,row.path,'1_0');
    assert.equal(state.rng,configuration.targetSeed);assert.equal(state.gameplayRng,configuration.targetSeed);
    const sourceTerrain=await checkpointTerrain(await stoppedFileSource(source.snapshots[1].path));
    const targetTerrain=await checkpointTerrain(await stoppedFileSource(row.path));
    const sharedHeights=createHash('sha256');
    for(let start=0;start<=128;start+=33) {
      const count=Math.min(33,129-start);
      const east=await sourceTerrain.edge('right',start,count),west=await targetTerrain.edge('left',start,count);
      for(let i=0;i<count;++i) {
        const a=Buffer.from(east.subarray(i*9,i*9+4)),b=Buffer.from(west.subarray(i*9,i*9+4));
        assert.ok(a.equals(b),'Generated west heights must match the saved source east edge');sharedHeights.update(a);
      }
    }
    const marker='[coop-target-fixture] Snapshot epoch=1 serial=1 local=2 slot=1 region=1_0 frame=0 clock=0 original-writer=1 source-retained=1 coordinator-loaded=1 peer-loaded=0 resume-controls=0 live-second-engine=0';
    assert.equal(log.split('\n').filter(l=>l===marker).length,1);assert.ok(log.indexOf(marker)>cursor);
    targetSnapshot={...row,clock:state.clock,counts:state.counts,roots:state.roots,rng:state.rng,
      gameplayRng:state.gameplayRng,kingdoms,configuration,sharedEdgeVertices:129,
      sharedEastWestHeightsMatch:true,sharedHeightsSha256:sharedHeights.digest('hex')};
  } else assert.ok(!log.includes('[coop-target-fixture]'));
  return {version:1,productionRecipientSourceCaptureQualified:true,productionRecipientReadyExecutedQualified:true,
    actualRecipientCommittedFreshGenerationExecutedQualified:true,originalRecipientRebuildHeldQualified:true,
    actualRecipientSdkLoadedExecutedQualified:true,exactLocalSourceGameplayRetainedQualified:true,
    originalHostBeginReadyBodiesReplayedUnchanged:true,hostLoadedVotes:0,recipientReadyVotes:1,recipientLoadedVotes:1,
    report:reportPath,reportSha256:sha(raw),sourceProof:source,hostProposalReport:host.report,
    hostProposalReportSha256:host.reportSha256,descriptorSha256:sha(descriptor),sourceComparison,
    sourceCheckpoint:{path:sourcePath,bytes:sourceBytes.length,sha256:sha(sourceBytes)},
    sourceMarker:{path:markerPath,bytes:markerBytes.length,sha256:sha(markerBytes)},
    capturedRecipientRequests:requests.filter(r=>r.sender===2&&r.op===12&&r.action>0),
    targetRegion:'1_0',targetClock:0,recipientKingdomSlot:1,
    targetFullSaveInspected:targetSnapshot!==null,bothTargetKingdomPalacesBuildingsGPLQualified:targetSnapshot!==null,
    targetSnapshot,pairedTargetStateEqualityQualified:false,sharedResumeQualified:false,
    pairedSynchronizationQualified:false,liveSecondOriginalEngine:false,browserUsed:false,goalComplete:false,
    peakSampledNativeRssBytes:source.peakSampledNativeRssBytes,
    verifierInputs:{...source.verifierInputs,'scripts/inspect-native-coop-proposal.mjs':sha(await readFile(new URL('./inspect-native-coop-proposal.mjs',import.meta.url))),
      'scripts/inspect-native-coop-recipient-proposal.mjs':sha(await readFile(new URL(import.meta.url))),
      'scripts/lib/coop-generated-configuration.mjs':sha(await readFile(new URL('./lib/coop-generated-configuration.mjs',import.meta.url))),
      'scripts/lib/coop-host-checkpoint-state.mjs':sha(await readFile(new URL('./lib/coop-host-checkpoint-state.mjs',import.meta.url))),
      'web/world/hero-generation-request.mjs':sha(await readFile(new URL('../web/world/hero-generation-request.mjs',import.meta.url)))},
    scope:'One actual original guest receives preserved original host pause/Begin/Ready, executes its own source capture/Ready and committed fresh generation/rebuild/Loaded, then waits paused without a host Loaded vote. Full target save, shared resume and live paired gameplay remain unqualified.'};
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  assert.equal(process.argv.length,4);
  const p=await inspectRecipientProposal(process.argv[2]);
  await writeFile(resolve(process.argv[3]),JSON.stringify(p,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({recipientReady:true,committedFreshGeneration:true,originalRebuildHeld:true,
    recipientLoaded:true,hostLoaded:false,sharedResume:false}));
}
