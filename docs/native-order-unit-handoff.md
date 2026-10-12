# Transferring restored order ownership

The subsequent [complete private vehicle lifecycle](native-order-full-vehicle.md)
extends this fixture with original vehicle construction and CRT pool accounting.
That qualification now passes; the results below retain the previous checkpoint.

The guarded UNIT reader can now relinquish its reservations to the exact private
UNIT that successfully loaded them. `AllocationBridge::handoff_unit_orders`
requires the complete native-name budget, the same reservation revision, expected
UNIT table, and all three bank fields still pointing to the journal's claimed,
owned banks. It refuses before loading, during guest execution, after failed
loading, after cleanup begins, for another UNIT, and after a previous handoff.
Wrong tables or changed fields refuse without consuming ownership, so the caller
can restore its stopped private fields and retry.

The journal enters `Transferred` without a guest call, allocation or free. Its
later `release` does not free engine-owned blocks. Claims and journal cleanup
calls are disabled. A new reservation invalidates the old controller even if a
caller constructs matching UNIT fields and claims every replacement block.
Callers must validate graph semantics and qualify their allocator's compatibility
with original destruction before handoff. This API does not validate destination
references, navigation or clocks, construct a complete actor, publish it, or
activate scripts. Original cleanup cancellation/nonlocal exits remain unqualified.

The original-code fixture exercises both ownership paths across the same 90
inputs: 89 copied actor order attachments plus one synthetic kind-1 case. One
pass retains the journal and individually removes orders through original
destructors; the other hands ownership to the UNIT and drains each bank through
original `005e4ff0`, then deletes it with UNIT method `005b2de0`.

A stronger trial initially tried deleting populated banks directly. It failed:
the original base bank destructor `005e4cc0` removes list nodes and its sentinel,
but leaves their orders alive. The failure is retained in
`output/native-order-unit-handoff-bank-full-clear-initial-ctest.log`. The pinned
static audit confirms that distinction and the actual drain's virtual removal
lineage. Concrete vehicle banks dispatch removal to `005e5350`, which can invoke
the callback dispatcher before reaching base removal. The passing private input
cases do not qualify arbitrary active callback effects or destination bindings.

Final original-code results: **373505 checks, zero failures, 201 trials, 6125
top-level native calls**. All 180 healthy graphs serialize identically. Cleanup
uses 965 top-level calls: 1154 original CRT frees retire journal reservations,
and another 1154 original CRT frees reclaim the 90 transferred graphs. Every
positive transferred reservation is freed exactly once; journal release before
engine cleanup leaves guest heap totals and extents unchanged. All trials return
to their retained guest heap baseline with null UNIT bank fields and intact
scratch canaries. The 450 changed-owner refusals and one stale-controller control
pass, alongside existing allocation/name/truncation refusals.

The focused allocation suite passes 1183 checks across 32 dispatch trials,
including handoff refusal during execution and for the controlled-name budget.
The storage suite checks unchanged reserve/rollback/retirement behavior. All
builds use the official game tools, one job and one process at a time. No generated
translation edits, browser launch, WASM build or staging occurred.

Current evidence is `output/native-order-unit-handoff-observed.json`, three copied
CTest logs and build logs, and `output/native-order-unit-handoff-cleanup-audit.json`.
The previous UNIT reader report retains its historical source identities. Reproduce
the focused tests sequentially from `upstream/majesty-recomp`:

```sh
.venv/bin/python tools/test.py --native-test native_order_bank_read_hook_tests --jobs 1
.venv/bin/python tools/test.py --native-test native_order_allocation_tests --jobs 1
.venv/bin/python tools/test.py --native-test native_order_storage_tests --jobs 1
```

This closes the initial ownership handoff gap. Complete actor construction and
arrival consumption, destination references/navigation/clocks, live region
cutover and continuous terrain streaming remain unfinished. The measured
704-byte sample journal heap peak excludes UNIT/stream scratch, CRT process
storage, host metadata, executable/arena and browser resources. It does not
establish whole-world/browser memory bounds or independent WAN gameplay.
Browser/WASM testing stays suspended during the unresolved host-app crash.
