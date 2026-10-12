# Published NPC pair and original-engine reload

One stopped transfer of the verified Brashnard NPC now has a durable selected
ownership transaction and serial original-engine reload evidence. This is a
foundation for region streaming; it does not implement a continuously expanding
world or repeated travel.

## Publication

`web/world/entity-pair.mjs` binds an immutable canonical ledger to the existing
version-one paired checkpoint manifest. The ledger records one persistent entity
identity, native/script aliases 2101/37 in source storage region `0_0` and 510/79
in destination storage region `1_0`, before/after save digests, and one explicitly
declared leader binding 2073/12 to 497/2. These region names are storage identities,
not evidence of adjacent geometry. The leader correspondence is fixture input,
not an automatically inferred relationship between arbitrary kingdoms.

Before publication the NPC exists and is queued only in the source; afterward it
exists and is queued only in the destination. Reciprocal native/script links,
known typed script references, inspected order references and declared leader
descriptors are checked. Complete opaque reference closure remains unqualified.
Changed ledgers, malformed manifests, damaged saves and attempts to rewind the
immutable transfer are rejected. Initialization writes the ledger first, stages
both inactive save slots, and publishes the manifest last. Each copy/hash uses
at most 4096 bytes per read/write and stages one world at a time.

`output/native-entity-pair-current-observed.json` records three actual supervised
Node worker exits (77), after staging the source, before manifest publication,
and after publication. Reopening selects either the complete old pair or the
complete new pair with one owner. Recovery and subsequent retries preserve that
owner; four GMP slots and an 829-byte ledger are retained per fixture pair.
The disk fixture lock is process-local, with child exits serially supervised.
This does not qualify concurrent OS writers, power loss, OPFS or browser recovery.
The publication path does not buffer whole GMP files. Legacy Python motion
evidence revalidation separately hashes a roughly 320 KB GMP using `read_bytes`;
the page limits do not describe every verifier or whole-browser memory.

## Selected export and native reload

`web/world/entity-export.mjs` holds both selected read leases while copying the
worlds in serial pages, rehashes copied input, and publishes a receipt only after
both writer callbacks finish. Failed, skipped, unfinished or changed writes
cannot publish a receipt. `scripts/export-native-entity-pair.mjs` writes isolated
`Source.GMP` and `Destination.GMP` copies and a bounded receipt, then independently
verifies both copies against the selected transaction and immutable ledger.
This is an owned stopped native fixture exporter, not a player-facing save UI.

Both native runners accept `--selected-pair <receipt>` in their corresponding
reload modes. They verify the receipt and both exported worlds, require the
selected digest to equal the independently qualified original snapshot, copy it
into a fresh profile, and verify that copy before starting the original engine.
The aggregate checker requires the same receipt, selected manifest, persistent
owner and provenance in two separate process/profile runs.

Source attempt003 (PID 89753, terminal exit 0) loads 1,959 original units. NPC2101 and
GPL37 stay absent. A new original full save preserves all 2,111 surviving entity
records and remaining script queues; original counters are preserved.
Destination attempt013 (PID 89784, terminal exit 0) loads 481 units from the same
published pair, restores NPC510/GPL79 queued exactly once without reinsertion,
and runs 240 simulation ticks with 40 original AI actions and 41 Path calls.
The bounded observer removes its delegating hooks afterward. The engine inputs
have exactly the hashes recorded in the receipt.

Evidence is in `output/native-entity-pair-export-observed.json`,
`output/native-entity-pair-source-reload-observed.json`, and
`output/native-entity-pair-reload-observed.json`. Eleven offline export corruptions
and eight mismatched paired-reload controls are rejected. The focused storage,
lease, entity/export and guarded-startup suite passes 54 tests. The existing
source-absence and destination-motion corruption suites reject another 37 and
28 corruptions on the new manifests, respectively. All 84 offline refusals pass.

One initial offline export-controls attempt stopped because a copied fixture's
file metadata changed while being read. Its failure log is preserved. Added
diagnostic detail retained the strict check; a fresh owned-copy controls run
passed. No native run was repeated because of that offline failure.

## Reproduction

From the parent workspace, with qualified original source/destination evidence
already present, use fresh output names and attempt numbers:

```sh
node scripts/qualify-native-entity-pair.mjs native-entity-pair-fresh
node scripts/export-native-entity-pair.mjs output/native-entity-pair-fresh.json native-entity-export-fresh
```

Read the export report's `receipt` path. Run these native commands serially,
waiting for each process to terminate before starting the next:

```sh
python3 scripts/run-native-original-source-departure.py output/native-original-source-departure-preflight.json --attempt 4 --reload-after output/native-original-source-departure-observed.json --selected-pair <receipt>
python3 scripts/run-native-joint-reload.py output/native-inflight-move-checkpoint-observed.json output/native-inflight-move-identity-observed.json --attempt 14 --reload-scheduled output/native-npc-schedule-current-observed.json --observe-motion --selected-pair <receipt>
python3 scripts/check-native-entity-pair-reload.py output/native-original-source-departure-attempt-004.json output/native-joint-reload-attempt-014.json --output output/native-entity-pair-reload-fresh.json
```

The checkers and focused JS tests launch no game:

```sh
node --test tests/entity-pair.test.mjs tests/transfer-store.test.mjs tests/checkpoint-lease.test.mjs tests/paired-session.test.mjs
node scripts/check-native-entity-export-controls.mjs output/native-entity-pair-export-observed.json <fresh output>
python3 scripts/check-native-entity-pair-reload-controls.py output/native-entity-pair-reload-observed.json --output <fresh output>
```

## Remaining goal requirements

The ledger describes one frozen before/after transition. Replaying those files
cannot preserve evolving gameplay or implement repeated crossings. Next work
must connect newly captured native state to versioned ownership transactions,
region activation/deactivation and disposal, plus compatible entity references.
Subsequent [evolved-state work](native-npc-evolved-state.md) verifies two original
gameplay intervals with an intervening save/fresh reload and preserved changed
actor state. Those new snapshots still require ownership revisions in this store.
Simultaneously active original regions, multiplayer region ownership, heroes and
buildings, continuous boundary travel and original terrain paging remain open.
So do full co-op campaign/victory-defeat completion, independent-household internet
qualification and resource measurements across long browser journeys.

No native rebuild was performed for the export/reload bridge. Served WASM is
unchanged. Browser/game launches remain suspended while the host-app allocator
crash is unresolved; the native evidence does not qualify browser safety.
