# Original world disposal required before session travel

The named-world session now observes the original teardown before it permits
another kingdom to load. It tracks eight distinct addresses: the world, factory,
terrain, spatial grid, the grid's two pointer tables and the terrain's cell and
vertex buffers. The original CRT free
wrapper must acknowledge each exactly once. The adapter never frees an object
itself or dereferences a departed root.

One temporary free hook is installed after the durable checkpoint and before
the original full Quit Game action. This includes cleanup that happens before
dispatcher disposal. After the original disposal returns, the session checks
the eight acknowledgements, null world, valid heap and unchanged hook count, then
switches the profile. At the empty-world menu boundary it removes the observer
and clears all retained root addresses before generation or restoration. Its
storage is fixed; it adds no free observer to ordinary gameplay between trips.

The engine advertises `release=v2` alongside the existing session version. When
that contract is advertised, browser controls require the matching release and
observer-removal events before moving the active-region read capability and
URL. Partial frees, stale/source-mismatched acknowledgements, missing removal
and retained observer roots cannot activate the destination. Older engines that
do not advertise the contract retain their existing behavior.

## Earlier six-root verification

Official native115 builds through the one-job official smoke tool. Trial006
uses the production session path for thirteen visits through five kingdoms,
including four fresh generated kingdoms and saved returns. PID92518 exits0
without a guard stop. All twelve transitions acknowledge six original frees
each (72 total), then remove the temporary hook with one persistent session
hook remaining. The final save-only request installs no release observer.

Independent stopped inspection passes actual lifecycle order, named save
routing, positive AI populations, latest saved clocks/RNGs, all five final
checkpoint digests and five129-vertex height borders.437 original ticks advance.
Guest heap usage falls at every disposal; after-disposal values still vary
between22,746,544 and24,497,280 bytes. Peak sampled native RSS is177,078,272 bytes
in the52-second trial. These are observations, not sustained memory bounds or
a comparison proving a speed/RSS improvement.

Source145 and actual staged94 terminal tests pass, including replay of all
twelve transitions with fixed DOM, one world lease and zero navigation.
Nineteen contradictions reject missing/retained/wrong-order disposal, observer
removal and existing lifecycle failures, plus the earlier actual zero-agent
generated save. Five game configuration tests pass.

Only `world/native-session-controls.mjs` is staged; its source, staged and static
HTTP hashes match. All four served engine artifacts retain their hashes, sizes,
inodes and modification times. A separate official WASM candidate002 compiles
the new contract with conservative heap growth and passes bounded static
inspection of linked protocol strings and actual memory/glue settings. No
browser, WASM module or real WASM memory is started for inspection or replay;
the candidate is not staged.

Evidence:

- `output/native-region-session-attempt-006.json` and
  `output/native-session-release-001-observed.json`: terminal native production
  trace and stopped inspection.
- `output/native-session-release-001-controls.json`: nineteen contradictions.
- `output/native-session-release-generation-115-preserved.json`: exact native
  source, executable, symbols and evidence, copied with4096-byte reads.
- `output/native-session-release-002-staged.json`: controller publication,
  preserved changed JS/test/inspection sources and hash-bound test evidence.
- `output/wasm-session-candidate-002-build.json` and
  `output/wasm-session-candidate-002-observed.json`: stopped official browser
  build and static candidate inspection.

## Terrain buffers included in the current contract

Official116 extends the fixed observer with the terrain cell/vertex addresses
at the audited original offsets+48/+4c. Original destructor005fdcc0 passes both
directly to CRT free0064d4b6; the pinned audit rechecks23 anchors/four vtable
targets. Geometry validation covers128x128 cells,129x129 vertices and both
256x256 grid tables. Their declared payload sizes total1,054,744 bytes per
kingdom, excluding allocator overhead and other resources. No payload copies,
new cache eviction or replacement frees are introduced.

Trial007/PID93866 exits0 without a guard stop after thirteen visits through
five kingdoms. All twelve transitions acknowledge eight frees (96 total) and
remove the observer before attachment.418 ticks advance; saved clocks/RNGs,
initialized/scheduled AI, all five final checkpoint digests and five height
borders pass stopped inspection. Peak sampled RSS is194,543,616 bytes; this
single short trial does not establish a speed or memory improvement.

Source146/staged95 tests replay the actual eight-allocation protocol with fixed
DOM, one lease and zero navigation.23 contradictions now also reject missing
cell/vertex frees, downgrade to six acknowledgements and wrong geometry sizes.
The helper's first run incorrectly required exactly20 western agents; the
actual save has30. That source/refusal log is preserved. Corrected validation
requires every actual saved agent to occur exactly once in its queues, and
still rejects the earlier actual zero-agent save. The previous six-root trace
passes19 controls without another game run. All five configuration tests pass.

The updated controller is staged/static-HTTP verified with unchanged served
engine artifacts. Separate official WASM candidate003 compiles and passes
static inspection of linked release=v2/eight-free/geometry-size markers and
actual conservative memory settings. It remains unlaunched and unstaged.
Exact116 and changed sources, successful evidence and failed count-assumption
evidence are preserved in
`output/native-terrain-release-generation-116-preserved.json`.
`output/native-terrain-release-002-staged.json` binds controller publication
and146/95 tests; stopped inspection is
`output/native-terrain-release-001-observed.json`, with corrected controls in
`output/native-terrain-release-002-controls.json`.

## Renderer metadata retirement

The DirectDraw surface destructor now erases its live content-revision and
storage-generation records after the original pixel preservation and resource
cleanup. Retained pixel snapshots remain independently owned by frame leases
and pixel acquires; destruction does not discard them.

An official focused native `dx_tests` run reproduced two abandoned metadata
entries per destroyed surface: 64 cycles left 128 entries above baseline, with
64 failures. After the fix, the same suite passes 155,588 checks with zero
failures. The regression uses no recorder reset inside the loop. It first
acquires a surface's old pixels after destruction, retires the frame, checks
all 64 pixels while the acquire remains held, then verifies the snapshot bytes
are released with that acquire. An intermediate build failed because the new
helper's declaration had the wrong namespace; its log is retained alongside
the corrected passing run.

The command was `.venv/bin/python kit/tools/test.py --game-dir
/Users/mike/Documents/ChatGPT/majesty/upstream/majesty-recomp --native-test
dx_tests --jobs 1`, run from the game directory with a 240-second process-group
guard. It opens no game, browser, rendering device or audio stream. Only the
native test target was built. Evidence and exact changed sources are saved in
`output/ddraw-surface-retirement-001/`; `observed.json` binds the test log,
test executable and source hashes. Four served engine files are checked against
the earlier staging receipt and remain unchanged. Later native117/candidate004
integration is recorded below. Native116's archived world-travel evidence
remains historical evidence for that exact build.

This removes one process-lifetime retention path. The registry/owner-list
paths identified during that work are addressed by the following change; total
resource ownership and stable long-session CPU use remain unqualified.

## Live COM registry and surface ownership

The COM registry now stores live objects in stable map nodes, removing a whole
node and its vector payloads after final Release. IDs remain monotonically
fresh within the guest arena, so a retained frame cannot mistake a destroyed
surface for a newly allocated one. Native pointers are valid until final
Release; look up saved IDs rather than dereferencing departed objects. A
destruction guard keeps the current node stable during nested cleanup and
prevents a child back-reference from recursively destroying or resurrecting it.

Palette scans advance through live identities instead of scanning all IDs
ever created. Their existing upper bound still excludes objects created after
the traversal began. Flip-chain validation bounds malformed chains by the live
object count. Live lookups now use a tree instead of the old deque index; these
changes do not establish an overall speed improvement.

DirectDraw devices remove destroyed surface IDs and register duplicate
surfaces in their live list. Enumeration takes a local snapshot of those IDs:
a callback can destroy a visited surface and create another without invalidating
the traversal. Newly created surfaces appear in the next enumeration. List
capacity may retain the device's peak live population; it no longer grows with
the number of already destroyed surfaces.

The official focused `dx_tests` suite passes 157,651 checks with zero failures.
Before the registry change, a 128-cycle guest Release regression retained 129
nodes after all objects had died (129 failing assertions). The fixed version
keeps one anchor node during the cycles and zero afterward, frees guest views,
and preserves that anchor pointer/payload across inserts and removals. Separate
checks cover holes in live iteration, advancing after deletion, recursive
destruction, creation during cleanup and frame snapshots that outlive surfaces.

After the registry fix, a separate regression reproduced 64 abandoned IDs in
one DirectDraw device's surface list (64 failures). The final suite returns the
list to baseline after each of 64 surface retirements and enumerates a duplicate
while its callback destroys the original and creates a replacement. Every
allocation from that enumeration fixture is released. No game or browser is
launched by this suite.

Evidence, exact changed sources, the passing executable and CTest log are
preserved in `output/com-live-registry-001/observed.json` and its directory.
Two preliminary runs were invalid test setup: one used an incorrect heap-stat
field and failed compilation, and one omitted guest CPU initialization and
crashed the native test process. Their logs remain preserved; only the corrected
regression supports the before/after claims. The final passing process exits
normally without a guard stop. All four served engine artifacts remain unchanged.

## Renderer cleanup during actual kingdom travel

Official native117 includes the renderer changes. Its build receipt freezes
the four game inputs and four DirectDraw/COM inputs, alongside the existing
heap-runtime source receipt. Trial008/PID4092 exits0 without a guard stop after
thirteen visits through five kingdoms, with twelve transitions and96 tracked
original frees. Stopped inspection passes fresh generation, saved returns,
initialized AI, latest clocks/RNGs, all five final checkpoints and five shared
height borders.437 original ticks advance. The final native dump reports18 live
COM objects out of140 created; these live objects occupy the registry's nodes.

Peak sampled native RSS is181,846,016 bytes in this short trial. Post-disposal
guest heap varies22,738,400..24,136,736 bytes. These observations establish
neither sustained bounds nor a speed/RSS improvement. Full pre-tick typed
restoration and all renderer/GPU resource ownership remain unqualified.

