#!/usr/bin/env python3
"""Offline rejection controls for the actual native coordinate fixture."""
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
        parser.error('Preserve prior control evidence')
    spec = importlib.util.spec_from_file_location('placement', ROOT / 'scripts/check-native-actor-cross-placement.py')
    verifier = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(verifier)
    report = verifier.verify(args.manifest)
    meta, results = report['fixture'], []
    log = Path(meta['log']).read_text()
    evidence = Path(tempfile.mkdtemp(prefix='native-cross-placement-controls-', dir=ROOT / 'output'))
    controls = [
        ('missing-placement', re.sub(r'^\[streaming\] Cross placement .*\n', '', log, count=1, flags=re.M)),
        ('wrong-fixed-position', log.replace('fixed=2208219,4476448,261580', 'fixed=2208220,4476448,261580', 1)),
        ('wrong-origin-delta', log.replace('delta=-4096,0', 'delta=0,0', 1)),
        ('cell-collapsed-to-position', log.replace('cells=67,137', 'cells=67,136', 1)),
        ('changed-z', log.replace('fixed=2208219,4476448,261580', 'fixed=2208219,4476448,0', 1)),
        ('collision-rejected', log.replace('queried=4 clear=4', 'queried=4 clear=3', 1)),
        ('writer-mismatch', re.sub(r'(Cross placement .*?)equal=1', r'\1equal=0', log, count=1)),
        ('actor-not-destroyed', re.sub(r'(Cross placement .*?)destroyed=1', r'\1destroyed=0', log, count=1)),
        ('world-state-changed', re.sub(r'(Cross placement .*?)preserved=1', r'\1preserved=0', log, count=1)),
        ('allocation-not-recovered', re.sub(r'(Cross placement .*?)balanced=1', r'\1balanced=0', log, count=1)),
    ]
    for name, changed in controls:
        if changed == log:
            raise ValueError(f'Control did not alter evidence: {name}')
        changed_log = evidence / f'{name}.log'
        changed_log.write_text(changed)
        manifest = evidence / f'{name}.json'
        manifest.write_text(json.dumps(dict(meta, log=str(changed_log)), indent=2) + '\n')
        try:
            verifier.verify(manifest)
        except ValueError as error:
            results.append(dict(control=name, rejected=True, reason=str(error)))
        else:
            raise ValueError(f'Invalid evidence accepted: {name}')
    try:
        verifier.verify(ROOT / 'output/native-actor-cross-destination-attempt-011.json')
    except ValueError as error:
        results.append(dict(control='actual-stale-cell-attempt-011', rejected=True, reason=str(error)))
    else:
        raise ValueError('Accepted actual zero-cycle native run')
    before = set((ROOT / 'upstream/majesty-recomp/build').glob('actor-arrival-fixture-stage-populated-*'))
    process = subprocess.run([sys.executable, str(ROOT / 'scripts/run-native-actor-populated-stage-fixture.py'),
                              str(args.manifest), '--attempt', '995', '--placement-probe'], capture_output=True, text=True)
    if process.returncode == 0 or 'nativePid' in process.stdout or before != set(
            (ROOT / 'upstream/majesty-recomp/build').glob('actor-arrival-fixture-stage-populated-*')):
        raise ValueError('Invalid placement mode created or launched a fixture')
    results.append(dict(control='placement-without-route', rejected=True, launched=False))
    args.output.write_text(json.dumps(dict(qualified=True, controls=results, nativeProcessesStarted=0,
                                          browserUsed=False, originalEvidenceModified=False,
                                          evidence=str(evidence)), indent=2) + '\n')
    print(json.dumps(dict(rejected=len(results), nativeProcessesStarted=0)))


if __name__ == '__main__':
    main()
