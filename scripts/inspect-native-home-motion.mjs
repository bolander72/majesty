#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {inspectNativeHomeTask} from './inspect-native-home-task.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace, stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {originalHomeMotionTrace, verifyHeroMotionRecords} from './lib/home-motion-trace.mjs';
import {checkpointActorOrderEntries} from './lib/native-crossing-order-entries.mjs';
import {checkpointPlacements, checkpointActorRecords, checkpointAgentValues,
  checkpointContainerEntries, checkpointUnitAgentLinks, checkpointInventory} from '../web/world/checkpoint.mjs';

async function text(source, value) {
  assert.equal(value.type, 3); assert.ok(value.stringBytes <= 64);
  const bytes = Buffer.from(await source.readAt(value.offset, value.stringBytes + 1));
  assert.equal(bytes.at(-1), 0); assert.ok(!bytes.subarray(0, -1).includes(0));
  return new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(0, -1));
}
async function kingdom(filename) {
  const state = await connectedWorldState(filename), source = await stoppedFileSource(filename);
  const actor = await checkpointActorRecords(source, 502), guild = await checkpointActorRecords(source, 469);
  assert.deepEqual([actor.unit.agentId, actor.unit.playerNumber, actor.unit.description, actor.unit.family], [27, 0, 0x314c5641, 'VHCL']);
  assert.deepEqual([guild.unit.agentId, guild.unit.playerNumber, guild.unit.description, guild.unit.family], [7, 0, 0x31564241, 'BLDG']);
  let placement;
  for await (const p of checkpointPlacements(source)) if (p.unitId === 502) {assert.ok(!placement); placement = p;}
  assert.ok(placement);
  const roots = (await Array.fromAsync(checkpointAgentValues(source, 27))).filter(v => !v.path.length);
  function one(name, type) {const rows = roots.filter(v => v.attribute === name);
    assert.equal(rows.length, 1); assert.equal(rows[0].type, type); return rows[0];}
  assert.equal(one('home', 5).targetAgentId, 7); assert.equal(one('target', 5).targetAgentId, 7);
  const task = await text(source, one('taskname', 3));
  const functions = one('activescript', 8).functions.map(f => ({name: f.name, slot: f.slot}));
  const members = (await Array.fromAsync(checkpointAgentValues(source, 7)))
    .filter(v => v.attribute === 'members' && v.type === 5);
  assert.deepEqual(members.map(v => [v.path, v.targetAgentId]), [[[0], 27]]);
  const containers = [];
  for await (const c of checkpointContainerEntries(source))
    if (c.type === 'member' && [469, 502].includes(c.unitId)) containers.push({unit: c.unitId, kind: c.groupKind, member: c.targetUnitId, flags: c.flags});
  function link(unit, kind, member) {const rows = containers.filter(c => c.unit === unit && c.kind === kind && c.member === member);
    assert.equal(rows.length, 1); assert.equal(rows[0].flags, 1);}
  link(469, 100, 502); link(502, 101, 469);
  if (placement.parentUnitId === 469) link(469, 2, 502);
  else assert.equal(containers.filter(c => c.unit === 469 && c.kind === 2 && c.member === 502).length, 0);
  const children = [];
  for await (const u of checkpointUnitAgentLinks(source)) if (u.parentUnitId === 502) {
    assert.ok(children.length < 16); assert.equal(u.agentId, 0, 'Unexpected scripted attached unit');
    link(502, 1, u.unitId);
    children.push({unitId: u.unitId, native: state.records.units[u.unitId], orders: state.records.attachments[`ORDR:${u.unitId}`]});
    assert.ok(children.at(-1).native && children.at(-1).orders);
    await Array.fromAsync(checkpointActorOrderEntries(source, u.unitId));
  }
  assert.deepEqual(containers.filter(c => c.unit === 502 && c.kind === 1).map(c => c.member).sort((a, b) => a - b),
    children.map(c => c.unitId).sort((a, b) => a - b));
  assert.equal((await Array.fromAsync(checkpointInventory(source))).filter(v => v.ownerUnitId === 502).length, 0);
  const orders = (await Array.fromAsync(checkpointActorOrderEntries(source, 502))).filter(v => v.type === 'entry')
    .map(v => ({kind: v.kind, bank: v.bank, index: v.index, bytes: v.size}));
  return {state, placement, task, functions, orders, children, containers};
}
export async function inspectNativeHomeMotion(name) {
  const base = await inspectNativeHomeTask(name, {motion: true});
  const m = JSON.parse(await readFile(name, 'utf8'));
  const trace = originalHomeMotionTrace(await readFile(m.log, 'utf8'));
  const paths = ['Before', 'After', 'Resumed'].map(n => join(m.profile, 'Documents/My Games/MajestyHD/SaveGame', `Home_Motion_${n}.GMP`));
  const worlds = [];
  for (const p of paths) worlds.push(await kingdom(p));
  const [before, after, resumed] = worlds;
  assert.deepEqual(worlds.map(w => w.state.clock), [trace.beforeClock, trace.afterClock, trace.resumedClock]);
  for (const w of [before, after]) {
    assert.equal(w.placement.parentUnitId, 0); assert.equal(w.placement.stateFlags, 512);
    assert.equal(w.task, 'go_home'); assert.deepEqual(w.functions, [{name: 'travel_to', slot: 0}]);
    assert.deepEqual(w.orders.map(v => [v.kind, v.bank]), [[4, 0], [7, 1]]);
    assert.deepEqual([w.placement.fixedPosition.x, w.placement.fixedPosition.y, w.placement.fixedPosition.z], trace.position.slice(0, 3));
  }
  assert.deepEqual(before.children, after.children, 'Held attached graph changed');
  assert.deepEqual(before.containers, after.containers, 'Held memberships changed');
  const enteredHome = resumed.placement.parentUnitId === 469;
  assert.equal(resumed.placement.parentUnitId, trace.resumedParentUnitId);
  if (enteredHome) {
    assert.equal(resumed.placement.stateFlags, 514); assert.equal(resumed.placement.requiresParentPosition, true);
    assert.equal(resumed.task, ''); assert.deepEqual(resumed.functions, [{name: 'Rest_at_guild', slot: 0}]);
    assert.deepEqual(resumed.orders, []); assert.equal(resumed.state.records.attachments['ORDR:502'], undefined);
  } else {
    assert.equal(resumed.placement.parentUnitId, 0); assert.equal(resumed.task, 'go_home');
    assert.ok(resumed.placement.mapPosition.x !== before.placement.mapPosition.x ||
      resumed.placement.mapPosition.y !== before.placement.mapPosition.y, 'No resumed horizontal motion');
    assert.ok(Math.abs(resumed.placement.mapPosition.x - before.placement.mapPosition.x) <= 128 &&
      Math.abs(resumed.placement.mapPosition.y - before.placement.mapPosition.y) <= 128, 'Unexpected movement jump');
  }
  const records = verifyHeroMotionRecords(before.state, after.state, resumed.state, {enteredHome});
  const audit = join(workspace, 'output/native-home-motion-instruction-audit-001.json');
  await promisify(execFile)(join(workspace, 'upstream/majesty-recomp/.venv/bin/python'),
    [join(workspace, 'scripts/audit-native-home-motion.py'), '--verify-report', audit], {maxBuffer: 4096});
  return {version: 1, nativeHeroCommandHoldQualified: true, localGuildEntryAfterHoldQualified: enteredHome,
    physicalHeroFreezeQualified: false, arbitraryDurationSuspensionQualified: false, playerHeroCrossingQualified: false,
    scope: 'One-second native per-owner script/command hold. Whole original UNIT/GPL/ORDR records and observed attached graph remain identical while other units dispatch. Original release resumes movement or completes local guild entry. Absolute ages, arbitrary effects/damage, remote guilds and regional transfer remain unqualified.',
    trace, records, heldChildren: before.children, resumedChildren: resumed.children,
    worlds: worlds.map((w, i) => ({filename: paths[i], bytes: w.state.bytes, sha256: w.state.sha256, clock: w.state.clock,
      placement: w.placement, task: w.task, functions: w.functions, orders: w.orders})),
    sourceManifest: resolve(name), sourceManifestSha256: base.sourceManifestSha256,
    nativeExecutableSha256: base.nativeExecutableSha256, nativeSourceSha256: base.nativeSourceSha256,
    instructionAudit: audit, instructionAuditSha256: (await hashNativeFile(audit)).sha256,
    elapsedMs: base.elapsedMs, maxSampledRssBytes: base.maxSampledRssBytes, browserUsed: false, nativeProcessesStarted: 0};
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const [manifest, out] = process.argv.slice(2); if (process.argv.length !== 4) throw Error('Usage: <stopped motion manifest> <fresh proof>');
  const r = await inspectNativeHomeMotion(manifest); await writeFile(out, JSON.stringify(r, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({nativeHeroCommandHoldQualified: true, localGuildEntryAfterHoldQualified: r.localGuildEntryAfterHoldQualified,
    playerHeroCrossingQualified: false, held: r.records, maxSampledRssBytes: r.maxSampledRssBytes}));
}
