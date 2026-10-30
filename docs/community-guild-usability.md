# Community guild usability

Mike's October 30, 2026 direction keeps Adventurers Guild, Royal Menagerie
(Zoo), and the individually approved Dark Paladin's Guild. Every other More
Heroes guild remains retired. Existing actors and saves retain their definitions.

## World scale

Adventurers Guild world frames and placement geometry use 60% of their previous
size. Zoo levels 1–3 use 78%. This includes animation frames, hotspots,
attachment positions, rectangular masks and collision polygons, rather than
shrinking only the completed picture. Native sidebar portraits and framed
Palace emblems retain their original dimensions. Dark Paladin art is unchanged.

## Capture and the Royal Menagerie

Palace → Rewards includes Capture when the kingdom has a completed Zoo.
Capture opens the Zoo's native bounty controls and arms its capture cursor.
Back returns to Palace Rewards. Entering Capture from a Zoo returns to that Zoo.
Attack and Explore retain their own bounty values.

Capture is a nonlethal bounty, with no hidden success roll. Heroes still fight
an eligible flagged monster; at defeat it is subdued, restored to one-third
health, and escorted to an available Zoo. A living hero and a free Zoo slot are
required. The funded bounty pays through normal hero reward distribution.
Bigger rewards attract heroes; they do not improve an undisclosed probability.
Available heroes take escort duty. Stored and pending captures count
against capacity (4, 6 and 8 at levels 1, 2 and 3).

Friendly units, summons, already controlled beasts and special scripted quest
bosses are ineligible. In particular Rrongol's Holy Chalice death event must
remain a quest event. Placement checks normal monster death handlers rather
than promising capture for every enemy on the map.

- **Captives** opens the real stored-beast list. Select a beast, then pay
  **Tame Beast** to release it as a permanent kingdom guard around the Palace.
  This frees its Zoo slot. The threat-based price is shown before payment.
- **Rentals On** lets heroes spend their own gold to hire stored beasts as
  travelling companions. **Rentals Off** prevents new rentals. The label is the
  current state; clicking changes it. Capture and manual taming work either way.
- Stored beasts earn exhibit income and can escape. Taming is distinct from
  placing a capture bounty or letting a hero hire a companion.

Every Zoo tier's question-mark help must explain these actions and its capacity.

## Adventurers Guild

The Guild stays open once built. New guilds start open, and saved closed guilds
become open when their normal state checks run. Open/Close controls and their
queued actions are removed from this Guild.

The QUEST button opens Available Quests, which lists unclaimed jobs. The visitor
bar lists heroes currently inside the Guild; Nobody Here means it has no visitors. Heroes choose suitable jobs automatically;
players do not assign a particular hero from this list. Refresh costs 500 gold
and replaces unclaimed offers with up to six jobs when suitable objectives
exist. Accepted quests continue. Heroes return for their quest rewards.
Only one Adventurers Guild is allowed per kingdom.

## Retirement enforcement

NotBuildable alone is insufficient: the original build-anything cheat bypasses
it. The native construction-list insertion boundary must reject all fourteen
retired More Heroes building families even with that cheat. Dark Paladin's
Guild is the sole approved exception. Keep archived resources, existing saved
actors and original game content; do not enable retired recruitment or random
arrivals as a side effect.

Reintroduction still requires the full native-scale artwork, UI, animation,
audio, progression and gameplay standard in `more-heroes-art-direction.md`.

## Qualification and rollout

Release `guild-usability-v1` was qualified on October 30, 2026 with the
original SDK compiler and official native browser build tools. The production
Common BCD has 1,108 definitions. Four test-only helper functions were appended
in an isolated fixture; every production definition matched that fixture, and
none of those helpers are included in the release resources.

The bounded native test applied a lethal injury through the original HP setter.
The real monster death callback subdued the flagged Ratman, restored one-third
health, completed its ordinary control and escort sequence, stored it in the
Zoo, and released a living owned guardian through the native paid Tame action.
Level 1000 and infinite gold were active during capture; infinite gold was
turned off after storage to verify the actual taming debit. This verifies the
native lethal callback and delivery/payment sequence; it is not a claim that
a test forced normal hero combat or reproduced every previously reported freeze.

Native review covered the smaller guilds beside the stock Palace, the Palace
Capture button and its Back navigation, scrollable Zoo and Adventurers Guild
help, and the removal of Open/Close controls. All fourteen retired building
families were filtered from the actual construction list with build-anything
active. All three Zoo tiers' frame geometry and help aliases were checked
statically; the world-art and help runtime review used level one.

An owned new save containing the active guilds and tamed guard loaded using
the production scripts with test flags absent. The fifteen protected original
GMP files remained byte-identical. Owned browser engines were closed after
verification. The separate historical host-app crash investigation remains open.

The source installer chain reproduced all 149 qualified deployment files
exactly. The release changes eight deployment files and twenty native resource
bindings; Dark Paladin art and all original unit definitions are unchanged.
Player saves require no migration. Deployment receipts are recorded in
`deploy/guild-usability-release.json`, `deploy/guild-usability-verification.json`
and the production verification receipt once promotion completes.
