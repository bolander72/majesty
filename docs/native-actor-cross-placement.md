# Private actor coordinates across supplied region origins

The latest [grounded restoration](native-actor-grounded-placement.md) additionally
places 64 private candidates at actual destination height, with inactive-cache
and unsupported-state guards. This remains separate from live command transfer.

Subsequent [original ground-height qualification](native-actor-cross-ground.md)
adds 64 queries against actual destination terrain. Saved source Z differs
slightly from source ground; no elevation transfer policy is qualified yet.

Native attempt 012 qualifies 64 additional private UNIT restorations across four
saved actors, with translated fractional X/Y positions and separately translated
saved navigation cells. All 256 original collision calls pass, original UNIT
serialization matches the translated input exactly, and actor deletion returns
heap totals, CRT pool occupancy, hooks and identity counters to baseline.
Actors remain unpublished. This does not establish live region crossing.

## Coordinate and movement-cell evidence

The adapter in `web/world/actor-coordinates.mjs` preserves Q11 local positions
through safe integer global coordinates and subtracts the destination origin.
Original terrain cells span 32 world units; navigation cells span 16. Z remains
unchanged. Source and destination geometry is supplied explicitly and checked
before translation. Five focused JavaScript tests cover fractional round trips,
distant negative origins, exclusive edges, unsafe inputs and distinct saved cells.

The pinned version-nine UNIT reader restores both XYZ and explicit saved cells.
Those cells can differ from cells calculated from the physical position during
movement. Actor 2101, for example, has physical grid `(323,136)` but saved cells
`(323,137)`. A supplied origin shift of 4096 world units produces physical grid
`(67,136)` and saved cells `(67,137)`. Collapsing those two values loses saved
movement state. Seventeen pinned instruction anchors independently verify the
reader, map conversion and original CELL setter; the private stage defers that
setter's registry/spatial observer effects.

Attempt 011 translated XYZ while retaining source cells. Its placement probe
failed before collision/writer qualification despite a zero host exit. The log
and profile are retained, and an offline control rejects that actual incomplete
run. Attempt 012 translates both original coordinate representations independently;
the 252-byte NAP1 version-two fixture records both for independent checking.
Twelve offline negative controls reject missing results, altered positions/cells/Z,
failed collision/writer/cleanup checks and an invalid runner option combination.

The original restored graph tests and 68 complete original point searches still
pass. Their independent 17-point routes are not copied into ten-point source
command buffers. See [the route qualification](native-actor-cross-route.md).

## Limits and next work

Brashnard and Scions are unrelated checkpoints. These supplied origins qualify
coordinate arithmetic and original private restoration, not shared terrain or
entity continuity. Terrain elevation, in-flight cached movement state, destination
command intent and adequate route ownership must be qualified before world
association, ownership handoff, registration, scheduling or activation.

Continuous expansion, dormant-region recovery, full browser resource bounds,
complete cooperative campaigns and independent internet gameplay remain open.
Browser/game launches remain suspended after the host-app crashes. The served
WASM is unchanged and the full goal remains active.

## Evidence

- `output/native-actor-cross-placement-observed.json`: attempt 012 qualification.
- `output/native-actor-cross-placement-controls-observed.json`: twelve controls.
- `output/native-actor-coordinate-instruction-audit.json`: seventeen anchors.
- `output/native-actor-cross-placement-v2.bin` and `.json`: immutable fixture.
- `output/native-actor-cross-destination-attempt-011.json` and `.log`: retained failure.

Prepare with `node scripts/prepare-native-actor-cross-placement.mjs`, preserving
existing outputs. Build only through the official tools with one job. The native
runner adds `--placement-probe` to the existing `--navigation-probe --invalidate-path
--landing-probe --fresh-route-probe` fixture options and requires a fresh attempt
number. Qualify the resulting manifest with
`scripts/check-native-actor-cross-placement.py`; the controls script only checks
offline evidence and starts no native processes.
