# Original demo mission: Vampiric Revenge

Cyberlore's [original demo page](https://www.cyberlore.com/majesty/demo.htm)
identifies Vampiric Revenge as its single demo quest. Gold HD already includes
its original `Vampiric_Revenge.q`, quest XML and GPL functions. The browser uses
the older DirectDraw executable, whose fixed campaign map does not expose that
modern quest descriptor.

The canonical GUID remains `{504D4156-0000-0000-0000-000000000000}`. A separate
legacy template changes only its initialization name to `DOWNLOADABLE_QUEST_3`.
The original SDK compiled a 616-byte bridge that calls `VAMPIRIC_REVENGE`.
Terrain, starting forces, scripted events, restrictions and victory logic are
original Cyberlore content. No stock mission is replaced. The XQD3 slot is
separate from the shipped bonuses and the retired XQD2 content.

Find the mission through Play Game: pan west, roughly midway down the campaign
map, to the glowing bonus medallion west of Shovrah-Dan. Hover displays
**Vampiric Revenge**. The marker reuses Majesty's native bonus medallion and
hover animation, with transparent margins over the unchanged map. The briefing
uses the native advisor portrait and original text. No new artwork or narration
is claimed.

`scripts/prepare-vampiric-revenge.py` verifies the purchased input hashes,
qualified Alchemist configuration and SDK/source bindings before producing a
separate candidate. Its output includes both quest-directory aliases because
the expansion selector discovers its reserved template in `QuestsMX`. Original
files, including the canonical demo descriptor, remain intact.

Browser1807 verified selection, original background/goals, the generated Palace
world and ordinary saving. Its 346547-byte GMP has SHA256
`8e3fda02ddd12e7cfa380acbc520285888567f48e4ba695ebd18841ae6ccc8d5`
and retains the original `Vampiric_Victory` and `vampiric_events` references.
Fresh browser1808 restored that original save, continued into Day2 and saved
again. The original demo's restricted Palace construction list is active. A
complete victory playthrough has not been repeated.

The root mounts a new `majesty-alchemist-demo-v1` game-data collection with
the existing qualified Alchemist pack. Original game data and older community
collections are retained; Majesty's original save/profile identity is unchanged.
The qualified smooth-copy1799 engine and its performance settings are unchanged.
See `deploy/vampiric-revenge-verification.json` for scope and resource bounds.
Browser1810 additionally verified automatic preparation from the cached original
game using the clean Git-built root and commit-pinned resource URLs. It restored
the same original GMP under Majesty's existing profile identity. The preserved
Day2 save is 365871 bytes, SHA256
`6a1cd483c646237c2cd6f65c79c86c46eaba0629d7dae3828fbdc817225aed66`.

## Community guilds to evaluate next

Both identified mods are by **Phantomstar**, the Alchemist Lab creator:

- [Bards Hall source](https://github.com/Phantomstar721/majesty-gold-hd-custom-guild-bards-hall)
  describes three distinct heroes: a supporting Troubadour, ranged Spellsinger
  and melee Blade Dancer, with custom artwork, voices and a three-level guild.
  Its recruiting, equipment and shared systems require the creator's Mod Manager
  runtime; simply copying its CAM files is insufficient. Its public source
  excludes original artwork/audio, which come from the complete Workshop package.
- [Phantoms Haunt source](https://github.com/Phantomstar721/majesty-gold-hd-custom-guild-phantoms-haunt)
  and [Workshop package3769947406](https://steamcommunity.com/sharedfiles/filedetails/?id=3769947406)
  describe a three-level undead guild, original Phantom heroes and six
  cold/undead abilities, plus interactions with Priestesses and Paladins. The
  repository README warns about raw Freestyle loading; the creator's newer
  Workshop edit says the Mod Manager removes that limitation. Browser support
  and compatibility with Alchemists still require independent verification.

Both full Workshop packages were acquired on October 16, 2026. Mike confirmed
redistribution permission for both guilds' original artwork/audio, with creator
acknowledgement. Their browser integration is in progress; neither is deployed
yet. Preserve actual mechanics, art and credits. See
[community guild integration](community-guild-integration.md) for the source
and compatibility checkpoint. No creator was messaged here.
