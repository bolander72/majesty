# Bounded native cache retirement plans

`web/world/native-cache-retirement.mjs` provides a read-only plan for retiring
cached rectangles by an explicit set of native keys. This is the next component
toward removing native regional state after checkpoint publication. It is
**not installed as a game hook** and does not establish complete region unload.

Subsequent [whole-world residency work](native-world-residency.md) observes the
original dispatcher actually freeing world/navigation roots across three native
loads. It does not install this modeled cache plan or qualify continuous paging.

The [cache lineage](native-listener-cache.md) and
[consumer audits](native-cache-consumers.md) establish the pinned layout:
collection head/count at `+8/+12`, 36-byte nodes with next/previous links at
`+0/+4`, embedded value at `+8`, rectangle words at `+12..+24`, key at `+28`
and metadata at `+32`. The accepted value/collection tables are `0068a8e0` and
`0068a8e8`. Other live types are rejected rather than interpreted with this
layout. The original constructor allocates a 36-byte sentinel; overlap checks
reserve its entire extent, including the uninitialized bytes beyond its links.

The planner reads serially, checks both sentinel links and every backlink,
rejects cycles, incorrect counts, overlapping storage, address overflow and
unexpected value tables, then prepares only changed surviving links, sentinel
links and count. It selects **all** records with retiring keys, preserving the
original order and first-match behavior of every surviving key. Retired records
include their raw rectangle words and metadata for a future repaint step;
planning does not issue drawing notifications.

The cap is 512 cached nodes and 512 distinct retiring keys. A capture reads at
most 18,456 bytes in 514 requests, each no larger than 36 bytes. Plans retain
immutable numeric copies, never a source memory view or its underlying heap.
These describe captured payload and request bounds, not measured JavaScript
heap or browser memory. The 512-node cap is a planner admission limit; there is
no installed engine registration cap.

Preflight re-reads every captured word, including all surviving payloads, and
rejects any change. This is not an atomic update or a synchronization primitive.
A future native consumer must hold the stopped world's exclusive lease through
capture, preflight and mutation, establish the collection/key ownership of the
retiring region, invalidate affected drawing, splice the surviving links,
destroy embedded values with flag zero and free their nodes. It must also
preserve dispatcher membership, reciprocal peers and all other actor/script
references. A supplied key list is not proof of regional ownership; collisions
with keys still needed by an active region must be resolved before using a plan.

Eight focused JavaScript tests pass. They compare all 256 retirement subsets of
an eight-node list with an independent surviving-order oracle, cover repeated
keys, empty/all/missing matches, the maximum capture, corruption, source changes,
immutable plans and forged-plan rejection. All 262 workspace JavaScript tests
pass.

An isolated CPU fixture applies three plans only to 512-byte synthetic guest
images and replays each under two stack-fill patterns. The pinned original
first-key reader `005c7a50` and updater `005c7a00` retain their expected behavior
after retirement, including unchanged output on a missing key and changes only
to the first surviving record's rectangle. Original embedded-value destruction
`005c7810` with flag zero preserves the other node bytes. Its initial deleting
vtable slot and the constructor's sentinel allocation/table are checked against
the pinned executable; that constructor is not executed. Retired-node disposal is
**modeled**, not an execution of the game's CRT free.

The fixture completes 66 original calls / 1,806 original instructions, with at
most 65 instructions per call. Only one 16,384-byte guest mapping set exists at
a time; all mappings are explicitly unmapped and checked empty after each case.
This is a controlled guest-address bound, not process RSS or browser/GPU memory.
It does not execute a running game, renderer, worker or WASM build, and does not
modify saves or profiles.

```sh
node --test tests/native-cache-retirement.test.mjs
node scripts/prepare-native-cache-retirement-fixtures.mjs
upstream/majesty-recomp/.venv/bin/python scripts/check-native-cache-retirement.py
node --test tests/*.test.mjs
```

Evidence is in `output/native-cache-retirement-focused.log`,
`output/native-cache-retirement-workspace.log`,
`output/native-cache-retirement-fixtures.json` and
`output/native-cache-retirement-emulated-observed.json`. The planner is source
only and is not imported by the player. Live collection identity, key provenance,
repaint/notification effects, actual allocator reuse, complete detach and native
simulation paging remain unfinished. App crashes remain unresolved and game/
browser launches remain suspended. The full cooperative/expanding-world goal
stays active.
