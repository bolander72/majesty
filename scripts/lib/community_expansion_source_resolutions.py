"""Additive source resolutions for the verified More Heroes package."""
import re

from lib.community_guild_source_resolutions import STOCK_HEROES, random_hero_function

EXTRA_HEROES = ('Necromancer', 'Fire_Witch', 'Dark_Paladin', 'Cultist_Healer',
    'Wild_Monk', 'Lightning_Lord', 'Dragoncaller', 'Assassin', 'Fallen_Angel',
    'Minstrel', 'Shapeshifter', 'Mystic', 'Timewalker')
EXTRA_GUILDS = ('Necromancer_Abode', 'Temple_Flame', 'Dark_Paladin_Domain',
    'Temple_Mother_Agrela', 'Wild_Monk_Gardens', 'Lightning_Lord_Shrine',
    'Dragoncaller_Sanctuary', 'Assassin_Hideout', 'Angelic_Gateway', 'Tavern',
    'Labyrinth', 'Mystic_Keep', 'Time_Sphere')
STOCK_GUILDS = (('Adept', 'Temple_Lunord'), ('Barbarian', 'Temple_Krolm'),
    ('Cultist', 'Temple_Fervus'), ('Dwarf', 'Dwarven_Settlement'), ('Elf', 'Elven_Bungalow'),
    ('Gnome', 'Gnome_Hovel'), ('Healer', 'Temple_Agrela'), ('Monk', 'Temple_Dauros'),
    ('Paladin', 'Warriors_Guild'), ('Priestess', 'Temple_Krypta'), ('Ranger', 'Rangers_Guild'),
    ('Rogue', 'Rogues_Guild'), ('Solarus', 'Temple_Helia'), ('Warrior', 'Warriors_Guild'),
    ('Warrior_of_Discord', 'Warriors_Guild'), ('Wizard', 'Wizards_Guild'))


def guild_function(pairs):
    lines = ['function Guild_Title(agent ThisAgent) is string', 'declare', 'begin']
    for index, (title, guild) in enumerate(pairs):
        lines += [('if' if index == 0 else 'else if') +
            f' (ThisAgent\'s "title" == "{title}")', f'    return "{guild}";']
    lines += ['else', 'begin', '$debugout(911, "No guild type found for hero!?");',
              'return "No guild type found...";', 'end', 'end', '']
    return '\n'.join(lines)


def resolve(existing_random, existing_guild, more_random, more_guild):
    from majesty_cam.gpl_function_merge import same_function_instructions
    from majesty_cam.gpl import DefinitionKind, parse_gpl
    more_order = (*STOCK_HEROES[:-1], *EXTRA_HEROES, 'Gnome')
    if not same_function_instructions(more_random, random_hero_function(more_order)):
        raise ValueError('More Heroes random selection changed beyond the reviewed uniform pool')
    restricted = tuple(title for title in STOCK_HEROES if title != 'Paladin')
    if not same_function_instructions(existing_random, random_hero_function(
            (*STOCK_HEROES, 'Phantom', 'Alchemist'), (*restricted, 'Phantom', 'Alchemist'))):
        raise ValueError('Existing random selection or Haunt restriction changed')
    pairs = (*STOCK_GUILDS, *zip(EXTRA_HEROES, EXTRA_GUILDS))
    if not same_function_instructions(more_guild, guild_function(pairs)):
        raise ValueError('More Heroes guild mapping changed beyond the reviewed title branches')
    # The baseline is independently pinned by the stage tool. Preserve its
    # complete guild body, including Bards/Phantom/Alchemist and stock fallback.
    existing = parse_gpl(existing_guild).require(DefinitionKind.FUNCTION, 'Guild_Title')
    guard = '\n'.join(f'    if (ThisAgent\'s "title" == "{title}")\n'
                     f'        return "{guild}";' for title, guild in zip(EXTRA_HEROES, EXTRA_GUILDS))
    combined_guild, count = re.subn(r'(?im)^begin\s*$', lambda match: match.group() + '\n' + guard,
                                   existing.text, count=1)
    if count != 1:
        raise ValueError('Existing guild function entry changed')
    titles = (*STOCK_HEROES, 'Phantom', 'Alchemist', *EXTRA_HEROES)
    return dict(random_hero_type=random_hero_function(titles, tuple(t for t in titles if t != 'Paladin')),
                guild_title=combined_guild)
