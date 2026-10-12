# Optional world expansions

Requested future content: a Lord of the Rings / Middle-earth expansion covering
the Shire, Mordor and the lands between, and a Dune / Arrakis expansion. These
are planned packs; neither is installed or playable. The active expanding-world
and cooperative-play work remains the foundation.

Keep these as separately selectable campaigns using the shared expanding-world
engine. Each setting can introduce its own factions, heroes, buildings, enemies
and cooperative mission chains without requiring a different game client.
Pack selection and those content features remain to implement.

## Middle-earth

Build a connected regional campaign, with authored settlements and landmarks
inside regions and generated wilderness between them. Candidate regions include
the Shire, Bree, Rivendell, Moria, Mirkwood, Rohan, Isengard, Gondor and Mordor.
Regional routes should connect these places so the campaign can grow from the
Shire toward Mordor over multiple missions. The campaign should
support exploration, settlement development and cooperative objectives, rather
than require every region to be a separate competitive skirmish.

First playable slice: a Shire border settlement and a neighboring wilderness
region. Use a small mission chain: defend the settlement, establish an outpost
and escort a party between regions. Add one recruitable character type, one
recruitment building and one enemy type before expanding the region catalogue.
These are proposed designs, not existing content or qualified engine features.

Later missions can introduce other factions, regional architecture, hostile
strongholds and journeys toward Mordor. Competitive maps use explicit balanced
starting positions and their own victory conditions; campaign geography does
not imply competitive balance.

## Arrakis

Use the same world and mission interfaces with a desert setting, settlements,
spice fields and faction outposts. Candidate mechanics include spice income,
water reserves, desert travel hazards and sandworm encounters. Each needs its
own behavior implementation; a terrain reskin alone does not implement them.

First playable slice: an outpost and a neighboring spice-field region, with a
cooperative mission to secure a harvesting route and defend the outpost. Add
one character type, one production building and one desert enemy or hazard.
Qualify these before adding more factions, region types and mission branches.

## Shared pack requirements

- Packs are optional. Each declares a stable pack ID, version, dependencies,
  engine compatibility and exact content digest. This is a proposed packaging
  contract; there is no general pack installer yet.
- Each pack supplies terrain/biome rules, authored map pieces, missions,
  character and building definitions, enemy behavior, artwork and sound.
  Existing Majesty assets can support development slices while replacement
  content is prepared.
- World identity includes the selected pack and its content digest. Saves,
  regional checkpoints and campaign progress belong to that identity. Loading
  with missing or incompatible content must preserve the save and report the
  missing requirement. Updates need an explicit migration or a new world.
- Cooperative players must agree on pack bytes, generation seed and gameplay
  rules before starting. Campaign progression and outcomes are shared. A pack
  does not solve offline-party continuation; that remains a separate save and
  ownership policy to implement.
- Camera visibility controls rendering work. It must not independently remove
  another player's active castle, heroes or simulation. Shared region activation
  and persistence govern cooperative simulation; dormant solo regions preserve
  their saved state until loaded.
- Region caches, entity rendering and background work retain bounded budgets.
  Regions outside the view do not become persistent DOM elements. Native world
  teardown, actor references and gameplay queues must also be bounded; DOM
  clipping alone cannot establish this.

## Delivery sequence and acceptance

1. Finish connected-region save/restore and travel, including actor ownership,
   edge consistency and repeated-travel resource measurements.
2. Qualify one custom Majesty mission and one new recruitable character/building
   pair on the pinned browser engine. Verify behavior, original save/reload,
   compatibility refusal and cooperative synchronization.
3. Implement the shared pack format and loading interface using that small
   working pack. Keep pack loading separate from engine address assumptions.
4. Build and play the Middle-earth two-region slice through its final objective,
   then save, unload, return and resume with both cooperative players.
5. Repeat for the Arrakis slice and its resource/hazard behaviors, then expand
   either world in independently playable batches.

For each slice, acceptance requires a completed mission, functioning recruitment
and building behavior, persisted progression and entity state, matching
cooperative outcomes and measured resource use during repeated region travel.
Native fixture results alone do not qualify browser gameplay or internet play.

Committed hero kingdoms now have a four-visit original save/unload/return
qualification in one native process. The latest native fixture selects three actual saved
kingdoms by coordinates and restores each destination without menu input,
while refusing stale, replayed, missing, non-neighbor and malformed requests. See
[three-kingdom coordinate travel](native-coordinate-multiway.md). This includes
one independently generated and initialized neighbor; automatic exploration, spatial hero crossing, arbitrary
region generation, co-op activation and sustained resource bounds remain
unfinished. Neither expansion has a playable slice yet.

Current connected terrain and native unload/return evidence is linked in
[connected terrain](native-connected-terrain.md) and
[connected residency](native-connected-residency.md). First-load field changes,
seamless player-hero travel and browser resource qualification remain unfinished.
