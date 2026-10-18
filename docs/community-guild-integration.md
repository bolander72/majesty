# Bards Hall and Phantoms Haunt integration

The composed browser release adds Bards Hall and Phantoms Haunt alongside
Alchemist Lab and the original Vampiric Revenge demo. Official SDK compilation,
paid native guild play, combat/effect controls, native ability UI, ordinary
browser save/fresh reload and root automatic import are qualified. The final
section records the release evidence and its limits; intermediate sections
retain their historical staging state.

## Acquired originals

Mike confirmed on October 16, 2026 that Phantomstar's permission covers both
mods' original artwork/audio for the site and public GitHub assets, with credit.
No further creator contact or package download is needed.

| Package | Workshop item | Manifest | Files | Bytes |
| --- | --- | --- | ---: | ---: |
| Bards Hall | 3813128205 | 3968691095026359591 | 53 | 15,383,129 |
| Phantoms Haunt | 3769947406 | 3427765037297317583 | 15 | 15,010,135 |

Exact files are bound by `content/community-mods/*/source-contract.json`.
`scripts/inspect-community-guild-package.py` checks the complete acquired file
inventory, hashes, canonical manifest identity, compiled container bounds,
original art identities, audio and actor costs without installing or launching
anything. Both real packages pass. Nine focused boundary tests pass, including
changed media, wrong identities, symlinks, XML entities and malformed bytecode.

`scripts/prepare-community-guild-gpl.py` reproduces source preparation from
explicit local inputs. Use a clean read-only Mod Manager checkout at the release
commit below, a clean Phantom source checkout at its contract commit, all three
acquired packages and the original game/SDK directory. Supply them with
`--manager`, `--phantom-source`, `--bards-package`, `--phantom-package`,
`--alchemist-package` and `--game`, plus a fresh `--out` directory. It validates
the packages before writing, records stock input hashes, attaches actual Phantom
source to a private copy, applies the two reviewed source resolutions and calls
the creator's preparation API. The tool never compiles, installs or launches.
Its output exactly reproduced all four source hashes below.

The downloaded Bards package is newer than its public source in six GPL files,
its manifest and definition. Its complete acquired GPL is authoritative. The
public repository remains a reference; regenerating that older source would
lose the current projectile interception and damage contribution behavior.

The public Mod Manager `release/v0.3.10` commit
`b7b36f17cd897c5f95d9e84d6b99194ad6cae6bb` supports these newer declarations.
The earlier `main` commit does not. This release source is used read-only;
the installed browser's existing Alchemist registries are unchanged.

Phantoms Haunt's downloaded package contains compiled gameplay but no GPL
source. Its public builder emits200 definitions, while the acquired binary
contains202. Independent SDK reference compilation confirmed the missing
`Phantom_Hero` prototype and `Guild_Title` function. The acquired artifact also
has later kiting defaults, two nested melee attribute-existence guards and a
Priestess assignment result local that avoids returning inside `foreach`.

`scripts/lib/phantom_workshop_source.py` recovers those deltas from pinned
public/SDK inputs. The private original-compiler recovery compares all164 named
instruction records against the acquired binary outside offsets identified by
independent257/514-line shifts. Its prototype's typed signature and all38 DAT
records match exactly. See `phantoms-haunt/source-recovery-verification.json`.
The compiled function symbol/value tables differ: this is instruction/data
correspondence, **not byte-identical compilation or native gameplay proof**.
The earlier200-definition public-source candidate must not be used as the
published gameplay baseline.

The source preparer reproduces the bound recovery before shared composition and
adds its prototype source to the private manifest. It refuses any recovered
file that differs from the observed source hashes. Original media, downloaded
BCD, Steam files and installed game remain unchanged.

## Shared gameplay preparation

The creator's `prepare_gpl_bundle` now successfully prepares all three guilds
together for both Majesty and MajestyExpansion. It includes the actual feature
transforms, potion policies, seven private activity-text bindings and dependency
closure, rather than a last-loaded-script override.

Two authored conflicts required explicit source resolutions:

- Spell confidence retains Alchemist and Phantom branches exactly once. The
  compatibility Haunt query is structurally identical to Phantom's canonical
  query; all six confidence constants match the existing literal values.
- Random hero selection follows the existing native uniform choice across all
  sixteen stock candidates plus Alchemist and Phantom. The creator's existing
  embassy/outpost guard excludes Paladin after a Haunt is placed, preserving
  the undead incompatibility.

Five additional source-resolution tests cover retaining both guild branches,
the restricted/unrestricted recruitment pools, changed confidence constants,
changed Haunt queries and hidden extra side effects. Unexpected source changes
are rejected for review.

Current private preparation `community1847-recovered-combined-source` contains:

| Scope/file | Bytes | SHA256 |
| --- | ---: | --- |
| Any/Merged.dat | 12085 | `e5d10ef06b724c5d9a4f88b204a66d0ae5a868d7807a5a9acd9b7316fed95b6c` |
| Any/Merged.gpl | 456586 | `f198e299a2591136309fe15274436c2d2ac99d868e4216a88cdbace4142ffe97` |
| Majesty/Merged.gpl | 21606 | `82973ffd7c2ed673303cd3d5e497f9d0ce82da757c74ce3d412a91f145eef75f` |
| MajestyExpansion/Merged.gpl | 5183 | `d726cf951d9787ab60de75ee253d834875328d9953adc0b286e91f31d307d275` |

The read-only creator preparation runs against a private stock fixture. Its
base manifest normalizes only `Bytecode.bcd` to `bytecode.bcd`, because the
Windows-oriented validator compares case-sensitive host paths on macOS.
Bytecode and SDK bodies are untouched; input and adaptation hashes are recorded
in the private fixture receipt. The pinned browser guest remains MajestyHD -
Old.exe. The modern executable is only offline source-analysis evidence.

## Original SDK compilation

The original `Gplbcc.exe`, SHA256
`8cfbf6fff1cf90d7aaf334392352515eb0f989a35a16bc99f225e52af38820c4`,
successfully compiled all three prepared outputs. Definition-table validation
finds every expected function, expression, prototype and DAT definition, with
no missing or additional definitions.

| Output | Bytes | Definitions | SHA256 |
| --- | ---: | ---: | --- |
| common.bcd | 13535721 | 684 | `c0547c8663e3591f33c2415417f605b3a16c9c89a89ed36755fb124a669b861b` |
| base.bcd | 108586 | 57 | `0ff27dca0792e93edf589aa66e2936a38cfef74f711d4e7dec46afcc73d9a29b` |
| expansion.bcd | 16812 | 8 | `2e9247f9f84b0cafdb34fa2f7d3ff93bcc43d3c729ea45ad2a7a7963c6926084` |

The earlier public-source baseline compiled in muted, guarded browser SDK
trial1826 at1745.2 MiB
peak owned RSS. Its chunked export reached the existing input cutoff; the
incomplete local copy is unqualified and must not be used. A fresh isolated
prefix using the installed game's `wine32on64` ran the same original compiler
and produced byte-identical complete outputs, independently validating that
handoff without another browser launch.

The tracked `scripts/compile-community-guild-gpl.py` independently reproduced the
earlier baseline, then compiled the recovered current source in trial1848:
all749 definitions in15.56 seconds at64.7 MiB observed peak owned RSS. It
validates prepared source hashes and the original compiler, creates a
fresh owned Wine prefix, enforces a 2048 MiB/180-second guard and shuts down only
that prefix's server. Use `--source` for the preparation output, `--compiler`
for the original SDK executable, `--manager` for the pinned creator checkout,
`--wine`/`--wineserver` for the installed compatible executables and a fresh
`--out`. Player profiles are never opened. Prefer this qualified compiler path
for subsequent source changes on this machine.

## Native resource conversion

