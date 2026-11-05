#!/usr/bin/env python3
"""Prepare an isolated Old equipment-resource probe, not a playable guild pack."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.legacy_description_wire import cam_payloads
from lib.native_sprite_art import encode_cam


def digest(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def prepare(args):
    if args.out.exists() or args.out.is_symlink():
        raise ValueError('Preserve previous trials; choose a fresh output')
    if args.out.resolve().is_relative_to(args.game.resolve()):
        raise ValueError('Keep trial outputs outside the source game')
    source_raw = (args.source / 'source-stage.json').read_bytes()
    source = json.loads(source_raw)
    media_raw = (args.media / 'media-stage.json').read_bytes()
    media = json.loads(media_raw)
    if (not source.get('finalResourceContext') or media.get('sourceStage') != digest(source_raw)
            or media.get('format') != 'majesty-community-creator-media-stage-v1'):
        raise ValueError('Require source-bound final creator resource views')
    resources = {}
    for name, path, expected in (
            ('community-equipment-gpltext.cam', args.source / 'resources/merged_gpltext.cam',
             source['resourceFiles']['merged_gpltext.cam']),
            ('community-equipment-interface.cam', args.media / 'merged_interface.cam',
             media['files']['merged_interface.cam'])):
        raw = path.read_bytes()
        if path.is_symlink() or digest(raw) != expected:
            raise ValueError('Prepared equipment media changed: ' + name)
        resources[name] = raw
    feature_raw = (args.source / 'resources/features.bin').read_bytes()
    if digest(feature_raw) != source['resourceFiles']['features.bin']:
        raise ValueError('Prepared equipment registry changed')
    module_raw = args.module.read_bytes()
    args.out.mkdir(parents=True)
    game = args.out / 'game'
    game.mkdir()
    for path in sorted(args.game.rglob('*')):
        target = game / path.relative_to(args.game)
        if path.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            if getattr(path.stat(), 'st_flags', 0) & 0x40000000:
                raise ValueError('Unavailable native game input')
            target.symlink_to(path.resolve(strict=True))
    patches = {}
    for name in ['Data/miscdata.cam', 'DataMX/mx_miscdata.cam']:
        target = game / name
        payloads = cam_payloads(target.read_bytes())
        # Old consumes DATA/XML1 in native miscdata, not the modern external
        # MajestyDatasetDefinitions.xml. Preserve all existing native groups.
        configuration = ET.fromstring(payloads[b'DATA', b'XML1'])
        groups = configuration.findall('./DataGroups/LoadData/*')
        if not groups:
            raise ValueError('Missing original native data groups')
        for group in groups:
            for filename in resources:
                if any(child.tag == 'LoadCAM' and child.text == filename for child in group):
                    raise ValueError('Equipment resources were already staged')
                ET.SubElement(group, 'LoadCAM').text = filename
        payloads[b'DATA', b'XML1'] = ET.tostring(configuration)
        sections = [(kind, [(key, raw) for (extension, key), raw in payloads.items()
                             if extension == kind]) for kind in dict.fromkeys(k for k, _ in payloads)]
        raw = encode_cam(sections)
        if target.is_symlink():
            target.unlink()
        target.write_bytes(raw)
        patches[name] = digest(raw)
        for filename, raw in resources.items():
            destination = target.parent / filename
            if destination.exists() or destination.is_symlink():
                raise ValueError('Private resource filename is occupied')
            destination.write_bytes(raw)
            patches[destination.relative_to(game).as_posix()] = digest(raw)
    trial = args.out / 'trial'
    (trial / 'profile').mkdir(parents=True)
    (trial / 'frames').mkdir()
    # Only owned neutral settings are seeded. No GMP, quest progress, browser
    # storage, or user profile is copied or opened by the trial.
    for name in ['registry.json', 'mod-settings.json']:
        path = args.profile_seed / name
        if path.is_file():
            shutil.copyfile(path, trial / 'profile' / name)
    mod = trial / 'user-mods/alchemist-probe'
    mod.mkdir(parents=True)
    for name in ['mod.toml', 'features.bin', 'controllers.bin', 'shared-overrides.tsv']:
        shutil.copyfile(args.seed_mod / name, mod / name)
    (mod / 'alchemist_native_probe.dylib').write_bytes(module_raw)
    (mod / 'equipment-features.bin').write_bytes(feature_raw)
    script = ['await picture>0.80 for 2000 within 35000']
    for x, y, delay in [(90, 548, 1800), (300, 428, 2200), (400, 403, 1800),
                         (400, 578, 1800), (400, 237, 7000), (400, 578, 9000)]:
        script += [f'move {x} {y}', 'wait 250', 'button left down', 'wait 300',
                   'button left up', f'wait {delay}']
    script += ['dump native-equipment-world', 'wait 3000', 'dump native-equipment-checked']
    (trial / 'input.script').write_text('\n'.join(script) + '\n')
    receipt = dict(format='majesty-community-native-equipment-probe-stage-v1',
        sourceStage=digest(source_raw), mediaStage=digest(media_raw), gamePatches=patches,
        module=digest(module_raw), featureRegistry=digest(feature_raw),
        sources={name: digest((ROOT / 'native/community' / name).read_bytes()) for name in (
            'equipment_registration.h', 'native_probe_plugin.cpp')},
        freshOwnedProfile=True, newGuildActorsInstalled=False,
        ordinaryGuildGameplayQualified=False, browserPlayable=False, published=False)
    (args.out / 'probe-stage.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['game', 'source', 'media', 'module', 'seed-mod', 'profile-seed', 'out']:
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    try:
        receipt = prepare(args)
    except (ValueError, OSError, KeyError, ET.ParseError) as error:
        parser.exit(1, f'Native equipment probe refused: {error}\n')
    print(json.dumps(dict(module=receipt['module'], newGuildActorsInstalled=False,
                          ordinaryGuildGameplayQualified=False)))


if __name__ == '__main__':
    main()
