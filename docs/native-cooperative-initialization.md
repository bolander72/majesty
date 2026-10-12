# Original cooperative initialization

The private port initializes the original network manager's time-per-frame
member from the original configured global. The pinned constructor00497a00
leaves manager+88 unset; GameStart0045304b reads it before original match
initialization0049929f assigns it. Serial host captures029/031 differed in this
field alone. This was allocator data in an actual protocol field, so reusing a
guest vote across those messages would be invalid.

The adapter calls the entire original constructor, verifies its returned typed
manager, then initializes this one scalar from006c0ea0. Saved reads and original
match initialization retain their later assignments. The default is50 ms.
Native401/capture032 advertises50 ms; original guest033 consumes that unchanged
GameStart and original host vote, emits its own original vote, and saves both
kingdoms at clocks0 and500. These ten startup ticks do not qualify sustained
synchronized play. The stopped parser retains both palaces, buildings and GPL
links. No game assets or generated translations are edited.

## Exact recorded-peer checks

The new guest replayer admits a vote only from an independently parsed original
guest world. It preserves the guest's original NotReady, Ready and GoStatus
messages, plus the parent original host's world descriptor and vote. This host
must emit the byte-identical GameStart and GoStatus before receiving that guest
vote. The reference has no game world and never answers subsequent gameplay,
shared-load or resume acknowledgements. Host and guest run separately, with one
native process at a time and owned profiles, registries and relay instances.

Capture034 correctly refuses after the timing repair: the next host's actual
random seed changes at GameStart body offset24. Its timing remains50. That seed
is an original scenario field and must match; it is not ignored as padding.

A native-only fixture makes subsequent serial tests reproducible by setting the
owned host's scenario seed at settings+144 immediately before original
GameStart00452b50 serializes it. Admission requires the actual SDK host/local1,
the real two-player roster1/2, matching original inline slots, no attached world,
and the exact owned profile. It changes no phases, player identities, packets or
votes. The fixture is excluded from browser builds. Original GameStart reads
this field through settings+74+d0 and puts it at body offset24; the pinned-code
audit checks that instruction sequence.

Native402/capture035 and native403/capture036 are failed fixture observations,
retained with terminal producers. Capture036 identifies a mistaken extra check:
settings+4e0 is0 despite the SDK proving host1/local1/roster1,2. The fixture now
uses that actual SDK host evidence and retains its original roster/world/profile
guards. These failed observations do not qualify initialization.

Evidence includes `output/native-network-start-timing-035-audit.json`, terminal
capture032 and its packet audit, `output/native-coop-world-033-inspected.json`,
and the refusal reports034–036. The protocol suite has12 focused guest-replay
tests, including changed timing/seed refusals and unchanged socket delivery
through the production relay with two synthetic worldless peers. Those tests
do not stand in for a second original engine.

## Native404 serial round trip

Capture037 passes the owned seed fixture and original packet audit. Actual
guest038 initializes and saves through the original reader/writer; actual
host039 then emits the byte-identical GameStart and host vote, receives the
unchanged vote from that independently inspected guest, and initializes its own
world. Both original engines save at clock0/frame0 and clock500/frame10. Their
actual SDK bindings remain guest2/slot1 and host1/slot0. Each run is terminal,
with isolated settings/registry/executable and no live second original engine.

The stopped round-trip audit confirms matching terrain heights, counts, palace
and building IDs, original script links, positions and gold for both kingdoms.
It retains the differing raw SVGD, MTER, GPL, BLDG and GSGL roots at both clocks:
the complete saves are not byte-identical, and this is not an exact-state or
paired synchronization qualification. Both roles retransmit their identical
original GoStatus once; the replayer delivers the recorded guest vote only once.

Evidence: `output/native-multiplayer-lobby-037-packet-audit.json`,
`output/native-coop-world-038-inspected.json`,
`output/native-coop-world-039-inspected.json`, and
`output/native-coop-initialization-039-audit.json`. Their original payloads and
full saves remain private local evidence. Native RSS peaks are190595072 and
195117056 bytes; these short samples do not prove a sustained memory limit.

Private WASM057 completes the official one-job build, static inspection and
126-file isolated package with190 archived inputs. The linked constructor
timing guard is present; the native-only seed fixture and its log strings are
absent from the module. No module is instantiated. Peak sampled build RSS is
1360347136 bytes, below the runner's2 GiB ceiling. This is compiler memory,
not game memory or host-app crash qualification. Served028 remains unchanged.

