"""Serialize complete authored particle parameters using the pinned PRIM-v5 layout."""
import math
import struct

from .legacy_description_engine import INFO, block, text
from .legacy_description_game import number, fourcc, scalar, resolve, keyed_map


def unique(element, allowed, repeated=()):
    if element is None:
        raise ValueError('Complete authored particle component required')
    seen = set()
    for item in element:
        if item.tag not in allowed or item.tag in seen and item.tag not in repeated:
            raise ValueError('Unsupported or duplicate particle field: ' + item.tag)
        seen.add(item.tag)


def real(value):
    try:
        result = float(value)
        if not math.isfinite(result):
            raise ValueError('Nonfinite particle value')
        return struct.pack('<f', result)
    except (TypeError, OverflowError, struct.error) as error:
        raise ValueError('Particle value exceeds float32 bounds') from error


def vector(value, size):
    parts = value.split(',')
    if len(parts) != size:
        raise ValueError('Particle vector dimension differs')
    return b''.join(real(part.strip()) for part in parts)


def float_field(element, tag, size=1):
    item = element.find(tag)
    if item is None:
        return bytes(size * 4)
    value = scalar(item)
    return real(value) if size == 1 else vector(value, size)


def integer_field(element, tag):
    item = element.find(tag)
    return struct.pack('<I', number(scalar(item)) if item is not None else 0)


def encode_particle_engine(element, resources):
    engine = element.find('Engine')
    if engine is None or engine.attrib != {'version': '1'}:
        raise ValueError('Complete particle Engine version1 required')
    unique(engine, {'Info', 'CanUse', 'Menu', 'ImageIDBase', 'AttachmentPointID', 'Category',
                    'ShadowType', 'InitialParticles', 'MaxParticles', 'Bounds', 'Emitter',
                    'Particle', 'Script', 'DefaultSound'}, ('Info', 'CanUse'))
    flags = set()
    info = 0
    for item in engine.findall('Info'):
        flag = scalar(item)
        if flag not in INFO or flag in flags:
            raise ValueError('Unsupported or duplicate particle Info flag')
        flags.add(flag)
        info |= INFO[flag]
    for item in engine.findall('CanUse'):
        if scalar(item) not in ('HumanPlayer', 'Monster'):
            raise ValueError('Unsupported particle authoring classification')
    menu = engine.find('Menu')
    category = engine.find('Category')
    image = engine.find('ImageIDBase')
    point = engine.find('AttachmentPointID')
    point_value = scalar(point) if point is not None else '0'
    prefix = struct.pack('<6I', info, number(scalar(category)) if category is not None else 0, 0,
                         number(scalar(menu)) if menu is not None else 0,
                         fourcc(scalar(image)) if image is not None else 0,
                         number(point_value) if point_value.lstrip('-').isdigit() else fourcc(point_value))
    prefix += integer_field(engine, 'InitialParticles') + integer_field(engine, 'MaxParticles')
    bounds = engine.find('Bounds')
    if bounds is None or set(bounds.attrib) != {'min', 'max'} or len(bounds):
        raise ValueError('Complete particle bounds required')
    prefix += vector(bounds.get('min'), 3) + vector(bounds.get('max'), 3)
    emitter = engine.find('Emitter')
    unique(emitter, {'Type', 'Velocity', 'Acceleration', 'Offset', 'SurfaceNormal', 'Radius',
                     'RadiusVariance', 'DirectionVariance', 'Rate', 'Lifespan', 'Recycle', 'Flags'}, ('Type', 'Flags'))
    emitter_type = 0
    types = set()
    for item in emitter.findall('Type'):
        value = scalar(item)
        if value not in {'Point': 1, 'Area': 2, 'Disk': 4, 'Column': 8} or value in types:
            raise ValueError('Unsupported or duplicate emitter type')
        types.add(value)
        emitter_type |= {'Point': 1, 'Area': 2, 'Disk': 4, 'Column': 8}[value]
    em = struct.pack('<I', emitter_type)
    for tag in ('Velocity', 'Acceleration', 'Offset', 'SurfaceNormal'):
        em += float_field(emitter, tag, 3)
    for tag in ('Radius', 'RadiusVariance', 'DirectionVariance', 'Rate'):
        em += float_field(emitter, tag)
    em += integer_field(emitter, 'Lifespan') + integer_field(emitter, 'Recycle')
    flags = set()
    em_flags = 0
    for item in emitter.findall('Flags'):
        value = scalar(item)
        if value not in {'IsPausable': 1, 'IsPerformanceHog': 2} or value in flags:
            raise ValueError('Unsupported or duplicate emitter flag')
        flags.add(value)
        em_flags |= {'IsPausable': 1, 'IsPerformanceHog': 2}[value]
    em += struct.pack('<I', em_flags)
    particle = engine.find('Particle')
    unique(particle, {'Lifespan', 'LifespanVariance', 'InitialSpeed', 'InitialSpeedVariance', 'Gravity',
                      'BirthColor', 'MidlifeColor', 'DeathColor', 'BirthSize', 'MaxSize', 'DeathSize',
                      'SizeTime', 'FadeTime', 'JitterOrientation', 'JitterDisplacement',
                      'BirthSpinRate', 'MidlifeSpinRate', 'DeathSpinRate'})
    part = integer_field(particle, 'Lifespan')
    for tag in ('LifespanVariance', 'InitialSpeed', 'InitialSpeedVariance'):
        part += float_field(particle, tag)
    part += float_field(particle, 'Gravity', 3)
    for tag in ('BirthColor', 'MidlifeColor', 'DeathColor'):
        part += float_field(particle, tag, 4)
    for tag in ('BirthSize', 'MaxSize', 'DeathSize'):
        part += float_field(particle, tag)
    for tag in ('SizeTime', 'FadeTime'):
        item = particle.find(tag)
        if item is None:
            part += bytes(8)
            continue
        if set(item.attrib) != {'in', 'out'} or len(item):
            raise ValueError('Complete particle ' + tag + ' required')
        part += real(item.get('in')) + real(item.get('out'))
    part += float_field(particle, 'JitterOrientation', 3) + float_field(particle, 'JitterDisplacement', 3)
    for tag in ('BirthSpinRate', 'MidlifeSpinRate', 'DeathSpinRate'):
        part += float_field(particle, tag)
    part += bytes(8)  # Two native reserved float fields have no authored XML property.
    script = engine.find('Script')
    script_data = bytes(8) + b'\0'
    if script is not None:
        if set(script.attrib) != {'type', 'cProc', 'GPLFunction'} or len(script):
            raise ValueError('Unsupported particle script declaration')
        if (number(script.get('type')), number(script.get('cProc'))) != (0, 0):
            raise ValueError('Non-GPL particle script route remains unqualified')
        script_data = bytes(8) + text(script.get('GPLFunction'))
    sound = engine.find('DefaultSound')
    sound_id = resolve(scalar(sound), resources['Sound']) if sound is not None else 0
    shadow = engine.find('ShadowType')
    if shadow is not None and scalar(shadow) != 'Dynamic':
        raise ValueError('Unsupported particle shadow type')
    assert len(prefix) == 56 and len(em) == 80 and len(part) == 148
    return block(b'PRIM', prefix + em + part + script_data + keyed_map(()) +
                 struct.pack('<III', sound_id, 2 if shadow is not None else 0, 0), version=5)
