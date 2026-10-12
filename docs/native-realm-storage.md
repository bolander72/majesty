# Independent saved realms

`web/world/realm-store.mjs` stores independent stopped kingdom snapshots;
`web/world/realm-terrain.mjs` connects them to the bounded native terrain scene.
The number of saved regions can grow without loading a directory catalogue
into memory. A scene requests only the realms containing its visible windows.
The store accepts at most 49 unique region keys per read lease. It retains no
region index, open-file cache or decoded terrain after that callback ends.

Each region uses two data slots and one marker. Names are generated from
canonical signed region coordinates, bounded to ±1,000,000:

```text
Frontier_0_0.GMP
Frontier_0_0_Recovery.GMP
Frontier_0_0.checkpoint
```

The marker uses the existing native `checkpoint-v1` format: slot, byte length,
full-file SHA-256 and expected imported content identity. It is limited to
511 ASCII bytes, data files to 64 MiB, and all copying/hashing to 4096-byte
reads. The original flat adapter remains available for isolated snapshots.
`web/world/realm-profile.mjs` adds a separate adapter for the pinned game's
observed profile/SaveGame layout, with opt-in launcher integration described below.
The original serializer must supply complete validated stopped snapshots.
The store validates integrity, not every gameplay relationship in their bytes.

A writer validates the old selected file, checks its predecessor, stages the
inactive slot, verifies it independently and publishes the marker last.
Repeating the selected snapshot performs no write. A failed publication
preserves the selected snapshot; a completed-but-reported-failed publication
can be retried idempotently. Two data slots bound retained versions per region,
while durable disk usage grows with saved regions. Unmarked pre-existing files
are preserved: first-publication recovery accepts only an exact matching staged
file and writes its marker without overwriting data.

All participating readers/writers use one world-scoped shared/exclusive lock.
Busy locks reject without queueing. `withRegions(keys, callback)` holds that
lease through file validation and bounded reads, freezes selected metadata and
expires readers when it ends. A callback cannot enlarge their captured file
size. The OPFS adapter expects an owned world directory supplied by the caller,
never the personal profile root. Its browser behavior remains unqualified.

The profile adapter takes the Majesty profile-root directory handle and a
validated world name. It maps logical files into a dedicated namespace:

```text
profile/native-world-example/frontier_0_0/Frontier_0_0.checkpoint
profile/native-world-example/frontier_0_0/Documents/My Games/MajestyHD/SaveGame/Frontier_0_0.GMP
profile/native-world-example/frontier_0_0/Documents/My Games/MajestyHD/SaveGame/Frontier_0_0_Recovery.GMP
```

`nativeRealmProfilePath('example', '0_0')` returns the relative profile path,
whose region suffix also satisfies the native region guard. Construction and
reads create no directories. Writes create only the requested region's path.
Every component is generated from a validated world name and canonical region
key; filenames outside the two slots and marker are rejected before I/O.
Permission errors propagate, and missing directories never fall back to a
personal profile or the flat snapshot directory. It uses the same world lock
as the flat adapter, with no directory listing or handle catalogue.

This path adapter reads stopped snapshots. Opt-in named-world startup now owns
the same exclusive world lease before content hashing, GPU creation or native
script injection. It retains that lease until the page context is destroyed;
pagehide and runtime failure are not proof that native I/O ended. Legacy pages
and native hosts do not acquire this lease and must stay stopped when using
the adapter. Actual OPFS and original-engine restore of the new namespace
remain unqualified.

The staged player accepts one validated `world` URL parameter (lowercase
letters, digits and hyphens, up to 40 characters) with a dedicated solo region.
For example, `world=example` selects `native-world-example/frontier_0_0`.
The original `profile=frontier_0_0` parameter remains canonical for the region
guard, while staged preRun selects the nested profile path. Profile-directory
overrides, paired fixtures and cooperative chapter settings are rejected
before startup. The namespace is a host save selection, not a `RECOMP_RULE_`
setting, and does not add a game-rule compatibility parameter.

