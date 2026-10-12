# Reject and invalidate stale routes before region activation

The subsequent [original landing-query and fresh-route fixture](native-actor-cross-route.md)
qualifies in-bounds class rectangles and full original point routes with owned
search cleanup. The earlier rejection/invalidation evidence below retains its
original tested identity and scope; live activation remains unfinished.

The stopped native fixture now verifies actual destination-grid rejection and
private cached-route invalidation. It does not yet place an actor in the new
region or generate a new route. All game/browser launch restrictions remain;
the browser build is unchanged and the full goal is active.

## Actual second-world rejection

The unchanged Brashnard checkpoint contains 256 × 256 terrain cells; Scions has
128 × 128. The original spatial grid has twice the terrain dimensions along
each axis. The actual loaded Scions grid reports **256 × 256**. The four private
source actors are at navigation coordinates `(323,136)`, `(365,172)`, `(144,342)`
and `(137,366)`. Their source Path destination is native-world `(2352,5936)`,
which the original conversion produces as grid `(147,371)`. All their ten-point
cached routes are also wholly outside Scions' grid.

The opt-in probe calls original MapPosition, original signed world-to-grid
conversion and original point collision against the actual destination grid.
Each of 64 cycles queries the actor position, destination, ten source points and
four outside-edge controls: **1024 original collision calls**, all blocked.
In-bounds points are refused by this diagnostic before any footprint branch;
it does not qualify collision masks, viable landing points or real path search.

Recorded digests of the private actor, 100-byte native Path object, 80-byte point
buffer, grid header and both complete grid pointer tables remain unchanged by
the queries. The two pointer tables total 524288 bytes. Heap totals recover
after the 32-byte scratch buffer is freed. These are stopped component checks,
not whole-game/browser/GPU memory bounds.

Navigation attempt 002 failed before a cycle: the initial admission used the
140-byte serialized Path body size as the native allocation size. The pinned
allocation is **100 bytes**. Its capacity is native `+5c`, represented by saved
body word 32; `+50` is another scalar. Corrected attempt 003 passes all 64 cycles.
The failed profile, process exit 6 and log are retained. Successful host exit
without complete positive cycle observations is never accepted.

## Private route invalidation

An additional opt-in step runs after typed reference/time edits. It preflights
the owned Path object, cursor 8, count 10, capacity 10 and all 80 literal waypoint
bytes. It then clears only native cursor `+48` and count `+4c`. Capacity and the
owned allocation remain unchanged. The expected serialized payload clears
saved cursor word 30 and count word 34, omits the 80 stale waypoint bytes and
shifts the later Follow command. The native original writer reproduces the
shortened **540-byte** payload, including the destination reference/time edits.
Its remaining 80-byte output capacity retains the original sentinel fill.

All 64 invalidation cycles pass. They omit 640 stale serialized points while
retaining an 80-byte owned capacity per cycle. Original DRAIN/UNIT_CLEAR and
actor destruction retire all **1152** exact reserved extents, including those
still-allocated point buffers. Heap, pool and hook baselines recover every time;
the original destination target and identity counters remain preserved.

The original branch is `cursor + 1 < count`. Ten isolated original instruction
trials, with two stack fills, prove that `(8,10)` and `(0,10)` select reuse;
`(9,10)`, `(10,10)` and `(0,0)` select replanning. Therefore resetting the cursor
alone would retain stale path reuse. This branch fixture executes 90 original
instructions, maps at most 12288 guest bytes and releases every mapping. It
stops before either branch body; it executes no search or gameplay leaf.

Seven offline controls reject a missing collision row, wrong native coordinate,
missing invalidation row, wrong shortened size, missing owned buffer free and
two invalid runner mode combinations. No control starts a game or changes the
original observations.

## Retained evidence and reproduction

The navigation report and its reverified snapshot refer to attempt 003's tested
C++ identity. That binary predates the invalidation helper. The invalidation
report refers to attempt 004's tested identity. Both remain separate; later
source edits must never relabel historical native runs.

```sh
# Build with the official tools, one job, then use fresh attempt numbers.
python3 scripts/run-native-actor-populated-stage-fixture.py \
  output/native-actor-populated-stage-attempt-005.json \
  --cross-destination output/native-actor-cross-source-observed.json \
  --navigation-probe --invalidate-path --attempt 4
upstream/majesty-recomp/.venv/bin/python scripts/check-native-order-replan-branch.py
upstream/majesty-recomp/.venv/bin/python scripts/check-native-actor-cross-path-invalidate.py \
  output/native-actor-cross-destination-attempt-004.json
```

These commands preserve existing attempts and qualification reports. Evidence
is retained in `output/native-actor-cross-navigation-reverified.json`,
`output/native-order-replan-branch-observed.json`,
`output/native-actor-cross-path-invalidate-observed.json` and
`output/native-actor-cross-navigation-controls-observed.json`.

Before activation, the adapter still needs a consistent region-origin transform,
valid actor placement with original class footprints, durable entity mapping
and a fresh original route in the actual destination. The Path leaf resolves a
nonzero target through original lookup and target-goal helpers before its
cursor/count branch. Those helpers and path search depend on actual world/grid
association and shared temporary search state. A count reset alone cannot make
the unchanged out-of-world actor position safe or establish bounded search
ownership. Ownership handoff, publication and interrupted recovery remain open.
Continuous paging, dormant region restoration, browser resource bounds, full
campaign completion and independent internet gameplay remain unfinished.
