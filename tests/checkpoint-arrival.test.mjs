import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointFile, checkpointActorRecords, checkpointAgentValues,
  checkpointContainerEntries} from '../web/world/checkpoint.mjs';
import {checkpointActorArrivalPlan, prepareCheckpointActorArrival,
  MAX_ARRIVAL_CONTEXTS, MAX_ARRIVAL_RECORD_BYTES, MAX_ARRIVAL_ATTACHED_UNITS} from '../web/world/arrival.mjs';

const w = n => {const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b;};
const str = s => Buffer.from(s + '\0');
const env = (v, b) => Buffer.concat([w(b.length + 16), w(v), b, w(0), w(-1)]);
const chunk = (tag, b = Buffer.alloc(0), v = 0, count = 0) => Buffer.concat([
  Buffer.from(tag), w(b.length), w(v), w(count), b]);
const value = (type, ...b) => Buffer.concat([w(type), ...b]);
const ref = id => value(5, w(id));
function context({delay = 500, stamp = 3000, flags = 2, remainder = 0, running = 0, args = [ref(9)]} = {}) {
  return value(8, w(args.length), ...args, w(delay), w(stamp), w(flags), w(remainder),
    Buffer.from([running, 1]), str('Guard_Return_Home'), Buffer.from([0]));
}
function agent(id, uid, attrs, name = '') {
  return Buffer.concat([w(id), env(2, Buffer.concat([
    env(0, Buffer.concat([w(attrs.length), ...attrs.flatMap(([k, v]) => [str(k), v])])),
    w(0), w(id), str(name), w(uid), Buffer.from([0]), w(0), Buffer.from([0, 0])]))]);
}
function unit(id, gid, {description = 42, owner = 0, parent = 0, optional = false} = {}) {
  const head = Buffer.alloc(60);
  for (const [i, n] of [[0, 1], [1, id], [2, 514], [4, description], [5, owner], [6, parent],
    [7, 456 << 11], [8, 123 << 11], [12, Number(optional)], [13, 9]]) head.writeUInt32LE(n >>> 0, i * 4);
  const body = Buffer.concat([head, ...(optional ? [w(1), Buffer.alloc(12)] : []),
    w(1), w(2), w(0x4541), w(gid), w(0x5058), w(9), Buffer.alloc(8)]);
  return chunk('UNIT', chunk('PRIM', body, 9), 0, 1);
}
function container(id, groups) {
  const body = Buffer.concat([w(1), w(groups.length), ...groups.map(([kind, members]) => Buffer.concat([
    w(1), w(members.length), w(kind), w(id), ...members.flatMap(([target, flags = 1]) => [w(target), w(flags)])]))]);
  return Buffer.concat([w(id), chunk('CONT', chunk('PRIM', body, 1), 0, 1)]);
}
function save({destination = false, attrs, ctx, homeDescription = 77, owner = 0, bindingId,
  bindingAgent, name = '', padding = 0, extraUnits = 0, order = false, emptyOrders = false, inventory = false,
  containerTarget, groups, optional = false, badTail = false, children = [],
  childMembers = children.map(c => c.id), childOrder = null, homeAttrs = [], rootAttrs = []} = {}) {
  const uid = destination ? 536 : 506, gid = 9;
  const home = bindingId ?? (destination ? 531 : 502), homeGid = bindingAgent ?? (destination ? 6 : 7);
  const attributes = attrs ?? [['activescript', context(ctx)], ['home', ref(homeGid)], ['target', ref(homeGid)],
    ['ordinary', value(1, w(homeGid))], ['float', value(2, w(0x7fc00123))], ['sentinel', ref(-1)]];
  const agents = [agent(1, 0, rootAttrs), agent(homeGid, home, homeAttrs), agent(gid, uid, attributes, name)].sort((a, b) => a.readUInt32LE(0) - b.readUInt32LE(0));
  const manager = env(2, Buffer.concat([w(0), w(agents.length), ...agents,
    w(0), w(0), Buffer.from([badTail ? 2 : 0])]));
  const containers = [container(home, groups ?? [[100, [[uid]]], [2, [[uid]]]]),
    container(uid, [[101, [[containerTarget ?? home], [0, 0]]],
      ...(children.length ? [[1, childMembers.map(id => [id])]] : [])])];
  const global = Buffer.concat([Buffer.alloc(19 * 4), w(0), w(Number(inventory)),
    ...(inventory ? [w(123), w(uid)] : [])]);
  const orders = order || emptyOrders ? [Buffer.concat([w(uid), chunk('ORDR', chunk('PRIM',
    emptyOrders ? Buffer.concat([w(1), w(0), w(1), w(0), w(1), w(0)]) : Buffer.alloc(4), 2), 0, 1)])] : [];
  if (childOrder) orders.push(Buffer.concat([w(children[0].id), chunk('ORDR', chunk('PRIM', childOrder, 2), 0, 1)]));
  return Buffer.concat([chunk('VERS', Buffer.alloc(256), 1), chunk('MTER', Buffer.alloc(padding)),
    chunk('GPL ', env(3, Buffer.concat([w(0), manager, w(10)])), 1),
    chunk('BLDG', unit(home, homeGid, {description: homeDescription, owner}), 0, 1),
    chunk('VHCL', Buffer.concat([unit(uid, gid, {parent: home, optional}),
      ...children.map(c => unit(c.id, c.agentId ?? 0, {parent: c.parent ?? uid, description: 0x33485241})),
      ...Array.from({length: extraUnits}, (_, i) => unit(10000 + i, 0))]), 0, 1 + extraUnits + children.length),
    ...['GRND', 'RWRD', 'MSGF', 'OFMP'].map(tag => chunk(tag)),
    chunk('ORDR', Buffer.concat(orders), 1, orders.length),
    chunk('CONT', Buffer.concat(containers), 1, containers.length), chunk('GSGL', global, 6)]);
}
function source(data) {
  let reads = 0, readBytes = 0, largestRead = 0, inFlight = 0, peak = 0;
  return {size: data.length, stats: () => ({reads, readBytes, largestRead, peak}),
    async readAt(at, n) {
      assert(n <= 4096); assert(at >= 0 && at + n <= data.length);
      reads++; readBytes += n; largestRead = Math.max(largestRead, n); peak = Math.max(peak, ++inFlight);
      await Promise.resolve(); --inFlight; return data.subarray(at, at + n);
    }};
}
const opts = {unitId: 506, freshUnitId: 100000, freshAgentId: 1000,
  unitBindings: [{from: 502, to: 531}], sourceClockMs: 3200, destinationClockMs: 9000};
