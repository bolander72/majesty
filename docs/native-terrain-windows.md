# Native saved terrain windows

`web/world/terrain.mjs` reads terrain from a stopped native GMP checkpoint.
It retains dimensions and byte offsets, then returns one small window without
assembling the whole terrain array or save file. It is a read-only foundation
for loading real maps into the streaming work. The running Majesty renderer,
navigation, physics and world checksum still use their original flat arrays.

The pinned executable's MAP/MTER descriptors and save/load routines establish
the compact record layout. Run the read-only instruction audit with the game
virtual environment:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-terrain.py
```

The audit refuses a different executable SHA-256. MAP reader/writer callbacks
are `005f3570`/`005f3690`; MTER callbacks are `005f2a80`/`005f2fa0`. The writer
uses width/height from MAP and writes the vertex and cell records individually.
Its vertex height scale is 1/65536. This evidence locates fields; it does not
qualify changing them in a running engine.

| Container | Primary version | Data bytes | Count |
| --- | --- | --- | --- |
| MAP | 2 | 40 | 0; first two words are width and height |
| MVTX within MTER | 2 | 9 per vertex | (width + 1) × (height + 1) |
| MCEL within MTER | 5 | 5 per cell | width × height |

The current reader rejects missing or duplicate map/terrain groups, mismatched
versions/counts/sizes, invalid chunk ends and unsupported dimensions. Its
dimension limit of 1024 per side is a reader policy, not a claim that all maps
of that size run in the engine. Source files keep the existing 64 MiB bound.
The [native lifecycle audit](native-terrain-lifecycle.md) now identifies the
saved shading byte and the native derived normal vector. The remaining saved
vertex word and cell fields remain opaque byte data.
The reader neither normalizes them nor invents terrain semantics.

`checkpointTerrain(source)` returns an object with `width`, `height` and
`window(x, y, width, height)`. Window coordinates are native cell coordinates.
A window contains packed `vertices` and `cells` arrays. Width/height are at
most 32 cells; it includes the far edge vertex row and column. A full window
contains 33 × 33 × 9 + 32 × 32 × 5 = 14,921 bytes. Adjacent windows share the
same boundary vertices and have separate cells.
The [boundary reader and seam comparison](native-terrain-seams.md) can now
extract at most 33 shared-edge vertex records without loading adjacent cells.
The [draft height copier](native-terrain-reconciliation.md) uses validated
`heightOffset(x, y)` saved-file offsets to reconcile stopped copies while
preserving every other field. It does not update live terrain.

Metadata reads use the existing bounded checkpoint scanner (at most 4096
bytes). Window reads select individual source rows (at most 297 vertex bytes
or 160 cell bytes each). One incoming window is accepted per reader, with no
queue; overlapping requests reject. Source length changes and truncated reads
reject without returning a partial window. The caller owns returned buffers
and must enforce its active-window residency budget; this API alone does not
bound the number of results a caller can retain.

For a selected paired checkpoint, keep the lease through extraction:

```js
await store.withSelected(async ({sources}) => {
  const terrain = await checkpointTerrain(sources[0]);
  const window = await terrain.window(0, 0, 32, 32);
  // Copy this window into the bounded active scene before the lease ends.
});
```

A terrain object backed by those selected readers cannot perform a later read
after the lease ends. Other adapters must likewise keep the stopped snapshot
stable; equal-size file edits require a storage lease or immutable File
snapshot and full content verification. The reader does not hash the entire
file on every small window request.

Ten terminal tests cover exact rows, shared edges, clipped map boundaries,
allocation/read limits, corrupt metadata, single incoming work, retry after
failure, opaque bytes and paired-lease participation. Four further read-only
qualification cases use real native source/destination snapshots before and
after actor migration. Each actual 128 × 128 map produces 16 windows.
Independent Python row extraction matches every ordered window digest and
eight retained sample digests per file. Independent full-file SHA-256 also
matches, with no save mutation. At that milestone, all 147 JavaScript tests
passed. The subsequent [bounded native scene](native-terrain-scenes.md) uses
this reader and brings the suite to 161 tests.

Inspect an owned stopped checkpoint with:

```sh
node scripts/inspect-native-terrain.mjs /absolute/path/to/owned-stopped.GMP
node --test tests/terrain.test.mjs
```

Evidence is in `output/native-terrain-instruction-audit.json`,
`output/native-terrain-real-files-observed.json`,
`output/native-terrain-tests-final.log` and
`output/native-terrain-all-tests.log`. No native engine, browser or heavy build
was launched. Live native terrain streaming, asset-based terrain rendering,
navigation reconstruction and whole-browser memory remain unqualified. The
app-crash testing restriction and the full expanding-world/co-op goal remain
active.
