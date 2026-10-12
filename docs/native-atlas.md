# Saved Majesty terrain in Frontier

Selecting a saved kingdom in the catalogue now refreshes its checkpoint even
when its terrain is already visible. Previously the camera-only pan shortcut
could keep an older terrain/marker snapshot and report success without reading
the selected save. Explicit selection now bypasses that shortcut and checks
the movement result; a damaged or unavailable save retains the complete prior
view and reports failure, including when the camera is already at that region.
Ordinary pointer dragging within the captured footprint still opens no save
files. The two regressions fail before the fix; all69 focused atlas, scene and
realm-store tests pass afterwards. This is controlled DOM/Node verification,
not browser FPS or live OPFS evidence. These source changes are not staged into
the served browser build while game launches remain suspended. Evidence:
`output/native-atlas-explicit-refresh-001-tests.log`.

Stopped-original check002 also passes using native380/005's actual captured18850
and published23050 saves from `-5_-1`. All100 small pans perform zero additional
reads, opens or lock acquisitions; explicit refresh replaces the original unit
markers and expires the old view. A corrupt-read control refuses publication
and preserves the fresh view, then the intact save refreshes successfully.
The read-only adapter performs no writes and retains at most65 old/incoming
windows and479432 packed bytes in this check. Both original input hashes remain
unchanged. These component measurements exclude parser/runtime overhead and
qualify no actual browser memory or frame rate. Evidence:
`output/native-atlas-original-refresh-002.json`. Reproduce without launching
any game or browser, using a fresh report/log path:

```sh
node --max-old-space-size=96 scripts/check-native-atlas-saved-refresh.mjs \
  output/native-hero-remote-roundtrip-005.json \
  output/native-hero-remote-roundtrip-002-observed.json \
  output/native-atlas-original-refresh-<unused>.json
```

The Frontier page now has **Show saved Majesty terrain** for named worlds
(`/world/?world=our-world`). Selecting it loads the original saved terrain
through the existing bounded native window reader and draws a read-only altitude
map on the page's single canvas. Empty areas have no checkpoint. Generated
experiment terrain and watchtowers remain available through the other mode.
The saved view also draws building squares and smaller mobile-unit markers,
colored by the saved player number. These are positions in the last checkpoint;
the map does not run dormant kingdoms. Original sprites, textures and gameplay
remain in the separate native game.

The map preserves the region layout: one 128 × 128-cell saved kingdom occupies
the same 512-unit region as the experiment. Native realm dimensions are validated
against that layout. Altitude uses the serialized float32 vertex height, with
32 fixed colors; nonfinite heights receive an unavailable color. Independent
kingdom borders are drawn and may still disagree. Opaque materials, normals
and gameplay state are not interpreted or modified.

Only named-world profiles beneath `majesty/profile/native-world-NAME` are read.
No directories or checkpoints are created, and there is no personal-profile
fallback or directory enumeration. Identity discovery, digest validation,
terrain extraction and source expiry use the same shared world lease as the
native player. Mixed content identities, corruption and unavailable locks
reject the incoming scene and preserve the last complete view. Discovering a
checkpoint identity here permits only saved-byte inspection; it does not
qualify those assets for an original engine load.

Published scene views and their iterators now [expire after a successful handoff](scene-view-ownership.md),
releasing retired window references. Failed handoffs preserve the active view;
consumers retaining handles must obtain the newly published `scene.active`.
Switching back to generated terrain awaits `nativeScene.close()`, which expires
views, rejects queued moves and drains any in-flight snapshot before releasing
its buffers and provider. Failed staging is cleared without replacing the active
view. These paths are verified in terminal tests and a bounded Node/V8 probe;
live browser retention remains unmeasured.

The renderer visits visible cells in at most 49 requested windows. The existing
scene retains at most 98 old/incoming windows and 1,587,698 packed bytes during
a handoff, with one incoming operation and one coalesced pending destination.
The saved-map viewport is at most 128 cells on either axis and preserves the
viewport aspect ratio. The canvas keeps the existing 4096-pixel cap per axis.
There are no terrain DOM nodes or new animation loops.

Leaving the source map now closes its catalogue, backups and camera writer as
well as terrain streams, and reduces canvas backing dimensions to 1 × 1.
Retained controls cannot restart map work. The focused component run passes82
Node tests; actual browser/GPU release remains unmeasured. See
[Frontier view lifetime](frontier-view-lifetime.md) for drain and restore behavior.