const prepare = (a = save(), b = save({destination: true}), o = opts) =>
  prepareCheckpointActorArrival(source(a), source(b), o);
// The original unsigned scheduler comparison, independently of the planner.
const due = (clock, stamp, delay) => ((clock - stamp) >>> 0) >= delay;

test('different worlds bind script, physical and container references; equal numeric IDs are not borrowed', async () => {
  const a = save(), b = save({destination: true}), originals = [Buffer.from(a), Buffer.from(b)];
  const {plan, records} = await prepare(a, b);
  assert.equal(plan.destinationParent, 531);
  assert.deepEqual(plan.edits.filter(e => e.reason === 'script:home' || e.reason === 'script:target').map(e => [e.before, e.after]), [[7, 6], [7, 6]]);
  assert.deepEqual(plan.memberships.map(m => [m.sourceUnitId, m.destinationUnitId, m.groupKind]), [[502, 531, 100], [502, 531, 2]]);
  for (const [key, range] of Object.entries(plan.ranges)) {
    const expected = Buffer.from(a.subarray(range.offset, range.offset + range.size));
    for (const edit of plan.edits.filter(e => e.record === key)) {
      assert.equal(expected.readUInt32LE(edit.offset - range.offset), edit.before);
      expected.writeUInt32LE(edit.after, edit.offset - range.offset);
    }
    assert.deepEqual(Buffer.from(records[key]), expected);
    assert(records[key].length <= MAX_ARRIVAL_RECORD_BYTES);
  }
  assert.deepEqual([a, b], originals);
  assert(plan.requirements.includes('commit destination arrival and source removal together'));
});

test('rebased active timer fires after exactly the same remaining simulation time', async () => {
  const {plan} = await prepare();
  const ctx = plan.contexts[0]; assert.equal(ctx.after, 8800); assert.equal(ctx.elapsed, 200);
  for (let delta = 0; delta <= 1000; ++delta)
    assert.equal(due(opts.sourceClockMs + delta, ctx.stamp, ctx.delay), due(opts.destinationClockMs + delta, ctx.after, ctx.delay));
  assert(!due(9299, ctx.after, ctx.delay)); assert(due(9300, ctx.after, ctx.delay));
});

