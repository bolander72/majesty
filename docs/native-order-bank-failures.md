# Original order-bank load failure boundaries

The original bank reader `005e4d20` mutates its destination as it reads. A
successful return alone cannot establish complete restoration. Populated-order
arrival remains disabled; this investigation identifies requirements for a
future checked importer without installing one in the game.

The pinned initial bank table `00683148` binds reader `+4` to `005e4d20` and
writer `+8` to `005e4e20`. The reader reads version/count, then entry version/kind,
gets the manager, calls its factory slot `+c` and the new leaf's reader slot `+4`.
It then allocates a 12-byte list node, links it at the sentinel's tail and
increments the bank count. It returns the stream status. These list writes are
original CPU instructions in the new fixture, not modeled list edits.

Two version words are read but never checked. A null factory result skips the
entry, and the declared count is not compared with the linked count before
returning. The leaf reader's return value is overwritten at `005e4db8`; a leaf
error does not prevent insertion. At `005e4dd6` the allocated node pointer is
written without a preceding null-result check. The original factory's initial
range/default branch and initial slot are also pinned statically; it is modeled,
not executed, in this fixture.

| Synthetic fixture | Observed bank behavior |
| --- | --- |
| Empty bank | Reads and rewrites identically |
| Eight supported discriminators | Links eight modeled leaves in original order; rewrites identically |
| Bank version 999 | Returns zero; rewrite emits version 1 |
| Entry prefix version 999 | Returns zero; rewrite emits version 1 |
| Unknown kind 99 with no body, followed by kind 2 | Returns zero with one linked leaf despite declared count two |
| Leaf returns error 7; stream remains successful | Returns zero and links both leaves |
| Leaf sets persistent stream error 4 | Links the first leaf, then returns error with the second unread |
| Node allocator returns zero | Invalid write at zero; one modeled leaf remains unlinked |

Unknown-kind control deliberately has no body. It does not establish that
unknown payload bytes can be safely skipped or that arbitrary files retain
their boundaries. Original leaf bodies are replaced by single-word synthetic
markers, and the factory/leaf methods, stream primitives and node allocator are
modeled. Bank storage and its empty sentinel are installed manually; constructors
do not execute. This qualifies bank control flow under these controlled models,
not actual saved-bank restoration, real allocation failure or live cleanup.

Both stack fills produce identical observations. There are 28 completed original
reader/writer calls plus two controlled fault cases and 3420 original instruction
visits, including the faulting writes. A fixture maps at most 32768 guest bytes,
with at most eight modeled leaves and eight 12-byte nodes. Calls have a
1024-step/one-second limit and the run a 10000-instruction-visit budget. Exact
owned read/write, list links, counts, stream consumption, preserved registers
and writer immutability are checked. Each mapping set is unmapped and checked
empty afterward. These are guest fixture limits, not host/browser/world memory
measurements; no real allocator, callback, game, browser or build runs.

Three focused admission controls wrap the same unsafe synthetic bank words in
the existing checked attachment structure. The JavaScript prevalidator rejects
bank version 999, entry prefix version 999 and kind 99 before native loading.
Each source has a 32-request / 8192-byte diagnostic budget and 4 KiB maximum
reads. This confirms necessary source admission; it does not catch a runtime
leaf error or implement rollback. Runtime JavaScript and existing test files
are unchanged, so the preceding 308-test workspace suite was not repeated.

A future importer must fully validate source records before allocation, check
each original leaf read and final consumption, and validate resulting bank
membership/counts. It needs qualified cleanup for both linked and unlinked
allocations and must publish only after the entire actor transaction succeeds.
Wrapping the existing bank call and checking its return afterward is insufficient.
Checked per-leaf loading, original factory/constructors, allocator behavior,
callbacks, cleanup ownership and destination activation remain unfinished.

A subsequent [fresh lifecycle trial](native-order-lifecycle.md) now executes
the pinned factory and all eight supported constructor/deleting-destructor
chains under modeled allocation/free. It qualifies fresh inactive ownership,
including null outer and kind-7 inner allocations. Loaded-order cleanup and
complete bank/actor rollback remain unverified.

The [copied-bank ownership trial](native-order-bank-rollback.md) now exercises
original bank construction, loading and low-level cleanup for all 89 copied
actors. It confirms that bank deletion alone does not free orders; unpublished
cleanup removes unique owned entries first. Full actor rollback remains open.

Reproduce from the workspace root:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/check-native-order-bank-failures.py
node scripts/check-order-bank-admission-controls.mjs
```

Evidence: `output/native-order-bank-failures-emulated-observed.json`,
`output/order-bank-admission-controls-observed.json`, their small logs and
`output/native-order-bank-failures-terminal-verified.json`. Existing copied-save
leaf evidence remains source-compatible. Served WASM/glue files are unchanged.
These findings do not identify the host-app crash cause. Crashes remain
unresolved, launches remain suspended and the full goal remains active.
