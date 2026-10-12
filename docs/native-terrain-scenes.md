# Bounded scenes from native saved terrain

`web/world/terrain-scene.mjs` connects the compact native terrain reader to a
bounded read-only scene. `NativeTerrainScene.move(x, y, width, height)` uses
global projected cell coordinates and requests visible 32 × 32 windows plus
one window of margin. It is a saved-map projection, not a replacement for the
running game's renderer, simulation or navigation.

| Managed state | Limit |
| --- | --- |
| Active window entries, including unavailable windows | 49 |
| Old scene plus incoming windows during handoff | 98 |
| Packed active terrain buffers | 731,129 bytes |
| Packed old/incoming terrain buffers | 1,462,258 bytes |
| Pending destination while one handoff runs | 1 |

The scene does not queue every pointer destination. Superseded pending moves
share one promise and retain only the latest target. A handoff loads windows
serially and publishes the map and captured snapshot generation together only
after the snapshot callback and lease cleanup succeed. A read, metadata or
cleanup failure preserves the complete previous scene and permits retry.
The provider never receives the staged residency map.

Unchanged generations reuse overlapping windows. A changed generation reloads
every requested window, including overlapping ones. Old windows leave the
managed map when travel commits; returning extracts their bytes from the
stored snapshot again. The `active` view supports size/get/has/iteration and
has no set/delete/clear methods, so a consumer cannot grow the residency map.
Payload fields are restricted to supported scalars and exact-sized owned
ArrayBuffers. Large backing-buffer views and shared memory are rejected.
Callers can still retain returned buffers externally; the limits above cover
the scene's managed data, not all application, process or GPU memory.

`pairedTerrainProvider(store, {realmWidth, realmHeight})` reads the currently
selected source/destination kingdom under `withSelected`. Both files are
verified by the paired store, even when one kingdom is offscreen. Terrain
dimensions must match the declared layout and be multiples of 32. The default
layout is 128 × 128. Selected region keys place each kingdom in the projection;
negative and distant fixture keys work without rewriting native coordinates.
The reader retains only two terrain layouts during the callback. Its consumers
expire when the callback ends, including queries for unavailable regions.

This adapter covers two stored kingdoms. An absent kingdom returns unavailable
data; it is never regenerated or invented. More realms require a provider
connected to their durable original snapshots. The projected boundary between
independently generated kingdoms has not been reconciled: vertex heights,
materials, navigation and actor travel across it remain unfinished.
The [saved boundary qualification](native-terrain-seams.md) now measures those
differences and provides an opt-in `seamPolicy: 'exact-vertices'` publication
check. It preserves the old scene on mismatch and performs no reconciliation.
The [native lifecycle audit](native-terrain-lifecycle.md) adds `height-bytes`
for geometry consistency without requiring cached shading equality. Neither
policy establishes material/navigation compatibility or live actor crossing.

Fourteen focused tests cover long journeys, reuse/invalidation, failure before
publication and during cleanup, 10,000 coalesced destinations, residency/data
bounds, absent realms, selected-pair lease expiry, opposite-side corruption,
negative/distant coordinates and captured snapshot identity. Synthetic scenes
reach the 98-window/1,462,258-byte limits. A further host-file qualification
uses real original native saves and validates 13 source/destination window
samples against the previously independently checked byte digests. It travels
back and forth, publishes the after-migration pair and restores it with a fresh
store and scene. Actual packed residency peaks at 477,472 bytes, file reads at
4096 bytes and open read handles at one. These are logical ownership/I/O
measurements, not whole-browser memory measurements.

At that milestone, all 161 JavaScript tests passed. The subsequent
[independent realm store](native-realm-storage.md) adds per-window identities
and requested-realm capture, bringing the suite to 173 tests. Evidence:
`output/native-terrain-scene-focused-tests-final.log`,
`output/native-terrain-scene-all-tests.log`,
`output/native-terrain-scene-real-files-observed.json` and
`output/native-terrain-scene-terminal-qualified.json`.

The stopped paired-save diagnostic has a read-only terrain streaming control.
It chooses one of its two copied saved kingdoms and reports the managed scene
bounds. It uses the same scene and storage lease, with no game process or
terrain DOM nodes. It has been staged and syntax checked, not opened in the
browser. The root app-crash constraint remains in force; no game, browser or
heavy build was launched during this work. Asset rendering, continuous native
terrain/navigation, actual browser resource use and remote multiplayer
qualification remain unfinished.
