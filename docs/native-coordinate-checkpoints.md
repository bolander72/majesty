# Verified checkpoint slots for native coordinate travel

The opt-in native coordinate fixture now publishes each kingdom through two
original GMP save slots and a small atomic checkpoint marker. Before unloading
the current kingdom, destination admission verifies the selected slot's size,
SHA-256 and fixture content identity, rather than just its VERS header. Original
engine save/load and disposal still perform the world transition.

Official native110 and corrected travel attempt005 pass independent inspection
through `0_0 → 0_-1 → 0_0 → 0_1 → 0_0 → 1_0 → 0_0 → 0_-1`.
Eight visits advance326 original ticks in45,223ms and preserve compared saved
state, clocks, RNGs, terrain and committed-pair hero ownership. Eight checkpoint
publications select slots `1,1,0,1,1,1,0,0`; each final marker selects that
coordinate's own latest verified original save.

## Actual fault cases

The controller damages only an owned copy of the southern kingdom: byte272 is
XORed with1 while size and the original VERS header remain unchanged. The native
router rejects this existing neighbor before the first world unload. Only after
the actual refusal does the controller withdraw the request and restore the
original copy. Independent inspection compares the complete files in4KiB reads
and verifies that exact changed byte and publication/repair ordering.

An empty inactive northern recovery slot is present before launch. The valid
committed slot still loads, and later publication replaces the inactive slot.
Selected save size and digest validation remain mandatory. This corrects
native109's overly strict requirement that both slots already contain complete
saves. Oversized or nonregular slots still refuse.

Six actual refusals cover stale serial, missing west neighbor, non-neighbor,
trailing byte, damaged existing south and replay. Twenty contradictory actual
trace controls refuse. Original selected worlds, generated input kingdoms,
settings, publication and receipt remain unchanged.

## Verification and resource limits

Twenty-four complete heap metadata captures reconcile with saved clocks and
original disposal; all48 tracked root frees are observed. Seven replaced queues
retire through original destruction/deletion, reclaiming28,672 observed backing
bytes. Eight post-cleanup full saves preserve compared state and raw terrain.
The observed4KiB group stays at nine blocks; eight origins remain outside the
observer's coverage.

Other allocations still grow: home visits0→6 add357,968 heap bytes/24,752 CRT
live bytes, and north visits1→7 add101,184/19,200. Maximum sampled native RSS is
180,699,136 bytes. These observations establish neither sustained memory bounds
nor a browser performance gain. No FPS claim is made.

Twenty-six focused JavaScript checks pass. The existing compiled production
CheckpointStore suite passes76 checks, covering slot rotation, interrupted
writers, invalid content/digests and streamed SHA-256. This suite was run without
another build; it is not a claim of freshly rebuilt transitive dependencies.

Copying uses4KiB chunks, digest loading uses16KiB scratch, the marker is capped
at511 bytes, and each native fixture slot is capped at2MiB. No complete GMP is
buffered by this adapter. Content identity binds to the compiled native fixture
artifact; it is distinct from the browser's imported-assets identity. Power-loss
durability, concurrent external writers and production recovery remain untested.

Native109's ordinary four-kingdom run also passes. Fault attempt004 remains a
failed controller run: packet timing concealed the trailing-byte probe, and a
shadowed path broke final bookkeeping. Its native process is confirmed absent
but its native exit code was not independently retained. It is not promoted to
a passing run. Attempt005 fixes both controller errors and exits normally.

## Evidence and reproduction

Current evidence is in parent `output/native-coordinate-checkpoints-003-`
`heap-observed.json`, `queues-observed.json`, `controls-observed.json`, and
`native-coordinate-multiway-attempt-005.json`. Exact executable, compiled source,
symbols, controller, inspectors and proofs are frozen and rehashed in
`output/native-coordinate-checkpoints-generation-110-preserved.json`.

Use the official `scripts/build-native-world-residency.py --attempt FRESH`
wrapper, then `scripts/run-native-coordinate-multiway.py` with that build report,
the immutable committed-pair publication/receipt, the qualified southern and
northern initialization proofs, and these flags:

```text
--attempt FRESH --fourth-initialization-proof output/native-connected-north-004-initialized.json
--coordinate-checkpoints --checkpoint-fault-probe
--capture-heap --capture-page-context --retire-orphan-queues
```

The southern proof is `output/native-connected-south-003-initialized.json`.
Inspect the terminal manifest with `scripts/inspect-native-coordinate-multiway-heap.mjs`,
then inspect its proof with `scripts/inspect-native-coordinate-multiway-queues.mjs`
and `scripts/check-native-coordinate-multiway-controls.mjs`, each using a fresh
output path. Keep one heavy build/game at a time and retain failed attempts.

This is native prototype work. Browser HTML/WASM delivery is unchanged this
turn; no browser game launches ran and the crash suspension remains in force.
Automatic region generation while exploring, spatial hero crossing, production
browser activation, shared co-op region activation, completed internet matches
and sustained browser/native memory bounds remain unfinished.
