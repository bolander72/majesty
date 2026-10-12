# Coordinate conversion for a pending actor crossing

`web/world/actor-region-crossing.mjs` adds
`actorRegionCrossingCoordinates(previous, proposed, source, destination)`.
It converts a pending movement step into a neighboring region's local frame
and returns the exact global position, direction, displacement and candidate
navigation cell. The utility has no game or storage side effects.

The existing `actorRegionCoordinates` requires a position inside both source
and destination footprints. That works for overlapping windows, including the
earlier 256-cell/128-cell mission fixture. The generated 128-cell regions are
4096 world units wide and meet without overlapping. A stationary actor inside
one of those footprints has no valid position inside its neighbor. Camera
departure alone therefore cannot establish an actor crossing.

The new conversion requires the prior position inside the source, a proposed
position outside it and inside one cardinal neighbor, equal region extents,
and matching shared-edge spans. Invalid signed Q11 positions, unsafe global
arithmetic, overlapping or distant targets and ambiguous corner steps refuse.
It preserves the proposed fractional position and proposed elevation, without
clamping either into a valid range. Its storage is a fixed number of scalars;
it retains no region history or entity collection.

For example, a proposed westward step from source-local `x=0` to `x=-1` in Q11
becomes destination-local `x=8,388,607`. With that neighbor's origin at -4096
world units, the global displacement remains exactly -1/2048 world unit.
An eastward reverse step returns to the original global position.

The new API lives in a separate module. The saved-position converter is
byte-identical to both its preserved WASM-candidate input and served source,
retaining earlier preparation provenance.

## Verification and remaining integration

Seven new synthetic tests and five existing coordinate tests pass, with no
failures or skips. They cover all four directions, reverse travel, fractional
positions, distant positive/negative origins, half-open bounds, wrong targets,
corner proposals and unsafe arithmetic. Evidence is
`output/actor-crossing-003-isolated-focused.tap`.

```sh
node --test --test-concurrency=1 tests/actor-coordinates.test.mjs tests/actor-region-crossing.test.mjs
```

No production caller supplies original movement to this utility yet. It does
not establish that the original engine emits a usable boundary step, admit
terrain collision or grounding, reserve native/script identities, update
command destinations or rebuild native spatial state. Those operations must
join the existing save/dispose/load and durable sole-owner transaction before
ordinary destination AI resumes. Guild membership, attached units, held items
and external references still need their complete migration obligations.

The current native region session continues to leave heroes in their saved
kingdoms. No native game, build, browser, relay or tunnel was started, and no
served files were published. Live hero travel, co-op regional ownership,
completed multiplayer matches, independent-machine internet play and sustained
browser resource bounds remain required by the active goal.
