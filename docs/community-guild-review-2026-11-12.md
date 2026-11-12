# Private guild review — November 12, 2026

These are private candidates, not installed or published changes. Following the
user's environment publication, the resumed runtime can access
`majesty.boland.co`. Earlier CONNECT 403 receipts remain intact. The served
manifest identifies `guild-usability-v1`, with engine hash
`e37eb16601316c3322018e54391414bee3c63bb92366921b3dabd6ba0bb1c1f8`.
Its combined world-art CAM was downloaded and verified against the served
manifest: `9a392451bbd208b4623f06172b1eca0ec6814e0056ca2be46dd02b41aa0e84ed`.
The pinned producer source archive at commit
`0cd1ee7c710c3c303acb38d0d0fd262bb8a91bcd` has all 2,030 Git blob hashes verified.
It contains the later installers and receipts, but no complete generated GPL
source stage. Source and asset downloads are retained privately under output.

## Building scale

The recovered usability producer records Adventurers Guild at 60% and Zoo
at 78% of their previous world scale, including matching geometry. The live CAM
matches its production receipt. Current representative visible widths are
233 pixels for Adventurers Guild and 288 pixels for each Zoo tier. Those
resources remain byte-identical in the new candidate.

The live combined CAM now has a private 78% Bards candidate for all three
tiers. The live Alchemist art matches the retained original package and also
merits reduction: visible widths are
318/286/336 pixels, compared with the stock Warriors Guild's 250 pixels.
Its private 78% candidate measures 248/223/262 pixels. These are representative
idle-frame bounds, not a claim that all stock buildings share one size.

All three candidates scale world frames, hotspots, attachment coordinates, rectangle
masks and polygons together. Original TILE slots, palettes, unrelated images
and sidebar animation sets remain unchanged. The independent art parser accepts
the rewritten references. In-engine appearance, placement and save compatibility
still require qualification against the actual current release.

The recovered Phantom building is already comparable to stock size and has not
been resized. Dark Paladin's approved textured art now has a 90% candidate,
including all three tiers and their geometry. Representative widths fall from
246/275/319 to 221/247/287 pixels. Native-scale decoded previews retain its
architecture and tier differences. The reviewed active mod building families
are Alchemist, Bards, Phantom, Adventurers, Zoo and Dark Paladin; no other mod
building families occur in the live combined art archive. Retired guilds remain
disabled; no originals or player data were changed.

`scripts/prepare-community-building-scale.py` reproducibly applies the three
reductions to the pinned live input. It refuses changed or already modified
baselines and existing output directories, and independently checks original
slots, unrelated resources and UI byte preservation. The combined candidate is
`output/guild-review-2026-11-12/live-combined-scale-003/Community-main.cam`, SHA256
`0829ca89365657851f5b92d9295b03abad11a3e6603e84b0991a8b1760b616a5`.

## High-level health

The retained Phantom source contains large multiplication before division in
Eternal Soul health adjustments. Shared healing evaluation and stock HasLowHP
also multiply HP by 100, exceeding GPL's bounded arithmetic at high health.
The candidate uses the existing safe proportional-health helper and a bounded
floor-percentage helper, preserving normal percentage thresholds. It adds no
vitality/health bonus and changes no vampire damage or level-drain rules.

Only existing functions Eval_For_Healing, Eternal_Soul_Begin and Eternal_Soul_End
change in the recovered merged source. HasLowHP and the two helpers are added.
All DAT files and base/expansion source files remain byte-identical. This is an
arithmetic defect correction, not proof of the remembered live vampire incident.
The current live source must be reconciled before installing it. Recovery now
confirms the earlier Phantom fix already shipped: its release history documents
the overflow and the live 1,108-definition Common BCD declares
MJP_Scale_Living_HP and MJP_Phantom_Resilience. It does not declare HasLowHP or
the new percentage helper. There is also a later MJC_Eval_For_Healing definition.
The old 718-definition candidate must never replace that live library. The
complete post-usability source stage is needed to preserve and inspect those
later changes before adapting the shared health rules. The public archive
contains neither that stage nor Merged.gpl; this remains an integration blocker.

The authentic SDK compiler successfully compiled the candidate with its isolated
classic Wine/QEMU runner. Common output has 718 definitions; base and expansion
outputs remain byte-identical to their prior receipts. No gameplay installation
or live qualification is implied by compilation.

## Adventurers Guild and Zoo

The retained usability contract and recovered original creator source say heroes
automatically select suitable jobs. The pinned Adventurers Guild ZIP (2,918,733
bytes, SHA256 `8f5b847c0ec7f3795f7f6528a1b8b22e76b23f83291728bdd276ff255356649e`)
was verified and its source retained privately. Its quest-board definition sets
`focus_selected_row_on_click` to false and scopes the sole paid action to the
parent Guild's refresh callback. The hero visit/claim functions enforce an
applicant and executable quest; no player double-click assignment is registered.
Available Quests is an offer list, not a player-directed assignment interface;
double-clicking need not dispatch a hero. Refresh changes unclaimed offers, while
accepted jobs continue. This intended contract is confirmed from source,
not a fresh live interaction check. Zoo behavior is unchanged in this review.

## Receipts

Private inputs, candidates, previews, source comparisons, compiler proof and logs
are retained under `output/guild-review-2026-11-12/`. Earlier recovery/build/SDK
receipts remain intact. Latest root Python run: 775 passed, 2 skipped. The skipped
tests and exact reasons are recorded in the task verification manifest. No
JavaScript or engine source changed, and no new browser gameplay success is
claimed. Existing tests/assertions were not weakened.

Full JavaScript rerun: 1,299 passed, 22 skipped, zero failures. Existing external
fixture gates remain intact; the missing modern EXE and 154-case native-order
capture account for the two Python skips. JS skips remain historical native
artifact/binding gates as inventoried in the retained setup skip receipt.

Bounded browser qualification reached the actual production engine and WebGPU
but did not reach the menu within 90 seconds. The unchanged production baseline
reproduced exactly the same native startup log and identical screenshot, ending
after legacy inventory compatibility registration. This separates that startup
failure from the art changes, but does not establish gameplay compatibility.
The earlier malformed test URL/profile trial also remains recorded separately.
No failed trial is counted as a pass. A final configuration check restores the
pinned Vulkan/Mesa environment from the earlier successful setup instructions;
it also fails to reach the menu within 90 seconds, with the same final native
event and startup screenshot. Its receipt and aggregate-RSS supervisor receipt
are retained separately under `browser-candidate-005`. Owned browser contexts
were closed after each trial. Current production-engine startup in this VM and
the missing complete current GPL stage are the two remaining blockers; the
earlier successful fresh WIP engine/kingdom receipts remain separate and intact.

Reproduce the resource candidate without modifying originals:

```bash
upstream/majesty-recomp/.venv/bin/python scripts/prepare-community-building-scale.py \
  --source output/guild-review-2026-11-12/live-release/Data/Community-main.cam \
  --out output/guild-review-2026-11-12/my-new-private-candidate
```

No deployment, merge or environment publication was performed. The source-only
changes are prepared for PR review; private inputs and runtime receipts stay local.
The PR branch also passes all 13 focused building/health/Phantom tests on current main.
