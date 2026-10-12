// Pinned Majesty native chunk metadata. Locate unit records without retaining
// a whole dormant region or interpreting process-local pointers as identity.
export const MAX_CHECKPOINT_BYTES = 64 * 1024 * 1024;
export const MAX_UNIT_RECORDS = 100000;
export const CHECKPOINT_PAGE_BYTES = 4096;
const FAMILIES = new Set(['BLDG', 'VHCL', 'GRND', 'RWRD', 'MSGF', 'OFMP']);
const MAX_ROOTS = 128, MAX_COMPONENTS = 8;

class MetadataReader {
  constructor(source) {
    if (!source || !Number.isSafeInteger(source.size) || source.size < 16 ||
        source.size > MAX_CHECKPOINT_BYTES || typeof source.readAt !== 'function')
      throw new Error('Native checkpoint read is out of bounds');
    this.source = source;
    this.size = source.size;
    this.page = new Uint8Array(CHECKPOINT_PAGE_BYTES);
    this.pageOffset = -1;
    this.pageLength = 0;
  }
  async bytes(offset, length) {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 ||
        length < 0 || length > 36 || offset + length > this.size)
      throw new Error('Native checkpoint read is out of bounds');
    // Copy metadata so a subsequent page read cannot change a yielded record.
    const result = new Uint8Array(length);
    for (let copied = 0; copied < length;) {
      const at = offset + copied;
      if (at < this.pageOffset || at >= this.pageOffset + this.pageLength) {
        const start = Math.floor(at / CHECKPOINT_PAGE_BYTES) * CHECKPOINT_PAGE_BYTES;
        const count = Math.min(CHECKPOINT_PAGE_BYTES, this.size - start);
        const value = await this.source.readAt(start, count);
        if (!(value instanceof Uint8Array) || value.byteLength !== count)
          throw new Error('Truncated native checkpoint');
        this.page.set(value);
        this.pageOffset = start;
        this.pageLength = count;
      }
      const within = at - this.pageOffset;
      const count = Math.min(length - copied, this.pageLength - within);
      result.set(this.page.subarray(within, within + count), copied);
      copied += count;
    }
    return result;
  }
}
async function header(source, offset, limit) {
  if (offset + 16 > limit) throw new Error('Truncated native chunk header');
  const data = await source.bytes(offset, 16), view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tag = String.fromCharCode(...data.subarray(0, 4));
  const size = view.getUint32(4, true), end = offset + 16 + size;
  if (!/^[A-Z ]{4}$/.test(tag) || end > limit) throw new Error('Invalid native chunk boundary');
  // The last word is a record count, NOT universally a child-chunk count.
  // For example MVTX/PRIM contains raw vertices rather than nested headers.
  return {tag, offset, size, end, version: view.getUint32(8, true), count: view.getUint32(12, true)};
}

export async function* checkpointChunks(source) {
  yield* chunks(new MetadataReader(source));
}
async function* chunks(source) {
  let offset = 0, count = 0;
  while (offset < source.size) {
    if (++count > MAX_ROOTS) throw new Error('Too many native root chunks');
    const chunk = await header(source, offset, source.size);
    if (count === 1 && (chunk.tag !== 'VERS' || chunk.version !== 1 || chunk.size !== 256 || chunk.count !== 0))
      throw new Error('Unsupported native checkpoint format');
    yield chunk;
    offset = chunk.end;
  }
  if (!count) throw new Error('Empty native checkpoint');
}

