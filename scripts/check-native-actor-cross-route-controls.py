#!/usr/bin/env python3
"""Offline landing/route evidence controls; never starts a game or browser."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Preserve previous controls')
    spec = importlib.util.spec_from_file_location('route', ROOT / 'scripts/check-native-actor-cross-route.py')
    verifier = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(verifier)
    positive = verifier.verify(args.manifest)
    meta = positive['fixture']
    log = Path(meta['log']).read_text()
    evidence = Path(tempfile.mkdtemp(prefix='native-cross-route-controls-', dir=ROOT / 'output'))
    controls = [
        ('missing-class-warmup', re.sub(r'^\[streaming\] Cross class warm .*\n', '', log, count=1, flags=re.M)),
        ('missing-landing-cycle', re.sub(r'^\[streaming\] Cross landing .*\n', '', log, count=1, flags=re.M)),
        ('empty-rectangle', log.replace('rectangle=-1,-1,1,2', 'rectangle=0,0,0,0', 1)),
        ('changed-grid', log.replace('grid-same=1', 'grid-same=0', 1)),
        ('missing-route-cycle', re.sub(r'^\[streaming\] Cross route warm=0 .*\n', '', log, count=1, flags=re.M)),
        ('missing-points', re.sub(r'^\[streaming\] Cross route points .*\n', '', log, count=1, flags=re.M)),
        ('wrong-route-endpoint', log.replace(';103,129\n', ';102,129\n', 1)),
        ('discontinuous-route', log.replace('119,137;118,136', '119,137;100,100', 1)),
        ('missing-grid-cleanup', log.replace('scratch-clear=1', 'scratch-clear=0', 1)),
        ('missing-cache-retirement', log.replace('caches-retired=1', 'caches-retired=0', 1)),
        ('retained-pool-block', log.replace('caches-retired=1 pool-same=1', 'caches-retired=1 pool-same=0', 1)),
        ('node-budget-exceeded', log.replace('used-nodes=69', 'used-nodes=2050', 1)),
        ('retained-heap-block', log.replace('retained-bytes=0 retained-blocks=0 destroyed=1 pool-same=1',
                                            'retained-bytes=32 retained-blocks=1 destroyed=1 pool-same=1', 1)),
    ]
    results = []
    for name, changed in controls:
        if changed == log:
            raise ValueError(f'Control failed to alter evidence: {name}')
        changed_log = evidence / f'{name}.log'
        changed_log.write_text(changed)
        manifest = evidence / f'{name}.json'
        manifest.write_text(json.dumps(dict(meta, log=str(changed_log)), indent=2) + '\n')
        try:
            verifier.verify(manifest)
        except ValueError as error:
            results.append(dict(control=name, rejected=True, reason=str(error)))
        else:
            raise ValueError(f'Accepted invalid evidence: {name}')
    for attempt in [6, 8]:
        manifest = ROOT / f'output/native-actor-cross-destination-attempt-{attempt:03d}.json'
        try:
            verifier.verify(manifest)
        except ValueError as error:
            results.append(dict(control=f'actual-failed-attempt-{attempt:03d}', rejected=True, reason=str(error)))
        else:
            raise ValueError('Accepted actual failed native attempt')
    before = set((ROOT / 'upstream/majesty-recomp/build').glob('actor-arrival-fixture-stage-populated-*'))
    for name, mode in [('landing-without-invalidation', '--landing-probe'),
                       ('route-without-landing', '--fresh-route-probe')]:
        process = subprocess.run([sys.executable, str(ROOT / 'scripts/run-native-actor-populated-stage-fixture.py'),
                                  str(args.manifest), '--attempt', '994', mode], capture_output=True, text=True)
        if process.returncode == 0 or 'nativePid' in process.stdout:
            raise ValueError('Runner accepted or launched an invalid mode')
        results.append(dict(control=name, rejected=True, launched=False))
    if before != set((ROOT / 'upstream/majesty-recomp/build').glob('actor-arrival-fixture-stage-populated-*')):
        raise ValueError('Invalid runner modes created a game fixture')
    args.output.write_text(json.dumps(dict(qualified=True, controls=results, nativeProcessesStarted=0,
                                          browserUsed=False, originalEvidenceModified=False,
                                          evidence=str(evidence), positiveManifest=str(args.manifest.resolve())), indent=2) + '\n')
    print(json.dumps(dict(rejected=len(results), nativeProcessesStarted=0)))


if __name__ == '__main__':
    main()
