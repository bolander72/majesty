# Original NPC removal before a region handoff

Native reload/departure attempt 008 qualifies removal of the relocated Scions
fixture NPC, UNIT 510 / GPL 79, through the original complete unit-removal
lifecycle. It preserves all 501 other saved records, all other active script
queue members and both identity counters. The original Brashnard actor's
departure, fresh loading of the departed snapshot, full script scheduling and a
committed two-world ownership handoff remain open. The full cooperative and
expanding-world goal stays active.

## Known incoming references

Read-only inspection of the corrected producer 027 full checkpoint exhausts
481 UNITs, 11 GPL agents and all 11 supported command attachments. It finds no
external incoming references to the fixture actor in typed GPL values, parent
fields, native/script links, containers or supported command targets. Its two
script self-references belong to the actor being removed. Reads are capped at
4096 bytes. Opaque fields and general reference closure remain unqualified; this
fixture is restricted to the copied, parentless NPC and its exact source hash.

## Original lifecycle and observed state

The opt-in --depart-npc mode runs separately from motion observation in a new
owned copied profile. It first performs the existing full original reload and
compares all three initial actor, script and command writer outputs. A guarded
original call to 005a21b0 removes the native actor, EA association, orders,
containers, physical/drawing registration and factory memberships. Original
00633370 drains the single owned deferred script destruction. The existing
departure instruction audit pins eight ranges and 21 anchors; the script queue
audit additionally pins the original queue removal and sentinel getter.

Before removal, the fixture requires a parentless actor, exact native/script
backlinks, an empty deferred list, a valid collision footprint and exactly one
drawing entry. Factory group snapshots omit only this actor. Queue snapshots
retain every other node, agent pointer and agent ID. After removal, the original
lookups return no actor or script, all remaining group/queue snapshots match,
every active physical bucket is free of this actor pointer, and the remaining
drawing list matches. Factory and script identity counters are preserved.

The engine's original named writer and renderer save/restore lifecycle produce
two immutable full-world files in the owned profile:

| Records | Before | After | Exact unchanged records |
| --- | --- | --- | --- |
| UNIT | 481 | 480 | 480 |
| GPL | 11 | 10 | 10 |
| Attachments | 12 | 11 | 11 |

Only UNIT 510, GPL 79 and ORDR 510 are removed. Complete unrelated records are
byte-identical. This verifies one copied world's original removal and saved
departure state, ahead of joining it to an independently saved destination.

## Queue and allocator findings

Attempts 005 and 006 remain unqualified even though their native processes
terminated with exit 0. The initial predicate incorrectly assumed this newly
composed script was in an active queue and that logical reclamation would shrink
the backing guest heap. Diagnostic 006 showed the agent index changing from
11 to 10 while the ten other queued scripts remained. Small-block allocator live
allocations fell from 136315 to 136218, reclaiming 97 blocks. Backing heap usage
remained 24296224 bytes / 1641 blocks.

The fixture now derives the expected queue change from actual pointer membership
and compares all remaining members. It requires lower small-block occupancy and
no backing-heap growth. It does not claim a whole-browser memory bound.
Attempt 007 also remains unqualified: the first queue reader used the wrong
start-pointer layout and refused the operation before departure. Original
00633fc0 reads the sentinel at list +4 and then its next node; original 006332c0
stops at the sentinel itself. The corrected reader is pinned to those instructions.
Attempt 008 passes all removal, membership, allocator and full-checkpoint checks.

The composed actor's script is absent from both active queues. Earlier movement
qualification proves native command execution, including Path, but does not prove
normal GPL AI/context scheduling. The transfer path must restore that scheduling
through original routines before claiming a fully resumed character.

## Evidence and reproduction

- output/native-npc-departure-preflight.json: known typed incoming references.
- output/native-npc-departure-instruction-audit.json: original removal lifecycle.
- output/native-npc-queues-sentinel-instruction-audit.json: ten original queue
  instruction anchors, complete removal function and pure begin getter.
- output/native-npc-departure-reload-observed.json: initial full reload and three
  exact original writer records in attempt 008.
- output/native-npc-departure-current-observed.json: original removal, logical resource
  reclamation and independent full-world before/after record comparison.
- output/native-npc-departure-controls-current.json: 20 offline refusals,
  including missing removal evidence, stale memberships, counter/allocator/queue
  failures and an unrelated UNIT changed only in an owned copied snapshot.
- output/native-npc-departure-diagnostic-observed.json: unqualified attempt 006
  differences, retained separately from the positive result.
- output/native-npc-departure-*-build.log: four official jobs-one smoke builds,
  each justified by a changed predicate or unresolved failure.

```sh
node scripts/inspect-native-npc-departure.mjs \
  output/native-inflight-move-checkpoint-observed.json output/<fresh-preflight>.json
python3 scripts/run-native-joint-reload.py \
  output/native-inflight-move-checkpoint-observed.json \
  output/native-inflight-move-identity-observed.json \
  --attempt <fresh-number> --depart-npc output/<fresh-preflight>.json
python3 scripts/check-native-joint-reload.py \
  output/native-joint-reload-attempt-008.json --output output/<fresh-reload-proof>.json
node scripts/check-native-npc-departure.mjs \
  output/<fresh-reload-proof>.json output/<fresh-departure-proof>.json
node scripts/check-native-npc-departure-controls.mjs \
  output/<fresh-reload-proof>.json output/<fresh-controls>.json
```

The diagnostic checker mode always emits qualified:false. Native exit 0 alone
does not establish departure success. Preserve all prior attempts and player
profiles, keep at most one heavy native/build process live, and leave the served
WASM unchanged. Browser launches remain suspended during the unresolved host-app
crash investigation. Next verify the departed world's fresh original reload,
restore natural script scheduling, then commit both region snapshots with a
durable ownership/reference ledger and test repeated crossings.

The [saved scheduling fixture](native-npc-scheduling.md) subsequently qualifies
original queue insertion and AI after a fresh full reload. Its attempt 011 removes
the scheduled NPC with one owned queue entry, preserves all 501 other entity
records and remaining saved/runtime queues, and reclaims 98 allocations. Fresh
departure reload and committed two-world ownership handoff remain open.

The [departed-world reload fixture](native-npc-departed-reload.md) subsequently
qualifies a fresh original load of attempt 011's after snapshot. All 501 surviving
entity records and saved queues survive a new original full save, while both
removed IDs remain absent. Committed two-world ownership handoff remains open.
