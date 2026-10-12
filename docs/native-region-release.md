# Native component release and world teardown

Offscreen JavaScript window eviction does not release the original engine's
terrain or spatial-grid storage. `scripts/audit-native-region-release.py`
verifies 23 instruction anchors and four destructor vtable targets in the
pinned executable to identify their ownership and teardown order.

The world deleting destructor at `004913d0` delegates to `004914d0` before
optionally freeing the world object. That destructor cleans world-owned state
and delegates to base teardown `005bafb0`. Base teardown processes owned
components and registries before deleting terrain at world `+0x80`, then
directly destroying the spatial grid at `+0x88` and freeing its object.
Individual terrain/grid frees are not a complete region-unload operation.

The terrain's deleting method `005f19f0` calls `005f1a30`, which jumps to
`005fdcc0`. It releases both full arrays through the original CRT free entry
points, along with other owned terrain state. The base terrain's deleting
method `005fdb60` also delegates to `005fdcc0`. Spatial-grid destructor
`005b8000` frees its two full pointer tables and calls actor-list pool cleanup
`005f0ae0`, which releases pooled pages and base storage. The spatial grid is
destroyed explicitly; its virtual slot zero is not a deleting destructor.

`scripts/check-native-region-release.py` executes the original terrain and grid
constructors/destructors in one isolated CPU emulator. It uses 128 × 128 terrain
cells and a 256 × 256 spatial grid, matching the real fixture dimensions.
Native constructors initialize allocator-poisoned arrays to zero. The test
then adds synthetic pooled buffers and distinctive component data; these are
not loaded worlds or newly generated maps. Actors, scripts and rendering are
not activated.

Seven constructor cycles include five successful component exchanges and one
cancelled incoming pair. At most the old and incoming pairs coexist. Hashes
verify that incoming construction and cancellation preserve the active buffers,
and that releasing the old pair preserves the incoming buffers. The original
component destructors release all 49 owned allocations by the end:

| Controlled component state | Owned bytes |
| --- | ---: |
| Terrain arrays plus the two spatial-grid tables | 1,054,744 |
| Additional synthetic populated pool buffers | 147,460 |
| One retained component pair | 1,202,204 |
| Old plus incoming pairs, peak across every exchange | 2,404,408 |
| After final release | 0 |

The allocator is a bounded first-fit/coalescing model with a three-MiB arena.
Its reuse behavior is not evidence about the game's CRT, kit heap, browser GC
or WASM memory fragmentation. The emulator maps 6,586,368 guest bytes, including
the executable image, arena and fixed state/stack pages. This is not a measured
host-process or browser memory bound. Calls have a one-second and one-million
instruction limit; the largest executes 265,910 instructions. Component-buffer
verification reads at most 4096 guest bytes at a time. No renderer, full gameplay
loop, browser or build runs.

Reproduce with the existing game environment:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-region-release.py
upstream/majesty-recomp/.venv/bin/python scripts/check-native-region-release.py
```

Evidence is in `output/native-region-release-instruction-audit.json`,
`output/native-region-release-emulated-observed.json` and
`output/native-region-release-terminal-qualified.json`. The pinned executable
digest matches before and after the instruction checks; an unpinned synthetic
input is rejected before decoding. Runtime sources and original saves are
unchanged. The previous 203 JavaScript tests were not rerun for these tools.

This establishes component ownership and repeatable frees, not live region
eviction. Integration still needs a completed durable checkpoint before unload,
world/actor/GPL cleanup and reference validation, safe world selection after a
load failure, actual allocator/GPU accounting, and coordinated co-op publication.
The [movement audit](native-navigation.md) also requires temporary path-pointer
cleanup before its pool is reused. Existing hero/orders/reference migration and
continuous native terrain remain unfinished. Browser testing stays suspended
under the app-crash restriction.

The [listener resource audit](native-listener-resources.md) now extends the
notification side of teardown: derived drawing buffers are released before base
listener cleanup, and a collection destroys values embedded inside its nodes.
Its insertion body has no count cap; two copied words and live callback targets
remain unqualified. Complete listener/actor reference cleanup is still required.
