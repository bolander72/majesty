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
