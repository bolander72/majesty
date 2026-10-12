import json
from pathlib import Path

import pytest

from scripts.lib import native_saved_source as source


@pytest.fixture
def saved_fixture(tmp_path, monkeypatch):
    game = tmp_path / 'upstream/majesty-recomp'
    fixture = game / 'build/actor-arrival-fixture-session-test'
    fixture.mkdir(parents=True)
    snapshot = fixture / 'Session_Ready_0.GMP'
    snapshot.write_bytes(b'fixture bytes, not a game-format qualification')
    settings = fixture / 'settings'
    inputs = {}
    for name in source.SETTINGS:
        path = settings / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b'owned fixture setting')
        inputs[name] = source.sha(path)
    output = tmp_path / 'output'
    output.mkdir()
    log = output / 'terminal.log'
    log.write_text('[frontier] Session ready snapshot serial=0 region=0_0 clock=50 '
                   'ordinary-ticks=0 guards=0 world-same=1 hooks-same=1 saved=1\n')
    digest, size = source.sha(snapshot), snapshot.stat().st_size
    capture = dict(serial=0, region='0_0', clock=50, file=str(snapshot), size=size,
                   sha256=digest, manifest=f'checkpoint-v1\n0\n{size}\n{digest}\nfixture-content\n')
    metadata = dict(nativeOnly=True, browserUsed=False, nativeSessionTerminal=True,
                    nativeExitCode=0, nativeRouteCompleted=True, stopReason=None,
                    readyStateExpected=True, nativePid=123, fixture=str(fixture),
                    log=str(log), logSha256=source.sha(log), readyCaptures=[capture],
                    originalSettings=str(settings), inputHashes=inputs)
    report = output / 'terminal.json'

    def absent(pid, signal):
        assert (pid, signal) == (123, 0)
        raise ProcessLookupError

    monkeypatch.setattr(source.os, 'kill', absent)

    def save():
        report.write_text(json.dumps(metadata))
        return source.saved_source(report, game)

    return metadata, snapshot, log, save


def test_saved_snapshot_admission_has_no_ownership_or_pair_claim(saved_fixture):
    _, snapshot, _, save = saved_fixture
    admitted = save()
    assert admitted['sha256'] == source.sha(snapshot)
    assert admitted['clock'] == 50
    assert admitted['entityOwnerRevisionQualified'] is False
    assert admitted['pairedGameplayQualified'] is False


@pytest.mark.parametrize('field,value', [('nativeSessionTerminal', False),
                                       ('nativeExitCode', 6), ('browserUsed', True),
                                       ('nativeRouteCompleted', False)])
def test_nonterminal_or_failed_producer_is_refused(saved_fixture, field, value):
    metadata, _, _, save = saved_fixture
    metadata[field] = value
    with pytest.raises(ValueError, match='successful terminal'):
        save()


def test_live_producer_is_refused(saved_fixture, monkeypatch):
    _, _, _, save = saved_fixture
    monkeypatch.setattr(source.os, 'kill', lambda *_: None)
    with pytest.raises(ValueError, match='PID is still present'):
        save()


def test_changed_original_snapshot_is_refused(saved_fixture):
    _, snapshot, _, save = saved_fixture
    snapshot.write_bytes(b'replacement snapshot')
    with pytest.raises(ValueError, match='snapshot changed'):
        save()


def test_ready_clock_requires_exact_original_trace(saved_fixture):
    metadata, _, _, save = saved_fixture
    metadata['readyCaptures'][0]['clock'] = 100
    with pytest.raises(ValueError, match='exact original ready'):
        save()


def test_changed_settings_are_refused(saved_fixture):
    metadata, _, _, save = saved_fixture
    Path(metadata['originalSettings'], 'mod-settings.json').write_bytes(b'changed')
    with pytest.raises(ValueError, match='settings changed'):
        save()


