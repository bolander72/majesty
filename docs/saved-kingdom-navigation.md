# Finding dormant kingdoms in an expanding world

Named Frontier maps now have a **Saved kingdoms** section. Select **Load saved
kingdoms**, then **Show saved region X, Y** to center the map and load its saved
Majesty terrain. The existing **Play this region in Majesty** link targets that
world's dedicated profile. Selection never launches a game. **Next saved
kingdoms** replaces the visible list; **Refresh list** discovers changes such as
a newly restored kingdom. Unnamed generated experiments have no native list.
Browser gameplay remains suspended under the app-crash restriction.

The separate [Resume region travel](world-travel-recovery.md) section remembers
the latest saved trip and offers its destination and last saved source. It does
not enumerate dormant saves or launch a game automatically.

## Bounds and persistence

`NativeRealmCatalog` reads only the selected `native-world-<name>` directory.
Each action inspects at most 128 directory entries and returns at most eight
metadata items. An empty batch can still have more entries. The catalogue
retains one enumeration cursor rather than an array of every visited region.
The controls replace their current DOM rows. Refresh/disposal closes a suspended
iterator where return is supported; only one list/selection action runs at once.

Enumeration, checkpoint markers and selected-file metadata are read under the
existing shared world lease. A running named game blocks listing; refused lease
admission does not advance the cursor. Reads never create files or fall back to
another world's or personal saves. Missing markers are unpublished regions and
are omitted. Invalid markers, missing GMPs and wrong GMP sizes produce unavailable
entries whose selection buttons are disabled.

Discovery reads at most 511 bytes per marker and no GMP body bytes. A valid
entry is metadata, not a complete checkpoint health check: a same-size altered
body is detected later by the normal hash-checking terrain/native loader.
Terrain selection retains that loader's 49 active / 98 resident window bounds
and complete-view publication. It never bypasses content/terrain validation.

Each page has its own lease. Browser enumeration order is not sorted, and changes
between pages can affect results. Refresh starts a new cursor. This is not a
transactional catalogue snapshot across the campaign. Interrupted I/O requires
refresh instead of silently skipping an unknown part of a page. No saved files
are changed by listing or selection.

## Qualification

The subsequent [view lifetime change](frontier-view-lifetime.md) adds terminal
catalogue closure on map departure and revokes callbacks from replaced pages.
It drains in-flight I/O before releasing the cursor and profile references.
Its82-test component run includes catalogue, map, backup and camera controls;
it does not establish actual browser memory release.

The focused catalogue/map/backup/storage/control suites pass 126 Node tests.
Lazy fake directory/file interfaces expose 10,000 dormant 64 MiB checkpoints.
The first action advances eight entries, reads eight small markers and never
slices a GMP. Another case advances 200 pages with eight DOM rows and one cursor;
refresh/disposal closes that cursor. Sparse directories, malformed names, missing
worlds, invalid saves, busy leases, permission errors, failed cursor cleanup,
slow selection and failed terrain loading are covered. The shipped callback
selects distant `39_-2` terrain and preserves its world-specific play link.

A terminal trial uses owned copies of two stopped original saves with test-only
content metadata:

- `0_0`: 336,981 bytes; SHA-256
  `a4e87de15b4fdd02046cc7878532b9b94ce0ed0b577766fe29933363559c9919`.
- `1_0`: 351,130 bytes; SHA-256
  `9dc5e6b964bf3c6ed43f781aec890635fce2869f35d252c9bd462ac3c32a154c`.

The production catalogue discovers both with zero GMP body reads and one peak
cursor. Production terrain/marker projection then visits `0_0`, `1_0`, empty
`100000_-100000` and returns to `0_0`. High-water marks are 49 active windows,
98 resident windows and 478,132 resident map bytes. Reads stay at most 4,096 bytes.
Scene closure releases its windows. Original input inode/size/timestamp/hash and
served WASM metadata remain unchanged.

These are stopped-file/Node checks, not browser OPFS/DOM execution, original-game
play, spatial hero movement, co-op activation, internet matches or sustained
browser memory qualification. The in-process native request controller remains
a two-kingdom fixture. Arbitrary coordinate routing and seamless save/unload/
restore still need implementation. No native/browser game was launched.

Evidence: `output/native-realm-catalog-001-observed.json`, its frozen sources,
`output/native-realm-catalog-001-qualified-tests.log` and static staging report.

```sh
node --test --test-concurrency=1 tests/realm-catalog.test.mjs tests/native-atlas.test.mjs tests/region-backup.test.mjs tests/realm-profile.test.mjs tests/realm-store.test.mjs tests/camera-checkpoint.test.mjs tests/world.test.mjs tests/region-store.test.mjs tests/frontier-controls.test.mjs
```
