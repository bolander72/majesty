# Persistent hero homes

`web/world/hero-home.mjs` now registers an observed native guild and its hero
roster, stores their logical identities, and reserves/cancels travel without
discarding the home or occupied slot. This is persistent metadata and transfer
preparation. Native remote-home projection, completed owner transfer, recruitment
capacity enforcement and atomic publication with regional worlds remain unfinished.

## Registration and lookup

Registration reads the original guild UNIT/GPL association, the GPL `members`
list, native group 100, each member's GPL `home` backlink and native kind-101
parent relationship. The two rosters must agree. Duplicate, missing, nested or
incompatible associations are refused. The prototype accepts at most eight
registered members per guild; this is a compatibility bound, not an inferred
native recruitment limit.

World/content identity and the original registration checkpoint bind stable
guild/member IDs. The original registration is retained; later saves reuse it.
The lookup filename is derived from the guild's saved region/UNIT/GPL alias:
`Frontier_GuildHome_<region>_<unit>_<agent>.checkpoint`. A reload can recover the
stable ID from one file without enumerating every dormant region or guild.
Trying to register a different checkpoint origin over that alias refuses the
existing record. A native alias remains region-local and is not itself a
portable entity ID.

For future co-op integration, one authority must issue the registration and
share its exact canonical bytes. Players must not independently derive IDs
from their own save files: timestamp and view state can make those bytes differ.
The current real-input utility uses an isolated development-world namespace and
an exact native-build/mod-settings fixture digest. It does not qualify a general
asset-pack compatibility contract or a multiplayer registration protocol.

## Reservation semantics

One checked record of at most 4,096 bytes holds a guild, its observed roster and
at most one pending travel request. Reads/writes use the caller's world storage
lock and atomic writer. Standard OPFS/Web Locks can use the existing
`opfsRealmStorage` adapter in the same owned world directory. Browser execution
and browser recovery have not been tested for this addition.

Reservation preserves the entire roster, original aliases and home region.
It records intent; it does not claim the hero has reached another world. Its
occupied-slot count is the registered roster count, not a new native capacity
calculation. Revision/digest comparison rejects stale concurrent requests.
Exact reservation and cancellation retries recover acknowledged or interrupted
publication without adding another member or freeing an away hero's slot.
Cancellation removes the pending request and keeps the home/member IDs.

The home-bound preparation wrapper validates the selected registration and
the actual native home/script association before adding persistent IDs to the
existing actor plan. It refuses rebinding to an unrelated building and refuses
remote regions until the original-runtime home projection and owner transfer
are qualified. A reserved destination must match the request. This wrapper
currently prepares same-region inputs only; no alternate guild or null home is
used to bypass the remote-home requirement.

## Actual evidence

```sh
node scripts/register-native-hero-home.mjs \
  output/native-generated-hero-attempt-002.json \
  output/hero-home-registration-<fresh-three-digit-number>
```

The utility independently validates the stopped original recruitment producer,
registers its actual Warriors Guild 469 / GPL 7 and Warrior 502 / GPL 27, then
performs registration, eastward reservation, disk reopen, alias lookup and
cancellation in a fresh owned output directory. It confirms one occupied slot
throughout and exact retries. Remote preparation is refused. The home-bound
same-checkpoint package remains the same five binary records totaling 2,751
bytes, and the original native save remains unchanged.

Current evidence is `output/hero-home-registration-002/registration-observed.json`.
Its terminal filesystem writer uses atomic rename and serial fixture supervision;
it does not establish interprocess or browser locking. Earlier registration 001
is retained as a historical prototype with lookup by logical ID.

All 62 focused home, arrival and GPL tests pass. These include interrupted
reservation/cancellation, stale/conflicting requests, corrupt records, namespace
and alias refusal, lookup among 500 unrelated files and concurrent-read exclusion.
No native build/game process, WASM staging or browser launch ran for this step.

Next, the original runtime must represent and route a remote guild faithfully,
preserve both native and GPL rosters before scheduling the hero, and couple the
registered home state to completed regional ownership publication. New recruits,
deaths, destroyed guilds, arbitrary held inventory and co-op publication need
their own observed original-runtime handling. Metadata reservation alone does
not qualify playable hero travel or whole-browser resource bounds.

## Original remote-home rejection boundary

Native build 045 is now preserved, with its three exact sources and symbols,
under `output/native-initialization-generation-045-preserved.json`. The stopped
initialization and recruitment inspectors revalidate that archive after the
current runtime advances; they reject foreign source/symbol tuples, a live or
nonterminal producer, and an unregistered historical executable. Both original
recruitment captures still revalidate after build 047.

The original `IsValidGamePiece` callback at `005a8a80` delegates to the agent
reference check at `00625580`. That method requires a registered, nondeleted
script agent **and a resolved native object**. Its native association getter at
`00626310` only resolves a positive native unit alias. The original SDK `isdead`
returns true when `IsValidGamePiece` fails. Original `go_home` selects
`use_building` and sets the target to the hero's home; `use_building` tests
`isdead(target)` before navigation and resets the task on failure. Keeping a
positive script reference alone therefore cannot implement remote homes.

A native-only, owned-profile trial enabled with
`BROWSER_STREAMING_HOME_VALIDITY_FIXTURE=v1` checks the original methods at the
normal attached-world frame boundary. It uses the existing loaded Warriors Guild
469 / GPL 7 as a positive control and existing registered, nondeleted pure GPL
agents 12 and 20 as negative controls. It does not disconnect the actual guild,
write any hero home, create a guild substitute or schedule either pure agent.
All three original reference objects are constructed in 64 bytes of owned
scratch storage. Their agent bytes, queues, alias counter, clock, world, hook
count and live guest heap totals remain fixed across the queries. The guild's
normal lazy native getter is resolved before the object comparison baseline.
These controls establish validity semantics; they do not create or qualify a
remote guild projection.

```sh
python3 scripts/run-native-home-validity.py \
  output/native-world-residency-build-047.json --attempt <fresh-positive-number>
node scripts/inspect-native-home-validity.mjs \
  output/native-home-validity-attempt-<number>.json <fresh-proof.json>
```

