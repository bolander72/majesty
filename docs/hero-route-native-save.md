# Persisting stopped native gameplay into hero custody

Registered gameplay saves now have a separate scoped [live publication
path](hero-live-save.md), using an acknowledged paused native checkpoint and
the injected game's existing world lease. The offline API described below
continues to refuse an open game.

`publishNativeHeroOwnerSave` connects an original native region checkpoint to
the registered hero journal's existing `save` transaction. It captures the
current kingdom after gameplay so later owner restoration can use that evolved
snapshot. The [Frontier journey panel](hero-route-launcher.md) now invokes this
API during stopped-world preparation in source and an isolated overlay. The
served game is unchanged. It supports the prototype's
one registered, living hero with unchanged native/script aliases; hero death,
alias reassignment, multiple travellers and cooperative ownership need further
integration.

The caller supplies the expected world and hero IDs, verified native content
identity, region, exact custody and native checkpoint manifests, and a stable
operation ID. The custody content digest is derived from the native identity by
the same rule as selected-owner startup. Fixture-derived development identities
are not silently converted.

The function acquires the named world's exclusive lock with `ifAvailable` and
refuses an open game before touching files. Its stores borrow only that lock
for the duration of publication. It does not borrow a live game's lock or
interpret a browser message as permission to write while the engine is running.
Future game-driven integration must establish an acknowledged stopped-world
boundary before using the equivalent transaction.

The native checkpoint must match the supplied marker, pass digest and complete
original root validation, and have a saved clock at least as large as the
selected kingdom's clock. The current prototype refuses clock rollback; clock
wrapping needs separate handling. The existing custody transaction also
validates the hero and its reciprocal native/script guild relationships. It
retains the immutable registered origin and outgoing aliases, stages the new
world in the other custody slot, and publishes one new hash-linked head. No
native checkpoint is modified by publication.

An already selected identical world returns without a new revision. Retrying an
operation after an uncertain acknowledgement uses the original operation ID and
original expected custody manifest; the transaction recognizes its exact prior
publication and creates no writes. Stale state, reused operation IDs with a
different intent, damaged saves, incompatible content and changed ownership
refuse. The prototype does not infer or reassign a hero from matching class or
player alone.

All custody reads and writes check cancellation, and the native source is a
leased checkpoint reader. Pending I/O drains while the exclusive world lock
remains held. An interrupted staging/publication keeps either the prior or the
published head selected; a retry determines which. Tests exercise cancellation
with pending reads and writes and at three publication boundaries. This does
not qualify real OPFS power-loss durability.

## Verification

`output/hero-route-native-save-regression-001.log` records 177 passing tests
covering save publication, startup/preparation, custody/profile storage,
checkpoint cancellation, destination admission, realm/session storage,
transfers, arrivals and home-leg planning. The ten new save cases use synthetic
original-format worlds and controlled OPFS/Web Locks. The first focused run
failed when a test expected an asynchronous rejection for synchronous content
validation; the corrected second run preserves that check and passes.

`output/hero-route-startup-original-004.json` adds a stopped original-save check.
It binds the absent native producer and its independently inspected ten-tick
continuation. The unchanged revision-8 native journal supplies home at clock
113500; an isolated test world is separately enrolled using those exact bytes.
After initial startup projection, the original engine's evolved 336,377-byte
save at clock 114000 is copied into that test world's native region slots. The
production save API publishes it as custody revision 1. Reopening verifies
UNIT513/GPL29, guild relationships, digest and saved clock. The production
startup preparer then selects revision 1 and the updated native save without
replacing it. Publication retry and resumed preparation each write zero bytes.
Both original input saves and the original native journal remain unchanged.

The original-data test uses filesystem-backed OPFS-shaped handles with streamed
writes and a controlled content fingerprint, not a browser installation's
verified assets. Adapter operations are at most 4096 bytes with one pending I/O
operation. No native process or browser starts. It stops before graphics/WASM
and does not qualify a new original-engine reload, live world crossing or an
end-to-end browser save/load session.

Reproduce with a fresh report suffix and the local private evidence:

```sh
node --test tests/hero-route-native-save.test.mjs tests/hero-route-launch.test.mjs tests/hero-route-restore.test.mjs tests/hero-route-profile.test.mjs tests/hero-route-store.test.mjs tests/checkpoint-lease.test.mjs tests/native-destination.test.mjs tests/realm-session.test.mjs tests/realm-store.test.mjs tests/transfer-store.test.mjs tests/registered-hero-arrival.test.mjs tests/halo-home-leg.test.mjs tests/player-startup-cancel.test.mjs
MAJESTY_HERO_STARTUP_ORIGINAL_PUBLICATION=output/native-halo-saved-roundtrip-publication-001-observed.json MAJESTY_HERO_STARTUP_ORIGINAL_ATTEMPT=output/native-halo-saved-home-owner-attempt-001.json MAJESTY_HERO_STARTUP_ORIGINAL_BASELINE=output/hero-route-startup-original-002.json MAJESTY_HERO_STARTUP_ORIGINAL_CONTINUATION=output/native-halo-saved-home-owner-001-observed.json MAJESTY_HERO_STARTUP_ORIGINAL_REPORT=output/hero-route-startup-original-005.json node --test tests/hero-route-startup-original.test.mjs
```

The served game was not rebuilt or launched. Live launcher enrollment/save driving,
live browser hero crossing, co-op region activation, completed internet matches
and sustained browser resource measurements remain required by the active goal.
Browser launch suspension remains in force under the workspace crash constraint.
