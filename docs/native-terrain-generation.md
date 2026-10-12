# Generation ordering and spatial actor storage

`scripts/audit-native-terrain-generation.py` verifies eight vtable targets and
43 instruction anchors in the pinned executable without launching the game.
The audit starts at established function boundaries and requires the executable's
full SHA-256 before PE decoding. Exploratory byte scans are not its evidence.

The current Frontier generation observer wraps `004b23d0` and examines terrain
after that function returns. The verified generation path has already performed
these operations by then:

| Operation | Call site | Target |
| --- | --- | --- |
| Construct world from cell extents multiplied by 32 | `004b2979` | `00491c70` |
| Store the new world in generator `+0x84` | `004b297e` | data assignment |
| Configure players | `004b2a57` | `004b2160` |
| Placement stage | `004b2a5e` | `004b1780` |
| Terrain-cell and placement stage | `004b2a65` | `004b1ec0` |
| Further placement stage | `004b2a6c` | `004b1b00` |
| Terrain virtual slot `+0x14` | `004b2a81` | `005cc330` |
| World virtual slot `+0x88` | `004b2a8c` | `005d97b0` |

The placement stages call the world's `+0x64` method, resolved to `005a1480`.
Stage `004b1ec0` also calls `005cc0e0`, which invokes cell-update and neighbour
propagation methods `005cb8b0` and `005cae10`. Their effects must be accounted for
when joining generated terrain. A post-return border rewrite would occur after
these placements; it cannot assume existing actor locations remain valid.

The construction return at `004b297e` precedes the four explicit generation
stages. It is an investigation point, not a qualified mutation hook. The world
constructor itself initializes terrain before returning, and the later stages
can update terrain. Neither this order nor the copied-save tests establish that
all actors are absent there or that shared heights remain intact afterward.

A subsequent [first-finalizer context audit](native-construction-finalizer.md)
finds an earlier point inside construction, before spatial-grid creation and
generator world publication. Its verified entry frame supplies world `+0x5c`
as the configuration pointer and uses the base-world vtable. A future hook
must recover the constructing world from that argument, rather than the
generator's not-yet-published `+0x84`. This narrows the guard requirements;
actor absence, later height edits and a safe mutation hook remain unqualified.

During construction, `005bb6e0` publishes terrain at world `+0x80`, invokes world
slot `+0x98` (`005bb300`), then creates a separate object at world `+0x88`.
`005bb300` initializes the terrain description and calls its normal/shading
finalizer at slot `+0x10`, with world configuration `+0x5c` and a null rectangle.
This is the [previously audited finalizer](native-terrain-lifecycle.md).

The post-generation terrain method `005cc330` is different. It iterates native
cells, uses the original RNG, and calls the cell-update/propagation methods.
Calling it as a border-normal rebuild could alter primary terrain and consume
random state. It is not a verified navigation reconstruction operation.

The subsequent [cell-path checks](native-terrain-cells.md) execute original
post-generation and placement-cell routines with synthetic descriptors. They
change cell bytes and RNG state without reading or changing vertex geometry.
Synthetic zero-kind propagation can affect the complete 6 × 6 grid following
one placement, including when starting at a corner. Other propagation rules
and actor-placement dependencies remain unqualified.

Terrain slot `+0x20`, `005f1a40`, can modify the signed Q16 height at a supplied
vertex by subtracting a scaled integer delta; it has no coordinate bounds
checks. The [height instruction checks](native-height.md) qualify this operation
and the reader/writer conversion with isolated synthetic state. Its
callers and ordering relative to placement remain unqualified; we cannot assume
that the initial zero heights survive all generation operations.

The [placement dispatch audit](native-placement-dispatch.md) resolves the world
wrapper and seven actor initialization targets shared by five factory tables.
Actor slot `+0x20` writes actor `+0x70` and conditionally invokes another actor
callback; it is not the terrain height method. A separate bulk height writer
has no matching pointer words or direct relative call/jump encodings in the
audited inventory, but absence of callers is not proven. Callback bodies and
preservation through later geometry operations remain open.

The object at world `+0x88` is a spatial actor grid, not an established navigation
graph. Its constructor `005b7f00` receives extents rounded up in units of 16,
allocates two four-byte pointer tables for the full grid, and owns a separate
pool for actor lists. The grid diagnostic reads actor records from those lists.
Destructor `005b8000` frees both tables and the pool. JavaScript camera-window
eviction does not free this native object or the terrain arrays.

The subsequent [movement audit](native-navigation.md) establishes that queries
use this grid. Table `+0x14` holds temporary path-node pointers and exclusion
markers; table `+0x18` holds actor lists. This distinguishes path scratch from
actor residency without identifying a separate terrain-derived navigation graph.

For square maps whose cells span 32 native world units, the two tables alone
consume `8 × (2 × cellSide)²` bytes:

| Terrain cell side | Full terrain arrays | Spatial grid tables | Combined arrays |
| ---: | ---: | ---: | ---: |
| 128 | 530,456 B | 524,288 B | 1,054,744 B |
| 1024 | 33,603,608 B | 33,554,432 B | 67,158,040 B |

These are calculated allocations for square extents, not measured process
memory. They exclude pooled actor lists, world/actor objects, script state,
navigation, finalization workspace, textures and runtime overhead. The 1024
example is a reader-policy budget example; it is not an engine-size qualification.

Run the lightweight static audit with the existing environment:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-terrain-generation.py
```

Evidence is saved in `output/native-terrain-generation-instruction-audit.json`
and `output/native-terrain-generation-terminal-qualified.json`. An unpinned
synthetic executable is rejected before PE decoding. No native source, build,
game launch, browser, server or original save changes are involved. The previous
203 JavaScript tests apply to unchanged runtime modules and were not rerun here.

Subsequent [connected-generation work](native-connected-terrain.md) moves the
height write after the original terrain GPL generator and before player setup.
Two native neighboring regions now retain matching saved height boundaries.
Movement/placement near boundaries, material cells and lighting remain open.
Native terrain and actor-grid residency
must also be bounded independently of rendering windows. Live actor travel,
co-op region publication and browser resource qualification remain unfinished;
the user-requested app-crash testing restriction stays active.

The [world teardown audit and component release checks](native-region-release.md)
identify the original release path and exercise bounded component ownership at
128-cell dimensions. They do not yet qualify live world eviction or actor/GPL
cleanup, and they do not make JavaScript window culling release native storage.
