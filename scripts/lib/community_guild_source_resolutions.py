"""Reviewed source compatibility; creator repositories remain read-only."""
import re

STOCK_HEROES = ('Adept', 'Barbarian', 'Cultist', 'Healer', 'Monk', 'Priestess',
               'Ranger', 'Rogue', 'Solarus', 'Warrior', 'Wizard', 'Paladin',
               'Warrior_of_Discord', 'Dwarf', 'Elf', 'Gnome')
CONFIDENCE = {
    'ice_lance': ('10', 'Phantom_Ice_Lance_Confidence'),
    'frost_armor': ('10', 'Phantom_Frost_Armor_Confidence'),
    'icy_touch': ('25', 'Phantom_Icy_Touch_Confidence'),
    'call_to_grave': ('10', 'Phantom_Call_To_Grave_Confidence'),
    'eternal_soul': ('25', 'Phantom_Eternal_Soul_Confidence'),
    'endless_winter': ('30', 'Phantom_Endless_Winter_Confidence'),
}


def require(condition, message):
    if not condition:
        raise ValueError('Community source resolution refused: ' + message)


def pool(titles, indent):
    """Majesty's native uniform choice pattern, including the terminal else."""
    lines = [indent + f'Random = $RandomNumber({len(titles)}) + 1;']
    for index, title in enumerate(titles, 1):
        if index == len(titles):
            branch = 'Else'
        else:
            branch = ('If' if index == 1 else 'Else if') + f' (Random == {index})'
        lines.extend((indent + branch, indent + '\treturn "' + title + '";'))
    return '\n'.join(lines)


def random_hero_function(titles, restricted=None):
    lines = ['Function Random_Hero_Type(agent ThisAgent) is string',
             'Declare', '\tinteger Random;', 'Begin']
    if restricted:
        lines.extend((
            '\tIf (ThisAgent\'s "Title" == "Embassy" || ThisAgent\'s "Subtype" == "Outpost")',
            '\t\tIf ($Phantom_Player_Has_Placed_Haunt(ThisAgent))', '\t\t\tbegin',
            pool(restricted, '\t\t\t\t'), '\t\t\tend'))
    lines.extend((pool(titles, '\t'), 'End', ''))
    return '\n'.join(lines)


def resolve(alchemist, phantom, phantom_full_source):
    from majesty_cam.gpl_function_merge import _Parser, same_function_instructions

    compatibility = alchemist['alchemist_compat_phantom_max_haunt_level'].text.replace(
        'Alchemist_Compat_Phantom_Max_Haunt_Level', 'Phantom_Player_Max_Completed_Haunt_Level')
    require(same_function_instructions(compatibility,
        phantom['phantom_player_max_completed_haunt_level'].text), 'Haunt query changed')

    # Alchemist already has a Phantom confidence branch. Canonicalize only the
    # equivalent names/constants, then prove the complete remaining body equal.
    confidence = alchemist['spell_extra_value'].text.replace(
        'Alchemist_Compat_Phantom_Max_Haunt_Level', 'Phantom_Player_Max_Completed_Haunt_Level')
    for spell, (value, constant) in CONFIDENCE.items():
        require(re.search(r'(?im)^expression #' + constant + r' ' + value + r'\s*$',
                          phantom_full_source), 'Phantom confidence constant changed: ' + spell)
        pattern = (r'(\$isspellavailable\(thisagent,"' + spell
                   + r'",1\)\s*\)\s*value \+= )' + value + r';')
        confidence, count = re.subn(pattern, lambda m: m[1] + '#' + constant + ';',
                                    confidence, flags=re.I)
        require(count == 1, 'Alchemist compatibility confidence changed: ' + spell)
    combined = _Parser(confidence).function()
    canonical = _Parser(phantom['spell_extra_value'].text).function()
    require(combined[:2] == canonical[:2], 'Confidence signature/locals changed')
    require(combined[2][:-2] == canonical[2][:-1] and combined[2][-1] == canonical[2][-1],
            'Confidence contains another unreviewed difference')
    require(combined[2][-2].head == (
        'if', '(', 'thisagent', "'s", '"Title"', '==', '"Alchemist"', ')'),
        'Missing the original Alchemist confidence branch')

    # Compare the entire inputs, not merely lists of return strings. Extra
    # conditions, side effects or changed probabilities must be reviewed again.
    restricted = tuple(title for title in STOCK_HEROES if title != 'Paladin')
    require(same_function_instructions(alchemist['random_hero_type'].text,
        random_hero_function((*STOCK_HEROES, 'Alchemist'))), 'Alchemist hero pool changed')
    require(same_function_instructions(phantom['random_hero_type'].text,
        random_hero_function((*STOCK_HEROES, 'Phantom'), (*restricted, 'Phantom'))),
        'Phantom hero pool or undead guard changed')
    recruitment = random_hero_function((*STOCK_HEROES, 'Phantom', 'Alchemist'),
                                       (*restricted, 'Phantom', 'Alchemist'))
    _Parser(recruitment).function()
    return {'spell_extra_value': confidence, 'random_hero_type': recruitment}
