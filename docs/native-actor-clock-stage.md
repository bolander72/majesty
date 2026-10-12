# Common dispatch timing on restored actors

The opt-in native clock probe extends the
[matched populated actor fixture](native-actor-populated-stage.md). All 64 native
cycles pass, including 1536 original dispatch calls, 1248 checked leaf returns
and 288 dispatch skips. It captures the actual stopped clock
at `0071c6a8` and uses four synthetic destination snapshots: the same clock,
zero, the source plus `80000000` modulo 2^32, and `ffffffff`. These values test
the private migration arithmetic; they are not clocks captured from a second
active world.

The fresh NAS2 producer uses the production dispatch-clock planner to identify
three timestamp sites in each copied actor's literal command payload. It records
the typed bank/index/kind, saved offset and original when/rate/delay/flags. The
native probe validates these against the actual restored object fields and
original virtual tables before changing memory. It retains original actor IDs,
world association, navigation points, targets, rates, delays and flags.

For each command, the original common dispatcher `005e53c0` runs before and
after rebasing `_when`. Its actual leaf slot is wrapped for the exact private
object and guarded invocation. The callback verifies the original caller and
owner/bank/selector argument frame, then returns before executing the gameplay
leaf. The probe tests initial age, wraparound, one tick before the delay boundary
and the boundary itself. It requires the same dispatch decision in both clock
domains. The real stopped source clock and original command stamp are restored
after each call, including a canceled probe.

Only after all three commands pass does the probe commit their private `_when`
words and update the independently prepared writer expectation. The original
UNIT bank writer must reproduce the edited payload byte-for-byte. Original
drain/clear and actor deletion then reclaim the same exact storage, recovering
heap/pool/hook baselines. There is no published actor or running leaf effect.

The pinned static audit decodes four complete methods, checks 12 anchors and
four virtual slots, and requires internal direct branches and consistent return
stack sizes. The actual game's Move update is `004ab8a0`, delegating to library
`005b7490`; the other selected leaves are Path `005e1330` and Queue `005e2ef0`.
All four methods are curated function entries through the normal generator.
The first executing attempt refuses hook admission while they are still
unhookable data blocks; its terminal failure is preserved separately.

The rebuilt attempt 002 completes all 64 cycles and continued original-game
captures, exits successfully, preserves source/copy hashes and recovers the
tracked memory and hook baselines. The verifier independently recomputes every
expected dispatch decision from the typed input headers and each observed clock
snapshot. It requires all four curated entries, the current pinned audit and
the exact original command writer/cleanup records. Failed attempt 001 is rejected
without producing qualification evidence. Five focused JavaScript tests and
all five configuration checks pass. The original NAS1 producer still reproduces
its prior pack exactly, and fresh NAS2 production reproduces the clock pack.

Evidence is `output/native-actor-clock-stage-attempt-002.json`, its log and
`output/native-actor-clock-stage-observed.json`. That report retains the code
identity actually exercised before the later Brashnard source-selection change;
it is historical evidence rather than a replay against a relabeled source hash.

```sh
node scripts/prepare-native-actor-populated-stage.mjs \
  native-actor-clock-stage-fixtures --clock-probe
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-order-clock-probe.py
python3 scripts/check-native-actor-clock-stage.py \
  output/native-actor-clock-stage-attempt-002.json
```

Source references in the four selected actors are zero. Leaf timer semantics,
nonzero target binding, destination navigation, actual second-world clocks,
activation, continuous streaming and whole-browser memory bounds remain
unqualified. Browser/WASM launches remain suspended while the app crash is
unresolved. The co-op campaign / real internet / expanding-world goal is active.
