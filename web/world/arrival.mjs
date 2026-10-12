// Read-only preparation for a native actor arriving in another world. This
// does not allocate an actor, edit a checkpoint, or commit a regional handoff.
import {CHECKPOINT_PAGE_BYTES, MAX_GPL_REFERENCE_SITES, checkpointActorRecords,
  checkpointAgentValues, checkpointAgents, checkpointUnitAgentLinks,
  checkpointUnits, checkpointAttachments, checkpointContainerEntries,
  checkpointInventory, checkpointIncomingAgentReferences} from './checkpoint.mjs';
import {checkpointEmptyActorOrders} from './orders.mjs';
import {checkpointActorOrderEntries} from './order-entries.mjs';
import {checkpointActorOrderCallbacks} from './order-callbacks.mjs';
import {checkpointActorOrderRestoreBounds} from './order-restore-bounds.mjs';
import {checkpointNewrecruitMarkerClockPlan} from './newrecruit-marker-clock.mjs';
import {checkpointHeroOrderArrivalPlan} from './hero-order-arrival.mjs';
import {compactConsumedHaloPathRecord} from './halo-order-compaction.mjs';
import {checkpointOutdoorHeroEffectClocks} from './hero-effect-clocks.mjs';
import {checkpointHaloCompanionOrderPlan,checkpointHaloAttachedOrderProfile} from './halo-companion-orders.mjs';
import {haloRegionLayout} from './halo-region-layout.mjs';
import {actorRegionCoordinates,actorRegionGridCells} from './actor-coordinates.mjs';
import {Sha256} from './sha256.mjs';
import {verifyEntityOwnership} from './entity-ownership.mjs';
import {registeredHeroRegions} from './entity-home-ownership.mjs';
import {checkpointSavedClock} from './saved-clock.mjs';

export const MAX_ARRIVAL_RECORD_BYTES = 64 * 1024;
export const MAX_ARRIVAL_CONTEXTS = 64;
export const MAX_ARRIVAL_ATTACHED_UNITS = 16;
export const MAX_ARRIVAL_TOTAL_RECORD_BYTES = 256 * 1024;
const positive = (value, maximum = 0x7fffffff) => Number.isInteger(value) && value > 0 && value <= maximum;
const clock = value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;

function contextClock({delay,stamp,flags,flag=0},sourceClockMs,destinationClockMs){
  if(flag)throw Error('Cannot transfer an executing function context');
  if(flags & 0xffffff7c)throw Error('Unsupported arrival context flags');
  const paused=Boolean(flags & 0x80),active=Boolean(flags & 0x7f);
  const elapsed=active&&!paused?(sourceClockMs-stamp)>>>0:null;
  const after=elapsed===null?stamp:(destinationClockMs-elapsed)>>>0;
  if(elapsed!==null&&(!stamp||!after||delay>0x7fffffff||elapsed>0x7fffffff))
    throw Error('Unsupported arrival clock or zero-stamp transition');
  return {paused,active,elapsed,after};
}

// At most64 contexts can exclude64 clocks. Choose the first ordinary50ms
// tick boundary after two startup ticks which preserves every nonzero stamp.
// This selects an initialization duration, never assigns the guest clock.
export function heroGenerationInitializationClock(contexts,sourceClockMs){
  if(!Array.isArray(contexts)||contexts.length>MAX_ARRIVAL_CONTEXTS||!clock(sourceClockMs)||!sourceClockMs)
    throw Error('Invalid generation scheduling contexts');
  for(const c of contexts){
    if(!c||![c.delay,c.stamp,c.flags,c.flag??0].every(clock)||(c.flag??0)>1)
      throw Error('Invalid generation scheduling context');
    // Use a destination outside the candidate range to validate source ages
    // without accidentally rejecting an otherwise admissible candidate.
    contextClock(c,sourceClockMs,0x80000000);
  }
  for(let ticks=2;ticks<=MAX_ARRIVAL_CONTEXTS+2;++ticks){
    const destinationClockMs=ticks*50;
    if(contexts.every(c=>!(c.flags&0x7f)||(c.flags&0x80)||
      ((sourceClockMs-c.stamp)>>>0)!==destinationClockMs))
      return Object.freeze({clock:destinationClockMs,ticks,contexts:contexts.length});
  }
  throw Error('No bounded generation initialization clock');
}

export async function checkpointHeroGenerationInitialization(source,unitId,sourceClockMs){
  if(await checkpointSavedClock(source)!==sourceClockMs)throw Error('Generation source clock differs from its checkpoint');
  const actor=await checkpointActorRecords(source,unitId),contexts=[];
  if(actor.agent.size>MAX_ARRIVAL_RECORD_BYTES)throw Error('Generation source agent exceeds its bound');
  for await(const value of checkpointAgentValues(source,actor.agent.agentId))if(value.type===8){
    if(contexts.length===MAX_ARRIVAL_CONTEXTS)throw Error('Too many arrival function contexts');
    const state=[];for(let i=0;i<4;++i)state.push(await word(source,value.stateOffset+i*4));
    contexts.push({delay:state[0],stamp:state[1],flags:state[2],flag:value.flag});
  }
  return heroGenerationInitializationClock(contexts,sourceClockMs);
}

