# Original height conversion and border safety

The pinned MTER serializer stores native signed Q16 heights as float32. The
reader converts them back by truncating magnitude, clearing values smaller than
1/65536 and applying the sign. Its bit-shift implementation can wrap values
outside the signed range. A saved +32768 becomes native -32768; this is observed
in the original instructions, not an assumption about a C++ cast.

`web/world/native-height.mjs` implements checked conversion for stopped
reconciliation. Donor heights must be finite, within `[-32768, 32768)`, and have
exactly the same float32 bits after native reader/writer conversion. For example,
float32 0.1 becomes Q16 6553 and serializes as 0.0999908447265625. Copying its raw
float bits would not survive native reload exactly. Negative zero and sub-step
nonzero heights also change on reload and are rejected. No silent normalization
or averaging changes a donor's claimed border.

The native writer itself can round extreme positive Q16 values to the invalid
positive boundary. Consequently, matching the writer alone does not establish
reader safety. The shared-border guard checks range and complete conversion.
It uses one four-byte scratch view and retains no height catalogue.

`terrain-reconcile.mjs` now checks every incoming strip with this guard. Unsafe
endpoints reject before writes; an unsafe later strip aborts an already-started
private draft without a completed result. The caller must discard that draft
on error, as before. Original inputs and selected checkpoint markers are never
written by reconciliation.

The original terrain method at `005f1a40` subtracts an integer delta divided by
the terrain configuration's float at `+8`, then converts the result back to
Q16. It contains no coordinate bounds checks. It cannot be treated as an
absolute-height setter. The initial-clear method at `005aeb70` clears height
words across the vertex stride while preserving other vertex fields.

`scripts/audit-native-height.py` requires the full executable pin before PE
decoding and checks 22 anchors, the height scale, zero threshold and terrain
vtable target. Reader/writer conversion blocks are instruction boundaries
inside established full functions; they are not claimed standalone entries.
Branches stay within the audited reader block, and neither block calls out.

`scripts/check-native-height-instructions.py` executes those original blocks
and the two methods in one bounded CPU emulator. Eighteen serialized inputs and
eight writer extremes include stable heights, precision loss, signed zero,
nonfinite inputs and wrapping ranges. Six delta cases validate subtraction and
preservation of all other bytes. A 90-vertex clear preserves opaque/derived
fields. No game host, original gameplay loop, renderer or allocator runs.
The emulator maps 3,321,856 guest bytes, permits at most 2000 instructions and
one second per call, and observes at most 729 instructions in a call. It uses
round-to-nearest x87 control; other control modes are not qualified. An unpinned
synthetic input is rejected before PE decoding.

`scripts/qualify-native-height.mjs` compares the shipped JavaScript against the
original observations. It also streams both before/after native destination
reconciliations to a hash sink, with the new guard active. Both results match
their previously qualified draft digests exactly, including 118 changed border
vertices per destination. All four original fixture sizes, timestamps and full
digests remain unchanged. Reads/writes to the hash sink stay within 4096 bytes,
with one input file open; no GMP output file is created or published.

Reproduce using the existing game Python environment and Node:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-height.py
upstream/majesty-recomp/.venv/bin/python scripts/check-native-height-instructions.py
node scripts/qualify-native-height.mjs
node --test --test-concurrency=1 tests/native-height.test.mjs tests/terrain-reconcile.test.mjs
```

Evidence: `output/native-height-instruction-audit.json`,
`output/native-height-emulated-observed.json`,
`output/native-height-terminal-qualified.json` and
`output/native-height-all-tests.log`.

This hardens shared-height draft inputs; it does not qualify original engine
reload, generated seamless regions, normals/shading, actor elevation after
mutation, movement across the native grid, live region paging or co-op handoff.
Safe mutation ordering remains unresolved. Browser/game launches stay suspended
under the host-app crash restriction.
