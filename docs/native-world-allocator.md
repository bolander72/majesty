# Original CRT allocator accounting across region visits

The subsequent [complete heap metadata probe](native-world-heap.md) separates
known CRT backing from individual remaining allocations and records a save-to-exit
clock gap that must be investigated before continuous travel is qualified.

Official one-job build014/native persistence attempt008 (PID61630) completed12
visits,24 original saves,240 completed original ticks and72 tracked root frees.
`output/native-world-allocator-observed.json` independently qualifies all saved
revisits,36 scripting observations and36 allocator observations. The longest
allocator observation took567 microseconds. All observations left the tracked
guest heap, live CRT count, clock and hook count unchanged.

`output/native-world-allocator-persistence-observed.json` retains the complete
independent persistence findings for this exact build/process.
`output/native-world-allocator-controls-observed.json` rejects30 contradictory
observations: wrong class sums, capacities, backing/residual accounting, original
exit counters, elapsed bounds, lifetime/mutation flags, missing/duplicate rows
and observation ordering. The unchanged actual positive passes before each case.
No additional game process is launched for these controls.

The run lasted147.7 seconds with74 exact-process RSS/CPU samples. Highest sampled
RSS was192,331,776 bytes (183.4MiB) and CPU101.2%. The longest observation was
0.567ms. Sampling does not measure continuous peaks, GPU memory or browser
resources. No sustained native residency plateau has been established.

| Same-region comparison | Total guest heap drift | Known CRT backing drift | Other heap drift | Live CRT allocation drift | Live rounded CRT byte drift |
| --- | ---: | ---: | ---: | ---: | ---: |
| Larger region0, visits1→11 | +1,652,736 bytes | +1,065,424 bytes | +587,312 bytes | +277 | +20,432 bytes |
| Smaller region1, visits0→10 | −241,824 bytes | 0 bytes | −241,824 bytes | +470 | +40,928 bytes |

Larger-region pool count grows by one and committed groups by58; the smaller
comparison adds33 committed groups within its existing reservations. These
observations distinguish small live-block growth from the larger backing
capacity and other retained allocations. They justify investigating
fragmentation and allocation ownership; they do not identify an owner or prove
that trimming an existing pool is safe. The probe is read-only, so differences
from the previous run do not establish an optimization or performance gain.

The native-only `--allocator` diagnostic extends the existing persisted-world
and scripting-storage observations. It inspects original CRT small-block heap
tables, committed-group masks, page sentinels and allocation boundary tags.
No guest callbacks, writes, payload reads, free-list traversals, new hooks,
allocator replacements or ownership changes are introduced.

Original `0065545f` independently checks the layout: each committed32KiB group
contains eight4KiB pages; page sentinels are at+8 and+ffc, blocks begin at+c,
sizes are16-byte multiples, allocated blocks have the low bit set and are at
most1024 bytes, header/footer tags match, and counted live blocks equal the
group counter. `scripts/audit-native-crt-layout.py` verifies that instruction
fragment against the pinned PE. Four changed instruction controls refuse.

The observer mirrors this bounded linear boundary walk and accumulates64 live
size classes. Live rounded bytes include CRT headers/footers; they are not exact
requested payload bytes. Allocated plus free block bytes must equal committed
page capacity after excluding page sentinels/prologue. All group counters and
the existing live-allocation count must match.

The original tables expose the known heap backing:1MiB reserved per pool,
16,848 rounded bytes per control allocation (`0x41c4` requested), and the rounded
table allocation. The probe checks those allocation sizes using the runtime's
existing read-only `heap_size` API. The remaining guest heap bytes are reported
as a residual. This does not enumerate or identify the residual's owners.
Reserved bytes also do not measure host physical RSS.

All observer storage is fixed:64 counters. Every sample permits at most64
pools,512 committed groups and600,000 boundary headers. It compares heap
statistics including requested/free bytes and allocation/free totals, live CRT
count, clock and hooks before/after inspection, and refuses observations taking
more than two seconds. No additional game process is required for qualification
or contradictory-observation controls.

Reproduce from the parent workspace with fresh attempt/report names, keeping
only one native build/game active:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-crt-layout.py \
  --output output/native-world-crt-layout-final-observed.json
python3 scripts/build-native-world-residency.py --attempt NEW_BUILD_NUMBER
python3 scripts/run-native-world-residency.py \
  output/native-repeat-handoff-publication-observed.json \
  upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-0bies5/Selected_Entity_Revision.json \
  output/native-world-residency-build-NEW_BUILD_NUMBER.json \
  --attempt NEW_RUN_NUMBER --persist --visits 12 --survivors --allocator
node scripts/check-native-world-allocator.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_ALLOCATOR_REPORT.json
node scripts/check-native-world-allocator-controls.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_CONTROLS_REPORT.json
```

The allocator gate first independently qualifies every actual original save,
revisit, RNG/entity/queue/attachment state, six root frees, resource samples and
scripting observations. It then requires all three allocator samples per visit
in the correct lifetime order, exact class sums/weighted byte sums, committed
capacity, reservation/control/table accounting, unchanged-state flags and
matching original exit heap/CRT counters. It refuses missing or malformed rows.

These diagnostics do not qualify a memory plateau, safe cache trimming,
continuous or generated terrain, co-op region transitions, actual browser
resources or recovery from the reported host-app crashes. Browser game launches
remain suspended.
