#!/usr/bin/env python3
"""Prepare actual potion/combat action descriptors and preserve all unqualified boundaries."""
import argparse
from collections import Counter
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.legacy_description_action import action_descriptor, action_parts
from lib.legacy_description_wire import cam_payloads, encode_description_cam


def module():
    spec = importlib.util.spec_from_file_location('alchemist_action_dependencies', ROOT / 'scripts/stage-alchemist-native-descriptions.py')
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def stage(composition, game, package, output):
    if output.exists():
        raise ValueError('Preserve existing native action staging; choose a new directory')
    dependency = module()
    helper = dependency.helpers()
    inspection = helper.helper('alchemist_action_package', 'inspect-alchemist-package.py')
    inspection.inspect(package)
    registry = helper.helper('alchemist_action_registry', 'stage-alchemist-runtime-registries.py')
    contract = registry.verified_source(registry.DEFAULT_MANAGER)
    from majesty_cam.descriptions import parse_descriptions
    from majesty_cam.gpl import parse_gpl, DefinitionKind
    source_raw = (composition / 'source-composition.json').read_bytes()
    source = json.loads(source_raw)
    if source.get('definitionSha256') != contract['definitionSha256'] or source.get('sourcePoliciesApplied') is not True:
        raise ValueError('Pinned actual source-policy composition required')
    payloads = {}
    for name in ('Alchemist_Composed.xml', 'Alchemist_Composed.gpl'):
        raw = (composition / name).read_bytes()
        if source['files'][name] != dict(bytes=len(raw), sha256=registry.sha(raw)):
            raise ValueError('Composed action source changed: ' + name)
        payloads[name] = raw
    authored = parse_descriptions(payloads['Alchemist_Composed.xml'])
    functions = {i.normalized_name for i in parse_gpl(payloads['Alchemist_Composed.gpl'].decode('cp1252')).items
                 if i.kind is DefinitionKind.FUNCTION}
    guest = inspection.read(game, 'MajestyHD - Old.exe')
    if registry.sha(guest) != contract['guestExecutableSha256']:
        raise ValueError('Native action layouts require pinned DirectDraw guest')
    inputs = {'MajestyHD - Old.exe': dict(bytes=len(guest), sha256=registry.sha(guest))}
    stock, actions, sounds = {}, {}, {}
    for folder, action_file, sound_file in [('Data', 'action.cam', 'sounddesc.cam'),
                                          ('DataMX', 'mx_action.cam', 'mx_sounddesc.cam')]:
        raw, _ = helper.capture(game, folder + '/' + action_file, inputs)
        actions.update(cam_payloads(raw))
        raw, _ = helper.capture(game, folder + '/' + sound_file, inputs)
        sounds.update(cam_payloads(raw))
        for path in sorted((game / 'SDK/OriginalQuests' / folder).glob('*.xml')):
            raw, name = helper.capture(game, path.relative_to(game).as_posix(), inputs)
            stock.update(parse_descriptions(raw, source=name).index)
    resources = dependency.name_tables(stock.values())
    resources['Sound'] = {}
    dependency.native_names(resources['Sound'], sounds, b'DSND')
    exact, exceptions = 0, []
    for (kind, key), record in stock.items():
        if kind != 'Action' or (b'DACT', key.encode()) not in actions:
            continue
        try:
            generated = action_descriptor(record.to_element(), resources)
        except ValueError as error:
            exceptions.append(dict(id=key, reason=str(error)))
            continue
        original = actions[b'DACT', key.encode()]
        if generated == original:
            exact += 1
        else:
            part_diffs = []
            for label, a, b in zip(('HEAD', 'PRIM+script', 'SECD'), action_parts(generated), action_parts(original)):
                if a != b:
                    part_diffs.append(dict(part=label, generatedBytes=len(a or b''), originalBytes=len(b or b'')))
            exceptions.append(dict(id=key, reason='Stock action bytes differ', parts=part_diffs))
    combined = dict(stock)
    combined.update(authored.index)
    private = dependency.name_tables(combined.values())
    private['Sound'] = dict(resources['Sound'])
    raw = inspection.read(package, 'Data/alchemist_sounddesc.cam')
    inputs['Workshop/Data/alchemist_sounddesc.cam'] = dict(bytes=len(raw), sha256=registry.sha(raw))
    dependency.native_names(private['Sound'], cam_payloads(raw), b'DSND')
    descriptors, bindings = {}, []
    for record in authored.records:
        if record.type != 'Action':
            continue
        element = record.to_element()
        callback = element.find('Engine/Script').get('GPLFunction')
        validation = element.find('Game/ValidationScript')
        validator = validation.get('value') if validation is not None else ''
        for name in (callback, validator):
            if name and name.casefold() not in functions:
                raise ValueError('Authored action callback absent from composed source: ' + name)
        descriptors[record.description_id] = action_descriptor(element, private)
        bindings.append(dict(id=record.description_id, name=element.get('Name'), effect=callback, validation=validator))
    archive = encode_description_cam(descriptors, b'DACT')
    report = dict(format='majesty-alchemist-native-action-stage-v1',
                  sourceCompositionSha256=registry.sha(source_raw), definitionSha256=contract['definitionSha256'],
                  originalInputs=inputs, exactStockActions=exact, stockExceptions=exceptions,
                  authoredActionCount=len(descriptors), callbackBindings=bindings,
                  files={key + '.dact': dict(bytes=len(raw), sha256=registry.sha(raw)) for key, raw in descriptors.items()},
                  archive=dict(path='alchemist-native-action.cam', bytes=len(archive), sha256=registry.sha(archive)),
                  actionPartsConverted=True, nativeActionExecutionQualified=False,
                  nativeHooksQualified=False, browserPlayable=False, installed=False, published=False)
    output.mkdir(parents=True)
    for key, raw in descriptors.items():
        (output / (key + '.dact')).write_bytes(raw)
    (output / 'alchemist-native-action.cam').write_bytes(archive)
    (output / 'native-action-stage.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('composition', 'game-source', 'package', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    try:
        report = stage(args.composition, args.game_source, args.package, args.out)
    except (OSError, ValueError) as error:
        parser.exit(1, f'Alchemist action staging refused: {error}\n')
    print(json.dumps(dict(authoredActionCount=report['authoredActionCount'], exactStockActions=report['exactStockActions'],
                          stockExceptions=len(report['stockExceptions']), browserPlayable=False)))
