# Original destination collision and fresh point routes

Subsequent [same-actor composition](native-actor-composed-arrival.md) attaches
complete 34–50-point routes to adequately reserved Path storage on grounded
candidates and qualifies actual saved-file graph replays. Live movement is open.

Subsequent [private coordinate qualification](native-actor-cross-placement.md)
adds 64 translated restorations with independently preserved saved movement
cells. Elevation, command intent and live activation remain open.

The stopped native fixture now queries nonempty original class rectangles in
Scions and generates complete original point-to-point routes. This is a
prerequisite for streamed actor crossings, not a live crossing or a playable
expanding world. Browser launches remain suspended after the host-app crashes;
the served WASM is unchanged and the full goal remains active.

## Class collision queries

The original movement point-query arguments are actor, grid X, grid Y,
collision flags, footprint selector and callback. The movement calls use
selector zero, which returns a shared class footprint. All four source actors
return a null footprint here, selecting the original rectangle fallback.
This does **not** qualify the masked-footprint branch.

Attempt 005 accepted two interior positions but failed its preservation check.
Attempt 006's separate digests identify only the class traits as changed:
actor, grid header, both complete pointer tables and heap totals are unchanged.
Pinned rectangle code `005b85e0` lazily invokes bounds initialization at
`005ba280`. The fixture now initializes those bounds explicitly before taking
cycle baselines and refuses empty rectangles. These classes have grid-relative
bounds `(-1,-1,1,2)`; four warmups retain zero heap bytes/blocks.

Attempt 007 passes 64 restored-actor cycles. Six original in-bounds point calls
per cycle test candidates around destination target 497 at `(111,129)`, admitting
`(119,137)` and `(103,129)` under both movement collision flags 512 and 1024.
All 384 calls preserve the actor, class bounds, grid and heap baselines.
Existing outside-grid rejection, stale-route invalidation, typed reference/time
edits, exact original serialization and owned cleanup still pass.

## Full original pathfinder and cleanup

The additional opt-in primitive calls original wrapper `005adef0` with an
independent guarded 64-point output buffer, explicit Scions factory and private
actor, the two admitted endpoints, no target actor, zero lookahead/radius and
the original planning collision flag 512. It does not edit the actor's source
position, world association or command destination. Endpoints are additionally
checked under flag 1024; each returned waypoint is checked under planning flag
512. Mobile-actor avoidance during movement is a separate original-engine step.

The fixture limits this original search to 256 expansions, restoring its shared
1024 default afterward. Pinned neighbour loops consider eight offsets per
expansion and commit at most one new node per neighbour: at most 2049 nodes for
this search, within the original 8192-node array (229376 bytes). An incomplete
route, a capacity-sized potentially truncated result, discontinuous points,
wrong endpoints or overwritten output sentinels fails qualification.

The original search leaves pooled node pointers in the grid scratch table.
Before pool reuse or retirement, original `005b7e30` clears that table, every
entry is checked zero, and original search reset verifies empty open/closed
lists. A cleanup failure aborts the isolated process before node storage can
be freed while still referenced.

Attempt 008 returned all 17 points and cleared scratch, but retained the newly
created caches: 265376 guest heap bytes, four heap blocks and increased CRT
pool occupancy. Its host exit was zero, but it completed **zero actor cycles**;
the qualifier rejects it. The fixture now requires both original cached
contexts absent at entry, owns only contexts it creates, and calls original
goal/search teardown `005ea5b0` / `005ec0f0` after scratch cleanup. Inherited
contexts or outstanding scratch are refused rather than discarded.

Attempts 009 and 010 pass 68 complete original searches: four setup searches
plus 64 restored-actor cycles. Every route has 17 points, including both
endpoints, and uses 69 nodes. All 1156 returned points pass original planning
collision checks. Both context globals return to zero, grid node pointers are
cleared, and heap totals plus CRT pool occupancy recover after every search.
All 64 original command writers and 1152 journal extent frees also pass.

This route is longer than the source Path's ten-point owned capacity. It is
never copied into that command buffer. Real intent-preserving transfer still
needs qualified destination coordinates/terrain height, consistent region
origins, durable entity correspondence, adequate route ownership/capacity,
world association, handoff and live activation. The point-route primitive
does not prove any of those or whole-browser memory bounds.

## Reproduction and evidence

Use fresh attempt numbers and preserve all prior profiles/logs/reports.
Build through the official tools with one job; do not edit generated code.

```sh
cd upstream/majesty-recomp
.venv/bin/python tools/build.py --target smoke --jobs 1
cd ../..
python3 scripts/run-native-actor-populated-stage-fixture.py \
  output/native-actor-populated-stage-attempt-005.json \
  --cross-destination output/native-actor-cross-source-observed.json \
  --navigation-probe --invalidate-path --landing-probe --fresh-route-probe \
  --attempt 10
upstream/majesty-recomp/.venv/bin/python scripts/check-native-actor-cross-route.py \
  output/native-actor-cross-destination-attempt-010.json \
  --output output/native-actor-cross-route-observed.json
upstream/majesty-recomp/.venv/bin/python scripts/check-native-actor-cross-route-controls.py \
  output/native-actor-cross-destination-attempt-010.json \
  --output output/native-actor-cross-route-controls-observed.json
```

The landing and route audits pin 28 and 68 instruction anchors respectively.
Qualifiers retain launch C++/configuration identities; the earlier landing
report refers to attempt 007, and attempt 009 has its own report before the
additional abort guard. Attempt 010 qualifies the final guard-bearing source.
Offline controls reject altered observations, actual failed attempts 006/008,
and invalid runner mode combinations without launching another game.

Continuous world paging, dormant-region restoration during live movement,
campaign completion and independent internet gameplay remain unfinished.
