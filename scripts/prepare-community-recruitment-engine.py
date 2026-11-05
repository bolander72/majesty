#!/usr/bin/env python3
"""Declare verified Old recruitment entries in an owned private engine view.

Follow with the official translator/build tools. This changes no original
executable, generated source, gameplay, profile or resource collection.
"""
import argparse
import hashlib
import importlib.util
from pathlib import Path
import re
import tomllib

spec = importlib.util.spec_from_file_location('original_recruitment_image',
    Path(__file__).with_name('prepare-alchemist-research-engine.py'))
original = importlib.util.module_from_spec(spec)
spec.loader.exec_module(original)
ENTRIES = {
    0x00465510: '64a1000000006aff',  # generic one-choice presenter
    0x00465AC0: '518b44240c53558b',  # generic tooltip, RET12
    0x0047E680: '83ec105355568bf1',  # AP52 counts
    0x0047E8F0: '53555657e8c73500',  # stock extra-choice availability
    0x0047E9C0: '6aff6840c9660064',  # stock multi-choice presenter
    0x0047F270: '8b44240853558b6c',  # AP52 tooltip, RET12
    0x0047F3E0: '83ec085356578bf9',  # AP52 native command/index dispatch, RET4
    0x0047F530: '56578b7c24148bf1',  # AP52 native notification, RET16
}


def curate(text, executable):
    if hashlib.sha256(executable).hexdigest() != original.PIN:
        raise ValueError('Require the pinned original DirectDraw executable')
    table = original.mapped_bytes(executable, 0x00682050, 68)
    if hashlib.sha256(table).hexdigest() != '116ab671abc4e384150bb2c6c007af7227bb33176e071a938d714236830bed29':
        raise ValueError('Original AP52 vtable differs')
    for address, prefix in ENTRIES.items():
        expected = bytes.fromhex(prefix)
        if original.mapped_bytes(executable, address, len(expected)) != expected:
            raise ValueError('Original recruitment entry differs')
    config = tomllib.loads(text)
    if config['game']['sha256'] != original.PIN:
        raise ValueError('Private configuration names another executable')
    previous = config['translate']['entry_points']
    values = list(dict.fromkeys([*previous, *ENTRIES]))
    match = re.search(r'^entry_points\s*=\s*\[([^\]]*)\]', text, re.M)
    if not match:
        raise ValueError('Require one original entry_points declaration')
    result = text[:match.start()] + 'entry_points = [' + ', '.join(
        f'0x{x:08x}' for x in values) + ']' + text[match.end():]
    check = tomllib.loads(result)
    check['translate']['entry_points'] = previous
    if check != config:
        raise ValueError('Recruitment curation changed unrelated configuration')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game', type=Path, required=True)
    args = parser.parse_args()
    path = args.game / 'game.toml'
    text = path.read_text()
    config = tomllib.loads(text)
    path.write_text(curate(text, (args.game / config['game']['developer_exe']).read_bytes()))
    print('Verified recruitment entries declared; official translation/build still required')
