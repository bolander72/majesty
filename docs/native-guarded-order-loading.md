# Native stop boundary for unpublished order loading

The allocation claim controller rejects mismatches rather than returning null
to original code that dereferences allocations without checking. The kit now
contains an opt-in `guest_call_guarded` boundary for the future native adapter.
The native boundary compiles and passes **1,066 focused native checks**, including
active exception landings. A game-owned fixture additionally passes **184 checks
through the original bank constructor and real hooks**. No production allocation
adapter is enabled; live actor loading and graph rollback remain unqualified.
Browser/WASM launches remain suspended after app crashes.

The existing translated `CALL_FN` macro consults `recomp_hooked` and dispatches
through `recomp_hook_ptrs` when hooks are enabled. That source path gives the
allocator interception a route now verified for private bank construction in
the isolated native fixture. The JavaScript
[claim controller](native-order-allocation-bridge.md) remains disconnected from
native/WASM execution.

## Explicit stop contract in source

The new generic kit API reports `Returned`, `Cancelled`, or `InvalidCall` plus
EAX. It writes a new, non-reused invocation cookie to caller-owned host storage
before entering the guest. The cookie is eligible only in the same host thread,
on the exact originating `X86`, at the innermost guarded callback. An ordinary
nested callback hides its guarded parent. Rejecting a wrong/stale/foreign cookie
has no effect. An accepted cancellation jumps to that checked caller and cannot
return to the rejecting allocator callback's next instruction.

Cancellation uses the existing callback `setjmp`/`longjmp` machinery. It unwinds
hook state to the saved caller ESP, rather than the pushed return slot: the
latter would leave a hook on the first guest instruction active. It truncates
profiling and scheduler atomic scopes, including nesting above the scheduler's
eight-slot ESP-marker array. At the checked caller it discards owned exception
records and a pending transfer introduced during the invocation, restores all
modeled CPU fields and restores the physical FS chain head. A preexisting
pending exception transfer rejects entry. Normal return keeps normal register
changes and the existing callback ESP/EIP restoration behavior.

Checked entry also rejects a callback chain containing another `X86` CPU. Hook
cleanup compares ESPs, and different CPU stacks cannot be ordered that way.
Ordinary foreign-CPU callbacks keep their existing behavior, but a new checked
call inside a mixed chain rejects before dispatch, stack writes or cookie
allocation. Regressions cover direct foreign entry and attempted guarded reentry
from a foreign ordinary callback. Guest stack pivots within one CPU still require
an audit of the intended original loading path before integration.

The CPU snapshot lives in the outer wrapper, outside the function executing
`setjmp`, so cancellation does not read modified automatic locals whose values
became indeterminate. Ordinary callbacks take no full CPU snapshot and consume
no cookie. All addresses remain guest offsets; the public API adds no
Majesty-specific literal or dependency.

## Ownership limits before integration

Stopping execution does **not** undo guest memory writes, release a reserved
extent, undo I/O, restore world-manager state or destroy an actor. The native
adapter must retain its unpublished reservation journal outside skipped frames
and clean it up after a confirmed stop and hook removal. It must explicitly
associate its own written cookie with its claim controller; reading whichever
cookie happens to be active would wrongly adopt unrelated work.

Host frames skipped by `longjmp` must have no C++ objects that require
destructors. Existing original guest `_longjmp` and SEH exits retain their own
behavior; they may escape the checked call without producing a guarded result.
Those exits, stale original jump-buffer records, capture-window cleanup,
scheduler baton ownership, and unpublished graph cleanup need
auditing and actual native tests before this boundary can be used for actor
publication. This addition is an explicit stop mechanism, not a general
transaction or a claim that every exceptional path is safe.

## Focused native regression suite

`kit/runtime/tests/guarded_call_tests.cpp` is registered as a focused `nogame`
CTest entry with a 30-second timeout. Its test dispatcher runs actual runtime
import/callback/exception/atomic/profile helpers over synthetic callbacks; it
loads no original PE or game map. Hook unwind is a spy rather than the real
hook dispatcher. Cases include:

- Normal stdcall result and callee register changes; the ordinary callback
  sentinel's nonlocal return remains a normal completion.
- Invalid entry inputs reject before stack writes or dispatch.
- Explicit stops skip the following callback statement and restore every
  modeled CPU field, FS head, inherited exception frame, atomic/profile depths
  and callback depth over 32 repetitions.
- A real pending unwind created inside the callback is cleared. Attempting a
  new checked call during that pending transfer rejects without changing it.
- Atomic nesting nine levels deeper than the inherited scope is discarded.
- Nested guarded, ordinary and foreign-CPU callbacks reject parent cookies;
  another host thread cannot use an active cookie.
- Mixed-CPU checked entry rejects with unchanged CPU state and zero output
  cookie, preserving the parent's eligible scope.
- A guest-memory marker persists across cancellation, documenting why the
  separate allocation journal remains necessary.
