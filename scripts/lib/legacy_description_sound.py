"""Audited legacy single-selection DSND layout; original waveform bytes stay intact."""
import math
import struct

from .legacy_description_engine import block, text
from .legacy_description_game import fourcc, scalar
from .legacy_description_wire import unpack_chunk, children

# Shared by stock Arena, Graveyard, Tavern and UI Click1 selection descriptors.
SELECT_PHASE = 810308421


def sound_parts(raw):
    _, version, count, payload = unpack_chunk(raw, b'DSND')
    if (version, count) != (0, 1):
        raise ValueError('Unsupported sound descriptor root')
    _, version, count, body = unpack_chunk(children(payload, 1)[0], b'DATA')
    if version != 0 or count != 2 or len(body) < 16:
        raise ValueError('Unsupported sound descriptor body')
    head_end = 16 + struct.unpack_from('<I', body, 4)[0]
    if head_end > len(body):
        raise ValueError('Sound HEAD exceeds body')
    head = body[:head_end]
    _, version, count, value = unpack_chunk(head, b'HEAD')
    if (version, count) != (0, 0) or len(value) < 10 or value[-2:] != b'\0\0':
        raise ValueError('Unsupported sound descriptor HEAD')
    # Phase data is outside the fixed eight-byte PRIM chunk, as in stock.
    engine = body[head_end:]
    if len(engine) < 32 or struct.unpack_from('<4sIII', engine) != (b'PRIM', 8, 3, 0):
        raise ValueError('Unsupported sound engine layout')
    phases = struct.unpack_from('<Q', engine, 24)[0]
    # Voice phases can carry extra alternative WAVE entries. Preserve those
    # acquired tails opaquely; only the single-selection encoder below claims
    # full field conversion. Each phase has at least the stock 56-byte prefix.
    if phases > 128 or len(engine) < 32 + phases * 56 or (not phases and len(engine) != 32):
        raise ValueError('Sound phase vector exceeds bounds')
    return head, engine


def selection_sound(element):
    """Encode only the complete stock selection contract, refusing extra fields."""
    if (element.get('type'), element.get('subType')) != ('Sound', 'Standard'):
        raise ValueError('Require a standard sound descriptor')
    if set(element.attrib) - {'type', 'subType', 'ID', 'Name', 'Description'}:
        raise ValueError('Unsupported sound descriptor attribute')
    if len(element) != 1 or element[0].tag != 'Engine':
        raise ValueError('Require one complete sound Engine')
    engine = element[0]
    if engine.attrib != {'version': '1'} or [n.tag for n in engine] != ['Category', 'Phase']:
        raise ValueError('Unsupported selection sound engine')
    if scalar(engine[0]) != '0' or engine[1].attrib != {'ID': 'Select'}:
        raise ValueError('Unsupported selection sound category/phase')
    phase = engine[1]
    if [n.tag for n in phase] not in (['Wave'], ['Wave', 'DistanceModifier']):
        raise ValueError('Unsupported selection sound phase field')
    wave = fourcc(scalar(phase[0]))
    distance = float(scalar(phase[1])) if len(phase) == 2 else 0.0
    if not math.isfinite(distance) or not 0 <= distance <= 3.4028234663852886e38:
        raise ValueError('Invalid sound distance modifier')
    head = block(b'HEAD', struct.pack('<II', fourcc(element.get('ID')), 1)
                 + text(element.get('Name', '')) + text(element.get('Description', '')))
    phase_raw = struct.pack('<13If', SELECT_PHASE, wave, *([0] * 11), distance)
    body = head + block(b'PRIM', bytes(8), version=3) + struct.pack('<Q', 1) + phase_raw
    raw = block(b'DSND', block(b'DATA', body, count=2), count=1)
    sound_parts(raw)
    return raw


def clone_selection_sound(element, ancestor, ancestor_raw, available_waves):
    """Require an exact native ancestor before changing just identity and WAVE."""
    if selection_sound(ancestor) != ancestor_raw:
        raise ValueError('Stock selection sound does not reproduce native bytes')
    original_head, original_engine = sound_parts(ancestor_raw)
    target = selection_sound(element)
    head, engine = sound_parts(target)
    wave = element.find('Engine/Phase/Wave').get('value')
    if wave.encode('ascii') not in available_waves:
        raise ValueError('Selection sound references unavailable original audio')
    # This adaptation changes no category, phase, group, frequency, distance or
    # cooldown policy. WAVE occupies phase word1 at engine+36.
    if engine[:36] != original_engine[:36] or engine[40:] != original_engine[40:]:
        raise ValueError('Selection sound differs beyond identity/WAVE')
    if head[20:24] != original_head[20:24]:
        raise ValueError('Selection sound native subtype changed')
    return target