async function unit(source, family, chunk, ordinal, includePlacement = false) {
  if (chunk.tag !== 'UNIT' || chunk.version !== 0 || !chunk.count || chunk.count > MAX_COMPONENTS)
    throw new Error('Unsupported native unit container');
  const components = [];
  let offset = chunk.offset + 16, primary;
  for (let index = 0; index < chunk.count; ++index) {
    const part = await header(source, offset, chunk.end);
    if (components.some(previous => previous.tag === part.tag))
      throw new Error('Duplicate native unit component');
    if (part.tag === 'PRIM') {
      if (part.version !== 9 || part.size < 36 || part.count !== 0)
        throw new Error('Unsupported native primary unit state');
      if (includePlacement && part.size < 40) throw new Error('Truncated native unit position');
      const data = await source.bytes(part.offset + 16, includePlacement ? 28 : 36);
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      // 005c0bd0 copies +5c/+60/+64/+68/+6c/+70/+74, then the original
      // coordinate data. Keep unmapped words opaque until their references
      // have been audited. The description key is independently resolved.
      primary = {description: view.getUint32(16, true), words: Array.from({length: 7}, (_, i) => view.getUint32(i * 4, true))};
      if (includePlacement) {
        // Continue forward once, rather than revisiting a previous page to
        // reread coordinates that overlap the basic metadata's tail.
        const raw = await source.bytes(part.offset + 16 + 28, 12);
        const position = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
        primary.fixedPosition = {x: position.getInt32(0, true), y: position.getInt32(4, true), z: position.getInt32(8, true)};
      }
    }
    components.push(part);
    offset = part.end;
  }
  if (offset !== chunk.end || !primary) throw new Error('Incomplete native unit record');
  return {family, ordinal, offset: chunk.offset, size: chunk.end - chunk.offset, primary, components};
}

export async function* checkpointUnits(source) {
  yield* units(new MetadataReader(source));
}
async function* units(reader, includePlacement = false) {
  let total = 0;
  const seen = new Set();
  for await (const group of chunks(reader)) {
    if (!FAMILIES.has(group.tag)) continue;
    if (seen.has(group.tag) || group.version !== 0 || total + group.count > MAX_UNIT_RECORDS)
      throw new Error('Invalid native unit group');
    seen.add(group.tag);
    let offset = group.offset + 16;
    for (let ordinal = 0; ordinal < group.count; ++ordinal) {
      const chunk = await header(reader, offset, group.end);
      const record = await unit(reader, group.tag, chunk, ordinal, includePlacement);
      ++total;
      yield record;
      offset = chunk.end;
    }
    if (offset !== group.end) throw new Error('Native unit group count does not match its data');
  }
  if (seen.size !== FAMILIES.size) throw new Error('Incomplete native unit groups');
}

export async function* checkpointPlacements(source) {
  const reader = new MetadataReader(source);
  for await (const record of units(reader, true)) {
    const fixedPosition = record.primary.fixedPosition;
    const words = record.primary.words, parentUnitId = words[6];
    // 005a2660 is the original virtual player-number getter. 005ad5b0
    // resolves physical attachment +74, unless state flag bit 7 is set.
    // GPL GetParent instead queries container relationships: do not equate
    // a physical parent with the hero's home or gameplay parent.
    const requiresParentPosition = parentUnitId !== 0 && (words[2] & 0x80) === 0;
    yield {family: record.family, unitId: words[1], playerNumber: words[5] | 0,
      description: record.primary.description, parentUnitId, stateFlags: words[2], fixedPosition,
      requiresParentPosition, mapPosition: requiresParentPosition ? null : {x: fixedPosition.x >> 11, y: fixedPosition.y >> 11},
      offset: record.offset, size: record.size};
  }
}

async function integer(reader, offset, limit) {
  if (offset + 4 > limit) throw new Error('Truncated native reference data');
  const data = await reader.bytes(offset, 4);
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0, true);
}

async function* attachments(reader) {
  const seen = new Set();
  let total = 0;
  for await (const group of chunks(reader)) {
    if (group.tag !== 'ORDR' && group.tag !== 'CONT') continue;
    if (seen.has(group.tag) || group.version !== 1 || total + group.count > MAX_UNIT_RECORDS)
      throw new Error('Invalid native attachment group');
    seen.add(group.tag);
    let offset = group.offset + 16;
    for (let ordinal = 0; ordinal < group.count; ++ordinal) {
      // 005b1f00 / 005bfd7c write Unit+60 immediately before this chunk.
      // IDs refer to one saved native world; they are not portable identity.
      const unitId = await integer(reader, offset, group.end);
      const record = await header(reader, offset + 4, group.end);
      if (!unitId || record.tag !== group.tag || record.version !== 0 ||
          !record.count || record.count > MAX_COMPONENTS)
        throw new Error('Unsupported native attachment container');
      const components = [];
      let partAt = record.offset + 16, primary;
      for (let index = 0; index < record.count; ++index) {
        const part = await header(reader, partAt, record.end);
        if (components.some(previous => previous.tag === part.tag))
          throw new Error('Duplicate native attachment component');
        if (part.tag === 'PRIM') {
          if (part.count !== 0 || part.version !== (group.tag === 'ORDR' ? 2 : 1))
            throw new Error('Unsupported native attachment state');
          primary = part;
        }
        components.push(part); partAt = part.end;
      }
      if (!primary || partAt !== record.end) throw new Error('Incomplete native attachment record');
      ++total;
      yield {kind: group.tag, unitId, ordinal, offset, size: record.end - offset, primary, components};
      offset = record.end;
    }
    if (offset !== group.end) throw new Error('Native attachment count does not match its data');
  }
  if (seen.size !== 2) throw new Error('Incomplete native attachment groups');
}

