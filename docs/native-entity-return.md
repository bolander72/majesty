# Evolved NPC return preparation

The selected revision-3 NPC now has a read-only return capsule for its latest
original-engine gameplay state. Departure preflight verifies no known incoming
references to UNIT 510/GPL 79 in the evolved 489-unit/16-agent world, no unsupported
commands in the inspected world, and exactly one scheduling entry. The capsule
remains read-only. A separate opt-in native fixture now restores its UNIT/GPL
state with fresh original IDs, verifies the original writers and removes the
private objects. An additional opt-in stage restores the current commands and
rebuilds the receiving route. Activation and a paired ownership change remain
unfinished.

## Current evidence

`output/native-evolved-return-departure-current-preflight-observed.json` records
typed incoming-reference admission. The inspector's `--evolved` mode recomputes
the original evolved capture and requires its process to be terminal and absent
before scanning. It retains the existing original-source report format and
behaviour; the earlier original-source preflight still recomputes exactly.
The evolved mode uses the bounded stopped-file reader with device/inode/size/
nanosecond mtime guards and expected full hashes, allowing metadata-only ctime
changes. Other opaque references remain unclassified.

`output/native-evolved-return-current-preparation-observed.json` binds the current
revision receipt, capture report and exact original UNIT/GPL/Orders writers.
Their lengths are 375/1428/588 bytes: 2,391 bytes total. Each record is at most
4,096 bytes, each file read is at most 4,096 bytes and one preparation read is in
flight. The retained plan is 8,685 bytes, below its 32 KiB cap. The input worlds
are read in pages; their full terrain or world contents are not retained by this
preparation code. These bounds do not measure the original simulation or browser.

The capsule contains the original, unmodified writer bytes and 23 pending field
edits. Native/script own identities and EA/native associations are symbolic
reservation sites; they are not assigned guessed IDs. Known leader references
reverse the declared forward mapping: UNIT 497/GPL 2 to UNIT 2073/GPL 12. The
existing ownership verifier checks both associations in the selected worlds.
This is explicit fixture correspondence, not general castle/hero identity lookup.

The fixture reverses its original supplied origin transform by adding 4,096 world
units to X. The actor's saved Q11 position (3768320,5697536,74421) becomes
(12156928,5697536,154511) after a four-vertex interpolation on the receiving
256-cell terrain. Its saved physical cells become (371,174), within that world's
512-cell navigation grid. The two mission terrains have not been proven adjacent
parts of one generated world; this is not seam continuity or collision admission.

The kind-2 in-flight Move retains its remaining displacement and receives an
independently sampled destination goal height. The kind-4 source route has six
waypoints, cursor four and capacity 128. It is explicitly marked for disposal and
an original destination Path rebuild; none of its waypoints are offered for
reuse. Applying this policy remains runtime work. The GPL `destination` pair
moves from (1677,2170) to (5773,2170); its zero `Coord_Home` sentinel stays zero.
Unknown nonzero home/pair semantics are refused rather than translated blindly.

Ten non-running script contexts preserve symbolic functions and raw state. The
active context's saved age is 100 ms. Active context and command timestamps defer
rebasing until the original destination clock is captured at insertion. Paused
and inactive context stamps remain unchanged. The original order storage request
profile is retained for later restoration; it is not a measurement of total
engine allocations or a claim that the regenerated path has the same size.

## Verification and next runtime step

The capsule verifier regenerates the plan from the selected originals, compares
each stored writer and the bounded stored plan, and checks current source code
hashes. Fourteen isolated copied-capsule controls refuse fabricated completion/
reservation, changed own IDs, manifest, bindings, position, ground, clocks, route
reuse, each writer, stored plan and missing verifier provenance without changing
the selected ownership manifest. Six evolved departure-provenance controls and
37 prior source-reload controls pass. Thirty-nine focused coordinate, terrain,
GPL, command reference/clock/navigation/allocation tests also pass.

