# Native retained buffer owners and cache storage

Follow-up allocation origins and active queue callers for the growing 4 KiB
group are documented in [native-page-queues.md](native-page-queues.md).

Build020 / persistence attempt013 observes the candidate `ESI` data owner at the
audited ordinary allocation call. It records an allocation event ID and guest
address in a fixed 512-entry table, clears that record on an observed original
free, and validates exact small-CRT block lifetime at each world boundary.
Thirty-six captures across twelve visits qualify the existing original state,
completed checkpoint, teardown, heap and allocation-event checks. Twenty-nine
contradictory metadata/log controls refuse. The first load remains unknown.

The actual retained owners have the expected vtable and buffer slot, but their
cache pointers are embedded in a larger directly allocated index array. Treating
those pointers as independent CRT allocations cannot qualify their reference
counts. The first report preserves that unknown result instead of assuming zero.

Build021 / attempt014 extends the opt-in observation to embedded cache storage.
An entry is readable only if its fields fit an exact live small-CRT payload, or
fit entirely inside a complete guest heap allocation excluding the known CRT
table, controls and reservations. A reservation alone does not establish that
an interior CRT block is live. Storage bounds do not establish logical entry
lifetime; reused objects and unobserved allocator paths remain limitations.

The fixed record grows from 60 to 72 bytes to include storage kind, containing
allocation address and requested bytes. The maximum file grows from 30,760 to
36,904 bytes. The observer still has four delegating hooks, captures no buffer
payload, performs no guest allocations or frees, holds the scheduler baton, and
checks unchanged heap counters, game clock and installed hook count.

The pinned original acquire/release code links `owner+4` to a cache entry whose
`+0x10` links back to the owner; `+0x14` holds its reference count. Resource sizes
include a 26-byte header and 1,032 bytes per signed 16-bit header entry, which
the original loader subtracts before its buffer allocation. The header count
itself is not captured. Observed size differences are checked for consistency
with that calculation, rather than incorrectly equating cache size and buffer
input. Six reference-layout and one size-layout instruction controls refuse.

At the observed boundaries in attempt014, all qualified embedded entries have
zero references. They still link back to allocated owners holding the target
buffers. This does not authorize eviction: the original action-2 release path
consults a cache policy callback before invoking the destructor. Its live policy
decision remains unobserved. The target group mostly turns over between regions
and settles around 23–24 retained blocks on later larger-region visits.

| Visit | Region | Target blocks after exit | Qualified zero-reference backlinks |
| ---: | ---: | ---: | ---: |
| 0 | 1 | 28 | 0 (baseline unknown) |
| 1 | 0 | 2 | 0 (baseline unknown) |
| 2 | 1 | 0 | 0 |
| 3 | 0 | 24 | 24 |
| 4 | 1 | 1 | 1 |
| 5 | 0 | 24 | 24 |
| 6 | 1 | 0 | 0 |
| 7 | 0 | 23 | 23 |
| 8 | 1 | 1 | 1 |
| 9 | 0 | 23 | 23 |
| 10 | 1 | 0 | 0 |
| 11 | 0 | 23 | 23 |

Thirty-six contradictory cache metadata, storage bounds and immutable-boundary
log controls refuse. All twelve original visits, 24 state snapshots, ten
persisted revisits, 240 completed ticks and 72 tracked root frees still pass.
The longest cache observation is 218 microseconds. The native run takes 147.6
seconds; 74 samples reach 193,658,880 bytes RSS (184.7 MiB). These are sampled
native observations, not browser peaks or evidence of a performance improvement.

A separate 4,096-byte allocation group grows from 9 to 21 blocks across the
same twelve teardowns: 49,152 bytes of net growth, with no removal from its
observed address sets. Address persistence does not prove allocation identity
without allocation/free events. Its allocation origin remains unqualified and
is the next tracing target. Other allocation groups also contribute to growth.

The native generations are copied, synced and rehashed with 4 KiB buffers before
future source changes. Browser launches remain suspended, and the served WASM
has not changed. Sustained memory bounds, generated adjacent terrain, seamless
travel, cooperative handoff and internet full-match completion remain unfinished.

Reproduce from the parent workspace with fresh attempt/report names:

```sh
python3 scripts/build-native-world-residency.py --attempt NEW_BUILD_NUMBER
python3 scripts/run-native-world-residency.py \
  output/native-repeat-handoff-publication-observed.json \
  upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-0bies5/Selected_Entity_Revision.json \
  output/native-world-residency-build-NEW_BUILD_NUMBER.json \
  --attempt NEW_RUN_NUMBER --persist --visits 12 --survivors --allocator --heap --allocation --owners
node scripts/check-native-buffer-cache.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_CACHE_REPORT.json
node scripts/check-native-buffer-cache-controls.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_CONTROLS_REPORT.json
node scripts/check-native-retained-pages.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_PAGE_REPORT.json
```

Evidence: `output/native-buffer-owners-observed.json`,
`output/native-buffer-owners-controls-observed.json`,
`output/native-buffer-cache-observed.json`,
`output/native-buffer-cache-controls-observed.json`,
`output/native-retained-pages-observed.json`,
`output/native-owner-generation-preserved-observed.json` and
`output/native-cache-generation-preserved-observed.json`.
