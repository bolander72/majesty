// Partial preparation for the pinned original Newrecruit effect. Native004/005
// match all twelve living UNIT states and retire the original marker/callback.
// This does not qualify original destination import or arbitrary marker modes.
import {checkpointActorOrderEntries} from './order-entries.mjs';
import {checkpointOrderDispatchClockPlan} from './order-dispatch-clock.mjs';
import {checkpointAttachments} from './checkpoint.mjs';
import {Sha256} from './sha256.mjs';

// Whole original UNIT records, with only the audited native ID and physical
// parent ID zeroed. Preserve every other byte, including the actual draw part,
// frame, flags, relative position and opaque state. A class key alone is not
// sufficient to identify Newrecruit rather than another ARH3 effect.
const livingStates = Object.freeze([
  '3a9ee0a8695ca2b326983a2ae192d91b38f9243f7cbda9a741f12e7e99cf9871',
  'd3167a7206876e7eebbc29b73119ebb1d8ce24bd0d67ce088039685678a21038',
  'f9b31679f16c8770354791a3102ba4af1a72ac49185f9a5ef2fe66995755e15a',
  '26a3a58ac5184abb7f58a05a2aa0db751ec0ee8537d427f8c1a798e5e0e96750',
  '1b3ec305f91d8ef434bc046e7fa9e770b498544227bde6ed97bebbd9c0f20447',
  '5bae6b67435f5deaabe5d9acfbe4b02a0a4d55dd984803935271ecae59c373db',
  'c4fd9f37c7c11feb5865b0698165236b4f879c9bd44c332e7e7d808a255bd831',
  '4d9cf0df7fb7d1c589a20ee29503bda29592e8fe08457d775b5ee8dc175bd328',
  '36fb72d0432533f891bb4b5bba567d6f39324d1282c94bb97020f0244882782f',
  '1222e0a2bdd8f3ee62612f67d7aea0e0e54d91bd0e4f6ba7ceafc4ce6875d6cd',
  '051191ac76f8eeddce2bef74055241c544c1e90c06481791bc0d5aa7eb522418',
  '52ed72322444193d5879208651cdc98565e4f296089010bcc255049b8a77b73f',
]);

export async function checkpointNewrecruitMarkerClockPlan(source, child, clocks) {
  if (child?.family !== 'VHCL' || child.description !== 0x33485241 || child.agentId ||
      child.stateFlags !== 2592 || !child.parentUnitId || child.size !== 151)
    throw Error('Unqualified cross-clock attached effect');
  const bytes = await source.readAt(child.offset, child.size);
  if (!(bytes instanceof Uint8Array) || bytes.length !== 151)
    throw Error('Truncated cross-clock recruit effect');
  const canonical = Uint8Array.from(bytes), view = new DataView(canonical.buffer);
  if (view.getUint32(36, true) !== child.unitId || view.getUint32(56, true) !== child.parentUnitId)
    throw Error('Cross-clock recruit effect identity changed');
  view.setUint32(36, 0, true); view.setUint32(56, 0, true);
  const effectState = livingStates.indexOf(new Sha256().update(canonical).hex());
  if (effectState < 0) throw Error('Unqualified cross-clock recruit animation state');

  const banks = [], entries = [];
  for await (const row of checkpointActorOrderEntries(source, child.unitId)) {
    if (row.type === 'bank') banks.push(row);
    else if (row.type === 'entry') entries.push(row);
  }
  if (banks.length !== 3 || banks.some((b, i) => b.bank !== i || b.version !== 1 || b.count !== Number(i === 1)) ||
      entries.length !== 1 || entries[0].bank !== 1 || entries[0].index !== 0 || entries[0].kind !== 5)
    throw Error('Unqualified cross-clock recruit marker banks');
  const entry = entries[0];
  const fixed = new Map([[0, 1], [1, 1], [2, 2], [3, 5], [4, 100], [6, 100], [10, 4101], [24, 336], [28, 1]]);
  if (entry.size !== 176 || entry.words.length !== 44 ||
      entry.words.some((word, i) => i !== 5 && word !== (fixed.get(i) ?? 0)))
    throw Error('Unqualified cross-clock recruit marker command or callback');
  let attachment;
  for await (const a of checkpointAttachments(source))
    if (a.kind === 'ORDR' && a.unitId === child.unitId) {
      if (attachment) throw Error('Duplicate cross-clock recruit order attachment');
      attachment = a;
    }
  if (!attachment || attachment.size !== 244) throw Error('Unqualified cross-clock recruit order record');
  const raw = await source.readAt(attachment.offset, attachment.size);
  if (!(raw instanceof Uint8Array) || raw.length !== 244) throw Error('Truncated cross-clock recruit order record');
  const rawView = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const body = entry.offset - attachment.offset;
  if (rawView.getUint32(0, true) !== child.unitId || body !== 60 ||
      entry.words.some((word, i) => rawView.getUint32(body + i * 4, true) !== word))
    throw Error('Cross-clock recruit order changed during planning');
  const payload = Uint8Array.from(raw.subarray(36));
  new DataView(payload.buffer).setUint32(44, 0, true);
  if ([4,8,12,16,20,24,28,32].some((at, i) => rawView.getUint32(at,true) !==
      [0x5244524f,224,0,1,0x4d495250,208,2,0][i]) ||
      new Sha256().update(payload).hex() !== 'cbe86524f0ca30ae6c183f4605b4a5fb88e02c6f0caa43f879380896ab90a473')
    throw Error('Cross-clock recruit order framing changed during planning');
  const dispatch = await checkpointOrderDispatchClockPlan(source, child.unitId, clocks);
  // Only observed living states between original 100ms dispatches. An overdue
  // order, skipped dispatch or a future timestamp needs independent evidence.
  if (dispatch.headers.length !== 1 || dispatch.headers[0].when !== entry.words[5] ||
      dispatch.headers[0].delta !== 100 || dispatch.headers[0].rate !== 100 ||
      dispatch.headers[0].bank !== 1 || dispatch.headers[0].index !== 0 || dispatch.headers[0].kind !== 5 ||
      dispatch.headers[0].elapsed >= 100 || dispatch.headers[0].dispatchSkipped)
    throw Error('Unqualified cross-clock recruit marker dispatch age');
  return Object.freeze({scope: 'original-newrecruit-marker-dispatch-clock', effectState,
    sourceClockMs: dispatch.sourceClockMs, destinationClockMs: dispatch.destinationClockMs,
    elapsed: dispatch.headers[0].elapsed, patches: dispatch.patches,
    effectSha256: new Sha256().update(bytes).hex(), orderSha256: new Sha256().update(raw).hex(),
    originalProjectedClockLifetimeQualified: true, completeOrderMigration: false,
    destinationImportQualified: false});
}
