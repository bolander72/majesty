# Local movement checks and path-state ownership

`scripts/audit-native-navigation.py` verifies 39 instruction anchors in the
pinned executable. It traces the script `PathCost` implementation at `005a8ad0`
through `005adf50`, the cached path context at `005ebfc0`, path-cost wrapper
`005eb2a0`, and search `005eaf50`. Search expands neighbours through `005eb850`
and eligibility function `005eb7b0`. This establishes that movement-related
queries use world `+0x88`, the [previously identified spatial grid](native-terrain-generation.md).

The two full-grid pointer tables have different roles:

| Grid offset | Role | Lifetime |
| --- | --- | --- |
| `+0x14` | Search-node pointers and exclusion marker `0xfffffff0` | Temporary path-search state |
| `+0x18` | Pooled actor lists, eight pointer slots per bucket | Actor collision indexing |

`005eaf10` obtains a 28-byte node from the shared path pool and writes its pointer
to the first table through `005b8040`. The setter checks local grid bounds and
extends a dirty rectangle. `005b7e30` clears only that rectangle in the first
table and resets its rectangle metadata. It preserves the actor table. Search
calls this reset before populating its scratch state. This is not a terrain
normal finalizer or an identified terrain-derived navigation-graph rebuild.

Point collision `005b8eb0` checks local grid extents and returns blocked outside
them. It delegates to rectangle collision `005b8bc0` or masked-footprint
collision `005b8d50`. Those query actor lists, apply the original collision
callback `005f0db0`, and block saturated eight-slot buckets. The callback ignores
the querying actor itself and compares original description collision masks,
along with query flags and other actor attributes. Exclusion markers in the
scratch table can also block a query under specific flags. An empty footprint
mask contributes no occupied cells.

Consequently, neighbouring saved-map windows cannot by themselves enable
movement across realms: the original collision query rejects coordinates beyond
its local grid. A native region adapter needs consistent origin conversion,
neighbour collision data, actor footprint ownership, and a defined path/actor
handoff. Actor removal must clear its index references before native reclamation.
Temporary search-node pointers must not become durable checkpoint data or
survive reuse of their owning pool. Cached saved movement orders are separate
state; these checks do not qualify their migration.

The initial cached context at global `0071ca10` allocates 8192 nodes, each 28
bytes: 229,376 bytes, plus a 28-byte context. Its constructor initializes a
1024-iteration search default. Repeated context requests reuse it. Destructor
`005ec0f0` frees it and clears the global pointer. These are verified constructor
defaults, not a total memory bound: open/closed collections, other callers,
iteration settings, node-capacity enforcement, actor lists and the full grid
tables require separate accounting. The grid tables still have the allocation
sizes recorded in the generation audit.

`scripts/check-native-navigation-instructions.py` runs selected original x86
instructions in the installed Unicorn CPU emulator. It uses one isolated guest
context, synthetic grid/actor/footprint data, and controlled allocation/free
stubs. It executes the original collision callback, coordinate copying, memory
clearing, grid setter, scratch reset and path-pool constructor/destructor. Only
listed function ranges and allocator stubs may execute; an unexpected code
path aborts. No game host, renderer, filesystem import, WASM or browser is used.

Six check groups establish:

- Point queries block negative, far and just-outside coordinates, and accept
  the two in-bounds endpoints with empty collision state.
- Native grid writes reject outside coordinates. Dirty-rectangle clearing
  preserves untouched cells and every byte in the actor table; retry is stable.
- Masked queries block each outside edge with an occupied footprint bit.
- Original actor-mask comparisons and self exclusion behave as expected.
  Saturated distinct-actor buckets and flagged exclusion markers block, while
  an empty footprint bit contributes no collision.
- Allocated original path nodes retain local coordinates and appear in grid
  scratch; native cleanup removes those pointers.
- The original default path context allocates once, reuses its two allocations,
  then releases them and clears its global pointer.

The run executes 84,371 instructions, at most 81,965 in a call. Each call has
a 200,000-instruction and one-second limit. The emulator maps 3,702,784 guest
bytes; allocator stubs have a 262,144-byte arena cap. Mapped guest memory is not
a host-process or browser memory measurement. The executable hash matches
before and after, and an unpinned synthetic executable is rejected by the
static auditor before PE decoding.

Reproduce with the existing game environment, without installing dependencies:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-navigation.py
upstream/majesty-recomp/.venv/bin/python scripts/check-native-navigation-instructions.py
```

Evidence is in `output/native-navigation-instruction-audit.json`,
`output/native-navigation-emulated-observed.json` and
`output/native-navigation-terminal-qualified.json`. These are selected original
function checks with synthetic state, not full gameplay, complete path-search
execution or real actor-placement qualification. JavaScript/native runtime
sources are unchanged; the preceding 203 JavaScript tests were not rerun.

The next native integration must coordinate local collision indexing and
temporary path-state ownership across region changes, alongside the actual
terrain height-writer ordering. No separate terrain-derived navigation graph
has been identified by this trace; adding an assumed navmesh rebuild would not
address the demonstrated grid boundary. Height changes may still affect other
movement, rendering, placement or physics paths, which remain unqualified.
Native paging, live hero crossing, shared co-op regional publication, complete
browser resource bounds and independent-household internet play remain open.
The app-crash testing restriction stays active.

The subsequent [component release checks](native-region-release.md) execute
original terrain/grid teardown across bounded component exchanges. Whole-world
cleanup and checkpoint-before-unload integration remain separate requirements.
