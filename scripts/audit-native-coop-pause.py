#!/usr/bin/env python3
"""Bind a stopped original pause to its inspected party and captured input window."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re

from lib.native_original_guest_replay import GuestTranscript
from lib.native_original_host_replay import lobby_manifest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('coop_initialization_audit',
    ROOT/'scripts/audit-native-coop-initialization.py')
initialization = importlib.util.module_from_spec(spec)
spec.loader.exec_module(initialization)


def audit(guest_path, host_path, abi_path):
    guest, guest_run = initialization.proof(guest_path, 'guest')
    host, host_run = initialization.proof(host_path, 'host')
    assert host_run['nativePauseWorldRequested'] is True
    assert host_run['replayOriginalInputsRequested'] is True
    assert host_run['originalGuestInputWindowDelivered'] is True
    assert host_run['replaySourceReport'] == str(Path(guest_path).resolve())
    assert host_run['nativeExecutableSha256'] == guest_run['nativeExecutableSha256']
    assert host_run['originalHostGameStartMatched'] is True
    assert host_run['originalHostGoStatusObserved'] is True
    assert host_run['capturedGuestGoStatusDelivered'] is True
    for label, key in [('native_original_host_replay.py', 'replayHelperSha256'),
                       ('native_original_guest_replay.py', 'guestReplayHelperSha256'),
                       ('native_original_inputs.py', 'originalInputHelperSha256')]:
        assert initialization.sha(Path(host_run['script']).parent/label) == host_run[key]
    wire = lobby_manifest(guest_run['nativeExecutableSha256'],
        guest_run['configuredCoopChapter'], guest_run['configuredCoopRegion'],
        guest_run['nativeFixtureContentIdentity'])
    transcript = GuestTranscript(Path(guest_path), wire, guest_run['nativeExecutableSha256'],
        guest_run['configuredCoopChapter'], guest_run['configuredCoopRegion'],
        guest_run['nativeFixtureContentIdentity'])
    window = transcript.input_window()
    delivered = host_run['replayedGuestInputPackets']
    assert len(delivered) == 5
    for sequence, (payload, row) in enumerate(zip(window.payloads, delivered, strict=True), 4):
        assert row == dict(sequence=sequence, bytes=len(payload),
            sha256=hashlib.sha256(payload).hexdigest())
    assert host_run['originalGuestInputWindowTriggerFrame'] == 12
    abi = initialization.read(abi_path)
    assert abi['originalEmptyInputWindowAbiQualified'] is True
    assert abi['sourceProofSha256'] == initialization.sha(guest_path)
    assert abi['nativeExecutableSha256'] == host_run['nativeExecutableSha256']
    assert abi['preparedInputReturn'] == '004179a9'
    log = (Path(host_run['script']).parent/'native.log').read_text()
    production = host_run.get('nativeProductionPauseActionRequested') is True
    queued = ('[coop-pause-fixture] Original pause queued epoch=1 local=1 slot=0 '
        'frame=1 clock=50 original-control=005a38c0 original-sender=005a46a0 '
        'input-return=004179a9 phase-unmodified=1')
    if production:
        queued += ' production-action=1'
        armed = ('[coop-pause-fixture] Production pause action armed epoch=1 '
            'local=1 slot=0 original-actions=1')
        requested = '[coop-transition] Pause requested epoch=1 owner=1'
        assert log.splitlines().count(armed) == log.splitlines().count(requested) == 1
        assert log.index(armed) < log.index(requested) < log.index(queued)
    settled = ('[coop-pause-fixture] Settled original pause epoch=1 local=1 slot=0 '
        'owner=1 frame=11 clock=550 phase=7 pending=0 live-second-engine=0')
    assert log.splitlines().count(queued) == log.splitlines().count(settled) == 1
    assert log.index(queued) < log.index(settled)
    assert re.search(r'\[smoke\] peek 0071c6a8\+4:\s+0071c6a8  26 02 00 00', log)
    assert [(s['frame'], s['clock']) for s in host['snapshots']] == [(0, 0), (11, 550)]
    assert host['bothKingdomPalacesBuildingsAndGPLSavedQualified'] is True
    assert host['pairedSynchronizationQualified'] is False
    assert host['sharedSaveLoadResumeQualified'] is False
    return dict(version=1, originalNativeCooperativePauseSavedQualified=True,
        guestProof=str(Path(guest_path).resolve()), guestProofSha256=initialization.sha(guest_path),
        hostProof=str(Path(host_path).resolve()), hostProofSha256=initialization.sha(host_path),
        inputAbi=str(Path(abi_path).resolve()), inputAbiSha256=initialization.sha(abi_path),
        nativeExecutableSha256=host_run['nativeExecutableSha256'],
        queuedFrame=1, queuedClock=50, pausedFrame=11, pausedClock=550,
        owner=1, localSlot=0, originalPauseSender='005a46a0',
        preparedInputReturn='004179a9', unchangedGuestInputPackets=5,
        unchangedGuestInputFrames=list(range(10, 20, 2)), finalClock=550,
        bothKingdomsSaved=True, browserUsed=False, liveSecondOriginalEngine=False,
        productionTravelActionRuntimeQualified=production, sharedSavedNameCleanupRuntimeQualified=False,
        sharedSaveLoadResumeQualified=False,
        pairedSynchronizationQualified=False, goalComplete=False,
        scope='One original native host settles its own original pause and saves both kingdoms using a bounded unchanged guest input window. No continuing peer world, Loaded vote, shared resume or browser execution.')


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('guest', type=Path);p.add_argument('host', type=Path)
    p.add_argument('abi', type=Path);p.add_argument('output', type=Path)
    args=p.parse_args(); result=audit(args.guest.resolve(), args.host.resolve(), args.abi.resolve())
    with args.output.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps({key:result[key] for key in ['originalNativeCooperativePauseSavedQualified',
        'pausedFrame','pausedClock','bothKingdomsSaved','sharedSaveLoadResumeQualified']}))
