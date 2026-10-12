# Scoped native order allocation claim controller

The JavaScript profile now includes the real empty-name copier's one-byte
allocations. `interceptName` matches return PC `00523485`, size one and EBX's
destination field: order +36 for base names, +76 for kind 2/6 leaf names and
+72 for kind 5/11 leaf names. Successful node loading requires all applicable
names; failed reads keep unused storage owned for cleanup. All 24 focused
planner/reservation/bridge tests pass. [Native name storage](native-order-empty-names.md)
records the separate compiled qualification and current limitations. Counts
and original-CPU frame replays below describe the historical controlled-name
profile; they have not been rerun against the current JS profile.

The JavaScript controller below is now complemented by a
[game-owned native allocation controller](native-order-allocation-component.md).
The private compiled bank fixture uses that native controller instead of its
former inline matcher. It passes 172954 checks across 196 original-code trials;
519 focused native scope checks also pass. Production actor arrival remains
disconnected, and the older counts/reports below are historical.

`web/world/order-allocation-bridge.mjs` now translates the original allocator's
verified call sites into claims on the [reservation journal](native-order-reservations.md).
Its decisions match all 1280 recorded allocator requests from 186 bounded
original-code scenarios, including six interrupted reads. The controller is
source code for a future native adapter; no production hook or native/WASM
import path connects it to execution. A separate isolated constructor fixture
now verifies the real allocator hook for the sentinel role.

Twelve pinned return PCs identify the initial-profile requests:

| Role | Allocator return PC | Request |
| --- | --- | --- |
| Bank sentinel | `005e4c71` | 12 bytes |
| Order kind 1 | `005da543` | 88 bytes |
| Order kind 2 | `005da579` | 92 bytes |
| Order kind 4 | `005da5e5` | 100 bytes |
| Order kind 5 | `005da61b` | 92 bytes |
| Order kind 6 | `005da651` | 92 bytes |
| Order kind 7 | `005da687` | 72 bytes |
| Order kind 10 | `005da6f3` | 76 bytes |
| Order kind 11 | `005da729` | 112 bytes |
| Kind-4 path | `005e0e39` | Saved capacity times 8 |
| Kind-7 path | `005e2b61` | 80 bytes |
| Bank list node | `005e4dc9` | 12 bytes |

`scripts/audit-native-order-allocation-sites.py` checks the pinned executable
hash and every preceding direct call to `0064c616`, plus the eight factory-size
push instructions. It verifies the static kit `mods_hook_return` contract:
return PC from `[ESP]`, then `ESP += 4 + arg_bytes`. The bridge supplies
`argBytes: 0` for this cdecl allocator. The audit does not execute the live
hook dispatcher or prove that a translated call reaches a newly installed hook.

Construction and reading use explicit per-invocation tokens. Inactive calls and
calls tagged with another invocation delegate normally. Within an owned scope,
the controller checks phase, bank order, entry order, kind, byte count and exact
reserved identity. Sentinel allocation must have the current bank in ESI; path
allocation must have the pending order in ESI; node allocation must have that
bank's sentinel in ESI. Equal-size kinds 2/5/6 cannot borrow one another's slots.
The bank object itself is claimed before direct construction, so the unchecked
UNIT getter's 20-byte allocation is not used here.

Each constructor must consume its sentinel and return its reserved bank address.
All banks are constructed before reads begin. An entry must acquire its required
path and list node before another factory entry can start. A successful read must
consume all expected entries, and complete bridge acknowledgment also requires
every journal slot to be claimed. This acknowledgment covers allocation claims,
not complete command semantics, actor activation or safe publication.

A failed kind-4 read before saved-capacity consumption may request zero while
its planned path reservation is positive. With a nonzero stream status, the
controller returns zero for that failed request and retains the unused reserved
path for cleanup. Bank completion then fails; further reads and overall
completion reject. A canonical successful zero-capacity path instead consumes
its real zero-byte slot. An observed stream failure cannot be hidden by a later
zero bank result. Claim mismatches poison the owned scope and throw; the native
adapter must stop that invocation **before another guest instruction**, rather
than turning the error into null for unchecked original code.