`scripts/stage-community-guild-native-resources.py` now emits private resources
from both exact acquired packages, with no descriptor-format omissions:

| Guild | Unit/item descriptions | Actions | Sounds |
| --- | ---: | ---: | ---: |
| Bards Hall | 31 | 12 | 3 |
| Phantoms Haunt | 61 | 7 | 3 |

Hero/building descriptor identities use unused native V/B families, allowing
the original classifiers to recognize custom actors. The exact mapping is
frozen in each source contract. It preserves original names, scripts, artwork
IDs and canonical GUIDs, and refuses stock/art collisions and retired IDs.

All33 Phantom numeric inventory slots80..112 retain their exact `INV+index`
representation, full item names, flag bits and source-bound named metadata.
Named metadata stays in an explicit sidecar rather than being truncated or
inserted into the wrong legacy map. The existing Phial slot113 and its encoder
guard remain unchanged; both actual Alchemist inventory regression tests pass.
Runtime handling, equipment UI and persistence of the new items remain pending.

The missing `PH02` guild-selection description is encoded from its actual XML
and exact stock selection layout, referencing original `PHGS` audio. Six stock
selection descriptions reproduce byte-for-byte. Both acquired Phantom voice
descriptions remain verbatim, including their variable-length wave phases.

Stock image lookup reads only validated CAM directories through read-only
mapping, avoiding loading hundreds of MiB of TILE data. Bards' stock `DRA2`
reference resolves. The acquired Phantom XML references inventory images `PHIC`
and `PHIR` absent from both supplied and stock archives; track their actual
runtime/UI use before qualification. Do not replace them with invented art or
claim their binding verified. Private titles/dependencies still require a
complete collection merge. No new resources are installed or published.

Twenty-nine focused tests pass, including the actual Alchemist regression,
sound policy preservation, numeric-item metadata tampering and recovery shape
refusals. This does not establish native/WASM gameplay qualification.

## Private native recruitment primitives

The unchanged vendored controller parser already supports MMCRv21. The current
Alchemist runtime's explicit version guard still admits only its qualified v20
registry; this checkpoint does not broaden that runtime guard.

`native/community/controller_dispatch.h` now supports a separate 68-byte,
17-slot private AP52 table. All entries are checked against the pinned Old
executable at `00682050`; the existing 44-byte AP69 path retains its contract.
Only the command/event bridges change in the private table. Stock classes,
presenters, destructors and vtables remain untouched.

`recruitment_commands.h` preserves the creator's three command/index bindings,
blocks hidden parent recruitment and child utilities, permits child Back/footer
controls, and blocks recruitment during research. The real creator registry
also binds the child hiring controls. These are tested input/lifetime
primitives; the AP52 presenter and constructor integration are still pending.

The official `tools/test.py --native-test community_recruitment_tests` passes
against the real three-guild MMCRv21 and an independently extracted pinned
vtable. Allocation failures, altered layouts, stale teardown and stock-table
preservation are exercised. The separate existing
`community_controller_lifecycle_tests` also passes, including the Alchemist
AP69 path. Observed peak owned RSS was188.1 and180.4 MiB respectively, below
the2048 MiB guards. No game or browser launched.

Use `scripts/prepare-community-controller-fixture.py` with `--game` pointing to
the prepared native game view, `--controllers` to an actual creator MMCRv21 and
a fresh `--out`; it records the official focused-test command. This fixture's
dialog allocations are **not** a final collection relocation map. Generate
bindings against the complete stock/private namespace during collection merge,
and verify existing Alchemist saves separately. See
`content/community-mods/native-recruitment-verification.json`.

## Legacy script loading and original recruitment module

`scripts/prepare-community-guild-legacy-functions.py` binds every input to the
prepared source and pinned official SDK. It adds source-identical `MJC_`
exports for stock-name collisions only:102 common,28 base and5 expansion.
Every original export, body, DAT and private function remains unchanged.
Private helpers are not needlessly duplicated. Separate edition route files
contain130 and107 entries; the two scoped `give_exp` implementations stay
separate.

The original SDK compiled this private ABI stage in25.96 seconds, with64.5 MiB
observed compiler RSS and884 total definitions. The source-file hashes in the
final1861 preparation exactly match the1860 compiler input. These exports
prepare the existing lookup-time redirect, which selects the correct original
function object before the VM creates a frame. They are not execution proof.

| Compiled ABI output | Bytes | Definitions | SHA256 |
| --- | ---: | ---: | --- |
| common | 14367967 | 786 | `f6450d27483439c758f99eedcc4f7475a7d056d8bc62ec8c776048232b31d48f` |
| base | 187130 | 85 | `6bcf4e7b106249c212dcc3c264d98cd5faafbe90f2b41d433406c0e42bb8c4f0` |
| expansion | 27612 | 13 | `9581cf08a4a936a93ea52fb41de6ff492a92e1c1788e01262340169f57494dfa` |

`shared_function_routes.h` and the first-party probe now recognize the separate
`majesty-community-shared-gpl-v2` format, bounded at256 entries/64 KiB. The
existing `MJA_` Alchemist v1 format retains its128-entry/32 KiB limits. Refused
files never partially publish a map. Native tests pass against both actual
edition maps and the actual current Alchemist file, including duplicate,
malformed, prefix, NUL and limit refusals. The existing Alchemist controller
suite and native probe compilation also pass. The runtime's MMCRv20 guard
remains in place; this does not enable unimplemented v21 guild features.

`scripts/prepare-community-recruitment-engine.py` verifies the complete pinned
executable, AP52 vtable and eight original entry prefixes before extending only
an owned private configuration's translation entries. It reproduces the exact
private1865 module input. The official translator's `--as-module community_ap52`
with `--only 00465510 00465ac0 0047e680 0047e8f0 0047e9c0 0047f270 0047f3e0 0047f530`
translated all eight routines plus three required alternate entries at353.8 MiB
observed RSS. The generated source is untouched and private. The module then
compiled successfully through official `tools/test.py` at135.9 MiB peak owned
RSS; no game launched.

The original AP52 command is RET4 and delegates native recruitment index2 from
`0x1388`, index1 from `0x1389`, and index0 through the generic `0x1F48` handler.
Its tooltip is RET12 and its event method RET16. The single-choice presenter
is `00465510`; native title/quote helpers are `004652a0`/`00465410`. The creator's
Windows machine-code presenter clones cannot be executed directly by WASM;
those private presenter adaptations and their lifecycle are implemented below,
but still need source-backed gameplay services and live-world integration.
Preserve the original queue/upgrade methods and stock UI rather than replacing
them with simulated recruitment. The Old secondary-container flag is
`controller+0x20`, verified in original `0047a760`; the modern creator layout
uses `+0x30`, which must not be copied into the36-byte Old object. See `legacy-abi-verification.json` for the
qualification boundary. All34 focused Python tests pass without skips.

## Private stock presenter port

The private presenter copies now compile using the original translator's
existing guarded instruction-patch input. No generated C or executable is
edited. `prepare-community-recruitment-templates.py` verifies the original image,
six function byte ranges, all five indexed lookup/title operands, eleven exact
control operands and the tooltip command before preparing three recruitment
variants and one common module. The final1882 source exactly reproduces the
1870 inputs used for translation.

The three variants retain the literal original presenter/tooltip bodies and
native queue, formatting and price lookups. Their changes bind indices0/1/2 to
commands`1F48`/`1389`/`1388` and price controls`1752`/`1F51`/`7301`. Common code
retains native counters and base setup/events; only private availability and
Call-to-Arms behavior changes, matching the creator's private-controller design.

Generated constructors are redirected into a typed private template bank, and
all raw function symbols are renamed. Native object-symbol audits show no
reference to global `recomp_module_register` and no unprefixed stock `fn_`
exports in those eight generated objects. The patched copies must never be
registered at original PE addresses: that could affect stock guilds.

