# Four native travel laps preserve saved state

The isolated native session controller now accepts `--laps 1..4`. It repeats
the admitted closed route, preserving its coordinate adjacency and refusal
probes. The default remains one lap. A base route has at most16 moves; four
laps permit at most65 visits. The current five-kingdom route produces49 visits,
48 unload/attach transitions and45 saved-load comparisons, including the
initial committed home load. Native161 changes only the owned native Ready
snapshot fixture's serial ceiling from16 to64. Ownership, solo-world, phase,
zero-tick, hook-depth and checkpoint invariants remain required. The fixture is
excluded from Emscripten builds; no generated translation is edited.

The stopped inspector admits a longer route only when its explicit lap count
and base route exactly reconstruct every move. Arbitrary long routes, invalid
lap counts, malformed closures and changed repeated coordinates refuse. Existing
save, actor/script/attachment, RNG, UI, exploration, terrain and root-release
checks remain required. Resource samples now include elapsed milliseconds and
the most recently observed attach serial; that serial is not proof that the
world remains active throughout a sample or disposal.

The producer retains its512MiB sampled native RSS stop ceiling. At most one
heavy build/game may run. Four laps test repeated returns to the same five
kingdoms; they do not prove unlimited world growth, a long-term resource bound,
browser GPU/worker memory, co-op activation or seamless hero navigation.

Preparation passes73 focused Node checks, including five route tests. A direct
Python check produces the same49-visit route and refuses five invalid lap counts
and four invalid routes. Archive-bound reinspection of the stopped native160
trial still passes its existing nine saved-load comparisons and shared-height
checks after the controller/inspector update. Its original manifest, frozen
controller and all historical evidence remain preserved. The archive path
selects the archived controller bytes rather than requiring historical code
to match the currently edited source.

Evidence:

- output/native-session-endurance-route-002.tap:73 checks, zero failures,
  including explicit null-count and maximum65-visit controls. The earlier
  route-001 log is preserved.
- output/native160-session-archive-001.json: copy of the stopped trial032
  manifest with the exact160 archive selected; the original is unchanged.
- output/native160-session-archive-001-observed.json: unchanged nine-load
  comparison result from the archived160 generation.

WASM008 compiles in one official job, exits0 and passes static inspection with
its build PID absent. It remains unstaged; no browser or WASM instance is
started. The same Frontier/config inputs match native160. Four served engine
artifacts retain their hashes, inodes and mtimes. Evidence:
output/wasm-session-candidate-008-build.json and
output/wasm-session-candidate-008-observed.json. Browser launches remain suspended
under the host-app crash constraint.

The first extended trial033 under160 exits6 after17 Ready and departure captures.
Its eighteenth attachment has serial17; the native-only fixture still rejects
serial>16 before it can write that Ready checkpoint. This fixture ceiling was
missed when the controller was extended. The stopped failure preserves43 files,
including every capture, exact controller, old CPP and160 archive receipt, in
output/native-session-endurance-001-failure.json.17 completed transitions
acknowledge136 tracked frees. Peak sampled RSS190136320 bytes is below the
512MiB stop ceiling; this incomplete route does not prove memory stability or
full-state restoration. No browser or WASM instance runs.

Official one-job native161 builds after both earlier producers stop, exits0 and
has its PID absent. It corrects only that native fixture ceiling. Fresh trial034/
PID47543 then exits0 after49 visits through five kingdoms and1588 ordinary ticks.
All49 Ready and departure captures are available, and the actual producer PID
is absent before inspection. All45 saved-load comparisons and the tested shared
height strips pass the existing contract. Inspection uses a256MiB Node heap
limit. Fourteen contradictory Ready traces and seven delta-writer contradictions
refuse. Both original writers'32 boundary and four interior controls still pass.

All48 transitions acknowledge eight tracked root frees each,384 in total.
95 timed resource samples peak at190480384 bytes (about181.7MiB). Every observed
disposal decreases guest heap bytes, but matching phases still vary: the largest
lap2-to-lap4 increase is214576 bytes and16 live allocation blocks. The last
post-disposal values across the four laps are22963936,22826768,22927872 and
22919232 bytes. These observations do not establish a sustained plateau,
absence of retention, total browser memory bounds or host-app crash safety.

Evidence:

- output/native-world-residency-build-161.json
- output/native-region-session-attempt-034.json
- output/native-region-session-restoration-013-observed.json
- output/native-session-restoration-controls-007.json
- output/native-boundary-delta-writer-002-observed.json
- output/native-session-endurance-002-observed.json: timed RSS and exact
  same-phase lap comparisons, hash-bound to stopped native and full-state results.
- output/native-region-restoration-generation-161-preserved.json:20 compiled
  inputs, executable, symbols and125 evidence files, copied and rehashed with
 4096-byte buffers. The failed033 evidence remains separately preserved.

Unstaged WASM009 compiles in one official job to bind the current source
identity, exits0 and has its PID absent. Static identity/protocol/memory checks
pass without instantiation. Its Frontier/config/renderer inputs match native161;
four served engine artifacts retain hashes, inodes and mtimes. Evidence:
output/wasm-session-candidate-009-build.json and
output/wasm-session-candidate-009-observed.json. Native fixture limits are excluded
from WASM behavior. Keep browser launches suspended under the crash constraint.

Source and served browser controllers each pass110 terminal checks against this
stopped49-visit trace. All48 changes retain fixed DOM node count, one held world
lease and zero page navigation. Evidence:
output/native161-session-browser-001-observed.json and its two bound TAP logs.
This verifies controller sequencing in fixtures, not live browser gameplay.

```sh
python3 scripts/run-native-region-session.py output/native-world-residency-build-161.json output/native-hero-return-pair-001-published.json upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-iIyAMK/Selected_Entity_Revision.json --attempt 34 --world restoration --capture-ready-state --route west,west,north,east,south,east,west,west,north,east,south,east --laps 4
node --max-old-space-size=256 scripts/inspect-native-region-session.mjs output/native-region-session-attempt-034.json output/native-region-session-restoration-013-observed.json
```

For another justified run, use fresh positive attempt/output names and at most
one heavy producer. Do not edit a running controller or its compiled inputs.
Require terminal native exit, actual PID absence and all planned captures before
inspection. Preserve failures as well as successes. Positive tracked frees alone
do not establish a plateau. Report actual state comparison and memory
observations separately. Seamless camera/hero travel, coordinated co-op region
activation, full matches, independent internet play and sustained browser bounds
remain requirements of the active goal.
