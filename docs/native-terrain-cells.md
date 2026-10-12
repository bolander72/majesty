# Original terrain-cell updates

The post-generation terrain method `005cc330` is not a lighting rebuild. It
reads byte `+6` from eight-byte native cell records at terrain `+0x48`, skips
nonzero kinds, and uses the original RNG to select updates for zero-kind cells.
The generation caller supplies `-1` at `004b2a77`. The method can call cell
update `005cb8b0` and neighbor propagation `005cae10`; normal finalization is
the separate `005aebe0` routine described in
[neighbor geometry and lighting](native-normal-halo.md).

`scripts/audit-native-terrain-cells.py` checks the full executable pin before
PE decoding, 17 original routine ranges and 28 instruction anchors. The update
writes four individual cell bytes at `+4`, `+5`, `+6`, `+7`. `004fcb40` extends
or initializes a four-integer affected rectangle; it is not an actor callback.
Dictionary/rule accessors are included in the audit. Its propagation switch
uses an unsigned index bounded by 16, with all 17 original table targets inside
the audited routine. No audited instruction accesses non-stack offset `+0x4c`,
where the terrain object's vertex pointer resides. This is a structural fact,
not a proof that all indirect data pointers have safe ownership in a live game.

`scripts/check-native-terrain-cells.py` executes original post-generation and
placement-cell methods on nine small synthetic cases, each repeated from cleared
state with different stack-fill patterns. It runs original dictionary lookups, rule accessors and
RNG arithmetic; there are no allocator or import stubs. Descriptors and
compatibility masks are explicit synthetic inputs rather than assumed startup
state. RNG initialization is bypassed by supplying its already-initialized
flag and seed, as a running game would have done. Time/CRT initialization is
outside this qualification.

| Case | Changed cell records | Original RNG calls | Vertex reads |
| --- | ---: | ---: | ---: |
| 8 × 8 zero-kind cells, post-generation | 25 | 104 | 0 |
| 5 × 7 mixed zero/nonzero cells, post-generation | 4 | 29 | 0 |
| 4 × 3 nonzero-kind cells, post-generation | 0 | 0 | 0 |
| 6 × 6 cells, placement-cell method | 1 | 0 | 0 |
| 6 × 6 cells, packed-group change at center or either tested corner (3 cases) | 36 each | 220 each | 0 |
| 6 × 6 cells, negative/outside x placement (2 cases) | 0 | 0 | 0 |

Every native vertex byte and every cell's primary four-byte word stays
unchanged. The first placement case produces rectangle `[1, 1, 2, 2]`. All resulting
cell digests, RNG states, counters and rectangles reproduce exactly on replay.
Memory hooks reject vertex reads, writes outside the stack/cell bytes/rectangle/
RNG state, and changes to a cell's primary word. Each call is limited to 800,000
instructions and two seconds; the largest observed call uses 277,902
instructions and 2768 bytes of stack. Guest mapped memory is 4,386,816 bytes, including the PE image,
one 1 MiB synthetic-state arena and a 32 KiB stack. These component limits are
not whole-game/browser memory measurements.

The zero-kind path converts the packed-group input to `(value >> 4) × 17`.
The original third argument value `1` consequently preserves group zero;
changing it to `17` changes the group and reaches neighbor propagation through
the original placement wrapper. At `(1, 1)`, `(0, 0)` or `(5, 5)`, that change
propagates through all 36 cells in this synthetic grid, invoking the original
propagation entry 36 times. Changed-cell bounds and the affected rectangle both
become `[0, 0, 6, 6]`. A one-cell placement rectangle therefore does not bound
its complete effects. Invalid x placements leave cells, rectangle and RNG
unchanged.

Only synthetic zero-kind propagation is exercised. Other switch branches,
imported rules, actor placement, safe border-height mutation order, native
navigation, world paging and cooperative publication remain unqualified.
The findings support keeping cell updates separate from height reconciliation
and normal/shading finalization, and accounting for propagation beyond the
initial placement when defining native region residency.

`scripts/qualify-native-terrain-cells.py` checks current source/evidence hashes,
the original generation caller's `-1` argument, the three propagation extents,
replay and memory invariants. It also verifies that an unpinned synthetic input
is rejected before PE decoding. It consumes existing CPU evidence rather than
rerunning the emulator.

Reproduce sequentially with the existing game Python environment:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-terrain-cells.py
upstream/majesty-recomp/.venv/bin/python scripts/check-native-terrain-cells.py
upstream/majesty-recomp/.venv/bin/python scripts/qualify-native-terrain-cells.py
```

Evidence: `output/native-terrain-cells-instruction-audit.json`,
`output/native-terrain-cells-emulated-observed.json` and
`output/native-terrain-cells-terminal-qualified.json`.
No browser/game/build/server is launched; original saves and runtime sources
are unchanged. Browser/game launches remain suspended while the reported host
app crashes are unresolved.