A process-lifetime builtin can allocate160 guest bytes, hold the scheduler
baton and install ten separately addressed native bridges. The bank rejects
unaligned/out-of-range/overlapping blocks and replacement allocations. Host
function pointers remain typed host data. The unloadable build bundle leaves
live bridge installation disabled. The `RefreshAll` bridge calls each literal
presenter sequentially through the existing guest-call boundary and the same
building context. The instance owner below supplies parent/child ownership and
research/input guards; this bank alone does not enable a guild.

Official native fixtures compile all four modules and execute their actual
translated instructions with explicit refusing native-service fixtures. They
pass construction/pending-queue visibility for all three bindings, indexed
counters, common setup/event forwarding, shared-progress refreshes and register/
stack/FS restoration. The first execution fixture lacked the event's required
refresh/count vtable entries; supplying those real private bridge entries fixed
the fixture. There was no running game or player-save failure.

Observed translation peaks were368.5–369.9 MiB, below1536 MiB guards. Final bank
and translated-execution tests peaked50.5 and88.8 MiB, below2048 MiB guards.
The external service/callback bookkeeping in these fixtures is controlled test
code. Live callback/SEH behavior, idle captions/prices, tooltips, paid orders and
all gameplay remain unqualified. See `private-presenters-verification.json`.

The creator's `bards_recruitment_panel.py` documents a live-traced index order:
Blade Dancer0, Spellsinger1, Troubadour2. The visual order is Troubadour,
Spellsinger, Blade Dancer. The earlier private alias mapping reversed the first
and third native type order. Current resource staging1881 corrects it to
`BDD1→AVt1`, `BDS1→AVu1`, `BDT1→AVv1`, preserving original FourCC ordering and
unaltered source art/names. A focused guard refuses a reorder. The earlier1849
resource candidate is superseded; no affected characters or saves were public.
Actual Old paid recruitment still must verify each binding. All39 focused
Python tests pass without skips.

For reproducibility, use `prepare-community-template-fixture.py` with the
prepared template stage and all four successful original-translator outputs.
It records exact source hashes, constructor redirection and symbol renaming,
then creates the official `community_private_template_tests` and
`community_private_template_execution_tests` targets. Test bodies are not
replacements for the game's external services.

## Private AP52 instance ownership

`recruitment_panel_owner.h` and `recruitment_panel_runtime.cpp` now bind the
literal presenters to the Old controller lifecycle. Both parent and child
use the original AP52 factory, with all17 native slots retained. Each captured
instance gets a private68-byte vtable overriding only destruction, setup,
tooltip, command, event, refresh and count entries. Stock vtables are unchanged.
Seven process-lifetime heap bridges retain the native RET4/RET12/RET16 ABI;
an unloadable configuration refuses activation. The constructor wrapper restores
the caller's private dialog argument after the original factory returns.

The binding requires an explicit private dialog/building-family association.
It resolves the actor through original`00481ec0`, rather than interpreting
controller context`+18` as a pointer. Generation, window/context, actor identity
and family checks prevent old panels from acting on recycled objects. Child
setup writes only Old`+20`; the modern`+30` location is not touched.

Parent recruiting rows and hotkeys stay suppressed. A child admits the original
three paid recruitment commands, native footer tracking, Back and the authored
hiring controls. Its hidden repair/upgrades/utilities cannot acquire input.
An active research reservation blocks recruitment commands/tooltips and the
raw recruit presenters, preventing research timing from being interpreted as a
produced-hero order. MaxGuildMembers notifications refresh the installed guarded
slots, as in the creator's runtime. Back uses the child's own resolved actor;
deleting a parent does not clear child ownership.

The scalar destructor restores the full original table and retires ownership
before calling native teardown, then releases only its private table. The
content adapter must call`majesty_reset_recruitment_panels` before original
world disposal while guest allocations are still valid. Registered code bridge
storage remains allocated for the process lifetime.

Activation requires every research-state, research-command, hiring and extra
presentation service callback. No default callback disables a declared feature.
Those source-backed services, the final namespace/resource collection and the
production loader connection are still pending. This does not relax the
existing MMCRv20 production gate or activate Bards or Phantom content.

Official native ownership tests use the actual acquired MMCRv21 and the table
extracted from the pinned Old executable. They verify private instance capture,
actor recycling, parent/child independence, hidden input, research exclusion,
capacity updates, teardown and disposal. A second target links the real runtime
owner to all four actual generated presenter modules and executes factory/setup,
command and tooltip stack discipline, event refresh/count dispatch, destruction
and reset. Its external game services, research/hiring callbacks, allocator and
callback bookkeeping are explicit test fixtures. They do not establish live
orders, gold deductions, abilities, UI rendering, save compatibility or SEH.
See`recruitment-owner-verification.json` for exact source and result bindings.

## Original VM attributes and saved kingdom ledgers

The initial declaration-focused audit found39 integer,21 boolean,10 function
and seven list `AddAttribute` declarations. A later audit also found conditional
agent-reference calls, covered below. The previous Alchemist bridge always read an
initializer and admitted only initialized scalars. All seven authored lists use
the three-argument form. They back Renown contributors, street audiences,
activity records and the Chronicles kingdom ledger. Reading a fourth argument
would leave the original argument span and allocating a scalar would change
the creator's mechanics.

`gpl_attribute_bridge.h` now checks the original external-call reference span
before reading required values or an optional initializer. It supports those four types and native agent-reference tag5, retaining the
native pool's typed allocation and virtual assignment. Without an initializer it calls the native Reset method,
including the list clear that releases recycled elements. The original agent
attribute map owns each resulting value and its serialization. Existing
attributes remain unchanged. Native growth settings are checked, and missing
symbol type10 never reaches a value bucket. Boundary tests cover omitted
initializers, independent initialized values, invalid spans/types and failed
insertion cleanup; the private plugin also compiles through official tools.

The private scalar evaluator now uses the original Old string, function-call,
typed argument, execution, result and cleanup helpers. Its no-argument agent
result path replaces the constructor's integer return slot through native
drain/NullAgent append/reference rebuild methods. It never patches a saved
function's model or copies a modern evaluator layout into Old.

Owned native trial1905 loaded the exact1860 common bytecode alongside the
preserved earlier Alchemist library and entered a normal Beginner Random world.
Controlled calls used its stock Palace agent: the authored Chronicles status
callback returned3 twice for cancellation without a purchase; the hiring
accessor returned0/1/1/0 for query/close/query/open. The actual VM executed all
three empty-list declarations, and a typed return from the original root
function resolved the same agent that received them. Its native map contained
three distinct list values, each with zero elements.

The ordinary Save Game menu wrote a1,305,927-byte GMP with SHA256
`c982a9fa323242ccc423e1811902f107aa1c77119cba8295ee418222bcea492f`.
An independent bounded typed traversal found the three empty lists on the
original `GplAIRoot` and a boolean false `BardsHiringClosed` on the Palace agent.
Trial1907 loaded that exact unchanged save in a fresh owned profile, reran the
authored callbacks and resolved the original three lists with **zero** new list
declarations. Both trials exited normally, muted, below173 MiB observed owned
RSS; all owned games are closed. See`gpl-state-verification.json`.

This qualifies a controlled VM attribute/callback/save boundary. It does not
qualify a Bards building, paid research, bonuses, hiring contracts, rendered
guild controls or browser gameplay. Hiring callbacks worked after reload;
independent preservation of a nondefault hiring state remains a live guild
check. No player save was changed. This probe also does not prove that replacing
the deployed Alchemist library with the combined library preserves older saved
VM continuations.

