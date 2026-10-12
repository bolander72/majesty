#!/usr/bin/env python3
"""Qualify original private restoration at actual destination ground height."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import struct

ROOT = Path(__file__).resolve().parents[1]


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def verify(manifest):
    ground = load('ground', 'check-native-actor-cross-ground.py')
    report = ground.verify(manifest, grounded=True)
    audit = load('grounding', 'audit-native-actor-grounding.py').audit()
    meta = report['fixture']
    if meta.get('groundedPlacement') is not True:
        raise ValueError('Missing original grounded restoration')
    raw = (Path(meta['profile']) / 'Populated_Order_Stage.bin').read_bytes()
    cursor, caches = 8, []
    for case in report['groundHeightCases']:
        identity, size, requests, payload, *_ = struct.unpack_from('<7I', raw, cursor); cursor += 28
        unit = raw[cursor:cursor + size]; cursor += size + requests * 20 + payload + 4 + 3 * 32 + 4 + 2 * 20
        fields = [struct.unpack_from('<I', unit, at)[0] for at in [24, 56, 80, 84, 92, 96]]
        if identity != case['id'] or size != 375 or fields != [9, 0, 1, 1, 1, 0]:
            raise ValueError('Source actor is not the supported parentless ground/inactive-cache record')
        caches.append(dict(id=identity, mode=1, cachePresent=True, cacheVersion=1, cacheActive=0,
                           inactivePointWords=list(struct.unpack_from('<2I', unit, 100))))
    rows = re.findall(r'^\[streaming\] Cross grounded actor=(\d+) trial=(\d+) mode=1 cache-inactive=1 '
                      r'z=(-?\d+) refused=5 cache-queries=1 equal=1 result=pass$', Path(meta['log']).read_text(), re.M)
    if len(rows) != 64:
        raise ValueError('Missing all original grounded/cache/writer/refusal cycles')
    for index, row in enumerate(rows):
        case = report['groundHeightCases'][index // 16]
        if list(map(int, row)) != [case['id'], index % 16, case['destination']['groundQ16']]:
            raise ValueError('Grounded restoration differs from actual original destination height')
    # The last completed cycle leaves only an isolated writer file. Independently
    # require every other UNIT byte, including unused cache coordinates, intact.
    unit = raw[0:0]
    cursor = 8
    for _ in range(4):
        identity, size, requests, payload, *_ = struct.unpack_from('<7I', raw, cursor); cursor += 28
        unit = raw[cursor:cursor + size]; cursor += size + requests * 20 + payload + 4 + 3 * 32 + 4 + 2 * 20
    projected = report['projectedActorCases'][-1]
    expected = bytearray(unit)
    struct.pack_into('<I', expected, 36, 0)  # Private staged identity is deliberately unpublished.
    struct.pack_into('<3i', expected, 60, *projected['fixed'])
    struct.pack_into('<2i', expected, 72, *projected['cells'])
    observed = (Path(meta['profile']) / 'Placement_Roundtrip.bin').read_bytes()
    if observed != bytes(expected):
        raise ValueError('Final original writer file differs beyond allowed coordinate/height/cell edits')
    report.update(scope='64 private original grounded UNIT restores with actual terrain queries, inactive-cache original branch, exact writers and cleanup; no live crossing',
                  privateGroundedCoordinateRestorationQualified=True, privateGroundedActorRestorations=64,
                  groundedHeightMatchesOriginalDestinationTerrain=True, nativeInactiveCacheQueries=64,
                  groundedPreflightRefusals=320, refusalsPreservePreparedUnit=True,
                  groundedSourceCacheCases=caches, originalGroundingInstructionAnchors=audit['verifiedInstructionAnchors'],
                  inactiveCachePointWordsPreserved=True, finalOriginalWriterFileIndependentlyMatched=True,
                  actorZEdited=True, actorMovementElevationPolicyQualified=False,
                  supportedPrivateGroundPlacementPolicyQualified=True,
                  activeNavigationCacheMigrationQualified=False, animationTrajectoryMigrationQualified=False,
                  worldAssociationPerformed=False, actorActivationQualified=False, continuousPagingQualified=False)
    for rel in ['scripts/check-native-actor-grounded-placement.py', 'scripts/audit-native-actor-grounding.py',
                'scripts/check-native-actor-cross-placement.py', 'scripts/check-native-actor-cross-ground.py']:
        report['sourceSha256'][rel] = ground.sha(ROOT / rel)
    report['evidenceSha256'][str((Path(meta['profile']) / 'Placement_Roundtrip.bin').relative_to(ROOT))] = ground.sha(Path(meta['profile']) / 'Placement_Roundtrip.bin')
    return report


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__); p.add_argument('manifest', type=Path); p.add_argument('--output', type=Path, required=True)
    args = p.parse_args(); result = verify(args.manifest)
    with args.output.open('x') as f:
        json.dump(result, f, indent=2); f.write('\n')
    print(json.dumps({k: result[k] for k in ['qualified', 'privateGroundedActorRestorations', 'nativeInactiveCacheQueries', 'groundedPreflightRefusals', 'actorActivationQualified']}))