The source renderer now combines adjacent cells of the same altitude colour
into horizontal rectangles and skips offscreen windows before scanning unit
markers. It retains no raster caches or extra canvas surfaces. The two existing
native snapshots need 513 terrain draw calls for 16,384 visible cells, about
32 times fewer than the preceding renderer. Their bounded software raster
matches the independently retained pre-batching digest exactly, including
return after eviction and a fresh reader. This measures draw calls and software
coverage, not browser frame rate or GPU memory; the source change is not staged
into the served browser build while browser testing remains suspended.

`atlas-units.mjs` streams original placement metadata under the same snapshot
lease and projects only requested windows. BLDG records produce building
markers and VHCL records produce mobile-unit markers; it does not infer hero
classes from opaque descriptions. Original Q11 X/Y coordinates retain their
fraction when projected into 32-world-unit terrain cells. Physical-parent
dependent positions are omitted instead of guessed; out-of-map coordinates,
terrain decorations, rewards, messages and off-map records are not displayed.
Each window keeps at most 64 markers in an exact-sized Int32Array, five words
per marker (at most 1280 bytes). Crowded windows count omissions. Working
buffers are allocated only for windows containing eligible units and compacted
one at a time. The scene byte budget includes all retained marker buffers;
temporary parser/compaction buffers, metadata and runtime overhead are additional.
These bounds apply to the atlas components, not total browser memory.

Markers render after all terrain, clip to the viewport and use the existing
canvas. Offscreen windows are evicted with their terrain; successful handoffs
expire old scene views, and close drains the read lease before clearing the
provider. No persistent unit catalogue, per-unit DOM nodes, worker or simulation
timer is added. Local panning within the loaded footprint still performs no
save reads. Footprint changes scan eligible saved-region unit metadata once
per region alongside terrain reads.

Panning within the captured footprint uses retained windows without rereading
or hashing entire save files. A footprint change reads current checkpoints;
reselecting the saved-map mode reconstructs the scene. This is a saved snapshot,
not continuous observation of a running kingdom. Leaving this mode releases its
scene; selecting it releases the experiment's terrain entries after completed
tower edits. Failed mode selection preserves the previous camera, map and
controls. Metadata persistence uses the experiment's existing camera record.

Checkpoint read leases now clear their backing-source references after each
callback, even when an expired reader is retained. The paired provider also
clears parsed terrain after its callback. See the bounded
[checkpoint ownership check](checkpoint-lease.md); actual OPFS and browser
memory release remain unmeasured.

Twenty-eight focused terminal tests execute the source adapter, renderer and Frontier
handlers. They cover lock/path selection, read bounds, missing saves, invalid
metadata, corruption, mode failure, preserved native links, viewport resizing,
local pan reuse and restoration. Batched coverage also checks mixed float32
altitudes, nonfinite fallback colours and a partially clipped fractional camera.
No browser, game process or build is launched.

`scripts/qualify-native-atlas.mjs` additionally uses two existing isolated native
kingdom snapshots with independently pinned input digests. A bounded software
sink receives 16,384 visible cells from 16 windows across their border. After 12
empty destinations, both return and a fresh reader reproduce the exact raster
bytes. Twenty-five local pans perform zero file reads. Reads remain at most
4096 bytes and at most one input file is open. Original sizes, modification times
and full digests match before and after. These are two existing kingdoms,
not newly generated maps or a seamless shared world.

Evidence: `output/native-atlas-focused-tests.log`,
`output/native-atlas-all-tests.log`, `output/native-atlas-real-files-observed.json`
and `output/native-atlas-terminal-qualified.json`.
The newer batching check preserves the earlier evidence instead of overwriting
it: `output/native-atlas-render-batching-001-observed.json` and
`output/native-atlas-render-batching-001-preserved/qualification.json`.

Actual browser canvas output, OPFS behavior and GPU usage remain unverified
under the host-app crash restriction. This work connects saved terrain to the
Atlas, but does not replace the engine's flat arrays, implement native region
paging, reconcile seams, migrate heroes or coordinate co-op checkpoints.

The marker extension passes 62 focused terminal tests covering the shipped
Frontier handlers, actual realm provider, renderer, read leases, placements,
crowding, corruption, fifty distant dense-marker handoffs and byte accounting.
The new native load/save from the reconciled-terrain test also supplies a real
stopped input: three building markers and five mobile-unit markers render
alongside 16,384 terrain cells. After thirty distant empty views, returning
reconstructs the same retained byte count; close releases the scene and all
file handles. Its file digest, size and modification time remain unchanged.
This uses the actual projection and renderer with a software draw sink, not a
browser canvas. Evidence: `output/atlas-units-focused-tests.log` and
`output/atlas-units-real-save-observed.json`.
