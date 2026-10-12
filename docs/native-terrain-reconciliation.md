# Draft shared-border heights

`web/world/terrain-reconcile.mjs` adds a stopped-checkpoint prototype for
adopting neighbouring border heights. It creates a draft through a caller's
private atomic sink. It does not select a realm checkpoint, change an existing
save, or run the original engine.

```js
await reconcileTerrainHeights({
  source: stoppedDestination,
  borders: [{side: 'left', sourceSide: 'right', terrain: stoppedNeighbourTerrain}],
}, privateDraftSink);
```

Inputs must be immutable stopped files or readers held under a valid snapshot
lease throughout copying. The sink must consume each write before resolving,
discard the draft on any error, and publish only after copying succeeds.
The copier does not acquire locks or verify input content identities itself.

The [native lifecycle audit](native-terrain-lifecycle.md) distinguishes height
from derived shading and an opaque primary word. Reconciliation changes only
the four serialized float32 height bytes at chosen border vertices. It keeps
all chunk headers, cells, shading, opaque words, actors and scripts byte exact.
`NativeTerrain.heightOffset(x, y)` provides a validated saved-file offset for
this operation; it is not a native or WASM pointer.

Requests contain one to four unique target borders. Corresponding dimensions
and axes must agree. Endpoint preflight rejects conflicting corner ownership
before any draft write. Heights must also survive the original signed-Q16
reader/writer conversion with exact float32 bits. Nonfinite, out-of-range or
noncanonical heights (including negative zero), malformed strips, truncated
files, changed source lengths and sink errors reject. This is exact height-bit
ownership; it does not average incompatible heights. See
[original height conversion and border safety](native-height.md).
Global corner ownership and terrain generation order still need a world policy.

The copier retains at most four 33-vertex strips: 1188 packed bytes. It streams
the destination through one reusable 4096-byte page and an incremental digest,
merging sorted border offsets and carrying a height across a page boundary.
Borrowed input pages are copied before modification. Reads and sink writes are
serial and at most 4096 bytes; transient input buffers, parser/digest metadata
and caller storage are additional. These limits do not bound the whole browser
or engine. There is no whole-file output array or pending write queue.

Eight focused tests cover byte-exact output on all borders, corner deduplication,
idempotent retry, a height split across pages, dimension/axis/corner rejection,
malformed and nonfinite input, source/sink failures and request mutation during
an asynchronous read. Conversion regressions cover unsafe endpoints and an
unsafe later strip that aborts a private partial draft. Run them with:

```sh
node --test --test-concurrency=1 tests/terrain-reconcile.test.mjs
```

Two isolated drafts from the actual before/after destination checkpoints each
adopt 118 changed heights from the source's right edge. All 129 shared heights
then match. An independent Python binary parser reconstructs the expected
output and verifies every byte and its SHA-256, including all unchanged data.
The original fixture sizes, timestamps and full digests remain unchanged.
A stopped saved-map scene accepts these drafts under its height policy and
can be reconstructed afresh. The fixture producer also discards an injected
failed draft and preserves a pre-existing destination on publication failure.
It uses stopped file readers; this is not a browser OPFS or Web Locks test.

Evidence is in `output/native-terrain-reconcile-real-files-observed.json`,
`output/native-terrain-reconcile-independently-observed.json` and
`output/native-terrain-reconcile-terminal-qualified.json`. The complete suite
passed 203 tests at the initial draft milestone, with test-file concurrency limited to one. No browser, game,
server restart or heavy build was used. The app-crash restriction remains active.

One subsequent isolated native run loaded the **Before** draft and saved it
through Majesty's original menu, without diagnostic hooks, fixture actor edits
or a browser launch. The captured original game shows the kingdom after load
and the game's “Game Saved!” message after saving. The new save preserves all
16,641 serialized height bit patterns, all opaque vertex words and all 16,384
cell records. Thus the draft's 118 adopted heights survive the original engine
load/save path. Its cached shading changes at 202 vertices; this does not prove
that lighting agrees across two neighbouring maps.

`scripts/run-native-reconciled-terrain.py` uses an owned temporary profile,
checks the qualified executable and draft identities, permits only one native
game/build at a time, and stops at a 512 MiB sampled RSS or 90-second wall limit.
This attempt finished in about 29 seconds with a sampled high water of about
172 MiB. That is one native run, not a sustained memory bound. The original
draft remains unchanged. `scripts/inspect-native-terrain-roundtrip.mjs` compares
every vertex and cell with at most 4096 bytes per read and a 14,921-byte terrain
window per input, and checks both stopped file identities before and after.

Evidence is in `output/native-reconciled-terrain-attempt-001.json` and
`output/native-reconciled-terrain-roundtrip-001.json`. The private saves and
captured game pixels remain local. This qualifies one original-engine terrain
load/save, not continuous expanding-world gameplay.

These drafts are not playable expanding regions. Normal calculation with
neighbouring geometry, lighting consistency, navigation, existing border actor
placement and primary terrain-word semantics remain unqualified.
The original engine still owns full terrain arrays. Generation, native paging,
transactional co-op publication and live crossing need further work before
these heights can be used in a shared world.

The subsequent [generation-order audit](native-terrain-generation.md) shows
that the existing generation observer runs after explicit placement stages.
It also identifies separate full-map spatial actor tables. A safe original-engine
border hook and native residency budget require both findings to be addressed.

The [movement trace and bounded instruction checks](native-navigation.md) now
identify the local collision-grid boundary and temporary path-state lifetime.
Accepting shared saved heights does not make that local boundary crossable.
