"""Read one immutable ready snapshot from a terminal, owned native session.

This admits saved-world lifecycle testing only, never an entity-owner revision,
connected-party state, or multiplayer synchronization qualification.
"""
import hashlib
import json
import os
import re
from pathlib import Path

SETTINGS = {'mod-settings.json', 'Documents/My Games/MajestyHD/MajXPrefs',
            'Documents/My Games/MajestyHD/questdata_majx.sav'}


def sha(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def owned(path, build):
    raw = Path(path)
    path = raw.resolve()
    if raw.is_symlink() or not path.is_relative_to(build) or not any(
            part.startswith('actor-arrival-fixture-') for part in path.parts):
        raise ValueError('Require an owned native fixture input')
    return path


def saved_source(report, game):
    report = Path(report).resolve()
    if report.stat().st_size > 2 * 1024 * 1024:
        raise ValueError('Stopped source report exceeds bound')
    digest = sha(report)
    m = json.loads(report.read_text())
    if m.get('initializedNativeCooperativeWorldSavedQualified') is True:
        return cooperative_saved_source(report, digest, m, game)
    if not (m.get('nativeOnly') is True and m.get('browserUsed') is False and
            m.get('nativeSessionTerminal') is True and m.get('nativeExitCode') == 0 and
            m.get('nativeRouteCompleted') is True and not m.get('stopReason') and
            m.get('readyStateExpected') is True):
        raise ValueError('Require a successful terminal saved-world session')
    try:
        os.kill(m['nativePid'], 0)
    except ProcessLookupError:
        pass
    else:
        raise ValueError('Stopped source producer PID is still present')
    build = (game / 'build').resolve()
    fixture = owned(m['fixture'], build)
    log = Path(m['log']).resolve()
    if (not log.is_relative_to(game.parent.parent / 'output') or
            log.stat().st_size > 4 * 1024 * 1024 or sha(log) != m['logSha256']):
        raise ValueError('Stopped source trace changed')
    candidates = [r for r in m['readyCaptures'] if r['serial'] == 0 and r['region'] == '0_0']
    if len(candidates) != 1:
        raise ValueError('Require one initial saved-world ready capture')
    capture = candidates[0]
    if type(capture['clock']) is not int or not 0 <= capture['clock'] <= 0xffffffff:
        raise ValueError('Invalid stopped snapshot clock')
    observation = (f"[frontier] Session ready snapshot serial=0 region=0_0 clock={capture['clock']} "
                   'ordinary-ticks=0 guards=0 world-same=1 hooks-same=1 saved=1')
    if log.read_text().splitlines().count(observation) != 1:
        raise ValueError('Missing exact original ready snapshot observation')
    source = owned(capture['file'], build)
    if source.parent != fixture or source.name != 'Session_Ready_0.GMP':
        raise ValueError('Snapshot is outside the exact stopped fixture')
    if not 1 <= capture['size'] <= 64 * 1024 * 1024 or (
            source.stat().st_size != capture['size'] or sha(source) != capture['sha256']):
        raise ValueError('Stopped original snapshot changed')
    manifest = capture['manifest'].splitlines()
    if (len(manifest) != 5 or manifest[0] != 'checkpoint-v1' or
            manifest[1] not in ('0', '1') or int(manifest[2]) != capture['size'] or
            manifest[3] != capture['sha256']):
        raise ValueError('Stopped snapshot manifest mismatch')
    original = owned(m['originalSettings'], build)
    inputs = m['inputHashes']
    if set(inputs) != SETTINGS or any(sha(original / n) != h for n, h in inputs.items()):
        raise ValueError('Stopped source settings changed')
    if sha(report) != digest:
        raise ValueError('Stopped source report changed during admission')
    return dict(report=str(report), reportSha256=digest, source=str(source),
                sha256=capture['sha256'], bytes=capture['size'], clock=capture['clock'],
                originalSettings=str(original), inputHashes=inputs,
                admitterSourceSha256=sha(Path(__file__)),
                sourceType='original-terminal-ready-snapshot-v1',
                entityOwnerRevisionQualified=False, pairedGameplayQualified=False)


def cooperative_saved_source(proof_path, proof_sha, proof, game):
    """Admit a stopped original co-op progress save for single-engine readback.

    Bind the independent typed inspector, its inputs, the original producer
    report/trace and exact private snapshot. No joined party travels with it.
    """
    output = (game.parent.parent / 'output').resolve()
    if not proof_path.is_relative_to(output):
        raise ValueError('Cooperative proof must be in owned output')
    if (proof.get('bothKingdomPalacesBuildingsAndGPLSavedQualified') is not True or
            proof.get('originalGuestProgressSavedQualified') is not True or
            proof.get('browserUsed') is not False or
            proof.get('liveSecondOriginalEngine') is not False or
            proof.get('pairedSynchronizationQualified') is not False or
            proof.get('sharedSaveLoadResumeQualified') is not False):
        raise ValueError('Require an independently inspected original co-op world')
    required_verifiers = {'scripts/inspect-native-coop-world.mjs', 'scripts/lib/connected-residency.mjs',
                         'scripts/lib/incoming-host-pause.mjs',
                         'scripts/check-native-repeat-return.mjs', 'scripts/lib/stopped-entity-io.mjs',
                         'web/world/checkpoint.mjs', 'web/world/terrain.mjs', 'web/world/transfer-store.mjs'}
    if set(proof['verifierInputs']) != required_verifiers or any(
            sha(game.parent.parent / name) != digest for name, digest in proof['verifierInputs'].items()):
        raise ValueError('Cooperative inspector inputs changed')
    raw_path = Path(proof['report']).resolve()
    if not raw_path.is_relative_to(output) or raw_path.stat().st_size > 1024 * 1024 or sha(raw_path) != proof['reportSha256']:
        raise ValueError('Cooperative producer report changed')
    m = json.loads(raw_path.read_text())
    flags = ('nativeSessionTerminal', 'producerAbsent', 'fixtureStopped', 'servedUnchanged',
             'originalSettingsUnchanged', 'canonicalNativeStateUnchanged', 'privateNativeExecutableUnchanged',
             'recordedHostReplay', 'originalGuestGoStatusObserved', 'capturedHostGoStatusDelivered',
             'worldSnapshotRequested', 'twoOriginalWorldSnapshotsCaptured')
    if (m.get('nativeExitCode') != 0 or m.get('browserUsed') is not False or m.get('liveSecondOriginalEngine') is not False or
            m.get('stopReason') or m.get('referenceError') or not all(m.get(key) is True for key in flags)):
        raise ValueError('Require a successful terminal original co-op producer')
    try:
        os.kill(m['nativePid'], 0)
    except ProcessLookupError:
        pass
    else:
        raise ValueError('Stopped source producer PID is still present')
    root = output / f"native-multiplayer-lobby-{m['attempt']:03}"
    profile = root / 'owned-profile'
    if raw_path != output / (root.name + '-observed.json') or Path(m['profile']) != profile or profile.resolve() != profile:
        raise ValueError('Cooperative producer is outside its exact owned profile')
    log = root / 'native.log'
    if log.stat().st_size > 4 * 1024 * 1024 or sha(log) != m['logSha256']:
        raise ValueError('Cooperative producer trace changed')
    if len(proof['snapshots']) != 2 or len(m['worldSnapshots']) != 2:
        raise ValueError('Require exactly two inspected cooperative snapshots')
    capture = proof['snapshots'][1]
    source = profile / 'Documents/My Games/MajestyHD/SaveGame/Coop_World_Progress.GMP'
    original_capture = m['worldSnapshots'][1]
    if (capture['label'] != 'Coop_World_Progress' or capture['path'] != str(source) or
            source.resolve() != source or source.is_symlink() or
            type(capture['clock']) is not int or not 500 <= capture['clock'] <= 0xffffffff or
            not 1 <= capture['bytes'] <= 2 * 1024 * 1024 or
            any(capture[k] != original_capture[k] for k in ('label', 'path', 'bytes', 'sha256')) or
            source.stat().st_size != capture['bytes'] or sha(source) != capture['sha256']):
        raise ValueError('Cooperative progress snapshot changed')
    kingdoms = capture['kingdoms']
    if len(kingdoms) != 2 or sorted(k['networkPlayer'] for k in kingdoms) != [1, 2] or any(len(k['palace']) != 1 for k in kingdoms):
        raise ValueError('Both original kingdoms must be inspected')
    observation = (r'^\[coop-world-fixture\] Snapshot stage=1 label=Coop_World_Progress epoch=[1-9][0-9]* '
                   rf"local=2 slot=[0-3] frame={capture['frame']} clock={capture['clock']} "
                   r'kingdoms=2 original-writer=1 before-tick=1 live-second-engine=0$')
    if len(re.findall(observation, log.read_text(), re.M)) != 1:
        raise ValueError('Missing exact original co-op progress snapshot observation')
    original = owned(m['settingsSource'], (game / 'build').resolve())
    inputs = m['settingsBefore']
    if set(inputs) != SETTINGS or any(sha(original / n) != h for n, h in inputs.items()):
        raise ValueError('Stopped co-op source settings changed')
    if sha(raw_path) != proof['reportSha256'] or sha(proof_path) != proof_sha:
        raise ValueError('Cooperative source evidence changed during admission')
    return dict(report=str(proof_path), reportSha256=proof_sha, source=str(source),
                sha256=capture['sha256'], bytes=capture['bytes'], clock=capture['clock'],
                originalSettings=str(original), inputHashes=inputs,
                admitterSourceSha256=sha(Path(__file__)),
                sourceType='original-terminal-coop-progress-snapshot-v1',
                originalCooperativeWorldInspected=True, entityOwnerRevisionQualified=False,
                pairedGameplayQualified=False)