Reproduce from the parent workspace, using the receipt from
`output/native-entity-revision-latest-export-observed.json`:

```sh
node scripts/inspect-native-npc-departure.mjs output/native-npc-revision-resumed-checkpoint-observed.json output/<fresh-preflight>.json --evolved
node scripts/prepare-native-entity-return.mjs <current-revision-receipt> output/native-npc-revision-resumed-checkpoint-observed.json <fresh-output-basename>
node scripts/prepare-native-entity-return.mjs --verify output/<fresh-output-basename>.json
```

The preparation itself ran without a native build/process or browser launch.
The later native consumer is documented below. Browser launch suspension remains
active.

## Original-engine private return boundary

`output/native-private-return-observed.json` qualifies original-source attempt005,
an isolated copied profile. Two serial official smoke builds used `--jobs 1`:
the first built the consumer; the second corrected the original writer comparison
to retain its actual fresh native ID. No other native process ran concurrently.
Attempt005 exited0 and the native PID is absent. The served WASM was not rebuilt
or launched.

The runner accepts `--return-capsule` only with a current selected revision and a
qualified departed-source proof. The packet exporter re-verifies the capsule and
binds it to this exact receipt and receiving-world hash. NRT1 contains an eleven
DWORD header, the three untouched original records and23 six-DWORD edit rows.
Its observed size is2,987 bytes, below the8,192-byte native parser cap; records
remain bounded by4,096 bytes and edits by64. These are fixture packet limits,
not overall engine resource measurements.

The original full load retains1959 source units; the pre-stage original save
preserves2111 existing records and both queues. The native counter is2141 and
the next script reservation is72. Original GPL constructor00625e70 consumes72;
the staged complete UNIT reader allocates privately with ID0; original factory
publication005a12e0 consumes native ID2142. These fresh aliases are beyond the
retired2101/37. No counter is rewound. Original GPL native-association methods and
GetUnit establish reciprocal UNIT/EA/GPL links, with declared leader bindings
restored to2073/12.

The receiving runtime clock is4000. The active context stamp becomes3900,
preserving its observed100ms age. All16 UNIT/GPL edits are applied; the seven
command edits stay pending. The original375-byte UNIT and1428-byte GPL writers
exactly match an independent reconstruction from the selected capsule and actual
native IDs/clock. The original GPL reader resolves its symbolic script state.
Actor position/physical-cell values receive the prepared terrain transform;
physical insertion, collision admission and rendering are not performed here.

Cleanup uses original registry retirement, agent-tree erasure and destructors.
Both new identities disappear, registry groups and queue snapshots match their
pre-stage values, script membership returns to70, hooks/clock and the checked
leader object are preserved. Counters remain consumed. This verifies those
specific cleanup observations; total heap recovery and all unrelated records
after cleanup have not been independently measured. The2111-record full-save
comparison is before the private stage.

The stopped-file verifier independently re-validates capsule and departed-world
evidence, requires a terminal absent native PID, checks current native/exporter
source hashes and packet rows, derives fresh aliases from observed counters and
compares all four input/output record files byte for byte. Current native source
provenance is required; this report is not a portable historical replay archive.
Seventeen copied-profile controls first accept each unchanged copy, then reject
changed terminal state, provenance, capsule/receipt/plan, IDs, clock age, ground,
leader binding, packet edit, cleanup or activation evidence. They do not launch
the game or alter the selected ownership manifest. The39 focused component tests
also pass.

Reproduce from the parent workspace, choosing an unused attempt and output:

```sh
python3 scripts/run-native-original-source-departure.py output/native-original-source-departure-preflight.json --attempt <unused-number> --reload-after output/native-original-source-departure-observed.json --selected-revision <current-revision-receipt> --return-capsule output/native-evolved-return-current-preparation-observed.json
node scripts/check-native-private-return.mjs output/native-original-source-departure-attempt-<number>.json output/<fresh-private-return-report>.json
node scripts/check-native-private-return-controls.mjs output/native-original-source-departure-attempt-<number>.json output/<fresh-controls-report>.json
```