@pytest.fixture
def cooperative_fixture(tmp_path, monkeypatch):
    game = tmp_path / 'upstream/majesty-recomp'
    settings = game / 'build/actor-arrival-fixture-coop-source/settings'
    inputs = {}
    for name in source.SETTINGS:
        path = settings / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b'owned cooperative setting')
        inputs[name] = source.sha(path)
    output = tmp_path / 'output'
    root = output / 'native-multiplayer-lobby-001'
    profile = root / 'owned-profile'
    snapshots = []
    for label in ('Coop_World_Ready', 'Coop_World_Progress'):
        path = profile / 'Documents/My Games/MajestyHD/SaveGame' / (label + '.GMP')
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b'Admission fixture only; not native game bytes')
        snapshots.append(dict(label=label, path=str(path), bytes=path.stat().st_size, sha256=source.sha(path)))
    log = root / 'native.log'
    log.write_text('[coop-world-fixture] Snapshot stage=1 label=Coop_World_Progress epoch=1 local=2 slot=1 '
                   'frame=10 clock=500 kingdoms=2 original-writer=1 before-tick=1 live-second-engine=0\n')
    metadata = dict(attempt=1, nativePid=123, nativeExitCode=0, browserUsed=False,
                    liveSecondOriginalEngine=False, profile=str(profile), worldSnapshots=snapshots,
                    logSha256=source.sha(log), settingsSource=str(settings), settingsBefore=inputs)
    for key in ('nativeSessionTerminal', 'producerAbsent', 'fixtureStopped', 'servedUnchanged',
                'originalSettingsUnchanged', 'canonicalNativeStateUnchanged', 'privateNativeExecutableUnchanged',
                'recordedHostReplay', 'originalGuestGoStatusObserved', 'capturedHostGoStatusDelivered',
                'worldSnapshotRequested', 'twoOriginalWorldSnapshotsCaptured'):
        metadata[key] = True
    verifiers = {}
    for name in ('scripts/inspect-native-coop-world.mjs', 'scripts/lib/connected-residency.mjs',
                 'scripts/lib/incoming-host-pause.mjs',
                 'scripts/check-native-repeat-return.mjs', 'scripts/lib/stopped-entity-io.mjs',
                 'web/world/checkpoint.mjs', 'web/world/terrain.mjs', 'web/world/transfer-store.mjs'):
        path = tmp_path / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b'Admission verifier fixture')
        verifiers[name] = source.sha(path)
    raw = output / 'native-multiplayer-lobby-001-observed.json'
    raw.write_text(json.dumps(metadata))
    proof = dict(initializedNativeCooperativeWorldSavedQualified=True,
                 bothKingdomPalacesBuildingsAndGPLSavedQualified=True, originalGuestProgressSavedQualified=True,
                 browserUsed=False, liveSecondOriginalEngine=False, pairedSynchronizationQualified=False,
                 sharedSaveLoadResumeQualified=False, verifierInputs=verifiers, report=str(raw), reportSha256=source.sha(raw),
                 snapshots=[snapshots[0], dict(**snapshots[1], clock=500, frame=10,
                    kingdoms=[dict(networkPlayer=1, palace=[{}]), dict(networkPlayer=2, palace=[{}])])])
    report = output / 'proof.json'
    def absent(pid, signal):
        assert (pid, signal) == (123, 0)
        raise ProcessLookupError
    monkeypatch.setattr(source.os, 'kill', absent)
    def save():
        report.write_text(json.dumps(proof))
        return source.saved_source(report, game)
    return proof, raw, log, save


def test_cooperative_progress_admits_single_engine_readback_only(cooperative_fixture):
    _, _, _, save = cooperative_fixture
    result = save()
    assert result['sourceType'] == 'original-terminal-coop-progress-snapshot-v1'
    assert result['clock'] == 500
    assert result['entityOwnerRevisionQualified'] is False
    assert result['pairedGameplayQualified'] is False


def test_cooperative_live_producer_refused(cooperative_fixture, monkeypatch):
    _, _, _, save = cooperative_fixture
    monkeypatch.setattr(source.os, 'kill', lambda *_: None)
    with pytest.raises(ValueError, match='PID is still present'):
        save()


@pytest.mark.parametrize('change,reason', [('report', 'producer report changed'),
    ('snapshot', 'snapshot changed'), ('clock', 'exact original co-op'),
    ('kingdom', 'Both original kingdoms'), ('pair', 'independently inspected'),
    ('verifier', 'inspector inputs changed'), ('incoming-verifier', 'inspector inputs changed'),
    ('missing-incoming-verifier', 'inspector inputs changed')])
def test_changed_cooperative_evidence_refused(cooperative_fixture, change, reason):
    proof, raw, _, save = cooperative_fixture
    if change == 'report': raw.write_text('{}')
    elif change == 'snapshot': Path(proof['snapshots'][1]['path']).write_bytes(b'changed')
    elif change == 'clock': proof['snapshots'][1]['clock'] = 550
    elif change == 'kingdom': proof['snapshots'][1]['kingdoms'].pop()
    elif change == 'pair': proof['pairedSynchronizationQualified'] = True
    elif change == 'verifier': proof['verifierInputs']['web/world/checkpoint.mjs'] = '0' * 64
    elif change == 'incoming-verifier': proof['verifierInputs']['scripts/lib/incoming-host-pause.mjs'] = '0' * 64
    elif change == 'missing-incoming-verifier': proof['verifierInputs'].pop('scripts/lib/incoming-host-pause.mjs')
    with pytest.raises(ValueError, match=reason): save()
