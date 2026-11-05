#!/usr/bin/env python3
"""Bind a private Alchemist overlay to the unchanged browser import archive.

This stages metadata only. It never publishes assets or modifies game files.
"""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile
import zlib

EXE_SHA = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def resident(path):
    if path.is_symlink() or not path.is_file() or path.stat().st_flags & 0x40000000:
        raise ValueError('Require a resident regular input: ' + path.name)
    return path.read_bytes()


def prepare(base, candidate, output):
    if output.exists():
        raise ValueError('Preserve existing overlay metadata')
    game = candidate / 'game'
    if digest(resident(game / 'MajestyHD - Old.exe')) != EXE_SHA:
        raise ValueError('Unsupported executable')
    patches = []
    with zipfile.ZipFile(base) as archive:
        entries = {item.filename: item for item in archive.infolist() if not item.is_dir()}
        if len({name.casefold() for name in entries}) != len(entries):
            raise ValueError('Conflicting original archive paths')
        if digest(archive.read('MajestyHD - Old.exe')) != EXE_SHA:
            raise ValueError('Original archive executable differs')
        for directory in ('Data', 'DataMX'):
            for path in sorted((game / directory).iterdir()):
                if path.is_dir():
                    raise ValueError('Unexpected nested resource directory')
                name = path.relative_to(game).as_posix()
                raw = resident(path)
                original = entries.get(name)
                if not original and any(key.casefold() == name.casefold() for key in entries):
                    raise ValueError('Resource spelling conflicts with original archive')
                if original and original.file_size == len(raw) and original.CRC == zlib.crc32(raw):
                    continue
                if not 0 < len(raw) <= 16 * 1024 * 1024:
                    raise ValueError('Resource outside bounded browser patch size')
                patches.append(dict(path=name, bytes=len(raw), sha256=digest(raw),
                                    baseSha256=digest(archive.read(original)) if original else None))
    if not 1 <= len(patches) <= 64 or sum(p['bytes'] for p in patches) > 64 * 1024 * 1024:
        raise ValueError('Unexpected content pack size')
    report = dict(format='majesty-alchemist-browser-overlay-v1', baseArchive=str(base.resolve()),
                  candidate=str(candidate.resolve()), patches=patches,
                  browserQualified=False, published=False)
    output.write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('base', 'candidate', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    report = prepare(args.base, args.candidate, args.output)
    print(json.dumps(dict(patches=len(report['patches']), bytes=sum(p['bytes'] for p in report['patches']),
                         published=False)))
