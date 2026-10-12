# Grounded actor, restored commands and saved routes

Subsequent [script namespace witnesses](native-actor-script-witness.md) retain
this qualification in attempt 018. [Private script restoration](native-script-stage.md)
in attempt 019 adds 64 separate GPL cycles with matching goals and context ages;
linking those scripts to these private actors remains necessary.

Attempt 017 qualifies **64 private actor/command compositions**, followed by
**64 actual saved-file command replays**. Four source actors each run 16 cycles
under the actual loaded Scions factory. A single private candidate receives the
qualified translated coordinates, destination terrain height and original
populated command banks. Its Path/Follow references and command ages are rebound,
a fresh original route is attached, and original readers/writers and cleanup
preserve the resulting data and allocator baselines.

The candidates remain unpublished: identity/world fields stay zero. This does
not activate actors, remove source actors or establish continuous native regions.
The supplied mapping between unrelated Brashnard/Scions checkpoints is a test
policy, not persistent entity correspondence.

## Goals and owned route capacity

The source Path goal `(2352,5936)` differs from captured source target 2073's
whole-world position `(2457,5830)`. The fixture preserves the approach offset
`(-105,+106)` around captured destination target 497 at `(1782,2064)`, producing
`(1677,2170)`, navigation cell `(104,135)`. It does not snap the goal to the
centre of the destination target. Twenty-nine pinned original instruction
anchors verify the two-field goal setter `005e1aa0`, capacity-based Path reader
allocation and count-based original writer.

Before original graph reading, the private reservation and saved capacity are
expanded from ten points / 80 bytes to **64 points / 512 bytes**. The original
reader claims that exact owned allocation. The stale ten-point source route is
invalidated; the fresh search starts at the grounded actor's physical position,
separately from its preserved saved logical movement cells.

| Actor | Physical start cell | Complete route points | Original search nodes | Saved graph bytes |
| --- | --- | --- | --- | --- |
| 2101 | 67,136 | 38 | 119 | 844 |
| 2105 | 109,172 | 43 | 130 | 884 |
| 2122 | 144,86 | 50 | 225 | 940 |
| 2136 | 137,110 | 34 | 149 | 812 |

Each route reaches `(104,135)` without truncation. All **2640** composed route
points pass original collision queries; both endpoints also pass flags 512
and 1024. The search expansion limit is 512, with at most 4097 possible node
allocations inside the original 8192-node pool. Search scratch and lists are
cleared and fixture-owned caches are retired through original functions before
coordinates are attached to the owned Path. Heap and CRT pool totals recover.

## Actual serialization and disk replay

The original graph writer matches the complete independently expected payload,
including preserved opaque fields and the shifted trailing Follow order. After
original command destruction, all actor bytes return to their pre-bank state.
The fixture closes and reopens its own `Composed_Orders.bin`, checks exact length,
EOF and equality, then uses those actual file bytes as input to a second original
graph reader on the same grounded candidate. The longer route survives that
reader and another original writer and destructor.

The verifier independently transforms the original literal 620-byte payload:
three captured-clock timestamp edits, two typed reference edits, the two goal
coordinates, cursor/count/capacity and replacement of the old 80-byte point list.
It matches the actual final `Composed_Orders.bin` and `Replayed_Orders.bin` files
byte for byte. All 64 composed graphs and 64 replay graphs free their 18 owned
extents: **2304 additional frees**, or **3456** including the unchanged source
baseline. Actor deletion, target records, grid tables, identity counters, heap,
CRT pool occupancy and installed hooks return to their baselines.

Earlier immutable attempt 015 qualifies composition only. Attempt 016 adds
original reader replay from matching in-memory serialized data. Attempt 017
adds actual saved-file input. The strict saved-file verifier refuses the earlier
attempts; their evidence and isolated profiles are preserved.

## Evidence and next work

The latest evidence is:

- `output/native-actor-cross-destination-attempt-017.json` and its terminal log.
- `output/native-actor-composed-disk-replay-observed.json`.
- `output/native-actor-composed-disk-replay-controls-observed.json`.
- `output/native-actor-composed-arrival-instruction-audit.json`.
- `output/native-actor-composed-arrival-progress.json`.

All **31 offline controls** reject missing graph/binding/goal/attachment/writer/cleanup,
wrong approach and route endpoints, discontinuous routes, undersized capacity,
modified actual writer files, missing original replay or actual file input,
predecessor attempts and invalid runner options. They do not launch a game or
modify the original evidence.

Reproduce with the existing cross-destination runner options and add
`--composed-arrival --grounded-placement`, using a fresh attempt number. Native
builds use `tools/build.py --target smoke --jobs 1`; only one heavy process may
run at a time. Qualification is lightweight:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/check-native-actor-composed-arrival.py \
  output/native-actor-cross-destination-attempt-017.json --require-disk-replay \
  --output output/<fresh-qualified-report>.json
upstream/majesty-recomp/.venv/bin/python scripts/check-native-actor-composed-arrival-controls.py \
  output/native-actor-cross-destination-attempt-017.json \
  --output output/<fresh-control-report>.json
```

Next work must qualify durable actor/script reference closure, movement/animation
state, world association, ownership handoff and live activation. The preserved
logical cells and physical route start can differ; private serialization alone
does not establish safe live movement. Continuous terrain expansion, dormant
region recovery and full browser rendering/simulation memory bounds remain open,
as do complete co-op campaign outcomes and independent internet matches.
Browser/WASM launches remain suspended, the served WASM is unchanged, and the
full goal remains active.
