#!/usr/bin/env python3
"""Audit stopped, serial original host/guest initialization; never live co-op."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        while block := f.read(4096):h.update(block)
    return h.hexdigest()


def read(path, limit=1024*1024):
    path = Path(path).resolve()
    if not path.is_file() or not 0 < path.stat().st_size <= limit:
        raise ValueError('Missing or oversized stopped evidence')
    return json.loads(path.read_text())


def stopped(report):
    assert report['pinnedExecutableSha256'] == PIN and report['nativeExitCode'] == 0
    assert not report.get('stopReason') and not report.get('referenceError')
    for key in ['nativeSessionTerminal', 'producerAbsent', 'fixtureStopped',
                'servedUnchanged', 'originalSettingsUnchanged',
                'canonicalNativeStateUnchanged', 'privateNativeExecutableUnchanged']:
        assert report[key] is True, key
    assert report['browserUsed'] is False and report['liveSecondOriginalEngine'] is False
    assert report['gameplayQualified'] is False and report['sharedSaveLoadResumeQualified'] is False
    try:os.kill(report['nativePid'], 0)
    except ProcessLookupError:pass
    else:raise ValueError('Original engine still live')
    assert sha(report['nativeExecutable']) == report['nativeExecutableSha256']
    assert sha(report['buildReport']) == report['buildReportSha256']
    assert read(report['buildReport'])['nativeExecutableSha256'] == report['nativeExecutableSha256']
    assert read(report['buildReport'])['nativeBuildQualified'] is True
    for name, digest in report['sources'].items():assert sha(ROOT/name) == digest
    log = Path(report['script']).parent/'native.log'
    assert sha(log) == report['logSha256']
    for row in report['replayInputs'] if 'replayInputs' in report else []:
        assert sha(row['copy']) == row['sha256']
    return report


def packet(report, kind, size, identical_retransmission=False):
    matches = []
    for row in report['lobbyPacketMetadata']:
        path = Path(row['copy'])
        assert path.stat().st_size == row['bytes'] <= 65536
        assert sha(path) == row['sha256']
        if row['bytes'] != size:continue
        data = path.read_bytes()
        if struct.unpack_from('<II', data) == (0x100, kind):matches.append(data)
    assert matches and (len(matches) == 1 or identical_retransmission), (kind, len(matches))
    assert all(data == matches[0] for data in matches), 'A retransmitted vote changed'
    return matches[0]


def proof(path, role):
    result = read(path)
    assert result['originalRole'] == role
    for key in ['initializedNativeCooperativeWorldSavedQualified',
                'bothKingdomPalacesBuildingsAndGPLSavedQualified',
                'originalProgressSavedQualified']:
        assert result[key] is True
    assert result['liveSecondOriginalEngine'] is False
    assert result['pairedSynchronizationQualified'] is False
    assert result['sharedSaveLoadResumeQualified'] is False
    assert sha(result['report']) == result['reportSha256']
    for name, digest in result['verifierInputs'].items():assert sha(ROOT/name) == digest
    for saved in result['snapshots']:
        assert sha(saved['path']) == saved['sha256']
    return result, stopped(read(result['report']))


def audit(source_path, guest_path, host_path, abi_path):
    source = stopped(read(source_path))
    guest, guest_run = proof(guest_path, 'guest')
    host, host_run = proof(host_path, 'host')
    abi = read(abi_path)
    assert abi['originalExecutableSha256'] == PIN and abi['originalNetworkStartTimingAbiQualified']
    assert abi['gameStartBodyScenarioSeedOffset'] == 24 and abi['gameStartBodyTimingOffset'] == 28
    assert guest_run['replaySourceReport'] == str(Path(source_path).resolve())
    assert host_run['replaySourceReport'] == str(Path(guest_path).resolve())
    assert {r['nativeExecutableSha256'] for r in [source, guest_run, host_run]} == {source['nativeExecutableSha256']}
    assert source['recordedHostReplay'] is False and source['recordedGuestReplay'] is False
    assert guest_run['recordedHostReplay'] is True and host_run['recordedGuestReplay'] is True
    for key in ['originalHostGameStartMatched', 'originalHostGoStatusObserved',
                'capturedGuestGoStatusDelivered']:assert host_run[key] is True
    first_start, returned_start = packet(source, 3, 452), packet(host_run, 3, 452)
    assert first_start == returned_start
    assert packet(source, 0x10, 16) == packet(host_run, 0x10, 16, identical_retransmission=True)
    guest_vote = packet(guest_run, 0x10, 16, identical_retransmission=True)
    assert len(host_run['replayedGuestPackets']) == 3
    assert host_run['replayedGuestPackets'][2]['sha256'] == hashlib.sha256(guest_vote).hexdigest()
    decoded = bytes(x ^ 0x31 for x in first_start[8:])
    seed, interval = struct.unpack_from('<II', decoded, 24)
    assert seed == source['nativeConfiguredInitialSeed'] == host_run['nativeConfiguredInitialSeed']
    assert interval == 50 and host['ownedNativeInitializationSeedConfigured'] is True
    comparisons = []
    for before, after in zip(guest['snapshots'], host['snapshots'], strict=True):
        assert before['clock'] == after['clock'] and before['frame'] == after['frame']
        assert before['counts'] == after['counts']
        assert before['kingdoms'] == after['kingdoms']
        assert before['terrainHeightsSha256'] == after['terrainHeightsSha256']
        assert before['gameplayRng'] == after['gameplayRng']
        differences = []
        for index, (a, b) in enumerate(zip(before['roots'], after['roots'], strict=True)):
            assert a['tag'] == b['tag']
            if a != b:differences.append(dict(index=index, guest=a, host=b))
        comparisons.append(dict(clock=before['clock'], frame=before['frame'],
            palaceBuildingScriptLinksPositionsAndGoldEqual=True, terrainHeightsEqual=True,
            fullRawRootsEqual=not differences, rawRootDifferences=differences))
    return dict(version=1, serialOriginalInitializationRoundtripQualified=True,
        originalGameStartByteIdentical=True, originalHostVoteByteIdentical=True,
        originalGuestVoteDeliveredUnchanged=True, originalScenarioSeed=seed,
        originalIntervalMs=interval, originalRoles=['guest', 'host'],
        completedOriginalTicksPerRole=guest['completedOriginalTicks'], comparisons=comparisons,
        nativeExecutableSha256=source['nativeExecutableSha256'],
        sources={str(Path(p).resolve()):sha(p) for p in [source_path, guest_path, host_path, abi_path, __file__]},
        browserUsed=False, liveSecondOriginalEngine=False, pairedSynchronizationQualified=False,
        sharedSaveLoadResumeQualified=False, sustainedMemoryBoundQualified=False,
        goalComplete=False,
        scope='Stopped serial original engines and byte-preserved recorded initialization only. Raw save differences are retained; no live paired frames, shared load/resume or internet gameplay.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['source_host', 'guest_proof', 'host_proof', 'abi_audit', 'output']:
        parser.add_argument(name, type=Path)
    args = parser.parse_args()
    result = audit(args.source_host, args.guest_proof, args.host_proof, args.abi_audit)
    with args.output.open('x') as f:json.dump(result, f, indent=2);f.write('\n')
    print(json.dumps(dict(serialOriginalInitializationRoundtripQualified=True,
        completedOriginalTicksPerRole=result['completedOriginalTicksPerRole'],
        fullRawSaveEquality=[r['fullRawRootsEqual'] for r in result['comparisons']],
        pairedSynchronizationQualified=False)))
