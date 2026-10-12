#!/usr/bin/env python3
"""Require real native peers, original initialization/checksums and a shared outcome.

This gate covers the owned native cooperative match only. Browser memory,
independent internet participants require separate evidence. A defeat run must
also observe the selected original peer's surrender request.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import struct
from lib.native_pair_script import verify_peer_outcome

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as source:
        while chunk := source.read(4096):h.update(chunk)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('observation', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    assert not args.output.exists(), 'Preserve prior evidence'
    report = json.loads(args.observation.read_text())
    assert report['runRequested'] and report['nativeProcessesStarted'] == 2
    assert report['nativeExitCodes'] == [0, 0] and report['producerAbsent'] and report['fixtureStopped']
    assert not report['stopReason'] and not report['remainingOwnedProcesses']
    assert report['sourcesUnchanged'] and report['settingsSourceUnchanged'] and report['servedUnchanged']
    assert report['canonicalDeveloperStateUnchanged']
    assert report['browserUsed'] is False and report['goalComplete'] is False
    assert report['aggregateRssCeilingBytes'] == 512 * 1024 * 1024
    assert report['resourceSamples'] and max(row['aggregateRssBytes'] for row in report['resourceSamples']) <= report['aggregateRssCeilingBytes']
    assert sha(ROOT / 'upstream/majesty-recomp/build/recomp/pop_smoke') == report['nativeExecutableSha256']
    assert all(sha(ROOT / name) == expected for name,expected in report['sources'].items())
    assert all(sha(ROOT / name) == expected for name,expected in report['supervisorInputs'].items())
    assert sha(report['approvedPlan']) == report['approvedPlanSha256']
    pids = [entry['nativePid'] for entry in report['roles'].values()]
    assert len(set(pids)) == 2
    for pid in pids:
        try:os.kill(pid, 0)
        except ProcessLookupError:pass
        else:raise AssertionError('Owned native producer remains live')
    initialized = set()
    starts = []
    ready = False
    for row in report['initialPackets']:
        path = Path(row['copy']);assert path.stat().st_size == row['bytes'] <= 65536
        assert sha(path) == row['sha256']
        data = path.read_bytes();assert struct.unpack_from('<II', data) == (row['category'], row['kind'])
        body = bytes(byte ^ 0x31 for byte in data[8:])
        if row['kind'] == 0x10:
            assert len(data) == 16
            player, vote = struct.unpack('<II', body)
            assert player == row['sender'] and player in (1, 2) and vote == 1
            initialized.add(player)
        if row['kind'] == 3:
            assert len(data) == 452 and row['sender'] == 1
            starts.append(row['sha256'])
        if row['kind'] == 0x20 and row['sender'] == 2:
            assert len(data) == 52
            player, field, vote, version, label = struct.unpack('<IIBxH32s', body)
            assert player == 2 and version == 0x106 and label.split(b'\0', 1)[0] == b'1.5.1.2'
            ready |= vote == 1
    assert ready and initialized == {1, 2} and len(starts) == 1
    checksums = {}
    outcomes = {}
    chapter = report['configuredCoopChapter']
    outcome = report.get('expectedOutcome', 'victory')
    surrender_role = report.get('surrenderRole')
    assert outcome in ('victory', 'defeat')
    assert (outcome == 'defeat' and chapter in (2, 3, 4) and surrender_role in ('host', 'guest')) or (outcome == 'victory' and surrender_role is None)
    for role,entry in report['roles'].items():
        assert sha(entry['nativeExecutable']) == report['nativeExecutableSha256']
        log = Path(entry['log']);assert log.stat().st_size <= report['logCeilingBytesPerRole']
        assert sha(log) == report['logSha256'][role] and sha(entry['script']) == entry['scriptSha256']
        text = log.read_text()
        assert 'CHECKSUM FAILURE' not in text and 'GplException' not in text
        assert f'[campaign] Chapter {chapter} started with 2 network kingdoms' in text
        script = Path(entry['script']).read_text()
        verify_peer_outcome(text, script, chapter, outcome, outcome == 'defeat' and role == surrender_role)
        frames = {}
        for frame,value in re.findall(r'\[network\] Engine checksum frame=(\d+) value=([0-9a-f]{8})', text):
            frame = int(frame)
            assert frame not in frames or frames[frame] == value
            frames[frame] = value
        checksums[role] = frames;outcomes[role] = 'shared ' + outcome
    common = sorted(set(checksums['host']) & set(checksums['guest']))
    assert len(common) >= 2
    assert all(checksums['host'][frame] == checksums['guest'][frame] for frame in common)
    public_tls = report.get('publicTlsTransportRequested', False)
    if public_tls:
        tunnel = report['publicTunnel']
        assert report['bothNativePeersUseTls'] and report['originalPeerConnections'] == 2
        assert report['tlsReadinessProbe']['authenticatedHandshake']
        assert report['tlsReadinessProbe']['negotiatedProtocol']
        assert report['tlsReadinessProbe']['gamePacketsSent'] == 0
        assert not report['routeTokenPublished'] and not tunnel['routeTokenPublished']
        assert len(report['routePathSha256']) == 64
        assert tunnel['terminal'] and tunnel['ownedGroupAbsent'] and not tunnel.get('resourceStop')
        assert not tunnel['existingConfigurationRead'] and not tunnel['existingTunnelChanged']
        assert tunnel['peakOwnedRssBytes'] <= tunnel['rssCeilingBytes'] == 128 * 1024 * 1024
        assert all(row['aggregateRssBytes'] == row['nativeRssBytes'] + row['transportRssBytes']
                   for row in report['resourceSamples'])
        assert any(row['transportRssBytes'] > 0 for row in report['resourceSamples'])
        try:os.kill(tunnel['tunnelPid'], 0)
        except ProcessLookupError:pass
        else:raise AssertionError('Owned public tunnel remains live')
    result = dict(version=1, observation=str(args.observation.resolve()), observationSha256=sha(args.observation),
                  nativeCooperativeChapter=chapter, realOriginalPeersInitialized=True,
                  matchedOriginalChecksums=[dict(frame=frame,value=checksums['host'][frame]) for frame in common],
                  nativeOutcome=outcome, surrenderRole=surrender_role,
                  bothOriginalPeersReportedSharedVictory=outcome == 'victory',
                  bothOriginalPeersReportedSharedDefeat=outcome == 'defeat', producerAbsent=True,
                  fullNativeCooperativeMatchQualified=True, sharedDefeatQualified=outcome == 'defeat',
                  publicTlsFullNativeCooperativeMatchQualified=public_tls,
                  independentInternetQualified=False, sustainedBrowserMemoryBoundQualified=False,
                  browserUsed=False, goalComplete=False)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(dict(fullNativeCooperativeMatchQualified=True, matchedChecksums=len(common), browserUsed=False, goalComplete=False)))


if __name__ == '__main__':
    main()