export async function* checkpointAttachments(source) {
  yield* attachments(new MetadataReader(source));
}

export async function* checkpointContainerEntries(source) {
  const reader = new MetadataReader(source);
  let totalGroups = 0, totalMembers = 0;
  for await (const attachment of attachments(reader)) {
    if (attachment.kind !== 'CONT') continue;
    const primary = attachment.primary, limit = primary.end;
    let offset = primary.offset + 16;
    const version = await integer(reader, offset, limit);
    const count = await integer(reader, offset + 4, limit);
    if (version !== 1 || totalGroups + count > MAX_UNIT_RECORDS)
      throw new Error('Unsupported native container groups');
    totalGroups += count; offset += 8;
    for (let groupIndex = 0; groupIndex < count; ++groupIndex) {
      if (offset + 16 > limit) throw new Error('Truncated native container group');
      const data = await reader.bytes(offset, 16);
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const groupVersion = view.getUint32(0, true), memberCount = view.getUint32(4, true);
      const groupKind = view.getUint32(8, true), groupOwnerUnitId = view.getUint32(12, true);
      if (groupVersion !== 1 || totalMembers + memberCount > MAX_UNIT_RECORDS || offset + 16 + memberCount * 8 > limit)
        throw new Error('Invalid native container members');
      totalMembers += memberCount;
      yield {type: 'group', unitId: attachment.unitId, groupIndex, groupKind, groupOwnerUnitId,
        memberCount, offset, size: 16};
      offset += 16;
      for (let memberIndex = 0; memberIndex < memberCount; ++memberIndex) {
        const value = await integer(reader, offset, limit), flags = await integer(reader, offset + 4, limit);
        // 005995f9..00599603 stores a saved ID and sets bit 0. A clear bit
        // is opaque data (including null), never a guest pointer to resolve.
        yield {type: 'member', unitId: attachment.unitId, groupIndex, memberIndex, groupKind,
          groupOwnerUnitId, value, flags, targetUnitId: flags & 1 ? value : null, offset, size: 8};
        offset += 8;
      }
    }
    if (offset !== limit) throw new Error('Native container count does not match its data');
  }
}

export async function* checkpointInventory(source) {
  const reader = new MetadataReader(source);
  let seen = false;
  for await (const group of chunks(reader)) {
    if (group.tag !== 'GSGL') continue;
    if (seen || group.version !== 6 || group.count !== 0)
      throw new Error('Unsupported native global state');
    seen = true;
    // 0043632c..00436421 writes 19 four-byte words, then 00491df0 writes
    // a counted definition-ID set. 004d70a0 follows with (item, owner) pairs.
    // Remaining globals/kingdoms/quest data are intentionally not decoded.
    const definitionsAt = group.offset + 16 + 19 * 4;
    const definitions = await integer(reader, definitionsAt, group.end);
    if (definitions > MAX_UNIT_RECORDS) throw new Error('Too many native definition references');
    const countAt = definitionsAt + 4 + definitions * 4;
    const count = await integer(reader, countAt, group.end);
    if (count > MAX_UNIT_RECORDS || countAt + 4 + count * 8 > group.end)
      throw new Error('Invalid native inventory count');
    for (let ordinal = 0; ordinal < count; ++ordinal) {
      const offset = countAt + 4 + ordinal * 8;
      yield {item: await integer(reader, offset, group.end),
        ownerUnitId: await integer(reader, offset + 4, group.end), ordinal, offset, size: 8};
    }
  }
  if (!seen) throw new Error('Missing native global state');
}

