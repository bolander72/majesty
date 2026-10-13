# Wayfinder and Trail Lodge v2

Gameplay-qualified content for the Lost Trail, delivered in a separate
`majesty-lost-trail-v2` collection. Original and v1 game data remain available;
native save identities `AVz1` and `ABs1` are retained.

Wayfinders are lantern-bearing melee scouts with original travel-coat, teal
uniform and staff/polearm artwork. They use close-combat attacks and the native
staff equipment family. Existing equipment is preserved when older actors
adopt the new attack actions.

- Lantern Survey reveals a 448-pixel radius around outdoor Wayfinders every
  eight seconds, beyond their normal 320-pixel sight.
- Field Aid unlocks at level two. Every sixteen seconds an outdoor Wayfinder
  restores up to four HP to the most injured friendly hero within 96 pixels.
  The implementation excludes self, enemies, dead heroes and indoor heroes.
- Completed Trail Lodges supply outdoor friendly heroes within 160 pixels,
  restoring up to two HP every eight seconds. The implementation prevents
  overlapping Lodge effects from stacking and excludes unfinished/enemy Lodges.

The Lodge is stationary, has 300 HP and four hero slots. Its first construction
cost is 900 gold, and Wayfinder recruitment costs 425 gold. Original artwork
covers construction, completed, active and ruined Lodges, plus directional
Wayfinder movement, melee combat, casting and death. Native portrait and icon
contracts are preserved.

A named AIRoot controller uses the native scheduler; its counter and callback
survive original save/reload. Native effect qualification893 proves the level
gate, four-HP aid, self exclusion, HP cap and two-HP supply. Additional controlled
enemy/indoor/overlapping-Lodge cases are deferred; content co-op is unqualified.

Final source was compiled by the original SDK895: 19,231 bytes, SHA256
`709b003843a29a40c0b6c9c6101ac176c4590668f4213c38bcbbaba321e7eec5`.
Native899 verifies ordinary recruitment and saving. Browser920 binds all
thirteen final resources and verifies paid recruitment; browser921 restores
the exact generated Day4 save with three Wayfinders and the completed Lodge.
Browser922 selects the native Lost Trail marker, reads its objectives and starts
a fresh world. Browser924 checks the unchanged published v1 resources against
the updated engine. Private qualification is
`output/regression925-browser-content-qualified.json`.

The underlying mission GUID, compiled objectives and inherited Fertile Plain
terrain are unchanged. Terrain and quest-marker artwork remain prototypes;
the new hero and Lodge artwork is original. The original mission's objective
controls, victory and completion records were qualified in native742.

`RECOMP_RULE_INVENTORY_COMPAT=1` is required. Release source/resource integrity
and browser/native qualification are gated by `deploy/content-v2-release.json`.

### Native UI icon contract

The Palace's Trail Lodge entry uses the original native building-list frame and opaque dark inset, with the original lodge illustration fitted inside it. The 25×25 icon is distinct from the transparent world sprite. `scripts/lib/native_ui_icon.py` reuses the purchased native frame, and `scripts/prepare-wayfinder-v2-art.py` encodes it in the Lodge's existing 1002 image set. Only positional tile 74 changes; world sprites, hero art, animation controls and abilities remain byte-identical. All future UI additions must follow the workspace AGENTS.md UI consistency rule.