The failed preparatory trials are retained:1896 rejected newer UI hooks in the
older native host and was stopped;1898 sent input before readiness;1899/1900
stopped at stock name/quest introduction dialogs. The successful probe used the
native presented-frame readiness gate and the actual Play Game/name/quest
introduction/Freestyle/Beginner sequence. These were harness failures, not
qualified guild gameplay or evidence of an application-crash fix.

## Combined resource context and original media

The source preparer now follows the creator's final description, potion, spell
and projectile-observer composition before emitting GPL. Comparison with the
preliminary1851 source exposed30 missing spell validation/cast wrappers plus
`MM_SpecialSpellSuppressed`, and a corresponding check in the shared spell
path. These preserve Countermelody suppression across Bards, Phantom and
Alchemist special spells. The common source changed; the two edition-specific
sources did not. The original SDK1920 compiled817 common definitions and85/13
edition definitions, all matching their prepared source. Its common output is
15,602,915 bytes, SHA256
`9ae7e81810996e6bfc31f5383f5e2564b4d5c2a7c9425d3faf3263df304f493e`.

The final source stage1923 and its legacy stage1930 reproduce those exact
compiler input files and edition routes. Compiler1920 remains bound to the
preserved1919 input receipt; metadata added for stronger package provenance
did not change a source or route byte. Do not recompile unchanged GPL merely
to replace that receipt. Earlier1860 bytecode lacks these wrappers and is not
the final collection's gameplay library.

Private output namespaces preserve the deployed Alchemist parent/child
`CG01/CG02`. Bards uses`CGBD/CGBC`; Phantom uses`CGPH`. The creator's normal
allocation order would assign Bards the existing Alchemist child ID. The
adapter relocates derived controller records simultaneously while preserving
the authored source IDs, logical keys and private SMNU bindings. Source-backed
tests cover the collision and the integer/byte forms. MMCR/MMFR roundtrips
pass; their production admission gates remain unchanged.

`prepare-community-guild-media.py` now verifies all acquired package bytes,
the recovered Phantom manifest/source-package binding, and original stock CAM
ancestry, then runs the pinned creator's real art/audio composition. Native
dataset order includes base-data loads declared by the expansion. Bounded
named-resource reads avoid materializing unrelated stock voices or TILEs.
Private stock archives are separate copies or COW clones, never hardlinks.

Media1924 contains37,360,100 bytes across four archives: main art, interface
art, original voices and sound descriptions. The creator's relocation resolved
801 main and69 interface positional collisions, rewriting6350/151 IMAG
references. Equipment binding uses the actual authored frames in the stock
`INBw` presentation recipe. No replacement art or voices were invented. These
are resource-composition checks, not an in-game visual or audio qualification.

The native converter can now consume these source-bound final descriptions
and media. Stage1928 encodes all118 units,32 actions and12 sound descriptions,
with no pending conversion fields. It retains the final private dialogs and
spell wrappers, preserves Alchemist`ABx1..3`, and combines Phantom inventory
slots80..112 with the unchanged Phoenix Phial slot113. The three Bards
instrument identities remain the creator's exact24-bit private values in
the original integer equipment map, with explicit runtime-required metadata;
they are not converted to stock weapons. Unregistered or malformed equipment
identities still refuse conversion. PHIC/PHIR art references remain absent
from the acquired and stock art; their inventory presentation still requires
an actual use-path check.

All49 focused Python tests pass without skips. Muted SDK compilation exited
normally below91 MiB observed owned RSS; the largest media merge stayed below
796 MiB. No owned engine/browser was launched in this preparation step. See
`resource-context-verification.json` for exact source/artifact hashes.

Read-only Old presenter analysis found constructor`004c0b60`, getter`004c0760`
and native name insertion`004c1bc0`. Its four maps start at0/0x10/0x20/0x30,
rather than the modern runtime's0/0x20/0x40/0x60. The getter uses a static
singleton and registers teardown at process exit. Name resources are acquired
through`004f2000`; the weapon name and icon paths are`004c1410/004c17c0`.
These observations guide an Old-specific equipment adapter; they do not
qualify its installation, resources, cleanup, shopping, combat or gameplay.

Rollout: audited none for this source-only checkpoint. The new archives,
bytecode and registry versions remain private; production assets, active
collections, runtime gates and player profiles are unchanged. Final publication
still requires the remaining native services and ordinary browser gameplay.

## Original equipment registration

`equipment_registration.h` now registers the creator's private equipment in
Old's original four maps, through original guest insertion and STRT acquisition
helpers. It validates the complete record set and checks all destinations
before publishing values. Private IDs remain24-bit values; stock entries are
never replaced. Original native maps own their inserted nodes and the original
resource provider owns the name tables. No host pointer is stored in guest
memory, and the constructor hook preserves its original return value.

The controlled probe admits a separate source-bound MMFR file solely for the
three equipment records. This is an explicit subsystem trial, not admission
of the remaining MMFRv9 capabilities: normal MMFRv1/MMCRv20 gates are unchanged.
The production content adapter still needs to connect the registration at its
own normal load boundary.

Official native test1933 compiled the adapter/plugin and passed its invalid
identity, collision, resource-failure and map-offset checks with assertions
enabled. Trial1935 then ran the actual Old executable in a fresh owned profile
and a normal Beginner Random world. The original constructor, both native
map insertion helpers, repeated singleton getter and STRT virtual methods
retrieved all12 authored quality names:

- Troubadour: Travel Lute, Fine Lute, Concert Lute, Masterwork Lute.
- Spellsinger: Resonance Fork, Silver Resonator, Crystal Resonator, Harmonic Conductor.
- Blade Dancer: Saber & Dagger, Balanced Blades, Duelist's Pair, Masterwork Blades.

All three icon-map values retained the exact private identity. The trial exited
normally, muted, below178 MiB observed owned RSS. Its captured world renders
the normal stock Palace interface. No Bards or Phantom actor was installed or
spawned in this probe, and no player save was used or written. This establishes
real native registration and resource lookup, not hero-card icon rendering,
equipment shopping/combat, multi-world lifetime or save/reload compatibility.
See`equipment-registration-verification.json`.

The preparatory1934 trial was deliberately stopped after file-open evidence
showed it never consumed the added external dataset XML. Old consumes the
embedded`DATA/XML1` native LoadData groups in`miscdata.cam`, rather than modern
`MajestyDatasetDefinitions.xml`. The tracked probe preparer now appends owned
CAM loads to those original native groups and preserves all earlier entries.
Trial1935 actually opened the two added archives. Do not repeat the unused
external-XML approach. Existing libraries, original game files, prior trial
profiles and the production collection remain unchanged.

## Native timing and reward helpers

Six native-only GPL helpers now execute through Old's original function
registry and VM argument frames: simulation time/elapsed, earned bonus/cap,
action base period and movement base period. They retain the creator's exact
unsigned clock wrapping, saturation and mutable fractional carry behavior.
The two arithmetic headers are unmodified MIT source from release b7b36f17.
Registration dispatches only the exact six registered function objects;
NullFunction and all other native calls remain unchanged.

Official native boundary tests and trial1945 passed. Fourteen original-VM
cases covered arithmetic, missing inputs and native action/worker comparisons
(1100 and90), plus unsupported building and null-agent controls. The native
trial exited normally, muted, at164 MiB peak observed owned RSS. The clock was
not changed. Trial1943 was deliberately stopped after the comparison harness
used the wrong calling convention; the corrected getter call passed1945.

This is helper-boundary verification with the older1860 co-loaded library,
not final1920 replacement, ordinary guild play, saves, or browser qualification.
At that checkpoint four helpers remained: effect expiry, spell cooldown and
kingdom research eligibility/orders. The spell helpers are covered below.
Normal MMFRv1/MMCRv20 admission remains unchanged.
See `native-helper-verification.json` for bound sources, build and trial.

## Original spell cooldown and effect timing

