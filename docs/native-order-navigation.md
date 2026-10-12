# Source navigation fields in native orders

`web/world/order-navigation.mjs` streams typed, read-only navigation observations
for supported Move Path (kind 4) and queued movement (kind 7) entries. It separates
native-world coordinates from navigation-grid coordinates and checks canonical
path cursors. It does not translate a route, prove destination walkability or
enable populated-order arrival. Other order coordinate fields remain unclassified.

| Field | Native location | Saved location | Coordinate space |
| --- | --- | --- | --- |
| Move Path destination | `+3c`, `+40` | Words 26, 27 | Native world |
| Move Path route points | Buffer `+44` | After 140-byte body | Navigation grid |
| Queued movement points | Buffer `+38` | After 112-byte body | Native world |

These are signed integer pairs. The original Move Path consumer passes its
destination through `0043c640`, dividing each component by 16 with truncation
toward zero. For example, `(-17,33)` becomes `(-1,2)`. A queued movement point
passes through adapter `005e27f0` and the initial manager's `+50` handler
`005e19c0`, which creates a Move Path and stores the pair through `005e1aa0`.
This connects the two coordinate scales under the pinned initial methods;
it does not qualify arbitrary replacement handlers.

The Move Path cursor is native `+48` / saved word 30. It compares the current
route point with the current navigation result and only reads a following point
when `cursor + 1 < count`; otherwise it replans. A different region's grid can
invalidate a route even when the destination translates correctly. The queued
movement cursor is native `+3c` / saved word 25. It advances before submitting
the previous cursor's point; reaching count finishes or resets the queue under
the original flags. These paths have different cursor and completion behavior.

The inspector admits canonical cursors `0 <= cursor <= count`, checks count
against kind 4's saved capacity or kind 7's ten-point buffer, and limits each
attachment to 128 navigation headers. Rejecting larger exhausted cursors is a
source admission policy, not proof that every such cursor would fault in every
original branch. Coordinates retain their signed raw values; bounds, obstacles,
ownership and movement-class compatibility require a destination navigation
check. Capacity admission is not a full allocator or world memory bound.

Frozen observations contain offsets and bank/index metadata. Paths stream from
the existing checked reader in blocks of at most 4 KiB; no point catalogue is
retained by this iterator. Consumers must fully exhaust it before using results,
because unsupported later entries, duplicates, truncation or trailing bytes
can still reject an attachment. No checkpoint bytes are edited.

The pinned audit decodes 12 local ranges / 518 instructions, checks 38 anchors,
three original labels, initial virtual slots and eight prior original writer
field mappings. Twenty isolated original coordinate conversions complete 360
instructions with two stack fills, including signed extrema and negative
rounding boundaries. Guest mappings peak at 16384 bytes and return to zero after
each call. Path consumers, allocation, movement, callbacks and game runtime
never execute. This guest bound is not process or browser memory usage.

Both unchanged copied saves pass full source traversal: 89 attachments contain
39 path headers and 348 coordinate pairs (309 grid, 39 native world). Seven paths
are exhausted. Serial diagnostic reads total 6586282 bytes, with 4 KiB maximum
reads and a per-file 64 MiB / 16384-request budget. At most eight header samples
per file are retained; whole-file hashes and file identities stay unchanged.

Four focused tests and all 308 JavaScript tests pass, with test concurrency one.
Evidence is `output/native-order-navigation-emulated-observed.json`,
`output/native-order-navigation-snapshots-observed.json`, their logs and
`output/native-order-navigation-terminal-verified.json`.

```sh
node --test --test-concurrency=1 tests/order-navigation.test.mjs
upstream/majesty-recomp/.venv/bin/python scripts/check-native-order-navigation.py
node scripts/inspect-native-order-navigation.mjs \
  output/checkpoint-unit-reference-browser/scions.GMP \
  output/checkpoint-unit-reference-browser/brashnard.GMP
```

Destination path reconciliation, other coordinates/timers, original bank and
actor restoration, complete native simulation paging and live hero crossing
remain unfinished. No game/browser launch or build ran; the served game is
unchanged. App crashes remain unresolved and launch suspension remains in force.