- Cancellation after an owned exception landing has returned to its checkpoint
  clears the stored landing pointer. A checked callback inside an older landing
  preserves that landing, which then completes normally.

The official test tool now accepts `--native-test NAME` and builds only that
named binary before running its exact CTest entry. This mode defaults to one
build job, rejects invalid names/nonpositive jobs, fails promptly on a busy
build lock, and treats an absent CTest entry as failure. Eight lightweight Python
tests cover selection and failure handling, including avoiding a stale binary
after build failure and avoiding broad-suite fallback on an empty name.

```sh
upstream/majesty-recomp/.venv/bin/python upstream/majesty-recomp/tools/test.py \
  --native-test guarded_call_tests --jobs 1
upstream/majesty-recomp/.venv/bin/python -m unittest discover \
  -s upstream/majesty-recomp/kit/tests -p test_test_py.py -q
```

The native test passed all 1,066 checks with zero failures in 0.36 seconds
(0.37 seconds total CTest time). Three sequential builds used one job each.
The second added active-landing cases; the third checked mixed-CPU admission. No broad
native suite, original PE/game, graphics window, audio device or browser was
launched. The test reserves the usual guest arena lazily and touches synthetic
frames, bounded shim data and its small memory marker; these checks do not
establish live game or browser memory use.

Evidence is in `output/native-guarded-loading-mixed-cpu-build-tests.log`,
`output/native-guarded-loading-tool-tests.log` and
`output/native-guarded-loading-native-observed.json`. The preceding
`output/native-guarded-loading-source-observed.json` records the earlier unbuilt
stage and is historical. Served artifacts and copied checkpoints remain
unchanged; player profiles were not accessed. The crash remains unresolved and
the full co-op, WAN and expanding native-world goal remains active.

## Original constructor and real hook regression

The game-owned `tests/native_order_bank_hook_tests.cpp` adds a focused fixture
for the pinned executable's bank constructor and actual allocator hook. Its
symbol metadata marks both entries hookable. It reserves one private bank and
one sentinel before dispatch, checks the allocator's return PC, size and bank
identity, and supplies the owned sentinel through the real hook-return API.
A deliberately wrong size requests guarded cancellation before the original
code can consume the allocation. Additional cases wrap the constructor itself
to check normal completion and cancellation against real hook, view and
attribution state while preserving an inherited disabled view.

The fixture maps the original executable but calls no entry point, mission,
actor publication or renderer. Its six trials cover guarded success and
cancellation, plus ordinary success, each with and without a constructor wrap
and after hook. Allocation requests reach the actual mod dispatcher and the
hook-return API substitutes a previously reserved sentinel; the original
allocator body does not execute. Wrong-size cancellation stops before sentinel
writes, while an earlier bank-byte write remains, demonstrating why separate
ownership cleanup is necessary. The original constructor leaves the sentinel's
unused payload untouched.

The first compiled run found three failures: normal completion skipped the
rest of a root wrap and left its hook/view state and attribution live. The kit
now lets a callback's own root hook finish its wrap/after phases before the
sentinel exits `guest_call`. Ownership requires the same CPU, entry return slot
and callback depth. Older callbacks cannot defer a nested return; wrong CPU,
slot and depth reject. Explicit cancellation keeps its nonlocal stop behavior.

The final run passes all 184 checks in 0.60 seconds. Both guarded and ordinary
normal callbacks finish their root wrap/after phases. Cancellation skips both;
inherited disabled views survive, hook/view/attribution/profile/callback state
clears, and all private reservations are freed. Each trial reserves two guest
blocks (20-byte bank and 12-byte sentinel), adding at most **48 rounded guest
heap bytes**; trial groups return block and byte totals to baseline. This metric
excludes host allocations, the mapped executable, the reserved guest arena,
browser memory and a live world.

All builds were sequential with one job. The first required 211 steps after
CMake regeneration; the preflight showed only regeneration and did not predict
that count. Subsequent runs reused the generated archive. The unchanged
guarded helper suite also passes its 1,066 checks after the runtime fix.
This constructor fixture remains test scaffolding. A separate
[compiled bank reading fixture](native-bank-read-hooks.md) now qualifies all
twelve allocation sites and copied initial bank graphs with controlled stream,
name and manager helpers. The JavaScript controller's production adapter,
populated actor loading and complete actor rollback remain unfinished.

```sh
upstream/majesty-recomp/.venv/bin/python upstream/majesty-recomp/tools/test.py \
  --native-test native_order_bank_hook_tests --jobs 1
```

Evidence: `output/native-order-bank-hook-native-observed.json`,
`output/native-order-bank-hook-first-build-tests.log`,
`output/native-order-bank-hook-heap-build-tests.log` and the copied CTest logs.
The earlier build-pending record is historical. Served artifacts and copied
checkpoints are unchanged; player profiles were not accessed. Browser/WASM
launch suspension remains in force and the full goal remains active.
