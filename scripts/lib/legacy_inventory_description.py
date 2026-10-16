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
    if extension.get('unit') != 'PXF1':
        raise ValueError('Inventory extension/source binding differs')
    return _encode_bound_game(game, names, remap, extension)


def _encode_bound_game(game, names, remap, extension):
    if extension.get('sourceGameSha256') != game_hash(game):
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


def plan_legacy_item(element, modern_raw, item_index, item_attribute):
    """Bind an authored numeric item to the original INV+index representation.

    Phantom's own source assigns slots80..112. Long XML descriptor identifiers
    need a native FourCC, but the full authored name/title and metadata remain
    intact. This is descriptor staging, not runtime or UI qualification.
    """
    if hashlib.sha256(modern_raw).hexdigest() != MODERN_SHA:
        raise ValueError('Inventory metadata requires the audited modern source executable')
    return _legacy_item_metadata(element, item_index, item_attribute)


def _legacy_item_metadata(element, item_index, item_attribute):
    if (element.get('type'), element.get('subType')) != ('Unit', 'Character'):
        raise ValueError('Require an authored character inventory description')
    if element.get('ID') != element.get('Name') or not element.get('Name'):
        raise ValueError('Require an explicit canonical item identity/name binding')
    if not isinstance(item_index, int) or isinstance(item_index, bool) or not 32 <= item_index <= 126:
        raise ValueError('Require a printable native numeric inventory slot')
    if not item_attribute or item_attribute == 'CanDropItem':
        raise ValueError('Require a distinct authored item attribute')
    game = element.find('Game')
    if game is None or game.attrib != {'version': '1'}:
        raise ValueError('Complete authored item game data required')
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
        if name not in ('CanDropItem', item_attribute):
            raise ValueError('Unreviewed inventory attribute: ' + name)
        canonical, key = attribute_key(name)
        values.append(dict(name=name, canonicalName=canonical, nativeKey=key,
                           value=number(item.get('Value'))))
    if len(values) != 2 or {v['name'] for v in values} != {'CanDropItem', item_attribute}:
        raise ValueError('Missing or duplicate authored inventory attributes')
    identity = 'INV' + chr(item_index)
    return dict(format='majesty-legacy-inventory-description-extension-v1', unit=identity,
                canonicalUnit=element.get('ID'), title=element.get('Name'),
                sourceGameSha256=game_hash(game), sourceExecutableSha256=MODERN_SHA,
                flag={'name': 'IsInventoryItem', 'mask': 0x400}, attributes=values,
                numericInventoryIndex=item_index,
                storedInventoryId=int.from_bytes(identity.encode('ascii'), 'little'),
                runtimeRequired=True, nativeRuntimeQualified=False)


def encode_legacy_item_game(element, names, remap, extension):
    """Serialize the bound item while retaining named modern metadata separately."""
    index = extension.get('numericInventoryIndex')
    if not isinstance(index, int) or isinstance(index, bool) or not 32 <= index <= 126:
        raise ValueError('Unverified native inventory slot')
    identity = 'INV' + chr(index)
    if (extension.get('unit') != identity or extension.get('canonicalUnit') != element.get('ID')
            or extension.get('title') != element.get('Name')
            or extension.get('storedInventoryId') != int.from_bytes(identity.encode('ascii'), 'little')):
        raise ValueError('Inventory native/canonical identity binding differs')
    names_in_extension = [a['name'] for a in extension.get('attributes', [])
                          if a.get('name') != 'CanDropItem']
    if len(names_in_extension) != 1:
        raise ValueError('Require one exact authored item attribute')
    # Revalidate the complete plan from source rather than accepting edited
    # sidecar values or silently truncating a long named attribute into a word.
    expected = _legacy_item_metadata(element, index, names_in_extension[0])
    if extension != expected:
        raise ValueError('Inventory metadata/source binding differs')
    # Share only the audited wire serializer; original Phoenix callers retain
    # their exact identity guard and unchanged metadata contract.
    return _encode_bound_game(element.find('Game'), names, remap, extension)
