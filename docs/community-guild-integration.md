# Bards Hall and Phantoms Haunt integration

The integration goal is active. Alchemist Lab and Vampiric Revenge remain the
deployed content. All three guilds' authentic combined GPL now compiles with the
original SDK. Bards Hall and Phantoms Haunt remain private candidates, with no
claim of native or browser gameplay qualification.

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
those private presenter adaptations and their lifecycle still need integration.
Preserve the original queue/upgrade methods and stock UI rather than replacing
them with simulated recruitment. The Old secondary-container flag is
`controller+0x20`, verified in original `0047a760`; the modern creator layout
uses `+0x30`, which must not be copied into the36-byte Old object. See `legacy-abi-verification.json` for the
qualification boundary. All34 focused Python tests pass without skips.

## Remaining qualification

Adapt the compiled gameplay and required features to the pinned DirectDraw
runtime. In particular, Bards needs its three-choice AP52 recruitment,
equipment, hiring/activity lifecycle, Chronicles research, XP observers and
projectile behavior. Phantoms needs private upgrade/recruitment controls, undead
interactions, spell effects and native descriptor conversion. Do not silently
disable unsupported features or relabel stock actors.

Require ordinary paid construction/recruitment, distinctive mechanics,
selection/fog reveal, UI states, original saves and fresh reloads in bounded,
muted browser trials before publishing. Preserve the current Alchemist and demo
content and all player profiles. Lost Trail remains retired.
