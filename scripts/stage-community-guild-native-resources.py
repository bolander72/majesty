#!/usr/bin/env python3
"""Convert acquired guild descriptions to private Old resources without installing them."""
import argparse
import copy
import hashlib
import importlib.util
import json
import mmap
from pathlib import Path
import struct
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.legacy_description_wire import cam_payloads, encode_description_cam
from lib.legacy_description_engine import descriptor, KINDS
from lib.legacy_description_game import encode_character, encode_building, encode_overlay
from lib.legacy_description_action import action_descriptor
from lib.legacy_description_sound import clone_selection_sound
from lib.legacy_inventory_description import plan_legacy_item, encode_legacy_item_game

# Empty native V/B-family slots: custom names, scripts and artwork remain the
# acquired originals. Existing Alchemist identities and retired IDs stay intact.
ACTOR_IDS = {'BDT1': 'AVt1', 'BDS1': 'AVu1', 'BDD1': 'AVv1',
             'BDG1': 'ABt1', 'BDG2': 'ABt2', 'BDG3': 'ABt3',
             'PHM1': 'AVp1', 'PHG1': 'ABu1', 'PHG2': 'ABu2', 'PHG3': 'ABu3'}
RESERVED = {'ALC1', 'ABx1', 'ABx2', 'ABx3', 'AVz1', 'ABs1', 'ABs2', 'ABs3'}


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    sys.modules[name] = result
    spec.loader.exec_module(result)
    return result


def digest(raw):
    return dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())