async function word(source, offset) {
  // Keep even independent word reads inside the metadata reader's I/O bound.
  const bytes = await source.readAt(offset, 4);
  if (!(bytes instanceof Uint8Array) || bytes.length !== 4) throw new Error('Truncated arrival word');
  return new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
}
async function rangeDigest(source, range) {
  const hash = new Sha256();
  for (let at = 0; at < range.size; at += CHECKPOINT_PAGE_BYTES) {
    const length = Math.min(CHECKPOINT_PAGE_BYTES, range.size - at);
    const bytes = await source.readAt(range.offset + at, length);
    if (!(bytes instanceof Uint8Array) || bytes.length !== length) throw new Error('Truncated arrival record');
    hash.update(bytes);
  }
  return hash.hex();
}
async function compatibleUnits(source, destination, bindings, arriving, reservedIds) {
  const wantedSource = new Set(bindings.keys()), wantedDestination = new Set(bindings.values());
  const before = new Map(), after = new Map();
  for await (const unit of checkpointUnitAgentLinks(source)) if (wantedSource.has(unit.unitId)) {
    if (before.has(unit.unitId)) throw new Error('Duplicate source binding unit');
    before.set(unit.unitId, unit);
  }
  // Exhaust all groups, including ones after the last binding/collision.
  for await (const unit of checkpointUnitAgentLinks(destination)) {
    if (reservedIds.has(unit.unitId)) throw new Error('Arrival native ID is occupied');
    if (wantedDestination.has(unit.unitId)) {
      if (after.has(unit.unitId)) throw new Error('Duplicate destination binding unit');
      after.set(unit.unitId, unit);
    }
  }
  for (const [from, to] of bindings) {
    const a = before.get(from), b = after.get(to);
    if (!a || !b || a.family !== b.family || a.description !== b.description ||
        a.playerNumber !== b.playerNumber || a.playerNumber !== arriving.playerNumber ||
        (a.stateFlags & 4) || (b.stateFlags & 4))
      throw new Error('Missing or incompatible destination unit binding');
  }
  return {before, after};
}

// A physical child is a separate original UNIT, even when it has no GPL agent.
// Support a bounded star of scriptless children; never borrow a destination
// effect or silently drop a child. Deeper/scripted dependencies need a richer
// runtime transaction and remain unsupported here.
async function attachedUnits(source, unitId, proposals) {
  const selected = new Map(), children = new Set(), nested = new Set();
  for await (const unit of checkpointUnitAgentLinks(source)) {
    if (unit.parentUnitId === unitId) {
      if (children.has(unit.unitId)) throw new Error('Duplicate attached arrival unit');
      children.add(unit.unitId);
      if (children.size > MAX_ARRIVAL_ATTACHED_UNITS) throw new Error('Too many attached arrival units');
    }
    if (proposals.has(unit.unitId)) {
      if (selected.has(unit.unitId)) throw new Error('Duplicate attached arrival unit');
      selected.set(unit.unitId, unit);
    }
    if (proposals.has(unit.parentUnitId)) nested.add(unit.unitId);
  }
  if (nested.size || children.size !== proposals.size || [...children].some(id => !proposals.has(id)))
    throw new Error('Unresolved or nested attached arrival units');
  for (const unit of selected.values()) if (unit.family !== 'VHCL' || unit.agentId ||
      unit.parentUnitId !== unitId || (unit.stateFlags & 4) || unit.size > MAX_ARRIVAL_RECORD_BYTES)
    throw new Error('Arrival child requires a bounded scriptless vehicle attached to the actor');
  return selected;
}

