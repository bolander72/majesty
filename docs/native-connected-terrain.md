# Connected terrain generation prototype

Two independently generated neighboring Frontier kingdoms now preserve an
exact shared height boundary through original startup, rendering and saving.
This experimental native feature is a step toward an expanding world. It does
not yet provide seamless travel or one continuously running simulation.

## Recipe and scope

`upstream/majesty-recomp/browser_frontier.cpp` computes gentle Q16 heights from
global cell coordinates using a 16-cell integer lattice. Each region remains
an ordinary 128 × 128 Majesty kingdom with 129 × 129 vertices. Neighbors
evaluate identical coordinates along their common edge. No random-generator
calls or retained world catalogue are added. `web/world/connected-height.mjs`
provides the corresponding integer reference for read-only qualification.

The recipe requires explicit `RECOMP_RULE_FRONTIER_CONNECTED_TERRAIN=v1`,
seeded generation and a dedicated solo Frontier profile. It is not enabled in
ordinary browser links. Existing saves, fixed missions and network startup
do not enter this fresh-generation path. The served WASM is unchanged.

## Original-engine integration

Construction is too early for writing the new heights: the original terrain
GPL generator replaces almost every height before player setup. Attempts
002–005 demonstrated that ordering, including 507 changed border vertices.
Attempt 001 refused a hook on a callable virtual target that is not a declared
hook entry. Failed attempts do not count as generated gameplay evidence.

The prototype now captures fresh terrain through declared initializer
`005bb300`, called from the base constructor at return address `005bb7fe`.
It checks the exact base-world/terrain types, zeroed height allocation,
empty constructor registry and absent spatial grid. The factory hook checks
that original `00491c70` returns that same derived world. Neither callback
writes geometry.

The actual write occurs at declared player-setup entry `004b2160`, with exact
caller return `004b2a5c` and the captured generator receiver. The original
terrain GPL generator has finished. Before writing, the prototype validates
world/terrain/vertex pointers and dimensions, complete registry links, every
group's empty list/tree representation, and all 65,536 entries in both spatial
grid tables. The derived registry has 17 groups, rather than the base
constructor's one group. Pinned `004911c0` calls `0042c490`, which constructs
kind 3 using `005ba670` and installs derived vtable `0067fe1c`; its registration
and lookup targets remain `00596570` and `005ba8d0`. Attempt 010 exposed the
derived shape without changing geometry. Build 038 validates all 17 groups.

Only native Q16 height words are replaced. Original `005aebe0` recalculates
normals/shading through the existing active-hook guest-call helper, which
restores CPU/x87 state. All 16,641 heights must still match immediately
afterward. Original player setup, placement, cell updates and world finalization
then run normally. Interior foundations may change heights; every boundary
vertex must remain exact at generation return. A disagreement refuses the
experimental run. Occupied terrain is never corrected afterward. All three
hooks are scoped to this generation call and removed on exit.

## Observed qualification

Official native build 038 has executable SHA-256
`9c978d2711655e11a138d8277a5d7359dac06c0c97e0fa0ee77f31aab4ca7570`.
Its Frontier source SHA-256 is
`813f81d7dd480e2cf48e9ceb450727ebd1d98d3c016aed8c05be51e1e40e35ad`.

| Serial run | Region | Saved vertices inspected | Interior recipe differences | Boundary differences |
| --- | --- | ---: | ---: | ---: |
| Attempt 011 | `0_0` | 16,641 | 387 | 0 |
| Attempt 012 | `1_0` | 16,641 | 767 | 0 |

Both runs exit successfully with one original saved game. Reviewed stopped
frames show the rendered kingdom, palace and starting buildings, followed by
the original “Game Saved!” message. Their common edge has all 129 serialized
height words identical. Generation itself adjusted 328 and 706 interior
vertices respectively, with no changed border vertices. Later interior
differences are retained rather than overwritten.

`scripts/run-native-connected-terrain.py` requires the current qualified
binary/source tuple and refuses a concurrent native game/build. It copies only
three verified settings files to a new owned profile and drives original
freestyle startup and the Save menu. It samples its exact PID and enforces a
512 MiB sampled-RSS ceiling and 120-second duration ceiling. Both observed
runs take about 41 seconds, with maximum sampled RSS below 177 MiB. This is
not a memory bound across repeated region travel or browser performance proof.
Original settings remain unchanged. No browser is used.

`scripts/inspect-native-connected-terrain.mjs` requires terminal successful
runs, original-generation confirmation, one matching native save and unchanged
source settings. It inspects every saved height, keeps boundary mismatches
fatal, hashes each complete edge and compares adjacent regions. Reads are at
most 4,096 bytes; source digest, size and modification metadata remain unchanged.
Six focused connected-height/native-height tests also pass, covering negative
and distant coordinates, exact serialization, varied regions and invalid input.

Evidence: `output/native-world-residency-build-038.json`,
`output/native-connected-terrain-attempt-011.json`,
`output/native-connected-terrain-attempt-012.json`, and
`output/native-connected-terrain-pair-observed.json`. Private saves, binaries,
frames and run logs remain local inputs.

The subsequent [generated-kingdom unload/revisit trial](native-connected-residency.md)
now preserves both regions' saved state on return in one native process. Initial
load primary-field differences remain unqualified.

Matching material cells and lighting halos, navigation/building placement near
boundaries, hero crossing, repeated world disposal, full native/browser memory
limits and cooperative region publication remain unfinished. Browser game
testing remains suspended under the workspace crash restrictions.
