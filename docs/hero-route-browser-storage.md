# Browser storage for the selected hero custody journal

`hero-route-profile.mjs` connects the existing `HeroRouteStore` transaction
contract to browser file handles. The prototype's journal lives beneath
`majesty/profile/native-world-<name>/hero-route/`. It shares the exact named
world lock used by original region saves and game startup. A live game's
exclusive lease therefore refuses offline custody reads or writes immediately.
No lock is queued and the adapter never borrows the engine's lease for writing.

Opening an existing route requires the expected world ID, hero entity ID and
content digest. `openHeroRouteStore` reads at most 4096 bytes of canonical
identity metadata before constructing the store. It checks all three expected
identities and the registered guild origin. It opens no GMP, scans no directory
and creates nothing. Normal store operations recheck the captured identity
after acquiring their own lock, so replacing it between opening and reading
does not rebind an existing store.

There is one route directory in each named world. The current format binds one
registered hero; another hero must fail its stored identity check. Separate
hero directories would fork complete kingdom histories, so the prototype does
not create them. A world containing multiple travelling heroes still needs a
shared custody format and native coordination.

The adapter admits only the canonical identity/head, u32 journal-node names
and canonical two-slot region checkpoint names. Every operation must hold the
world lock; writes require exclusive mode. Reads bind a captured File to one
operation and reject use under a later lease. Each read/write is at most 4096
bytes. Metadata writes are bounded to 4096 bytes and GMP writes to 64 MiB.
Existing custody verification selects the owner and hashes the complete worlds.

Atomic writes use `createWritable` and publish on close. A producer or stream
creation failure aborts the stream and removes only its newly created empty
file while the exclusive lease is still held. Existing files are preserved.
Once close starts, publication is uncertain: the adapter retains the file and
lets the journal's normal verification/idempotent retry discover the selected
state. This is not qualification of browser OPFS power-loss durability.

To open an existing, previously seeded route from a captured profiles handle:

```js
import {openNativeHeroRouteStore} from './hero-route-profile.mjs';
const store = await openNativeHeroRouteStore(profiles, worldName, {
  worldId: expectedWorldId,
  entityId: expectedHeroEntityId,
  contentDigest: verifiedContentDigest,
}, {signal});
const selected = await store.read({signal});
```

The focused regression run passes 144 tests across route/profile storage,
checkpoint cancellation, native destination admission, realm/session storage,
transfer storage, registered arrival and home-leg planning. Ten new profile
cases include four interruption/retry boundaries, uncertain-close recovery,
identity mismatches, exclusive game-lock refusal, filename isolation, failed
writes, cancelled opening, and prevention of duplicate kingdom histories.
The OPFS and Web Locks in these tests are controlled adapters.

The separate original-data test passes against the selected revision-8 native
round trip. It maps read-only disk files through the production profile adapter
without copying a complete checkpoint into memory. Opening reads only identity
metadata; owner reads open only home `0_0`. Destination reads open home and east
`1_0`, with clocks 113500 and 4050. Reopening preserves UNIT513/GPL29 as the sole
selected owner. Every journal filename and publication digest is unchanged.
Maximum read size is 4096 bytes; owner reads peak at one pending I/O and the
paired concurrent clock queries peak at two. No native game or browser launches.

Evidence: `output/hero-route-profile-regression-002.log` and
`output/hero-route-profile-original-003.json`. Earlier original-data attempt001
refused an incorrect one-read expectation for the explicitly concurrent pair;
attempt002 recorded the corrected two-read scope. Attempt003 verifies the final
single-directory implementation. Earlier evidence remains preserved.

Reproduce from the workspace root, using a fresh report suffix:

```sh
node --test tests/hero-route-profile.test.mjs tests/hero-route-store.test.mjs tests/checkpoint-lease.test.mjs tests/native-destination.test.mjs tests/realm-session.test.mjs tests/realm-store.test.mjs tests/transfer-store.test.mjs tests/registered-hero-arrival.test.mjs tests/halo-home-leg.test.mjs
MAJESTY_HERO_ROUTE_ORIGINAL_PUBLICATION=output/native-halo-saved-roundtrip-publication-001-observed.json MAJESTY_HERO_ROUTE_ORIGINAL_ATTEMPT=output/native-halo-saved-home-owner-attempt-001.json MAJESTY_HERO_ROUTE_ORIGINAL_REPORT=output/hero-route-profile-original-004.json node --test tests/hero-route-profile-original.test.mjs
```

The [selected-owner startup path](hero-route-native-restore.md) now connects a
previously enrolled compatible journal to preparation of native checkpoint
slots before game injection. Its current verification uses synthetic saves and
controlled browser APIs; the served game has not been rebuilt for this path.
The game does not yet create this journal or drive it during browser
hero departure/import/activation. Seamless browser travel, multi-hero custody,
cooperative regional ownership, independent internet full matches and sustained
browser resource bounds remain unfinished. Browser game launches remain
suspended while the host-app crashes are unresolved; the full goal stays active.
