#!/usr/bin/env python3
"""Stage two authentic descriptions for a bounded, unsaved native timing probe."""
import argparse
import importlib.util
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.legacy_description_wire import cam_payloads
from lib.native_sprite_art import encode_cam

spec = importlib.util.spec_from_file_location(
    'equipment_probe', ROOT / 'scripts/prepare-community-equipment-probe.py')
equipment_probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(equipment_probe)
digest = equipment_probe.digest


def prepare(args):
    resources_raw = (args.resources / 'native-resource-stage.json').read_bytes()
    resources = json.loads(resources_raw)
    source = json.loads((args.source / 'source-stage.json').read_bytes())
    if (not resources.get('finalResourceContext') or
            resources['finalResourceContext']['sourceStage'] != digest(
                (args.source / 'source-stage.json').read_bytes())):
        raise ValueError('Require matching final native resource/source contexts')
    selected = []
    for name, key in [('bards-hall-native-action.cam', (b'DACT', b'BMA1')),
                      ('bards-hall-native-unittype.cam', (b'DUNT', b'BME1'))]:
        path = args.resources / name
        raw = path.read_bytes()
        if path.is_symlink() or digest(raw) != resources['files'][name]:
            raise ValueError('Native timing descriptions changed')
        selected.append((key[0], [(key[1], cam_payloads(raw)[key])]))
    # Reuse its checked, isolated native DATA/XML1 loader and original settings
    # handling. Equipment itself is not enabled by this timing trial.
    receipt = equipment_probe.prepare(args)
    receipt['format'] = 'majesty-community-native-spell-timing-probe-v1'
    receipt['nativeResourceStage'] = digest(resources_raw)
    receipt['authoredDescriptionIds'] = ['BMA1', 'BME1']
    receipt['equipmentRuntimeEnabled'] = False
    receipt['controlledSetup'] = 'Original LearnSpell and CreateEffector; no cast, save or guild actor'
    cam = encode_cam(selected)
    filename = 'community-timing-descriptions.cam'
    for folder in ['Data', 'DataMX']:
        target = args.out / 'game' / folder / ('miscdata.cam' if folder == 'Data' else 'mx_miscdata.cam')
        payloads = cam_payloads(target.read_bytes())
        configuration = ET.fromstring(payloads[b'DATA', b'XML1'])
        for group in configuration.findall('./DataGroups/LoadData/*'):
            ET.SubElement(group, 'LoadCAM').text = filename
        payloads[b'DATA', b'XML1'] = ET.tostring(configuration)
        kinds = dict.fromkeys(kind for kind, key in payloads)
        target.write_bytes(encode_cam([(kind, [(key, raw) for (tag, key), raw in payloads.items()
                                               if tag == kind]) for kind in kinds]))
        (target.parent / filename).write_bytes(cam)
        receipt['gamePatches'][target.relative_to(args.out / 'game').as_posix()] = digest(target.read_bytes())
        receipt['gamePatches'][folder + '/' + filename] = digest(cam)
    mod = args.out / 'trial/user-mods/alchemist-probe'
    feature_raw = (args.source / 'resources/features.bin').read_bytes()
    if digest(feature_raw) != source['resourceFiles']['features.bin']:
        raise ValueError('Timing registry source changed')
    (mod / 'timing-features.bin').write_bytes(feature_raw)
    receipt['timingFeatureRegistry'] = digest(feature_raw)
    receipt['sources'] = {name: digest((ROOT / 'native/community' / name).read_bytes()) for name in (
        'gpl_attribute_bridge.h', 'gpl_integer_helpers.h', 'gpl_base_timing_helpers.h',
        'gpl_spell_timing_helpers.h',
        'native_probe_plugin.cpp')}
    if args.research_bindings is not None:
        stage_raw = (args.research_bindings / 'research-binding-stage.json').read_bytes()
        binding_stage = json.loads(stage_raw)
        if (binding_stage['sourceStage'] != digest((args.source / 'source-stage.json').read_bytes()) or
                binding_stage['nativeResourceStage'] != digest(resources_raw)):
            raise ValueError('Research bindings do not match native/source context')
        for name, expected in [('research-bindings.bin', binding_stage['bindings']),
                               ('research-features.bin', binding_stage['featureRegistry'])]:
            raw = (args.research_bindings / name).read_bytes()
            if digest(raw) != expected:
                raise ValueError('Research binding input changed')
            (mod / name).write_bytes(raw)
        receipt['researchBindingStage'] = digest(stage_raw)
        receipt['sources']['gpl_research_helpers.h'] = digest(
            (ROOT / 'native/community/gpl_research_helpers.h').read_bytes())
        receipt['sources']['kingdom_research_descriptors.h'] = digest(
            (ROOT / 'native/community/kingdom_research_descriptors.h').read_bytes())
    (args.out / 'probe-stage.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['game', 'source', 'media', 'resources', 'module', 'seed-mod', 'profile-seed', 'out']:
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--research-bindings', type=Path)
    args = parser.parse_args()
    try:
        receipt = prepare(args)
    except (ValueError, OSError, KeyError, ET.ParseError) as error:
        parser.exit(1, f'Native timing probe refused: {error}\n')
    print(json.dumps(dict(module=receipt['module'], authoredDescriptionIds=receipt['authoredDescriptionIds'],
                         browserPlayable=False, published=False)))


if __name__ == '__main__':
    main()
