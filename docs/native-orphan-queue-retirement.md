# Replaced message-queue retirement trial

Native091 observes recipient registration across the four committed hero kingdom
visits. Native092 adds an opt-in native retirement trial. Both complete through
original Load Game menus in one process each; neither changes the served WASM.

## Registration before retirement

The original manager at global006d8568 has final vtable00682bc4 and688 requested
bytes (696 CRT payload). Its recipient tree has head at+50 and count at+58;
+54 remains a raw word in the older owner trace and is not interpreted as count.
The leaf comes from006d857c. Nodes have24 CRT payload bytes with left, parent,
right, key and queue fields at0,4,8,c,10. A bounded walk checks at most64 nodes,
physical allocations, parent links, unsigned key ranges, cycles, extrema and count.

Native091 has106 complete registration samples matching the original owner
samples. The tree holds exactly one node with recipient1. Its queue value is
replaced on each load. Older observed descriptors remain allocated with one
pending message, but have no value reference anywhere in the complete tree and
are not the manager's default queue. After the four exits there are respectively
0,1,2,3 such orphaned descriptors, plus one current registered descriptor.
Total ordinary4096-byte allocations grow9,10,11,12. The other eight have
unobserved origins and are not admitted for cleanup.

The pinned executable audit checks11 instruction fragments, including original
lookup004a1ec0 and replacement00499655;11 changed-instruction controls refuse.
This observation establishes current tree membership, not arbitrary alias absence.

## Native092 admission and original destruction

`--retire-orphan-queues` requires heap/context/registration observation and is
mutually exclusive with the TILE-release experiment. Its flag is explicitly
unavailable under Emscripten. Cleanup runs after the twentieth complete original
tick, with the scheduler baton, zero hook depth, current world identity and no
pending transition. It retains every tree-registered or default queue.

An orphan must be an actually observed earlier-load allocation, with the exact
live descriptor, map, buffer and iterator layout:56-byte CRT descriptor,8-byte
CRT map, capacity2, count1 and the known4096-byte backing block. Its one pending
message must have40 CRT payload bytes, vtable00682d04, matching recipient and an
allocated nested queue. Unknown or changed layouts are not admitted.

Original00497cf0 drains the message references and owns map/buffer release.
Only after empty iterators, released backing storage and a still-live descriptor
are established does original00645bc0 delete that observed descriptor. No direct
page or map free is substituted. The pinned retirement audit checks13 instruction
fragments and13 changed-instruction controls. The original00499fc0 manager path
supplies the separate descriptor-delete ordering.

Each retirement must preserve all observed tree node words, default queue,
world, clock, hook count and original game state, reduce requested heap bytes
and leave heap_check clear. Original allocation/free hooks reconcile the actual
buffer free. A second original full-game save is retained after each sweep;
it does not replace the selected evolving region checkpoint.

| Visit | Observed queues before sweep | Retained | Retired | Ordinary4096-byte blocks after exit |
| --- | ---: | ---: | ---: | ---: |
| Home |1|1|0|9|
| Remote |2|1|1|9|
| Home return |2|1|1|9|
| Remote return |2|1|1|9|

Three original frees reclaim12,288 observed backing bytes in total. Four post-
cleanup full saves preserve every field compared by the existing saved-kingdom
inspector, both RNG states, clocks, commands and queues, exact raw terrain and
single hero ownership. The independently qualified base report also checks four
initial/return loads,12 complete heap captures,80 ticks and24 root frees.
Actual page events increase to231, including the three retirement frees;
91 owner/registration samples remain after the retired descriptors disappear.

Forty-five contradictory copies of the actual091/092 logs refuse: missing or
changed tree observations/links/counts/lookups, false registration/default
membership, same-load or unadmitted queues, altered message layouts, wrong
original destruction methods, missing releases, changed tree/clock/world/hooks,
missing byte reduction and invalid sweep counters. The real logs remain exact.
These controls qualify the stopped evidence parser, not every dynamic native
refusal path. No extra game is launched for them.

## Resources, limits and next work

The later [twelve-visit native run](native-repeated-region-travel.md) reuses
this exact092 build and qualifies11 retirements with all12 post-cleanup saves.
The results below describe the initial four-visit trial.

Native091 PID40778 exits0 in56,815ms, max sampled RSS184,074,240 bytes.
Native092 PID41593 exits0 in56,774ms, max sampled RSS184,139,776 bytes.
There is no measured speed or RSS reduction claim. Each uses the unchanged
90-second/512MiB runner bounds; both exact executable/source/symbol generations
are preserved using4KiB transfers and registered for later revalidation.
Original settings, selected worlds, publication and receipt remain unchanged.

This qualifies one queue family over four native visits. Other heap groups still
change: home first→return ordinary requested bytes grow112,016; remote
first→return grow218,384. A229,376-byte group still appears once and remains;
it is not shown to grow on every transition and its original lifetime must be
respected. Sustained native memory bounds, arbitrary travel, cooperative message
retirement and browser memory safety are unqualified. The queued message
layout/recipient here is a specific fixture, not all gameplay queues.

Next qualification needs longer repeated native travel with the same complete
saved-state and allocation checks, then broader message/transition coverage.
Do not enable browser or cooperative cleanup from this short proof. Browser
launch suspension remains in force while the app-crash cause is unresolved.

## Evidence and reproduction

- `output/native-page-registration-layout-001-observed.json`
- `output/native-page-registration-001-observed.json`
- `output/native-page-registration-generation-091-preserved.json`
- `output/native-orphan-queue-retirement-layout-001-observed.json`
- `output/native-hero-region-travel-attempt-010.json` and its log
- `output/native-hero-region-heap-004-observed.json`
- `output/native-orphan-queue-retirement-001-observed.json`
- `output/native-orphan-queue-retirement-controls-001-observed.json`
- `output/native-orphan-queue-retirement-generation-092-preserved.json`

For new changes, use the official one-job wrapper with fresh build/run/output
numbers. With the existing qualified publication and selected actual revision2
receipt, add `--capture-heap --capture-page-context --retire-orphan-queues` to
`scripts/run-native-hero-region-travel.py`. Only one native game/build may run
at once. Wait for the actual terminal process result before inspecting:

```sh
node scripts/inspect-native-hero-region-heap.mjs output/native-hero-region-travel-attempt-010.json output/native-hero-region-heap-004-observed.json
node scripts/inspect-native-orphan-queue-retirement.mjs output/native-hero-region-heap-004-observed.json output/native-orphan-queue-retirement-001-observed.json
node scripts/check-native-orphan-queue-retirement-controls.mjs output/native-page-registration-001-observed.json output/native-orphan-queue-retirement-001-observed.json output/native-orphan-queue-retirement-controls-001-observed.json
```

The listed reports already exist; preserve them and use fresh output paths.
Earlier owner-lifetime failures and no-op TILE trials remain separate evidence.
