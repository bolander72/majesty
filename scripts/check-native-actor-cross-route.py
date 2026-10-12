#!/usr/bin/env python3
"""Qualify full original point routes and owned native search retirement."""
import argparse
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def verify(manifest):
    landing = load('landing', 'check-native-actor-cross-landing.py')
    populated = load('populated', 'check-native-actor-populated-stage.py')
    audit = load('route_audit', 'audit-native-fresh-route.py').audit()
    report = landing.verify(manifest)
    meta = report['fixture']
    if meta.get('freshRouteProbe') is not True:
        raise ValueError('Missing actual original fresh-route fixture')
    text = Path(meta['log']).read_text()
    rows = re.findall(
        r'^\[streaming\] Cross route warm=(\d+) trial=(\d+) count=(\d+) validated=(\d+) '
        r'capacity=64 expansion-limit=256 used-nodes=(\d+) node-capacity=8192 '
        r'redzones=1 scratch-clear=1 lists-empty=1 caches-retired=1 pool-same=1 '
        r'preserved=1 retained-bytes=0 retained-blocks=0 result=pass$', text, re.M)
    points = re.findall(
        r'^\[streaming\] Cross route points warm=(\d+) trial=(\d+) count=(\d+) '
        r'values=([0-9,;]+)$', text, re.M)
    expected = [(1, 0), *[(0, trial) for trial in range(16)]] * 4
    if len(rows) != 68 or len(points) != 68:
        raise ValueError('Missing complete original searches and cache retirement')
    validated_total, maximum_nodes, observations = 0, 0, []
    for row, raw, label in zip(rows, points, expected):
        warm, trial, count, validated, used = map(int, row)
        point_warm, point_trial, point_count = map(int, raw[:3])
        if ((warm, trial) != label or (point_warm, point_trial, point_count) != (warm, trial, count) or
                validated != count or not 1 < count < 64 or not 0 < used <= 2049):
            raise ValueError('Wrong search order, count, truncation or node budget')
        route = [list(map(int, point.split(','))) for point in raw[3].split(';')]
        if len(route) != count or any(len(point) != 2 or not all(0 <= n < 256 for n in point) for point in route):
            raise ValueError('Invalid route point count or coordinates')
        if route[0] != [119, 137] or route[-1] != [103, 129]:
            raise ValueError('Original search returned a partial or reversed route')
        for first, second in zip(route, route[1:]):
            dx, dy = second[0] - first[0], second[1] - first[1]
            if not (-1 <= dx <= 1 and -1 <= dy <= 1 and (dx or dy)):
                raise ValueError('Discontinuous original route')
        if report['landingCases'][(len(observations) // 17)]['admitted'] != [route[0], route[-1]]:
            raise ValueError('Search endpoints differ from original class admission')
        validated_total += count
        maximum_nodes = max(maximum_nodes, used)
        observations.append(dict(warm=bool(warm), trial=trial, count=count, usedNodes=used, points=route))
    warm = re.findall(
        r'^\[streaming\] Cross route warm actor=(\d+) retained-bytes=0 retained-blocks=0 '
        r'destroyed=1 pool-same=1 result=pass$', text, re.M)
    if list(map(int, warm)) != [case['unitId'] for case in report['sourceNavigationCases']]:
        raise ValueError('Missing zero-growth original search setup actor retirement')
    report.update(scope='68 full original point-to-point searches (four setup and 64 private '
                  'actor cycles) against actual Scions, with original class collision validation '
                  'of every returned point, original scratch clearing and teardown of fixture-owned '
                  'search/goal caches; no actor relocation or command intent transfer',
                  originalPathSearchExecuted=True, fullOriginalPointRouteQualified=True,
                  originalFreshPathSearches=68, repeatedActorSearchCycles=64,
                  originalRoutePointsValidated=validated_total,
                  originalRouteCollisionCalls=validated_total + 4 * 68,
                  maximumObservedSearchNodes=maximum_nodes, fixtureSearchExpansionLimit=256,
                  originalSearchNodeCapacity=8192, originalSearchNodeArrayBytes=8192 * 28,
                  outputCapacityPoints=64, truncatedRoutesAccepted=False,
                  originalOwnedSearchCacheRetirements=68,
                  originalSearchGridPointersCleared=True, originalSearchCachesAbsentAfterCleanup=True,
                  perSearchRetainedHeapBytes=0, perSearchRetainedHeapBlocks=0,
                  perSearchCrtPoolOccupancyPreserved=True,
                  nativeRouteObservations=observations,
                  freshDestinationRouteQualified=False, commandIntentTransferred=False,
                  sourceActorPositionChanged=False, actorActivationQualified=False,
                  continuousPagingQualified=False, wholeBrowserMemoryBoundQualified=False,
                  originalRouteInstructionAnchors=audit['verifiedInstructionAnchors'])
    for name in ['scripts/check-native-actor-cross-route.py', 'scripts/audit-native-fresh-route.py']:
        report['sourceSha256'][name] = populated.sha(ROOT / name)
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
    print(json.dumps({k: result[k] for k in ['qualified', 'originalFreshPathSearches',
                     'originalRoutePointsValidated', 'maximumObservedSearchNodes',
                     'perSearchRetainedHeapBytes', 'actorActivationQualified']}))
