# Original order readers and path storage admission

The new isolated reader fixture executes all eight supported leaf readers and
writers without launching a game. A separate read-only admission module now
checks path storage before future native restoration. These checks do not
enable populated-order arrival or establish complete command restoration.

Two native storage rules differ from structural file parsing:

- Kind 4's reader allocates `order +0x5c` multiplied by eight, then reads the
  number of points stored at `+0x4c`. The capacity is body word 32; the count
  is word 34. A structurally valid record can request a much larger allocation
  than its serialized point data requires, or declare capacity below count.
- Kind 7's original constructor requests **80 bytes**, enough for ten point
  pairs. Its reader uses that existing buffer at `+0x38`, iterating the saved
  count at `+0x40` without allocating more storage. Structural parsing of an
  eleventh point does not establish safe restoration into a freshly constructed
  order. This is an initial constructor/read boundary, not a live-buffer audit.

`checkpointActorOrderReadBounds` in `web/world/order-read-bounds.mjs` fully
traverses the selected attachment before returning an immutable partial plan.
It rejects kind-4 capacity above 4,096 or below the point count, kind-7 count
above ten, and combined path storage above 64 KiB per selected actor's order
attachment. Spare capacity counts toward the budget even when no points are
serialized. Kind 7 accounts for its 80-byte constructor buffer even with zero
points. A plan captures count/capacity field offsets and expected values; it
allocates nothing, copies no path data and reports `completeOrderMigration:
false`. Applying it later still requires an exclusive stopped source lease,
revalidation and all remaining command migration rules. It does not account
for order objects, names, bank nodes, actors, graphics or complete simulation
memory. The existing structural parser remains useful for read-only inspection
of larger paths, including its 600-point synthetic fixtures.

The native fixture pins all reader slots, the embedded reader slot, kind 7's
constructor allocation and kind 4's allocation/count flow against the original
executable SHA-256. It executes original leaf/base/token readers, point readers,
leaf/shared writers and original stack zero-fill code. Scalar/raw/status I/O,
empty-name clearing/copying and the kind-4 allocator are modeled. Kind 7's
constructor is statically inspected; its controlled 80-byte buffer is installed
by the fixture. No constructor, real allocator, native callback, original
bank/factory reader or operating-system file I/O executes.

Twenty cases start from the previous original-writer replay payloads, using two
stack fills. Four kind-4 payloads used arbitrary capacity bits in that earlier
scalar fixture; their capacity word is explicitly normalized to their zero or
three-point count before any allocating reader runs. The earlier payloads are
not overwritten or falsely claimed to restore unmodified. Two additional
synthetic kind-7 cases exercise exactly ten points. All 22 inputs round-trip
through original readers and writers byte for byte, consuming the full input,
preserving the fixture data during writing and returning with the expected
stack and preserved registers.

The fixture executes **44 original calls / 10,114 original instructions**.
At most 77,824 guest-mapped bytes exist at a time; each case is explicitly
unmapped and checked empty afterward. Path storage is at most 80 fixture bytes.
Per-call step/stack, input/output, allocation request and owned read/write bounds
are enforced, including modeled stream writes. The fixture demonstrates the
current layouts under those models. It does not measure process RSS, execute
positive name restoration, restore actual copied-save entries, validate target
existence or test order execution in a region.

All 89 order attachments in the two unchanged copied snapshots pass the new
storage admission. They contain 39 path entries: 32 kind-4 entries with capacity
ten and seven kind-7 entries with one saved point. The plans account for 3,120
bytes of path buffers across those entries, with at most 160 bytes in one
actor's attachment. These are planned path-buffer bytes, not measured native
memory. Diagnostic reads are serial and at most 4 KiB, totaling 6,586,282 bytes.
The inspector has separate per-file 64 MiB / 16,384-request and 128-attachment
budgets, preserves no regional catalogue and keeps at most eight samples.
Copied file hashes and file identities remain unchanged.

A subsequent [literal copied-entry trial](native-checkpoint-order-readers.md)
now restores and rewrites all 154 actual captured entry payloads through the
same isolated original leaf methods without normalization. This advances the
entry-level evidence while full-bank construction and active restoration remain
unverified.

Four focused tests cover the native ten-point boundary, excessive/signed-negative
and undersized capacities, aggregate spare-capacity accounting, immutable copied
plans, zero/absent paths, late unsupported data, duplicates and truncation. All
294 workspace JavaScript tests pass. Evidence is in
`output/native-order-readers-emulated-observed.json`,
`output/native-order-read-bounds-snapshots-observed.json`, their small logs and
`output/native-order-readers-terminal-verified.json`.

```sh
node --test tests/order-read-bounds.test.mjs
upstream/majesty-recomp/.venv/bin/python scripts/check-native-order-readers.py
node scripts/inspect-native-order-read-bounds.mjs \
  output/checkpoint-unit-reference-browser/scions.GMP \
  output/checkpoint-unit-reference-browser/brashnard.GMP
node --test tests/*.test.mjs
```

Targets, clocks, leaf callback semantics, unsupported entry kinds, destination
navigation, complete native restoration and live hero travel remain unfinished.
No browser/game launch, native/WASM build or staging operation ran. The served
game is unchanged. This finding does not establish a cause for the app crashes;
they remain unresolved and the launch suspension holds. The full co-op and
expanding-world goal remains active.
