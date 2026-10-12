#!/usr/bin/env python3
"""Transfer a frozen owned GMP through original packets, without starting a world."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        while chunk := stream.read(4096):
            h.update(chunk)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('owned_session', type=Path)
    parser.add_argument('--attempt', type=int, required=True)
    args = parser.parse_args()
    report = ROOT / f'output/native-received-real-{args.attempt:03}.json'
    log = report.with_suffix('.log')
    if args.attempt < 1 or report.exists() or log.exists():
        parser.error('Use a fresh positive attempt')
    rows = subprocess.check_output(['ps', '-axo', 'comm='], text=True).splitlines()
    if any(Path(row.strip()).name in ['pop_smoke', 'clang', 'clang++', 'ninja',
                                     'wasm-opt', 'wasm-ld', 'native_received_packet_tests']
           for row in rows):
        parser.error('Another resource-intensive build/game is live')
    session_path = args.owned_session.resolve()
    session = json.loads(session_path.read_text())
    if not session.get('nativeSessionTerminal') or session.get('nativeExitCode') != 0 \
            or not session.get('nativeRouteCompleted'):
        parser.error('Require a completed owned native session')
    selected = session['selectedRevisionExports'][0]
    source = Path(selected['filename']).resolve()
    if not source.is_relative_to(GAME / 'build') or \
            not any(part.startswith('actor-arrival-fixture-') for part in source.parts) or \
            not source.name.endswith('.GMP') or source.stat().st_size != selected['bytes'] or \
            not 0 < source.stat().st_size <= 64 * 1024 * 1024 or sha(source) != selected['sha256']:
        parser.error('Require the unchanged owned session input save')
    fixture = Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-received-checkpoint-',
                                    dir=GAME / 'build'))
    copied, received = fixture / 'Source.GMP', fixture / 'Received.GMP'
    shutil.copy2(source, copied)
    assert sha(copied) == selected['sha256']
    inputs = ['tests/native_received_packet_tests.cpp', 'tests/CMakeLists.txt',
              'native_received_transfer.cpp', 'native_received_transfer.h',
              'native_received_checkpoint.cpp', 'native_received_checkpoint.h',
              'browser_network.cpp', 'browser_overrides.h', 'browser_viewport.cpp',
              'game.toml', 'globals.toml', 'kit/dx/directplay.cpp', 'kit/dx/dx.h',
              'kit/runtime/native_seam.h', 'kit/runtime/mods_seam.cpp',
              'kit/runtime/kernel32.cpp']
    frozen = []
    for index, name in enumerate(inputs):
        path = GAME / name
        saved = fixture / f'{index:02}-{path.name}'
        shutil.copy2(path, saved)
        frozen.append(dict(source=str(path), copy=str(saved), sha256=sha(saved)))
    command = ['.venv/bin/python', 'kit/tools/test.py', '--game-dir', str(GAME),
               '--native-test', 'native_received_packet_tests', '--jobs', '1']
    record = dict(version=4, realCheckpointPacketTransferQualified=False,
                  originalFileDispatcherFixtureQualified=False,
                  originalSourceIdentityFixtureQualified=False,
                  originalOuterReceiveQueueFixtureQualified=False,
                  originalSystemLossDispatchFixtureQualified=False,
                  originalLobbyCleanupComponentsFixtureQualified=False,
                  modalLobbyExitQualified=False, liveMatchExitQualified=False,
                  browserUsed=False, gameProcessesStarted=0, worldLoadQualified=False,
                  ownedSession=str(session_path), ownedSessionSha256=sha(session_path),
                  source=str(source), sourceSha256=selected['sha256'], bytes=selected['bytes'],
                  copiedSource=str(copied), received=str(received), fixture=str(fixture),
                  frozenInputs=frozen, command=command, log=str(log),
                  startedAtMs=time.time_ns() // 1000000, testTerminal=False)
    report.write_text(json.dumps(record, indent=2) + '\n')
    env = {key: value for key, value in os.environ.items() if not key.startswith('RECOMP_')}
    env.update(MAJESTY_TEST_RECEIVED_SOURCE=str(copied),
               MAJESTY_TEST_RECEIVED_OUTPUT=str(received))
    with log.open('x') as output:
        process = subprocess.Popen(command, cwd=GAME, env=env, stdout=output,
                                   stderr=subprocess.STDOUT)
        record['testPid'] = process.pid
        report.write_text(json.dumps(record, indent=2) + '\n')
        code = process.wait()
    record.update(testTerminal=True, exitCode=code,
                  finishedAtMs=time.time_ns() // 1000000, logSha256=sha(log),
                  sourcesUnchanged=all(sha(Path(item['source'])) == item['sha256']
                                       for item in frozen),
                  originalSaveUnchanged=sha(source) == selected['sha256'],
                  copiedSourceUnchanged=sha(copied) == selected['sha256'])
    test_log = GAME / 'build/cmake/macos/Testing/Temporary/LastTest.log'
    if test_log.exists() and test_log.stat().st_size < 2 * 1024 * 1024:
        trace = test_log.read_text()
        match = re.search(r'real checkpoint: bytes=(\d+) packets=(\d+) original-crc=([0-9a-f]{8})', trace)
        checks = re.search(r'original receive packets: (\d+) checks, (\d+) failures; (\d+) guarded calls', trace)
        dispatch = re.search(r'original FILE dispatch: (\d+) packets; source IDs=7,8,0; '
                             r'protocol keys=49,0,8', trace)
        queue = re.search(r'original outer receive queue: (\d+) packets', trace)
        losses = re.search(r'original system loss dispatch: (\d+) packets; modal lobby exit unexecuted', trace)
        cleanup = 'original lobby cleanup components: drained manager reset; local source released' in trace
        if match and checks:
            record.update(transferredBytes=int(match[1]), dataPackets=int(match[2]),
                          originalCrc=match[3], checks=int(checks[1]),
                          failures=int(checks[2]), guardedCalls=int(checks[3]))
        if dispatch:
            record['originalFileDispatchPackets'] = int(dispatch[1])
        if queue:
            record['originalOuterReceiveQueuePackets'] = int(queue[1])
        if losses:
            record['originalSystemLossDispatchPackets'] = int(losses[1])
        record['originalLobbyCleanupComponentsTracePresent'] = cleanup
        saved = fixture / 'LastTest.log'
        shutil.copy2(test_log, saved)
        record['testLog'] = dict(filename=str(saved), sha256=sha(saved))
    if code == 0 and record['sourcesUnchanged'] and record['originalSaveUnchanged'] \
            and record['copiedSourceUnchanged'] and record.get('failures') == 0 \
            and record.get('originalFileDispatchPackets', 0) >= record.get('dataPackets', 0) + 2 \
            and record.get('originalOuterReceiveQueuePackets', 0) >= record.get('originalFileDispatchPackets', 0) \
            and record.get('originalSystemLossDispatchPackets', 0) >= 23 \
            and record.get('originalLobbyCleanupComponentsTracePresent') \
            and record.get('transferredBytes') == selected['bytes'] and received.is_file() \
            and received.stat().st_size == selected['bytes'] and sha(received) == selected['sha256']:
        record.update(realCheckpointPacketTransferQualified=True,
                      originalFileDispatcherFixtureQualified=True,
                      originalSourceIdentityFixtureQualified=True,
                      originalOuterReceiveQueueFixtureQualified=True,
                      originalSystemLossDispatchFixtureQualified=True,
                      originalLobbyCleanupComponentsFixtureQualified=True,
                      receivedSha256=sha(received))
        binary = GAME / 'build/recomp/native_received_packet_tests'
        saved = fixture / 'native_received_packet_tests'
        shutil.copy2(binary, saved)
        record['testBinary'] = dict(filename=str(saved), sha256=sha(saved))
    record['scope'] = ('Original player/packet constructors, source and forwarder setters, FILE '
                       'dispatch and outer receive queue/destruction, filename/CRC calls and '
                       'original system-loss notification dispatch and drained manager reset components, '
                       'real private file transfer; fake transport, no modal lobby or live-match exit, world load, '
                       'peer match, internet or browser.')
    report.write_text(json.dumps(record, indent=2) + '\n')
    print(json.dumps({key: record.get(key) for key in
                      ['realCheckpointPacketTransferQualified', 'exitCode', 'checks',
                       'failures', 'transferredBytes', 'dataPackets', 'originalCrc']}))
    raise SystemExit(0 if record['realCheckpointPacketTransferQualified'] else code or 1)


if __name__ == '__main__':
    main()