def stage(args):
    if args.out.exists():
        raise ValueError('Preserve existing native staging; choose another directory')
    policy = module('community_native_source_policy', ROOT / 'scripts/prepare-community-guild-gpl.py')
    policy.verified_git(args.manager, policy.MANAGER_COMMIT)
    policy.verified_git(args.phantom_source, policy.PHANTOM_COMMIT)
    inspection = module('community_native_inspection', ROOT / 'scripts/inspect-community-guild-package.py')
    preflights = {}
    packages = [('bards-hall', 'bards', args.bards_package),
                ('phantoms-haunt', 'phantom', args.phantom_package)]
    for identity, _, package in packages:
        contract = json.loads((ROOT / 'content/community-mods' / identity / 'source-contract.json').read_text())
        preflights[identity] = inspection.inspect(package, contract)
        declared = contract.get('nativeActorIdentityMap', {})
        owned = {name: target for name, target in ACTOR_IDS.items()
                 if name in set(contract['authoredIdentities']['heroes']
                                + contract['authoredIdentities']['buildings'])}
        if owned != declared:
            raise ValueError('Native actor identities differ from the declared source contract')
    guest = inspection.PRIMITIVES.read(args.game, 'MajestyHD - Old.exe')
    if digest(guest)['sha256'] != '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542':
        raise ValueError('Native layouts require pinned MajestyHD - Old.exe')
    modern = inspection.PRIMITIVES.read(args.game, 'MajestyHD.exe')
    sys.path.insert(0, str(args.manager / 'src'))
    from majesty_cam.descriptions import parse_descriptions
    from majesty_cam.cam import read_cam

    helpers = module('community_native_description_helpers',
                     ROOT / 'scripts/stage-alchemist-native-descriptions.py')
    stock, native, inputs = {}, {}, {'MajestyHD - Old.exe': digest(guest),
                                    'MajestyHD.exe': digest(modern)}
    for folder, sound_file, unit_file in [('Data', 'sounddesc.cam', 'unittype.cam'),
                                         ('DataMX', 'mx_sounddesc.cam', 'mx_unittype.cam')]:
        for filename in (sound_file, unit_file):
            name = folder + '/' + filename
            raw = inspection.PRIMITIVES.read(args.game, name)
            inputs[name] = digest(raw)
            native.update(cam_payloads(raw))
        for path in sorted((args.game / 'SDK/OriginalQuests' / folder).glob('*.xml')):
            name = path.relative_to(args.game).as_posix()
            raw = inspection.PRIMITIVES.read(args.game, name)
            inputs[name] = digest(raw)
            stock.update(parse_descriptions(raw, source=name).index)
    occupied = {key.decode('ascii') for kind, key in native if kind == b'DUNT'} | RESERVED
    if set(ACTOR_IDS.values()) & occupied or len(set(ACTOR_IDS.values())) != len(ACTOR_IDS):
        raise ValueError('Native custom actor identity is already occupied')
    stock_images = set()
    for name in ('Data/maindata.cam', 'Data/interfacedata.cam',
                 'DataMX/mx_maindata.cam', 'DataMX/mx_interfacedata.cam'):
        path = args.game / name
        if path.is_symlink() or getattr(path.stat(), 'st_flags', 0) & 0x40000000:
            raise ValueError('Unavailable native image archive')
        # Touch only the CAM directory; do not load hundreds of MiB of TILEs
        # merely to resolve a handful of existing stock image identifiers.
        with path.open('rb') as file:
            with mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ) as raw:
                index = inspection.PRIMITIVES.cam_index(raw)
                stock_images.update(key[:4] for kind, key in index if kind == b'IMAG')
                sections, header_bytes = struct.unpack_from('<II', raw, 12)
                end = 20 + sections * 8 + header_bytes
                inputs[name] = dict(archiveBytes=len(raw),
                    directory=digest(raw[:end]), scope='Identity directory only; TILE bodies untouched')
    if {name.encode('ascii') for name in ACTOR_IDS.values()} & stock_images:
        raise ValueError('Native actor alias collides with existing stock art')

    private, by_mod, sounds = {}, {}, {}
    original_images, original_waves = set(), set()
    for identity, prefix, package in packages:
        records = {}
        for path in sorted((package / 'Data').glob('*.xml')):
            for record in parse_descriptions(path.read_bytes(), source=path.name).records:
                if record.key in records or record.key in private:
                    raise ValueError('Duplicated community description: ' + repr(record.key))
                records[record.key] = record
                private[record.key] = record
        by_mod[identity] = records
        sounds[identity] = {key.decode('ascii'): raw for (kind, key), raw in cam_payloads(
            (package / 'Data' / (prefix + '_sounddesc.cam')).read_bytes()).items() if kind == b'DSND'}
        native.update({(b'DSND', key.encode('ascii')): raw for key, raw in sounds[identity].items()})
        for suffix in ('maindata', 'interfacedata', 'voices'):
            archive = read_cam(package / 'Data' / (prefix + '_' + suffix + '.cam'))
            for section in archive.sections:
                if section.extension == b'IMAG':
                    original_images.update(entry.name[:4].decode('ascii') for entry in section.entries)
                if section.extension == b'WAVE':
                    original_waves.update(entry.name[:4] for entry in section.entries)

    # This exact complete selection contract matches native Tavern, Arena and
    # Graveyard descriptors. Preserve both acquired Phantom voice DSNDs verbatim.
    ph_sound = private['Sound', 'PH02'].to_element()
    selection = clone_selection_sound(ph_sound, stock['Sound', 'BP18'].to_element(),
                                      native[b'DSND', b'BP18'], original_waves)
    sounds['phantoms-haunt']['PH02'] = selection
    native[b'DSND', b'PH02'] = selection

    builder = module('community_phantom_item_source',
                     args.phantom_source / 'src/build_phantom_guild.py')
    item_specs = [(name, index, attribute) for index, name, attribute, _, _
                  in builder.phantom_equipment_item_specs()]
    item_specs.append(('FrostArmorBonus', builder.PHANTOM_FROST_ARMOR_ITEM_ID,
                       'Phantom_Item_FrostArmorBonus'))
    if {index for _, index, _ in item_specs} != set(range(80, 113)) or len(item_specs) != 33:
        raise ValueError('Creator inventory slots differ from the reviewed 80..112 range')
    extensions = {name: plan_legacy_item(private['Unit', name].to_element(), modern, index, attr)
                  for name, index, attr in item_specs}
    identities = {**ACTOR_IDS, **{name: plan['unit'] for name, plan in extensions.items()}}
    if set(identities.values()) & occupied or len(set(identities.values())) != len(identities):
        raise ValueError('Native item/actor identity is already occupied')
    combined = {**stock, **private}
    tables = helpers.name_tables(combined.values())
    for name, value in list(tables['Unit'].items()):
        tables['Unit'][name] = identities.get(value, value)
    tables['Sound'] = {}
    helpers.native_names(tables['Sound'], native, b'DSND')
    helpers.native_names(tables['Movement'], native, b'DMOV')
    encoders = {'Character': encode_character, 'Building': encode_building, 'Overlay': encode_overlay}
    payloads, summaries, titles = {}, {}, {}
    for identity, _, _ in packages:
        units, actions, pending, missing_images = {}, {}, [], set()
        for record in by_mod[identity].values():
            element = record.to_element()
            key = record.description_id
            try:
                if record.type == 'Action':
                    actions[key] = action_descriptor(element, tables)
                elif record.type == 'Unit':
                    subtype = element.get('subType')
                    if subtype not in KINDS:
                        raise ValueError('No audited native engine encoder for ' + str(subtype))
                    game_part = None
                    if key in extensions:
                        game_part = encode_legacy_item_game(element, tables['Action'], {}, extensions[key])
                    elif subtype in encoders:
                        game_part = encoders[subtype](element.find('Game'),
                            tables['Action' if subtype == 'Character' else 'Unit'])
                    adapted = copy.deepcopy(element)
                    target = identities.get(key, key)
                    adapted.set('ID', target)
                    units[target] = descriptor(adapted, tables, game_part)
                    if target != key:
                        titles[target] = dict(canonical=key, name=element.get('Name'),
                                               display=element.get('Description', element.get('Name')))
                    image = element.find('Engine/ImageIDBase')
                    if (image is not None and image.get('value') not in original_images
                            and image.get('value').encode('ascii') not in stock_images):
                        missing_images.add(image.get('value'))
            except ValueError as error:
                pending.append(dict(kind=record.type, id=key, reason=str(error)))
        for suffix, kind, rows in [('unittype', b'DUNT', units), ('action', b'DACT', actions),
                                   ('sounddesc', b'DSND', sounds[identity])]:
            if rows:
                name = identity + '-native-' + suffix + '.cam'
                payloads[name] = encode_description_cam(rows, kind)
        summaries[identity] = dict(units=len(units), actions=len(actions),
            sounds=len(sounds[identity]), pending=pending,
            imageReferencesAbsentFromGuildAndStockArt=sorted(missing_images))
    extension_raw = (json.dumps(list(extensions.values()), indent=2) + '\n').encode()
    payloads['inventory-description-extensions.json'] = extension_raw
    payloads['native-title-bindings.json'] = (json.dumps(titles, indent=2) + '\n').encode()
    receipt = dict(format='majesty-community-native-resource-stage-v1',
        packages=preflights, sourceInputs=inputs, actorIdentities=ACTOR_IDS,
        numericInventorySlots=[80, 112], inventoryMetadataCount=len(extensions),
        summaries=summaries, files={name: digest(raw) for name, raw in payloads.items()},
        privateTitlesNeedCollectionMerge=True, dependenciesNeedCollectionMerge=True,
        allRuntimeCapabilitiesQualified=False, nativeRuntimeQualified=False,
        browserPlayable=False, installed=False, published=False)
    args.out.mkdir(parents=True)
    for name, raw in payloads.items():
        (args.out / name).write_bytes(raw)
    (args.out / 'native-resource-stage.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('bards-package', 'phantom-package', 'phantom-source', 'manager', 'game', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    try:
        result = stage(args)
    except (OSError, ValueError, KeyError, ET.ParseError) as error:
        parser.exit(1, f'Community native staging refused: {error}\n')
    print(json.dumps(dict(summaries=result['summaries'],
                         inventoryMetadataCount=result['inventoryMetadataCount'], browserPlayable=False)))


if __name__ == '__main__':
    main()
