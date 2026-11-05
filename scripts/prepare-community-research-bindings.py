#!/usr/bin/env python3
"""Bind authored kingdom research to explicit, source-bound Old actor families."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'third_party/majesty-mod-manager/src'))
from majesty_cam.runtime_features import decode_runtime_feature_registry


def digest(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def encode_bindings(registry, actor_ids):
    if not 1 <= len(registry.kingdom_research) <= 64:
        raise ValueError('Require a bounded nonempty research registry')
    result = bytearray(b'MJR1' + struct.pack('<I', len(registry.kingdom_research)))
    native_families, identities, commands = set(), set(), set()
    rows = []
    for record in registry.kingdom_research:
        family = record.building_family.to_bytes(4, 'little')[:3].decode('ascii')
        targets = [actor_ids.get(family + level) for level in '123']
        if any(not target or len(target) != 4 or target[3] != level
               for target, level in zip(targets, '123')):
            raise ValueError('Research requires explicit matching levels1..3')
        native = targets[0][:3]
        if any(target[:3] != native for target in targets):
            raise ValueError('Research levels must remain one native family')
        if (native in native_families or record.identity in identities or
                record.action_control_id in commands):
            raise ValueError('Duplicate research binding')
        native_families.add(native)
        identities.add(record.identity)
        commands.add(record.action_control_id)
        result.extend(bytes.fromhex(record.identity))
        result.extend(struct.pack('<II', record.building_family,
                                  int.from_bytes(native.encode('ascii'), 'little')))
        rows.append(dict(identity=record.identity, sourceFamily=family, nativeFamily=native,
                         actionControlId=record.action_control_id, requiredLevel=record.required_level))
    return bytes(result), rows


def prepare(source, resources, output):
    if output.exists() or output.is_symlink():
        raise ValueError('Preserve earlier bindings; choose a fresh output')
    source_raw = (source / 'source-stage.json').read_bytes()
    manifest_raw = (resources / 'native-resource-stage.json').read_bytes()
    source_manifest, native = json.loads(source_raw), json.loads(manifest_raw)
    if native['finalResourceContext']['sourceStage'] != digest(source_raw):
        raise ValueError('Native resources do not match the final source')
    spec = importlib.util.spec_from_file_location('native_resource_stager',
        ROOT / 'scripts/stage-community-guild-native-resources.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if native['actorIdentities'] != module.ACTOR_IDS:
        raise ValueError('Native actor relocation differs from the reviewed map')
    feature_raw = (source / 'resources/features.bin').read_bytes()
    if digest(feature_raw) != source_manifest['resourceFiles']['features.bin']:
        raise ValueError('Authored research registry changed')
    registry = decode_runtime_feature_registry(feature_raw)
    raw, rows = encode_bindings(registry, native['actorIdentities'])
    output.mkdir(parents=True)
    (output / 'research-bindings.bin').write_bytes(raw)
    (output / 'research-features.bin').write_bytes(feature_raw)
    receipt = dict(format='majesty-community-research-bindings-v1', sourceStage=digest(source_raw),
        nativeResourceStage=digest(manifest_raw), featureRegistry=digest(feature_raw),
        bindings=digest(raw), rows=rows, nativeGameplayQualified=False, browserPlayable=False,
        published=False)
    (output / 'research-binding-stage.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['source', 'resources', 'out']:
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    try:
        receipt = prepare(args.source, args.resources, args.out)
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, f'Research binding refused: {error}\n')
    print(json.dumps(receipt['rows']))


if __name__ == '__main__':
    main()
