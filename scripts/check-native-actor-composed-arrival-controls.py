#!/usr/bin/env python3
"""Offline negative controls for grounded same-actor command and route composition."""
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
        raise ValueError('Preserve prior composed controls')
    spec = importlib.util.spec_from_file_location('composed_controls', ROOT / 'scripts/check-native-actor-composed-arrival.py')
    verifier = importlib.util.module_from_spec(spec); spec.loader.exec_module(verifier)
    positive = verifier.verify(args.manifest); meta = positive['fixture']; original = Path(meta['log']).read_text()
    evidence = Path(tempfile.mkdtemp(prefix='native-composed-arrival-controls-', dir=ROOT / 'output'))
    def change_points(which):
        def changed(match):
            points = match[2].split(';')
            if which == 'start':
                points[0] = '68,136'
            elif which == 'end':
                points[-1] = '103,135'
            else:
                points[1] = '1,1'
            return match[1] + ';'.join(points)
        return re.sub(r'(^\[streaming\] Composed route points .*?values=)([0-9,;]+)$', changed, original, count=1, flags=re.M)
    controls = [
        ('missing-composed-graph', re.sub(r'^\[streaming\] Composed graph read .*\n', '', original, count=1, flags=re.M)),
        ('missing-typed-binding', re.sub(r'^\[streaming\] Composed binding .*\n', '', original, count=1, flags=re.M)),
        ('changed-target', original.replace('Composed binding trial=0 before=2073 after=497', 'Composed binding trial=0 before=2073 after=498', 1)),
        ('changed-command-clock', re.sub(r'(Composed binding .*?destination-clock=)8650', r'\g<1>8651', original, count=1)),
        ('missing-original-goal-setter', re.sub(r'^\[streaming\] Composed goal .*\n', '', original, count=1, flags=re.M)),
        ('snapped-target-centre', original.replace('goal=1677,2170 start=', 'goal=1782,2064 start=', 1)),
        ('source-route-capacity', original.replace('capacity=64 retained-bytes=512 serialized-bytes=540', 'capacity=10 retained-bytes=80 serialized-bytes=540', 1)),
        ('wrong-actor-route-start', change_points('start')),
        ('wrong-command-route-end', change_points('end')),
        ('discontinuous-route', change_points('middle')),
        ('missing-route-attachment', re.sub(r'^\[streaming\] Composed attachment .*\n', '', original, count=1, flags=re.M)),
        ('missing-original-writer', re.sub(r'^\[streaming\] Composed graph writer .*\n', '', original, count=1, flags=re.M)),
        ('missing-owned-cleanup', re.sub(r'^\[streaming\] Composed graph cleanup .*\n', '', original, count=1, flags=re.M)),
        ('missing-memory-recovery', re.sub(r'^\[streaming\] Composed graph recovery .*\n', '', original, count=1, flags=re.M)),
        ('missing-same-actor-arrival', re.sub(r'^\[streaming\] Composed arrival .*\n', '', original, count=1, flags=re.M)),
    ]
    if meta.get('composedReplay') is True:
        for label in ['read', 'writer', 'cleanup', 'recovery']:
            controls.append((f'missing-persisted-original-{label}',
                             re.sub(r'^\[streaming\] Replayed graph ' + label + r' .*\n', '', original, count=1, flags=re.M)))
    if meta.get('composedDiskReplay') is True:
        controls.extend([
            ('missing-actual-file-replay', re.sub(r'^\[streaming\] Composed disk replay .*\n', '', original, count=1, flags=re.M)),
            ('wrong-actual-file-replay-size', re.sub(r'(Composed disk replay .*?bytes=)(\d+)', lambda m: m[1] + str(int(m[2]) + 8), original, count=1)),
        ])
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
            raise ValueError(f'Invalid composed evidence accepted: {name}')
    writer = Path(meta['profile']) / 'Composed_Orders.bin'; raw_writer = writer.read_bytes()
    cases, _ = verifier.cases_from_pack((Path(meta['profile']) / 'Populated_Order_Stage.bin').read_bytes())
    body = cases[-1]['body']; original_read = Path.read_bytes
    for name, offset in [('changed-final-goal', body + 104), ('changed-final-capacity', body + 128),
                         ('changed-final-route-point', body + 140), ('changed-trailing-follow-state', len(raw_writer) - 16)]:
        changed = bytearray(raw_writer); changed[offset] ^= 1
        def altered(path):
            return bytes(changed) if path == writer else original_read(path)
        with patch.object(Path, 'read_bytes', altered):
            try:
                verifier.verify(args.manifest)
            except ValueError as error:
                results.append(dict(control=name, rejected=True, reason=str(error)))
            else:
                raise ValueError('Altered original composed writer artifact accepted')
    if meta.get('composedReplay') is True:
        replay_writer = Path(meta['profile']) / 'Replayed_Orders.bin'
        raw_replay = replay_writer.read_bytes()
        for name, offset in [('changed-replayed-capacity', body + 128), ('changed-replayed-point', body + 140)]:
            changed = bytearray(raw_replay); changed[offset] ^= 1
            def altered_replay(path):
                return bytes(changed) if path == replay_writer else original_read(path)
            with patch.object(Path, 'read_bytes', altered_replay):
                try:
                    verifier.verify(args.manifest, require_replay=True)
                except ValueError as error:
                    results.append(dict(control=name, rejected=True, reason=str(error)))
                else:
                    raise ValueError('Altered original persisted replay artifact accepted')
        if replay_writer.read_bytes() != raw_replay:
            raise ValueError('Offline control changed original replay file')
        try:
            verifier.verify(ROOT / 'output/native-actor-cross-destination-attempt-015.json', require_replay=True)
        except ValueError as error:
            results.append(dict(control='actual-composition-without-replay-015', rejected=True, reason=str(error)))
        else:
            raise ValueError('Original composition-only predecessor accepted as persisted replay')
    if meta.get('composedDiskReplay') is True:
        try:
            verifier.verify(ROOT / 'output/native-actor-cross-destination-attempt-016.json', require_disk_replay=True)
        except ValueError as error:
            results.append(dict(control='actual-memory-replay-predecessor-016', rejected=True, reason=str(error)))
        else:
            raise ValueError('In-memory payload replay accepted as actual saved-file reload')
    if writer.read_bytes() != raw_writer:
        raise ValueError('Offline control changed actual writer artifact')
    try:
        verifier.verify(ROOT / 'output/native-actor-cross-destination-attempt-014.json')
    except ValueError as error:
        results.append(dict(control='actual-separate-graphs-predecessor-014', rejected=True, reason=str(error)))
    else:
        raise ValueError('Separate grounded actor and graph run accepted as same-actor composition')
    before = set((ROOT / 'upstream/majesty-recomp/build').glob('actor-arrival-fixture-stage-populated-*'))
    rejected = subprocess.run([sys.executable, str(ROOT / 'scripts/run-native-actor-populated-stage-fixture.py'),
                               str(args.manifest), '--attempt', '994', '--composed-arrival'], capture_output=True, text=True)
    if (rejected.returncode == 0 or 'Composed arrival requires grounded private actor restoration' not in rejected.stderr or
            'nativePid' in rejected.stdout or before != set((ROOT / 'upstream/majesty-recomp/build').glob('actor-arrival-fixture-stage-populated-*'))):
        raise ValueError('Invalid composed mode created or launched a fixture')
    results.append(dict(control='composition-without-grounded-restoration', rejected=True, launched=False))
    with args.output.open('x') as f:
        json.dump(dict(qualified=True, controls=results, nativeProcessesStarted=0, browserUsed=False,
                       originalEvidenceModified=False, evidence=str(evidence)), f, indent=2); f.write('\n')
    print(json.dumps(dict(rejected=len(results), nativeProcessesStarted=0)))


if __name__ == '__main__':
    main()