Two more helpers now use Old's original actor, descriptor and order objects.
`MM_CommitSpellCooldown` walks Old's singly linked learned-spell list, writes
the authored timeout before the native clock, and preserves availability and
all other fields. It neither learns nor casts a spell. `MM_EffectorRemaining`
uses the original effect/order accessors and checks the timeout-order kind and
completion message before applying the creator's unsigned remaining-time math.
Only names present in the source-bound timing declarations are admitted.

Official build1956 passed42 native boundary assertions. Muted trial1957 used
two actual native Bards descriptions, BMA1/BME1. Original LearnSpell created the
record; the helper committed its6000ms cooldown while preserving availability.
Original CreateEffector created a100000ms timeout, which the helper retrieved
through the real order. Missing/undeclared names, null/unsupported actors,
unlearned spells and absent effects returned the authored refusal values.
The trial exited normally at166.5 MiB observed owned RSS with no guard stop.
All49 focused Python tests also pass without skips.

This controlled probe made no save and did not cast March, apply its modifiers,
exercise its expiry callback or install a guild. It retains the older1860
co-loaded GPL library. Ordinary paid guild play, the final1920 library,
original-save compatibility and browser qualification remain pending. The
initial1951/1953 trial processes exited6 on harness assertions (identifier
encoding and worker-spawn readiness); the corrected setup passed1957.
See `spell-timing-verification.json`. Production gates remain MMFRv1/MMCRv20.

## Kingdom research queries and native descriptors

The remaining research helpers now preserve the creator's query contract.
`MM_KR_Eligible` checks the declared building family, native level and original
completion/construction attributes. `MM_KR_Order` checks the original saved
4005 order and current research command, with a scoped reentrant call guard;
it does not enqueue or pay for research. Old's kind field is at6c, rather than
the modern7c. A separate source-bound MJR1 file explicitly binds BDG to private
ABt while preserving the authored feature registry and all three levels.

Native trial1963 passed the original VM binding/refusal controls on a stock
Palace and null actors, leaving Palace activity unchanged. Positive Bards
eligibility and saved-order checks still require the actual guild. Official
query boundary tests cover those positive/negative branches and nested guards;
these fixtures do not establish paid gameplay. See `research-query-verification.json`.

`KingdomResearchDescriptors` uses the original AP99 map and a clone of the
creator's declared stock template. It preserves the native timing/notification
words and sets the actual level, price and private completion mirror. It
refuses collisions and changed registrations, and repeated registration is
idempotent. Native1968 retrieved Epic Chronicles through the original getter:
level3,3000 gold, completionda878b2c, stock time10000, notification202. That
muted probe exited normally at176.9 MiB. It neither installed a guild nor
submitted research. Ordinary orders, completion, saved ledger and visuals
remain required.

The broader source audit also found14 literal conditional `agentref` attribute
creations missing from the earlier declaration-focused audit. The original
AddAttribute adapter now admits native tag5 and uses the original pool,
assignment/reset and saved agent map. The missing-symbol type10 remains refused.
Actual native1968 copied a live agent identity into a separate owned value;
agent-reference save/reload still needs the guild gameplay checks.

Combined native1971 also passed original creation of the owned agent-reference
state, the8-second controlled effect, later native NullAgent state and absent
effect, with no cleanup fault. Its normal exit peaked at168 MiB. The prior1965
controlled setup omitted the state expected by the authored cleanup and exited
with a native AdjustAttribute access violation;1971 initializes zero modifiers
through original AddAttribute before CreateEffector. The callback's result was
observed in original state; its entry was not separately traced. See
`research-descriptor-verification.json`. This does not qualify paid research,
full modifier application, original saves or browser play.

## Live process core and collection tables

The four AP52 services now have concrete Old-engine implementations: busy
research, paid command submission, authored hiring toggles and UI extras.
They call the original GPL evaluator, AP99 affordability/submission routines,
native UI methods and saved4005 orders. Research reserves/cancels/commits the
authored saved ledger around the original executor and completion callback.
No host purchase state substitutes for the ledger or native order.

The process-lifetime core includes the four original private template modules
and a four-entry guest bridge for factory, research execution, completion and
world disposal. Old004ac2f0 is a data-discovered internal block, so its hook
API correctly refuses wrapping it. The adapter guards original vtable slot
00682f58, commits the process-lived guest bridge after hook installation and
retains the original body for other families. Generated symbol metadata and
translations remain unchanged. UI-only caches reset before original teardown.

`prepare-community-process-engine.py` links exact qualified original native
objects with this new game-owned core through the official build tool. It
binds every reused object/archive, original symbols, source and generated
module to hashes. Native1992 accepted core initialization, entered an original
world, passed the existing controlled helpers and exited normally at186.3 MiB
observed peak RSS. It used a fresh owned profile and dummy audio.

That bootstrap explicitly disabled the legacy Alchemist panel/research
bridges: this older native archive classifies the later fog-reveal entry
0042ee50 as unhookable. It also retained the older1860 probe library and no
new guild actors. It does **not** establish actual AP52 factory use, paid guild
gameplay, full Alchemist coexistence or final1920/browser compatibility.
See `guild-services-verification.json` for separate build and trial scope.

`prepare-community-native-tables.py` now stages13 private outputs for both
editions, starting with the36 verified effective deployed files from the
qualified Alchemist and Vampiric Revenge overlays. It merges
native unit/action/sound catalogs, canonical title aliases, authored building
prerequisites and text/UI tables. Existing Alchemy Lab stage labels and all
original inventory positions remain intact. It does not activate load groups.

This merge caught two genuine collisions before gameplay activation:

- Phantom's original NM11/HN41/HN42 names would replace stock name fragments.
  Its native descriptor now references private NMPH; its exact first two
  tables move to HNP0/HNP1, retaining original HN43/HN44 suffix references.
  The stage emits source-bound `community-name-bindings.bin`; runtime
  registration is still required.
- Troubadour's BT01 voice conflicts with the original FervisTemple descriptor.
  Only its DSND identity and hero default-sound reference move to BTV1. Its
  original phase parameters and waveform references stay byte-identical, and
  both original temple sound payloads remain unchanged.

The creator's five stock hero help changes and Meteor Storm suppression
wrapper are explicit exceptions; other occupied names/IDs refuse replacement.
Both real-edition table audits passed, as did66 focused Python tests with no
skips. These are resource/coexistence checks, not in-game UI or mechanics
qualification. See `native-table-verification.json`.

The effective demo overlay is mandatory: staging whole miscdata.cam from an
earlier Alchemist-only baseline would discard the existing XQD3 load entries
on later installation. Native table stage1999 retains both demo XML1 payloads
and every other non-BDEP misc payload byte-for-byte; only the prerequisites
change. Stage1993 is preserved as an earlier Alchemist-only resource draft.

Rollout/manual-data audit: none required for this source checkpoint. The
audit covered native registry admission, saved-state ownership, immutable
private staging and the unchanged deployment descriptors. New collection
activation and publication remain part of the pending implementation and
gameplay qualification; they have not been performed by these preparers.

## Final private native collection and names

`prepare-community-native-candidate.py` assembles a separate owned game tree
from the 36 effective Alchemist/demo files, final native tables from stage1999,
authentic composed media from stage1924 and original SDK bytecode from trial1920. It validates
all actual SDK source inputs against legacy source1930 rather than accepting
only a compiler receipt. It preserves the original quests and continuation
exports. Private file changes never write through the original game links.

The loader merges native text/widgets into the original text archives, retaining
stock names and demo resources. It mounts the final common and matching base or
Northern library before the prior Alchemist compatibility library. The old
seven Alchemist media overrides are replaced by their composed equivalents;
the adapted native sound catalog is retained. Edition aliases share targets,
with missing aliases falling back to the original VM. Actual edition-specific
execution and old Alchemist save compatibility still require qualification.

