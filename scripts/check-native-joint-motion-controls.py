#!/usr/bin/env python3
"""Refuse incomplete natural-motion evidence without launching the game."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import tempfile
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('manifest', type=Path)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    spec = importlib.util.spec_from_file_location('motion_checker', ROOT / 'scripts/check-native-joint-motion.py')
    checker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(checker)
    positive = checker.verify(a.manifest.resolve())
    m = positive['fixture']
    log = Path(m['log']).read_text()
    owned = Path(tempfile.mkdtemp(prefix='native-joint-motion-controls-', dir=ROOT / 'output'))
    results = []

    def refuse(name, manifest):
        try:
            checker.verify(manifest)
        except ValueError as error:
            results.append(dict(control=name, rejected=True, reason=str(error)))
        else:
            raise ValueError('Invalid natural motion accepted: ' + name)

    for name, field, value in [('observation-disabled', 'observeMotion', False), ('pinned-clock', 'clockMode', 'pinned'),
                               ('nonterminal', 'nativeSessionTerminal', False), ('failed-process', 'nativeExitCode', 6)]:
        manifest = owned / f'{name}.json'
        manifest.write_text(json.dumps(dict(m, **{field: value})))
        refuse(name, manifest)
    changes = [
        ('missing-completion', re.sub(r'^\[streaming\] Joint motion completed .*\n', '', log, flags=re.M)),
        ('missing-last-sample', re.sub(r'^\[streaming\] Joint motion sample elapsed=240 .*\n', '', log, flags=re.M)),
        ('no-original-path', re.sub(r'path=\d+', 'path=0', log)),
        ('unbalanced-dispatch', re.sub(r'(Joint motion completed .*?returns=)\d+', r'\g<1>0', log)),
        ('unbalanced-leaf', re.sub(r'(Joint motion completed .*?leaf-returns=)\d+', r'\g<1>0', log)),
        ('missing-physical-membership', re.sub(r'(Joint motion sample .*?physical=)1', r'\g<1>0', log, count=1)),
        ('missing-drawing-registration', re.sub(r'(Joint motion sample .*?drawing=)\d+', r'\g<1>0', log, count=1)),
        ('lost-backlink', re.sub(r'(Joint motion sample .*?links=)1', r'\g<1>0', log, count=1)),
        ('stale-source-coordinate', re.sub(r'(Joint motion sample .*?fixed=)-?\d+', r'\g<1>10584064', log, count=1)),
        ('stalled-clock', re.sub(r'(Joint motion sample elapsed=16 clock=)\d+', r'\g<1>8650', log)),
        ('hooks-retained', log.replace('hooks-removed=1', 'hooks-removed=0')),
        ('wrong-owned-actor', re.sub(r'(Joint motion begin unit=)\d+', r'\g<1>511', log)),
        ('wrong-sample-count', re.sub(r'(Joint motion completed .*?samples=)\d+', r'\g<1>17', log)),
    ]
    first = re.search(r'Joint motion sample elapsed=0 .*?cells=(-?\d+),(-?\d+)', log)
    changes.append(('navigation-cells-never-transition', re.sub(r'(Joint motion sample .*?cells=)-?\d+,-?\d+',
                                                              lambda match: match[1] + ','.join(first.groups()), log)))
    if m.get('scheduleNpc') is True or m.get('reloadScheduledNpc') is True or m.get('reloadEvolvedNpc') is True:
        changes.append(('missing-ai-completion', re.sub(r'^\[streaming\] Joint script motion completed .*\n', '', log, flags=re.M)))
        for field in ['agent-calls', 'agent-returns', 'contexts', 'context-returns', 'executed', 'hooks-removed']:
            changes.append(('ai-' + field + '-zero', re.sub(r'(Joint script motion completed .*?' + field + r'=)\d+', r'\g<1>0', log)))
    if m.get('reloadScheduledNpc') is True or m.get('reloadEvolvedNpc') is True:
        changes.append(('missing-restored-queue', re.sub(r'^\[streaming\] Joint scheduled reload .*\n', '', log, flags=re.M)))
        changes.append(('restored-queue-mutated', log.replace('queue-mutated=0', 'queue-mutated=1')))
    for name, changed in changes:
        if changed == log:
            raise ValueError('Control did not change evidence: ' + name)
        file = owned / f'{name}.log'
        file.write_text(changed)
        manifest = owned / f'{name}.json'
        manifest.write_text(json.dumps(dict(m, log=str(file))))
        refuse(name, manifest)
    original = Path.read_bytes
    file = Path(m['profile']) / 'Joint_Reload_Orders.bin'
    raw = bytearray(file.read_bytes())
    raw[120] ^= 1
    with patch.object(Path, 'read_bytes', lambda path: bytes(raw) if path == file else original(path)):
        refuse('corrupt-restored-move-point', a.manifest.resolve())
    result = dict(qualified=True, rejected=len(results), controls=results, browserUsed=False,
                  nativeProcessesStarted=0, originalEvidenceModified=False)
    with a.output.open('x') as f:
        json.dump(result, f, indent=2)
        f.write('\n')
    print(json.dumps(dict(rejected=len(results), nativeProcessesStarted=0)))


if __name__ == '__main__':
    main()