test('unsigned wrap and already overdue contexts preserve scheduler eligibility and lateness', async () => {
  for (const [stamp, src, dest] of [[0xfffffff0, 20, 200], [3000, 3900, 5000], [3000, 3200, 20]]) {
    const {plan} = await prepare(save({ctx: {stamp}}), undefined, {...opts, sourceClockMs: src, destinationClockMs: dest});
    const ctx = plan.contexts[0];
    for (let delta = 0; delta < 1000; ++delta)
      assert.equal(((src + delta - stamp) >>> 0), ((dest + delta - ctx.after) >>> 0));
    assert.equal(due(src, stamp, ctx.delay), due(dest, ctx.after, ctx.delay));
  }
});

test('paused remainder survives unchanged, and original resume retains its remaining delay', async () => {
  const a = save({ctx: {flags: 130, remainder: 375}}), {plan, records} = await prepare(a);
  const ctx = plan.contexts[0], original = a.subarray(ctx.offset, ctx.offset + 16);
  assert.deepEqual(Buffer.from(records.agent.subarray(ctx.offset - plan.ranges.agent.offset, ctx.offset - plan.ranges.agent.offset + 16)), original);
  assert.equal(ctx.after, ctx.stamp); assert.equal(ctx.elapsed, null);
  const resumedStamp = (opts.destinationClockMs - ctx.delay + ctx.remainder) >>> 0;
  assert(!due(opts.destinationClockMs + 374, resumedStamp, ctx.delay));
  assert(due(opts.destinationClockMs + 375, resumedStamp, ctx.delay));
  assert(!plan.edits.some(e => e.reason.startsWith('clock:')));
});

test('inactive contexts, ordinary integers, float NaN bits and sentinel references are preserved', async () => {
  const a = save({ctx: {flags: 0, stamp: 0}}), {plan, records} = await prepare(a);
  assert(!plan.edits.some(e => e.reason.startsWith('clock:')));
  const agent = await checkpointActorRecords(source(a), 506);
  for await (const v of checkpointAgentValues(source(a), agent.agent.agentId)) if (['ordinary', 'float', 'sentinel'].includes(v.attribute))
    assert.equal(new DataView(records.agent.buffer).getUint32(v.offset - agent.agent.offset, true), v.bits);
});

test('fresh native/script identities must be unoccupied in the entire destination', async () => {
  for (const overrides of [{freshUnitId: 536}, {freshUnitId: 531}, {freshAgentId: 9}, {freshAgentId: 6}, {freshAgentId: 1}])
    await assert.rejects(prepare(undefined, undefined, {...opts, ...overrides}), /occupied|binding/);
});

test('missing, duplicate, mismatched and unused home bindings fail before a package is exposed', async () => {
  await assert.rejects(prepare(undefined, undefined, {...opts, unitBindings: []}), /Unresolved/);
  for (const to of [502, 536, 0]) await assert.rejects(prepare(undefined, undefined, {...opts, unitBindings: [{from: 502, to}]}));
  for (const b of [save({destination: true, homeDescription: 78}), save({destination: true, owner: 7})])
    await assert.rejects(prepare(undefined, b), /incompatible/);
  for (const unitBindings of [[{from: 502, to: 531}, {from: 502, to: 536}], [{from: 502, to: 531}, {from: 506, to: 531}]])
    await assert.rejects(prepare(undefined, undefined, {...opts, unitBindings}), /binding/);
  await assert.rejects(prepare(save({containerTarget: 888})), /native arrival reference/);
});

test('container groups at the destination must exist and agree with reciprocal ownership', async () => {
  await assert.rejects(prepare(undefined, save({destination: true, groups: [[100, []]]})), /reciprocal container group/);
  await assert.rejects(prepare(undefined, save({destination: true, groups: [[100, []], [100, []], [2, []]]})), /reciprocal container group/);
});

test('orders and quest inventory refuse partial migration', async () => {
  await assert.rejects(prepare(save({order: true})), /orders/);
  await assert.rejects(prepare(save({inventory: true})), /inventory/);
});

