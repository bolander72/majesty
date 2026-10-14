"""Original DACT layout, including script bytes outside the fixed PRIM chunk."""
import struct

from .legacy_description_engine import block, text
from .legacy_description_game import number, fourcc, scalar, resolve, fields, flag_bits
from .legacy_description_wire import unpack_chunk, children

IMAGE_SETS = {'Stand': 8, 'Attack': 16, 'Attack-2': 17, 'Attack-3': 18,
              'Special': 64, 'Special-2': 65, 'Special-3': 66, 'Build': 80,
              'Die': 96, 'Die-2': 97, 'Cast': 128, 'Carry': 144, 'Carry-2': 145,
              'Recoil': 160, 'Stand-to-Walk': 176, 'Walk-to-Stand': 177,
              'Active': 192, 'Inactive': 208, 'Crumble': 240, 'Interface': 1000}
PHASES = {'Death': 810042437, 'Begin': 809845317, 'Attack': 810238277,
          'VFX_SPECIAL1': 810767943, 'Monster_Idle': 827279693,
          'Peak': 810242117, 'End': 809780549, 'Attack2': 827015493,
          'VFX_CAST_SPELL1': 810571335, 'Buildup': 810893893,
          'GetHit2': 826820421, 'VFX_SPECIAL3': 844322375}
SPELL_TYPES = {'Attack': 1, 'CombatUtility': 2, '4': 4}


def action_parts(raw):
    _, version, count, payload = unpack_chunk(raw, b'DACT')
    if (version, count) != (0, 1):
        raise ValueError('Unsupported action root')
    _, version, count, body = unpack_chunk(children(payload, 1)[0], b'DATA')
    if version or count not in (2, 3) or len(body) < 16:
        raise ValueError('Unsupported action body')
    head_end = 16 + struct.unpack_from('<I', body, 4)[0]
    if head_end + 16 > len(body):
        raise ValueError('Action HEAD exceeds body')
    head = body[:head_end]
    unpack_chunk(head, b'HEAD')
    tag, size, version, n = struct.unpack_from('<4sIII', body, head_end)
    if (tag, size, version, n) != (b'PRIM', 64, 1, 0):
        raise ValueError('Unsupported action engine layout')
    script_start = head_end + 80
    if script_start + 9 > len(body):
        raise ValueError('Truncated external action script')
    end = body.find(b'\0', script_start + 8)
    if end < 0 or end - script_start - 8 > 1024:
        raise ValueError('Unterminated external action script')
    engine = body[head_end:end + 1]
    game = body[end + 1:]
    if count == 3:
        _, version, n, payload = unpack_chunk(game, b'SECD')
        if (version, n) != (3, 0) or len(payload) < 29:
            raise ValueError('Unsupported action game layout')
    elif game:
        raise ValueError('Unexpected trailing action bytes')
    return head, engine, game or None


