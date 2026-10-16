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
source. Its pinned creator builder's `write_gpl_sources` generated the four
original GPL/DAT inputs against the original SDK. These were added only to a
private copy's source manifest for composition. Original media, compiled
package, Steam download and installed game remain unchanged. Source-to-bytecode
equivalence for the acquired Phantom BCD remains unqualified.

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

Private preparation `community1825-combined-manager-source-stage` contains:

| Scope/file | Bytes | SHA256 |
| --- | ---: | --- |
| Any/Merged.dat | 12039 | `2bc9e78169ecdc9a898520ee54fe13649beb6e32d94ee9594582aefce94b69e0` |
| Any/Merged.gpl | 451701 | `9fa6fc628ab29abbba1ea900e8d9c509051cd97eeab3af22386998558ec3ef51` |
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
| common.bcd | 13375114 | 683 | `c9721fa2d236149b5d9d05bdad78a7e49632fdbb1d9b71c7a3ff94b1e10401fd` |
| base.bcd | 108586 | 57 | `0ff27dca0792e93edf589aa66e2936a38cfef74f711d4e7dec46afcc73d9a29b` |
| expansion.bcd | 16812 | 8 | `2e9247f9f84b0cafdb34fa2f7d3ff93bcc43d3c729ea45ad2a7a7963c6926084` |

Muted, guarded browser SDK trial1826 produced these exact hashes at 1745.2 MiB
peak owned RSS. Its chunked export reached the existing input cutoff; the
incomplete local copy is unqualified and must not be used. A fresh isolated
prefix using the installed game's `wine32on64` ran the same original compiler
and produced byte-identical complete outputs, independently validating that
handoff without another browser launch.

The tracked `scripts/compile-community-guild-gpl.py` then reproduced all three
hashes and all 748 definitions in 14.05 seconds at 64.8 MiB observed peak owned
RSS. It validates prepared source hashes and the original compiler, creates a
fresh owned Wine prefix, enforces a 2048 MiB/180-second guard and shuts down only
that prefix's server. Use `--source` for the preparation output, `--compiler`
for the original SDK executable, `--manager` for the pinned creator checkout,
`--wine`/`--wineserver` for the installed compatible executables and a fresh
`--out`. Player profiles are never opened. Prefer this qualified compiler path
for subsequent source changes on this machine.

A private native description probe also encoded all 31 Bards unit descriptors
with the existing audited XML encoders. Phantom conversion currently leaves its
33 inventory-item descriptors and guild sound binding pending. Those are actual
mechanics/resources to implement, not content that may be silently dropped.

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
