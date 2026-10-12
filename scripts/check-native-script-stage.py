#!/usr/bin/env python3
"""Qualify unregistered original GPL restoration with reserved IDs in a second kingdom."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
from importlib.util import spec_from_file_location, module_from_spec

ROOT = Path(__file__).resolve().parents[1]


def module(name):
    spec = spec_from_file_location(name, ROOT / 'scripts' / f'{name}.py')
    value = module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def verify(manifest):
    meta = json.loads(manifest.read_text())
    if meta.get('privateScriptStage') is not True or meta.get('scriptWitness') is not True:
        raise ValueError('Missing private destination GPL stage')
    witness = module('check-native-actor-script-witness')
    destination = witness.verify_one(manifest, 1)
    producer = module('prepare-native-script-stage')
    expected_pack, prepared = producer.prepare()
    descriptor = meta['privateScriptPack']
    pack, metadata = Path(descriptor['path']), Path(descriptor['metadata'])
    if (pack.read_bytes() != expected_pack or witness.sha(pack) != descriptor['sha256'] or
            witness.sha(metadata) != descriptor['metadataSha256'] or json.loads(metadata.read_text()) != prepared or
            (Path(meta['profile']) / 'Script_Stage_Pack.bin').read_bytes() != expected_pack):
        raise ValueError('Private GPL stage package differs from pinned original records and typed transformation')
    log = Path(meta['log']).read_text()
    if re.search(r'^\[streaming\] Script stage .*result=fail$', log, re.M):
        raise ValueError('Original private GPL stage failed')
    pattern = (r'^\[streaming\] Script stage phase=(warmup|steady) actor=(\d+) trial=(\d+) '
               r'old-agent=(\d+) new-agent=(\d+) clock=(\d+) stamp=(\d+) goal=(\d+),(\d+) '
               r'native=0 refs=4 reader=0 separate=1 equal=1 unregistered=1 preserved=1 balanced=1 result=pass$')
    rows = re.findall(pattern, log, re.M)
    summary = re.findall(r'^\[streaming\] Script stage completed=64 constructor-count=68 counter-before=(\d+) '
                         r'counter-after=(\d+) active=0 result=pass$', log, re.M)
    if len(rows) != 68 or len(summary) != 1:
        raise ValueError('Missing 4 warmup and 64 exact private GPL reader/writer/cleanup witnesses')
    initial, final = map(int, summary[0])
    if not 0 < initial < final <= 0x7fffffff or final != initial + 68:
        raise ValueError('Original script identity counter was not preserved monotonically')
    cursor = 40
    originals = {}
    for case in prepared['cases']:
        words = struct.unpack_from('<9I', expected_pack, cursor)
        cursor += 36 + 32
        originals[case['unitId']] = expected_pack[cursor:cursor + words[2]]
        cursor += words[2]
    if cursor != len(expected_pack):
        raise ValueError('Trailing private stage records')
    observations, evidence = [], {}
    for index, row in enumerate(rows):
        phase, *numbers = row
        actor, trial, old_id, new_id, clock, stamp, x, y = map(int, numbers)
        case = prepared['cases'][index % 4]
        if (phase != ('steady' if index >= 4 else 'warmup') or trial != index // 4 or
                actor != case['unitId'] or old_id != case['sourceAgentId'] or new_id != initial + index or
                clock != prepared['destinationClockMs'] or stamp != case['afterStamp'] or
                [x, y] != prepared['newGoal']):
            raise ValueError('Wrong original reserved ID, actor, script clock or coordinated destination')
        expected = bytearray(originals[actor])
        struct.pack_into('<I', expected, case['identityOffset'], new_id)
        for ref in case['references']:
            if ref['targetAgentId'] == old_id:
                struct.pack_into('<I', expected, ref['offset'], new_id)
        writer = Path(meta['profile']) / f'Script_Stage_{actor}_{trial}.bin'
        actual = writer.read_bytes()
        if actual != expected:
            raise ValueError('Actual original GPL writer differs from complete expected transformed record')
        parsed = witness.Script(actual).parse(new_id, 0)
        # Validate positive and sentinel refs, inert contexts and opaque bytes via full equality above.
        ids = [r['targetAgentId'] for r in parsed['references'] if r['targetAgentId'] is not None]
        if sorted(ids) != sorted([new_id, new_id, 2, 2]):
            raise ValueError('Private script reference closure changed')
        evidence[str(writer.relative_to(ROOT))] = hashlib.sha256(actual).hexdigest()
        observations.append(dict(phase=phase, trial=trial, actor=actor, sourceAgentId=old_id,
                                 reservedAgentId=new_id, bytes=len(actual), clockMs=clock,
                                 stampMs=stamp, ageMs=case['ageMs'], goal=[x, y]))
    exe = ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    audit = module('audit-native-agent-restore').audit(exe)
    return dict(qualified=True, scope='Private unregistered destination GPL clones only; no native UNIT/GPL association or activation',
                fixture=meta, destinationWitness=destination, steadyCycles=64, warmupCycles=4,
                actualOriginalGPLWriterRecords=68, monotonicConstructorReservations=68,
                counterBefore=initial, counterAfter=final, typedReferencesPerScript=4,
                completeExpectedWriterComparison=True, agePreservingActiveContextStamps=True,
                coordinatedScriptAndPathFixtureDestination=True, originalPoolAndHeapRecoverAfterWarmup=True,
                originalDestinationHeaderAndQueuesPreserved=True, nativeAssociation=0,
                privateScriptRestorationQualified=True, nativeActorScriptCompositionQualified=False,
                scriptConsumerSemanticsQualified=False, persistentEntityCorrespondenceQualified=False,
                actorActivationQualified=False, continuousPagingQualified=False, wholeBrowserMemoryBoundQualified=False,
                browserUsed=False, observations=observations,
                originalInstructionAnchors=len(audit['checkedInstructions']),
                sourceSha256=meta['nativeSourceSha256'] | {str(Path(__file__).relative_to(ROOT)): witness.sha(Path(__file__)),
                                                        'scripts/prepare-native-script-stage.py': witness.sha(ROOT / 'scripts/prepare-native-script-stage.py')},
                evidenceSha256=destination['evidenceSha256'] | evidence)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = verify(args.manifest)
    with args.output.open('x') as file:
        json.dump(result, file, indent=2)
        file.write('\n')
    print(json.dumps({key: result[key] for key in ['qualified', 'steadyCycles', 'actualOriginalGPLWriterRecords',
                                                 'monotonicConstructorReservations', 'actorActivationQualified']}))
