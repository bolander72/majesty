# Portable independent kingdom backups

The Frontier map offers **Saved kingdom backups**. With the native game stopped,
open a named world's map and center it on the kingdom to preserve. Select
**Export saved kingdom** to save its last committed native checkpoint as a
`.majesty-region` file. Unnamed generated maps have no exportable native kingdom.
The position used is the committed map camera, not unsubmitted travel fields.

Choose that file and a fresh lowercase world name to **Restore into new world**.
Restore creates one independent kingdom at its original region coordinates.
Existing worlds, including empty or incomplete world directories, are refused.
A successful restore presents a **Resume saved kingdom** link; it never starts
the game automatically. Original asset/mod compatibility is checked separately
when the native game opens the checkpoint. Missing assets/mods are not supplied
by the backup. Do not resume while browser testing remains suspended because
of the reported app crashes.

This is one kingdom, not a complete portable account or campaign. The file
excludes chapter completion, atlas metadata/watchtowers, other kingdoms,
cooperative membership/continuation and connected actor transfer ledgers. It
cannot restore a shared campaign or the ownership history of a connected world.
Optional direct Google Drive backup and complete profile export remain future
work. A player can keep this ordinary file in a locally synced folder themselves.

## Storage and resource behavior

Export holds the existing shared native-world lease while checking and reading
the selected snapshot. A running named native world holds the corresponding
exclusive lease, so export reports busy. Legacy writers that ignore that lease
must also be stopped. Export writes in at most 4 KiB pieces. The direct file-save
path supports the existing 64 MiB checkpoint limit without collecting the whole
kingdom in memory. Browsers without a file save picker use a 4 MiB archive limit
for downloaded files; larger backups require direct file saving. Failed exports
abort their sink and do not publish a fallback download. Only one temporary
download URL is retained, revoked after five seconds or the next export.

The archive has a 24-byte prefix, at most 1 KiB of canonical JSON metadata and
the exact original GMP bytes. It records the format version, pinned DirectDraw
engine SHA-256, original world, region, content identity, size and checkpoint
SHA-256. Import rejects unsupported engines, invalid metadata, duplicate fields,
out-of-range sizes, truncation, trailing bytes, hash mismatches and unsupported
top-level checkpoint layout before claiming a target world. This is bounded
archive validation; original gameplay loading remains the native engine's job.

Restore takes the fresh world's exclusive lease, writes and verifies its GMP,
then publishes the existing bounded native checkpoint marker. A changing source
cannot publish a selected checkpoint. If a write fails after the fresh directory
is created, the incomplete owned directory is preserved; retry with another
name. The operation never deletes directories that could contain another save.
No dormant region is activated or inserted into the DOM to perform a backup.

## Qualification

The subsequent [view lifetime change](frontier-view-lifetime.md) closes backup
controls on map departure, releases download URLs/timers, cancels export reads
and drains unfinished sinks. An already-admitted restore completes atomically
without showing a late resume link. Focused delayed-operation tests verify both
paths and the restored checkpoint digest; browser execution remains unverified.

The focused backup/map/storage/control suites pass 110 Node tests. They exercise
the shipped button handlers with production archive and OPFS adapters, using
fake directory/lock/picker/DOM interfaces. Cases cover exact bytes, signed region
coordinates, content identity, corrupt input, source changes, busy worlds,
existing-world refusal, failed body/marker publication, picker activation,
single in-flight action, sink abortion, download limits, URL disposal and map
camera selection.

A terminal-only trial uses an already-stopped native `Source.GMP`:

- Original and restored checkpoint: 336,981 bytes, SHA-256
  `a4e87de15b4fdd02046cc7878532b9b94ce0ed0b577766fe29933363559c9919`.
- Exported archive: 337,313 bytes. Maximum file read and write: 4,096 bytes.
- Restore to a second fresh directory preserves the exact checkpoint. Repeating
  into that same directory refuses and preserves the restored bytes.
- Original input inode, size, timestamp and hash remain unchanged. The served
  WASM inode, size and timestamp remain unchanged.

The trial uses a test-only content identity and filesystem interfaces matching
the OPFS adapter contract. It proves an original-file byte/storage roundtrip,
not browser OPFS execution, original asset compatibility, post-import gameplay,
co-op continuation, complete account portability or sustained browser memory
bounds. No native or browser game was launched.

Evidence: `output/native-region-backup-001-observed.json`, its frozen sources and
`output/native-region-backup-001-qualified-tests.log`.

```sh
node --test --test-concurrency=1 tests/region-backup.test.mjs tests/realm-profile.test.mjs tests/realm-store.test.mjs tests/native-atlas.test.mjs tests/camera-checkpoint.test.mjs tests/world.test.mjs tests/region-store.test.mjs tests/frontier-controls.test.mjs
```