Attempt 001 exits successfully before reaching gameplay and is **unqualified**:
no original validity trial runs. Attempt 002 loads the kingdom and exits 0 after
21.50 seconds, with maximum sampled RSS 176,177,152 bytes. The guild returns
valid, both pure agents return invalid, and the independent stopped inspector
passes. Native input/settings files remain unchanged. Exact instruction/SDK
provenance is in `output/native-home-validity-instruction-audit.json`, and the
runtime proof is `output/native-home-validity-002-observed.json`. All 64 focused
home, arrival, GPL and validity-trace tests pass. Five copied-provenance refusal
controls pass. Build 046 fails compilation on heap-counter names; corrected
one-job official build 047 succeeds. No browser launch or WASM staging runs.

The next integration must recognize a registered remote-home task and request
travel at a safe interpreter boundary **before** the original invalid-gamepiece
check resets it. It must restore the real home building and both rosters before
resuming building use. This does not authorize making every pure agent valid,
pretending the remote guild is a local building, or discarding the home target.
Native routing, completed hero travel and cooperative regional publication remain
unfinished.

## Original local-home script gate

The native-only `BROWSER_STREAMING_HOME_TASK_FIXTURE=v1` trial loads the
independently captured original Warrior 502 / GPL 27 and Warriors Guild 469 / GPL 7 in
an owned `actor-arrival-fixture-home-task-*` profile. It does not project a
remote guild, change a home reference or perform a regional transfer.

The first pause intercepts actual `use_building` dispatch 006381b0, before the
script's invalid-target guard. Its original caller 00639220 still updates the
context clock and clears its running flag. After that cleanup, a quiescent
frame captures the baseline and whole agent invocations 00626cf0 are held using
the original eight-byte return. The hold does not rewind the first caller's
clock writes. Release delegates to the original agent and building-use body;
the original script changes to `travel_to`, keeping `home=7`, `target=7` and
`taskname=go_home`. Both temporary hooks are removed.

Native build 056 / attempt 009 independently passes. Original-writer held records are
identical 1852-byte GPL envelopes at clocks 45550 and 46550, across 20 skipped
agent invocations. The resumed 1850-byte record at 46600 contains `travel_to`
with the same home, target and task. The original native save occurs during
the hold; it independently preserves both GPL/native guild memberships.
The separate resumed record proves continuation after that save. Elapsed
time 41.81 s, maximum sampled native RSS 184,303,616 B; these are native observations,
not browser memory qualification. All 68 focused home/arrival/GPL/trace tests
pass. Original input saves/settings and served WASM remain unchanged.

```sh
python3 scripts/run-native-home-validity.py \
  output/native-world-residency-build-056.json --attempt <fresh-number> --home-task
node scripts/inspect-native-home-task.mjs \
  output/native-home-task-attempt-<number>.json <fresh-proof.json>
```

Pinned dispatch/return/cleanup instructions are in
`output/native-home-task-instruction-audit-002.json`; independent actual proof
is `output/native-home-task-009-observed.json`. Native build 047 validity evidence is
preserved separately from native build 045 initialization/recruitment evidence.
The qualified build 056 executable, sources and symbols are preserved in
`output/native-home-task-generation-056-preserved.json`. All three archived
producers revalidate; three altered task-provenance controls are refused.

Attempts 001–003 refuse the initial view before installing hooks: the first
reader incorrectly limited named contexts to 8, while this original Warrior
has 12. Attempts 004–006 reach gameplay without observing a hold. Attempt 007
preserves and resumes the task but leaves hooks installed until process exit;
attempt 008 additionally removes them. Only 009 includes the independently
checked post-resume original-writer record. None qualify remote-home routing.

**Physical hero motion is not frozen by this script gate.** Original command,
attached effect and native movement state still need travel coordination.
No physical guild entry, remote-guild restoration, player-hero crossing or
cooperative region publication is qualified by this trial. Next, bind the
gate to a registered remote-home travel request and coordinated native actor
departure; restore the real guild and reciprocal rosters before resumption.

## Coordinated native script and command hold

`--home-task --home-motion` extends the owned trial with
`BROWSER_STREAMING_HOME_MOTION_FIXTURE=1`. After original building-use code
creates the hero's travel orders, the trial holds both the hero's GPL entry
and its native common command dispatch `005e53c0` for one second. The native
hook identifies its owner through `processor+4`, returns with four argument
bytes and delegates all other units. It does not clear an order bank or use
the original spell-freeze path, whose unfreeze script resets tasks.

Three immutable original full-world snapshots use the same named writer and
autosave renderer lifecycle as the other native checkpoint trials. The
independent inspector exhausts typed parsing, checks exact record hashes and
requires native/GPL guild memberships, physical parent state, original script
continuation and the complete observed attached graph to agree.

Build 057 / attempt 011 passes. At clocks 27300 and 28300, the entire Warrior
UNIT record (426 bytes), GPL record (1850 bytes) and two-command ORDR record
(336 bytes) are identical. Original Path kind 4 / bank 0 and Queue kind 7 /
bank 1 remain intact. The attached scriptless effect 505 and its own native
order record also remain identical. Twenty hero GPL invocations and forty
hero command invocations are held; 265 other-unit commands are delegated.

After release, two original hero command calls return. At clock 29300 the
hero is physically inside its actual guild 469, with native state flags 514,
guild physical membership kind 2, retained native home memberships 100/101
and retained GPL member 27. Original scripting has naturally selected
`Rest_at_guild` and cleared `taskname`; the consumed travel orders are absent.
The engine has replaced effect 505 with effect 506. No fixture code sets
the physical parent, clears orders, changes the home or supplies a replacement
guild. All three temporary hooks are removed.

The process exits 0 after 46.11 s, with maximum sampled native RSS 181682176 B.
All 73 focused home/arrival/GPL/trace tests pass. The actual proof is
`output/native-home-motion-011-observed.json`; pinned dispatch instructions are
in `output/native-home-motion-instruction-audit-001.json`. Exact native 057
sources, executable and symbols are preserved in
`output/native-home-motion-generation-057-preserved.json`. Builds 045, 056
and 057 revalidate after the changes; four altered provenance controls refuse.

Attempt 010 preserves the held records but ends before the release check and
hook cleanup, so it is unqualified. A trailing script `wait` only schedules
the next action; with no subsequent action it does not extend the run. Attempt
011 adds a final capture after that wait and qualifies the full local trial.

```sh
python3 scripts/run-native-home-validity.py \
  output/native-world-residency-build-057.json --attempt <fresh-number> \
  --home-task --home-motion
node scripts/inspect-native-home-motion.mjs \
  output/native-home-task-attempt-<number>.json <fresh-proof.json>
```