The later command stage below restores the current commands with original readers,
rebases the in-flight Move and discards/rebuilds its receiving Path. Next, qualify
physical/render insertion and AI scheduling. A real handoff must preserve other receiving-world records,
remove the outgoing NPC through original methods, save both worlds and publish
one ownership change. Repeated journeys, general heroes/buildings, simultaneous
region activation/disposal, full co-op completion, independent-household internet
play and whole-browser resource limits remain unqualified.

## Original current command restoration and receiving route

`output/native-private-return-commands-current-observed.json` qualifies native
original-source attempt010. The optional `--restore-return-commands` runner flag
requires a verified return capsule/current revision and enables only the owned
native fixture. Its original order reader consumes the latest588-byte command
record: Move and Path in bank0, Follow in bank1, bank2 empty. Bounded native
parsing derives18 typed reservations, totaling1445 requested bytes, with an
actual128-point/1024-byte Path buffer. It preserves the current canonical empty
names rather than replaying an older620-byte fixture.

The seven pending command edits are applied: known target aliases and unsigned
dispatch ages receive the receiving binding/clock. The original Move coordinate
setter receives Q11 goal(12156928,5701632,154491); receiving ground height comes
from the original terrain sampler and independently matches the capsule. Its
remaining horizontal displacement is preserved. The source Path's six points and cursor4
are discarded. The route starts at the in-flight Move's receiving destination
cell(371,174), which matches the actor's saved physical cell, rather than its
fractional current-position floor.

The requested Path goal(360,135) is occupied in the receiving world. The original
goal resolver005e9b00 chooses(360,137). A cookie-scoped read-only observer delegates
the real method, verifies its original caller005eafa6 and exact actor/factory/
requested-goal arguments, then records its output. The fixture does not invent a
different destination. `output/native-return-goal-instruction-observed.json` pins
that ABI and distinguishes original populated-bank draining from bank deletion.
The original Path primitive generates38 adjacent waypoints ending at the observed
resolved cell. Every point passes original actor-footprint collision checks with
the Path collision mask. The capped512 search expansions use139 nodes of the
original8192-node pool. Output/redzones, actor/grid state, scratch/list clearing,
fixture-owned cache teardown, pool count and temporary heap recovery are checked.
These observations do not bound every goal-search allocation or whole-engine
resources.

The844-byte original command writer exactly matches an independent reconstruction
of the source record with the prepared edits, Move goal and newly observed route.
All other bytes are preserved. UNIT/GPL writers still match their independently
applied records. The validated command journal transfers ownership to the stopped
UNIT. Cleanup explicitly calls original populated-bank drain005e4ff0 before
UNIT bank clear005b2de0 and scalar vehicle deletion. All18 recorded guest extents
are absent afterward; registry/queues, leader, clock and hooks are preserved,
membership returns to70 and fresh counters remain consumed. This proves those
extents' cleanup; total post-stage heap or all unrelated full-save bytes are not
independently measured yet.

Debugging evidence is preserved. Attempts006/007 terminate with native exit6:
the earlier endpoint preflight refused the occupied goal before original goal
resolution. Attempt008 restores/writes the route but records missing command
cleanup; attempt009 shows that bank deletion without prior draining also leaves
command extents owned. Both smoke runs exit0 while fixture results fail, so neither
is qualified. Attempt010 executes both original drain and deletion and exits0 with
all fixture gates passing. Five official jobs1 builds and five native processes
ran serially for these changes/failures, with no browser launch or WASM rebuild.
The first audit diagnostic also used the wrong register in its expected virtual
call; the corrected pinned instructions and fresh audit report are preserved.

