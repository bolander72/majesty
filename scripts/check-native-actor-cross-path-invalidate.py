#!/usr/bin/env python3
"""Qualify private stale-route invalidation, original serialization and cleanup."""
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
    navigation = load('cross_navigation', 'check-native-actor-cross-navigation.py')
    populated = load('populated', 'check-native-actor-populated-stage.py')
    report = navigation.verify(manifest, allow_invalidation=True)
    meta = report['fixture']
    if meta.get('invalidatePath') is not True:
        raise ValueError('Missing actual private path invalidation')
    branch_path = ROOT / 'output/native-order-replan-branch-observed.json'
    branch = json.loads(branch_path.read_text())
    if (branch.get('qualified') is not True or branch['executableSha256'] !=
            '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542' or
            branch['originalPathSearchExecuted'] is not False or branch['nativeOrderBytes'] != 100 or
            branch['serializedPathBodyBytes'] != 140 or branch['nativeCapacityOffset'] != 0x5c or
            branch['mappedGuestBytesAfterCleanup'] != 0):
        raise ValueError('Missing original branch/layout evidence')
    for name, digest in branch['sourceSha256'].items():
        if populated.sha(ROOT / name) != digest:
            raise ValueError('Branch evidence source changed')
    observations = [(r['cursor'], r['count'], r['branch'], r['stackPoison']) for r in branch['observations']]
    expected = [(cursor, count, selected, poison) for poison in [0x5a, 0xc3]
                for cursor, count, selected in [(8, 10, 'reuse'), (9, 10, 'replan'),
                                                (10, 10, 'replan'), (0, 0, 'replan'), (0, 10, 'reuse')]]
    if observations != expected:
        raise ValueError('Missing original canonical branch cases')
    rows = re.findall(r'^\[streaming\] Cross path invalidate trial=(\d+) old-count=10 count=0 cursor=0 '
                      r'capacity=10 retained-bytes=80 serialized-bytes=540 replan-selected=1 result=pass$',
                      Path(meta['log']).read_text(), re.M)
    if list(map(int, rows)) != list(range(16)) * 4:
        raise ValueError('Missing complete private invalidation cycles')
    report.update(scope='64 private actor cycles in actual Scions, with original source-route '
                  'rejection, typed target/time edits, private cached Path count/cursor reset, '
                  'exact original shortened command serialization and original owned cleanup; '
                  'no destination placement or fresh path search',
                  privatePathInvalidationQualified=True, clearedCachedPaths=64,
                  staleWaypointsOmittedFromOriginalSerialization=640,
                  retainedOwnedPathCapacityBytesPerCycle=80,
                  serializedCommandPayloadBytes=540, originalSourceCommandPayloadBytes=620,
                  privateNativeOrderBytes=100, serializedPathBodyBytes=140,
                  nativePathCapacityPreserved=True, cursorResetWithoutCountResetInsufficient=True,
                  originalCursorCountBranchQualified=True, originalPathSearchExecuted=False,
                  freshDestinationRouteQualified=False, viableDestinationLandingQualified=False,
                  productionArrivalQualified=False, actorActivationQualified=False)
    report['sourceSha256']['scripts/check-native-actor-cross-path-invalidate.py'] = populated.sha(Path(__file__))
    report['evidenceSha256'][str(branch_path.relative_to(ROOT))] = populated.sha(branch_path)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'output/native-actor-cross-path-invalidate-observed.json')
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Preserve prior qualification output')
    result = verify(args.manifest)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ['qualified', 'trials', 'clearedCachedPaths',
                                          'originalJournalExtentFrees', 'freshDestinationRouteQualified']}))