This qualifies one bounded local script/command hold and original local guild
entry. Absolute command and effect ages still advance with the shared world
clock. Long holds, damage from other actors, arbitrary attached effects,
cross-clock migration, registered remote-home routing, regional hero ownership
publication and co-op travel remain unfinished. Browser launch suspension
continues; no WASM build, staging or browser test runs.

## Selected-owner return-home task resolution

`web/world/hero-home-task.mjs` now resolves a saved `go_home` task against its
registered guild identity. `readRegisteredHomeTask` reads the current entity
revision and one home record through `EntityRevisionStore.withSelectedMetadata`,
under the same adapter lock. Metadata is copied within a 4096-byte bound; native
read leases end with the scope. Home publication must use that same adapter and
lock. No dormant directory scan or nested acquisition is needed.

The resolver checks stable member identity, current local aliases, original
native/GPL association and queue membership, home/target references, captured
`use_building` or `travel_to` continuation, and reciprocal native/GPL rosters.
It rejects stale revision tokens, foreign membership, mismatched guilds,
conflicting pending travel and unsupported remote-home projection. A completed
local task produces no request. Returned ownership/home revision tokens must
be compared again when a future operation publishes state.

Thirteen new tests include changed local aliases after two synthetic ownership
handoffs, exclusion of home/owner publication during inspection, revoked readers,
corruption, stale tokens and 500 ignored dormant files. The 116-test focused
regression suite passes (`output/hero-home-task-regression-tests-001.log`).

`output/native-registered-home-task-001-observed.json` independently binds the
two held native057 tasks to the existing registered guild/member IDs from source
002. After original local guild entry, no return request remains. These saved
worlds descend from that registered source; its native045 development content
descriptor remains a fixture binding, not cross-build compatibility proof.
This inspection does not seed or publish a real persistent hero owner. The
selected-store path is tested with synthetic checkpoints. Live gate dispatch,
remote guild projection, native hero handoff and cooperative publication remain
unfinished. No native build/process, WASM staging or browser session was started.

## Inert remote-home record in the neighboring original kingdom

`web/world/remote-home.mjs` creates a bounded original GPL version-2 record for
the registered guild. Nine primitive attributes carry the format marker,
world/content/guild IDs and the original home region, unit/agent aliases,
description and player. Native unit ID is zero, the name and function list are
empty, and there are no typed agent references. The record is 453 bytes, with
a 1024-byte limit. It represents the actual registered home as metadata; it
does not create a building or turn the proxy into a valid game piece.

Preparation001 binds the registered0_0 guild from recruitment002 to the
independently initialized neighboring1_0 checkpoint from residency007. The
legacy native045 fixture content descriptor remains unchanged; this is not a
general pack compatibility scheme. The proposed agent ID100000 is unreserved.

Native-only `BROWSER_STREAMING_REMOTE_HOME_FIXTURE=create|reload` is restricted
to an owned `actor-arrival-fixture-remote-home-*` profile in1_0. Original
constructor00625e70 reserves ID45, original reader006269b0 fills the record,
and original manager tree insertion00634460 registers it without active queues.
Original validity00625580 still returns zero. The original writer00626740
returns the exact 453 bytes with only the reserved ID replacing the proposal.
Compared queues, clock/world and hook count remain unchanged during admission.
The original manager owns and tears down the registered agent.

Build058 fails on one C++ declaration with incompatible `auto` types; corrected
official one-job build059 succeeds. Create attempt001 exits0 after an original
UI full save containing the exact record and no native backlink or queued proxy.
Reload attempt002 loads that saved GMP, finds ID45 already registered without
allocation/insertion, verifies all nine identity attributes and original invalid
game-piece result, then saves it intact again. Evidence:
`output/native-remote-home-001-observed.json` and
`output/native-remote-home-002-observed.json`. Exact native059 sources, executable
and symbols are preserved in
`output/native-remote-home-generation-059-preserved.json`.

`web/world/remote-home-cache.mjs` now reuses an existing qualified proxy for its
logical guild rather than proposing another allocation on each arrival. It
streams candidate records serially, retains at most one <=1024-byte record,
and refuses duplicate logical identities, queued proxies, native backlinks or
corrupted home metadata. Current aliases are re-read from the selected snapshot;
no native pointer survives unload. The caller must hold that snapshot's lease.
`output/native-remote-home-reuse-002-observed.json` reuses actual original saved
ID45 and its unchanged payload. All124 focused tests pass, including16 synthetic
reuse admissions and corruption/queue/backlink refusals.

```sh
node scripts/prepare-native-remote-home.mjs output/remote-home-preparation-<fresh-number>
python3 scripts/run-native-remote-home.py <current-qualified-build.json> \
  output/remote-home-preparation-<number>/remote-home-preparation.json --attempt <fresh-number>
node scripts/inspect-native-remote-home.mjs <terminal-create-manifest.json> <fresh-proof.json>
python3 scripts/run-native-remote-home.py <same-build.json> <same-preparation.json> \
  --attempt <fresh-number> --reload-from <terminal-create-manifest.json>
node scripts/inspect-native-remote-home.mjs <terminal-reload-manifest.json> <fresh-proof.json>
```

This remote-home-only trial did not import a hero. Later sections qualify
explicit home-aware preparation, original import, reload and live activation.
Integration must bind the
actual hero to this stable guild identity, preserve its logical occupied slot,
remove source native/GPL membership safely, and publish one current owner.
Original `go_home` must be intercepted before the remote target reaches
`use_building`'s validity guard. Returning must restore the actual guild and
reciprocal memberships before original building use resumes. Native path work,
command/context/effect ages, attached-effect lifetime and co-op publication
remain unfinished. These two native processes ran serially; no browser launch,
WASM build or staging ran. Browser suspension remains active.

## Explicit registered-hero ownership and real stopped seed

Revision identity version2 now includes the canonical original guild registration
and stable member ID. Each revision explicitly declares a native guild alias in
the home region and a pure remote-home alias in the neighboring region. Version1
identities retain their native-only contract; there is no automatic conversion.
The existing manifest framing remains version1 and binds the explicit identity
and state version through their hashes.

`web/world/entity-home-ownership.mjs` checks the actual guild descriptor/player,
native/script association, reciprocal current native and GPL membership, and
the current hero's script home. Remote owners may reference only the registered
inert proxy; they cannot borrow a different local guild. The proxy must have its
canonical identity payload, no native association and no active queue entry.
The original registered member IDs remain origin aliases; current owner aliases
can change on return. Save and handoff rules preserve retained home bindings.
Typed checks do not prove general opaque or historical reference closure.

