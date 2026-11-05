# Native Majesty cursor in the browser

The browser player uses the original game's `-softwarecursor -nothreadedcursor`
options. Majesty draws its own cursor artwork, animation, hotspot and contextual
states in its normal presented frames. No extracted cursor pack, replacement
artwork, JavaScript animation loop or new engine build is required.

`scripts/build-vercel.py` appends these options to the active game catalogs and
hides the browser pointer only over the ready game canvas. Startup, recovery and
content outside the game canvas retain the browser pointer. Both the root player
and the game deep link receive the same readiness rule. The cursor declaration
uses `!important` because SDL updates the canvas inline cursor style during
focus/pointer changes; an ordinary stylesheet rule loses that cascade.

Muted isolated browser trial cursor1531 verified the original hand in the main
menu, load menu and Palace interface, then the original attack flag cursor with
its amount and invalid-target indicator. The browser's computed canvas cursor
was `none`, eliminating the second browser arrow. The owned browser closed
normally; the resident evidence is cursor1537-native-cursor-qualified.json.
The generated production site independently checks both launch flags and both
player pages. The existing nine hosted-build integrity tests pass.

Rollout audit: no save/profile migration, content reimport, asset upload or WASM
replacement. Existing Alchemist content and engine bindings stay unchanged.
Reloading the page applies the new launch options. Rollback removes the two
options and the ready-canvas pointer rule in a normal site deployment.
