# Bounded publication of evolved entity state

The verified NPC arrival and both evolved original saves now publish as revisions
0, 1 and 2 under one persistent entity identity. Four supervised Node worker
interruptions recover either the complete previous revision or the complete new
revision. A stopped export bridge now loads revision 2 through the original
engine and publishes its continued gameplay save as revision 3. Browser player
integration and actual return crossings remain unfinished.

## Format and transaction rules

`web/world/entity-revisions.mjs` separates immutable entity/content/region/archetype
identity from mutable local aliases, declared references and world digests. Each
revision records its number, operation ID, preceding manifest digest, owning side,
visited sides and the complete pair of snapshot digests. State and identity JSON
are canonical and bounded to 4096 bytes. A short manifest binds the identity,
revision number, selected slot and revision-state digest.

The store retains eight files per pair: one identity, one manifest, two revision
states and four GMP slots. It overwrites inactive slots, stages and verifies both
worlds and their typed ownership, writes the inactive state, and publishes the
manifest last. Readers hold revocable leases through both world reads or exports.
The implementation retains no revision history list. The previous-manifest digest
is a link, not an independently verified unlimited audit chain.

An operation ID makes the latest exact retry idempotent. Reusing that ID for
different state is rejected. Other stale manifest tokens are rejected. A `save`
must update the active world's digest while preserving the dormant world and
local actor aliases. A `handoff` must change both worlds, remove the outgoing
current alias and select the incoming owner. Returning to a visited side requires
higher native/script IDs than the previous aliases. This minimum check does not
reserve IDs or prove the original engine's complete counter/retired-ID history.
Native capture and migration must supply valid snapshots and fresh identities.

Known UNIT/GPL links, unique owner queue membership, current actor descriptor,
typed script references and inspected command references share the existing
verification helper in `entity-ownership.mjs`. General opaque reference closure,
all historical retired aliases and archetype/player conversions remain unqualified.
The original version1 identity applies to the verified NPC class. This is not yet a general
hero/building/mod migration schema. Stage verification also rejects input that
switches to defective bytes after initial typed validation.

