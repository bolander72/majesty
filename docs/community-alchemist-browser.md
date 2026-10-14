# Community Alchemist Lab browser integration

The active content goal is Phantomstar721's actual **Custom Guild: Alchemist
Lab**, including its original animated Alchemist, three building stages, voices,
reagent economy, research and combat/sovereign alchemy. Lost Trail, Wayfinder and
Trail Lodge remain retired. Production still runs the original game.

## Current native qualification

Candidate1093 now passes ordinary paid Laboratory construction. Trial1125
spends1400 gold at a normally revealed, unobstructed site and saves completed
ABx1 unit915, original agent40 (`AlchemistsLaboratory`), at153/235HP. Trial1129
restores that exact original save and displays the authentic finished building,
interior panel,600-gold Alchemist control and Brewing control. This supersedes
the earlier unsuccessful placement/construction trials described below.

Ordinary paid native recruitment is now qualified. Trial1161 charges600 gold,
shows the native recruitment notification and saves living ALC1 unit1076,
agent44, title `Alchemist`, at15HP. Trial1163 restores that exact original GMP
in a fresh owned profile. Its native Laboratory roster shows Ameline Amberglass
alive at level3; trial1165 selects the hero and displays the authentic portrait,
Alchemist class, health and native Spells/Items/Stats controls. Later combat in
trial1163 kills this fragile hero normally, and the engine saves and exits
without a crash. Preserve living receipt1162 separately from dead receipt1164.

The private native probe has an opt-in
`RECOMP_ALCHEMIST_ATTRIBUTE_COMPAT=1` adapter for the author's boolean, integer
and function attributes. It uses original GPL value allocation/copying,
original agent attribute insertion and original function registration, keeping
state in native agents and leaving the package and compiled GPL unchanged.
The original save and fresh reload retain Should_Kite=False, KitingTime=0,
AlchemistBaseMovementApplied=True and the actual Alchemist_Recruitment_Voice
function context; Home still references the Laboratory's original agent40.

An earlier adapter bug registered AddAttribute with result type10. That is the
function registry's missing-symbol fallback, not void. Allocating it from the
nine native value buckets overlaps the pool's growth settings. Trial1155
witnesses a corrupted boolean-growth request of17,527,268 objects; trial1153
witnesses a returned value with zero type/vtable immediately before the failed
comparison. The adapter now registers result type0, independently verified
against the original SetAttribute binding. Registration checks that result,
and insertion checks the original typed allocation, independent map ownership
and all nine unchanged growth settings. The previous later-AI-crash checkpoint
is superseded; do not add speculative AI replacements or reset growth fields.

Native play is qualified only for the checks above. Research, full reagent/oil/
sovereign-spell/Phoenix behavior and browser play/publication remain pending.

`RECOMP_ALCHEMIST_RECRUIT_TRACE=1` optionally observes native GPL calls,
operator signatures and distinct function-registry misses. Output is bounded;
constant probes beginning with `#` are excluded because their function-registry
misses are expected. This observer neither changes a query nor suppresses an
exception. Native fixture builds use the official `tools/test.py`, with the
already installed Command Line Tools selected by `DEVELOPER_DIR` when the
machine's selected Xcode requests license acceptance. No license is accepted
or system developer-directory preference changed by the build.

Next activate and qualify the remaining research/alchemy controllers, then
qualify the actual mechanics and browser integration before publishing assets.
All these trials are private, muted and
guarded; public runtime/content and player data remain unchanged.

## Private Brewing navigation and research descriptors

`RECOMP_ALCHEMIST_PANEL_BRIDGE=1` now enables a source adapter attached only to
owned private CG02/AP69 controller instances. It copies the eleven original
32-bit virtual entries, redirects only the RET4 control and RET16 event slots
through verified stock AP10 entries, and delegates to the original AP69 methods
with their original arguments. Back substitutes the declared CG01 parent ID.
The original global tables and generated eligibility metadata remain unchanged;
the previously prepared AP69 module is not required for this private dispatch.
Destructor generations prevent stale teardown from releasing a replacement
instance; plugin teardown restores any surviving owned table before freeing
its separate allocation. Other stock controllers pass through normally.

Native1175 opens the authentic Brewing panel and returns to the original Lab
with Back. Native1177/1179 repeat that navigation with research descriptors and
normal original saving/exit, below156MiB peak RSS. The focused official native
fixture verifies unchanged stock entries, wrong-layout/allocation refusal,
address reuse and teardown, plus descriptor collision/renewal boundaries.

Two20-byte descriptors are cloned into the original AP99 registry through its
own map and allocator: Weapon Oil10771 is level1/250gold with completion
attribute2A425041; Phoenix Phial10774 is level2/750gold with attribute29425041.
All opaque template fields are retained. Native1179 independently reads those
values back and observes both completion attributes and current research as0.
The original row presenter owns availability/price presentation, including its
building-health check. Private idle progress overlays are hidden, and higher
level powers follow the creator's level requirements. The test Lab is damaged
and under attack; its disabled row is not evidence of a completed research.