// The caller must supply script-clock snapshots in milliseconds, not gameplay
// ticks or wall time, and explicit source -> destination native object bindings.
// IDs are only proposals until the engine reserves them in the destination.
async function actorArrivalPlan(source, destination, options, homeBinding = null) {
  const {unitId, freshUnitId, freshAgentId, unitBindings, sourceClockMs, destinationClockMs} = options ?? {};
  if (!positive(unitId, 0xffffffff) || !positive(freshUnitId) || !positive(freshAgentId) ||
      !clock(sourceClockMs) || !clock(destinationClockMs) || !Array.isArray(unitBindings) ||
      unitBindings.length > MAX_GPL_REFERENCE_SITES)
    throw new Error('Invalid actor arrival options');
  const halo=options.haloRegions;
  if(halo&&(!homeBinding||halo.version!=='halo-v1'||halo.sourceRegion!==homeBinding.sourceRegion||
    halo.destinationRegion!==homeBinding.destinationRegion))throw Error('Halo arrival requires selected registered regions');
  const from=halo?haloRegionLayout(halo.sourceRegion):null,to=halo?haloRegionLayout(halo.destinationRegion):null;
  if(halo&&Math.abs(from.native.originX-to.native.originX)+Math.abs(from.native.originY-to.native.originY)!==from.core.widthCells*32)
    throw Error('Halo arrival requires adjacent regions');
  const bindings = new Map(), targets = new Set();
  for (const binding of unitBindings) {
    if (!binding || !positive(binding.from, 0xffffffff) || !positive(binding.to, 0xffffffff) ||
        binding.from === unitId || binding.to === freshUnitId || bindings.has(binding.from) || targets.has(binding.to))
      throw new Error('Invalid or duplicate native arrival binding');
    bindings.set(binding.from, binding.to);
    targets.add(binding.to);
  }
  if(homeBinding&&([...bindings].some(([from,to])=>
    from===homeBinding.source.unitId||to===homeBinding.destination.unitId)||
    freshAgentId===homeBinding.destination.agentId))throw Error('Registered home cannot be rebound or borrowed');
  const children = new Map(), reservedIds = new Set([freshUnitId]);
  const childOptions = options.attachedUnitBindings ?? [];
  if (!Array.isArray(childOptions) || childOptions.length > MAX_ARRIVAL_ATTACHED_UNITS)
    throw new Error('Invalid attached arrival bindings');
  for (const binding of childOptions) {
    if (!binding || !positive(binding.from, 0xffffffff) || !positive(binding.to) ||
        binding.from === unitId || children.has(binding.from) || bindings.has(binding.from) ||
        reservedIds.has(binding.to) || targets.has(binding.to))
      throw new Error('Invalid or duplicate attached arrival binding');
    children.set(binding.from, binding.to); reservedIds.add(binding.to);
  }
  const actor = await checkpointActorRecords(source, unitId);
  if (actor.unit.family !== 'VHCL' || actor.unit.playerNumber !== 0 || (actor.unit.stateFlags & 4) ||
      actor.unit.parentUnitId === unitId ||
      actor.unit.size > MAX_ARRIVAL_RECORD_BYTES || actor.agent.size > MAX_ARRIVAL_RECORD_BYTES)
    throw new Error('Arrival requires a bounded living player vehicle');
  if(homeBinding&&actor.unit.parentUnitId)throw Error('Registered hero must leave its physical building before arrival');
  const childRecords = await attachedUnits(source, unitId, children);

  const references = [], contexts = [], functions = new Set();
  // Exhaust the entire typed record before exposing a partial edit plan.
  for await (const value of checkpointAgentValues(source, actor.agent.agentId)) {
    if (value.type === 5 && value.targetAgentId !== null) {
      if (references.length === MAX_GPL_REFERENCE_SITES) throw new Error('Too many arrival reference sites');
      references.push(value);
    } else if (value.type === 8) {
      if (contexts.length === MAX_ARRIVAL_CONTEXTS) throw new Error('Too many arrival function contexts');
      if (value.flag) throw new Error('Cannot transfer an executing function context');
      const state = [];
      for (let i = 0; i < 4; ++i) state.push(await word(source, value.stateOffset + i * 4));
      // These fields are raw DWORDs despite the original four-byte writer's
      // float-shaped signature. Scheduler 00639220 compares unsigned integers.
      const [delay, stamp, flags, remainder] = state;
      // Keep the same zero-sentinel and source-age rules as fresh generation.
      const {paused,active,after,elapsed}=contextClock({delay,stamp,flags,flag:value.flag},sourceClockMs,destinationClockMs);
      contexts.push({attribute: value.attribute, path: value.path,
        offset: value.stateOffset, delay, stamp, flags, remainder, paused, active, elapsed, after});
      for (const fn of value.functions) if (fn.name) functions.add(fn.name);
    }
  }

  const {before, after} = await compatibleUnits(source, destination, bindings, actor.unit, reservedIds);
  const sourceAgents = new Map(), destinationAgents = new Map();
  const sourceAgentIds = new Set([...before.values()].map(unit => unit.agentId));
  const destinationAgentIds = new Set([...after.values()].map(unit => unit.agentId));
  for await (const agent of checkpointAgents(source)) {
    if (children.has(agent.unitId)) throw new Error('Attached arrival unit has a saved script association');
    if (sourceAgentIds.has(agent.agentId)) sourceAgents.set(agent.agentId, agent);
  }
  for await (const agent of checkpointAgents(destination)) {
    if (agent.agentId === freshAgentId) throw new Error('Arrival script ID is occupied');
    if (destinationAgentIds.has(agent.agentId)) destinationAgents.set(agent.agentId, agent);
  }
  const agentBindings = new Map([[actor.agent.agentId, freshAgentId]]);
  if(homeBinding)agentBindings.set(homeBinding.source.agentId,homeBinding.destination.agentId);
  for (const [from, to] of bindings) {
    const a = before.get(from), b = after.get(to);
    const scriptA = sourceAgents.get(a.agentId), scriptB = destinationAgents.get(b.agentId);
    if (!scriptA || !scriptB || scriptA.unitId !== from || scriptB.unitId !== to || scriptA.deleted || scriptB.deleted)
      throw new Error('Destination binding has no valid bidirectional script association');
    if (agentBindings.has(a.agentId)||b.agentId===homeBinding?.destination.agentId) throw new Error('Ambiguous source script binding');
    agentBindings.set(a.agentId, b.agentId);
  }

  const edits = [], usedBindings = new Set();
  const usedChildren = new Set();
  const add = (record, offset, before, after, reason) => edits.push({record, offset, before, after, reason});
  const unitAfter = id => {
    if (id === unitId) return freshUnitId;
    if (children.has(id)) {usedChildren.add(id); return children.get(id);}
    if (!bindings.has(id)) throw new Error('Unresolved native arrival reference');
    usedBindings.add(id); return bindings.get(id);
  };
  for (const value of references) {
    if (!agentBindings.has(value.bits)) throw new Error('Unresolved arrival script reference');
    if (value.bits !== actor.agent.agentId&&value.bits!==homeBinding?.source.agentId) {
      const association = sourceAgents.get(value.bits);
      if (!association) throw new Error('Arrival script reference has no native binding');
      usedBindings.add(association.unitId);
    }
    add('agent', value.offset, value.bits, agentBindings.get(value.bits), `script:${value.attribute}`);
  }
  for (const ctx of contexts) if (ctx.after !== ctx.stamp)
    add('agent', ctx.offset + 4, ctx.stamp, ctx.after, `clock:${ctx.attribute}`);
  const sourceParent = actor.unit.parentUnitId, destinationParent = sourceParent ? unitAfter(sourceParent) : 0;

  let native;
  const childRanges = {}, attachments = [], attachedOrders = [], recordSha256 = {};
  let selectedBytes = actor.unit.size + actor.agent.size;
  const childRange = (key, offset, size) => {
    selectedBytes += size;
    if (selectedBytes > MAX_ARRIVAL_TOTAL_RECORD_BYTES)
      throw new Error('Arrival dependency records exceed the total byte budget');
    childRanges[key] = {offset, size};
  };
  for await (const record of checkpointUnits(source)) {
    const id = record.primary.words[1];
    if (id === unitId) native = record;
    if (!children.has(id)) continue;
    const key = `attached_${id}`, primary = record.components.find(part => part.tag === 'PRIM');
    childRange(key, record.offset, record.size);
    recordSha256[key] = await rangeDigest(source, childRanges[key]);
    add(key, primary.offset + 20, id, children.get(id), 'attached native identity');
    add(key, primary.offset + 40, unitId, freshUnitId, 'attached physical parent');
    attachments.push({...childRecords.get(id), freshUnitId: children.get(id), record: key});
  }
  const primary = native.components.find(part => part.tag === 'PRIM'), base = primary.offset + 16;
  add('unit', base + 4, unitId, freshUnitId, 'native identity');
  if (sourceParent) add('unit', base + 24, sourceParent, destinationParent, 'physical parent');
  // Find EA using the already validated ordered native attribute map.
  let at = base + 60 + (await word(source, base + 48) ? 16 : 0);
  const count = await word(source, at + 4); at += 8;
  for (let i = 0; i < count; ++i, at += 8) if (await word(source, at) === 0x4541)
    add('unit', at + 4, actor.agent.agentId, freshAgentId, 'native script association');
  // Agent own ID is followed by its bounded nul-terminated name and native ID.
  add('agent', actor.agent.offset + actor.agent.size - 20 - new TextEncoder().encode(actor.agent.name).length - 4,
    actor.agent.agentId, freshAgentId, 'script identity');
  add('agent', actor.agent.offset + actor.agent.size - 19, unitId, freshUnitId, 'script native association');

  const orders=homeBinding?await checkpointHeroOrderArrivalPlan(source,unitId,
    {sourceClockMs,destinationClockMs},homeBinding,unitAfter,halo):await checkpointEmptyActorOrders(source,unitId);
  if(orders)add('order',orders.attachment.offset,unitId,freshUnitId,'order identity');
  for(const patch of orders?.patches??[])
    add('order',patch.offset,patch.before,patch.after,'original hero order reference or dispatch age');
  const outdoorEffects=homeBinding&&!halo&&orders?.entries?.length&&children.size?
    await checkpointOutdoorHeroEffectClocks(source,unitId,{sourceClockMs,destinationClockMs}):null;
  let haloPlacement=null;
  if(halo){
    const position=await source.readAt(native.offset+60,12),pv=new DataView(position.buffer,position.byteOffset,12),
      fixed={x:pv.getInt32(0,true),y:pv.getInt32(4,true),z:pv.getInt32(8,true)},
      projected=actorRegionCoordinates(fixed,from.native,to.native),
      cells={x:await word(source,native.offset+72),y:await word(source,native.offset+76)},
      grid=actorRegionGridCells(cells,from.native,to.native);
    // The original grid setter (005ad470) stores an independent anchor;
    // moving units need not be in the cell obtained by flooring their pose.
    // Translate that saved anchor, already bounded in both regions above.
    // Original physical insertion must still qualify its destination footprint.
    for(const[at,before,after]of [[60,fixed.x,projected.fixed.x],[64,fixed.y,projected.fixed.y],
      [72,cells.x,grid.x],[76,cells.y,grid.y]])add('unit',native.offset+at,before>>>0,after>>>0,'halo:preserve global hero placement');
    let homeTask=false,homeTarget=false;
    if(homeBinding)
      for await(const v of checkpointAgentValues(source,actor.agent.agentId))if(!v.path.length){
        if(v.attribute.toLowerCase()==='taskname'&&v.type===3&&v.stringBytes===7)
          homeTask=new TextDecoder().decode(await source.readAt(v.offset,7))==='go_home';
        if(v.attribute.toLowerCase()==='target'&&v.type===5)homeTarget=v.targetAgentId===homeBinding.source.agentId;
      }
    const remoteHomeRequest=homeTask&&homeTarget;
    for await(const v of checkpointAgentValues(source,actor.agent.agentId))if(v.type===7&&!v.path.length&&v.attribute.toLowerCase()==='destination'){
      const fixed={x:(v.words[0]|0)*2048,y:(v.words[1]|0)*2048,z:0};
      // A returning hero's logical guild goal can lie outside the active
      // neighbor. Preserve that global request as a signed script point;
      // physical placement, anchors and native path banks remain bounded.
      let point;
      if(remoteHomeRequest){
        const home=haloRegionLayout(homeBinding.homeRegion);
        // Validate the goal in its registered guild's physical map even when
        // it is already outside the current region on a later leg.
        point=actorRegionCoordinates({x:fixed.x+(from.native.originX-home.native.originX)*2048,
          y:fixed.y+(from.native.originY-home.native.originY)*2048,z:0},home.native,home.native);
        point.world.x+=home.native.originX-to.native.originX;point.world.y+=home.native.originY-to.native.originY;
      }else point=actorRegionCoordinates(fixed,from.native,to.native);
      add('agent',v.offset,v.words[0],point.world.x>>>0,'halo:script destination x');
      add('agent',v.offset+4,v.words[1],point.world.y>>>0,'halo:script destination y');
    }
    for(const child of attachments){
      const key=child.record,range=childRanges[key],old={x:await word(source,range.offset+72),y:await word(source,range.offset+76)};
      if(old.x!==cells.x||old.y!==cells.y)throw Error('Halo attached effect navigation differs from parent');
      add(key,range.offset+72,old.x,grid.x,'halo:parent-derived effect nav x');
      add(key,range.offset+76,old.y,grid.y,'halo:parent-derived effect nav y');
    }
    haloPlacement={version:'halo-v1',sourceRegion:from.key,destinationRegion:to.key,
      sourceFixed:fixed,destinationFixed:projected.fixed,globalFixed:projected.globalFixed,
      sourceGrid:cells,destinationGrid:grid,navigationPolicy:'preserve-original-saved-anchor',relativeEffectPosesPreserved:true,
      remoteHomeDestinationPolicy:remoteHomeRequest?'preserve-global-home-request':'physical-overlap',
      remoteHomeRoutingRequired:remoteHomeRequest&&homeBinding.destination.kind==='proxy',nativeGroundQualified:false,destinationCollisionQualified:false};
  }
  let container;
  for await (const attachment of checkpointAttachments(source)) if (attachment.unitId === unitId) {
    if (attachment.kind === 'ORDR') continue; // Already fully checked above.
    if (container || attachment.size > MAX_ARRIVAL_RECORD_BYTES) throw new Error('Invalid or oversized arrival container');
    container = attachment;
  } else if (children.has(attachment.unitId)) {
    if (attachment.kind !== 'ORDR' || attachment.size > MAX_ARRIVAL_RECORD_BYTES)
      throw new Error('Attached arrival unit has unsupported container state');
    const id = attachment.unitId, key = `attached_order_${id}`;
    if (childRanges[key]) throw new Error('Duplicate attached arrival orders');
    const banks = [], entries = [];
    const child=childRecords.get(id),haloProfile=halo?await checkpointHaloAttachedOrderProfile(source,child):null;
    if(halo&&!haloProfile)throw Error('Unqualified halo arrival attached effect');
    for await (const row of checkpointActorOrderEntries(source, id)) {
      if (row.type === 'bank') banks.push({bank: row.bank, version: row.version, count: row.count});
      else if (row.type === 'entry') {
        // Retain the original marker and callback. Unequal clocks require the
        // independently qualified Newrecruit shape, checked after full parsing.
        if ((row.kind !== 5 && !((outdoorEffects||haloProfile) && row.kind === 9) &&
            !((haloProfile==='arb2-extended-marker'||haloProfile==='arb2-reward-1000')&&row.kind===13)) || (!homeBinding && sourceClockMs !== destinationClockMs))
          throw new Error('Attached arrival orders require marker commands and equal simulation clocks');
        entries.push({bank: row.bank, index: row.index, kind: row.kind, offset: row.offset, size: row.size});
      }
    }
    for await (const callback of checkpointActorOrderCallbacks(source, id)) if (callback.scriptId)
      throw new Error('Attached arrival order has an unresolved script callback');
    const haloClock=haloProfile?await checkpointHaloCompanionOrderPlan(source,id,haloProfile,{sourceClockMs,destinationClockMs}):null;
    const markerClock = haloClock?{...haloClock,effectSha256:await rangeDigest(source,childRanges[`attached_${id}`]),
      orderSha256:await rangeDigest(source,{offset:attachment.offset,size:attachment.size})}:outdoorEffects ? outdoorEffects.effects.find(e=>e.unitId===id)?.plan :
      sourceClockMs !== destinationClockMs ?
        await checkpointNewrecruitMarkerClockPlan(source, childRecords.get(id), {sourceClockMs, destinationClockMs}) : null;
    if(outdoorEffects&&!markerClock)throw Error('Missing qualified outdoor effect clock plan');
    for (const patch of markerClock?.patches ?? [])
      add(key, patch.offset, patch.before, patch.after, 'clock:original attached effect dispatch age');
    const allocation = await checkpointActorOrderRestoreBounds(source, id);
    childRange(key, attachment.offset, attachment.size);
    add(key, attachment.offset, id, children.get(id), 'attached order identity');
    // The complete small command is a copy precondition: a frame/lifetime or
    // callback change between planning and copying must invalidate preparation.
    recordSha256[key] = await rangeDigest(source, childRanges[key]);
    if (markerClock && (recordSha256[key] !== markerClock.orderSha256 ||
        recordSha256[`attached_${id}`] !== markerClock.effectSha256))
      throw Error('Cross-clock effect dependencies changed during planning');
    attachedOrders.push({unitId: id, freshUnitId: children.get(id), record: key, banks, entries,
      allocationRequestBytes: allocation.allocationRequestBytes,
      clockPolicy: haloClock?'original-halo-effect-preserve-dispatch-age':outdoorEffects ? 'original-outdoor-effect-preserve-dispatch-age' :
        markerClock ? 'original-newrecruit-preserve-dispatch-age' : 'same-clock-only',
      ...(markerClock ? {markerClock} : {}),
      completeOrderMigration: false});
  }
  if (container) add('container', container.offset, unitId, freshUnitId, 'container identity');
  const memberships = [], homeGroups = [], homeMembers = [];let homeNativeDeparture=null;
  let containerSites = 0;
  for await (const entry of checkpointContainerEntries(source)) {
    if (entry.unitId === unitId) {
      if (++containerSites > MAX_GPL_REFERENCE_SITES) throw new Error('Too many arrival container sites');
      if(homeBinding&&entry.groupKind===101) {
        if(entry.type==='group')homeGroups.push(entry);
        else homeMembers.push(entry);
        if(entry.type==='member')continue;
      }
      if (entry.type === 'group' && entry.groupOwnerUnitId)
        add('container', entry.offset + 12, entry.groupOwnerUnitId, unitAfter(entry.groupOwnerUnitId), 'container owner');
      else if (entry.type === 'member' && entry.targetUnitId) {
        if (children.has(entry.targetUnitId) && (entry.groupKind !== 1 || usedChildren.has(entry.targetUnitId)))
          throw new Error('Invalid attached arrival container membership');
        add('container', entry.offset, entry.targetUnitId, unitAfter(entry.targetUnitId), 'container member');
      }
    } else if (entry.type === 'member' && entry.targetUnitId === unitId) {
      if (memberships.length === MAX_GPL_REFERENCE_SITES) throw new Error('Too many reciprocal arrival memberships');
      if(homeBinding&&homeBinding.source.kind==='native'&&entry.unitId===homeBinding.source.unitId) {
        if(homeNativeDeparture||entry.groupKind!==100||entry.groupOwnerUnitId!==entry.unitId||entry.flags!==1)
          throw Error('Unsupported registered home reciprocal membership');
        homeNativeDeparture={sourceUnitId:entry.unitId,groupKind:100,sourceOffset:entry.offset,
          previousUnitId:unitId,flags:entry.flags};
        continue;
      }
      const destinationUnitId = unitAfter(entry.unitId);
      if (entry.groupOwnerUnitId !== entry.unitId) throw new Error('Unsupported reciprocal container owner');
      memberships.push({sourceUnitId: entry.unitId, destinationUnitId,
        sourceOffset: entry.offset, groupKind: entry.groupKind, flags: entry.flags});
    } else if (entry.type === 'member' && children.has(entry.targetUnitId)) {
      throw new Error('Attached arrival unit has an external container membership');
    }
  }
  const containerTransforms=[];
  if(homeBinding) {
    if(!container||homeGroups.length!==1||homeGroups[0].groupOwnerUnitId!==unitId||
       homeGroups[0].memberCount!==homeMembers.length)throw Error('Missing or ambiguous registered hero home container');
    const group=homeGroups[0],outward=homeBinding.source.kind==='native';
    if(outward?(homeMembers.length!==1||homeMembers[0].targetUnitId!==homeBinding.source.unitId||homeMembers[0].flags!==1):homeMembers.length!==0)
      throw Error('Unsupported registered hero home container membership');
    const inward=homeBinding.destination.kind==='native',delta=(Number(inward)-Number(outward))*8;
    if(delta){
      add('container',group.offset+4,group.memberCount,group.memberCount+delta/8,'home container member count');
      for(const at of [container.offset+8,container.primary.offset+4]) {
        const before=await word(source,at);add('container',at,before,before+delta,'home container record size');
      }
      containerTransforms.push({record:'container',offset:outward?homeMembers[0].offset:group.offset+16,
        removeBytes:outward?8:0,insertWords:inward?[homeBinding.destination.unitId,1]:[]});
    }
    if(Boolean(homeNativeDeparture)!==outward)throw Error('Registered native departure membership differs');
  }
  if (usedChildren.size !== children.size) throw new Error('Missing attached arrival container membership');
  for await (const item of checkpointInventory(source)) if (item.ownerUnitId === unitId || children.has(item.ownerUnitId))
    throw new Error('Arrival with quest inventory is not supported');
  if (usedBindings.size !== bindings.size) throw new Error('Unused native arrival binding');
  const neededGroups = new Set(memberships.map(member => `${member.destinationUnitId}:${member.groupKind}`));
  const destinationGroups = new Set();
  for await (const entry of checkpointContainerEntries(destination)) if (entry.type === 'group') {
    const key = `${entry.unitId}:${entry.groupKind}`;
    if (!neededGroups.has(key)) continue;
    if (entry.groupOwnerUnitId !== entry.unitId || destinationGroups.has(key))
      throw new Error('Invalid destination reciprocal container group');
    destinationGroups.add(key);
  }
  if (destinationGroups.size !== neededGroups.size)
    throw new Error('Missing destination reciprocal container group');

  // A guild's native member group is backed by a separate GPL list. Validate
  // both directions rather than exposing a valid-looking actor whose old ID
  // remains in another agent's script state. This is an original-runtime list
  // restoration obligation, not an in-place edit of the destination snapshot.
  const incoming = await checkpointIncomingAgentReferences(source, actor.agent.agentId);
  const reciprocalScriptMemberships = [], sourceListSites = new Set();let homeDeparture=null;
  for (const site of incoming.sites) {
    if (site.agentId === actor.agent.agentId) continue;
    if(homeBinding&&site.agentId===homeBinding.source.agentId) {
      if(homeBinding.source.kind!=='native'||homeDeparture||site.deleted||site.unitId!==homeBinding.source.unitId||
         site.attribute.toLowerCase()!=='members'||site.rootType!==4||site.path.length!==1)
        throw Error('Unresolved registered home incoming reference');
      homeDeparture={sourceUnitId:site.unitId,sourceAgentId:site.agentId,sourceAttribute:site.attribute,
        sourceIndex:site.path[0],sourceOffset:site.offset,sourceMemberCount:site.rootChildCount,
        previousAgentId:actor.agent.agentId};continue;
    }
    const bound = before.get(site.unitId);
    if (site.deleted || !bound || bound.agentId !== site.agentId ||
        site.rootType !== 4 || site.path.length !== 1 ||
        !memberships.some(member => member.sourceUnitId === site.unitId))
      throw new Error('Unresolved incoming arrival script reference');
    const key = `${site.agentId}:${site.attribute.toLowerCase()}`;
    if (sourceListSites.has(key)) throw new Error('Duplicate incoming arrival script membership');
    sourceListSites.add(key);
    const destinationAgentId = agentBindings.get(site.agentId);
    let list = null;
    for await (const value of checkpointAgentValues(destination, destinationAgentId)) {
      if (value.attribute.toLowerCase() !== site.attribute.toLowerCase()) continue;
      if (value.type === 5 && value.targetAgentId === freshAgentId)
        throw new Error('Destination script list already contains the proposed arrival ID');
      if (!value.path.length) {
        if (list || value.type !== 4) throw new Error('Invalid destination reciprocal script list');
        list = value;
      }
    }
    if (!list) throw new Error('Missing destination reciprocal script list');
    reciprocalScriptMemberships.push({sourceUnitId: site.unitId, sourceAgentId: site.agentId,
      sourceAttribute: site.attribute, sourceIndex: site.path[0], sourceOffset: site.offset,
      sourceMemberCount: site.rootChildCount, previousAgentId: actor.agent.agentId,
      destinationUnitId: bindings.get(site.unitId), destinationAgentId,
      destinationAttribute: list.attribute, destinationMemberCount: list.childCount,
      arrivingAgentId: freshAgentId});
  }
  if(homeBinding&&Boolean(homeDeparture)!==(homeBinding.source.kind==='native'))
    throw Error('Registered home departure membership differs');
  let homeScriptArrival=null;
  if(homeBinding?.destination.kind==='native') {
    for await(const v of checkpointAgentValues(destination,homeBinding.destination.agentId))
      if(v.attribute.toLowerCase()==='members') {
        if(v.type===5&&v.targetAgentId===freshAgentId)throw Error('Registered guild already contains proposed arrival agent');
        if(!v.path.length)homeScriptArrival={destinationUnitId:homeBinding.destination.unitId,
          destinationAgentId:homeBinding.destination.agentId,destinationAttribute:v.attribute,
          destinationMemberCount:v.childCount,arrivingAgentId:freshAgentId};
      }
    if(!homeScriptArrival)throw Error('Missing registered destination script roster');
    for await(const e of checkpointContainerEntries(destination))
      if(e.unitId===homeBinding.destination.unitId&&e.groupKind===100&&e.type==='member'&&e.targetUnitId===freshUnitId)
        throw Error('Registered guild already contains proposed arrival unit');
  }

  const ranges = {unit: {offset: actor.unit.offset, size: actor.unit.size},
    agent: {offset: actor.agent.offset, size: actor.agent.size},
    ...(container ? {container: {offset: container.offset, size: container.size}} : {}),
    ...(orders ? {order: {offset: orders.attachment.offset,size: orders.attachment.size}} : {}), ...childRanges};
  if (Object.values(ranges).reduce((total, range) => total + range.size, 0) > MAX_ARRIVAL_TOTAL_RECORD_BYTES)
    throw new Error('Arrival dependency records exceed the total byte budget');
  const transformedBytes=Object.values(ranges).reduce((total,range)=>total+range.size,0)+
    containerTransforms.reduce((total,t)=>total+t.insertWords.length*4-t.removeBytes,0);
  if(transformedBytes>MAX_ARRIVAL_TOTAL_RECORD_BYTES)throw Error('Transformed arrival dependencies exceed total byte budget');
  if(homeBinding)for(const [name,range] of Object.entries(ranges)) {
    const digest = await rangeDigest(source,range);
    if (recordSha256[name] && recordSha256[name] !== digest)
      throw Error('Arrival dependency record changed during planning');
    recordSha256[name] = digest;
  }
  // All edits must remain inside their selected record and match original bytes.
  for (const edit of edits) {
    const range = ranges[edit.record];
    if (!range || edit.offset < range.offset || edit.offset + 4 > range.offset + range.size ||
        await word(source, edit.offset) !== edit.before) throw new Error('Invalid arrival edit precondition');
  }
  return {version: homeBinding?2:1, unitId, agentId: actor.agent.agentId, freshUnitId, freshAgentId,
    sourceClockMs, destinationClockMs, sourceParent, destinationParent, ranges, edits,
    contexts, functions: [...functions], memberships,
    ...(reciprocalScriptMemberships.length ? {reciprocalScriptMemberships} : {}),
    incomingScriptReferenceSites: incoming.sites.length,
    ...(attachments.length ? {attachedUnits: attachments} : {}),
    ...(attachedOrders.length ? {attachedOrders} : {}),
    ...(orders?.entries?.length ? {heroOrders:orders,nativeActivationQualified:false} : {}),
    ...(outdoorEffects ? {outdoorEffects} : {}),
    ...(haloPlacement ? {haloPlacement} : {}),
    ...(attachments.length||homeBinding ? {recordSha256} : {}),
    ...(homeBinding?{registeredHome:{...homeBinding,scriptDeparture:homeDeparture,nativeDeparture:homeNativeDeparture,
      scriptArrival:homeScriptArrival,nativeArrival:homeBinding.destination.kind==='native'?
        {destinationUnitId:homeBinding.destination.unitId,groupKind:100,arrivingUnitId:freshUnitId,flags:1}:null,
      destinationNativeMembershipRequired:homeBinding.destination.kind==='native',
      nativeHomeProjectionQualified:false,continuousPositionQualified:false,heroCrossingQualified:false},containerTransforms}:{}),
    ...(orders ? {orderBanks:orders.banks,...(!orders.entries?.length?{preconditions:Array.from({length:6},(_,i)=>
      ({record:'order',offset:orders.attachment.primary.offset+16+i*4,before:i%2?0:1}))}:{})} : {}),
    limits: {recordBytes: MAX_ARRIVAL_RECORD_BYTES, pageBytes: CHECKPOINT_PAGE_BYTES,
      referenceSites: MAX_GPL_REFERENCE_SITES, functionContexts: MAX_ARRIVAL_CONTEXTS,
      attachedUnits: MAX_ARRIVAL_ATTACHED_UNITS, totalRecordBytes: MAX_ARRIVAL_TOTAL_RECORD_BYTES},
    requirements: ['reserve destination IDs', 'resolve symbolic functions and descriptions in the original runtime',
      'restore the destination container memberships',
      ...(homeBinding?['preserve the registered logical guild slot while removing outgoing local membership',
        'restore reciprocal native/GPL memberships only in the actual home region',
        'intercept remote go_home before original building use',
        'project seam position with global coordinates preserved before original import']:[]),
      ...(reciprocalScriptMemberships.length ? ['restore reciprocal script lists through the original runtime',
        'retain global guild roster and capacity across dormant regions'] : []),
      'finalize and schedule original actors',
      ...(orders?.entries?.length?['restore populated hero banks through the original factory while dispatch is held',
        'reconcile destination navigation before resuming original hero commands',
        ...orders.deferredNativeHomeReferences.map(site=>site.activationRequirement)]:
        orders?['restore the original empty order attachment']:[]),
      ...(attachments.length ? ['reserve attached-unit IDs and restore original physical/container links',
        'qualify attached-unit lifetime in the original destination runtime'] : []),
      ...(attachedOrders.length ? ['restore attached orders through the original factory and qualify marker callbacks'] : []),
      'commit destination arrival and source removal together']};
}

