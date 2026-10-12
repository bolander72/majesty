# Stop saved-map reads when leaving the view

Closing a NativeTerrainScene now aborts its saved-region read operation. The
signal travels through the actual saved-atlas adapter, realm provider and
NativeRealmStore. Digest validation uses the same bounded checkpoint lease as
terrain reads, so cancellation can stop whole-save hashing before terrain is
supplied to the scene. Previously, closure was noticed only after acquisition
had finished validating all selected saves.

The scene immediately revokes public views and cancels its queued destination.
A file operation already in progress is awaited; its result is rejected after
cancellation. No subsequent file opens or reads start. The shared world lock
stays held until that operation and provider cleanup finish. Closing does not
release the initialized native game's separate exclusive world lease.

The world-map page closes its scene on pagehide. A scene returned by a late
storage-open operation also closes before any move. Queued painting/panning and
late navigation are suppressed after departure. Generated preview windows are
cleared. Existing checkpoint digests, content checks, file-size limits and
4KiB lease read bounds remain mandatory. This is a read-only change to map
loading; it never edits a player's saved kingdoms.

## Verification

Run from the workspace root:

```sh
node --test --test-concurrency=1 tests/checkpoint-lease.test.mjs tests/realm-store.test.mjs tests/terrain-scene.test.mjs tests/native-atlas.test.mjs tests/atlas-units.test.mjs tests/realm-profile.test.mjs tests/region-backup.test.mjs tests/transfer-store.test.mjs
```

All110 focused checks pass, with no skips. New cases delay actual adapter
operations during manifest reading, selected-slot opening, digest hashing,
terrain parsing and lock acquisition. They prove that closure prevents later
I/O, rejects queued movement, preserves the world lock until the current read
settles, and drains scene residency to zero. Two cases evaluate the shipped
view module and its pagehide handler during late opening and save hashing.
A checkpoint-lease case rejects a pending read result after cancellation and
prevents subsequent backing reads. A source-size mutation during hashing still
refuses, even though the hashing input is now a leased reader.

Logs are `output/native-atlas-cancellation-001-tests.log` (65 checks),
`002-tests.log` (68 checks), `003-tests.log` (109 checks) and `004-tests.log`
(110 checks). Six static modules are staged individually and match the exact
bytes served by localhost8000. `output/native-atlas-cancellation-001-staged.json`
records their hashes, original staged snapshots and unchanged WASM metadata/
player HTML. The game binary and player HTML are unchanged. This is
Node/static qualification, not measured browser FPS, total engine memory,
back-forward-cache restoration or a resolution of the host-app crashes. No
browser game, native game or build runs for this change. The launch suspension
remains in force.

In-process browser kingdom activation, automatic region generation while
exploring, hero crossing, shared co-op handoffs and sustained engine/browser
memory bounds still need implementation and gameplay qualification.
