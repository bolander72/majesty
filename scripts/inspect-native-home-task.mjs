#!/usr/bin/env node
// Independently qualify the stopped local-home script gate, never hero travel.
import assert from 'node:assert/strict';
import {readFile, writeFile, stat} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {workspace, ownedDirectory, stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {inspectGeneratedHero} from './inspect-native-generated-hero.mjs';
import {originalHomeTaskTrace} from './lib/home-task-trace.mjs';
import {checkpointAgentRecord, checkpointAgentRecordValues,
  checkpointAgentValues, checkpointActorRecords, checkpointContainerEntries} from '../web/world/checkpoint.mjs';

const hash = async p => (await hashNativeFile(p)).sha256;
async function json(p) {
  assert.ok((await stat(p)).size <= 65536);
  return JSON.parse(await readFile(p, 'utf8'));
}
async function checkTask(source, values, expectedFunction) {
  const roots = values.filter(v => !v.path.length);
  function one(name, type) {
    const found = roots.filter(v => v.attribute === name);
    assert.equal(found.length, 1); assert.equal(found[0].type, type);
    return found[0];
  }
  assert.equal(one('home', 5).targetAgentId, 7);
  assert.equal(one('target', 5).targetAgentId, 7);
  const task = one('taskname', 3);
  assert.equal(task.stringBytes, 7);
  assert.deepEqual(Buffer.from(await source.readAt(task.offset, 8)), Buffer.from('go_home\0'));
  const active = one('activescript', 8);
  assert.deepEqual(active.functions.map(f => ({name: f.name, slot: f.slot})),
    [{name: expectedFunction, slot: 0}]);
  return {homeAgentId: 7, targetAgentId: 7, task: 'go_home', function: expectedFunction};
}
export async function inspectNativeHomeTask(name, {motion = false} = {}) {
  const m = await json(name);
  assert.deepEqual([m.nativeOnly, m.browserUsed, m.nativeSessionTerminal, m.nativeExitCode, m.stopReason],
    [true, false, true, 0, null]);
  assert.equal(m.homeTaskFixture, 'v1'); assert.equal(m.homeTaskTrialCompleted, true);
  assert.equal(m.homeMotionFixture, motion ? '1' : undefined);
  assert.deepEqual([m.initializedSourceUnchanged, m.sourceCopyUnchanged, m.originalSettingsUnchanged], [true, true, true]);
  const dir = await ownedDirectory(m.fixture, 'actor-arrival-fixture-home-task-');
  assert.equal(m.profile, join(dir, 'frontier_0_0'));
  assert.equal(m.script, join(dir, 'load-home.script')); assert.equal(await hash(m.script), m.scriptSha256);
  const build = await json(m.buildReport);
  assert.equal(await hash(m.buildReport), m.buildReportSha256);
  assert.equal(build.nativeBuildQualified, true); assert.equal(build.exitCode, 0);
  assert.equal(await hash(build.log), build.logSha256); assert.ok(build.finishedAtMs <= m.startedAtMs);
  await verifyConnectedNativeArtifact(m, build);
  assert.equal(await hash(m.sourceManifest), m.sourceManifestSha256);
  const origin = await json(m.sourceManifest), recruited = await inspectGeneratedHero(m.sourceManifest);
  assert.equal(recruited.independentlyPlacedOutsideHome, true);
  assert.equal(m.initializedSource, recruited.save.filename);
  assert.equal(await hash(m.initializedSource), m.initializedSourceSha256);
  assert.equal(m.sourceCopy, join(m.profile, 'Documents/My Games/MajestyHD/SaveGame/Home_Starting_Realm.GMP'));
  assert.equal(await hash(m.sourceCopy), m.initializedSourceSha256);
  for (const [n, d] of Object.entries(m.inputHashes)) {
    assert.equal(origin.inputHashes[n], d);
    assert.equal(await hash(join(origin.profile, n)), d);
    assert.equal(await hash(join(m.profile, n)), d);
  }
  assert.ok((await stat(m.log)).size <= 1024 * 1024);
  assert.equal(await hash(m.log), m.logSha256);
  const trial = originalHomeTaskTrace(await readFile(m.log, 'utf8'));
  if (!motion) assert.equal(trial.observedParentUnitId, 0);
  assert.equal(m.heldRecords.length, 2);
  const checked = [];
  for (const [i, r] of [...m.heldRecords, m.resumedRecord].entries()) {
    assert.ok(r);
    assert.equal(r.filename, join(m.profile, ['Hero_Home_Held_Before.GPL',
      'Hero_Home_Held_After.GPL', 'Hero_Home_Resumed.GPL'][i]));
    assert.ok(r.bytes >= 56 && r.bytes <= 65536);
    const info = await hashNativeFile(r.filename, {maximum: 65536});
    assert.equal(info.bytes, r.bytes); assert.equal(info.sha256, r.sha256);
    const source = await stoppedFileSource(r.filename), record = await checkpointAgentRecord(source);
    assert.deepEqual([record.agentId, record.unitId, record.deleted, record.attributes.declaredCount], [27, 502, false, 57]);
    // Exhaust traversal: later malformed attributes must refuse the record.
    const values = await Array.fromAsync(checkpointAgentRecordValues(source));
    checked.push({...r, task: await checkTask(source, values, i < 2 ? 'use_building' : 'travel_to')});
  }
  assert.equal(checked[0].bytes, checked[1].bytes); assert.equal(checked[0].sha256, checked[1].sha256);
  assert.notEqual(checked[2].sha256, checked[0].sha256, 'Original continuation did not change the script record');
  assert.equal(m.saves.length, motion ? 5 : 2);
  for (const r of m.saves) {
    assert.equal(resolve(r.filename), join(m.profile, 'Documents/My Games/MajestyHD/SaveGame', r.filename.split('/').at(-1)));
    const info = await hashNativeFile(r.filename); assert.equal(info.bytes, r.bytes); assert.equal(info.sha256, r.sha256);
  }
  const motionFiles = motion ? ['Home_Motion_Before.GMP', 'Home_Motion_After.GMP', 'Home_Motion_Resumed.GMP']
    .map(n => join(m.profile, 'Documents/My Games/MajestyHD/SaveGame', n)) : [];
  if (motion) for (const n of motionFiles) assert.equal(m.saves.filter(r => r.filename === n).length, 1);
  const saved = m.saves.filter(r => r.filename !== m.sourceCopy && !motionFiles.includes(r.filename)); assert.equal(saved.length, 1);
  const source = await stoppedFileSource(saved[0].filename);
  const hero = await checkpointActorRecords(source, 502), guild = await checkpointActorRecords(source, 469);
  assert.deepEqual([hero.unit.agentId, hero.unit.playerNumber, hero.unit.family, hero.unit.description], [27, 0, 'VHCL', 0x314c5641]);
  assert.deepEqual([guild.unit.agentId, guild.unit.playerNumber, guild.unit.family, guild.unit.description], [7, 0, 'BLDG', 0x31564241]);
  const savedValues = await Array.fromAsync(checkpointAgentValues(source, 27));
  let task;
  if (!motion) task = await checkTask(source, savedValues, 'use_building');
  else {
    // With the extended trial the UI save can occur after natural guild entry.
    // The immutable held and resumed records above establish the task gate.
    const home = savedValues.filter(v => v.attribute === 'home' && !v.path.length);
    assert.equal(home.length, 1); assert.equal(home[0].type, 5); assert.equal(home[0].targetAgentId, 7);
  }
  const members = (await Array.fromAsync(checkpointAgentValues(source, 7)))
    .filter(v => v.attribute === 'members' && v.type === 5);
  assert.deepEqual(members.map(v => [v.path, v.targetAgentId]), [[[0], 27]]);
  const containers = [];
  for await (const c of checkpointContainerEntries(source))
    if (c.type === 'member' && ((c.unitId === 502 && c.groupKind === 101) || (c.unitId === 469 && c.groupKind === 100))) containers.push(c);
  assert.deepEqual(containers.map(c => [c.unitId, c.groupKind, c.targetUnitId]).sort((a, b) => a[0] - b[0]),
    [[469, 100, 502], [502, 101, 469]]);
  assert.equal(m.rssCeilingBytes, 512 * 1024 * 1024);
  assert.ok(m.resourceSamples.length >= 3 && m.resourceSamples.length <= 40);
  for (const s of m.resourceSamples) {assert.equal(s.pid, m.nativePid); assert.ok(s.rssBytes > 0 && s.rssBytes <= m.rssCeilingBytes);}
  assert.ok(m.finishedAtMs >= m.startedAtMs && m.finishedAtMs - m.startedAtMs <= 62000);
  const audit = join(workspace, 'output/native-home-task-instruction-audit-002.json');
  await promisify(execFile)(join(workspace, 'upstream/majesty-recomp/.venv/bin/python'),
    [join(workspace, 'scripts/audit-native-home-task.py'), '--verify-report', audit], {maxBuffer: 4096});
  return {version: 1, originalHeroHomeTaskGateQualified: true, physicalHeroFreezeQualified: false,
    buildingEntryQualified: false, remoteHomeProjectionQualified: false, playerHeroCrossingQualified: false,
    scope: 'One local original Warrior/go_home task latched before use_building, then held across a one-second interval after original context cleanup. Full held GPL records are identical. Original dispatch resumes to travel_to with the same guild target; both hooks are removed. This is a native script gate only.',
    trial, records: checked, savedTaskDuringHold: task, uiSavedHeroHome: motion ? {agentId: 27, homeAgentId: 7} : undefined,
    sourceManifest: resolve(name), sourceManifestSha256: await hash(name),
    instructionAudit: audit, instructionAuditSha256: await hash(audit), nativeExecutableSha256: m.nativeExecutableSha256,
    nativeSourceSha256: m.nativeSourceSha256, maxSampledRssBytes: Math.max(...m.resourceSamples.map(s => s.rssBytes)),
    elapsedMs: m.finishedAtMs - m.startedAtMs, browserUsed: false, nativeProcessesStarted: 0};
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const [manifest, out] = process.argv.slice(2); if (process.argv.length !== 4) throw Error('Usage: <stopped task manifest> <fresh proof>');
  const r = await inspectNativeHomeTask(manifest); await writeFile(out, JSON.stringify(r, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({originalHeroHomeTaskGateQualified: true, playerHeroCrossingQualified: false,
    heldBytes: r.records[0].bytes, heldCalls: r.trial.heldCalls, maxSampledRssBytes: r.maxSampledRssBytes}));
}
