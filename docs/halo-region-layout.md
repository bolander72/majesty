# Overlapping native maps for future hero crossings

Fresh `halo-v1` regions keep the original 128-by-128 terrain and 256-by-256
navigation grid. Each map contains a 124-cell ownership core plus two terrain
cells on each side. Adjacent maps therefore overlap by four cells. Ownership
changes at the inner edge, where a hero's footprint can fit both physical maps.
Existing v1 kingdoms retain their original origins; a region key alone never
establishes this new layout.

`web/world/halo-region-layout.mjs` maps an original accepted movement to the
neighbor's coordinates without rounding its Q11 position. It accepts one
cardinal crossing, requires the prior position to belong to the selected core,
and refuses physical boundary/corner ambiguity. It retains only scalar poses
and geometry. This planner does not yet observe live movement or transfer an
actor. Six new layout tests cover four directions, fractional return trips,
all shared vertices and invalid inputs. With existing coordinates, native
height encoding and ground interpolation, all 27 focused tests pass.

## Original native generation and saves

Native223 generates two fresh maps in separate isolated processes through the
existing original Beginner preset. The connected terrain policy now protects
all five vertex columns/rows in each shared strip, including original
foundation edits after placement. Interior shaping remains original behavior.
The original map allocation is unchanged. The cold generation check admits
exactly the two persistent boundary writer registrations; later generations
keep their previous registration check.

The Native223 generation experiment requires a private
`actor-arrival-fixture-halo-world-*` profile, fresh generation, restore disabled
and no session/chapter. Automatic generation
and its named save are native-only. The original whole-world writer saves once
at the first gameplay boundary, clock0. Nothing selects an existing kingdom or
relabels an old checkpoint. No served WASM engine/package is rebuilt.

- Build223 succeeds through the official one-job smoke wrapper. All53 compiled
  inputs are bound in `output/native-world-residency-build-223.json`.
- Attempt010, region0_0: PID67310 exits0 and is absent;25.758s wall time,
  179617792B peak sampled RSS,307176B original save.
- Attempt011, region-1_0: PID67389 exits0 and is absent;25.688s wall time,
  177373184B peak sampled RSS,329212B original save.
- `output/native-halo-region-001-observed.json` and `002-observed.json`
  independently check each complete saved terrain:16641 vertices,2480 protected
  vertices exact against the globally addressed recipe. Heights are compared
  using their original float32 serialization, not raw in-memory Q16 words.
- `output/native-halo-seam-001-observed.json` directly compares all645 heights
  across the west overlap. All25 fractional crossing positions yield identical
  pinned ground interpolation in both saved maps. Overlap reads are45B here;
  ground windows are36B; provenance hashing uses4KiB reads.
- `output/halo-region-layout-003-focused.log`:27 focused checks pass.
  `output/native-halo-region-config-001.log`:six configuration checks pass.

Original settings, canonical profiles and served engine files are unchanged.
Each trial supervises one native process, a512MiB RSS ceiling,4MiB log ceiling
and35s deadline. These short native observations do not establish sustained
browser memory limits.

## Reproducing the terrain checks

From the workspace root, while no other game/build is running:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/run-native-halo-region.py \
  output/native-world-residency-build-223.json \
  output/native-regional-hero-013-effects-inputs.json \
  --attempt <fresh-number> --region=-1_0
node scripts/inspect-native-halo-region.mjs \
  output/native-halo-region-attempt-<number>.json <fresh-proof.json>
node scripts/inspect-native-halo-seam.mjs \
  output/native-halo-region-001-observed.json \
  output/native-halo-region-002-observed.json <fresh-seam-proof.json>
```

Build/controller hashes must still match; archived evidence must not bypass
current provenance checks. The settings preparation above supplies only its
three hash-checked original settings, not historical actor import plans.

## Limits and next gameplay gate

Native224 attempt015 verifies the original camera/minimap and guild UI. Clicking
the minimap reaches a rendered kingdom; hiring through the guild creates one
original Warrior. A subsequent ordinary `frontier-checkpoint` action saves
clock28750, UNIT481/GPL17, with physical parent guild469/GPL7. The reciprocal
script, native membership and physical containment pass the existing registered
hero checks. Its original `Rest_at_guild` delay expires at clock54450; the hero
has not yet left the guild. All2480 protected terrain vertices still match.
`output/native-halo-recruitment-001-observed.json` records the actual save and
identity. The final checker corrected a guessed log string, mistyped class
constant and decoded string termination against the actual log/parser output;
the failed inspection logs remain alongside the passing005 inspection.

This proves recruitment and a post-recruitment player save in the native
prototype. The initial automatic camera still needs adjustment; manual minimap
input reaches the kingdom. The optional clock20000 evolved snapshot predates
recruitment and is not the hero travel source.

Native225 adds an explicit isolated reload admission for this actual save.
`Halo_Restore.layout` binds layout, region, save size/SHA, world, hero and guild
identities, and source producer. Its own SHA is supplied before original
deserialization; the selected checkpoint must match. Old v1 kingdoms cannot be
inferred as halo maps. The owned controller copies the verified frozen224 save
and supplies the new reader's content marker while preserving the original save
bytes and source producer provenance. It does not relabel a legacy v1 save.

Attempt001 PID69308 exits0 and is absent after44.717s, with181338112B peak
sampled RSS. At the first phase3 boundary, the original clock is28750; all2480
shared in-memory vertices pass before the first resumed tick. The existing
scoped UI hooks preserve selection, camera target and exploration, then remove
all three registrations. Original saved RNG setters precede the immutable
`Halo_Region_Reloaded.GMP` save. The Warrior and guild UNIT/GPL records are byte
exact, both saved RNG values agree, and all16641 saved heights are unchanged.

Ordinary simulation then reaches58850. The same Warrior481/GPL17 has physical
parent0 and original `travel_to_exp`, following its unchanged rest expiration
at54450. The normal checkpoint action commits the evolved recovery slot;
registered guild membership and all2480 protected vertices remain valid.
No hero/task guard or pose edit drives this departure. The stopped checker is
`scripts/inspect-native-halo-reload.mjs`; evidence is
`output/native-halo-reload-001-observed.json`. Fifty focused layout, coordinates,
height and registered-home checks and six game configuration tests pass.
The private source generation is preserved in
`output/native-halo-recruitment-generation-224/manifest.json`.

## Accepted original movement and a responsive pause (233)

Native226 introduced the bounded original-tick pose observer. Native230's
sender1/receiver0/creator0 result came from the private test's command timing,
not a demonstrated defect in Majesty's restored command routing. The original
005a4250 replaces the frame batch at the start of each tick. Submitting before
that replacement targeted the previous batch. Native233 submits the same
six-argument0043ef50 UI request immediately before original005a45c0 sends the
current batch, after input processing. No sender, receiver or hero AI is replaced.
The pinned command and pause audits are recorded in native-halo-command-batch-
002-abi.json and native-halo-pause-001-abi.json under output/.

Attempt008 PID74509 exits0 and is absent after32.797s, with147652608B peak
sampled RSS. The actual original sender,004a7810 receiver and004a7600 creator
each run once. Explore flag492/GPL21, model34415241, is saved at world3072,32.
All four scoped hooks are removed and the previous registration count restored.
Warrior481/GPL17 crosses north from0_0 to the logical0_-1 core at clock60650.
The original accepted Q11 pose is7397020,122524,112485; the neighboring local
projection is7397020,8248988,112485. Four occupied source navigation cells
are verified. The projection is geometry only, not destination collision.

The original writer captures Halo_Hero_Crossed.GMP before another simulation
tick. Original00416050 then queues pause phase7. Original paused ticks keep
presentation/input alive while simulation remains at60650. A later script
checkpoint writes Halo_Hero_Held.GMP at the same clock; the hero UNIT/GPL bytes
are exact across the hold. Both original frame dumps complete, and shutdown
has no undeliverable calls. Attempts006/007 preserve earlier failed holds:
skipping the tick did not keep the interface running; neither is qualified.

The original Explore flag's script heroes list and native group100 contain the
Warrior. Hero group101 reciprocally contains both the actual guild and flag.
The home validator now distinguishes that verified reward association from
another home. It checks the exact Explore model/family/player, bounded unique
native and script rosters and their actual actor aliases. An unrelated building,
dead/foreign flag or broken reciprocal roster still refuses. Remote proxy
admission stays strict; this does not provide foreign reward proxies.

scripts/inspect-native-halo-crossing.mjs verifies original reload, actor/home,
saved RNG, all16641 pre-tick heights and2480 protected vertices, original flag
creation, accepted movement, both paused hero records, terminal process and
bounded resources. output/native-halo-crossing-002-observed.json binds the
current verifier sources. All63 focused tests and six game configuration tests
pass. This qualifies an accepted native core crossing and held source save;
destination import, source retirement and published ownership remain false.

Native233 attempt016 generates the actual northern neighbor0_-1 separately.
scripts/inspect-native-halo-crossing-seam.mjs compares all645 saved overlap
heights and samples original ground interpolation at the exact accepted source
pose and its destination projection. The heights agree. Evidence is
output/native-halo-region-north-001-observed.json and
output/native-halo-crossing-seam-001-observed.json. Destination collision is
still unverified. Each engine runs alone; no browser or served engine is launched
or rebuilt.

This proves fresh geometry and saved ground continuity, not playable seamless
travel. The automatic run's reviewed frame shows the original gameplay HUD but
a black/unexplored main view. Later original minimap input renders the kingdom,
but the automatic initial camera remains unfinished. The original menu sequence
also stalls when dismissing the
tutorial prompt in the current isolated smoke path. Automatic generation does
not qualify that menu path. Attempts001..009 retain those failures, premature
shutdown, cold-hook checking mistakes and invalid harness waits/input.

Terrain textures, opaque vertex fields, lighting, navigation obstacles and
collision still need admission at the chosen crossing. Retirement from the
source, original import into the destination,
one published owner, remote guild AI and return travel remain unfinished.
The new halo reload is qualified for the isolated native save above; repeated
region activation and browser persistence still need integration. Browser launching
stays suspended under AGENTS.md while the host crash is unresolved. Shared
co-op regional activation, full campaign/match completion and independent
internet play remain unfinished. The full goal stays active.

## Preparing the actual crossing commands

`web/world/halo-hero-orders.mjs` now prepares a bounded original-reader command
payload from the actual Native233 crossing save and the northern clock0 save.
The explicit halo layout is required. In-flight Move2, Path4 and Queue7 retain
their original order, banks, cursors, capacities, flags, callbacks and delays.
Only qualified absolute XY coordinates and common dispatch stamps change.
Target-relative navigation, unknown commands/callbacks, points outside either
map, differing saved ground and changing source records refuse preparation.
This code does not activate actors or write either checkpoint.

Move2's native+3c/+40/+44 vector has pinned serialization and original setter
provenance in `scripts/audit-native-inflight-move.py`. The existing bounded
original writer replay independently maps it to saved body words26..28.
The read-only navigation iterator exposes those signed fixed coordinates
separately from Path/Queue world pairs and Path navigation-grid pairs.

`output/native-halo-orders-002.json` binds the current preparation sources,
both unchanged checkpoint hashes, pinned Move audit and original writer replay.
Its564-byte banks payload is `output/native-halo-orders-002.bin`. Independent
literal offset checks verify the final values, including the last empty bank:

- Move goal:7372800,8224768,106240, retaining its original elevation exactly.
- Path world destination:3072,4000. Its ten grid points shift Y by248.
- Queue world point:3072,4000. Consumed cursors remain1.
- Dispatch ages remain0/200/200ms at the destination clock0, including unsigned
  wrap for the two older stamps.
- All13 saved coordinate points have equal original ground samples in both
  stopped maps. The Move's source elevation equals its original ground sample.
  This is height continuity, not destination walkability or collision.

All65 focused checks pass in `output/native-halo-orders-005-focused.log`,
including four-direction round trips, exact prepared bytes, ambiguity/bounds,
ground mismatch, unsupported callback and changing-record refusals. Early
failing test/preparation logs remain preserved. No native game/build or browser
is started; the compiled native generation remains233 and served engine files
are unchanged. The new helper modules are source preparation work.

The same source save identifies additional dependencies that must not be
dropped or replaced by older fixtures. Explore flag492/GPL21 carries command12,
which the current original command storage planner does not support. Current
scriptless children494/495 are Wait9 effects of classes31475241/34475241,
with1000/2500ms intervals and age200ms. The older exact three-effect arrival
profile has different classes and ages and remains unsuitable. Flag script
`heroes` references17, while hero script references its own17 and registered
home7. Hero's script destination pair still needs its own typed coordinate
edit. Preparing and validating these linked records through the original
reader, then retiring the source and publishing one owner, remains next.

To reproduce the preparation against matching current sources, preserve old
reports and use a fresh three-digit prefix:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-inflight-move.py \
  --output output/<fresh-move-audit>.json
node scripts/prepare-native-halo-hero-orders.mjs \
  output/native-halo-crossing-002-observed.json \
  output/native-halo-region-north-001-observed.json \
  output/<fresh-move-audit>.json output/native-halo-orders-<fresh-number>
```

Whole actor/reward reference closure, native reader execution, source retirement,
ownership transfer, return travel, full co-op completion and browser memory
bounds are not qualified by this payload. The active goal retains those gates.

## Preserving current reward and effect commands (234)

The command12 obstacle above is now removed for preparation/storage admission.
The pinned original factory creates a72-byte frame command at005da75f; its
writer005e38a0 emits116 bytes. Its five leaf DWORDs are animation flags, first/
last/current frames and repetition count, not route coordinates or agent IDs.
`scripts/audit-native-frame-order.py` verifies16 original instruction anchors,
the constructor/vtable/factory and frame update, then replays the original
writer twice with different stack fills. Both payloads agree; guest memory
peaks at40960 bytes and returns to zero. The audit preserves older writer
evidence and explicitly records that the original reader has not run here.

The JS parser/storage planner and native payload/ownership planners now admit
that fixed layout. A separate optional allocator caller authorizes command12;
older profiles retain caller refusal by default. Duplicate caller sites,
wrong sizes, wrong command kind and missing name/node claims still refuse.
The private family-order restorer supplies the verified caller. No actor is
published or activated by these changes.

`web/world/halo-companion-orders.mjs` prepares the exact current dependency
shape. It verifies the living player's reciprocally associated Explore flag
and exactly two scriptless children, rejects nested/duplicate dependencies,
and retains bounded command copies. The flag keeps its frame and marker orders,
including current frame/repetition state. Each effect keeps its Wait command
and native destruction callback. Only qualified common dispatch stamps change.

