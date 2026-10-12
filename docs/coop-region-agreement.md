# Cooperative checkpoint agreement on the room relay

The current Begin adapter adds guarded recovery for an unavailable destination
before any proposal is submitted. Private candidate027 compiles it, while
actual co-op recovery and fresh-region generation remain unqualified. See
[unavailable cooperative destinations](coop-unavailable-destination.md).

## Checkpoint delivery added to the relay

The separately negotiated checkpoint-delivery-v1 contract now transports
bounded chunks during the exact Prepared proposal. End acknowledgement must
precede a requesting guest's Ready vote. See [the delivery wire contract and
verification scope](checkpoint-delivery.md). The final run passes47 tests,
including three new real local WebSocket delivery cases. This is relay-only:
the native transport/game bridge, actual co-op loading and internet match
qualification remain unfinished. No live service or served game was updated.


## Saved-neighbor host proposal (native181)

The gated coop-travel-west/east/north/south actions now request the original
replicated pause, capture the host's source checkpoint once, and call the
production Begin adapter once at the settled boundary. The generic transition
pause remains available. These are native action handlers, not published UI
buttons. RULE_COOP_TRANSITION_PAUSE, RULE_COOP_CHECKPOINT and
RULE_COOP_SHARED_READ must all be v1 for this path.

Begin admits only the current host/pause owner, exact frozen epoch/roster,
world/profile/local binding, matching source capture and an in-range adjacent
saved region. Original filename resolution and selected profile checks admit
both stores. Their actual sizes/digests/revisions are rechecked, including a
second check after parsing target metadata. The target clock is read from
SVGD-v10 and must match its manifest; GPL-v3 and game seeds come from the same
verified target file. The next canonical proposal serial is submitted through
the existing room agreement. Ordinary pre-commit cancellation preserves the
source room. Nonmatching observed permission rejects the exact session.

The original paused network/UI tick continues. Shared-read mode automatically
negotiates checkpoint agreement once per valid joined party, including during
normal gameplay; explicit host Begin also checks Enable. The native saved
metadata reader now optionally returns the clock and clears partial outputs
on failure. It uses a fixed1 KiB buffer and at most128 chunk headers, not a full
world copy. Fresh targets remain unsupported by this Begin adapter; generation
and transfer delivery are still required for continuous co-op expansion.

Official native-coop-pause-019/PID8885 passes10945 checks/671 guarded calls.
New real-file cases use an independent408-byte metadata-only layout with known
clock and seeds, every truncated prefix and11 structural/seed mutations.
This fixture is not a loadable graph or a production Begin/Ready invocation.
Native181/PID9300 links. Actual native181/trial043/PID9767 finishes0_0 -> -1_0
-> 0_0 with92 gameplay ticks,2/2 full typed saved-load matches and16 original
root frees. Seven actual-trace controls pass. Shared-read flags are absent;
this is ordinary restoration plus the binding/hold fixtures. Sampled peak RSS
184008704 bytes is only this short native trial. All producers exit0 and are
absent. The43 compiled inputs and28 evidence files plus binary/symbols/profiles
are frozen in parent output/native-region-restoration-generation-181-preserved.json.

Private WASM016 completes and static inspection finds Begin, Ready, load-stage
strings and all four travel actions, with unchanged conservative memory
settings. No module is instantiated. Parent output/wasm-session-candidate-016-
{build,observed}.json records this scope. The served game remains unchanged and
browser launch suspension remains in force.

Still unqualified: production host proposal, transfer delivery/import callback,
real co-op Ready/read/type3 attach/Loaded/resume, fresh-region generation,
provider/UI/exploration survival, full-match completion, independent internet
play and sustained browser memory bounds.


## Target checkpoint import and Ready adapter (native180)

CoopCheckpointStore::import_file now streams a received private file into an
exclusive inactive sibling with a fixed16 KiB scratch buffer. It verifies the
agreement's byte count and SHA-256, flushes data/metadata, then atomically
selects the exact host revision rather than deriving a local revision. Exact
retries reuse a freshly verified selected file; stale revisions and conflicting
metadata at the same revision are refused. Failed guards, sizes, hashes or
manifest publication preserve the previously selected checkpoint. Incoming
files are retained. The caller must admit the source/profile and exclude other
writers; directory power-loss and browser OPFS durability remain unqualified.

