"""Encode original common Unit/Overlay/Projectile PRIM layouts from authored XML.

Resource references are resolved by their own namespace, never by truncating
names or inheriting a stock actor's art, sound, callbacks or attachments.
"""
import struct

from .legacy_description_game import number, fourcc, scalar, resolve, keyed_map

INFO = {'Static': 0x1, 'Directionless': 0x4, 'DontBlock': 0x8,
        'BlockGround': 0x10, 'BlockFlying': 0x20,
        'ModifyTerrainTextureOnPlacement': 0x100,
        'ModifyTerrainHeightOnPlacement': 0x200, 'AllocateLocalID': 0x800,
        'NotVisibleInISOView': 0x1000, 'NotVisibleInOverheadView': 0x2000,
        'NotVisibleToOpponent': 0x8000, 'NoGPLAgent': 0x10000,
        'RevealTerrainIfExposed': 0x20000, 'NoRandomTargetOnDestination': 0x40000}
KINDS = {'General': 0, 'Projectile': 1, 'Building': 2, 'Character': 3, 'Overlay': 4, 'ParticleSystem': 5}
MOVEMENT_TYPES = {'Walk': 1, 'Fly': 4}


def block(tag, payload, version=0, count=0):
    return struct.pack('<4sIII', tag, len(payload), version, count) + payload


def text(value):
    if not isinstance(value, str) or '\0' in value or len(value) > 1024:
        raise ValueError('Invalid legacy descriptor text')
    try:
        return value.encode('cp1252') + b'\0'
    except UnicodeEncodeError as error:
        raise ValueError('Legacy descriptor text must fit Windows-1252') from error


def header(element):
    if element.get('type') != 'Unit' or element.get('subType') not in KINDS:
        raise ValueError('Unsupported native unit header kind')
    key = fourcc(element.get('ID'))
    return block(b'HEAD', struct.pack('<II', key, KINDS[element.get('subType')]) +
                 text(element.get('Name', '')) + text(element.get('Description', '')))


def attachments(elements, subtype, movements):
    if subtype == 'Overlay':
        if elements:
            raise ValueError('Overlay attachment serialization is not qualified')
        return b''
    move = []
    for element in elements:
        if set(element.attrib) != {'kind', 'type', 'ID'} or len(element):
            raise ValueError('Invalid authored attachment')
        if element.get('kind') != 'Movement' or element.get('type') not in MOVEMENT_TYPES:
            raise ValueError('Unsupported authored attachment kind/type')
        move.append((MOVEMENT_TYPES[element.get('type')], resolve(element.get('ID'), movements)))
    if len(move) > 8:
        raise ValueError('Movement attachments exceed native slots')
    move += [(0, 0)] * (8 - len(move))
    parts = [block(b'EXPL', bytes(32), count=4),
             block(b'MOVE', b''.join(struct.pack('<II', kind, key) for kind, key in move), count=8)]
    if subtype != 'Projectile':
        parts.append(block(b'WEAP', bytes(16), count=2))
    return block(b'ATCH', b''.join(parts), count=len(parts))