test('empty native orders preserve all three banks and change only their actor identity',async()=>{
  const original=save({emptyOrders:true}),{plan,records}=await prepare(original);
  assert.deepEqual(plan.orderBanks,[0,1,2].map(bank=>({bank,version:1,count:0})));
  assert.equal(records.order.length,60);assert.equal(new DataView(records.order.buffer).getUint32(0,true),opts.freshUnitId);
  const range=plan.ranges.order;
  assert.deepEqual(records.order.subarray(4),Uint8Array.from(original.subarray(range.offset+4,range.offset+range.size)));
  assert.deepEqual(plan.edits.filter(edit=>edit.record==='order'),[
    {record:'order',offset:range.offset,before:506,after:100000,reason:'order identity'}]);
  assert.equal(plan.preconditions.length,6);assert.ok(plan.requirements.includes('restore the original empty order attachment'));
});

test('an order bank changing after planning is rejected before prepared records escape',async()=>{
  const data=save({emptyOrders:true}),normal=source(data),destination=source(save({destination:true}));
  const initial=await checkpointActorArrivalPlan(normal,destination,opts),range=initial.ranges.order;
  const changed={size:data.length,async readAt(at,n){
    const bytes=await normal.readAt(at,n);
    if(at!==range.offset||n!==range.size)return bytes;
    const copy=Uint8Array.from(bytes);new DataView(copy.buffer).setUint32(40,1,true);return copy;
  }};
  await assert.rejects(prepareCheckpointActorArrival(changed,destination,opts),/order state changed/);
});

test('executing, unknown, future, ambiguous and zero-sentinel clocks fail closed', async () => {
  for (const ctx of [{running: 1}, {flags: 4}, {stamp: 3500}, {delay: 0x80000000}, {stamp: 0}])
    await assert.rejects(prepare(save({ctx})), /context|clock|stamp/);
  await assert.rejects(prepare(undefined, undefined, {...opts, destinationClockMs: 200}), /zero-stamp/);
  for (const bad of [-1, 0x100000000, 1.5, '3200', undefined])
    await assert.rejects(prepare(undefined, undefined, {...opts, sourceClockMs: bad}), /options/);
});

test('late source and destination manager corruption cannot publish valid-looking earlier records', async () => {
  await assert.rejects(prepare(save({badTail: true})), /manager/);
  await assert.rejects(prepare(undefined, save({destination: true, badTail: true})), /manager/);
  const data = save(), selected = await checkpointActorRecords(source(data), 506);
  const bad = Buffer.from(data);
  // Keep envelopes valid but corrupt the last attribute's type.
  for await (const v of checkpointAgentValues(source(data), 9)) if (v.attribute === 'sentinel') bad.writeUInt32LE(99, v.typeOffset);
  await assert.rejects(prepare(bad), /type/);
  assert(selected.agent.size > 0);
});

test('fixed context/record bounds and changed copy preconditions refuse publication', async () => {
  const attrs = Array.from({length: MAX_ARRIVAL_CONTEXTS + 1}, (_, i) => [`f${i}`, context({flags: 0})]);
  await assert.rejects(prepare(save({attrs})), /contexts/);
  const large = save({attrs: [['large', value(3, str('x'.repeat(MAX_ARRIVAL_RECORD_BYTES)))]]});
  await assert.rejects(prepare(large), /bounded/);
  const data = save(), normal = source(data), first = await checkpointActorArrivalPlan(normal, source(save({destination: true})), opts);
  const nativeRange = first.ranges.unit;
  const changed = {size: data.length, async readAt(at, n) {
    const bytes = Uint8Array.from(await normal.readAt(at, n));
    if (at === nativeRange.offset && n === nativeRange.size) bytes[36] ^= 1;
    return bytes;
  }};
  await assert.rejects(prepareCheckpointActorArrival(changed, source(save({destination: true})), opts), /changed/);
});

test('optional state and multibyte agent names produce checked identity locations', async () => {
  const data = save({optional: true, name: 'Éowyn'}), {plan} = await prepare(data);
  assert.equal(plan.edits.find(e => e.reason === 'native script association').before, 9);
  const idEdit = plan.edits.find(e => e.reason === 'script identity');
  assert.equal(data.readUInt32LE(idEdit.offset), 9);
  const blobPlan = await checkpointActorArrivalPlan(checkpointFile(new Blob([data])), checkpointFile(new Blob([save({destination: true})])), opts);
  assert.deepEqual(blobPlan, plan);
});

