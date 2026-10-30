# Dark Paladin's Guild: original-art integration

Current status: released on October 30, 2026 at https://majesty.boland.co/.
The redesigned Dark Paladin is the only reintroduced More Heroes guild.
Adventurers Guild and Royal Menagerie remain active; the other classes remain
retired. Dark Paladin's Guild becomes available at Palace level 2. The
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

## Native tier presentation corrections

Mike requested explicit level names and stock-equivalent upgrade behavior.
The base entry retains `Dark Paladin's Domain`, following stock level-one
naming. Higher tiers use `Dark Paladin Level 2` and `Dark Paladin Level 3`
in the narrow building list; the guild panel retains the full Domain name.
Both native description headers and display-name tables carry the tier labels;
internal actor names, engine bindings and game attributes remain unchanged. An upgrade begins
with the completed previous tier visible, rather than showing the initial
construction foundation. The late construction stage reveals the enlarged
target structure. New construction still uses the original foundation stages.

The revised second tier adds a substantial attached bell tower and side
gallery. The third preserves that architecture and adds two large crenellated
gate towers and an arched fortified entry. The original hall and courtyard
remain in place. These requirements are recorded in the art-direction brief
and persistent workspace instructions for future guilds.


The follow-up native review completed levels 2 and 3 from the existing
level-one checkpoint, confirmed the previous building remains visible during
both upgrades, and reloaded the existing 12-day level-three checkpoint with
the expanded architecture. All 15 existing GMP checkpoint hashes were
preserved; normal quest victory updated the owned test profile's progress and
high scores. The bounded trial reported no guest exceptions. The normal
Palace menu shows the base entry, while upgrade-only tiers retain native
filtering; higher labels were checked in world text and both native name and
description tables.

This correction is pinned by `deploy/dark-paladin-tier-release.json` and
qualified by `deploy/dark-paladin-tier-verification.json`. Its final overlay
changes three resource-binding files and eight native resource archives,
retaining the engine, gameplay scripts and actor attributes. A clean source
build reproduced all 149 production artifact files exactly. Native asset
commit: `7a177a31363ea700439f876223620a0e91814d7d`. Binding commit:
`1881fd8354675cbbcfa9306124918ef8d5dbde7e`. Native review images are in the
workspace's `output/more-heroes/dark-paladin/v4/review/`.

The corrected tier presentation is live on https://majesty.boland.co/ in
production deployment `dpl_HpChsK8RGTTCRZ2Z9eyQ5Do24vLk`. Staged and public
HTTP checks matched the reviewed artifact, including resource bindings,
unchanged engine bytes and browser isolation headers. The public receipt is
`deploy/dark-paladin-tier-production-verification.json`.

## Textured replacement and matching hero direction

After reviewing the live world sprite beside the marketplace and zoo, Mike
approved the generated textured chapterhouse study as a substantially better
visual direction and requested a matching hero redesign. This supersedes the
earlier live building as the world-art benchmark. The reference package is
`output/more-heroes/dark-paladin/v5-style-study/` in the workspace; the new
matching hero board and exact image-generation prompt are in
`output/more-heroes/dark-paladin/v6-hero-redesign/`. Both were created with the
built-in image_gen tool. The hero board is a design reference awaiting native
animation production and user review; neither package is installed game art.
Carry the shared textured medieval treatment through every building tier and
state, hero direction and action, and corresponding native UI image. Retain
working upgrades, labels, male audio and save compatibility. The full shared
standard is in `docs/more-heroes-art-direction.md`.


## Native textured guild and hero completion

The approved reference direction now has an original deterministic native
renderer in `scripts/artwork/dark_paladin_textured.py`. It supplies fine
weathered masonry, overlapping slate courses, recessed galleries and timber
gates across cumulative levels 1–3, matching initial construction, three
damage states per tier and 42 collapse frames per tier. The hero's entire
424-frame directional animation set has forged rounded armor, visible mail,
folded teal cloth, a heater shield and matching guild heraldry. A new painted
portrait supplies the 100-pixel and small native hero UI images. The native
25-pixel Palace emblem and guild-panel painted interior retain their existing
framing. The editable renderer and final native assets are saved in the
workspace's `output/more-heroes/dark-paladin/v7-native-textured/` package.

Testing exposed an existing panel mismatch: CGDP borrowed AP05 resources but
uses the AP06 single-choice guild controller. Its copied Spells widget (1009)
had no handler, producing a null-call access violation at return 004168fc.
`scripts/lib/dark_paladin_panel_safety.py` removes only that complete private
widget and centers the native Heroes control as in AP06. Stock AP05/AP06
records remain unchanged. The same correction is applied to all four native
text archives. No engine, actor attributes, voice bindings or gameplay scripts
change. Tier labels and additive upgrade-frame bindings remain intact.