// Original GPL streams use (total bytes, version) envelopes, not the
// four-character chunk headers above. Each envelope includes its final
// (0, -1) marker. Keep attribute values opaque until their types/references
// can be remapped; a native unit's saved state alone is not its script agent.
async function gplEnvelope(reader, offset, limit, version, minimum = 16) {
  const size = await integer(reader, offset, limit);
  if (size < minimum || size > limit - offset ||
      await integer(reader, offset + 4, limit) !== version)
    throw new Error('Invalid native GPL envelope');
  const end = offset + size;
  return {offset, size, end, version};
}
async function gplEnd(reader, record) {
  if (await integer(reader, record.end - 8, record.end) !== 0 ||
      await integer(reader, record.end - 4, record.end) !== 0xffffffff)
    throw new Error('Invalid native GPL end marker');
}
export const MAX_GPL_NAME_BYTES = 1024;
export const MAX_GPL_STRING_BYTES = 1024 * 1024;
export const MAX_GPL_VALUE_DEPTH = 32;
export const MAX_GPL_VALUE_RECORDS = 100000;
export const MAX_GPL_REFERENCE_SITES = 1024;
async function gplName(reader, offset, limit, capture = false, maximum = MAX_GPL_NAME_BYTES) {
  const bytes = capture ? new Uint8Array(MAX_GPL_NAME_BYTES) : null;
  let length = 0;
  while (offset + length < limit && length < maximum) {
    const part = await reader.bytes(offset + length,
      Math.min(32, maximum - length, limit - offset - length,
        CHECKPOINT_PAGE_BYTES - (offset + length) % CHECKPOINT_PAGE_BYTES));
    const zero = part.indexOf(0), count = zero < 0 ? part.length : zero;
    if (bytes) bytes.set(part.subarray(0, count), length);
    length += count;
    if (zero >= 0) return {end: offset + length + 1,
      value: bytes ? new TextDecoder('utf-8', {fatal: true}).decode(bytes.subarray(0, length)) : undefined};
  }
  throw new Error('Native GPL name is truncated or exceeds its bound');
}

async function gplAgentRecord(reader, offset, limit, agentId) {
  const record = await gplEnvelope(reader, offset, limit, 2, 56);
  const attributes = await gplEnvelope(reader, record.offset + 8, record.end - 19, 0, 20);
  const attributeCount = await integer(reader, attributes.offset + 8, attributes.end - 8);
  if (attributeCount > MAX_UNIT_RECORDS) throw new Error('Too many native GPL attributes');
  await gplEnd(reader, attributes);
  let at = attributes.end;
  const functions = await integer(reader, at, record.end - 19);
  if (functions > MAX_UNIT_RECORDS) throw new Error('Too many native GPL function names');
  at += 4;
  for (let i = 0; i < functions; ++i) at = (await gplName(reader, at, record.end - 19)).end;
  const actualId = await integer(reader, at, record.end - 19);
  if (!actualId || actualId > 0x7fffffff || (agentId !== undefined && actualId !== agentId))
    throw new Error('Native GPL record ID does not match its manager key');
  const name = await gplName(reader, at + 4, record.end - 19, true);
  if (name.end !== record.end - 19) throw new Error('Invalid native GPL agent tail');
  const unitId = await integer(reader, name.end, record.end);
  const deleted = (await reader.bytes(name.end + 4, 1))[0];
  if (deleted > 1) throw new Error('Invalid native GPL deletion flag');
  await gplEnd(reader, record);
  return {agentId: actualId, unitId, deleted: deleted === 1, name: name.value,
    offset: record.offset, size: record.size,
    identityOffset: at, nativeIdOffset: name.end,
    attributes: {offset: attributes.offset, size: attributes.size, declaredCount: attributeCount},
    functionNameCount: functions};
}

export async function* checkpointAgents(source) {
  const reader = new MetadataReader(source);
  yield* agents(reader);
}

// Scalar insertion boundaries for an inert, freshly reserved pure GPL agent.
// Exhaust queues and sentinels before exposing an offset; retain no catalogue.
export async function checkpointAgentManagerLayout(source) {
  const reader=new MetadataReader(source);let result;
  for await(const record of agents(reader,false,true))if(record.type==='manager-layout')result=record;
  if(!result)throw Error('Missing native GPL manager layout');return result;
}

