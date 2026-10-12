#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile, writeFile, stat} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {ownedDirectory, stoppedFileSource, workspace} from './lib/stopped-entity-io.mjs';
import {checkpointUnitAgentLinks, checkpointAgentRecord, checkpointAgentRecordValues} from '../web/world/checkpoint.mjs';
const [manifestName, outputName] = process.argv.slice(2); assert.equal(process.argv.length, 4);
const hash = async n => (await hashNativeFile(n)).sha256;
async function json(n) {assert.ok((await stat(n)).size <= 256 * 1024); return JSON.parse(await readFile(n, 'utf8'));}
function chunk(tag, data = Buffer.alloc(0), version = 0, count = 0) {
  const header = Buffer.alloc(16); header.write(tag); header.writeUInt32LE(data.length, 4);
  header.writeUInt32LE(version, 8); header.writeUInt32LE(count, 12); return Buffer.concat([header, data]);
}
async function unit(filename, family) {
  const bytes = await readFile(filename); assert.ok(bytes.length <= 4096);
  const world = Buffer.concat([chunk('VERS', Buffer.alloc(256), 1),
    ...['BLDG', 'VHCL', 'GRND', 'RWRD', 'MSGF', 'OFMP'].map(t => chunk(t, t === family ? bytes : undefined, 0, Number(t === family)))]);
  const source = {size: world.length, async readAt(at, n) {assert.ok(n <= 4096); return Uint8Array.from(world.subarray(at, at + n));}};
  const units = []; for await (const row of checkpointUnitAgentLinks(source)) units.push(row);
  assert.equal(units.length, 1); return {bytes, unit: units[0]};
}
const m = await json(manifestName);
assert.deepEqual([m.nativeOnly, m.browserUsed, m.nativeSessionTerminal, m.nativeExitCode,
  m.queueEntryTrialCompleted, m.stopReason], [true, false, true, 0, true, null]);
