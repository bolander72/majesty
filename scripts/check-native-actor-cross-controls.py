#!/usr/bin/env python3
"""Offline refusal controls against retained native cross-world observations."""
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / f'scripts/check-native-actor-cross-{name}.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    output = ROOT / 'output/native-actor-cross-controls-observed.json'
    if output.exists():
        raise ValueError('Preserve earlier controls')
    evidence = Path(tempfile.mkdtemp(prefix='native-cross-controls-', dir=ROOT / 'output'))
    results = []
    for name in ['source', 'destination']:
        original = ROOT / f'output/native-actor-cross-{name}-attempt-001.json'
        original_meta = json.loads(original.read_text())
        log = Path(original_meta['log']).read_text()
        controls = [('zero-cycles', re.sub(r'^\[streaming\] Populated stage actor=.*\n', '', log, flags=re.M))]
        if name == 'destination':
            def wrong_stamp(match):
                return 'when=' + str(int(match.group(1)) + 1) + ','
            controls.append(('wrong-age', re.sub(r'when=(\d+),', wrong_stamp, log, count=1)))
        for label, changed in controls:
            assert changed != log
            changed_log = evidence / f'{name}-{label}.log'
            changed_log.write_text(changed)
            meta = dict(original_meta, log=str(changed_log))
            manifest = evidence / f'{name}-{label}.json'
            manifest.write_text(json.dumps(meta, indent=2) + '\n')
            try:
                load(name).verify(manifest)
            except ValueError as error:
                results.append(dict(control=f'{name}-{label}', refused=True, reason=str(error)))
            else:
                raise ValueError('Verifier accepted a negative observation')
    source_proof = json.loads((ROOT / 'output/native-actor-cross-source-observed.json').read_text())
    source_proof['sourceCapture']['sha256'] = '0' * 64
    bad_proof = evidence / 'bad-source-proof.json'
    bad_proof.write_text(json.dumps(source_proof, indent=2) + '\n')
    # Proof paths must be in output itself. This misplaced proof must fail before
    # any profile or process is created, as must a source/destination world swap.
    commands = [
        ('source-wrong-world', ['output/native-actor-populated-stage-attempt-005.json', '--cross-source']),
        ('destination-wrong-world', ['output/native-actor-target-stage-source.json', '--cross-destination',
                                     'output/native-actor-cross-source-observed.json']),
        ('misplaced-source-proof', ['output/native-actor-populated-stage-attempt-005.json', '--cross-destination', str(bad_proof)]),
    ]
    before = set((GAME / 'build').glob('actor-arrival-fixture-stage-populated-*'))
    for label, args in commands:
        run = subprocess.run([sys.executable, str(ROOT / 'scripts/run-native-actor-populated-stage-fixture.py'),
                              *args, '--attempt', '991'], cwd=ROOT, capture_output=True, text=True)
        if run.returncode == 0 or 'nativePid' in run.stdout:
            raise ValueError('Runner launched a rejected control')
        results.append(dict(control=label, refused=True, launched=False))
    if before != set((GAME / 'build').glob('actor-arrival-fixture-stage-populated-*')):
        raise ValueError('Rejected inputs created a native fixture')
    if any((ROOT / f'output/{label}-attempt-991.json').exists() for label in
           ['native-actor-cross-source', 'native-actor-cross-destination']):
        raise ValueError('Rejected inputs created a run manifest')
    output.write_text(json.dumps(dict(qualified=True, controls=results, nativeProcessesStarted=0,
                                      originalObservationsModified=False, browserUsed=False,
                                      evidence=str(evidence)), indent=2) + '\n')
    print(json.dumps(dict(refused=len(results), nativeProcessesStarted=0)))


if __name__ == '__main__':
    main()
