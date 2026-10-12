# Retained message queues across kingdom returns

Later native091/092 registration and opt-in retirement results are in
[native orphan queue retirement](native-orphan-queue-retirement.md). The evidence
and limits below describe native090 before that follow-up.

Native090 / hero-region-travel008 completes the actual home, remote, home,
remote sequence through original Load Game menus. Independent heap inspection
requalifies all saved state and hero ownership, twelve complete allocation
captures, eighty completed original ticks and twenty-four world-root frees.
No queue cleanup or game behavior replacement is introduced.

The existing allocation/free hooks now retain a fixed table of at most512
observed page allocations. Active original queue frames supply the caller's
saved ESI and EDI and message reference. Seven pinned fragments first audited
the stack and manager creation; the later nine-fragment audit also establishes
the constructor's final vtable and recipient-tree count offset. Nine changed
instruction controls refuse.

The80 active contexts identify original global006d8568, final vtable00682bc4,
696 CRT payload bytes for its688-byte request, and the critical section at+138.
They all enqueue recipient1 into a48-byte requested queue descriptor with56
CRT payload bytes. The allocation call is004a0095; the original message
manager calls the queue helper at005a4e0d. Captures retain106 bounded owner
samples, reconciled with the228 page allocation/free events and actual heap
records. No matching queue-descriptor or parent free is observed while these
retained page identities remain in the table.

| After unload | Total4KiB allocations | Matched retained queues | Pending messages in each |
| --- | ---: | ---: | ---: |
| First home visit |9|1|1|
| First remote visit |10|2|1|
| Returned home visit |11|3|1|
| Returned remote visit |12|4|1|

Each matched descriptor is still allocated, its eight-byte map is allocated,
and both map nodes link to the exact surviving4096-byte allocation. Queue count
is1. Thus these are not qualified empty queues or freed descriptors with abandoned
buffers. The other eight allocations have unobserved origins. Current recipient-
tree membership, other message references and safe retirement are still unqualified.
A caller association does not itself establish current manager ownership.

The observer does not read queued message payloads after return. Before any
cleanup, establish whether an old queue remains registered and how the original
manager drains/retires that registration. Preserve pending references and saved
kingdom behavior. Original004995db allocates a new descriptor, and00499655
stores it into a recipient-tree node; current membership and replacement lifetime
need actual bounded observation. Original00497cf0 can consume and release queue
storage, but its use on these retained queues is not yet qualified.

## Corrections and refused attempt

Native089 / attempt007 terminates with exit6 at an observer guard before any
new context result. It expected the initial constructor vtable00682c64 as the
live manager identity. The constructor later writes00682bc4, which actual090
contexts confirm. The exact conjunct that failed089 was not logged; do not
claim it is dynamically proven. No cleanup ran. Keep its manifest, log and
native-page-owner-attempt-007-refused.json; it contributes no positive result.

Native090's log label `tree-count` reads manager+54. The pinned tree constructor
establishes count at container+c, manager+58. These logged values are raw words,
not counts. The owner inspector explicitly records this correction and makes
no tree-count or membership claim. Do not reuse that field for retirement.
The final-vtable audit initially used a six-byte endpoint for a seven-byte
instruction; that static preflight refused before writing any qualified report.
The corrected exact endpoint passes.

## Verification and resources

The actual log is accepted;20 contradictory copies refuse: missing/changed parent,
lock/vtable/global identity, unknown-size sentinel, missing/duplicate sample,
wrong buffer/descriptor/parent/recipient/event, false frees, false empty queue,
and broken map/iterator links. Original log remains unchanged. No additional
game is launched for these checks. The exact090 executable, sources and symbols
are synced and rehashed with4KiB transfers and registered as a stopped artifact.

Native process39696 exits0 after56,840ms. Max sampled RSS is184,205,312 bytes
(175.7MiB). Both source kingdom files, publication, selected receipt and original
settings remain unchanged. This is a short native observation, not a performance
gain, sustained native/browser bound or browser qualification. The served WASM
is unchanged; in-app game testing remains suspended.

Evidence:

- `output/native-hero-region-travel-attempt-008.json` and its log;
- `output/native-hero-region-heap-002-observed.json`;
- `output/native-page-owner-001-observed.json`;
- `output/native-page-owner-controls-001-observed.json`;
- `output/native-page-owner-lifetime-layout-001-observed.json`;
- `output/native-page-owner-generation-090-preserved.json`.

Reproduce using fresh build/run/report numbers and the same actual revision2
publication and selected export:

```sh
python3 scripts/build-native-world-residency.py --attempt NEW_BUILD
python3 scripts/run-native-hero-region-travel.py \
  output/native-world-residency-build-NEW_BUILD.json \
  output/native-hero-return-pair-001-published.json \
  upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-iIyAMK/Selected_Entity_Revision.json \
  --attempt NEW_RUN --capture-heap --capture-page-context
node scripts/inspect-native-hero-region-heap.mjs \
  output/native-hero-region-travel-attempt-NEW_RUN.json output/FRESH_HEAP_REPORT.json
node scripts/inspect-native-page-owners.mjs \
  output/FRESH_HEAP_REPORT.json output/FRESH_OWNER_REPORT.json
```

For a changed observer, re-audit relevant instructions and update verification
expectations before interpreting results. Do not force-free based on map
visibility, raw prefix words or matching addresses alone.
