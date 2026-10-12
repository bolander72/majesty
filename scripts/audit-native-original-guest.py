#!/usr/bin/env python3
"""Audit one terminal original guest against an immutable recorded host.

Original loading/clock evidence is separate from live two-engine gameplay.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import struct

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as source:
        while chunk := source.read(4096):
            h.update(chunk)
    return h.hexdigest()


def copied(record):
    path = Path(record['copy']).resolve()
    assert path.is_relative_to(ROOT / 'output')
    assert path.stat().st_size == record['bytes'] <= 1024 * 1024
    assert sha(path) == record['sha256']
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('observation', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    assert not args.output.exists(), 'Use a fresh audit output'
    report = json.loads(args.observation.read_text())
    assert report['recordedHostReplay'] and report['liveSecondOriginalEngine'] is False
    assert report['nativeExitCode'] == 0 and report['nativeSessionTerminal'] and report['producerAbsent']
    assert report['fixtureStopped'] and report['servedUnchanged'] and report['originalSettingsUnchanged']
    assert report['browserUsed'] is False and not report.get('stopReason') and not report.get('referenceError')
    assert report['originalGuestReadyObserved'] and report['originalGuestGoStatusObserved']
    assert report['capturedHostGoStatusDelivered'] and report['originalGuestPlayerId'] == 2
    assert report['rssCeilingBytes'] == 512 * 1024 * 1024
    assert report['resourceSamples'] and max(row['rssBytes'] for row in report['resourceSamples']) <= report['rssCeilingBytes']
    assert sha(ROOT / 'upstream/majesty-recomp/build/recomp/pop_smoke') == report['nativeExecutableSha256']
    assert all(report[key] is False for key in ['gameplayQualified', 'sharedSaveLoadResumeQualified',
               'independentInternetQualified', 'sustainedBrowserMemoryBoundQualified', 'goalComplete'])
    try:
        os.kill(report['nativePid'], 0)
    except ProcessLookupError:
        pass
    else:
        raise AssertionError('Original guest producer remains live')
    script = Path(report['script'])
    assert sha(script) == report['scriptSha256']
    assert sha(script.parent / 'runner.py') == report['runnerSha256']
    assert sha(script.parent / 'native_original_host_replay.py') == report['replayHelperSha256']
    log_path = script.parent / 'native.log'
    assert sha(log_path) == report['logSha256'] and log_path.stat().st_size <= 8 * 1024 * 1024
    assert all(sha(ROOT / name) == expected for name, expected in report['sources'].items())
    assert all(sha(Path(report['settingsSource']) / name) == expected for name, expected in report['settingsBefore'].items())
    # Bind the transmitted bytes to the successful, separately executed host.
    inputs = report['replayInputs']
    assert 5 <= len(inputs) <= 132
    paths = [copied(record) for record in inputs]
    host, audit = json.loads(paths[0].read_text()), json.loads(paths[1].read_text())
    assert host['recordedHostReplay'] is False and host['producerAbsent'] and host['nativeSessionTerminal']
    assert audit['observationSha256'] == inputs[0]['sha256']
    assert audit['readyRequestVerified'] and audit['originalGameStartPacketVerified'] and audit['originalGoStatusPacketVerified']
    assert host['nativeExecutableSha256'] == report['nativeExecutableSha256']
    assert host['configuredCoopChapter'] == report['configuredCoopChapter']
    assert host['finishedAtMs'] <= report['startedAtMs']
    expected = host['lobbyPacketMetadata']
    sent = report['replayedHostPackets']
    assert len(sent) == len(expected) == len(inputs) - 4
    assert [(row['sequence'], row['bytes'], row['sha256']) for row in sent] == [(row['sequence'], row['bytes'], row['sha256']) for row in expected]
    assert [(row['bytes'], row['sha256']) for row in inputs[4:]] == [(row['bytes'], row['sha256']) for row in expected]
    # These are original guest emissions observed at authenticated relay IDs.
    ready = go = False
    rows = report['lobbyPacketMetadata']
    assert len(rows) <= 128 and sum(row['bytes'] for row in rows) <= 2 * 1024 * 1024
    for index, row in enumerate(rows, 1):
        assert (row['sequence'], row['sender'], row['recipient']) == (index, 2, 1)
        data = copied(row).read_bytes()
        assert 8 <= len(data) <= 65536
        category, kind = struct.unpack_from('<II', data)
        if category != 0x100:
            continue
        if kind == 0x20:
            assert len(data) == 52
            body = bytes(byte ^ 0x31 for byte in data[8:])
            player, slot, vote, version, label = struct.unpack('<IIBxH32s', body)
            assert player == 2 and slot in (0, 0xffffffff) and vote in (0, 1)
            assert version == 0x106 and label.split(b'\0', 1)[0] == b'1.5.1.2'
            ready |= bool(vote)
        if kind == 0x10:
            assert ready and len(data) == 16
            body = bytes(byte ^ 0x31 for byte in data[8:])
            assert struct.unpack('<II', body) == (2, 1)
            go = True
    assert ready and go
    addresses = [0x0071c68c, 0x006d7670, 0x006d7678, 0x0071c6a8]
    names = ['worldRoot', 'stateRoot', 'originalGoWaitActive', 'gameClock']
    commands = re.findall(r'^peek (0x[0-9a-f]+) (\d+)$', script.read_text(), re.M)
    assert [(int(address, 16), int(size)) for address, size in commands] == [(address, 4) for address in addresses * 4]
    text = log_path.read_text()
    reads = re.findall(r'\[smoke\] peek ([0-9a-f]{8})\+4:\s*([0-9a-f]{8})\s+((?:[0-9a-f]{2}\s+){3}[0-9a-f]{2})', text)
    assert len(reads) == 16
    samples = []
    for index, (address, row_address, value) in enumerate(reads):
        assert int(address, 16) == int(row_address, 16) == addresses[index % 4]
        if index % 4 == 0:
            samples.append(dict(sample=index // 4))
        samples[-1][names[index % 4]] = int.from_bytes(bytes.fromhex(value), 'little')
    assert all(sample['originalGoWaitActive'] in (0, 1) for sample in samples)
    campaign = [{'chapter': int(chapter), 'networkKingdoms': int(count)} for chapter, count in
                re.findall(r'\[campaign\] Chapter (\d+) started with (\d+) network kingdoms', text)]
    assert all(row['chapter'] == report['configuredCoopChapter'] and 0 <= row['networkKingdoms'] <= 4 for row in campaign)
    advanced = samples[-1]['worldRoot'] != 0 and samples[-1]['stateRoot'] != 0 and samples[-1]['originalGoWaitActive'] == 0 and samples[-1]['gameClock'] > 0
    result = dict(version=1, observation=str(args.observation.resolve()), observationSha256=sha(args.observation),
                  originalGuestReadyPacketVerified=True, originalGuestInitializationVoteVerified=True,
                  capturedHostPacketsBytePreserved=True, sequentialOriginalHostAndGuest=True,
                  originalGuestGameClockAdvanced=advanced, scalarSamples=samples,
                  campaignStartObservations=campaign, producerAbsent=True,
                  browserUsed=False, liveTwoEngineGameplayQualified=False,
                  sharedSaveLoadResumeQualified=False, fullMatchQualified=False,
                  independentInternetQualified=False, sustainedBrowserMemoryBoundQualified=False,
                  goalComplete=False)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({key: result[key] for key in ['originalGuestInitializationVoteVerified', 'capturedHostPacketsBytePreserved', 'originalGuestGameClockAdvanced', 'campaignStartObservations', 'liveTwoEngineGameplayQualified']}))


if __name__ == '__main__':
    main()