`scripts/seed-native-hero-owner.mjs` independently rechecks actual recruited
source002 and native059 remote-home reload002, then publishes their unchanged
original GMP files under one initial owner in0_0. The proof is
`output/native-hero-owner-seed-001-observed.json`. Reopening selects the same
stable member, guild and proxy; an exact retry performs zero writes. Initial
storage retains five files; two alternating revision slots remain bounded to
eight files after later synthetic revisions. Reads and writes are <=4096 bytes,
with one stored-source read in flight. Proposed destination actor aliases are
unreserved and absent; no hero was imported or removed.

Fourteen new synthetic tests cover outward/return ownership with fresh aliases,
membership/proxy/duplicate-owner refusals and interrupted publication selecting
one complete old or new owner. Synthetic transfers do not qualify native hero
travel. The stopped adapter uses process-local serial supervision, not an OS or
browser lock. No game process, native build, browser launch or WASM staging ran
for this seed. Live return routing, cross-clock effects, native revision reload,
safe source removal, cooperative publication and browser resource use remain
unfinished.

## Home-aware arrival capsules and the real cross-clock refusal

`web/world/registered-hero-arrival.mjs` prepares under the selected version2
owner store's shared lock. It checks the expected manifest and derives both
simulation clocks from the actual selected SVGD sections; callers cannot supply
replacement clocks. Both world leases remain held until preparation completes.
`web/world/arrival.mjs` now has an explicit version2 registered-home path; the
existing version1 native-to-native path keeps its previous contract.

Outward preparation maps the hero's typed home/target references to the inert
registered proxy, retains the original guild/global member IDs and logical slot,
and removes the actual home member from the arriving hero's native CONT101
group. It updates the two original nested chunk sizes and member count while
retaining the empty group and all unrelated bytes. It records the source guild's
native/GPL unlink obligations rather than manufacturing a destination building
or guild members list. Returning preparation inserts the actual native home
member and records the actual guild's reciprocal native/GPL restoration duties.
Physical guild parents are never cleared to force an exit. Entire prepared
records are hash-bound copy preconditions; capsules and transformations retain
the existing per-record and total byte budgets.

Twelve new tests exercise an actual prepared capsule in synthetic outward and
return publications, one stable owner/member and occupied slot, independently
expected original record framing, stale requests, occupied/borrowed aliases,
physical-parent/inventory/unknown-reference refusal, changed opaque bytes,
caller mutation, storage-lock exclusion and complete saved-clock parsing.
All150 focused tests pass in
`output/registered-hero-arrival-regression-tests-004.log`.

`scripts/inspect-native-registered-hero-arrival.mjs` independently rechecks the
real source002 and native059 remote-home reload002, reopens their initial owner
publication, then runs selected preparation without any writes. Current proof
`output/native-registered-hero-arrival-002-observed.json` observes source clock
25800 and destination clock18250 and refuses at the attached marker command's
unequal-clock boundary. All five owner files retain their exact hashes. The
real Warrior's attached503 effect cannot be dropped or migrated with a guessed
clock; original marker lifetime behavior must be qualified next. No actual
hero capsule is exposed for this real pair.

These capsules do not reserve destination IDs, change either selected snapshot,
perform original-runtime import/departure, project continuous seam positions or
resume a remote building task. The original guild capacity is represented by
the registered logical slot; enforcement during later recruitment remains
unfinished. Native hero transfer/reload, multiplayer publication and browser
resources remain unqualified. No native game/build, browser launch or WASM
staging ran for this work.


## Original recruit-marker lifetime across regional clock bases

Official one-job native build064 adds a disposable-profile observer for the
original source002 Newrecruit effect503 and its marker5 command. Original common
dispatch005e53c0, animation leaf005abad0, callback4101/005e3670 and original order
removal all run. The observer restores the real world clock before returning to
the normal frame. No browser launch or WASM staging occurs.

Native attempts004 and005 load separate fresh copies of the same actual full
source save. The first uses25800 as the projected clock base; the second uses
the actual neighboring save's18250 base, changing only the command timestamp.
Both complete at relative1200ms after12 original animation calls and25 samples.
The original bank calls reason2 (completion), then reason1 (removal), followed
by one original leaf cleanup. It sets the effect's dead flag and retires the
order. All original hero/effect UNIT writer bytes match across the two runs at
every sample. The full command bank bytes match after normalizing only the
four-byte dispatch timestamp; empty bank output is identical.

`output/native-marker-clock-pair-001-observed.json` independently checks process
termination, exact native/source/input provenance, callback order, record bytes,
clock restoration and sampled resources. Exact build064 is preserved in
`output/native-marker-clock-generation-064-preserved.json` with4KiB copy bounds.
Attempts001–003 are failed observer checks retained for audit: initial callback
field, fourth-argument and cleanup-call assumptions were corrected. Their aborts
are not passing gameplay results.59 focused JavaScript regression tests pass
in `output/native-marker-regression-tests-002.log`.

Qualification is limited to this original saved Newrecruit marker in the source
world with two synchronous projected clock bases. It does not establish actual
destination import, other marker modes, script callbacks, actor ownership
handoff, continuous seam position or browser resource bounds. The native tests alone do not establish a migrated actor or destination import.
Preparation enabled after that qualification is described below. Future content
packs remain documented in [world expansions](world-expansions.md).


## Real home-aware capsule with preserved recruit-marker timing

`web/world/newrecruit-marker-clock.mjs` now permits partial timestamp preparation
for the qualified original recruit effect. It recognizes twelve complete living
UNIT states by their original record digests, excluding only the audited native
ID and physical-parent ID. Every other byte, including draw part, frame, flags
and relative position, must match. The class key alone does not qualify another
effect. The complete original command must retain its exact bank, rate100,
delta100, flags336, increment1, callback4101 and zero script/leaf callback state.
Only a pending dispatch age below100ms is accepted. Due/future timestamps,
unknown modes and altered command or record framing refuse.

Explicit registered-home version2 arrival uses the partial dispatch-clock plan
and changes only the four-byte timestamp to preserve unsigned age. Existing
native-only version1 cross-clock behavior is unchanged. Entire original effect
and order records remain copy preconditions; changes between shape validation,
planning and copying refuse rather than bless new bytes through a later hash.
No game assets or original record payloads are included in source files.

