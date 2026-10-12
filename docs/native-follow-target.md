# Follow Unit target provenance

The read-only `checkpointActorOrderUnitTargets` iterator identifies the saved
unit target in **kind 6 (Follow Unit)** orders. This is one field, not a complete
reference map or an enabled migration path. Other supported kinds are still
parsed structurally; their integer values are not inferred to be unit IDs.

A subsequent [four-kind UNIT reference module](native-order-unit-bindings.md)
adds explicit partial binding plans for Move, Move Path, Follow Unit and Init
Action fields. This original Follow Unit-only iterator retains its narrower API.

The pinned executable provides three independent links:

- Producers at `005e2830` and `005e29a0` copy the target unit's `+0x60`
  saved identity into the order's `+0x38` field.
- Writer `005e2390` serializes that field into body word 25 (byte 100).
  Both previously qualified original writer replays reproduce this mapping.
- Consumer `005e2680` passes that field to world unit lookup `005a10d0`.
  The original lookup returns null for zero. This does not establish how a
  missing target should be handled when restoring or migrating an order.

The original text formatter labels the same field `_targetID` and names the
class `Order Follow Unit`. The audit verifies 23 instruction anchors in six
fully decoded ranges (226 instructions), three virtual slots and both labels,
after checking the original executable's SHA-256. This audit is static: it does
not execute a game, a target lookup or an order consumer. The two writer replays
are prior isolated CPU evidence with modeled stream I/O; their source and report
hashes are checked before reuse.

The iterator yields frozen numeric descriptors containing the actor ID, bank,
entry index, target ID and exact four-byte file range. Zero is exposed as zero,
and high-bit IDs stay unsigned. Descriptors retain no source byte views.
Consumers must exhaust the iterator: malformed later entries, unsupported
kinds, trailing data or duplicate attachments still invalidate inspection.
The underlying reader retains its existing 64 KiB record, 1,024-entry,
200-byte fixed capture and 4 KiB read limits. These are parsing bounds, not
JavaScript heap, native simulation or browser resource measurements.

The copied Scions and Brashnard snapshots contain 89 order attachments. The
new inspector exhausts each and finds 25 Follow Unit targets, all in Brashnard;
each matches exactly one saved UNIT record. It scans unit metadata separately
for each target instead of retaining an ID catalogue. Both snapshot hashes and
file identities remain unchanged. Reads are serial and at most 4 KiB, totaling
13,651,882 bytes across both files. A separate per-file diagnostic budget limits
requests to 16,384, bytes to 64 MiB and attachments/targets to 128 each; report
samples are limited to eight per file. Saved membership does not establish
destination membership, current live target validity or actor/hero type.

Four added tests exercise numeric collisions with callback/action/other-kind
fields, all three banks, unsigned and zero IDs, page crossings, immutable copied
values and late failures. All 14 focused tests and 284 workspace JavaScript
tests pass. No order bytes are rewritten and arrival still rejects populated
orders. Callback/script references, remaining target fields, clocks, path
reconciliation and original order-reader restoration remain unfinished.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-follow-target.py
node --test tests/order-entries.test.mjs
node scripts/inspect-native-order-targets.mjs \
  output/checkpoint-unit-reference-browser/scions.GMP \
  output/checkpoint-unit-reference-browser/brashnard.GMP
node --test tests/*.test.mjs
```

Current evidence is in `output/native-follow-target-audit.json`,
`output/native-order-targets-snapshots-observed.json`,
`output/order-targets-focused.log`, `output/order-targets-workspace.log` and
`output/native-follow-target-terminal-verified.json`. Earlier structural-reader
reports retain their historical source hashes; this addition does not rewrite
them to imply they tested a newer source. No browser, game, build or staging
operation ran. App crashes remain unresolved, launch suspension stays in force
and the full cooperative/expanding-world goal remains active.
