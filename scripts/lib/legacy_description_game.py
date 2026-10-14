"""Serialize audited legacy SECD game parts from complete XML, without stock actor cloning.

This is only the game part: HEAD/PRIM artwork, attachments, audio and actions
need their own conversion. Unsupported fields or unresolved identities fail
closed. Layouts follow the pinned guest's vehicle/building/overlay writers.
"""
import math
import struct

CHARACTER_FIELDS = {
    'Cost': 4, 'Experience': 8, 'MaxHP': 12, 'SightRange': 16, 'Speed': 20,
    'Vitality': 32, 'Charisma': 36, 'Artifice': 40, 'WillPower': 44,
    'Intelligence': 48, 'Strength': 52, 'MagicResistance': 56, 'Attack': 60,
    'RangedAttack': 64, 'Parry': 68, 'Dodge': 72, 'WeaponBasicDamage': 76,
    'ArmorBasicDamage': 80, 'Gold': 84, 'RecruitDelay': 88, 'PrimaryStat': 104,
}
CHARACTER_IDS = {'DialogID': 0, 'NameGenType': 92, 'HelpID': 100}
CHARACTER_FLAGS = {'Heals': 1, 'HasHPBar': 4, 'Poisons': 8, 'NotInMiniMap': 32,
                   'NumberedName': 64, 'CanHighlight': 128,
                   'HasGoldToolTip': 256, 'NotHero': 512}
# These two flags always co-occur in the captured stock corpus. Their combined
# mask is proved; independent bit assignments are deliberately not guessed.
CHARACTER_PAIRED_FLAGS = (frozenset(('NotFlaggable', 'NotSpellTarget')), 0x12)
WEAPONS = {'Chaos': 1, 'Crossbow': 2, 'Dagger': 3, 'Hammer': 4, 'Longbow': 5,
           'Longsword': 6, 'Mace': 7, 'Staff': 8, 'Axeclub': 9}
ARMORS = {'Leather': 1, 'Chain': 2, 'Plate': 3, 'Chaos': 4}
BUILDING_FIELDS = {'Cost': 4, 'IncomeType': 20, 'IncomeAmount': 24,
                   'MaxHP': 28, 'MaxGuildMembers': 32, 'SightRange': 36, 'Gold': 44}
BUILDING_IDS = {'DialogID': 0, 'NameGenType': 48, 'HelpID': 52}
BUILDING_FLAGS = {'NotBuildable': 1, 'IsGuild': 2, 'NoFlaggable': 4,
                  'HasHPBar': 8, 'NotSpellTarget': 16, 'NotInMiniMap': 32,
                  'NumberedName': 64, 'HasGoldToolTip': 256, 'Heals': 512}


def number(value):
    if not isinstance(value, str) or not value or value.strip() != value:
        raise ValueError('Integer game value required')
    try:
        result = int(value, 10)
    except ValueError as error:
        raise ValueError('Integer game value required') from error
    if not -0x80000000 <= result <= 0xffffffff:
        raise ValueError('Game value exceeds 32-bit bounds')
    return result & 0xffffffff


def fourcc(value):
    if value in ('0', '1'):
        # Stock overlay descriptions use the raw sentinel DialogID 1.
        return int(value)
    if not isinstance(value, str) or len(value) != 4 or any(not 32 <= ord(x) <= 126 for x in value):
        raise ValueError('Resolved four-character resource ID required: ' + repr(value))
    return int.from_bytes(value.encode('ascii'), 'little')


def fields(game, allowed, repeatable=('Flags',)):
    if game is None or game.tag != 'Game' or game.attrib != {'version': '1'}:
        raise ValueError('Require a supported complete Game version1 element')
    seen = set()
    for child in game:
        if child.tag not in allowed:
            raise ValueError('Unsupported authored game field: ' + child.tag)
        if child.tag not in repeatable and child.tag in seen:
            raise ValueError('Duplicate authored game field: ' + child.tag)
        seen.add(child.tag)


def scalar(element):
    if element.attrib.keys() != {'value'} or len(element):
        raise ValueError('Expected one scalar game value: ' + element.tag)
    return element.get('value')


def flag_bits(game, mapping, pair=None):
    chosen = []
    for element in game.findall('Flags'):
        chosen.append(scalar(element))
    if len(set(chosen)) != len(chosen):
        raise ValueError('Duplicate game flag')
    remaining = set(chosen)
    result = 0
    if pair and remaining & pair[0]:
        if not pair[0] <= remaining:
            raise ValueError('Independent paired character flag is not yet qualified')
        remaining -= pair[0]
        result |= pair[1]
    for name in remaining:
        if name not in mapping:
            raise ValueError('Unsupported authored game flag: ' + name)
        result |= mapping[name]
    return result


def set_fields(payload, game, numeric, resource_ids, remap):
    for tag, offset in numeric.items():
        element = game.find(tag)
        if element is not None:
            struct.pack_into('<I', payload, offset, number(scalar(element)))
    for tag, offset in resource_ids.items():
        element = game.find(tag)
        if element is not None:
            value = scalar(element)
            struct.pack_into('<I', payload, offset, fourcc(remap.get(value, value)))