The stopped-file verifier rechecks native absence/source provenance, capsule,
packet, receiving world and every writer. It derives route endpoints, adjacency,
capacity, actor/Move cell alignment, preserved clocks, original resolver evidence,
collision/cache cleanup and all18 extents from the actual output. Twenty-six
copied-profile controls each accept an unchanged copy first, then reject corrupted
evidence. New cases include a changed command mode, missing resolver observation,
occupied endpoint substitution, missing waypoint qualification, retained storage,
wrong Move destination/clock/Follow target and source-route reuse. The selected
ownership manifest remains unchanged. Thirty-nine focused component tests pass.

Add `--restore-return-commands` to the native runner example above, then use the
same `check-native-private-return.mjs` and controls checker with fresh outputs.
The current commands are restored on an inactive private object; execution of its
in-flight links, physical/render insertion and original AI scheduling remain
unqualified. The source owner510/79 has not been removed, no original returned
world has been saved/reloaded and no ownership revision has changed. Genuine
repeated crossings, native region residency/disposal, complete co-op and WAN
qualification and whole-browser resources remain unfinished.

## Original returned activation and current full saves

`--activate-return` requires `--restore-return-commands` and the current verified
return capsule/selected revision. This mode retains the actor under original
engine ownership rather than running the private cleanup trial. Original spatial
insertion005ad3e0, family/render finalizer005a2370 and second finalizer005a2420
register the declared six-cell footprint and one drawing node. Other drawing
nodes remain unchanged. Original script queue insertion00633fd0 adds exactly one
agent without changing the other queue nodes. Fresh IDs are2142/GPL72; original
counters advance once and the loaded clock remains4000 during insertion.

The original full writer produces `Joint_Return_Ready.GMP` before simulation
resumes. The independent stopped-file check compares all2111 surviving UNIT/GPL/
attachment records and both saved queues with the pre-stage receiving save;
only the new actor's375-byte UNIT,1428-byte GPL and844-byte Orders are added.
The full-save actor records exactly match the separate original active writers.
Counts are1960 units,71 agents and83 attachments.

Attempt011 exits0 and activates the actor, but the pinned presentation clock
finishes the timed smoke script before240 original ticks. It only logs samples
through tick16 and is not qualified for complete motion or evolved saving.
The runner now uses the same advancing host clock as the existing natural-motion
runner when activation is requested. This change does not edit the original
simulation clock, which advances50ms per original tick.

Attempt012 exits0 after240 observed ticks. Its six delegating observer hooks
record482 original command dispatches/returns,192 leaf calls/returns and37 Path
calls; physical membership, drawing and native/script links stay valid. The NPC
moves from Q11(12156928,5697536), physical cell371,174, to
(11796480,4497451), cell360,137. Original AI runs204 agent calls and2040 context
calls, with40 executed actions. All observer hooks are removed at completion.

The original `Joint_Evolved.GMP` save records clock16000 and the final sampled
position, all three changed actor writer ranges and exactly one queued agent.
Other original simulation activity changes the full world to1961 units,73 GPL
agents and87 attachments; these totals are observations, not a stable-world
assumption. The save preserves observed registry/queues/counters/position/clock
and hook count around the original writer.

Example, using a fresh unused attempt/output name:

```sh
python3 scripts/run-native-original-source-departure.py \
  output/native-original-source-departure-preflight.json --attempt 12 \
  --reload-after output/native-original-source-departure-observed.json \
  --selected-revision upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-AaLUBT/Selected_Entity_Revision.json \
  --return-capsule output/native-evolved-return-current-preparation-observed.json \
  --restore-return-commands --activate-return
node scripts/check-native-return-active.mjs \
  output/native-original-source-departure-attempt-012.json output/FRESH-report.json
node scripts/check-native-return-active-controls.mjs \
  output/native-original-source-departure-attempt-012.json output/FRESH-controls.json
```

