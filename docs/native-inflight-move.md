# In-flight movement across a region coordinate change

Producer 027 and fresh full reload 004 qualify a correction to one specific
transfer fixture: parentless ground war-follower NPCs with an already-running
Move, a queued Path and a Follow command. All four actors complete 16 composition
cycles; one restored NPC then moves under the original command dispatcher for 240
ticks. These are native tests in owned copied profiles. The served WASM is
unchanged, and browser launches remain suspended during the host-app crash
investigation. General heroes, source departure, repeated region crossings,
continuous streaming and browser resource bounds remain unqualified.

## Failure found by actual continuation

The preceding [full-world persistence fixture](native-joint-reload.md) preserved
the entire command graph, but had transformed only actor position/logical cells,
script destination and Path data. The already-running Move retained its source
destination. Its original target ID is zero, so original refresh 005b7430 does
not replace that cached point through a native target lookup.

Reload 003 completed 240 ticks but failed motion qualification: no original Path
calls occurred. Actor510 moved toward x=5168 in a destination world whose width
is 4096. The declared collision footprint stayed registered at its original
logical cells. Those observations did not prove spatial coherence with the
actor's changing floating position. Reload 002, using a host clock that advanced
on presentation, did not complete 240 ticks and is also unqualified. The bounded
motion runner now uses a monotonic host clock; original simulation ticks still
advance the guest game clock by50ms.

## Correct original point setter

The pinned executable's Move has native cached Q11 coordinates at +3c/+40/+44.
Its base writer 005b6d60 emits those three DWORDs through 004f6ad0; the kind 2 saved
body contains them at bytes 104/108/112. Pure setter 005b7990 writes exactly those
three native fields and returns with 12 bytes of arguments removed. The static
audit checks complete instruction ranges, 18 anchors and four original Move
vtable slots. The game leaf 004ab8a0 delegates to 005b7490.

Read-only inspection of both pinned copied worlds establishes, for all four
source actors, that the saved Move goal equals the saved logical navigation
cell multiplied by 32768. Its Z equals original-compatible source terrain
interpolation exactly, with no height offset. The goal is the remaining current
step, so its XY translation uses the same origin delta as the actor. It does
not use the later Path's target-relative approach transform.

| Source actor | New Move Q11 XY | New terrain Q11 Z |
| --- | --- | --- |
| 2101 | 2195456,4489216 | 95001 |
| 2105 | 3571712,5668864 | 76578 |
| 2122 | 4718592,2850816 | 74759 |
| 2136 | 4521984,3604480 | 76160 |

The opt-in --rebase-inflight-move fixture calls original terrain sampler 005af220
at the new goal, then original setter 005b7990 while the command is private and
owned by its allocation journal. It requires a zero native target, the observed
flag values 0 or 4000, a single 4096-pixel origin change, a goal at the translated
logical cell, and destination terrain bounds. It compares every other native
command byte and the complete native actor structure, then compares complete
original writer files independently against literal source records. Queues,
flags, rates, remaining XY displacement and previously rebased command ages
remain intact. It never removes the Move, skips the Path or jumps the actor.

Producer 026 passed 48 cycles, then aborted on an overly strict 4000-only flag
precondition: actor2136 has flags 0. It remains a failed terminal attempt. After
allowing that observed flag without editing it, producer 027 terminated with
exit 0 and qualified 64 point setters/height queries, 192 complete joint writer
records, 68 monotonic identity reservations/retirements and allocation recovery.
The original full-world checkpoint adds just UNIT510/GPL79/ORDR510; all 501
existing records remain byte-identical.

## Natural continuation after fresh full-world load

Fresh reload 004 uses a distinct process/profile and the exact corrected 320050-byte
original checkpoint. The original loader visits 481 units. All three initial
actor/script/command writers and native/script backlinks match the producer.

Four fixed delegating hooks observe original common dispatch, Move, Path and
Queue. They always call the next original handler and do not edit game state.
The observer uses fixed storage and logs 16 samples over 240 original simulation
ticks. It observed 484 common calls/returns and 197 leaf calls/returns, including
41 original Path calls. The actor's sampled logical cells changed from 67,137
to 107,131. Its declared six-cell collision footprint, drawing registration and
native/script associations remained valid. All four hooks were removed at
completion. The native process terminated with exit 0.

This establishes natural movement and navigation-cell transitions for this one
NPC. Drawing registration is not a rendered-pixel or animation qualification.
It does not measure whole-browser/GPU memory, complete a co-op match, or establish
a committed ownership handoff between two persisted regions.

## Evidence and reproduction

- output/native-inflight-move-preflight.json: four source goals, exact source
  terrain heights and independently derived destination points; reads capped at 4096.
- output/native-inflight-move-instruction-audit.json: pinned original instructions.
- output/native-inflight-move-identity-observed.json: producer 027,64 cycles and 192
  exact joint writers, including the corrected Move point.
- output/native-inflight-move-checkpoint-observed.json: complete original saves
  and 501 unchanged existing records.
- output/native-joint-motion-observed.json: fresh reload 004 and 240 natural ticks.
- output/native-joint-motion-controls-observed.json: 19 offline refusals, including
  absent Path execution, stationary cells, broken links/membership, retained hooks,
  stalled clock, incomplete observation and corrupted restored Move data.
- output/native-inflight-move-js-tests.log: 22 terrain, coordinate and order tests.
- output/native-inflight-move-build.log and output/native-inflight-move-flags-build.log:
  official jobs-one smoke builds; both completed with exit 0.

Add --rebase-inflight-move to the complete --joint-checkpoint producer invocation
documented by the linked full-world/identity fixtures. Require both independent
producer checks before a fresh reload. Use fresh attempt numbers and report
filenames; the runners refuse to overwrite prior evidence.

```sh
python3 scripts/run-native-joint-reload.py \
  output/native-inflight-move-checkpoint-observed.json \
  output/native-inflight-move-identity-observed.json \
  --attempt <fresh-number> --observe-motion
python3 scripts/check-native-joint-motion.py \
  output/native-joint-reload-attempt-004.json --output output/<fresh-report>.json
python3 scripts/check-native-joint-motion-controls.py \
  output/native-joint-reload-attempt-004.json --output output/<fresh-controls>.json
```

Run at most one heavy native/build process at a time, confirming its actual handle
is terminal before the next. Continue toward a durable ownership/reference ledger,
source departure and repeated region crossings before claiming an expanding
original-engine world. The full co-op, internet-play and browser-bounds goal stays
active.

The subsequent [original NPC departure fixture](native-npc-departure.md) removes
the relocated copy and preserves all 501 other saved records. It also shows that
this composed script is absent from active queues; normal GPL scheduling remains
a required step beyond the natural command movement qualified here.

The subsequent [saved scheduling fixture](native-npc-scheduling.md) adds that
missing queue entry through the original routine, verifies AI after a fresh full
reload without reinsertion, and removes the scheduled NPC while preserving the
other queue entries. Continuous regions and ownership handoff remain open.