`scripts/inspect-native-registered-hero-clock-arrival.mjs` independently rechecks
both stopped native marker producers, the original recruited source002 and the
native059 neighboring proxy save, then prepares from the selected owner while
deriving clocks25800/18250. Current evidence is
`output/registered-hero-clock-arrival-preparation-003/arrival-preparation.json`.
Its five inert records total2743 bytes: hero418, agent1846, container84, effect151
and orders244. Proposed identities100000/1000/100001 remain unreserved. Typed GPL
references independently map self27 to1000 and home7 to pure proxy45, preserving
sentinels. Native CONT101 is empty and CONT1 retains the effect100001 under hero
100000; registered guild/member identity and one logical guild slot remain.
The timestamp becomes18250 with age0 and unchanged frame0. All five selected
owner files and both original full worlds retain their hashes.

64 focused checks pass in `output/newrecruit-arrival-regression-tests-003.log`.
Five new integration groups inspect all24 living original samples, renamed
native/parent aliases, altered effect and command bytes, unsupported banks,
invalid/pending ages, and mutations during planning. These require ignored
native004 records and explicitly skip when those private original inputs are
absent; they do not use a synthetic fingerprint bypass. The preceding59
portable cases still pass. An intermediate fixture check omitted the required
empty CONT root; its correction is recorded in the test logs. The real capsule
check also corrected its assumed group ordering and now checks actual membership
content independently.

This is prepared original data, not a migrated or playable hero. Actual native
ID reservation, source unlink/removal, destination reader/finalization, actor
scheduling, remote go_home routing and paired owner publication remain required.
Continuous seam position is still unqualified: the source hero remains at its
captured3440,288 coordinates, not a claimed boundary crossing. Original complete
writer captures show both hero and effect have two components, PRIM and SECD;
that matches the existing complete-reader framing but does not qualify import.
No native process/build, browser launch or WASM staging ran this turn. Browser
launch suspension and the served WASM identity remain unchanged.


## Original hero/effect import and whole-world save

Native-only `BROWSER_STREAMING_HERO_IMPORT_FIXTURE=1`, restricted to a disposable
`actor-arrival-fixture-hero-import-* / frontier_1_0` profile, consumes the five
real prepared records above. Original UnitStage reads hero and effect privately,
with incoming native IDs cleared to request deferred fresh registration. The
original factory assigns554/555; the original GPL constructor assigns48. Only
known native identity, EA, physical-parent, container membership, script identity
and typed self-reference sites are remapped; pure home45 is retained. Original
bank reader005b1b90 restores the actual recruit command. Original family
finalization005a2370 runs for both native objects. The agent is deliberately not
queued pending remote-home task handling.

Official one-job builds065–067 succeed. Attempt001 loaded but did not enter the
fixture because an old isolation predicate only allowed0_0; the new explicit
profile guard corrects that without broadening the old guard. Attempt002 reaches
construction but the private reader refuses the nonzero proposed native ID.
Attempt003 exits0 with both readers complete, exact original writer comparisons,
an original full `Hero_Import_Ready.GMP` at clock18250, and original removal of
both actors plus deferred GPL cleanup before ordinary frames resume. Failed
attempts remain preserved and are not passing import evidence.

`scripts/inspect-native-hero-import.mjs` independently checks stopped provenance,
actual prepared/source records, the original full GMP, all five imported records
and precise aliases. It compares every byte after only the audited ID changes,
checks the single attached child, empty home membership, absence from both active
queues, surviving preexisting typed identities, and exact pure-home bytes. It
also reopens the unchanged selected owner publication. Current evidence is
`output/native-hero-import-005-observed.json`, after revalidation through the
exact archived build067 in `native-hero-import-generation-067-preserved.json`.
64 focused JS checks continue to pass; no new browser launch or WASM staging ran.

This qualifies an unscheduled original-runtime destination import and original
whole save in a disposable native world. UnitStage defers spatial exposure;
explicit grid publication and live physical behavior are not qualified here. Resumed hero
AI/remote go_home behavior, source removal, paired regional owner publication,
continuous seam travel, multiplayer and browser resource behavior are still
unfinished. Source owner502 remains selected in0_0. The temporary native
registry entry does not publish a second regional owner. The complete original
cleanup proves the fixture objects were removed; it does not prove a sustained
heap/cache plateau across repeated gameplay travel.

## Fresh original hero/effect save reload

Official one-job build068 and fresh native reload001 exit0. The new fixture
loads the actual original Hero_Import_Ready.GMP from native import003 in a
separate process. It restores original hero554, attached effect555, GPL48 and
pure home45 at saved clock18250. Original native associations, lazy backlinks,
physical parent and attached container agree. Original record writers emit
exact hero418B, effect151B and agent1846B; the recruit bank's208B also matches.
The fixture writes Hero_Reload_Ready.GMP with the original full-world serializer,
then removes both actors and the deferred script through original cleanup.

`scripts/inspect-native-hero-reload.mjs` independently revalidates import003,
the unchanged selected source owner and world files, exact input ranges from
the actual original save, terminal native provenance and bounded resources.
All five complete actor/GPL/container/effect/order records in the new original
GMP match the input save byte for byte. All445 typed native identities and48
script identities survive. The home45 record stays exact and neither home45
nor actor48 is in either active script queue. Reload001's highest sampled RSS
is175226880B (167.1MiB); this is one native trial, not a browser or repeated-travel
memory bound. Evidence: `output/native-hero-reload-001-observed.json`. Exact
build068 is archived in `output/native-hero-reload-generation-068-preserved.json`.

This qualifies original full-load/save restoration of the unscheduled actor.
Live activation is qualified in the following section; complete remote-home
task routing, source removal, paired owner publication and continuous seam
travel remain unfinished. There was one
native build and one native game process; no browser launch or WASM staging.

## Original destination AI and remote-home request gate

Native live006 at build074 passes after a fresh original load of actual
Hero_Reload_Ready.GMP. The loaded Warrior554 has four original occupied grid
cells, one rendering entry and native/script backlinks to GPL48. One original
queue insertion leaves the actor bytes, agent header and other queue entries
unchanged. Hero_Live_Ready.GMP retains all five original imported records exactly,
with actor48 uniquely queued and pure home45 unscheduled.

