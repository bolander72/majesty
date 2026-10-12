# Releasing the Frontier view on departure

The source Frontier view now closes its saved-kingdom catalogue, backup controls,
optional camera writer, generated stream and saved terrain scene on `pagehide`.
Canvas backing dimensions become 1 × 1 immediately. A departed view cannot
restart map moves, tower edits, mode selection or resizing through retained
handlers. This applies to the separate map projection; the original WASM game
and served browser artifacts have not changed.

The catalogue remains bounded to eight displayed rows and 128 directory entries
per scan. Its new terminal `close()` stops admission, drains an already-started
directory/file operation, closes a suspended iterator and drops the profile and
storage references. Closing during lock admission, directory opening, iteration,
marker opening/reading or checkpoint stat inspection produces no late page.
Old row callbacks are revoked when a new page replaces them. The existing
reusable `dispose()`/refresh behavior remains available while the list is open.

Backup closure disables and detaches handlers, revokes its download URL and
cancels the five-second revocation timer. An export uses the existing cancellable
checkpoint lease: accepted reads/writes drain, further reads/writes stop, and
an opened unfinished output sink is aborted. An unresolved file picker cannot
open a writer after departure. Closing an already-opened file writer cannot
cancel a browser operation instantly; it waits for that operation to settle.

An already-admitted restore finishes its existing atomic validation/publication
path. It retains only that operation until settlement and publishes no late
status or resume link. This deliberately avoids interrupting a committed
kingdom's storage transaction or deleting an incomplete owned directory.
If departure happens during profile lookup, no restore is admitted afterward.

The camera writer cancels its scheduled timer and discards queued optional view
positions. It drains only an accepted transaction, does not retry failures after
departure, suppresses late reports and releases its store and callback. This
can lose an unsaved camera position on page departure. Explicit region links
still flush before navigation; kingdom and building persistence are separate.

## Terminal evidence

The focused Node run passes 82 tests using the production catalogue, backup,
camera, stream/scene adapters and VM execution of the source map handlers.
Delayed fixtures cover close during storage, picker, writer and restore work;
they verify that accepted work drains before a close resolves, leases release,
cancelled exports never commit or download, and restored checkpoint digests
remain exact. Retained handlers and timer callbacks cannot restart work.

The first run passed 80 of 81 tests but the restore test used the wrong store
inspection method (`withSnapshot` instead of `read`). Its failure log is retained;
the corrected test reads and digest-validates the actual restored checkpoint.
The subsequent run adds a departed-map handler test and passes all 82.

Earlier catalogue-only cleanup passes 56 tests and has its own frozen sources.
These checks use fake directory, picker, DOM and timer interfaces. They establish
component lifecycle behavior and canvas dimensions, not actual OPFS execution,
browser/GPU memory release, sustained whole-engine memory bounds, host-app crash
safety or playable connected co-op regions. No browser, build, native game or
new service was launched. The active goal remains incomplete.

Evidence:

- `output/native-catalog-close-001-preserved/preserved.json`
- `output/native-map-departure-001-tests.log` (retained failed test)
- `output/native-map-departure-002-tests.log`
- `output/native-map-departure-001-preserved/preserved.json`

```sh
node --test --test-concurrency=1 tests/camera-checkpoint.test.mjs tests/region-backup.test.mjs tests/realm-catalog.test.mjs tests/native-atlas.test.mjs
```
