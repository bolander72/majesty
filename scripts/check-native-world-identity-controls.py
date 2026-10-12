#!/usr/bin/env python3
"""Reject corrupted world identity, natural backlinks and exact joint writer evidence."""
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
        raise ValueError('Preserve previous controls')
    spec = spec_from_file_location('script_composition_controls', ROOT / 'scripts/check-native-script-composed-arrival.py')
    verifier = module_from_spec(spec)
    spec.loader.exec_module(verifier)
    private_verify = verifier.verify
    verifier.verify = lambda manifest: private_verify(manifest, publication=True)
    positive = verifier.verify(args.manifest)
    meta = positive['fixture']
    log = Path(meta['log']).read_text()
    owned = Path(tempfile.mkdtemp(prefix='native-world-identity-controls-', dir=ROOT / 'output'))
    results = []

    def refuse(name, call):
        try:
            call()
        except ValueError as error:
            results.append(dict(control=name, rejected=True, reason=str(error)))
        else:
            raise ValueError('Invalid simultaneous script composition accepted: ' + name)

    changes = [
        ('missing-tree-warm', re.sub(r'^\[streaming\] Script compose tree warm .*\n', '', log, count=1, flags=re.M)),
        ('missing-joint-cycle', re.sub(r'^\[streaming\] Script published .*\n', '', log, count=1, flags=re.M)),
    ]
    changes.extend([
        ('missing-native-warm', re.sub(r'^\[streaming\] Native identity warm .*\n', '', log, count=1, flags=re.M)),
        ('missing-orders-marker', re.sub(r'^\[streaming\] Native command marker .*\n', '', log, count=1, flags=re.M)),
        ('wrong-orders-marker', re.sub(r'(^\[streaming\] Native command marker .*?)after=1', r'\g<1>after=0', log, count=1, flags=re.M)),
        ('wrong-orders-marker-actor', re.sub(r'(^\[streaming\] Native command marker )actor=2101', r'\g<1>actor=2105', log, count=1, flags=re.M)),
    ])
    first = positive['observations'][0]
    for name, before, after in [
        ('wrong-actor', 'actor=2101', 'actor=2105'),
        ('wrong-source-script', 'old-agent=37', 'old-agent=41'),
        ('reused-reserved-id', f"new-agent={first['reservedAgentId']}", f"new-agent={first['reservedAgentId']-1}"),
        ('reused-native-unit', f"unit-id={first['unitId']}", f"unit-id={first['unitId']-1}"),
        ('missing-world', 'world=1', 'world=0'),
        ('missing-backlink', 'backlink=1', 'backlink=0'),
        ('missing-native-lookup', 'lookup=1', 'lookup=0'),
        ('missing-native-retirement', 'retired=1', 'retired=0'),
        ('changed-registry-count', 'groups=17', 'groups=16'),
        ('rewound-native-counter', f"native-before={first['unitId']-1}", f"native-before={first['unitId']-2}"),
        ('incomplete-self-sites', 'self=2', 'self=1'),
        ('incomplete-leader-sites', 'leader=2', 'leader=1'),
        ('wrong-command-length', f"commands={first['commandBytes']}", f"commands={first['commandBytes']-8}"),
        ('unit-writer-failure', 'unit-equal=1', 'unit-equal=0'),
        ('script-writer-failure', 'script-equal=1', 'script-equal=0'),
        ('order-writer-failure', 'orders-equal=1', 'orders-equal=0'),
        ('script-activation', 'unscheduled=1', 'unscheduled=0'),
        ('dangling-native-cache', 'detached=1', 'detached=0'),
        ('retained-id-tree-entry', 'erased=1', 'erased=0'),
        ('destination-mutation', 'preserved=1', 'preserved=0'),
        ('retained-pools', 'balanced=1', 'balanced=0'),
    ]:
        changed = re.sub(r'(^\[streaming\] Script published .*?)' + re.escape(before),
                         lambda match: match[1] + after, log, count=1, flags=re.M)
        changes.append((name, changed))
    for name, changed in changes:
        if changed == log:
            raise ValueError('Control did not change original composition evidence: ' + name)
        file = owned / f'{name}.log'
        file.write_text(changed)
        manifest = owned / f'{name}.json'
        manifest.write_text(json.dumps(dict(meta, log=str(file))))
        refuse(name, lambda: verifier.verify(manifest))
    profile = Path(meta['profile'])
    unit = profile / 'Script_Composed_Unit_2101_0.bin'
    script = profile / 'Script_Composed_GPL_2101_0.bin'
    commands = profile / 'Script_Composed_Orders_2101_0.bin'
    before = profile / 'Script_Composed_Before_2101_0.bin'
    raw_unit = unit.read_bytes()
    ea = [116 + i*8 + 4 for i in range(struct.unpack_from('<I', raw_unit, 112)[0])
          if struct.unpack_from('<I', raw_unit, 116+i*8)[0] == 0x4541]
    if len(ea) != 1:
        raise ValueError('Missing independent EA control location')
    script_info = json.loads(Path(meta['privateScriptPack']['metadata']).read_text())['cases'][0]
    orders_module = verifier.module('check-native-actor-composed-arrival')
    cases, _ = orders_module.cases_from_pack((profile / 'Populated_Order_Stage.bin').read_bytes())
    case = cases[0]
    original_read = Path.read_bytes
    for name, file, offset in [
        ('corrupt-actual-unit-EA', unit, ea[0]),
        ('corrupt-actual-unit-position', unit, 60),
        ('corrupt-actual-unit-identity', unit, 36),
        ('corrupt-actual-original-unit', before, ea[0]),
        ('corrupt-actual-script-self', script, script_info['references'][0]['offset']),
        ('corrupt-actual-script-leader', script, script_info['references'][2]['offset']),
        ('corrupt-actual-script-native', script, script_info['nativeOffset']),
        ('corrupt-actual-script-stamp', script, script_info['stampOffset']),
        ('corrupt-actual-script-destination', script, script_info['destinationOffset']),
        ('corrupt-actual-path-destination', commands, case['body']+104),
        ('corrupt-actual-path-reference', commands, case['targets'][0][0]),
        ('corrupt-actual-command-stamp', commands, case['clocks'][0][0]),
    ]:
        raw = file.read_bytes()
        corrupt = bytearray(raw)
        struct.pack_into('<I', corrupt, offset, struct.unpack_from('<I', raw, offset)[0] ^ 1)
        with patch.object(Path, 'read_bytes', lambda path: bytes(corrupt) if path == file else original_read(path)):
            refuse(name, lambda: verifier.verify(args.manifest))
    for name, field in [('missing-compose-flag', 'scriptComposedArrival'), ('missing-stage-flag', 'privateScriptStage'), ('missing-native-flag', 'nativeIdentity')]:
        manifest = owned / f'{name}.json'
        manifest.write_text(json.dumps(dict(meta, **{field: False})))
        refuse(name, lambda: verifier.verify(manifest))
    refuse('actual-uncomposed-predecessor', lambda: verifier.verify(ROOT / 'output/native-actor-cross-destination-attempt-019.json'))
    for attempt in [20, 21, 22, 23]:
        refuse(f'actual-unqualified-attempt-{attempt}', lambda attempt=attempt: verifier.verify(ROOT / f'output/native-actor-cross-destination-attempt-{attempt:03}.json'))
    runner = subprocess.run([str(ROOT / 'upstream/majesty-recomp/.venv/bin/python'),
                             str(ROOT / 'scripts/run-native-actor-populated-stage-fixture.py'),
                             str(args.manifest), '--native-identity', '--attempt', '999993'],
                            capture_output=True, text=True)
    if runner.returncode != 2 or 'Native identity requires script composed arrival' not in runner.stderr or 'nativePid' in runner.stdout:
        raise ValueError('Runner did not refuse before profile creation/process launch')
    results.append(dict(control='invalid-runner-dependencies', rejected=True))
    output = dict(qualified=True, rejected=len(results), controls=results, nativeProcessesStarted=0,
                  browserUsed=False, originalEvidenceModified=False)
    with args.output.open('x') as file:
        json.dump(output, file, indent=2)
        file.write('\n')
    print(json.dumps(dict(rejected=len(results), nativeProcessesStarted=0)))


if __name__ == '__main__':
    main()
