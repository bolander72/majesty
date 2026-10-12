#!/usr/bin/env python3
"""Qualify original private restoration of projected actor coordinates."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import struct

ROOT = Path(__file__).resolve().parents[1]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def verify(manifest, *, grounded=False):
    populated = load('populated', 'check-native-actor-populated-stage.py')
    coordinate_audit = load('coordinates', 'audit-native-actor-coordinates.py').audit()
    report = load('route', 'check-native-actor-cross-route.py').verify(manifest)
    meta = report['fixture']
    if bool(meta.get('groundedPlacement')) != grounded:
        raise ValueError('Grounded restoration requires its separate terrain/cache qualification')
    if meta.get('placementProbe') is not True:
        raise ValueError('Missing actual projected actor restoration')
    pack = meta['placementPack']
    original = ROOT / 'output/native-actor-cross-placement-v2.bin'
    metadata = original.with_suffix('.json')
    if (Path(pack['path']).resolve() != original or Path(pack['metadata']).resolve() != metadata or
            populated.sha(original) != pack['sha256'] or populated.sha(metadata) != pack['metadataSha256'] or
            populated.sha(Path(meta['profile']) / 'Cross_Placement.bin') != pack['sha256']):
        raise ValueError('Changed supplied placement fixture')
    plan = json.loads(metadata.read_text())
    source = (Path(meta['profile']) / 'Populated_Order_Stage.bin').read_bytes()
    data = original.read_bytes()
    if (len(data) != 252 or struct.unpack_from('<3I', data) != (0x3150414e, 2, 4) or
            plan['sourcePackSha256'] != meta['copiedCaseFileSha256'] or plan['sha256'] != pack['sha256']):
        raise ValueError('Invalid bounded placement input')
    cursor, cases = 8, []
    ground_cases = json.loads((ROOT / 'output/native-actor-ground-fixtures.json').read_text())['cases'] if grounded else None
    for index, expected in enumerate(plan['cases']):
        identity, size, requests, payload, *_ = struct.unpack_from('<7I', source, cursor)
        cursor += 28
        source_fixed = struct.unpack_from('<3i', source, cursor + 60)
        source_cells = struct.unpack_from('<2i', source, cursor + 72)
        parent, = struct.unpack_from('<I', source, cursor + 56)
        cursor += size + requests * 20 + payload + 4 + 3 * 32 + 4 + 2 * 20
        row = struct.unpack_from('<15i', data, 12 + index * 60)
        # Independent integer oracle; do not import the JS adapter/producer.
        origin_x = source_fixed[0] // (4096 * 2048) * 4096
        origin_y = source_fixed[1] // (4096 * 2048) * 4096
        fixed = (source_fixed[0] - origin_x * 2048,
                 source_fixed[1] - origin_y * 2048, source_fixed[2])
        grid = (fixed[0] // 32768, fixed[1] // 32768)
        cells = (source_cells[0] - origin_x // 16, source_cells[1] - origin_y // 16)
        oracle = (identity, *source_fixed, *fixed, -origin_x, -origin_y, *grid, *source_cells, *cells)
        if parent or size != 375 or tuple(row) != oracle or expected['id'] != identity:
            raise ValueError('Placement does not correspond to original actor or supplied origin')
        if (expected['sourceFixed'] != dict(zip(['x', 'y', 'z'], source_fixed)) or
                expected['source'] != dict(originX=0, originY=0, widthCells=256, heightCells=256) or
                expected['destination'] != dict(originX=origin_x, originY=origin_y, widthCells=128, heightCells=128) or
                expected['projected']['fixed'] != dict(zip(['x', 'y', 'z'], fixed)) or
                expected['projected']['grid'] != dict(zip(['x', 'y'], grid)) or
                expected['sourceCells'] != dict(zip(['x', 'y'], source_cells)) or
                expected['projected']['cells'] != dict(zip(['x', 'y'], cells))):
            raise ValueError('Metadata differs from independent fixed-coordinate projection')
        if not all(0 <= n < 4096 * 2048 for n in fixed[:2]) or not all(0 <= n < 256 for n in (*grid, *cells)):
            raise ValueError('Projected coordinates outside actual destination')
        cases.append(dict(id=identity, delta=[-origin_x, -origin_y], sourceFixed=list(source_fixed),
                          fixed=list(fixed), grid=list(grid), cells=list(cells), sourceCells=list(source_cells)))
        if grounded:
            if ground_cases[index]['id'] != identity:
                raise ValueError('Grounding does not match original actor order')
            cases[-1]['fixed'][2] = ground_cases[index]['destination']['groundQ16']
    rows = re.findall(
        r'^\[streaming\] Cross placement actor=(\d+) trial=(\d+) delta=(-?\d+),(-?\d+) '
        r'fixed=(-?\d+),(-?\d+),(-?\d+) grid=(\d+),(\d+) cells=(\d+),(\d+) queried=4 clear=4 '
        r'equal=1 destroyed=1 preserved=1 balanced=1 result=pass$', Path(meta['log']).read_text(), re.M)
    if len(rows) != 64:
        raise ValueError('Missing all original projected restoration/collision/writer/cleanup cycles')
    for index, row in enumerate(rows):
        case = cases[index // 16]
        if list(map(int, row)) != [case['id'], index % 16, *case['delta'], *case['fixed'], *case['grid'], *case['cells']]:
            raise ValueError('Native restored coordinates differ from original fixed-position projection')
    report.update(scope='64 additional original private UNIT restorations with explicitly supplied '
                  'region-origin transforms, original map conversion/class collision and exact '
                  'translated serialization; no terrain continuity, command intent transfer or activation',
                  privateProjectedActorRestorationQualified=True, projectedActorRestorations=64,
                  projectedActorCases=cases, originalProjectedPositionCollisionCalls=256,
                  fractionalFixedPositionPreserved=True, originalZPositionPreserved=not grounded,
                  translatedOriginalUnitSerializationQualified=True,
                  originalDeferredSpatialCellsPreserveSourceRelationship=True,
                  originalCoordinateInstructionAnchors=coordinate_audit['verifiedInstructionAnchors'],
                  projectionInputsAreSuppliedFixtureGeometry=True,
                  terrainToActorElevationQualified=False, terrainContinuityQualified=False,
                  viableDestinationLandingQualified=False, actorActivationQualified=False,
                  commandIntentTransferred=False, continuousPagingQualified=False)
    for name in ['scripts/check-native-actor-cross-placement.py',
                 'scripts/prepare-native-actor-cross-placement.mjs', 'scripts/audit-native-actor-coordinates.py',
                 'web/world/actor-coordinates.mjs', 'tests/actor-coordinates.test.mjs',
                 'upstream/majesty-recomp/native_actor_stage.cpp',
                 'upstream/majesty-recomp/native_actor_stage.h']:
        report['sourceSha256'][name] = populated.sha(ROOT / name)
    report['evidenceSha256'].update({str(path.relative_to(ROOT)): populated.sha(path)
                                    for path in [original, metadata]})
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Preserve previous qualification')
    result = verify(args.manifest)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ['qualified', 'projectedActorRestorations',
                     'originalProjectedPositionCollisionCalls', 'actorActivationQualified']}))