majesty_browser_coop_checkpoint_ready is gated by RULE_COOP_SHARED_READ=v1.
It admits only exact Proposed stage1 plus frozen epoch/roster/descriptor,
current world/profile/local kingdom and settled source pause/frame/clock.
An existing matching target store can vote Ready once; an explicit incoming
private path is imported before validation/voting. The paused tick calls the
existing-store branch once per proposal. A later incoming callback can request
one import attempt, but that transport callback is not connected yet. Failed
attempted import rejects the exact room. The original paused network/UI tick
continues. Stage1 never grants read or resume permission; stage2/3 retain their
separate exact checks. Import metadata uses frame0 because the wire has no target
frame; live rebuilding must still verify actual frame/clock/RNG.

Official native-coop-checkpoint-004/PID6861 passes919 real-file checks, including
an independent50003-byte SHA-256 vector spanning multiple scratch buffers,
guard/size/hash/publisher failures, retries and stale/conflicting revisions.
Native-coop-pause-018/PID7449 passes9258 checks/671 guarded calls, including exact
Ready/local-verification policy and the earlier Complete and20 original resume
queue cycles. Both producers terminate0 and are absent. These tests do not
execute the production Ready adapter or the live co-op load coordinator.
Native180/PID7859 links successfully;43 compiled inputs/binary/symbols/log are
frozen in parent output/native-coop-checkpoint-generation-180-preserved.json.

Private WASM014 completed and static inspection found the native179 load-stage
strings and conservative memory policy without instantiating a module. It
predates this import/Ready change. It is unstaged and not browser-qualified;
512 MiB initial shared memory,4 GiB maximum and eight preloaded workers remain.
Private WASM015 then completed with the import/Ready sources. Static inspection
found all load-stage strings plus Ready, and checked unchanged memory settings
without allocating WASM memory or running gameplay. Its producer PID8288 is
absent. Reports: parent output/wasm-session-candidate-015-{build,observed}.json.
The served game has not been changed. Browser launch suspension remains in force.

Still unfinished: host Begin and target selection/generation, incoming transfer
callback, real co-op Ready/read/type3 attach/Loaded/resume execution, provider
and UI/exploration survival, full matches, independent internet testing, and
sustained browser memory bounds.


## Gated cooperative load coordinator (native179)

The RULE_COOP_SHARED_READ=v1 coordinator now calls the production shared reader,
transfers its genuine context to original type3 attachment, and requests an
original pause immediately after phase2 rebuilding. It freezes the exact room
epoch, canonical descriptor, roster, local kingdom binding and profile. Loaded
is submitted once after checking the held world, clock and restored RNG. Only
an exact Complete agreement following local Loaded permits the pause owner to
enqueue the original secondary resume; clients wait for the replicated command.
Successful resume updates the active region identity without retaining old graphs.
These stages compile but have not executed together in a live cooperative match.

Original00416050 and004a5c00 return early when current phase7 equals requested7,
even when pending3 exists. The coordinator therefore blocks the next phase3
world tick and requests7 before gameplay can advance on an unauthorized resume;
it does not claim to cancel pending3 by requesting7 while still in7.

Official fixture017/PID4805 terminates0:8821 checks,671 guarded calls and20
original secondary enqueue/dequeue/dispatch/free cycles. The timestamp source
is a private header, and deferred phase copying is fixture-driven. Exact
Complete/local-Loaded policy is covered; no loaded world, real peer or production
coordinator runs. Failed fixture016's equal-phase assumption remains preserved.

Native179/trial042/PID5738 terminates0 with93 gameplay ticks, two full typed
saved-load matches and16 original root frees. Seven actual-trace controls pass.
The binding/hold fixtures use ordinary solo attachment and local resume; the
production shared-read flag is absent. Sampled peak RSS182648832 bytes covers
only this short native regression. All43 compiled inputs and29 evidence files,
plus executable/symbols/profiles, are frozen in parent output/native-region-
restoration-generation-179-preserved.json. Served artifacts remain unchanged.

Still unqualified: Begin/Ready and durable target import, actual provider and
frame reset through network mode2 rebuilding, co-op UI/exploration state,
production shared read/type3 attachment/Loaded/resume, full matches, independent
internet play and sustained browser memory. The existing UI restore hooks admit
solo mode1 only. Browser launch suspension remains in force.


The room relay has an opt-in checkpoint transition agreement. It uses the
existing WebSocket room and relay-owned player identities: no Steam/Galaxy
dependency, second connection, display-name identity or client-supplied sender
ID is involved. The native provider now exposes opt-in agreement commands and
decodes its events, but the game-owned region loader does not invoke that API
yet. Cooperative region loading remains disabled in the game.

