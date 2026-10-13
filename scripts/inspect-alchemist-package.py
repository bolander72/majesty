#!/usr/bin/env python3
"""Read-only preflight for the original community package; never install or launch it."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import struct
import xml.etree.ElementTree as ET

CONTRACT = Path(__file__).resolve().parents[1] / 'content/community-mods/alchemist'
LIMIT = 64 * 1024 * 1024
CAM_MAGIC = b'CYLBPC  \x01\x00\x01\x00'
CAMS = ('textdata', 'gpltext', 'miscdata', 'maindata', 'interfacedata', 'audio', 'sounddesc')


def read(root, name):
    """Reject linked or escaping inputs before reading; never touch player directories."""
    path = PurePosixPath(name)
    if (path.is_absolute() or '\\' in name or ':' in name or '\x00' in name
            or any(part in ('', '.', '..') for part in name.split('/'))):
        raise ValueError('Unsafe package path')
    candidate = root
    for part in path.parts:
        candidate /= part
        if candidate.is_symlink():
            raise ValueError(f'Linked package input: {name}')
    if not candidate.is_file():
        raise ValueError(f'Missing original community resource: {name}')
    if candidate.stat().st_size > LIMIT:
        raise ValueError(f'Oversized community resource: {name}')
    if getattr(candidate.stat(), 'st_flags', 0) & 0x40000000:
        raise ValueError(f'Cloud-evicted package input: {name}')
    return candidate.read_bytes()


def xml(raw):
    if b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
        raise ValueError('Package XML may not declare entities')
    return ET.fromstring(raw)


def cam_index(raw):
    """Bound every directory and payload, allowing authored sparse stock TILE slots."""
    if len(raw) < 20 or raw[:12] != CAM_MAGIC:
        raise ValueError('Invalid CAM header')
    sections, header_bytes = struct.unpack_from('<II', raw, 12)
    directory_end = 20 + sections * 8
    payload_start = directory_end + header_bytes
    if not 0 < sections <= 128 or payload_start > len(raw):
        raise ValueError('Invalid CAM section bounds')
    records, spans, cursor, kinds = {}, [], directory_end, set()
    for i in range(sections):
        kind, offset = struct.unpack_from('<4sI', raw, 20 + i * 8)
        if kind in kinds or offset != cursor or offset + 8 > payload_start:
            raise ValueError('Invalid CAM section directory')
        kinds.add(kind)
        count = struct.unpack_from('<I', raw, offset)[0]
        cursor = offset + 8 + count * 28
        if count > 200000 or cursor > payload_start:
            raise ValueError('Invalid CAM record bounds')
        for j in range(count):
            name, start, size = struct.unpack_from('<20sII', raw, offset + 8 + j * 28)
            if start < payload_start or start + size > len(raw):
                raise ValueError('CAM resource exceeds payload bounds')
            if size:
                key = (kind, name.rstrip(b'\x00'))
                if key in records:
                    raise ValueError('Duplicate CAM resource')
                records[key] = size
                spans.append((start, start + size))
    if cursor != payload_start:
        raise ValueError('Unaccounted CAM directory bytes')
    end = payload_start
    for start, stop in sorted(spans):
        if start != end:
            raise ValueError('CAM payload gap or overlap')
        end = stop
    if end != len(raw):
        raise ValueError('Unaccounted CAM payload bytes')
    return records


def inspect(package):
    if package.is_symlink() or not package.is_dir():
        raise ValueError('Require an extracted, unlinked original Alchemist package directory')
    contract = json.loads((CONTRACT / 'source-contract.json').read_text())
    definition_bytes = read(package, 'mod-definition.json')
    expected_bytes = (CONTRACT / 'mod-definition.json').read_bytes()
    if hashlib.sha256(expected_bytes).hexdigest() != contract['definitionSha256']:
        raise ValueError('Pinned source definition and source contract disagree')
    expected = json.loads(expected_bytes)
    if json.loads(definition_bytes) != expected:
        raise ValueError('Community definition differs from the pinned source; review this version first')
    manifest = xml(read(package, 'CustomGuildAlchemist.mmxml'))
    mod = manifest.find('Mod')
    if mod is None or mod.get('id') != expected['mod_id'] or mod.findtext('Name') != expected['internal_name']:
        raise ValueError('Community manifest identity differs')
    files = {'mod-definition.json', 'CustomGuildAlchemist.mmxml', 'Data/Alchemist.bcd'}
    for tag in ('CAM', 'Descriptions', 'Target', 'Source'):
        for node in mod.iter(tag):
            if not node.text:
                raise ValueError('Empty resource reference')
            files.add(node.text.replace('\\', '/'))
    files.update(f'Data/alchemist_{name}.cam' for name in CAMS)
    payloads = {name: read(package, name) for name in sorted(files)}
    if sum(map(len, payloads.values())) > 128 * 1024 * 1024:
        raise ValueError('Package exceeds bounded content size')
    if len(payloads['Data/Alchemist.bcd']) < 1024:
        raise ValueError('Missing complete compiled community gameplay')
    indices = {name: cam_index(payload) for name, payload in payloads.items() if name.endswith('.cam')}
    main = indices['Data/alchemist_maindata.cam']
    for name in (b'ALC1Alchemist', b'ALB1Alchemy Lab 1', b'ALB2Alchemy Lab 2',
                 b'ALB3Alchemy Lab 3', b'PXF1Phoenix Phial'):
        if (b'IMAG', name) not in main:
            raise ValueError(f'Missing authored art identity: {name.decode()}')
    for suffix, kind in [('maindata', b'TILE'), ('interfacedata', b'TILE'),
                         ('audio', b'WAVE'), ('sounddesc', b'DSND')]:
        if not any(key[0] == kind for key in indices[f'Data/alchemist_{suffix}.cam']):
            raise ValueError(f'Missing actual community {suffix} payloads')
    descriptions = xml(payloads['Data/alchemist_units.xml'])
    for identity, cost in [('ALC1', '600'), ('ALB1', '1400'), ('ALB2', '1800'), ('ALB3', '2200')]:
        matching = [d for d in descriptions.findall('Description') if d.get('ID') == identity]
        if len(matching) != 1:
            raise ValueError(f'Missing unique community actor: {identity}')
        item = matching[0]
        for field, value in [('Engine/ImageIDBase', identity), ('Game/Cost', cost)]:
            node = item.find(field)
            if node is None or node.get('value') != value:
                raise ValueError(f'Authored actor contract changed: {identity}/{field}')
    hero = descriptions.find("Description[@ID='ALC1']")
    spells = [(s.get('ID'), s.get('Value')) for s in hero.findall('./Game/AllowedSpells/Spell')]
    if spells != [('0', 'stun_serum'), ('1', 'flash_flask'), ('2', 'miasma_mist')]:
        raise ValueError('Actual Alchemist combat abilities are missing')
    return dict(format='majesty-alchemist-package-inspection-v1',
                sourceCommit=contract['source']['commit'],
                files={name: dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
                       for name, raw in payloads.items()},
                definitionMatchesPinnedSource=True, nativeHooksQualified=False,
                mediaRedistributionQualified=False, browserPlayable=False, published=False,
                scope='Structural preflight only; does not authenticate media origin or establish playability')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('package', type=Path)
    parser.add_argument('--receipt', type=Path, required=True)
    args = parser.parse_args()
    if args.receipt.exists():
        parser.error('Preserve existing receipt; choose another path')
    try:
        result = inspect(args.package)
    except (ValueError, OSError, ET.ParseError) as error:
        parser.exit(1, f'Alchemist preflight refused: {error}\n')
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'filesInspected': len(result['files']), 'browserPlayable': False,
                      'receipt': str(args.receipt)}))


if __name__ == '__main__':
    main()
