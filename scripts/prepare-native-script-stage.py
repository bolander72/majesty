#!/usr/bin/env python3
"""Prepare four bounded, private destination GPL records; reserve self IDs at native load."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / f'{name}.py')
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def prepare():
    witness = module('check-native-actor-script-witness')
    proof = witness.verify(ROOT / 'output/native-actor-cross-source-attempt-004.json',
                           ROOT / 'output/native-actor-cross-destination-attempt-018.json')
    metadata_path = ROOT / 'output/native-actor-script-fixtures.json'
    metadata = json.loads(metadata_path.read_text())
    pack = ROOT / 'output/native-actor-script-fixtures.bin'
    raw = pack.read_bytes()
    if hashlib.sha256(raw).hexdigest() != metadata['sha256']:
        raise ValueError('Changed literal script witness pack')
    cases = witness.pack_cases(raw, metadata)
    source_clock, destination_clock = proof['sourceClockMs'], proof['destinationClockMs']
    old_goal = (2352, 5936)
    # Same explicit approach-offset fixture policy as the qualified command graph.
    positions = []
    for case in (cases[0], cases[-1]):
        positions.append(tuple(x >> 11 for x in struct.unpack_from('<2i', case['unit'], 60)))
    goal = tuple(d + old - s for old, s, d in zip(old_goal, *positions))
    if goal != (1677, 2170):
        raise ValueError('Command approach policy changed')
    words = lambda values: struct.pack('<' + 'I' * len(values), *values)
    parts = [words([0x3153474e, 1, 4, source_clock, destination_clock, *old_goal, *goal, 2])]
    rows = []
    for case in cases[1:5]:
        parsed = case['parsed']
        positive = [r for r in parsed['references'] if r['targetAgentId'] is not None]
        active = [c for c in parsed['contexts'] if c['state'][2] & 2]
        pairs = [p for p in parsed['coordinatePairs'] if p['attribute'] == 'destination' and p['path'] == []]
        if (len(positive) != 4 or len(active) != 1 or len(pairs) != 1 or
                pairs[0]['words'] != list(old_goal) or
                active[0]['attribute'] != 'activescript' or active[0]['path'] or
                active[0]['functions'] != [dict(name='monster_travel_to', slot=0)] or
                active[0]['state'][0] != 300 or active[0]['state'][2:] != [2, 0] or active[0]['running']):
            raise ValueError('Unsupported private script shape')
        original = case['script']
        changed = bytearray(original)
        age = (source_clock - active[0]['state'][1]) & 0xffffffff
        if age >= 0x80000000:
            raise ValueError('Ambiguous script timer age')
        stamp = (destination_clock - age) & 0xffffffff
        stamp_offset = active[0]['offset'] + 4
        struct.pack_into('<I', changed, stamp_offset, stamp)
        struct.pack_into('<2i', changed, pairs[0]['offset'], *goal)
        struct.pack_into('<I', changed, parsed['nativeOffset'], 0)
        for ref in positive:
            if ref['bits'] == 12:
                struct.pack_into('<I', changed, ref['offset'], 2)
            elif ref['bits'] != case['agentId']:
                raise ValueError('Unmapped script reference')
        # Independent complete typed reparse; self ID is reserved by original ctor later.
        result = witness.Script(changed).parse(case['agentId'], 0)
        if len([r for r in result['references'] if r['targetAgentId'] == 2]) != 2:
            raise ValueError('Leader mapping was incomplete')
        refs = [n for ref in positive for n in [ref['offset'], ref['bits']]]
        descriptor = [case['unitId'], case['agentId'], len(changed), parsed['identityOffset'],
                      parsed['nativeOffset'], stamp_offset, pairs[0]['offset'], 4, parsed['values']]
        parts += [words(descriptor), words(refs), changed]
        rows.append(dict(unitId=case['unitId'], sourceAgentId=case['agentId'], bytes=len(changed),
                         identityOffset=parsed['identityOffset'], nativeOffset=parsed['nativeOffset'],
                         stampOffset=stamp_offset, destinationOffset=pairs[0]['offset'], references=positive,
                         beforeStamp=active[0]['state'][1], afterStamp=stamp, ageMs=age,
                         originalSha256=hashlib.sha256(original).hexdigest(),
                         preparedSha256=hashlib.sha256(changed).hexdigest()))
    prepared = b''.join(parts)
    if len(prepared) > 8192:
        raise ValueError('Private script stage pack exceeds bound')
    info = dict(format='NGS1', version=1, sha256=hashlib.sha256(prepared).hexdigest(),
                bytes=len(prepared), sourceClockMs=source_clock, destinationClockMs=destination_clock,
                oldGoal=list(old_goal), newGoal=list(goal), sourceLeaderAgentId=12, destinationLeaderAgentId=2,
                witnessPackSha256=metadata['sha256'], witnessMetadataSha256=witness.sha(metadata_path),
                cases=rows, privateNativeAssociation=0, selfIdsReservedAtNativeLoad=True,
                entityMappingPolicy='Supplied checkpoint fixture approach offset; no persistent correspondence',
                scriptTransferQualified=False, scriptConsumerSemanticsQualified=False,
                actorActivationQualified=False, browserUsed=False)
    return prepared, info


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--basename', default='native-script-stage-fixtures')
    args = parser.parse_args()
    if not args.basename.replace('-', '').replace('_', '').isalnum():
        raise ValueError('Invalid output basename')
    raw, metadata = prepare()
    with (ROOT / 'output' / f'{args.basename}.bin').open('xb') as file:
        file.write(raw)
    with (ROOT / 'output' / f'{args.basename}.json').open('x') as file:
        json.dump(metadata, file, indent=2)
        file.write('\n')
    print(json.dumps(dict(cases=4, bytes=len(raw), newGoal=metadata['newGoal'],
                          stamps=[c['afterStamp'] for c in metadata['cases']])))
