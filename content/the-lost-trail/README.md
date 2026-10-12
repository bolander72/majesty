# The Lost Trail

An original single-player mission for the Wayfinder and Trail Lodge edition.
Complete two Trail Lodges, retain four living Wayfinders, and destroy every
hostile lair while keeping the Palace alive. Buildings under construction,
ruins, dead heroes and unexplored lairs cannot satisfy victory.

The GPL source uses the purchased SDK's ordinary object queries, building
completion predicate, periodic quest thread and native victory function.
The quest has its own stable GUID; keep that identity when revising it so
native saves can identify their content. It does not override stock functions.

Status: authoring draft. The `.mqxml` is an SDK definition, not evidence that
the pinned DirectDraw executable can list or load it. `Quests/TheLostTrail.q`
must be generated with the official RGS Editor, and the GPL must compile with
the official `Gplbcc.exe`. Both resources remain private outputs, outside Git.
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