The restored recruit effect555 initially has a populated command bank and no
ORDR update membership or derived UNIT+40 marker. Original unit notification
005b66f0 refreshes that specific group through00596a70 and its original nonempty
predicate005f2920. Membership changes from0 to1; all seven other members retain
their order/hash. Original normal world ticks then dispatch the effect24 times
and remove it. The complete evolved save has neither effect555 nor its ORDR
record or hero child membership. No manual clock projection or leaf execution
is used by this trial. The pinned instruction contract is independently checked
in `output/native-restored-order-group-instruction-audit-001.json`.

During6000 game milliseconds, original hero AI returns21 times, original
contexts return402 times and the hero's commands dispatch20 times. At clock19300
the real AI selects go_home/use_building targeting pure home45. The dispatch
gate returns before original use_building would declare that proxy dead; normal
context cleanup still completes. Subsequent101 whole-agent invocations are
held. Complete original settled GPL records1853B match before/after the hold,
preserving home45, target45 and go_home/use_building. Other agents execute5590
times during the trial. Hero_Live_Evolved.GMP at clock24250 retains this actual
task, one active queue entry, the original physical footprint and rendering
entry, and the exact original453B pure home record. Original actor removal and
deferred script cleanup retire its aliases, queue entry and drawing entry;
all three observation/gate hooks are removed.

`scripts/inspect-native-hero-live.mjs` independently verifies actual prior
import/reload and selected owner, original saved ranges, both new full saves,
complete held GPL bytes, effect/child/order absence, original instruction
contract, terminal native process and bounded resource samples. Evidence:
`output/native-hero-live-001-observed.json`; exact074 is archived in
`output/native-hero-live-generation-074-preserved.json`.85 focused JavaScript
checks pass with zero skips in `output/native-hero-live-regression-tests-001.log`.
Maximum sampled native RSS is179945472B (171.6MiB), not a browser or repeated
travel memory bound. Builds069–074 and live001–006 were run one at a time;
earlier failed/incomplete attempts remain preserved and are not passing evidence.

This qualifies a live native restored actor and a preserved return-home request,
not actual return routing. The selected source owner still remains502/GPL27
in0_0. Source guild/member/actor/effect removal, paired publication, actual seam
coordinates, travel/resume, multiplayer and browser resources remain unfinished.
The gate is native-only and restricted to owned live fixture profiles; no
browser launch, WASM build or staging ran.

## Original source departure and stopped paired publication

Build075/departure001 remove the actual source Warrior502/GPL27 and its recruit
effect503 at clock25800. Original operator5 removes the one typed guild member;
original actor removal retires effect then hero, and original deferred script
cleanup removes GPL27. Guild469/GPL7 survives. Other manager queue entries and
drawing entries retain their counts and ordered hashes, and a bounded traversal
finds neither removed pointer in the original grid. Original full saves capture
the world before and after this lifecycle; there is no selected-owner mutation
inside this native trial.

Independent save inspection finds447 retained UNIT records byte-identical to
the loaded pre-departure world and25 retained agents byte-identical, excluding
guild7. The guild changes only by removing one8B typed list member and updating
four length/count words. All known typed references to27, native memberships
to502/503 and actor27's queue entry are gone. Loading the original source first
clears guild469's UNIT+40 marker from513 to512; every other UNIT/GPL record is
exact. This load difference is verified separately from departure. Standalone
guild writing uses SECD version2/271B versus full-world version1/267B; the PRIM
bytes are exact and the standalone before/after guild records are identical.
These fixture-specific differences are not general save transformation rules.

Evidence is `output/native-hero-departure-002-observed.json`, independently
rechecked against preserved exact075 in
`output/native-hero-departure-generation-075-preserved.json`. Native departure001
terminates successfully and peaks at175489024B sampled RSS (167.4MiB). This is
one native trial, not a browser or repeated-travel resource bound.

`scripts/publish-native-hero-handoff.mjs` uses that actual departed source world
and build074's actual Hero_Live_Evolved.GMP. It recreates the verified initial
owner in a new disposable store, then publishes both full worlds through one
revision manifest. Revision1 selects registered hero554/GPL48 in1_0, preserving
the logical guild slot and exact remote home45. The original seed store and
all producer worlds remain unchanged. The destination's actual saved
go_home/use_building request is retained; publication does not route it home.

Four serial interruptions (after source staging, after state staging, before
manifest publication and after publication) select a complete old or new pair.
Reopening and retrying converge on the same revision; exact retries write zero
files. Five invalid owner/alias/home/manifest/digest requests are refused. Eight
files retain four world slots, with reads/writes capped at4096B. These are stopped
serial filesystem checks, not concurrent OS writer or browser recovery proof.
`scripts/inspect-native-hero-handoff.mjs` independently revalidates both native
producers and the initial seed, derives the expected revision, and reopens the
published store and all four recovered stores. Evidence:
`output/native-hero-handoff-001-published.json` and
`output/native-hero-handoff-001-observed.json`.44 relevant ownership/revision
tests pass with zero skips in `output/native-hero-handoff-regression-tests-001.log`.

Fresh original paired reload of this committed revision, remote return routing,
seam coordinates and continuous travel remain unfinished. No browser game,
WASM build/staging or extra native game was used for publication/recovery.

## Fresh original loading of the actual committed pair

The selected revision exporter now supports explicit version2 registered-home
identities. Both world copies retain their selected read leases through the
receipt write; validation includes home aliases and refuses a changed selected
revision before launch. `output/native-hero-handoff-export-001.json` exports
the actual source After and destination Evolved worlds in4096B writes.

Build076 loads those two exports in separate fresh native profiles, one process
at a time. Source side0 at25800 has no502/27 or effect503; original guild469/7
loads with an empty native/script roster. Destination side1 at24250 restores
hero554/GPL48 with one existing queue entry, four occupied grid cells and one
render entry. Pure home45 remains unscheduled and native-less, and the original
saved go_home/use_building request remains intact. No actor is inserted or
scheduled to manufacture the reload result. The destination actor is removed
through the original lifetime after the full re-save and before normal AI can
dispatch its remote-home task without a routing gate.

