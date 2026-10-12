# Original actor restoration before exposure

The game-owned `native_actor_stage.h/.cpp` adapter is implemented and configured
for native compilation. An isolated native fixture passes 64 healthy cycles and
one controlled stopped-construction cleanup. It targets the
pinned living vehicle class, two-component UNIT container version 0, PRIMARY version 9 and vehicle
secondary state. It does not publish or activate restored actors.

Four scoped SDK wrappers guard PRIMARY admission, the original factory,
registration and cell dispatch. The factory still runs the original complete
class constructor, with its world argument changed to zero. Registration is
recorded without assigning an identity/world or inserting into registry groups.
The original parented cell branch runs only when the audited branch has no
spatial effects. The parentless branch preserves scalar cell coordinates while
deferring grid removal/insertion and the global observer. Later publication
must separately qualify those effects; suppressing them during preparation does
not prove correct live world integration.

The scope requires the guest baton, owning thread, no active hook frame, the
pinned component/factory tables and a caller-verified immutable living record.
It admits one read attempt. Failed original reading retains the captured object
pointer for explicit cleanup; hook removal and object cleanup are caller duties.
No destructor silently removes hooks or guesses ownership after interruption.
The failure control deliberately mismatches the expected player, captures the
complete original constructor's object, cancels at registration admission,
removes hooks and invokes original deletion. Heap/pool totals, source lookup,
both identity counters and guard depth recover before all 64 healthy retries.
This qualifies that cancellation boundary, not arbitrary constructor failure
or interruption during secondary/order loading and destruction.

The opt-in native streaming fixture composes this adapter with the qualified
private order reader. It alternates 32 original parented records and 32 private
parentless controls. Each must restore all original PRIMARY/secondary bytes,
with the record's own saved ID normalized to zero for private construction,
load/transfer/clear three empty order banks, execute the original deleting
destructor, recover runtime heap totals and original pooled-allocation counts,
remove all diagnostic hooks and preserve the source actor and world counters.
This earlier checkpoint covers one selected configured actor with empty order
banks. The subsequent [matched populated stage](native-actor-populated-stage.md)
passes four actual saved vehicles and their commands while retaining journal
ownership through original cleanup. Destination references/navigation/clocks,
interrupted full-actor cleanup and live publication remain unqualified.

The original writer also computes parented cell coordinates through its world
association. The first executing fixture restored its actor but faulted at that
lookup during serialization, before completing the cycle. The diagnostic now
wraps only the original cell getter for the exact private actor under the
writer's own guarded invocation. Matching parent/flag state is required, and
the original getter evaluates through the registered source actor's read-only
parent context. Its one expected invocation is checked. The private actor keeps
zero world/ID fields throughout. This source-region serialization support does
not qualify destination parent binding or production serialization.

The original PRIMARY method `005bfe50..005c0b00` is declared as a curated game
entry. Official regeneration now records a hookable entry with configuration
provenance instead of a non-hookable data block. The extended executable audit
passes 12 methods, 48 instruction anchors and seven virtual slots, including
the original writer and parent-resolving getter; all five configuration checks
pass. These are static/configuration results only.

The previous corrected native run loaded its isolated kingdom successfully but
the stage fixture stopped at hook admission before constructing an actor.
`output/native-actor-stage-hookability-initial.log` preserves that failure. A
successful native host exit did not qualify the stage fixture. Attempt 003
preserves the parent-lookup failure. Attempt 004 first passes all healthy cycles;
attempt 005 also passes the stopped-construction control and healthy retries.
The official single-job smoke builds and those native sessions are terminal.

After the actual native session is observed terminal, record its exit code in
its manifest and run:

```sh
python3 scripts/check-native-actor-stage.py output/native-actor-stage-attempt-005.json
```

The verifier requires all 64 complete trial records and every invariant, the
original loaded-world completion, continued native captures, source profile
hashes and unchanged fixture GMP. It cannot launch a game and refuses a manifest
without an observed terminal session. The current result is retained in
`output/native-actor-stage-observed.json`; earlier healthy evidence remains
separate. Native test
fixtures must remain under new owned `actor-arrival-fixture-stage-*` directories;
preserve earlier logs/profiles and the original copied source.

The final original-order regression passes 420137 checks / 201 trials / 6310
native calls / 1892 allocation hooks with zero failures. Its adapters now come
from the production-configured native sources, so this also checks the changed
link arrangement. The retained CTest log is
`output/native-actor-stage-final-order-regression-ctest.log`.

Browser/WASM game launches and inspection remain suspended because the host-app
crash is unresolved. No WASM build/staging, continuous world paging, browser
resource bound or independent WAN gameplay is qualified by this work.