test('large dormant terrain and many units do not become capsule buffers or retained world arrays', async () => {
  const a = source(save({padding: 1024 * 1024, extraUnits: 1500})), b = source(save({destination: true, padding: 1024 * 1024, extraUnits: 1500}));
  const {plan, records} = await prepareCheckpointActorArrival(a, b, opts);
  assert.equal(Object.keys(records).length, 3); assert.equal(plan.memberships.length, 2);
  assert(Object.values(records).reduce((total, data) => total + data.length, 0) < 4096);
  for (const input of [a, b]) {assert.equal(input.stats().peak, 1); assert(input.stats().largestRead <= 4096);}
  const entries = await Array.fromAsync(checkpointContainerEntries(source(save())));
  assert.equal(entries.filter(e => e.unitId === 506 && e.type === 'member').length, 2);
});

const childOpts = {...opts, destinationClockMs: opts.sourceClockMs,
  attachedUnitBindings: [{from: 507, to: 100001}]};
// Original stopped recruitment capture: three banks and a marker command,
// including its nonzero native callback, dispatch stamp and opaque frame data.
function markerOrders({scriptId = 0, kind = 5} = {}) {
  const body = Buffer.alloc(176);
  for (const [i, n] of [[0, 1], [1, 1], [2, 2], [3, kind], [4, 100], [5, 25800],
    [6, 100], [10, 4101], [11, scriptId], [24, 336], [28, 1]]) body.writeUInt32LE(n, i * 4);
  return Buffer.concat([w(1), w(0), w(1), w(1), w(1), w(kind), body, w(1), w(0)]);
}

test('physical effect and populated marker orders remain separate records with their lifetime state intact', async () => {
  const a = save({children: [{id: 507}], childOrder: markerOrders()}), before = Buffer.from(a);
  const input = source(a), target = source(save({destination: true}));
  const {plan, records} = await prepareCheckpointActorArrival(input, target, childOpts);
  const effect = Buffer.from(a.subarray(plan.ranges.attached_507.offset,
    plan.ranges.attached_507.offset + plan.ranges.attached_507.size));
  // UNIT header (16) + PRIM header (16): id at payload+4, parent at payload+24.
  effect.writeUInt32LE(100001, 36); effect.writeUInt32LE(100000, 56);
  assert.deepEqual(Buffer.from(records.attached_507), effect);
  const orderRange = plan.ranges.attached_order_507;
  assert.equal(new DataView(records.attached_order_507.buffer).getUint32(0, true), 100001);
  assert.deepEqual(Buffer.from(records.attached_order_507.subarray(4)),
    a.subarray(orderRange.offset + 4, orderRange.offset + orderRange.size));
  assert.equal(plan.attachedOrders[0].entries[0].kind, 5);
  assert.equal(plan.attachedOrders[0].completeOrderMigration, false);
  assert.equal(plan.attachedOrders[0].allocationRequestBytes, 202);
  assert.equal(plan.attachedUnits[0].parentUnitId, 506);
  assert.equal(plan.edits.find(e => e.reason === 'script:home').after, 6);
  assert.equal(plan.edits.find(e => e.before === 507 && e.reason === 'container member').after, 100001);
  assert.deepEqual(a, before);
  for (const s of [input, target]) {assert.ok(s.stats().largestRead <= 4096); assert.equal(s.stats().peak, 1);}
});

test('omitted, duplicated, nested, scripted or occupied effects refuse a partial hero package', async () => {
  const a = save({children: [{id: 507}]});
  await assert.rejects(prepare(a), /attached arrival/);
  for (const attachedUnitBindings of [[{from: 507, to: 536}], [{from: 507, to: 100000}],
    [{from: 507, to: 100001}, {from: 507, to: 100002}], [{from: 507, to: 531}]])
    await assert.rejects(prepare(a, undefined, {...childOpts, attachedUnitBindings}), /occupied|binding/);
  await assert.rejects(prepare(save({children: [{id: 507, agentId: 12}]}), undefined, childOpts), /scriptless/);
  await assert.rejects(prepare(save({children: [{id: 507}, {id: 508, parent: 507}]}), undefined,
    {...childOpts, attachedUnitBindings: [{from: 507, to: 100001}, {from: 508, to: 100002}]}), /nested/);
  const children = Array.from({length: MAX_ARRIVAL_ATTACHED_UNITS + 1}, (_, i) => ({id: 507 + i}));
  await assert.rejects(prepare(save({children}), undefined, {...childOpts, attachedUnitBindings:
    children.map((c, i) => ({from: c.id, to: 100001 + i}))}), /attached arrival/);
});

