# Original scripting storage after world unload

Official one-job build013 and native persistence attempt007 (PID59351)
completed12 visits,24 original saves,240 completed original ticks and72 tracked
root frees. `output/native-world-survivors-observed.json` independently qualifies
all persisted revisits and36 lifetime-ordered survivor observations. The run
lasted147.6 seconds;74 exact-process samples reached194,691,072 bytes
(185.7MiB) RSS and100.8% CPU. These are sampled native observations, not browser
or continuous peak measurements. The served WASM is unchanged.

`output/native-world-survivor-persistence-observed.json` also retains the full
independent original save/clock/RNG/entity/queue/attachment/teardown findings
for this exact terminal process and build. The goal remains active.

`output/native-world-survivor-controls-observed.json` rejects25 contradictory
observations, including missing/extra/reordered rows, absent required managers,
nonzero counts in absent registries, replaced pointers, invalid counts and
capacities, incorrect byte sums and changes to heap/CRT/clock/hooks. The unchanged
actual observation passes before every case. No extra game process is launched.

| Same-region comparison | Registry count drift | Allocated batch drift | Free-value drift | Pointer-vector backing drift | Post-unload heap drift |
| --- | --- | ---: | ---: | ---: | ---: |
| Larger region0, visits1→11 | All ten counts unchanged | 0 | −539 | 0 bytes | +2,766,992 bytes |
| Smaller region1, visits0→10 | All ten counts unchanged | 0 | −369 | +8,000 bytes | +848,016 bytes |

The pool contains100 batches after every unload. Pointer-vector capacity
increases from314,112 to322,112 bytes on the first larger-region visit and stays
at322,112 bytes thereafter. Slots `+c` and `+10` remain null. The three present
registry pointers (`+8`, `+14`, `+18`) change at each subsequent load, while
runtime/value-pool pointers remain stable. This agrees with the audited original
registry reconstruction and initialization paths.

The heap increase therefore is not explained by increasing registry counts or
large increases in pointer-vector capacity. Falling free-value counts also
require ownership investigation; constant batch counts do not prove every value
or nested allocation has been released. Shared caches, nested value resources,
remaining heap blocks and live CRT size classes are the next candidates. No
storage has been forcibly freed based on these observations.

Attempts005 and006 stopped during observer setup and are preserved. Attempt005
has no detailed refusal line; attempt006 explicitly rejected an absent registry
at runtime+c. Static inspection corrected both nullability and the earlier
mistaken batch/value comparison before the successful attempt007. Build011 added
refusal logging but was not launched; builds010,012 and013 each had a separate
owned native run. No builds or game processes overlapped.

The opt-in native diagnostic records the original scripting-runtime manager
slots at load, immediately before original world exit, and after exit. It
reads ten registry size fields and the headers of the value pool's master
pointer vector and nine free-value vectors. It does not construct missing
managers, traverse their trees, free storage, invoke guest callbacks, install
additional hooks, or change guest ownership. The existing residency observer
still uses three delegating hooks and six tracked world roots.

Original `006289e0` deletes and zeros runtime slots `+c` and `+10` during script
initialization. These slots may therefore be absent; their presence and counts
are recorded explicitly. The other four slots must contain their expected
objects. This corrects the earlier assumption that all six constructor-created
managers remain present. Manager pointer stability is checked within each world
lifetime. Original `00628670` deletes and reconstructs the first five slots
between loads, leaving the value pool at `+1c` intact. Runtime and value-pool
pointers must remain stable throughout the journey; registry replacements are
recorded explicitly rather than confused with unexplained ownership changes.

Original `0062abf0` allocates arrays of values. The master vector contains one
pointer per allocated batch, while each free vector contains pointers to
individual values. Batch counts cannot be subtracted from free-value counts to
infer live values. The diagnostic reports batches and reusable values separately.
It measures pointer-vector backing capacity, not the arrays' storage, nested
resources, tree nodes, or complete transitive ownership.

`scripts/audit-native-value-pool.py` verifies initialization and type1 batch
creation and registry reconstruction against the exact pinned PE. Three altered
instruction controls refuse.
The audit reads at most4096 bytes at once and starts no game process.

The native observer uses fixed host arrays, reads vector headers only, bounds
aggregate pointer-vector capacity to1MiB, and compares guest heap statistics,
live CRT allocation count, clock and hook count before/after observation. Any
invalid layout or unexpected mutation aborts this owned test. Null registry
slots are recorded as null rather than dereferenced.

Reproduce from the parent workspace, using fresh attempt/report names and only
one native build/game at a time:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-value-pool.py \
  --output output/native-world-value-pool-reload-observed.json
python3 scripts/build-native-world-residency.py --attempt NEW_BUILD_NUMBER
python3 scripts/run-native-world-residency.py \
  output/native-repeat-handoff-publication-observed.json \
  upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-0bies5/Selected_Entity_Revision.json \
  output/native-world-residency-build-NEW_BUILD_NUMBER.json \
  --attempt NEW_RUN_NUMBER --persist --visits 12 --survivors
node scripts/check-native-world-persistence.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_PERSISTENCE_REPORT.json
node scripts/check-native-world-survivors.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_SURVIVOR_REPORT.json
node scripts/check-native-world-survivor-controls.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_CONTROLS_REPORT.json
```

The survivor verifier first qualifies the actual original persistence run:
native build/source/executable provenance, every original save and revisit,
both RNGs, all entity/queue/attachment records, six root frees per exit, and
bounded exact-process RSS sampling. It then requires all three survivor rows
per visit, lifetime-correct manager pointers, valid counts/capacities, exact backing byte
sums, absence-consistent tree counts, unchanged observer state and correct order
relative to save/request/exit. Missing or malformed rows cannot be ignored.

Browser launches remain suspended because of the reported host-app crashes.
These native counters do not qualify a memory plateau, safe trimming, generated
adjacent terrain, continuous travel, co-op region handoff, or browser resources.

The following journey separates actual small-block sizes and CRT backing from
other heap bytes. See [native-world-allocator.md](native-world-allocator.md).