The process core now binds the final collection's MJC routes and MNB1 name
mapping, checks the original research registry inputs, and registers NM18,
NMBD, NMBS, NMBT and private NMPH through the original name-generator lifecycle.
Native engine2006 accepted this collection in fresh owned profiles; its original
world can save and reload. All five registrations were observed in ordinary
startup, with stock NM11 preserved. The source-bound instruments also register
through the original equipment constructor; this does not yet qualify shopping
or combat. CGPH is adapted to the original AP10 factory while retaining the
private window and actual Haunt identity; its ordinary building interaction
still needs a live check.

The official guild-services native test passed, including truncated/corrupt name
mapping refusal and preservation of output on invalid input. The official
one-job native link passed. Repeated saved-world entry exposed one incorrect
adapter guard: original004f6710 accepts a null name-resource provider and
resolves it through0054c3c0, but registration refused that legitimate default.
The adapter now passes the value unchanged to the original constructor. The
official native name-registration test covers both explicit and default
providers, plus the existing collision/allocation/construction refusal cases.
These native trials remain explicitly limited by
the older bootstrap's disabled Alchemist panel/research bridges, described
above. No new guild collection has been published or enabled on the website.

Native trial2042 performed ordinary paid Bards construction after removing one
stock Warriors Guild through its native demolition confirmation in a disposable
profile. The first Hall cost800; the next listed price became1600. Its authentic
teal-roofed artwork rendered, and the original Day1 GMP contains one live ABt1
with GPL title `Bards_Hall`,300/300 HP and the completed flag. The generated
365544-byte save is SHA256
`7a37512013191ad6fbcc7a3f54e3b152e92e08c81630df8db6ae1860fe729176`.
No cheats, actor fixtures or save edits produced that Hall. This proves
construction and serialization. Trials2061/2077 additionally restored this exact
world and opened the authentic parent card; recruitment remained unqualified.

Selecting the Hall in trial2040 exposed the next boundary: the mod API rejects
private RecompModule addresses, accepting original symbols and registered
import trampolines. Source now forwards the four process-lived services through
registered game-owned import gateways to their private module bodies. Each
receives the actual guest CPU and uses a separate scratch stack; the mod API's
public-symbol admission remains unchanged. Factory/research are stdcall; the
completion gateway retains cdecl cleanup. Live controller qualification is
pending. Live entry then exposed two assumptions that the earlier refusing
fixture did not establish: the factory takes four stack arguments and returns
with RET16, and its third argument is the actual unit pointer. Original00481b70
stores that unit's ID at controller+1c and a separate global context token at+18.
Ownership now checks the real unit/ID/family and caches the context token
separately. The execution fixture preserves a nonzero fourth argument and
checks all16 cleanup bytes. The private module gateway keeps the kit's original
symbol admission intact. Trial2077 then proved a callback-boundary error:
factory entry executed, but the generated original RET reached the enclosing
`guest_call` sentinel and jumped past ownership capture. The adapter now calls
the original through a separate process-lived entry with its own nested callback,
attaches the owner, then returns with the original four-argument convention.
The execution fixture now uses real nested setjmp/longjmp semantics, rather
than a callback-return counter that let host statements after RET run.
Research execution/completion use the same nested-original convention so native
RET cannot skip reservation cancellation, visual refresh or `ResearchFlight`
restoration. Ordinary research qualification remains pending.
See `native-collection-verification.json` for separate scopes.

Trial2088 verifies the corrected ordinary recruitment path. The native parent
opens CGBC, charges500 gold per recruitment, and returns to the parent with
one Blade Dancer, one Spellsinger and one Troubadour. The ordinary Day2 GMP is
391089 bytes, SHA256
`a87fc6396a42ad0a120bea6bdc97159f26392577e3dc3e6c7ecb9c6ae2d192e3`.
A read-only actor audit finds completed Hall561 and living heroes585/603/627,
with original GPL titles and native aliases AVt1/AVu1/AVv1. Their HP are31,13,14;
all three are outside buildings and belong to player0. No cheats or actor/save
fixtures were used. Trial2096 restores that exact save in a fresh profile and opens the native
Members list: Riley the Gallant (level4,37/37HP), Morgan Chimeweaver
(level2,13/13HP) and Linden Wanderwell (level1,14/14HP) all appear with their
original portraits. Direct character cards and full mechanics remain separate
checks; the browser collection is still inactive.

Native trial2106 also opened all three original hero cards, completed the paid
2500-gold level2 upgrade (500HP), and saved it normally. Trial2135 completes the
3500-gold level3 upgrade (700HP) and the3000-gold Epic Chronicles research.
Its original Day5 GMP is393874 bytes, SHA256
`12b973434c66f748d8ce3fdbccc3874e066e45b4df280e747dacc85b4d4f8547`.
The save retains all three living heroes, the completed ABt3 Hall, player0 in
the research done list and an empty pending list. The available list names the
actual Hall agent36. Research benefit controls and rebuild/ownership event
restoration remain separate checks.

### Activity cancellation compatibility

The first level3 trials exited with3765269347 (`GplException`). A bounded
observer in2123 traced street-show cancellation re-entering `MM_AD_Change`,
then the outer `MM_AD_StopIfEmpty` reading `MM_ActivityTicking_v1` from agent-1.
The outer function used its local Root after a callback capable of re-entering
that same function. Preparation now replaces only its post-callback
`$MM_AD_StopIfEmpty(Root);` with `$MM_AD_StopIfEmpty($MM_AD_Root());`.
Refreshing the named kingdom root protects that lookup without changing the
committed ledger, callback order, timing, rewards or public function names.
The compatibility pass refuses changed signatures and callback/return flow.

Original SDK trial2126 recompiled all817 common and85/13 edition definitions.
Only common bytecode changed (12bytes); base/expansion bytecode and every
resource/runtime registry remain byte-identical. Private candidate2130 changes
only the common BCD in Data and DataMX. Native2135 replays the exact failing
Day3 input and input script with the same native engine; its observer witnessed
nested cancellation and the outer dispatcher returning normally. The entire
run then completed with exit0,183.7MiB peak RSS and the original Day5 save.
Saved activity busy/ticking/running flags are false and its record list is empty.
See `activity-reentrancy-verification.json` for the scoped proof. The new
collection remains private while the remaining gameplay/browser checks run.

## Phantoms Haunt native guild play

Native2146 placed the actual Haunt at map42,172 for1400 gold, preserving the
existing stock Temple and Bards Hall. Native2151 resumed that generated save,
completed the250HP building and recruited Fen Shadowfiend for700 gold.
The original save contains the live Phantom `AVp1`, not a placement preview.
Native2154 restored that save in a fresh owned profile, selected the Phantom
through the normal Members list and displayed its original portrait, class and
18HP character card. The paid1800-gold upgrade completed as `ABu2`,350HP.
All three Bards remained alive, alongside Hall3 and completed Epic Chronicles.
The latest generated Day8 save is409986 bytes, SHA256
`2520b936789298f1eb87214af0ae923f8795690de4aeb2dafda2ef91656780a5`.
These are native gameplay/save checks; browser and advanced ability checks
remain separate. The receipt is in `native-collection-verification.json`.

Native2210 completed the paid2200-gold Haunt3 upgrade at475HP and saved Day9
with all four community heroes alive. Native2214 then built the original
Alchemy Lab for1400 gold in the same kingdom, completed its235HP building and
recruited Arcane Amberglass for600 gold. The Alchemist subsequently died;
the cause is unqualified, while normal death handling and the Day11 save
completed. This does not establish living-Alchemist coexistence after reload.
Those two trials used the earlier movement adapter and do not qualify its
positive speed effect. Their building/recruitment observations remain scoped.