test('effect membership must be unique, complete and owned by the hero', async () => {
  for (const childMembers of [[], [507, 507]])
    await assert.rejects(prepare(save({children: [{id: 507}], childMembers}), undefined, childOpts), /container membership/);
  await assert.rejects(prepare(save({children: [{id: 507}], groups: [[100, [[506], [507]]], [2, [[506]]]]}),
    undefined, childOpts), /external container membership/);
});

test('populated effect commands cannot silently cross clocks or retain unresolved script callbacks', async () => {
  const a = save({children: [{id: 507}], childOrder: markerOrders()});
  await assert.rejects(prepare(a, undefined, {...childOpts, destinationClockMs: 9000}), /equal simulation clocks/);
  await assert.rejects(prepare(save({children: [{id: 507}], childOrder: markerOrders({scriptId: 7})}),
    undefined, childOpts), /script callback/);
  await assert.rejects(prepare(save({children: [{id: 507}], childOrder: markerOrders({kind: 123})}),
    undefined, childOpts), /order kind/);
});

test('effect frame and command changes between planning and copying invalidate the whole package', async () => {
  const data = save({children: [{id: 507}], childOrder: markerOrders()});
  const first = await checkpointActorArrivalPlan(source(data), source(save({destination: true})), childOpts);
  for (const name of ['attached_507', 'attached_order_507']) {
    const range = first.ranges[name], normal = source(data);
    // Each record fits one page. Its first complete read is the planning hash,
    // and its second is the prepared copy; changing a non-ID word must fail.
    let copies = 0;
    const changed = {size: data.length, async readAt(at, n) {
      const bytes = await normal.readAt(at, n);
      if (at !== range.offset || n !== range.size || ++copies < 2) return bytes;
      const copy = Uint8Array.from(bytes); copy[copy.length - 1] ^= 1; return copy;
    }};
    await assert.rejects(prepareCheckpointActorArrival(changed, source(save({destination: true})), childOpts),
      /Attached arrival record changed/);
  }
});

const members = ids => value(4, env(0, Buffer.concat([w(ids.length), ...ids.map(ref)])));
test('native guild membership retains its independent script-list restoration obligation', async () => {
  const a = save({homeAttrs: [['members', members([9])]]});
  const b = save({destination: true, homeAttrs: [['Members', members([9])]]});
  const {plan} = await prepare(a, b);
  assert.equal(plan.incomingScriptReferenceSites, 2); // Guild list plus the actor's context argument.
  const [membership] = plan.reciprocalScriptMemberships;
  assert.deepEqual({...membership, sourceOffset: 0}, {sourceUnitId: 502, sourceAgentId: 7,
    sourceAttribute: 'members', sourceIndex: 0, sourceOffset: 0, sourceMemberCount: 1,
    previousAgentId: 9, destinationUnitId: 531, destinationAgentId: 6,
    destinationAttribute: 'Members', destinationMemberCount: 1, arrivingAgentId: 1000});
  assert.equal(a.readUInt32LE(membership.sourceOffset), 9);
  assert.ok(plan.requirements.includes('retain global guild roster and capacity across dormant regions'));
  assert.equal(plan.edits.some(edit => edit.offset === membership.sourceOffset), false);
});

test('missing, duplicate and dangling destination guild script lists cannot expose an actor package', async () => {
  const a = save({homeAttrs: [['members', members([9])]]});
  for (const homeAttrs of [[], [['members', ref(9)]], [['members', members([1000])]],
    [['members', members([])], ['Members', members([])]]])
    await assert.rejects(prepare(a, save({destination: true, homeAttrs})), /reciprocal script list|proposed arrival ID/);
  await assert.rejects(prepare(save({homeAttrs: [['members', members([9, 9])]]}),
    save({destination: true, homeAttrs: [['members', members([])]]})), /Duplicate incoming/);
});

test('unbound, scalar, nested and nonreciprocal incoming references cannot be left behind on departure', async () => {
  const b = save({destination: true, homeAttrs: [['members', members([])]]});
  for (const a of [save({rootAttrs: [['questTarget', ref(9)]]}),
    save({homeAttrs: [['target', ref(9)]]}),
    save({homeAttrs: [['members', value(4, env(0, Buffer.concat([w(1), members([9])])) )]]}),
    save({homeAttrs: [['members', members([9])]], groups: []})])
    await assert.rejects(prepare(a, b), /Unresolved incoming arrival script reference/);
});