The activation checker shares the authenticated capsule/packet/original-writer
checks with the private verifier. An explicit API flag permits only the
pre-activation departed-world snapshot check. The ordinary departed/private CLIs
continue to reject active-return mode; the private checker still requires native
destruction and all18 extents absent. Active commands remain owned by the original
engine and do not claim that cleanup proof. The active checker independently
validates every motion sample, balanced callbacks, original AI actions, full-save
identity/position/commands/queue and initial preservation of other saved records.

Thirty-two offline refusal cases pass, including mode/provenance/packet errors,
counter mismatch, failed insertion, queue changes, wrong restored clocks/Move
goals, missing original goal resolution, incomplete motion, missing Path/AI
execution, unbalanced callbacks, footprint loss, retained observer hooks, altered
live state around saving, wrong active writers, altered initial/evolved records
and a rolled-back world. The30 mutation cases each accept an unchanged copied
profile before applying the mutation; two additional checks reject use of the
private/departed-only APIs for an activated return. The same disposable profile
is restored between cases. All eight selected-store files remain unchanged.
Thirty-nine focused coordinate/terrain/GPL/order component tests pass.

At this activation checkpoint, fresh returned-world reload had not run. The outgoing510/GPL79 is still in its
selected region, and the persistent store still selects revision3/owner1. This is
an isolated activation fixture, not a published two-region ownership handoff or
a player-accessible open world. Next steps are fresh full-state reload, original
outgoing removal and paired publication, then repeated journeys and real bounded
region residency/disposal. Full co-op, WAN qualification and whole-browser
resource/crash checks remain open. Browser launches stay suspended; the served
WASM has not changed.

## Fresh returned-world reload and further evolution

The motion observer now reads the original collision grid at factory+0x88 and
checks equal width/height of256 or512. It no longer selects the grid size from
the activation flag, which is absent during a fresh reload. Scheduling still
comes from original saved-queue restoration. One official smoke build with jobs1
completed for this change. A new activation producer, original-source attempt013,
passes the same240-tick and original full-save checks and all32 offline controls;
its evolved world contains1961 units/73 agents/86 attachments. The preceding
attempt012 world with87 attachments is preserved as historical evidence. Original
simulation totals can vary outside the observed NPC; the checker reads actual
membership rather than assuming these totals remain constant.

`run-native-return-reload.py` independently recomputes the activation proof,
requires its terminal producer and copies the original evolved GMP plus profile
settings into a fresh owned profile. The writer exporter accepts `--returned`
only for a qualified returned full save and the returned-reload profile namespace.
It reads bounded UNIT/GPL/Orders ranges directly from the copied world, checks
their hashes and supplies exact expected original writer bytes. The runner uses
the same native executable and current source hashes, advancing host time, the
original full loader and saved-queue observation with no insertion/removal flags.

Returned reload attempt001 exits0 in a separate process/profile. Original loading
visits all1961 input units. The2142/GPL72 backlinks and the saved UNIT/GPL/Orders
records match exactly. Original queue inspection finds exactly one scheduled
agent with queue-mutated0. The observer starts at saved clock16000 and exact Q11
position(11796480,4497451). No coordinate, age, path or identity transformation is
applied during reload.

During240 further original ticks, the NPC makes483 command dispatches/returns,
180 leaf calls/returns and31 Path calls, with valid physical footprint/drawing/
links throughout. Original AI makes212 agent calls and2120 context calls with40
executed actions. All six delegating observer hooks are removed. The original
full writer produces another evolved GMP at clock28000, final position
(10789593,5397794), physical cell329,165. Saving preserves the live state. Saved
UNIT/GPL/Orders remain linked with one queued agent; the actual evolved Orders
record is1564 bytes. Actual world totals become1962 units/74 agents/87 attachments.

```sh
python3 scripts/run-native-return-reload.py \
  output/native-return-active-reload-producer-observed.json --attempt 1
node scripts/check-native-return-reload.mjs \
  output/native-return-reload-attempt-001.json output/FRESH-reload-proof.json
node scripts/check-native-return-reload-controls.mjs \
  output/native-return-reload-attempt-001.json output/FRESH-reload-controls.json
```

