#!/usr/bin/env python3
"""Check captured browser UI logs and the stopped public relay for the 070 trial."""
import argparse
import hashlib
import json
import re
from pathlib import Path


ROUTE = ['1_0', '0_0', '1_0', '1_-1', '1_0', '0_0', '0_-1',
         '1_-1', '0_-1', '0_0', '1_0', '2_0', '1_0', '1_-1', '1_0', '0_0']


def qualify(directory):
    evidence = {}

    def read(name):
        path = directory / name
        data = path.read_bytes()
        evidence[name] = hashlib.sha256(data).hexdigest()
        return json.loads(data)

    initial = read('initial.json')
    initial_hashes = []
    for role in ['host', 'guest']:
        assert 'CHECKSUM FAILURE' not in initial[role], f'{role}: initial engine failure'
        assert '[campaign] Chapter 3 started with 2 network kingdoms' in initial[role]
        values = re.findall(r'Engine checksum frame=199 value=([0-9a-f]{8})', initial[role])
        assert values, f'{role}: missing initial checksum'
        initial_hashes.append(values[-1])
    assert initial_hashes[0] == initial_hashes[1], 'Initial engine disagreement'
    trips = []
    checksum_pairs = 1
    heaps = {role: [] for role in ['host', 'guest']}
    for serial, region in enumerate(ROUTE, 1):
        capture = read(f'trip-{serial:02d}.json')
        assert capture['trip'] == serial
        item = {'serial': serial, 'region': region, 'roles': {}}
        role_checksums = []
        for role in ['host', 'guest']:
            log = capture[role]
            assert 'CHECKSUM FAILURE' not in log, f'{role}: engine disagreement'
            marker = f'[coop-load] Resumed epoch=1 serial={serial} region={region}'
            assert marker in log, f'{role}: missing actual resume {serial}'
            tail = log.rsplit(marker, 1)[1]
            resource = re.search(rf'Resources epoch=1 serial={serial} heap-bytes=(\d+) blocks=(\d+) world=([0-9a-f]+) context=([0-9a-f]+)', tail)
            assert resource, f'{role}: missing resumed resource sample {serial}'
            heap, blocks = map(int, resource.group(1, 2))
            assert heap > 0 and blocks > 0 and int(resource[3], 16) and int(resource[4], 16)
            heaps[role].append(heap)
            checksums = re.findall(r'Engine checksum frame=(\d+) value=([0-9a-f]{8})', tail)
            for frame, value in checksums:
                assert all(other_value == value for other_frame, other_value in checksums
                           if other_frame == frame), f'{role}: conflicting sampled frame {frame}'
            role_checksums.append(checksums)
            item['roles'][role] = {'heapBytes': heap, 'blocks': blocks, 'checksums': checksums}
        # Compare only frames actually captured on both sides, preserving distinct values.
        by_role = [{int(frame): value for frame, value in samples} for samples in role_checksums]
        common = sorted(set(by_role[0]) & set(by_role[1]))
        for frame in common:
            assert by_role[0][frame] == by_role[1][frame], f'Engine disagreement after transfer {serial}, frame {frame}'
        item['matchingSampledFrames'] = common
        checksum_pairs += len(common)
        trips.append(item)
    relay = read('service.json')
    tunnel = read('public-tunnel.json')
    assert relay['terminal'] and relay['livePeers'] == 0 and relay['liveRooms'] == 0
    assert 'privateEndpoint' not in relay, 'Live test route must be retired'
    assert tunnel['terminal'] and tunnel['ownedGroupAbsent'], 'Owned tunnel still running'
    barriers = relay['barriers']
    for serial in range(1, 17):
        events = [event for event in barriers if event['serial'] == serial]
        assert [event['stage'] for event in events] == [1, 2, 3], f'Incomplete public barrier {serial}'
        assert len({event['descriptorSha256'] for event in events}) == 1
        assert all(event['players'] == [1, 2] for event in events)
    result = read('shared-defeat.json')
    assert all('[campaign] Chapter 3 shared defeat for 2 kingdoms' in result[role]
               and 'CHECKSUM FAILURE' not in result[role] for role in ['host', 'guest'])
    profiles = read('defeat-profile-completion.json')
    assert profiles['enginesReleased']
    assert all('0 of 3 chapters completed locally.' in profiles[role] for role in ['host', 'guest'])
    bounds = {role: {'samples': len(samples), 'minimumBytes': min(samples),
                     'maximumBytes': max(samples), 'firstBytes': samples[0],
                     'lastBytes': samples[-1]} for role, samples in heaps.items()}
    # A trial bound, not a claim of whole-browser memory or unlimited-world stability.
    assert all(bound['maximumBytes'] < 32 * 1024 * 1024 for bound in bounds.values())
    assert all(bound['lastBytes'] <= bound['firstBytes'] + 256 * 1024 for bound in bounds.values())
    return {'version': 1, 'qualified': True, 'browserUsed': True, 'players': 2,
            'publicTlsRelayQualified': True, 'independentInternetConnectionsQualified': False,
            'completedTransfers': 16, 'visitedRegions': sorted({'0_0', *ROUTE}),
            'matchingSampledChecksumPairs': checksum_pairs, 'initialChecksum': initial_hashes[0],
            'sharedDefeatQualified': True, 'defeatNotMarkedComplete': True,
            'testEnginesReleased': True, 'ownedTunnelAbsent': True,
            'managedHeapTrialBound': bounds, 'trips': trips, 'evidenceSha256': evidence,
            'scope': 'Two actual in-app browser engines through a public TLS WebSocket relay; '
                     '16 shared fresh/saved transfers across five regions and shared defeat. '
                     'Both clients used the same machine/network. Resource samples cover managed '
                     'game allocations at resumed arrivals, not total browser/GPU memory, peaks '
                     'during transfer, unlimited expansion, seamless camera crossing, or crash recovery.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    assert not args.output.exists(), 'Preserve previous qualification'
    report = qualify(args.directory)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in ['qualified', 'completedTransfers',
          'matchingSampledChecksumPairs', 'publicTlsRelayQualified', 'sharedDefeatQualified',
          'managedHeapTrialBound']}))


if __name__ == '__main__':
    main()