Before proposing a transition, every registered member negotiates
`checkpoint-transition-v1`. The host then supplies the next room proposal
serial and an opaque checkpoint descriptor of at most1024 non-NUL bytes.
The relay freezes the exact registered two-to-four-player roster. It sends
prepare to all participants, load permission only after every participant's
matching Ready acknowledgement, and resume permission only after every
participant's matching Loaded acknowledgement. Retries do not add extra votes
or duplicate the permission events. Canceled/completed serials cannot replay.

There is one proposal, one deadline timer, and at most four Ready/Loaded IDs
per room. There is no growing transition history. Joining, registering another
player or replacing session settings while a proposal is pending is refused.
Destroying a participant cancels an uncommitted proposal; after load permission,
it ends the room. A disconnect uses the existing whole-room loss path.

Each phase has a30-second deadline. Before load permission, cancellation or
timeout cancels the proposal and retains the current room. After permission,
cancellation or timeout ends the room: some clients may already have left the
source world, so the remaining clients cannot safely resume a smaller party.
Completing/canceling/detaching cancels the timer and releases the proposal.
Legacy clients receive no new events unless all members explicitly negotiate.
The existing opaque game-packet and completion paths retain their behavior.

The descriptor is deliberately opaque to the relay. Agreement on its bytes
does **not** prove a client paused at the agreed frame, saved the shared world,
validated checkpoint content or loaded anything. The game adapter must supply
and validate a canonical descriptor containing world identity, source/target
regions, seed/generation rules, paused simulation frame, shared checkpoint
revision/digests and content/rule identity. Ready must follow durable checkpoint
validation; Loaded must follow the actual matching native load completion.
The party must remain paused until resume permission. These native/client
requirements remain to implement and test; this protocol is not anti-cheat.

## Wire extension

The existing DPR1 header, version1, strictly increasing per-connection RPC
request IDs, origin policy and room compatibility manifest remain in use.
Operation12 is Barrier. Operation109 is BarrierEvent. All words are little-endian
u32; strings are u32 byte length followed by their bytes.

| Barrier action | Body after opcode | Behavior |
| --- | --- | --- |
| 0 Enable | action, contract string | Negotiate exact contract; reply body is word1 |
| 1 Begin | action, serial, descriptor string | Host only; freezes current roster and emits Prepared |
| 2 Ready | action, serial, descriptor string | Records authenticated participant; all Ready emits Committed |
| 3 Loaded | action, serial, descriptor string | Admitted after Committed; all Loaded emits Complete |
| 4 Cancel | action, serial, descriptor string | Any participant; cancels before Committed, ends room afterwards |

Successful actions1..4 return an empty RPC reply. BarrierEvent body is
`serial, stage, descriptor string, player count, sorted player IDs`.
Stages1..4 are Prepared, Committed, Complete, Canceled. Descriptor equality is
byte-for-byte. The serial starts at1 and advances exactly once on each accepted
Begin, including subsequently canceled proposals. Ended rooms require a fresh
room and negotiation. Standard room-loss notification remains operation107.
Malformed/trailing/oversized data uses existing protocol rejection; unauthorized,
stale or unavailable transitions return existing Access/Closed/NoSession status.

## Evidence and remaining integration

`output/coop-region-barrier-002-observed.json` preserves relay/test sources and
the26-test log. Five tests use actual local WebSocket connections, including
four new agreement tests; twelve earlier room/packet tests still pass. A direct
four-player test completes100 transitions with only one proposal and zero
queued bytes after each cycle. Cases cover missing negotiation, stale/mismatched
votes, duplicate acknowledgements, roster changes, pre/post-permission timeout,
participant destruction and disconnect. Test PID81188 exits0 and is absent.
Both ephemeral server sockets and all test peers close after each live test.

```sh
upstream/majesty-recomp/.venv/bin/python -m unittest discover -s tests -p 'test_room*.py' -v
```

Those relay tests restart no existing relay and run no native build/game or
browser. They qualify local transport agreement, not native region activation,
save durability, lockstep pause/resume, independent internet play or sustained
browser bounds.

## Native provider seam

