"""Preserve newer item metadata separately from the old descriptor's unrelated maps.

The source flag/attribute encoding is verified from the actual modern engine;
the old runtime still needs explicit handlers. This is private staging only.
"""
import copy
import hashlib
import struct
import xml.etree.ElementTree as ET
import zlib

from .legacy_description_game import number

MODERN_SHA = '65c6dd32c3d873c2e320bdaa2de1b00488af85b44573fd0fd82f79a2ffd37792'


def game_hash(game):
    return hashlib.sha256(ET.tostring(game, encoding='utf-8')).hexdigest()


def attribute_key(name):
    # The actual XML alias table resolves CanDropItem to ATTRIB_CanDropItem.
    canonical = 'ATTRIB_CanDropItem' if name == 'CanDropItem' else name
    return canonical, zlib.crc32(canonical.encode('cp1252')) ^ 0xffffffff


def plan(element, modern_raw):
    if hashlib.sha256(modern_raw).hexdigest() != MODERN_SHA:
        raise ValueError('Inventory metadata requires the audited modern source executable')
    if (element.get('type'), element.get('subType'), element.get('ID'), element.get('Name')) != (
            'Unit', 'Character', 'PXF1', 'PhoenixPhial'):
        raise ValueError('Only the acquired actual Phoenix Phial extension is staged')
    game = element.find('Game')
    if game is None or game.attrib != {'version': '1'}:
        raise ValueError('Complete actual item game data required')
    flags = [x.get('value') for x in game.findall('Flags')]
    if flags.count('IsInventoryItem') != 1:
        raise ValueError('Actual inventory flag must be present once')
    attributes = game.find('Attributes')
    if attributes is None or attributes.attrib or len(game.findall('Attributes')) != 1:
        raise ValueError('Actual item attributes required')
    values = []
    for item in attributes:
        if item.tag != 'Attribute' or set(item.attrib) != {'ID', 'Value'} or len(item):
            raise ValueError('Unsupported inventory attribute')
        name = item.get('ID')
        if name not in ('CanDropItem', 'PhoenixPhial'):
            raise ValueError('Unreviewed inventory attribute: ' + name)
        canonical, key = attribute_key(name)
        values.append(dict(name=name, canonicalName=canonical, nativeKey=key, value=number(item.get('Value'))))
    if len(values) != 2 or {x['name'] for x in values} != {'CanDropItem', 'PhoenixPhial'}:
        raise ValueError('Missing or duplicate actual Phial attributes')
    return dict(format='majesty-legacy-inventory-description-extension-v1', unit='PXF1',
                title='PhoenixPhial', sourceGameSha256=game_hash(game),
                sourceExecutableSha256=MODERN_SHA, flag={'name': 'IsInventoryItem', 'mask': 0x400},
                attributes=values, numericInventoryIndex=113, storedInventoryId=0x71564e49,
                runtimeRequired=True, nativeRuntimeQualified=False)


def encode_game(game, names, remap, extension):
    """Keep the flag bits in SECD, keep named metadata in its explicit sidecar.

    The old first map is not the newer native attribute map. No name truncation,
    guessed offsets, added hero behavior or stock item substitution occurs here.
    """
    if extension.get('sourceGameSha256') != game_hash(game) or extension.get('unit') != 'PXF1':
        raise ValueError('Inventory extension/source binding differs')
    if extension.get('flag') != {'name': 'IsInventoryItem', 'mask': 0x400}:
        raise ValueError('Unverified inventory flag encoding')
    if extension.get('sourceExecutableSha256') != MODERN_SHA or extension.get('nativeRuntimeQualified') is not False:
        raise ValueError('Unverified inventory extension source/runtime claim')
    expected = []
    for item in game.find('Attributes'):
        canonical, key = attribute_key(item.get('ID'))
        expected.append(dict(name=item.get('ID'), canonicalName=canonical,
                             nativeKey=key, value=number(item.get('Value'))))
    if extension.get('attributes') != expected:
        raise ValueError('Inventory attributes/extension binding differs')
    clone = copy.deepcopy(game)
    for item in list(clone):
        if (item.tag == 'Flags' and item.get('value') == 'IsInventoryItem') or item.tag == 'Attributes':
            clone.remove(item)
    from .legacy_description_game import encode_character
    raw = bytearray(encode_character(clone, names, remap))
    flags = struct.unpack_from('<I', raw, 16 + 96)[0]
    struct.pack_into('<I', raw, 16 + 96, flags | 0x400)
    return bytes(raw)
