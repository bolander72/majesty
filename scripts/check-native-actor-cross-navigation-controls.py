#!/usr/bin/env python3
"""Offline negative observations; never launches a native host or browser."""
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    output = ROOT / 'output/native-actor-cross-navigation-controls-observed.json'
    if output.exists():
        raise ValueError('Preserve previous control evidence')
    spec = importlib.util.spec_from_file_location('invalidate', ROOT / 'scripts/check-native-actor-cross-path-invalidate.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    original = ROOT / 'output/native-actor-cross-destination-attempt-004.json'
    meta = json.loads(original.read_text())
    log = Path(meta['log']).read_text()
    evidence = Path(tempfile.mkdtemp(prefix='native-cross-navigation-controls-', dir=ROOT / 'output'))
    controls = [
        ('missing-navigation', re.sub(r'^\[streaming\] Cross navigation .*\n', '', log, count=1, flags=re.M)),
        ('wrong-native-coordinate', re.sub(r'actor=(-?\d+),', 'actor=-999,', log, count=1)),
        ('missing-path-invalidation', re.sub(r'^\[streaming\] Cross path invalidate .*\n', '', log, count=1, flags=re.M)),
        ('wrong-shortened-size', log.replace('serialized-bytes=540', 'serialized-bytes=620', 1)),
        ('missing-owned-path-free', log.replace('cleanup frees=18 expected=18 retained=0',
                                               'cleanup frees=17 expected=18 retained=80', 1)),
    ]
    results = []
    for name, changed in controls:
        assert changed != log
        changed_log = evidence / f'{name}.log'
        changed_log.write_text(changed)
        changed_meta = dict(meta, log=str(changed_log))
        manifest = evidence / f'{name}.json'
        manifest.write_text(json.dumps(changed_meta, indent=2) + '\n')
        try:
            module.verify(manifest)
        except ValueError as error:
            results.append(dict(control=name, rejected=True, reason=str(error)))
        else:
            raise ValueError('Accepted an invalid native observation')
    before = set((ROOT / 'upstream/majesty-recomp/build').glob('actor-arrival-fixture-stage-populated-*'))
    for name, args in [('navigation-without-destination', ['--navigation-probe']),
                       ('invalidation-without-navigation', ['--invalidate-path'])]:
        process = subprocess.run([sys.executable, str(ROOT / 'scripts/run-native-actor-populated-stage-fixture.py'),
                                  str(original), '--attempt', '992', *args], capture_output=True, text=True)
        if process.returncode == 0 or 'nativePid' in process.stdout:
            raise ValueError('Runner launched an invalid mode combination')
        results.append(dict(control=name, rejected=True, launched=False))
    if before != set((ROOT / 'upstream/majesty-recomp/build').glob('actor-arrival-fixture-stage-populated-*')):
        raise ValueError('Rejected inputs created a game fixture')
    output.write_text(json.dumps(dict(qualified=True, controls=results, nativeProcessesStarted=0,
                                      originalEvidenceModified=False, browserUsed=False,
                                      evidence=str(evidence)), indent=2) + '\n')
    print(json.dumps(dict(rejected=len(results), nativeProcessesStarted=0)))


if __name__ == '__main__':
    main()
