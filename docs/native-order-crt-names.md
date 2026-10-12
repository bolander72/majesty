# Original CRT empty-name allocation and cleanup

A subsequent [tracked bank destruction](native-order-retirement.md) now couples
actual original CRT frees to the private journal's ownership retirement, under
naturally selected mode 3. All 180 healthy graphs return private storage to
baseline before fallback release. Full live actor ownership remains unfinished.

The private `native_order_crt_name_tests` target executes original CRT heap
initialization, empty-name copying, replacement, positive-pointer clearing and
heap termination through the pinned translations. It installs no allocator
hooks and enters no game loop. The guest's current Windows 4.10/platform-1
policy naturally selects **CRT heap mode 3**; the test does not force a bypass.

The final run passes **216281 checks / 3204 native calls** in 0.65 seconds.
Eight cycles each hold 128 simultaneous canonical empty names. Each cycle
copies all names, replaces every positive name, then clears every field.
The test checks original results, NUL contents, aliasing against every other
live field, caller stack, cdecl preserved registers, physical SEH and profile
depth. Every one of the 896 fresh allocations after the first cycle reuses an
address from the preceding cleared set. This checks recycling in addition to
the backing-pool measurements, which alone could hide small-block leaks.

The original CRT retains **1065744 rounded guest heap bytes in three allocations**
after the first cycle. The count and bytes stay exactly constant for the next
seven cycles, below the probe's 2 MiB guest-pool cap. These figures include
this workload's CRT initialization/pool cost and exclude the field/source
scratch buffers, host metadata, executable, guest arena and browser. This is
an observed fixed-workload plateau, not a complete native world or host RAM
bound. Other allocation sizes, fragmentation and long-running worlds remain
unqualified.

A separate control supplies 128 one-byte standalone runtime heap allocations,
the backend used by the current order-storage journal. Original positive-name
clear recognizes these as outside its small-block pool and releases them.
Each field becomes zero, each exact runtime allocation ceases to be owned,
and runtime heap counts/bytes return to the pre-control baseline. This removes
the allocator-compatibility uncertainty for that control. It does not update a
journal's ownership ledger: ownership handoff or tracked retirement is still
needed before original destruction can coexist with journal cleanup.

This extends the [real empty-name bank loading](native-order-empty-names.md)
proof. That fixture still intercepts allocation primitives and uses a private
journal; this separate probe executes the CRT bodies and positive-name clear.
It does not qualify all allocator modes, nonempty strings, complete order/actor
destructors, original factory-manager initialization, live publication or
continuous region streaming. The independent-internet co-op test is unfinished.

Reproduce using the official focused target, one job:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-order-crt-names.py
cd upstream/majesty-recomp
.venv/bin/python tools/test.py --native-test native_order_crt_name_tests --jobs 1
```

The static audit verifies the pinned executable before reading thirteen heap
selection, allocation, free and name-helper instruction sites. It also checks
the original HeapCreate/HeapAlloc/HeapFree import identities. Native evidence
is `output/native-order-crt-names-observed.json`, with the copied final CTest
log and source hashes. Four focused builds ran sequentially as compatibility,
live-alias and cleared-address reuse controls were added; none overlapped.
Both copied checkpoints and served WASM identity remain unchanged. No browser
or WASM launch ran; the app crash remains unresolved and suspension continues.
