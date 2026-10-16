#!/usr/bin/env python3
"""Merge authentic three-guild art/audio privately with the creator's pipeline."""
import argparse
import importlib.util
import json
import mmap
from pathlib import Path
import sys
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.community_guild_composition import digest, json_value, stock_named_resources


def prepare(args):
    if args.out.exists() or args.out.is_symlink():
        raise ValueError('Preserve previous media outputs; choose a fresh directory')
    spec = importlib.util.spec_from_file_location('community_media_source_policy',
        ROOT / 'scripts/prepare-community-guild-gpl.py')
    policy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(policy)
    policy.verified_git(args.manager, policy.MANAGER_COMMIT)
    proof_raw = (args.source / 'source-stage.json').read_bytes()
    proof = json.loads(proof_raw)
    if (proof.get('format') != 'majesty-community-combined-creator-gpl-stage-v1'
            or not proof.get('finalResourceContext') or proof.get('legacyFunctionAliases')
            or proof.get('managerCommit') != policy.MANAGER_COMMIT):
        raise ValueError('Require authentic unaliased final resource-context source')
    for name, expected in proof['resourceFiles'].items():
        path = args.source / 'resources' / name
        if (Path(name).name != name or path.is_symlink() or path.stat().st_size > 16 * 1024 * 1024
                or digest(path.read_bytes()) != expected):
            raise ValueError('Prepared resource view changed: ' + name)
    sys.path.insert(0, str(args.manager / 'src'))
    from majesty_cam import compose as c
    from majesty_cam.package import load_package, load_mod_definition
    from majesty_cam.descriptions import parse_descriptions

    selected = (
        c.SelectedMod('alchemist', load_package(args.alchemist_package)),
        c.SelectedMod('bards', load_package(args.bards_package)),
        c.SelectedMod('phantom', load_package(args.source / 'phantom-source-package',
            definition=load_mod_definition(args.manager / 'profiles/poc/phantoms-haunt.mod-definition.json'))),
    )
    # Bind every original source/media file again; no unreviewed package can
    # acquire an existing compiled source proof merely by retaining its GUID.
    inspector = policy.module('community_media_inspection', ROOT / 'scripts/inspect-community-guild-package.py')
    for identity, path in [('bards-hall', args.bards_package), ('phantoms-haunt', args.phantom_package)]:
        contract = json.loads((ROOT / 'content/community-mods' / identity / 'source-contract.json').read_text())
        if inspector.inspect(path, contract) != proof['packages'][identity]:
            raise ValueError('Package differs from prepared source: ' + identity)
    alchemist = policy.module('community_media_alchemist', ROOT / 'scripts/inspect-alchemist-package.py')
    if alchemist.inspect(args.alchemist_package)['files'] != proof['alchemistPackageFiles']:
        raise ValueError('Alchemist package differs from prepared source')
    # The recovered Phantom source package has an intentionally extended
    # manifest, but its original media must still match the acquired originals.
    phantom_inventory = proof.get('preparedPhantomFiles')
    if not phantom_inventory:
        raise ValueError('Require source-bound recovered Phantom manifest and files')
    for name, expected in phantom_inventory.items():
        path = args.source / 'phantom-source-package' / name
        if (Path(name).is_absolute() or '..' in Path(name).parts or path.is_symlink()
                or path.stat().st_size > 64 * 1024 * 1024 or digest(path.read_bytes()) != expected):
            raise ValueError('Recovered Phantom package changed: ' + name)
    inventories = tuple(map(c.inventory_package, selected))
    fixture = args.source / 'stock-fixture'
    from lib.community_guild_composition import declared_archives
    for relative, path in declared_archives(fixture):
        expected = proof['stockFixture']['camArchives'][relative.as_posix()]
        with path.open('rb') as stream, mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as raw:
            if digest(raw) != expected:
                raise ValueError('Original art ancestry changed: ' + str(relative))
    descriptions = SimpleNamespace(document=parse_descriptions(
        (args.source / 'resources/merged_descriptions.xml').read_bytes()))
    features = c.resolve_runtime_feature_registry(inventories)
    print('Verified original media and final resource-context bindings', flush=True)
    required = ({row.image_id.encode('ascii') for row in features.equipment}
                | ({b'IX93'} if features.enchantment_rows else set())
                | ({b'INTn', b'IX93'} if features.hero_info_rows else set()))
    art = c.merge_art_resource_domains(fixture, inventories,
        required_stock_imag_ids=tuple(sorted(required)),
        description_imag_ids=c._description_imag_ids(descriptions))
    art = c.bind_equipment_art(art, inventories)
    print('Merged original art lineages and equipment frames', flush=True)
    named = stock_named_resources(fixture, {resource.key for inventory in inventories
        for resource in inventory.resources if resource.section == b'WAVE'})
    audio, sound, selections = c.merge_sound_resources(inventories, stock_named_resources=named)
    strings = c.merge_string_resources(inventories,
        stock_records=c.load_effective_stock_strings(fixture)[0].index)
    payloads = {'merged_audio.cam': audio.to_bytes(), 'merged_sounddesc.cam': sound.to_bytes()}
    payloads.update({f'merged_{result.domain}.cam': result.archive.to_bytes() for result in art})
    if strings is not None:
        payloads['merged_strings.xml'] = strings.payload
    args.out.mkdir(parents=True)
    for name, raw in payloads.items():
        (args.out / name).write_bytes(raw)
    receipt = dict(format='majesty-community-creator-media-stage-v1',
        sourceStage=digest(proof_raw), managerCommit=policy.MANAGER_COMMIT,
        files={name: digest(raw) for name, raw in payloads.items()},
        artRelocations={result.domain: c._art_report_payload(result) for result in art},
        soundSelections=[dict(section=row.section.decode('ascii'), key=row.key.decode('ascii'),
                              owners=list(row.owners), payload=digest(row.entry.data))
                         for row in selections],
        requiredStockImageIds=json_value(sorted(required)),
        nativeRuntimeQualified=False, browserPlayable=False, published=False)
    (args.out / 'media-stage.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('source', 'manager', 'alchemist-package', 'bards-package', 'phantom-package', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    try:
        receipt = prepare(args)
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, f'Community media preparation refused: {error}\n')
    print(json.dumps(dict(files=receipt['files'], browserPlayable=False, published=False)))


if __name__ == '__main__':
    main()