The C-compatible `native_seam.h` API now supplies
`recomp_network_barrier_enable`, `recomp_network_barrier_action` and
`recomp_network_barrier_snapshot`. Every call names the exact currently joined
session epoch; zero/stale epochs cannot send, reopen a socket or touch another
room. Only the provider that created the room may Begin. The API copies bounded
descriptors and retains one latest snapshot with at most four player IDs; it
does not append agreement events to the original gameplay receive queue.

The decoder checks the current relay roster, sorted unique IDs/local membership,
serial, exact descriptor, header, phase order and this client's own Ready/Loaded
vote before accepting permission. Replay, changed roster/descriptor, unknown
stage and skipped permission produce ordinary session loss and clear state.
Loss, rejection, Close and destruction also discard agreement state. A fresh
join gets a fresh epoch and negotiates again. Unsupported negotiation leaves
ordinary multiplayer available.

Prepared can arrive during the final participant's Enable RPC. A partner may
also cancel before the host finishes reading its Begin acknowledgement. Both
valid cases are accepted; early cancellation preserves the room and permits
the next serial. A failed RPC accompanied by newly delivered load/resume
permission closes the session rather than granting inconsistent recovery.

The official focused `directplay_contract_tests` target passes12434 checks with
zero failures, including existing provider regressions,100 native agreement
cycles, maximum-size descriptors, snapshot-copy isolation, stale epochs,
permission/roster refusals and early/colliding replies. This uses a fake
transport through the production adapter and actual COM stack ABI; it does not
connect the native adapter to a real WebSocket server or start a game world.
Inputs, binary and CTest trace are preserved in
`output/native-checkpoint-barrier-003-observed.json`. Test PID82548 exits0 and
is absent. No browser or game process is started; served engine files remain
unchanged.

```sh
# From upstream/majesty-recomp, through the official test tool:
.venv/bin/python tools/test.py --native-test directplay_contract_tests --jobs 1
```

Next connect that exact-epoch API to the game-owned shared save/pause/load
lifecycle with a canonical descriptor and real native completion observations.
Keep solo region unload refusal for multiplayer worlds until the full shared
lifecycle is implemented and verified. Private/served WASM delivery, actual
shared activation and independent internet completion remain unfinished.

## Checkpoint hashing prerequisite

The native loader provides `loader_hash_file_bounded`: fixed 16 KiB scratch,
regular nonempty input, an explicit byte budget and a one-byte overflow probe.
The paired-region TransferStore uses its admitted size (up to 64 MiB) for three
verification calls. The coordinator still excludes concurrent writes or
replacement; a digest is not a lease. Eighteen focused hash checks pass and
native166 links, with inputs/results in output/native-checkpoint-hash-001-observed.json.
Concurrent growth was not exercised. Canonical descriptor capture from the actual paused world and the shared
pause/save/load/resume adapter remain to implement; this does not enable co-op
world travel or change the served engine.

## Canonical game descriptor

`upstream/majesty-recomp/coop_transition.h` defines the fixed-storage
`majesty-coop-region-v1` codec. It has exactly 22 newline-terminated ASCII lines,
no NUL bytes, and a maximum of 1024 bytes. A rejected input never publishes a
partially decoded identity. Integers must have their unique decimal spelling:
no leading zeros, plus signs, negative zero, whitespace or overflow. The wire
contains no guest addresses, host paths or local camera settings.

| Line | Field |
| --- | --- |
| 1 | `majesty-coop-region-v1` |
| 2 | Named world, 1–40 lowercase letters/digits/hyphens |
| 3–6 | Source x/y and destination x/y, each within ±1,000,000 |
| 7–8 | World seed 71201 and generation version 1 |
| 9 | Executable/content identity: two lowercase SHA-256 digests joined by `:` |
| 10 | Content/rule configuration SHA-256 |
| 11–12 | Paused gameplay frame and simulation clock (u32) |
| 13–15 | Source checkpoint revision (positive u64), bytes (1–64 MiB), SHA-256 |
| 16 | Destination mode: 0 fresh, 1 saved |
| 17–19 | Destination revision, clock, byte length |
| 20 | Saved destination SHA-256, or `-` for fresh |
| 21–22 | Saved destination GPL and game RNG seeds |

Only a cardinal neighboring region is accepted. A fresh destination has zero
revision/clock/bytes/RNG fields and no digest. A saved destination requires a
positive revision, nonzero seeds and 1–64 MiB of hashed bytes. The source digest
identifies the host's shared checkpoint; independently serialized local views
are not assumed byte-identical. The provider separately authenticates its exact
sorted roster. Game admission must compare this identity to verified local
content and source state, and verify any transferred checkpoint before Ready.
The codec only validates structure; it does not establish pause or durability.