// The original GPL serializer retains its next allocation counter after the
// manager envelope, including IDs of agents already removed from the registry.
// Deriving a proposal from the largest surviving ID would revive retired IDs.
export async function checkpointNextAgentId(source) {
  const reader=new MetadataReader(source);let maximum=0;
  for await(const agent of agents(reader))maximum=agent.agentId;
  let result;
  for await(const group of chunks(reader))if(group.tag==='GPL '){
    if(result!==undefined||group.version!==1||group.count!==0)throw Error('Unsupported native GPL counter');
    const runtime=await gplEnvelope(reader,group.offset+16,group.end,3,40);
    const manager=await gplEnvelope(reader,runtime.offset+12,runtime.end-12,2,29);
    if(runtime.end!==group.end||manager.end!==runtime.end-12)throw Error('Invalid native GPL counter boundary');
    result=await integer(reader,manager.end,runtime.end-8);
    if(result<=maximum||result>0x7fffffff)throw Error('Invalid native GPL allocation counter');
  }
  if(result===undefined)throw Error('Missing native GPL allocation counter');
  return result;
}
async function* agents(reader, includeQueues = false, includeLayout = false) {
  let seen = false;
  for await (const group of chunks(reader)) {
    if (group.tag !== 'GPL ') continue;
    if (seen || group.version !== 1 || group.count !== 0)
      throw new Error('Unsupported native GPL state');
    seen = true;
    const runtime = await gplEnvelope(reader, group.offset + 16, group.end, 3, 40);
    if (runtime.end !== group.end) throw new Error('Unexpected trailing native GPL data');
    const manager = await gplEnvelope(reader, runtime.offset + 12, runtime.end - 12, 2, 29);
    if (manager.end !== runtime.end - 12) throw new Error('Invalid native GPL manager boundary');
    let offset = manager.offset + 8;
    const definitions = await integer(reader, offset, manager.end - 8);
    if (definitions > MAX_UNIT_RECORDS) throw new Error('Too many native GPL definitions');
    offset += 4;
    for (let i = 0; i < definitions; ++i) {
      offset = (await gplName(reader, offset, manager.end - 8)).end;
      if (!await integer(reader, offset, manager.end - 8)) throw new Error('Invalid native GPL definition ID');
      offset += 4;
    }
    const countOffset=offset,count = await integer(reader, offset, manager.end - 8);
    if (count > MAX_UNIT_RECORDS) throw new Error('Too many native GPL agents');
    offset += 4;
    let previous = 0;
    for (let ordinal = 0; ordinal < count; ++ordinal) {
      const agentId = await integer(reader, offset, manager.end - 8);
      // The original manager writes its positive-ID ordered tree. Monotonic
      // IDs reject duplicates without a set proportional to the kingdom.
      if (agentId <= previous || agentId > 0x7fffffff) throw new Error('Invalid native GPL agent ordering');
      previous = agentId;
      const record = await gplAgentRecord(reader, offset + 4, manager.end - 8, agentId);
      yield {...record, ordinal};
      offset = record.offset + record.size;
    }
    const insertionOffset=offset;
    // Two manager queues and its active-list selector follow the agents.
    // Values remain world-local agent IDs; do not turn them into host pointers.
    for (let queue = 0; queue < 2; ++queue) {
      const length = await integer(reader, offset, manager.end - 8);
      offset += 4;
      if (length > MAX_UNIT_RECORDS || length * 4 > manager.end - 8 - offset)
        throw new Error('Invalid native GPL queue');
      if (includeQueues) {
        for (let index = 0; index < length; ++index) {
          const at = offset + index * 4, agentId = await integer(reader, at, manager.end - 8);
          if (!agentId || agentId > 0x7fffffff) throw new Error('Invalid native queued agent ID');
          yield {type: 'queued-agent', queue, index, agentId, offset: at, size: 4};
        }
      }
      offset += length * 4;
    }
    if (offset + 1 !== manager.end - 8 || (await reader.bytes(offset, 1))[0] > 1)
      throw new Error('Invalid native GPL manager tail');
    if (includeQueues) yield {type: 'queue-selector', activeQueue: (await reader.bytes(offset, 1))[0], offset, size: 1};
    await gplEnd(reader, manager);
    await gplEnd(reader, runtime);
    if(includeLayout){
      const nextAgentId=await integer(reader,manager.end,runtime.end-8);
      if(nextAgentId<=previous||nextAgentId>0x7fffffff)throw Error('Invalid native GPL allocation counter');
      yield {type:'manager-layout',groupOffset:group.offset,groupSize:group.size,
        runtimeOffset:runtime.offset,runtimeSize:runtime.size,managerOffset:manager.offset,managerSize:manager.size,
        countOffset,count,insertionOffset,counterOffset:manager.end,nextAgentId};
    }
  }
  if (!seen) throw new Error('Missing native GPL state');
}

