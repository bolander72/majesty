# Cancellation of region and hero checkpoint reads

The browser's existing neighboring-region admission path now uses the shared
`CheckpointReadLease`. Aborting the travel request immediately clears the
lease's backing-file references, even while a consumer is idle. Pending I/O may
finish, but its result is rejected and no subsequent backing read starts.
Normal callback completion removes the abort listener and revokes escaped
readers. The document's exclusive native-game writer lock remains held.

Empty and oversized files retain their presence and size without becoming
valid checkpoint readers. In particular, an empty orphan save still prevents
generating a kingdom over existing unregistered data. The neighbor adapter
retains its five-open limit, adjacent-region checks and read-only capability.

`HeroRouteStore.read`, `withOwner` and `withDestination` now accept a separate
`{signal}` option. Cancellation is checked before acquiring the operation lock,
after acquiring it, around metadata opens/reads and journal traversal, during
bounded checkpoint reads, and before accepting a consumer's result. Arrival
preparation and selected home-leg planning forward the same option. These are
read-only changes; custody publication remains a separate transaction.

The focused regression run passes 102 tests. New cases interrupt head,
identity, journal and world reads; cancel before a delayed lock is granted;
reject obsolete callback results; and release all 49 backing sources without
waiting for another read. Existing shipped-page tests still exercise neighbor
admission and pagehide cancellation through the actual OPFS adapter with test
storage. They do not instantiate WASM or qualify a real browser writer lock.

The broader regression run passes 220 tests across those six files plus
transfer storage, registered arrival, region backup, realm catalog, native
atlas and halo home routing. Its log is
`output/hero-route-read-cancellation-regression-001.log`.

The read-only inspector also exercises the original-engine round-trip saves
selected at journal revision 8: home `0_0`, hero UNIT513/GPL29, saved clock
113500. It checks cancellation during owner hashing, saved-east arrival
admission and an idle owner callback. All three stop subsequent I/O and make
zero writes. A fresh read restores the same selected owner, and every journal
file retains its publication digest. Maximum custody read size is 4096 bytes,
with one peak read. The saved native producer is confirmed absent; no new
native or browser process is launched.

Reproduce from the workspace root, choosing a fresh report number:

```sh
node --test tests/checkpoint-lease.test.mjs tests/hero-route-store.test.mjs tests/halo-home-leg.test.mjs tests/realm-session.test.mjs tests/native-destination.test.mjs tests/realm-store.test.mjs
node scripts/inspect-hero-route-read-cancellation.mjs output/native-halo-saved-roundtrip-publication-001-observed.json output/native-halo-saved-home-owner-attempt-001.json output/hero-route-read-cancellation-native-002.json
```

Evidence is in `output/hero-route-read-cancellation-tests-001.log` and
`output/hero-route-read-cancellation-native-001.json`. The latter records the
publication/terminal-attempt hashes and relevant current source hashes. It
does not supersede the frozen native gameplay evidence or republish its saves.

This qualifies cancellation and backing-source release, not measured frame
rate, total browser memory, seamless browser hero travel, cooperative regional
ownership or a full internet match. Browser game testing remains suspended
while the host-app crashes are unresolved; the complete goal stays active.
