# The Lost Trail

An original single-player mission for the Wayfinder and Trail Lodge edition.
Complete two Trail Lodges, retain four living Wayfinders, and destroy every
hostile lair while keeping the Palace alive. Buildings under construction,
ruins, dead heroes and unexplored lairs cannot satisfy victory.

The GPL source uses the purchased SDK's ordinary object queries, building
completion predicate, periodic quest thread and native victory function.
The quest has its own stable GUID; keep that identity when revising it so
native saves can identify their content. It does not override stock functions.

Status: official GPL compilation and initial SDK template export verified;
complete map and native quest integration pending.
The current GPL source compiled successfully with the original SDK compiler
on October 12, 2026: 8,583 bytes, SHA256
`5c7df3fbad3afc5ad37c96b3e5df5c1d36530b16e4eca299f7f5f458462061de`.
All three mission functions are present in the exported bytecode. The compiler
exit receipt is zero; Wine could not reopen its diagnostic log, so no complete
compiler-log claim is made. The private artifact and source-bound evidence are
retained locally; bytecode is not committed.

The `.mqxml` is an SDK definition, not evidence that the pinned DirectDraw
executable can list or load it. `Quests/TheLostTrail.q`
must be generated with the official RGS Editor. The GPL output was generated
with the official `Gplbcc.exe`. Both resources remain private outputs, outside Git.
Map generation, native menu integration, complete gameplay, save/reload and
victory remain unqualified. This draft is not installed on the public site.

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