The batch manifest preserves76 source files and13 reports, plus the owned
native404 executable's exact digest. Its69 focused checks and three integrity
refusal controls pass: wrong original role, a supposedly stopped producer still
alive, and a changed retransmitted vote despite valid per-file hashes all
refuse. See `output/coop-init-039-qualification.json` and
`output/coop-init-039-preserved/manifest.json`.

Shared saved return, prepared shared resume, fresh-region travel and current
paired gameplay remain unqualified. The active goal continues. Browser launches
remain suspended under the latest workspace instructions; candidate028 remains
the served player. This timing defect is not evidence of the cause of the
unresolved host-app allocator crashes.


## Original prepared pause (native407–409 / private WASM058)

A bounded explicit recorded-guest fixture now admits only the five unchanged
original empty-input packets at frames10/12/14/16/18. It binds the inspected
terminal guest and identical original host GameStart/votes, ignores the host's
own command bundle, and delivers the captured window once when the host requests
an empty frame in that window. It authors no command, frame or Loaded vote and
has no continuing second world. The pinned audit includes the original queue
preparation through0049e230/005a4250 before the004179a9 frame/input return.

Native040 reaches original clock1000 with this captured window (a scalar final
read, not a full world save at1000). Native405/043 initially tried to pause before
queue preparation;406/046 then exposed the fixture's incorrect frame0 assumption.
Native407/050 queues the original pause at actual frame1/clock50, but its
reference rejected the host's nonempty command bundle. The corrected reference
keeps that bundle outside empty-input admission. Native407/051 saves a real
settled phase7 world at frame11/clock550; final original clock stays550.

The production travel handler formerly consumed actions from ordinary graphics
polling before original queue preparation. It now consumes new pause/direction
actions only at the prepared004179a9 input seam. Settled-pause observation,
checkpoint saving and proposal servicing remain available from ordinary UI
polling. Native408/054 arms an ordinary native `coop-transition-pause` action:
the production handler queues it, and a read-only native observer confirms that
handler's exact epoch/world/owner. The engine settles phase7 at frame11/clock550,
saves both kingdoms through the original writer, and stays at550 through the
final read. This qualifies the native pause action; directional travel, a shared
read, Loaded agreement and paired resume remain unqualified. The legacy report
field `productionTravelActionRuntimeQualified` covers this pause action only.

The shared saved reader now releases the preceding saved player-name strings
through original004373e0 after full source teardown, under its unchanged exact
committed party/pause/worldless guard. Native409 finishes resetting the empty
owning range before a boundary check can pump party loss, so a refused read does
not retain destructed strings. The front-end reader retains its phase1 guard.
Actual shared-reader execution is still required; compilation is not proof of
that path. Native409/solo074 regresses five visits with four matching saved
comparisons,151 completed ticks and32 original root releases (peak sampled native
RSS191954944 bytes).

Evidence: `output/native-coop-pause-051-audit.json`,
`output/native-coop-pause-054-audit.json`,
`output/native-coop-world-053-inspected.json`,
`output/native-coop-world-054-inspected.json`,
`output/native-coop-inputs-054-abi-audit.json`,
`output/native-solo-regression-074-qualified.json`, and
`output/coop-pause-054-qualification.json`. Native408 producer sources are frozen
in `output/coop-pause-054-preserved/manifest.json`;409 differs in the owning-range
retirement sequence. Guest053 and host054 RSS peaks are194084864 and177979392
bytes, respectively; these short native runs do not prove sustained browser
residency or resolve the host-app allocator crashes.

The official original-control component suite passes26558 checks/1165 guarded
calls with zero failures, and60 focused Python controls pass. Private WASM058
compiles, passes static inspection and packages126 files/190 archived inputs.
Bounded scanning confirms native-only seed/pause fixtures are absent from the
module. Peak sampled compiler RSS843022336 bytes. No module is instantiated;
published028 and player profiles remain unchanged. The goal stays active.


## Actual paused-party read and attachment component (native413–416 / WASM059)

Pinned005d9cf0 returns uniqueness in AL while upper EAX retains its reference
pointer. Original0049a59e tests AL. Both cooperative ring/outgoing retirement
paths now use that same width, preventing premature destruction of shared
batches. Component070 passes26578 checks/1169 guarded calls, including four
independent original shared-owner lifetimes and heap recovery across eight
retirement cycles. Six original config checks pass.

The production saved reader now shares its complete original read leaf with
an owned native component. Actual native413/066 gets through source teardown,
network retirement and owning saved-name cleanup, then reads successfully.
Native414/069 exposes a fixture error: full writer00435610 needs its live-world
player query00418b50; an unattached graph cannot be written with that wrapper.
Native415/073 attaches through original00415f30(kind3), writes successfully and
disposes, but returns into an already-entered render call after its objects
were destroyed. That failed producer remains unqualified. Attempt072 ended its
shortened script before loading a world and supplies no readback qualification.

