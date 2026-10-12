# Native terrain ownership and derived fields

`scripts/audit-native-terrain-lifecycle.py` audits the pinned executable without
launching it. It verifies the MAP/MTER descriptor finish callbacks, three
vtable targets and 22 instruction anchors. The executable SHA-256 must match
before PE decoding. This establishes storage/finalization code paths, not a
qualified hook for live terrain mutation.

The MAP reader obtains the native factory through `005ec440`. Its first vtable
slot (`0068b2ec`) points to `005ec370`, which delegates to `00491c70`. That
factory constructs the native world object. Its terrain component is reached
through world offset `0x80`.

MTER finish callback `005f2e20` collects both child arrays before replacing
anything. On its error path it frees the incoming arrays. On success it frees
the old cell/vertex arrays, attaches replacements at component offsets `0x48`
and `0x4c`, then calls virtual slot `0x10` with the world's configuration at
offset `0x5c` and a null affected rectangle. For the pinned terrain vtable
`0068b660`, that slot is `005aebe0`. The subsequent `005aeb60` is a no-op;
it is not a verified navigation rebuild.

| Native vertex field | Serialized field | Behavior |
| --- | --- | --- |
| `+0`, four-byte signed Q16 height | bytes 0–3, float32 | Loaded and used to construct triangle geometry |
| `+4`, four-byte word | bytes 5–8 | Preserved primary data; meaning remains opaque |
| `+8`, `+12`, `+16`, three floats | omitted | Recomputed normalized vertex vector |
| `+20`, one byte | byte 4 | Recomputed shading from normals and configured light |

`005af010` constructs the two triangles of a cell, with their diagonal chosen
by coordinate parity, and calls `005685b0` to form normalized cross products.
Finalizer `005aebe0` combines neighbouring triangle normals, writes the three
native vertex floats and derives the shading byte. Its temporary allocation
is `48 × affected cell-column count`: two rolling rows containing two
three-float triangle normals per cell. A full 128-column map uses 6144 bytes;
1024 columns would use 49,152 bytes. This is temporary finalization storage,
not a bound on the whole engine or browser.

The terrain object still owns full arrays: eight native bytes per cell and
24 bytes per vertex. A 128 × 128 map therefore uses 530,456 bytes for these
two arrays, separately from finalization workspace, game actors, navigation,
textures and the WASM heap. Camera windows in the JavaScript saved-map reader
do not replace those native arrays. Destructor `005fdcc0` frees both arrays.

This changes how shared borders should be reconciled. Heights are geometry;
the serialized shading byte is a cache that the native loader derives again.
Copying all nine vertex bytes from a neighbour would also copy the opaque
primary word. That is not a qualified way to join terrain. New region generation
needs shared height ownership, appropriate neighbour geometry for normals,
consistent world lighting, and separately verified primary terrain/navigation
state before original-engine crossing can be enabled.

The saved-map scene now supports `seamPolicy: 'height-bytes'` in addition to
`'exact-vertices'` and the existing independent projection. The height policy
compares the four serialized height bytes at each available shared vertex after
snapshot cleanup. It rejects inconsistent geometry without treating cached
shading as an authoritative height field. This is conservative byte equality,
not a float equivalence rule; it does not qualify materials or navigation.
Mismatch results now also distinguish shading-byte and opaque-word differences.

Real native fixtures confirm the distinction. In the right/left orientation,
118 of 129 vertices differ in height, 120 in shading and zero in the opaque
word. In the bottom/top orientation, heights all match, shading differs at all
129 vertices and the opaque word differs at 26. Results are identical before
and after the previously qualified actor migration. A geometry-policy scene
rejects the horizontal join and preserves the old scene. When the same stopped
kingdoms are projected vertically it accepts the matching height border and
loads the destination window; exact-record policy still rejects that join.
This does not create a playable vertically joined kingdom.

The independent Python binary extractor matches all four edge digests and every
mismatch category. The focused tests include a scene that accepts shading/word
differences while rejecting changed heights and retaining its previous buffers.
All 197 JavaScript tests pass. The audit also rejects an unpinned synthetic
executable before PE decoding.

Run the read-only audit with the existing game environment:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-terrain-lifecycle.py
```

Evidence is in `output/native-terrain-lifecycle-instruction-audit.json` and
`output/native-terrain-lifecycle-terminal-qualified.json`, with real-file cases
in `output/native-terrain-seam-real-files-observed.json`. No browser, game or
heavy build was launched, and no original save or native engine source was
changed. Actual generated-border reconciliation, native navigation updates,
live hero crossing, cooperative region publication and browser resource
qualification remain unfinished. The app-crash testing restriction stays active.

The subsequent [draft height reconciliation](native-terrain-reconciliation.md)
changes only primary height bytes in private stopped copies. Real-file and
independent binary checks establish byte preservation and geometry equality;
they do not yet qualify the native finalizer or navigation on those drafts.

The [generation-order audit](native-terrain-generation.md) distinguishes that
normal/shading finalizer from a later RNG-consuming terrain-cell update and
identifies full-world actor-grid tables alongside the terrain arrays.

The subsequent [normal halo check](native-normal-halo.md) executes this original
finalizer on synthetic neighboring geometry. Two-cell padding reproduces larger
reference normals/shading exactly at the core edges; integration into native
generation, saved kingdoms and live paging remains unfinished.