Independent inspection revalidates both current exports, actual native
producer/build/fixture/settings identities and terminal processes. All447 UNIT,
26 GPL and26 ORDR/CONT records in the source and444 UNIT,48 GPL and21 ORDR/CONT
records in the destination match their committed input ranges exactly after
original full re-save; actor queues match as well. Registered ownership checks
also pass on the two actual re-saved worlds together. Evidence:
`output/native-hero-pair-reload-002-observed.json`; exact076 is retained in
`output/native-hero-pair-reload-generation-076-preserved.json`.44 relevant
ownership/export tests pass, zero skips, in
`output/native-hero-pair-reload-regression-tests-001.log`.

Both processes exit0. Maximum sampled RSS is177930240B (169.7MiB) on the source
and172670976B (164.7MiB) on the destination. These two native loads do not prove
a repeated-travel plateau or browser resource bound. Continuing the restored AI
with actual return routing, crossing region edges, and browser loading remain
unfinished. The initial seed store and committed revision remain unchanged;
no browser launch or WASM build/staging occurred.

## Actual remote Warrior restored to its native guild

Read-only selected revision1 preparation uses the actual remote Warrior554/GPL48
and native guild469/GPL7. There are no active native orders or attached effects.
The existing arrival code preserves the actual go_home/use_building task and
rebases its sole active context timestamp19300 to20850 between actual regional
clocks24250/25800, retaining4950ms elapsed, delay300 and flags2. All eleven
inactive contexts stay unchanged. The three inert records total2379B (442B UNIT,
1853B GPL,84B CONT). CONT101 regains the actual native home with flag1, and the
plan requires reciprocal native100 and script members rosters; the logical
registered slot remains one. This preparation alone reserves no native IDs.
Evidence: `output/registered-hero-return-preparation-001/return-preparation.json`.

Build078/return001 import those actual records through original UNIT/GPL/CONT
readers, fresh original native identity registration and script construction.
Actual IDs are504/GPL28. The private native reader uses zero identity, then
original publication supplies504; prepared proposal IDs never enter a live
registry. Only typed container owner sites20/44 in the48B payload are rebound.
Original native relationship00598e20 inserts the hero in guild100, and original
list operator4 inserts an independently owned type5 reference into guild7's
members list. The caller returns only its separate operand. Hero CONT101 points
to guild469; both roster directions contain exactly the actual returned hero.
An original queue insertion uniquely queues GPL28 and preserves all other
entries. This happens before normal original AI ticks.

Original Hero_Return_Ready.GMP contains the exact prepared actor/script/container
bytes with only the actual reserved aliases, including the unchanged home task
and rebased timestamp. All447 prior UNIT records,25 other GPL records and25 other
ORDR/CONT records stay byte-identical. Guild GPL1201 to1209 changes only by one8B
member and four envelope/count words; native guild CONT60 to68 changes only by
one8B member and three size/count words. Other queue entries are exact. Full-save
inspection also checks script associations, both rosters, all typed references,
sentinel targets and actual active clock state. Original cleanup removes the
temporary test hero, agent, both roster entries and queue entry while retaining
the guild and all other queues.

Evidence: `output/native-hero-return-003-observed.json`; exact078 is archived in
`output/native-hero-return-generation-078-preserved.json`.50 relevant arrival/
home tests pass, zero skips, in `output/native-hero-return-regression-tests-001.log`.
One native game exits0 at a maximum sampled183271424B RSS (174.8MiB). Two official
one-job builds were used:077 compiled the initial implementation;078 replaces
container-wide integer matching with the two explicit typed owner sites before
the sole native run. No browser launch or WASM build/staging occurred.

This qualifies original native home import and rosters, not a published regional
return. Selected revision1 still owns554/GPL48 in1_0. Fresh original load and
normal AI continuation of the returned504/GPL28, departure from1_0, paired return
publication, continuous crossing and browser integration remain unfinished.

## Returned hero enters the original guild through normal AI

Build079 loads the actual return Ready save in a fresh owned native profile.
Before normal updates, its original full Loaded save preserves all448 UNIT,
27 GPL and27 ORDR/CONT records and actor queues exactly. The returned504/GPL28
retains home7 and the saved go_home/use_building request, one existing AI queue
entry, four grid cells and one rendering entry. Original home validity is1.

Normal original updates run6000ms, from25800 to31800. Three temporary hooks
observe and always delegate unchanged: no remote-home gate, scheduling hold,
script projection or result override runs.125 hero agent calls,3235 other agent
calls,39 context calls, two building-use calls and three command dispatch calls
return. The actual hero enters native guild469. The evolved save records native
physical parent469, reciprocal guild100/physical2/hero101 links, guild GPL7
members[28], home7/target7 and one AI queue entry. Rest_at_guild has the original
state [30000,26750,2,0]. Three hooks are removed; the actor remains alive and
normal frames continue until the successful smoke exit.

Evidence: `output/native-hero-return-live-002-observed.json`; exact079 is archived
in `output/native-hero-return-live-generation-079-preserved.json`. This uses one
official one-job build and one native game, with maximum sampled RSS181288960B
(172.9MiB). The30sec rest has not completed; six seconds of native gameplay do
not qualify a full mission, browser performance or repeated region travel.

The resulting save exposed a stopped ownership rule that rejected every physical
parent. Explicit version2 registered heroes now accept residence only inside
their actual native registered home. The guild's physical2 member must agree
with the hero parent, with one reciprocal membership and canonical flag1.
Outside or inactive heroes must have no corresponding physical member; stale
origin aliases, duplicate groups/members and foreign parents refuse. Both logical
guild links, script membership and the unique AI queue remain required. Version1
identities and remote-home proxies still refuse a physical parent. A resident
hero must leave the building before arrival preparation can transfer it.

Before changing the two ownership modules, their exact prior bytes were archived
in an owned fixture. Historical qualification accepts only the measured
publication/initial seed digests and those two exact archived source hashes.
Every other producer source still must match current code; current ownership
checks independently validate the selected native snapshots.

`output/native-hero-returned-residence-001-observed.json` applies the current
policy to the actual evolved resident504/GPL28 and the initial dormant proxy
world. It passes, and a bounded read-only view with the physical member flag
cleared refuses. Producer files remain unchanged. This is candidate validation;
the dormant neighboring world is not an actual departed remote owner, so no
paired return publication is claimed.

74 relevant tests pass, zero skips, in
`output/native-hero-residence-regression-tests-003.log`. These include save/reopen
with a returned resident alias, malformed residence refusal and unchanged
outside/remote transfer and interruption checks. The initial seed and actual
selected outward revision1 remain unchanged. Remote554/GPL48 departure, paired
return publication/reload, continuous crossing and browser integration remain
unfinished. No in-app game or WASM build/staging was used.

