#!/usr/bin/env python3
"""Compose private authored native unit resources, preserving unsupported content as pending."""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.legacy_description_engine import encode_engine, header, descriptor, KINDS
from lib.legacy_description_game import encode_character, encode_building, encode_overlay
from lib.legacy_description_wire import cam_payloads, unit_parts, resource_name, encode_unit_cam

GAME_ENCODERS = {'Character': encode_character, 'Building': encode_building, 'Overlay': encode_overlay}


def helpers():
    spec = importlib.util.spec_from_file_location('alchemist_native_source', ROOT / 'scripts/compose-alchemist-gameplay.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def name_tables(records):
    result = {name: {} for name in ('Unit', 'Action', 'Sound', 'Movement')}
    for record in records:
        if record.type not in result:
            continue
        name = record.to_element().get('Name', '').casefold()
        if not name:
            continue
        table = result[record.type]
        if name in table and table[name] != record.description_id:
            table[name] = None
        else:
            table[name] = record.description_id
    return result


def native_names(table, records, tag):
    for (kind, key), raw in records.items():
        if kind != tag:
            continue
        identity, name = resource_name(raw, tag)
        if identity != key.decode('ascii'):
            raise ValueError('Native named-resource header/archive identity disagreement')
        name = name.casefold()
        if name in table and table[name] != identity:
            table[name] = None
        else:
            table[name] = identity


def stage(composition, game, package, output, inventory_source=None):
    if output.exists():
        raise ValueError('Preserve existing native-description staging; choose a new directory')
    helper = helpers()
    inspection = helper.helper('alchemist_native_package', 'inspect-alchemist-package.py')
    inspection.inspect(package)
    registry = helper.helper('alchemist_native_registry', 'stage-alchemist-runtime-registries.py')
    contract = registry.verified_source(registry.DEFAULT_MANAGER)
    from majesty_cam.descriptions import parse_descriptions
    source = json.loads((composition / 'source-composition.json').read_text())
    xml = (composition / 'Alchemist_Composed.xml').read_bytes()
    if source.get('definitionSha256') != contract['definitionSha256'] or source.get('sourcePoliciesApplied') is not True:
        raise ValueError('Actual pinned source-policy composition required')
    if source['files']['Alchemist_Composed.xml'] != dict(bytes=len(xml), sha256=registry.sha(xml)):
        raise ValueError('Composed authored XML changed')
    document = parse_descriptions(xml)
    inputs, stock, units, sounds = {}, {}, {}, {}
    guest = inspection.read(game, 'MajestyHD - Old.exe')
    if registry.sha(guest) != contract['guestExecutableSha256']:
        raise ValueError('Require pinned DirectDraw guest for native unit layouts')
    inputs['MajestyHD - Old.exe'] = dict(bytes=len(guest), sha256=registry.sha(guest))
    for folder, unit_file, sound_file in [('Data', 'unittype.cam', 'sounddesc.cam'),
                                         ('DataMX', 'mx_unittype.cam', 'mx_sounddesc.cam')]:
        raw, _ = helper.capture(game, folder + '/' + unit_file, inputs)
        units.update(cam_payloads(raw))
        raw, _ = helper.capture(game, folder + '/' + sound_file, inputs)
        sounds.update(cam_payloads(raw))
        for path in sorted((game / 'SDK/OriginalQuests' / folder).glob('*.xml')):
            raw, name = helper.capture(game, path.relative_to(game).as_posix(), inputs)
            stock.update(parse_descriptions(raw, source=name).index)
    resources = name_tables(stock.values())
    # Actual native sound names can be ambiguous across the two stock datasets;
    # never silently let one descriptor overwrite another with the same name.
    resources['Sound'] = {}
    native_names(resources['Sound'], sounds, b'DSND')
    native_names(resources['Movement'], units, b'DMOV')
    exact_engine, exact_headers, exceptions = Counter(), 0, []
    for (kind, identity), record in stock.items():
        element = record.to_element()
        subtype = element.get('subType')
        if kind != 'Unit' or subtype not in KINDS or (b'DUNT', identity.encode()) not in units:
            continue
        parts = unit_parts(units[b'DUNT', identity.encode()])
        if header(element) == parts[0]:
            exact_headers += 1
        else:
            exceptions.append(dict(id=identity, reason='Stock HEAD differs'))
        try:
            generated = encode_engine(element, resources)
        except ValueError as error:
            exceptions.append(dict(id=identity, reason=str(error)))
            continue
        if generated == parts[1]:
            exact_engine[subtype] += 1
        else:
            offsets = [i for i, (a, b) in enumerate(zip(generated, parts[1])) if a != b]
            exceptions.append(dict(id=identity, reason='Stock engine bytes differ',
                                   generatedBytes=len(generated), originalBytes=len(parts[1]), differingByteOffsets=offsets))
    combined = dict(stock)
    combined.update(document.index)
    private_tables = name_tables(combined.values())
    private_tables['Movement'] = resources['Movement']
    private_tables['Sound'] = dict(resources['Sound'])
    raw = inspection.read(package, 'Data/alchemist_sounddesc.cam')
    inputs['Workshop/Data/alchemist_sounddesc.cam'] = dict(bytes=len(raw), sha256=registry.sha(raw))
    native_names(private_tables['Sound'], cam_payloads(raw), b'DSND')
    # The acquired voices must resolve to the exact declared private IDs.
    for record in document.records:
        if record.type == 'Sound':
            name = record.to_element().get('Name', '').casefold()
            if private_tables['Sound'].get(name) != record.description_id:
                raise ValueError('Private sound artwork/XML binding differs: ' + record.description_id)
    descriptions, pending, inventory_extensions = {}, [], []
    modern_raw = inspection.read(inventory_source, 'MajestyHD.exe') if inventory_source is not None else None
    for record in document.records:
        if record.type != 'Unit':
            continue
        element = record.to_element()
        subtype = element.get('subType')
        if subtype not in KINDS:
            pending.append(dict(id=record.description_id, reason='Particle-system engine conversion required'))
            continue
        try:
            game_part = None
            if subtype in GAME_ENCODERS:
                names = private_tables['Action' if subtype == 'Character' else 'Unit']
                if record.description_id == 'PXF1' and modern_raw is not None:
                    from lib.legacy_inventory_description import plan, encode_game
                    extension = plan(element, modern_raw)
                    game_part = encode_game(element.find('Game'), names, {'CGAL': 'CG01'}, extension)
                    inventory_extensions.append(extension)
                else:
                    game_part = GAME_ENCODERS[subtype](element.find('Game'), names, {'CGAL': 'CG01'})
            descriptions[record.description_id] = descriptor(element, private_tables, game_part)
        except ValueError as error:
            pending.append(dict(id=record.description_id, reason=str(error)))
    archive = encode_unit_cam(descriptions)
    extension_raw = (json.dumps(inventory_extensions, indent=2) + '\n').encode()
    report = dict(format='majesty-alchemist-native-description-stage-v1',
                  sourceCompositionSha256=registry.sha((composition / 'source-composition.json').read_bytes()),
                  definitionSha256=contract['definitionSha256'], originalInputs=inputs,
                  exactStockHeaders=exact_headers, exactStockEngineParts=dict(exact_engine),
                  stockExceptions=exceptions, privateUnitCount=len(descriptions),
                  files={identity + '.dunt': dict(bytes=len(raw), sha256=registry.sha(raw))
                         for identity, raw in descriptions.items()},
                  archive=dict(path='alchemist-native-unittype.cam', bytes=len(archive), sha256=registry.sha(archive)),
                  pending=pending, actionPartsConverted=False, particleConverted='AMM4' in descriptions,
                  inventoryExtensions=inventory_extensions,
                  inventoryExtensionFile=dict(path='inventory-description-extensions.json',
                                              bytes=len(extension_raw), sha256=registry.sha(extension_raw)),
                  inventoryRuntimeRequired=bool(inventory_extensions),
                  completeNativeDescriptors=False, nativeHooksQualified=False,
                  browserPlayable=False, installed=False, published=False,
                  soundBindingVerified=True, completeSoundBodyCompatibilityQualified=False)
    output.mkdir(parents=True)
    for identity, raw in descriptions.items():
        (output / (identity + '.dunt')).write_bytes(raw)
    (output / 'alchemist-native-unittype.cam').write_bytes(archive)
    (output / 'inventory-description-extensions.json').write_bytes(extension_raw)
    (output / 'native-description-stage.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('composition', 'game-source', 'package', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--inventory-source', type=Path, help='Private audited modern source directory; does not change the pinned guest')
    args = parser.parse_args()
    try:
        report = stage(args.composition, args.game_source, args.package, args.out, args.inventory_source)
    except (OSError, ValueError) as error:
        parser.exit(1, f'Alchemist native-description staging refused: {error}\n')
    print(json.dumps(dict(privateUnitCount=report['privateUnitCount'], exactStockHeaders=report['exactStockHeaders'],
                          exactStockEngineParts=report['exactStockEngineParts'], pending=report['pending'], browserPlayable=False)))