Attempt/output paths are exclusive; use unused names for new runs. The reload
checker recomputes the qualified producer, checks separate stopped process/profile
identities, current source/executable bindings, all copied input hashes and exact
writer records. It independently inspects saved position/identity/order/queue
ranges and validates every original motion/AI sample and the second full save.
Whole input state is hash-bound to the producer. The three reloaded NPC records
are compared to original writers; this does not assert every unrelated entity's
post-load runtime field has been independently compared before simulation.

Thirty-four fresh-reload refusal controls pass. Each unchanged disposable copy
qualifies before its mutation. Cases cover process/mode/identity/source/executable
bindings; a forged producer record with a refreshed local proof digest; missing
original loading, changed/reinserted scheduling, wrong original writers; stale
expected records and loaded positions with refreshed local input digests; saved
clock discontinuity; missing motion/Path/AI execution; altered live state around
saving; bad evolved records and save rollback. All eight selected-store files
remain unchanged. The refactored shared motion checker also passes the32
activation controls again. Thirty-nine focused component tests pass.

Fresh saved-state reload and natural gameplay continuation are now qualified for
this NPC. The selected store is still revision3/owner1 with outgoing510/GPL79;
there is no paired return publication yet. Next are original outgoing removal,
paired ownership publication and both-side loading, then repeated journeys and
bounded original region residency/disposal. Full co-op/internet qualification and
whole-browser resource/crash checks remain unfinished. Browser launches stay
suspended and the served WASM remains unchanged.

## Selected outgoing removal and paired return admission

The original joint-reload runner now accepts evolved departure as a separate
pinned mode, requiring the current selected receipt and a recomputed typed
reference preflight. It selects the latest evolved world before checking the
preflight digest. Motion, reinsertion and removal flags remain exclusive. Original
writer expectations come from the actual evolved save. The original loader and
departure checks derive current membership from the qualified evolved proof;
legacy fixture counts are unchanged outside this explicit mode.

Native attempt017 loads selected revision3's510/GPL79, all489 units and the exact
current UNIT/GPL/Orders. Its existing queue is restored without reinsertion.
Original unit removal005a21b0 and script deferred drain00633370 retire the actor.
Native registry, drawing and physical references are absent, other queue/registry
nodes and counters/hooks remain preserved. Membership/queue count changes16→15;
deferred work drains to0. Observed guest heap bytes fall24308592→24307568, blocks
1646→1645; original CRT live count falls137715→137618. These are this removal's
allocator observations, not a whole-browser memory bound.

Original before/after full saves change489→488 units,16→15 agents and25→24
attachments. Only UNIT510, GPL79 and ORDR510 are removed; all527 other record
hashes and saved queues are unchanged. The known typed preflight has no incoming
references or unsupported inspected order kinds; complete opaque closure remains
unqualified. Twenty-four removal refusal controls pass.

Fresh native attempt018 loads the original departed snapshot in a separate owned
profile.510/GPL79 stay absent. Original counters/registry/queues are unchanged;
the original round-trip full save preserves all527 surviving entity records and
saved queues. Thirty-seven departed reload refusal controls pass. An initial
control-run diagnostic assumed the old ten-agent fixture count; it is preserved,
and the corrected controls derive the count from the qualified removal proof.

The read-only handoff preparer independently rechecks original loading/removal,
fresh departed loading and the returned NPC's fresh gameplay/save. Both sides
must bind the exact same selected revision3, persistent identity, original
executable and native source hashes. Four distinct stopped process/profile stages
are required. Candidate snapshots contain only returned2142/GPL72 as the owner;
outgoing510/GPL79 are absent. The known leader bindings remain2073/GPL12 on side0
and497/GPL2 on side1. Incoming aliases exceed retired2101/GPL37. The proposed
revision4 keeps the identity, flips owner1→0 and uses the returned clock28000 save
plus the freshly reloaded departed world. Twenty-seven admission mutations each
accept an unchanged copied evidence chain before mutation; all eight selected
store files remain unchanged.