try {process.kill(m.nativePid, 0); throw Error('Native producer remains live');}
catch (error) {if (error.code !== 'ESRCH') throw error;}
const fixture = await ownedDirectory(m.fixture, 'actor-arrival-fixture-queue-entry-');
assert.equal(m.worldRoot, join(fixture, 'native-world-queue-entry')); assert.equal(m.profile, join(m.worldRoot, 'frontier_0_0'));
assert.equal(await hash(m.buildReport), m.buildReportSha256); const build = await json(m.buildReport);
assert.equal(build.nativeBuildQualified, true); assert.equal(await hash(build.log), build.logSha256);
for (const group of ['nativeSourceSha256', 'nativeHeapRuntimeSourceSha256', 'nativeOrderRuntimeSourceSha256']) {
  assert.deepEqual(m[group], build[group]); for (const [n, h] of Object.entries(m[group])) assert.equal(await hash(n), h);
}
assert.equal(await hash(join(workspace, 'upstream/majesty-recomp/build/recomp/pop_smoke')), m.nativeExecutableSha256);
assert.equal(build.nativeExecutableSha256, m.nativeExecutableSha256);
assert.equal(await hash('scripts/run-native-queue-entry.py'), m.runnerSha256);
assert.equal(await hash(m.preparation), m.preparationSha256); const prep = await json(m.preparation);
assert.equal(prep.queueEntryPreparationQualified, true);
assert.equal(await hash(prep.targetAudit), prep.targetAuditSha256); assert.equal(await hash(prep.sourceProof), prep.sourceProofSha256);
for (const [n, h] of Object.entries(prep.sourceSha256)) assert.equal(await hash(n), h);
assert.equal(m.source, prep.source.filename); assert.equal(await hash(m.source), prep.source.sha256);
assert.equal(await hash(m.sourceCopy), prep.source.sha256);
for (const flag of ['originalSourceUnchanged', 'sourceCopyUnchanged', 'originalSettingsUnchanged', 'proposalsUnchanged']) assert.equal(m[flag], true);
for (const [n, h] of Object.entries(prep.inputHashes)) assert.equal(await hash(join(prep.settingsProfile, n)), h);
assert.equal(await hash(m.script), m.scriptSha256);
assert.equal(await readFile(m.script, 'utf8'), 'wait 12000\ndump queue_entry_completed\n');
assert.equal(await hash(m.log), m.logSha256); assert.ok((await stat(m.log)).size <= 1024 * 1024);
const log = await readFile(m.log, 'utf8'); assert.ok(log.includes('all expectations met') && log.includes('undeliverable calls: none'));
assert.ok(!/result=fail|SIGSEGV|abort from/.test(log));
const lines = log.split('\n').filter(r => r.startsWith('[streaming] Queue entry '));
assert.equal(lines.length, 3);
assert.equal(lines[0], '[streaming] Queue entry begin clock=57650 hero=504 guild=469 home=7 source-parent=0 cursor=1 count=1 serialized-equal=1');
assert.equal(lines[1], '[streaming] Queue entry lookup target=469 original-guild=1 original-delegated=1');
const final = lines[2].match(/^\[streaming\] Queue entry complete hero=504 parent=469 lookup=1 path-count=([01]) queue-count=0 clock=(\d+) elapsed=(\d+) original-ai=1 original-entry=1 hooks-removed=1 hero-transfer=0 result=pass$/);
assert.ok(final);
assert.equal(Number(final[2]), 57650 + Number(final[3])); assert.ok(Number(final[3]) > 0 && Number(final[3]) <= 6000);
assert.equal(m.records.length, 11); const records = new Map();
for (const r of m.records) {
  assert.ok(!records.has(r.filename)); assert.equal(r.filename, join(m.profile, r.filename.split('/').at(-1)));
  const actual = await hashNativeFile(r.filename, {maximum: 65536});
  assert.equal(actual.sha256, r.sha256); assert.equal(actual.bytes, r.bytes); records.set(r.filename, r);
}
const source = await stoppedFileSource(m.source), original = new Map();
for await (const u of checkpointUnitAgentLinks(source)) if ([504, 469].includes(u.unitId)) original.set(u.unitId, u);
const units = {}, scripts = {}; let guildSecondaryWriterUpgrade;
for (const phase of ['Before', 'After']) {
  for (const [part, id, family, agentId] of [['Hero', 504, 'VHCL', 28], ['Guild', 469, 'BLDG', 7]]) {
    const filename = join(m.profile, `Queue_Entry_${phase}_${part}.UNIT`); assert.ok(records.has(filename));
    const observed = await unit(filename, family); assert.equal(observed.unit.unitId, id); assert.equal(observed.unit.agentId, agentId);
    if (phase === 'Before') {
      const saved = Buffer.from(await source.readAt(original.get(id).offset, original.get(id).size));
      if (part === 'Hero') assert.deepEqual(observed.bytes, saved);
      else {
        // The original whole-world save and standalone UNIT writer emit
        // different Guild SECD versions. Bind the entire unchanged PRIM and
        // retain the observed secondary difference rather than claim equality.
        assert.equal(saved.readUInt32LE(20), 218); const secondaryAt = 250;
        assert.deepEqual(observed.bytes.subarray(16, secondaryAt), saved.subarray(16, secondaryAt));
        assert.equal(saved.length, 267); assert.equal(observed.bytes.length, 271);
        assert.equal(saved.toString('ascii', secondaryAt, secondaryAt + 4), 'SECD');
        assert.equal(observed.bytes.toString('ascii', secondaryAt, secondaryAt + 4), 'SECD');
        assert.equal(saved.readUInt32LE(secondaryAt + 8), 1);
        assert.equal(observed.bytes.readUInt32LE(secondaryAt + 8), 2);
        guildSecondaryWriterUpgrade = {savedVersion: 1, standaloneVersion: 2, savedBytes: 267,
          standaloneBytes: 271, completePrimaryCompared: true, completeSecondaryEqualityQualified: false};
      }
    }
    if (part === 'Hero') assert.equal(observed.unit.parentUnitId, phase === 'Before' ? 0 : 469);
    units[`${phase}${part}`] = observed.unit;
    const scriptName = join(m.profile, `Queue_Entry_${phase}_${part}.GPL`); assert.ok(records.has(scriptName));
    const scriptSource = await stoppedFileSource(scriptName), record = await checkpointAgentRecord(scriptSource);
    assert.equal(record.agentId, agentId); assert.equal(record.unitId, id); assert.equal(record.deleted, false);
    const values = []; for await (const v of checkpointAgentRecordValues(scriptSource)) values.push(v);
    scripts[`${phase}${part}`] = {record, values};
  }
}
const beforeOrder = await readFile(join(m.profile, 'Queue_Entry_Before_Orders.bin'));
assert.deepEqual(beforeOrder, await readFile(prep.orderPayload.filename));
const afterOrder = await readFile(join(m.profile, 'Queue_Entry_After_Orders.bin'));
const pathCount = Number(final[1]); assert.equal(afterOrder.length, pathCount ? 172 : 24);
if (!pathCount) assert.deepEqual([...new Uint32Array(Uint8Array.from(afterOrder).buffer)], [1, 0, 1, 0, 1, 0]);
else {
  const expected = Buffer.concat([beforeOrder.subarray(0, 156), Buffer.from([1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0])]);
  assert.deepEqual(afterOrder, expected);
}
// Home is a persistent GPL reference, distinct from physical parent469.
const homes = Object.fromEntries(['Before', 'After'].map(phase => {
  const home = scripts[`${phase}Hero`].values.find(v => v.attribute === 'home' && !v.path.length);
  assert.equal(home.type, 5); assert.equal(home.targetAgentId, 7); return [phase, home.targetAgentId];
}));
for (const phase of ['Before', 'After']) {
  const member = scripts[`${phase}Guild`].values.filter(v => v.attribute === 'members' && v.targetAgentId === 28);
  assert.equal(member.length, 1); assert.deepEqual(member[0].path, [0]); assert.equal(member[0].type, 5);
}
assert.ok(m.resourceSamples.length && m.resourceSamples.every(s => s.pid === m.nativePid && s.rssBytes <= m.rssCeilingBytes));
const result = {version: 1, originalQueueGuildEntryQualified: true,
  manifest: resolve(manifestName), manifestSha256: await hash(manifestName), nativePid: m.nativePid,
  nativeExecutableSha256: m.nativeExecutableSha256, units, homes, pathCount,
  originalSimulationElapsedMs: Number(final[3]),
  sourceHeroBeforeExact: true, guildSecondaryWriterUpgrade, occupiedGuildScriptSlotPreserved: true,
  originalNativeGuildLookup: true,
  sourceSha256: {'scripts/inspect-native-queue-entry.mjs': await hash('scripts/inspect-native-queue-entry.mjs')},
  maximumSampledRssBytes: Math.max(...m.resourceSamples.map(s => s.rssBytes)),
  scope: 'Original source-world Queue4099 callback enters actual guild469 while script home7 remains. No destination restoration, dormant home routing or hero crossing.',
  destinationImportQualified: false, dormantHomeRoutingQualified: false, heroTransferred: false, browserUsed: false};
await writeFile(outputName, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({originalQueueGuildEntryQualified: true, nativeParent: 469, scriptHome: 7, pathCount}));
