# Releasing retired terrain scene views

`NativeTerrainScene.active` previously returned a frozen wrapper whose methods
captured a Map of terrain windows. Keeping a retired wrapper or one of its bound
methods could retain every window from that scene after later handoffs. Raw Map
iterators can also retain an obsolete backing table after `Map.clear()`; clearing
the old Map alone is insufficient for consumers holding unadvanced iterators.

The scene now publishes a `SceneViewLease`. Its public interface remains a frozen
read-only map with `size`, `has`, `get`, `keys`, `values`, `entries` and iterable
entries. Iterators hold only the lease, iteration kind and an index. The lease
owns a key list capped at the same 49 entries as active scene residency; it never
exposes a raw Map iterator.

After the incoming snapshot has validated, its storage cleanup has succeeded
and seam checks have passed, the scene publishes the new view and revokes the
old lease. Retired views become empty, getters return undefined, and outstanding
iterators end. The old window and revision Maps are cleared. Overlapping windows
already referenced by the new Map remain reusable. Failed reads, cleanup or seam
validation preserve the previous view and its lease.

This changes the lifetime of retained `scene.active` handles: consumers must
read `scene.active` again after a successful handoff. A previously returned
window/value or iterator result belongs to the consumer and can still keep its
buffers alive. The scene cannot revoke arbitrary external references to those
values; consumers should discard them when their work ends.

All 35 focused scene/atlas tests and 247 workspace JavaScript tests pass. The added
handoff test covers retained views/iterators, read and cleanup failures, overlap
reuse, and the absence of public mutation/revocation methods.

A bounded Node/V8 probe uses the actual scene and provider API across five
disjoint 49-window publications. It retains four old views, 20 iterators, eight
bound methods and five provider callbacks. Retired iterators are not advanced
until after garbage collection. All 392 retired backing buffers are collected;
the current scene's 98 vertex/cell buffers remain reachable before closure. Negative controls
retain buffers through the old captured-Map wrapper and a raw iterator over a
cleared Map. The evidence records Node/V8 versions and at most eight GC passes.

`NativeTerrainScene.close()` now revokes public views immediately, rejects queued
and subsequent movement, and prevents a snapshot from publishing after closure.
It returns the same drainage promise on repeated calls. An already-running
snapshot acquisition, read or cleanup must settle before that promise resolves;
underlying I/O is not cancelled. Ownership remains included in residency counters
until drainage completes. Then the scene clears its active/revision maps and
drops its provider reference. Failed or abandoned staging also clears its maps,
and completed snapshot callbacks no longer retain the staged publication through
their closure. A movement failure still reaches its caller; `close()` waits for
settlement rather than asserting that failed cleanup succeeded.

The shipped atlas handler awaits closure when switching back to generated
terrain. Its mock-DOM test retains the old scene, view and iterator and checks
that buffers are released and the atlas shortcut cannot move a closed scene.
Four new scene tests cover idle closure, queued movement, pending acquisition,
an in-flight read and both successful and failed snapshot cleanup. The bounded
GC probe also stages a sixth snapshot, closes during cleanup and retains five
views, 25 iterators, ten bound methods and six provider callbacks. All 196 active
and unpublished backing buffers collect after drainage, bringing the total to
588 collected buffers. The five fresh closure iterators are not advanced until
after this collection. Both negative controls remain reachable.

The checkpoint-source regression probe was also refreshed because its source
identity includes the changed terrain-scene module. After
[validated checkpoint-source reuse](checkpoint-lease.md), its 204 backing sources
collect while 204 expired readers remain held; each checkpoint is opened once
for validation and consumption. The changed modules and
new dependency are staged through `scripts/stage-world.py`; source/staged hashes
match. Player HTML content and the WASM artifact's size/mtime are preserved.

```sh
node --test --test-concurrency=1 tests/terrain-scene.test.mjs tests/native-atlas.test.mjs
node --test --test-concurrency=1 tests/*.test.mjs
node --expose-gc scripts/check-scene-view-retention.mjs
node --expose-gc scripts/check-checkpoint-lease-retention.mjs
python3 scripts/stage-world.py
python3 scripts/qualify-scene-view-retention.py
```

Evidence is in `output/scene-view-retention-observed.json`,
`output/scene-view-stage.json` and `output/scene-view-terminal-qualified.json`,
with focused/workspace/retention/stage logs and source/evidence hashes.
This qualifies JavaScript ownership cleanup on the recorded Node/V8 version.
Live browser retention, native simulation paging, GPU/worker resources and total
process memory remain unqualified. No game/browser launch or native build ran,
and original saves/profiles remain untouched. The app crash is unresolved and
the browser/game launch suspension remains in force.