`output/native-halo-companion-orders-003.json` binds frozen producer233 evidence,
the current reader build234 and current preparation sources. Its three binary
payloads retain:

- Flag492:332 bytes, commands12/5, dispatch ages50/0ms,287 bytes of requested
  initial command storage. Current frame state remains2,0,3,0,1.
- Effect494, class31475241:128 bytes, Wait interval1000ms, age200ms,161 bytes
  requested storage.
- Effect495, class34475241:128 bytes, Wait interval2500ms, age200ms,161 bytes
  requested storage.

These elapsed ages are preserved at destination clock0 using unsigned stamps;
the timers are not restarted. Original projected lifetime/callback execution
is still an explicit native verification gate. Older exact three-effect clock
profiles remain unchanged and unsuitable for this crossing.

A read-only corruption control changes one effect's player in an in-memory
reader. Preparation refuses the foreign effect and the actual source hash stays
unchanged; evidence is output/native-halo-companion-orders-001-player-control.json.

The preparation reads the frozen233 sources/evidence after validating every
archived hash. It does not rerun a current-native-source inspector against an
older build. The immutable233 source and northern saves are unchanged. The
earlier failed preparation log records an incorrect assumption that the terrain
proof included an exit-code field; the successful preparation checks its
hash-bound archived process manifest instead.

Official one-job native_order_payload_tests, native_order_allocation_tests and
native_order_storage_tests pass.71 focused JavaScript tests pass in
output/native-halo-frame-order-003-js.log. Official smoke build234 passes and
binds all53 compiled inputs; no native game or browser starts in this step.
The served browser engine is unchanged. Complete actor/GPL references, original
reader execution, collision, source retirement, ownership and return travel
remain next, alongside the full co-op/WAN/browser-resource goal.

## Original Explore flag class (235)

The current flag cannot be restored as a vehicle. The pinned factory switch
maps kind4 to004331e0, a336-byte object with vtable0068071c; its146-byte saved
UNIT has exactly one PRIMARY v9 component. Warrior and effects use kind1,
356-byte objects, vtable0068098c and two components. Parent static audit
output/native-halo-explore-flag-001-audit.json binds the actual frozen crossing
record to16 instruction anchors and eight original flag vtable slots.

The native stage now accepts an explicit ExploreReward profile with the current
flag's description34415241, flags545 and no physical parent. Complete UNIT
reads check the selected component count. Factory results must match the
selected original kind/table/size while registry and spatial exposure remain
deferred. Command restoration accepts that explicit class and retains the
same original bank reader/getter and+88 bank fields, verified for both tables.
Unknown profiles and changed reward state are rejected before construction.

Official native_actor_profile_tests passes50 checks; official one-job smoke
build235 passes with54 bound inputs. Companion preparation004 binds that build
and regenerates the same three588-byte command payloads from frozen233 saves.
It does not execute the flag reader. No game/browser was launched in this step.
The linked hero/flag GPL and container import, command execution, retirement,
ownership and continuous play still require implementation and live evidence.

## Original linked transfer reader (239)

The current transfer contains the actual Warrior481, Explore flag492, attached
effects494/495, their original command banks and GPL contexts, reciprocal
containers and a pure remote guild identity. All13 records (4,877 bytes) load
through the original native readers and write back exactly after reserving
fresh destination identities. The flag uses its original RWRD serialization
table with one PRIMARY component. Effects retain their relative Q11 poses;
their saved navigation cells follow the translated parent, as the original
writer/getter requires.

Official build239 and isolated trial004 pass. The independent inspector
`output/native-halo-bundle-001-observed.json` verifies those writebacks, two
presentation dumps, unchanged source checkpoints/profiles, terminal exit0
and original cleanup of all49 command reservations. Controls003 reject11
corruptions. Earlier failed attempts001..003 are retained as failure evidence.

The bundle remains unscheduled in this test and is removed afterward. It does
not yet continue the hero's movement/AI, perform source retirement or publish
ownership. Those steps, full save/reload and seamless browser travel remain
next; native RSS sampling is not a browser memory guarantee.

## Linked activation and movement (241)

The native prototype now activates that linked bundle through the original
postload, footprint, command-registration and scheduling methods. Trial005
maintains the hero's four-cell footprint while original commands move it and
both hero and flag AI contexts run. All four banks update during500ms of
ordinary play. The original writer saves the whole world before/after that
interval, then the original pause mechanism holds it for normal shutdown.

Independent evidence `output/native-halo-bundle-003-observed.json` checks both
saved poses/clocks, intact flag reciprocal membership, effect parent/nav,
canonical remote guild proxy, native/script backlinks and exactly two queued
agents. Ordinary hero AI selects an existing destination agent as its new
target; that agent's actual native backlink is verified. No AI/task override
or movement edit produces the changed pose.

This is a bounded native activation and save test. Reloading the evolved save,
retiring the source family, publishing one owner and integrating continuous
browser travel remain next. Full co-op, independent internet and sustained
browser resource qualification remain open; the served WASM is unchanged.

## Fresh revisit of the evolved region (244)

The evolved500ms region now reloads in a separate native game process through
the original whole-world reader, with no actor reimport. Independent checks
compare all13 transferred UNIT/GPL/container/command records before play and
after command admission; all26 comparisons match exactly. The hero continues
moving and both AI contexts and all four banks resume their original updates.
The engine saves again at clock1000 and pauses through its original mechanism.

The shorter attached effect expires at800, retaining its already elapsed
lifetime across reload. The Explore flag's poll releases the hero; both native
memberships and its script heroes list agree afterward. Saved targets remain
valid, the remote guild proxy stays canonical/unscheduled, and the surviving
effect retains its parent and derived nav. Evidence is
`output/native-halo-reload-bundle-001-observed.json` from terminal trial009.

Next are retirement of the actual source family, one ownership publication
and repeated integrated travel. This fresh native revisit is not browser or
multiplayer qualification. Full co-op/internet and sustained browser resource
checks remain incomplete, and the served WASM build is unchanged.

## Actual source retirement and one selected handoff (245)

Build245/trial010 reloads the frozen actual crossing at clock60650 into one
private native process. It writes a before save, removes only hero17 from the
guild's script members through the original list operation, releases the flag
from scheduling and removes effects495/494, flag492 and hero481 through the
original native removal method. Original manager collection retires GPL17/21.
The original writer saves again and original pause7 permits normal shutdown.

The independent inspector `output/native-halo-source-retirement-001-observed.json`
compares the input/load records and both before/after saves. All485 unrelated
UNIT/GPL/CONT/ORDR records are byte-exact. Guild GPL7 and CONT469 change only by
their expected single roster member removal, including exact other opaque
bytes. Both queues retain their other entries and selector. No physical child,
container member, positive GPL reference or audited order target points to the
removed aliases. This does not classify every opaque native field as a reference.
Kind13's inherited188-byte command framing is qualified against the original
writer with two bounded CPU replays; its added DWORDs remain opaque. The reader
supports this framing rather than skipping an unsupported bank.

`output/native-halo-route-publication-002-observed.json` joins that retired save
and frozen244's evolved1000ms destination in the actual stopped-file hero route
journal. Immutable registration still refers to the original recruitment save,
not the crossing save. Revision1 selects hero510/GPL54 in `0_-1`, its pure home
proxy53 and the retired `0_0` save together. A reopen and idempotent retry agree.
Four interruption boundaries preserve the old owner before publication and the
new owner afterward, then recover. Two real-save corruptions refuse publication:
keeping a duplicate source hero and deleting the destination's current AI target.

Ordinary AI chose live destination agent48/native505. Route custody now validates
the explicit root target's live reciprocal native/script identity while retaining
the existing immutable-home and other-reference rules. No target/task reset or
borrowed home is used to force publication. The journal retains three checkpoint
slots across the two visited regions here, at most two per region, with4096-byte
reads/writes and one observed read at a time. This bounds stopped copying, not
browser simulation/render memory. Twenty command/parser checks and15 route checks
pass. Continuous running handoff/return, engine scene residency, full co-op,
independent internet and browser resource qualification remain unfinished. Browser
launch suspension remains in force; served WASM and personal profiles are unchanged.

## Resume the selected owner and advance its saved state (246)

Current-owner export now uses `HeroRouteStore.withOwner` with a single leased
checkpoint. It verifies the selected hash/ownership before consumption, checks
the hash again afterward and revokes the reader on success or failure. It opens
no dormant destination worlds. New tests check that exact opened-file set,
escaped readers, callback failures and source mutation; all17 route checks pass.

Preparation001 reconstructs the qualified245 journal in an owned private
directory, then exports only the selected north region at clock1000. Its
44-byte original-reload identity records absent effect512 and the released flag
association. The original native loader accepts that observed state: it neither
reimports the hero nor recreates the expired effect nor forces reward membership.
Three surviving command banks register; both original agents remain queued.

Official build246/trial011 passes. Independent evidence
`output/native-selected-halo-owner-001-observed.json` compares all11 surviving
UNIT/GPL/container/command records after load and after command admission; all22
comparisons are exact. Original AI, contexts and the three surviving banks run
through clock1500. The original writer saves, original pause7 holds play and
the private native process exits normally. Saved home, live targets, survivor
parent/nav and flag script/native membership are checked independently.

`output/native-selected-halo-save-001-observed.json` publishes that new save as
private journal revision2, with the same hero510/GPL54 owner in `0_-1` and
unchanged immutable guild registration. A fresh owner export selects1500; retry
writes nothing. All old world slots remain unchanged and the two visited regions
have exactly four checkpoint slots, at most two per region, with4096-byte copying.
Frozen245 originals and personal/served browser files are preserved. This is a
selected save/resume/save loop, not automatic running seam crossing or return.
Those remain next, together with engine residency, full co-op/WAN and sustained
browser resource qualification. Browser launches remain suspended.


## Prepare the selected hero for home

Frozen246's selected revision2 is the authoritative source, at clock1500 in
`0_-1`. Original AI has finished Explore, cleared its previous Treasure_Chest
agent48 target and removed the hero's ORDR attachment. The active script remains
`warrior_tree`; preparation does not replace it or issue a fabricated go_home.
Effect512 stays absent. Existing Wait effect513 survives, and the original AI
has created a new scriptless ARB2 effect516 with an extended-animation13 and
retirement-marker5 bank. Both physical children must travel together.

The ordinary header readers previously recognized only inherited kind11.
They now use the parser's verified inherited version framing for clocks and
base callbacks; kind13's inherited marker callback is also inspected. Kind13
requests100 object bytes and two canonical empty callback names. Original x86
writer replay002 independently verifies its clock words5..8 and callback tokens
11/30. Its two additional saved parameters73/0 stay opaque and unchanged.
The current ARB2 preparation profile accepts this observed shape only; it does
not qualify other animation parameters or original reader/activation behavior.

Selected return preparation002 clones all nine frozen route files to a fresh
owned journal, then derives the source/destination clocks1500/60650 and the
actual immutable native home469/GPL7 through the selected route API. Caller
options name halo-v1; source/destination regions come from the leased journal.
The seven inert records total3308 bytes: hero UNIT/GPL/CONT, two effect UNITs
and two effect ORDRs. Actor aliases100000/GPL1000 and child100001/100002 are
unreserved proposals. The plan restores CONT101 home469 and retains obligations
for the guild's native100 group and GPL members list; it does not mutate them.

Hero Q11 XY7307264/8192000 projects to7307264/65536 with unchanged Z88832;
global XY7176192/-65536 and both relative effect poses stay unchanged. Parent
navigation223/250 projects to223/2. Independent stopped terrain sampling gives
88832 on both sides at the same global point. Active script age200ms, Wait age
200ms and both new animation/marker ages0ms survive clock rebasing. Every
record is reconstructed from original bytes and declared edits, including the
sole eight-byte home-container insertion. Sources and journal selection remain
unchanged, with4096-byte reads and one observed read at a time.

`output/native-selected-halo-return-001-observed.json` reproduces preparation
from the unchanged selected journal and compares all seven output records to
the reproduction. All111 focused parser, callback, clock, dependency, arrival
and route tests pass, including wrapped inherited timers and refusal of altered
callbacks, opaque parameters or late commands. No native build/game/browser
process runs for this preparation. Served WASM and personal profiles remain
unchanged.

This is an explicit home destination prepared at the current overlap position,
not an observed automatic return crossing. Original import/reservation,
kind13 original read/storage hooks, spatial/command/AI activation, source
retirement and return publication remain next. Native collision at this return
point is also unqualified. Continuous browser travel, co-op regional ownership,
independent-household transport and sustained engine/browser resource bounds
remain unfinished; browser launch suspension remains in force.


## Extended command storage and original literal reading

The returning ARB2 effect516 needs Animate Extended13 plus marker5. Native
`PayloadPlan`/`Journal` now admit its188-byte inherited body,100-byte object and
both one-byte canonical empty names. The optional factory allocation return is
005da795, pinned by original factory005da78e's100-byte malloc005da790. Legacy
entry-point profiles leave this optional site disabled. The private family
restore helper supplies it explicitly. Wrong size/kind, missing base or leaf
name storage, an unconfigured caller and overlapping entry sites stop the
owned call without transferring storage. The generic payload parser retains
opaque callbacks/parameters; it does not classify them as portable references
or authorize activation.

`capture-native-selected-halo-orders.mjs` reads only the actual selected1500
owner and takes literal unnormalized commands from effect516. Both commands
are tested with5a/c3 stack poison. Original reader005f9410 delegates to005ab760,
then reads its two opaque parameters; original writer005f9460 emits the same
188 bytes. Four controlled reader/write round trips (eight original calls)
preserve all payload bytes, including both tokens and73/0. Original streams,
empty-name copying and allocator dependencies are modeled in these CPU calls;
they are not native bank-hook or game import evidence. Maximum mapped guest
memory is81920 bytes and all mappings are removed afterward. The existing22
command round trips also pass against freshly replayed current writer evidence.

Both official native targets `native_order_payload_tests` and
`native_order_allocation_tests` pass. The latter reports1947 checks and covers
kind13 success, missing optional caller, wrong allocation size/kind, missing
base name and missing inherited leaf name, plus duplicate-site refusals and
return to heap baseline. Five capture schema tests pass, including inherited
version and distinct poison cases. The first payload compile failed because
of a test-fixture syntax error; corrected attempt002 passes. Historical logs
and earlier writer evidence are preserved rather than overwritten.

