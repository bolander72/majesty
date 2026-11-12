# Guild scale and current-source verification — November 12, 2026

PR #1 contains preparation tools and authored arithmetic only. No generated game
resources, licensed creator sources, SDK binaries, player saves or release bindings
are included. The candidates remain private; production is unchanged.

## Current GPL source recovered

Reconstructed the complete post-usability collection from the pinned creator
packages, Windows-line-ending SDK sources, retained preparation history and
producer commit `0cd1ee7c710c3c303acb38d0d0fd262bb8a91bcd`.
The original historical stage manifest was not recovered. Newly generated
provenance explicitly records that distinction; it does not impersonate the lost
manifest. Current source is retained privately in
`output/pr-1-recovery/current-source-001/` and `recovered-current-gpl.zip`.

The unchanged original SDK compiler, SHA256
`8cfbf6fff1cf90d7aaf334392352515eb0f989a35a16bc99f225e52af38820c4`,
first reproduced all six stock SDK controls byte-for-byte under Wine 11.21 on
macOS with a fresh win64 prefix. It then reproduced **all three currently deployed
libraries exactly**:

| Library | Definitions | Bytes | SHA256 |
| --- | ---: | ---: | --- |
| Common | 1,108 | 37,409,957 | `d0902fa5653d87cd6c5e0d57eb02941ffa3c5c9c3a166d5aca74be8d04b5c741` |
| Base | 175 | 946,028 | `85cbbbd1dd63fe3db48e25e5cfea97ecb1d8fe67e88c80c3656ea50d489521f1` |
| Expansion | 209 | 1,738,800 | `9513523bf234bb7676c0bc846e3617b04f23a5c06ee9dc98632ceb01b1462190` |

The earlier 684-definition creator baseline was also reproduced in all three
scopes. Expansion preparation now offers an explicit `--creator-compiled`
recovery path: it requires the source-bound original-compiler receipt, complete
source inventory, and all three actual outputs matching the existing original
pins. The historical exact-manifest path remains the default. Missing receipts,
changed sources/bytecode and partial matches are refused.

The SDK fixture lacks the modern `MajestyHD.exe`. Recovery omitted only its
unused copy and records that omission. It did not substitute the pinned Old
executable or claim modern native ABI qualification. Compiler resource accounting
now includes newly detached Wine/PE processes, with an explicit `--wine-arch`
option. The existing 180-second / 2,048-MiB limits and isolated-prefix cleanup
remain.

## Resized world artwork

The downloaded production CAM is 43,445,265 bytes, SHA256
`9a392451bbd208b4623f06172b1eca0ec6814e0056ca2be46dd02b41aa0e84ed`.
The tool reproducibly yields 56,840,864 bytes, SHA256
`0829ca89365657851f5b92d9295b03abad11a3e6603e84b0991a8b1760b616a5`.

Bards Hall and Alchemy Lab use 78% world scale; Dark Paladin's Guild uses 90%,
for all three tiers. Frames, hotspots, attachments, rectangle masks and polygons
scale together. Original TILE slots, palettes, sidebar artwork, Adventurers
Guild, Zoo, Phantom and unrelated images remain unchanged. An independent CAM
parser accepts all 1,976 references in the nine resized tier images.

Reproduce with the pinned input and the art requirements installed:

```bash
.venv-pr/bin/python scripts/prepare-community-building-scale.py \
  --source output/pr-1-verification/Community-main.cam \
  --out output/my-new-private-scale-candidate
```

## Native placement, upgrades and fresh reload passed

A private localhost build of the pinned producer served the candidate CAM with
the **unchanged production engine**
`e37eb16601316c3322018e54391414bee3c63bb92366921b3dabd6ba0bb1c1f8`
and the unchanged production Common/Base/Expansion libraries above. Browser
inspection through the engine's public filesystem API independently hashed the
actual mounted files and confirmed those exact bytes.

Owned Chrome sessions used an isolated profile, the same explicit executable
and `--mute-audio` configuration on every command, and deadline/RSS guards. One
engine ran at a time. In trial `pr1-placement-005`, native controls constructed
the three guilds, recruited their heroes and upgraded each guild through levels
1, 2 and 3. Alchemy research prerequisites used the normal Brewing controls.
Cheats supplied gold, level-1000 defenders and Restoration to bound construction
and raid interference; this is not an economy or balance qualification.

All nine tier previews accepted clear-ground positions in trial 004. Blocked
placement was also observed over existing buildings and obstructions. That
trial's distant sites were subsequently destroyed by a raid, so those sites do
not count as completed-building evidence. Trial 005 supplies the completed
three-tier and persistence evidence instead. Earlier input/setup failures and
raid losses are retained separately and are not counted as passes.

