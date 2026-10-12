#!/usr/bin/env node
// Inspect a stopped actual-party full read, retaining every save difference.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile, realpath} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {inspectCoopWorld} from './inspect-native-coop-world.mjs';
import {connectedWorldState, compareConnectedWorlds} from './lib/connected-residency.mjs';
import {compareHostCheckpointGameplay} from './lib/coop-host-checkpoint-state.mjs';
import {checkpointChunks} from '../web/world/checkpoint.mjs';
import {stoppedFileSource, workspace} from './lib/stopped-entity-io.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function bounded(path, limit) {
  const source = await stoppedFileSource(path);
  assert.ok(source.size > 0 && source.size <= limit);
  const bytes = Buffer.alloc(source.size);
  for (let at = 0; at < bytes.length; at += 4096)
    bytes.set(await source.readAt(at, Math.min(4096, bytes.length - at)), at);
  return bytes;
}
async function rawRoots(path) {
  const source = await stoppedFileSource(path), roots = [];
  for await (const chunk of checkpointChunks(source)) {
    const hash = createHash('sha256');
    for (let at = 0; at < chunk.size; at += 4096)
      hash.update(await source.readAt(chunk.offset + 16 + at, Math.min(4096, chunk.size - at)));
    roots.push({tag:chunk.tag, version:chunk.version, count:chunk.count,
      bytes:chunk.size, sha256:hash.digest('hex')});
  }
  return roots;
}