The official `native_coop_transition_tests` target passes 1163 checks, including
independent fresh/saved wire fixtures, every truncated prefix, hidden trailing
array data, numeric ambiguity, oversized saves and inconsistent destination
metadata. Frame, rule and checkpoint changes produce different wire identities.
Test PID84938 exits0 and is absent; exact inputs/binary/CTest trace are in
output/native-coop-transition-002-observed.json. No game world or browser runs.
The codec is not yet called by the live save/pause/load/resume path.

The pinned tick's `0041788c` observes gameplay state +0x28; `0041791d..00417924`
advances that frame only in phase 3, independently of clock0071c6a8. Original
phases 7/8 still execute the tick's networking and interface work while world
advancement is paused. A local early return or raw phase change does not prove
all peers stopped at the same frame. Use the original replicated pause path
and qualify that boundary before publishing the descriptor. The original
END_PAUSE_AND_RETURN handler004a5740 also invokes manager cleanup and changes
the selected phase; it cannot be assumed to preserve the existing room for a
region handoff. These lifecycle qualifications remain open.

## Original saved-world rebuilding hold (native178)

coop_hold_rebuilt_context in coop_restore.h calls original004a5c00 immediately
after original00416c30, while the attached saved context is current and phase2
has pending3. The original pause queues7 before the outer dispatcher consumes
the pending phase. Admission requires the guest baton, no active hook, a valid
stack, genuine00682950 context and matching current world/state/manager roots.
It verifies owner, frame and clock without writing a phase or advancing a world.
The coordinator must separately validate the real room/roster; this primitive
does not grant Loaded or resume permission.

The native-only BROWSER_COOP_REBUILD_HOLD_FIXTURE=v1 is restricted to owned
restoration profiles. It arms on an actual original saved-reader context,
uses ordinary solo attachment, observes original phase2 rebuilding and a
settled phase7, runs one complete original00417730 paused tick, then dispatches
an owning subtype1 control record/ref pair through original005a5610. Frame,
clock and gameplay count remain unchanged through resume-pending. Each record
and reference reaches original00645bc0; the temporary free observer is removed,
caller CPU is preserved by the adapter calls, and arena usage balances.
These are solo worlds with a fixed pause-owner test token, not network parties.
The fixture is excluded from WASM. The native session counter now counts only
calls entering original00417730 in gameplay phase3, excluding paused7/8 calls.

Native178/trial041/PID3815 exits0 after0_0 -> -1_0 -> 0_0:94 gameplay ticks,
two full typed saved-load comparisons matching before the first gameplay tick,
eight hold-stage observations, two record/two reference frees and16 original
world-root frees. Seven route/actual-trace tests pass, including145 rejected
hold-field/missing/extra/order contradictions. Sampled peak RSS186908672 bytes
covers only this short native trial, not a browser or sustained memory bound.
Five protected served files remain unchanged and all producers are absent.

Build175 initially failed because the fixture referenced a later-declared
session type; the typed scalar accessor fixes it. Trials039/040 reached the
actual paused tick and original resume but aborted on a false fixture claim
that two record allocations/frees must increment arena counters by two. Actual
original CRT pool reuse produced zero arena calls with unchanged retained heap.
The corrected test observes the two original frees directly and requires
balanced arena usage. These failed attempts remain preserved, not qualified.

Evidence: parent output/native-coop-rebuild-hold-001-{observed,trace-controls}.json,
native-region-session-attempt-041.{json,log}, and
native-region-restoration-generation-178-preserved.json (43 compiled inputs,
29 evidence files plus executable/symbols/profiles). Production shared-reader
execution, network type3 attachment, live provider survival through phase2,
Loaded voting, replicated005a4820 resume and browser activation remain open.


## Kingdom selection verified on actual saved graphs (native173/174)

The opt-in disposable-profile binding fixture now runs on the real unattached
context returned by original00435940. It temporarily supplies explicit live
party metadata for IDs7/8, captures/restores that metadata through CoopLiveParty,
and selects slots0/1 through the production coop_select_loaded_context and
original005bbaf0. Wrong player ownership is refused without changing selection.
Before ordinary attachment it restores the original selected slot, full0x11c
context header, full0x198 party block, phase/local-ID/mode and CPU. Guest heap
allocation counters, clock, roots and hook counts stay unchanged. It never
constructs an empty substitute context or claims a replicated network pause.

