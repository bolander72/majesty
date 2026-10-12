# Quest Background overlap

Open defect reported October 12, 2026. The published browser engine can leave
the quest-map bitmap over a quest's Background text and controls. Reproduced
on **Quest for the Holy Chalice**, independently of the user's screenshot of
**The Bell, the Book, and the Candle**.

Engine: `e47728d4ca0655abfb340c935ca322a527660bb6f5bac3c5332375ff4a7c5cdf`.
Public deployment: `dpl_D49YypGxeBn3eCDfGtJbfdLSG4pv`.

Reproduction uses a muted owned Chrome, cached original assets and a fresh
isolated save profile. Enter Play Game, accept a player name, dismiss the
Select A Quest help, and select the Holy Chalice marker. The map remains over
the Background panel. It reproduces both at 1280×633 (trial412) and on a clean
800×600 launch (trial413). No restored co-op campaign is involved.

Changing the viewport after the overlap forces a native surface rebuild and
removes the stray map. This narrows the investigation to transition drawing,
surface contents or presentation. It does not prove which component caused
the defect, establish correct text wrapping, or qualify a permanent fix.
Keeping the original menu size is insufficient: the clean800×600 control
still overlaps. Avoid publishing a resolution-only workaround as a fix.

Private evidence is `output/ui412-reproduction.json`. Screenshots:

- `output/ui411-user.png`: converted user screenshot.
- `output/ui412-info.png`: independent1280×633 reproduction.
- `output/ui413-info.png`: clean800×600 reproduction.
- `output/ui412-info-800-final.png`: redraw following a native surface rebuild.

The native adapter and resident game/runtime source inputs match the published
WASM298 receipt. `globals.toml` and `runtime/imports.h` are cloud placeholders
and were not re-read or claimed verified in that comparison. Generated
translations were inspected as evidence only; none were edited.

Next gate: identify the incorrect bitmap/region across this transition,
implement a focused fix, then verify readable Background text and working
Continue/Back controls at both original and responsive sizes. Verify entry
into gameplay separately. Current evidence does **not** establish that fix,
mission completion, or a host-app crash repair. All owned trials are closed.

This UI defect takes priority over publishing The Lost Trail mission. Keep
the mission draft and compiler staging; the compiler has not run for that
draft and its new map has not been authored. The user deferred the older
Chapter3 co-op completion loop in favor of new content.
