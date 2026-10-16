#!/usr/bin/env python3
"""Prepare authentic three-guild GPL privately; never compile, install or launch it."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
MANAGER_COMMIT = 'b7b36f17cd897c5f95d9e84d6b99194ad6cae6bb'
PHANTOM_COMMIT = 'fed7058cd342a5f9568f964cebdc8797ef6a82e2'


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    sys.modules[name] = result
    spec.loader.exec_module(result)
    return result


def record(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def verified_git(path, commit):
    head = subprocess.check_output(['git', '-C', str(path), 'rev-parse', 'HEAD'], text=True).strip()
    dirty = subprocess.check_output(
        ['git', '-C', str(path), 'status', '--porcelain', '--untracked-files=normal'], text=True)
    if head != commit or dirty:
        raise ValueError('Require clean pinned creator source: ' + path.name)


def stock_fixture(game, output):
    """Keep Windows path spelling normalization out of the installed game."""
    inputs = {}
    for directory in ('SDK', 'Data', 'DataMX'):
        for path in sorted((game / directory).rglob('*')):
            if path.is_symlink():
                raise ValueError('Linked stock fixture input')
            if not path.is_file():
                continue
            suffix = path.suffix.casefold()
            include = (directory == 'SDK' or suffix in ('.xml', '.bcd')
                       or suffix == '.cam' and path.stat().st_size <= 16 * 1024 * 1024)
            if not include:
                continue
            if path.stat().st_size > 64 * 1024 * 1024:
                raise ValueError('Oversized stock source input')
            raw = path.read_bytes()
            relative = path.relative_to(game)
            target = output / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
            inputs[relative.as_posix()] = record(raw)
    raw = (game / 'MajestyHD.exe').read_bytes()
    (output / 'MajestyHD.exe').write_bytes(raw)
    inputs['MajestyHD.exe'] = record(raw)
    manifest = output / 'Data/MajestyDatasetDefinitions.xml'
    raw = manifest.read_bytes()
    original = b'$(MajestyBytecodeDataPath)/Bytecode.bcd'
    normalized = b'$(MajestyBytecodeDataPath)/bytecode.bcd'
    if raw.count(original) == 1:
        manifest.write_bytes(raw.replace(original, normalized))
    elif raw.count(normalized) != 1:
        raise ValueError('Unreviewed stock manifest spelling')
    return dict(inputs=inputs, manifestNormalization=record(manifest.read_bytes()),
                reason='Only Windows-equivalent Bytecode.bcd spelling is normalized in the private fixture')


def prepare(args):
    if args.out.exists():
        raise ValueError('Preserve existing staging output; choose another directory')
    verified_git(args.manager, MANAGER_COMMIT)
    verified_git(args.phantom_source, PHANTOM_COMMIT)
    inspector = module('community_guild_preflight', ROOT / 'scripts/inspect-community-guild-package.py')
    preflights = {}
    for identity, path in [('bards-hall', args.bards_package), ('phantoms-haunt', args.phantom_package)]:
        contract = json.loads((ROOT / 'content/community-mods' / identity / 'source-contract.json').read_text())
        preflights[identity] = inspector.inspect(path, contract)
    alchemist = module('community_alchemist_preflight', ROOT / 'scripts/inspect-alchemist-package.py')
    alchemist_inspection = alchemist.inspect(args.alchemist_package)
    args.out.mkdir(parents=True)
    fixture = args.out / 'stock-fixture'
    fixture.mkdir()
    stock_inputs = stock_fixture(args.game, fixture)

    # The acquired Phantom BCD has no source files. Attach the pinned creator's
    # actual generated source to a private copy for shared script composition.
    phantom = args.out / 'phantom-source-package'
    shutil.copytree(args.phantom_package, phantom)
    gpl = phantom / 'GPL'
    gpl.mkdir()
    builder = module('community_phantom_creator_builder',
                     args.phantom_source / 'src/build_phantom_guild.py')
    builder.write_gpl_sources(fixture, gpl)
    manifest = phantom / 'CustomGuildPhantomsHaunt.mmxml'
    root = ET.fromstring(manifest.read_bytes())
    loads = root.findall('.//Load/GPL')
    if len(loads) != 1 or list(loads[0]) != loads[0].findall('Target'):
        raise ValueError('Unexpected Phantom source handoff')
    for name in ('Phantom_Building_Data.dat', 'Phantom_Hero_Data.dat',
                 'Phantom_Items_Data.dat', 'Phantom.gpl'):
        ET.SubElement(loads[0], 'Source').text = 'GPL\\' + name
    manifest.write_bytes(ET.tostring(root, encoding='utf-8', xml_declaration=True))

    sys.path.insert(0, str(args.manager / 'src'))
    from majesty_cam.package import load_package, load_mod_definition
    from majesty_cam.compose import (SelectedMod, inventory_package, discover_private_activity_texts,
                                     prepare_gpl_bundle, ScopedSemanticResolution,
                                     _parse_inventory_gpl_sources)
    from majesty_cam.gpl import DefinitionKind, parse_gpl
    from lib.community_guild_source_resolutions import resolve
    selected = (
        SelectedMod('alchemist', load_package(args.alchemist_package)),
        SelectedMod('bards', load_package(args.bards_package)),
        SelectedMod('phantom', load_package(phantom, definition=load_mod_definition(
            args.manager / 'profiles/poc/phantoms-haunt.mod-definition.json'))),
    )
    inventories = tuple(map(inventory_package, selected))

    def functions(inventory):
        return {item.normalized_name: item for source in _parse_inventory_gpl_sources(inventory)
                for item in source.items if item.kind is DefinitionKind.FUNCTION}

    resolutions = resolve(functions(inventories[0]), functions(inventories[2]),
                          (gpl / 'Phantom.gpl').read_text())
    owned_resolutions = {item.key: ScopedSemanticResolution(item, frozenset(('alchemist', 'phantom')))
                         for text in resolutions.values() for item in parse_gpl(text).items}
    texts = discover_private_activity_texts(fixture, inventories)
    bundle = prepare_gpl_bundle(fixture, inventories, private_activity_texts=texts,
                                semantic_resolutions=owned_resolutions)
    sources = args.out / 'sources'
    files = {}
    for scope, result in bundle.outputs:
        folder = sources / scope
        folder.mkdir(parents=True)
        for name, text in result.source_set.files.items():
            raw = text.encode('cp1252')
            (folder / name).write_bytes(raw)
            files[f'{scope}/{name}'] = record(raw)
    receipt = dict(format='majesty-community-combined-creator-gpl-stage-v1',
        managerCommit=MANAGER_COMMIT, phantomSourceCommit=PHANTOM_COMMIT,
        packages=preflights, alchemistPackageFiles=alchemist_inspection['files'],
        stockFixture=stock_inputs, files=files, privateActivityTexts=len(texts),
        explicitSourceResolutions=sorted(resolutions), compiled=False,
        targetNativeABIQualified=False, browserPlayable=False, published=False)
    (args.out / 'source-stage.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('manager', 'phantom-source', 'bards-package', 'phantom-package',
                 'alchemist-package', 'game', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    try:
        receipt = prepare(args)
    except (OSError, ValueError, ET.ParseError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'Community source preparation refused: {error}\n')
    print(json.dumps({key: receipt[key] for key in
        ('files', 'privateActivityTexts', 'compiled', 'browserPlayable', 'published')}))


if __name__ == '__main__':
    main()