The fixture is gated by BROWSER_COOP_LOADED_BINDING_FIXTURE=v1 and requires an
owned actor-arrival-fixture-session profile under native-world-restoration,
menu phase1 with no pending transition, and no global active world. The runner's
--check-loaded-kingdom-binding flag requires before-first-tick Ready captures.
No personal profile, network transport, browser launch or served engine change
is involved. This is a real graph with temporary test party fields, not a live
cooperative kingdom or production shared-reader API test.

Native173/trial038 (PID99634) finishes the three-visit 0_0 -> -1_0 -> 0_0 route
with exit0 and95 original gameplay ticks. The initial saved load and saved
return both pass the binding fixture. All two saved loads match their expected
full typed state before the first resumed tick, including clock/RNG, terrain,
actors/agents, inventories, ownership/containers and GPL state;16 original root
frees are observed. The original input worlds/settings and refusal sentinels
remain unchanged, and the native producer is absent. Peak sampled RSS is
189104128 bytes for this short native run; this does not prove sustained memory
bounds or browser performance.

Six route/actual-trace controls pass. They reject missing/extra binding rows,
wrong kingdom IDs/slots, false network claims, zero contexts and failed
preservation flags. Evidence is output/native-coop-loaded-binding-001-observed.json
and -trace-controls.json, with the trial038 manifest/log and all43 compiled
inputs/binary/symbols preserved in native-region-restoration-generation-173-
preserved.json. Source/native build173 was frozen before the follow-up correction.

Static follow-up found that native172's shared reader incorrectly compared
context+9c to the manifest frame. Original004aef52 copies configuration+38 into
the generator's first word;004bbedd copies that word to context+9c. Writer
00435700 saves it, and reader00435591 restores it. This is a map configuration
property, not simulation-frame state. Native174 removes the false comparison;
the exact file digest/identity remains required. Actual frame/clock/RNG agreement
must be qualified in the attachment/rebuild coordinator. Native174 builds
successfully (PID99838), with43 compiled inputs frozen in native-coop-checkpoint-
generation-174-preserved.json and five protected served files unchanged.

Production shared-reader execution, live co-op attachment/rebuild/hold/resume,
full internet matches and sustained browser memory bounds remain unfinished.
The next runtime qualification must exercise that production coordinator with
a real party; these isolated binding results do not qualify it.

## Shared-checkpoint reader and live-party retention (native172)

The source now includes `majesty_browser_coop_checkpoint_read`, gated by
`RULE_COOP_SHARED_READ=v1`. It admits only a saved target under an exact joined
session and committed stage2 agreement. The canonical descriptor, frozen
roster, source pause frame/clock, trusted launch identity and target revision,
byte count, clock and SHA-256 must match. Original filename formatting is used
for both writable and readable paths; a higher overlay cannot substitute a
file for the verified private slot. Each committed serial permits one reader
attempt, not repeated I/O on every paused UI frame.

The reader invokes original00435940 with an initialized output and original
CYString lifecycle, suspends/restores the original renderer, and preserves the
Save UI label. A successful returned context must be a new00682950 object. Native172 also
contained the incorrect +9c/frame comparison corrected in native174 above. It restores the current match's inline IDs/names/counts
at settings+344 (0x198 bytes), then calls original005bbaf0 to select the local
kingdom on that unattached context. The retained block is current game metadata,
not the pending lobby block at settings+164. Failed retained-party restoration
cannot write through a replaced root or restore a different provider/local ID.

Success transfers context ownership to a future game coordinator, which must
attach or destroy it in the same baton turn before returning to dispatch. The
reader does not set mode1, attach a world, rebuild phase2, restore RNG, vote
Ready/Loaded or resume. An attempted read failure rejects the exact session;
original resource-cache changes prevent treating the old scene as safely
resumable. Successful newly owned typed contexts are destroyed by their
original scalar deleting destructor on a post-read refusal. There is no live
production coordinator call yet; this is not completed shared save/load.

Official fixture015 passes6135 checks/628 guarded calls (PID98077). New cases
cover one-shot live-party retention for both local members and committed read
admission/refusal for wrong stages, serials, roster/padding, lengths, descriptor
bytes, revision and generation. They use explicit metadata and fixed agreement
structs; they do not execute the original graph reader or successful selection
on a loaded context. Attempts013/014 to construct a standalone empty CCGame
failed (timeout/segfault), with original005bb5f0 requiring a registry at+84 that
the base constructor leaves null. Those failures remain preserved and the
standalone constructor assumption was removed, without substituting a fake
context/vtable. The next dynamic test must use an actual deserialized world.