Native2235 saved a second paid Alchemist recruitment while it was still in
progress. Native2240 restored that exact save with the corrected adapters,
completed recruitment normally and selected Adalia Smokesleeve's actual card
at11/11HP. Its generated Day11 save is403232 bytes, SHA256
`bf1c69f427723f0ed845129a90f89f9f57df2154f48d427e1ab8b1c35f1287df`.
It contains completed Hall3, Haunt3 and Lab1, plus living Dancer, Spellsinger,
Troubadour, Phantom and Alchemist. Native2248 restored it in a fresh owned
profile, displayed the living Alchemist card and saved normally again. All
five community hero types remain alive with all three completed guilds. The
new Day11 save is400021 bytes, SHA256
`5126a2cca05310966f96f93f55eff097a3cd73b45ad20d23a7ef25da45f6fb1c`.

## Movement and original spell caster adapters

The private native movement module retains the original order calculation and
applies the creator's declared effector percentages to each current step.
It does not repeatedly modify saved speed or the native cached base step.
An audit of the original control flow rejected the first temporary at
originalESP+20, which is reused by native vector assembly at005b771c. The
corrected loan at originalESP+18 is unused through every continuation and
RET12 path. Focused tests reject the old slot and a changed vector reference.

Original CreateSpellUnit retains its resolved caster in EBP at the exact
005ae750 callback returning to00422fca. The process core invokes the creator's
MM_SO_Record before authored birth logic, preserving source context in the
original saved agent attribute rather than a transient host map. Native2230
exposed an evaluator ABI mistake: a two-agent scalar call retains twelve
bytes of references, comprising the return value and both arguments. The
adapter now validates all three typed slots. A fresh positive control is
recorded by native2234: the original constructor spawned spell1613 from
caster627 and the creator's record function returned1 before authored birth.
The same fixture witnessed actual Dancer585 movement change from16384 to18841
(115%), with its native cached base unchanged, followed by normal expiry of
the original8000ms overlay. The session exited normally at201.5MiB peak RSS.

The bounded component fixture invokes the actual March song and original
spell constructor. It must never be used as ordinary campaign progress.
Native arithmetic, compilation and the controlled effect/expiry pass; ordinary
AI casting/learning and browser qualification remain separate. See
`native-adapter-verification.json`.

The new Palace icons preserve the stock25-by-25 emblem's exact two-pixel
frame and opaque inset. Only the creator's inset art is quantized; native
palette control indices are excluded. Decode/roundtrip tests verify the rim,
and native2210 displayed the Bard icon beside stock Palace entries.

## Private browser integration

`prepare-community-browser-engine.py` binds the corrected native core and five
private modules to the exact production browser objects. It removes only the
three superseded Alchemist plugin objects and old builtin table, preserving
the remaining148 objects and original libraries. It verifies the original
artifact hashes, translation configuration, symbols and module inputs, then
stages a separate resource bundle. No original generated source is edited.
The official private build2238 passed at1707MiB peak owned RSS. Its WASM is
90847770 bytes; this is link evidence, not browser gameplay qualification.

Browser2244 stopped during initial asset import, before the game launched:
OPFS reported a quota error and the host filesystem had only166MiB available.
The owned staging directory was removed through the browser storage API,
the owned browser/server closed, and783MiB became available. Preserve all
profiles, original inputs and prior releases. Require at least3GiB free before
another full browser import. No public release descriptor was changed.

## Remaining qualification

Activate the final compiled gameplay, required features and private tables in
the pinned DirectDraw runtime. Verify the final edition-specific MJC bodies and preserved Alchemist
continuations, and audit CGPH/Old AP10 and AP78 in ordinary gameplay. In particular,
Bards still needs equipment/shopping, advanced combat and projectile checks,
hiring controls, Chronicles benefit/negative controls and lifecycle restoration.
The current merged MMFRv9 declares23 hero-information rows,17 hidden
inventory actions and2 enchantment rows. The private core now consumes these
sections through the source-bound native presenter described below; the
ordinary MMFRv1/MMCRv20 acceptance gates remain unchanged. Its map-fog-query
and movement-query flags are both false, so those optional services are not
required by this collection.
Its three-choice recruitment, all original cards, paid upgrades through level3,
research completion and original progress saves have native evidence above.
Phantoms has ordinary construction, recruitment, its own card, fresh reload
and paid upgrades through tier3. It still needs undead interactions and spell
effects. Do not silently
disable unsupported features or relabel stock actors.

Use the final resource-context source and compiled inputs described above,
rather than preliminary1851/1861 or1860 bytecode. The current compiled source
also calls ten native-only helpers for timing, movement and kingdom research;
all ten now have Old implementations. The acquired source already applies
Chronicles gold/XP bonuses in `give_gold` and each edition's `give_exp` GPL
wrappers; preserve and verify those bodies rather than adding duplicate native
award hooks. Research visual restoration at completion, ownership changes and
world reload still requires its original native event integration. Eight have positive original-VM helper
checks; the two research queries have original-VM refusal controls and positive
unit fixtures. Actual guild/research/save and browser verification remain required.

Require ordinary paid construction/recruitment, distinctive mechanics,
selection/fog reveal, UI states, original saves and fresh reloads in bounded,
muted browser trials before publishing. Preserve the current Alchemist and demo
content and all player profiles. Lost Trail remains retired.


## Native ability UI and browser save/reload — October 17

The private AP78 adapter uses the original learned-ability and enchantment
lists, image objects, scroll controls and footer tooltips. It adds the creator's
labels, icons and passive unlocks, suppresses declared inventory-only actions
through a read-only flag gate, and supplies the source's legacy enchantment
labels. Three audited instruction substitutions are generated by the official
tools in a separate, two-entry module; no original generated C is edited and
no original learned nodes or saved hero attributes are changed. Nested panel
refreshes retain separate row contexts. Temporary native strings and images
are released after the native lists copy them.

Native2271 and muted browser2278 show Riley the Gallant's Dueling Flourish,
Deflect and Encore plus the active Roused enchantment. Deflect displays its
original authored description in the native footer. These checks establish
the Dancer's observed presentation, not every class or combat mechanic.

The first private browser bundles omitted production's fixed shared-memory
view policy. Even a separate19-byte write through original CreateFileA and
WriteFile failed with growable shared views; the ordinary game saves were
zero bytes in disposable test profiles. The packaged production runtime
already returned `wasmMemory.buffer`. `pin-browser-memory-views.py` retains
that same policy in private bundles, validates the audited Emscripten selector
and leaves the WASM unchanged. Future staged engines carry a hashed copy of
this post-link policy. The current private2273 bundle was postprocessed with
the same script after official build2274.

Browser2278 has fixed shared views, passes the19-byte original file-write
probe and returns1 from the original game save writer after503 unit visits.
The generated Day12 GMP is399892 bytes, SHA256
`fd562cc44560369e6ac987c21ce3d9b3b3cdc4240eaef75f3c2a43015327019b`.
A read-only audit finds all five living community hero types and completed
Hall3, Haunt3 and Lab1. Browser2281 imports that exact save into a fresh owned
native profile and runtime, loads Day12, resumes ordinary play and reopens
the custom ability panel. The original Day11 native save remains unchanged.
This is a bounded local browser UI/save qualification; it does not qualify
internet play or the remaining advanced guild mechanics.

Before these checks, cleanup removed only22 obsolete owned native build
caches and their disposable test executables, recovering2.701GiB. Every player
profile, save, backup, original input, required link dependency and release was
preserved. One broad-trace browser2256 exceeded its existing memory guard and
was closed; it was not resumed. Subsequent scoped2278/2281 trials stayed below
the same limit. No community content or new engine was activated publicly.

## Phantom icons and additional mechanics checks — October 17

