# Official SDK quest authoring

The original 32-bit `Gplbcc.exe` compiled The Lost Trail source successfully in
private trial518. The output is 8,583 bytes with exit0 and all three mission
functions present. Its bytecode remains under ignored output; compilation does
not establish native game integration or victory.

## Editor runtime

The original `RGSeditor.exe` initially failed because `mfc90.dll` was absent.
The [official Microsoft VC2008 x86 security-update package](https://www.microsoft.com/en-us/download/details.aspx?id=26368)
was downloaded from Microsoft's page-selected URL. Its SHA256 is
`8742bcbf24ef328a72d2a27b693cc7071e38d3bb4b9b44dec42aa3d2c8d61d92`.
The CAB was extracted with a checksum-verified standalone cabextract bottle;
no host Windows/Wine runtime was installed. The helper pins seven DLLs and two
manifests from that package and puts them alongside the unmodified editor in
its private memory filesystem.

`prepare-native-quest-editor.py` validates the qualified SDK runtime and original
editor, resolves the dataset loader dependencies and stages the original GPL
compiler, and optionally stages a previously exported project/template pair.
Purchased assets, Microsoft DLLs, bytecode and binary templates stay out of Git
and out of the public website. The actual editor hash is
`ab8cafe411372d9ff86b6a95e2a2087836b7e01891818af90c1e605fb7d121ef`.

Wine still logs activation-context version and unsupported-service warnings.
Do not report those as repaired: editor opening and serialization are the
verified scope. Trial542 became unresponsive during text input; trial543 proved
creation/saving through mouse input and individual physical key presses. Generic
`keyboard type` did not enter text into the legacy editor. Focus the native
field explicitly and use individual `press` commands; avoid unqualified shortcut
sequences such as Control+A. Preserve the isolated browser launch config and
mute audio on every command.

## Resume the saved authoring state

A ready private package exists at `output/mission545-editor`. To create another
from the matching, unchanged exported files:

```sh
python3 scripts/prepare-native-quest-editor.py \
  --runtime output/mission517-compiler \
  --output output/NEW-editor \
  --mfc-payload output/mission540-mfc/payload \
  --resume-project output/mission544-TheLostTrail.mqxml \
  --resume-template output/mission544-TheLostTrail.q
```

Use the returned direct editor launch query, press Start, then File → Open to
select `thelosttrail.mqxml` in the SDK directory. The resume ZIP was inspected:
both exported files remain byte-identical and the original compiler hash matches
`8cfbf6fff1cf90d7aaf334392352515eb0f989a35a16bc99f225e52af38820c4`.
This is package validation, not a live resume claim.

The package uses memory-only guest storage. Save through the editor and export
both the `.mqxml` and `.q` early after each major authoring step. A successful
Save is insufficient until the exported files have been downloaded and verified
outside the emulator. Do not begin another complex dialog sequence near the
owned trial's input/save deadline. Always close the owned emulator afterward.

## Current checkpoint and next work

Trial544 exported a 465-byte SDK-generated template containing the `town` unit
pattern: Palace, Marketplace and Blacksmith, with the Northern Expansion data
set, 256×256 size and seed 54321. Evidence is `output/mission544-result.json` and
the source record is `content/the-lost-trail/map-checkpoint.json`. The peak owned
browser RSS was approximately 1,703 MiB; the browser was closed afterward.

The saved template still needs a force pattern that places the town and assigns
player ownership, valid default terrain/landscape patches, hostile lairs and
starter economy settings. Unsaved later force/region work was not exported.
Preserve the canonical source GUID when reconciling the editor project with the
mission resource manifest, then bind the compiled GPL and Wayfinder resources.
Verify the map in the game, objective progression, original saves/reloads and
victory before publication. Existing missions, player profiles and public release
538 are unchanged by these authoring steps.

## October 13 continuation

The private mission549 checkpoint now contains the town force pattern, Epic
Quest type and a single-player 256×256 layout. Its `.q` is 558 bytes, SHA256
`8286e5eef5d62d5d6faaa19cdc1a2e3a76ed50f64c61ec5099037ee12402fb09`.
It remains a draft, not a playable map. Original checkpoint544 is preserved.

Use `--map-assets-only` for bounded editor trials. This optional private loader
removes seven audio/cinematic CAM references and their 322 MiB of inputs, while
retaining map art, unit types, terrain, constants, scripts and sound descriptions.
Purchased files on disk are unchanged; the staged XML loader is intentionally
filtered, with original/staged hashes and omitted references recorded in
`stage.json`. The default mode preserves the original XML bytes. This option
affects the editor package only, not native gameplay or production assets.

A resumed package can use `stage.json`'s `resumeLaunchQuery`, which runs the
unchanged official editor with its saved document filename through a private
batch file. Wait until the staged SDK files are readable in the emulator FS
before pressing Start; the harness initialization can reset an earlier click.
Trial610 directly opened the original project with the filtered dataset and
peaked at about 2,119 MiB of owned browser RSS, then closed normally. Trial604
with the full dataset hit the resource guard and was closed; this is not a
claim that all editor operations have bounded memory use.

Region confirmation remains unresponsive in trials602/610, including the latter
with a nonzero seed control and Project View selected. No new terrain export
was verified. Avoid repeating that same sequence without new evidence. The
next baseline is an existing valid official RGS template with its complete
dependencies, followed by mission-specific edits and native game validation.
`output/mission611-template-audit.json` records original template identities:
many classic quests use `RGM6`, whereas original Freestyle, expansion Freestyle
and the SDK examples use `RGMa`. Do not infer compatibility from the suffix.
The canonical mission GUID and compiler-proven GPL remain unchanged.

## Native legacy integration candidate637

The unchanged expansion Freestyle template rendered successfully in the official
editor in trial614 (about 2,140 MiB peak owned RSS). This establishes that map
rendering works in this runtime; it does not qualify the unsaved force edits or
the fresh Lost Trail terrain definition.

The pinned DirectDraw executable reads `.q` templates and `.qdd` descriptions.
Its native quest manager at `004cfb20` registers 34 known names; `004d1be0` maps
them to native IDs, with unknown names passed to `004e5ed0`'s four-character
conversion. Reserved `DOWNLOADABLE_QUEST_2` maps to `XQD2` at instruction
`004cfd0a`, and the third reserved entry maps to `XQD3` at `004cfd14`. The second
slot is the Lost Trail candidate's legacy bridge; the existing XQD1 mission and
all stock quest files remain intact. Canonical SDK GUID/name remain unchanged.

The original GPL compiler compiled the added `DOWNLOADABLE_QUEST_2` alias,
which delegates to `TheLostTrail`. New output is 9,154 bytes, SHA256
`66b6d4ab64f5e0f6c89ec5366c2ffab4ead81451a5de260231c0a24ff1a357cd`.
The exported container and four function names were checked independently.
The compiler can return 0 on a syntax error; require fresh bytecode/container
verification as well as its exit receipt. Earlier failed alias attempt632
produced no qualified bytecode and is preserved separately.

`prepare-lost-trail-native.py` stages separate private files, validates their
compiler/source bindings, preserves the RGS payload after its initialization
name, adds independent XQD2 availability, and appends mission bytecode after
Wayfinder in all supported load groups. It uses the original Fertile Plain
template as a temporary gameplay baseline, not newly authored terrain. New
terrain, balance, selection, gameplay objectives, saves and victory remain
unqualified. Candidate `output/mission635-native-candidate` is not published.

Native engine534 (hash `4c42a37ed90648fb8e46969694757994af40d8d82f6b01e7f63d0c90eeb2c0d5`)
read the candidate scripts, template and descriptions and reached its home and
quest-selection screens. Trials618/620/623/624/627/636 exited normally with
owned RSS below 159 MiB. This older native test executable is distinct from
production WASM598. Trial617's overly verbose file-read trace hit the log guard
and was closed; later trials used the bounded file-open trace.

At checkpoint 637 the selector still showed the stock markers. The central question mark was
verified as the stock Secret Quest, not Lost Trail. The next task is to connect
the reserved XQD2 entry's native menu widget/title resources, then select it and
verify original world creation, paid Lodge/Wayfinder recruitment, objectives,
save/reload and victory. Avoid repeating map-editor confirmation or generic
hover scans without new evidence. Private checkpoint:
`output/mission637-continuation-checkpoint.json`.

### Reserved native menu entry and first world, October 13

The purchased expansion `SMNU/AP30` already contains XQD2's marker 4032 and
trigger 4132. The marker rectangle starts at 1201,369 on its large scrolling map;
it is outside the initial southern view. Native `0044eda0` makes both controls
visible when `004d1710` finds the registered template. Native `004d2e00`,
`004d30b0` and `004d31b0` request separate IXD2/IXR2/IXS2 image resources.
The trigger uses DX32. These images are absent from the stock installation.

`scripts/lib/lost_trail_menu.py` prepares a private clone of purchased XQD1 art
under those four unused image IDs. Only directory identities change; all image
and numeric TILE entries/payloads remain intact. Section mode 1 is not evidence
of compression: this archive's TILE directory has numeric keys. This inherited
art is a prototype, not newly authored mission artwork. All stock widgets and
the original XQD1 archive remain unchanged. Earlier resolution/base-menu
override experiments 643/645 were unnecessary and removed from the test mirror.

AP30's string 2 names its reserved control, but the visible quest heading comes
from `STRT/QUES`, keyed by native quest IDs. Original `004d1390` requests
QUES/XQD2. The private candidate changes only that name to The Lost Trail and
preserves all other quest identities/names. It stages the installation's Data
and DataMX aliases together. Canonical SDK GUID and compiled initializer stay
unchanged. The staging helper still requires independently verified official
GPL output and never installs or publishes its candidates.

Native trial 654 selected the reserved entry, displayed the authored background
and goals under the correct heading, and entered an original Palace world.
Trial 655 used the ordinary Options/Save Game interface to create a 318,590-byte
GMP (SHA256 `4e172882d626b57a51da6d34d63cee0af4b5ea594077870cfe3b228a8af949ab`).
Its serialized state includes LostTrailVictory. Trials 656/658 restored it in
fresh owned profiles, retaining the title, Palace world and 40,000 gold. These
checks do not establish paid Lodge/Wayfinder persistence, objective completion
or victory. Terrain still uses the unchanged Fertile Plain baseline.

Candidate `output/mission653-native-candidate` and qualification receipt
`output/mission657-selection-world-qualified.json` remain private. Eight focused
tests cover preserved template bytes/load ordering, safe descriptions, distinct
quest availability, unrelated menu strings, numeric artwork entries/payloads,
and other campaigns' heading identities. Production WASM598 is unchanged.

Trial 658 restored the initial world and selected its Palace through ordinary
input. Trials 660/661/664 located Trail Lodge in the construction menu at
900 gold. Trial 660 selected the wrong list row; later trials selected Lodge
but their previews stayed red and the placement clicks did not deduct its
price. These runs do not qualify construction. Saves containing a pending
placement ghost are not completed-building checkpoints. Resume the original
trial 655 world save for the next placement/construction test, preserving it.
Then verify paid Wayfinder recruitment, building/hero save persistence,
negative objective cases and actual victory. Current private continuation:
`output/mission666-continuation-checkpoint.json`.

### Paid construction, recruitment and preserved progress

Trial 671 produced the original “Can't build on top of other units or
buildings” message. No construction-rule patch was needed. Twelve discrete
DOWN key presses moved the view to clear southern ground; trial 672 placed
Trail Lodge at screen 530,350 for 900 gold. Peasants built it normally, and
trial 674 showed its completed tents. Trial 676 selected its own interface
at 300/300 HP and recruited a Wayfinder for 425 gold. Trials 678/680 filled the
first Lodge's four hero slots through paid recruitment and preserved the
original save/reload path. Trial 682 placed the second Lodge for 1800 gold;
trials 688/691 continued construction and selected its completed 300/300 HP
interface, recruiting two more Wayfinders there. These are ordinary gameplay
actions; no fixtures spawned the buildings or heroes.

A save-selection mistake initially bound receipt 677 to an unchanged copied
Day1 input. It was corrected to the actual generated Day2 output. The saved
inputs remain intact. `scripts/lib/native_trial_saves.py` now selects exactly
one changed/generated GMP by excluding input hashes, refusing ambiguous
outputs, unowned directories and linked saves. Three regression tests cover
copied inputs sorting first, updated same-name saves, ambiguity and ownership.
Together with the eight mission-resource checks, eleven focused tests pass.

The Day4 second-Lodge save failed on the older native engine without inventory
compatibility. Bounded trace 687 identified the stock hero-death chain:
gravestone -> Hero_Drop_Immediate_Items -> Drop_Immediate_Items -> missing
GetInventoryItems/NullFunction -> GplNull converted to list&. This was not the
mission's victory function. Existing `RECOMP_RULE_INVENTORY_COMPAT=1` registered
the real legacy inventory bridge; trial 688 resumed that same saved world for
70 seconds, exited normally and created a new Day5 save. No mission GPL or
native implementation was changed for this failure. The private candidate
receipt now declares the required runtime environment explicitly.

Current private candidate: `output/mission689-native-candidate`. Gameplay
evidence: `output/mission694-gameplay-qualified.json`. Resume only the exact
generated save in `output/mission692-latest-generated-save.json`, with inventory
compatibility enabled. Live hero/building counts, isolated negative objective
cases, hostile-lair clearance and actual victory remain unfinished. Review
global visibility and heroes inside buildings against the SDK's ListObjects
modifiers before declaring that the objective counts every living Wayfinder.
Neither inherited terrain/artwork nor these partial checks establish a new
published playable mission. Production WASM598 remains unchanged. Current
continuation: `output/mission693-continuation-checkpoint.json`.

### Whole-kingdom objectives and existing save compatibility

The exact generated Day6 save contained two completed 300-HP Lodges and five
living Wayfinders; four heroes were inside their Lodges. The official GPL
reference's ListObjects entry specifies `#NoHiddenMap` for all objects and
`#InsideOtherUnits` for heroes inside buildings. The previous hero query could
therefore exclude resting heroes. Both owned building/hero queries now search
the entire kingdom, and the hero query includes building occupants. Ownership,
living checks, completed construction and the hostile-lair requirement remain.

Original SDK trial696 compiled the revised canonical source to 9,327 bytes,
SHA256 `a4f20b05ce9a09324f5dbc16be485cea3b6f630443a2e12e2c373a8892ec4df7`.
The four function identities, XQD2 alias and mission GUID are unchanged.
Private candidate698 validates the fresh source/compiler bindings. Trial700
loaded that bytecode and resumed the unchanged Day6 input normally, then saved
through the original interface. The generated output had five living heroes
inside buildings, both completed Lodges, seven hostile lairs and a false
Quest_Flag_9. Trial702 restored that output normally and saved again. These
checks establish continuation compatibility and a still-pending quest; they
do not independently witness every GPL query result or qualify final victory.

`scripts/inspect-lost-trail-save.mjs` reads an owned stopped GMP using the
existing bounded native parsers. It binds exact size/hash, requires the original
quest root and LostTrailVictory context, and checks original unit HP, death
flags, ownership, completion and parent relationships. It includes indoor
actors and reports the persisted victory flag. Incorrect input hashes are
refused without writing a report. This is a state audit, not a replacement for
native execution or ordinary gameplay qualification.

Combat controls: click the minimap at 123,122 to center the nearby Dark Castle,
then world 520,300 selects it. The purple button at 193,155 selects the Palace;
Palace Rewards is 150,385. Its attack-reward plus button is 173,281, increments
100 gold, and ten discrete clicks set 1000. Click ATTACK flag at 100,242, then
world 520,300 to place the paid bounty. The yellow button at 166,414 in a lair
interface only tracks the lair; right-clicking it clears selection. Trials
704/705/707 were control exploration forks and did not create progress saves.

Trial709 deducted 1000 gold and placed the ordinary attack flag on lair524.
After 60 seconds of ordinary play its HP decreased from 800 to 731. The
generated Day8 save retained reward unit1445, owned by player0 and parented to
that exact lair. Four Wayfinders remained alive, two resting inside Lodges;
both Lodges remained completed and all seven lairs still lived. The victory
flag remained false. This qualifies paid flag placement and partial combat
progress, not clearance or victory. Resume the exact save bound by
`output/mission710-attack-generated-save.json`, with trial709's owned settings
and inventory compatibility enabled. Preserve the earlier Day6/Day8 inputs.
Current continuation: `output/mission713-continuation-checkpoint.json`.

### Native objective controls and ordinary lair clearance

Private controls718 copy the exact generated Day6 input, retaining its native
chunk/agent structure. Only original typed HP/death/completion fields change;
the source save remains untouched. They are marked controlled inputs and must
never replace ordinary campaign checkpoints. Trial720 reached the original
“You are victorious” dialog from four living indoor Wayfinders, two completed
Lodges and no living hostile lairs. Trials721/722/723 refused victory with,
respectively, three heroes, one completed Lodge, and one living hostile lair.
Their ordinary saved outputs preserve the other required counts and false
Quest_Flag_9. This proves the threshold branches through native execution;
it is not an exact scalar query-return trace or ordinary full-match completion.
Evidence: `output/mission725-objective-controls-qualified.json`.

The separate ordinary campaign resumed Day8, paid for replacement recruits and
continued its 1000-gold attack bounty. Trial715 destroyed lair524; trial717
destroyed lair522. Trial724 destroyed Animal Den518 and placed a northwest
exploration bounty (600 gold observed). Trial727 cleared northeastern lair520,
and trial729 cleared northwestern lair525. The original generated Day24 save
retains eight living Wayfinders, both completed 300-HP Lodges and the two
remaining 800-HP castles519/526. No fixtures or victory cheats generated this
campaign progress. Exact current receipt:
`output/mission730-campaign-generated-save.json`.

The northern map edge needs a different screen target: after minimap23,4,
castle519 is near world560,170; world520,300 targets the lower castle or empty
ground. Northeastern castle526 is selected from minimap150,60 at world520,300.
Once a castle is revealed, place its attack flag directly. Trial727's combined
attack/explore attempts did not leave a bounty on castle526. Trial731 resumes the exact
Day24 input with just those two attack bounties. Source README now describes
the current private qualification rather than the obsolete compilation-only
status. Production WASM598 and all public game assets remain unchanged.

Trial731 cleared castle519, leaving only526. Repeated pointer resets at the top
left pan the camera. Trial733 used relative moves through the Palace/Rewards
interface and placed the final bounty at world440,360 after minimap150,60.
It cleared the last castle and reached the original “You are victorious”
dialog on Day29. The complete ordinary progress chain is bound by
`output/mission735-ordinary-victory-qualified.json`. No controlled inputs,
fixture spawns or victory cheats were used in that chain.

Trials734/738 replayed the exact Day28 input and original final assault, then
acknowledged victory. End Game Statistics showed 16 recruits, eight killed,
eight alive, average hero level9, building spend2700 and hero spend6800.
The owned profile wrote native `questdata_majx.sav` and `hiscores.sav`.
Trial741 copied those owned records to a fresh owned profile; the ordinary
quest selector displayed The Lost Trail, Victories1, Best Time29 Days. This
qualifies persisted native completion. Difficulty is displayed as Advanced;
the dependency rule's MEDM token is not evidence of a Medium difficulty label.

The end-game acknowledgement advances to statistics after a delay. Continue
Playing returned to the town, but the attempted later Save Game did not produce
a changed GMP. Do not bind an unchanged copied Day28 input as a won-world save.
Original progress save/reload and native profile completion are proved
separately. Browser mission integration and publication remain unfinished.
