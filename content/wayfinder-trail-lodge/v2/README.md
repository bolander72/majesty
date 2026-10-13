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
states, and directional Wayfinder movement, combat, casting, recoil and death.
Generated source atlases must be reviewed and encoded into native resources;
concept/source images alone do not qualify visible in-game integration.

Native progress checkpoint805: the new Lodge artwork renders on the original
completed 300-HP building, and ordinary 425-gold Wayfinder recruitment creates
a generated progress save. A preserved Day28 campaign also restores and runs
normally. The support controller is saved, but its counter remains zero and no
support callback survives in that save. Survey, Aid and Supply are therefore
not gameplay-qualified. The latest no-argument callback has the same issue;
next verify the native callback binding and use a declared function member to
match the original scheduler pattern. Hero portraits/directional animation,
help text, the inherited Move Camp action and browser release remain pending.
