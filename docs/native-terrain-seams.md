# Saved terrain boundary qualification

The expanding-world scene can locate independent native kingdoms next to each
other, but their shared vertex records do not currently agree. A continuous
native world needs reconciled borders and compatible navigation before heroes
can safely cross them. This work reads stopped original snapshots, identifies
the disagreement and adds an optional publication check; it does not rewrite
the maps or provide live crossing.

`NativeTerrain.edge(side, start, count)` extracts a left/right/top/bottom vertex
strip, ordered along increasing local coordinates. It reads at most 33 records,
including the final map endpoint, in an owned buffer of at most 297 bytes.
Horizontal strips use one bounded row read; vertical strips read nine bytes
per vertex. Edge and window reads share the same busy state, accept no queue,
reject changed/truncated input and allow retry after failure.

`compareTerrainSeam(first, second, axis)` compares right/left edges for `x`
and bottom/top edges for `y`. The shared dimension must match; the perpendicular
dimensions may differ. It walks every vertex in serial strips, retaining at
most 594 packed vertex bytes plus bounded digest/scalar state. Results include
two SHA-256 digests, mismatch counts by byte offset, first mismatching vertex
and counts for the first four height bytes versus the remaining opaque fields.
It does not interpret those opaque fields or normalize heights.
The later [native lifecycle audit](native-terrain-lifecycle.md) identifies byte
4 as recomputed shading and separates its mismatch count from the opaque word.
It adds a `height-bytes` scene policy for geometry checks; exact-record policy
continues to require equality of all nine bytes.

The stopped native source/destination snapshots have 128-cell maps and 129
vertices per border. Before and after actor migration, the observations are:

| Border orientation | Different records | Different height bytes | Different other fields |
| --- | ---: | ---: | ---: |
| right/left (`x`) | 127 / 129 | 118 / 129 | 120 / 129 |
| bottom/top (`y`) | 129 / 129 | 0 / 129 | 129 / 129 |

These are two existing kingdoms examined in two orientations and two snapshot
states. They are not newly generated adjoining realms. The stored height field
is established by the pinned executable's terrain save/load evidence; matching
serialized records alone does not establish navigation/material compatibility.

For a byte-exact shared-vertex publication requirement, use:

```js
const scene = new NativeTerrainScene(provider, {seamPolicy: 'exact-vertices'});
```

After loading and snapshot cleanup, this policy compares every available
horizontal/vertical neighbouring window, including cross-realm boundaries and
corner endpoints, before publishing the new scene. It uses no additional
terrain buffers. A mismatch leaves the previous scene and identity intact;
its private incoming windows are discarded. Unavailable regions stay absent.
This check is opt-in: the existing independent saved-map diagnostic remains
available, and neither mode claims continuous native simulation.

Four focused reader/comparator tests cover bounded strips, all endpoints,
both axes, different perpendicular dimensions, opaque-byte mismatches,
shared busy state, failure recovery and oversized backing-buffer rejection.
Three additional scene tests cover mismatches in both boundary orientations,
height/opaque fields, absent regions, rollback/retry and alteration during
snapshot cleanup. That milestone passed 196 tests; the subsequent native
lifecycle/geometry distinction brings the complete suite to 197.

The real-file qualification verifies all four seam comparisons and loads a
source-only native scene under the exact policy. Travelling toward its copied
destination is rejected, preserving the old scene. The independent projection
can still show the destination. Actual strict-scene residency peaks at 24
windows / 358,104 packed bytes; file reads stay at 4096 bytes with one open
read handle. An independent Python binary extractor verifies both edge hashes,
every per-byte mismatch count, category counts and first mismatch for all
four cases. Original fixture files remain unchanged.

Read-only CLI:

```sh
node scripts/inspect-native-seam.mjs FIRST.GMP SECOND.GMP x
```

Evidence is in `output/native-terrain-seam-real-files-observed.json`,
`output/native-terrain-seam-independently-observed.json` and
`output/native-terrain-seam-terminal-qualified.json`. No browser, game or heavy
build was launched. The app-crash testing restriction remains active. Canonical
shared-edge ownership, generated terrain reconciliation, native map/nav updates,
transactional cooperative regional state and live hero crossing remain required.

The subsequent [draft reconciliation prototype](native-terrain-reconciliation.md)
copies neighbour heights into isolated destination files and accepts the copied
shared heights under the geometry policy. The original snapshots retain the
differences reported above; engine reload and live crossing remain unverified.
