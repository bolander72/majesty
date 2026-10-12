// Exact stopped ARH2 state from the original outdoor Warrior. The source and
// projected original lifetime are qualified; destination import is unfinished.
import {checkpointAttachments} from './checkpoint.mjs';
import {checkpointActorOrderEntries} from './order-entries.mjs';
import {checkpointOrderDispatchClockPlan} from './order-dispatch-clock.mjs';
import {Sha256} from './sha256.mjs';
const digest = bytes => new Sha256().update(bytes).hex();

export async function checkpointOutdoorMarkerClockPlan(source, child, clocks) {
  if (child?.family !== 'VHCL' || child.description !== 0x32485241 || child.agentId !== 0 ||
      child.stateFlags !== 2592 || !Number.isInteger(child.unitId) || child.unitId <= 0 ||
      child.unitId > 0xffffffff || !Number.isInteger(child.parentUnitId) || child.parentUnitId <= 0 ||
      child.parentUnitId > 0xffffffff || child.size !== 151 || !Number.isSafeInteger(child.offset) || child.offset < 0)
    throw Error('Unqualified cross-clock outdoor marker');
  const bytes = await source.readAt(child.offset, 151);
  if (!(bytes instanceof Uint8Array) || bytes.length !== 151) throw Error('Truncated outdoor marker');
  const canonical = Uint8Array.from(bytes), view = new DataView(canonical.buffer);
  if (view.getUint32(36, true) !== child.unitId || view.getUint32(40, true) !== child.stateFlags ||
      view.getUint32(48, true) !== child.description || view.getUint32(56, true) !== child.parentUnitId)
    throw Error('Outdoor marker identity changed');
  view.setUint32(36, 0, true); view.setUint32(56, 0, true);
  if (digest(canonical) !== '648dfd42d26024dd8a940af7fcccb140489c132ff9c1e906f6cd9f2a9c34b03e')
    throw Error('Unqualified outdoor animation state');

  let attachment;
  for await (const row of checkpointAttachments(source)) if (row.unitId === child.unitId) {
    if (row.kind !== 'ORDR' || attachment) throw Error('Unqualified outdoor marker attachments');
    attachment = row;
  }
  if (!attachment || attachment.size !== 244 || attachment.primary.size !== 208 ||
      attachment.primary.offset !== attachment.offset + 20 || attachment.components.length !== 1)
    throw Error('Unqualified outdoor marker order record');
  const banks = [], entries = [];
  for await (const row of checkpointActorOrderEntries(source, child.unitId)) {
    if (row.type === 'bank') banks.push(row);
    else if (row.type === 'entry') entries.push(row);
  }
  if (banks.length !== 3 || banks.some((b, i) => b.bank !== i || b.version !== 1 || b.count !== Number(i === 1)) ||
      entries.length !== 1 || entries[0].bank !== 1 || entries[0].index !== 0 || entries[0].kind !== 5 ||
      entries[0].size !== 176 || entries[0].offset !== attachment.offset + 60)
    throw Error('Unqualified outdoor marker banks');
  const entry = entries[0], fixed = new Map([[0, 1], [1, 1], [2, 2], [3, 5],
    [4, 100], [6, 100], [10, 4101], [24, 336], [28, 1]]);
  if (entry.words.length !== 44 || entry.words.some((word, i) => i !== 5 && word !== (fixed.get(i) ?? 0)))
    throw Error('Unqualified outdoor marker command or callback');
  const raw = await source.readAt(attachment.offset, 244);
  if (!(raw instanceof Uint8Array) || raw.length !== 244) throw Error('Truncated outdoor marker order');
  const order = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const frame = [child.unitId, 0x5244524f, 224, 0, 1, 0x4d495250, 208, 2, 0];
  if (frame.some((word, i) => order.getUint32(i * 4, true) !== word) ||
      entry.words.some((word, i) => order.getUint32(60 + i * 4, true) !== word))
    throw Error('Outdoor marker order changed during preparation');
  const payload = Uint8Array.from(raw.subarray(36)); new DataView(payload.buffer).setUint32(44, 0, true);
  if (digest(payload) !== 'cbe86524f0ca30ae6c183f4605b4a5fb88e02c6f0caa43f879380896ab90a473')
    throw Error('Outdoor marker bank framing changed');
  const dispatch = await checkpointOrderDispatchClockPlan(source, child.unitId, clocks);
  if (dispatch.headers.length !== 1 || dispatch.headers[0].when !== entry.words[5] ||
      dispatch.headers[0].elapsed !== 50 || dispatch.headers[0].dispatchSkipped || dispatch.headers[0].dispatchDue)
    throw Error('Unqualified outdoor marker dispatch age');
  return Object.freeze({scope: 'original-outdoor-arh2-marker-dispatch-clock', unitId: child.unitId,
    sourceClockMs: dispatch.sourceClockMs, destinationClockMs: dispatch.destinationClockMs,
    elapsed: 50, remainingMs: 450, patches: dispatch.patches,
    effectSha256: digest(bytes), orderSha256: digest(raw), unsignedClockAgePreserved: true,
    originalProjectedClockLifetimeQualified: dispatch.sourceClockMs === 57650 &&
      (dispatch.destinationClockMs === 57650 || dispatch.destinationClockMs === 24250),
    completeOrderMigration: false, destinationImportQualified: false});
}
