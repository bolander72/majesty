# Compiled original bank loading through real hooks

The newest [private UNIT run](native-order-unit-attachment.md) binds actual
owner addresses, attaches validated banks and executes original UNIT getters,
writing and clearing. All 338401 checks / 198 trials pass; production actor
publication remains unfinished. Earlier runs preserve their original scopes.

The latest [fixed-stream run](native-order-fixed-streams.md) executes original
stream construction, transfers, status and destruction: 251203 checks / 198
trials, including four truncated reads and 180 healthy graph destructions.
Its stream hooks observe original bodies; earlier reports retain their models.

The current [original factory-manager run](native-order-real-manager.md) also
executes singleton initialization, cached lookup and deletion: 204017 checks /
198 trials, including destruction of 180 healthy graphs. The earlier runs below
preserve their historical source identities and controlled-manager scope.

The latest [real empty-name run](native-order-empty-names.md) executes original
copy/zero-clear bodies with typed reserved name storage: 178896 checks across
198 trials, 1700 native calls and 1337 core allocation hooks. Its 704-byte peak
includes real empty names. It now consumes the JS descriptors directly from
the 55908-byte NBO2 input, without adding native-only descriptors. Current
evidence is `output/native-order-real-name-direct-observed.json`. Earlier runs
below retain historical source hashes and describe their original inputs/models.

The [native allocation scope controller](native-order-allocation-component.md)
now replaces the inline matcher in this fixture. The latest run passes 172954
checks across the same 196 trials, 1690 native calls and 1329 allocation hooks.
Current evidence is `output/native-order-allocation-component-native-observed.json`;
the earlier storage and bank counts below preserve their historical runs.

The newer [native ownership component](native-order-storage-component.md) now
backs this fixture. Its current run passes 175167 checks across 196 trials,
1690 native calls and 1329 allocation hooks, including an ordinary nested
original callback. The 147121-check run below and its observed JSON retain
historical source hashes. Current evidence is in
`output/native-order-storage-component-native-observed.json`.

The game-owned `native_order_bank_read_hook_tests` now executes the pinned
original bank constructors, readers, order factory, eight initial leaf types
and writers through compiled translations and the actual mod hook dispatcher.
All 89 copied actor profiles plus one synthetic kind-1 profile load and rewrite
their literal bank bytes under two memory fills. The final run passes **147121
checks**, with **196 trials / 1689 native calls / 1329 allocation hooks**, in
0.63 seconds.

This extends the [original-CPU reservation fixture](native-order-reservations.md)
and [constructor hook fixture](native-guarded-order-loading.md). Stream I/O,
canonical empty-name helpers and the initial factory-manager getter are
controlled native hooks. The real factory and leaf methods execute; the
original allocator body and live manager initialization do not. There is no
game entry, mission, actor publication, scheduler tick or browser launch.

## Input and storage ownership

`scripts/prepare-native-order-hook-fixtures.py` checks the pinned executable,
current evidence source hashes and copied-file hashes. It compares each literal
bank range with the unchanged copied file and exports a 50608-byte private
fixture containing 90 bounded profiles. It adds the previously qualified
synthetic kind-1 payload because that type is absent from the copied profiles.
The private input and observations are not game assets to distribute.

The C++ runner reads one actor at a time into fixed host arrays: three payloads
of at most 2048 bytes and at most 32 reservation descriptors. Requests total at
most 2048 bytes per actor. Every positive extent is allocated before the first
original instruction; zero-byte paths retain a zero address. The allocator hook
checks exact return PC, phase, bank/index/kind, size and receiver identity before
claiming a reserved extent once. Node receivers are sentinels, path receivers
are orders, and sentinel receivers are banks. Equal-size types remain distinct.

All twelve pinned sites execute through the real allocator hook. Valid loads
consume every reservation, preserve list membership/tail/count invariants and
rewrite the exact saved bytes. Native reservations are released in reverse order
after execution stops. Block and rounded-byte totals return to baseline after
every trial. The largest observed private actor journal adds **640 rounded guest
heap bytes**, under a 4096-byte test cap. The manager/stream fixture has fixed
separate storage. These metrics exclude host metadata, the mapped executable,
the reserved guest arena, browser memory and a running world.

## Failure controls

Twelve trials deterministically refuse one owned allocation, one for each
pinned return site. These are controller-refusal controls, not real allocator
OOM. Each accepted guarded cancellation skips the following callback statement;
the refused extent remains entirely untouched. Earlier private writes remain.
Hook/view/profile/callback/FS state is checked, and the whole journal is released
without calling an unsafe bank destructor or publishing any actor.

Four additional trials interrupt a copied bank whose first entry is kind 4,
under both memory fills. The controlled primitive read is all-or-none with
sticky status 7. Failure occurs after the discriminator or four bytes before
the bank end. A zero-byte path request following early failure can return zero
while its positive reservation stays unused and journal-owned. Both early
failure cases execute this zero-request branch and leave the reserved path
buffer untouched. Valid partial
list links and counts are checked; failed loads never proceed to writing or
completion, and every reservation is released.

All five builds ran sequentially with one job and reused the generated
archive. Compilation and the selected CTest entry used the official game tools:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/prepare-native-order-hook-fixtures.py
upstream/majesty-recomp/.venv/bin/python upstream/majesty-recomp/tools/test.py \
  --native-test native_order_bank_read_hook_tests --jobs 1
```

The fixture's claim matcher remains test scaffolding. It does not connect the
JavaScript controller to production native/WASM execution. Populated actor
arrival, destination references/navigation/clocks, actual manager/stream/name
behavior, live destructors, active capture-window unwind, arbitrary partial I/O
and original guest nonlocal exits still require qualification. It proves
private initial bank graphs under these controlled prerequisites, not complete
actor rollback, bounded world simulation, full co-op or independent WAN play.

Evidence is in `output/native-order-bank-read-hooks-native-observed.json`,
the copied CTest logs and `output/native-order-hook-fixtures-prepared.json`.
Served artifacts and copied checkpoints remain unchanged; player profiles are
not accessed. The app crash remains unresolved, browser launch suspension
continues and the full goal remains active.