Payment, asynchronous research ownership, timed completion, simultaneous
recruitment, upgrade gating, research-state save/reload and all remaining powers
are **not qualified or enabled by this milestone**. The next implementation must
port the creator's BeginPrivateResearch/CaptureSubmittedResearch/completion
route, preserving the AP10 recruitment tuple. Old native research submission
is00495900; its stock command reads the selected unit's command owner at+84.
Old research rows refresh at004748C0 and descriptors live in map006D81D0.
CanSubmitResearch00474C10 and bulk refresh00474BB0 were independently located
in the pinned executable but are absent from the current generated entries;
do not call an undiscovered address through the mod API or edit generated flags.
Prepare a proper source/API translation path or faithfully port the audited
native eligibility calculation before enabling submission.

The source now ports the literal affordability calculation from00474C10,
using the original command-owner discount lookup, fixed-point helpers0051F310/
0051F2D0 and current-player gold. This is affordability only, not permission
to bypass level, completion, health or native command validation. The private
readback reports affordability without submitting an order.
Native1190 reports both declared recipes affordable in the restored original
Lab world, with completion/current-research still zero. Brewing opens, returns,
reopens and returns again; ordinary save/exit succeeds at147.9MiB peak RSS.
Official fixture1189 passes with the final plugin source.

`ResearchActivity` ports the creator's separate pending/active research owner.
Its fixture covers delayed submission, unrelated tuples, zero duration,
duplicate submission, wrong-building/wrong-event completion, a native callback
that retains the order, and restoration of concurrent recruitment after actual
native retirement. This owner is not wired into live submission/completion yet;
passing those controls does not qualify paid research or persistence.

The private event bridge now follows the original AP99 notification filter,
instead of refreshing compound research controls on every event. Original
event2009's dispatch is independently bound in the pinned Old image: slot
006C202C points to004ABF70, between event IDs2009 and200B. That routine uses
the original descriptor resolver00474480 and packed-attribute setter at
vtable+124. Current native534 classifies004ABF70 as a non-hookable block.
Curate its real entry through source/config and official regeneration before
installing the completion wrapper; never change generated hookability flags.

Rollout/manual-data audit: none required for this private source checkpoint.
The audited surfaces are native function/attribute registries, original GMP
ownership, build flags and production asset inclusion. Existing public players
have no Alchemist state to migrate; this probe is not a production launch input.

## Source and package

