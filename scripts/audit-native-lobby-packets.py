#!/usr/bin/env python3
"""Verify a captured original lobby status exchange against pinned instructions."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import capstone
import pefile

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(4096), b''):
            h.update(block)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('observation', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    out = args.output.resolve()
    if out.exists():
        parser.error('Preserve prior evidence; use a fresh output')
    path = args.observation.resolve()
    report = json.loads(path.read_text())
    assert report['nativeExitCode'] == 0 and report['nativeSessionTerminal'] and report['producerAbsent']
    assert report['originalLobbyRequestResponseQualified'] and report['fixtureStopped']
    assert report['referenceOriginalStatusConfirmed'] and report['servedUnchanged'] and report['originalSettingsUnchanged']
    try:
        os.kill(report['nativePid'], 0)
    except ProcessLookupError:
        pass
    else:
        raise RuntimeError('Native producer remains live')
    exe = ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    assert sha(exe) == PIN
    pe = pefile.PE(str(exe), fast_load=True)
    md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
    anchors = [
        (0x004bb00d, 'mov', 'dword ptr [esi + 0x4f0], 0x31'),
        (0x00588378, 'mov', 'cl, byte ptr [ecx + 0x48]'),
        (0x00588382, 'xor', 'bl, cl'),
        (0x00588384, 'mov', 'byte ptr [eax], bl'),
        (0x0058838b, 'ret', '8'),
        (0x00588398, 'mov', 'cl, byte ptr [ecx + 0x48]'),
        (0x005883a2, 'xor', 'bl, cl'),
        (0x004537fe, 'mov', 'eax, dword ptr [eax + 0x4f0]'),
        (0x0045380e, 'push', '0x2c'),
        (0x00453811, 'push', '0x20'),
        (0x00453813, 'call', '0x588300'),
    ]
    ready_requested = bool(report.get('referenceReadyRequested'))
    if ready_requested:
        assert report['referenceReadyConfirmed']
        anchors.extend([
            (0x00416d3b, 'mov', 'dword ptr [esp + 0x2c], 1'),
            (0x00416d6c, 'push', '8'),
            (0x00416d6f, 'push', '0x10'),
            (0x00416d71, 'call', '0x588300'),
            (0x00416daf, 'mov', 'ecx, dword ptr [0x6c0eac]'),
            (0x00416dbb, 'mov', 'dword ptr [0x6d7678], 1'),
            (0x00416dd3, 'call', 'dword ptr [edx + 0x40]'),
            (0x00416ddd, 'mov', 'eax, dword ptr [esi + 0x338]'),
            (0x00416df6, 'mov', 'ecx, dword ptr [eax + 0x10]'),
            (0x00416e15, 'mov', 'dword ptr [0x6d7678], 0'),
        ])
    rows = []
    for address, mnemonic, operands in anchors:
        instruction = next(md.disasm(pe.get_data(address - pe.OPTIONAL_HEADER.ImageBase, 15), address))
        assert (instruction.mnemonic, instruction.op_str) == (mnemonic, operands), hex(address)
        rows.append(dict(address=f'{address:08x}', mnemonic=mnemonic, operands=operands))
    # Verify that the copied packet writer dispatches through the reviewed
    # XOR transform; addresses are pinned game data, never host pointers.
    table = struct.unpack('<20I', pe.get_data(0x00689190 - pe.OPTIONAL_HEADER.ImageBase, 80))
    assert table[17] == 0x00588370 and table[18] == 0x00588390
    packets = report['lobbyPacketMetadata']
    assert 1 <= len(packets) <= 128 and sum(p['bytes'] for p in packets) <= 2 * 1024 * 1024
    host, peer = report['originalHostPlayerIds'][0], report['referencePlayerId']
    assert host and peer and host != peer
    decoded_types = []
    echoed = False
    game_start = go_status = False
    scenario_seed = frame_interval = None
    for index, record in enumerate(packets, 1):
        packet_path = Path(record['copy'])
        assert sha(packet_path) == record['sha256'] and packet_path.stat().st_size == record['bytes']
        assert (record['sequence'], record['sender'], record['recipient']) == (index, host, peer)
        data = packet_path.read_bytes()
        assert 8 <= len(data) <= 65536
        category, kind = struct.unpack_from('<II', data)
        assert category == 0x100
        decoded_types.append(kind)
        if kind == 2:
            assert len(data) == 52
            status = bytes(byte ^ 0x31 for byte in data[8:])
            if struct.unpack_from('<I', status)[0] == peer:
                echoed |= status[8] == int(ready_requested) and struct.unpack_from('<H', status, 10)[0] == 0x106 and status[12:].split(b'\0', 1)[0] == b'1.5.1.2'
        elif kind == 3:
            assert ready_requested and len(data) == 452 and not game_start
            body = bytes(byte ^ 0x31 for byte in data[8:])
            scenario_seed, frame_interval = struct.unpack_from('<II', body, 24)
            game_start = True
        elif kind == 0x10:
            assert ready_requested and game_start and len(data) == 16 and not go_status
            go = bytes(byte ^ 0x31 for byte in data[8:])
            assert struct.unpack_from('<I', go)[0] == host
            assert struct.unpack_from('<I', go, 4)[0] == 1
            go_status = True
    request = report['referenceOriginalRequest']
    request_path = Path(request['copy'])
    assert sha(request_path) == request['sha256']
    data = request_path.read_bytes()
    assert len(data) == 52 and struct.unpack_from('<II', data) == (0x100, 0x20)
    decoded = bytes(byte ^ 0x31 for byte in data[8:])
    player, slot, ready, version, version_text = struct.unpack('<IIBxH32s', decoded)
    assert player == peer and slot == 0xffffffff and ready == int(ready_requested) and version == 0x106
    assert version_text.split(b'\0', 1)[0] == b'1.5.1.2' and echoed
    assert report['referenceSawSessionLoss']
    assert sha(Path(report['script'])) == report['scriptSha256']
    assert sha(Path(report['script']).parent / 'runner.py') == report['runnerSha256']
    if report.get('replayHelperSha256'):
        assert sha(Path(report['script']).parent / 'native_original_host_replay.py') == report['replayHelperSha256']
    if report.get('originalRoomSnapshot'):
        snapshots = [report['originalRoomSnapshot']] + report['originalHostPlayerSnapshots']
        assert len(snapshots) == 2
        for snapshot in snapshots:
            saved = Path(snapshot['copy'])
            assert saved.stat().st_size == snapshot['bytes'] <= 65536
            assert sha(saved) == snapshot['sha256']
    log_path = Path(report['script']).parent / 'native.log'
    assert sha(log_path) == report['logSha256']
    configured_seed = report.get('nativeConfiguredInitialSeed')
    if configured_seed is not None:
        assert 1 <= configured_seed <= 0x7fffffff and scenario_seed == configured_seed
        seed_rows = re.findall(r'\[coop-init-fixture\] Original host seed configured seed=(\d+) previous=(\d+) epoch=(\d+) phase=(\d+) settings-offset=144 before-GameStart=1 live-second-engine=0', log_path.read_text())
        assert len(seed_rows) == 1 and int(seed_rows[0][0]) == configured_seed and int(seed_rows[0][2]) > 0
        assert frame_interval == 50
    samples = []
    loading_interval = None
    campaign_starts = []
    configured_chapter = report.get('configuredCoopChapter')
    if configured_chapter:
        campaign_starts = [{'chapter': int(chapter), 'networkKingdoms': int(count)}
                           for chapter, count in re.findall(r'\[campaign\] Chapter (\d+) started with (\d+) network kingdoms', log_path.read_text())]
        assert all(s['chapter'] == configured_chapter and 0 <= s['networkKingdoms'] <= 4 for s in campaign_starts)
    # The smoke host executes these existing read-only commands under the
    # scheduler baton. Decode only the seven reviewed scalar globals; no heap
    # graph, save bytes, or fabricated Loaded acknowledgement is involved.
    addresses = [0x0071c68c, 0x006d7670, 0x006d8568, 0x006d87a0,
                 0x006d7678, 0x006c0eac, 0x0071c6a8]
    names = ['worldRoot', 'stateRoot', 'worldManagerRoot', 'networkManagerRoot',
             'originalGoWaitActive', 'originalGoWaitLimitMs', 'gameClock']
    script_text = Path(report['script']).read_text()
    commands = re.findall(r'^peek (0x[0-9a-f]+) (\d+)$', script_text, re.M)
    minimal_clock_sample = commands == [('0x0071c6a8', '4')]
    if minimal_clock_sample:
        # Reduced capture: the original polling adapter's one-shot marker and
        # a final baton-owned clock read. No root-stability claim is possible.
        assert game_start and go_status and 'originalLoadingSpinFixture' in report
        reads = re.findall(r'\[smoke\] peek ([0-9a-f]{8})\+4:\s*([0-9a-f]{8})\s+((?:[0-9a-f]{2}\s+){3}[0-9a-f]{2})', log_path.read_text())
        assert len(reads) == 1
        address, row_address, value = reads[0]
        assert int(address, 16) == int(row_address, 16) == 0x0071c6a8
        assert int.from_bytes(bytes.fromhex(value), 'little') == 0
        markers = re.findall(r'\[network\] Original initialization wait interval-ms=(\d+) spin-fixture=(\d+) world-present=(\d+) clock=(\d+)', log_path.read_text())
        assert len(markers) == 1
        loading_interval, spin, world_present, clock = map(int, markers[0])
        assert spin == int(report['originalLoadingSpinFixture'])
        assert loading_interval == (0 if spin else 8) and world_present == 1 and clock == 0
    elif 'peek ' in script_text:
        expected = addresses * 4
        assert [(int(a, 16), int(n)) for a, n in commands] == [(a, 4) for a in expected]
        reads = re.findall(r'\[smoke\] peek ([0-9a-f]{8})\+4:\s*([0-9a-f]{8})\s+((?:[0-9a-f]{2}\s+){3}[0-9a-f]{2})', log_path.read_text())
        assert len(reads) == len(expected)
        for index, (address, row_address, value) in enumerate(reads):
            assert int(address, 16) == int(row_address, 16) == expected[index]
            if index % 7 == 0:
                samples.append({'sample': index // 7})
            samples[-1][names[index % 7]] = int.from_bytes(bytes.fromhex(value), 'little')
        assert not samples[0]['originalGoWaitActive']
        assert game_start and go_status
        # Generation time varies with the actual map. Fixed four/nine-second
        # samples may precede attachment. Require the final observed wait and
        # validate every sampled wait; do not invent a second stable root.
        assert all(s['originalGoWaitActive'] in (0, 1) for s in samples)
        waiting_samples = [s for s in samples if s['originalGoWaitActive'] == 1]
        assert waiting_samples and samples[-1]['originalGoWaitActive'] == 1
        assert all(all(s[n] for n in names[:4]) and s['gameClock'] == 0 for s in waiting_samples)
        first_wait = next(i for i, s in enumerate(samples) if s['originalGoWaitActive'] == 1)
        assert all(s['originalGoWaitActive'] == 1 for s in samples[first_wait:])
        if 'originalLoadingSpinFixture' in report:
            markers = re.findall(r'\[network\] Original initialization wait interval-ms=(\d+) spin-fixture=(\d+) world-present=(\d+) clock=(\d+)', log_path.read_text())
            assert len(markers) == 1
            loading_interval, spin, world_present, clock = map(int, markers[0])
            assert spin == int(report['originalLoadingSpinFixture'])
            assert loading_interval == (0 if spin else 8) and world_present == 1 and clock == 0
    assert all(sha(ROOT / name) == expected for name, expected in report['sources'].items())
    assert all(sha(Path(report['settingsSource']) / name) == expected for name, expected in report['settingsBefore'].items())
    result = dict(version=1, observation=str(path), observationSha256=sha(path),
                  pinnedExecutableSha256=PIN, originalInstructionAnchors=rows,
                  dynamicPeerIds=[host, peer], originalPacketTypes=decoded_types,
                  originalPacketCount=len(packets), originalPacketBytes=sum(p['bytes'] for p in packets),
                  notReadyRequestVerified=not ready_requested, readyRequestVerified=ready_requested,
                  correctVersionLabelEchoVerified=True,
                  originalGameStartPacketVerified=game_start, originalGoStatusPacketVerified=go_status,
                  originalScenarioSeed=scenario_seed, originalFrameIntervalMs=frame_interval,
                  ownedNativeInitialSeedQualified=configured_seed is not None,
                  originalGoWaitSamples=samples, originalInitializationWaitObserved=bool(samples) or minimal_clock_sample,
                  originalFinalClockOnlySampled=minimal_clock_sample,
                  originalGoWaitRootStabilitySampled=bool(samples) and len([s for s in samples if s['originalGoWaitActive'] == 1]) >= 2 and len({s['worldRoot'] for s in samples if s['originalGoWaitActive'] == 1}) == 1,
                  originalInitializationPollIntervalMs=loading_interval,
                  configuredCoopChapter=configured_chapter, campaignStartObservations=campaign_starts,
                  cooperativeChapterStartObserved=any(s['networkKingdoms'] >= 2 for s in campaign_starts),
                  producerAbsent=True, originalSourcesAndSettingsUnchanged=True,
                  browserUsed=False, originalLobbyRequestResponseQualified=True,
                  mapLoaded=False, secondOriginalEngineExecuted=False,
                  sharedSaveLoadResumeQualified=False, fullMatchQualified=False,
                  independentInternetQualified=False, sustainedBrowserMemoryBoundQualified=False,
                  goalComplete=False)
    out.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ['dynamicPeerIds', 'originalPacketCount', 'originalPacketBytes', 'notReadyRequestVerified', 'readyRequestVerified', 'originalGameStartPacketVerified', 'originalGoStatusPacketVerified', 'originalInitializationWaitObserved', 'mapLoaded']}))


if __name__ == '__main__':
    main()