`output/native-extended-order-storage-001-observed.json` binds the exact inputs
and test/CPU reports; `output/native-extended-order-storage-001-preserved/` holds
all28 bound files. No native game or browser runs, and no served WASM changes.
The historical246 executable is unchanged but its source no longer matches
current native code, so current game runners must refuse it until a new
successful official build. The later249 import below qualifies the original
hero/effect import and cleanup against the actual selected home world.
Spatial/command/AI activation, departure/publication and continuous return
travel remain next. These storage and emulation checks alone do not complete
those gates.

## Original home import and cleanup

Official native build249 loads a private copy of the selected dormant home
checkpoint at60650ms and imports all seven prepared records from the selected
northern1500ms Warrior. Its allocated aliases are hero496/GPL22 and current
effects497/498. The original native100/101 container links and guild7 `members`
list are reciprocal; neither the immutable registered guild nor the selected
northern source is changed. The complete3416-byte pack contains3308 record
bytes; input/output records are bounded and world inspection reads4KiB at a time.

Attempts001/002 restored all three actors and both command banks, but aborted
on exact effect516 UNIT comparison: its saved animation attachment exported
as0 instead of1. Version9's compact model reader leaves a one-based model index;
the original helper post-load005b54d0 resolves it to a pointer, and the writer
maps that pointer back to its saved index. Calling that original stage for all
three actors fixes the mismatch without rewriting the saved state. The drawing
bank and script queues remain unchanged; spatial publication and scheduling
are deferred. The pinned actor-postload audit independently binds the method.

Trial003 is terminal0 with its producer absent after20.796s, at168.109375MiB
peak sampled native RSS under a512MiB/35-second guard. Independent inspector001
reconstructs the aliases from the prepared records, reproduces preparation
against the unchanged selected journal, and compares seven individual outputs
plus all seven records in `Halo_Return_Imported.GMP`. It verifies485 unrelated
records exactly, reconstructs both guild records with only one member inserted,
and checks unchanged queues. Original removal frees23 command reservations;
`Halo_Return_Cleaned.GMP` restores all487 baseline actor/script/attachment
records exactly, with no remaining aliases or incoming memberships.

`output/native-halo-return-import-001-observed.json` records this scope, and
`output/native-halo-return-import-generation-249/manifest.json` retains83 sources
and45 evidence files before subsequent runtime changes. This is a stopped
import/model/roster/save/cleanup qualification. It does not establish collision
at the return point, live AI/effect continuation, source retirement, custody
publication or an automatic return crossing. Continuous browser travel, co-op
regions, full-match/WAN testing and sustained browser resource bounds remain
unfinished. Served WASM files and player state are unchanged; browser launches
remain suspended while the host crash is unresolved.

## Original live home continuation

Official build252 loads the qualified imported home save in a fresh private
native process. The original world reader restores model references, physical
placement and drawing membership; the probe does not repeat first postload or
rewrite actor state. Failed live trials001/002 exposed an incorrect test
assumption: the returning hero has no saved ORDR attachment, so original group
notification correctly leaves it out of the command registry. Its two effects
already belong to that registry. The corrected probe preserves this state and
adds only one original pending AI queue entry.

Trial003 advances ordinary gameplay from60650 to63650ms. Original hero AI runs
62 times, context execution447 times and other actors1186 times. Its AI creates
new commands naturally (103 observed bank calls), and the hero moves on25
frames. Effect498 runs56 bank calls and retires at62050; Wait effect497 runs46
and retires at62950, exactly its saved60450+2500 deadline. Original native and
script guild membership remains reciprocal. Physical footprint4 and drawing
membership1 remain valid. The original pause is entered after the evolved save,
and all three observer hooks are removed.

Independent inspector001 compares all494 actor/script/attachment records
exactly through the loader snapshot, loaded snapshot and Ready save (1482
comparisons). Queue contents before scheduling are unchanged; Ready adds only
GPL22 once. The evolved save contains the hero's newly created orders and no
expired effect units, banks, containers, parents or memberships. No hero command
bank is invented before gameplay. The immutable home registration and all nine
selected journal files remain unchanged.

The producer exits0 and is absent after22.808s, with170.328125MiB peak sampled
native RSS under the512MiB/35-second guard. This short native trial does not
establish sustained or browser resource bounds. Report
`output/native-halo-return-live-001-observed.json` and frozen
`output/native-halo-return-live-generation-252/manifest.json` retain65 sources
and29 evidence files, linked to the frozen249 import proof. Source retirement,
paired ownership publication and automatic crossings remain next; this private
copy does not change the currently selected northern owner. Seamless browser
travel, co-op regions, full-match/WAN testing and browser bounds remain open.

## Original source retirement and return publication

The source preparer binds frozen252's verified home gameplay to the actual
revision2 northern owner. Only its selected checkpoint is leased; no dormant
world is opened to export it. Warrior510/GPL54 retains current children513/516,
no saved hero bank, one queued entry and no incoming script references from
other actors. Explore511/GPL55's hero roster is already empty. Expired512 is
absent. The immutable home remains pure proxy53 in the remote region.

Official build253 privately reloads this1500ms source. Original gameplay removal
005a21b0 retires children then hero, and manager00633370 removes GPL54. Original
saves before/after and an original pause occur without a gameplay tick. Trial001
stayed at the menu because the fixture marker named the wrong region; correcting
only the runner marker permits trial002 to finish0/absent after22.771s at
164.21875MiB sampled peak native RSS under the512MiB/35-second guard.

Independent inspector001 compares462 actor records through both loader/Before
saves (924 comparisons), verifies only seven records removed, and compares all
455 remaining records exactly. Flag511/GPL55, its empty reward roster and home
proxy53 are unchanged. Only the hero's queue entry disappears; no native child,
container membership or incoming GPL reference retains the retired aliases.
`output/native-halo-return-source-001-observed.json` and frozen generation253
retain69 sources/29 evidence files, with the selected journal still at revision2
at that milestone.

The stopped return publisher then selects the retired north at1500 and the
verified home continuation at63650 together. Revision3 in the owned test journal
now selects home0_0/hero496/GPL22, preserving native guild469/GPL7 and the original
registered identity. Both regions still use two checkpoint slots each. Prior
active slots and prior metadata nodes remain unchanged. Repeating the same
operation writes nothing. Owner export opens only the home checkpoint and its
reader is revoked afterward.

Four cloned-journal interruptions (after source, after destination, before head
publication and after publication) recover to revision3. The old owner remains
selected until publication. Two negative controls reject a still-present source
hero and a deleted home guild without changing the selected owner. All reads and
writes are at most4KiB; these stopped serial adapters do not provide a live
interprocess or browser writer lock. The publication report is
`output/native-halo-return-route-publication-001-observed.json`; its preserved
directory retains12 sources/73 evidence files, including all control journals
and the actual revision3 journal, linked to generations253/252/249.

The existing17-test hero-route store suite also passes, including90 movements
with two slots per region, reader revocation, stale plans, damaged staged state,
native targets and interrupted third-region publication. Those generic controls
complement the original-record return evidence; they do not run the game.

This is a verified original-engine saved-state round trip with atomic stopped
ownership publication. It does not establish automatic boundary triggers,
uninterrupted live transfer, fresh journal-selected home reload after publication,
co-op regional ownership, full-match/WAN qualification or browser memory bounds.
Served files and player profiles remain unchanged; browser launch suspension
remains in force.

## Journal-selected home reload and save

The owner preparer exports the actual revision3 selected home through one
bounded, read-only owner lease. It opens only `Frontier_Hero_Route_0_0_0.GMP`,
preserves its63650 clock, hero496/GPL22, native guild469/GPL7 and original
commands2/4/7, and revokes the reader after export. It does not substitute the
earlier imported home or re-register the original guild. Effects497/498 are
absent; no dormant northern checkpoint is parsed to export the owner.

Official native build255/trial001 loads that save in a fresh private process.
Original world loading restores the physical grid, drawing and command-group
membership. The hero is already queued once: no AI insertion, command repair,
model-postload replay or actor import occurs. Loaded/Ready snapshots precede
ordinary gameplay63650→64150. Original hero AI runs11 times, context execution48
times, other AI199 times and its command bank18 times. The hero moves on5
frames and remains outdoors with footprint4/drawing1. Its guild memberships
remain reciprocal and expired effects remain absent. The probe permits original
guild entry, checking resident grid absence if it occurs; that branch was not
exercised in this500ms trial and is not claimed qualified.

Independent inspector002 compares all489 actor/script/attachment records through
the loader snapshot, Loaded and Ready (1467 comparisons), with exact queue
contents and typed ownership/native-home checks in every snapshot. The evolved
pose matches the original observation and original commands have advanced.
Trial001 is terminal0/absent after23.328s at165.859375MiB sampled peak native RSS
under the512MiB/35-second guard. Frozen255 retains70 sources/31 evidence files,
including the exact native script, linked to the revision3 publication archive.
Inspector001 is retained; inspector002 additionally binds the native script.
Build254/preparation001 are retained but no game was launched against them;
build255 adds the resident grid check before trial001.

The stopped owner-save publisher now selects this64150 continuation as revision4
without changing the hero's alias, guild registration or either northern slot.
Only the inactive home slot is replaced; four total checkpoint slots remain.
Three cloned-journal interruptions (after source, before head publication and
after publication) recover. The old63650 save remains selected until publication.
Retry writes nothing and owner export opens only the new selected home slot,
revoking its reader afterward. The native report is
`output/native-halo-return-owner-002-observed.json`; the owner-save report is
`output/native-halo-return-owner-save-001-observed.json`, with12 sources/47
evidence files retained in its preserved directory.

Revision3 preparations must refuse reuse against the new eleven-file revision4
journal. Original selected-save load/play/save is now verified after the
homeward handoff. Automatic boundary triggering and same-process region
transfer remain next. Browser/WASM launches stay suspended; seamless browser
travel, cooperative regional ownership, full-match/WAN testing and sustained
browser resource bounds remain unfinished. Served files and player profiles
are unchanged.

## Same-process overlapping-region session

Official build258/trial002 now exercises five visits in one original native
engine: home `0_0`, retired north `0_-1`, home, new east `1_0`, home. Preparation003
exports the actual revision4 selected home and selected retired northern save
through two bounded, read-only leases. Both readers are revoked; the real
eleven-file custody journal remains unchanged. This pages kingdoms; it does not
transfer the Warrior or select a new custody owner.

A native-only `BROWSER_FRONTIER_HALO_SESSION=v1` binding authorizes a private
`native-world-halo` root under an owned `actor-arrival-fixture-halo-world-session-`
directory. Its immutable hash-bound layout contains world, registered hero,
guild, settings-producer and engine/content identities. Each saved destination
also requires exact layout metadata matching its selected original checkpoint,
region and identities. Every load, including revisit/fallback, receives restore
admission before the original reader. Original checkpoint publication refreshes
the sidecar; a failed update prevents travel. Interrupted recovery of these two
publications together remains unqualified. No dormant graph or growing region
catalogue is retained. Original disposal resets halo restore state after freeing
all eight tracked world/factory/terrain/grid/matrix roots. Temporary observers
are removed before attachment, with zero retained roots and balanced hooks.

Failed build256/trial001 is retained. Timed travel inputs expired during startup;
its east generation and two exits succeeded, but returning home refused a
two-element saved-name vector. Original SVGD reader00436770 appends names;
original writer00436ef0 clears its owning vector through004373e0 before refilling
it. Build258 repeats that original range destruction at the empty front end
before another read, retaining the strict single-player restored-name check.
Four loads observe counts0,1,1,1. Build257 compiled cleanup but was not launched;
build258 also adds a private bounded request bridge. The supervisor waits for
Ready saves and publishes through the same native named-action API as UI input.
The engine retains one current packet and a sequence, without engine pointers.

Trial002 gives the north sidecar the wrong world identity. The first request
refuses before any source checkpoint or unload. The supervisor restores the
exact qualified metadata; the second request succeeds. The fresh east region
uses the original preset and reaches fully attached gameplay at clock0 before
its first tick or initial checkpoint. Each kingdom then advances through normal
original gameplay. Four exits each free all eight roots exactly once, including
530456 terrain bytes and524288 spatial bytes.

Inspector001 compares all489 home and455 northern UNIT/GPL/CONT/ORDR records,
totaling1922 exact comparisons across four loads/revisits. Queues, active
schedule, RNG and saved-world sections match. The whole-world comparator
excludes save labels/date and the documented cached shading byte, and admits
only independently verified keyed order-container permutations; this run needed
no permutation or shading exception. Northern guild proxy53 retains its original
unscheduled state. All12400 shared height bits across five Ready snapshots match
the global halo recipe. Ready clocks are64150,1500,66250,0,67100. Final private
selected saves record home68200, north2500 and east850. Original home guild
membership and expired-effect absence survive restoration.

Six checkpoint slots remain, two per visited region; uniquely named saves are
additional qualification evidence. Trial002 exits0/absent after25.826s at
177.359375MiB sampled native peak RSS under the35-second/512MiB guard. Twenty-eight
focused JS checks pass. Frozen258 retains76 sources/52 evidence files; failed256
retains77 files. Evidence is `output/native-halo-session-001-observed.json`.

```sh
env DEVELOPER_DIR=/Library/Developer/CommandLineTools \
  upstream/majesty-recomp/.venv/bin/python scripts/build-native-world-residency.py --attempt 258
node scripts/prepare-native-halo-session.mjs \
  output/native-halo-return-owner-save-001-preserved/manifest.json \
  output/native-world-residency-build-258.json output/native-halo-session-preparation-003
python3 scripts/run-native-halo-session.py \
  output/native-halo-session-preparation-003/preparation.json --attempt 2
node scripts/inspect-native-halo-session.mjs \
  output/native-halo-session-attempt-002.json output/native-halo-session-001-observed.json
node --test --test-concurrency=1 tests/halo-region-layout.test.mjs \
  tests/native-session-route.test.mjs tests/hero-route-store.test.mjs
node scripts/preserve-native-halo-session.mjs \
  output/native-halo-session-001-observed.json output/native-halo-session-generation-258
```

These attempt numbers are retained; fresh runs need new ones and a current
official build/preparation. Revisiting newly generated east, automatic camera/
hero boundary travel, running custody publication, co-op activation and full
internet matches remain unqualified. Release heaps differ between visits;
four root disposals and one bounded native run do not prove sustained engine
or browser memory limits. Browser launches remain suspended for the unresolved
host-app crashes. Served WASM and player profiles remain unchanged; the full
goal remains active.

## Journal-selected hero crossing

Official build260 adds a native-only running actor observer to the bound halo
session. It reads the current journal-selected UNIT/GPL alias496/22, rather
than the immutable historical alias481/17. Original registry/runtime lookups
verify reciprocal identity, living outdoor state and the four physical
footprint buckets at each accepted tick. The footprint check is local to the
actor's shape; it does not scan every grid cell. Fixed arrays and scalar state
hold the observation. The original AI and movement remain in control.

