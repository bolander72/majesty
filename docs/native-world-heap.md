# Complete bounded heap allocation metadata

The runtime's [heap inspection API](../upstream/majesty-recomp/kit/docs/heap-inspection.md)
returns address, rounded size and requested size into caller-owned storage.
It reads allocator metadata without guest payload access, allocation, free,
relocation or callbacks. It limits each call to 64 output rows and 256 inspected
allocator records. The game-specific native probe walks these pages while
holding guest execution and compares complete totals against independent heap
statistics.

The opt-in `--heap` probe requires persistence, scripting and CRT observations.
It captures at load, before exit and after exit into exclusive files in an owned
fixture profile. Fixed arrays hold 64 rows plus 64 CRT base/control addresses;
the largest write is 1024 bytes. Each file holds a 40-byte header and at most 8192
16-byte records. The records tag actual original CRT table/control/reservation
addresses, rather than guessing ownership from allocation size. Other blocks
remain unclassified. No game payload or entire arena is dumped.

The runtime API was committed separately at
`fd660e2c03c482785853f82b7906aaf55d3f39a7` on `codex/heap-inspection`, and the
game's kit reference updated. Existing unrelated staged/unstaged kit changes,
including the previous guarded-call test target, were preserved. API source,
test source and actual native build/executable hashes bind the new observations.

The official focused `heap_inspection_tests` CTest entry passed 978 checks in
0.18 seconds, without game loading. Fragmented/resized allocations verify
single-row/batched pagination, complete live coverage, independently reconciled
size sums, unchanged contents/state and invalid-request refusal. The broader
`runtime_tests` invocation reported 2236 checks, two import-coverage failures
and three skips: 69 USER32 imports include 11 unknown argument counts, and 19
imports in total have unknown counts (including intentionally malformed ABI
test names). The broader suite is not claimed to pass. Its heap inspection
checks passed. Logs and source bindings are retained separately in
`output/native-heap-inspection-tests-observed.json`.

Reproduce from the parent workspace with fresh names, one build/game at a time:

```sh
cd upstream/majesty-recomp
.venv/bin/python tools/test.py --native-test heap_inspection_tests --jobs 1
cd ../..
python3 scripts/build-native-world-residency.py --attempt NEW_BUILD_NUMBER
python3 scripts/run-native-world-residency.py \
  output/native-repeat-handoff-publication-observed.json \
  upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-0bies5/Selected_Entity_Revision.json \
  output/native-world-residency-build-NEW_BUILD_NUMBER.json \
  --attempt NEW_RUN_NUMBER --persist --visits 12 --survivors --allocator --heap
node scripts/check-native-world-heap.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_HEAP_REPORT.json
node scripts/check-native-world-heap-controls.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_CONTROLS_REPORT.json
```

Qualification first independently verifies original persisted state, both RNGs,
entity/queue/attachment bytes, original teardown/root frees, resource sampling,
scripting and CRT observations. It then checks every heap metadata file against
its lifetime-ordered producer line and matching original allocator totals.
Files must contain complete ordered/nonoverlapping rows, valid size rounding,
correct CRT tag counts/sizes, exact byte sums and no trailing/truncated data.

Native persistence attempt009 completed successfully across 12 visits. All 36
heap captures reconcile with allocator accounting and the independently checked
saved state. The longest capture took 429 microseconds. The larger region's
unclassified heap grew by 599,520 bytes across repeated visits, including 22
additional allocations requesting 12,208 bytes each. Allocation ownership and
safe cleanup remain unproven. The smaller region's unclassified heap decreased
by 241,824 bytes. These observations do not establish a sustained memory bound.

The run lasted 147.6 seconds. Its 74 process samples peaked at 193,183,744 bytes
RSS (184.2 MiB); samples do not establish continuous peaks or browser memory.
Results are retained in `output/native-world-heap-observed.json`.
The subsequent [allocation-site investigation](native-allocation-sites.md)
identifies the ordinary data-loader call behind the repeated 12,208-byte blocks
and shows substantial turnover between region loads. Other retained growth
still requires investigation.
The corresponding metadata controls reject all 19 corrupted or stale cases,
using in-memory copies without another game launch.

Inspection also records the live game clock. The attempt009 diagnostic saved
before requesting exit; initial observations show the clock advances50ms before
actual teardown in every one of the 12 visits. Preserving those saved
checkpoints across revisits does not
prove that they capture the exact pre-teardown state. The subsequent [completed-tick checkpoint correction](native-completed-checkpoint.md)
addresses this timing gap; its separate evidence is required before claiming
the boundary correction passed. No memory cleanup,
allocation ownership beyond known CRT backing, sustained residency bound,
browser safety or co-op transition qualification is claimed. Browser game
launches remain suspended.
