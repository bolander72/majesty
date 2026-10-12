# Neighbor geometry for original terrain lighting

`web/world/terrain-halo.mjs` captures a 32-cell window with two extra cells on
each side from its nine neighboring saved-terrain windows. The result is one
owned 37 × 37 signed-Q16 grid (5476 bytes). Every captured window must have an
owned vertex buffer and matching shared height bits. Missing geometry,
conflicting borders and heights that change on native reload reject the result.
Input buffers are preserved, and metadata is captured once before validation.

The two-cell padding is necessary for the pinned original finalizer. A one-cell
ring leaves the core's bottom vertex row dependent on a cell row the finalizer
skips. The original triangle diagonals also depend on coordinate parity. Window
origins are multiples of 32 and the padding shifts both axes equally, preserving
that parity. The adapter supplies geometry only: it does not invoke an engine
hook, copy opaque primary fields between regions or set a lighting policy.

`scripts/prepare-native-normal-halo.mjs` prepares synthetic hills through the
actual adapter and compares every height with an independent global oracle.
Three coordinate cases include negative positions and a join around zero.
Each has four touching core windows, a larger reference grid, independent
unexpanded windows and the failed one-cell baseline as a regression case.

`scripts/check-native-normal-halo.py` checks the executable pin before PE
decoding, verifies 33 instruction anchors and executes the original normal and
shading finalizer, triangle normals, vector normalization and CRT float-to-long
conversion in one bounded CPU emulator. All 13,068 core vertex samples match
the larger reference exactly for three normal floats and the shading byte,
including shared edges and corners. The one-cell baseline fails at the bottom
core row in each case; independent unexpanded windows also differ. Every
primary height/opaque word and reserved vertex byte stays unchanged.

The emulator maps 3,510,272 guest bytes. Each call is limited to three million
instructions and three seconds; the largest observed call uses 1,790,352
instructions. Thirty finalizer calls each allocate and free one controlled
workspace, with a maximum of 3264 bytes and zero bytes retained. A padded native
vertex grid is 32,856 bytes. These are component bounds, not measurements of
the game's native allocator, WASM heap, browser, renderer or GPU. Allocator
calls are bounded stubs; no original gameplay loop runs.

Reproduce sequentially using Node and the existing game Python environment:

```sh
node scripts/prepare-native-normal-halo.mjs
upstream/majesty-recomp/.venv/bin/python scripts/check-native-normal-halo.py
node --test --test-concurrency=1 tests/terrain-halo.test.mjs
```

Evidence: `output/native-normal-halo-inputs.json`,
`output/native-normal-halo-emulated-observed.json`,
`output/native-normal-halo-terminal-qualified.json` and
`output/native-normal-halo-all-tests.log`.

This qualifies synthetic geometry under one common light and x87 control mode.
It does not load a generated or modified saved kingdom, integrate with the
renderer, establish safe generation-hook ordering, rebuild navigation or actor
elevation, join terrain materials, page live worlds or publish co-op regions.
The browser/game launch suspension remains in force while the reported app
crashes are unresolved.