Native172 compiles successfully (PID98509);43 compiled inputs, executable,
symbols and log are frozen in parent output/native-coop-checkpoint-generation-
172-preserved.json. All producers are terminal and absent; five protected
served files are unchanged. Browser launching remains suspended for the
unresolved host-app crashes. Actual co-op read/attach/hold/resume, independent
internet full-match testing and sustained browser memory bounds remain open.

## Paused host checkpoint source adapter

With `RULE_COOP_CHECKPOINT=v1`, the host freezes trusted world/region/content/
rules identity before requesting pause. Once phase7 settles, it attempts one
checkpoint per pause through the original writer004359c0. Exact epoch, live
host/roster, local kingdom ownership and unchanged world/frame/clock/profile
are rechecked before writing and publishing. Original CYString operations
preserve the Save UI's default name even when writing fails. The private
two-slot store caps saves at64 MiB, fsyncs the inactive file and manifest, and
atomically selects the next revision. This is source integration, not proof
that all peers paused, browser OPFS durability or live serializer success.

Official native_coop_checkpoint_tests passes846 checks, native_coop_pause_tests
passes6057 checks/628 guarded calls, and directplay_contract_tests passes12923
checks with a fake transport. Reports are in output/native-coop-checkpoint-
003-observed.json, native-coop-pause-012-observed.json and native-coop-session-
info-001-observed.json. Native171 links;42 recorded inputs, executable/symbols/
log are preserved by native-coop-checkpoint-generation-171-preserved.json.
Test PID94910 and build PID96130 exit0 and are absent. Formatter012 executes the original method
with an explicit Documents/My Games/MajestyHD/SaveGame root: flat names retain identity; nested directories
are stripped. The adapter now uses flat world/region basenames and validates
the exact basename and every existing profile descendant directory. A real
Win32 writable overlay resolves those names inside a removed temporary
profile. The earlier direct-child check would refuse this valid hierarchy.
Failed formatter009 is preserved. The
original serializer still needs execution on a loaded world. No UI
control, Ready/Loaded caller, shared load/resume or served WASM activation is
added; five protected served files remain unchanged.

## Original pause-control ABI

The pinned engine has two separately numbered object families. AI order
factory005da510 is not the network-control factory. The actual pause-control
record is 0x28 bytes, constructed by005a38c0 with vtable00682e28. Its +0x10
method004a5e60 returns the 16-bit command type9. Generic dispatcher005a5610
selects manager00682bc4's +0x90 slot004a5130. The by-value command/reference pair
uses original reference-count copying and destruction.

Manager+8c and the pause owner are network player IDs: original00497cc0
returns the ID, and004bb7f0 maps it through settings+344 to a kingdom slot.
The local kingdom is selected at state+24. IDs must not be used as slot
indices or constrained to0..3. Production coop_player_binding now checks
that mapping and exact sorted game/provider roster before pause and during
capture. Fixture012 exercises original getters and explicit metadata for
both members of two two-player layouts and all four shuffled members of a
four-player layout, including a vacant slot and large IDs. This does not
execute the loaded world's local-player dispatcher or prove shared loading.

Within that record, +8 is subtype, +0xc is player, +0x1c is pause UI options,
+0x20 is resume pace, and +0x24 is resume autosave interval. Subtype0 invokes
004a5c00: it records the pause owner in manager +0x27c and queues phase7 through
00416050. A duplicate pause does not replace the owner. Subtype1 queues phase3,
clears the owner, restores pace/autosave values and sets manager +0x280.
The pinned jump table at004a530c maps subtype2 to004a5289, which requests
phase2 if manager+c8 is absent. It does not select or read a checkpoint.
Subtype3 saves through004a5ac0, subtype4 invokes participant departure through
004a53d0, and subtype5 invokes exit/return through004a5740. The previous
identification of subtype2 as a load path was incorrect. These controls are
not qualified shared region travel and cannot replace simple pause/resume.

