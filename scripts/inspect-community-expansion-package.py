#!/usr/bin/env python3
"""Verify original expansion packages without installing content or touching saves."""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    'expansion_package_primitives', ROOT / 'scripts/inspect-alchemist-package.py')
PRIMITIVES = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PRIMITIVES)
MAX_PACKAGE_BYTES = 256 * 1024 * 1024


def digest(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def inspect(package, contract):
    if (contract.get('format') != 'majesty-community-expansion-source-contract-v1'
            or contract.get('fullPackageAcquired') is not True):
        raise ValueError('Require an acquired original expansion contract')
    if package.is_symlink() or not package.is_dir():
        raise ValueError('Require an unlinked extracted package')
    inventory = contract['packageFiles']
    encoded = json.dumps(inventory, sort_keys=True, separators=(',', ':')).encode()
    if hashlib.sha256(encoded).hexdigest() != contract['packageInventorySha256']:
        raise ValueError('Package inventory contract changed')
    if (not inventory or len(inventory) > 4096
            or sum(row['bytes'] for row in inventory.values()) > MAX_PACKAGE_BYTES):
        raise ValueError('Package exceeds bounded inventory')
    actual = set()
    for path in package.rglob('*'):
        if path.is_symlink():
            raise ValueError('Linked package input')
        if path.is_file():
            actual.add(path.relative_to(package).as_posix())
    if actual != set(inventory):
        raise ValueError('Package inventory differs from the acquired original')
    payloads = {}
    for name, expected in inventory.items():
        raw = PRIMITIVES.read(package, name)
        if digest(raw) != expected:
            raise ValueError('Original package resource changed: ' + name)
        payloads[name] = raw
    manifest = PRIMITIVES.xml(payloads[contract['manifestFilename']])
    mods = manifest.findall('Mod')
    if (len(mods) != 1 or mods[0].get('id') != contract['canonicalGuid']
            or mods[0].findtext('Name') != contract['internalName']):
        raise ValueError('Expansion manifest identity changed')
    referenced = set()
    for tag in ('CAM', 'Descriptions', 'Strings', 'Source', 'Target'):
        for node in mods[0].iter(tag):
            if not node.text:
                raise ValueError('Empty expansion resource reference')
            name = node.text.replace('\\', '/')
            PRIMITIVES.read(package, name)
            referenced.add(name)
    if not set(contract['requiredMedia']).issubset(referenced):
        raise ValueError('Manifest omits original expansion media')
    indices = {}
    for name in referenced:
        raw = payloads.get(name)
        if raw is None:
            raise ValueError('Referenced file is outside the acquired inventory')
        if name.casefold().endswith('.cam'):
            indices[name] = PRIMITIVES.cam_index(raw)
        elif name.casefold().endswith('.xml'):
            PRIMITIVES.xml(raw)
        elif name.casefold().endswith('.bcd'):
            if (len(raw) < 1024 or struct.unpack_from('<III', raw)
                    != (len(raw) - 4, len(raw) - 4, 0xffffffff)):
                raise ValueError('Invalid compiled expansion gameplay')
    for name, entries in contract.get('requiredCamRecords', {}).items():
        for kind, key in entries:
            if (kind.encode('ascii'), key.encode('ascii')) not in indices.get(name, {}):
                raise ValueError('Missing original expansion CAM record: ' + key)
    definition_name = contract.get('definitionFilename', 'mod-definition.json')
    definition = json.loads(payloads[definition_name]) if definition_name else None
    if definition is not None and (
            definition.get('mod_id') != contract['canonicalGuid']
            or definition.get('internal_name') != contract['internalName']):
        raise ValueError('Expansion declaration identity changed')
    features = Counter(row['type'] for row in definition.get('runtime_features', ())) if definition else Counter()
    if dict(features) != contract['runtimeFeatureCounts']:
        raise ValueError('Expansion feature declarations changed')
    return dict(format='majesty-community-expansion-package-inspection-v1',
        id=contract['id'], packageInventorySha256=contract['packageInventorySha256'],
        filesInspected=len(payloads), bytesInspected=sum(map(len, payloads.values())),
        originalMediaPresent=True, runtimeFeatureCounts=dict(features),
        nativeHooksQualified=False, browserPlayable=False, published=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('package', type=Path)
    parser.add_argument('--contract', type=Path, required=True)
    parser.add_argument('--receipt', type=Path, required=True)
    args = parser.parse_args()
    if args.receipt.exists():
        parser.error('Preserve existing evidence; choose a fresh receipt')
    result = inspect(args.package, json.loads(args.contract.read_text()))
    args.receipt.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))