export function checkpointActorArrivalPlan(source,destination,options) {
  return actorArrivalPlan(source,destination,options);
}

// Explicit home-aware preparation. Ownership context must be bound to both
// stopped snapshots; the selected-store wrapper supplies that read scope.
export async function checkpointRegisteredHeroArrivalPlan(source,destination,options,context) {
  const captured=JSON.parse(JSON.stringify({options,context})),o=captured.options,c=captured.context;
  if(c.identity?.version!==2||![0,1].includes(c.ownerSide)||
     o.unitId!==c.aliases?.[c.ownerSide]?.unitId)throw Error('Invalid registered hero arrival context');
  const regions=registeredHeroRegions(c.regions??c.identity.regions);
  const inputs=c.ownerSide?[{source:destination},{source}]:[{source},{source:destination}];
  await verifyEntityOwnership(c.identity,c.aliases,c.referenceBindings,inputs,c.ownerSide,c.homeAliases,regions);
  const r=c.identity.registeredHome;
  return actorArrivalPlan(source,destination,o,{worldId:r.worldId,contentDigest:r.contentDigest,
    guildEntityId:r.guildEntityId,heroEntityId:c.identity.entityId,homeRegion:r.home.region,
    sourceRegion:regions[c.ownerSide],destinationRegion:regions[1-c.ownerSide],
    source:c.homeAliases[c.ownerSide],destination:c.homeAliases[1-c.ownerSide],occupiedSlots:r.members.length,
    ...(c.homeAliases[c.ownerSide].kind==='proxy'?{registeredNativeHomeUnitId:r.home.unitId}:{})});
}

