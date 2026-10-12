# Original order lifecycle through a private UNIT

The subsequent [whole-UNIT reader work](native-order-unit-reader.md) changes
the controller/fixture and passes 201 original-code trials. Counts and hashes
below preserve the preceding successful attachment run.

The compiled bank fixture now attaches validated loaded banks to a private
148-byte partial UNIT with the pinned initial vehicle table `0068098c`. Its
three bank fields are `+88`, `+8c`, `+90`. Every bank constructor receives this
UNIT address and preserves it at bank `+4`, replacing the previous opaque
owner value. This is a controlled layout, not complete original actor construction
or registration in a live world.

Attachment occurs only after all claims, successful reads, list/name checks and
per-bank original writing. All three UNIT fields must be null and each bank's
owner must match. The journal retains ownership; no asynchronous user can access
this private UNIT. Its original getter `004300e0` must return each existing bank
without allocating replacements. The original UNIT writer `005b1be0` traverses
its virtual presence/nonempty checks and serializes all three banks through the
original fixed stream. Output must exactly equal the concatenated copied payloads,
including empty banks.

Orders are then removed through `005e4f90` and original deleting destructors.
Only once a bank is empty does original UNIT clear `005b2de0` delete it and null
the UNIT field. Its original CRT frees retire exact journal records. All fields
must be null before fallback release. Loading refusal/truncation controls never
attach banks and also finish with null UNIT fields. The private UNIT's outer
sentinels remain intact in all trials. This establishes the tested borrowing and
cleanup sequence, not production publication, ownership transfer or full rollback.

One official single-job native build passes **338401 checks / 198 trials / 8432
top-level calls**. Across 180 healthy graphs, 540 original getters, 180 original
UNIT writers and 540 original UNIT clears pass. The existing 850 destruction
calls / 2308 tracked CRT frees and 18 rejection/truncation controls still pass.
Each actor trial returns guest heap totals to baseline. The maximum 704-byte
rounded journal delta excludes private UNIT/stream scratch, warmed process storage,
host metadata, executable, arena and browser; it is not a full-world memory bound.
The fixture executes 5148 stream setup/teardown calls and observes 36173 original
stream operations. Final CTest took 0.67 seconds.

The seven-method/11-site static audit checks the pinned hash, bank owner copy,
existing-bank getter branch, UNIT writer dispatch, clear/null sequence and five
initial UNIT vtable slots. Current evidence is
`output/native-order-unit-attachment-observed.json` and its copied CTest log.
Earlier runs retain their historical source identities and narrower scopes.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-order-unit-attachment.py
cd upstream/majesty-recomp
.venv/bin/python tools/test.py --native-test native_order_bank_read_hook_tests --jobs 1
```

The original UNIT reader still has unchecked allocation paths and replacement
can orphan orders, as documented in [its earlier failure probe](native-unit-order-loading.md).
This run does not call that reader or qualify arbitrary populated replacement.
Production capsule consumption, complete actor construction, destination target
references, navigation, clocks, live region cutover and complete simulation/browser
bounds remain unfinished. Copied checkpoints and served WASM identity are unchanged.
Browser/WASM testing stays suspended during the unresolved host-app crash.
