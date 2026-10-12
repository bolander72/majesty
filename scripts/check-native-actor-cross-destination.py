#!/usr/bin/env python3
"""Verify private native reference/time edits in an actual second loaded world."""
import argparse
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
ACTORS = [2101, 2105, 2122, 2136]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def verify(manifest):
    populated = load('populated', 'check-native-actor-populated-stage.py')
    source = load('cross_source', 'check-native-actor-cross-source.py')
    report = populated.verify(manifest, actors=ACTORS, world_visits=480)
    meta = report['fixture']
    if (meta.get('crossDestination') is not True or meta.get('crossSource') is not False or
            meta.get('clockProbe') is not False or meta.get('targetCases') is not False):
        raise ValueError('Wrong fixture mode')
    retained = meta['sourceCapture']
    proof_path = Path(retained['qualification']).resolve()
    if (proof_path.parent != ROOT / 'output' or proof_path.stat().st_size > 2 * 1024 * 1024 or
            populated.sha(proof_path) != retained['qualificationSha256']):
        raise ValueError('Changed source qualification')
    proof = json.loads(proof_path.read_text())
    checked = source.verify(Path(proof['fixture']['log']).with_suffix('.json'))
    if (proof.get('qualified') is not True or proof['sourceCapture'] != checked['sourceCapture'] or
            retained['path'] != checked['sourceCapture']['path'] or
            retained['sha256'] != checked['sourceCapture']['sha256']):
        raise ValueError('Missing independently verified source capture')
    pack_path = ROOT / 'output/native-actor-cross-binding-fixtures.json'
    pack = json.loads(pack_path.read_text())
    if pack['sha256'] != meta['copiedCaseFileSha256']:
        raise ValueError('Destination uses a different command graph')
    world_keys = [k for k in meta['sourceHashes'] if k.endswith('.GMP')]
    if len(world_keys) != 1 or meta['sourceHashes'][world_keys[0]] != source.DESTINATION_PIN:
        raise ValueError('Did not load the actual pinned second kingdom')
    copied_capture = Path(meta['profile']) / 'Cross_Source_Capture.bin'
    if copied_capture.stat().st_size != 36 or populated.sha(copied_capture) != retained['sha256']:
        raise ValueError('Copied real source capture changed')
    log = Path(meta['log']).read_text()
    rows = re.findall(r'^\[streaming\] Cross binding trial=(\d+) before=(\d+) after=(\d+) '
                      r'source-clock=(\d+) destination-clock=(\d+) refused=4 targets=2 clocks=3 '
                      r'when=(\d+),(\d+),(\d+) result=pass$', log, re.M)
    if len(rows) != 64:
        raise ValueError('Missing complete reference/time-edit cycles')
    destination_clocks = set()
    for i, row in enumerate(rows):
        trial, before, after, source_clock, destination_clock, *stamps = map(int, row)
        expected = [(destination_clock - ((checked['sourceClockMs'] - clock['when']) & 0xffffffff)) & 0xffffffff
                    for clock in pack['cases'][i // 16]['clocks']]
        if (trial != i % 16 or before != 2073 or after != 497 or
                source_clock != checked['sourceClockMs'] or stamps != expected):
            raise ValueError('Wrong typed binding or original unsigned command age')
        destination_clocks.add(destination_clock)
    if len(destination_clocks) != 1:
        raise ValueError('Destination clock advanced inside the stopped fixture')
    report.update(scope='four private Brashnard actors reconstructed under the actual Scions '
                  'world factory; explicitly supplied 2073-to-497 Path/Follow reference edits '
                  'and common command age preservation between two actual stopped native clocks; '
                  'no actor publication, gameplay leaf execution or destination navigation',
                  actorAndCommandBytesRoundTripEqual=False,
                  privateActorBytesRoundTripEqual=True, originalCommandWriterMatchesEditedPayload=True,
                  sourceActorIdentitiesWorldsAndSerializedStatePreserved=False,
                  destinationTargetOriginalLookupAndSerializedRecordPreserved=True,
                  realSourceClockCaptured=True, realDestinationClockCaptured=True,
                  sourceClockMs=checked['sourceClockMs'], destinationClockMs=destination_clocks.pop(),
                  privateCommonCommandAgeEdits=192, privateNonzeroTargetEdits=128,
                  preflightRefusalControls=256, refusedEditsLeavePrivateGraphAndPayloadUnchanged=True,
                  sourceLocalTargetIdAbsentInDestination=True,
                  suppliedFixtureBinding=pack['binding'], privateDestinationBindingsQualified=True,
                  entityContinuityQualified=False, completeReferenceClosureQualified=False,
                  destinationNavigationQualified=False, originalGameplayLeafEffectsQualified=False,
                  sourceActorDepartureQualified=False, sourceCapture=retained)
    report['sourceSha256'] = populated.recorded_native_sources(meta)
    for name in ['scripts/check-native-actor-cross-destination.py',
                 'scripts/check-native-actor-cross-source.py',
                 'scripts/check-native-actor-populated-stage.py',
                 'scripts/run-native-actor-populated-stage-fixture.py']:
        report['sourceSha256'][name] = populated.sha(ROOT / name)
    for evidence in [pack_path, pack_path.with_suffix('.bin'), copied_capture, proof_path, Path(meta['log'])]:
        report['evidenceSha256'][str(evidence.relative_to(ROOT))] = populated.sha(evidence)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'output/native-actor-cross-destination-observed.json')
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Preserve existing qualification output')
    result = verify(args.manifest)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ['qualified', 'trials', 'sourceClockMs',
                                          'destinationClockMs', 'preflightRefusalControls']}))
