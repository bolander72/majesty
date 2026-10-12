// Only Queue kind7 with original cProc4099 gives userData a UNIT-ID role.
// Arbitrary userData remains opaque; this is not dormant guild activation.
import {checkpointActorOrderEntries} from './order-entries.mjs';
export const MAX_QUEUE_ENTRY_TARGET_SITES = 128;

export async function checkpointQueueEntryTargetPlan(source, unitId, resolveUnitId) {
  if (typeof resolveUnitId !== 'function') throw Error('Queue entry target resolver required');
  const sites = [];
  for await (const entry of checkpointActorOrderEntries(source, unitId)) {
    if (entry.type !== 'entry' || entry.kind !== 7 || entry.words[10] !== 4099) continue;
    if (entry.words[11] !== 0 || entry.words.slice(12, 24).some(word => word !== 0))
      throw Error('Unqualified queue entry callback state');
    if (entry.words[9] === 0) continue;
    if (sites.length >= MAX_QUEUE_ENTRY_TARGET_SITES) throw Error('Queue entry target budget exceeded');
    sites.push({offset: entry.offset + 36, size: 4, before: entry.words[9],
      bank: entry.bank, index: entry.index, kind: 7, field: '_userData', cProcId: 4099});
  }
  const bindings = new Map(), destinations = new Map(), patches = [];
  // A resolver must look up an already reserved native UNIT. A pure GPL home
  // proxy (native ID0) cannot stand in for the building the callback enters.
  for (const site of sites) {
    let after = bindings.get(site.before);
    if (after === undefined) {
      after = await resolveUnitId(site.before);
      if (!Number.isInteger(after) || after <= 0 || after > 0xffffffff)
        throw Error('Unresolved native queue entry building');
      if (destinations.has(after) && destinations.get(after) !== site.before)
        throw Error('Ambiguous native queue entry target');
      bindings.set(site.before, after); destinations.set(after, site.before);
    }
    patches.push(Object.freeze({...site, after}));
  }
  return Object.freeze({scope: 'original-queue-4099-native-entry-target', unitId,
    patches: Object.freeze(patches), dormantHomeRoutingQualified: false,
    destinationImportQualified: false, completeOrderMigration: false});
}
