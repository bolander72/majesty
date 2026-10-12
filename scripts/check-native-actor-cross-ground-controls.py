#!/usr/bin/env python3
"""Offline refusal controls for loaded-world ground qualification."""
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
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('manifest', type=Path); p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    if args.output.exists():
        raise ValueError('Preserve previous control evidence')
    spec = importlib.util.spec_from_file_location('ground', ROOT / 'scripts/check-native-actor-cross-ground.py')
    verifier = importlib.util.module_from_spec(spec); spec.loader.exec_module(verifier)
    positive = verifier.verify(args.manifest); meta = positive['fixture']; original = Path(meta['log']).read_text()
    evidence = Path(tempfile.mkdtemp(prefix='native-cross-ground-controls-', dir=ROOT / 'output'))
    controls = [
        ('missing-query', re.sub(r'^\[streaming\] Cross ground .*\n', '', original, count=1, flags=re.M)),
        ('wrong-query-count', re.sub(r'^\[streaming\] Cross ground .*\n', '', original, flags=re.M)),
        ('wrong-native-height', re.sub(r'(Cross ground .*?destination-ground=)(-?\d+)', lambda m: m[1] + str(int(m[2]) + 1), original, count=1)),
        ('wrong-source-z', re.sub(r'(Cross ground .*?source-z=)(-?\d+)', lambda m: m[1] + str(int(m[2]) + 1), original, count=1)),
        ('wrong-source-ground', re.sub(r'(Cross ground .*?source-ground=)(-?\d+)', lambda m: m[1] + str(int(m[2]) + 1), original, count=1)),
        ('wrong-terrain-dimensions', original.replace('terrain=128,128 stride=129', 'terrain=129,129 stride=129', 1)),
        ('terrain-changed', re.sub(r'(Cross ground .*?)preserved=1', r'\1preserved=0', original, count=1)),
        ('allocator-not-recovered', re.sub(r'(Cross ground .*?)balanced=1', r'\1balanced=0', original, count=1)),
    ]
    results = []
    for name, changed in controls:
        if changed == original:
            raise ValueError('Control did not change evidence')
        log = evidence / f'{name}.log'; log.write_text(changed)
        manifest = evidence / f'{name}.json'; manifest.write_text(json.dumps(dict(meta, log=str(log))))
        try:
            verifier.verify(manifest)
        except ValueError as error:
            results.append(dict(control=name, rejected=True, reason=str(error)))
        else:
            raise ValueError(f'Invalid ground evidence accepted: {name}')
    for name, change in [('flag-not-selected', {'groundProbe': False}),
                         ('changed-fixture-hash', {'groundPack': dict(meta['groundPack'], metadataSha256='0' * 64)})]:
        manifest = evidence / f'{name}.json'; manifest.write_text(json.dumps(dict(meta, **change)))
        try:
            verifier.verify(manifest)
        except ValueError as error:
            results.append(dict(control=name, rejected=True, reason=str(error)))
        else:
            raise ValueError(f'Invalid ground manifest accepted: {name}')
    try:
        verifier.verify(ROOT / 'output/native-actor-cross-destination-attempt-012.json')
    except ValueError as error:
        results.append(dict(control='actual-placement-only-attempt-012', rejected=True, reason=str(error)))
    else:
        raise ValueError('Placement-only run accepted as terrain qualification')
    before = set((ROOT / 'upstream/majesty-recomp/build').glob('actor-arrival-fixture-stage-populated-*'))
    rejected = subprocess.run([sys.executable, str(ROOT / 'scripts/run-native-actor-populated-stage-fixture.py'),
                               str(args.manifest), '--attempt', '994', '--ground-probe'], capture_output=True, text=True)
    if rejected.returncode == 0 or 'nativePid' in rejected.stdout or before != set((ROOT / 'upstream/majesty-recomp/build').glob('actor-arrival-fixture-stage-populated-*')):
        raise ValueError('Invalid ground mode created/launched a fixture')
    results.append(dict(control='ground-without-placement', rejected=True, launched=False))
    with args.output.open('x') as f:
        json.dump(dict(qualified=True, controls=results, nativeProcessesStarted=0, browserUsed=False,
                       originalEvidenceModified=False, evidence=str(evidence)), f, indent=2); f.write('\n')
    print(json.dumps(dict(rejected=len(results), nativeProcessesStarted=0)))


if __name__ == '__main__':
    main()