Trials003–005 ended normally without a crossing and remain preserved. Longer
waiting and moving the Explore flag from3488 to4000 did not reach the core
boundary. The supplied SDK's explore_flag_poll describes sight-range reward
completion; most SDK BCD files differ from the installed runtime, so this source
is a hypothesis aid, not independently established runtime equivalence. Trial006
instead places an ordinary Explore request at4064,32 in the overlap strip,
through original UI helper0043ef50 and command send005a45c0. Original creation
produces flag500 at64250. No hero position, destination or AI record is edited.

The selected hero crosses east into1_0 at84550 after the84500 tick. Accepted
Q11 position8261479,258194,116930 projects to135015,258194,116930, preserving
the global position and elevation. The source/destination navigation cells are
252,7 and4,7, inside the footprint guard. Original pause00416050 selects phase7;
the original paused tick keeps presentation/input alive. A bounded hash-bound
supervisor packet requests a second original save while the clock stays84550.
This pauses the source for a later handoff; it does not yet unload or migrate it.

Inspector001 compares every original UNIT/GPL/CONT/ORDR record:489 at the initial
reload,499 between the crossing and held snapshots, totaling988. Complete world
sections, queues, schedules and both RNG states match while held; no order
permutation or shading exception is needed. All7440 shared height bits across
the three snapshots match the global halo recipe. The hero retains the original
registered guild469/GPL7 and its reciprocal roster links. Initial script is
hero_wander; at crossing it is use_building with target/home GPL7. This does
not prove that the flag alone caused the crossing. Flag500 is absent by then;
the actual three attached effects505/506/507 remain.

The crossing runs45.971s and exits0/absent under the55-second/512MiB guard, at
152.609375MiB sampled peak native RSS. The actual eleven-file revision4 custody
journal, player profiles and served browser artifacts remain unchanged. Frozen
`output/native-halo-session-actor-crossing-generation-260/manifest.json` retains
74 sources/35 evidence files. Earlier unsuccessful260 captures are retained
separately; build259 compiled but was not launched. No new C++ build is needed
for the flag-location change.

Stopped arrival preparation now recognizes the actual ARG3 Wait9 timer at3000ms
and the ARB2 extended-animation/retirement pair with opaque parameter1000.
Existing73 and ARG1/ARG4 profiles keep their exact checks. Only original dispatch
timestamps are rebased; callback IDs, opaque parameters and remaining dispatch
age remain intact. Unknown parameters/timers/callbacks still refuse. All three
actual crossing effects pass stopped preparation in
`output/native-halo-session-actor-effects-001.json`; four focused suites pass42
checks, including negative callback, expiry, parameter and alias controls.
Destination import and projected lifetimes remain unqualified.

```sh
node scripts/prepare-native-halo-session.mjs \
  output/native-halo-return-owner-save-001-preserved/manifest.json \
  output/native-world-residency-build-260.json output/native-halo-session-preparation-006
python3 scripts/run-native-halo-session.py \
  output/native-halo-session-preparation-006/preparation.json --attempt 6 --actor-crossing
node scripts/inspect-native-halo-session-actor.mjs \
  output/native-halo-session-attempt-006.json output/native-halo-session-actor-001-observed.json
node scripts/preserve-native-halo-session-actor.mjs \
  output/native-halo-session-actor-001-observed.json output/native-halo-session-actor-crossing-generation-260
node --test --test-concurrency=1 tests/halo-companion-orders.test.mjs \
  tests/hero-order-arrival.test.mjs tests/registered-hero-arrival.test.mjs \
  tests/hero-route-store.test.mjs
```

These output names are retained; later runs require fresh names. Next, assemble
the complete current hero family for the eastern destination, intercept its
remote home use, and connect original retirement/import/publication to the held
session. Seamless browser/camera travel, co-op region ownership, complete
independent internet matches and sustained browser memory bounds are unfinished.
Browser/WASM launches remain suspended; the full goal remains active.

## Running source removal

Build262/trial008 connects the actual running eastbound crossing to original
source-family removal in the same engine. The source remains paused at84550.
The supervisor reads the immutable Held snapshot and checks the complete
scriptless attached family, original home registration, reciprocal native links,
incoming script references and companion command profiles. External or nested
dependencies refuse preparation. A48-byte request names the current hero496,
agent22, registered home469/7 and actual children505/506/507. Its canonical
metadata binds both the held save SHA and request SHA to this region/serial/clock.
No player save or custody journal is rewritten by the preparation helper.

The native adapter admits only the explicit session/actor/removal flags and
owned private profile. At phase7 it checks live identities, the entire child
container, one registered guild slot, original queues and registry membership.
Original owning-list methods0062a810/006254c0/00639bb0/0062aa20 remove the departing
script member. Original005a21b0 removes children then hero;00633370 retires the
GPL association. Every other registry member/queue, both identity counters,
clock, phase and installed-hook count remain unchanged. Original writer saves
`Halo_Session_Actor_Retired_0.GMP` at the same paused clock. The runtime holds only
fixed arrays and scalar state; full registry comparison occurs only at removal.

Inspector001 first rechecks the running crossing and complete held world. It
then independently verifies removal of nine original records: UNIT496/505/506/
507, GPL22, ORDR505/506/507 and CONT496. All488 remaining records outside the
guild GPL/CONT are exact. The two guild records match only the expected removal
of their one member, including envelope sizes/counts and every remaining byte.
No physical parent, native container, script or typed order reference points to
the removed family. Remaining queues are exact. VHCL count/size subtract only
the four units; ORLS preserves its kind and ordered remaining registrations,
dropping only505/506/507 (496 was not in that list). Other world roots, raw terrain
and both RNG states remain exact. This does not remove opaque matching scalars.

The first261 trial007 refused before removal because the new API accidentally
retained an old BROWSER_STREAMING_DEBUG fixture requirement. It exits6/absent
and is retained with77 files.262 replaces that guard with the explicit bound
session/actor flags. Trial008 exits0/absent in45.861s at171.15625MiB sampled peak
native RSS under the55-second/512MiB guard. The successful archive retains78
sources/39 evidence files. The failed inspector attempts corrected metadata
shape and separately checked the affected VHCL/ORLS roots; no native rerun or
weaker unrelated-record comparison was used to resolve those assertions.

```sh
env DEVELOPER_DIR=/Library/Developer/CommandLineTools \
  upstream/majesty-recomp/.venv/bin/python scripts/build-native-world-residency.py --attempt 262
node scripts/prepare-native-halo-session.mjs \
  output/native-halo-return-owner-save-001-preserved/manifest.json \
  output/native-world-residency-build-262.json output/native-halo-session-preparation-008
python3 scripts/run-native-halo-session.py \
  output/native-halo-session-preparation-008/preparation.json --attempt 8 --actor-retirement
node scripts/inspect-native-halo-session-retirement.mjs \
  output/native-halo-session-attempt-008.json output/native-halo-session-retirement-001-observed.json
node scripts/preserve-native-halo-session-actor.mjs \
  output/native-halo-session-retirement-001-observed.json output/native-halo-session-retirement-generation-262
```

Those names are retained. Syntax checks pass for the helper, inspector and Python
runner; the upstream diff has no whitespace errors. This trial saves a retired
private source, while the actual revision4 journal still owns the original
selected hero. Neither destination import nor ownership publication is claimed.
Next, unload this saved source, attach the eastern destination, and activate the
preserved hero/family before publishing both sides together. Cooperative region
ownership, seamless browser/camera travel, independent full internet matches and
sustained browser resource bounds remain unfinished. Browser launches remain
suspended; served WASM and player profiles stay unchanged. The goal remains active.

## Running crossing region transition

Build263/trial009 connects that running crossing and original retirement to
the same process's normal region unload/load path. The previous goal turn was
a status-only check; this turn adds and executes the next transition. Prior
native PID6660 and build PID6212 were independently confirmed absent first.
No browser or alternate browser launch was used.

`run-native-halo-session.py --actor-paging` implies the existing crossing and
retirement gates, then publishes one bounded private packet after the original
retired save exists. The packet binds serial0, source0_0, observed destination
1_0, clock84550 and the retired save's hash. The engine admits only a truly
absent adjacent destination. It saves the retired source through the normal
two-slot checkpoint writer and layout binding, then calls original Quit
Game00416590 from phase7. Pinned00416050 explicitly maps phase7 to pending4
for that exit. The tick wrapper returns after original quit so no old-world
tick can execute. No phase/clock/pointer patch substitutes for original quit.

Original disposal004170a0 frees all eight tracked world/factory/terrain/grid
roots exactly once. The temporary observer is removed; no old root remains
retained. Only after world-null does profile routing change to1_0. The original
fresh-region generator, complete attachment and writer run at clock0. Before
the first ordinary simulation update, original00416050 pauses the destination
and an original full save captures `Halo_Session_Destination_Held_1.GMP`.
Original paused input/presentation ticks continue, with zero completed gameplay
ticks and zero clock. State across teardown is scalar crossing direction and
identity only. This deliberately holds the destination for the pending original
hero import; it does not substitute a newly recruited hero for the traveler.

The independent inspector reruns every crossing/retirement check, then verifies
the ordered quit/disposal/unload/attachment/generation/hold evidence. Normal
source and destination checkpoint heads select exact hashed original saves;
both layout sidecars bind all four world/member/guild/settings identities.
The retired source versus its durable checkpoint and the generated destination
versus its checkpoint/held save preserve1,438 complete UNIT/GPL/CONT/ORDR records
in total, full queues, world roots, raw terrain and both RNG states. None of
these comparisons needs the cached-shading or keyed-order permutation exception.
All7,440 shared height bits across the three eastern snapshots match the same
global terrain recipe. Production saves stay within two slots per region;
unique evidence snapshots are not retained native world instances.

Trial009 uses one original native process, exits0 and is confirmed absent in
45.841s. Sampled peak native RSS is153.234375MiB under the55-second/512MiB guard.
Original disposal reduces observed guest heap use from25,358,160 to22,954,288
bytes. This single transition is not evidence of sustained browser memory
bounds. Freeze263 retains79 source files and46 evidence files, including the
whole successful trial and source/destination snapshots. Actual custody remains
revision4, and personal profiles/served WASM remain unchanged.

```sh
env DEVELOPER_DIR=/Library/Developer/CommandLineTools \
  upstream/majesty-recomp/.venv/bin/python scripts/build-native-world-residency.py --attempt 263
node scripts/prepare-native-halo-session.mjs \
  output/native-halo-return-owner-save-001-preserved/manifest.json \
  output/native-world-residency-build-263.json output/native-halo-session-preparation-009
python3 scripts/run-native-halo-session.py \
  output/native-halo-session-preparation-009/preparation.json --attempt 9 --actor-paging
node scripts/inspect-native-halo-session-actor-paging.mjs \
  output/native-halo-session-attempt-009.json output/native-halo-session-actor-paging-001-observed.json
node scripts/preserve-native-halo-session-actor.mjs \
  output/native-halo-session-actor-paging-001-observed.json output/native-halo-session-actor-paging-generation-263
```

Those names are retained; new runs need unused attempt/preparation/archive names.
Python compile and Node syntax checks pass; upstream diff whitespace checks pass.
Next, create the immutable registered home's pure proxy through the original
destination runtime, prepare the actual hero and all three attached effects
against that original saved destination, and import/activate them before jointly
publishing both regions. Current selected hero496/GPL22 is in `use_building`,
targets its original home GPL7, and has no hero ORDR record; its three scriptless
effects are ARB2 reward1000, ARG1 wait1000 and ARG3 wait3000. The historical
Explore/flag bundle cannot stand in for this actual family. Remote home dispatch
must be intercepted before original building validity checks. Destination
import, paired publication in this running path, seamless browser/camera travel,
co-op region ownership, independent full internet completion and sustained
browser memory remain unfinished. Browser testing remains suspended, and the
full goal remains active.

## Original home reference after running travel

Build265/trial011 adds the destination home reference needed by the actual
traveling hero. Prior native PID7852 and build PID7337 were confirmed absent;
the previous goal turn completed original running source retirement and the
same-process eastern attachment. This turn extends that path, rather than
changing the immutable guild registration or substituting a local guild.

`--actor-proxy` implies the existing crossing, retirement and paging gates.
After the eastern destination is completely attached and held, the bounded
preparation helper reads its original held save and builds the nine-attribute
pure agent from the immutable registered home. Its proposed ID1000 is not an
allocation. A private packet binds serial1, region1_0, clock0, the original held
world hash, proposal hash and453-byte size. Both preparation and native consumer
retain the explicit owned-session/actor/paging guards; the old broad debug
fixture is not enabled.

The original runtime allocates/registers actual agent54, advancing its counter
54→55. Original00625e70,00634460 and GPL reader/writer methods preserve the
record exactly after changing only its proposed identity. The agent has no
native backlink, functions or scheduled queue entry; original game-piece
validity returns false. No building is created. Original native registry,
native identity counter, all AI queues, world, paused phase7, clock0 and hooks
are unchanged. The original manager owns the agent and serializes it in the
complete destination save. No manually managed dormant native pointer remains.

The first264 trial010 exits0/absent, but its original destination Held and Proxy
Ready saves differ beyond the audited shading exception:16,641 terrain bytes
and three GSGL bytes differ. This comparison was refused rather than accepted
by normalizing another field.131 files preserve264 and that refusal in
`output/native-halo-session-proxy-generation-264-refused/manifest.json`.
Build265 captures `Halo_Session_Proxy_Before_1.GMP` immediately before insertion,
then `Halo_Session_Proxy_Ready_1.GMP` without an intervening original tick. This
isolates the actual insertion from paused input/presentation between requests.
The reason for the earlier display/global changes is not proven; no terrain or
GSGL exception is used for265 qualification.

Inspector002 reruns all crossing, retirement and paging verification. It
independently verifies the original patched/observed453-byte record, immutable
home identity, unscheduled status and absence of any native backlink. All514
prior destination UNIT/GPL/CONT/ORDR records remain byte-exact. The entire GPL
root matches only an ordered map insertion of key54 plus453 record bytes and
five explicit DWORD changes: outer size, runtime envelope size, manager
envelope size, map count and runtime counter. Definitions, queues and every
other GPL byte are exact. Every other world root, raw terrain, GSGL and both
RNG states remain exact. No cached-shading or order permutation exception is
needed across the insertion snapshots.

