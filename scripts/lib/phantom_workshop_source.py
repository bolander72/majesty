"""Recover the acquired Phantom's observed source deltas from pinned public/SDK inputs.

The downloaded binary, not the older public source, is the fidelity baseline.
Private recovery trials compare all164 instruction records against that binary
with independent source-line shifts, plus the exact prototype and38 DAT records.
This is not a claim of runtime qualification or byte-identical compilation.
"""
import re


def once(text, original, replacement, label):
    if text.count(original) != 1:
        raise ValueError('Unreviewed Phantom source shape: ' + label)
    return text.replace(original, replacement, 1)


def recover(public_gpl, hero_dat, stock_hero, stock_guild_title, project):
    from majesty_cam.gpl import parse_gpl, DefinitionKind

    parsed = parse_gpl(public_gpl)
    replacements = {}
    item = parsed.require(DefinitionKind.FUNCTION, 'Phantom_Icy_Touch_In_Range')
    old = ('''If (
\t\ttarget's "attacktype" == 1 &&
\t\ttarget's "attack_action" == "basic_attack"
\t)''')
    new = ('''If ($HasAttribute("attacktype", target))
\t\tIf ($HasAttribute("attack_action", target))
\t\t\tIf (target's "attacktype" == 1 && target's "attack_action" == "basic_attack")''')
    replacements[item.span.start, item.span.end] = once(item.text, old, new, 'melee attribute guards')
    item = parsed.require(DefinitionKind.FUNCTION, 'Phantom_Priestess_Assigned_To')
    body = once(item.text, '\tagent Priestess;', '\tagent Priestess;\n\tboolean Is_Assigned;',
                'Priestess assignment local')
    body = once(body, 'Begin', 'Begin\n\tIs_Assigned = False;', 'Priestess assignment initialization')
    body = once(body, 'return True;', 'Is_Assigned = True;', 'Priestess foreach result')
    body = once(body, 'return False;', 'return Is_Assigned;', 'Priestess function result')
    replacements[item.span.start, item.span.end] = body
    for (start, end), body in sorted(replacements.items(), reverse=True):
        public_gpl = public_gpl[:start] + body + public_gpl[end:]
    # The qualified recovery's main source uses normalized LF; the separate
    # stock-cloned prototype retains its original source layout.
    stock_guild_title = stock_guild_title.replace('\r\n', '\n')
    pattern = r'(else if\s*\(\s*ThisAgent\x27s "title" == "Priestess"\s*\))'
    guild, count = re.subn(pattern, 'else if (ThisAgent\'s "title" == "Phantom")\n'
                          '\t\treturn "Phantoms_Haunt";\n\t' + r'\1', stock_guild_title, flags=re.I)
    if count != 1:
        raise ValueError('Unreviewed stock Guild_Title source')
    public_gpl += '\n\n' + guild + '\n'

    prototype, count = re.subn(r'(?i)^(\s*prototype\s+)Hero\b', r'\1Phantom_Hero',
                               stock_hero, count=1)
    if count != 1:
        raise ValueError('Unreviewed stock Hero prototype')
    prototype, count = re.subn(r'(?im)^begin\s*$', '\tboolean Should_Kite;\n'
                               '\tinteger KitingTime;\n\nbegin', prototype, count=1)
    if count != 1:
        raise ValueError('Unreviewed Hero declaration boundary')
    hero_dat = once(hero_dat, '{Hero', '{Phantom_Hero', 'Phantom prototype reference')
    hero_dat = once(hero_dat, '\t\t(Friend\txx)', '\t\t(Friend\txx)\n'
                    '\t\t(Should_Kite true)\n\t\t(KitingTime 0)', 'authored kiting defaults')
    project = once(project, 'source="Phantom.gpl"',
                   'source="Phantom.gpl"\nsource="Phantom_Hero_Prototype.gpl"', 'prototype source declaration')
    return {'Phantom.gpl': public_gpl.encode('cp1252'),
            'Phantom_Hero_Prototype.gpl': prototype.encode('cp1252'),
            'Phantom_Hero_Data.dat': hero_dat.encode('cp1252'),
            'Phantom.gplproj': project.encode('cp1252')}
