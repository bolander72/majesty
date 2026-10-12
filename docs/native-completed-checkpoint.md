# Region checkpoint after a complete original tick

The earlier native heap probe exposed a 50 ms clock advance on every visit
between the persisted checkpoint and original teardown. The fixture saved at
the entry of tick 21 after observing 20 completed ticks, then requested exit;
tick 21 still ran. Its saved state survived revisits, but simulation continued
after that save.

The corrected native diagnostic keeps its first-tick observation at entry and
saves after `fn_00417730` returns from tick 20. A callback then requests exit
through original `00416050`. It refuses saving without the scheduler baton,
from a nested hook, after unexpected phase/world changes, or without the
expected tick increment. The delegating exit observer requires the saved clock
and tick number to remain unchanged. This path remains native-only and uses
owned fixture profiles; browser testing remains suspended.

The pinned executable audit covers the complete original tick, dispatcher and
phase-request path. Request 1 from gameplay phase 3 selects a call-free branch
that writes pending phase 4. After the tick returns, the dispatcher consumes
that pending phase and selects teardown before another simulation tick. Three
instruction mutations and three jump-table mutations are rejected. The exact
frontier adapter addition is reconstructed from the preserved, previously
qualified source and hashed; unrelated changes do not pass its provenance gate.

The independent completed-checkpoint gate first rechecks all original saved
entities, queues, sections, both RNG states, revisits, original root disposal,
scripting counters, CRT accounting and complete heap metadata. It then requires
one correctly ordered completed-save/exit pair per visit, exactly 20 completed
ticks, zero hook depth, scheduler ownership, and zero clock/tick advance between
saving and teardown. Stronger save-payload purity and every transient reference
remain unproven; generated adjacency, seamless travel, sustained memory bounds,
co-op transitions and browser safety require further work.

Official one-job build017 and native persistence attempt010 (PID67957) completed
12 visits, 24 original snapshots, 240 completed original ticks, 10 persisted
revisits and 72 tracked root frees. The independent completed-checkpoint gate
passed all visits with zero save-to-exit clock or tick advance. Its report is
`output/native-completed-checkpoint-observed.json`.
The corresponding controls requalify the actual run and reject 17 contradictory
trace/adapter cases without launching another game.
The exact executable and three game sources are preserved as the tenth known
native generation; three runtime API/test sources are archived alongside them.
All archived files were independently rehashed before further native work.

The run lasted 147.7 seconds. Across 74 process samples, the highest observed
RSS was 189,399,040 bytes (180.6 MiB). This does not measure continuous peaks,
browser memory or playable performance. Unclassified heap grew by 609,856 bytes
in the larger-region comparison; allocation ownership and a sustained memory
bound remain unfinished. Differences from earlier runs do not establish a
memory optimization.

Reproduce from the parent workspace, using fresh attempt/report names and at
most one native build or game process at a time:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-checkpoint-boundary.py \
  --output output/FRESH_LAYOUT_REPORT.json
python3 scripts/build-native-world-residency.py --attempt NEW_BUILD_NUMBER
python3 scripts/run-native-world-residency.py \
  output/native-repeat-handoff-publication-observed.json \
  upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-0bies5/Selected_Entity_Revision.json \
  output/native-world-residency-build-NEW_BUILD_NUMBER.json \
  --attempt NEW_RUN_NUMBER --persist --visits 12 --survivors --allocator --heap
node scripts/check-native-completed-checkpoint.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_BOUNDARY_REPORT.json
node scripts/check-native-completed-checkpoint-controls.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_CONTROLS_REPORT.json
```

The gate uses `output/native-checkpoint-boundary-layout-observed.json` as its
source-bound pinned layout evidence. Preserve that report; a separate fresh
layout report can be compared against it without replacing earlier evidence.