// Exhaust this iterator before trusting queue membership: later data can fail.
// IDs are local to this checkpoint; this does not validate every queue-to-agent
// link or activate scripts in a live engine. Retain only bounded selected IDs.
export async function* checkpointAgentQueues(source) {
  const reader = new MetadataReader(source);
  for await (const record of agents(reader, true))
    if (record.type === 'queued-agent' || record.type === 'queue-selector') yield record;
}

const GPL_VALUE_KINDS = ['null', 'integer', 'float', 'string', 'list', 'agent-reference', 'boolean', 'pair', 'function-context'];
// Flat post-order traversal: one page and a bounded recursion path, no value
// tree or complete string payload. Type 5 alone denotes a script-agent ID.
async function* gplValue(reader, typeOffset, limit, context, path, budget) {
  if (path.length > MAX_GPL_VALUE_DEPTH || ++budget.count > MAX_GPL_VALUE_RECORDS)
    throw new Error('Native GPL value depth or count exceeds its bound');
  const type = await integer(reader, typeOffset, limit), offset = typeOffset + 4;
  let end = offset, details = {};
  if (type === 0) {
    // Original base value read/write consumes no payload.
  } else if (type === 1 || type === 2 || type === 5) {
    const bits = await integer(reader, offset, limit);
    details = type === 1 ? {bits, value: bits | 0} : type === 2 ? {bits} :
      {bits, targetAgentId: bits > 0 && bits <= 0x7fffffff ? bits : null};
    end += 4;
  } else if (type === 3) {
    end = (await gplName(reader, offset, limit, false, MAX_GPL_STRING_BYTES)).end;
    details = {stringBytes: end - offset - 1};
  } else if (type === 4 || type === 8) {
    const envelope = type === 4 ? await gplEnvelope(reader, offset, limit, 0, 20) : null;
    let at = envelope ? offset + 8 : offset;
    const childLimit = envelope ? envelope.end - 8 : limit;
    const count = await integer(reader, at, childLimit);
    if (count > MAX_GPL_VALUE_RECORDS - budget.count) throw new Error('Too many native GPL child values');
    at += 4;
    for (let i = 0; i < count; ++i)
      at = yield* gplValue(reader, at, childLimit, context, [...path, i], budget);
    details = {childCount: count};
    if (envelope) {
      if (at !== envelope.end - 8) throw new Error('Native GPL list count does not match its data');
      await gplEnd(reader, envelope);
      end = envelope.end;
    } else {
      // Arguments precede two raw floats, two DWORDs, a flag and two optional
      // symbolic function names. None of the raw context words is inferred as ID.
      if (at + 17 > limit) throw new Error('Truncated native GPL function context');
      const stateOffset = at;
      at += 16;
      const flag = (await reader.bytes(at++, 1))[0];
      if (flag > 1) throw new Error('Invalid native GPL function-context flag');
      const functions = [];
      for (let slot = 0; slot < 2; ++slot) {
        if (at >= limit) throw new Error('Truncated native GPL function presence');
        const present = (await reader.bytes(at++, 1))[0];
        if (present > 1) throw new Error('Invalid native GPL function presence');
        if (present) {
          const name = await gplName(reader, at, limit, true);
          functions.push({slot, offset: at, size: name.end - at, name: name.value});
          at = name.end;
        }
      }
      details = {...details, stateOffset, stateBytes: 16, flag, functions};
      end = at;
    }
  } else if (type === 6) {
    if (offset >= limit) throw new Error('Truncated native GPL boolean');
    const value = (await reader.bytes(offset, 1))[0];
    if (value > 1) throw new Error('Invalid native GPL boolean');
    details = {value: value === 1}; end += 1;
  } else if (type === 7) {
    details = {words: [await integer(reader, offset, limit), await integer(reader, offset + 4, limit)]};
    end += 8;
  } else throw new Error('Unsupported native GPL value type');
  yield {...context, path, type, kind: GPL_VALUE_KINDS[type], typeOffset, offset, size: end - typeOffset, ...details};
  return end;
}