Native416 defers destructive work until outer tick entry(return00415e88), after
the preceding frame/render call has returned. Host076 completes original full
read, live SDK party/local-kingdom restoration, original attachment and full
write, then full target teardown and original exit with guest code0. Its smoke
harness returns1 because the intentional original exit precedes one final
scheduled clock peek:23 of24 steps ran. The component inspector explicitly
requires that exact owned script/one unfinished peek, all component markers,
clean original guest exit, terminal producer and unchanged inputs. Default
startup inspection still requires a complete script. Six acceptance/refusal
controls pass, including a live producer, missing read/attachment flags,
abnormal native status and rejection by the default startup mode.

All parsed entity records, queues, scripting RNG and gameplay RNG match the
source. The unattached/read component has context clock0 versus source550;
the actual paused global clock remains550 throughout. Full restoration remains
false. Every raw root is retained, including SVGD/ORDR/GSGL differences. This
component performs no phase rebuild, committed descriptor agreement, Loaded
vote, shared resume, concurrent second original world or browser gameplay.
The next work is original phase rebuild and target clock/global-state
restoration before shared resume or repeated cooperative travel qualification.

Evidence:output/native-coop-reference-bool-070-audit.json,
output/native-coop-readback-076-inspected.json and
output/native-coop-readback-076-inspector-controls.json. Guest075 and host076
sampled native RSS peaks are192512000 and194625536 bytes; these short serial
runs do not establish browser or repeated cooperative residency bounds.
Failure generations063/066/069/073 are frozen separately. The latest final
sources and reports are in output/coop-read-076-preserved/manifest.json.

Private WASM059 builds, passes static inspection and packages126 files/190
archived inputs. The new native readback/seed controls and unique completion
markers are absent under a4096-byte stream scan. An older common loaded-binding
diagnostic uses the same log prefix; that broad prefix alone cannot identify
this fixture. Peak sampled compiler RSS399867904 bytes. No module is
instantiated or served; published028 and player profiles remain unchanged.
Browser launch suspension stays in force and the goal remains active.


Native427 incoming host pause qualification (serial104/105/107/108, private WASM064):
The terminal original host now preserves its actual SDK room/server descriptors.
Paused replay requires an independent current-source inspection of that full
host world, exact original initialization and the unchanged72-byte pause plus
five20-byte input packets. No frames or pause commands are synthesized.
Guest103 reached clock550 but its second save was still startup500; only108
qualifies the actual incoming settled boundary. A native-only observer queues
no local pause and writes no phase/clock. It waits for original phase7/pending0,
then requires owner1/frame11/clock550, unchanged source party/context/settings
and the original player2/local-kingdom1 binding. Original full saves retain
both palaces/buildings/GPL data. Guest108 completes all24 smoke steps and exits0.

Strict serial host107/guest108 saves differ in entities. Clocks, both RNGs,
terrain heights and entity counts match; differing roots include GPL/BLDG/GSGL
and the normal save metadata/terrain. No new normalization or paired equality
claim is introduced. These differences need an original-field audit before
shared synchronization qualification. Guest saved restoration/rebuild, committed
Ready/Loaded votes, shared resume, fresh cooperative neighbors and sustained
cooperative residency remain unqualified. Source106 was refused before native
launch because the new inspector input was absent from the admission inventory;
that inventory now includes its exact hash and refuses changed/missing copies.

Focused43 original replay/input checks,5 incoming-pause evidence checks and19
saved-source admission checks pass. Native peak190857216 bytes, guest108 peak
174211072. Private WASM064 compiles, passes all prior static coordinator/return/
loading/UI/memory checks, and a4096-byte stream scan excludes unique incoming
pause/phase2/native reader controls. Compiler aggregate peak400130048 bytes.
No browser/module launch or publication occurs; published028 remains usable and
profiles preserved. Evidence: parent output/coop-incoming-pause-108-qualification.json;
source freeze: output/coop-incoming-pause-108-preserved/manifest.json. Goal active.


Native429 guest-owned saved restoration qualification (serial113/114/115/116,
private WASM065): the owned component now admits either original host1/kingdom0
or original guest2/kingdom1. Guest admission additionally requires the actual
incoming host pause observer. Exact SDK party, typed proxy/both context fields,
manager context, pause owner and local kingdom remain guarded throughout.
Native428 guest112 completed read/rebuild/hold/two paused bodies with clean
original exit0 and exact saved semantic equality, but its completion diagnostic
still hardcoded host1/kingdom0. The inspector refused it. That generation stays
frozen in parent output/coop-guest-read-112-refused-preserved/manifest.json. Both
completion sites now report the actual validated network ID and selected slot.
No inspector exception was added for the incorrect label.

