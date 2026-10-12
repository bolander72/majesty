# Twelve original save/unload/revisit cycles

Actual native attempt004 (PID54414, official one-job build009) completed12
alternating visits to the two committed mission fixtures:24 original snapshots,
240 completed original ticks and72 tracked world/navigation root frees. All
ten revisits preserve the latest clock, both RNG states, entities, queues and
command-container bytes. These are existing missions loaded through the original
menu. Generated adjacency, continuous travel, co-op handoff and browser
integration remain unfinished. Browser game launches remain suspended.

Extended diagnostics accept3–32 visits and require persistence and owned native
profiles. The observer retains fixed six-root arrays and three delegating hooks.
The extended script captures only its final menu frame. The previous qualified
three-cycle executable/sources were copied and rehashed before the engine change;
that earlier persistence qualification revalidates against its preserved build.

The game spawned UNIT2147 in the larger region during its first visit. Its83
order-container records serialize with2147 last before unload, then in the
factory's existing group after reload. All keyed records, bytes, counts, sizes
and within-container order match. The original raw-root equality check refused
this difference. Static inspection of the pinned216-byte/71-instruction reader
005b1cf0 shows004ef740 reading the saved unit ID,005a10d0 resolving it, and
005c1f30 receiving that resolved unit. Writer005b1ef9..005b1f00 emits Unit+60 as
the prefix. Three contradictory instruction controls refuse. The independent
gate permits only this audited serialization permutation when every keyed byte
and root header matches. All other sections retain full equality apart from
validated save labels/calendar timestamps. Changed command data never qualifies.

The run lasted147.6 seconds. Exact-process `ps` sampling produced74 native
RSS/CPU observations. Highest sampled RSS was187,809,792 bytes (179.1MiB);
highest sampled CPU was101%. The two-second sampler stops its own test on
sampling failures or RSS above1GiB. The gate checks PID/timing, gaps no greater
than4 seconds, and a fresh final sample. These samples do not establish maxima
between observations, browser memory bounds, GPU usage, or host-app crash safety.
The served WASM is unchanged.

Retained allocations have not established a plateau:

| Region | Visits | First post-unload heap bytes | Last post-unload heap bytes | Heap increase | Increase in live CRT allocations |
| --- | --- | ---: | ---: | ---: | ---: |
| 0, larger mission | 1,3,5,7,9,11 | 22,636,176 | 25,305,504 | 2,669,328 | 273 |
| 1, smaller mission | 0,2,4,6,8,10 | 23,234,304 | 24,082,320 | 848,016 | 472 |

Remaining caches/managers and references need investigation. Freeing all six
world roots does not prove that every retained allocation belongs to a bounded
cache or that there is no leak. Sustained original-engine and browser memory
bounds remain unqualified.

One concrete diagnostic target follows from the original teardown listings:
004170a0 obtains the scripting runtime through00623b20 and calls00623a70.
That reset destroys/replaces only runtime+4 (the agent manager), resets the
next-agent counter, and leaves the six constructor-owned submanagers at+8
through+1c intact. Their cleanup is in the separate runtime destructor00623440.
The00628c60 getter keeps its global environment at007218b4. These surviving
submanagers are candidates for bounded retained-storage measurements; the
listings do not establish that they caused the observed growth. No raw frees
or invented ownership changes have been added.

Evidence:

- `output/native-world-persistence-extended-observed.json`: binds the stopped
  process/build/exports, all24 snapshots, ten preserved revisits, actual container
  permutation, final regional publications and resource samples.
- `output/native-world-persistence-extended-controls-observed.json`: unchanged
  actual positive checked before every case;24 stale/corrupt/contradictory save,
  trace or resource cases refuse. A valid calendar change and the actual original
  ID-keyed container permutation pass. No additional game process starts.
- `output/native-world-attachment-keying-observed.json`: pinned reader/writer
  instruction evidence and three contradictory-code controls.
- `output/native-world-persistence-archived-revalidated-observed.json`: previous
  three-cycle findings remain exact against the preserved generation.

Reproduce from the parent workspace with fresh build/run/report numbers. Keep
only one native game/build active:

```sh
python3 scripts/build-native-world-residency.py --attempt NEW_BUILD_NUMBER
python3 scripts/run-native-world-residency.py \
  output/native-repeat-handoff-publication-observed.json \
  upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-0bies5/Selected_Entity_Revision.json \
  output/native-world-residency-build-NEW_BUILD_NUMBER.json \
  --attempt NEW_RUN_NUMBER --persist --visits 12
node scripts/check-native-world-persistence.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_REPORT.json
node scripts/check-native-world-persistence-controls.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_CONTROLS.json
```

When a journey observes a container permutation, the pinned attachment-keying
audit is required. It is saved in this workspace. A fresh workspace produces it
with the game's Python environment, before qualification:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-attachment-keying.py \
  --output output/native-world-attachment-keying-observed.json
```

The next measured journey adds original scripting-manager/value-pool counters.
See [native-world-survivors.md](native-world-survivors.md) for actual lifetime
observations, unchanged registry/batch counts, remaining heap growth and controls.
