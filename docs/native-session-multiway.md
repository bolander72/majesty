# Named-world travel through five kingdoms

The later [state-restoration trial](native-session-restoration.md) compares
saved revisits before gameplay resumes. First-return selection/global UI fields
differ; exact restoration is not yet qualified. The route below retains its
original narrower clock/RNG and lifecycle qualification.

The production opt-in native session path now passes thirteen visits through
five kingdoms in one original game process. Starting at `0_0`, the route goes
west, west, north, east, south, east, then repeats that loop. Four initially
absent kingdoms generate once; subsequent visits load their own latest saved
checkpoints. Travel uses the existing session path, not the older coordinate
residency fixture. No game or runtime source changed for this trial.

The controller accepts 2..16 cardinal steps, requires an adjacent route that
returns home and preserves its refused orphan/symlink neighbors, and scales the
trial duration to the route. Its 512 MiB RSS guard and deadline now escalate a
failed termination after five seconds; controller exceptions also stop and reap
the game before writing the terminal report. Earlier controller and inspector
sources remain preserved.

## Actual native evidence

Trial005 uses official native114. PID91259 exits0 with no guard stop; all thirteen
checkpoint captures are present. Inspection checks the actual quit/unload/
attach order, named save destinations and modes derived from first visits,
initial RNG restoration, each saved kingdom's own latest clock/RNG restoration,
and the final committed checkpoint digest for all five kingdoms.

All saved kingdoms contain initialized AI agents. First visits to the four new
kingdoms contain20,35,23 and23 agents, respectively; they retain positive AI
populations after return. Across the visits433 original ticks advance. Five
distinct shared borders pass all129 height vertices each, including both axes
and negative coordinates. Shading/other vertex fields are not claimed identical.
Peak sampled native RSS is134,316,032 bytes in this short run.

`output/native-region-session-attempt-005.json` is the terminal producer report;
`output/native-region-session-multiway-001-observed.json` is independent stopped
inspection. Twelve contradictions still reject missing lifecycle events,
retained loading/world state, wrong routing, regeneration of saved kingdoms,
missing refusals/RNG events and the actual earlier zero-agent generated save.

## Browser adapter replay and limits

Source143 and actual staged92 Node checks pass. The replay consumes the actual
thirteen-visit native trace, mapping only the native profile root to OPFS. It
checks twelve region/URL activations, admission mode for each destination,
unchanged DOM node count, one retained exclusive world lease and zero page
navigation. It is a terminal DOM fixture, not browser or WASM gameplay.
The generalized inspector also accepts the previous five-visit trace; its
twelve negative controls and59 focused replay/route tests still pass.

Exact changed sources, tests, producer/inspection reports and logs are copied
and hash-bound in `output/native-region-session-multiway-preserved.json`; the
official114 source/executable archive remains linked separately. No player
profile or committed hero-pair input is modified. Served engine files remain
unchanged; the compiled browser candidate stays separate.

This verifies a larger playable native route and saved revisits. It does not
compare full typed state before the first resumed tick, observe every disposed
allocation, establish sustained memory bounds, qualify browser activation or
resolve the host-app crash. Continuous camera/hero crossing, co-op regional
activation and complete independent internet matches remain unfinished. Browser
game launches remain suspended.

```sh
python3 scripts/run-native-region-session.py output/native-world-residency-build-114.json output/native-hero-return-pair-001-published.json upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-iIyAMK/Selected_Entity_Revision.json --attempt FRESH --world multiway-session --route west,west,north,east,south,east,west,west,north,east,south,east
node scripts/inspect-native-region-session.mjs output/native-region-session-attempt-FRESH.json output/multiway-FRESH-observed.json
MAJESTY_DESTINATION_STAGED=1 MAJESTY_NATIVE_SESSION_TRACE=output/native-region-session-attempt-FRESH.json node --test tests/frontier-controls.test.mjs tests/native-region-session-controls.test.mjs tests/native-destination.test.mjs
```

Check for existing game/build processes first. A tool timeout is not terminal;
keep polling the same handle/PID and preserve failures and original inputs.