Trial011 uses one supervised native process, exits0/absent in45.833s, and samples
174.4375MiB peak native RSS under the55-second/512MiB guard. Frozen265 retains83
source files and53 evidence files. Actual custody remains revision4, and personal
profiles and served WASM remain unchanged. Both worlds remain private test data;
the destination hero is not imported, queued or activated yet.

```sh
env DEVELOPER_DIR=/Library/Developer/CommandLineTools \
  upstream/majesty-recomp/.venv/bin/python scripts/build-native-world-residency.py --attempt 265
node scripts/prepare-native-halo-session.mjs \
  output/native-halo-return-owner-save-001-preserved/manifest.json \
  output/native-world-residency-build-265.json output/native-halo-session-preparation-011
python3 scripts/run-native-halo-session.py \
  output/native-halo-session-preparation-011/preparation.json --attempt 11 --actor-proxy
node scripts/inspect-native-halo-session-proxy.mjs \
  output/native-halo-session-attempt-011.json output/native-halo-session-proxy-002-observed.json
node scripts/preserve-native-halo-session-actor.mjs \
  output/native-halo-session-proxy-002-observed.json output/native-halo-session-proxy-generation-265
node scripts/prepare-native-halo-session-arrival.mjs \
  output/native-halo-session-proxy-002-observed.json output/native-halo-session-arrival-preparation-001
```

The final command **refuses** with `Unsupported arrival clock or zero-stamp
transition`; it writes `refused.json` and no capsule. Actual hero496/GPL22 has
`activescript=use_building`, delay300, stamp84550, flags2 and remainder0. Since
the crossing occurs at84550, elapsed age is zero. Projecting it to destination
clock0 hits the original scheduler's special zero stamp, so existing arrival
guards reject it. Neither source/destination save nor custody is modified.
The proposed preparation keeps all three current children and the real saved
proxy; it does not borrow an unrelated guild or drop the active function.

Next, establish a positive destination clock with one ordinary original tick,
then pause and preserve that actual world before import. This needs qualification
through original resume/pause, complete-tick timing, all child command ages,
global pose/ground preservation and original destination allocation. Do not set
a raw clock, fudge the timer's age or weaken its sentinel check. The original
remote-home call must be intercepted before its building-validity guard, then
both completed worlds must publish together. Browser/co-op regional activation,
independent full internet completion and sustained browser resource bounds remain
unfinished. Browser launches remain suspended and the complete goal stays active.

## Running destination hero import

Build266/trial012 establishes a positive destination clock through exactly one
ordinary original tick, then original pause00416050 holds clock50 in phase7.
No raw clock write occurs. Proxy inspector003 independently verifies that tick,
2,480 shared height bits at the positive epoch, the original pure home34, all
474 existing records exact across its immediate insertion saves, and unchanged
other roots/raw terrain/GSGL/RNG/queues. Frozen proxy266 retains83 sources and55
evidence files. This resolves the zero-stamp refusal without changing elapsed
script or attached-command ages.

Actual source496/GPL22 has position8261479,258194,116930 and saved navigation
anchor252,8. The original005ad470 setter and005a1fb0 copier maintain the anchor
independently of the fractional position; flooring Y would incorrectly produce7.
Arrival now translates the saved anchor to4,8 separately from the global point,
and preserves the three children's parent anchors and relative positions.
Bounds in both physical maps still apply; destination collision remains an
activation gate.49 focused JS tests pass, including moving-anchor preservation
and rejection outside either physical map.

Stopped preparation002 retained the erroneous floor assertion; its37-source
refusal closure is frozen. Preparation003 then exposed another incorrect
assertion: the original moving Z116930 differs from a fresh ground sample117090.
Both overlapping terrains produce117090 at the same global point. Transfer
preserves the exact original Z and its offset-160, rather than snapping it.
Its37-source refusal is retained. Preparation004 succeeds with nine records,
3,630 record bytes, and a3,786-byte inert pack;54 files freeze its sources and
evidence in native-halo-session-arrival-generation-001. This alone is not import.

Build268 connects the live preparation to the running crossing session. The
private native request hashes the actual source hold, original proxy-ready
destination, and complete package. The helper verifies the live private producer
and preserves its manifest snapshot. Native guards require the owned profile,
phase7/clock50, complete selected family, pure original proxy and bounded pack.
Original factories reserve one GPL ID and four native IDs. Original UNIT/GPL/
CONT readers and bounded original order storage restore all three scriptless
effects; original005b54d0 resolves each compact model index once. No actor enters
the spatial grid, drawing list or AI queues at this stage. Original writers
capture immediate Arrival_Before/Imported snapshots with no intervening tick.

Trial013 reached the destination but the live helper lacked projected crossing
metadata. It failed before package publication or import. Its producer is
confirmed absent; the incomplete trial manifest does not establish an exit code.
130 frozen files retain that failure. The helper now derives the projection from
the actual original crossing trace and compares it with the prepared position.
The supervisor also records exceptions and awaits producer termination before
writing final evidence. Build267 compiled the reader alone;268 includes the
running adapter. No repeat build was needed for the JavaScript-only helper fix.

Trial014 succeeds in one original process: source crossing/retirement/unload,
fresh eastern attachment, one original epoch tick, pure home42, then hero549/
GPL43 and effects550,551,552. Proxy inspector004 rechecks the preceding crossing,
retirement, paging and pure insertion; all505 prior proxy-boundary records match.
Arrival inspector001 independently repeats preparation, rebinds only proposed
IDs, and checks all nine standalone writer outputs and their whole-save records.
All506 prior destination records, including home42, are byte-exact. It verifies
the complete affected roots: VHCL+4/909 bytes, ORDR+3/768, CONT+1/100, ordered ORLS
append of only the three children, one MAP/PRAM native counter increment of4,
and exactly one ordered GPL insertion plus five explicit size/count/counter
DWORD changes. Other roots, raw terrain, GSGL, both RNG states and queues remain
exact. No additional normalization exception is used.

Trial014 exits0/absent in45.766s with175.546875MiB sampled peak native RSS under
55-second/512MiB supervision. Frozen proxy268 contains83 sources/73 evidence
files; frozen arrival268 contains131 files and links that preceding archive.
Actual custody remains revision4 and all player/served artifacts are unchanged.
No browser was launched. These measurements cover this isolated native run,
not sustained browser memory or multiplayer regional ownership.

```sh
node --test tests/actor-coordinates.test.mjs tests/halo-companion-orders.test.mjs \
  tests/hero-order-arrival.test.mjs tests/registered-hero-arrival.test.mjs \
  tests/hero-route-store.test.mjs
env DEVELOPER_DIR=/Library/Developer/CommandLineTools \
  upstream/majesty-recomp/.venv/bin/python scripts/build-native-world-residency.py --attempt 268
node scripts/prepare-native-halo-session.mjs \
  output/native-halo-return-owner-save-001-preserved/manifest.json \
  output/native-world-residency-build-268.json output/native-halo-session-preparation-014
python3 scripts/run-native-halo-session.py \
  output/native-halo-session-preparation-014/preparation.json --attempt 14 --actor-arrival
node scripts/inspect-native-halo-session-proxy.mjs \
  output/native-halo-session-attempt-014.json output/native-halo-session-proxy-004-observed.json
node scripts/inspect-native-halo-session-arrival.mjs \
  output/native-halo-session-proxy-004-observed.json output/native-halo-session-arrival-001-observed.json
node scripts/preserve-native-halo-session-actor.mjs \
  output/native-halo-session-proxy-004-observed.json output/native-halo-session-proxy-generation-268
```

The complete goal remains active. Next qualify original physical/drawing
insertion and collision, intercept the remote-home call before its native
building-validity guard, resume actual AI/effect lifetimes, and publish both
completed region worlds under one owner. Browser/camera travel, co-op activation,
independent full internet completion and sustained browser resource bounds
remain unfinished. Browser launch suspension remains in force.


## Destination activation in progress

The native adapter now admits a separately bound `Halo_Session_Activate.txt`
request after the original arrival import. It captures an immediate original
Activation_Before save, invokes the original collision, first/second postload,
spatial insertion and pending AI queue operations, and plans seventy ordinary
50ms ticks followed by an original completed-boundary save and pause. The
three saved effect banks are retained; the hero has no saved bank, so the
adapter must preserve that absence until original AI creates commands. A
remote `use_building` request is intercepted before the local building guard;
other AI and effect commands continue while that request is held.

This is implemented but not runtime-qualified. Build269 compiled the adapter;
build270 removed its two new indentation warnings. Trial015 was stopped by
its supervisor (exit-15/producer absent) because the retirement preparation
script did not accept the new `actor-activation` mode. Both retirement/proxy
preparation guards are corrected, with the refused sources/evidence retained
in `output/native-halo-session-activation-270-refused`.

Build270/trial016 reached the original nine-record import, then aborted6 at
activation. Build271/trial017 added tagged admission checks and the immediate
Activation_Before save; admission, the complete twelve-context home view and
collision succeeded, but the postload stage still aborted6. Both producers
are absent, and profiles/journal remain unchanged. Their original inputs are
retained under `output/native-halo-session-activation-270-aborted` and
`output/native-halo-session-activation-271-aborted`.

The recovered virtual model resolver005b54d0 was `kind:block`, `hookable:false`.
Activation cannot install its scoped completion cache against that symbol.
The original helper virtual+4 call at005a23fb/return005a23fe and its RET0 body
verify the entry. Config now declares005b54d0; official build272 is regenerating
and rebuilding with one job. The regenerated symbol is `kind:entry`,
`provenance:config`, `hookable:true`. Regeneration alone is not a runtime pass.
Six configuration tests and the new activation inspector syntax check pass.

`scripts/inspect-native-halo-session-activation.mjs` is a pending independent
verifier, not evidence of successful activation. It requires a successful
terminal run, exact immediate activation records and full roots except the
reconstructed original GPL queue append, all three original effect expiries,
registered-home/pose/anchor preservation, and whole-world queue validation.
Its assertions still need qualification against real completed snapshots.
No journal publication, served browser update or WASM launch has occurred.

After build272 completes, verify its success/current54 compiled inputs and
absence of live build/native processes, prepare a new private session, and run
`--actor-activation` once under the existing55s/512MiB supervision. Never restart
a still-live build from a timeout. Only after native continuation and saved-world
inspection pass may paired source/destination custody publication proceed.


### Pending activation custody publication

Two new scripts prepare the actual next custody step without weakening the
activation gate. `preserve-native-halo-session-activation.mjs` freezes a
successful terminal native producer, independently qualified activation/import/
retirement evidence, exact54 compiled inputs and stopped journal baseline.
`publish-native-halo-session-activation.mjs` then requires that frozen proof
before selecting source0_0/84550 and destination1_0/3550 together as revision5.
It uses the current owner496/GPL22 and the actual destination aliases/proxy,
retains the immutable native home469/GPL7, and preserves northern snapshots.

The publisher plans two invalid-world controls and four interruption/retry
controls on cloned stopped journals before its actual commit. It checks one
selected owner, idempotent retry without writes, bounded4KiB I/O, one leased
owner world, revoked readers and at most two slots per region. The new region
would add one slot, for five retained world files. This is still the existing
serial stopped test-storage guard; it is not an interprocess/browser writer lock.

Both scripts pass `node --check`. Actual paused import268 and its frozen proxy
archive are rejected at the activation-proof gate, creating no archive/output
and changing none of the current revision4 journal files. The read-only control
receipt is `output/native-halo-session-activation-gates-001-observed.json`.
These two refusal checks do not qualify the unexecuted positive path, clone
recovery controls or publication. No custody was changed. Build272 remains the
single live heavy process; its compilation must finish and activation must be
qualified before these scripts may publish the actual journal.


## Qualified destination activation and paired publication (272)

Official build272 completed successfully after one-job regeneration. Its54
compiled inputs match current sources;005b54d0 is a verified hookable config
entry. Private trial018/PID16410 completed0/producer absent in45.831s, with
173.265625MiB sampled peak RSS under the55s/512MiB limits. No browser was used.

The same running hero496/GPL22 crosses east at84550, retires with three attached
units, and the original old world releases eight owned roots. The new region
receives original positive epoch50, pure home proxy34, Warrior532/GPL35 and
children533/534/535. Proxy inspector005 verifies474 prior records exactly;
arrival inspector002 verifies nine imported records and475 prior records
exactly. Original spatial/drawing activation then preserves all484 complete
records across immediate Before/Ready saves, plus complete original roots,
terrain and both RNGs. The only root change is the independently reconstructed
original GPL pending-queue append. The hero retains no command bank.

Seventy ordinary original ticks reach3550. Actual hero AI runs6 times; its
remote use_building dispatch is captured at350 before the local building guard,
then held65 times without changing its home/task/context fingerprint. Other AI
runs2425 times. Original child command calls are52/20/60; ARB2 retires1350,
ARG1 Wait1050, ARG3 Wait3050. Both Wait deadlines match their original saved
stamp plus duration. All three child records/members are absent from the final
save. Hero footprint4, drawing1, queue1, original global position and independent
saved anchor4,8 persist; proxy34 remains pure, unqueued and tied to native home
469/GPL7. Hooks are removed before the original Evolved save and pause.

Activation inspector001 passes after correcting its string read to the parser's
actual text offset. The refused verifier is preserved separately. Native
activation archive272 retains107 sources/92 evidence files, including complete
original Before/Ready/Evolved saves and the old revision4 journal baseline.
Inspecting the live current journal again with that old baseline must now refuse:
the following publication intentionally changes custody.

The stopped publisher validates the exact nine removed source record keys;
its initial mistaken scalar-count check refused before any write and its old
source is retained. Two clone controls reject a still-owning source and a
missing destination hero without writes. Four cloned journals recover from
after-source, after-destination, before-publish and after-publish interruption.
The actual test journal then publishes both retired home0_0/84550 and evolved
east1_0/3550 together as revision5. Its one selected hero is532/GPL35 in1_0,
with immutable home proxy34. Retry writes nothing, owner export opens only
1_0's selected world, and escaped readers are revoked. Both north slots and
all unrelated existing journal files remain exact. There are five world slots,
with at most two per region. The publication archive retains12 sources/91
evidence files, including all refusal/recovery journals. Stale revision4 session
preparation now refuses before creating an output or launching native code.

Commands after the successful272 build:

