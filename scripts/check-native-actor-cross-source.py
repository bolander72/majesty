#!/usr/bin/env python3
"""Qualify a real stopped source clock and literal live command capture only."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import struct

ROOT = Path(__file__).resolve().parents[1]
ACTORS = [2101, 2105, 2122, 2136]
SOURCE_PIN = '31059d44ebf165c25bf1fd91f8ef00d5c5e3733d2d6177ca8e05956026650e13'
DESTINATION_PIN = '6e6a2ee125b68ce00ec25a46f205904e7cdd8f83ca009c10cf29e8e9ab76e2d1'


def verify(manifest):
    spec = importlib.util.spec_from_file_location('populated', ROOT / 'scripts/check-native-actor-populated-stage.py')
    populated = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(populated)
    report = populated.verify(manifest, actors=ACTORS, world_visits=1960)
    meta = report['fixture']
    pack_path = ROOT / 'output/native-actor-cross-binding-fixtures.json'
    pack = json.loads(pack_path.read_text())
    if (meta.get('crossSource') is not True or meta.get('clockProbe') is not False or
            meta.get('targetCases') is not False or pack['format'] != 'NAS3' or
            pack['sourceSha256'] != SOURCE_PIN or pack['destinationSha256'] != DESTINATION_PIN or
            populated.sha(ROOT / pack['source']) != SOURCE_PIN or
            populated.sha(ROOT / pack['destination']) != DESTINATION_PIN or
            pack['sha256'] != meta['copiedCaseFileSha256'] or
            populated.sha(pack_path.with_suffix('.bin')) != pack['sha256'] or
            [c['unitId'] for c in pack['cases']] != ACTORS or
            pack['binding'] != dict(before=2073, after=497, kind=1, description=827610690, player=7)):
        raise ValueError('Missing immutable, explicitly bound source/destination fixtures')
    # Decode the actual copied NAS3 bytes rather than trusting the JSON planner.
    data = (Path(meta['profile']) / 'Populated_Order_Stage.bin').read_bytes()
    cursor = 0

    def take(count):
        nonlocal cursor
        if count < 0 or cursor + count > len(data):
            raise ValueError('Truncated NAS3 record')
        result = data[cursor:cursor + count]
        cursor += count
        return result

    def words(count):
        return struct.unpack('<' + 'I' * count, take(4 * count))

    if words(2) != (0x3353414e, 4):
        raise ValueError('Wrong NAS3 header')
    for case in pack['cases']:
        actor, unit_bytes, requests, payload_bytes, *counts = words(7)
        if (actor != case['unitId'] or unit_bytes != case['unitBytes'] or
                requests != case['requests'] or payload_bytes != case['payloadBytes'] or
                counts != case['counts'] or not 92 <= unit_bytes <= 4096 or
                not 6 <= requests <= 32 or not 24 <= payload_bytes <= 2048):
            raise ValueError('Wrong source case bounds')
        unit = take(unit_bytes)
        if unit[:4] != b'UNIT' or struct.unpack_from('<I', unit, 36)[0] != actor:
            raise ValueError('Wrong source UNIT identity')
        take(requests * 20)
        payload = take(payload_bytes)
        if words(1) != (3,):
            raise ValueError('Wrong source clock count')
        for clock in case['clocks']:
            offset, bank, index, kind, when, rate, delta, info = words(8)
            if ((offset, bank, index, kind, when, rate, delta, info) !=
                    tuple(clock[k] for k in ['offset', 'bank', 'index', 'kind', 'when', 'rate', 'delta', 'info']) or
                    offset < 4 or offset + 12 > len(payload) or
                    struct.unpack_from('<4I', payload, offset - 4) != (rate, when, delta, info)):
                raise ValueError('Clock descriptor does not match source commands')
        if words(1) != (2,):
            raise ValueError('Wrong source target count')
        for target in case['targets']:
            offset, bank, index, kind, before = words(5)
            if ((offset, bank, index, kind, before) !=
                    tuple(target[k] for k in ['offset', 'bank', 'index', 'kind', 'before']) or
                    offset + 4 > len(payload) or struct.unpack_from('<I', payload, offset)[0] != 2073):
                raise ValueError('Target descriptor does not match source commands')
    if words(5) != (2073, 497, 1, 827610690, 7):
        raise ValueError('Wrong explicit test binding')
    for identity in [2073, 497]:
        size, = words(1)
        if not 92 <= size <= 4096:
            raise ValueError('Invalid target UNIT bounds')
        target = take(size)
        if (target[:4] != b'UNIT' or struct.unpack_from('<II', target, 32) != (1, identity) or
                struct.unpack_from('<III', target, 48) != (827610690, 7, 0)):
            raise ValueError('Wrong target template, owner or parent')
    if cursor != len(data):
        raise ValueError('Trailing NAS3 bytes')
    capture_path = Path(meta['profile']) / 'Cross_Source_Capture.bin'
    capture = capture_path.read_bytes()
    if len(capture) != 36:
        raise ValueError('Missing complete native clock/target capture')
    magic, version, clock, identity, kind, description, player, flags, parent = struct.unpack('<9I', capture)
    if (magic, version, identity, kind, description, player, flags, parent) != (
            0x3143414e, 1, 2073, 1, 827610690, 7, 512, 0):
        raise ValueError('Wrong observed original source target')
    log = Path(meta['log']).read_text()
    rows = re.findall(r'^\[streaming\] Cross source actor=(\d+) clock=(\d+) live-banks=1 result=pass$', log, re.M)
    if rows != [(str(actor), str(clock)) for actor in ACTORS]:
        raise ValueError('Missing original live bank equality or stable source clock')
    summary = f'[streaming] Cross source capture clock={clock} target=2073 unchanged=1 bytes=36 result=pass'
    if log.count(summary) != 1:
        raise ValueError('Missing native source capture completion')
    report.update(scope='real stopped Brashnard source clock and original live command writer '
                  'equality for four source actors, with 64 private restore/cleanup cycles; '
                  'no destination load, rebinding, navigation, publication or activation',
                  sourceClockMs=clock, realSourceClockCaptured=True,
                  sourceLiveBanksMatchCopiedCommands=True, sourceTargetOriginalLookupAndFullRecordPreserved=True,
                  sourceCapture=dict(path=str(capture_path), sha256=populated.sha(capture_path), bytes=36),
                  suppliedFixtureBinding=pack['binding'], realDestinationClockCaptured=False,
                  destinationBindingsQualified=False, entityContinuityQualified=False,
                  destinationNavigationQualified=False, sourceActorDepartureQualified=False)
    report['sourceSha256'] = populated.recorded_native_sources(meta)
    for name in ['scripts/check-native-actor-cross-source.py',
                 'scripts/check-native-actor-populated-stage.py',
                 'scripts/run-native-actor-populated-stage-fixture.py',
                 'scripts/prepare-native-actor-cross-bindings.mjs']:
        report['sourceSha256'][name] = populated.sha(ROOT / name)
    for evidence in [pack_path, pack_path.with_suffix('.bin'), capture_path, Path(meta['log'])]:
        report['evidenceSha256'][str(evidence.relative_to(ROOT))] = populated.sha(evidence)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'output/native-actor-cross-source-observed.json')
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Preserve existing qualification output')
    result = verify(args.manifest)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ['qualified', 'trials', 'sourceClockMs', 'destinationBindingsQualified']}))
