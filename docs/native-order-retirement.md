# Tracked original destruction of private order banks

The subsequent [fixed-stream run](native-order-fixed-streams.md) executes
original stream construction/transfer/status/destruction as well as the manager:
251203 checks / 198 trials pass with the same healthy graph cleanup.

The subsequent [original factory-manager run](native-order-real-manager.md)
removes the modeled getter and passes 204017 checks / 198 trials. The counts,
controlled-manager scope and report below describe the earlier retirement run.

The game-owned storage journal now has an explicit guarded cleanup phase.
`invoke_cleanup` requires every initial claim before its first invocation.
Once cleanup begins, loading invocations and claims stay disabled. The caller
must separately establish that the graph and destructor are safe; complete
claims alone do not prove successful reading, actor publication or rollback.

`retire(request, address)` requires the current cleanup guard's authority, an
exact typed descriptor, its exact positive address, and a claimed owned extent.
It calls the nonthrowing allocator port and removes ownership only after a
definitive successful free. Duplicate/wrong claims, ordinary nested callbacks,
out-of-scope calls and reentry during a pending free reject. A definite refusal
leaves storage owned for retry or stopped whole-journal release.

If guard cancellation skips a pending free's return, the journal cannot know
whether the side effect happened. It records that address/size as untrusted,
latches `AllocatorViolation`, blocks further invocations and skips that extent
during release. Other trusted storage can still be reclaimed. This avoids a
second free in both tested interruption cases: before and after the side effect.
Only explicit external reconciliation resolves the uncertain allocation;
zero trusted owned bytes does not mean that uncertainty is resolved. Original
nonlocal exits that bypass the whole checked return remain unqualified and
leave the journal pinned.

The compiled original-bank fixture now removes each loaded order through
`005e4f90`, including its original virtual deleting destructor, then deletes
the emptied banks through `004abce0`. The actual original CRT free body runs
through the SDK original-call path. Its port checks that the exact standalone
runtime allocation is no longer owned before retiring the ledger record. A
successful graph has zero journal-owned bytes before fallback release, so
fallback cleanup performs no second free. Incomplete loading controls still
use stopped raw-extent rollback, without traversing partial graphs.

Original CRT initialization naturally selects mode 3 under the current guest
Windows policy. A real empty-name copy/clear warms its persistent pool before
owned trials. That process storage is part of the baseline. Stream primitives
and the initial factory-manager getter remain controlled; initial object/name
allocation returns reserved runtime extents. Actual removal, all eight order
deleting-destructor chains, bank destruction and CRT free execute.

Current qualification:

- **1184 ownership checks:** cleanup admission, irreversible loading shutdown,
  exact retirement, hidden child authority, definite refusal/retry, duplicate
  prevention and uncertain-free cancellation on both sides of the side effect.
- **831 scope checks / 24 controlled dispatch trials:** allocation/guard
  regressions after the journal change.
- **204946 compiled bank checks / 198 trials:** 180 healthy graphs originally
  destroyed, 850 removal/bank-delete calls and 2308 tracked CRT frees. All 89
  unchanged copied actor profiles plus one synthetic missing kind-1 profile
  pass under both memory fills. Twelve allocation refusals, two name refusals,
  four sticky stream failures and two failed zero-path requests remain covered.

There are 2554 native calls including four CRT setup/termination calls. Each
private trial returns guest heap blocks and bytes to its baseline. The largest
actor journal delta remains 704 rounded guest heap bytes, excluding CRT pool,
host metadata, executable, arena and browser. These numbers do not establish
complete world memory bounds. Published actors, arbitrary nested deallocator
callbacks, destination references/navigation/clocks and full actor rollback
remain unqualified; production arrival is still disconnected.

Reproduce sequentially through the official game tools:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-order-retirement.py
cd upstream/majesty-recomp
.venv/bin/python tools/test.py --native-test native_order_storage_tests --jobs 1
.venv/bin/python tools/test.py --native-test native_order_allocation_tests --jobs 1
.venv/bin/python tools/test.py --native-test native_order_bank_read_hook_tests --jobs 1
```

The static audit verifies five instruction sites, eight order deleting-vtable
entries and the bank delete target after checking the pinned executable hash.
Current evidence is `output/native-order-retirement-observed.json` and its copied
focused CTest logs. Four focused builds ran serially with one job; final bank
CTest took 0.63 seconds. No generated source changed, no browser/WASM/game entry
ran, and both copied checkpoints and served WASM identity remain unchanged.
The host-app crash is unresolved and browser testing remains suspended.
