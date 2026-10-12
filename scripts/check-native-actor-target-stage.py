#!/usr/bin/env python3
"""Verify matched private actors with literal nonzero saved command targets."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ACTORS = [2062, 2063, 2067, 2073]
PIN = '31059d44ebf165c25bf1fd91f8ef00d5c5e3733d2d6177ca8e05956026650e13'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(path):
    spec = importlib.util.spec_from_file_location('populated', ROOT / 'scripts/check-native-actor-populated-stage.py')
    populated = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(populated)
    report = populated.verify(path, actors=ACTORS, world_visits=1960)
    meta = report['fixture']
    pack_path = ROOT / 'output/native-actor-target-stage-fixtures.json'
    pack = json.loads(pack_path.read_text())
    if (meta.get('targetCases') is not True or meta.get('clockProbe') is not False or
            pack['format'] != 'NAS1' or pack['sourceSha256'] != PIN or
            sha(ROOT / pack['source']) != PIN or pack['sha256'] != meta['copiedCaseFileSha256'] or
            sha(pack_path.with_suffix('.bin')) != pack['sha256'] or
            [c['unitId'] for c in pack['cases']] != ACTORS):
        raise ValueError('Missing unchanged Brashnard target fixture')
    sites = [t for c in pack['cases'] for t in c['targets'] if t['targetUnitId']]
    if (len(sites) != 8 or {t['kind'] for t in sites} != {4, 6} or
            {t['targetUnitId'] for t in sites} != {2087, 2120} or
            {t['unitId'] for t in sites} != set(ACTORS)):
        raise ValueError('Unexpected nonzero target sites')
    sources = ['upstream/majesty-recomp/browser_streaming.cpp',
               'upstream/majesty-recomp/game.toml',
               'scripts/prepare-native-actor-populated-stage.mjs',
               'scripts/prepare-native-actor-target-source.py',
               'scripts/run-native-actor-populated-stage-fixture.py',
               'scripts/check-native-actor-populated-stage.py',
               'scripts/check-native-actor-target-stage.py',
               'web/world/order-unit-bindings.mjs']
    report.update(scope='four matched private Brashnard actors with literal nonzero Move Path '
                  'and Follow Unit target fields; exact original read/write and journal-owned '
                  'drain/clear/deletion, no destination binding or gameplay activation',
                  nonzeroSavedTargetSites=8, nonzeroSavedTargetFieldRoundTrips=128,
                  savedTargetUnits=pack['targetUnits'], targetFieldsRebound=False,
                  destinationBindingsQualified=False, completeReferenceClosureQualified=False,
                  sourceTargetSavedMembershipOnly=True,
                  sourceSha256={p: sha(ROOT / p) for p in sources})
    report['sourceSha256'].update(populated.recorded_native_sources(meta))
    report['evidenceSha256'][str(pack_path.relative_to(ROOT))] = sha(pack_path)
    return report


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('manifest', type=Path)
    p.add_argument('--output', type=Path, default=ROOT / 'output/native-actor-target-stage-observed.json')
    args = p.parse_args()
    report = verify(args.manifest)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['qualified', 'actors', 'trials',
                                           'nonzeroSavedTargetFieldRoundTrips',
                                           'destinationBindingsQualified']}))
