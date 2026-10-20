"""Preserve original Fire Balm eligibility and adapt missing base hero fields."""
import hashlib
import re


def fire_balm_support(stock, occupied):
    from majesty_cam.gpl import parse_dat
    path = stock / 'GPLMx/mx_Hero_Data.dat'
    raw = path.read_bytes()
    if len(raw) > 2 * 1024 * 1024:
        raise ValueError('Oversized original hero data')
    items = {item.normalized_name: item for item in parse_dat(raw.decode('cp1252')).items}
    mappings = {}
    for title, expected in [('Ranger', 'Fire_Ranger_Arrow'), ('Rogue', 'Fire_Bolt'),
                            ('Elf', 'Fire_Elf_Arrow')]:
        matches = re.findall(r'\(special_attack_action\s+(\w+)\)', items[title.casefold()].text, re.I)
        if matches != [expected]:
            raise ValueError('Original Fire Balm attack binding differs: ' + title)
        mappings[title] = expected
    names = ['MCR_Fire_Balm_Eligible', 'MCR_Prepare_Fire_Balm']
    if any(name.casefold() in occupied for name in names):
        raise ValueError('Fire Balm compatibility helper name is occupied')
    choices = '\n'.join(f'    if (ThisAgent\'s "Title" == "{title}") Action = "{action}";'
                        for title, action in mappings.items())
    eligible = ' || '.join(f'ThisAgent\'s "Title" == "{title}"' for title in mappings)
    text = f'''// Base saves retain their original Hero prototype. Initialize only the
// missing field on an eligible hero, using its original Northern fire action.
function MCR_Fire_Balm_Eligible(agent ThisAgent) is boolean
declare
begin
    if ($IsValidGamePiece(ThisAgent) == False) return False;
    if ($HasAttribute("Title", ThisAgent) == False) return False;
    if ($IsDead(ThisAgent)) return False;
    if ($MM_BP_Eligibility(ThisAgent, #Bazaar_Item_Two) == 0) return False;
    return ({eligible});
end

function MCR_Prepare_Fire_Balm(agent ThisAgent) is boolean
declare
    string Action;
begin
    if ($MCR_Fire_Balm_Eligible(ThisAgent) == False) return False;
    if ($GetAttribute(ThisAgent, #ATTRIB_HasEffectFireBalm) != 0) return False;
{choices}
    if ($HasAttribute("Special_Attack_Action", ThisAgent) == False)
        $AddAttribute(ThisAgent, "Special_Attack_Action", "string", Action);
    else
        if (ThisAgent's "Special_Attack_Action" == "")
            ThisAgent's "Special_Attack_Action" = Action;
    return True;
end
'''
    return dict(source=text, actions=mappings, functions=names,
                scope='Any',
                originalHeroData=dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest()),
                requiresNativeStringAttribute=True, originalHeroPrototypeUnchanged=True)


def patch_fire_balm_sources(payloads):
    """Change only the supported-use gates, preserving original effect bodies."""
    from majesty_cam.gpl import parse_gpl, DefinitionKind
    effects = {'fire_balm_effect', 'mjc_fire_balm_effect', 'alchemist_fire_balm_effect'}
    validators = {'mm_bp_validate_41303235', 'mm_bp_validate_41505333'}
    changes = []
    result = dict(payloads)
    for name, raw in payloads.items():
        if not name.startswith('Any/') or not name.endswith('.gpl'):
            continue
        text = raw.decode('cp1252')
        replacements = []
        for item in parse_gpl(text, name).items:
            key = item.normalized_name
            if item.kind != DefinitionKind.FUNCTION or key not in effects | validators:
                continue
            validator = key in validators
            pattern = (r'if\s*\(\s*\$MM_BP_Eligibility\(ThisAgent,\s*#Bazaar_Item_Two\)'
                       r'\s*==\s*0\s*\)\s*return' + (r'\s+0' if validator else '') + r'\s*;')
            gate = ('if ($MCR_Fire_Balm_Eligible(ThisAgent) == False) return 0;' if validator else
                    'if ($MCR_Prepare_Fire_Balm(ThisAgent) == False) return;')
            updated, count = re.subn(pattern, lambda match: gate, item.text, flags=re.I)
            if count != 1:
                raise ValueError('Fire Balm entry gate differs: ' + item.name)
            replacements.append((item.span.start, item.span.end, updated))
            changes.append(dict(file=name, function=item.name,
                priorSha256=hashlib.sha256(item.text.encode('cp1252')).hexdigest(),
                sha256=hashlib.sha256(updated.encode('cp1252')).hexdigest()))
        for start, end, updated in sorted(replacements, reverse=True):
            text = text[:start] + updated + text[end:]
        result[name] = text.encode('cp1252')
    if {row['function'].casefold() for row in changes} != effects | validators:
        raise ValueError('Incomplete original/aliased Fire Balm entry compatibility')
    return result, changes