def resolve(value, names):
    if value == '0':
        return 0
    if value.casefold() not in names:
        if value in names.values():
            # A literal ID is valid only when it belongs to this namespace.
            return fourcc(value)
        raise ValueError('Unresolved authored description: ' + value)
    if names[value.casefold()] is None:
        raise ValueError('Ambiguous typed description name: ' + value)
    return fourcc(names[value.casefold()])


def keyed_map(pairs):
    # Native 0x004f0630 emits version1, count, then sorted uint32 key/value pairs.
    ordered = sorted(pairs)
    if len({key for key, value in ordered}) != len(ordered) or len(ordered) > 1024:
        raise ValueError('Duplicate or oversized native game map')
    return struct.pack('<II', 1, len(ordered)) + b''.join(struct.pack('<II', key, value) for key, value in ordered)


def chunk(payload, version):
    return struct.pack('<4sIII', b'SECD', len(payload), version, 0) + payload


def encode_character(game, names, remap=None, attribute_ids=None):
    remap, attribute_ids = remap or {}, attribute_ids or {}
    fields(game, set(CHARACTER_FIELDS) | set(CHARACTER_IDS) |
           {'AttackRange', 'Flags', 'Attributes', 'AllowedWeapon', 'AllowedArmor', 'AllowedSpells'})
    payload = bytearray(108)
    set_fields(payload, game, CHARACTER_FIELDS, CHARACTER_IDS, remap)
    attack = game.find('AttackRange')
    if attack is not None:
        if set(attack.attrib) != {'min', 'max'} or len(attack):
            raise ValueError('Invalid attack range')
        struct.pack_into('<II', payload, 24, number(attack.get('min')), number(attack.get('max')))
    struct.pack_into('<I', payload, 96, flag_bits(game, CHARACTER_FLAGS, CHARACTER_PAIRED_FLAGS))
    attrs = []
    container = game.find('Attributes')
    if container is not None:
        if container.attrib:
            raise ValueError('Unsupported attributes container')
        for element in container:
            if element.tag != 'Attribute' or set(element.attrib) != {'ID', 'Value'} or len(element):
                raise ValueError('Invalid authored description attribute')
            key = element.get('ID')
            if key not in attribute_ids:
                raise ValueError('Native attribute binding remains unqualified: ' + key)
            attrs.append((fourcc(attribute_ids[key]), number(element.get('Value'))))
    equipment = []
    for tag, mapping in [('AllowedWeapon', WEAPONS), ('AllowedArmor', ARMORS)]:
        element = game.find(tag)
        pairs = []
        if element is not None:
            value = scalar(element)
            if value not in mapping:
                raise ValueError('Unsupported equipment family: ' + value)
            pairs.append((0, mapping[value]))
        equipment.append(pairs)
    spells = []
    container = game.find('AllowedSpells')
    if container is not None:
        if container.attrib:
            raise ValueError('Unsupported spells container')
        for element in container:
            if element.tag != 'Spell' or set(element.attrib) != {'ID', 'Value'} or len(element):
                raise ValueError('Invalid authored spell binding')
            spells.append((number(element.get('ID')), resolve(element.get('Value'), names)))
    return chunk(bytes(payload) + b''.join(keyed_map(pairs) for pairs in (attrs, *equipment, spells)), 8)


def encode_building(game, names, remap=None):
    remap = remap or {}
    fields(game, set(BUILDING_FIELDS) | set(BUILDING_IDS) |
           {'UpgradeTo', 'UpgradeFrom', 'Multiplier', 'Flags', 'Produces'})
    payload = bytearray(56)
    set_fields(payload, game, BUILDING_FIELDS, BUILDING_IDS, remap)
    for tag, offset in [('UpgradeTo', 8), ('UpgradeFrom', 12)]:
        element = game.find(tag)
        if element is not None:
            struct.pack_into('<I', payload, offset, resolve(scalar(element), names))
    multiplier = game.find('Multiplier')
    if multiplier is not None:
        value = float(scalar(multiplier))
        if not math.isfinite(value) or not 0 <= value <= 1000000:
            raise ValueError('Invalid building multiplier')
        struct.pack_into('<f', payload, 16, value)
    struct.pack_into('<I', payload, 40, flag_bits(game, BUILDING_FLAGS))
    produces = []
    container = game.find('Produces')
    if container is not None:
        if container.attrib:
            raise ValueError('Unsupported production container')
        for element in container:
            if element.tag != 'Unit' or set(element.attrib) != {'ID'} or len(element):
                raise ValueError('Invalid authored production binding')
            produces.append(resolve(element.get('ID'), names))
    if len(produces) > 1024 or len(set(produces)) != len(produces):
        raise ValueError('Duplicate or oversized production list')
    # First map is the stock building's empty attribute map; second is its
    # version1 production vector, which preserves authored list order.
    return chunk(bytes(payload) + keyed_map(()) + struct.pack('<II', 1, len(produces)) +
                 b''.join(struct.pack('<I', value) for value in produces), 5)


def encode_overlay(game, names=None, remap=None):
    fields(game, {'DialogID', 'StackPriority', 'Flags'})
    payload = bytearray(12)
    set_fields(payload, game, {'StackPriority': 4}, {'DialogID': 0}, remap or {})
    struct.pack_into('<I', payload, 8, flag_bits(game, {'TransparentToMouse': 1}))
    return chunk(payload, 3)