The native adapter must obtain tokens from the originating stopped invocation,
not attach the active token to unrelated threads or callbacks. It must remove
the hook and establish that the invocation has stopped before closing the bridge
and releasing its journal. The controller registers no hook, controls no guest
thread, walks no native lists and allocates no guest storage itself. Those native
integration and exception-boundary guarantees remain unfinished.

An [opt-in native stop boundary](native-guarded-order-loading.md) now compiles
and passes 1,066 focused C++ checks with invocation cookies, CPU/FS restoration
and exception-landing cleanup. It remains disconnected from this controller.
Explicit cancellation is separate from journal rollback, and original guest
nonlocal exits and full graph cleanup still require auditing. An isolated
original-constructor fixture passes 184 checks through the real allocator and
root hooks; it also fixes normal callback cleanup. This does not connect the
controller or qualify complete order-bank reading.

A separate [compiled bank fixture](native-bank-read-hooks.md) now passes 147121
checks over all copied initial bank profiles, all twelve real allocation hook
sites, owned allocation refusals and sticky stream failures. It uses controlled
stream/name/manager helpers and its own test matcher. This qualifies those
private native graphs without connecting this JavaScript controller or proving
live actor restoration.

The original-CPU runner now records bounded malloc frames: phase/bank, return PC,
requested bytes, ESI, stream status and returned address. Original instruction
behavior is unchanged: 1644 completed calls / 274066 original instruction visits,
106496-byte peak guest mappings, zero mappings after each case, and a 556-byte
peak modeled request total. Recording frames increases evidence JSON to 803244
bytes, still below the one-MiB cap. No new native game or build is involved.

`scripts/replay-native-order-allocation-bridge.mjs` creates journals from the
unchanged copied checkpoints, uses the original fixture's bounded allocation
layout, and replays the recorded frames through the JavaScript controller.
Every returned allocation address and zero-byte cdecl cleanup decision matches. All 89 copied
actors pass under both stack fills, plus two synthetic kind-1 trials and six
interrupted reads. The two failed-capacity zero requests are observed explicitly.
The 28 pre-native reservation-failure controls have no native frames and are
excluded from claim replay; their reservation/cleanup evidence remains separate.

The replay releases every modeled journal and preserves copied-file hashes and
identities. It reads at most 4 KiB at a time, with per-file 64 MiB / 32768-request
limits. Total serial I/O is 11535038 bytes. It retains eight compact samples and
no runtime world catalogue. The replay does not invoke a real native allocator,
hook-return implementation, original world manager or live actor.

Eight focused tests and all 329 workspace JavaScript tests pass. Tests cover
scoped delegation, all initial kinds, exact pointer ownership, equal-size kind
conflicts, missing/repeated/premature claims, constructor/read ordering,
interrupted capacity reads, hidden stream failure, invalid frames and successful
zero-capacity paths. Prepared-copy revalidation, full bank hook integration and
exceptional exits, full actor rollback, destination references/navigation/clocks
and publication still require integration before populated arrivals can run.

```sh
node --test tests/order-allocation-bridge.test.mjs
node scripts/export-native-order-allocation-sites.mjs
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-order-allocation-sites.py
upstream/majesty-recomp/.venv/bin/python scripts/check-native-reserved-order-banks.py
node scripts/replay-native-order-allocation-bridge.mjs \
  output/checkpoint-unit-reference-browser/scions.GMP \
  output/checkpoint-unit-reference-browser/brashnard.GMP
node --test --test-concurrency=1 tests/*.test.mjs
```

Evidence: `output/native-order-allocation-sites-audit.json`,
`output/native-order-allocation-bridge-replay-observed.json`, updated bounded
native claim evidence and `output/native-order-allocation-bridge-terminal-verified.json`.
No browser/game launch or build ran; served artifacts and player data remain
unchanged. App crashes remain unresolved and launch suspension continues.
The full cooperative/expanding-world goal stays active.
