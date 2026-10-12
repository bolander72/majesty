# Retained allocation sites across original region visits

Follow-up live owner and embedded-cache observations are documented in
[native-buffer-cache.md](native-buffer-cache.md), including the separate retained
4 KiB group that continues growing.

The native heap probe separated known CRT backing from other live allocations.
A repeated 12,208-byte size accounted for a substantial early difference between
larger-map visits. A size alone does not identify an owner or justify freeing it.

Build018/persistence attempt011 added a bounded delegating observer of original
`0064d5dd` and reused the original free observer. It confirmed a 12,200-byte
request rounded to 12,208 bytes, with allocations and actual frees across region
loads. The operator-new-only caller check did not identify the callers; that
unknown result is preserved in `output/native-allocation-sites-observed.json`
and its exact native generation archive.

Build019/persistence attempt012 extends the audited caller layout to original
`malloc`, including its global new-handler flag and all three matching size
arguments. The independent gate qualifies all original persisted state and
completed-tick boundaries before checking the allocator observations. It then
reads the pinned PE instruction at each captured return site and requires an
actual direct CALL to the recorded allocation wrapper.

All 182 captured allocations identify the same CALL at `00529e6b` in original
`00529c30`, through `malloc` at `0064d59f`. The run also records 180 original frees.
At the final larger-region teardown, all 23 observed live target addresses match
prior captured allocation events. The first load precedes observer installation,
and calloc, realloc and non-CRT origins are not completely captured. A matching
address is not proof of current allocation ownership or safe eviction.

The pinned data-buffer audit shows that this ordinary allocation path reads data
through `005273e0` and installs its buffer through `00558d80` into object `+0x24`.
The setter frees the prior ordinary buffer before replacing that slot. The
scalar destructor `005588a0`, using vtable `00688a70`, frees and clears the slot.
Three changed install/replacement/destruction instructions refuse. This locates
an ownership layout; live owners, reference counts and cache release policy
still need independent observation.

| Visit | Region | Live 12,208-byte blocks after teardown |
| ---: | ---: | ---: |
| 0 | 1 | 28 |
| 1 | 0 | 1 |
| 2 | 1 | 0 |
| 3 | 0 | 24 |
| 4 | 1 | 1 |
| 5 | 0 | 24 |
| 6 | 1 | 0 |
| 7 | 0 | 23 |
| 8 | 1 | 1 |
| 9 | 0 | 24 |
| 10 | 1 | 0 |
| 11 | 0 | 23 |

This size group settles around 23–24 blocks on later larger-region visits and
largely turns over when the next region loads. It does not itself show continuing
per-visit growth over this interval. Other heap allocations still rise; the
whole memory bound remains unqualified. No cache eviction, forced free or other
allocation behavior change has been made.

The twelve-visit run lasts 147.6 seconds. Its 74 process samples reach
188,628,992 bytes RSS (179.9 MiB). Samples do not measure continuous peaks or
browser memory, and differences from earlier runs do not prove an optimization.
Browser game testing remains suspended.

Reproduce from the parent workspace with fresh attempt/report names:

```sh
python3 scripts/build-native-world-residency.py --attempt NEW_BUILD_NUMBER
python3 scripts/run-native-world-residency.py \
  output/native-repeat-handoff-publication-observed.json \
  upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-0bies5/Selected_Entity_Revision.json \
  output/native-world-residency-build-NEW_BUILD_NUMBER.json \
  --attempt NEW_RUN_NUMBER --persist --visits 12 --survivors --allocator --heap --allocation
node scripts/check-native-malloc-sites.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_SITES_REPORT.json
node scripts/check-native-malloc-sites-controls.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_CONTROLS_REPORT.json
```

The opt-in observer permits at most 1,024 allocation/free events. It captures
addresses, sizes and validated return sites, with no buffer payload capture,
allocator replacement or extra free. Four caller-layout instruction mutations
refuse; all 20 observation controls reject contradictions using only copies
of the actual trace
and instruction bytes, without another game launch. All broader world residency,
generated adjacency, continuous travel, co-op transition and browser safety
requirements remain unfinished.

The exact qualified malloc-observation executable and three game sources are
preserved and independently rehashed as the twelfth known native generation.