```sh
node scripts/prepare-native-halo-session.mjs \
  output/native-halo-return-owner-save-001-preserved/manifest.json \
  output/native-world-residency-build-272.json output/native-halo-session-preparation-018
python3 scripts/run-native-halo-session.py \
  output/native-halo-session-preparation-018/preparation.json --attempt 18 --actor-activation
node scripts/inspect-native-halo-session-proxy.mjs \
  output/native-halo-session-attempt-018.json output/native-halo-session-proxy-005-observed.json
node scripts/inspect-native-halo-session-arrival.mjs \
  output/native-halo-session-proxy-005-observed.json output/native-halo-session-arrival-002-observed.json
node scripts/inspect-native-halo-session-activation.mjs \
  output/native-halo-session-arrival-002-observed.json output/native-halo-session-activation-001-observed.json
node scripts/preserve-native-halo-session-activation.mjs \
  output/native-halo-session-activation-001-observed.json output/native-halo-session-activation-generation-272
node scripts/publish-native-halo-session-activation.mjs \
  output/native-halo-session-activation-generation-272/manifest.json \
  output/native-halo-session-activation-publication-001-observed.json
node scripts/preserve-native-halo-session-activation-publication.mjs \
  output/native-halo-session-activation-publication-001-observed.json \
  output/native-halo-session-activation-publication-001-preserved
```

These are historical one-use commands: their outputs already exist, and the
old revision4 preparation is stale. Do not repeat them or overwrite evidence.
Next qualify original fresh-process reload of the selected east3550 owner and
route its preserved remote-home request toward the actual guild, with continued
bounded region release/restore. The prototype still pauses at3550 and uses a
serial stopped journal, not a live browser/shared-writer lock. Seamless browser
travel, co-op regional activation, independent full internet completion and
sustained browser bounds remain unqualified. Browser launches stay suspended.


## Qualified selected eastern reload (274)

Official274 and owned native trial002/PID17888 complete successfully. The
original loader opens the revision5 eastern3550 owner without actor reimport,
postload replay, queue insertion or expired-effect resurrection. Independent
inspection checks all482 complete original records across Reloaded, Loaded and
Ready (1446 exact comparisons), both RNGs, queues and complete normalized roots.
Original spatial footprint4/drawing1/AI queue1 already exist. Ten original ticks
reach4050, holding the saved go_home/use_building request10 times while other AI
runs340 times. Complete hero pose135015,258194,116930 and independent anchor4,8
remain intact. The journal stays revision5/clock3550; the4050 test save is private.

Trial001 on273 aborted at shared fixture admission before loading: its directory
lacked the required halo-world prefix. Its sources and evidence are retained.
Corrected274/trial002 finishes0/producer absent in23.241s, sampled peak
178110464B under35s/512MiB. Reload archive274 retains73 sources/35 evidence files.
Browser launches remain suspended.

## Qualified original homeward movement (276)

The production JS helper web/world/halo-home-leg.mjs reads the selected registered
hero through HeroRouteStore.withOwner. It preserves immutable guild identity,
checks the held original go_home/use_building request and empty native order
record, and plans one cardinal navigation leg toward home. It opens only the
current owner save, retains no multi-region route, and writes no custody or actor
state. Far homes cost one leg; intermediate world saves are not opened. A leg is
a prospective movement goal, never proof of a handoff.

For actual revision5/hero532/GPL35/home proxy34, the selected leg is west toward
local48,126 world units. The integer original Move interface quantizes the
fractional tangent goal; the hero's initial fractional position and saved
anchor are preserved. Pinned instruction audit001 checks11 anchors, virtual
slot114 ->005b4870/RET20 and its original command creation005b48c0. The adapter
uses this original method, without writing native pose, path arrays or banks.
Original AI is held before the remote-building guard; original commands and
other world AI keep running.

Build275 refused compilation because guest_call has no five-scalar overload;
its exact sources/log/report are retained. Corrected276 passes the official
one-job build using the existing argument-array API. Native home-leg trial001/
PID19156 completes0/producer absent in22.798s, peak sampled RSS177094656B under
35s/512MiB. No browser or second native game is launched.

The loader and pre-movement save preserve482 records exactly. Arming preserves
all482 records byte for byte and adds only original ORDR532 plus its original
ORLS registration. All other complete roots, terrain, queues and both RNGs are
exact; total exact record comparisons1446. Original Path4 and Queue7 are created
at3550. Four ordinary50ms ticks reach3750: owned AI held4, other AI130, actual
hero command calls9. Normal original movement changes the pose from
135015,258194,116930 to125384,250634,117986, crossing the west core boundary.
Independent geometry projects it to home0_0 local8251848,250634,117986, preserving
global position and original evolved height. The independent saved anchor becomes
3,7. Footprint4, drawing1 and AI queue1 remain valid.

The complete hero GPL35 and proxy GPL34 records remain exact, including original
contexts and home task. The crossing save has original Move2, Path4 and Queue7;
Path cursor1/count2/capacity10 has original points4,8 ->3,7. Queue cursor1/count1/
capacity10 retains48,126 with procedure/user data zero, not a local guild alias.
Hooks are removed before the original crossing save and pause. No personal
profile, served WASM, source checkpoint or journal file changes; revision5 still
selects the original eastern3550 save. Home-leg archive276 retains81 sources/
37 evidence files. Two initial verifier bookkeeping errors (old runner name,
double-counted attachment ID framing) refused before output; their sources are
retained, and the same native saves pass the corrected independent inspection.

Historical commands, with existing outputs that must not be overwritten:

```sh
node scripts/prepare-native-halo-east-owner.mjs \
  output/native-halo-session-activation-publication-001-preserved/manifest.json \
  output/native-world-residency-build-276.json output/native-halo-home-leg-preparation-001 --home-leg
python3 scripts/run-native-halo-home-leg.py \
  output/native-halo-home-leg-preparation-001/preparation.json --attempt 1
node scripts/inspect-native-halo-home-leg.mjs \
  output/native-halo-home-leg-attempt-001.json output/native-halo-home-leg-001-observed.json
node scripts/preserve-native-halo-home-leg.mjs \
  output/native-halo-home-leg-001-observed.json output/native-halo-home-leg-generation-276
```

Next retire the actually crossed eastern owner, restore the selected dormant
home0_0/84550 save, import with original command clock/coordinate adaptation,
rebind the actual469/GPL7 guild, and resume its original building-use task.
Only independently qualified paired saves may publish the return. This trial
qualifies original homeward motion, not home restoration, return publication,
continuous browser travel, co-op regional activation, independent internet
completion or sustained browser memory bounds. The full goal remains active.

## Original homeward retirement and home import (279,281)

279/home-leg trial004 retires actual hero532/GPL35 at the accepted3750 west
crossing, before another tick. Original removal deletes exactly UNIT/GPL/ORDR/
CONT for this hero; all479 remaining records stay exact. Independent inspection
reconstructs the complete GPL root, removing only its ordered map entry and AI
queue member. Proxy34, other roots, terrain, both RNGs, drawing and registry
members remain unchanged. The CRT actor allocator releases211 allocations;
the separate guest heap remains unchanged.277/278 correctly refused an
unsupported requirement that both unrelated allocators shrink. Their stopped
attempts are retained. Qualified retirement archive279 holds83 sources/39 evidence.

The homeward return preparation uses the frozen actual3750 crossing, plus only
the journal-selected dormant home0_0/84550. It opens no intermediate kingdoms,
copies in4096B pages, revokes readers, preserves the journal and independently
checks ground continuity. Global position and the saved independent anchor
project to home local8251848,250634,117986/grid251,7. Original Move2/Path4/Queue7
commands retain their route/cursors/capacity10 and elapsed times; native IDs
100000/GPL1000 are inert placeholders until the original factory reserves aliases.
Empty optional attachment fields are correctly absent; no empty banks replace
the actual movement state.

281/native homeward import trial001/PID22153 originally reloads that actual home
and imports hero508/GPL25 through original readers. The existing owned command
reader restores three commands using18 reserved allocations/560B, then hands
them to original actor lifetime management. Compact model resolution runs once.
Original native guild469/GPL7 gains both reciprocal memberships. Nothing is
spatially activated or scheduled; the immediate original save precedes cleanup.

Independent inspector001 repeats the production arrival projection and checks
four exact standalone and whole-save records,488 unchanged unrelated records,
only the two declared guild insertions, complete GPL root insertions/counters,
monotonic native ID reservation, other roots, raw terrain, RNGs and queues.
All490 pre-existing records are exact after original cleanup; all18 command
allocations are released. Original loading changes only serialization order
of nine byte-identical keyed ORDR records; cached terrain shading stays exact.
Trial exits0/producer absent in21.306s, sampled native peak175751168B under the
35s/512MiB limits. Build280 had a declaration-order error and is retained;
281 moves the importer after its existing home-task declaration. A verifier
JSON-serialization comparison fix accepts omitted undefined metadata without
rerunning the native game. Import archive281 freezes77 sources/47 evidence files.

Historical commands below have existing outputs and must not overwrite them:

```sh
node scripts/inspect-native-halo-home-leg-retirement.mjs \
  output/native-halo-home-leg-002-observed.json output/native-halo-home-leg-retirement-001-observed.json
node scripts/preserve-native-halo-homeward-retirement.mjs \
  output/native-halo-home-leg-retirement-001-observed.json output/native-halo-homeward-retirement-generation-279
node scripts/prepare-native-halo-homeward-return.mjs \
  output/native-halo-homeward-retirement-generation-279/manifest.json output/native-halo-homeward-return-preparation-001
DEVELOPER_DIR=/Library/Developer/CommandLineTools \
  upstream/majesty-recomp/.venv/bin/python scripts/build-native-world-residency.py --attempt 281
node scripts/prepare-native-halo-homeward-import.mjs \
  output/native-halo-homeward-return-preparation-001/preparation.json \
  output/native-world-residency-build-281.json output/native-halo-homeward-import-preparation-001
python3 scripts/run-native-halo-homeward-import.py \
  output/native-halo-homeward-import-preparation-001/preparation.json --attempt 1
node scripts/inspect-native-halo-homeward-import.mjs \
  output/native-halo-homeward-import-attempt-001.json output/native-halo-homeward-import-001-observed.json
node scripts/preserve-native-halo-homeward-import.mjs \
  output/native-halo-homeward-import-001-observed.json output/native-halo-homeward-import-generation-281
```

Current journal remains revision5/east3550. The retired3750 eastern save and
imported84550 home save are private stopped evidence, not a completed paired
return. Next qualify original destination collision/spatial activation,
postload without a second model resolution, scheduling and ungated home AI,
then commit actual source retirement and destination arrival together.
Continuous browser/camera travel, co-op regions, independent full internet
completion and sustained browser memory bounds remain unqualified. Browser
launch suspension continues; the full goal stays active.

### Original homeward activation and gameplay continuation (284)

Official build284 passes. Homeward preparation003 requires the frozen qualified
281 import before permitting explicit `--activate`. Original collision and
postload methods insert hero508/GPL25 at its saved anchor251,7, retain the
populated Move/Path/Queue bank and both real guild469/GPL7 memberships, and
append the hero to the original pending AI queue. The already-resolved model
helper is guarded exactly once; activation neither resets its route nor advances
the clock. Temporary script membership operands are released after the list
owns its copy. Observers always call the original AI, context and command methods.

Trial004/PID24179 exits0/absent in30.762s with sampled peak176324608B. The original
engine advances84550→94550 over200 ticks:208 hero AI calls,4440 other AI calls,
1606 hero contexts, one original building-use call and405 hero command calls.
Pose advances from8251848,250634,117986/anchor251,7 to
7273079,557056,139839/anchor221,17. Original hooks are removed, the evolved save
is written and an original pause is requested. No clock/timer writes or original
phase-resume request occurred. The hero is still outside the guild, with
`go_home`, `home=7` and `target=7`; entering the guild is not established.

Import inspector002 checks the exact four-record import independently.
Activation inspector001 checks all494 keyed records byte-for-byte before and
after activation, reconstructs the entire GPL root's sole queue append,
checks all other roots/RNG/terrain unchanged at activation, and verifies live
saved alias ownership, reciprocal rosters and scheduling after200 ticks.
All16641 terrain heights stay exact through gameplay; live terrain cache/state
bytes are allowed to evolve. Archive284 freezes79 sources/50 evidence files.

Build282 was compile-only;283's shorter trial002 produced a Ready save but
no endpoint.284 trial003 observed clock advancement but also ended before the
endpoint. These incomplete receipts remain retained. Trial004 extended only
the activation runner's post-startup window from8s to18s, with45s deadline,
512MiB RSS and4MiB log ceilings; it uses the same284 executable. This supplies
the requested ten seconds of gameplay without treating startup time as play.

Historical commands below have existing outputs and must not overwrite them:

```sh
python3 scripts/run-native-halo-homeward-import.py \
  output/native-halo-homeward-import-preparation-003/preparation.json --attempt 4 --activate
node scripts/inspect-native-halo-homeward-import.mjs \
  output/native-halo-homeward-import-attempt-004.json output/native-halo-homeward-import-002-observed.json
node scripts/inspect-native-halo-homeward-activation.mjs \
  output/native-halo-homeward-import-002-observed.json output/native-halo-homeward-activation-001-observed.json
node scripts/preserve-native-halo-homeward-import.mjs \
  output/native-halo-homeward-activation-001-observed.json output/native-halo-homeward-activation-generation-284 --activate
```

The actual journal remains revision5/east3550. Private original east retirement
at3750 and home continuation at94550 are now independently qualified, but
their paired publication is still next work. Continuous camera/browser travel,
co-op regions, independent internet full-match completion and sustained browser
memory remain unqualified. Browser launches remain suspended.

### Paired homeward publication and selected home reload (286)

`publish-native-halo-homeward-route.mjs` joins frozen original east retirement3750
and the qualified home continuation94550 from archive284. It checks both original
producer terminals, all frozen evidence, current custody reader hashes and the
entire selected revision5 journal before staging anything. Two invalid pairs
(source still owns the hero; destination predates import) are rejected with zero
writes. Four cloned interruptions at after-source, after-destination,
before-publish and after-publish recover under one owner. Only the head publication
selects both changed worlds; retry after publication performs no writes.

Actual journal `actor-arrival-fixture-hero-route-z81GCJ` is now revision6, sole
owner0_0/UNIT508/GPL25/home469/GPL7, home clock94550, retired east clock3750 with
pure proxy34 preserved. Six world slots remain, two per visited region; both
northern saves and previous selected home/east slots stay exact. Owner export
opens only home0_0_1; paired export opens only home and east. Readers are revoked
after the lease, and copies stay bounded at4KiB with one active read. This is the
owned stopped native journal; its serial lock does not establish a live browser
or multiplayer writer lock.

Original full-world reload now consumes that actual selected home save. It does
not reimport the hero, replay postload, insert an AI queue, repair commands or
restore expired effects. Observer285 initially refused the valid evolved script
because it expected `use_building`, while the original200-tick save has moved to
the `travel_to` substep of `go_home`. Failed generation285 retains83 files and
terminal PID25003/exit6; the loaded original snapshot already exists.286 admits
that exact saved context with unchanged home/target7 and task `go_home`. The
unused speculative original paused-overlay resume branch from284 was removed;
neither this reload nor the earlier continuation needs it.

