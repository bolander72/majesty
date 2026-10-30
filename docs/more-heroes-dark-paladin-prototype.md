# Dark Paladin’s Domain: original-art prototype

Current status: released on October 30, 2026 at https://majesty.boland.co/.
The redesigned Dark Paladin is the only reintroduced More Heroes guild.
Adventurers Guild and Royal Menagerie remain active; the other classes remain
retired. Dark Paladin's Domain becomes available at Palace level 2. The
preview-stage statements below describe the development and qualification
history before this production authorization.

On October 29, 2026 Mike approved developing the Dark Paladin concept as the
first More Heroes guild with original artwork. This work is an isolated
prototype. Public More Heroes admissions remain retired; Adventurers Guild
and The Royal Menagerie remain live.

## Visual identity

Use a closed, angular helm, weathered iron with warm bronze edges, a short
divided teal cloak, a longsword and a broad asymmetric tower shield. The
eclipse disk is the shared visual motif on the shield, chapterhouse and guild
emblem. Keep the character’s handedness and equipment consistent in every
direction. Simplify the concept’s material detail when producing native sprites.

The October 30 revision replaces the initial octagonal design with a medieval
Gothic stone chapterhouse: a steep slate roof, pointed portal and lancet
windows, a small belfry and faded teal cloth banners. The second tier adds a
carved porch and rose window; the third adds crenellated gate piers. All tiers
share a stable courtyard footprint and native placement metadata.

The prototype has an original portrait, recruitment image and guild emblem.
Shared spells retain their familiar native glyphs and effects. Reuse Majesty’s
interface framing and interaction states. The Palace list uses an opaque, framed 25-by-25 emblem, checked beside stock
entries at native scale.

## Verified source and native requirements

The original package’s Dark_Paladin descriptor borrows image AVF1 and the
dark_paladin_domain descriptor borrows building image BBB3. In the composed
catalogue their actor identities are AV21 and AB21, respectively. Preserve
those identities and existing saves; introduce independently audited image
resources rather than replacing stock Paladin or castle art.

The native AVF1 image has 430 references to 241 distinct non-empty tiles:

| Image set | Native role | Directions | Frames per direction |
| --- | --- | ---: | ---: |
| 1 | Movement set; verify its movement binding before import | 8 | 8 |
| 8 | Stand | 8 | 1 |
| 16 | Attack | 8 | 8 |
| 64 | Special | 8 | 12 |
| 96 | Die | 8 | 16 |
| 128 | Cast | 8 | 8 |

Six further single-frame sets are present: 224, 300, 400, 1000, 1001 and
1002. Recorded examples include a 100-by-100 portrait, a 200-by-245 panel
background and a 25-by-25 small hero image. Frame rectangles vary; one sampled
special frame is 64 by 72. Do not infer a universal cell size from that sample.

The original castle image has 350 image references to 105 distinct non-empty
tiles. Sets96..101 are damage variants; it lacks the placement/construction
sets needed by a buildable guild. The prototype instead uses the standard
ABW1 guild's control/placement metadata, replacing every building, portrait
and emblem tile with original art. No Ranger artwork is retained. Generic
native fire effects and interface framing remain shared resources.

The existing design uses a longsword and plate with Vortex, exploding_aura2
and acid_bolt2. Preserve those gameplay callbacks and prices during the art
prototype. Spell glyphs may express them with the eclipse/bronze/verdigris
identity; no balance changes are implied by the concept.

## Deliverables and preview qualification

The workspace output is `output/more-heroes/dark-paladin/v1/`:

- `concept-board.png`: original hero front/rear studies, chapterhouse,
  portrait and emblem direction, generated with the built-in image_gen tool.
- `concept-prompt.txt`: the exact generation prompt.
- `native-resource-audit.json`: complete source image-set inventory.
- `prototype-manifest.json`: provenance, hashes and explicit incomplete status.

The approved direction now has 424 original hero frames, three construction
and damage states, 42 collapse frames, the portrait, and a native framed
25-pixel emblem. Original articulated geometry supplies consistent eight-way
poses; built-in image_gen supplied the approved concept, portrait and emblem.
The reproducible Blender renderers and native packers live under
`scripts/artwork/` and `scripts/prepare-dark-paladin-*.py`.

The isolated original and Northern Expansion candidates admit only AB21/AV21, with image
identities NDG1/NDH1.
All other retired admissions and random-arrival pools remain disabled. The
source tint repair changes only five `"gray"` constants to `"none"`:20 bytecode
bytes in the expansion script, with Common bytecode identical. The original
campaign port separately adds the two missing actor templates and five
callbacks to Base bytecode; it appends the two actor descriptors, their
projectile and two spell actions to the original campaign catalogs. Existing
catalog records are preserved. Actual petrification, camouflage,
invisibility and illusion precedence remain intact. Old actors can retain
their saved cosmetic tint. An experimental saved-actor refresh caused an
isolated guest exception and was removed; it is not part of the candidate.

