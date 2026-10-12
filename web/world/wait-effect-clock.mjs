// Partial clock preparation for two pinned original ARG1/ARG3 Wait effects.
// Preserve the complete UNIT and command; this neither imports nor moves them.
import {checkpointAttachments} from './checkpoint.mjs';
import {Sha256} from './sha256.mjs';

const profiles = new Map([
  [0x31475241, {interval: 1000, state: '72bb46ca873b592dafe7d7eb3fbe9dfccdef0792181d9f17d6bd4c25e230bb7c'}],
  [0x33475241, {interval: 3000, state: '1deb81ce6df18d50b529bc908fa21d914fbe76b0b8b9dbc788cde90a57df40e9'}],
]);
const uint32 = n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
const positiveId = n => uint32(n) && n > 0;
const digest = bytes => new Sha256().update(bytes).hex();

export async function checkpointWaitEffectClockPlan(source, child, clocks) {
  const {sourceClockMs, destinationClockMs} = clocks ?? {};
  if (!uint32(sourceClockMs) || !uint32(destinationClockMs))
    throw Error('Invalid Wait effect clock snapshots');
  const profile = profiles.get(child?.description);
  if (!profile || child.family !== 'VHCL' || child.agentId !== 0 || child.stateFlags !== 544 ||
      !positiveId(child.unitId) || !positiveId(child.parentUnitId) || child.size !== 151 ||
      !Number.isSafeInteger(child.offset) || child.offset < 0)
    throw Error('Unqualified cross-clock Wait effect');
  const bytes = await source.readAt(child.offset, 151);
  if (!(bytes instanceof Uint8Array) || bytes.length !== 151)
    throw Error('Truncated cross-clock Wait effect');
  const canonical = Uint8Array.from(bytes), view = new DataView(canonical.buffer);
  if (view.getUint32(36, true) !== child.unitId || view.getUint32(40, true) !== child.stateFlags ||
      view.getUint32(48, true) !== child.description || view.getUint32(56, true) !== child.parentUnitId)
    throw Error('Cross-clock Wait effect identity changed');
  view.setUint32(36, 0, true); view.setUint32(56, 0, true);
  if (digest(canonical) !== profile.state)
    throw Error('Unqualified cross-clock Wait effect state');

  let attachment;
  // Exhaust all metadata before exposing a plan. Attached containers and
  // duplicate orders need separate ownership evidence rather than truncation.
  for await (const row of checkpointAttachments(source)) {
    if (row.unitId !== child.unitId) continue;
    if (row.kind !== 'ORDR' || attachment)
      throw Error('Unqualified cross-clock Wait attachments');
    attachment = row;
  }
  if (!attachment || attachment.size !== 164 || attachment.primary.size !== 128 ||
      attachment.primary.offset !== attachment.offset + 20 || attachment.components.length !== 1)
    throw Error('Unqualified cross-clock Wait order record');
  const raw = await source.readAt(attachment.offset, 164);
  if (!(raw instanceof Uint8Array) || raw.length !== 164)
    throw Error('Truncated cross-clock Wait order record');
  const order = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const frame = [child.unitId, 0x5244524f, 144, 0, 1, 0x4d495250, 128, 2, 0];
  if (frame.some((word, i) => order.getUint32(i * 4, true) !== word) ||
      [1, 0, 1, 1, 1, 9].some((word, i) => order.getUint32(36 + i * 4, true) !== word) ||
      order.getUint32(156, true) !== 1 || order.getUint32(160, true) !== 0)
    throw Error('Unqualified cross-clock Wait banks or framing');
  // Original kind9 has only leaf version1 and the shared 96-byte body.
  // No script callback, name, target or additional leaf timer is admitted.
  const fixed = new Map([[0, 1], [1, 1], [2, 2], [3, 9], [4, profile.interval],
    [6, profile.interval], [10, 4109]]);
  for (let i = 0; i < 24; ++i)
    if (i !== 5 && order.getUint32(60 + i * 4, true) !== (fixed.get(i) ?? 0))
      throw Error('Unqualified cross-clock Wait command or callback');
  const when = order.getUint32(80, true), elapsed = (sourceClockMs - when) >>> 0;
  // Both real effects were independently rebased at age300. Other living
  // ages require their own original-clock replay before admission here.
  if (elapsed !== 300 || elapsed >= profile.interval)
    throw Error('Unqualified cross-clock Wait dispatch age');
  const after = (destinationClockMs - elapsed) >>> 0;
  const patches = after === when ? [] : [Object.freeze({offset: attachment.offset + 80,
    size: 4, before: when, after, bank: 1, index: 0, kind: 9})];
  return Object.freeze({scope: 'original-arg-wait-effect-dispatch-clock', unitId: child.unitId,
    sourceClockMs, destinationClockMs, interval: profile.interval, elapsed,
    remainingMs: profile.interval - elapsed, patches: Object.freeze(patches),
    effectSha256: digest(bytes), orderSha256: digest(raw), unsignedClockAgePreserved: true,
    storage: Object.freeze({objectBytes: 52, nodeBytes: 12, baseNameBytes: 1,
      bankAndHeadBytes: 96, requestedBytes: 161}),
    // Other destination clock bases have the same unsigned arithmetic, but
    // only these two bases have actual original dispatch/lifetime evidence.
    originalProjectedClockLifetimeQualified: sourceClockMs === 57650 &&
      (destinationClockMs === 57650 || destinationClockMs === 24250),
    completeOrderMigration: false, destinationImportQualified: false});
}