All23 lifecycle contradictions pass against this actual trace, including the
earlier real zero-agent save refusal. Focused terminal controller tests pass65
checks each against source and staged controllers (57 frontier-controls and8
native-session-controls). Actual thirteen-visit trace replay keeps the DOM fixed,
one region capability held and navigation at zero; it instantiates no browser
game. Only the previously staged controller is served.

Separate official WASM candidate004 compiles the renderer updates with17 source
hashes frozen, one compiler job and the existing conservative growth policy.
Static inspection finds the linked COM identity-exhaustion guard and the v2
session protocol, checks shared-memory metadata and actual growth glue, and
confirms the four served engine artifacts retain their hashes/inodes/timestamps.
No real WASM memory is allocated and the candidate remains unstaged/unlaunched.

Exact native117 sources, executable, symbols and evidence are preserved by
`output/native-renderer-retirement-generation-117-preserved.json`.
`output/native-renderer-travel-001-observed.json` and
`output/native-renderer-travel-001-controls.json` bind the actual native trace;
`output/wasm-session-candidate-004-build.json` and
`output/wasm-session-candidate-004-observed.json` bind the separate WASM build
and static inspection. Continuous movement and co-op region activation remain
unfinished, and the browser launch suspension stays in force.

## Opt-in camera boundary prototype

`RULE_FRONTIER_CROSSING=v1` enables an experimental movement trigger only
inside a named solo session. It reads the original main view and validates the
camera class, viewport rectangle, world extents and clamped origin. A cardinal
outward hold must persist for one second. The detector retains fixed scalar
state and emits a sequenced boundary event; the source browser controller uses
the existing neighbor admission, durable journey write and release=v2 lifecycle
before changing the active region. Neither controller edits nor this camera
runtime are staged for browser play.

The pinned audit (`scripts/audit-native-camera-border.py`) verifies 33
instruction anchors and five vtable slots. Gameplay constructor0043a4b0 calls
the base constructor005c4040 and installs00680e14; its origin override0043a910
delegates to005c2980. Native119/trial010 confirmed this derived camera in both
kingdoms, explaining why native118's base-only check rejected every sample.
Native120/trial011 reads valid geometry but produces zero boundary events and
zero travel requests under the original left-arrow fixture. These attempts are
preserved in `output/native-camera-binding-119-preserved/` and
`output/native-camera-pan-120-preserved/`; successful process exit alone does
not qualify travel.

The original clamp clears camera+54/+58 at005c4fa4/005c4fa7. Native121
therefore observes the unmodified00438040 scroll gateway and retains only
main-view input, timestamp and session serial, expiring stale input after250ms.
Normal sessions without the opt-in flag install no scroll observer.

The arrow-input trial012 also emits no boundary and makes no request; its
source/evidence are preserved in `output/native-camera-arrow-121-preserved/`.
Mouse trials013/014 refuse pointer delivery because the headless producer
publishes no physical-window layout. `SMOKE_WINDOW_INPUT` is presence-based,
so assigning0 also selects physical mapping. Their runners and terminal evidence
are preserved in `output/native-camera-mapping-013-preserved/` and
`output/native-camera-mapping-014-preserved/`. The corrected native fixture
omits that flag and uses the smoke host's supported guest-coordinate mouse
path. It does not qualify physical-window mapping or browser pointer delivery.
Incomplete routes now fail even when the native process exits0.

Source controller tests pass67 checks in
`output/native-camera-border-003-source-tests.log`.
`--observe-camera --pan-first --route west,east` requires an actual west
boundary before the first request. The stopped checker requires valid camera
geometry, outward input, a one-second hold and event ordering before accepting
this trigger. An isolated first-trip DOM replay is available through
`MAJESTY_NATIVE_CAMERA_TRACE`. These checks do not establish browser gameplay,
continuous arrival-camera placement, hero crossing or co-op regional travel.
Four served game artifacts remain byte/identity unchanged, verified in
`output/native-camera-border-003-served-unchanged.json`.

The corrected guest-coordinate trial015 delivers input without the mapping
failure, but makes zero requests and emits zero boundary events. It exits0;
the runner correctly exits1 for an incomplete route. Exact native121 sources,
executable and terminal trials012..015 are preserved in
`output/native-camera-input-generation-121-preserved.json`. That attempt did not qualify camera-driven
travel. Native122 adds a fixture-only probe capped at16 one-second
samples of camera origin and scroll call/accept counts to distinguish missing
input observation from incomplete panning. It retains fixed scalar state and
is disabled outside an owned native fixture.

## Qualified native camera crossing and arrival

Native124/trial020 qualifies the first actual west-edge hold, original source
save/unload, generated neighbor and saved return. Native125/trial021 adds the
original camera origin setter and qualifies opposite-edge arrival before the
first simulation tick. The west neighbor arrives at x=3506/y=65/clock=0; the
saved home returns at x=0/y=65/clock=37850. The source orthogonal coordinate is
preserved, clamped to destination extents. No raw camera position writes are
used. Only the first request is camera-triggered; the fixture requests the
return explicitly. This remains whole-kingdom travel rather than a seamless
renderer spanning multiple kingdoms.

The stopped trial021 inspection passes three visits/two kingdoms,185 completed
original ticks,16 original root frees, saved clock/RNG and scheduled AI checks.
Peak sampled native RSS is195,035,136B, a short observation rather than a
sustained memory bound. Evidence is in
`output/native-camera-arrival-001-observed.json`. Source controller replay
passes68 tests;10 actual boundary and23 actual lifecycle contradictions pass.
Fourteen actual arrival contradictions also pass. The actual first
boundary replay retains one named-world lease and updates read capabilities
only after native attachment. Exact124 inputs/evidence are preserved in
`output/native-camera-crossing-generation-124-preserved.json`;125 sources,
executable,19 evidence files and three checkpoints are retained in
`output/native-camera-arrival-generation-125-preserved.json`.

The earlier initial-camera parser also matched fixture probe rows; it now
requires the exact initial sample prefix. A long-route RNG control assumed a
specific region; it now removes the actual final saved seed row. Failed helpers
and logs are preserved. Neither correction weakens boundary or lifecycle
requirements. Camera runtime and controllers remain unstaged, browser launches
remain suspended, and hero crossing/co-op regional activation are unfinished.

## Real outdoor hero departure state

Official native126 adds an owned, native-only departure gate that waits for the
selected returned Warrior504/GPL28 to leave its actual guild469/GPL7 through
ordinary AI. It retains two scalar observation stages, installs no task or
command hooks, changes no positions, and gates only the first fixture departure.
Without `BROWSER_FRONTIER_OUTDOOR_HERO_FIXTURE=v1`, the normal session path is
unchanged. The experiment is enabled by runner `--await-outdoor-hero`.

Trial022 exits0/no stop with three captured visits and a completed route. The
original hero starts resident at31850, completes its saved Rest_at_guild deadline
56750, is observed outside at57050 with four physical cells and one AI queue,
and is saved outside at57650. The independently parsed original checkpoint
keeps home7, one occupied script guild slot, reciprocal native100/101 links,
and removes only the physical2 membership. Camera departure/arrival and the
returned hero's home, guild slot and reciprocal links pass independently. Trial022 has
579 original completed ticks,16 original root frees and peak sampled native
RSS194,789,376B. This is a short native observation, not a sustained/browser bound.

`output/native-outdoor-hero-002-observed.json` qualifies this departure and
saved-return hero state.
Thirteen actual hero contradictions,14 arrival/10 boundary/23 lifecycle controls,
and68 source controller tests pass. Source capability replay still keeps one
world lease and fixed DOM. No hero is moved to another kingdom by this test.

The actual source has three attached effects527/528/529. Initial capsule
preparation refuses their missing explicit bindings; its source and failure log
are preserved. Bounded discovery proposes fresh child aliases without changing
any actor, then `output/native-outdoor-hero-capsule-003-refused.json` reaches the
existing nonempty-order refusal. Hero504 has live kind4/7 navigation, effect527
has kind5, and effects528/529 have kind9. Their five complete typed commands
are retained in `output/native-outdoor-hero-orders-001-observed.json`. The
existing supplemental kind9 parser
has separate pinned writer provenance; general runtime arrival continues to
require its qualified empty-order contract. The source/recipient remain exact.
Exact126 sources, executable, symbols,32 evidence files and three original
checkpoints are preserved in `output/native-outdoor-hero-generation-126-preserved.json`.
Four served artifacts remain byte/identity unchanged in
`output/native-outdoor-hero-001-served-unchanged.json`.
Live path/callback/clock/effect migration and atomic regional owner publication
are the next integration work. Waiting for an indoor hero or dropping these
commands/effects would not establish faithful open-world travel.

## Original timed effects across region clocks

Official native128 exercises actual saved effects528/529 attached to outdoor
Warrior504. Their classes are ARG1/ARG3, flags544, scriptless151B UNIT records
with one kind9 Wait command each. The pinned original kind9 writer produces
96B body/128B banks; the base callback is4109 and both commands have age300
at source57650. Baseline and projected24250 clock runs call the full original
005e53c0 dispatcher on already-loaded original orders, restoring the real clock
after every call. No actor relocation or destination import occurs.

Both processes exit0/completed. Effect528 expires after700ms/15 observations;
529 after2700ms/55 observations. Independent inspection compares all140
original UNIT/order records per phase. Living bytes remain exact except the
projected common timestamp57350→23950. Original expiry removes the order and
sets flags2596; the whole remaining UNIT stays exact. The initial inspection
expected548 rather than the original deleted/no-block2596 flags; its refusal
and source remain preserved. Maximum sampled native RSS is132,399,104B and
127,238,144B respectively, short observations rather than browser/long-play bounds.
Build127 had an ARH class guard typo caught before a native run; its executable
and source are preserved. Corrected128 uses actual ARG classes.

`web/world/wait-effect-clock.mjs` now prepares a bounded, read-only timestamp
patch with complete UNIT/order SHA preconditions for those exact canonical
states. Only native ID/physical parent are normalized when identifying the
effect; opaque animation/state bytes cannot be accepted by class alone. All
three banks, framing, callback/name/script/reserved words and living age300
must match. The actual lifetime qualification covers source57650 and the two
observed destination bases57650/24250. Other uint32 destination bases have
checked unsigned age arithmetic, explicitly without native lifetime qualification.
No future, overdue or other living ages are admitted.

