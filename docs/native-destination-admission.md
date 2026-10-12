# Check a neighboring kingdom before browser departure

The named-world game's four travel buttons now check the destination before
requesting a native checkpoint. A failed check leaves the current kingdom
active, without requesting a save, publishing a trip or navigating away.
Save-only and return-to-Frontier operations retain their existing behavior.
Successful admission still requires the original game's successful checkpoint
acknowledgement and durable journey publication before page replacement.

This is implemented in the actual browser JavaScript route, rather than just
the private native expansion fixture. It does not yet turn page replacement
into seamless in-process travel or deliver native expansion in WASM.

## Storage and cancellation

Player startup grants a document-local neighbor-read capability at the native
injection boundary. It borrows the exclusive Web Lock already held by that
game; it never acquires a competing shared lock or releases the engine lease.
The capability permits only a canonical immediately adjacent coordinate in the
same named world, with read-only access to that region's marker and two slots.
It is unavailable before injection and cannot read the active kingdom, another
world, or a distant region. Escaped readers reject after their callback ends,
and their backing snapshot references are cleared.

The paths remain `majesty/profile/native-world-<world>/frontier_<key>` in OPFS,
with the serializer's existing nested SaveGame directory for GMP slots. Reads
never create directories or edit files. A destination is new only if its marker
and both slots are missing. Empty or partial unregistered slots refuse travel.
For a saved destination, NativeRealmStore validates the marker, imported-content
identity, selected size and complete SHA-256 digest. The checkpoint parser then
checks the pinned VERS header and every root boundary, with at most128 roots.
A valid committed slot remains usable when its inactive slot is empty.

Reads are at most4096 bytes, the marker at most511 bytes, and a selected save
at most64MiB. Only one destination check is in flight; repeated clicks cannot
replace it or queue more I/O. These are read-operation bounds, not a proof of
bounded native simulation or total browser memory.

Menu/loading/result/network transitions, runtime failure and pagehide abort
the check. Directory and file lookup boundaries notice cancellation before
starting further work. An already pending read is drained and its result
rejected. The UI remains busy until that check settles; a newly playable kingdom
can then accept a fresh save request. Page departure suppresses late navigation
and recovery-link clicks. The initialized engine's exclusive lease stays held.

## Verification and delivery

Run from the workspace root:

```sh
node --test --test-reporter=tap --test-concurrency=1 tests/native-destination.test.mjs tests/frontier-controls.test.mjs tests/realm-session.test.mjs tests/realm-profile.test.mjs tests/realm-store.test.mjs tests/checkpoint-lease.test.mjs tests/checkpoint.test.mjs tests/journey.test.mjs
node --test --test-reporter=tap --test-concurrency=1 tests/player-startup-cancel.test.mjs tests/transfer-store.test.mjs tests/native-atlas.test.mjs
MAJESTY_DESTINATION_STAGED=1 node --test --test-reporter=tap --test-concurrency=1 tests/native-destination.test.mjs
```

The source suite passes136 checks, related suites47, and the actual staged-module
suite30, all without skips or cancellations. Tests combine the shipped DOM
adapter, initialized world lease, real destination/store/parser modules and an
OPFS directory fixture. They cover new and saved destinations, damaged saves,
content mismatch, orphan/empty slots, excessive root counts, truncated roots,
read revocation, pending directory/digest cancellation, duplicate clicks,
successful/failed save acknowledgements and late journey publication.

Logs are `output/native-destination-006-tests.log`,
`output/native-destination-004-related-tests.log` and
`output/native-destination-007-staged-tests.log`. The initial001 test log preserves
a failed permission test whose fixture had no world directory, so its denied
neighbor path was never reached; supplying an existing saved directory corrects
the fixture and exercises the refusal.

`output/native-destination-002-staged.json` records exact source/staged/HTTP hashes
for `native.mjs`, `realm-session.mjs` and new `native-destination.mjs`, test counts
and hashes, prior staging proof, original staged snapshots, and unchanged WASM
metadata/player HTML. Ten transitive dependency files are preserved. Nine match
source exactly. The served checkpoint module differs in later actor-analysis
helpers; its complete prefix containing constants, MetadataReader, chunk headers
and checkpointChunks is identical to source. The staged test suite runs against
that actual preserved module. Initial staging refused this mismatch before any
mutation; the subsequent check verifies the consumed implementation explicitly.

No browser game, native game or build runs for this change. WASM remains
108,718,147 bytes with inode258380143 and mtimeNs1791032426322853964. This is
Node/static delivery evidence; browser execution remains suspended because the
host-app crashes are unresolved. Root-format and digest admission do not prove
that every saved object is semantically loadable by the original engine.
External concurrent filesystem mutation is unqualified.

Production in-process browser generation/travel, hero crossings, co-op region
activation, complete internet matches and sustained resource bounds remain open.
