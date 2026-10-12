# Preparing repeated hero travel with a pending guild command

The registered-hero arrival planner now accepts a pending return-to-guild Queue
when its source region contains a pure home proxy. Previously it required a
native home in the departing region, so a second remote hop refused the actual
moved hero's command with `Unresolved hero order user-data reference`.

`checkpointRegisteredHeroArrivalPlan` verifies both stopped owner/home snapshots
before supplying the native guild ID from the immutable registered home record.
The order planner admits only the existing pinned kind7/procedure1003 callback,
with no script callback and an exact matching guild reference. A proxy's zero
backlink or an unrelated local building is never substituted. Remote arrival
keeps the reference deferred before native lookup; return home resolves it to
the actual registered guild. Source waypoints and other opaque bytes remain
source data until coordinate/navigation reconciliation.

Five new tests include wrong guild IDs, invalid native reference bindings,
unqualified callbacks and forged registrations. The route-store integration
seeds home0_0, publishes a synthetic first hop1_0, prepares the pending Queue for
2_0, independently compares every prepared actor record against the receiving
fixture and publishes that second hop. The sole selected owner becomes2_0.
Return preparation then resolves the original home without publishing any
additional state. These are synthetic custody tests, not native crossing proof.

All62 tests pass across arrival, registered-home arrival, route custody and
populated command preparation in `output/remote-hero-order-arrival-005-repeated-custody.log`.

```sh
node --test --test-concurrency=1 tests/checkpoint-arrival.test.mjs \
  tests/registered-hero-arrival.test.mjs tests/hero-route-store.test.mjs \
  tests/hero-order-arrival.test.mjs tests/remote-hero-order-arrival.test.mjs
node scripts/prepare-native-remote-hero-orders.mjs <fresh-report.json>
```

The read-only real-file preparation binds native218's frozen reload proof,
original producer, archived compiled sources and native211's saved hero547/AI24.
It verifies the actual pure home23 against immutable guild registration, then
prepares two152-byte Queue payloads. Source clock12500 and dispatch anchor8750
give a3750ms age: the remote candidate clock8750 produces dispatch5000, while
the original home checkpoint clock57650 produces53900. The guild469 callback,
procedure1003 and consumed waypoint stay byte exact. All byte changes are
limited to qualified patches, and all original worlds remain unchanged.

Evidence is `output/native-remote-hero-orders-001-refused.json` and
`003-prepared.json`/`003-preparation.log`. Those two payloads are inert; no next
region has been selected, no native actor activated, no ownership published and
no browser or native process launched. Actual seam movement, destination terrain
admission, source retirement, atomic shared-world ownership and multiplayer
qualification remain unfinished.

Native218's earlier planning generation stays frozen under
`output/native-regional-reload-generation-218/manifest.json`. Current arrival
modules have new provenance. Historical capsules must not be relabeled current
or launched by bypassing hash checks; a new native preparation must bind the
current planner. The served game binary is not rebuilt by this change.