`scripts/check-native-wait-effect-plan.mjs` checks the actual source,150 altered
records/clock inputs and10 wrap arithmetic cases. Largest read is4096B; the
save is unchanged. Proofs are `output/native-wait-effect-clock-002-observed.json`
and `output/native-wait-effect-plan-001-observed.json`. The exact128 executable,
symbols,19 source inputs and312 evidence files are frozen in
`output/native-wait-effect-generation-128-preserved.json` before later builds.

Native Journal/allocation support accepts kind9's52B object plus12B node,1B
empty base name and96B banks/heads,161 requested bytes total. Its allocator
caller is a separate opt-in EntryPoints field; legacy twelve-site profiles are
unchanged. Wrong51/53B requests and malformed/omitted base-name allocation
refuse without leaking. Official one-job native_order_storage_tests passes1204
checks; native_order_allocation_tests passes. The test harness's initial private
API compile error and stale-bank-index crash are corrected and preserved.
No live game profile enables the new allocator caller yet, so this is controlled
storage/allocation testing, not actual bounded destination restoration.

The standalone clock plan is not wired into general arrival's empty-order
contract. The hero's live kind4/7 navigation and animated ARH2 effect527 still
need faithful migration, followed by actual destination import and atomic owner
publication. No served artifacts are staged, and browser launches stay suspended.

## Outdoor animation and combined effect clock preparation

Official native129 adds a separate opt-in native ARH2 animation trial for actual
effect527. It restores a copy of the same57650 outdoor kingdom, verifies its
exact151B UNIT/208B saved order banks, and delegates the complete original
common dispatch, animation leaf005abad0 and callback4101. The source has
50ms elapsed since its saved57600 timestamp. Two fresh processes project
source57650/destination24250, retaining that age before the first call.

Both native processes exit0/completed. At ten observations, the effect retires
after450ms/five actual original animation calls; callback reasons2 then1 and
one original cleanup occur at the same relative time. All30 original writer
records per phase are checked. Whole hero/effect UNIT records match at every
step; whole banks differ only in the common timestamp while living and become
the same24B empty banks at retirement. The first hero/effect records match
the original source. Hooks are removed and the real world clock is restored.
Maximum sampled native RSS129,843,200B/169,246,720B is a short observation.
No original save/settings change or destination import occurs.

`web/world/outdoor-marker-clock.mjs` admits only this exact canonical ARH2
state, complete original command/banks/callback4101 and observed age50. It
preserves unsigned dispatch age and complete source hashes, with lifetime
qualification limited to the two observed clock bases.93 actual-source
mutations and14 original trace contradictions pass at4096B maximum reads.
`output/native-outdoor-marker-clock-001-observed.json` and
`output/native-outdoor-marker-plan-001-observed.json` contain the evidence.
The exact129 executable, symbols,19 sources and89 evidence files are frozen
in `output/native-outdoor-marker-generation-129-preserved.json`.

`web/world/hero-effect-clocks.mjs` composes the three source effects into one
read-only plan:527 retains450ms,528 retains700ms and529 retains2700ms.
It exhausts unit metadata, enforces a16-child ceiling and the exact three
observed classes, rejects nested effects/missing classes/duplicate IDs, and
retains complete per-record hash preconditions and three nonoverlapping clock
patches. Twelve actual-source owner/set/nesting/budget/clock controls pass;
`output/native-hero-effect-clocks-001-observed.json` binds both component proofs.

These plans are not imported into a destination world or connected to the
generic empty-order arrival contract. Native hero kinds4/7 navigation, actual
bounded effect restoration, owner publication and spatial travel remain the
next integration work. Browser launches remain suspended; no engine artifacts
or browser delivery files are staged by this work.
Four served engine files remain byte/inode/mtime/size unchanged in
`output/native-outdoor-marker-001-served-unchanged.json`.

The actual typed source navigation is retained in
`output/native-outdoor-hero-navigation-001-observed.json`: kind4 has no saved
waypoints/zero cursor and destination3401/263; kind7 has one saved waypoint,
cursor1 and base callback4099/script0. Its saved word9 is469, alongside that
callback. The existing audited target-ID mapper covers kind4's zero target,
not this queue field. Its field provenance and cross-region ownership resolution
must be established before claiming a complete destination restoration.

## Native queued guild-entry target and original route completion

Pinned instruction audit `output/native-queue-entry-target-001-audit.json`
establishes kind7/cProc4099's saved word9 as a native UNIT-ID userData field.
The original queue builder copies target+60 into order+20, its shared writer
emits that as body word9, and four existing original writer replays agree.
When the queue cursor reaches its count, the original processor sets admission
bit4. Completion callback4099 then looks up that UNIT, checks proximity and
adds the actor to physical container kind2.19 instruction anchors/five complete
ranges and the original callback registration/vtable slots pass. The first
audit range included one byte after its complete return; its refusal/source
are preserved and corrected without replacing an older audit.

`web/world/queue-entry-target.mjs` now plans only those audited native target
fields. Other callbacks' userData remains opaque. It exhausts typed orders
before resolving already-reserved destination UNIT IDs, bounds128 sites, and
refuses script callbacks/noncanonical callback bytes/zero destination IDs.
The actual hero resolves source469 locally; a pure GPL home proxy with native
ID0 is explicitly rejected.18 malformed/reference controls and4 opaque/null
controls pass. The source navigation's initial requested storage is454B for
three banks/heads, two commands, two80B path buffers, two names and two nodes;
this is preparation, not actual bounded destination restoration.

Official native132/trial003 observes the original simulation, rather than
forcing a single isolated queue dispatch. After50ms at57700, the hero's original
callback looks up the real guild469 and the hero enters it. Both path and
queue banks are empty. The native process exits0/completed, restores/removes
its single lookup observer, and preserves the original disk save/settings.
Independent stopped inspection verifies physical parent469, script home7 and
the same occupied guild members[0]→GPL28 slot before/after. Its first whole hero
UNIT and first whole order banks match the actual saved source. Peak sampled
native RSS132,333,568B is a short observation.

The original standalone guild UNIT writer emits SECD version2/271B where the
source whole-world save has version1/267B. The full234B PRIM component matches;
the secondary-version/size difference is retained explicitly and is not claimed
equal or interpreted as a complete guild secondary migration. The initial
overbroad whole-guild equality refusal/inspector source are preserved. The
corrected proof is `output/native-queue-entry-002-observed.json`.

Native130/trial001 stopped before dispatch because callback4099 is a nonhookable
translated block. Native131/trial002's immediate queue dispatch did not reach
entry. Both processes are terminal and their executables/sources/failure records
remain preserved. Native132 uses the existing hookable original UNIT lookup,
observes ordinary path/queue processing, and leaves the callback unmodified.
Exact132's19 sources, executable/symbols and stopped evidence are frozen in
`output/native-queue-entry-generation-132-preserved.json`.

This confirms the dependency that destination restoration must preserve: a
queued building entry requires the actual native home building, not just a
script proxy or copied coordinates. Dormant-home return routing, cross-region
path rebuild, actual destination import and owner publication remain unfinished.
The generic empty-order arrival contract is unchanged. No browser/WASM launch,
build or web staging occurs; browser launch suspension remains in force.

## Bounded restoration of the outdoor hero's actual commands

The game-owned `native_order_payload.h` now derives fixed-capacity reservation
descriptors from complete original command payloads. It supports kinds 1, 2, 4, 5, 6,
7, 9, 10, 11, all three banks, canonical empty names and checked path counts/cursors.
Admission is capped at 128 entries, 4096 points per path, 64 KiB serialized input and
64 KiB requested guest storage. It performs no guest allocation, rewrites no
commands and emits an empty plan on refusal. The existing private return loader
uses this planner while retaining its original Move/Path/Follow semantic checks.
Future smoke build reports include the new header as the twentieth source input.

`scripts/prepare-native-outdoor-order-payloads.mjs` compares four prepared payloads
against the actual stopped outdoor save and its existing immutable proof. Hero 504
has Path 4 / Queue 7; marker 527 has kind 5; effects 528/529 have Wait 9. Requested command
storage is 454/202/161/161 bytes respectively, excluding actors, allocator overhead
and all other world resources. Wait's actual 52-byte allocation and return PC 005da6bd
are independently anchored in the pinned executable.

Official focused commands, run sequentially from upstream/majesty-recomp:

```sh
.venv/bin/python tools/test.py --native-test native_order_payload_tests --jobs 1
.venv/bin/python tools/test.py --native-test native_order_bank_read_hook_tests --jobs 1
```

Both pass. The original reader test independently compares the new planner with
all 90 existing JavaScript fixture cases, then restores the four actual source
payloads twice into private original vehicles, with two initial storage patterns.
Each original writer reproduces the complete input. The second pass transfers
storage to the private vehicle, and original deleting destruction reclaims it.
An injected Wait allocation refusal stops safely and releases owned storage.
The complete suite reports 433088 checks, 0 failures, 210 trials, 94 constructed/
deleted vehicles and 188 cleaned graphs. Guest heap and original small-block
occupancy return to each trial's baseline. The planner's focused test also covers
every truncated input length, name suffixes, count/cursor/capacity boundaries,
128/129 entries and aggregate storage refusal. Its first linking failure is
preserved; explicit aborting guest-entry stubs repair the portable harness only.

Stopped evidence is `output/native-outdoor-order-read-001-observed.json`, with
the original CTest transcript preserved separately. Revalidate current sources
and actual saved inputs without another native process:

```sh
node scripts/check-native-outdoor-order-read.mjs
```

This qualifies command storage and exact restoration inside private original
vehicles, not the hero's PRIMARY/GPL graph, destination spatial placement,
dormant guild routing or live activation. Opaque callback data remains unchanged;
a native home ID still requires its actual registered building at execution.
No smoke game, browser/WASM launch, web build or staging runs in this step.
Total/sustained native/browser memory remains unqualified and launch suspension
continues. Next integrate these reservations into complete actor-family restoration
and actual home routing before activation.

## Outdoor family restored in the original receiving world