Official286 passes. Native owner trial002/PID25505 exits0/absent in22.808s with
sampled peak176275456B, under35s/512MiB/4MiB ceilings. Ten original ticks advance
94550→95050:11 hero/229 other AI calls,50 hero contexts and20 commands. Pose moves
7273079,557056,139839/anchor221,17→7213119,557056,126360/anchor220,17. No new
building-use call is required while its existing travel task continues. Hero is
still outdoors; physical guild entry remains unqualified.

Owner inspector001 checks all504 original keyed records in each of the reload,
Loaded and Ready saves (1512 comparisons), both original queues, full world/RNG
state, reciprocal guild memberships, the restored populated Move/Path/Queue bank
and the saved evolving pose. Original loading permutes twelve byte-exact keyed
ORDR records; raw terrain shading stays unchanged. Archive286 freezes73 sources/
36 evidence files and refers to the prior archive284 and publication proof.
The private95050 continuation is not selected; the actual journal stays revision6
at94550.47 focused route/home-leg/companion-orders/registered-arrival tests pass;
receipt output/halo-homeward-route-tests-001.log.

Historical commands have preserved outputs and must not overwrite them:

```sh
node scripts/publish-native-halo-homeward-route.mjs \
  output/native-halo-homeward-activation-generation-284/manifest.json \
  output/native-halo-homeward-route-publication-001-observed.json
node scripts/prepare-native-halo-homeward-owner.mjs \
  output/native-halo-homeward-route-publication-001-observed.json \
  output/native-world-residency-build-286.json output/native-halo-homeward-owner-preparation-002
python3 scripts/run-native-halo-homeward-owner.py \
  output/native-halo-homeward-owner-preparation-002/preparation.json --attempt 2
node scripts/inspect-native-halo-homeward-owner.mjs \
  output/native-halo-homeward-owner-attempt-002.json output/native-halo-homeward-owner-001-observed.json
node scripts/preserve-native-halo-homeward-owner.mjs \
  output/native-halo-homeward-owner-001-observed.json output/native-halo-homeward-owner-generation-286
```

The native crossing, source retirement, home import, original AI continuation,
paired save and selected-owner reload now have independent evidence. Continuous
camera travel within one paged session, co-op regional ownership, a full match
between independent internet endpoints and sustained browser resource bounds
remain open. The full goal stays active; browser launches remain suspended.

### Returned home and east paging in one session (286)

New homeward session preparation001 exports only actual journal revision6's
home94550 and retired east3750. It requires frozen selected-owner reload286,
checks both selected digests and aliases, reads only those two worlds and
revokes both readers. The journal remains unchanged. The existing session
runner gains explicit `--homeward-paging`; original actor-crossing modes retain
their own gates. No new engine build is needed: the current286 executable
already supports original save/unload/load and named region requests.

Native session trial019/PID25774 performs0_0→1_0→0_0→1_0→0_0 with four named
requests in one process. All five regions load saved worlds; no fresh region
or second hero is generated. Original world roots, terrain530456B and spatial
storage524288B are released at each departure, observer hooks are removed,
and both heap bytes and live block counts fall on all four unloads. Saved home
clocks restore94550→95700→96800; saved east clocks restore3750→4900 and finally
persist5950. Only the active region advances. The hero remains in its home;
camera paging does not constitute hero transfer or paired custody publication.

Independent homeward session inspector001 compares2469 keyed records exactly
across all five loads, full world/RNG/queues and original serialization
permutations. It verifies hero508/GPL25's registered native/script guild469/GPL7,
absence of retired home aliases, retired east owner532/GPL35 with dormant proxy34,
and home pose continuity between visits. Home hero positions advance naturally
7273079,557056,139839→7129690,557056,104783→7045120,589824,75821. Four operational
world slots remain, two per region; marker/layout digests select actual saved
checkpoints. The original persistent journal still selects home94550/revision6.

Trial exits0/absent45.776s; sampled peak182960128B, under55s/512MiB/4MiB ceilings.
This bounded four-disposal run does not establish leak-free indefinite expansion
or sustained browser memory.41 focused session-route/control/input/route-store/
halo-layout tests pass (output/native-halo-homeward-session-tests-001.log).
Frozen homeward session286 retains73 sources/52 evidence files and refers to
selected-owner archive286. All artifacts are private native evidence; the served
WASM, personal profiles and user browser state remain preserved.

Historical commands have existing outputs and must not overwrite them:

```sh
node scripts/prepare-native-halo-homeward-session.mjs \
  output/native-halo-homeward-owner-generation-286/manifest.json \
  output/native-world-residency-build-286.json output/native-halo-homeward-session-preparation-001
python3 scripts/run-native-halo-session.py \
  output/native-halo-homeward-session-preparation-001/preparation.json --attempt 19 --homeward-paging
node scripts/inspect-native-halo-homeward-session.mjs \
  output/native-halo-session-attempt-019.json output/native-halo-homeward-session-001-observed.json
node scripts/preserve-native-halo-session.mjs \
  output/native-halo-homeward-session-001-observed.json output/native-halo-homeward-session-generation-286 --homeward-paging
```

Next qualify actual pointer/camera boundary departure with these selected saves,
then combine camera paging with automatic actor custody when a hero crosses.
Co-op regions, independent internet full-match completion and sustained browser
resource bounds remain open. Keep the browser launch suspension and full goal.

### Pointer-driven saved-region travel (286)

Native session trial021 uses the same286 executable and actual selected
revision6 home94550/east3750 saves. Original window input scrolls east until
the camera clamps, holds for1055ms, and emits a boundary gesture. The production
NativeRegionSession JavaScript parser admits that gesture; the native request
bridge delivers its named action. Original save/unload/load enters the saved
east at x=0,y=22. West scrolling holds for1005ms and returns home at x=3506,y=22.
The original camera setter preserves the vertical coordinate on both arrivals.
No browser is launched, and no actor transfer or custody publication occurs.

Independent pointer inspector001 verifies1487 keyed records exactly over three
loads, full world/RNG/queues, hero508/GPL25's guild and absence of retired east
aliases. Both departures free eight world roots,530456B terrain and524288B
spatial storage; heap bytes and block counts fall. Four operational save slots
remain, two per region. Actual journal revision6/home94550 remains unchanged.
Trial021/PID26520 exits0/absent45.775s, sampled peak188465152B (~180MiB).
41 focused tests pass. Frozen pointer session286 retains77 sources/46 evidence
files, including the production parser and native bridge. This proves two
native pointer-driven saved-region crossings, not sustained browser memory.

Trial020's two crossings occurred but its strict host pointer-mapping check
failed: requested x=797 mapped to799, outside the original one-pixel tolerance.
Its22-file refused archive is retained. Trial021 requests the actual edge799;
the original mapping check and game code were unchanged.

Historical commands (existing outputs must not be overwritten):

```sh
python3 scripts/run-native-halo-session.py \
  output/native-halo-homeward-session-preparation-001/preparation.json --attempt 21 --pointer-paging
node scripts/inspect-native-halo-homeward-session.mjs \
  output/native-halo-session-attempt-021.json output/native-halo-pointer-session-001-observed.json --pointer-paging
node scripts/preserve-native-halo-session.mjs \
  output/native-halo-pointer-session-001-observed.json output/native-halo-pointer-session-generation-286 --pointer-paging
```

Continue with automatic hero custody into saved neighbors. Existing actor
paging assumes a freshly generated region and does not yet admit the saved
east. Browser launch suspension, co-op regional ownership, full independent
internet matches and sustained browser resource bounds remain open.

### Returning-hero departure preparation against a saved neighbor (286)

Homeward preparation now accepts explicit `--actor-crossing`, derives current
hero508/GPL25 and its actual outdoor pose from the selected94550 home save,
and verifies the visited east through HeroRouteStore's two-world read lease.
The production remote-home reuse planner confirms existing pure proxy34:
453 bytes, unscheduled, no native backlink, exact immutable guild identity.
Preparation003 binds that existing alias, destination clock3750 and the selected
world digest. It neither allocates another proxy nor resets the neighbor clock.
Both source readers are revoked; journal revision6 remains unchanged.

The runner admits returned-home crossing/retirement only with the explicit
bound actor preparation. Actor paging into this saved neighbor is still
rejected because the current native actor-page path requires a fresh kingdom.
This guard prevents interpreting saved state as a zero-clock generated world.

Trial022/PID26992 reused286 with preparation002. Original reward511 was created
at94650 and original hero motion was observed, but no accepted crossing or
retirement occurred before the bounded run ended. Exit0/absent does not qualify
hero travel: the supervisor marks the trial incomplete. Its84-file archive
output/native-halo-current-actor-attempt-022-incomplete/manifest.json preserves
sources, saves and logs before preparation was extended. No paired publication
or persistent custody change occurred. The next native step needs a departure
that respects the returning hero's original task, followed by saved-neighbor
load/hold/import/resume using clock3750 and proxy34. Browser launch suspension
and the full goal remain in force.

Historical preparation commands:

```sh
node scripts/prepare-native-halo-homeward-session.mjs \
  output/native-halo-homeward-owner-generation-286/manifest.json \
  output/native-world-residency-build-286.json output/native-halo-homeward-session-preparation-003 --actor-crossing
```

49 focused session, route-store, halo-layout and remote-home tests pass;
receipt output/native-halo-current-actor-tests-001.log. Node/Python syntax
and targeted diff checks pass.207 preserved source/evidence hashes verify,
actual journal hashes remain unchanged and both native producers are absent.

### Original hero departure and saved-neighbor hold (288)

The selected returning hero508/GPL25 now crosses east in one original native
session and pages into the previously visited eastern kingdom. The native-only
`--actor-move` test issues original005b4870 at94550 toward4064,272. It never
writes a pose or task; before/ready saves preserve all script bytes and position.
Hero AI remains ungated. The original movement crosses at103500:
8246540,557056,86067→8258702,557056,84309, projected into the east at
132238,557056,84309. This is an explicit original movement request for the test,
not a qualified autonomous response to an explore bounty.

Original paused source retirement removes UNIT508/GPL25/CONT508/ORDR508,
updates both real guild rosters, and preserves503 unrelated records, remaining
queues, registry, order registration list, other roots, terrain and RNG.
The two-slot original writer saves that retired source before teardown. Eight
world roots,530456B terrain and524288B spatial storage are freed; heap bytes
24882256→22478384 and blocks1758→1682. All release observers are removed.

A new explicitly bound saved-neighbor mode checks original admitted save clock
3750 before source teardown. It restores the east through the original reader
and requests original pause before its first simulation tick. The east stays
at3750 and retains existing inert pure guild proxy34. No fresh kingdom is
generated, no zero-clock epoch tick runs, and no duplicate proxy is allocated.
Native actor paging modes for fresh kingdoms keep their own existing paths.

Trial024/PID28495 exits0/absent45.837s, sampled peak181288960B (~173MiB), under
55s/512MiB/4MiB ceilings. Independent saved-actor inspector001 proves1463 exact
checkpoint records across source publication, saved-east load and held east,
full world/RNG/queues, existing unscheduled proxy34 and retired eastern aliases.
Actual persistent journal stays revision6/home94550; no custody is published.

Preparing the next import exposed a logical destination outside the active
map: the hero still carries its registered home goal. The registered arrival
planner now preserves that goal globally, validating it in the immutable home
region. It supports both outward and homeward legs without clamping or changing
physical actor, anchor or native path bounds. Only a typed registered `go_home`
request targeting that registered guild uses this policy; other destinations
retain their physical overlap check. New tests cover outward negative local
coordinates, restoring the original home goal and refusal for an explore task.
The plan explicitly requires remote-home routing before native AI activation.

Saved arrival preparation003 produces four inert original-reader records,
2760 bytes: UNIT442/GPL1850/CONT76/ORDR392. It preserves the accepted global pose,
Z/ground offset, independent navigation anchor, home reference34, original
Path/Queue banks and modular dispatch/context ages at destination3750. It
allocates no actor and leaves both saves/journal unchanged. Native import,
collision/render/AI activation and paired custody publication remain unfinished.

107 focused tests pass in output/native-halo-saved-actor-focused-tests-001.log.
Frozen saved-actor288 retains106 sources/59 evidence files, current capsule and
selected-owner286 predecessor. Refused generation287/trial023 is retained in an
88-file archive: its new move checkpoint labels were omitted from the owned
snapshot admission, so it stopped before departure.288 admits only those two
native move snapshots at serial0 and verifies the current `travel_to` task.

Historical commands (preserve existing outputs):

```sh
DEVELOPER_DIR=/Library/Developer/CommandLineTools upstream/majesty-recomp/.venv/bin/python scripts/build-native-world-residency.py --attempt 288
node scripts/prepare-native-halo-homeward-session.mjs \
  output/native-halo-homeward-owner-generation-286/manifest.json \
  output/native-world-residency-build-288.json output/native-halo-homeward-session-preparation-005 --actor-crossing
python3 scripts/run-native-halo-session.py \
  output/native-halo-homeward-session-preparation-005/preparation.json --attempt 24 --saved-actor-paging --actor-move
node scripts/inspect-native-halo-saved-actor-paging.mjs \
  output/native-halo-session-attempt-024.json output/native-halo-saved-actor-paging-001-observed.json
node scripts/prepare-native-halo-saved-arrival.mjs \
  output/native-halo-saved-actor-paging-001-observed.json output/native-halo-saved-arrival-preparation-003
node scripts/preserve-native-halo-saved-actor-paging.mjs \
  output/native-halo-saved-actor-paging-001-observed.json \
  output/native-halo-saved-arrival-preparation-003/preparation.json output/native-halo-saved-actor-generation-288
```

Next implement original import into this held saved neighbor, then qualify
remote-home task routing and gameplay resume before publishing custody. Browser
launch suspension remains in force; co-op regions, independent internet full
matches, unlimited exploration and sustained browser resource bounds remain
unfinished. Keep the full goal active.

## Original import into a saved neighbor (290)

Native session trial025 continues the actual accepted crossing from selected
home508/GPL25 at103500, original retirement/disposal, and saved-east restore at
3750. The live bounded arrival helper preserves its producer manifest before
the supervisor updates it and creates a hash-bound2856B pack containing four
records2760B. No fresh kingdom, clock epoch step or replacement guild proxy is
created. The original readers and factory reservations create UNIT537/GPL37,
restore CONT537 and populated Path/Queue ORDR537, and retain pure home proxy34.

