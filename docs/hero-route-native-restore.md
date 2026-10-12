# Selected hero owner at native player startup

Preparation also supplies a bounded binding for the current hero and its
actual guild. The production engine verifies that binding before the first
gameplay update. See [engine hero binding](hero-runtime-binding.md) for its
scope, native qualification and remaining live-travel work.

The opt-in startup path prepares an existing custody-selected kingdom for the
original region checkpoint loader. `hero-route-restore.mjs` copies its GMP into
the native region slots and publishes their marker under the world's exclusive
lock. It preserves the custody journal and imports no individual actors. This
is a connection between existing save formats, not live hero crossing.

The bootstrap URL requires a named `world`, its canonical `profile` and
`RECOMP_RULE_FRONTIER_REGION`, `RECOMP_RULE_FRONTIER_RESTORE=1`, and:

```text
RECOMP_RULE_FRONTIER_HERO_RESTORE=v1
hero-world=<expected 64-character lowercase hexadecimal world ID>
hero-entity=<expected 64-character lowercase hexadecimal hero entity ID>
```

Incomplete, duplicate or conflicting settings fail before startup. Room,
network, chapter, paired-transfer and in-process region-session settings are
rejected by this prototype. The [Frontier journey panel](hero-route-launcher.md)
now registers a saved hero and generates these links in source and an isolated
overlay; live browser use remains unverified.

The staged player acquires its existing lifetime world lock before content
hashing. After verifying the installed game's native checkpoint content
identity, it invokes the preparation callback before GPU allocation and WASM
script injection. The callback requires the startup AbortSignal and is usable
once before injection. A startup failure drains its exact pending preparation
before releasing the lock; borrowed capabilities expire with that startup.
Cancellation therefore cannot release the lock while a write is still pending.

`nativeHeroContentDigest` derives the required custody content digest from the
verified native `hex64:hex64` identity with a tagged SHA-256 encoding. Existing
native development journals use a different fixture-derived identity and fail
this check. Qualifying those bytes for this startup path would require explicit
enrollment in an isolated browser-compatible journal; no automatic migration
or in-place metadata rewrite is implemented.

Preparation checks the registered world, hero and content identity, the current
selected-owner manifest, its region, the checkpoint structure, digest and saved
clock. Startup selects that owner inside its existing exclusive lease and
validates one captured custody checkpoint. It no longer loads and validates the
same owner first just to discover a manifest. The explicit-manifest preparation
API still requires an exact manifest and refuses a stale or null token; current
selection is a separate entry point. Both retain digest checks before and after
consuming the owner. Data is read and copied in chunks of at most 4096 bytes.
An identical prepared native checkpoint is an idempotent retry. A different
native checkpoint is refused, preserving an evolving or newer kingdom instead
of replacing it with the custody snapshot. Orphan native data also causes
refusal. Tests recover interruptions immediately before and after marker
publication; partial-stream failures and OPFS power-loss durability are not
qualified by these tests.

The actual region controls remove the three hero bootstrap fields from browser
history only after the selected region reports ready. Restore progress or
another region's ready message does not consume them. Ordinary subsequent
native saves and reloads then use the evolving native region slots. Publishing
that evolved state back to the custody journal now has a
[stopped-world save API](hero-route-native-save.md); launcher and live game
driving of that publication are still unfinished.

## Verification

`output/hero-route-startup-selection-regression-001.log` records 167 passing tests across
startup, preparation, profile storage, custody, checkpoint cancellation,
destination admission, realm/session storage, transfer, arrival and home-leg
planning. The new preparation tests use small synthetic original-format
checkpoints and controlled OPFS/Web Locks. They cover identity and stale-owner
refusal, exclusive ownership, byte preservation, idempotence, publication
interruptions, cancellation and protection against save rollback.

The startup test evaluates the complete staged player script and calls the
production startup/preparation code. Its GPU stub requires the selected GMP to
be present before graphics allocation, and its injection stub checks the guarded
profile selected by preRun. No WASM is instantiated. The region-controls test
evaluates the actual source and verifies history/link updates at the ready
boundary. These checks establish script ordering and storage behavior, not
original-engine loading or browser gameplay.

`output/hero-route-startup-original-003.json` additionally qualifies the startup
projection against the selected original home checkpoint at native revision 8.
The test verifies the producer is absent and every original journal filename
and digest is unchanged before and after. It registers the same 336,749-byte
snapshot in a fresh test world with a new origin identity and an explicitly
controlled content fingerprint. The native development journal is not migrated.
Production startup then prepares the original region-loader slots under one
exclusive world lease. Their digest, sole UNIT513/GPL29 owner, reciprocal guild
roster and saved clock 113500 remain intact. The separately enrolled journal is
also unchanged by startup.

This test uses filesystem-backed OPFS-shaped handles, streamed temporary-file
writes and controlled Web Locks. Every adapter read/write is at most 4096 bytes;
one operation is pending at a time. Startup captures the owner GMP once and uses
557 reads and 84 writes. Across enrollment, startup and native-slot inspection,
the duplicate-validation removal reduces reads from 1517 to 1226 (291 fewer)
against the same original checkpoint. This is a file-operation measurement,
not a browser timing or memory benchmark. The test stops before graphics and
WASM; installed browser content compatibility and original-engine loading are
unverified. Attempt001 reached projection but failed because the test called a
nonexistent read helper; attempt002 corrected that harness and is the preserved
performance baseline. Attempt003 covers the optimized implementation and binds
its source hashes.

Reproduce from the workspace root:

```sh
node --test tests/hero-route-launch.test.mjs tests/hero-route-restore.test.mjs tests/hero-route-profile.test.mjs tests/hero-route-store.test.mjs tests/checkpoint-lease.test.mjs tests/native-destination.test.mjs tests/realm-session.test.mjs tests/realm-store.test.mjs tests/transfer-store.test.mjs tests/registered-hero-arrival.test.mjs tests/halo-home-leg.test.mjs tests/player-startup-cancel.test.mjs
```

The original-data test requires local private evidence and a fresh report suffix:

```sh
MAJESTY_HERO_STARTUP_ORIGINAL_PUBLICATION=output/native-halo-saved-roundtrip-publication-001-observed.json MAJESTY_HERO_STARTUP_ORIGINAL_ATTEMPT=output/native-halo-saved-home-owner-attempt-001.json MAJESTY_HERO_STARTUP_ORIGINAL_BASELINE=output/hero-route-startup-original-002.json MAJESTY_HERO_STARTUP_ORIGINAL_REPORT=output/hero-route-startup-original-004.json node --test tests/hero-route-startup-original.test.mjs
```

The served game has not been rebuilt or launched for this checkpoint. Browser
testing remains suspended under the workspace crash constraint. Game-driven
browser enrollment, automatic custody updates after gameplay, multiple travelling heroes, live
browser crossing, co-op region handoff, independent internet full matches and
sustained browser memory bounds remain unfinished. The full goal stays active.