The actual saved multiplayer startup is004bbb90: mode3 copies the selected
name from0071c634+10 and invokes serializer+40 (00435940) at004bc11a. Before
reading, it snapshots live settings+164; after reading,004bc243..004bc255
restores the live slot-ID roster at settings+344. It gets the local player ID
through manager+34, finds its matching live slot and invokes004169a0 at
004bc2eb. That method sets state+24 and calls the loaded world's virtual+20
to select the local kingdom. A host save must not select the host's kingdom
for every client. Output/native-coop-load-path-001-observed.json preserves
eight original listings and the pinned six-entry control table. This is
static evidence only. Running the whole lobby startup mid-match is not
qualified: its transfer, teardown and phase2 behavior require separate
integration with the shared pause/load/resume agreement.

Pause does not immediately change the current phase. Original00415e40 copies
its pending phase before dispatching the next tick. Once phase7 is current,
00417730 continues networking without phase3's world/frame/clock advancement.
A shared checkpoint must wait for current phase7 and no pending phase, then
observe the resulting frame/clock. A pending phase7 while current phase3 still
allows the complete current tick to finish. Sender004a5cc0 routes subtype0 via
005a46a0 and later controls via005a4820; these paths still require real network
qualification, including the original command scheduling/flush boundary.

The official native_coop_pause_tests target passes2098 checks and306 guarded
calls over20 cycles: original record construction/type getter/generic dispatch,
pause, duplicate pause and resume, unchanged fixture clock/frame, restored pace
and autosave values, and60 final command/60 reference frees. Test PID87870 exits0
and is absent. Exact inputs/binary/CTest trace and39 unchanged recorded native166
inputs are in output/native-coop-pause-006-observed.json.

This is a stopped ABI fixture: it suppresses the original modal pause UI and
emulates only the outer dispatcher's phase copy. No world, original tick loop,
network peer, renderer or browser runs. The original silent sound manager is
needed because phase changes visit it; that one manager stays alive throughout
the fixture and is released with the owned guest arena. Full global sound/cache
shutdown is unqualified. Earlier fixture failures are preserved: a mistaken AI
factory, missing sound-manager initialization, and lookup-dependent sound
shutdown without normal libraries. These are not evidence about the app crash.
No production pause handler is replaced, and multiplayer solo-unload refusal
remains. The live replicated pause boundary and shared save/load/resume still
need implementation and verification.

## Production queue adapter

The game-owned coop_pause.h helper now constructs the original control record
and calls sender005a46a0. That sender transfers an owning command/reference pair
through manager table+0x48 (005a54c0) into the primary queue at manager+0x34.
Its timestamp field+4 is elapsed wall-clock time from world+0x14; it is not the
gameplay frame. The adapter retains no record pointer after the sender returns.
It requires the scheduler baton, no hook nesting, sufficient guest stack,
network mode2, the local owner, current phase3 with no pending phase, and a
valid queue whose admitted count is below4096. This admission cap applies only
to this extra request; ordinary engine queue behavior is unchanged.

The campaign source has an opt-in RULE_COOP_TRANSITION_PAUSE=v1 input action,
coop-transition-pause. It checks a joined epoch, at least two game slots and
loaded-world structures, retains one pending request, and clears it on epoch
or world change. Observation requires current phase7, no pending phase and the
same pause owner; normal resume clears the request. This observation supplies
no load permission, checkpoint durability or proof that peers share that frame.
No save/load/unload action, resume override, UI control or served WASM update
is added. Multiplayer solo-unload refusal remains.

Official native_coop_pause_tests now passes5257 checks/533 guarded calls:
20 original direct-dispatch cycles plus20 production queue cycles. Original
sender/dequeue/dispatch ownership releases all100 tracked commands and100
reference counters. The actual base queue destructor releases its backing
storage. Rejected requests allocate nothing; enqueue preserves the caller,
phase/frame/clock. Boundary checks refuse an unconsumed/pending pause and accept
only the emulated settled phase with matching owner. PID88920 exits0 and is
absent. Exact inputs/binary/trace are in
output/native-coop-pause-007-observed.json. Native167 links this source adapter;
its40 recorded inputs/executable/symbols are preserved in
output/native-coop-pause-generation-167-preserved.json. Build PID89344 exits0
and is absent. Five existing route tests pass; protected served files retain
their hashes and filesystem stamps.

The queue fixture supplies only a private timestamp header, not a loaded world.
It continues to suppress modal UI and emulate the deferred phase copy; it starts
no original tick, peer or browser. The live epoch/party/action caller, actual
replicated boundary, durable canonical checkpoint capture and shared region
save/load/resume remain to implement and qualify.
