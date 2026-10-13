#!/usr/bin/env node
// Read a preserved, stopped native save; never launch or modify the game.
import assert from 'node:assert/strict';
import {readFile, writeFile, realpath} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {checkpointUnits, checkpointPlacements, checkpointActorRecords, checkpointAgents,
  checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';

async function attributes(source, unit) {
  const p = unit.components.find(x => x.tag === 'PRIM');
  assert.equal(p.version, 9);
  const word = async at => {
    assert.ok(at >= p.offset + 16 && at + 4 <= p.end);
    const b = await source.readAt(at, 4);
    return new DataView(b.buffer, b.byteOffset, 4).getUint32(0, true);
  };
  const optional = await word(p.offset + 64);
  assert.ok(optional <= 1);
  let at = p.offset + 76;
  if (optional) {assert.equal(await word(at), 1); at += 16;}
  assert.equal(await word(at), 1);
  const count = await word(at + 4);
  assert.ok(count <= 256 && at + 8 + count * 8 <= p.end);
  let previous = -1;
  const values = new Map();
  for (let i = 0; i < count; i++) {
    const key = await word(at + 8 + i * 8), value = await word(at + 12 + i * 8);
    assert.ok(key > previous); previous = key; values.set(key, value);
  }
  // Same original PRIM attribute schema used by inspect-native-ui-construction.
  return {agentId: values.get(0x4541), hp: values.has(0x00555041)
    ? values.get(0x00555041) | 0 : null, completed: values.get(0x01425041) ?? null};
}

async function main() {
  const [receiptPath, outputPath] = process.argv.slice(2);
  assert.ok(receiptPath && outputPath);
  const input = JSON.parse(await readFile(receiptPath, 'utf8'));
  const root = await realpath(new URL('../output/', import.meta.url));
  const filename = resolve(input.filename);
  assert.ok(filename.startsWith(root + '/') && await realpath(filename) === filename,
    'Require an owned regular save without symlink aliases');
  const source = await stoppedFileSource(filename), hash = createHash('sha256');
  assert.equal(source.size, input.bytes);
  for (let at = 0; at < source.size; at += 4096)
    hash.update(await source.readAt(at, Math.min(4096, source.size - at)));
  assert.equal(hash.digest('hex'), input.sha256);
  let rootAgent;
  for await (const agent of checkpointAgents(source))
    if (agent.name === 'GplAIRoot' && !agent.deleted) {
      assert.equal(rootAgent, undefined); rootAgent = agent;
    }
  assert.ok(rootAgent, 'Require the original live quest root');
  let victoryController = false, victoryFlag;
  for await (const v of checkpointAgentValues(source, rootAgent.agentId)) {
    if (v.attribute === 'VictoryCondition')
      victoryController = v.functions?.some(f => f.name === 'LostTrailVictory');
    if (v.attribute === 'Quest_Flag_9') {
      assert.equal(v.kind, 'boolean'); victoryFlag = v.value;
    }
  }
  assert.equal(victoryController, true, 'Require the Lost Trail victory controller');
  assert.equal(typeof victoryFlag, 'boolean');
  const positions = new Map();
  for await (const placement of checkpointPlacements(source))
    positions.set(placement.unitId, placement.mapPosition);
  const rows = [];
  let visited = 0;
  for await (const u of checkpointUnits(source)) {
    assert.ok(++visited <= 4096);
    const key = Buffer.alloc(4); key.writeUInt32LE(u.primary.description);
    const description = key.toString('ascii');
    if (u.family !== 'BLDG' && description !== 'AVz1') continue;
    const a = await attributes(source, u);
    if (!a.agentId) continue;
    // Dead native units can retain a record after their script agent retires.
    // They cannot satisfy any living objective and need no live-agent lookup.
    if (a.hp !== null && (a.hp <= 0 || (u.primary.words[2] & 4))) {
      rows.push({unitId: u.primary.words[1], owner: u.primary.words[5], description,
        ...a, stateFlags: u.primary.words[2], living: false,
        mapPosition: positions.get(u.primary.words[1])});
      continue;
    }
    const actor = await checkpointActorRecords(source, u.primary.words[1]);
    assert.equal(actor.agent.agentId, a.agentId);
    const values = {};
    for await (const v of checkpointAgentValues(source, a.agentId)) {
      if (v.path.length || !['title', 'type'].includes(v.attribute)) continue;
      assert.equal(v.kind, 'string'); assert.ok(v.stringBytes <= 1024);
      values[v.attribute] = Buffer.from(await source.readAt(v.offset, v.stringBytes)).toString('utf8');
    }
    if (!['Trail_Lodge', 'Wayfinder'].includes(values.title) && values.type?.toLowerCase() !== 'lair') continue;
    assert.notEqual(a.hp, null, 'Objective actor needs original HP');
    rows.push({unitId: u.primary.words[1], owner: u.primary.words[5],
      description, title: values.title, type: values.type, ...a,
      stateFlags: u.primary.words[2], parentUnitId: actor.unit.parentUnitId,
      mapPosition: positions.get(u.primary.words[1]),
      living: a.hp > 0 && !(u.primary.words[2] & 4)});
  }
  const lodges = rows.filter(r => r.owner === 0 && r.title === 'Trail_Lodge' && r.living && r.completed === 1);
  const heroes = rows.filter(r => r.owner === 0 && r.title === 'Wayfinder' && r.living);
  const lairs = rows.filter(r => r.owner !== 0 && r.type?.toLowerCase() === 'lair' && r.living);
  const counts = {completedLivingLodges: lodges.length, livingWayfinders: heroes.length,
    livingWayfindersInsideBuildings: heroes.filter(r => r.parentUnitId !== 0).length,
    livingHostileLairs: lairs.length};
  await writeFile(outputPath, JSON.stringify({input, counts, victoryFlag, rows,
    scope: 'Read-only original saved actor/HP/completion state. Does not qualify execution of GPL queries, victory or a playable release.'}, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify(counts));
}
main().catch(e => {console.error(e.message); process.exitCode = 1;});
