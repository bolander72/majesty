"""Select a generated native save without mistaking copied inputs for progress.

This is a file-identity check, not gameplay qualification. Native saves can
contain a placement ghost; that requires independent construction evidence.
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def save_sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            digest.update(block)
    return digest.hexdigest()


def changed_save(directory, input_sha256s, owned_root=None):
    directory = Path(directory).resolve(strict=True)
    owned_root = Path(owned_root or ROOT / 'output').resolve(strict=True)
    if not directory.is_relative_to(owned_root):
        raise ValueError('Require an owned trial save directory')
    inputs = set(input_sha256s)
    changed = []
    for path in sorted(directory.glob('*.GMP')):
        if path.is_symlink() or not path.is_file():
            raise ValueError('Trial saves must be regular owned files')
        stat = path.stat()
        if getattr(stat, 'st_flags', 0) & 0x40000000 or not 0 < stat.st_size <= 64 * 1024 * 1024:
            raise ValueError('Trial save is unavailable or outside size bounds')
        if save_sha256(path) not in inputs:
            changed.append(path)
    if len(changed) != 1:
        raise ValueError('Require exactly one generated or changed save; exclude copied inputs')
    return changed[0]