Regional and atlas links preserve the world name. The generated atlas's
camera/watchtower database gets a separate named-world namespace, including
when its name equals the legacy default. It remains a synthetic terrain
experiment; this change does not turn it into a renderer of native saved maps.
Ordinary links and profiles retain their previous startup route.

The startup wrapper supplies an injection-boundary callback, invoked just
before appending the native script. If startup throws before that boundary,
its unused lease is released. If it throws afterward, the error is reported
but the lock-owning callback remains pending. Successful injection also holds
the lease. There are no polls, retry queues or background timers. This avoids
assuming a failed startup has terminated all native work.

`stage-world.py` upgrades both the raw pinned template and the earlier paired
bootstrap. It is idempotent and refuses unexpected profile, injection or
startup changes. Nine focused named-world tests cover URL validation and
travel, ordinary startup, reader/writer exclusion across regions, unused
lease cleanup, retained failure leases, template migration and atlas storage
isolation. The final test runs the shipped startup, preRun and injection code
with controlled Node VM browser APIs for success, busy storage, invalid
settings and failures before/after injection. It requests no actual browser,
GPU or WASM runtime; real engine startup remains unverified.

This is an independent-region store, not an atomic transaction spanning
kingdoms. A cross-region actor move or co-op checkpoint still requires coordinated
publication of every affected region. The existing two-kingdom paired store
continues to serve that separate, unfinished integration route.

The terrain provider maps projected cells to declared uniform realm dimensions
and reads only requested snapshots under that world lease. It parses the
original terrain layouts, with no synthetic regeneration of missing regions.
A missing region stays unavailable until a saved snapshot is published.
Consumers cannot query outside the captured window set or after lease expiry.
It preserves the existing 49-active/98-handoff scene limits.

The scene now supports per-window snapshot identities. New regions and updated
markers replace their windows, while unchanged neighbouring regions reuse
their existing bounded buffers even when the requested realm set changes.
The snapshot identity remains a bounded digest of the captured metadata set,
not an ever-growing list of all saved regions.

Twelve focused store/provider tests cover native marker parsing, slot reuse,
failure/retry, stale writers, world leases, input/read-set bounds, corruption,
unregistered file preservation, new region discovery and neighbouring window
reuse. A full synthetic scene requests 49 stored realms; travelling away drops
its packed data and returning restores it. Those initial changes passed all
173 tests; the current suite including profile and startup adapters passes 189.

The host-file qualification places four actual snapshot variants from two
existing kingdoms under four fixture region keys. It verifies seven window
samples against the previously independently checked terrain digests, discovers
a newly published fourth region, updates one region while reusing its neighbour,
and restores with a fresh store and scene. It requests at most nine realms,
reads at most 4096 bytes and has at most one open read handle. Original saves
are read-only; copied slots and markers are in an isolated ignored directory.
These are snapshot copies, not four newly generated playable kingdoms.

Evidence: `output/native-realm-focused-tests-final.log`,
`output/native-realm-all-tests.log`,
`output/native-realm-world-real-files-observed.json` and
`output/native-realm-terminal-qualified.json`.

Seven additional profile-adapter tests verify isolation between named worlds,
preservation of personal/legacy files, missing directory behavior, traversal
rejection, permissions, busy leases and failed stream publication. A separate
terminal qualification copies a real native profile-layout save into an
isolated directory, registers its identical bytes, validates eight saved
terrain windows, publishes the recovery slot and validates another window
through a fresh store and scene. Reads stay at 4096 bytes with one open read
handle; the original save remains unchanged. This uses a filesystem adapter
with an OPFS-shaped API, not actual browser storage. Evidence is in
`output/native-realm-profile-real-files-observed.json`.

No browser, game or heavy build was launched. The modules are staged, but a
many-realm browser workflow, original-engine profile startup qualification, new map
generation, seam reconciliation, live simulation/hero travel, shared co-op
publication, whole-browser resources and independent-household WAN play remain
unfinished. The full goal and the app-crash testing restriction remain active.
