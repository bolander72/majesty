# Original gameplay state survives save and resume

The transferred NPC now has verified original gameplay/save/reload/gameplay
continuity. Two separate native processes run 240 simulation ticks each, with
an original full save between them. The resumed engine starts at the changed
position and clock, restores scheduling without reinsertion, and produces a
second changed full save. This remains an owned native fixture; cross-region
return and a continuously expanding original world are unfinished.

## Implementation

The opt-in `--capture-evolved` native runner flag requests one `Joint_Evolved.GMP`
at the end of the existing movement observer. The observer removes its delegating
hooks first. The original full-world writer runs only with the scheduler baton,
no in-flight actor/agent observer call, and a uniquely queued actor in a copied
fixture profile. The helper refuses an existing save and retains the original
renderer save lifecycle. Queue snapshots, registry membership, identity counters,
clock, actor position and installed hook count must match across the save.

`--reload-evolved <qualified capture proof>` independently revalidates that
capture, copies the exact updated GMP and existing profile settings, and extracts
bounded expected UNIT/GPL/command writer ranges from the updated save. It uses
the original loader and saved script queues. It does not substitute the original
arrival's actor bytes, rewind coordinates, reserve another identity, or insert
the actor into the queue again. Each extracted writer is at most 2048 bytes;
snapshot inspection/hash reads are at most 4096 bytes.

The reload checker checks the updated world's unit count and three exact original
writer outputs. It rejects conflicting insertion/deletion/old-snapshot modes,
stale paired-transaction provenance, changed capture proofs and changed expected
writer identities. The movement checker observes original commands and AI/context
actions for the next 240 ticks, then removes all delegating hooks. This test
lineage is a diagnostic proof chain, not the storage format for an unlimited
number of production gameplay revisions.

## Evidence

The official `tools/build.py --target smoke --jobs 1` build exited 0. No generated
translation or kit code was edited. The native processes ran serially:

| Stage | Original unit count | Saved clock | NPC fixed position (x, y, z) |
| --- | ---: | ---: | --- |
| Published destination input | 481 | 8650 | Arrival state |
| First evolved save, attempt014 / PID90608 | 488 | 20650 | 3477500, 4292608, 78661 |
| Fresh evolved reload, attempt015 / PID90674 | 488 | 20650 | 3477500, 4292608, 78661 |
| Second evolved save, attempt015 | 487 | 32650 | 3149696, 5279616, 84062 |

Both processes terminated with exit 0. The first save contains 488 native units,
15 script agents and 19 attachments. The second contains 487 units, 15 agents
and 20 attachments: the original world keeps changing during simulation. All
three actor writer records change in both gameplay intervals. Each interval
executes 40 original AI actions; original Path calls total 41 and 34 respectively.
The fresh reload matches the first save's full file hash, all three expected
actor writer records, saved queue data, position and starting clock. The actor
is queued exactly once in the fresh engine.
This does not independently prove every other unit's opaque runtime fields.

Authoritative reports:

- `output/native-npc-evolved-checkpoint-observed.json`: first evolved save.
- `output/native-npc-evolved-second-checkpoint-observed.json`: second save after
  the fresh evolved reload.
- `output/native-npc-evolved-continuity-current-observed.json`: independent chain
  revalidation, separate process/profile requirement and preserved clock/position.
- `output/native-npc-evolved-checkpoint-controls-observed.json`: 16 capture refusals.
- `output/native-npc-evolved-reload-controls-observed.json`: 10 proof/mode/writer refusals.
- `output/native-npc-evolved-reload-motion-controls-observed.json`: 28 movement,
  saved-queue, AI and hook-cleanup refusals.
- `output/native-evolved-storage-regression-tests.log`: 54 focused JS tests pass.
- `output/native-entity-pair-evolved-compatibility-observed.json`: the earlier
  published pair still passes the updated original-engine checks.

## Reproduce

From the parent workspace with the qualified original actor, scheduling and
published-pair evidence present, use fresh attempts and outputs. The first run
also accepts the published export receipt with `--selected-pair <receipt>`.
Run one native process at a time and confirm its terminal result before the next:

```sh
python3 scripts/run-native-joint-reload.py output/native-inflight-move-checkpoint-observed.json output/native-inflight-move-identity-observed.json --attempt 16 --reload-scheduled output/native-npc-schedule-current-observed.json --observe-motion --capture-evolved
node scripts/check-native-npc-evolved.mjs output/native-joint-reload-attempt-016.json output/native-evolved-first-fresh.json
python3 scripts/run-native-joint-reload.py output/native-inflight-move-checkpoint-observed.json output/native-inflight-move-identity-observed.json --attempt 17 --reload-evolved output/native-evolved-first-fresh.json --observe-motion --capture-evolved
node scripts/check-native-npc-evolved.mjs output/native-joint-reload-attempt-017.json output/native-evolved-second-fresh.json
python3 scripts/check-native-npc-evolved-continuity.py output/native-evolved-first-fresh.json output/native-evolved-second-fresh.json --output output/native-evolved-continuity-fresh.json
```

## Remaining integration

The previous immutable entity pair still describes its fixed arrival transaction.
The subsequent [revision store](native-entity-revisions.md) now publishes these
evolved snapshots with one persistent identity and bounded retained slots; its
new namespace still needs original-engine/player integration.
These updated saves are not yet new ownership revisions in that store. Next work
must publish evolved state through versioned transactions without changing the
persistent entity identity, then transfer that evolved state across boundaries
and activate/deactivate and dispose of original regions. General entity references,
heroes/buildings, simultaneous regions and original terrain paging remain open.
Full co-op completion and independent-household internet qualification also remain
open. No browser launch or WASM rebuild was performed. Browser launches stay
suspended while the host-app crash is unresolved; browser resource bounds are
unqualified.
