// Exact stopped gameplay comparison at a positive original simulation clock.
// The allowed local differences match the already audited held-world policy.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {checkpointChunks, checkpointUnits} from '../../web/world/checkpoint.mjs';
import {stoppedFileSource} from './stopped-entity-io.mjs';
import {compareConnectedWorlds} from './connected-residency.mjs';
import {checkpointDisplayNames} from './coop-host-checkpoint-state.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
async function read(source, offset, size) {
  assert.ok(size <= 2 * 1024 * 1024);
  const b = Buffer.alloc(size);
  for (let n = 0; n < size; n += 4096)
    b.set(await source.readAt(offset + n, Math.min(4096, size - n)), n);
  return b;
}

// Deliberately scoped to the admitted level2 fixture, not a general GSGL
// parser. Original00417730 updates only the local player's elves/dwarves
// advisors;0042d8a0 emits their+10 last-observed clock as record word3.
// The pinned audit and unmodified callback execution prove this below-timeout
// path. Preserve period, auxiliary state, enabled flag and every other byte.
export function savedReturnAdvisorNotificationClocks(bytes, localSlot, clock = 1450) {
  assert.ok([1450,1550].includes(clock));
  assert.equal(bytes.length,1792); assert.ok(localSlot===0||localSlot===1);
  const data=Buffer.from(bytes), fields=[];
  for(const [slot,offset,advisor]of [[0,226,'elves'],[0,246,'dwarves'],[1,408,'elves'],[1,428,'dwarves']]) {
    const words=Array.from({length:5},(_,i)=>data.readUInt32LE(offset+i*4));
    assert.deepEqual(words,[1,20000,0,slot===localSlot?clock:0,1],'Require the exact audited advisor schema/clock');
    fields.push({slot,advisor,recordOffset:offset,clockOffset:offset+12,lastObservedClock:words[3]});
    data.writeUInt32LE(0,offset+12);
  }
  return {data,fields};
}

export async function compareSavedReturnGameplay(host, guest, level) {
  assert.ok([1450,1550].includes(host.clock)); assert.equal(guest.clock, host.clock);
  assert.equal(host.rng, guest.rng); assert.equal(host.gameplayRng, guest.gameplayRng);
  assert.equal(level,2,'The audited paused advisor layout requires level2');
  const states = [structuredClone(host), structuredClone(guest)], views = [], names = [];
  for (const [slot, state] of states.entries()) {
    const source = await stoppedFileSource(state.filename);
    assert.equal(source.size, state.bytes);
    assert.equal(sha(await read(source, 0, source.size)), state.sha256);
    const selected = [];
    for await (const unit of checkpointUnits(source))
      if (unit.primary.words[2] & 1) selected.push(unit);
    assert.equal(selected.length, 1);
    const palace = selected[0];
    assert.equal(palace.family, 'BLDG');
    assert.equal(palace.primary.description, 0x304a4241 + level * 0x1000000);
    assert.equal(palace.primary.words[5], slot);
    const primary = palace.components.find(c => c.tag === 'PRIM');
    const selectedAt = primary.offset + 24;
    const record = await read(source, palace.offset, palace.size);
    record[selectedAt - palace.offset] &= 0xfe;
    state.records.units[palace.primary.words[1]] = {bytes:palace.size, sha256:sha(record)};
    let rootIndex = 0, globals = 0, metadata = 0;
    for await (const chunk of checkpointChunks(source)) {
      const root = state.roots[rootIndex++];
      assert.deepEqual([root.tag,root.version,root.count],[chunk.tag,chunk.version,chunk.count]);
      if (chunk.tag === 'BLDG') {
        assert.ok(selectedAt >= chunk.offset + 16 && selectedAt < chunk.end);
        const b = await read(source, chunk.offset + 16, chunk.size);
        b[selectedAt - chunk.offset - 16] &= 0xfe;
        root.sha256 = sha(b);
      } else if (chunk.tag === 'GSGL') {
        assert.deepEqual([chunk.version,chunk.count],[6,0]);
        assert.ok(chunk.size >= 76 && chunk.size <= 65536);
        const b = await read(source, chunk.offset + 16, chunk.size);
        assert.equal(b.readUInt32LE(20), palace.primary.words[1]);
        assert.ok([0,palace.primary.words[1]].includes(b.readUInt32LE(24)));
        const fields = [0,4,8,12,20,24].map(offset => ({offset,value:b.readUInt32LE(offset)}));
        for (const {offset,value} of fields) {
          if (offset < 16) assert.ok(value <= 8192);
          b.writeUInt32LE(0,offset);
        }
        const advisors=savedReturnAdvisorNotificationClocks(b,slot,host.clock);
        root.sha256 = sha(advisors.data); views.push({slot,fields,savedReturnAdvisorNotificationClocks:advisors.fields}); ++globals;
      } else if (chunk.tag === 'SVGD') {
        assert.deepEqual([chunk.version,chunk.count],[10,0]); assert.ok(chunk.size <= 1024);
        const parsed = checkpointDisplayNames(await read(source,chunk.offset+16,chunk.size));
        root.sha256 = sha(parsed.semantic); root.bytes = parsed.semantic.length;
        names.push(parsed.names); ++metadata;
      }
    }
    assert.equal(rootIndex,state.roots.length); assert.equal(globals,1); assert.equal(metadata,1);
  }
  return {...compareConnectedWorlds(...states), originalClock:host.clock, gameplayStateMatches:true,
    localViewDifferences:views, savedPlayerDisplayNameDigests:names,
    scope:'Two stopped recorded original roles at the same captured pause clock. Exact gameplay bytes; only previously audited local UI/selection/display-name differences are reported separately. No live paired simulation claim.'};
}