export async function* checkpointAgentValues(source, agentId) {
  if (!Number.isInteger(agentId) || agentId <= 0 || agentId > 0x7fffffff)
    throw new Error('Invalid native GPL agent ID');
  const reader = new MetadataReader(source);
  let selected;
  // Validate the entire manager before yielding selected attribute values.
  for await (const record of agents(reader)) if (record.agentId === agentId) selected = record;
  if (!selected || selected.deleted) throw new Error('Missing or deleted native GPL agent');
  yield* agentValues(reader, selected);
}

// Original single-agent writer records used at a quiescent script boundary.
// This validates one bounded record, not manager queues or native ownership.
export async function checkpointAgentRecord(source) {
  if (!Number.isSafeInteger(source?.size) || source.size < 56 || source.size > 65536)
    throw new Error('Standalone native GPL record exceeds bound');
  const record = await gplAgentRecord(new MetadataReader(source), 0, source.size);
  if (record.size !== source.size) throw new Error('Trailing standalone native GPL bytes');
  return record;
}
export async function* checkpointAgentRecordValues(source) {
  const record = await checkpointAgentRecord(source);
  if (record.deleted) throw new Error('Deleted standalone native GPL agent');
  yield* agentValues(new MetadataReader(source), record);
}

async function* agentValues(reader, selected) {
  const attributes = selected.attributes, limit = attributes.offset + attributes.size - 8;
  let at = attributes.offset + 12;
  const budget = {count: 0};
  for (let i = 0; i < attributes.declaredCount; ++i) {
    const name = await gplName(reader, at, limit, true);
    at = yield* gplValue(reader, name.end, limit,
      {agentId: selected.agentId, attribute: name.value, attributeIndex: i}, [], budget);
  }
  if (at !== limit) throw new Error('Native GPL attribute count does not match its data');
}

// Exhaust one manager/typed traversal, retaining only references to one actor.
// Do not repeatedly rescan the entire manager once for every other agent.
// A result does not classify opaque native fields or qualify a whole handoff.
async function scanAgentReferences(source, targetAgentId, requireLiveTarget) {
  if (!Number.isInteger(targetAgentId) || targetAgentId <= 0 || targetAgentId > 0x7fffffff)
    throw new Error('Invalid incoming native GPL agent ID');
  const reader = new MetadataReader(source), sites = [];
  let values = 0, found = false, present = false;
  for await (const agent of agents(reader)) {
    if (agent.agentId === targetAgentId) {present = true; if (!agent.deleted) found = true;}
    const pending = new Map();
    for await (const value of agentValues(reader, agent)) {
      if (++values > MAX_GPL_VALUE_RECORDS) throw new Error('Incoming native GPL traversal budget exceeded');
      if (value.type === 5 && value.targetAgentId === targetAgentId) {
        if (sites.length === MAX_GPL_REFERENCE_SITES) throw new Error('Too many incoming native GPL references');
        const site = {agentId: agent.agentId, unitId: agent.unitId, deleted: agent.deleted,
          attribute: value.attribute, attributeIndex: value.attributeIndex,
          path: value.path, offset: value.offset, before: value.bits, rootType: null};
        sites.push(site);
        if (!pending.has(value.attributeIndex)) pending.set(value.attributeIndex, []);
        pending.get(value.attributeIndex).push(site);
      }
      // Lists/contexts yield their children before their own root record.
      if (!value.path.length) for (const site of pending.get(value.attributeIndex) ?? []) {
        site.rootType = value.type;
        if (value.type === 4) site.rootChildCount = value.childCount;
      }
    }
  }
  if (requireLiveTarget && !found) throw new Error('Missing or deleted incoming native GPL target');
  if (!requireLiveTarget && present) throw new Error('Expected absent native GPL target');
  return {targetAgentId, sites, valuesScanned: values};
}
export async function checkpointIncomingAgentReferences(source, targetAgentId) {
  return scanAgentReferences(source, targetAgentId, true);
}
// After original retirement, exhaust the whole manager once to locate dangling
// typed references. Refuse a remaining target record, including tombstones.
export async function checkpointAbsentAgentReferences(source, targetAgentId) {
  return scanAgentReferences(source, targetAgentId, false);
}

