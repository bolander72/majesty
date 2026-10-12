#!/usr/bin/env python3
"""Offline mismatched-transaction refusals; no native or browser processes."""
import argparse
import copy
import importlib.util
import json
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('pair', ROOT / 'scripts/check-native-entity-pair-reload.py')
pair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pair)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('proof', type=Path)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    proof = json.loads(a.proof.read_text())
    if proof.get('selectedPairNativeReloadQualified') is not True:
        p.error('Require qualified selected-pair original reload')
    source_path, destination_path = [Path(proof[k]) for k in ['sourceManifest', 'destinationManifest']]
    baseline = pair.verify(source_path, destination_path)
    if baseline != proof:
        p.error('Independent selected-pair proof changed')
    original = [json.loads(f.read_text()) for f in [source_path, destination_path]]
    changes = [
        ('source missing selected export', lambda m: m[0].pop('selectedPairExport')),
        ('destination foreign receipt', lambda m: m[1]['selectedPairExport'].update(receipt=m[1]['profile']+'/missing.json')),
        ('source changed persistent owner', lambda m: m[0]['selectedPairExport']['owner'].update(unitId=511)),
        ('destination changed persistent owner', lambda m: m[1]['selectedPairExport']['owner'].update(agentId=80)),
        ('source changed selected manifest', lambda m: m[0]['selectedPairExport'].update(manifest='changed')),
        ('destination wrong export side', lambda m: m[1]['selectedPairExport'].update(side=0)),
        ('source changed receipt hash', lambda m: m[0]['selectedPairExport'].update(receiptSha256='f'*64)),
        ('same native process identity', lambda m: m[0].update(nativePid=m[1]['nativePid'])),
    ]
    directory = Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-entity-pair-reload-controls-', dir=ROOT/'upstream/majesty-recomp/build'))
    cases = []
    for i, (name, change) in enumerate(changes):
        manifests = copy.deepcopy(original)
        change(manifests)
        files = [directory/f'{i}-{side}.json' for side in range(2)]
        for file, manifest in zip(files, manifests):
            file.write_text(json.dumps(manifest)+'\n')
        reason = None
        try:
            pair.verify(*files)
        except (ValueError, KeyError, RuntimeError) as e:
            reason = str(e)
        if reason is None:
            raise AssertionError('Accepted changed paired reload: '+name)
        cases.append({'name': name, 'rejected': True, 'reason': reason})
    result = {'qualified': True, 'rejected': len(cases), 'cases': cases,
              'fixture': str(directory), 'nativeProcessesStarted': 0, 'browserUsed': False}
    with a.output.open('x') as f:
        json.dump(result, f, indent=2)
        f.write('\n')
    print(json.dumps({k:result[k] for k in ['qualified','rejected','nativeProcessesStarted','browserUsed']}))


if __name__ == '__main__':
    main()
