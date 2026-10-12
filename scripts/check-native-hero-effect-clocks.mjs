#!/usr/bin/env node
// Compose both original lifetime proofs against the same stopped hero source.
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnitAgentLinks} from '../web/world/checkpoint.mjs';
import {checkpointOutdoorHeroEffectClocks} from '../web/world/hero-effect-clocks.mjs';
const [waitPlanName, markerPlanName, outputName] = process.argv.slice(2); assert.equal(process.argv.length, 5);
const hash = async n => (await hashNativeFile(n)).sha256;
const wait = JSON.parse(await readFile(waitPlanName, 'utf8')), marker = JSON.parse(await readFile(markerPlanName, 'utf8'));
assert.equal(wait.originalWaitEffectClockPlanQualified, true); assert.equal(marker.originalOutdoorMarkerClockPlanQualified, true);
for (const proof of [wait, marker]) {
  assert.equal(await hash(proof.nativeProof), proof.nativeProofSha256);
  assert.equal(await hash(proof.preparation), proof.preparationSha256);
  for (const [n, h] of Object.entries(proof.sourceSha256)) assert.equal(await hash(n), h);
}
const prep = JSON.parse(await readFile(marker.preparation, 'utf8'));
assert.equal(await hash(prep.source.filename), prep.source.sha256);
const source = await stoppedFileSource(prep.source.filename), clocks = {sourceClockMs: 57650, destinationClockMs: 24250};
const plan = await checkpointOutdoorHeroEffectClocks(source, 504, clocks);
assert.equal(plan.originalProjectedEffectLifetimesQualified, true); assert.equal(plan.destinationImportQualified, false);
assert.equal(plan.completeOrderMigration, false);
assert.deepEqual(plan.effects.map(e => [e.unitId, e.plan.remainingMs]), [[527, 450], [528, 700], [529, 2700]]);
assert.deepEqual(plan.patches.map(p => [p.before, p.after]), [[57600, 24200], [57350, 23950], [57350, 23950]]);
const expected = [marker.plan, ...wait.plans];
for (let i = 0; i < 3; ++i) assert.deepEqual(plan.effects[i].plan, expected[i]);
assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.effects) && Object.isFrozen(plan.patches));
assert.deepEqual((await checkpointOutdoorHeroEffectClocks(source, 504, {...clocks, destinationClockMs: 57650})).patches, []);
const units = []; for await (const u of checkpointUnitAgentLinks(source)) units.push(u);
const child = units.find(u => u.unitId === 529), hero = units.find(u => u.unitId === 504);
let refusedControls = 0;
async function refuse(s, id = 504, options = clocks) {
  await assert.rejects(checkpointOutdoorHeroEffectClocks(s, id, options)); ++refusedControls;
}
function mutate(words) {
  const patches = words.map(([at, word]) => {
    const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, word, true); return {at, bytes};
  });
  return {size: source.size, async readAt(offset, n) {
    const result = await source.readAt(offset, n);
    for (const p of patches) for (let i = 0; i < 4; ++i)
      if (p.at + i >= offset && p.at + i < offset + n) result[p.at + i - offset] = p.bytes[i];
    return result;
  }};
}
for (const id of [0, -1, 0x100000000, 503, 527]) await refuse(source, id);
await refuse(mutate([[child.offset + 56, 0]]));
await refuse(mutate([[child.offset + 48, 0x31475241]]));
await refuse(mutate([[hero.offset + 56, 469]]));
await refuse(mutate([[hero.offset + 40, hero.stateFlags | 4]]));
const unrelated = units.filter(u => ![504, 527, 528, 529].includes(u.unitId));
await refuse(mutate([[unrelated[0].offset + 56, 527]]));
await refuse(mutate(unrelated.slice(0, 17).map(u => [u.offset + 56, 504])));
await refuse(source, 504, {...clocks, sourceClockMs: 57651});
assert.equal(await hash(prep.source.filename), prep.source.sha256);
const report = {version: 1, originalOutdoorHeroEffectClocksQualified: true, plan, refusedControls,
  sourceUnchanged: true, componentEvidence: [resolve(waitPlanName), resolve(markerPlanName)],
  sourceSha256: Object.fromEntries(await Promise.all(['web/world/hero-effect-clocks.mjs',
    'scripts/check-native-hero-effect-clocks.mjs'].map(async n => [n, await hash(n)]))),
  browserUsed: false, nativeProcessesStarted: 0, heroTransferred: false};
await writeFile(outputName, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({originalOutdoorHeroEffectClocksQualified: true, effects: 3, patches: 3, refusedControls}));
