# Reusable original order-reader hooks

The subsequent [private actor admission work](native-actor-publication-boundary.md)
adds identity/world and pinned-site checks. Counts and source identities below
describe the preceding hook integration checkpoint.

The subsequent [original actor staging fixture](native-actor-stage.md) now
consumes this adapter for three empty banks after private full UNIT loading.
The order adapters are configured native sources, and the focused CTest links
them from recomp_gen. All 201 original order trials still pass. Populated
full-actor integration and live arrival remain unfinished.

The private original-code restoration fixture now calls game-owned `ReaderHooks`
from `native_order_hooks.h/.cpp`. It no longer implements the owned allocator,
name allocator or bank constructor/read interception inside its test helper.
Those four runtime-owned SDK hooks share existing observers through wrapping
mode and delegate unrelated calls to the original chain. Runtime callbacks
receive no mod API context; the adapter uses the direct SDK functions.

The controller supplies its own journal identity. Installation, reading and
removal require the reserving thread and guest execution baton; mutation is
refused inside hook dispatch or an active journal invocation. The adapter cannot
be copied or moved while installed. Its caller must retain it, its controller
and its journal outside frames skipped by guest cancellation, and explicitly
remove every handle before destroying that storage. Failed installation removes
its prefix; any failed removal retains its handle for explicit retry.

All **201 native trials / 420023 checks / 6310 top-level calls** pass. This includes
180 healthy restored graphs, 90 complete original private vehicles, 15 allocation
refusals, two name refusals and four truncated input cases. The original class
constructors/deleting destructors and all 450 tracked pooled allocation frees
still execute. Every trial removes exactly its four hooks while retaining the
fixture's other hooks, restores heap/pool baselines and leaves no callback,
hook or view depth. Attempts to mutate hooks and recursively enter the reader
from allocation callbacks refuse before consuming another claim. An ordinary
nested original callback also cannot remove the active scope.

A real SDK capacity control fills the name allocator chain, forcing installation
to fail after publishing the first core allocator hook. The adapter removes that
prefix, preserves all foreign handles and admits a subsequent clean installation.
Additional controls refuse installation with mismatched constructor sites,
unregistered host-thread operations, duplicate installation and reads before
installation or with a null CPU.

Two integration failures were corrected before qualification. The SDK's exclusive
replacement mode conflicts with pre-existing allocator observers; wrapping mode
shares that chain. Stream wrapper `+4` alone omits the virtual C++ `ios` state.
The adapter now projects original status method `004ef6c0..004ef6e2` through
checked guest addresses and its virtual-base displacement without an extra guest
callback. Ten additional executable instruction anchors pin that projection.
The expanded stream audit checks 12 complete methods / 25 instruction sites;
truncated kind-4 paths retain the original failed-zero allocation behavior.

Reproduce from the game directory:

```sh
.venv/bin/python ../../scripts/audit-native-order-streams.py
.venv/bin/python tools/test.py --native-test native_order_bank_read_hook_tests --jobs 1
```

Evidence is `output/native-order-reader-hooks-observed.json` and its copied CTest
log. Previous full-vehicle reports preserve historical source identities.
The adapter is now also configured among the game's native sources and used by
the [private actor staging fixture](native-actor-stage.md), followed by the
[matched populated actor fixture](native-actor-populated-stage.md). These later
checkpoints qualify private PRIMARY/secondary state and selected command
composition. World/GPL registration, active callbacks, destination references,
navigation, complete timing semantics and full actor rollback remain open.
Populated production arrival, continuous world paging,
independent internet gameplay and whole-browser resource bounds remain unfinished.
No browser launch, WASM build or staging occurred. The host-app crash remains
unresolved and browser/WASM testing stays suspended.
