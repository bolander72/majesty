# Private script restoration in the destination kingdom

Subsequent [same-actor composition](native-script-composed-arrival.md) in
attempt020 adds 64 simultaneous UNIT/EA/GPL/command associations. Native identities
and activation remain unqualified; the earlier evidence below remains immutable.

Destination attempt 019 qualifies **64 private original GPL restore/write/delete
cycles**, following four warmup cycles. The original constructor reserves 68
distinct world-local IDs monotonically (11 through 78 in this isolated run).
The counter ends at 79 and is never rewound. Each private clone stays outside
the ID tree and active queues, with native UNIT association and cached backlink
both zero.

The [original namespace witnesses](native-actor-script-witness.md) establish
source agents 37, 41, 57 and 69 and leader mapping 12 to 2. Both self-reference
sites are patched to the original constructor's reserved ID. Both leader sites
are patched to actual destination agent 2. All sentinel values, inactive
context state, function names and other bytes remain unchanged.

The active context retains its original delay, flags, remainder and running
state. Its timestamp changes from source-clock 4000 to destination-clock 8650,
preserving ages 100, 100, 0 and 250 ms. Root script destinations change from
`(2352,5936)` to `(1677,2170)`, the same target-relative approach policy as the
qualified Path command. This supplied checkpoint fixture policy does not
establish persistent entity correspondence or installed script consumer
semantics. Scripts are not executed during this experiment.

## Original restoration and bounded cleanup

The prepared NGS1 pack is 6027 bytes, capped at 8192. Each of four selected GPL
records is capped at 4096 bytes, with four typed reference descriptors. Complete
typed parsing validates literal saved records before transformation. Self IDs
are finalized only after the native constructor reserves them. The runner
rejects incomplete fixture dependencies before creating a profile or process.

Original `006269b0` reads each privately written input; original `00626740`
writes its complete saved result. An independent verifier reconstructs each
expected record from pinned original bytes and compares **all 68 actual writer
files** byte for byte, including their distinct IDs. Original `00625fa0` and
CRT free release each clone. GPL pools are warmed across all four shapes once;
all subsequent heap, requested-byte, GPL pool and CRT occupancy totals recover
after every cycle. The destination leader header, ID registration count, active
and deferred queues, clock, factory identity counter and hooks remain stable.
This does not snapshot every linked destination script allocation.

Attempt 019 also passes the existing 64 grounded private actor/command
compositions and 64 actual saved-file command replays. Those actors and the
new script clones are still separate: **same-actor UNIT/GPL association and
live activation are not qualified**. Ten contexts per script serialize unchanged
except the selected active stamp. Script destinations match the independently
qualified command goal.

## Reproduction and evidence

`scripts/prepare-native-script-stage.py` prepares the pack from qualified
source/destination witnesses. Use `--basename <fresh-name>` to reproduce without
overwriting prior evidence. The runner uses the original prepared
`output/native-script-stage-fixtures.bin/.json`. Add
`--private-script-stage --script-witness` to the existing cross-destination
composed-arrival command, with a fresh attempt number. Native builds use
`tools/build.py --target smoke --jobs 1`, one heavy process at a time.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/check-native-script-stage.py \
  output/native-actor-cross-destination-attempt-019.json \
  --output output/<fresh-stage-report>.json
upstream/majesty-recomp/.venv/bin/python scripts/check-native-script-stage-controls.py \
  output/native-actor-cross-destination-attempt-019.json \
  --output output/<fresh-control-report>.json
```

`output/native-script-stage-observed.json` records exact native results.
`output/native-script-stage-controls-observed.json` records **28** offline
corrupt-log, actual writer, missing-feature and real predecessor refusals without
modifying original evidence or launching a game.
`output/native-private-script-stage-build.log` records the single official
jobs-one build for the native edit.

Next work must link a restored UNIT, its EA attribute, original order banks and
private script under consistent reserved identities, then qualify movement and
script behavior, teardown and activation. Continuous region paging and a
bounded browser simulation remain unproved. Full co-op completion, shared
objectives and independent internet testing retain their full scope. Browser
launches remain suspended while the reported host-app crash is unresolved;
the served WASM is unchanged.
