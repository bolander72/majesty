# Binding a paused hero save to a crossing request

Selected-owner startup accepts the optional `hero-layout=halo-v1` bootstrap
parameter. It verifies the actual leased journal owner's MAP/MTER before
reading or creating native checkpoint slots. The receipt includes the checked
layout. Ordinary hero restoration continues to permit existing maps without
assigning them halo geometry. Missing terrain, legacy origins, incompatible
dimensions and damaged protected heights refuse before any native write.
Unsupported/duplicate layout settings and a layout without owner restoration
refuse before profile access. Ready consumes this bootstrap parameter; the
recovery link restores it and the menu link removes it.

This parameter requests geometry preflight and now supplies the checked
capsule for [native movement sampling](hero-native-crossing.md). It never
issues a movement order or exposes the unfinished neighbor controls.

`queueNativeHeroGameSave(world, serial, {crossing})` can accept an explicit
crossing only after the prepared receipt contains the checked halo layout.
The request consists of exactly nine fields: serial, source region, target,
previous clock, accepted clock, native unit/agent IDs and previous/accepted
signed Q11 positions. It must match the prepared owner and next save serial,
advance the original simulation clock and cross one cardinal ownership edge
with the footprint inside both physical maps. Values are copied and frozen
before asynchronous I/O; arbitrary payloads cannot accumulate in the token.
Invalid requests do not consume a serial.

The live publisher checks the held save clock against the crossing. Before
writing custody it checks the actual original SVGD, UNIT/GPL association,
description, player, life state, physical parent and serialized placement.
The living hero must be outdoors and every fractional position word, including
height, must equal the requested accepted pose. Actual source terrain must
still pass halo admission. The publisher returns bounded crossing/geometry
receipts; it never moves, retires or imports the actor.

The subsequent held neighbor read can admit only that crossing's target and
returns the same verified receipt. It preserves the native/custody manifests
and the game's existing exclusive world lease. Crossings do not authorize a
second engine, native file edits or arbitrary regional reads. Cancellation
checks surround each asynchronous metadata read and drain pending I/O.

The previous pose remains a supplied request to this service. The production
native sampler now produces it around an original tick and requests capture
at the accepted clock. That path has actual native outdoor movement evidence
and controlled JS crossing/hold tests; an actual native boundary crossing is
still unqualified. The JS checks prove agreement with a saved snapshot.
Retirement,
source unload, destination load/generation, actor import, collision activation
and atomic ownership publication remain unfinished.

## Verification

`output/hero-travel-boundary-regression-002.log` records218 passing tests,
zero failures/skips. Cases cover all cardinal directions and signed regions,
fractional coordinates, wrong identity/clock/position, interior and diagonal
motion, dead/attached actors, changing caller data, stale target requests,
legacy geometry and cancellation during a pending read. Existing save,
restoration, lifetime lease, source/neighbor admission and actual HUD tests
remain included. No test starts a browser or native game.

`output/hero-route-startup-original-012.json` qualifies explicit startup
preflight on separately enrolled original home113500 and continued114000
saves. Both verify16641 height vertices and2480 shared vertices. Journal
and original sources stay unchanged; the resumed projection performs no
writes. This uses controlled content and filesystem-backed OPFS/Web Locks.

The first attempt to require position refusal from the original115900 save
failed its assertion because the hero is physically attached to guild469.
Inspection confirmed original UNIT513/GPL29, state flags514, parent469 and
`requiresParentPosition=true`. The implementation correctly refused outdoor
travel before comparing position; the guard was retained.
`output/hero-live-save-original-006.json` records the corrected explicit
physical-parent refusal with zero custody writes, then successful ordinary
live journal publication and source/east geometry admission. The failed
attempt005 is preserved. This is evidence of serialized attachment, not a
runtime guild entry/exit observation or an actual boundary crossing.

`output/hero-travel-boundary-site-001/manifest.json` freezes105 isolated
launcher files,327 resolved relative imports and idempotent staging. Served
launcher/player pages stay unchanged and no WASM engine is included. Original
producers are terminal/absent. Native compiled304 is unchanged. Browser game
launches remain suspended for the unresolved host-app crashes.

The full cooperative campaign, complete shared matches, independent internet
test and bounded expanding-world goal remains active.