Guest116 on native429 settles the incoming original owner1 pause at frame11/
clock550, restores its own full save, retains player2/kingdom1 through original
attachment and phase2 dispatch, and uses the production original pause hold.
Two original paused network/UI bodies return at rebuilt frame0/clock550 with
unchanged saved RNGs. Original full serialization, target disposal and guest
exit0 follow. Strict entities, queues, clock, both RNGs and semantic roots match
the source with existing permitted metadata/shading/order differences only.
Raw equality remains false. Two original guest startup votes precede its first
input; there are zero later startup votes. This is native-only target scheduling
and the guest's own save. Host-authoritative checkpoint loading, committed
Ready/Loaded, shared resume, fresh cooperative travel and live paired gameplay
remain unqualified. Serial host/guest entity differences from107/108 remain
recorded and unresolved.

The smoke status1 and23/24 script steps are intentional component exit before
one later clock peek. The component inspector requires clean original exit0,
that exact owned guest script, actual guest completion labels and all prior
rebuild/hold markers. Default startup inspection still refuses the component.
Seventeen acceptance/refusal controls include incorrect guest/host labeling,
missing incoming observation, changed pause bytes and missing host inspection.
Focused43 replay/input tests,6 incoming evidence tests and19 source-admission
tests pass. Native guest116 peak205602816 bytes. Private WASM065 compiles and
passes all current static checks plus streamed native fixture exclusion;
compiler aggregate peak932675584 bytes. No module is instantiated or published;
published028 and player profiles remain preserved. Evidence is parent
output/coop-guest-read-116-qualification.json; source/report freeze is
output/coop-guest-read-116-preserved/manifest.json. Browser suspension remains
in force and the complete shared-travel goal stays active.


### 2026-10-08: host checkpoint recipient restoration, native431/private WASM066

Guest124 now reads an unchanged owned offline copy of inspected host123's full
paused checkpoint at frame11/clock550. The original reader, attachment, phase2
rebuild, production pause hold, two paused bodies, writer/disposal and original
exit0 execute with actual player2/kingdom1. Native430 guest120 exposed a real UI
bug: the restored host palace stayed selected while the original guest UI also
selected its own palace. The production shared-reader wrapper now preserves
saved selection for the host and lets original code clear it for recipients.
Guest124 has exactly one selected palace, its own; no direct flag rewrite was
added. Guest125's own-save regression retains strict semantic equality.

Strict host-to-guest save equality remains false. A separate read-only gameplay
comparison checks every entity/queue/root with only pinned local-state fields
separated: bit0 of each original palace selection, GSGL v6 pane words0/4/8/12
and selected/cached IDs20/24, plus the SVGD v10 two display-name strings. The
original instruction audit binds the setter, primary writer, UI getters, GSGL
writer, name-vector writer and ANSI/UTF16 serializer to the pinned executable.
The complete metadata suffix/configuration, remaining flags/global words,
ownership, clocks, both RNGs and all gameplay bytes stay exact; existing narrow
calendar/terrain-cache/ID-keyed order permutations remain unchanged. Both full
raw saves/differences and the test peer display-name mismatch are retained.
This comparison does not relax the strict own-save comparator.

Twenty-two native evidence acceptance/refusal controls and18 saved-state
corruption controls pass. These include stale extra selection, wrong ownership,
non-selection flags/building bytes, opaque globals, clocks/RNG, metadata suffix
and reversed roles. Twelve file-custody tests pass (31 with saved-source tests),
plus43 original replay and6 incoming-pause evidence tests. Guest124 peak sampled
RSS175652864 bytes; private WASM066 compiler aggregate peak768311296 bytes.
WASM066 builds and passes current static checks, recipient-policy checks and
native-only fixture exclusion. It is neither instantiated nor published.

This is one stopped original guest reading the original host's save from an
owned offline copy, not live checkpoint transport or a committed loading
barrier. Native-only scheduling still queues phase2. Actual Ready/Loaded,
coordinator execution/shared resume, fresh co-op neighbors, saved returns,
repeated co-op residency and paired gameplay remain unqualified. Published028
and player profiles stay unchanged; browser suspension remains in force. The
goal stays active. Parent evidence: output/coop-host-read-124-qualification.json;
frozen sources/reports: output/coop-host-read-124-preserved/manifest.json.
