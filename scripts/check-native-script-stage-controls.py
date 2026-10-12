#!/usr/bin/env python3
"""Reject corrupt private GPL stage evidence without launching or modifying game artifacts."""
import argparse
import json
from pathlib import Path
import re
import struct
import subprocess
import tempfile
from unittest.mock import patch
from importlib.util import spec_from_file_location, module_from_spec

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('Preserve existing controls')
    spec = spec_from_file_location('private_stage_controls', ROOT / 'scripts/check-native-script-stage.py')
    verifier = module_from_spec(spec)
    spec.loader.exec_module(verifier)
    positive = verifier.verify(args.manifest)
    meta = positive['fixture']
    original_log = Path(meta['log']).read_text()
    scratch = Path(tempfile.mkdtemp(prefix='native-private-script-controls-', dir=ROOT / 'output'))
    results = []

    def refuse(name, call):
        try:
            call()
        except ValueError as error:
            results.append(dict(control=name, rejected=True, reason=str(error)))
        else:
            raise ValueError('Invalid private GPL stage accepted: ' + name)

    changes = [
        ('missing-warmup', re.sub(r'^\[streaming\] Script stage phase=warmup .*\n', '', original_log, count=1, flags=re.M)),
        ('missing-steady', re.sub(r'^\[streaming\] Script stage phase=steady .*\n', '', original_log, count=1, flags=re.M)),
    ]
    for name, before, after in [
        ('wrong-source-id', 'old-agent=37', 'old-agent=38'),
        ('wrong-reserved-id', 'new-agent=11', 'new-agent=12'),
        ('wrong-clock', 'clock=8650', 'clock=4000'),
        ('unshifted-context', 'stamp=8550', 'stamp=3900'),
        ('stale-script-goal', 'goal=1677,2170', 'goal=2352,5936'),
        ('published-native-association', 'native=0', 'native=2101'),
        ('missing-reference', 'refs=4', 'refs=3'),
        ('reader-failure', 'reader=0', 'reader=1'),
        ('shared-script-storage', 'separate=1', 'separate=0'),
        ('writer-failure', 'equal=1', 'equal=0'),
        ('registration-leak', 'unregistered=1', 'unregistered=0'),
        ('destination-mutation', 'preserved=1', 'preserved=0'),
        ('allocation-leak', 'balanced=1', 'balanced=0'),
        ('wrong-constructor-count', 'constructor-count=68', 'constructor-count=67'),
        ('counter-rewound', 'counter-after=79', 'counter-after=11'),
        ('live-activation', 'active=0', 'active=1'),
    ]:
        changed = re.sub(r'(^\[streaming\] Script stage .*?)' + re.escape(before),
                         lambda match: match[1] + after, original_log, count=1, flags=re.M)
        changes.append((name, changed))
    for name, changed in changes:
        if changed == original_log:
            raise ValueError('Control did not change stage evidence: ' + name)
        log = scratch / f'{name}.log'
        log.write_text(changed)
        manifest = scratch / f'{name}.json'
        manifest.write_text(json.dumps(dict(meta, log=str(log))))
        refuse(name, lambda: verifier.verify(manifest))
    pack_info = json.loads(Path(meta['privateScriptPack']['metadata']).read_text())
    case = pack_info['cases'][0]
    writer = Path(meta['profile']) / 'Script_Stage_2101_1.bin'
    raw = writer.read_bytes()
    original_read = Path.read_bytes
    for name, offset in [
        ('corrupt-actual-self-reference', case['references'][0]['offset']),
        ('corrupt-actual-leader-reference', case['references'][2]['offset']),
        ('corrupt-actual-context-stamp', case['stampOffset']),
        ('corrupt-actual-destination', case['destinationOffset']),
        ('corrupt-actual-native-link', case['nativeOffset']),
        ('corrupt-actual-own-id', case['identityOffset']),
    ]:
        corrupt = bytearray(raw)
        struct.pack_into('<I', corrupt, offset, struct.unpack_from('<I', raw, offset)[0] ^ 1)
        with patch.object(Path, 'read_bytes', lambda path: bytes(corrupt) if path == writer else original_read(path)):
            refuse(name, lambda: verifier.verify(args.manifest))
    for name, field in [('missing-private-flag', 'privateScriptStage'), ('missing-witness-flag', 'scriptWitness')]:
        manifest = scratch / f'{name}.json'
        manifest.write_text(json.dumps(dict(meta, **{field: False})))
        refuse(name, lambda: verifier.verify(manifest))
    refuse('actual-predecessor-has-no-private-scripts',
           lambda: verifier.verify(ROOT / 'output/native-actor-cross-destination-attempt-018.json'))
    command = [str(ROOT / 'upstream/majesty-recomp/.venv/bin/python'),
               str(ROOT / 'scripts/run-native-actor-populated-stage-fixture.py'),
               str(args.manifest), '--private-script-stage', '--attempt', '999991']
    runner = subprocess.run(command, capture_output=True, text=True)
    if runner.returncode != 2 or 'Private script stage requires' not in runner.stderr or 'nativePid' in runner.stdout:
        raise ValueError('Invalid private script runner did not refuse before process/profile creation')
    results.append(dict(control='invalid-runner-dependencies', rejected=True))
    output = dict(qualified=True, rejected=len(results), controls=results,
                  nativeProcessesStarted=0, browserUsed=False, originalEvidenceModified=False)
    with args.output.open('x') as file:
        json.dump(output, file, indent=2)
        file.write('\n')
    print(json.dumps(dict(rejected=len(results), nativeProcessesStarted=0)))


if __name__ == '__main__':
    main()
