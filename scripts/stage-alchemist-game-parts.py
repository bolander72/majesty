#!/usr/bin/env python3
"""Stage actual XML game parts and compare legacy serialization with purchased stock bytes."""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib.legacy_description_game import encode_character, encode_building, encode_overlay
from lib.legacy_description_wire import cam_payloads, unit_parts

ROOT = Path(__file__).resolve().parents[1]
ENCODERS = {'Character': encode_character, 'Building': encode_building, 'Overlay': encode_overlay}


def source_helper():
    spec = importlib.util.spec_from_file_location('alchemist_game_part_sources', ROOT / 'scripts/compose-alchemist-gameplay.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def namespaces(records):
    # Unit and Action FourCC namespaces intentionally overlap in the stock SDK.
    result = {'Unit': {}, 'Action': {}}
    for record in records:
        element = record.to_element()
        if record.type not in result:
            continue
        key = element.get('Name', '').casefold()
        if not key:
            # Anonymous stock records cannot be referenced by an XML name.
            continue
        if key in result[record.type] and result[record.type][key] != record.description_id:
            result[record.type][key] = None
        else:
            result[record.type][key] = record.description_id
    return result


def stage(composition, game, output):
    if output.exists():
        raise ValueError('Preserve existing game-part staging; choose a new directory')
    helper = source_helper()
    contract = helper.helper('alchemist_game_part_registry', 'stage-alchemist-runtime-registries.py').verified_source(
        ROOT / 'third_party/majesty-mod-manager')
    from majesty_cam.descriptions import parse_descriptions
    report_source = json.loads((composition / 'source-composition.json').read_text())
    raw = (composition / 'Alchemist_Composed.xml').read_bytes()
    expected = report_source['files']['Alchemist_Composed.xml']
    if expected != dict(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest()):
        raise ValueError('Composed authored descriptions changed')
    if report_source.get('sourcePoliciesApplied') is not True:
        raise ValueError('Source policies must be applied first')
    document = parse_descriptions(raw)
    stock, inputs, native = {}, {}, {}
    guest = game / 'MajestyHD - Old.exe'
    if (guest.is_symlink() or not guest.is_file() or guest.stat().st_size > 4 * 1024 * 1024
            or getattr(guest.stat(), 'st_flags', 0) & 0x40000000):
        raise ValueError('Pinned legacy executable unavailable')
    guest_raw = guest.read_bytes()
    guest_sha = hashlib.sha256(guest_raw).hexdigest()
    if guest_sha != contract['guestExecutableSha256']:
        raise ValueError('Legacy description layouts require the pinned DirectDraw executable')
    inputs[guest.name] = dict(bytes=len(guest_raw), sha256=guest_sha)
    for directory, filename in [('Data', 'unittype.cam'), ('DataMX', 'mx_unittype.cam')]:
        payload, _ = helper.capture(game, directory + '/' + filename, inputs)
        native.update(cam_payloads(payload))
        for path in sorted((game / 'SDK/OriginalQuests' / directory).glob('*.xml')):
            payload, relative = helper.capture(game, path.relative_to(game).as_posix(), inputs)
            stock.update(parse_descriptions(payload, source=relative).index)
    stock_names = namespaces(stock.values())
    verified, mismatches = Counter(), []
    for (kind, key), record in stock.items():
        element = record.to_element()
        subtype = element.get('subType')
        if kind != 'Unit' or subtype not in ENCODERS or (b'DUNT', key.encode()) not in native:
            continue
        original = unit_parts(native[b'DUNT', key.encode()])[2]
        generated = ENCODERS[subtype](element.find('Game'), stock_names['Action' if subtype == 'Character' else 'Unit'])
        if generated == original:
            verified[subtype] += 1
        else:
            # Retain every discrepancy, even known stock CDCDCDCD heap-fill
            # values. Never copy uninitialized bytes into a new description.
            differences = []
            for at in range(16, min(len(original), len(generated)), 4):
                a, b = struct.unpack_from('<I', original, at)[0], struct.unpack_from('<I', generated, at)[0]
                if a != b:
                    differences.append(dict(payloadOffset=at - 16, original=a, generated=b))
            mismatches.append(dict(id=key, type=subtype, originalBytes=len(original),
                                   generatedBytes=len(generated), differences=differences))
    # The exact stock byte comparison is evidence for the supported class
    # layouts; discrepancies remain explicit and do not become a blanket pass.
    combined = dict(stock)
    combined.update(document.index)
    names = namespaces(combined.values())
    payloads, pending = {}, []
    for record in document.records:
        element = record.to_element()
        subtype = element.get('subType')
        if record.type != 'Unit' or subtype not in ENCODERS:
            pending.append(dict(type=record.type, id=record.description_id, reason='Separate engine/action/sound conversion required'))
            continue
        try:
            payloads[record.description_id + '.secd'] = ENCODERS[subtype](
                element.find('Game'), names['Action' if subtype == 'Character' else 'Unit'], {'CGAL': 'CG01'})
        except ValueError as error:
            pending.append(dict(type=record.type, id=record.description_id, reason=str(error)))
    result = dict(format='majesty-alchemist-game-part-stage-v1',
                  sourceCompositionSha256=hashlib.sha256((composition / 'source-composition.json').read_bytes()).hexdigest(),
                  authoredXmlSha256=expected['sha256'], originalInputs=inputs,
                  exactStockGameParts=dict(verified), stockDiscrepancies=mismatches,
                  resourceRemap={'CGAL': 'CG01'},
                  files={name: dict(bytes=len(data), sha256=hashlib.sha256(data).hexdigest()) for name, data in payloads.items()},
                  pending=pending, completeNativeDescriptors=False,
                  stockCorpusFullyRoundTripped=not mismatches,
                  nativeHooksQualified=False, browserPlayable=False, installed=False, published=False)
    output.mkdir(parents=True)
    for name, data in payloads.items():
        (output / name).write_bytes(data)
    (output / 'game-parts.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('composition', 'game-source', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    try:
        result = stage(args.composition, args.game_source, args.out)
    except (OSError, ValueError) as error:
        parser.exit(1, f'Alchemist game-part staging refused: {error}\n')
    print(json.dumps(dict(stagedGameParts=len(result['files']), exactStockGameParts=result['exactStockGameParts'],
                          stockDiscrepancies=len(result['stockDiscrepancies']), browserPlayable=False)))
