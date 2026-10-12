# Private arrival at destination ground height

Subsequent [same-actor composition](native-actor-composed-arrival.md) joins the
grounded candidate with restored commands and full owned routes, including
64 actual saved-file graph replays. Live activation remains unqualified.

Native attempt 014 passes 64 grounded original UNIT restorations across actors
2101, 2105, 2122 and 2136. It retains the qualified fractional origin transform
and separately translated logical cells, and restores Z at the destination's
original terrain height. All 256 collision calls, exact original UNIT writers,
actor deletion, grid preservation, identity counters, heap totals, CRT pool
occupancy and hook baselines pass. Actors remain private with ID/world zero.

This qualifies a restricted private arrival policy, not live simulation transfer.
The previous [terrain observation](native-actor-cross-ground.md) remains immutable
and records the old source Z values; the new fixture edits only restored Z.

## Cache and placement policy

The version-nine PRIMARY raw block is 60 bytes. Saved cache presence is at UNIT
offset 80 and mode at 84. Cache serialization follows that block: version at 92,
active value at 96, and two point words at 100/104. The trailing raw-block word
at 88 remains opaque. Reading consecutive words beginning at 80 as the cache
would confuse presence/mode/raw data with actual cache state.

All four source actors have mode 1, an existing version-one cache and active
value zero. Native restoration independently confirms mode at actor `+78`,
the owned cache pointer at `+7c`, and its zero active value. The unused point
words are preserved exactly. Original consumer `005b91b0` obtains this existing
cache through `005b9e20` and returns before point reads or blocking lookup when
inactive. All 64 actual native calls take that path and leave complete actor
and cache bytes unchanged. Thirty-four pinned instruction anchors verify
PRIMARY layout and that control flow.

The private grounding helper requires the pinned 375-byte, parentless,
version-nine mode-one record with existing version-one inactive cache. It only
changes saved Z before invoking the original UNIT reader. Five malformed inputs
per restoration—parented, absent cache, special mode, unsupported cache version
and active cache—are rejected before editing the prepared bytes. All **320**
native refusal checks preserve that prepared buffer.

The restored Z values are 94946, 76535, 74714 and 75896. Original loaded-terrain
queries independently confirm every value. The complete world-dependent ground
setter is not invoked on a world-zero actor. The previously observed small
source Z differences are not copied as an intentional altitude offset; their
cause remains unqualified. Active movement and animation state need separate
migration work before command scheduling or live publication.

## Verification and limits

The original writer matches each full translated UNIT byte for byte, including
opaque fields and unused cache words. The checker also reads the actual last
writer file independently, allowing only unpublished identity normalization,
XYZ and logical-cell edits relative to the source record. Eleven offline
controls reject missing/wrong heights, mode/cache state, refusal or original
consumer evidence, writer mismatches, virtual corruption of the last writer
file, the actual observation-only attempt 013 and invalid runner options.
They do not modify original artifacts or launch a game.

The source populated command graphs still pass their reference/time edits,
stale-route invalidation, 68 complete destination point searches and original
cleanup. Those graphs are separate from the extra grounded UNIT candidates.
The fresh 17-point routes are not attached to ten-point source Path storage.
The next integration must compose grounded state and intended command goals in
one owned graph, with adequate route capacity and durable entity correspondence,
then qualify world association, handoff and activation.

Supplied origins between unrelated Brashnard/Scions checkpoints do not establish
continuous terrain or entity identity. Live crossings, dormant-region recovery,
full browser resource bounds, complete cooperative campaigns and independent
internet matches remain open. The browser/game launch suspension remains in
force; the served WASM is unchanged and the full goal remains active.

## Reproduction and evidence

Build through the official native tools with one job. Add `--grounded-placement`
to the existing cross-destination fixture options `--ground-probe
--placement-probe --fresh-route-probe --landing-probe --invalidate-path
--navigation-probe`, using a fresh attempt number and the qualified source
report. Do not overwrite existing attempts or profiles.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/check-native-actor-grounded-placement.py \
  output/native-actor-cross-destination-attempt-014.json \
  --output output/native-actor-grounded-placement-observed.json
upstream/majesty-recomp/.venv/bin/python scripts/check-native-actor-grounded-placement-controls.py \
  output/native-actor-cross-destination-attempt-014.json \
  --output output/native-actor-grounded-placement-controls-observed.json
```

Additional immutable evidence is in
`output/native-actor-grounding-instruction-audit.json` and the terminal attempt
014 manifest/log. Historical ungrounded qualifiers refuse the new mode unless
the separate ground/cache qualifier is selected.
