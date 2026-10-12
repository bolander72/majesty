# Guarded original UNIT order reads

The subsequent [ownership handoff qualification](native-order-unit-handoff.md)
extends this reader with explicit transfer and original drain-and-delete cleanup.
The results and hashes below describe the preceding reader-only checkpoint.

The allocation controller now has `read_unit` and constructor/read observers
for a single guarded original UNIT invocation. Admission requires a stopped,
unpublished UNIT with the expected table and three null bank fields, fresh bank
claims, valid field bounds and a distinct verified bank-allocation return site.
Existing populated fields reject before original code can delete their banks.

The getter's allocation consumes a reserved bank only in the expected sequence.
Observers require its original constructor to complete its sentinel claim before
reading, then require successful per-bank entry/path/name/node claims before the
next bank. Only the active CPU and eligible journal guard authorize observers;
foreign/ordinary nested callbacks delegate. Allocation Stop decisions must cancel
before the next guest instruction. Known failed reads may return original status,
but keep a failure latch and cannot certify successful restoration.

The fixture has been changed to call original `005b1b90` over a single bounded
combined payload. It adds refusal of each bank allocation, invalid UNIT admission
controls and stopped detachment of exact journal-owned bank pointers before raw
failure rollback. The scope tests add wrong lineage/arguments, missing read exit,
failed read and false successful-reader controls. All 32 controlled dispatch
trials pass in the focused scope CTest. The original-code fixture passes
**331122 checks / 201 trials / 6010 top-level native calls**. All 180 healthy
graphs serialize identically and are destroyed through 850 calls / 2308 tracked
original CRT frees. The prior attachment proof retains historical source hashes.

Fifteen allocation refusals include all three original getter bank sites and
the prior twelve core sites. Two name refusals and four real truncated-input
controls remain covered. Five invalid UNIT admission controls reject before guest
execution: wrong table, occupied bank field, overflowing field span, aliased
allocation site and null CPU. Thirty partially loaded bank pointers are detached
only after the guard stops and only when they exactly borrow claimed owned banks.
Every trial finishes with null UNIT bank fields and guest heap totals at baseline.
The maximum rounded journal delta stays 704 bytes, excluding private UNIT/stream
scratch, process storage, host metadata, executable, arena and browser; it does
not prove complete world or browser memory bounds.

The original getter now writes each bank pointer itself. Original callbacks are
observed at constructor/read entry and return; foreign CPUs and ordinary nested
callbacks cannot consume that authority. Stream construction/destruction accounts
for 3684 top-level calls; 36390 original operations are observed. Loading allocations
still use reserved runtime extents. This is a stopped private partial UNIT, not
complete actor construction or live-world publication.

The first integration build compiled but its test failed before bank execution:
the SDK catalogue marked `005e4d20` as an internal block and refused its observer
hook. The complete original virtual method is now declared in the game's curated
`[translate] entry_points`, and official regeneration recognizes it as a hookable
entry with configuration provenance. The static audit pins four methods and nine
instruction sites after verifying the executable hash. All five game configuration
tests pass. The official single-job native translation rebuild completed, followed
by the two focused CTests sequentially. Scope and original-code tests took
0.26/0.65 seconds. No generated files were edited manually and no browser or WASM
build/game was started.

Current evidence is `output/native-order-unit-reader-observed.json`, its copied
original-code CTest log, both focused build logs and the static audit. The scope
CTest pass is preserved in its build log; its detailed temporary output was
overwritten before a successful copy, so no exact scope-check count is reported.
All recorded build sessions are terminal. Reproduce sequentially:

```sh
cd upstream/majesty-recomp
.venv/bin/python tools/test.py --native-test native_order_allocation_tests --jobs 1
.venv/bin/python tools/test.py --native-test native_order_bank_read_hook_tests --jobs 1
```

Full actor construction, references,
navigation, clocks, ownership handoff, production capsule consumption, live region
cutover and complete world/browser bounds remain unfinished. Browser/WASM testing
stays suspended during the unresolved host-app crash investigation.