Independent saved-arrival inspector001 re-runs the production planner against
the actual held source/destination, reconstructs the entire pack and compares
all four original-writer records with only the new native/script IDs rebound.
All479 pre-existing records remain byte exact. Complete changed roots are
reconstructed: one native reservation, one script-map insertion, one container,
one order bank and one ordered command registration. Other roots, terrain,
RNG, saved clock and AI queues are exact. The original guild reference remains
pure and reciprocal hero native/script identity is valid. All1463 earlier
checkpoint comparisons, source retirement and disposal checks also pass.

The hero remains deliberately unscheduled and the region remains paused3750.
Production custody validation still requires a scheduled owner; that guard
has not been weakened to accept this intermediate import. Actual journal
revision6/home94550 is unchanged. Native025/PID30015 exits0 and is absent;
no browser launches occur. Official build289 failed a mixed-auto C++ declaration;
one declaration fix produces successful290.107 focused tests pass in
output/native-halo-saved-arrival-focused-tests-001.log. Frozen290 preserves the
qualified import sources/evidence linked to saved-paging288 and selected-owner286.

Historical commands (preserve existing outputs):

```sh
DEVELOPER_DIR=/Library/Developer/CommandLineTools upstream/majesty-recomp/.venv/bin/python scripts/build-native-world-residency.py --attempt 290
python3 scripts/run-native-halo-session.py \
  output/native-halo-homeward-session-preparation-006/preparation.json --attempt 25 --saved-actor-arrival --actor-move
node scripts/inspect-native-halo-saved-arrival.mjs \
  output/native-halo-session-attempt-025.json output/native-halo-saved-arrival-001-observed.json
node scripts/preserve-native-halo-saved-arrival.mjs \
  output/native-halo-saved-arrival-001-observed.json \
  output/native-halo-saved-arrival-live-preparation-025/preparation.json output/native-halo-saved-arrival-generation-290
```

Next qualify original collision/render postload and scheduling, with routing
for the retained remote `go_home`/`travel_to` goal before AI resume. Then qualify
paired custody publication and selected-owner reload. Browser stability, co-op
regional ownership, full internet match completion and sustained browser memory
bounds remain unfinished; the full goal stays active.

## Saved-neighbor activation and original homeward leg (291)

The saved-east import now continues through original collision clearance,
first/second postload, spatial admission, drawing registration and one original
pending AI-list append. The already completed model resolver is cached for
exactly that guarded postload call. Existing populated Path/Queue banks stay
intact at the activation boundary. The existing pure guild proxy34 is reused.

Production checkpointHaloHomeLeg validates reciprocal hero identity, immutable
guild registration, a pure unscheduled proxy, a stopped travel_to/go_home task,
and the signed global home goal. It chooses one cardinal physical leg toward
that registered region. Distant diagonal returns take one region at a time;
local-home tasks retain original local navigation. Invalid goals, stale owner
poses, foreign guild targets, borrowed local parents, executing contexts and
impure proxies refuse preparation. Twelve new focused tests cover these cases.

For current UNIT537/GPL37, the preserved destination(-608,160) is global
(3296,96), inside the registered home0_0. The physical leg is(32,272), toward
the west boundary. A producer-bound packet ties this production route to the
actual imported3750 save. Original005b4870 issues that movement command;
no pose or script destination is written. The hero's original AI scheduler and
other AI execute. Only the remote travel_to/use_building ingress is routed
before its local-only guild lookup; its logical home task remains pending.
The original native command banks execute the physical movement normally.

Trial026/PID31214 activates at3750 and crosses west at4050 after six original
ticks. Previous pose132238,557056,84309 becomes120063,557056,85977 under original
movement. At the accepted crossing, the private eastern world is saved and
paused before another simulation tick; temporary observers are removed. Counts
are6 hero AI,210 other AI,1 routed context and14 hero command calls. This is an
actual accepted return leg, not a completed import into the home region.

Independent activation inspector001 compares all483 records exactly before/
after activation and reconstructs the complete GPL queue append. Route issuance
changes only the hero's ORDR bank;482 other records and every other world root
remain exact at3750. Registered guild links and the signed home goal remain
valid in every saved snapshot. The endpoint pose exactly matches the original
crossing observation and production planHaloActorHandoff selects0_0. All16641
terrain heights are exact; the entire MTER root differs only at28 monotonic
player-zero explored-bit additions from ordinary gameplay.

Native exits0/absent45.843s, sampled peak177471488B under55s/512MiB/4MiB.119
focused tests pass in output/native-halo-saved-activation-focused-tests-001.log.
Frozen291 retains111 sources/83 evidence files linked to saved-import290,
saved-paging288 and selected-owner286. Actual journal remains6/home94550;
this private crossing has not published custody. Browser launches remain
suspended. The native continuation currently qualifies this bound saved-east
return scenario; general multi-region live routing needs further integration.

Historical commands (preserve existing outputs):

```sh
DEVELOPER_DIR=/Library/Developer/CommandLineTools upstream/majesty-recomp/.venv/bin/python scripts/build-native-world-residency.py --attempt 291
node scripts/prepare-native-halo-homeward-session.mjs \
  output/native-halo-homeward-owner-generation-286/manifest.json \
  output/native-world-residency-build-291.json output/native-halo-homeward-session-preparation-007 --actor-crossing
python3 scripts/run-native-halo-session.py \
  output/native-halo-homeward-session-preparation-007/preparation.json --attempt 26 --saved-actor-activation --actor-move
node scripts/inspect-native-halo-saved-arrival.mjs \
  output/native-halo-session-attempt-026.json output/native-halo-saved-arrival-002-observed.json
node scripts/inspect-native-halo-saved-activation.mjs \
  output/native-halo-saved-arrival-002-observed.json output/native-halo-saved-activation-001-observed.json
node scripts/preserve-native-halo-saved-activation.mjs \
  output/native-halo-saved-activation-001-observed.json output/native-halo-saved-activation-generation-291
```

Next retire this accepted eastern owner, restore the exact selected home,
import/activate the original return and publish both stopped regions together.
Co-op regional ownership, independent internet full matches, sustained browser
resource bounds and browser stability remain unqualified. Full goal active.

## Saved return retirement and held home reload (292)

Trial027 completes the native home → saved east → home paging route. After
original movement crosses west at eastern clock4050, original removal retires
UNIT537/GPL37 and its container/order records. All479 remaining eastern records
are byte exact, including the registered home proxy34. The second original
world disposal releases eight roots,530456 terrain bytes and524288 spatial
bytes. Home reloads at103500 and pauses before its first ordinary tick.

Independent return inspector001 verifies1489 record comparisons across the
retired eastern save, home reload and held home. Offline preparation002
constructs four home-arrival records totaling2920 bytes in a3016-byte pack,
preserving Move/Path/Queue commands and rebinding the guild reference to the
real home building469/GPL7. No incoming hero has been imported or activated
at this restored home, and custody has not been published. The actual journal
remains revision6/home94550; these private retired saves must not replace it.

Official build292 succeeds. Native exits0 and is absent after45.833s, with
180420608 bytes sampled peak RSS. All119 focused tests pass. Frozen generation292
retains114 sources and99 evidence files, linked to291/290/288/286. The proof is
output/native-halo-saved-return-page-001-observed.json; the archive is
output/native-halo-saved-return-page-generation-292/manifest.json.

Next import and activate the returning hero at the held home, then publish
both regions together and reload the selected owner. Browser launches remain
suspended under the crash constraint. Co-op regional ownership, independent
internet full matches and sustained browser resource bounds remain unqualified.

## Saved-region return imported into held home (294)

Trial029 now imports the actual eastern4050 crossing into the held home103500
in the same native session that performs home → saved east → home. Production
arrival planning projects the accepted pose into home, preserves all three
Move/Path/Queue entries and rebinds typed home references to469/GPL7. Original
readers allocate UNIT513/GPL29 and restore both reciprocal guild memberships.
The four records total2920 bytes; the pack is3016 bytes and ORDR is544 bytes.
Temporary membership operands and scratch storage are freed after insertion.

Independent home-arrival inspector001 repeats production planning, rebinds
only the actual original aliases and compares all four standalone records
and all four records in the original whole-world save. It compares503 unrelated
home records exactly, reconstructs both roster insertions and the complete
GPL root, and verifies monotonic alias reservations, order registration,
unchanged queues, drawing, terrain and RNG. Home remains paused, unscheduled
and unactivated. No ordinary home tick or custody publication is claimed.

The same run requalifies saved-east import and activation, its accepted
4050 return crossing,479 exact remaining eastern records and1489 exact
retirement/reload comparisons. Official294 succeeds; native exits0/absent
after45.826s with180273152 bytes sampled peak RSS.119 focused tests pass.
The proof is output/native-halo-saved-home-arrival-001-observed.json and the
frozen archive is output/native-halo-saved-home-arrival-generation-294/manifest.json.

Official293 compiled successfully, but trial028 refused before allocation:
the new import admission inherited an older fixture's BROWSER_STREAMING_DEBUG
requirement.294 removes that unrelated requirement while retaining the explicit
owned-session flags, phase, clock, packet and hash checks. Failed028 outputs
remain preserved. The selected journal remains revision6/home94550 and player
profiles remain unchanged throughout both trials.

Next finish original postload/scheduling at home, resume the returned hero's AI,
then publish both regions together and qualify selected reload. Browser
launches remain suspended; co-op regions, independent internet full matches and
sustained browser resource bounds remain unqualified. The full goal is active.

## Saved home activation and original gameplay (297)

Trial032 now activates the actual UNIT513/GPL29 return at home103500 in the
same home → saved east → home native session. Original collision clearance,
remaining postload, spatial/drawing registration and pending AI queue insertion
run without replacing the retained Move/Path/Queue banks. The completed model
resolver is cached for exactly the guarded original postload call. All AI,
context and command observers continue the original implementations, including
the real guild's building-use routine; no remote proxy gate is used at home.

Original gameplay advances200 ticks to113500, with209 hero AI calls,4791 other
AI calls,1540 contexts,one building-use call and388 command calls. The hero moves
from8246527,557056,85977/grid251,17 to7087173,557056,81535/grid216,17. Its four-cell
physical footprint, drawing, scheduling and both reciprocal guild memberships
remain valid. Observers are removed before the original evolved save and pause.
Physical entry into the guild is not qualified by a building-use call.

Independent home-activation inspector001 compares all509 records exactly at
activation and reconstructs the entire GPL-root queue insertion. All other
roots, terrain and RNG remain exact at that boundary. It verifies original
owner scheduling/typed references after activation and gameplay, actual saved
poses, counts and complete terrain bytes through all200 ticks; no terrain
exploration bits change in this run. The same session independently requalifies
earlier east activation, accepted return, retirement, unload, held-home reload
and import.119 focused JavaScript tests pass.

Official295 and296 compiled successfully. Trial030 safely stopped before
activation because its helper used a scheduled-owner validator for the
unscheduled held import. The corrected helper explicitly checks zero queue
entries, native/script identity and registered guild membership. Trial031
activated successfully but hit the55-second bound because the new before-tick
guard returned the value that skips the original tick.297 corrects that return
value; bounded observation logs confirm original AI and contexts return.
Both unsuccessful native processes are stopped and their outputs are preserved.

Official297 succeeds. Qualified032 exits0/absent after45.842s with181747712
bytes sampled peak RSS, under55s/512MiB/4MiB ceilings. The proof is
output/native-halo-saved-home-activation-001-observed.json and frozen provenance
is output/native-halo-saved-home-activation-generation-297/manifest.json.
Selected journal remains revision6/home94550; player profiles are unchanged.

Next publish the stopped retired east4050 and scheduled home113500 together,
then reload the selected owner through the original engine. Browser launches
remain suspended. Co-op regions, independent internet full matches and sustained
browser resource bounds remain unqualified; the full goal remains active.

## Saved round-trip publication and selected home reload (298)

The stopped original session now publishes both actual crossings through the
existing HeroRouteStore contract. Starting from selected revision6/home508/25,
revision7 selects retired home103500 plus activated east3750/537/37. Revision8
then selects retired east4050 plus scheduled home113500/513/29. Each publication
atomically selects both sides and a single scheduled owner. Intermediate
revision7 is a valid saved owner if the return publication is interrupted.

Publisher001 verifies the frozen297 native provenance and unchanged custody
reader code before writing. Copies qualify eight interruption/restart recoveries
(four boundaries for each crossing), four invalid-source/destination refusals,
and a stale outward request after the completed return. Refusals add zero
writes; both actual commits retry idempotently without writes. The six world
slots remain bounded at two per visited region. Northern checkpoints and all
prior metadata are unchanged. Owner export opens only home and revokes its
reader; paired export opens only home/east, with4KiB reads/writes and one peak
open reader. This stopped serial adapter does not qualify a browser writer lock.

The selected-owner export is admitted at revision8/home113500 and copied into
one isolated original-engine reload. Native owner001 restores its existing
actor, populated orders, spatial/drawing membership and single AI queue without
reimport, replayed postload or queue insertion. Ten original ticks reach114000,
with10 hero AI/240 other AI/100 contexts/21 command calls. The hero moves from
7087173,557056,81535/grid216,17 to7045120,589824,75821/grid215,18. It remains
outdoors with both guild memberships intact; physical guild entry is unproven.

Independent owner inspector001 checks510 exact selected records against three
original reload/ready saves, totaling1530 record comparisons. The selected
world has one additional original ORDR476 record created during the preceding
200 ticks, beyond the509 records at activation. The hero's Move/Path/Queue
banks are unchanged through reload; the Move entry finishes during subsequent
gameplay, leaving Path/Queue at114000. Scheduled-owner typed references,
registered guild identity, poses, original method counts and journal hashes
are verified independently.

Official298 succeeds. Native exits0/absent after23.324s, sampled peak176799744B
under35s/512MiB/4MiB.119 focused tests pass. Frozen
output/native-halo-saved-home-owner-generation-298/manifest.json preserves
selected revision8 and links297 activation/publication provenance. Publication
proof is output/native-halo-saved-roundtrip-publication-001-observed.json;
reload proof is output/native-halo-saved-home-owner-001-observed.json. The
actual journal now selects revision8/home113500; private continued114000 state
does not replace that selected save. Player profiles remain unchanged.

Saved-region actor departure, retirement, unload, saved reattachment, import,
original continuation, custody publication and selected reload now have a
complete native round-trip proof. General browser integration, shared co-op
regional ownership, independent internet full matches and sustained browser
resource bounds remain unqualified. Browser launches stay suspended and the
full goal remains active.
