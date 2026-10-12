# Connected terrain clamp repair

The subsequent [native191 profile restoration](native-profile-restoration.md)
closes the imported-header mismatch in an isolated native session: all three
full comparisons now match on the same15-visit/13-kingdom route. The native188
results below remain historical and retain their original failure scope.

The wider expansion journey fails in fresh region `-3_0` when original terrain
method `005fd160` changes five west-edge heights. The native187 observer and
failed route are preserved in [the expansion record](native-expanding-voyage.md).

The candidate protects the two direct height stores, `005fd2ba` and `005fd2c6`,
through the existing instruction-patch feature. Each synthetic call targets the
point-writer adapter and returns to the original two-byte instruction successor,
`005fd2bc` or `005fd2c8`. The adapter recognizes those callers and emulates the
store while preserving registers and integer flags. Ordinary point-writer calls
still delegate to the original function with its original RET8 convention.

For an active experimental connected terrain, shared-edge stores retain the
existing height. Interior stores keep their requested height. Original clamp
queue, flags and notifications continue. The policy retains one terrain identity
and a saturating counter; it adds no dormant terrain cache. It clears the terrain
identity before disposal or fresh generation. This does not propagate deliberate
terrain edits across regions or repair previously damaged saved borders.

The native Ready fixture exercises both stores on four sides, four corners and
an interior vertex before actors are placed. It checks all registers, all six
integer flags, expected stack movement, sixteen protected edge attempts and two
interior changes/restorations. The full connected-height invariant stays enabled.
The wider original-game route remains the decisive test of actual clamp callers.

Static evidence: `output/native-clamp-store-005-instructions.json` verifies the
hash-pinned original method, both store bytes and production-emitter continuations.
The regenerated table contains both return addresses. Six configuration tests
pass in `output/native-clamp-store-007-config-tests.log`. Earlier failed audit
logs are retained; they expose audit operand/format handling, not game execution.

The official one-job native188 rebuild passes. Attempt047 reaches all twelve
fresh regions with intact borders, but its sixty-second input script ends before
the final return home: thirteen completed captures are a partial route, not a
pass. The unchanged route reruns as048 with `--seconds-per-visit 8`, a120-second
script and185-second supervisor deadline. Both producers exit0 and are absent.

Attempt048 completes all15 visits through13 distinct kingdoms and478 original
ticks. All shared height seams match. Twelve generated regions pass192 edge
controls and24 interior controls, retaining registers and flags. The read-only
clamp observer reports no changed boundary vertices. Fourteen departures record
112 root frees, including the original terrain/spatial buffers. Peak sampled
native RSS is188,481,536 bytes, about180MiB; this short run does not qualify
sustained native or browser memory. Original settings, selected saves, receipt,
publication and refusal sentinels remain unchanged. Served engine hashes and
filesystem stamps also remain unchanged.

Both actual saved returns (`-1_0` and home) match their earlier world state.
The first imported home load still fails the full comparison in SVGD. A bounded
comparison narrows it to one header string, `Your Majesty` becoming `2`; the
remaining semantic prefix and suffix match. Its owning original reader/setter
and field semantics need verification. Do not mask it or call full restoration
qualified. All actor records match even on that initial load.

The first inspector refusal retained an outdated43-input count. The shared
provenance checker now requires the additional five window/import/platform
inputs as a complete group, rejects overlapping groups and hashes all48 inputs.
Three historical tuples pass and eight contradictory tuples refuse. Preservation
now uses full source paths so the runtime and platform CMakeLists cannot collide;
the failed partial archive and log remain available.

Evidence:

- `output/native-clamp-store-016-restoration.json`: full route, saved comparisons,
  seams, releases and memory observations; overall qualification remains false.
- `output/native-clamp-store-018-controls.json`: actual clamp controls and borders.
- `output/native-clamp-store-017-header-string.json`: bounded header difference.
- `output/native-region-restoration-generation-188-preserved.json`: exact48
  compiled inputs, executable, symbols and58 evidence files, including30 full
  Ready/saved captures and the partial run's manifest/log.

Browser launches remain suspended. Live co-op/competitive completion, independent
internet participants and sustained browser bounds remain open. This repair is
private and is not published to the served browser build.