def encode_action_engine(engine, resources):
    if engine is None or engine.attrib != {'version': '1'}:
        raise ValueError('Require complete Action Engine version1')
    allowed = {'ImageSet', 'CompletionImageSet', 'Sound', 'SoundPhase', 'Rate',
               'Distance', 'Info', 'Overlay', 'Projectile', 'Script'}
    seen = set()
    for item in engine:
        if item.tag not in allowed or item.tag in seen:
            raise ValueError('Unsupported or duplicate action engine field: ' + item.tag)
        seen.add(item.tag)
    words = [0] * 16
    info = engine.find('Info')
    if info is not None and scalar(info) != 'NoTarget':
        raise ValueError('Unsupported action info')
    for tag, index in [('ImageSet', 1), ('CompletionImageSet', 13)]:
        item = engine.find(tag)
        if item is not None:
            value = scalar(item)
            if tag == 'CompletionImageSet' and value == '':
                words[index] = 0xffffffff
            elif value not in IMAGE_SETS:
                raise ValueError('Unsupported action image set: ' + value)
            else:
                words[index] = IMAGE_SETS[value]
    for tag, index, namespace in [('Sound', 2, 'Sound'), ('Projectile', 3, 'Unit'), ('Overlay', 4, 'Unit')]:
        item = engine.find(tag)
        if item is not None:
            words[index] = resolve(scalar(item), resources[namespace])
    for tag, indices in [('Distance', {'min': 6, 'max': 7}), ('Rate', {'min': 8, 'max': 9})]:
        item = engine.find(tag)
        if item is not None:
            if not item.attrib or set(item.attrib) - indices.keys() or len(item):
                raise ValueError('Unsupported action ' + tag)
            for key, value in item.attrib.items():
                words[indices[key]] = number(value)
    item = engine.find('SoundPhase')
    if item is not None:
        if not item.attrib or set(item.attrib) - {'begin', 'peak', 'end'} or len(item):
            raise ValueError('Unsupported action sound phase')
        for key, value in item.attrib.items():
            if value not in PHASES:
                raise ValueError('Unresolved action sound phase: ' + value)
            words[{'begin': 10, 'peak': 11, 'end': 12}[key]] = PHASES[value]
    script = engine.find('Script')
    script_words, function = (0, 0), ''
    if script is not None:
        if set(script.attrib) != {'type', 'cProc', 'GPLFunction'} or len(script):
            raise ValueError('Unsupported action script declaration')
        script_words = (number(script.get('type')), number(script.get('cProc')))
        function = script.get('GPLFunction')
        if script_words != (0, 0):
            raise ValueError('Non-GPL action script route remains unqualified')
        if not function or len(function) > 64 or not function.replace('_', '').isascii() or not function.replace('_', '').isalnum():
            raise ValueError('Invalid action callback symbol')
    # Native 0x0059e760 emits a fixed64-byte PRIM and then the script route.
    return block(b'PRIM', struct.pack('<16I', *words), version=1) + struct.pack('<II', *script_words) + text(function)


def encode_action_game(game):
    if game is None:
        # Original stock actions always carry the default game part, including
        # those whose authoring XML omits Game altogether.
        return block(b'SECD', bytes(28) + b'\0', version=3)
    fields(game, {'Flags', 'EffectorDuration', 'TimeoutDuration', 'SpellType',
                  'CharacterLevel', 'SpellRank', 'ValidationScript'}, repeatable=('Flags', 'SpellType'))
    words = [flag_bits(game, {'IsSpell': 1}), 0, 0, 0, 0, 0, 0]
    for tag, index in [('EffectorDuration', 1), ('TimeoutDuration', 2), ('CharacterLevel', 4), ('SpellRank', 5)]:
        item = game.find(tag)
        if item is not None:
            words[index] = number(scalar(item))
    spells = set()
    for spell in game.findall('SpellType'):
        value = scalar(spell)
        if value not in SPELL_TYPES or value in spells:
            raise ValueError('Unsupported action spell type: ' + value)
        spells.add(value)
        words[3] |= SPELL_TYPES[value]
    validation = game.find('ValidationScript')
    function = scalar(validation) if validation is not None else ''
    return block(b'SECD', struct.pack('<7I', *words) + text(function), version=3)


def action_descriptor(element, resources):
    if element.get('type') != 'Action' or element.get('subType') != 'Standard':
        raise ValueError('Unsupported action descriptor kind')
    head = block(b'HEAD', struct.pack('<II', fourcc(element.get('ID')), 1) +
                 text(element.get('Name', '')) + text(element.get('Description', '')))
    engine = encode_action_engine(element.find('Engine'), resources)
    game = encode_action_game(element.find('Game'))
    body = head + engine + (game or b'')
    raw = block(b'DACT', block(b'DATA', body, count=3 if game is not None else 2), count=1)
    if action_parts(raw) != (head, engine, game):
        raise ValueError('Native action round trip differs')
    return raw
