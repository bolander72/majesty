# Original source NPC removal and reload

The copied original Brashnard world now passes removal and fresh reload for NPC
2101, script agent 37. Previous fixtures removed a relocated copy in Scions; this
continuation removes the actual source actor used to prepare that transfer. All
2,111 other source entity records survive removal and a fresh original full load
and save. The source and destination snapshots still require one durable ownership
transaction before this becomes region travel.

## Source preflight and native checks

The read-only preflight pins the original 1,298,525-byte Brashnard checkpoint to
SHA-256 31059d44ebf165c25bf1fd91f8ef00d5c5e3733d2d6177ca8e05956026650e13 and binds
it to the prior qualified native source observation. It derives agent37 from the
original UNIT/EA/GPL link rather than assuming the destination's reserved identity.
The world contains 1,960 units and 71 agents. Known typed native parents, script
references, EA links, containers and inspected order targets have no incoming
references to this actor. Its two self script references and one saved scheduling
entry are present; no unsupported inspected order kinds were encountered.

This remains partial reference coverage: opaque native/script state is not proven
free of references. It authorizes this copied diagnostic fixture, not arbitrary
production hero migration. No personal profile or original checkpoint is changed.

The source physical grid is 512 by 512, while the destination fixture uses 256
by 256. The native membership and complete post-removal bucket scans now support
only those two bounded extents. Source mode is restricted to IDs2101/37; existing
destination fixtures keep the 256-cell default. Both use the same original
complete removal and deferred script drain, with registry, queues, rendering,
physical memberships, identity counters and allocator checks.

Original-source attempt001 freshly loads all1,960 units and reproduces the exact
original UNIT, GPL and populated command writers for the selected actor. It removes
exactly UNIT2101, GPL37 and ORDR2101. Units become1,959, agents70 and attachments82;
all2,111 other entity records remain byte-identical. The owned queue entry clears,
all other queue entries and the saved selector are preserved, and live CRT count
falls141,353 to141,255 without backing-heap growth. Twenty-four offline removal
controls reject stale memberships, missing resource evidence, modified entities
and changed saved queues.

Attempt002 freshly loads that exact departed source snapshot in another profile
and process, with no second removal or actor activation. Original lookups keep both
removed IDs absent. The loader visits1,959 units, with70 script entries and queued
agents. A new original full save preserves all2,111 surviving records and both
queues/selector. Native/script counters2141/72 remain above the removed identities
and unchanged during that write. Thirty-seven offline reload controls reject
resurrection, damaged survivors, changed queues, counter floors, incorrect modes
and incomplete native evidence.

Reads in the file inspectors are capped at4096 bytes. Fresh reload metadata is
capped to this world's1,959 units,70 agents,82 attachments and70 queued IDs. These
native results do not establish browser memory bounds, rendered pixels, general
heroes, repeated crossings or a shared co-op transfer.

## Evidence and reproduction

- output/native-original-source-departure-preflight.json: pinned typed source
  reference and scheduling preflight.
- output/native-original-source-initial-reload-observed.json: exact original
  source load, backlinks and three writer files, attempt001.
- output/native-original-source-departure-observed.json: original source removal,
  full before/after snapshots,2,111 unchanged records and98 reclaimed allocations.
- output/native-original-source-departed-reload-observed.json: attempt002, removed
  IDs absent and2,111 surviving records/queues preserved after a new full save.
- output/native-original-source-departure-controls-observed.json:24 offline refusal cases.
- output/native-original-source-departed-reload-controls-observed.json:37 refusals.
- output/native-original-source-departed-backcompat-observed.json: prior destination
  departed-world reload still qualifies its501 surviving records.
- output/native-original-source-departure-build.log: official jobs-one smoke build,
  exit0; both subsequent native processes also exit0.
- output/native-original-source-focused-tests.log: focused checkpoint/coordinate tests.

Use fresh attempts and output names:

```sh
node scripts/inspect-native-npc-departure.mjs \
  output/native-actor-cross-source-observed.json output/<new-preflight>.json \
  --original-source
python3 scripts/run-native-original-source-departure.py \
  output/<new-preflight>.json --attempt <fresh-number>
node scripts/check-native-original-source-reload.mjs \
  output/<new-manifest>.json output/<new-initial-reload-proof>.json
node scripts/check-native-npc-departure.mjs \
  output/<new-initial-reload-proof>.json output/<new-departure-proof>.json
python3 scripts/run-native-original-source-departure.py \
  output/<new-preflight>.json --attempt <another-fresh-number> \
  --reload-after output/<new-departure-proof>.json
node scripts/check-native-npc-departed-reload.mjs \
  output/<new-reload-manifest>.json output/<new-departed-reload-proof>.json
```

The [destination scheduling fixture](native-npc-scheduling.md) independently
qualifies arrival as UNIT510/GPL79, saved AI scheduling and240 native movement/AI
ticks. Original source removal and destination arrival now have independently
qualified persisted states. Next bind their world-local aliases through durable
entity/reference mappings and publish the two complete snapshots atomically,
including interruption recovery and retries, before repeated region crossings.
The existing paired store and browser prototype alone do not prove that handoff.

The full goal remains active: co-op outcomes/full matches, independent internet
testing, continuous original-engine regions and browser resource bounds remain
unfinished. Browser launches stay suspended during the unresolved host-app crash
investigation; served WASM is unchanged. Only one heavy build/native process runs
at a time, and all runs in this continuation have finished.
