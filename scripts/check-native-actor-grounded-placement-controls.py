#!/usr/bin/env python3
"""Offline refusals for actual grounded UNIT restoration evidence."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def main():
    p = argparse.ArgumentParser(description=__doc__); p.add_argument('manifest', type=Path); p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    if args.output.exists():
        raise ValueError('Preserve prior controls')
    spec = importlib.util.spec_from_file_location('grounded', ROOT / 'scripts/check-native-actor-grounded-placement.py')
    verifier = importlib.util.module_from_spec(spec); spec.loader.exec_module(verifier)
    positive = verifier.verify(args.manifest); meta = positive['fixture']; original = Path(meta['log']).read_text()
    evidence = Path(tempfile.mkdtemp(prefix='native-grounded-placement-controls-', dir=ROOT / 'output'))
    controls = [
        ('missing-grounded-restoration', re.sub(r'^\[streaming\] Cross grounded .*\n', '', original, count=1, flags=re.M)),
        ('wrong-mode', original.replace('mode=1 cache-inactive=1', 'mode=4 cache-inactive=1', 1)),
        ('active-cache', original.replace('cache-inactive=1', 'cache-inactive=0', 1)),
        ('wrong-height', re.sub(r'(Cross grounded .*?z=)(-?\d+)', lambda m: m[1] + str(int(m[2]) + 1), original, count=1)),
        ('lost-refusal', original.replace('refused=5 cache-queries=1', 'refused=4 cache-queries=1', 1)),
        ('missing-original-cache-query', original.replace('cache-queries=1', 'cache-queries=0', 1)),
        ('writer-mismatch', re.sub(r'(Cross grounded .*?)equal=1', r'\1equal=0', original, count=1)),
    ]
    results = []
    for name, changed in controls:
        if changed == original:
            raise ValueError('Control did not alter evidence')
        log = evidence / f'{name}.log'; log.write_text(changed)
        manifest = evidence / f'{name}.json'; manifest.write_text(json.dumps(dict(meta, log=str(log))))
        try:
            verifier.verify(manifest)
        except ValueError as error:
            results.append(dict(control=name, rejected=True, reason=str(error)))
        else:
            raise ValueError(f'Invalid grounded evidence accepted: {name}')
    writer = Path(meta['profile']) / 'Placement_Roundtrip.bin'; raw_writer = writer.read_bytes()
    original_read = Path.read_bytes
    for name, offset in [('changed-final-native-z', 68), ('changed-unused-cache-point', 104)]:
        changed = bytearray(raw_writer); changed[offset] ^= 1

        def altered(path):
            return bytes(changed) if path == writer else original_read(path)

        with patch.object(Path, 'read_bytes', altered):
            try:
                verifier.verify(args.manifest)
            except ValueError as error:
                results.append(dict(control=name, rejected=True, reason=str(error)))
            else:
                raise ValueError('Altered original writer file accepted')
    if writer.read_bytes() != raw_writer:
        raise ValueError('Offline control changed original writer artifact')
    try:
        verifier.verify(ROOT / 'output/native-actor-cross-destination-attempt-013.json')
    except ValueError as error:
        results.append(dict(control='actual-height-observation-only-attempt-013', rejected=True, reason=str(error)))
    else:
        raise ValueError('Observation-only run accepted as grounded restoration')
    before = set((ROOT / 'upstream/majesty-recomp/build').glob('actor-arrival-fixture-stage-populated-*'))
    rejected = subprocess.run([sys.executable, str(ROOT / 'scripts/run-native-actor-populated-stage-fixture.py'),
                               str(args.manifest), '--attempt', '993', '--grounded-placement'], capture_output=True, text=True)
    if rejected.returncode == 0 or 'nativePid' in rejected.stdout or before != set((ROOT / 'upstream/majesty-recomp/build').glob('actor-arrival-fixture-stage-populated-*')):
        raise ValueError('Invalid grounded mode created/launched a fixture')
    results.append(dict(control='grounded-without-ground-query', rejected=True, launched=False))
    with args.output.open('x') as f:
        json.dump(dict(qualified=True, controls=results, nativeProcessesStarted=0, browserUsed=False,
                       originalEvidenceModified=False, evidence=str(evidence)), f, indent=2); f.write('\n')
    print(json.dumps(dict(rejected=len(results), nativeProcessesStarted=0)))


if __name__ == '__main__':
    main()
