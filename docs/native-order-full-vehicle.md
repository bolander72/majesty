# Original vehicle construction around order restoration

The subsequent [reusable reader hook integration](native-order-reader-hooks.md)
runs these same original lifecycles through game-owned SDK hooks. Counts and
source identities below describe the preceding fixture-owned hook checkpoint.

The focused original-code test now passes **418379 checks / 201 trials / 6310
top-level native calls**. Ninety complete private vehicles load, serialize and
transfer their order banks, then reclaim their original pooled storage and the
shared GPL resource cache. This qualifies the default unregistered class
lifecycle; complete arriving heroes remain unfinished.

The order fixture now uses original allocator/constructor `00433af0` for the
90 ownership-transfer cases. It allocates the complete `0x164`-byte vehicle and
constructs its inherited objects, attributes and embedded tree. The factory
argument is zero: each vehicle has no registered identity or world-manager
association. Its class table is the actual original `0068098c`, rather than a
table written onto a partial buffer. Other cases retain the prior private
partial UNIT to exercise failed-load detachment and journal rollback.

The controller still calls original UNIT reader `005b1b90`, and the original
getters install the three banks. Complete vehicles additionally compare every
byte outside those three bank fields with a pre-read constructor snapshot.
Successful graphs serialize identically, transfer reservations to the UNIT,
drain through original virtual removal, clear their banks and invoke original
deleting destructor `00433600`. Constructor/deleting entry observers prevent an
absent dispatch from being mistaken for actual original-body execution.

Original vehicle allocations use CRT heap mode 3's small-block pool. They are
not individual runtime heap blocks. A failed initial test incorrectly required
`heap_owns` for the returned object; that check stopped before using its storage.
The current observer retains at most 16 original allocation descriptors, checks
pool-region membership and allocated boundary tags, and requires the original
free to decrement its group's live allocation counter exactly once. Coalescing
can leave a stale boundary tag inside a freed block, so that tag alone is not a
valid post-free ownership test. Every retained allocation must receive its
original CRT free, and total pool occupancy must return to the pre-actor count.

The whole private vehicle lifecycle observes five allocations and five frees per
vehicle: 450 of each across 90 cycles. Maximum live requested vehicle storage is
460 bytes; the maximum simultaneous vehicle and order-reservation request total
is 1020 bytes. These are requested object bytes inside a retained process pool
plus separately reserved order extents, not browser RSS measurements. The warmed
constructor adds no backing runtime heap blocks, while order reservations add at
most 704 rounded heap bytes in these copied cases. Zero additional backing bytes
does not mean a vehicle uses no memory. Every trial restores both the retained
runtime heap totals and CRT pool live-allocation count, including failed loads
that use partial UNITs.

A stronger pool-occupancy check also caught original base-order callbacks lazily
creating the GPL runtime resource singleton. Pool occupancy rose from 2 to 37
objects. The fixture now initializes that original runtime before the actor
baseline, checks cached getter calls, refuses new allocation during owned order
cleanup, and requires original singleton teardown to recover the initial count.
An earlier teardown invocation returned without resetting the singleton or its
pool count; its complete `00628e60` method was absent from the translation
catalogue. The verified method is now a curated game entry. Official single-job
native regeneration completed, and the final native trial observed the actual
cleanup entry, a reset singleton and pool occupancy returning from 37 to 2.
No generated source was edited manually.

The static audit pins ten complete methods and 28 instruction sites, including
the vehicle constructor/deleting destructor, small-block region lookup and group
counter decrement, GPL resource getter and reset cleanup. It also checks the
relevant generated function catalogue entries. All five game configuration tests
pass. The focused CTest took 0.68 seconds after compilation. All build/test
sessions are terminal. Current source/evidence identities and results are in
`output/native-order-full-vehicle-observed.json`, the copied CTest/build logs,
`output/native-full-vehicle-lifecycle-audit.json` and the terminal progress record.
The initial ownership and pool-occupancy failures retain separate CTest logs.

Reproduce the native qualification from `upstream/majesty-recomp`, sequentially:

```sh
.venv/bin/python tools/build.py --regenerate --target gen --jobs 1
.venv/bin/python tools/test.py --native-test native_order_bank_read_hook_tests --jobs 1
.venv/bin/python -m unittest tests/test_game_config.py
```

This constructs complete default vehicle objects, not complete arriving heroes.
PRIMARY descriptions/state, world registration, GPL associations and active
callback effects, destination references/navigation/clocks, scheduling and joint
regional publication remain unfinished. No game loop or browser has run in this
fixture. The cached GPL runtime contains no imported campaign agents. Served
WASM remains unchanged, and browser/WASM testing stays suspended during the
unresolved host-app crash. Independent WAN gameplay and continuous original-world
streaming remain unqualified.