The creator's Phantom actions use WRa2..WRa7. Original Old AP78 has no icon
cases for those IDs, and the acquired Phantom manifest declares no HeroInfo
rows. `prepare-community-phantom-ui.py` binds the exact acquired XML/GPL/media
and adapts the creator's existing frost, skull and soul-flame glyphs to native
24px learned rows and25px enchantment rows. It retains the original static
image layout, opaque inset, palette budget, native list controls and hover
behavior. Names come from the source XML; the compatibility tooltip text is
our description of the source GPL. These are presentation adaptations, not
new creator declarations or replacement gameplay. No acquired package, action,
compiled GPL, learned-spell state or character stat is changed.

The optional row registry is separate from the unchanged creator registry.
It can only supplement spell/enchantment presentation; existing creator rows
have priority. Runtime validation rejects gameplay services, passives and
colliding declarations in that pack. The private engine stage binds its rows
to the matching interface art and canonical source. Native2294 displays Ice
Lance with the source frost glyph and correct native hover text. Native2303
also shows the Troubadour's Ballad of Valor, Marching Song and Cutting Satire,
and the Spellsinger's Arcane Note, Countermelody and Reverberation passive,
with their authored icons and active effects.

An explicitly opted-in component trial2300 calls the actual compiled creator
functions through the original typed GPL evaluator. It verifies Eternal
Soul's30% maximum-HP and15-point parry/resistance bonuses, duplicate begin/end
handling and restoration; normal/empowered Chill refresh, no stacking or
downgrade, building rejection and real watcher expiry; and Gravechill's exact
strength/parry/resistance penalties, refresh and expiry. Valor and
Countermelody overlap and refresh without repeated bonuses/penalties, then
both original native timers restore the baseline stats. The Chronicles gold
and XP wrappers return115 for a100-point eligible hero award and100 for a
building recipient. The original hiring callback closes, queries and restores
its initial state. These are component observations, not a claim that every
ordinary combat or shopping path is qualified. The controlled world is never
campaign progress. The trial exits normally at195MiB peak owned RSS.

Original attribute IDs used by the fixture were checked against the pinned
Old executable's expression constructors, including Parry07565041,
MagicResistance08565041, MovementRateModifier22565041 and
ActionRateModifier32565041. No modern-edition address profile is substituted
for the Old executable. The native policy test and97 focused Python tests
pass. Browser2306 displays the new Phantom icon/hover and both additional
Bard panels and writes an ordinary401583-byte Day12 save, preserving all five
living hero types and all three completed guilds. The two changed interface
archives were imported through the normal importer; other owned game inputs
were reused, preserving the existing saves and avoiding another815MB download.

Remaining qualification includes ordinary projectiles/reactions, Phantom
Frost Armor and tier perks, undead interactions, equipment shopping and
research visual reconciliation on world entry/ownership changes. The latter
has explicit creator callbacks, but the modern parity RVAs are not addresses
for our pinned Old executable. Keep public content inactive until these
remaining paths and the final browser/save flow qualify.


## Native projectile/reaction and research lifecycle controls — October17

Owned trial2328 invokes the actual source through the original GPL evaluator
and observes native projectile callbacks. Ice Lance damages and chills its
actual hostile target; Arcane Note builds Resonance on its actual hit. Dancer
Flourish arms at the third hostile hit, consumes once and rejects allies;
Deflect enforces its cooldown. Resonance caps at six, Crescendo consumes it,
and its real native overlay expires. Sovereign and non-Priestess healing are
refused by Phantom while an ordinary hero accepts sovereign healing. Original
experience awards reach Phantom level7. These are explicitly controlled
encounters, never ordinary campaign progress. The earlier fixture exit came
from giving boolean-return GPL functions an integer return slot; native GPL
booleans have their own type6, assignment and getter. The corrected typed
fixture passes, without changing the creator's source or game balance.

The Old research visual event adapter calls the creator's existing idempotent
callbacks after original world entry, building stage changes and ownership
transfers. Pinned PE audit2332 establishes Old416c30,431130 and5a2670 rather
than borrowing modern-edition RVAs. Original world entry queues phase3; its
one-shot reconciliation runs once that phase commits. No kingdom scan runs
on every frame, and the saved GPL ledger still owns research and awards.
Placement previews and retired or uninitialized actors do not get callbacks.

Isolated trial2356 restores the existing completed Chronicles visual, clears
it when a Hall becomes unfinished or changes to an unresearched owner, and
restores it on completion or return to the researched owner. Native overlay
retirement includes its exit animation: immediate and250ms presence checks
were premature. The final controls wait for actual retirement with a bounded
six-second deadline; they do not force-delete actors. Frost Armor's actual
freeze callback also refreshes its timer, rejects a building and expires
through native updates. The trial exits normally at203.1MiB. These checks do
not yet establish the remaining advanced Phantom callbacks or final browser
integration; keep the content private until those qualify.


Native2363 extends that replay with an actual living Daemonwood target for
Icy Touch: the contact gate passes, the original melee callback damages it
and applies Gravechill. The original Call to Grave home gate accepts the
fixture's distant, birth-bound Haunt task, and its native teleport reaches
that Haunt. Endless Winter creates its actual PHW1 storm through the ordinary
spell-unit factory; the original caster bridge records Phantom1412. After
22500 simulation milliseconds the native storm is gone or retired. Normal
caster deaths are allowed after launch; the cleanup assertion follows the
storm's own identity rather than requiring unrelated heroes to survive.
The complete controlled replay exits normally at199.8MiB. Source GPL and
ordinary player saves remain unchanged. Task preconditions are explicitly
set only in this owned fixture; it is not campaign progress or a claim about
every shopping, Priestess or Paladin combination. Final browser integration
and release admission remain pending.


## Composed browser/root release — October17

Release `community-guilds2373` binds the native-qualified core to the retained
production runtime/renderer objects and the complete54-file composed content
recipe. Phantom spell glyphs, Bard panels, ordinary401771-byte Day12 saving
and a fresh browser reload pass. The saved actor audit retains all five living
hero types and completed Hall3, Haunt3 and Lab1. Fixtures and cheats are absent
from these browser saves.

The root launcher originally recognized only the two older Alchemist data IDs.
The private2377 root trial caught that omission: it selected stock data and the
community save refused its missing name resources. The source now admits the
composed collection and refuses an unavailable declared live collection.
Retired Lost Trail/Wayfinder defaults remain excluded. Root2379 automatically
imports all54 integrity-bound patches from public GitHub, verifies206 installed
files, opens the normal native menu, restores the exact Day12 input through
Majesty's original profile identity and continues into Day14. Phantom's native
icon/footer remain correct and research reconciles after world entry. A normal
root Save generates402611 bytes, SHA256
`bdcd1749e62eb78bbde001d837f5118a09c68309172e7cb33f49041f47077d97`.
The copied input is excluded when identifying that generated save. Runtime
errors remain empty and the guarded, muted root trial stays below its2.4GiB
ceiling. The source and qualification record are separate from the old initial
candidate's staging-only booleans.

Assets are immutable at Git commit
`20829cb662a679af829f9aebf77e92c80d7c980d` on `codex/assets`. All23 new
public objects pass exact size/SHA256 and CORS checks. Matching prior objects
are reused rather than uploaded again. Original game collections, save/profile
identities and creator credits remain intact. The production renderer's prior
measurements retain their actual1799 engine in the archived proof; this is a
content relink and functional regression check, not a new benchmark or a claim
about every Priestess/Paladin/shop combination, internet co-op or arbitrary
kingdom sizes.

Cleanup removes obsolete owned build artifacts and the owned root trial's
854087737-byte derived game-input copy after unloading its engine. It never
removes a profile, save, backup, source input or prior public release. The
normal original owned base remains cached for subsequent trials.