- [Alchemist source](https://github.com/Phantomstar721/majesty-gold-hd-custom-guild-alchemist),
  pinned at `bb32bea97cf0a3bde4a02d9a6442a5ef11b56c29`.
- [Mod Manager source](https://github.com/Phantomstar721/majesty-gold-hd-mod-manager),
  pinned at `63a81840e0f9264067d7984ad0d2b39859fa1896`.
- [Actual Workshop package](https://steamcommunity.com/sharedfiles/filedetails/?id=3793509198),
  item `3793509198`, reported size 13,010,996 bytes and content manifest
  `5352500588909678435` on Workshop depot `73230`.

The source repository explicitly omits original media and compiled packages.
There is no GitHub release containing them. The full Workshop package has now
been downloaded through Mike's authenticated Steam client and copied into
private immutable staging: 42 files, 13,010,996 bytes. Its actual media must be
preserved. The original repository declaration remains in
`upstream-mod-definition.json`; `mod-definition.json` is the acquired Workshop
declaration, with exact package hashes in `source-contract.json`.

Valve's macOS SteamCMD bootstrap cannot run on this machine (Bad CPU type).
An isolated Node Steam client reached Valve anonymously and obtained item/depot
metadata, but Valve refused the manifest with **AccessDenied**. No user Steam
credentials were read or used. Mike installed Steam, signed in and executed
`workshop_download_item 73230 3793509198` in Steam's Console. Steam's Workshop
log and installed item manifest report successful download of the exact pinned
manifest. The original Steam directory is preserved. Do not repeat the rejected
anonymous request.

Mike confirmed creator permission on October 13, 2026 for redistribution of the
original Alchemist artwork/audio in the public browser build and GitHub asset
repository, with creator credit. Mike contacted the creator himself; no message
was sent by the agent. The package contains no separate media license file, so
this records the reported permission without applying the source MIT license
to all media. See [creator credits](../CREDITS.md). Publication still requires
playable runtime verification.

Inspect an extracted package without installing it:

```sh
python3 scripts/inspect-alchemist-package.py /path/to/CustomGuildAlchemist \
  --receipt output/alchemist-package-inspected.json
```

This verifies the acquired declaration, all 42 acquired file hashes, referenced files, private actor/art
identities, native CAM bounds, audio presence, costs and declared combat actions.
It hashes the actual package files. Passing preflight does **not** qualify media
provenance, native runtime support, or gameplay. A different declaration needs a
source/version review before accepting it. The real package passed this
inspection; all seven CAMs contain valid bounded resources, including the
private hero/building IMAG records, 15 WAVE audio records and six DSND records.

The Workshop declaration adds typed boolean capability dispatch, the shared
Bazaar potion policy (including the authored Giant Spider form), and the v2
Philosopher's Stone callback compared with the repository declaration. These
were validated with the actual community parsers; they must not be dropped to
fit the older declaration.

## Compatibility work completed

`web/content/community-runtime-registry.mjs` reads the community's MMCP v1
capability manifest and Alchemist's MMFR v1 name-generator/oil-row records. It
preserves private `NM18`/`HN69`–`HN72` identities and `ALo1`/`ALo2` descriptions.
It rejects truncation, duplicates, ordering errors, stock name collisions,
invalid encodings, unsupported schema versions and trailing bytes.

Tests use bytes produced by the pinned upstream Python encoder, rather than a
second invented implementation of the format. Separate checks refuse required
capabilities absent from the runtime and reject capability/feature disagreement.
These modules are preparatory code, currently outside the live launch path.

The source-pinned original community data/composition modules are vendored
unmodified under `third_party/majesty-mod-manager`, with their MIT notice.
`scripts/stage-alchemist-runtime-registries.py` uses the original community
encoder/decoder to stage all seven controller recipe families and the name/oil
registry. The acquired version emits **MMCR v20**, including the explicit
`Philosophers_Stone_Hit` source callback. Its two source-composition policies
are validated and retained in the registry staging receipt. They are now also
applied by the separate private GPL composition step below.

```sh
python3 scripts/stage-alchemist-runtime-registries.py \
  --parent-dialog CG01 --child-dialog CG02 --out output/alchemist-runtime-stage
```

These are explicit private staging assignments. CAMs still need corresponding
identity remapping, and the browser must implement every selected capability.
Staging does not install or launch content. Four tests verify authored research
prices, upgrade prerequisites, reagent costs, timed effects, callbacks, source
policies and refusal of modified community encoders.

`scripts/compose-alchemist-gameplay.py` applies the original community potion
and typed-provider composers to the actual acquired package and explicit
installed SDK project inputs, in stock project/load order. It audits capability
installation sites across stock and mod scripts, preserves the Alchemist's
authored mechanics, and generates the paired custom Giant Spider bonuses and
expiry cleanup. Six stock potion purchases and ten potion action validators
retain the declared eligibility policy. Changed or unsupported source boundaries
are refused before output is created. Its receipt binds 336 stock inputs and 31
package source/description inputs; source/runtime bytecode equivalence remains
a separate qualification step.

```sh
python3 scripts/compose-alchemist-gameplay.py \
  --package /path/to/CustomGuildAlchemist --game-source /path/to/Majesty \
  --out output/alchemist-source-composition
```

Private composition `output/alchemist979-source-composition` has 125 GPL/DAT
definitions and 45 XML descriptions. The official, unmodified SDK compiler
compiled its exact staged inputs in muted isolated browser trial 980, returning
`COMPILE_EXIT=0`. The downloaded bytecode is **701,264 bytes**, SHA-256
`98d726c14289ff0ca64adb147d2d922c8d2fdb893ad29f1ca593280edebfac93`.
`output/alchemist980-compiler-proof.json` binds the source composition, application
archive, compiler, guest source hashes, actual exit receipt and downloaded BCD
header/hash. No BCD was present in compiler input. This proves compilation,
not browser gameplay or legacy resource support. Peak owned RSS was 1,477.7 MiB;
the owned browser and compiler server were closed normally.

`scripts/prepare-alchemist-compiler.py` prepares repeatable official compiler
inputs from a source-composition receipt and the qualified SDK runtime. It
refuses altered composed source, incomplete policy composition, a different
compiler/runtime, and existing output directories.

`scripts/lib/legacy_description_game.py` now serializes the complete supported
Character, Building and Overlay **game parts** directly from XML. It does not
clone a stock actor. The scalar order and version1 key/value maps were checked
against the pinned guest's vehicle/building/overlay writers and original CAM
bytes. Unit and Action IDs use separate namespaces: stock descriptions reuse
FourCCs across these types, so one global name/ID dictionary loses valid spells.

Private staging `output/alchemist984-game-parts` contains 23 SECD blocks:
the actual Alchemist (including all three private spells, Dagger/Leather,
`NM18`, `hAL0` and full authored stats), the two scripted spell actors, three
Lab tiers with their actual prices/production/upgrades, and all 17 overlays.
`CGAL` is explicitly remapped to staged `CG01`, matching the existing registry.
HEAD/PRIM artwork, movement/script attachments, projectile/particle data,
action parts and the remaining inventory actor still require conversion and
integration. These isolated `.secd` files are not installed or discoverable by
the live game; they do not establish complete native descriptions.

The following step, `scripts/stage-alchemist-native-descriptions.py`, now
combines the supported game parts with independently serialized full HEAD/PRIM
parts. Private `output/alchemist987-native-descriptions` contains **24 complete
DUNT unit resources** in a 7,623-byte native CAM, SHA-256
`e3f368c74ead1ad3cb7412bc8023d74cf4f6bd0a845cd206b607a0fcff7cfbdb`.
This includes the authored Alchemist, three Laboratory stages, both scripted
spell actors, all 17 overlays and the Miasma missile. The hero's image remains
`ALC1`, its movement is the actual declared `Class 1`/`CL01`, its sound is
`AXH1`; each building retains its own `ALB1`/`ALB2`/`ALB3` image and `AXL1`
sound. Spell callbacks and overlay attachment points remain authored values.
Full prototype names are preserved in HEAD; the CAM's original 20-byte
directory filename field has its separate native length bound.

Common engine serialization matches **526 original PRIM blocks exactly**:
113 Buildings, 96 Characters, 202 Overlays, 37 Projectiles and 78 General
units. All **534 original HEAD blocks** compare exactly. Eight other stock
engine records remain explicit exceptions: five records with ambiguous sound names,
one absent sound reference, and two unqualified non-GPL script routes. These
are not silently resolved or called a whole-corpus pass. Named movement and
sound IDs are read from bounded actual native HEADs, with separate namespaces.
Private voice/XML bindings are verified; complete sound-body/runtime audio
compatibility is still pending.

The native archive remains private and is not installed. Phoenix Phial,
the Miasma particle system, action descriptors and all native controller/name/
oil capabilities remain necessary before full browser qualification. Action
format inspection found an important boundary: stock DACT stores script bytes
outside the nominal PRIM chunk, so a generic DUNT child-chunk parser cannot
convert actions. The exact sample is retained in
`output/alchemist988-action-layout-observation.json` for the next conversion.

That action conversion is now implemented in
`scripts/lib/legacy_description_action.py` and
`scripts/stage-alchemist-native-actions.py`. The native fixed 64-byte PRIM,
external script route and version3 SECD are preserved separately. The encoder
matches **127 whole original DACT resources byte for byte**; five other stock
actions remain explicit exceptions. Repeated SpellType declarations are native
bit masks, not duplicate scalar properties: Attack + CombatUtility must remain
3. Even stock actions omitting Game in XML carry a default SECD on disk.

Private `output/alchemist991-native-actions` contains all **13 authored and
composed potion/combat actions**, with effect and validation symbols bound to
the exact composed GPL source. It preserves Stun Serum's 5-second effect/
45-second cooldown at level5/rank5, Flash Flask's Special animation at level3/
rank4 and 30/45-second timing, and Miasma's actual
`Alchemist_Miasma_Mist_Hit` callback at level8/rank4 and 21/60-second timing.
The six stock and four private potion actions retain their generated policy
validators; no new shopping or potion mechanics are invented.

`scripts/lib/legacy_description_particle.py` serializes the complete authored
emitter/particle/bounds/colour/spin data in the pinned PRIM-v5 layout, matching
**all 22 original particle engine parts exactly**. Current unit staging
`output/alchemist993-native-descriptions` now contains **25 complete native
units**, including the actual Miasma cloud particle `AMM4`, in an 8,077-byte
CAM, SHA-256
`35193a4ddb9e8dbfb3c05644c395fe4d001e5bfcf50a2caaedee7ebd0db00f91`.
It preserves the mod's Area+Column emitter, 8-per-second rate, 10-particle
limit, declared colours/fade, one-second particle lifespan and size curve.
Phoenix Phial remains explicitly unconverted. All 556 original HEADs and
548 supported engine parts compare exactly; eight unrelated stock engine
exceptions remain explicit. No content is installed or browser-qualified.

Phoenix Phial now has a source-bound **private representation**, rather than
being replaced or having its unsupported fields discarded. Read-only inspection
of the actual modern executable verified `IsInventoryItem = 0x400`, the
`CanDropItem` alias to `ATTRIB_CanDropItem`, and the native CRC attribute-key
algorithm/table. The resulting attribute keys are 529,619,686 for
`ATTRIB_CanDropItem` and 3,775,212,793 for `PhoenixPhial`, both with authored
initial value 0. Evidence is retained in
`output/alchemist995-inventory-description-observation.json`.

These newer attributes belong to a different modern description map. They are
preserved in `inventory-description-extensions.json`; they are **not** stuffed
into an unrelated old map or truncated into four-character names. The old SECD
retains the source flag bits and all supported item fields, and the original
`PXF1` artwork/full `PhoenixPhial` name remain intact. Runtime support for the
extension remains required and unqualified. The default converter still refuses
unsupported metadata unless this explicit private extension step is requested.

Current `output/alchemist996-native-descriptions` has 26 unit DUNT records in an
8,589-byte CAM, SHA-256
`0491bdb6b4d86923d3aae7a06c01365e2530a62000c884d5c37b9430dba6b6ec`,
plus the bound extension file. No runtime or browser qualification is inferred
from having all resource records. The pinned guest remains DirectDraw; the
modern executable is used only as read-only evidence for source semantics.

The original `CreateNewInventoryItem` packs numeric index113 as `0x71564e49`
(`INV` plus byte113), which fits its existing legacy inventory representation.
The modern numeric-inventory drop query also returns the legacy drop type
before inspecting standalone item attributes. The community's actual
`gravestone` prelude consumes the Phial before either revival or ordinary death.
No stock item behavior is substituted. Ordinary purchase, both lethal outcomes,
revival at25%HP/flee and save/reload still require live qualification.

```sh
python3 scripts/stage-alchemist-native-descriptions.py \
  --composition output/alchemist-source-composition --game-source /path/to/Majesty \
  --package /path/to/CustomGuildAlchemist --inventory-source /path/to/Majesty \
  --out output/alchemist-native-inventory-descriptions
```

```sh
python3 scripts/stage-alchemist-native-actions.py \
  --composition output/alchemist-source-composition \
  --game-source /path/to/Majesty --package /path/to/CustomGuildAlchemist \
  --out output/alchemist-native-actions
```

```sh
python3 scripts/stage-alchemist-native-descriptions.py \
  --composition output/alchemist-source-composition \
  --game-source /path/to/Majesty --package /path/to/CustomGuildAlchemist \
  --out output/alchemist-native-descriptions
```

The original corpus comparison matches **404 complete game parts byte for
byte**: 85 Characters, 114 Buildings and 205 Overlays. Thirteen other stock
Characters differ only at `RecruitDelay`/`NameGenType` words containing
`0xCDCDCDCD`. Their exact discrepancies are retained in the receipt; that value
is not copied into generated data, and the receipt does not call the whole
corpus a successful round trip. Independent assignments for the co-occurring
stock `NotFlaggable`/`NotSpellTarget` character flags remain unqualified; only
their proved combined mask is supported.

Phoenix Phial's authored `IsInventoryItem` flag and its `CanDropItem`/
`PhoenixPhial` description attributes need native compatibility work. The
converter refuses unsupported flags and unresolved attribute bindings instead
of dropping them or substituting a stock item. Unsupported fields, ambiguous
names, duplicate keys, bad bounds and unknown equipment also fail closed.

```sh
python3 scripts/stage-alchemist-game-parts.py \
  --composition output/alchemist-source-composition \
  --game-source /path/to/Majesty --out output/alchemist-game-parts
```

The existing Mod Manager DLL cannot run directly in WASM. Its supported GOG
executable is different from our pinned `MajestyHD - Old.exe`, SHA-256
`654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542`.
Read-only disassembly found a concrete layout mismatch: the original browser
guest allocates **36 bytes** for its shared AP07/AP10 controller, while the
Manager's audited GOG profile allocates **52 bytes**. Both old AP07/AP10 switch
arms reach the same allocation. Native addresses and structure offsets from the
newer DLL therefore cannot simply be copied into this engine.

Private evidence: `output/alchemist972-directdraw-controller-audit.json`.
This identifies candidate stock entry/constructor boundaries and their hashes;
it does not qualify complete vtables, callbacks, ownership or hooks.

## Next implementation and qualification

1. The full package is obtained and structurally inspected. Preserve its authored
   media and original GPL/source/compiled bytecode as immutable inputs. The
   two authored source-composition policies are applied and SDK-compiled.
   Preserve the separate generated bytecode and source-bound compiler proof.
2. Audit the pinned guest's controller construction, vtables and destruction;
   name-generator registry and AP78 oil presenter; and resource/description
   loading. Adapt the real package to the legacy CAM/description format as needed.
3. Port the Manager's resolved MMCR recipes and native stock lifecycles: Brewing
   secondary panel, live reagent meter, queued research, research-gated upgrades,
   timed Vigor, one-shot Arcane Infusion, and targeted Philosopher's Stone.
   Do not replace these with custom DOM buttons or a renamed stock guild.
4. Install a separate private browser content collection using a production918
   source/runtime baseline. The unqualified SIMD947 experiment is unrelated and
   must not enter this build.
5. Prove paid construction/recruitment, private art/animations, reagents and
   research, combat mixtures, all sovereign transactions, and original saves/
   reloads in a silent isolated browser under the existing resource guard.
6. Publish versioned GitHub assets and the qualified normal-game integration only
   after these checks pass. Preserve original saves and all prior releases.

Focused checks:

```sh
node --test tests/community-runtime-registry.test.mjs
python3 -m unittest discover -s tests -p test_alchemist_package_inspection.py
python3 -m unittest discover -s tests -p test_alchemist_runtime_staging.py
python3 -m unittest discover -s tests -p test_alchemist_gameplay_composition.py
python3 -m unittest discover -s tests -p test_alchemist_compiler_staging.py
python3 -m unittest discover -s tests -p test_alchemist_legacy_game_parts.py
python3 -m unittest discover -s tests -p test_alchemist_legacy_engine_parts.py
python3 -m unittest discover -s tests -p test_alchemist_native_actions_particles.py
python3 -m unittest discover -s tests -p test_alchemist_inventory_description.py
```

The authentic composition test requires `MAJESTY_ALCHEMIST_PACKAGE` and
`MAJESTY_GAME_SOURCE` pointing to private Workshop and installed game inputs.
With those set, all 36 focused Python checks and six JavaScript checks pass.
This includes unchanged unrelated authored functions, both sides of the
temporary stat lifecycle, denied Fire Balm/allowed Strength purchase policy,
and all generated action validator bindings.
The original-file integration check also verifies stock byte comparisons,
explicit discrepancies, actual hero equipment/spell IDs and all three Lab
prices/production bindings. It does not launch the game.
The full native-description check additionally verifies actual artwork IDs,
voice IDs, movement attachments, complete building names, spell callbacks,
overlay attachment points and CAM round trips. Unsupported content remains
explicitly unconverted; it is not replaced with stock actors.
Additional original-file checks verify complete action byte comparisons,
actual callbacks/validators, spell ranks, animation/sound choices, durations,
and Miasma's authored emitter, bounds, colours and size. Passing these static
conversions does not prove in-game spell execution or native UI compatibility.
Inventory checks preserve actual Phial art/name/flag/attributes, keep its newer
attributes out of the old maps, and reject changed source/flag/value bindings or
an invented runtime qualification claim.

## Native Alchemist name registration

`native/community/community_names.cpp` implements the pinned Old guest's
original name-generator lifecycle for the actual NM18 / HN69–HN72 tables.
It creates the original 56-byte generator and eight-byte owning wrapper,
retains the stock destructor/vtable and rejects existing IDs or missing
resources. The original community C++ MMFR parser is vendored unchanged and
hash-bound to the source contract. The override remains uninstalled; neither
the public launcher nor the active runtime enables it.

The focused official native test compiles the adapter and checks registration,
stock preservation, duplicate refusal, missing resources, failed allocation/
construction cleanup, and every truncated boundary of the acquired registry.
This is a native fixture test, not live guest registration or recruitment
qualification. To prepare it on a resident upstream checkout:

```sh
python3 scripts/prepare-alchemist-name-fixture.py \
  --game /path/to/majesty-recomp \
  --registry /path/to/source-bound/RuntimeFeatures.bin \
  --out /path/to/new-private-fixture
/path/to/majesty-recomp/.venv/bin/python /path/to/majesty-recomp/kit/tools/test.py \
  --game-dir /path/to/new-private-fixture \
  --native-test community_name_registration_tests --jobs 1
```

The local successful trial used an isolated, resident CMake 4.1.2/Ninja 1.13.0
installation and unmodified official tools. Missing iCloud configure inputs
were recovered from the pinned upstream commit in a private view; originals
were preserved. No game, media asset or default launcher was changed.

Rollout/manual-data audit: none required for this source checkpoint. It adds
credits, private staging/test code and an uninstalled adapter; deployed
collection selection, player saves, profile schemas, asset manifests and
runtime environment settings remain unchanged. Alchemist release still
requires the remaining controls and full playable verification.

## Native Laboratory panel lifecycle and reagent display

`native/community/community_panels.cpp` now adapts the acquired MMCRv20
parent/child recipe through the Old engine's original factory. CG01 keeps its
private window and uses the authored AP10 controller base; CG02 keeps its
private Brewing window and uses the authored AP69 base. Opening Brewing uses
the original panel opener and existing building context, including native
parent retention/removal. Unrelated stock dialogs pass through unchanged.

Original controller destruction remains authoritative. Transient ownership
records use an instance generation so an older teardown cannot erase a new
panel at a reused guest address. The Old AP69 class has eleven vtable entries
and a 36-byte allocation; no newer native structure or vtable is copied.

The reagent presenter reads the actual `APV0` attribute through the original
packed-attribute getter and binds its integer to authored control 10789 using
the original AP22 quantity virtual. It shows authored label/count controls
10787/10788, clamps negative display counts without changing the resource,
and skips an absent building/window. Refresh follows original Brewing setup
and events only while the captured child instance survives.

The original community MMCR parser and its validation dependencies are
vendored unchanged with source-contract hashes. The focused native fixture
compiles the adapter and verifies all seven acquired recipe families, private
selectors, ordinary stock pass-through, wrong-command/building refusal,
parent/child ownership, address reuse, deleted-panel refusal, actual reagent
binding, missing-context handling, and every truncated registry boundary.
Prepare it using the previous command plus:

```sh
--controllers /path/to/majesty_mod_manager_controllers.bin
```

Then run the official tool with
`--native-test community_controller_lifecycle_tests --jobs 1`.
This passes as an isolated fixture. Native world rendering, clicking Brewing,
real reagent changes, research, upgrades, Vigor, Arcane Infusion, Philosopher's
Stone, AP78 oil rows and original save/reload are still unqualified. Both
community override headers remain uninstalled and the public game stays stock.

## First native live-probe integration

The real Workshop media, original community panels and freshly SDK-compiled
composed GPL now load in an isolated native collection and reach the normal
Majesty menu. The private native probe module loads through the official
mod API in the qualified native534 engine; its six supported hooks preserve
the original factory, name lifecycle, ownership and initial reagent presenter.
The other two UI methods (0047a790 and 0047aae0) are currently classified as
non-hookable recovered data blocks in generated symbol metadata. They remain
unhooked: proper function discovery through the official translator is required
before full Back/event handling, rather than changing generated eligibility
flags. Paid construction/recruitment and name generation remain unverified.

`native/community/native_probe_plugin.cpp` is a private qualification probe,
not a release plugin or a claim of complete runtime support. All research,
upgrade, sovereign, oil-row, inventory and browser qualification requirements
remain. Native trials are muted and owned; no player saves are loaded.

Private staging was recovered from Steam after its cache directories disappeared.
New resident working files now live outside Library/Caches and outside iCloud,
under `/Users/mike/.local/share/majesty-work`. The original 42-file package was
reverified against its pinned hashes. Original game files and source links were
not changed. One native trial hit the old harness's resolution-change assertion;
no game or host-app crash fix is claimed. Construction/recruitment and complete
runtime support still need qualification.

## Native world entry and collection preparation

The private probe now reaches the ordinary quest selector and generates a
stock Beginner Freestyle kingdom. Live NM18 registration reports successful
installation through the original name-generator lifecycle. An ordinary native
world save was generated and restored in fresh owned profiles. This proves
world entry, registration and the initial stock-world save path; it does not
prove Alchemist recruitment, generated hero names or content save compatibility.

Native menu automation must wait for the actual menu to finish loading. Use
absolute `move` followed by explicit `button left down` / `button left up`
steps separated by a short wait. Two stock/mod controls stalled during a modal
transition with the frame-count-based click helper; explicit releases passed.
Avoid relative input mixed with window cursor synchronization, and avoid an
early dump that establishes the old harness's fixed pointer-space assertion
before a resolution transition. No runtime/input code was changed for these
private trials.

`scripts/merge-alchemist-native-dependencies.py` prepares a separate private
collection from the existing verified candidate. It:

- Adds the acquired Laboratory's Palace-level-2 BDEP expression to the actual
  original and expansion tables, preserving all existing prerequisite bytes
  and the required final blank line.
- Attaches the real resource archives to original and expansion classification
  groups while retaining existing load order. The original edition has three
  groups; the expansion has six applicable groups.
- Materializes 26 authored native unit descriptions and 13 actions in the
  native catalogs. Existing unit identities are never replaced. The six
  acquired Bazaar potion actions are deliberate authored overrides and require
  the exact original action identity/name; unrelated action payloads remain
  unchanged.
- Adds missing semantic text keys to native unit/help/activity/item tables
  while preserving every existing stock row. Linked purchased files become
  owned copies before writes; earlier candidates and originals stay intact.

Ten focused tests pass, covering destination isolation, stock preservation, prerequisite collisions,
classification coverage, native catalog collisions, potion override identity
and semantic text merging. The script is private staging, not release activation.

The normal four-hero gate was met through paid recruitment at existing temples:
two healers and two monks survive in original saves. The ordinary paid Palace
upgrade completed. The Laboratory still failed to appear, isolating a native
filter rather than a prerequisite problem.

Pinned Old AP03 list construction at `00468a80..00468a97` masks the descriptor's
second byte with `ff00`, requires `4200` and then requires first byte `41`.
Only `AB` building IDs pass; the acquired `ALB1` does not. This is verified
original code, not an inferred restriction from an unsuccessful literal scan.

`scripts/alias-alchemist-native-buildings.py` assigns unused `ABx1..ABx3`
identities to the actual Laboratory tiers. It adapts only the HEAD identity,
upgrade references, directory/title/dependency keys and native controller family.
Names, PRIM artwork/audio/geometry, prices, HP, income, hero slots, the produced
actual Alchemist and compiled GPL stay unchanged. No stock actor is renamed or
replaced. Occupied IDs are refused. Four focused alias tests pass.

Private native trial1053 displays **Alchemy Lab, 1400 gold** with its original
framed flask icon. Its genuine circular construction artwork also renders in
the placement preview. Ordinary construction, completion and Alchemist
recruitment remain unqualified; crowded starting locations produced red previews.
Do not repeat the completed selector/menu discovery.

Every new save selection must exclude **all** copied input GMP hashes. A
profile can contain both Day0 and Day1 worlds. Trials that resume a specific
receipt should copy only that bound GMP into a fresh owned save directory,
preventing an older listed file from being mistaken for the intended world.

Rollout/manual-data audit: none for this source checkpoint. The new script only
creates private candidate files. Production assets, launcher configuration,
profile schemas and runtime remain unchanged; no Alchemist content is public.

## AP69 partial translation and native module

The Old control method `0047a790` and event method `0047aae0` are independently
audited vtable entries with RET4/RET16 respectively. Declaring their real starts
in a private `game.toml` produces hookable function-entry metadata through the
official translator; no generated eligibility flags are edited.

Partial-module translation previously failed on three unrelated routines that
whole-image discovery inspected but the module did not carry. The scoped kit
fix in `patches/recomp-kit-partial-module-failure-scope.patch` retains those
diagnostics as `module_omitted_failures`, keeps selected-function errors fatal,
and explicitly rejects a requested export that was not emitted. The full-image
path is unchanged. All 166 driver tests pass in an isolated kit checkout based
on `fd660e2c03c482785853f82b7906aaf55d3f39a7`.

Private trial1072 translates both selected methods successfully. Trial1073
builds their generated C module through the official `tools/test.py` fixture;
the original controller-lifecycle test also passes. Native1075 loads and
registers the two translated functions, then restores the original test world
and reaches the normal building list. These are module preparation/load checks,
not live Back/event or research qualification. The base image is consulted
first, so a supplementary module does not replace entries already carried by
native534; a complete curated runtime build remains necessary for activation.

Construction is still unqualified. The controlled stock Blacksmith placement
at the same investigated location also reports occupied units/buildings and
spends no gold; this does not establish an Alchemist-specific collision defect.

## Ordinary Lab placement causes

The opt-in, read-only `RECOMP_BROWSER_BUILD_DEBUG=1` observer in the qualified
native534 engine identifies two separate placement constraints without changing
any query result. In owned trial1077, site54,190 is blocked by the existing
Temple to Krypta (`ABT1`, unit532). In trial1079, site60,192 passes the actual
15-by-12 footprint query (`1800`) but fails the wider31-by-22 spacing query
(`1100`) against that same temple. The authentic Lab descriptor and spacing
art remain unchanged. The eastern site tested in1078 instead returns native
reason2 (unexplored ground), so moving farther east requires normal exploration.

These trials restore the exact paid-Palace2 Day1 input bound by receipt1051,
copy only that GMP into owned profiles, and exit normally under silent resource
guards. No Laboratory has yet been purchased, constructed or recruited from;
failed previews and stopped actor audits are not construction qualification.

Trial1081 places an ordinary1000-gold exploration reward east of the temple
through Palace Rewards (explore-plus173,370; flag100,332; ground620,200).
Gold drops15646->14646, stock heroes respond and the previously black eastern
ground is revealed. The generated Day2 GMP is419481bytes, SHA256
`3b9b38e99777b4119cfba8985df7a525e70e2356080ae37dc0ab58f4bfc5ea03`;
receipt1082 excludes the copied Day1 hash. All four prerequisite heroes remain
alive. This is ordinary preparation for construction, not Laboratory gameplay
qualification. The purple HUD shortcut193,155 selects the Palace without
relying on a saved camera position.

Trial1083 then passes both original placement masks at72,192 (world1152,3072)
and purchases the Lab for1400 gold. After25seconds the generated world retains
its destroyed building record (unit822, state528), so construction completion
is not qualified. A separate immediate-save fork1085 captures the live native
agent88, title`AlchemistsLaboratory`, type`building`, HP1 and state512. Its
424681-byte generated GMP has SHA256
`63d8a5c056cd159eff17fecb43c95f48d1bb3dd19298bd01b2d11790303c7ccb`.
This establishes ordinary paid creation and script initialization, not completed
construction, recruitment or browser play. The later world has multiple nearby
hostile Skeleton/Zombie actors; the exact killing event was not traced. Keep
this immediate-save fork separate from the destroyed-world receipt1084.

The stopped original actor title identifies the spacing blocker532 as
`Temple_Krypta`; earlier scratch notes calling ABT1 Fervus were incorrect.
Construction testing moves to an ordinary New Settlement freestyle world with
Rat Scouts and no wandering monsters or special events. This is the stock setup
UI, using only the authentic Alchemist candidate; retired content remains off.

The initial private alias candidate1052 used ABs1..ABs3. Those IDs occur in
archived Trail Lodge saves and must remain reserved after that pack's retirement.
The authoring helper now assigns ABx1..ABx3, which are unoccupied in both editions
of the original/native merged catalogs and absent from tracked prior content.
Its controller owner follows ABx. Existing private ABs Lab worlds remain archived
with their exact candidate; do not resume them under the replacement candidate.
The clean stock New Settlement save has no Lab and can safely start the new
qualification branch. Original art/audio/geometry, actor names and statistics,
ALC1 hero identity, canonical GUID and compiled GPL remain unchanged.

The New Settlement branch also lost its first stock Rogues Guild to ratmen
before construction completed; do not resume its destroyed Day4 world as
progress. Trial1098 instead selects the stock Fortified Palace preset (force
row309), with30000 gold, Rat Scouts, no wandering monsters/events and seed
150700822. It starts a completed700HP Warriors Guild,200HP Guardhouse and550HP
level-one Palace. These are unchanged original classes. Generated receipt1099
binds the314666-byte starting GMP, SHA256
`8a695441297a2eff601f91e8376320a3c228d8967a26acd68c0435acc526d2d6`.
Minimap140,26 then world500,300 selects the existing Warriors Guild normally;
its recruitment price is450. New private candidate1093 uses ABx identities.

Rollout/manual-data audit for this source helper change: none required. The
surfaces inspected are native description/controller mappings, archived player
identities, original stock catalogs, private stage boundaries and production
asset inclusion. ABs Lab prototypes remain private and bound to candidate1052;
no public Alchemist records or assets exist to migrate. Public game assets,
player schemas and runtime launch configuration are unchanged. Do not release
candidate1093 until ordinary Lab construction/recruitment and the remaining
mechanics/browser gates pass.
