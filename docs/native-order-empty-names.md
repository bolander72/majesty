# Real empty-name storage in private order loading

The [fixed-stream integration](native-order-fixed-streams.md) now passes 251203
checks / 198 trials through original stream bodies and original cleanup.

The latest [original factory-manager run](native-order-real-manager.md) passes
204017 checks / 198 trials with the same original graph destruction. Counts
and modeled prerequisites below describe their respective historical runs.

The bank fixture now also [tracks original destruction](native-order-retirement.md):
180 healthy graphs, 850 removal/bank-delete calls and 2308 actual CRT frees pass
with exact ownership retirement and private heap baseline recovery. The guarded
cleanup API blocks further loading and treats an interrupted free as uncertain.
That retirement run totaled 204946 checks. Earlier name-loading counts below retain their
original scope; published actors and full-world resource bounds are unfinished.

A subsequent [original CRT lifecycle probe](native-order-crt-names.md) now
executes actual allocation/free and positive-name clear in naturally selected
mode 3. It passes 216281 checks / 3204 calls, verifies 896 cleared-address
reuses and observes a stable 1065744-byte guest CRT pool across eight cycles.
It also verifies original clear releases 128 standalone journal-backend extents.
The bank fixture below still intercepts allocation primitives; full allocator
coverage and published actor handoff/destruction remain unqualified.

The original name copier allocates even for a canonical empty string. Its NUL
scan includes the terminator, so `00523450` requests one byte from `0064d59f`
at return PC `00523485`. The previous controlled helper returned a zero pointer
instead. Its bank/object/path/list request total and 640-byte observed peak
therefore excluded these real name allocations.

`native_order_storage` now reserves real names by default. Each initial order
requires a typed one-byte base-name descriptor. Kinds 2, 5, 6 and 11 also require
a one-byte leaf-name descriptor. The maximum grows from 390 controlled-helper
descriptors to **518 native-name descriptors** for 128 entries. The combined
request cap stays **64 KiB**, including names. The complete profile is validated
before allocation. The older model requires explicit `native_names=false` and
cannot supply the original copier's allocations.

`native_order_allocation::intercept_name` binds the malloc return PC, one-byte
size and preserved EBX destination field to the current guarded order. Base
fields are at order +36; leaf fields are +76 for kinds 2/6 and +72 for kinds
5/11. Unknown callers, larger strings, wrong fields and duplicate claims stop
the owned invocation. Missing names prevent successful node/read completion.
A nonzero stream error permits a partial failed list with unused names still
owned; failure cannot be acknowledged complete.

The compiled fixture consumes the current JavaScript name descriptors directly
from a new bounded NBO2 input, without inserting extra allocations itself.
It executes both original name helper
bodies through the hook dispatcher's original-call path. Clear is qualified for
an initially zero pointer; copy performs the original scan and one-byte copy.
Only the underlying malloc primitive returns reserved storage. No original
allocator body, positive-pointer clear/free or live destructor is qualified.

Current results:

- **1031 native ownership checks:** default refusal of an incomplete old profile,
  typed names, all 518 descriptors, name-allocation prefix failure cleanup,
  retryable ownership and inherited lifetime checks.
- **831 native scope checks / 24 controlled-dispatch trials:** real-name
  completion, missing/duplicate names, wrong sizes/fields/callers, policy
  refusal and the existing construction/read/guard controls.
- **178896 original-bank checks / 198 trials:** all 89 copied profiles and the
  synthetic missing kind-1 profile under both memory fills; 1700 native calls,
  1337 core allocation hooks and 551 name malloc hooks. These execute 549
  completed original copies and 553 original clears.

Two new trials refuse base/leaf name exposure before consuming the reservation.
Cancellation skips its successor statement and the refused byte retains its
poison fill. Twelve core allocation refusals, four sticky stream failures and
two failed zero-path requests also pass. Every trial releases all trusted
private storage and returns guest heap block/byte totals to baseline. The largest
actor journal adds **704 rounded guest heap bytes**, including names, under the
same 4096-byte fixture cap. These numbers exclude host metadata, the mapped
executable, guest arena, browser and a running world.

Reproduce sequentially using the official game tools:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-order-empty-names.py
cd upstream/majesty-recomp
.venv/bin/python tools/test.py --native-test native_order_storage_tests --jobs 1
.venv/bin/python tools/test.py --native-test native_order_allocation_tests --jobs 1
.venv/bin/python tools/test.py --native-test native_order_bank_read_hook_tests --jobs 1
```

The static audit verifies the pinned malloc call, base reader/vtable and leaf
field sites. The bank fixture requires the private pinned translations and new
55908-byte `output/native-order-real-name-hook-fixtures.bin` input. Prepare it
with `upstream/majesty-recomp/.venv/bin/python scripts/prepare-native-order-hook-fixtures.py`
after the JS capture below. The older 50608-byte NBO1 input remains unchanged.
No copied checkpoint or literal bank payload is rewritten. Earlier reports
retain their historical source hashes.

Stream operations and the factory-manager getter remain controlled prerequisites.
The JavaScript planner and scoped claim controller now include typed one-byte
names as well. All 24 focused JS tests pass serially, including all 36 positive
allocation refusal/throw positions, the 518-descriptor bound, name-field identity,
missing/duplicate claims and partial failed-read cleanup. The mixed eight-kind
profile requests 1088 bytes, including 12 name bytes. A formerly exact 64 KiB
two-path profile now rejects because its names exceed the combined cap.

The unchanged copied checkpoints produce 1145 descriptors / 28060 requested bytes
for 89 actors, including 154 base names and 110 leaf names. The new capture is
`output/native-order-real-name-reservation-cases.json`; the old controlled-name
capture and native input are preserved. The compiled runner passes all 89
copied profiles through to the native journal unchanged. The synthetic missing
kind-1 control has a separately identified explicit nine-descriptor profile.
Healthy list traversal verifies each original field points to the reserved
typed name and contains NUL; successful loading consumes every input slot.
All 198 trials pass with complete private heap cleanup. Historical model replays
do not qualify the updated
planner; their source-hash checks remain in force. Production
source-list integration, actor publication, destination references/navigation/
clocks, positive/noncanonical names, live rollback and world/browser bounds
remain unfinished. No browser, game entry, mission loop or WASM build ran.
The app crash remains unresolved and browser launch suspension remains in force.

The JS-only checks and capture require no native build or browser:

```sh
node --test --test-concurrency=1 tests/order-restore-bounds.test.mjs \
  tests/order-reservations.test.mjs tests/order-allocation-bridge.test.mjs
node scripts/prepare-native-order-reservations.mjs \
  output/checkpoint-unit-reference-browser/scions.GMP \
  output/checkpoint-unit-reference-browser/brashnard.GMP
```

Current direct-consumption evidence is
`output/native-order-real-name-direct-observed.json` and
`output/native-order-real-name-direct-ctest.log`. The earlier
`output/native-order-empty-names-native-observed.json` and seven-site audit
retain their own source identities and qualification scope. One focused native
build ran with one job; the private test took 0.60 seconds. Served WASM identity,
old native input and both copied checkpoints remain unchanged.
