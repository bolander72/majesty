#!/usr/bin/env python3
"""Validate acquired Bards/Phantoms packages without installing or launching them."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    'community_package_primitives', Path(__file__).with_name('inspect-alchemist-package.py'))
PRIMITIVES = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PRIMITIVES)
SUPPORTED = {'bards-hall': 'bards', 'phantoms-haunt': 'phantom'}


def inspect(package, contract):
    """Bind every input to the acquired Workshop version, including original media."""
    prefix = SUPPORTED.get(contract.get('id'))
    if prefix is None or not contract.get('fullPackageAcquired'):
        raise ValueError('Require a supported, acquired guild package')
    if package.is_symlink() or not package.is_dir():
        raise ValueError('Require an unlinked package directory')
    expected = contract['workshopPackageFiles']
    inventory_digest = hashlib.sha256(json.dumps(
        expected, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    if inventory_digest != contract['packageInventorySha256']:
        raise ValueError('Pinned inventory digest differs')
    actual = set()
    for path in package.rglob('*'):
        if path.is_symlink():
            raise ValueError('Linked package input')
        if path.is_file():
            actual.add(path.relative_to(package).as_posix())
    if actual != set(expected):
        raise ValueError('Package file inventory differs from acquired Workshop version')
    if sum(record['bytes'] for record in expected.values()) > 128 * 1024 * 1024:
        raise ValueError('Package exceeds bounded content size')
    payloads = {}
    for name, record in expected.items():
        raw = PRIMITIVES.read(package, name)
        if len(raw) != record['bytes'] or hashlib.sha256(raw).hexdigest() != record['sha256']:
            raise ValueError(f'Acquired resource changed: {name}')
        payloads[name] = raw
    manifest = PRIMITIVES.xml(payloads[contract['manifestFilename']])
    mods = manifest.findall('Mod')
    if (len(mods) != 1 or mods[0].get('id') != contract['canonicalGuid']
            or mods[0].findtext('Name') != contract['internalName']):
        raise ValueError('Community manifest identity differs')
    referenced = set()
    for tag in ('CAM', 'Descriptions', 'Source', 'Target'):
        for node in mods[0].iter(tag):
            if not node.text:
                raise ValueError('Empty resource reference')
            name = node.text.replace('\\', '/')
            PRIMITIVES.read(package, name)
            referenced.add(name)
    if not set(contract['requiredMedia']).issubset(referenced):
        raise ValueError('Manifest omits required original media')
    raw = payloads[contract['compiledGameplay']]
    if len(raw) < 1024 or struct.unpack_from('<III', raw) != (len(raw) - 4, len(raw) - 4, 0xffffffff):
        raise ValueError('Invalid compiled gameplay container')
    indices = {name: PRIMITIVES.cam_index(raw) for name, raw in payloads.items()
               if name.lower().endswith('.cam')}
    main = indices[f'Data/{prefix}_maindata.cam']
    for name in contract['expectedArt']:
        if (b'IMAG', name.encode('ascii')) not in main:
            raise ValueError(f'Missing original guild artwork: {name}')
    for suffix, kind in [('maindata', b'TILE'), ('interfacedata', b'TILE'),
                         ('voices', b'WAVE'), ('sounddesc', b'DSND')]:
        if not any(key[0] == kind for key in indices[f'Data/{prefix}_{suffix}.cam']):
            raise ValueError(f'Missing original guild {suffix}')
    units = PRIMITIVES.xml(payloads[f'Data/{prefix}_units.xml'])
    for identity, cost in contract['expectedActorCosts'].items():
        matches = units.findall(f"Description[@ID='{identity}']")
        if len(matches) != 1:
            raise ValueError(f'Missing unique guild actor: {identity}')
        field = matches[0].find('Game/Cost')
        if field is None or field.get('value') != cost:
            raise ValueError(f'Guild actor cost changed: {identity}')
    return dict(format='majesty-community-guild-package-inspection-v1',
                id=contract['id'], workshopManifest=contract['workshopManifest'],
                inventorySha256=inventory_digest, filesInspected=len(payloads),
                bytesInspected=sum(map(len, payloads.values())),
                originalMediaPresent=True, nativeHooksQualified=False,
                browserPlayable=False, published=False,
                scope='Exact acquired package and structural validation only; gameplay remains unqualified')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mod', choices=SUPPORTED)
    parser.add_argument('package', type=Path)
    parser.add_argument('--receipt', type=Path, required=True)
    args = parser.parse_args()
    if args.receipt.exists():
        parser.error('Preserve existing receipt; choose another path')
    contract = json.loads((ROOT / 'content/community-mods' / args.mod / 'source-contract.json').read_text())
    try:
        result = inspect(args.package, contract)
    except (ValueError, OSError, KeyError, ET.ParseError, struct.error) as error:
        parser.exit(1, f'Community guild preflight refused: {error}\n')
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
