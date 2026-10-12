# Recovering a saved region trip

Named solo kingdoms now remember their most recent saved trip. After the
original engine acknowledges its checkpoint, **Save and travel** records the
source, adjacent destination and actual imported-content identity before
replacing the page. **Save and return to Frontier** records the current region.
This adds recovery to the existing player controls; it does not activate the
native fixture router or change original save/disposal behavior.

The Frontier map's **Resume region travel** section offers the destination and
the last saved source. A pending trip remains pending until that destination's
native `ready` message. Arrival keeps the saved-source link: a newly generated
kingdom can be playable before it has a checkpoint. These links load through
the existing profile and compatibility checks, with no automatic game launch.
They do not promise to recover progress made since the last native save.

Only one `journey-v1` IndexedDB entry is retained per named world, with an
explicit 768-character bound and canonical coordinates/content identity. It is
optional navigation metadata, not a kingdom snapshot, actor handoff, paired
checkpoint or campaign transaction. Existing native GMP files and markers are
untouched. Ordinary unnamed regions perform no journey I/O; shared/co-op and
profile-override settings refuse it.

A failed metadata publication stays in the saved source kingdom and makes
recovery links available. The player can retry or explicitly open Frontier.
Arrival metadata failures leave gameplay available. There is no background retry
loop. One arrival operation precedes any departure publication; a loading,
result, network rejection or runtime failure cancels its delayed navigation.
Both atlas recovery links share one navigation flight.

The temporary region stores used by this feature close after every operation.
`BrowserRegionStore.close()` is now idempotent and removes its pagehide listener
before closing the database and releasing the view-store lease. Repeated opens
previously left those listeners attached until navigation. The native world
lease still lasts until document destruction; no runtime message releases it.

## Verification and limits

The focused storage/map/control suites pass **154 Node tests**. They run the
shipped native controls and cover source-save acknowledgement, delayed arrival
and publication, quota failure, late results, cancellation, wrong world/content,
ambiguous destinations, recovery-link contention and malformed records. A
1,000-trip case retains one bounded metadata record through 2,000 closed stores;
100 actual `BrowserRegionStore` opens in a fake IndexedDB/Web Locks environment
leave zero pagehide listeners and release each lease exactly once. These are
JavaScript contract checks, not real browser OPFS or native gameplay results.

Run:

```sh
node --test --test-concurrency=1 tests/journey.test.mjs tests/frontier-controls.test.mjs tests/realm-session.test.mjs tests/native-atlas.test.mjs tests/camera-checkpoint.test.mjs tests/region-store.test.mjs tests/world.test.mjs tests/realm-catalog.test.mjs tests/region-backup.test.mjs tests/realm-profile.test.mjs tests/realm-store.test.mjs
```

Evidence: `output/world-journey-001-qualified-tests.log` and
`output/world-journey-001-staged.json`. Static staging checks source/HTTP bytes
and the unchanged served WASM. No browser launch, game process or native build
is needed for this change. Browser execution remains unverified while the
host-app crash suspension applies. Seamless actor crossing, cooperative
activation, full matches, independent internet play and sustained engine/browser
memory bounds remain requirements of the active goal.