Read-only checker source hashes may change as validators improve. Revalidation
compares every result, fixture, evidence digest and native source hash, allowing
only `scripts/` checker-code provenance to differ. Original values remain in the
recorded report. Six direct controls accept a checker change but reject changed
actor/native/evidence/qualification fields;34 fresh returned reload controls pass
again. This does not accept changed native code, capsule records or world bytes.

Completed native return evidence now reconstructs historical receipts. The
version1 generator measured before history support has source SHA
`fd79d3fd2cdce38a09ed81e274c25b1bd06f1a09f265bca1ed7e46026c5dc39c`;
only that known version or current generator code is accepted for historical
reconstruction, and every stored plan/record is independently regenerated and
compared. Other17 dependency hashes remain exact. Unknown generator provenance
is rejected. Fresh preparation/packet export still require the current receipt
and current code, so historical evidence does not authorize a stale launch.

The canonical ownership store has not been changed by these admission tests.
Publication must commit both worlds using the exact previous manifest, reject
different stale operations, retry the identical operation and preserve historical
receipts without accepting them for fresh launches. Fresh loading of both sides
of a committed revision, repeated journeys, actual region residency/disposal,
full co-op/WAN and whole-browser resources remain unfinished. Browser launches
stay suspended and served WASM is unchanged.

## Committed original return revision

The publisher reconstructs stopped historical native evidence and commits using
the exact prior manifest. Ten disposable-store request controls reject wrong
ownership, reused incoming/changed outgoing aliases, missing leader bindings,
wrong prior manifest/kind, forged world digests and stale/different operations.
A wrong second-world digest can leave changed first-world staging in the inactive
slot. The selected revision/worlds remain intact; only inactive-slot files may
change. The initial overly strict all-files-unchanged diagnostic is preserved;
the corrected controls validate selection safety and restore the disposable
baseline between cases. The canonical store is untouched during these tests.

Four disposable callback-exception trials stop after-source, after-state,
before-publish and after-publish. Revision3 remains selected before publication,
revision4 after publication. Exact retries succeed; after-publish retry is
idempotent. Actual process crash, power-loss and browser recovery are not tested.

The actual canonical store is now revision4. Persistent identity remains
`f8e725d524620a21b0231a4c456c24c293320168da2f1b6a7770f58ba223e7d8`;
owner0 is region0_0, UNIT2142/GPL72. Outgoing510/GPL79 are absent on side1.
Both worlds pass typed ownership/reference checks before staging and after
readback; both hashes change and receiving aliases exceed retired2101/GPL37.
The reopened store selects the same manifest, exact worlds/aliases and one owner.
Repeated commit is idempotent. Eight files remain, with4096-byte maximum serial
reads/writes. These are storage bounds, not original-engine/browser memory bounds.

The returned source world is1305380 bytes, SHA
`cb075fafa121bf9d6759ba4d38d9ba6e0163b3f425ef43bc4fe80106de4f3bd2`;
the departed destination is330950 bytes, SHA
`1571a506d37c32104fa9558a3ed5facf78e5f6fba3a69b7f6b45ba55d69c1639`.
The old revision3 receipt is rejected for current launches and remains valid
under explicit historical verification. A fresh revision4 receipt is exported to
the owned `actor-arrival-fixture-entity-revision-export-B8Pnch` directory.

Fresh native loading of both sides from this committed receipt is still pending.
Repeated crossings, generated adjacent terrains, genuine bounded region
residency/disposal, full co-op/WAN and browser crash/resource checks remain open.
Native017/018 ran serially and are stopped. No native rebuild/browser launch;
served WASM is unchanged and the goal remains active.
