# Wayfinder and Trail Lodge v2

Private, unqualified content candidate. Production continues to use v1 until
the new native resources, mechanics, saves and browser integration are proved.

The Wayfinder is a lantern-bearing melee scout with a travel coat, teal uniform
and a staff/polearm. The resource retains v1's original descriptor/prototype
shape for save compatibility, with close-combat range, the staff equipment
family and a melee attack action. Its role is scouting and expedition support.

- Lantern Survey reveals a 448-pixel radius around outdoor Wayfinders every
  eight seconds, exceeding their normal 320-pixel sight.
- Field Aid unlocks at level two. Every sixteen seconds each outdoor Wayfinder
  restores up to four HP to the most injured nearby friendly hero within 96
  pixels. It excludes self, enemies, dead heroes and heroes inside buildings.
- Completed Trail Lodges supply outdoor friendly heroes within 160 pixels,
  restoring up to two HP every eight seconds. Overlapping Lodges do not stack.
  Unfinished, destroyed and enemy Lodges cannot supply heroes.

One named script controller and one native scheduler thread run these abilities
in single-player. Content co-op is not qualified. Counters and
thread state must survive original save/reload; compatibility with published
v1 worlds remains a required qualification. Costs and four-member capacity
remain unchanged so Lost Trail's existing mission economy remains recognizable.

Original artwork includes Lodge construction, completed, active and ruined
states, and directional Wayfinder movement, combat, casting and death.
Generated source atlases must be reviewed and encoded into native resources;
concept/source images alone do not qualify visible in-game integration.

Native trials815/840 rendered the new completed 300-HP Lodge and stationary
recruitment panel. The hard-coded Ranger recruit portrait now uses the original
Wayfinder art with the native 25-pixel icon contract. Ordinary recruitment still
costs 425 gold and generated native progress saves.

The support controller now uses the stock AIRoot timer fields, separately from
the mission's actual quest root. Trial840 saved two pulses and the named callback;
trial844 restored that exact save in a fresh profile, recruited a second hero,
and saved eight pulses. This qualifies timer execution and persistence; effect
controls are still pending. Older custom-prototype/function-field candidates
are private failed experiments and must not be distributed. Private effect controls remain unqualified. Trials852/858 ended in an attribute
setter fault; delta variants863/877 reached their guard deadlines. These
fixtures are not campaign progress. The revised fixture removes actor
destruction and level downgrades and isolates Supply with an odd pulse; it must
be freshly compiled and proved. Do not rerun guard-stopped trials.

Browser868 used pinned production WASM598 and the current catalog. It loaded the
native Day3 save and displayed original Lodge and moving Wayfinder art. Its
generated original GMP was restored in fresh browser870 and saved again. The
support counter advanced from eight to ten and retained the callback. Private
copies864/865 were unqualified because their stale engine/catalog omitted the
content. Corrected root867 uses the fully validated release and current catalog.

Healing effects, full hero interface checks and versioned publication remain
pending. Production serves v1. Player profiles, original saves and prior
releases have not been changed.
