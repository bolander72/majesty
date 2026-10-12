# Preparing saved hero journeys from Frontier

The Frontier page now has a **Saved hero journey** panel. In a named world,
save and close the native kingdom first, then choose **Check saved journey**.
For a new journey, select one saved hero and choose **Register and prepare
journey**. For an existing journey, choose **Prepare saved journey**. Successful
preparation exposes **Resume saved journey**; no game opens automatically.

The prototype supports one registered hero per world. Live hero crossing,
multi-hero custody and cooperative region ownership remain unfinished. These
controls are in source and an isolated launcher overlay; the served game has
not been updated or launched for this change.

Selected-owner startup now also supplies the production
[engine hero binding](hero-runtime-binding.md), so the original engine must
match the current saved hero and native guild before its first gameplay update.
Pure remote home proxies currently refuse pending live home routing.

## Registration and saved progress

Discovery reads the canonical, bounded identity metadata from the named world's
single journal directory. Missing identity does not select another profile or
create files. Enrollment reads the currently selected region's native snapshot
and offers at most eight heroes from at most eight living player homes. It
retains at most 64 nonempty native home-group IDs during discovery. Saved
native/script reciprocal membership must pass the existing guild-registration
checks; class or ownership alone does not infer a persistent home. A saved
script label is used when available; otherwise choices say “Hero 1”, etc., with
the kingdom number. No internal ID is editable in the UI.

Registering rechecks the exact native manifest and chosen membership under one
exclusive world lock. The origin identity is derived from the world name,
region, saved content identity and snapshot digest. Its `seed` operation ID is
stable across interrupted retries. Existing incompatible origins refuse; no
second hero gets a separate journal that forks kingdom history. A missing
origin beside orphan journal files also refuses, checking at most the first
directory entry without opening a GMP. Legitimate interrupted seeds publish
their identity first and can retry against that same origin.

An existing journey is prepared using the captured custody/native manifests.
Under one exclusive lease, the stopped-world save API publishes the latest
compatible kingdom into custody, then the native-loader preparation checks the
new selected head. Clock rollback, stale selections, damaged bytes, mismatched
content or changed hero aliases refuse. Lost publication acknowledgements
retry the same transaction without another revision. The resume URL carries
the exact world/hero identity, chooses its selected region and strips unrelated
room/session settings.

Content is discovered from the saved kingdom marker for offline preparation.
This is not proof that the browser's currently imported assets match it. Game
startup still hashes its imported content and verifies the registered identity
before GPU allocation or WASM injection. Development fixture identities are
not automatically migrated.

## Lifecycle and bounds

Refresh replaces earlier hero choices. Register and prepare operations
serialize; buttons disable while an operation is pending. Moving to another
region invalidates an unregistered hero choice until refreshed. A prepared
link appears only after successful publication/preparation; errors remove the
link and preserve existing kingdom files. The click uses the Frontier view's
existing replacement navigation after flushing optional camera metadata.

Page departure aborts pending reads/writes, removes links and handlers, drains
the exact operation and releases retained control/storage references. The
main view closes these controls alongside its catalog and backup controls;
it cannot create them after departing during initialization. World lock
admission refuses an open game, and all save operations use bounded checkpoint
readers. The panel retains scalar metadata and up to eight choices, not a
dormant simulation or whole checkpoint buffer.

## Evidence

`output/hero-route-launcher-regression-001.log` records 264 passing tests across
launcher controls/services, custody storage/publication/startup, cancellation,
native destination admission, terrain view, catalogs and backups. The new
launcher cases cover metadata-only discovery, registration, clean resume links,
latest-save publication, stale selections, three interrupted seed boundaries,
origin/hero/content mismatch, orphan data, cancellation and page departure.
These use controlled OPFS/Web Locks and a small DOM adapter. No browser renders
the page. The first focused run exposed an incorrect content-field assumption
in the new service; the second reads content from the validated manifest and
passes. The third adds orphan-journal protection. Failed logs remain preserved.

`output/hero-route-startup-original-006.json` checks the launcher services against
the real selected native home and its independently inspected continuation.
Discovery offers UNIT513 from guild469, and the service registers those original
bytes in an isolated world. Preparation subsequently publishes the original
336,377-byte continued save at clock 114000, preserves reciprocal memberships,
and generates a resume URL whose world/hero IDs match the selected owner.
Repeated preparation and subsequent startup selection write nothing. The
original native journal and source saves remain unchanged. Adapter operations
are at most 4096 bytes with one I/O pending. These are filesystem-backed
OPFS-shaped handles and a controlled content fingerprint; the test starts no
game and stops before graphics/WASM.

`output/hero-route-launcher-site-001/manifest.json` binds the isolated overlay's
101 files. Static inspection resolves 303 relative imports, confirms player
staging is idempotent, and checks the served launcher/player pages stayed
unchanged. This overlay contains no standalone WASM engine. Runtime rendering,
installed asset compatibility, browser save/load, co-op transitions and sustained
browser resource bounds remain unqualified.

Reproduce original-data qualification with local private evidence and a fresh
report suffix:

```sh
MAJESTY_HERO_STARTUP_ORIGINAL_PUBLICATION=output/native-halo-saved-roundtrip-publication-001-observed.json MAJESTY_HERO_STARTUP_ORIGINAL_ATTEMPT=output/native-halo-saved-home-owner-attempt-001.json MAJESTY_HERO_STARTUP_ORIGINAL_CONTINUATION=output/native-halo-saved-home-owner-001-observed.json MAJESTY_HERO_STARTUP_ORIGINAL_LAUNCHER=1 MAJESTY_HERO_STARTUP_ORIGINAL_REPORT=output/hero-route-startup-original-007.json node --test tests/hero-route-startup-original.test.mjs
```

Browser launches remain suspended under the host-app crash constraint. Full
cooperative mission completion, independent internet matches and seamless
bounded world streaming remain requirements of the active goal.