The opt-in native outdoor-family consumer combines complete original UNIT/SECD
restoration with the bounded command reader. It loads the actual 442-byte Warrior
and its three 151-byte effects into the copied receiving kingdom at clock 24250.
Each command graph is reserved, restored and compared before native identity
registration. The receiving constructors assign hero 561, effects 562/563/564 and
GPL 49. UNIT IDs are region-local: several source IDs already name unrelated
receiving actors, so they must not be treated as portable identities.

The original 1850-byte GPL record is restored with typed self references bound
to 49 and home references bound to the existing inert proxy 45. The original
container reader restores all three actual child links to the new hero. Original
writers reproduce every complete UNIT, the full GPL record, all four rebased
order payloads and the bound child container. The source home-container data is
retained separately; no native home building is substituted. The Queue4099 target
remains source-region 0_0 / UNIT 469, pending routing before any execution.

Official one-job build 133 and owned native attempt 001 are terminal exit 0. The
trial's original removal deletes children then the hero and reclaims all 42
command reservations (978 requested bytes). Native registry membership, original
queues and the existing proxy's complete runtime header are preserved. Native
and script counters advance normally without rewinding. Maximum sampled RSS is
132481024 bytes during this 12.748-second run; this is not a sustained memory bound.

Commands from the parent workspace, with fresh output paths/attempts:

```sh
node scripts/prepare-native-outdoor-family.mjs output/native-outdoor-family-preparation-001
python3 scripts/build-native-world-residency.py --attempt 133
python3 scripts/run-native-outdoor-family.py output/native-world-residency-build-133.json output/native-outdoor-family-preparation-001/prepared.json --attempt 1
node scripts/inspect-native-outdoor-family.mjs output/native-outdoor-family-attempt-001.json output/native-outdoor-family-001-observed.json
```

The stopped inspector independently compares source/proposal/input/observed bytes,
parses the rebased native and script identities, checks typed GPL references and
child containers, and reads the five saved commands including their exact clocks.
It binds all 20 compiled source inputs, current executable/symbols, saved inputs,
settings, producer script, terminal process, log and 27 captured files. Exact133's
sources, executable/symbols and 55 evidence files are frozen in
`output/native-outdoor-family-generation-133-preserved.json`. The preceding
compiled private-order test and source are retained separately in
`output/native-outdoor-order-reader-001-preserved.json`.

These actors are registered temporarily for genuine parent resolution, but never
finalized, spatially admitted, added to the AI queue or selected as the regional
owner. They are removed before ordinary simulation resumes. The later home-gate
trial observes that native identity publication already admits populated banks
to ORDR; the earlier trial did not run their ordinary command updates.
Script-context clock migration,
dormant native-guild routing, path rebuilding, actual activation and paired owner
publication remain prerequisites. This does not establish player-hero border
crossing, cooperative regional activation or full matches. Browser/WASM launch
and web staging do not run; host-app crash suspension remains in force.

## Ordinary native updates held for the actual remote-home family

Official one-job build139 and home-route attempt006/PID23349 finish exit0. The
new opt-in fixture extends the actual outdoor capsule with its canonical
registered home and the receiving world's exact453-byte anonymous proxy45.
Preparation verifies all registered proxy fields, nativeID0, no deletion and
no function list. The native original GPL writer reproduces the same proxy.

The source go_home/travel_to script points to GPL45 in the receiving region,
while Queue4099 still contains source native469. That number can identify an
unrelated receiving actor. Two guards hold the entire original agent invocation
and the native command processor for the four owned actors before their bodies
run. Other actors delegate to their original methods. The family stays
unfinalized/unspatial and is not published as the selected regional owner.

Here bank restoration precedes native identity publication. All four actors are
already present exactly once in the original ORDR group. The original group
notification is idempotent: before1/after1 for each, with all other members
preserved. The guards precede that notification and insertion into the original
AI pending queue. This differs from the older full-GMP fixture that registers
UNITs before restoring their banks and initially had no ORDR membership.

The ordinary AI queue first invokes the restored hero at clock24300, emits one
Family_Home_Request.json and requests registered home0_0/native469/GPL7. The
request binds the entity, guild entity, world and content identities, receiving
aliases561/GPL49, proxy45/native0 and the original pause anchor24250. The actor
clocks are paused; the later world clock must not be substituted for that anchor
in a future transfer, or its preserved effects would be aged artificially.

At clock25300, after1000ms, the trial has held21 ordinary hero AI calls and
42/21/21/21 ordinary command calls for hero/effects. It delegates993 other AI
calls and147 other command calls. Original writers reproduce eleven complete
before/after records identically: four UNITs, four order payloads, hero GPL,
proxy GPL and internal child container. There are no direct command probes or
manual AI invocations in this trial.

Original queue removal, child/hero removal and manager cleanup remove all four
aliases and GPL49, reclaim42 tracked command reservations, preserve the other
current registry/queue members and remove both temporary guards. Counters and
the cleanup world clock are unchanged during removal. The complete cleaned
proxy still equals its canonical453-byte proposal. The comparison uses current
other-actor state at cleanup, because ordinary NPCs have advanced during the hold.

Commands from the parent workspace, using fresh build/attempt/output names:

```sh
node scripts/prepare-native-outdoor-family-home-route.mjs output/native-outdoor-family-preparation-001/prepared.json output/native-outdoor-family-home-route-preparation-001
python3 scripts/build-native-world-residency.py --attempt 139
python3 scripts/run-native-outdoor-family-home-route.py output/native-world-residency-build-139.json output/native-outdoor-family-home-route-preparation-001/prepared.json --attempt 6
node scripts/inspect-native-outdoor-family-home-route.mjs output/native-outdoor-family-home-route-attempt-006.json output/native-outdoor-family-home-route-001-observed.json
node scripts/preserve-native-outdoor-family-home-route-generation.mjs output/native-world-residency-build-139.json output/native-outdoor-family-home-route-001-observed.json
```

Independent stopped inspection binds20 compiled inputs, executable/symbols,
producer, preparation, settings, exact source records, request/log and54 captured
files. Exact139 sources/binary/symbols and88 evidence files are frozen with
4096-byte copies in output/native-outdoor-family-home-route-generation-139-preserved.json.
Maximum sampled native RSS is176324608 bytes during20.096 seconds; this does
not establish sustained browser memory bounds or a performance improvement.

Failed builds/trials are retained:134 is a declaration/linkage failure; attempts
001-004 stop before activation on view reuse or the incorrect assumption that
ORDR membership must initially be empty. Attempt005 exits0 but ends before the
one-second hold and is explicitly incomplete. The extended observation window
of attempt006 supplies the complete hold/cleanup evidence.

This qualifies a paused remote-home request through ordinary native updates,
not consumption of that request or complete travel. Loading the home region,
retiring the current selected source, rebuilding spatial/navigation state,
migrating script clocks and publishing one regional owner remain unfinished.
No browser/WASM launch, staging, cooperative regional activation or internet
match is performed. The host-app crash suspension remains in force.

## Actual held family restored to its native home

The next native fixture consumes the actual identity-bound home request from139
and its complete held records. Return preparation translates temporary aliases
561-564/GPL49 back to the source proposal namespace504/527-529/GPL28 and replaces
the anonymous home reference45 with real guild GPL7. Order clocks return from
pause anchor24250 to home-world57650, retaining the50/300ms effect ages. The later
held world clock25300 is not used to age these actors. Every normalized UNIT,
script and order payload equals its original outdoor source record byte for byte.

The script has one active travel_to context [300,57650,2,0] and eleven inactive
zero states. It never ran in the receiving region; this return resumes the
original paused home world at57650, so no script timestamp edit is needed.
This does not qualify active outbound script-clock migration to another region.
The source home-container record restores native101 and three internal children.

Official one-job build142/attempt003/PID26164 loads the actual outdoor source
save. Before any tick, original list removal retires GPL28 from guild7's roster;
original child/hero removal and GC retire504/527/528/529, preserving other current
registry/queue members and native/script counters. Original saves capture the
source and departed worlds at57650. Fresh constructors then restore the held
family as530/531/532/533/GPL31. Complete UNIT/GPL/order/container writers match
the prepared records with those fresh aliases. Original methods restore guild100,
hero101 and script roster31, finalize all four actors and queue GPL31 once.

Single-actor postload does not establish a collision footprint after the private
reader deferred placement. Failed140/141 attempts001/002 expose physical0,
cells0 with drawing1. The fixture therefore saves Family_Return_Ready.GMP for a
full original load and removes its temporary candidate before ordinary updates.
All42 tracked command allocations are reclaimed; the saved ready world persists.
No physical admission check is bypassed to activate this intermediate state.

Attempt004/PID26213 loads that exact saved world through the original full-world
path. Before the first tick, the hero has its real four-cell collision footprint,
one drawing member, reciprocal home membership and one original AI queue entry.
All453 complete UNITs,29 GPL records and33 order/container attachments match the
saved preparation after that reload. The three temporary hooks are observers;
every AI/command/selected guild lookup delegates to the original method.

By58650, after1000ms of ordinary simulation, Queue4099 has looked up the real
native guild469 exactly once. Hero530 has physical parent469, guild native groups
100/2 and hero101, one script roster entry31 and one AI queue entry. Its active
function is Rest_at_guild. Original calls include20 hero AI returns and2/9/14/20
hero/effect command returns;580 other AI calls and267 other commands also return.
The evolved original GMP captures this actual continuation, and all three
observers are removed. The copied input worlds/settings remain unchanged.

Independent inspection additionally verifies all453 units/29 agents in the
initial source reload,449 unchanged other units and27 unchanged other agents
across source retirement, exact request/proposals, both terminal producer PIDs,
20 compiled source inputs,43 captured root records and five saved worlds. Both
runs exit0 and last20.754/20.098 seconds. Maximum sampled native RSS across them
is174538752 bytes; this is not a browser memory bound or performance comparison.

Commands from the parent workspace, with fresh build/attempt/output names:

