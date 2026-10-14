# Community Alchemist Lab browser integration

The active content goal is Phantomstar721's actual **Custom Guild: Alchemist
Lab**, including its original animated Alchemist, three building stages, voices,
reagent economy, research and combat/sovereign alchemy. Lost Trail, Wayfinder and
Trail Lodge remain retired. Production still runs the original game.

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

The Laboratory has not yet been exposed in a qualified building list. A prior
level-2 Palace save still lacked it after preparation; newly generated worlds
with the merged catalogs had a level-1 Palace. Its normal upgrade tooltip
requires four heroes, and those worlds started with zero. Next establish that
ordinary prerequisite and inspect actual native build eligibility before
assuming a prototype-ID or descriptor problem. Do not repeat home-menu scans
or infer gameplay support merely from opened resource files.

Rollout/manual-data audit: none for this source checkpoint. The new script only
creates private candidate files. Production assets, launcher configuration,
profile schemas and runtime remain unchanged; no Alchemist content is public.
