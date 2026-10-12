"""Native fixture input custody; dummy bytes do not qualify a game save."""
import hashlib
from pathlib import Path
from unittest.mock import patch

import pytest
from scripts.lib import native_original_host_replay as replay


@pytest.fixture
def checkpoint(tmp_path):
    data = b'Owned synthetic checkpoint custody fixture'
    profile = tmp_path / 'output/native-multiplayer-lobby-001/owned-profile'
    profile.mkdir(parents=True)
    source = tmp_path / 'output/source.GMP'
    source.write_bytes(data)
    transcript = object.__new__(replay.HostTranscript)
    transcript.paused_host_inspection = dict(role='host', complete=True,
        snapshots=[dict(frame=0,clock=0),dict(frame=11,clock=550)])
    transcript.host_checkpoint = dict(source=str(source), bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest())
    with patch.object(replay, 'ROOT', tmp_path):
        yield transcript, source, profile, data


def test_copy_preserves_exact_inspected_bytes(checkpoint):
    transcript, source, profile, data = checkpoint
    result = transcript.preserve_host_checkpoint(profile)
    assert result['source'] == str(source)
    assert result['sha256'] == hashlib.sha256(data).hexdigest()
    assert Path(result['path']).read_bytes() == data
    assert result['path'] == str(profile / 'Documents/My Games/MajestyHD/SaveGame/Coop_Host_Checkpoint.GMP')


@pytest.mark.parametrize('change', ['no-proof','guest','incomplete','wrong-frame','no-checkpoint'])
def test_require_paused_host_inspection(checkpoint, change):
    transcript, _, profile, _ = checkpoint
    if change == 'no-proof': transcript.paused_host_inspection = None
    elif change == 'guest': transcript.paused_host_inspection['role'] = 'guest'
    elif change == 'incomplete': transcript.paused_host_inspection['complete'] = False
    elif change == 'wrong-frame': transcript.paused_host_inspection['snapshots'][1]['frame'] = 10
    else: transcript.host_checkpoint = None
    with pytest.raises(ValueError, match='inspected original paused host'):
        transcript.preserve_host_checkpoint(profile)


@pytest.mark.parametrize('change', ['bytes','digest','length'])
def test_changed_source_refused(checkpoint, change):
    transcript, source, profile, _ = checkpoint
    if change == 'bytes': source.write_bytes(b'Changed')
    elif change == 'digest': transcript.host_checkpoint['sha256'] = '0' * 64
    else: transcript.host_checkpoint['bytes'] += 1
    with pytest.raises(ValueError, match='checkpoint changed'):
        transcript.preserve_host_checkpoint(profile)


def test_existing_target_is_preserved(checkpoint):
    transcript, _, profile, _ = checkpoint
    result = transcript.preserve_host_checkpoint(profile)
    with pytest.raises(FileExistsError): transcript.preserve_host_checkpoint(profile)
    assert Path(result['path']).read_bytes() == checkpoint[3]


def test_profile_and_destination_symlinks_refused(checkpoint):
    transcript, _, profile, _ = checkpoint
    outside = profile.parent / 'outside';outside.mkdir()
    (profile / 'Documents').symlink_to(outside, target_is_directory=True)
    with pytest.raises(ValueError, match='symlink'): transcript.preserve_host_checkpoint(profile)
    assert not list(outside.iterdir())
    alias = profile.parent / 'alias';alias.symlink_to(profile, target_is_directory=True)
    with pytest.raises(ValueError, match='exact owned native profile'):
        transcript.preserve_host_checkpoint(alias)


def test_unowned_profile_refused(checkpoint):
    transcript, _, profile, _ = checkpoint
    for candidate in [profile.parent, profile.parent / 'user-profile', profile.parent.parent / 'owned-profile']:
        with pytest.raises(ValueError, match='exact owned native profile'):
            transcript.preserve_host_checkpoint(candidate)
