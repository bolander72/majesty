#!/usr/bin/env node
// Bounded literal UNIT/GPL records for original namespace/writer witnesses.
import {open, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {checkpointUnitAgentLinks, checkpointAgents, checkpointAgentValues} from '../web/world/checkpoint.mjs';

const basename = process.argv[2] ?? 'native-actor-script-fixtures';
if (!/^[a-z][a-z0-9-]*$/.test(basename) || process.argv.length > 3) throw Error('Use a fresh simple output basename');
const inputs = [
  {side: 0, path: 'output/checkpoint-unit-reference-browser/brashnard.GMP', ids: [2073,2101,2105,2122,2136],
    sha256: '31059d44ebf165c25bf1fd91f8ef00d5c5e3733d2d6177ca8e05956026650e13'},
  {side: 1, path: 'output/checkpoint-unit-reference-browser/scions.GMP', ids: [497],
    sha256: '6e6a2ee125b68ce00ec25a46f205904e7cdd8f83ca009c10cf29e8e9ab76e2d1'},
];
const rows = [], sources = [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const input of inputs) {
  const file = await open(input.path, 'r');
  try {
    const before = await file.stat(), digest = createHash('sha256');
    let readRequests = 0, maximumRead = 0;
    const source = {size: before.size, async readAt(at, size) {
      if (!Number.isSafeInteger(at) || !Number.isInteger(size) || at < 0 || size < 0 || size > 4096 || at + size > before.size)
        throw Error('Unbounded script witness read');
      const bytes = new Uint8Array(size), {bytesRead} = await file.read(bytes, 0, size, at);
      ++readRequests; maximumRead = Math.max(maximumRead, size);
      if (bytesRead !== size) throw Error('Truncated script witness');
      return bytes;
    }};
    for (let at = 0; at < before.size; at += 4096) digest.update(await source.readAt(at, Math.min(4096, before.size - at)));
    if (digest.digest('hex') !== input.sha256) throw Error('Changed copied kingdom');
    const units = new Map(), agents = new Map(), wanted = new Set(input.ids);
    for await (const unit of checkpointUnitAgentLinks(source)) if (wanted.has(unit.unitId)) {
      if (units.has(unit.unitId) || unit.family !== 'VHCL' || unit.playerNumber !== 7 || (unit.stateFlags & 4) || unit.parentUnitId || !unit.agentId)
        throw Error('Unsupported script witness actor');
      units.set(unit.unitId, unit);
    }
    if (units.size !== wanted.size) throw Error('Missing script witness units');
    for await (const agent of checkpointAgents(source)) if ([...units.values()].some(unit => unit.agentId === agent.agentId)) {
      if (agents.has(agent.agentId)) throw Error('Duplicate witness script ID');
      agents.set(agent.agentId, agent);
    }
    const readRecord = async range => {
      if (range.size > 4096) throw Error('Script witness record budget exceeded');
      return await source.readAt(range.offset, range.size);
    };
    for (const id of input.ids) {
      const unit = units.get(id), agent = agents.get(unit.agentId);
      if (!agent || agent.deleted || agent.unitId !== id) throw Error('Invalid bidirectional script association');
      const references = [], contexts = [], pairs = []; let values = 0;
      for await (const value of checkpointAgentValues(source, agent.agentId)) {
        ++values;
        if (value.type === 5) references.push({...value, offset: value.offset - agent.offset});
        if (value.type === 7) pairs.push({...value, offset: value.offset - agent.offset});
        if (value.type === 8) {
          const bytes = await source.readAt(value.stateOffset, 16), view = new DataView(bytes.buffer, bytes.byteOffset, 16);
          contexts.push({attribute: value.attribute, path: value.path, offset: value.stateOffset - agent.offset,
            state: Array.from({length:4}, (_,i) => view.getUint32(i * 4, true)), running: value.flag,
            functions: value.functions.map(({name,slot})=>({name,slot}))});
        }
      }
      const native = await readRecord(unit), script = await readRecord(agent);
      const positive = references.filter(ref => ref.targetAgentId !== null);
      if (positive.length > 16 || contexts.length > 16 || values > 256) throw Error('Witness descriptor budget exceeded');
      rows.push({side: input.side, unitId: id, agentId: agent.agentId, unit, agent, native, script,
        unitSha256: hash(native), agentSha256: hash(script), values, references, contexts, coordinatePairs: pairs});
    }
    const after = await file.stat();
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw Error('Checkpoint changed');
    sources.push({...input, bytes: before.size, readRequests, maximumRead});
  } finally {await file.close();}
}
const words = values => {const bytes = Buffer.alloc(values.length * 4); values.forEach((n,i) => bytes.writeUInt32LE(n,i * 4)); return bytes;};
const pieces = [Buffer.from('NSW1'), words([1, rows.length])];
for (const row of rows) pieces.push(words([row.side,row.unitId,row.agentId,row.native.length,row.script.length]),row.native,row.script);
const bytes = Buffer.concat(pieces);
if (bytes.length > 32768) throw Error('Witness pack exceeds native budget');
await writeFile(`output/${basename}.bin`, bytes, {flag:'wx'});
await writeFile(`output/${basename}.json`, JSON.stringify({format:'NSW1', version:1, bytes:bytes.length, sha256:hash(bytes), sources,
  cases: rows.map(({native,script,...row})=>row), nativeNamespacesNotYetWitnessed:true,
  completeReferenceClosureQualified:false, actorActivationQualified:false, browserUsed:false},null,2)+'\n', {flag:'wx'});
console.log(JSON.stringify({cases:rows.length, bytes:bytes.length,
  pairs:rows.map(row=>[row.unitId,row.agentId]), maximumRead:Math.max(...sources.map(s=>s.maximumRead))}));