```sh
node scripts/prepare-native-outdoor-family-return.mjs output/native-outdoor-family-home-route-001-observed.json output/native-outdoor-family-return-preparation-002
python3 scripts/build-native-world-residency.py --attempt 142
python3 scripts/run-native-outdoor-family-return.py output/native-world-residency-build-142.json output/native-outdoor-family-return-preparation-002/prepared.json --attempt 3
python3 scripts/run-native-outdoor-family-return.py output/native-world-residency-build-142.json output/native-outdoor-family-return-preparation-002/prepared.json --attempt 4 --reload output/native-outdoor-family-return-attempt-003.json
node scripts/inspect-native-outdoor-family-return.mjs output/native-outdoor-family-return-attempt-003.json output/native-outdoor-family-return-attempt-004.json output/native-outdoor-family-return-002-revalidated.json
node scripts/preserve-native-outdoor-family-return-generation.mjs output/native-world-residency-build-142.json output/native-outdoor-family-return-002-revalidated.json
```

The return preparer calls the current139 inspector, so reproduce that preparation
before changing/rebuilding the139 source. Existing prepared records are immutable;
later runners bind their hashes and the exact139 archive. Preparation001 is a
retained partial failure before the clock-patch metadata fix;002 is complete.

Exact142's20 sources, executable/symbols and86 evidence files are frozen with
4096-byte copies in output/native-outdoor-family-return-generation-142-preserved.json.
The latest proof is output/native-outdoor-family-return-002-revalidated.json.
This is a native candidate-return fixture, not a publication of the active
regional owner. Seamless spatial crossing, source/destination owner transaction,
outbound script-clock migration, cooperative region activation, browser release
and independent internet/full competitive matches remain unfinished. App-crash
launch suspension stays in force and no served web artifacts are changed.

## Select ordinary outdoor evolution before a new handoff

The held-family return above does not replace the selected hero. Its source
hero504/GPL28 evolved normally from the selected revision2 snapshot at31800
to the actual outdoor snapshot at57650, while the saved pair still selected
the older world. A save must select that ordinary evolution before a subsequent
handoff can be evaluated against the right source state.

`scripts/publish-native-outdoor-owner.mjs` and
`scripts/lib/registered-hero-outdoor-save.mjs` now perform that operation in
a fresh stopped copy. The latter rechecks the frozen126 executable/eight source
files, successful terminal producer, native trace, real saved hero/home/roster,
the exported revision2 pair and its unchanged selected store. It copies only
the complete selection under the existing read lease, publishing its marker
last. It then commits a normal save to revision3 through EntityRevisionStore.
No previous store, native snapshot, settings or served web files are modified.

The selected owner remains the same logical hero504/GPL28 in0_0, with native
guild469/GPL7 and the remote proxy45. Its complete source world is341879 bytes
with SHA256 e249f636b66a3a97a6e27643331f6277e4ac3d022933db9a11f7bf2824355150.
The dormant1_0 world remains351130 bytes with SHA256
9dc5e6b964bf3c6ed43f781aec890635fce2869f35d252c9bd462ac3c32a154c.
Home/hero aliases, declared reference bindings and visited sides are preserved.
This is not a handoff and does not select candidate530/GPL31 from the separate
return trial.

Four serial interruptions after source/state staging and before/after manifest
publication recover complete revision2 or revision3 pairs. Retrying each selects
the same revision3; exact retries perform no completed writes. Seven invalid
saves refuse changed hero/home/owner, changed dormant world, unchanged active
world, stale manifest or forged active digest without changing the selection.
The retained store has eight files/four world slots and every storage read/write
is at most4096 bytes. These bounds apply to the stopped storage adapter, not to
native allocations or total browser memory. They do not prove concurrent OS
writer safety.

`scripts/export-native-entity-revision.mjs` accepts this publication through an
independent reopening/ownership/provenance check. Both worlds export through
the existing selected lease and verify in current and historical modes. This
makes the updated pair consumable by the native-loading tools. No new native
game was launched and no selected revision3 native reload is claimed.
The export guard also refuses the prior31800 source digest and an invalid side.
The28 focused entity-home/stopped-file tests pass. These tests validate saved
ownership and I/O safeguards; they do not qualify seamless game play.

```sh
node scripts/inspect-native-region-session.mjs output/native-region-session-attempt-022-archived.json output/native-outdoor-owner-session-001-revalidated.json
node scripts/publish-native-outdoor-owner.mjs output/native-hero-return-pair-001-published.json output/native-outdoor-owner-session-001-revalidated.json output/native-outdoor-owner-002-published.json
node scripts/export-native-entity-revision.mjs output/native-outdoor-owner-002-published.json native-outdoor-owner-001-exported
```

Use fresh output names on reproduction. The first publication001 records the
earlier checker before its stricter full-state comparison;002 is the current
publication. The export is output/native-outdoor-owner-001-exported.json.
The next transfer still requires an actual selected remote family, its original
retirement and a two-world return transaction. Outbound script-clock migration,
seamless spatial travel, cooperative regional activation, browser crash/resources
and independent internet/full matches remain unfinished.

## Original receiving-world family snapshots

Official one-job build143 and snapshot attempt001/PID27318 exit0. The new
native-only BROWSER_STREAMING_OUTDOOR_FAMILY_SNAPSHOT_FIXTURE=1 option saves
the receiving kingdom through the original full-world writer at four quiescent
boundaries: Family_Remote_Source, Ready, Held and Departed. The existing two
ordinary ingress guards remain in place while the candidate's AI/commands are
queued. No native home is substituted and no family body is released remotely.
The source/ready clocks are24250; held/departed clocks are25300.

The runner requires a current selected revision3 export receipt and validates
both source/dormant digests before launching. The preparation's actual outdoor
hero504/GPL28 still belongs to0_0; receiving aliases561-564/GPL49 are candidates
until a later two-world handoff. This trial does not publish another owner.
It copies only owned input worlds/settings and verifies those originals unchanged.

Independent inspection reuses the complete original-record remote-home hold
checks and additionally parses all four original GMPs. The initial receiving
reload matches443 complete UNITs,47 GPLs and20 attachments. Admission preserves
all443 existing UNITs/47 GPLs and adds exactly four units/one script. Both ready
and held saves contain the exact captured complete hero/effect UNIT, GPL, four
ORDR and internal CONT records; the canonical home proxy remains exact and the
hero has exactly one AI queue entry. Original retirement removes those four
aliases and GPL49 with no residual queue/container references while444 other
UNITs and48 other GPLs compare byte for byte across the quiescent removal.
Other actors evolve normally during the guarded interval; their later counts
are not assumed to equal the earlier source counts.

The original cleanup still reclaims all42 tracked command reservations. Sampled
peak native RSS181010432 bytes is a single-run observation, not a sustained
native/browser bound. The passing proof is
output/native-outdoor-family-snapshot-001-observed.json. Exact143's20 compiled
inputs, executable/symbols and94 evidence files are preserved in
output/native-outdoor-family-snapshot-generation-143-preserved.json using
4096-byte copies, before any subsequent native change.

```sh
python3 scripts/build-native-world-residency.py --attempt 143
python3 scripts/run-native-outdoor-family-snapshots.py output/native-world-residency-build-143.json output/native-outdoor-family-home-route-preparation-001/prepared.json --attempt 1 --selected-receipt upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-JtjkRL/Selected_Entity_Revision.json
node scripts/inspect-native-outdoor-family-snapshots.mjs output/native-outdoor-family-snapshot-attempt-001.json output/native-outdoor-family-snapshot-001-observed.json
node scripts/preserve-native-outdoor-family-snapshot-generation.mjs output/native-world-residency-build-143.json output/native-outdoor-family-snapshot-001-observed.json
```

Use fresh attempts/output names. The original private-reader spatial deferral
still applies. These serialized snapshots have not yet undergone a fresh
full-family load into the receiving collision grid. Outbound script clocks
remain held at their source anchor; active remote continuation is unqualified.
The next step is the guarded original full receiving-world reload, followed by
selected outward/return transactions. Seamless spatial travel, co-op regional
activation, browser crash/resources and independent internet/full matches remain
unfinished. No browser launch, WASM build or served web change occurs.

## Fresh original receiving-family reload

Official one-job build146/reload attempt003/PID28898 exits0. The runner consumes
143's exact Family_Remote_Ready.GMP, checks the frozen parent proof/archive and
the current selected revision3 export, then uses a fresh owned profile. The
native BROWSER_STREAMING_OUTDOOR_FAMILY_SNAPSHOT_RELOAD=1 option skips private
family import: the original full-world loader restores the saved561-564/GPL49
family directly. A48-byte identity record binds those actual saved aliases.
No IDs are reserved or allocated again by the fixture.

Before the first ordinary update, the real hero has four collision cells, one
drawing member, three internal child links and exactly one original AI queue
entry. The shared arming code checks the existing queue instead of adding it
again. Original ORDR notification remains idempotent. Both family AI/command
guards install before ordinary updates; the native-home proxy45 stays canonical
and resolves to no local native building. The source-native Queue4099 target469
is not treated as a receiving guild.

Failed144/145 attempts001/002 are retained, incomplete runs. They passed physical
admission but stopped at the first family command. The diagnostic showed a valid
command context and unchanged pure home proxy, with a changed runtime fingerprint.
Full loading leaves GPL49's native-object association lazy; the first command
resolves that cache. The private importer already invokes original00626310 before
its fingerprint. The reload now performs that same original getter for the hero
and verifies it returns native561, while the proxy getter returns0. It then freezes
the complete runtime fingerprint. No fingerprint check or guard is bypassed.

Independent inspection compares all447 UNITs,48 GPLs and25 attachments from the
parent ready save to the freshly loaded original ready save. During the subsequent
hold, the complete family UNIT/GPL/order/container records and home proxy stay
identical while other actors run. The same registered-home request is emitted
at24300; after1000ms until25300, original queue removal, child/hero deletion and
manager cleanup remove all four aliases/GPL49 and persistent queue/container
references.444 other complete UNITs and48 other complete GPLs compare exactly
across that quiescent removal. Both guards are removed.

The original full-world reader's order allocations are not journaled by this
fixture, so its cleanup reports requests0 rather than reusing the private reader's
42-reservation claim. This does not measure all freed allocations, collision-grid
retirement or sustained/browser memory. Peak sampled native RSS180846592 bytes
is a single-run observation.

