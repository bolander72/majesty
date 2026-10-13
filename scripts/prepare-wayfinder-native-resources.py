#!/usr/bin/env python3
"""Prepare private legacy DUNT resources for the pinned engine; never install."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import xml.etree.ElementTree as ET
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.wayfinder_interface import INTERFACE_ID, clone_interface, encode_interface_cam

ROOT = Path(__file__).resolve().parents[1]
SDK = ROOT / 'upstream/majesty-recomp/original/gog/SDK/OriginalQuests/Data'
UNIT_CAM = ROOT / 'upstream/majesty-recomp/original/gog/Data/unittype.cam'
EXPANSION_CAM = ROOT / 'upstream/majesty-recomp/original/gog/DataMX/mx_unittype.cam'
INTERFACE_CAM = ROOT / 'upstream/majesty-recomp/original/gog/Data/textdata.cam'
EXPANSION_INTERFACE_CAM = ROOT / 'upstream/majesty-recomp/original/gog/DataMX/mx_textdata.cam'
HEADER = b'CYLBPC  \x01\x00\x01\x00'


def resident(path):
    if path.stat().st_flags & 0x40000000:
        raise ValueError(f'Dataless input: {path.name}')
    return path.read_bytes()


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def cam_records(raw):
    if len(raw) < 28 or raw[:12] != HEADER:
        raise ValueError('Unsupported CAM header')
    count, directory_bytes = struct.unpack_from('<II', raw, 12)
    if not 0 < count <= 128 or 20 + count * 8 > len(raw):
        raise ValueError('CAM section count exceeds bounds')
    data_start = 20 + count * 8 + directory_bytes
    if data_start > len(raw):
        raise ValueError('CAM directory exceeds file bounds')
    next_index = 20 + count * 8
    records = {}
    spans = []
    for i in range(count):
        kind, index = struct.unpack_from('<4sI', raw, 20 + i * 8)
        if index != next_index or index + 8 > data_start:
            raise ValueError('Unexpected CAM index layout')
        items = struct.unpack_from('<Q', raw, index)[0]
        if items > 100000 or index + 8 + items * 28 > data_start:
            raise ValueError('CAM item count exceeds bounds')
        next_index = index + 8 + items * 28
        for j in range(items):
            label, offset, size = struct.unpack_from('<20sII', raw, index + 8 + j * 28)
            key = (kind, label[:4])
            if key in records or offset < data_start or offset + size > len(raw):
                raise ValueError('Duplicate or out-of-bounds CAM record')
            records[key] = raw[offset:offset + size]
            spans.append((offset, offset + size))
    if next_index != data_start:
        raise ValueError('CAM directory size differs')
    cursor = data_start
    for start, end in sorted(spans):
        if start != cursor or end <= start:
            raise ValueError('CAM payload overlap or gap')
        cursor = end
    if cursor != len(raw):
        raise ValueError('Unaccounted CAM payload')
    return records


def chunk(raw, expected=None):
    if len(raw) < 16:
        raise ValueError('Truncated descriptor chunk')
    tag, size, version, count = struct.unpack_from('<4sIII', raw)
    if size != len(raw) - 16 or expected is not None and tag != expected:
        raise ValueError('Descriptor chunk differs from its declared shape')
    return tag, version, count, raw[16:]


def children(raw, count):
    parts = []
    at = 0
    for _ in range(count):
        if at + 16 > len(raw):
            raise ValueError('Truncated descriptor child')
        size = struct.unpack_from('<I', raw, at + 4)[0]
        end = at + 16 + size
        if end > len(raw):
            raise ValueError('Descriptor child exceeds parent')
        parts.append(raw[at:end])
        at = end
    if at != len(raw):
        raise ValueError('Descriptor children do not cover parent')
    return parts


def encode_chunk(tag, version, count, payload):
    return struct.pack('<4sIII', tag, len(payload), version, count) + payload


def description(xml, key):
    root = ET.fromstring(xml)
    found = [d for d in root.findall('Description') if d.get('ID') == key]
    if len(found) != 1:
        raise ValueError('Expected one SDK description')
    return found[0]


def legacy_descriptor(raw, base, draft, hero=False):
    _, root_version, root_count, root_payload = chunk(raw, b'DUNT')
    if root_version != 0 or root_count != 1:
        raise ValueError('Unsupported DUNT root')
    data = children(root_payload, 1)[0]
    _, data_version, data_count, payload = chunk(data, b'DATA')
    if data_version != 0 or data_count != 3:
        raise ValueError('Unsupported DUNT data container')
    head, prim, secd = children(payload, 3)
    _, hv, hc, hp = chunk(head, b'HEAD')
    chunk(prim, b'PRIM')
    _, sv, sc, game = chunk(secd, b'SECD')
    expected_kind = 3 if hero else 2
    hero_sizes = {'AVH1': 156, 'AVA1': 164}
    expected_size = hero_sizes.get(base.get('ID')) if hero else 76
    if (hv, hc, sv, sc, len(game)) != (0, 0, 8 if hero else 5, 0, expected_size):
        raise ValueError('Unsupported native descriptor version')
    if len(hp) < 10 or hp[:4] != base.get('ID').encode('ascii') or struct.unpack_from('<I', hp, 4)[0] != expected_kind:
        raise ValueError('Native description identity differs from SDK')
    labels = hp[8:].split(b'\0')
    if labels != [base.get('Name').encode('ascii'), base.get('Description').encode('ascii'), b'']:
        raise ValueError('Native description labels differ from SDK')
    # The pinned original HEAD writer0059ce20 writes ID/kind then two C strings.
    # These narrow SECD fields match the purchased binary and SDK XML. Other
    # game bytes and the complete PRIM/art/attachment payload remain opaque.
    offsets = {'Cost': 4, 'MaxHP': 12, 'SightRange': 16, 'RecruitDelay': 88} if hero else {'Cost': 4, 'MaxHP': 28, 'MaxGuildMembers': 32}
    game = bytearray(game)
    for name, offset in offsets.items():
        original = int(base.find('Game/' + name).get('value'))
        value = int(draft.find('Game/' + name).get('value'))
        if struct.unpack_from('<I', game, offset)[0] != original or not 0 < value < 1000000:
            raise ValueError(f'Native {name} differs from expected SDK baseline')
        struct.pack_into('<I', game, offset, value)
    if hero:
        for name, offset in [('min', 24), ('max', 28)]:
            original = int(base.find('Game/AttackRange').get(name))
            value = int(draft.find('Game/AttackRange').get(name))
            if struct.unpack_from('<I', game, offset)[0] != original or not 0 < value <= 1000:
                raise ValueError('Native attack range differs from SDK baseline')
            struct.pack_into('<I', game, offset, value)
        # SDK/native cross-check: Ranger=Longbow(5), Adept=Staff(8),
        # Warrior=Longsword(6). Keep the same-sized Ranger descriptor and its
        # no-innate-spell tail while selecting the staff equipment family.
        weapons = {'Longbow': 5, 'Staff': 8, 'Longsword': 6}
        old_weapon = base.find('Game/AllowedWeapon').get('value')
        new_weapon = draft.find('Game/AllowedWeapon').get('value')
        if old_weapon not in weapons or new_weapon not in weapons or struct.unpack_from('<I', game, 128)[0] != weapons[old_weapon]:
            raise ValueError('Native weapon family differs from SDK baseline')
        struct.pack_into('<I', game, 128, weapons[new_weapon])
    if not hero:
        original_dialog = base.find('Game/DialogID').get('value').encode('ascii')
        new_dialog = draft.find('Game/DialogID').get('value').encode('ascii')
        if game[:4] != original_dialog or original_dialog != b'AP47' or new_dialog != INTERFACE_ID:
            raise ValueError('Native guild interface identity differs')
        game[:4] = new_dialog
        # In this version the single guild production description is last;
        # refuse any other membership shape rather than editing unknown data.
        if game[72:76] != b'AVH1' or struct.unpack_from('<I', game, 64)[0] != 1:
            raise ValueError('Unsupported guild production description')
        if draft.find('Game/Produces/Unit').get('ID') != 'Wayfinder':
            raise ValueError('Trail Lodge does not produce the new hero')
        game[72:76] = b'AVz1'
    key = draft.get('ID').encode('ascii')
    names = [draft.get('Name').encode('ascii'), draft.get('Description').encode('ascii')]
    if len(key) != 4 or any(b'\0' in n for n in names):
        raise ValueError('Invalid native identity or labels')
    head = encode_chunk(b'HEAD', hv, hc, key + struct.pack('<I', expected_kind) + b'\0'.join(names) + b'\0')
    secd = encode_chunk(b'SECD', sv, sc, game)
    old_image = base.find('Engine/ImageIDBase').get('value').encode('ascii')
    new_image = draft.find('Engine/ImageIDBase').get('value').encode('ascii')
    if new_image != old_image:
        _, pv, pc, payload = chunk(prim, b'PRIM')
        if len(new_image) != 4 or payload.count(old_image) != 1:
            raise ValueError('Native artwork binding differs from its unique baseline')
        prim = encode_chunk(b'PRIM', pv, pc, payload.replace(old_image, new_image, 1))
    data = encode_chunk(b'DATA', data_version, data_count, head + prim + secd)
    return encode_chunk(b'DUNT', root_version, root_count, data)


def encode_cam(records, names=None):
    if not records or any(len(k) != 4 for k in records):
        raise ValueError('Four-character resource identities required')
    index = 28
    directory_bytes = 8 + 28 * len(records)
    data_start = index + directory_bytes
    directory = struct.pack('<Q', len(records))
    payload = b''
    for key, raw in records.items():
        # Purchased native DUNT filenames join the four-character ID and
        # prototype name, e.g. ABW1Rangers_Guild. Keep that native naming
        # convention; the directory field is a filename, not sixteen flags.
        suffix = (names or {}).get(key, '').encode('ascii')
        if len(suffix) > 16 or b'\0' in suffix:
            raise ValueError('Native prototype filename exceeds its directory field')
        directory += struct.pack('<20sII', key + suffix, data_start + len(payload), len(raw))
        payload += raw
    raw = HEADER + struct.pack('<II4sI', 1, directory_bytes, b'DUNT', index) + directory + payload
    if cam_records(raw) != {(b'DUNT', k): v for k, v in records.items()}:
        raise ValueError('Native CAM roundtrip failed')
    return raw


def prepare(pack, stationary_interface=False):
    receipt = json.loads(resident(pack / 'compiled.json'))
    if receipt.get('bytecodeCompiled') is not True or receipt.get('installed') is not False:
        raise ValueError('Verified private compiled pack required')
    files = {}
    for name, record in receipt['files'].items():
        if Path(name).is_absolute() or '..' in Path(name).parts:
            raise ValueError('Unsafe pack path')
        raw = resident(pack / name)
        if sha(raw) != record['sha256'] or len(raw) != record['bytes']:
            raise ValueError('Compiled pack changed')
        files[name] = raw
    base_cam = resident(UNIT_CAM)
    records = cam_records(base_cam)
    expansion_cam = resident(EXPANSION_CAM)
    native_ids = set(records) | set(cam_records(expansion_cam))
    additions = {}
    names = {}
    sources = {str(UNIT_CAM.relative_to(ROOT)): sha(base_cam), str(EXPANSION_CAM.relative_to(ROOT)): sha(expansion_cam)}
    for key, xml, original, base_key, hero in [('AVz1', 'Wayfinder_Characters.xml', 'M_Characters.xml', 'AVH1', True), ('ABs1', 'Wayfinder_Buildings.xml', 'M_Buildings.xml', 'ABW1', False)]:
        if (b'DUNT', key.encode()) in native_ids:
            raise ValueError('New identity collides with original native descriptions')
        source = resident(SDK / original)
        sources[str((SDK / original).relative_to(ROOT))] = sha(source)
        base = description(source, base_key)
        draft = description(files['Data/' + xml], key)
        additions[key.encode()] = legacy_descriptor(records[b'DUNT', base_key.encode()], base, draft, hero)
        names[key.encode()] = draft.get('Name')
    files['Data/Wayfinder-units.cam'] = encode_cam(additions, names)
    interface_raw = resident(INTERFACE_CAM)
    expansion_interface_raw = resident(EXPANSION_INTERFACE_CAM)
    if stationary_interface:
        from lib.wayfinder_v2_interface import stationary_lodge_interface
        interface_builder = stationary_lodge_interface
    else:
        interface_builder = clone_interface
    interface_records = interface_builder(cam_records(interface_raw),
                                        {key[1] for key in cam_records(expansion_interface_raw)})
    interface_cam = encode_interface_cam(interface_records)
    if cam_records(interface_cam) != interface_records:
        raise ValueError('Independent interface CAM roundtrip differs')
    files['Data/Wayfinder-interface.cam'] = interface_cam
    sources[str(INTERFACE_CAM.relative_to(ROOT))] = sha(interface_raw)
    sources[str(EXPANSION_INTERFACE_CAM.relative_to(ROOT))] = sha(expansion_interface_raw)
    files['legacy-load-group.xml'] = b'<WayfinderNativeData><LoadCam>Wayfinder-units.cam</LoadCam><LoadCam>Wayfinder-interface.cam</LoadCam><LoadGPL>Wayfinder.bcd</LoadGPL></WayfinderNativeData>\n'
    report = dict(version=1, status='private-native-resource-draft', nativeIntegrationQualified=False,
                  installed=False, published=False, resourceIds=['AVz1', 'ABs1'], originalNativeIdsChecked=sum(k[0] == b'DUNT' for k in native_ids),
                  compiledPackReceiptSha256=sha(resident(pack / 'compiled.json')), sourceSha256=sources,
                  originalCAMUnmodified=True, originalArtAndAttachmentsPreserved=True,
                  bytecodeUnmodified=True, interfaceId=INTERFACE_ID.decode(),
                  stationaryInterface=stationary_interface, originalRangerInterfaceUnmodified=True,
                  loadGroupInstalled=False, menuIntegrationQualified=False,
                  files={n: dict(bytes=len(b), sha256=sha(b)) for n, b in files.items()})
    return files, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--compiled-pack', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--stationary-interface', action='store_true',
                        help='Use the distinct v2 Lodge panel; preserve v1 defaults')
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('Existing output must be preserved')
    files, report = prepare(args.compiled_pack, stationary_interface=args.stationary_interface)
    args.output.mkdir()
    for name, raw in files.items():
        target = args.output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    (args.output / 'native-resources.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['status', 'resourceIds', 'originalNativeIdsChecked', 'installed']}))


if __name__ == '__main__':
    main()