Completed buildings retained native selection, placement, construction and
upgrade artwork, original framed sidebar art, and recruitment controls. The
level-3 Bards Hall was checked beside the stock Warriors Guild at 800×600.

The normal Save Game menu wrote `(Freestyle Game) 8 Days.GMP`, **345,616 bytes**,
SHA256 `0efeab4b10ee67a0d203602409ce942f9bf3f0a8598e0b045f7277a767ba0703`.
The owned browser and engine were closed. Trial `pr1-placement-006` started a
new browser/engine and loaded that exact save through the native Load Game menu.
All three buildings retained their positions, level-3 artwork, recruitment
counts and full health:

| Guild | Before save and after fresh reload |
| --- | --- |
| Alchemy Lab | Level 3, 444/444 HP, one recruited Alchemist |
| Bards Hall | Level 3, 700/700 HP, one recruited hero |
| Dark Paladin's Guild | Level 3, 1,200/1,200 HP, one recruited Dark Paladin |

The saved file's bytes and SHA256 were identical before and after reload. Normal
kingdom play continued into day 9, including the saved level-1000 heroes. The
reload recorded no page errors. Aggregate owned RSS peaks were 1,745.4 MiB and
1,867.0 MiB respectively; both trials ended with operator cleanup and the host
app remained alive. Owned engines and tabs were closed. This bounded result does
not establish that the earlier host-app crash has been fixed or qualify co-op.
Private screenshots, the exported native save, mounted-file hashes and guard
receipts remain under `output/pr-1-recovery/`.

## Health candidate reconciled with current source

The earlier Phantom proportional-health correction already shipped. The current
adapter preserves that helper, Eternal Soul, Phantom resilience, every DAT file,
and both edition sources. It changes only the existing `Eval_For_Healing` and
`MJC_Eval_For_Healing` percentage expressions. It adds `MJP_Health_Percent`, the
stock `haslowHP` rule adapted to that helper, and its first-wins alias
`MJC_haslowHP`. Both edition route tables gain only that alias; existing routes
and stock LowLevel source must match their current pins.

Use the recovered source and its independently reproduced compiler outputs:

```bash
.venv-pr/bin/python scripts/prepare-community-high-level-health.py \
  --source output/pr-1-recovery/current-source-001 \
  --compiled output/pr-1-recovery/current-compiled-001 \
  --out output/my-new-private-current-health-stage
```

The original SDK compiles the current candidate to **1,111 Common definitions**,
SHA256 `8077e0a93fff3b6c47b1db0934e9e91e5a3d00d82961136cf99fba5726bbd944`.
Base and Expansion outputs remain byte-identical to production. Source comparison
confirms that all prior definitions except the two healing exports are unchanged.
The bounded helper preserves floor percentages through GPL's arithmetic limit;
no health bonus, vampire damage or level-drain rule changes.

This candidate is compiler-qualified, not installed in the gameplay trial or
production. Publishing it later requires a separately qualified release with the
new first-wins route included in its engine binding. The older 718-definition
candidate must never replace the live collection. The preparer retains explicit
unqualified runtime/publication flags and refuses an existing health module.

## Validation and rollout

Focused source/art/Phantom validation: **220 passed, 6 skipped, 64 subtests passed**
using Python 3.12.13 and the pinned art dependency. The skips retain their existing
external fixture gates. `git diff --check` passes. Compiler and native browser
receipts above are separate from these focused tests.

Earlier full-suite runs were compared with unchanged base
`83649beaef4a1b8d5f6604a9709b7fe26148ba79` in the same fresh checkout:

| Suite | PR at that run | Unchanged base |
| --- | --- | --- |
| Python | 852 passed, 20 failed, 13 errors, 19 skipped | 839 passed, same 20 failures / 13 errors / 19 skips |
| JavaScript | 1,283 passed, 17 failed, 22 skipped | Exact same results and failing cases |

Those are historical comparisons, not a green full-suite claim. Missing native
fixtures and existing saved-realm/crossing/map-close failures were not weakened
or changed. The later recovery populated private tooling for the focused compiler
and gameplay checks; it did not rerun or qualify all unrelated native suites.

Rollout/manual-data audit: **none required for this source-only PR**. Preparation
scripts, authored GPL, release descriptors, engine/resource bindings and save-format
impact were checked. No deployment, merge, environment configuration change,
player-data migration or release-resource installation was performed. Retired
content remains disabled. Any future installation is a separate release change.
