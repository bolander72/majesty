#!/usr/bin/env python3
"""Qualify original loaded destination terrain queries alongside private actors."""
import argparse
import hashlib
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


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(4096), b''):
            digest.update(b)
    return digest.hexdigest()


def terrain_samples(path, pin, cases, label):
    if sha(path) != pin or path.stat().st_size > 64 * 1024 * 1024:
        raise ValueError('Changed copied terrain checkpoint')
    size = path.stat().st_size
    with path.open('rb') as f:
        def header(at, end):
            if at < 0 or at + 16 > end:
                raise ValueError('Truncated terrain header')
            f.seek(at); raw = f.read(16)
            tag, length, version, count = struct.unpack('<4s3I', raw)
            if at + 16 + length > end:
                raise ValueError('Invalid terrain header')
            return tag, at + 16 + length, version, count

        at, roots, root_count = 0, {}, 0
        while at < size:
            tag, end, version, count = header(at, size)
            root_count += 1
            if root_count > 128 or (tag in [b'MAP ', b'MTER'] and tag in roots):
                raise ValueError('Invalid root terrain chunks')
            if tag in [b'MAP ', b'MTER']:
                roots[tag] = (at, end, version, count)
            at = end
        map_at, map_end, _, _ = roots[b'MAP ']
        if header(map_at + 16, map_end) != (b'PRIM', map_end, 2, 0):
            raise ValueError('Wrong map descriptor')
        f.seek(map_at + 32); width, height = struct.unpack('<2I', f.read(8))
        expected_width = 256 if label == 'source' else 128
        if width != expected_width or height != expected_width:
            raise ValueError('Wrong terrain dimensions')
        terrain_at, terrain_end, version, count = roots[b'MTER']
        if version or count != 2:
            raise ValueError('Wrong terrain descriptor')
        vertex_at = None; at = terrain_at + 16
        for _ in range(2):
            tag, end, version, count = header(at, terrain_end)
            if tag == b'MVTX':
                if version or count != 1 or header(at + 16, end) != (b'PRIM', end, 2, (width + 1) * (height + 1)):
                    raise ValueError('Wrong original vertex descriptor')
                vertex_at = at + 32
                if end - vertex_at != (width + 1) * (height + 1) * 9:
                    raise ValueError('Wrong vertex payload size')
            at = end
        if at != terrain_end or vertex_at is None:
            raise ValueError('Missing original vertices')
        results = []
        oracle = load('ground_cpu', 'check-native-ground-instructions.py').oracle
        for c in cases:
            sample = c[label]; p = sample['position']; x, y = p['x'] // 65536, p['y'] // 65536
            if not (0 <= x + 1 < width and 0 <= y + 1 < height):
                raise ValueError('Sample outside original interpolation interior')
            bits, heights = [], []
            for dx, dy in [(0, 0), (1, 0), (0, 1), (1, 1)]:
                f.seek(vertex_at + ((y + dy) * (width + 1) + x + dx) * 9)
                raw = f.read(4); bits.append(struct.unpack('<I', raw)[0]); value = struct.unpack('<f', raw)[0]
                if not -32768 <= value < 32768:
                    raise ValueError('Unsafe native height conversion')
                heights.append(int(value * 65536))
            result = oracle(p['x'], p['y'], heights)
            if sample['heightBits'] != bits or sample['heights'] != heights or sample['groundQ16'] != result or sample['cell'] != dict(x=x, y=y):
                raise ValueError('Ground sample does not match original copied checkpoint')
            results.append(result)
    return results