The passing proof is output/native-outdoor-family-reload-001-observed.json.
Exact146's20 compiled inputs, executable/symbols and79 evidence files are frozen
in output/native-outdoor-family-reload-generation-146-preserved.json with
4096-byte copies before further native changes.

```sh
python3 scripts/build-native-world-residency.py --attempt 146
python3 scripts/run-native-outdoor-family-reload.py output/native-world-residency-build-146.json output/native-outdoor-family-home-route-preparation-001/prepared.json --attempt 3 --selected-receipt upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-JtjkRL/Selected_Entity_Revision.json --parent-proof output/native-outdoor-family-snapshot-001-observed.json --parent-archive output/native-outdoor-family-snapshot-generation-143-preserved.json
node scripts/inspect-native-outdoor-family-reload.mjs output/native-outdoor-family-reload-attempt-003.json output/native-outdoor-family-reload-001-observed.json
node scripts/preserve-native-outdoor-family-reload-generation.mjs output/native-world-residency-build-146.json output/native-outdoor-family-reload-001-observed.json
```

Use fresh output names/attempts. This is guarded continuation of a saved receiving
candidate, not selected ownership publication or normal remote script execution.
The next step is the source/receiving ownership transaction and its return.
Outbound script-clock migration, spatial seam travel, cooperative region
activation, browser crash/resources and independent internet/full matches remain
unfinished. No browser launch, WASM build or served web change occurs.

## Selected saved-world round trip and ordinary home continuation

The actual native146 receiving captures now join native142's original source
retirement and home restoration through one stopped logical-owner history.
The existing revision3 outdoor hero504/GPL28 transfers to561/GPL49 under
revision4. Revision5 saves the actual receiving Held world at25300, after the
24300 home request. Its source kingdom remains retired and dormant. The request's
ownerPublished=false field describes its original native producer; the stopped
store separately selects the owner. This does not retrofit live selection into
those earlier game runs.

The return adapter compares complete selected Held UNIT/GPL data against the
exact archived native142 restoration proposals, including typed identities,
home references, three internal children and all four order payloads. Five
order clock fields reverse against pause anchor24250, preserving effect ages
while the actor was held. Both sides' full family records agree with the home
Ready snapshot under fresh530-533/GPL31. Actual receiving retirement removes
561-564/GPL49 and preserves444 other UNITs and48 other GPLs byte for byte.

Revision6 selects that freshly fully loaded home Ready world with the retired
receiving world. Revision7 selects the original ordinary guild entry at58650.
Eight interrupted writes across these two stages recover only complete pairs;
seven refusals include actual worlds with a duplicate receiving owner or a
missing returned owner. Exact retries write nothing. Every trial retains eight
files/four world slots and uses at most4096-byte reads/writes with one active
read. These are stopped fixture checks, not concurrent OS/browser guarantees.

The generic exporter now accepts the checked final revision7 through the new
round-trip inspector. Guarded revision4/5 publications remain refused; neither
can bypass the remote-home guards using ordinary export. Both exported worlds
pass current receipt and ownership verification.

Without changing native146, a fresh ordinary named-world session loads the
selected revision7 export with all family-fixture and family AI/command guard
flags absent. Original clocks/RNGs restore at58650. Native attempt002/PID29812
exits0 after two original saves at60350 and62000. Both retain530/GPL31, real
guild469/GPL7 membership, one AI queue entry and Rest_at_guild; the terrain and
dormant receiving selection remain intact. Peak sampled RSS174899200 bytes is
a short-run observation. This does not prove complete before-first-tick typed
equality or sustained memory bounds.

Attempt001/PID29746 is preserved as incomplete: its15-second script ended after
one save during60350. The corrected runner allows25 seconds with a40-second
deadline and the same512MiB RSS guard. No native rebuild was necessary. All58
focused entity-pair, registered-home and stopped-I/O tests pass.

```sh
node scripts/publish-native-guarded-outdoor-handoff.mjs output/native-outdoor-owner-002-published.json output/native-outdoor-family-reload-001-observed.json output/native-outdoor-family-return-002-revalidated.json output/native-outdoor-family-return-generation-142-preserved.json output/native-guarded-outdoor-handoff-002-published.json
node scripts/publish-native-guarded-outdoor-hold.mjs output/native-guarded-outdoor-handoff-002-published.json output/native-guarded-outdoor-hold-001-published.json
node scripts/publish-native-guarded-outdoor-round-trip.mjs output/native-guarded-outdoor-hold-001-published.json output/native-guarded-outdoor-round-trip-001-published.json
node scripts/export-native-entity-revision.mjs output/native-guarded-outdoor-round-trip-001-published.json native-outdoor-round-trip-001-exported
python3 scripts/run-native-outdoor-round-trip-session.py output/native-world-residency-build-146.json output/native-guarded-outdoor-round-trip-001-published.json upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-YNvQOo/Selected_Entity_Revision.json --attempt 2
node scripts/inspect-native-outdoor-round-trip-session.mjs output/native-outdoor-round-trip-session-attempt-002.json output/native-outdoor-round-trip-session-001-observed.json
node --test --test-reporter=dot tests/entity-pair.test.mjs tests/entity-hero-home.test.mjs tests/stopped-entity-io.test.mjs
```

Use fresh output/attempt names; use the receipt path returned by the export.
The actual selected native load is qualified separately from the earlier
stopped round-trip proof. A live ownership transaction, active receiving script
clock migration, world-space seam transformation and cooperative region
activation remain unfinished. No browser launch, WASM build or served web
change occurred; the app-crash suspension remains in force.

## Joint saved-family clock projection

The earlier outdoor capsule adjusts its five command timestamps but retains
the active GPL travel_to stamp57650 while the receiving world starts24250.
That guarded candidate remains historical evidence; it does not qualify normal
remote scheduling. The runtime now supplies
web/world/actor-family-clocks.mjs, which prepares script and common dispatch
clock edits together under one selected EntityRevisionStore lease. Both clocks
come from the selected SVGD sections, and callers cannot override them.

The planner copies at most256KiB of GPL/order records, limits scriptless direct
children to16, contexts to64 and dispatch sites to128, and uses4096-byte reads.
It scans other units without retaining their records. Active unpaused contexts
preserve unsigned elapsed time, while inactive/paused contexts stay unchanged.
Executing contexts, unsupported flags, ambiguous future stamps and transitions
through the scheduler's special zero stamp are refused. The companion runtime
parser includes the pinned96-byte kind9 Wait leaf already audited by the native
reader fixtures; it classifies only the common dispatch clock here. This does
not resolve native targets, paths, complete leaf semantics or spatial seams.

Actual selected revision3 preparation projects the one active context from
[300,57650,2,0] to[300,24250,2,0]. Eleven inactive contexts remain all zero.
The five order stamps match the earlier qualified age adjustments exactly:
hero Path/Queue24250, marker24200 and both Wait effects23950. All other GPL bytes
remain identical to the earlier proposal, before normal identity/home binding.
The new preparation is a separate candidate; no prior selected store changes.

Current native146 consumes the projected13-record home-route preparation without
a rebuild. Snapshot attempt002/PID30250 exits0, and the original import/Ready/Held
writers preserve the projected script and order clocks through the guarded hold.
The resulting parent proof and exact20 compiled inputs are preserved with94
evidence files in output/native-outdoor-family-snapshot-generation-146-preserved.json.

Fresh full reload attempt004/PID30504 also exits0. All447 UNITs,48 GPLs and25
attachments compare exactly against the projected Ready world. The hero has
four collision cells, one drawing member, three children and one AI queue entry;
both guards install before the first update. Direct typed inspection confirms
the projected active context and eleven inactive contexts in its freshly loaded
Ready and later Held saves. Other444 UNITs/48 GPLs survive original retirement.
Sampled peaks181043200/178667520 bytes are individual observations, not memory
bounds. The combining checker initially read a receipt field from the summary
instead of the producer manifest; correcting that lookup passed without another
native run.69 focused family-clock/storage/export tests pass.

```sh
node scripts/prepare-native-outdoor-family-clock-projection.mjs output/native-outdoor-owner-002-published.json output/native-outdoor-family-preparation-001/prepared.json output/native-outdoor-family-clock-projection-preparation-001
node scripts/prepare-native-outdoor-family-home-route.mjs output/native-outdoor-family-clock-projection-preparation-001/prepared.json output/native-outdoor-family-clock-route-preparation-001
python3 scripts/run-native-outdoor-family-snapshots.py output/native-world-residency-build-146.json output/native-outdoor-family-clock-route-preparation-001/prepared.json --attempt 2 --selected-receipt upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-JtjkRL/Selected_Entity_Revision.json
node scripts/inspect-native-outdoor-family-snapshots.mjs output/native-outdoor-family-snapshot-attempt-002.json output/native-outdoor-family-clock-snapshots-001-observed.json
node scripts/inspect-native-outdoor-family-clock-projection.mjs output/native-outdoor-family-snapshot-attempt-002.json output/native-outdoor-family-clock-projection-001-observed.json
node scripts/preserve-native-outdoor-family-snapshot-generation.mjs output/native-world-residency-build-146.json output/native-outdoor-family-clock-snapshots-001-observed.json
python3 scripts/run-native-outdoor-family-reload.py output/native-world-residency-build-146.json output/native-outdoor-family-clock-route-preparation-001/prepared.json --attempt 4 --selected-receipt upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-JtjkRL/Selected_Entity_Revision.json --parent-proof output/native-outdoor-family-clock-snapshots-001-observed.json --parent-archive output/native-outdoor-family-snapshot-generation-146-preserved.json
node scripts/inspect-native-outdoor-family-clock-reload.mjs output/native-outdoor-family-reload-attempt-004.json output/native-outdoor-family-clock-reload-001-observed.json
node --test --test-reporter=dot tests/actor-family-clocks.test.mjs tests/entity-pair.test.mjs tests/entity-hero-home.test.mjs tests/stopped-entity-io.test.mjs
```

Use fresh output/attempt names. These tests qualify prepared clock fields and
their original-reader restoration. Both whole-family guards still hold the
remote family; ordinary remote context/command execution and an active ownership
transaction remain unfinished. The old source-native Queue4099 target469 still
requires registered-home routing. Browser launch/staging remains suspended.