## Actual remote departure and stopped return publication

Build080's native-only remote-departure fixture loads the actual selected
revision1 remote world in a fresh owned profile at24250. Before retirement,
all444 UNIT,48 GPL and21 ORDR/CONT records and queues match the committed input
exactly.554/GPL48 retains the saved go_home/use_building request to pure45, one
AI queue entry, four grid cells and one drawing entry. Effect555 is absent.

Original unit retirement005a21b0 and script retirement00633370 remove554/GPL48.
All443 retained UNIT,47 GPL and20 ORDR/CONT records remain exact. Hero CONT554
is removed, and no known typed incoming native/script/inventory references
remain. Other queues, drawing entries and original order-registry members are
preserved. A whole-grid scan finds no hero entry. Native/script counters and
clock are unchanged. Pure45 remains native-less, unscheduled and byte-identical
453B before/after. Thirteen ordered gameplay root occurrences, including both
PLYR sections, terrain, globals and remaining orders, stay exact. VERS/SVGD
metadata are excluded from root byte comparison; all three clocks decode24250.

Evidence: `output/native-remote-hero-departure-001-observed.json`; exact080 is
preserved in `output/native-remote-hero-departure-generation-080-preserved.json`.
One official one-job build and one native process exit0, with maximum sampled
RSS178077696B (169.8MiB). No remote-home gate or normal remote AI dispatch runs.

`scripts/publish-native-hero-return.mjs` joins that actual departed remote world
with079's actual returned original AI Evolved save. A fresh store recreates
the exact original seed and outward revision1, then selects revision2 through
one manifest. The owner becomes504/GPL28 in0_0, physically inside its actual
registered469/GPL7. Home aliases, immutable guild registration and its logical
member slot stay intact; remote554/GPL48 is absent in1_0, while pure45 survives.
Both producer worlds are copied exactly into the selected slots. The original
seed, actual outward store and all native producer files remain unchanged.

Four serial interruptions after source staging, after state staging, before
manifest publication and after publication recover the complete revision1 or2
pair. Retry converges on2; exact repeated commits write nothing. Six conflicting
owner/outgoing alias/reused incoming alias/home/manifest/digest requests refuse
without changing the selected outward pair. Eight files retain four world slots,
with reads/writes capped at4096B. These supervised stopped checks do not prove
process-death, concurrent OS writer or browser crash recovery.

Publication: `output/native-hero-return-pair-001-published.json`.
`scripts/inspect-native-hero-return-pair.mjs` independently re-derives revision2
from both terminal native producers and the preserved outward chain, then
reopens the published store and four recovered stores. Its passing report is
`output/native-hero-return-pair-001-observed.json`.74 focused tests pass,
zero skips, in `output/native-hero-return-pair-regression-tests-001.log`.

The selected revision exporter now accepts independently qualified return
publications. It retains both selected read leases while copying the exact
worlds and writes one receipt after both finish. Current-state verification
refuses a changed selected manifest; historical receipt checks remain distinct.
`output/native-hero-return-pair-export-001.json` qualifies revision2's two copies
and their receipt with4096B maximum writes. Existing outward receipt verification
also runs while qualifying the returned producer chain. Export prepares the next
original paired-load test; it does not run that test.

Fresh original loading of the returned paired revision, continuous seam travel,
browser integration, full campaigns/matches, independent internet clients and
repeated browser resource bounds remain unfinished. No browser game, WASM
build/staging or additional native game was used for publication/recovery.

## Original reload and gameplay of the committed return pair

Build081's native-only return-pair reload mode loads both actual revision2
exports in sequential fresh owned profiles. Both original processes exit0.
Home0_0 restores504/GPL28 inside actual native guild469/GPL7 at31800, with
native100, physical2, hero101, script members[28], one existing AI queue entry
and one drawing entry. A whole-grid scan confirms the resident hero has no
outdoor cells. Remote1_0 restores no554/GPL48 or effect555 at24250, while pure45
remains native-less, unscheduled and intact.

Before normal updates, the original Loaded saves preserve all448 UNIT,27 GPL
and28 ORDR/CONT records at home and443 UNIT,47 GPL and20 ORDR/CONT records
remotely. Every keyed record and queue matches its committed input exactly.
Home's28 attachments include guild469's244B ORDR added by original AI before
revision2 publication. The earlier Ready save had27 attachments; comparing to
that count would be an incorrect expectation for this evolved input.

One bounded observer always delegates to original00626cf0. Both worlds advance
6000ms normally: home31800 to37800 with124 hero calls and3348 other calls;
remote24250 to30250 with no hero calls and5745 other calls. Original Evolved
saves retain the home hero's reciprocal guild links, script membership, one
queue and original Rest_at_guild state [30000,26750,2,0], home7/target7 and empty
taskname. Remote554/GPL48 stays absent, known typed incoming references are
absent, and pure45 stays byte-identical453B. The observer is removed and normal
frames continue. No actor import/removal, queue insertion, home gate, clock
projection or return override runs in this trial.

`output/native-hero-return-pair-reload-002-observed.json` independently checks
the actual exports, producer/build/profile identities, terminal processes and
original saved records. Both actual Loaded and Evolved pairs pass current
registered single-owner validation. Exact081 is retained in
`output/native-hero-return-pair-reload-generation-081-preserved.json`.
`checkpointAbsentAgentReferences` exhausts
the entire manager once to check removed aliases without repeatedly parsing
the manager for each surviving agent. It refuses a remaining target record,
including a tombstone; existing live migration checks keep their missing/deleted
target refusal. Parsing and retained sites keep the existing bounds.

100 focused tests pass, zero skips, in
`output/native-hero-return-pair-reload-regression-tests-002.log`. These include
dangling references versus integer/sentinel lookalikes, missing versus present/
deleted targets, late corruption and site bounds. The500-agent case verifies
serial bounded reads and skips a1MiB dormant terrain payload.

One official one-job build and two sequential native games were used. Maximum
sampled RSS is179666944B (171.3MiB) at home and178126848B (169.9MiB) remotely.
These short independent loads do not prove an unload/revisit plateau or browser
resource bound. The original selected revision2, earlier stores, producer worlds
and settings remain unchanged. The30sec rest remains incomplete; continuous
seam travel, browser loading/recovery, full campaigns/matches and independent
internet clients remain unfinished. No in-app game or WASM build/staging ran.
