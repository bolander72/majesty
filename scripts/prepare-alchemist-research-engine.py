#!/usr/bin/env python3
"""Stage an isolated Old-engine build with verified research function entries."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct
import tomllib

PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
ENTRIES = (0x00474C10, 0x004ABF70)


def mapped_bytes(data, address, count):
    pe = struct.unpack_from('<I', data, 0x3C)[0]
    if data[pe:pe + 4] != b'PE\0\0':
        raise ValueError('Expected the original PE executable')
    sections, optional_bytes = struct.unpack_from('<H', data, pe + 6)[0], struct.unpack_from('<H', data, pe + 20)[0]
    optional = pe + 24
    base = struct.unpack_from('<I', data, optional + 28)[0]
    for n in range(sections):
        section = optional + optional_bytes + n * 40
        size, rva, raw_size, offset = struct.unpack_from('<IIII', data, section + 8)
        delta = address - base - rva
        if 0 <= delta and delta + count <= raw_size:
            return data[offset + delta:offset + delta + count]
    raise ValueError('Binding lies outside original section data')


def curate(text, exe):
    if hashlib.sha256(exe).hexdigest() != PIN:
        raise ValueError('Pinned DirectDraw executable differs')
    # The literal event2009 dispatch, including both adjacent event identities.
    expected = struct.pack('<III', 0x2009, 0x004ABF70, 0x200B)
    if mapped_bytes(exe, 0x006C2028, 12) != expected:
        raise ValueError('Original research completion dispatch differs')
    if mapped_bytes(exe, 0x00474C10, 3) != b'\x83\xec\x14':
        raise ValueError('Original AP99 affordability entry differs')
    if mapped_bytes(exe, 0x004ABF70, 6) != b'\x64\xa1\0\0\0\0':
        raise ValueError('Original research completion entry differs')
    config = tomllib.loads(text)
    if config['game']['sha256'] != PIN:
        raise ValueError('Game configuration names a different executable')
    existing = config['translate']['entry_points']
    match = re.search(r'^entry_points\s*=\s*\[([^\]]*)\]', text, re.M)
    if not match:
        raise ValueError('Expected one original entry_points declaration')
    values = list(dict.fromkeys([*existing, *ENTRIES]))
    replacement = 'entry_points = [' + ', '.join(f'0x{value:08x}' for value in values) + ']'
    result = text[:match.start()] + replacement + text[match.end():]
    parsed = tomllib.loads(result)
    # All existing patches, native overrides and gameplay configuration stay exact.
    parsed['translate']['entry_points'] = existing
    if parsed != config:
        raise ValueError('Curation altered configuration beyond verified entries')
    return result


def prepare(game, native_sources, output):
    if output.exists():
        raise ValueError('Preserve prior builds; choose a fresh output directory')
    config_text = (game / 'game.toml').read_text()
    config = tomllib.loads(config_text)
    exe = (game / config['game']['developer_exe']).resolve()
    curated = curate(config_text, exe.read_bytes())
    sources = config['translate']['native']['sources']
    inputs = {name: (native_sources / name).read_bytes() for name in sources}
    for path in native_sources.glob('*.h'):
        inputs[path.name] = path.read_bytes()
    output.mkdir(parents=True)
    (output / 'game.toml').write_text(curated)
    shutil.copyfile(game / 'globals.toml', output / 'globals.toml')
    for name in ('analysis', 'original', 'kit'):
        (output / name).symlink_to((game / name).resolve(), target_is_directory=True)
    for name, data in inputs.items():
        (output / name).write_bytes(data)
    receipt = dict(format='majesty-alchemist-research-engine-v1', gameView=str(output),
                   exeSha256=PIN, verifiedEntries=[f'{address:08x}' for address in ENTRIES],
                   completionDispatchSlot='006c202c', generatedFilesEdited=False,
                   nativeSources={name: hashlib.sha256(data).hexdigest() for name, data in inputs.items()},
                   compiled=False, nativeResearchQualified=False, browserQualified=False)
    (output / 'source-binding.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('game', 'native-sources', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    try:
        prepare(args.game, args.native_sources, args.out)
    except (OSError, ValueError) as error:
        parser.exit(1, f'Research engine preparation refused: {error}\n')
    print('Isolated engine staged; official regeneration/build and gameplay checks still required')