Native art is packed by the existing `prepare-dark-paladin-art.py`, followed
by the frozen tier-presentation pass and the scoped panel-safety helper. The
final source build applies `deploy/dark-paladin-textured-release.json` after
the existing qualified releases. Its installer verifies native qualification,
source hashes, immutable payloads, and full before/after artifact inventories.
Historical release inputs and qualification receipts remain unchanged.


Final native verification completed both upgrades at 900/1,200 maximum HP,
reviewed fresh construction beside the stock palace/house, exercised the
working Heroes control and the former spell-button area, and inspected the
saved hero in combat with its matching portrait. A separate bounded session
loaded the exact older 12-day checkpoint at guild level three and hero level
1000 (maximum HP 7,936), with no runtime errors. All 15 existing GMP checkpoint
hashes were preserved. The owned quest victory updated normal profile progress;
no save command was issued. Every owned browser and local test server was
closed. The earlier unsupported-button failure and the subsequent deadline
stop are recorded in `deploy/dark-paladin-textured-verification.json`.

All 149 production files reproduced exactly from the source build. The staged
production artifact passed HTTP integrity and isolation-header checks before
promotion, and the public main site passed the same checks afterward. The
release is live at https://majesty.boland.co/ in deployment
`dpl_5WpW4oU7GH5kgc3GLKUGBxC7Xf2f`. Native asset commit:
`9de36ed8662eefea32e653eca7537f1e42a55ecd`; binding commit:
`0277a5093804f070d4f7d39417b7b72bd6886fcd`. Public verification is recorded in
`deploy/dark-paladin-textured-production-verification.json`. Other retired
More Heroes admissions remain disabled.


## Guild naming, solid heroes, visible works and native scale

Mike's follow-up requests replace the displayed Domain name with the literal
Dark Paladin's Guild name, including full Level 2 and Level 3 suffixes. Legacy
internal identifiers and the AB21/AB22/AB23 actor family remain stable.
`scripts/lib/dark_paladin_guild_presentation.py` updates native names, descriptor
headings and panel/help text without changing actor attributes or callbacks.

The new original renderer is `scripts/artwork/dark_paladin_guild.py`. It leaves
shin/boot silhouettes visible with shorter cloth hems and solid thicker leg
armor. The native packer keeps opaque hero RGB values above the RGB565 zero
key, preserves the silhouette mask and checks every packed hero frame. These
changes also apply to newly recruited heroes, as Mike explicitly confirmed
that they showed the reported issue. A scoped normal-decision-entry repair
clears class-default cosmetic effects only when no petrification, camouflage,
invisibility or illusion effect is active. It changes only
Dark_Paladin_tree_mh in each campaign source; the shared library is identical.
It uses ordinary GPL builtins and the original SDK compiler, without the
experimental native saved-actor callback used in the earlier prototype.

Completed native guild images now measure 248x208, 278x217 and 308x224 pixels,
compared with 182x153 at all three prior tiers. Stock Temple to Dauros images
measure 268x183, 261x197 and 278x222. Connected side/rear wings and enlarged
courtyards extend the pictured footprint while preserving earlier structures.
All tiers fit within the existing native placement reservation; actor/collision
attributes remain unchanged. Both upgrade paths have three independently
packed frames with standing earlier architecture, timber posts, platforms,
diagonal braces and ladders. The frozen additive-only mapping is deliberately
not applied to these new scaffold frames.

The native producer is `scripts/prepare-dark-paladin-guild-presentation.py`;
its 12 resources cover eight art/name archives and the two campaign bytecode
libraries in both edition folders. Gameplay attributes, recruitment,
capacities, prices, voice bindings and the single-player engine remain intact.
The complete editable/rendered package is in the workspace at
`output/more-heroes/dark-paladin/v8-guild-progression/`.

The Guild correction is live at https://majesty.boland.co/ in deployment
`dpl_4fExp961u9YE3sWoyjsZsGnFhTHG`. Native checks recruited a new hero,
reviewed its visible legs/boots outdoors at level 2, showed scaffolded work on
both upgrade paths and loaded the older 12-day level-three checkpoint with
1,200 maximum building HP and the saved level-1000 hero. Selection of the new
outer fortification returned the Guild panel correctly. The final reload
reported no runtime errors; all 15 existing GMP checkpoint hashes were
preserved. Resource/deadline guard stops and cleanup are recorded in
`deploy/dark-paladin-guild-verification.json`. Every owned browser and local
server was closed.

The original SDK compiler qualified all source definitions; the shared BCD
library remained identical. 18 focused Dark Paladin tests and 12 Vercel source
build tests passed. The clean source build reproduced all 149 production
files. All 12 published resource hashes, staged HTTP files and public main
files passed integrity verification. Public verification is recorded in
`deploy/dark-paladin-guild-production-verification.json`.