An explicit version2 registered-hero identity now binds the immutable origin
guild registration and global member ID. Its revision state carries native/home
proxy aliases and verifies current reciprocal home memberships. The real
recruited Warrior and neighboring native059 proxy save have an initial stopped
owner publication; actual hero transfer and native reload of this new revision
remain unqualified. See [registered-hero ownership](native-hero-homes.md#explicit-registered-hero-ownership-and-real-stopped-seed).

## Real-save evidence

`output/native-entity-revisions-current-observed.json` independently revalidates
the preceding original gameplay/save/reload continuity, reopens the published
arrival pair and preserves its entity ID. Each owned case publishes the arrival
as revision 0, the first evolved save as revision 1, then abruptly exits a worker
while publishing the second evolved save as revision 2:

| Interrupted boundary | Selected revision after reopening | After recovery |
| --- | ---: | ---: |
| Source staging complete | 1 | 2 |
| Revision state staged | 1 | 2 |
| Before manifest publication | 1 | 2 |
| After manifest publication | 2 | 2 |

All four workers actually exit 77. The selected worlds exactly match the expected
original source and evolved destination hashes, the NPC has one current owner,
and exact retries do not create another revision. Stale attempts to restore the
first save are rejected. All eight files remain bounded in number. A separate
damaged selected-state case refuses reopening rather than selecting stale data.
Selected export streams also reproduce both final world hashes under read leases.
Reads/writes are at most 4096 bytes, with one stored-source read in flight.

The disk adapter uses process-local locks and serial parent/worker supervision.
It syncs files, renames and syncs directories, but these checks do not qualify
power loss, concurrent OS writers or browser OPFS recovery. Both world files are
copied on each publication; avoiding unchanged dormant copies remains an
optimization. Page bounds do not measure the original flat-world simulation or
whole-browser memory. Legacy Python evidence verification separately buffers a
roughly 320 KB GMP for hashing.

## Filesystem metadata correction

The initial attempt is preserved in `output/native-entity-revisions-qualification.log`.
A staged source's ctime changed while its size and mtime remained unchanged;
the file has a macOS provenance attribute. The exact metadata writer was not
identified. Ctime also tracks permissions and extended attributes, so it is not
a content version. The stopped-file reader now checks device/inode, size and
nanosecond mtime before and after each read. Callers independently bind full
content with SHA-256. It still rejects replacements, changed content/timestamps,
oversized reads and symlinks. Controlled filesystem tests demonstrate that a
permission-only ctime change preserves bytes and mtime, and that inode replacement
is rejected even with identical bytes and identical nanosecond mtime.

The focused suite passes 68 tests, including the earlier ledger/export/startup
checks, four filesystem checks and 64 synthetic changing-owner publications with
bounded slots. Those 64 publications test storage rules, not original-engine
crossings. Eleven existing native-export corruption controls also pass with the
updated stopped-file reader. No native build, game process or browser launch was
started for this work.

## Reproduce and continue

From the parent workspace, with the qualified arrival/evolved reports present:

```sh
python3 scripts/check-native-npc-evolved-continuity.py output/native-npc-evolved-checkpoint-observed.json output/native-npc-evolved-second-checkpoint-observed.json --output output/<fresh-continuity-report>.json
node scripts/qualify-native-entity-revisions.mjs <fresh-output-basename> output/<fresh-continuity-report>.json
node --test tests/entity-pair.test.mjs tests/transfer-store.test.mjs tests/checkpoint-lease.test.mjs tests/paired-session.test.mjs tests/stopped-entity-io.test.mjs
```

The optional continuity input lets qualification use evidence recomputed with
current verifier code while preserving earlier reports and their historical
code hashes. It still requires exact independent recomputation of that report.

## Selected revision reload and continued save

`output/native-entity-revision-reload-observed.json` qualifies the stopped
revision-2 export through two separate original-engine processes. Source attempt
004 loads 1,959 units, keeps NPC 2101/GPL 37 absent and preserves all 2,111 other
entity records and queues in another original full save. Destination attempt 016
loads the exact evolved 487-unit snapshot at clock 32650 and its saved position,
restores queues without insertion, and runs 240 ticks with 40 original AI actions.
Both runs use the same receipt and exit 0. These are serial copied profiles;
the original engine reads GMP files exported by the bridge, not revision JSON.
No new native build was required.

The destination's original full save has 489 units, 16 agents, 25 attachments,
clock 44650 and NPC fixed position (3768320,5697536,74421). Its UNIT, GPL and ORDR
writer records all differ from the loaded snapshot. The independent capture
report is `output/native-npc-revision-resumed-checkpoint-observed.json`.

`scripts/publish-native-entity-revision.mjs` recomputes both native reload and
capture evidence, checks both native PIDs are gone, verifies the receipt and
requires the new save to continue its loaded snapshot. It preserves immutable
identity, aliases, references and the dormant source digest, and commits with
the loaded manifest as a compare-and-swap token. A deterministic operation ID
binds the loaded manifest, capture manifest digest and new world digest. Exact
retries remain idempotent; a changed selection cannot be silently overwritten.

`output/native-entity-revision-save-publication-observed.json` records the first
publication as revision 3. A separate full CLI retry report proves that the same
save performs zero writes and retains eight files. An initial retry diagnostic
incorrectly treated absent write statistics as a failed bound; the corrected
publisher initializes these counters to zero. The failed diagnostic log is
preserved, and the store remained at revision 3 throughout.

Revision 2 is rejected for new launches after publication; historical verification
still validates its exact exported files and native-run provenance. Historical
receipt verification requires the original identity/store and qualification
report to remain available; it is not a standalone portable-save archive. The
new selected revision-3 export is
`output/native-entity-revision-latest-export-observed.json`. It has not yet been
reloaded in the original engine. The healthy `after-publish` case now selects
revision 3; the previous four-boundary report describes its earlier revision-2
state, and the other boundary cases remain unchanged.

Checks pass: 68 focused JS tests, 11 export refusal controls, 37 source-reload
controls, 28 motion controls, 16 evolved-save controls and 8 new save-provenance
controls. Those eight reject altered/unrelated captures without changing the
selected manifest. All controls run offline and start no game or browser.

With the terminal native evidence available, the stopped bridge is reproducible:

```sh
python3 scripts/check-native-entity-revision-reload.py output/native-original-source-departure-attempt-004.json output/native-joint-reload-attempt-016.json --output output/<fresh-reload-proof>.json
node scripts/check-native-npc-evolved.mjs output/native-joint-reload-attempt-016.json output/<fresh-capture-proof>.json
node scripts/publish-native-entity-revision.mjs output/<fresh-reload-proof>.json output/<fresh-capture-proof>.json output/<fresh-publication-proof>.json
node scripts/export-native-entity-revision.mjs output/native-entity-revisions-current-observed.json <fresh-export-basename>
```

The evolved NPC's read-only return capsule and departure preflight are now
recorded in [native-entity-return.md](native-entity-return.md). Its original-engine
consumer still needs genuinely reserved local IDs, destination clock/path/Move
operations and paired source removal/receiving save publication.
Region activation/deactivation, disposal, simultaneous
original regions and original terrain streaming remain unfinished. So do full
co-op shared victory/defeat and independent-household internet testing. Served
WASM is unchanged and browser launches remain suspended pending the app-crash
investigation.


### Reloading both worlds of the committed native return

The parent `run-native-return-revision-reload.py` accepts the publication report,
current selected revision receipt, `--side 0|1`, and an unused `--attempt`. It
reconstructs the stopped original loading/removal/activation/gameplay history,
binds both exports to the actual return commit and rechecks both current launch
guards after copying. Producer settings and the native source/executable stay
exact. Each run uses a fresh owned profile. The runner refuses a live native game
or compiler/build process; run the active side to termination before the dormant
side. No native rebuild is needed for these tooling changes.

Side 0 restores the saved 2142/GPL72 UNIT, GPL and Orders through original writers,
checks the saved schedule without reinsertion, delegates another 240 original
movement/AI ticks and writes a full save. Side 1 uses the original absence/full-save
fixture with the clock pinned, without insertion, deletion or motion.
`check-native-return-revision-reload.mjs <active manifest> <absent manifest>
<fresh report>` independently qualifies both processes against the same commit.
It checks every dormant record/queue and checks exclusive ownership and known
reference bindings in both resulting original saves.

Observed revision 4 runs side0/side1 attempt001 were serial, exited 0, and are
stopped. Active loading visits 1962 units; the NPC starts at clock28000 and fixed
10789593,5397794, then completes 240 ticks to clock40000/fixed9985640,6463896,
with33 original Path calls and40 AI actions. The new full save retains1962 units,
74 agents and87 attachments. The dormant load visits488 units and preserves527
records,15 queued agents and24 attachments;510/GPL79 remain absent.

The paired proof is `output/native-return-revision-paired-reload-final-observed.json`.
47 refusal controls accept unchanged copied evidence before each mutation, reject
altered modes, identities, provenance, writers, logs or process ordering, and keep
the canonical eight-file store unchanged. This proves one stopped NPC return and
paired fresh loading. Repeated crossings, adjacent terrain generation, live original
region disposal/residency, complete opaque reference closure and browser memory
bounds remain unfinished. Browser launches remain suspended.


### Returned owner continuation: revision 5

The actual active full save from the paired revision4 reload now advances the
canonical store as ordinary save revision5, retaining owner2142/GPL72, all aliases/
reference bindings and the exact dormant world. Recomputed paired original native
evidence and the original loaded manifest authorize this save. Clock40000/actual
position and all three records come from the original writer. Independent retry
is idempotent with zero writes; both old receipt launch guards fail. Eight files,
4096-byte serial I/O and stable identity remain. See native-repeat-crossing.md for
the next current-state typed capsule, Order Wait audit and outstanding runtime work.
