"""Mirror the Hall's native capacity for original-campaign GPL consumers."""
import re

SYNC_NAME = 'Bards_Sync_Legacy_Guild_Capacity'
SYNC = '''function Bards_Sync_Legacy_Guild_Capacity(agent Guild)
declare
    integer Capacity;
begin
    if ($IsValidGamePiece(Guild) == FALSE) return;
    if (Guild's "Title" != "Bards_Hall") return;
    Capacity = $GetAttribute(Guild, #ATTRIB_MaxGuildMembers);
    // Original campaigns read max_members in adoption and guild destruction.
    // The native capacity remains authoritative, including quest restrictions.
    // Saved Halls may predate the declaration; repair only this private guild.
    if ($HasAttribute("max_members", Guild) == FALSE)
        $AddAttribute(Guild, "max_members", "integer", Capacity);
    else Guild's "max_members" = Capacity;
end
'''


def definition(text, kind, name, transform):
    matches = list(re.finditer(r'(?im)^' + kind + r'\s+' + re.escape(name) + r'\b[^\n]*', text))
    if len(matches) != 1:
        raise ValueError('Require one reviewed definition: ' + name)
    match = matches[0]
    following = re.search(r'(?im)^(?:function|prototype|expression)\s+', text[match.end():])
    end = match.end() + following.start() if following else len(text)
    return text[:match.start()] + transform(text[match.start():end]) + text[end:]


def once(text, before, after):
    if text.count(before) != 1:
        raise ValueError('Legacy capacity source contract changed')
    return text.replace(before, after, 1)


def restore_legacy_capacity(text):
    if re.search(r'(?im)^function\s+' + SYNC_NAME + r'\b', text):
        raise ValueError('Legacy capacity compatibility already applied')
    call = '$' + SYNC_NAME
    text = definition(text, 'prototype', 'Bards_Hall_Prototype',
                      lambda body: once(body, '//integer max_members;', 'integer max_members;'))
    text = definition(text, 'function', 'Bards_Hall_Birth', lambda body:
                      once(body, '\tthisagent\'s "in_danger" = FALSE;',
                           '\t' + call + '(thisagent);\n\tthisagent\'s "in_danger" = FALSE;'))
    text = definition(text, 'function', 'building_upgraded', lambda body:
                      once(body, '\t$runthread ( thisagent\'s "upgradescript", 1, thisagent );',
                           '\t' + call + '(thisagent);\n\t$runthread ( thisagent\'s "upgradescript", 1, thisagent );'))
    text = definition(text, 'function', 'BuildingReachedMaxHP', lambda body:
                      once(body, '\t\t\t\tIf ( TheBuilding\'s "Title" == "Palace" )',
                           '\t\t\t\t' + call + '(theBuilding);\n\n'
                           '\t\t\t\tIf ( TheBuilding\'s "Title" == "Palace" )'))
    # Existing world-ready/completion/ownership reconciliation reaches completed
    # saved Halls too. No periodic scan or new persisted host state is added.
    text = definition(text, 'function', 'MM_KR_61f71999deb595c08a9e9fd4ad74ab25_Visual', lambda body:
                      once(body, '    if ($MM_KR_Live(Building) == False) return 0;',
                           '    if ($MM_KR_Live(Building) == False) return 0;\n'
                           '    ' + call + '(Building);'))
    return text.rstrip() + '\n\n' + SYNC