## Runtime selection of a remote home return

`web/world/remote-home-task.mjs` reads the selected outdoor hero's saved
`go_home` task under the ownership store's checkpoint lease. It resolves the
destination from the logical home registration and current native home alias,
not a building ID in the receiving kingdom. It validates the complete command
attachment and the pinned Queue/cProc4099 target before calling a stopped
return producer. The native Queue target provenance is recorded in
`output/native-queue-entry-target-001-audit.json`.

`prepareSelectedRemoteHomeReturn` supplies the producer with the route and both
leased checkpoints. The producer must return separate immutable stopped worlds
with original retirement/restoration complete and fresh returned hero aliases.
The returned commit capability publishes that exact prepared pair through the
existing ownership store. Preserve this capability for interrupted retries;
retrying the commit does not rerun native retirement or restoration. A changed
selected owner refuses publication. The input leases are revoked before commit.

`output/native-selected-remote-home-return-001.json` exercises this runtime
selector with the original held receiving save: hero561/GPL49 at25300,
`travel_to`, Queue4099 targeting home469/GPL7 in region0_0. Its route agrees with
the request emitted by the native guard. The checked stopped producer restores
hero530/GPL31, retires the receiving family and selects revision6. Selecting the
original ordinary guild-entry save then produces revision7. The producer runs
once; an exact commit retry writes nothing. Eight files/four world slots remain,
with serial reads and writes of at most4096 bytes. Input captures and the prior
selected store are preserved.

```sh
node --test --test-reporter=dot tests/remote-home-task.test.mjs tests/entity-hero-home.test.mjs tests/actor-family-clocks.test.mjs
node scripts/run-selected-remote-home-return.mjs output/native-guarded-outdoor-hold-001-published.json output/native-selected-remote-home-return-001.json
```

Use a fresh output name. The tests include a receiving building with the same
numeric home ID, wrong callback/target, executing task, missing/duplicate owner,
escaped input lease, stale selection, producer failure and all four publication
interruption points. This connects the runtime selector to the checked captured
native results. It does not implement native pause/capture/retirement/restoration
inside a running browser session. Both remote family guards remain required;
normal remote execution, seamless spatial crossing, more than two ownership
regions and cooperative regional activation remain unfinished. No native build,
game process or browser launch was performed for this check.

## Restoring the selected held world without clock rollback

Native build147 accepts a second guarded family-reload identity format. The
48-byte identity separates the actual saved world clock (word2) from the family
pause anchor (word9). The original version1 format still requires clock24250
and zero reserved words. Version2 checks the restored game clock against word2
and refuses a future/unsupported pause anchor before actor lookup. This remains
an owned native fixture with its existing6000 ms age and run limits, not a
general browser activation API.

`output/native-selected-remote-home-preparation-001/prepared.json` was prepared
under build146's exact source-bound receiving proof, before changing the native
code. It copies both selected revision5 worlds under their checkpoint leases
with4096-byte I/O. The selected receiving world is at25300; the family was paused
at24250. The logical task, native Queue4099 home target, immutable registration
and source digests remain bound. Build147 checks the frozen146 producer sources
and executable through its preserved archive; it does not relabel that producer
as a build147 run. Earlier146 inspectors requiring current compiled sources are
historical checks after this native change.

`output/native-selected-remote-home-001-observed.json` checks build147/attempt001
(PID32175, exit0). The original full-world reader restores the actual selected
save at25300. All448 UNITs,49 GPLs and26 attachments match before the first tick.
The two guards are already installed, with four collision cells, one drawing
member and one AI queue entry. The new native request occurs at25350, still with
pause anchor24250. At26350, all eleven family records remain byte identical;
other actors have continued. Original retirement removes the four family units
and hero script, preserving the other444 UNITs/48 GPLs and the pure proxy.
Original saves and settings are preserved. No owner revision is published.

The version1 regression uses build147/reload attempt005 (PID32254, exit0).
`output/native-outdoor-family-reload-002-observed.json` checks447 UNITs,48 GPLs
and25 attachments against the frozen clock-projected parent at24250. The older
composite clock checker refuses its146 ancestor against current147 source;
the saved parent is verified through its immutable generation archive by the
full-world reload inspector. No extra native rerun was needed for that refusal.

```sh
python3 scripts/build-native-world-residency.py --attempt 147
python3 scripts/run-native-selected-remote-home.py output/native-world-residency-build-147.json output/native-selected-remote-home-preparation-001/prepared.json --producer-archive output/native-outdoor-family-reload-generation-146-preserved.json --attempt 1
node scripts/inspect-native-selected-remote-home.mjs output/native-selected-remote-home-attempt-001.json output/native-selected-remote-home-001-observed.json
node scripts/inspect-native-outdoor-family-reload.mjs output/native-outdoor-family-reload-attempt-005.json output/native-outdoor-family-reload-002-observed.json
```

Use fresh output/attempt names and a matching official build. The preparation
command is `scripts/prepare-native-selected-remote-home.mjs`; its old held-input
ancestry requires the matching146 qualification, not substituted current147
hashes. Each native process was supervised separately with a512MiB RSS ceiling
and35-second deadline. These checks qualify exact selected-save restoration,
guarded evolution and retirement. They do not yet connect that step to live
home restoration and atomic owner publication inside one session. Browser
launches remain suspended.

## One native session from remote retirement to ordinary home entry

Build148 connects the guarded selected receiving restore to the existing
original region session. The combined owned fixture contains both the named
world root and the guarded snapshot fixture path. Its native-only snapshot
exception requires the explicit `BROWSER_STREAMING_OUTDOOR_FAMILY_SESSION_FIXTURE`
flag, the exact nested path, the matching session root, idle session stage and
receiving key1_0. Every other snapshot/profile check keeps its original gate.
The first combined147 attempt/PID32577 stops at that old ownership gate with
exit6 before any transfer; its runner is preserved in the output directory.
The qualified147 executable/sources remain in its generation archive.

`output/native-selected-home-session-001-observed.json` checks148/attempt002,
PID33052, exit0. One process restores the actual25300 receiving save and holds
the family with its24250 pause anchor. Original retirement occurs at26350. The
ordinary session then saves the later receiving state at26500, requests original
Quit Game, acknowledges all eight tracked original frees, disposes the source
world and removes the release observer before restoring home0_0. The archived
fully prepared home capture is an input; this is not a new live actor import.

The original home reader resumes clock57650 and native ticks ordinarily enter
hero530/GPL31 into its real guild469/GPL7. Home saves at59300 and60950 both contain
parent469, the guild's100/2 and hero's101 reciprocal memberships, script roster31,
one scheduled owner and `Rest_at_guild`. Typed ownership checks prove that the
latest receiving26500 snapshot no longer contains the outgoing hero/family.
The initial448 UNITs/49 GPLs/26 attachments and eleven held family records remain
exact. Retirement preserves the other444 UNITs/48 GPLs. The receiving world is
saved before disposal rather than substituting the earlier26350 snapshot.

`output/native-selected-home-session-001-published.json` then runs the runtime
home-task selector against an owned copy of the original selected revision5.
It publishes home59300/receiving26500 as revision6, followed by home60950 with
the unchanged receiving world as revision7. The producer runs once, exact retries
write nothing, reopening selects the same sole home owner, and8 files/4 world
slots remain with4096-byte I/O. Publication occurs after the native process
stops; atomic owner publication inside the active engine remains unqualified.

The ordinary revision exporter now accepts this final checked publication.
`output/native-selected-home-session-001-exported.json` and its revision7 receipt
bind both exported worlds to independently derived canonical states and native
inputs. Pending remote owners remain unexportable. Five refusal cases in
`output/native-selected-home-session-002-controls.json` include substituting the
actual earlier26350 receiving snapshot, stale aliases, a damaged selected home
and falsely claiming an active engine transaction. Original inputs are preserved.

The standalone selected-restore regression,148/attempt002/PID33216, also exits0
and passes `output/native-selected-remote-home-002-observed.json` without the
combined-session exception. The focused JavaScript suite passes91 tests. The
combined session's peak sampled RSS181469184 bytes is a short-run observation,
not a total resource bound. No browser/WASM launch or served build change.

```sh
python3 scripts/run-native-selected-home-session.py output/native-world-residency-build-148.json output/native-selected-remote-home-preparation-001/prepared.json output/native-outdoor-family-return-002-revalidated.json --receiving-archive output/native-outdoor-family-reload-generation-146-preserved.json --home-archive output/native-outdoor-family-return-generation-142-preserved.json --attempt 2
node scripts/inspect-native-selected-home-session.mjs output/native-selected-home-session-attempt-002.json output/native-selected-home-session-001-observed.json
node scripts/publish-native-selected-home-session.mjs output/native-selected-home-session-attempt-002.json output/native-selected-home-session-001-published.json
node scripts/export-native-entity-revision.mjs output/native-selected-home-session-001-published.json native-selected-home-session-001-exported
```

Use fresh output/attempt names and the matching official build. Fresh live home
actor import, an engine pause/publication/resume handshake, spatial seam travel,
cooperative regional activation, sustained browser resource limits and independent
internet/full matches remain unfinished. Browser game launches stay suspended.

## Native pause, ownership publication and resume (150)

Build150 adds a native-only owned-fixture bridge at the existing00417730 tick
wrapper. Its listing updates the clock at004178d4..004178ef and then dispatches
GPL/world updates. The bridge saves and holds the restored home before calling
that original tick; while held it also skips frame fixtures and session requests.
It polls acknowledgement at100ms intervals with a5ms host sleep and keeps only
bounded scalar/file metadata. It never writes guest gameplay phases or pointers.

The fixture requires the explicit v1 flag, the exact nested named-world root,
serial1/home0_0, an owned revision directory and the existing selected revision5.
The original disposal path still frees the receiving world before home restore.
The pause request binds a fresh nonce, session/region, both saved clocks/digests,
previous selected manifest and incoming530/31 alias. A supervised JS writer uses
prepareSelectedRemoteHomeReturn on an owned copy, commits revision6, checks exact
retry with zero writes, and independently reopens typed ownership before sending
an acknowledgement. The engine matches the request hash, selected manifest/state,
identity, predecessor, owner and world descriptors and hashes both selected GMPs
before releasing the original tick. This file channel is a trusted serial native
supervisor fixture, not an OS/browser lock or multiplayer ownership protocol.