The private CGDP recruitment panel reuses the native single-choice guild
controls with its own Dark Paladin caption and icon. Its factory binding is
scoped to the AB2 building family; the stock Dwarf panel remains unchanged.
The guild requires Palace level 2 or 3 in both campaigns.

The bounded original-campaign checks completed construction (1,500 gold),
recruitment (1,200 gold), combat, normal level progression, spell/help display,
and save/reload. With infinite gold and level 1000 enabled, Jupithra saved
and loaded in a fresh engine at level 1000 with 7,936 HP, its portrait and
learned spells intact. All nine pre-existing player save files and the 18
baseline save/config file hashes were preserved. Owned browser engines were
closed after testing. All 424 authored frames passed static resource checks;
all eight directions have not separately been qualified in live play.
Legacy saved-actor cosmetic tint migration remains outside this prototype.

The playable preview is deployed at
https://majesty-9vzgtb0q9-bolander72-01.vercel.app (temporary sharing access is
provided separately). Main production remains unchanged, with Adventurers
Guild and Royal Menagerie active and More Heroes admissions retired.
The preview admits only this redesigned guild; other retired classes remain
blocked and the random-arrival pool remains unchanged.

Preview qualification binds the tested engine, source inputs and 17 changed
resources. Published asset commit:
`9e5596cd1ede743f68189fae7e0a388240745da8` on `codex/assets`.
The deployed engine and resource downloads match the played inputs. The
engine producer reproduces the tested staging inputs without modifying the
existing production qualification policy. Evidence and review screenshots
are in the workspace's `output/more-heroes/dark-paladin/v2/` directory,
including `preview-qualification.json` and `review/`. Host-app crash causes
remain unresolved; these bounded checks do not establish a general fix.

## October 30 medieval, voice and upgrade revision

The guild portrait now fills its native aperture with an original painted
interior: candlelight, Gothic stonework, stained glass and the armored Dark
Paladin holding a sword and eclipse shield. The private panel retains the
native guild controller and uses the stock upgradable temple layout with its
own caption, portrait and member icon. Stock panels remain unchanged.

The original package explicitly bound Dark Paladins to PN01 (stock Paladin)
audio. The candidate binds AV21 to WR01 (the stock male Warrior bank); other
actors and original waveform files remain intact. Existing hero names are
preserved. No new voice recordings are claimed.

AB21 upgrades to new private descriptors AB22 and AB23. Level 2 costs 2,000
gold, has 900 HP and holds four heroes. Level 3 costs 3,000 gold, has 1,200 HP
and holds five. Only AB21 appears as new construction; later tiers are reached
through native upgrades. Both editions include matching GPL prototypes and
NDG1/NDG2/NDG3 artwork with construction, damage and collapse states. Hero
stats, spells and recruitment price remain unchanged.

Old prototype saves lack an upgrade callback. Two shared upgrade dispatchers
now queue native workers directly only for the Dark_Paladin_Domain title,
then return; their existing stock branches remain byte-identical. The original
SDK compiler builds this explicit shared-source delta. The private preview
packager verifies that exact delta and compiler receipt. Production release
qualification policies remain unchanged.

The October 30 preview completed both upgrades from an older level-one save,
then loaded the explicit 12-day checkpoint in a fresh engine at level three
and 1,200 HP. The hero retained level 1000 and maximum HP 7,936. All 22 earlier
native save/config hashes remained unchanged. No guest exceptions appeared
in this bounded verification. Native sprite comparison confirms the correct
level-three artwork after reload. Main production remains unchanged.

Qualification and in-game review images are in
`output/more-heroes/dark-paladin/v3/` in the Majesty workspace. Published asset
commit: `f0c988467ea6a35aa19f9fee3f8573cba8e01e5c`.

## Production release

The production artifact preserves the tested preview's engine and all 56
resource bindings. Its only additional changes update the launcher's engine
cache identities and corresponding immutable routes, ensuring returning
players fetch the qualified engine. A staged production deployment passed
HTTP integrity and isolation-header checks before promotion; the main domain
then passed the same checks. Source builds reproduce that exact artifact.

`deploy/hosted-release.json` remains the historical baseline for the existing
qualification gates. The final active engine and resource delta are pinned by
`deploy/dark-paladin-release.json`, applied after those gates by
`scripts/lib/dark_paladin_release.py`. The installer verifies the complete
baseline and resulting file inventories, original preview qualification and
source hashes, and immutable downloaded payloads. The earlier retirement,
Phantom, capture-cursor and expansion qualification records are preserved.

The source build now includes this release automatically. Production deployment:
`dpl_7pKfZFf2A1FXMtLsFZhfPr4QRrS1`. Live verification is recorded in
`deploy/dark-paladin-production-verification.json`.
