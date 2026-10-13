# The Lost Trail — retired

Retired from the live site on October 13, 2026 at the user's request. This archive and existing player saves are preserved. Do not reactivate this mission, Wayfinders or Trail Lodges without a new explicit user request. Narration work is cancelled.

An original single-player mission for the Wayfinder and Trail Lodge edition.
Complete two Trail Lodges, retain four living Wayfinders, and destroy every
hostile lair while keeping the Palace alive. Buildings under construction,
ruins, dead heroes and unexplored lairs cannot satisfy victory.

The GPL source uses the purchased SDK's ordinary object queries, building
completion predicate, periodic quest thread and native victory function.
The quest has its own stable GUID; keep that identity when revising it so
native saves can identify their content. It does not override stock functions.

Status: qualified native mission and browser content release. Menu selection, briefing, world creation,
paid Lodge construction/recruitment, ordinary saves/reloads and objective
controls are verified. Ordinary campaign victory and persisted native completion
are also verified. Production WASM598 selected the mission, created its world,
wrote an ordinary GMP and restored that exact save in a fresh owned browser.
The root player also restored it through the ordinary profile path, with no
edition selector. `deploy/content-release.json` binds the CDN resources used
by the root deployment. Sustained browser campaign completion is not qualified.

The current GPL source compiled successfully with the original SDK compiler
on October 13, 2026: 9,327 bytes, SHA256
`a4f20b05ce9a09324f5dbc16be485cea3b6f630443a2e12e2c373a8892ec4df7`.
All four functions, including the reserved DOWNLOADABLE_QUEST_2 menu alias,
are present in the exported bytecode. The compiler
exit receipt is zero; Wine could not reopen its diagnostic log, so no complete
compiler-log claim is made. The private artifact and source-bound evidence are
retained locally; bytecode is not committed.

The `.mqxml` is the canonical SDK definition. The private candidate uses the
original Fertile Plain template with a changed initializer and native XQD2
catalog/menu bindings. Geometry and borrowed menu art remain prototypes;
fresh terrain authoring is unfinished. The GPL output comes from the original
`Gplbcc.exe`. Binary resources are hosted separately; none are committed to Git.

Both completed Lodges have 300 HP and four recruitment slots. The first Lodge
costs 900 gold, the second 1800; each Wayfinder costs 425. The ordinary Day18
save has eight living Wayfinders and records clearance of two Dark Castles and
the Animal Den. Four hostile castles still remain. Isolated predicate tests
showed native victory from four indoor heroes/two completed Lodges/no lairs,
and refused victory with three heroes, one completed Lodge or a surviving lair.
These controlled inputs are separate from ordinary campaign progress. The
ordinary campaign later cleared all seven lairs and won on Day29. Native end
statistics recorded 16 recruited heroes, eight survivors at average level9,
2700 gold spent on the two Lodges and 6800 on heroes. A fresh owned profile
restored the saved completion records and displayed The Lost Trail with one
victory and a best time of 29 days. Won-world GMP saving was not established;
the preserved ordinary progress saves and native completion records are
separate artifacts.

SDK content requires `RECOMP_RULE_INVENTORY_COMPAT=1` for the existing real
legacy inventory bridge. Current source-bound evidence and continuation details
are in [the authoring guide](../../docs/native-quest-authoring.md).

The intended map is a medium northern forest with one Palace, a viable starter
economy and several hostile lairs separated from the starting settlement.
Balance and rewards will be adjusted from actual play. Co-op is not offered
by this mission until its shared objectives and matching content are verified.

Compile from a separate private directory containing these source files:

```text
Gplbcc.exe -in TheLostTrail.gplproj -out TheLostTrail.bcd -stdout
```

## SDK map authoring checkpoint

The unchanged original RGS editor now opens with private app-local VC2008 x86
runtime files. It created and saved an initial Northern Expansion template at
256×256 with test seed 54321. The `town` unit pattern contains Palace (ABJ1),
Marketplace (ABH1) and Blacksmith (ABC1), at five-tile grid spacing. The SDK-written
465-byte `.q` was exported and independently checksum-verified:
`4d8b0b213310f0f378df4959f71b8991be527e064d05585dfc4011b6767598c6`.
The binary remains private; `map-checkpoint.json` records the authoring state.

This is a saved unit-pattern template, not a generated or playable mission map.
Later force/terrain edits were not exported and must be repeated from the saved
checkpoint. The generated SDK project has a temporary private GUID and default
presentation text; canonical quest identity, descriptions and resource bindings
remain in this source draft and must be reconciled before game installation.
The compiler-proven mission source has not yet been attached to this template.

An isolated resume package with both matching exported files has been prepared
and inspected in `output/mission545-editor`. The original compiler is included.
See `docs/native-quest-authoring.md` for staging and resume precautions. Nothing
from this authoring checkpoint is installed on the public game.