// Checked edit plan only: no source writes or engine allocation/activation.
// Exhaust typed traversal before publishing. Resolve every positive reference;
// preserve sentinel IDs, integers, float bits and context/coordinate words.
export async function checkpointAgentReferencePlan(source, agentId, resolveAgentId) {
  if (typeof resolveAgentId !== 'function') throw new Error('Native GPL reference resolver required');
  const patches = [], bindings = new Map();
  for await (const record of checkpointAgentValues(source, agentId)) {
    if (record.type !== 5 || record.targetAgentId === null) continue;
    if (patches.length >= MAX_GPL_REFERENCE_SITES) throw new Error('Too many native GPL reference sites');
    patches.push({offset: record.offset, before: record.bits,
      attribute: record.attribute, attributeIndex: record.attributeIndex, path: record.path});
  }
  // Validate the full typed range before consulting destination bindings.
  // The resolver must look up reserved IDs; it must not allocate live actors.
  for (const patch of patches) {
    const target = bindings.has(patch.before) ? bindings.get(patch.before) : await resolveAgentId(patch.before);
    if (!Number.isInteger(target) || target <= 0 || target > 0x7fffffff)
      throw new Error('Unresolved native GPL script reference');
    bindings.set(patch.before, target);
    patch.after = target;
  }
  // Keep the wire-plan property order stable for evidence consumers.
  return patches.map(({offset,before,after,attribute,attributeIndex,path})=>
    ({offset,before,after,attribute,attributeIndex,path}));
}

export async function* checkpointUnitAgentLinks(source) {
  const reader = new MetadataReader(source);
  for await (const unit of units(reader)) {
    const primary = unit.components.find(part => part.tag === 'PRIM');
    if (primary.size < 60) throw new Error('Truncated native unit agent header');
    const payload = primary.offset + 16;
    const block = await integer(reader, payload + 48, primary.end);
    if (block > 1) throw new Error('Invalid native unit optional-state flag');
    let offset = payload + 60;
    if (block) {
      if (offset + 16 > primary.end || await integer(reader, offset, primary.end) !== 1)
        throw new Error('Unsupported native unit optional state');
      offset += 16;
    }
    if (await integer(reader, offset, primary.end) !== 1) throw new Error('Unsupported native unit attribute map');
    const count = await integer(reader, offset + 4, primary.end);
    offset += 8;
    if (count > MAX_UNIT_RECORDS || count * 8 > primary.end - offset)
      throw new Error('Invalid native unit attribute count');
    let previous = -1, agentId = 0;
    for (let i = 0; i < count; ++i, offset += 8) {
      const key = await integer(reader, offset, primary.end);
      const value = await integer(reader, offset + 4, primary.end);
      if (key <= previous) throw new Error('Invalid native unit attribute ordering');
      previous = key;
      // The original FindInventoryItem reads EA to construct a GPL agent.
      if (key === 0x4541) agentId = value;
    }
    yield {family: unit.family, unitId: unit.primary.words[1], agentId,
      description: unit.primary.description, playerNumber: unit.primary.words[5] | 0,
      parentUnitId: unit.primary.words[6], stateFlags: unit.primary.words[2],
      offset: unit.offset, size: unit.size};
  }
}

// Select exactly one native UNIT and its separate GPL record. Exhaust both
// iterators before exposing either range: a late invalid manager queue or
// duplicate unit must not publish a partially checked arrival package.
// These IDs remain scoped to the source checkpoint, not portable identity.
export async function checkpointActorRecords(source, unitId) {
  if (!Number.isInteger(unitId) || unitId <= 0 || unitId > 0xffffffff)
    throw new Error('Invalid native actor unit ID');
  let unit, agent;
  for await (const record of checkpointUnitAgentLinks(source)) {
    if (record.unitId !== unitId) continue;
    if (unit) throw new Error('Duplicate native actor unit ID');
    unit = record;
  }
  if (!unit || !unit.agentId) throw new Error('Native actor has no saved script agent');
  for await (const record of checkpointAgents(source)) if (record.agentId === unit.agentId) agent = record;
  if (!agent || agent.unitId !== unitId || agent.deleted)
    throw new Error('Native actor script association is missing, mismatched or deleted');
  return {unit, agent};
}

export function checkpointFile(file) {
  return {size: file.size, async readAt(offset, length) {
    return new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());
  }};
}