// For stopped, immutable checkpoint snapshots only. These bounded buffers are
// preparation data, not a playable save or a promise of a completed transfer.
export async function prepareCheckpointActorArrival(source, destination, options) {
  return prepareArrivalRecords(source,await checkpointActorArrivalPlan(source,destination,options));
}
export async function prepareCheckpointRegisteredHeroArrival(source,destination,options,context) {
  return prepareArrivalRecords(source,await checkpointRegisteredHeroArrivalPlan(source,destination,options,context));
}
async function prepareArrivalRecords(source,plan) {
  const records = {};
  for (const [name, range] of Object.entries(plan.ranges)) {
    const data = new Uint8Array(range.size);
    for (let copied = 0; copied < data.length;) {
      const length = Math.min(CHECKPOINT_PAGE_BYTES, data.length - copied);
      const part = await source.readAt(range.offset + copied, length);
      if (!(part instanceof Uint8Array) || part.length !== length) throw new Error('Truncated arrival record');
      data.set(part, copied); copied += length;
    }
    if (plan.recordSha256?.[name] && new Sha256().update(data).hex() !== plan.recordSha256[name])
      throw new Error(plan.version===2?'Arrival dependency record changed after planning':'Attached arrival record changed after planning');
    const view = new DataView(data.buffer), seen = new Set();
    for(const check of plan.preconditions??[])if(check.record===name){
      const offset=check.offset-range.offset;
      if(offset<0||offset+4>data.length||view.getUint32(offset,true)!==check.before)
        throw new Error('Arrival order state changed after planning');
    }
    for (const edit of plan.edits) if (edit.record === name) {
      const offset = edit.offset - range.offset;
      if (seen.has(offset) || view.getUint32(offset, true) !== edit.before)
        throw new Error('Arrival record changed after planning');
      seen.add(offset); view.setUint32(offset, edit.after, true);
    }
    const transform=plan.containerTransforms?.find(t=>t.record===name);
    if(transform) {
      const at=transform.offset-range.offset,insert=new Uint8Array(transform.insertWords.length*4);
      const v=new DataView(insert.buffer);transform.insertWords.forEach((word,i)=>v.setUint32(i*4,word,true));
      if(at<0||at+transform.removeBytes>data.length)throw Error('Invalid home container transform');
      const output=new Uint8Array(data.length-transform.removeBytes+insert.length);
      if(output.length>MAX_ARRIVAL_RECORD_BYTES)throw Error('Transformed home container exceeds bound');
      output.set(data.subarray(0,at));output.set(insert,at);output.set(data.subarray(at+transform.removeBytes),at+insert.length);
      records[name]=output;
    } else records[name] = name==='order'&&plan.heroOrders?
      compactConsumedHaloPathRecord(data,plan.heroOrders.attachment,plan.heroOrders.haloNavigation):data;
  }
  return {plan, records};
}
