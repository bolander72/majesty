# Joint actor state in an original full-world checkpoint

Producer attempt025 and fresh reload attempt001 qualify one grounded Brashnard
war-follower NPC's linked UNIT, GPL script and populated command graph in a real
Scions full-world checkpoint. This is a native-only persistence fixture. It does
not qualify general hero migration, movement, ownership transfer or a playable
expanding browser world. The full cooperative/expanding-world goal stays active.

## Original full-world save

The preceding [world identity fixture](native-world-identity.md) still completes
all64 publication/lookup/retirement cycles and192 exact joint writer comparisons.
A new opt-in flag additionally saves one baseline before those cases and one
checkpoint while the first actor's links and commands are live. The original
named writer004359c0 serializes the full world. The helper reuses the existing
Frontier named-write function and original autosave renderer suspension/restore
sequence. It accepts only the owned copied native profile, region0_0, a solo
world, scheduler ownership and two fixed new filenames. Existing files are
refused; neither the player's active checkpoint selection nor profile is changed.
The flag is refused in WASM and remains disabled by default.

Baseline Joint_Actor_Before.GMP contains480 UNITs,10 agents and11 attachments.
Joint_Actor_2101_0.GMP contains481 UNITs,11 agents and12 attachments. The only
added records are native UNIT510, GPL79 and ORDR510. All501 pre-existing records
remain byte-identical between these two original writes. Independent bounded
inspection confirms the new375-byte UNIT,1428-byte GPL and844-byte command graph
match the actual individual original writer artifacts in full. Both self
references identify GPL79; the native ID and EA associations agree; external
leader references remain the qualified actual destination agent2. The final
checkpoint is320050 bytes.

Full-world scalar counters and bookkeeping intentionally differ; this is not a
claim that the entire file or every transient original object remains unchanged.
The source Brashnard actor is not removed in this fixture, so this persistence
result is not a jointly committed source/destination ownership handoff.

## Fresh original reload

A separate native process and newly copied profile contain exactly that original
full-world checkpoint as their sole saved game. The runner verifies the producer's
terminal status, checkpoint and identity reports, original input hashes and all
copied individual writer hashes before creating the reload profile. It records
all reload input and executable/source hashes. Existing profiles are preserved.

The original loader completes all481 UNIT visits. A one-shot native observer
resolves UNIT510 through the actual native registry and GPL79 through the actual
script registry, verifies their EA/native/backlink identities and nondeleted
script, and invokes the original UNIT/GPL/command writers. All three complete
records match the producer bytes exactly after full-world load. The command graph
is compared against the authentic copied original writer, not reconstructed
through a substitute JavaScript engine. Scratch storage is released. The native
smoke completes its remaining loaded-game observation and exits zero without
reported original-loader/continuing-game faults. No position trajectory,
command-dispatch count, scheduling/queue activity, physical or drawing membership
or sustained performance was measured; those claims remain unqualified.

## Evidence and reproduction

- `output/native-joint-checkpoint-observed.json` and
  `output/native-joint-checkpoint-bounded-observed.json`: exact full-world actor
  data and all501 pre-existing records preserved. Reads are capped at64KiB;
  actor files at4KiB and command data at2KiB. Inputs must be stopped native copies.
- `output/native-world-identity-checkpoint-observed.json`: all64 preceding native
  identity cases and192 original joint writers still pass in producer025.
- `output/native-joint-reload-current-observed.json`: separate original full load, actual
  lookup identities and three exact original writer outputs in reload001.
- `output/native-joint-checkpoint-controls-observed.json`:18 offline refusals,
  including corrupt individual/full-world records, wrong identities, altered
  existing records and missing original writer evidence. Only test copies change.
- `output/native-joint-reload-controls-current.json`:19 offline refusals for
  incomplete original load, reused process, wrong backlinks/writers, actual output
  byte corruption, cleanup failures and a continuing-game fault.
- `output/native-joint-checkpoint-build.log` and
  `output/native-joint-reload-build.log`: official jobs-one native smoke builds.

Add --joint-checkpoint to the complete --native-identity producer invocation,
choosing a fresh attempt number. It requires the existing script/ground/navigation
flags and refuses missing native identity before profile creation. After producer
termination, run the bounded checkpoint checker and existing native identity
checker with fresh output filenames. Build the current smoke target through
upstream tools/build.py --target smoke --jobs 1 before the following fresh reload:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/run-native-joint-reload.py \
  output/native-joint-checkpoint-observed.json \
  output/native-world-identity-checkpoint-observed.json --attempt <fresh-number>
upstream/majesty-recomp/.venv/bin/python scripts/check-native-joint-reload.py \
  output/native-joint-reload-attempt-001.json \
  --output output/<fresh-reload-qualification>.json
```

Run at most one heavy native game/build at a time and confirm the previous handle
is terminal. Both producer025 and reload001 terminated with exit0. The original
served WASM remains untouched. No browser launches or inspection were used.

## Next requirements

The subsequent [in-flight Move correction and continuation](native-inflight-move.md)
qualifies one NPC's original command dispatch,240 ticks of movement, navigation-cell
transitions and declared physical/drawing registration after reload004. Animation,
rendered pixels and general actor activation remain open. Connect this persisted
state to bounded active native regions and a durable
entity ownership/reference ledger, including source departure and repeated
crossings. Continuous terrain, dormant-region persistence policy, whole-browser
and GPU resource bounds, shared co-op objectives/full-match completion and real
internet transport qualification remain required. The unresolved host-app crash
continues to suspend browser/game launches.