The first149 attempt003/PID34242 stays paused and stops at its45-second controller
limit after rejecting both bad acknowledgements and the correct receipt. Its
comparison incorrectly used the predecessor state hash instead of the manifest
hash; the failed executable/sources/runner are preserved in
output/native-owner-pause-failed-generation-149-preserved.json.150 corrects that
comparison without replacing any original selected input.

Build150 attempt004/PID34709 exits0 with no stop reason. The receiving checkpoint
is the actual later26550 save, not the earlier26350 retirement snapshot. Home
pauses at57650 and rejects a wrong request and an unpublished-owner receipt at
that same clock. The JS writer publishes revision6 while that exact native PID
remains alive. The engine acknowledges400 skipped gameplay ticks, validates the
committed pair, and resumes at57650. Ordinary native AI then enters guild469;
home59400/61000 saves contain reciprocal100/2/101 membership, GPL member31 and
Rest_at_guild. Complete prior receiving checks still cover448 UNITs,49 GPLs,
26 attachments,11 guarded family records and unchanged444/48 other retired
records. Eight tracked disposal roots are freed through the original lifecycle.

Evidence: output/native-selected-home-session-003-observed.json and the embedded
Paused_Owner_Publication.json, independently rederived against actual saved
worlds. Eight metadata/order controls reject mismatched nonce/ack, substituted
receiving clock, advanced home clock, missing delivery liveness, premature
resumption, missing native refusal and changed resume clock. The91 focused JS
tests pass. Peak sampled RSS181174272 bytes is only a short-run observation.
The published revision6 contains the paused home state; the two subsequent home
saves prove resumed AI and are not silently promoted into that owner selection.

```sh
python3 scripts/run-native-selected-home-session.py output/native-world-residency-build-150.json output/native-selected-remote-home-preparation-001/prepared.json output/native-outdoor-family-return-002-revalidated.json --receiving-archive output/native-outdoor-family-reload-generation-146-preserved.json --home-archive output/native-outdoor-family-return-generation-142-preserved.json --attempt 4 --live-owner
node scripts/inspect-native-selected-home-session.mjs output/native-selected-home-session-attempt-004.json output/native-selected-home-session-003-observed.json
node scripts/check-native-paused-home-owner-controls.mjs output/native-selected-home-session-attempt-004.json output/native-paused-home-owner-001-controls.json
```

Use fresh attempt/report names. This qualifies the native pause/commit/resume
boundary with a preserved fully prepared home actor import. Fresh live import,
ordinary receiving AI, interrupted live recovery, spatial seam crossing,
more than two ownership regions, co-op regional activation, independent WAN/full
matches and sustained total browser resource bounds remain unfinished. No browser
launch, WASM build, served artifact change or player profile change occurs.

## Fresh hero import within the native handoff session (151)

The earlier150 proof restored an archived already-imported home world.151 instead
starts home0_0 from the actual selected revision5 dormant world at57650. That
input contains449 UNITs/28 GPLs/28 attachments and neither the retired504/28 owner
nor the incoming530/31 alias. The previous prepared Ready world is not loaded.
The preserved142 return preparation supplies checked record layouts and clock
patch offsets; actual imported bytes originate from this new session's held
original writer records and independently compare with its26350 held checkpoint.

prepare-native-session-home-import.mjs runs while the supervised native PID is
alive, before regional travel. It checks the original held UNIT/GPL/ORDR/CONT
records, maps their current561/49 aliases into the private reader's canonical
input namespace, restores the real469/7 home link, and translates held command
ages from the24250 pause anchor to57650. Twelve emitted records retain the full
actor payload; the script's already-held57650 context stamp remains exact. Each
result also matches the corresponding qualified layout/template record. No
prepared world, pre-created actor or original player profile is substituted.

The scoped original importer accepts the already-retired dormant home, constructs
four actors through the original private readers, assigns fresh530..533/GPL31,
restores the script/internal references and native/script home rosters, and
prepares the original scheduled continuation. The private reader still defers
collision placement. Before any gameplay tick, the bridge saves the new Ready
world, releases42 owned command requests through original removal, and uses
original Quit Game/world disposal to reload that new world in the same process.
An additional eight tracked roots are freed. The original full reader establishes
four collision cells and rendering; typed native guards check the registered
guild, family links, script roster, single queue entry and travel_to continuation.
Only then can the existing paused ownership publication proceed.

Official151 build/attempt005/PID35462 exits0, captures latest receiving26550 before
source disposal, creates the home import at57650, fully reloads it at57650, rejects
two bad acknowledgements, publishes revision6 while the engine is alive, and
resumes at57650 after398 skipped ticks. Home59300/61000 saves contain reciprocal
100/2/101 guild membership, GPL member31, one scheduled owner and Rest_at_guild.
The native region loader restores seeds from the actual dormant and prepared
saves (GPL/game2 here); the inspector now derives these seeds from the inputs
rather than assuming the earlier archived Ready world's44051797 seeds.

output/native-selected-home-session-004-observed.json independently verifies
all449/28/28 dormant records before construction, all453 UNITs/29 GPLs/33
attachments across the fresh prepared-world/full-reload boundary, unchanged448
other native actors and27 other scripts, full imported writer records and
sole-owner publication plus ordinary guild entry. The source-side448/49/26 and
11 held family-record checks remain. Eight fresh-import refusal controls reject
substituting a pre-imported world/actor preparation, absent producer liveness,
a damaged input, missing original constructor, deferred collision placement,
missing original disposal and a pre-publication gameplay tick. Eight paused-owner
controls also pass; the91 focused JS tests pass. Peak sampled RSS185204736 bytes
is a short-run observation, not a sustained browser memory bound.

```sh
python3 scripts/run-native-selected-home-session.py output/native-world-residency-build-151.json output/native-selected-remote-home-preparation-001/prepared.json output/native-outdoor-family-return-002-revalidated.json --receiving-archive output/native-outdoor-family-reload-generation-146-preserved.json --home-archive output/native-outdoor-family-return-generation-142-preserved.json --attempt 5 --live-owner --fresh-home-import
node scripts/inspect-native-selected-home-session.mjs output/native-selected-home-session-attempt-005.json output/native-selected-home-session-004-observed.json
node scripts/check-native-session-home-import-controls.mjs output/native-selected-home-session-attempt-005.json output/native-session-home-import-001-controls.json
node scripts/check-native-paused-home-owner-controls.mjs output/native-selected-home-session-attempt-005.json output/native-paused-home-owner-002-controls.json
```

Use fresh attempt/report names and one official native build/game at a time.
This qualifies fresh import plus pause/publication/resume for the trusted serial
native fixture and fixed two-region ownership store. It is not seamless spatial
crossing, generic actor migration, active receiving AI or replicated co-op
regional ownership. Interrupted live recovery, more than two owner regions,
browser activation/crash resolution, sustained total resource limits and
independent internet/full matches remain unfinished. No browser launch, WASM
build, served artifact staging or original player profile modification occurs.

## Interrupted publication and ordinary native recovery (152)

Build152/attempt006 deliberately terminates the supervised producer after its
revision6 ownership pair is committed and reopened, before acknowledgement is
delivered to the paused engine. Its expected exit is SIGTERM (-15). This is a
controlled fixture interruption, unrelated to the unresolved host-app crash.
The qualified checkpoint and normal export retain the newly imported home
world and latest receiving world without delivering the missing acknowledgement.

A separate process, recovery attempt001, loads that actual committed home world
through the original full reader. It uses no family import, actor guards or
ownership pause. An original checkpoint before gameplay matches all453 actors,
29 scripts and33 attachments exactly. Ordinary gameplay then enters the guild
and saves at59250 and60900. Temporary effects expire according to their saved
command timing, and their removal leaves no dangling command or attachment
references. The process exits0; peak sampled RSS171966464 bytes describes only
this short native run. The107 focused JavaScript tests pass.

The stopped later home save is committed with its unchanged dormant peer as
revision7 in a separate eight-file store. Exact retry performs zero writes;
the original revision6 checkpoint remains unchanged. This qualifies saved
progress publication after recovery. Export and another native load of revision7
remain unverified. Keep the recovery launch's exact source guards intact.

```sh
node scripts/qualify-native-interrupted-home-checkpoint.mjs output/native-selected-home-session-attempt-006.json output/native-interrupted-home-checkpoint-001-qualified.json
node scripts/export-native-entity-revision.mjs output/native-interrupted-home-checkpoint-001-qualified.json output/native-interrupted-home-checkpoint-001-exported.json
node scripts/inspect-native-interrupted-home-recovery.mjs output/native-interrupted-home-recovery-attempt-001.json output/native-interrupted-home-recovery-001-observed.json
node scripts/publish-native-recovered-home-progress.mjs output/native-interrupted-home-recovery-attempt-001.json output/native-recovered-home-progress-001-published.json
```

These are recorded evidence paths; new runs require fresh names. Recovery at
other interruption stages, generic migration, ordinary receiving AI, spatial
seam crossing, more than two ownership regions, co-op regional activation,
independent internet/full matches and sustained browser resource limits remain
unfinished. No browser launch, served artifact change or player profile change
occurs.

## Remaining limits

Eight tracked original frees do not account for every terrain suballocation,
actor allocation, cache, renderer/GPU object or host resource. Other heap usage
still varies; complete ownership and long-play bounds remain unqualified.
Complete restoration accounting for every native allocation, terrain cache
and renderer/GPU object remains unqualified. Live browser activation, continuous camera/hero crossing, co-op regional activation and
complete independent internet matches remain unfinished. The host-app crash is
unresolved and browser game launches remain suspended.

The earlier idle-TILE sweep reclaimed nothing and is not promoted into this
session path. Only the original full Quit Game and world disposal own cleanup.
See [the five-kingdom route](native-session-multiway.md) for controller commands;
use a fresh attempt and a matching official build report. Do not restart a game
or build on a tool timeout; inspect its actual handle/PID first.
