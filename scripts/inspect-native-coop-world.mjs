#!/usr/bin/env node
// Read stopped, complete original cooperative saves. No game/browser starts.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile, realpath} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stoppedFileSource, workspace} from './lib/stopped-entity-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {checkpointPlacements, checkpointUnitAgentLinks, checkpointAgents} from '../web/world/checkpoint.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {inspectIncomingHostPause} from './lib/incoming-host-pause.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function bounded(filename, cap = 1024 * 1024) {
  const source = await stoppedFileSource(filename);
  assert.ok(source.size <= cap, 'Evidence exceeds its read bound');
  const bytes = Buffer.alloc(source.size);
  for (let at = 0; at < bytes.length; at += 4096)
    bytes.set(await source.readAt(at, Math.min(4096, bytes.length - at)), at);
  return bytes;
}
function absent(pid) {
  assert.ok(Number.isInteger(pid) && pid > 1);
  try {process.kill(pid, 0);} catch (error) {
    if (error.code === 'ESRCH') return;
    throw error;
  }
  throw Error('Original producer remains live');
}
async function terrainHeights(filename) {
  const source = await stoppedFileSource(filename), terrain = await checkpointTerrain(source), hash = createHash('sha256');
  for (let y = 0; y <= terrain.height; ++y) {
    const row = await source.readAt(terrain.heightOffset(0, y), (terrain.width + 1) * 9);
    for (let x = 0; x <= terrain.width; ++x) hash.update(row.subarray(x * 9, x * 9 + 4));
  }
  return hash.digest('hex');
}
export async function cooperativeKingdoms(filename, slots) {
  const source = await stoppedFileSource(filename), agents = new Map(), links = new Map();
  for await (const agent of checkpointAgents(source)) {
    assert.ok(agents.size < 5000 && !agents.has(agent.agentId));
    agents.set(agent.agentId, agent);
  }
  for await (const unit of checkpointUnitAgentLinks(source)) {
    assert.ok(links.size < 5000 && !links.has(unit.unitId));
    if (unit.agentId) {
      const agent = agents.get(unit.agentId);
      assert.ok(agent && agent.unitId === unit.unitId && !agent.deleted,
        'Unit must retain its own live original GPL agent');
    }
    links.set(unit.unitId, unit);
  }
  const kingdoms = slots.map(slot => ({slot, palace: [], buildings: [], mobileActors: []}));
  let placements = 0;
  for await (const unit of checkpointPlacements(source)) {
    assert.ok(++placements <= 5000);
    const kingdom = kingdoms.find(k => k.slot === unit.playerNumber);
    if (!kingdom || !['BLDG', 'VHCL'].includes(unit.family)) continue;
    const link = links.get(unit.unitId);
    assert.ok(link && link.description === unit.description && link.playerNumber === unit.playerNumber);
    const record = {unitId: unit.unitId, agentId: link.agentId, description: unit.description,
      script: link.agentId ? agents.get(link.agentId).name : null,
      family: unit.family, fixedPosition: unit.fixedPosition, parentUnitId: unit.parentUnitId};
    (unit.family === 'BLDG' ? kingdom.buildings : kingdom.mobileActors).push(record);
    // The independently audited pinned palace family ABJ, including its level.
    if (unit.family === 'BLDG' && (unit.description & 0xffffff) === 0x4a4241)
      kingdom.palace.push(record);
  }
  assert.equal(placements, links.size);
  for (const kingdom of kingdoms) {
    assert.equal(kingdom.palace.length, 1, 'Each playable kingdom needs its own palace');
    assert.ok(kingdom.palace[0].agentId > 0);
  }
  return kingdoms;
}
export async function inspectCoopWorld(filename, {readbackComponent = false} = {}) {
  assert.equal(typeof readbackComponent, 'boolean');
  const reportPath = resolve(filename);
  assert.ok(reportPath.startsWith(join(workspace, 'output/')) && /native-multiplayer-lobby-\d{3}-observed\.json$/.test(reportPath));
  assert.equal(await realpath(reportPath), reportPath);
  const raw = await bounded(reportPath), m = JSON.parse(raw);
  if (m.nativeBeginFreshNeighborRequested !== undefined)
    assert.equal(typeof m.nativeBeginFreshNeighborRequested, 'boolean');
  absent(m.nativePid);
  // The owned reader component intentionally requests original exit after
  // disposal, before the startup script's final later clock peek. Its guest
  // must exit cleanly; a failed guest or arbitrary partial script never passes.
  assert.equal(m.nativeExitCode, readbackComponent ? 1 : 0);
  if (readbackComponent) {
    assert.equal(m.nativeReadbackWorldRequested, true);
    assert.equal(m.originalAttachedWorldReadbackSaved, true);
    assert.equal(m.recordedGuestReplay, m.nativeIncomingHostPauseObservationRequested !== true);
    assert.ok(m.nativeReadbackRebuildMethodRequested === undefined ||
      typeof m.nativeReadbackRebuildMethodRequested === 'boolean');
    assert.ok(m.nativeReadbackRngRestoreRequested === undefined ||
      typeof m.nativeReadbackRngRestoreRequested === 'boolean');
    assert.ok(m.nativeReadbackUiRestoreRequested === undefined ||
      typeof m.nativeReadbackUiRestoreRequested === 'boolean');
    assert.ok(m.nativeReadbackPhase2Requested === undefined ||
      typeof m.nativeReadbackPhase2Requested === 'boolean');
    assert.ok(m.nativeReadbackPausedTicksRequested === undefined ||
      typeof m.nativeReadbackPausedTicksRequested === 'boolean');
    assert.ok(!m.nativeReadbackPausedTicksRequested || m.nativeReadbackPhase2Requested);
    if (m.nativeReadbackPhase2Requested) {
      assert.equal(m.nativeReadbackRebuildMethodRequested, true);
      assert.equal(m.nativeReadbackRngRestoreRequested, true);
      assert.equal(m.nativeReadbackUiRestoreRequested, true);
    }
  }
  assert.ok(!m.stopReason && !m.referenceError);
  const host = m.recordedGuestReplay === true;
  assert.equal(m.recordedHostReplay, !host);
  for (const key of ['nativeSessionTerminal', 'producerAbsent', 'fixtureStopped',
    'servedUnchanged', 'originalSettingsUnchanged', 'canonicalNativeStateUnchanged',
    'privateNativeExecutableUnchanged', 'worldSnapshotRequested',
    'twoOriginalWorldSnapshotsCaptured']) assert.equal(m[key], true, key);
  for (const key of host ? ['originalHostGameStartMatched', 'originalHostGoStatusObserved',
    'capturedGuestGoStatusDelivered'] : ['originalGuestReadyObserved',
    'originalGuestGoStatusObserved', 'capturedHostGoStatusDelivered']) assert.equal(m[key], true, key);
  assert.equal(m.browserUsed, false);
  assert.equal(m.liveSecondOriginalEngine, false);
  assert.equal(m.gameplayQualified, false);
  assert.equal(m.configuredCoopChapter, 1);
  assert.equal(m.configuredCoopRegion, '0_0');
  const root = join(workspace, `output/native-multiplayer-lobby-${String(m.attempt).padStart(3, '0')}`);
  assert.equal(m.profile, join(root, 'owned-profile'));
  assert.equal(await realpath(m.profile), m.profile);
  const buildBytes = await bounded(m.buildReport), build = JSON.parse(buildBytes);
  assert.equal(digest(buildBytes), m.buildReportSha256);
  assert.equal(build.nativeBuildQualified, true);
  assert.equal(build.exitCode, 0);
  assert.equal(build.nativeExecutableSha256, m.nativeExecutableSha256);
  const sources = Object.assign({}, ...['nativeSourceSha256', 'nativeHeapRuntimeSourceSha256',
    'nativeCheckpointRuntimeSourceSha256', 'nativeOrderRuntimeSourceSha256'].map(key => build[key]));
  assert.deepEqual(m.sources, sources);
  for (const [name, hash] of Object.entries(sources))
    assert.equal(await hashCheckpointSource(await stoppedFileSource(join(workspace, name))), hash, name);
  for (const [name, hash] of [['runner.py', m.runnerSha256], ['native_original_host_replay.py', m.replayHelperSha256],
    ['lobby.script', m.scriptSha256]]) assert.equal(digest(await bounded(join(root, name))), hash);
  if (host) assert.equal(digest(await bounded(join(root, 'native_original_guest_replay.py'))), m.guestReplayHelperSha256);
  if (m.nativeBeginFreshNeighborRequested === true) {
    assert.equal(host, true); assert.equal(m.nativeReadbackWorldRequested, false);
    assert.equal(m.nativePauseWorldRequested, true);
    assert.equal(digest(await bounded(join(root, 'native_coop_proposal_observer.py'))), m.proposalObserverSha256);
  }
  const logPath = join(root, 'native.log'), logBytes = await bounded(logPath, 4 * 1024 * 1024), log = logBytes.toString();
  assert.equal(digest(logBytes), m.logSha256);
  assert.ok(log.includes('mods: Lua 5.4.6 core plugin ready'));
  if (readbackComponent) {
    assert.equal(log.split('\n').filter(line => line === 'guest exit code:    0').length, 1);
    assert.ok(log.endsWith('the script did not finish: 23 of 24 steps ran\n\n1 expectation not met\n'));
    const script = (await bounded(join(root, 'lobby.script'))).toString();
    assert.equal(script, (await bounded(join(workspace, host ? 'output/coop-world-host-027.script' : 'output/coop-world-guest-028.script'))).toString());
    assert.ok(script.endsWith('peek 0x0071c6a8 4\n'));
    assert.equal(log.includes('[coop-phase2-fixture] Paused original ticks returned count=2'),
      m.nativeReadbackPausedTicksRequested === true);
    for (const marker of [
      '[coop-read-fixture] Deferred read entered outer-tick return=00415e88 renderer-call-active=0',
      m.nativeReadbackRebuildMethodRequested ?
        `[coop-read-fixture] Complete epoch=1 local=${host ? 1 : 2} slot=${host ? 0 : 1} owner=1 frame=0 clock=550 names-before=2 names-after=2 original-reader=00435940 original-writer=004359c0 attached=1 rebuilt=1 party-same=1 loaded-votes=0 resume-controls=0 result=pass` :
        `[coop-read-fixture] Complete epoch=1 local=${host ? 1 : 2} slot=${host ? 0 : 1} owner=1 frame=11 clock=550 names-before=2 names-after=2 original-reader=00435940 original-writer=004359c0 attached=1 rebuilt=0 party-same=1 loaded-votes=0 resume-controls=0 result=pass`,
      '[coop-read-fixture] Target disposed original-exit-request=9 pending=6 world-null=1'])
      assert.equal(log.split('\n').filter(line => line === marker).length, 1);
    if (m.nativeReadbackPhase2Requested) {
      for (const marker of [
        '[coop-phase2-fixture] Queued original dispatcher pending=2 phase=7 native-only-scheduling=1 committed-coordinator=0 ready-votes=0 loaded-votes=0',
        '[coop-phase2-fixture] Original rebuild entered return=00415e7f phase=2 pending=0 terminal-request3-suppressed=0',
        '[coop-phase2-fixture] Original rebuild returned phase=2 pending=3 frame=0 clock=550 context-clock=550 connection-owned=1',
        '[coop-phase2-fixture] Production hold returned phase=2 pending=7 owner=1 frame=0 clock=550 original-pause=004a5c00 ready-votes=0 loaded-votes=0 resume-controls=0',
        '[coop-phase2-fixture] Dispatcher settled hold phase=7 pending=0 owner=1 frame=0 clock=550 original-tick-body-entered=0'])
        assert.equal(log.split('\n').filter(line => line === marker).length, 1);
      assert.ok(!log.includes('terminal-request3-held=1'));
      if (m.nativeReadbackPausedTicksRequested)
        for (const marker of [
          '[coop-phase2-fixture] Paused original tick admitted ordinal=1 phase=7 pending=0 frame=0 clock=550 peer-loaded-votes=0',
          '[coop-phase2-fixture] Paused original tick admitted ordinal=2 phase=7 pending=0 frame=0 clock=550 peer-loaded-votes=0',
          '[coop-phase2-fixture] Paused original ticks returned count=2 phase=7 pending=0 frame=0 clock=550 context-clock=550 owner=1'])
          assert.equal(log.split('\n').filter(line => line === marker).length, 1);
    } else if (m.nativeReadbackRebuildMethodRequested)
      for (const marker of [
        '[coop-read-fixture] Original loading scope restored connection-owned=1 startup-votes-replayed=0 web-loaded-votes=0',
        '[coop-read-fixture] Original rebuild method returned entry=00416c30 terminal-request3-held=1 phase=7 pending=5 frame=0 clock=550 context-clock=550 party-same=1 dispatcher-phase2=0 loaded-votes=0 resume-controls=0'])
        assert.equal(log.split('\n').filter(line => line === marker).length, 1);
  } else assert.ok(log.includes('all expectations met'));
  assert.ok(!/result=fail|SIGSEGV|abort from|exception e06d7363|mod loader reported a failure|raising an access violation|\[coop-read-fixture\] Refused/i.test(log));
  const rows = [...log.matchAll(/^\[coop-world-fixture\] Snapshot stage=(\d+) label=(Coop_World_Ready|Coop_World_Progress) epoch=(\d+) local=(\d+) slot=(\d+) frame=(\d+) clock=(\d+) kingdoms=2 original-writer=1 before-tick=1 live-second-engine=0$/gm)];
  const gold = [...log.matchAll(/^\[coop-world-fixture\] Kingdom stage=(\d+) slot=(\d+) network-player=(\d+) gold=(-?\d+) original-getter=1$/gm)];
  assert.equal(rows.length, 2);assert.equal(gold.length, 4);
  assert.equal(m.worldSnapshots.length, 2);
  const snapshots = [];
  for (let stage = 0; stage < 2; ++stage) {
    const row = rows[stage], recorded = m.worldSnapshots[stage];
    const label = stage ? 'Coop_World_Progress' : 'Coop_World_Ready';
    assert.equal(+row[1], stage);assert.equal(row[2], label);assert.equal(+row[4], host ? 1 : 2);
    assert.equal(+row[5], host ? 0 : 1);
    assert.equal(row[3], rows[0][3]);assert.equal(row[5], rows[0][5]);
    assert.equal(recorded.label, label);
    assert.equal(recorded.path, join(m.profile, 'Documents/My Games/MajestyHD/SaveGame', label + '.GMP'));
    const stageGold = gold.filter(g => +g[1] === stage);
    assert.equal(stageGold.length, 2);
    assert.deepEqual(stageGold.map(g => +g[3]).sort(), [1, 2]);
    const slots = stageGold.map(g => +g[2]);
    assert.equal(new Set(slots).size, 2);assert.ok(slots.every(s => s >= 0 && s < 4));
    const state = await connectedWorldState(recorded.path);
    assert.equal(state.sha256, recorded.sha256);assert.equal(state.bytes, recorded.bytes);
    assert.equal(state.clock, +row[7]);assert.equal(state.label, label);
    if (!stage) assert.equal(state.clock, 0);
    else assert.ok(state.clock >= 500 && state.clock % 50 === 0);
    const kingdoms = await cooperativeKingdoms(recorded.path, slots);
    for (const kingdom of kingdoms) {
      const entry = stageGold.find(g => +g[2] === kingdom.slot);
      kingdom.networkPlayer = +entry[3];kingdom.gold = +entry[4];
    }
    snapshots.push({...recorded, clock: state.clock, frame: +row[6], counts: state.counts,
      roots: state.roots, rng: state.rng, gameplayRng: state.gameplayRng,
      terrainHeightsSha256: await terrainHeights(recorded.path), kingdoms});
  }
  assert.ok(rows[0].index < rows[1].index);
  assert.equal(snapshots[1].clock, (snapshots[1].frame - snapshots[0].frame) * 50,
    'Progress must correspond to original completed simulation frames');
  for (const before of snapshots[0].kingdoms) {
    const after = snapshots[1].kingdoms.find(k => k.slot === before.slot);
    assert.equal(after.networkPlayer, before.networkPlayer);
    for (const building of before.buildings) {
      const retained = after.buildings.find(b => b.unitId === building.unitId);
      assert.ok(retained, 'Starting buildings must remain registered');
      for (const key of ['agentId', 'description', 'script', 'family']) assert.equal(retained[key], building[key]);
    }
  }
  assert.equal(snapshots[0].terrainHeightsSha256, snapshots[1].terrainHeightsSha256,
    'Original progress must preserve terrain heights; active cell state may change');
  const configuredSeed = m.nativeConfiguredInitialSeed ?? null;
  if (configuredSeed !== null) {
    assert.equal(host, true, 'The initialization seed fixture belongs to the host');
    assert.ok(Number.isInteger(configuredSeed) && configuredSeed > 0 && configuredSeed <= 0x7fffffff);
    assert.equal(snapshots[0].gameplayRng, configuredSeed);
    const configured = [...log.matchAll(/^\[coop-init-fixture\] Original host seed configured seed=(\d+) previous=(\d+) epoch=(\d+) phase=(\d+) settings-offset=144 before-GameStart=1 live-second-engine=0$/gm)];
    assert.equal(configured.length, 1);
    assert.equal(+configured[0][1], configuredSeed);assert.equal(configured[0][3], rows[0][3]);
    assert.ok(configured[0].index < rows[0].index);
  }
  assert.notEqual(snapshots[0].roots.find(r => r.tag === 'GPL ').sha256,
    snapshots[1].roots.find(r => r.tag === 'GPL ').sha256, 'Original script simulation must advance');
  for (const input of m.replayInputs)
    assert.equal(await hashCheckpointSource(await stoppedFileSource(input.copy)), input.sha256);
  const incoming = m.nativeIncomingHostPauseObservationRequested === true ?
    inspectIncomingHostPause(m, log, snapshots, {readbackComponent}) : {};
  assert.ok(m.nativeHostCheckpointReadRequested === undefined ||
    typeof m.nativeHostCheckpointReadRequested === 'boolean');
  if (m.nativeHostCheckpointReadRequested) {
    assert.equal(readbackComponent, true);assert.equal(host, false);
    assert.equal(m.nativeReadbackPhase2Requested, true);
    assert.equal(m.importedHostCheckpointUnchanged, true);
    const record = m.importedHostCheckpoint;
    assert.equal(record.path, join(m.profile,
      'Documents/My Games/MajestyHD/SaveGame/Coop_Host_Checkpoint.GMP'));
    assert.equal(await realpath(record.path), record.path);
    const data = await bounded(record.path, 2 * 1024 * 1024);
    assert.equal(data.length, record.bytes);assert.equal(digest(data), record.sha256);
    const preserved = m.replayInputs.filter(input => input.source === record.source);
    assert.equal(preserved.length, 1);assert.equal(preserved[0].sha256, record.sha256);
    assert.equal(preserved[0].bytes, record.bytes);
    const sourceReport = m.replayInputs.find(input => input.source === m.replaySourceReport);
    const originalHost = JSON.parse(await bounded(sourceReport.copy));
    const hostProgress = originalHost.worldSnapshots[1];
    assert.equal(hostProgress.label, 'Coop_World_Progress');
    assert.equal(record.source, hostProgress.path);assert.equal(record.sha256, hostProgress.sha256);
    assert.equal(record.bytes, hostProgress.bytes);
    const marker = '[coop-host-read-fixture] Original host checkpoint selected label=Coop_Host_Checkpoint local=2 slot=1 owner=1 clock=550 offline-copy=1 shared-barrier=0';
    assert.equal(log.split('\n').filter(line => line === marker).length, 1);
  } else {
    assert.ok(!log.includes('[coop-host-read-fixture]'));
    assert.ok(!m.importedHostCheckpoint);
  }
  const peak = Math.max(...m.resourceSamples.map(s => s.rssBytes));
  assert.ok(peak > 0 && peak <= m.rssCeilingBytes);
  const verifiers = ['scripts/inspect-native-coop-world.mjs', 'scripts/lib/connected-residency.mjs',
    'scripts/lib/incoming-host-pause.mjs',
    'scripts/check-native-repeat-return.mjs', 'scripts/lib/stopped-entity-io.mjs',
    'web/world/checkpoint.mjs', 'web/world/terrain.mjs', 'web/world/transfer-store.mjs'];
  return {version: 1, initializedNativeCooperativeWorldSavedQualified: true,
    ...incoming,
    bothKingdomPalacesBuildingsAndGPLSavedQualified: true, originalGuestProgressSavedQualified: !host,
    originalHostProgressSavedQualified: host, originalProgressSavedQualified: true,
    originalRole: host ? 'host' : 'guest',
    ownedNativeInitializationSeedConfigured: configuredSeed !== null,
    bothKingdomMobileActorsPresent: snapshots.every(s => s.kingdoms.every(k => k.mobileActors.length > 0)),
    report: reportPath, reportSha256: digest(raw), snapshots, completedOriginalTicks: snapshots[1].clock / 50,
    verifierInputs: Object.fromEntries(await Promise.all(verifiers.map(async name =>
      [name, await hashCheckpointSource(await stoppedFileSource(join(workspace, name)))]))),
    peakSampledNativeRssBytes: peak, maximumReadBytes: 4096, browserUsed: false,
    scriptCompleted:!readbackComponent, originalCleanComponentExitQualified:readbackComponent,
    liveSecondOriginalEngine: false, pairedSynchronizationQualified: false,
    sharedSaveLoadResumeQualified: false, sharedCampaignCompletionQualified: false,
    scope: host ? 'One original native host initialized with a captured guest vote, admitted only after matching the independently inspected guest world GameStart. Full saves retain both kingdoms. The reference has no continuing world; host startup progress is not synchronized gameplay or shared resume.' :
      'One original native guest initialized against recorded original host packets. Full saves retain both original playable kingdoms and their simulation data. No live host runs alongside it; progress is the original guest startup window, not synchronized continuing gameplay.', goalComplete: false};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output] = process.argv.slice(2);
  assert.ok(input && output, 'Use stopped observation and fresh output filenames');
  const result = await inspectCoopWorld(input);
  await writeFile(output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({initializedNativeCooperativeWorldSavedQualified: true,
    completedOriginalTicks: result.completedOriginalTicks, peakSampledNativeRssBytes: result.peakSampledNativeRssBytes}));
}
