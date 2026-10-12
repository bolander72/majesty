#!/usr/bin/env python3
"""Verify original rejection of unchanged source routes in the real second grid."""
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


def dimensions(path):
    size = path.stat().st_size
    if size > 64 * 1024 * 1024:
        raise ValueError('Checkpoint budget exceeded')
    at = 0
    result = None
    with path.open('rb') as file:
        for count in range(128):
            if at == size:
                break
            file.seek(at)
            header = file.read(16)
            if len(header) != 16:
                raise ValueError('Truncated checkpoint root')
            tag, length, version, children = struct.unpack('<4s3I', header)
            end = at + 16 + length
            if end > size:
                raise ValueError('Invalid checkpoint root extent')
            if tag == b'MAP ':
                if result or version != 0 or children != 1:
                    raise ValueError('Wrong MAP container')
                primary = file.read(16)
                if primary != struct.pack('<4s3I', b'PRIM', 40, 2, 0) or length != 56:
                    raise ValueError('Wrong MAP dimensions layout')
                result = struct.unpack('<2I', file.read(8))
            at = end
        else:
            raise ValueError('Too many checkpoint roots')
    if at != size or not result or not all(0 < n <= 1024 for n in result):
        raise ValueError('Missing bounded checkpoint dimensions')
    return result


def verify(manifest, *, allow_invalidation=False):
    cross = load('cross_destination', 'check-native-actor-cross-destination.py')
    populated = load('populated', 'check-native-actor-populated-stage.py')
    report = cross.verify(manifest)
    meta = report['fixture']
    if meta.get('navigationProbe') is not True:
        raise ValueError('Missing actual original navigation probe')
    if meta.get('invalidatePath') is True and not allow_invalidation:
        raise ValueError('Use the path-invalidation verifier for edited route bytes')
    # Original coordinate conversion and outside-grid branch are already pinned
    # by these audits. Revalidate the executable/anchors without launching a host.
    navigation = load('navigation_audit', 'audit-native-navigation.py')
    executable = ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    audit = navigation.audit(executable)
    if not audit['pointOutsideGridBlocked']:
        raise ValueError('Missing pinned original outside-grid rejection')
    pack = json.loads((ROOT / 'output/native-actor-cross-binding-fixtures.json').read_text())
    source_dimensions = dimensions(ROOT / pack['source'])
    destination_dimensions = dimensions(ROOT / pack['destination'])
    grid = tuple(n * 2 for n in destination_dimensions)
    data = (Path(meta['profile']) / 'Populated_Order_Stage.bin').read_bytes()
    if len(data) > 32768 or struct.unpack_from('<2I', data) != (0x3353414e, 4):
        raise ValueError('Wrong bounded NAS3 pack')
    cursor = 8
    cases = []
    for expected in pack['cases']:
        identity, unit_bytes, requests, payload_bytes, *_ = struct.unpack_from('<7I', data, cursor)
        cursor += 28
        unit = data[cursor:cursor + unit_bytes]
        cursor += unit_bytes + requests * 20
        payload = data[cursor:cursor + payload_bytes]
        cursor += payload_bytes
        # Source verifier independently checks all the descriptors and their
        # binary correspondence; the trailing source/destination records too.
        cursor += 4 + 3 * 32 + 4 + 2 * 20
        if identity != expected['unitId']:
            raise ValueError('Wrong actor order')
        fixed = struct.unpack_from('<2i', unit, 60)
        actor = tuple(int((n >> 11) / 16) for n in fixed)
        path_header = expected['clocks'][1]
        start = path_header['offset'] - 20
        destination_native = struct.unpack_from('<2i', payload, start + 104)
        destination_grid = tuple(int(n / 16) for n in destination_native)
        cursor_value, = struct.unpack_from('<i', payload, start + 120)
        point_count, = struct.unpack_from('<i', payload, start + 136)
        points = [struct.unpack_from('<2i', payload, start + 140 + i * 8) for i in range(point_count)]
        if point_count != 10 or cursor_value != 8:
            raise ValueError('Unexpected original path state')
        outside = lambda point: not (0 <= point[0] < grid[0] and 0 <= point[1] < grid[1])
        if not all(outside(point) for point in [actor, destination_grid, *points]):
            raise ValueError('Source route is not wholly outside this actual destination grid')
        cases.append(dict(unitId=identity, actorGrid=list(actor), destinationNative=list(destination_native),
                          destinationGrid=list(destination_grid), points=[list(p) for p in points], cursor=8))
    rows = re.findall(r'^\[streaming\] Cross navigation trial=(\d+) grid=(\d+),(\d+) '
                      r'actor=(-?\d+),(-?\d+) destination=(-?\d+),(-?\d+) '
                      r'points=10 queried=16 blocked=16 unchanged=1 reuse-refused=1 result=pass$',
                      Path(meta['log']).read_text(), re.M)
    if len(rows) != 64:
        raise ValueError('Missing all original navigation rejection cycles')
    for i, row in enumerate(rows):
        case = cases[i // 16]
        expected = [i % 16, *grid, *case['actorGrid'], *case['destinationGrid']]
        if list(map(int, row)) != expected:
            raise ValueError('Native navigation observation does not match immutable source coordinates')
    report.update(scope='64 private source-actor/command cycles in loaded Scions, with '
                  '1024 original outside-grid collision rejections and unchanged private '
                  'actors, paths and full grid pointer tables; stale route reuse refused',
                  sourceTerrainDimensions=list(source_dimensions), destinationTerrainDimensions=list(destination_dimensions),
                  actualDestinationGridDimensions=list(grid), sourceNavigationCases=cases,
                  originalPointCollisionCalls=1024, sourceCoordinateRejections=768,
                  outsideEdgeControlRejections=256, sourceRouteReuseRefused=True,
                  gridHeaderAndPointerTableDigestsPreserved=True,
                  gridPointerTableBytesCheckedPerSnapshot=grid[0] * grid[1] * 8,
                  noQueryEntersInBoundsFootprintBranch=True,
                  actualDestinationOutsideCollisionQualified=True,
                  viableDestinationLandingQualified=False, freshDestinationRouteQualified=False,
                  destinationNavigationQualified=False, routeBytesEdited=bool(meta.get('invalidatePath')))
    report['sourceSha256']['scripts/check-native-actor-cross-navigation.py'] = populated.sha(Path(__file__))
    report['sourceSha256']['scripts/audit-native-navigation.py'] = populated.sha(ROOT / 'scripts/audit-native-navigation.py')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'output/native-actor-cross-navigation-observed.json')
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Preserve previous qualification output')
    result = verify(args.manifest)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ['qualified', 'trials', 'originalPointCollisionCalls',
                                          'sourceRouteReuseRefused', 'freshDestinationRouteQualified']}))