def encode_engine(element, resources):
    subtype = element.get('subType')
    if subtype == 'ParticleSystem':
        from .legacy_description_particle import encode_particle_engine
        return encode_particle_engine(element, resources)
    if element.get('type') != 'Unit' or subtype not in KINDS:
        raise ValueError('Unsupported common engine unit kind')
    engine = element.find('Engine')
    if engine is None or engine.attrib != {'version': '1'}:
        raise ValueError('Require supported complete Engine version1')
    allowed = {'Info', 'CanUse', 'Menu', 'ImageIDBase', 'AttachmentPointID', 'Category',
               'Script', 'Attachment', 'DefaultSound', 'SoundOverride', 'ShadowType'}
    seen = set()
    for item in engine:
        if item.tag not in allowed:
            raise ValueError('Unsupported authored engine field: ' + item.tag)
        if item.tag not in {'Info', 'CanUse', 'Attachment', 'SoundOverride'} and item.tag in seen:
            raise ValueError('Duplicate authored engine field: ' + item.tag)
        seen.add(item.tag)
    info = 0
    flags = [scalar(item) for item in engine.findall('Info')]
    if len(set(flags)) != len(flags):
        raise ValueError('Duplicate engine info flag')
    for flag in flags:
        if flag not in INFO:
            raise ValueError('Unsupported authored engine info: ' + flag)
        info |= INFO[flag]
    # Original SDK CanUse is an authoring classification. Captured native
    # records serialize identical runtime metadata for HumanPlayer/Monster.
    for item in engine.findall('CanUse'):
        if scalar(item) not in ('HumanPlayer', 'Monster'):
            raise ValueError('Unsupported authoring CanUse classification')
    def numeric(tag, default='0'):
        item = engine.find(tag)
        return number(scalar(item) if item is not None else default)
    image = engine.find('ImageIDBase')
    image_id = fourcc(scalar(image)) if image is not None else 0
    shadow = engine.find('ShadowType')
    if shadow is not None and scalar(shadow) != 'Dynamic':
        raise ValueError('Unsupported shadow type')
    prefix = [info, numeric('Category'), 0, numeric('Menu'), image_id, 0]
    point = engine.find('AttachmentPointID')
    if subtype == 'Overlay':
        value = scalar(point) if point is not None else '0'
        prefix.append(number(value) if value.lstrip('-').isdigit() else fourcc(value))
    elif point is not None:
        raise ValueError('Non-overlay attachment point remains unqualified')
    script = engine.find('Script')
    script_words, function = (0, 0), ''
    if script is not None:
        if set(script.attrib) != {'type', 'cProc', 'GPLFunction'} or len(script):
            raise ValueError('Unsupported authored script route')
        script_words = (number(script.get('type')), number(script.get('cProc')))
        function = script.get('GPLFunction')
        if script_words != (0, 0):
            raise ValueError('Non-GPL engine script route remains unqualified')
        if not function or len(function) > 64 or any(not (x.isascii() and (x.isalnum() or x == '_')) for x in function):
            raise ValueError('Invalid authored script callback')
    overrides = []
    for item in engine.findall('SoundOverride'):
        if set(item.attrib) != {'type', 'ID'} or len(item):
            raise ValueError('Invalid authored sound override')
        overrides.append((resolve(item.get('type'), resources['Action']),
                          resolve(item.get('ID'), resources['Sound'])))
    sound = engine.find('DefaultSound')
    sound_id = resolve(scalar(sound), resources['Sound']) if sound is not None else 0
    payload = (struct.pack('<' + 'I' * len(prefix), *prefix) + struct.pack('<II', *script_words) + text(function) +
               attachments(engine.findall('Attachment'), subtype, resources['Movement']) +
               keyed_map(overrides) + struct.pack('<III', sound_id, 2 if shadow is not None else 0, 0))
    return block(b'PRIM', payload, version=4)


def descriptor(element, resources, game_part=None):
    subtype = element.get('subType')
    if subtype in ('Building', 'Character', 'Overlay') and game_part is None:
        raise ValueError('Complete authored game part required')
    if subtype in ('General', 'Projectile', 'ParticleSystem') and game_part is not None:
        raise ValueError('Unexpected game part for native engine-only kind')
    if subtype in ('General', 'Projectile', 'ParticleSystem') and element.find('Game') is not None:
        raise ValueError('Unsupported authored Game for native engine-only kind')
    parts = [header(element), encode_engine(element, resources)]
    if game_part is not None:
        from .legacy_description_wire import unpack_chunk
        unpack_chunk(game_part, b'SECD')
        parts.append(game_part)
    return block(b'DUNT', block(b'DATA', b''.join(parts), count=len(parts)), count=1)
