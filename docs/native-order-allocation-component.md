# Game-owned native allocation scopes

The newer [real empty-name qualification](native-order-empty-names.md) adds
typed one-byte name reservations and executes the original name helper bodies.
Current results are 1031 ownership checks, 831 scope checks and 178896 bank
checks across 198 trials. The 519/172954 results below are historical and used
controlled zero-pointer name helpers.

The bank fixture now directly consumes current JavaScript real-name descriptors
from NBO2 input; original typed field pointers and NUL bytes are checked.
Current evidence is `output/native-order-real-name-direct-observed.json`.

`upstream/majesty-recomp/native_order_allocation.{h,cpp}` now owns the native
allocation matching previously embedded in the private bank fixture. It uses
the [storage journal](native-order-storage-component.md) to claim real reserved
guest extents. Construction and reading enter the original methods through
the journal's guarded invocation. The controller supplies the exact CPU scope;
an adapter cannot authorize unrelated calls with a caller-chosen token.

The caller supplies verified constructor/reader entry points and twelve
allocator return PCs. The controller copies this configuration and rejects
missing or duplicated sites. Game addresses remain in the game-owned fixture;
the component and generic runtime contain no pinned executable addresses.
The fresh static executable audit verifies all twelve preceding allocator calls
and the factory size pushes. It establishes instruction provenance separately
from the native hook execution below.

Three bank constructors must finish in order before reading begins. Each must
consume its sentinel and return the reserved bank address. Reads proceed in
bank order, with typed factory claims followed by required path and list-node
claims. Sentinel, path and node receivers must match their reserved bank,
order and sentinel respectively. Unknown callers, wrong sizes/owners/kinds,
repeated claims or missing pieces poison the scope. Equal-size kinds cannot
borrow another kind's reservation.

Owned allocation mismatches return a **Stop** decision. The adapter must cancel
the guarded invocation before another guest instruction; it must not return a
null pointer to unchecked allocation code. The compiled fixture performs this
actual cancellation through the mod hook adapter. An optional nonthrowing,
nonallocating claim policy may refuse exposure before a claim is consumed.
Inactive, foreign-CPU and ordinary nested callbacks delegate without consuming
parent claims. A stopped scope cannot be restarted or acknowledged complete.

A failed kind-4 reader may request zero before consuming its positive saved
capacity. Only a nonzero stream status admits this exception; its positive
path extent remains unclaimed and journal-owned. Successful zero-capacity paths
claim their ordinary zero-byte descriptor. Observed stream failure remains
latched even if the original bank later returns zero. Completion also checks
all expected entries and every journal claim. These are allocation invariants,
not proof of destination actor semantics or publication safety.

The focused `native_order_allocation_tests` suite passes **519 checks**. Its
16 controlled-dispatch trials cover healthy three-bank claims, ordinary nested
and foreign-CPU delegation, unknown caller, wrong size, wrong receivers/kind,
duplicate sentinel/path, missing path/node/order, policy refusal, explicit and
hidden stream failures, and a bad constructor return. Invalid site profiles,
premature reading, wrong bank order and duplicate construction also refuse
dispatch. Accepted allocation stops skip their successor statement. Request
storage returns to native guest heap baseline.

The updated original-bank fixture passes **172954 checks** across **196 trials,
1690 native calls and 1329 allocation hooks**. It exercises all 89 copied actor
profiles plus the synthetic missing kind-1 profile under both memory fills.
Healthy literal rewrites, list membership/counts, twelve policy refusals,
four sticky stream failures, two failed zero-path requests and one ordinary
nested original getter still pass. Every private journal returns block and byte
totals to baseline, with a maximum delta of 640 rounded guest heap bytes.
Moving matching out of the fixture removes duplicate fixture assertions;
check totals alone do not indicate broader qualification.

Reproduce with the official game tools, one target at a time:

```sh
cd upstream/majesty-recomp
.venv/bin/python tools/test.py --native-test native_order_allocation_tests --jobs 1
.venv/bin/python tools/test.py --native-test native_order_bank_read_hook_tests --jobs 1
```

The original-bank fixture still requires the private pinned executable,
translations and `scripts/prepare-native-order-hook-fixtures.py` input. Its
stream/name/manager operations remain controlled prerequisites. The controller
is not yet in production `game.toml` native sources or connected to live actor
arrival. No production allocator hook is installed by this component. Original
nonlocal exits, live destructors/rollback, destination references/navigation/
clocks and populated publication remain unqualified. The larger world and
independent-internet co-op goals remain unfinished.

Current source/evidence identities and results are in
`output/native-order-allocation-component-native-observed.json`. Earlier
constructor, bank and storage reports preserve historical source hashes.
Three focused builds ran sequentially with one job and no generated translation
edits. No game entry, mission loop, browser or WASM build ran. Served artifacts
and copied checkpoints remain unchanged. Browser/WASM launch suspension stays
in force because the host-app crash remains unresolved.