def verify(manifest, *, grounded=False):
    report = load('placement', 'check-native-actor-cross-placement.py').verify(manifest, grounded=grounded)
    audit = load('ground', 'audit-native-ground.py').audit()
    meta = report['fixture']
    if meta.get('groundProbe') is not True:
        raise ValueError('Missing original loaded-world ground probe')
    pack = meta['groundPack']
    binary = ROOT / 'output/native-actor-ground-fixtures.bin'
    metadata = binary.with_suffix('.json')
    cpu_path = ROOT / 'output/native-ground-emulated-observed.json'
    js_path = ROOT / 'output/native-ground-js-qualified.json'
    if (Path(pack['path']).resolve() != binary or Path(pack['metadata']).resolve() != metadata or
            Path(pack['cpuEvidence']).resolve() != cpu_path or sha(binary) != pack['sha256'] or
            sha(metadata) != pack['metadataSha256'] or sha(cpu_path) != pack['cpuEvidenceSha256'] or
            sha(Path(meta['profile']) / 'Ground_Samples.bin') != pack['sha256']):
        raise ValueError('Changed immutable ground fixture')
    plan, cpu, js = [json.loads(p.read_text()) for p in [metadata, cpu_path, js_path]]
    if (plan['sha256'] != pack['sha256'] or plan['placementMetadataSha256'] != meta['placementPack']['metadataSha256'] or
            not cpu['qualified'] or cpu['fixtureMetadataSha256'] != sha(metadata) or cpu['executableSha256'] != audit['executableSha256'] or
            cpu['originalGroundQueries'] != 79 or len(cpu['vectors']) != 66 or len(cpu['copiedTerrainSamples']) != 8 or
            not cpu['terrainAndSentinelsUnchanged'] or cpu['mappedGuestBytesAfterCleanup'] or
            not js['qualified'] or js['originalCpuEvidenceSha256'] != sha(cpu_path) or js['fixtureMetadataSha256'] != sha(metadata)):
        raise ValueError('Ground CPU/JavaScript evidence mismatch')
    for rel, pin in js['sourceSha256'].items():
        if sha(ROOT / rel) != pin:
            raise ValueError('JavaScript ground sampler changed after qualification')
    bindings = json.loads((ROOT / 'output/native-actor-cross-binding-fixtures.json').read_text())
    original_results = {}
    for label in ['source', 'destination']:
        if plan[label]['path'] != bindings[label] or plan[label]['sha256'] != bindings[label + 'Sha256']:
            raise ValueError('Ground checkpoint does not match bound actor source/destination')
        original_results[label] = terrain_samples(ROOT / bindings[label], bindings[label + 'Sha256'], plan['cases'], label)
    data = binary.read_bytes()
    if len(data) != 108 or struct.unpack_from('<3I', data) != (0x3148474e, 1, 4) or len(plan['cases']) != 4:
        raise ValueError('Wrong bounded ground sample input')
    for index, c in enumerate(plan['cases']):
        projection = report['projectedActorCases'][index]
        source, destination = c['source'], c['destination']
        expected = (c['id'], destination['position']['x'], destination['position']['y'], source['position']['z'],
                    original_results['source'][index], original_results['destination'][index])
        if (struct.unpack_from('<6i', data, 12 + index * 24) != expected or c['id'] != projection['id'] or
                list(source['position'].values()) != projection['sourceFixed'] or
                [destination['position']['x'], destination['position']['y'], c['destination']['groundQ16'] if grounded else destination['position']['z']] != projection['fixed'] or
                c['sourceOffsetQ16'] != expected[3] - expected[4]):
            raise ValueError('Ground fixture differs from original restored actor projection')
        for label in ['source', 'destination']:
            observed = [v for v in cpu['copiedTerrainSamples'] if v['id'] == c['id'] and v['checkpoint'] == label]
            if len(observed) != 1 or observed[0]['position'] != c[label]['position'] or observed[0]['heights'] != c[label]['heights'] or observed[0]['observedQ16'] != c[label]['groundQ16']:
                raise ValueError('Ground sample differs from original CPU observation')
    rows = re.findall(r'^\[streaming\] Cross ground actor=(\d+) trial=(\d+) terrain=(\d+),(\d+) stride=(\d+) '
                      r'fixed=(-?\d+),(-?\d+) source-z=(-?\d+) source-ground=(-?\d+) destination-ground=(-?\d+) '
                      r'preserved=1 balanced=1 result=pass$', Path(meta['log']).read_text(), re.M)
    if len(rows) != 64:
        raise ValueError('Missing complete original loaded-world terrain query/preservation cycles')
    dimensions = set()
    for index, raw in enumerate(rows):
        row = list(map(int, raw)); c = plan['cases'][index // 16]; p = c['destination']['position']
        if row[:2] != [c['id'], index % 16] or row[2:5] != [128, 128, 129] or row[5:] != [p['x'], p['y'], p['z'], c['source']['groundQ16'], c['destination']['groundQ16']]:
            raise ValueError('Loaded terrain observation disagrees with pinned ground oracle')
        dimensions.add(tuple(row[2:5]))
    report.update(scope='64 original loaded-destination ground queries, exact private projected UNIT restoration and cleanup; no actor Z editing or activation',
                  originalDestinationGroundQueries=64, originalGroundCpuQueries=79, originalGroundInstructionAnchors=33,
                  sourceGroundOffsetsQ16=[c['sourceOffsetQ16'] for c in plan['cases']],
                  sourceGroundOffsetsNonzero=True, groundHeightCases=plan['cases'], actualDestinationTerrainDimensions=list(dimensions.pop()),
                  originalDestinationTerrainAndVerticesPreserved=True, originalGroundQueryHeapPoolHooksRecovered=True,
                  actorZEdited=grounded, actorMovementElevationPolicyQualified=False, terrainToActorElevationQualified=False,
                  terrainContinuityQualified=False, actorActivationQualified=False, continuousPagingQualified=False)
    for p in [binary, metadata, cpu_path, js_path]:
        report['evidenceSha256'][str(p.relative_to(ROOT))] = sha(p)
    for rel in ['scripts/check-native-actor-cross-ground.py', 'scripts/audit-native-ground.py', 'scripts/check-native-ground-instructions.py',
                'scripts/prepare-native-actor-ground.mjs', 'scripts/qualify-native-ground.mjs', 'web/world/terrain-ground.mjs', 'tests/terrain-ground.test.mjs']:
        report['sourceSha256'][rel] = sha(ROOT / rel)
    return report


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('manifest', type=Path); p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    result = verify(args.manifest)
    with args.output.open('x') as f:
        json.dump(result, f, indent=2); f.write('\n')
    print(json.dumps({k: result[k] for k in ['qualified', 'originalDestinationGroundQueries', 'sourceGroundOffsetsQ16', 'actorZEdited']}))