async function main() {
  const [input, output] = process.argv.slice(2);assert.ok(input && output);
  const report = resolve(input), bytes = await bounded(report, 1024 * 1024), m = JSON.parse(bytes);
  const sourceProof = await inspectCoopWorld(report, {readbackComponent:true});
  const host = sourceProof.originalRole === 'host';
  assert.equal(sourceProof.originalRole, host ? 'host' : 'guest');
  const local = host ? 1 : 2, slot = host ? 0 : 1;
  assert.equal(m.nativeReadbackWorldRequested, true);
  assert.equal(m.nativeProductionPauseActionRequested, host);
  assert.equal(m.originalAttachedWorldReadbackSaved, true);
  if (host) {
    assert.equal(m.originalGuestInputWindowDelivered, true);
    assert.equal(m.originalGuestInputWindowTriggerFrame, 12);
  } else assert.equal(sourceProof.originalGuestIncomingHostPauseSavedQualified, true);
  const rebuiltMethod = m.nativeReadbackRebuildMethodRequested === true;
  const phase2 = m.nativeReadbackPhase2Requested === true;
  const pausedTicks = m.nativeReadbackPausedTicksRequested === true;
  const restoredRng = m.nativeReadbackRngRestoreRequested === true;
  const restoredUi = m.nativeReadbackUiRestoreRequested === true;
  const fromHost = m.nativeHostCheckpointReadRequested === true;
  assert.ok(!restoredRng || rebuiltMethod);
  assert.ok(!restoredUi || rebuiltMethod);
  assert.equal(m.worldReadback.path, join(m.profile, 'Documents/My Games/MajestyHD/SaveGame/Coop_World_Readback.GMP'));
  assert.equal(await realpath(m.worldReadback.path), m.worldReadback.path);
  const logBytes = await bounded(join(m.profile, '../native.log'), 4 * 1024 * 1024);
  assert.equal(sha(logBytes), m.logSha256);
  const log = logBytes.toString();
  const markers = [
    `[coop-pause-fixture] Settled original pause epoch=1 local=${local} slot=${slot} owner=1 frame=11 clock=550 phase=7 pending=0 live-second-engine=0`,
    '[coop-read-fixture] Deferred read entered outer-tick return=00415e88 renderer-call-active=0',
    '[coop-read-fixture] Source disposed epoch=1 frame=11 clock=550 owner=1 world-null=1 party-same=1',
    '[frontier] Cooperative saved read saved names cleared entries=2 original-destroy=004373e0 world-null=1 result=pass',
    '[coop-read-fixture] Original attachment method=00415f30 kind=3 pending=5 rebuilt=0 party-same=1 clock=550 context-clock=0',
    ...(phase2 ? [
      '[coop-phase2-fixture] Queued original dispatcher pending=2 phase=7 native-only-scheduling=1 committed-coordinator=0 ready-votes=0 loaded-votes=0',
      '[coop-phase2-fixture] Original rebuild entered return=00415e7f phase=2 pending=0 terminal-request3-suppressed=0',
      '[coop-phase2-fixture] Original rebuild returned phase=2 pending=3 frame=0 clock=550 context-clock=550 connection-owned=1',
      '[coop-phase2-fixture] Production hold returned phase=2 pending=7 owner=1 frame=0 clock=550 original-pause=004a5c00 ready-votes=0 loaded-votes=0 resume-controls=0',
      '[coop-phase2-fixture] Dispatcher settled hold phase=7 pending=0 owner=1 frame=0 clock=550 original-tick-body-entered=0'] : rebuiltMethod ? [
      '[coop-read-fixture] Original rebuild method begin entry=00416c30 phase=7 pending=5 dispatcher-phase2=0',
      '[coop-read-fixture] Original loading scope restored connection-owned=1 startup-votes-replayed=0 web-loaded-votes=0',
      '[coop-read-fixture] Original rebuild method returned entry=00416c30 terminal-request3-held=1 phase=7 pending=5 frame=0 clock=550 context-clock=550 party-same=1 dispatcher-phase2=0 loaded-votes=0 resume-controls=0'] : []),
    rebuiltMethod ?
      `[coop-read-fixture] Complete epoch=1 local=${local} slot=${slot} owner=1 frame=0 clock=550 names-before=2 names-after=2 original-reader=00435940 original-writer=004359c0 attached=1 rebuilt=1 party-same=1 loaded-votes=0 resume-controls=0 result=pass` :
      `[coop-read-fixture] Complete epoch=1 local=${local} slot=${slot} owner=1 frame=11 clock=550 names-before=2 names-after=2 original-reader=00435940 original-writer=004359c0 attached=1 rebuilt=0 party-same=1 loaded-votes=0 resume-controls=0 result=pass`,
    '[coop-read-fixture] Target disposed original-exit-request=9 pending=6 world-null=1'];
  let previous = -1;
  for (const marker of markers) {
    assert.equal(log.split('\n').filter(line => line === marker).length, 1);
    const at = log.indexOf(marker);assert.ok(at > previous);previous = at;
  }
  if (pausedTicks) {
    let previous = log.indexOf('[coop-phase2-fixture] Dispatcher settled hold');
    for (const marker of [
      '[coop-phase2-fixture] Paused original tick admitted ordinal=1 phase=7 pending=0 frame=0 clock=550 peer-loaded-votes=0',
      '[coop-phase2-fixture] Paused original tick admitted ordinal=2 phase=7 pending=0 frame=0 clock=550 peer-loaded-votes=0',
      '[coop-phase2-fixture] Paused original ticks returned count=2 phase=7 pending=0 frame=0 clock=550 context-clock=550 owner=1']) {
      assert.equal(log.split('\n').filter(line => line === marker).length, 1);
      const at = log.indexOf(marker);assert.ok(at > previous);previous = at;
    }
    assert.ok(log.indexOf('[coop-read-fixture] Saved RNG restored') <
      log.indexOf('[coop-phase2-fixture] Paused original tick admitted ordinal=1'));
    assert.ok(previous < log.indexOf('[coop-read-fixture] Complete'));
  }
  if (restoredUi) {
    // The common UI scope prints the solo-frontier label. This owned co-op
    // method fixture initializes no solo region, so that label is empty;
    // inspectCoopWorld separately binds the actual co-op region to0_0.
    const rows = [...log.matchAll(/^\[frontier\] Session UI restored region= selected=(\d+) rebound=(\d+) reveals=(\d+) removed=3 retained-worlds=0 result=pass$/gm)];
    assert.equal(rows.length, 1);
    if (fromHost) assert.equal(+rows[0][1], 0, 'Guest must let original code clear host selection');
    else assert.ok(+rows[0][2] > 0);
    assert.ok(rows[0].slice(1).every(n => +n <= 1000));
    assert.ok(rows[0].index > log.indexOf(phase2 ? '[coop-phase2-fixture] Original rebuild entered' : '[coop-read-fixture] Original rebuild method begin'));
    assert.ok(rows[0].index < log.indexOf(phase2 ? '[coop-phase2-fixture] Original rebuild returned' : '[coop-read-fixture] Original rebuild method returned'));
  }
  let source = sourceProof.snapshots[1];
  if (fromHost) {
    assert.equal(host, false);assert.equal(phase2, true);
    assert.equal(m.importedHostCheckpointUnchanged, true);
    assert.equal(m.importedHostCheckpoint.path,
      join(m.profile, 'Documents/My Games/MajestyHD/SaveGame/Coop_Host_Checkpoint.GMP'));
    assert.equal(await realpath(m.importedHostCheckpoint.path), m.importedHostCheckpoint.path);
    const preserved = m.replayInputs.filter(input => input.source === m.importedHostCheckpoint.source);
    assert.equal(preserved.length, 1);
    assert.equal(preserved[0].sha256, m.importedHostCheckpoint.sha256);
    assert.equal(preserved[0].bytes, m.importedHostCheckpoint.bytes);
    const marker = '[coop-host-read-fixture] Original host checkpoint selected label=Coop_Host_Checkpoint local=2 slot=1 owner=1 clock=550 offline-copy=1 shared-barrier=0';
    assert.equal(log.split('\n').filter(line => line === marker).length, 1);
    assert.ok(log.indexOf(marker) > log.indexOf('[coop-read-fixture] Deferred read entered'));
    assert.ok(log.indexOf(marker) < log.indexOf('[coop-read-fixture] Full source teardown begin'));
    source = m.importedHostCheckpoint;
  } else {
    assert.ok(!log.includes('[coop-host-read-fixture]'));
    assert.ok(!m.importedHostCheckpoint);
  }
  const guestBefore = fromHost ? await connectedWorldState(sourceProof.snapshots[1].path) : null;
  const before = await connectedWorldState(source.path),
    after = await connectedWorldState(m.worldReadback.path);
  assert.equal(before.sha256, source.sha256);assert.equal(before.bytes, source.bytes);
  assert.equal(after.sha256, m.worldReadback.sha256);assert.equal(after.bytes, m.worldReadback.bytes);
  assert.equal(after.label, 'Coop_World_Readback');
  const contextClock = [...log.matchAll(/^\[coop-read-fixture\] Unattached context clock=(\d+) preserved-global-clock=550$/gm)];
  assert.equal(contextClock.length, 1);
  assert.equal(+contextClock[0][1], 0);
  assert.equal(after.clock, rebuiltMethod ? before.clock : +contextClock[0][1]);
  if (restoredRng) {
    const marker = `[coop-read-fixture] Saved RNG restored scripting=${before.rng} gameplay=${before.gameplayRng} clock=${before.clock} original-gpl-setter=00623720 original-game-setter=004f6710 loaded-votes=0`;
    assert.equal(log.split('\n').filter(line => line === marker).length, 1);
    assert.ok(log.indexOf(marker) > log.indexOf(phase2 ?
      '[coop-phase2-fixture] Dispatcher settled hold' : '[coop-read-fixture] Original rebuild method returned'));
    assert.ok(log.indexOf(marker) < log.indexOf('[coop-read-fixture] Complete'));
    assert.equal(after.rng, before.rng);assert.equal(after.gameplayRng, before.gameplayRng);
  }
  const originalRoots = await rawRoots(source.path), loadedRoots = await rawRoots(m.worldReadback.path);
  let originalHostStartupVotes = null;
  let originalHostPostStartupVotes = null;
  if (rebuiltMethod) {
    assert.equal(host ? m.replayedGuestPackets.length : m.replayedHostPackets.length, host ? 3 : 18);
    assert.ok(m.lobbyPacketMetadata.length > 0 && m.lobbyPacketMetadata.length <= 128);
    originalHostStartupVotes = 0;
    let firstInputSequence = Infinity;
    const voteSequences = [];
    for (const row of m.lobbyPacketMetadata) {
      assert.ok(row.copy.startsWith(join(m.profile, '../owned-lobby-packets') + '/'));
      assert.equal(await realpath(row.copy), row.copy);
      const packet = await bounded(row.copy, 65536);
      assert.equal(packet.length, row.bytes);assert.equal(sha(packet), row.sha256);
      if (row.sender === local && packet.length === 16 &&
          packet.readUInt32LE(0) === 0x100 && packet.readUInt32LE(4) === 0x10) {
        ++originalHostStartupVotes;
        voteSequences.push(row.sequence);
      }
      if (row.sender === local && packet.length >= 20 &&
          packet.readUInt32LE(0) === 0x100 && packet.readUInt32LE(4) === 5)
        firstInputSequence = Math.min(firstInputSequence, row.sequence);
    }
    assert.ok(Number.isFinite(firstInputSequence));
    // This original host emits two identical startup votes before its first
    // gameplay input. Count post-startup votes instead of mistaking the second
    // initial vote for a travel vote. Failed079 emits another atsequence20.
    assert.equal(originalHostStartupVotes, 2);
    originalHostPostStartupVotes = voteSequences.filter(n => n >= firstInputSequence).length;
    assert.equal(originalHostPostStartupVotes, 0, 'Travel must not repeat initialization after gameplay input');
  }
  const equality = {
    clock:before.clock === after.clock,
    scriptingRng:before.rng === after.rng,
    gameplayRng:before.gameplayRng === after.gameplayRng,
    entityRecords:isDeepStrictEqual(before.records, after.records),
    queues:isDeepStrictEqual(before.queues, after.queues) && before.activeQueue === after.activeQueue};
  let comparison = {matching:true};
  try {Object.assign(comparison, compareConnectedWorlds(before, after));}
  catch (error) {comparison={matching:false, reason:String(error.message).split('\n')[0].slice(0,256)};}
  let hostCheckpointGameplayComparison = null;
  if (fromHost) {
    try {hostCheckpointGameplayComparison = await compareHostCheckpointGameplay(before, after);}
    catch (error) {hostCheckpointGameplayComparison = {gameplayStateMatches:false,
      reason:String(error.message).split('\n')[0].slice(0,256)};}
  }
  const verifierInputs = {...sourceProof.verifierInputs};
  verifierInputs['scripts/inspect-native-coop-readback.mjs'] = sha(await readFile(join(workspace, 'scripts/inspect-native-coop-readback.mjs')));
  verifierInputs['scripts/lib/coop-host-checkpoint-state.mjs'] = sha(await readFile(join(workspace, 'scripts/lib/coop-host-checkpoint-state.mjs')));
  const result = {
    version:1, actualPartyFullReaderLeafExecutedQualified:true,
    originalHostCheckpointOfflineCopyReadExecuted:fromHost,
    guestOwnSavedWorldReadExecuted:!host && !fromHost,
    originalCleanComponentExitQualified:true, startupScriptCompleted:false,
    actualSdkPartyAndLocalKingdomPreservedQualified:true, settledPauseHeldDuringReadQualified:true,
    savedNameVectorRetirementExecutedQualified:true, namesBefore:2, namesAfter:2,
    originalAttachedContextSerializedQualified:true, originalAttachmentLeafExecutedQualified:true,
    originalRebuildMethodComponentExecutedQualified:rebuiltMethod,
    originalLoadingScopeRestorationComponentQualified:rebuiltMethod,
    originalSavedRngRestorationLeafExecutedQualified:restoredRng,
    originalSavedUiRestorationComponentQualified:restoredUi,
    originalRole:sourceProof.originalRole, localNetworkPlayer:local, localKingdomSlot:slot,
    originalHostStartupVotes:host ? originalHostStartupVotes : null,
    originalHostPostStartupVotes:host ? originalHostPostStartupVotes : null,
    originalGuestStartupVotes:host ? null : originalHostStartupVotes,
    originalGuestPostStartupVotes:host ? null : originalHostPostStartupVotes,
    committedLoadingScopeExecuted:false,
    originalPhaseRebuildExecuted:phase2, originalPhase2DispatcherExecuted:phase2,
    nativeOnlyPhase2Scheduling:phase2, productionOriginalPauseHoldExecutedQualified:phase2,
    originalPausedTickBodiesReturned:pausedTicks ? 2 : 0,
    savedReadbackMatches:comparison.matching,
    hostCheckpointGameplayComparison,
    unattachedContextClock:+contextClock[0][1], serializedContextClock:after.clock, pausedSourceClock:before.clock,
    equality,
    report, reportSha256:sha(bytes), sourceProof, guestBefore, before, after, comparison,
    originalRawRoots:originalRoots, loadedRawRoots:loadedRoots,
    fullRawEquality:JSON.stringify(originalRoots) === JSON.stringify(loadedRoots),
    peakSampledNativeRssBytes:sourceProof.peakSampledNativeRssBytes,
    verifierInputs, browserUsed:false, liveSecondOriginalEngine:false,
    committedSharedReaderCoordinatorExecuted:false, sharedAttachmentResumeQualified:false,
    pairedSynchronizationQualified:false, sharedSaveLoadResumeQualified:false, goalComplete:false,
    scope:fromHost ?
      'One actual original guest at a captured host pause reads/rebuilds an unchanged offline copy of the inspected original host full checkpoint while preserving player2/kingdom1. Native-only phase2/production hold/two paused bodies; strict host-to-guest saved differences retained. No checkpoint transport, committed barrier, Ready/Loaded votes, shared resume or continuing second engine.' : !host ?
      'One actual original guest at a captured host pause reads/attaches its own full saved world while preserving player2/kingdom1. Native-only scheduling optionally exercises original phase2/production hold and two paused ticks. No host-save transfer, committed barrier, Ready/Loaded votes, shared resume or continuing second engine. Strict save differences are retained.' : phase2 ?
      'One actual original host reads/attaches its own paused saved world. Native-only scheduling queues pending2; the original dispatcher performs phase2 rebuild and the production pause hold queues7. The dispatcher settles pause7 before original serialization/disposal/exit. No committed barrier, Ready/Loaded peer vote, resume or continuing second engine. Strict save differences are retained.' : rebuiltMethod ?
      'One actual original host reads, attaches and invokes original00416c30 while paused7. A native-only hook holds the terminal request3 at00417077; there is no phase2 dispatcher, committed agreement, Loaded vote, resume or live paired engine. Target is serialized and disposed before clean original exit. Exact save differences are retained.' :
      'One actual original host reads and serializes its own paused full world through the production reader leaf while preserving the actual party. Result is attached through original00415f30 for serialization, then disposed before original exit; no phase rebuild runs. Complete descriptor agreement, paired attachment/resume, travel and browser play remain unqualified.'};
  await writeFile(resolve(output), JSON.stringify(result,null,2)+'\n', {flag:'wx'});
  process.stdout.write(JSON.stringify({actualPartyFullReaderLeafExecutedQualified:true,
    savedReadbackMatches:comparison.matching, fullRawEquality:result.fullRawEquality,
    hostCheckpointGameplayMatches:hostCheckpointGameplayComparison?.gameplayStateMatches ?? null,
    peakSampledNativeRssBytes:result.peakSampledNativeRssBytes})+'\n');
}
await main();
