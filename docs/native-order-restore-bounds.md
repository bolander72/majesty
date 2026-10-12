# Initial order-bank allocation-request admission

The current planner includes one-byte base names for every entry and one-byte
leaf names for kinds 2/5/6/11. These allocations count toward the 64 KiB cap,
including when the saved names are canonical empty strings. The unchanged
89-actor capture now requests 28060 bytes. All 24 focused planner/reservation/
claim tests pass; direct native consumption now passes 178896 checks / 198 trials.
See [real empty-name qualification](native-order-empty-names.md). The original
comparison counts and inspector described below refer to the earlier model,
which omitted name allocations. Do not refresh historical evidence hashes to
reuse that model as proof of the current budget.

The read-only `checkpointActorOrderRestoreBounds` API now accounts for bank,
sentinel, order-object, list-node and path-buffer requests together. Its estimates
match the original-method fixtures for all 89 copied actors / 267 banks / 154
entries under both stack fills: 178 comparisons. The largest actor requests 556
bytes; the sum across these fixtures is 27796 bytes. This sum is diagnostic,
not permission to load every actor simultaneously.

The API is in `web/world/order-restore-bounds.mjs`. It fully traverses the source
attachment before publishing a frozen plan, requires canonical empty token names,
and rejects more than 128 entries or combined requests over 64 KiB. The three
initial banks request 20 bytes each plus 12-byte sentinels. Every linked order
requests a 12-byte node and its verified initial factory object size:

| Kind | Object request, bytes |
| --- | ---: |
| 1 | 88 |
| 2 | 92 |
| 4 | 100 |
| 5 | 92 |
| 6 | 92 |
| 7 | 72 |
| 10 | 76 |
| 11 | 112 |

Kind 4 adds its saved capacity times eight bytes, including unused capacity;
capacity must be at most 4096 and at least the saved point count. Kind 7 always
adds its constructor's 80-byte buffer, including when its saved point count is
zero; at most ten points fit. Absent order attachments request zero; a canonical
three-empty-bank attachment requests 96 bytes. The combined budget is stricter
than the earlier [path-only admission](native-order-readers.md): two kind-4
buffers with capacities 4096 each already consume the path-only limit and exceed
the combined limit when object/list/bank requests are included.

All eight words in every base and applicable leaf token name must be zero.
A leading NUL with nonzero suffix bytes also rejects. This is a deliberate
profile restriction because positive-name allocation and release remain
unqualified. Callback IDs and reserved words remain opaque; accepting them does
not qualify their migration or activation.

The original [factory lifecycle](native-order-lifecycle.md) supplies the object
sizes. The [copied-bank fixture](native-order-bank-rollback.md) supplies independent
modeled allocation roles and peaks after executing original constructors/readers.
`scripts/inspect-native-order-restore-bounds.mjs` checks those evidence dependencies
and source hashes, then compares each source plan with both regular native
outcomes. Synthetic, interrupted and ownership-control outcomes are excluded.
All role counts, loaded-entry counts and positive request peaks agree; copied
files retain their structural hashes and file identities.

This inspector reads at most 4 KiB at a time, with per-file limits of 64 MiB,
16384 requests and 128 actor attachments. The two fixtures require 6586282 bytes
of serial I/O. It retains at most eight compact samples per file. It does not
create a runtime world catalogue, allocate native banks, mutate saves or execute
new original CPU cases.

Five focused tests cover all eight object types, exact combined-limit admission,
spare capacity, empty/absent banks, canonical-name refusal, path/entry limits and
late malformed records. All 313 workspace JavaScript tests pass sequentially.

```sh
node --test tests/order-restore-bounds.test.mjs
node scripts/inspect-native-order-restore-bounds.mjs \
  output/checkpoint-unit-reference-browser/scions.GMP \
  output/checkpoint-unit-reference-browser/brashnard.GMP
node --test --test-concurrency=1 tests/*.test.mjs
```

This is requested storage for an initial empty-name order-bank profile. It
excludes allocator overhead/alignment, UNIT/GPL state, graphics and other world
state. It is a reusable source admission API, not a native loader or global
simulation-memory bound. A future loader must retain an immutable stopped source,
revalidate its prepared copy, check allocation/path readiness and handle partial
graphs before publication. Populated actor arrival and live streaming remain
disabled pending full actor rollback and reference/navigation/clock integration.

Evidence: `output/native-order-restore-bounds-snapshots-observed.json`, focused
and workspace test logs, and `output/native-order-restore-bounds-terminal-verified.json`.
No game/browser launch or build ran; served artifacts remain unchanged. App
crashes remain unresolved and launch suspension continues. The goal stays active.
