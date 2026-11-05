#!/usr/bin/env python3
"""Declare original map selection and sight callback entries for Alchemist compatibility."""
import argparse
import hashlib
import importlib.util
from pathlib import Path
import re
import tomllib

_spec = importlib.util.spec_from_file_location('research_engine', Path(__file__).with_name('prepare-alchemist-research-engine.py'))
_research = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_research)
ENTRIES = (0x0043DFC0, 0x0043E250, 0x005B6670, 0x0042EE50)
BINDINGS = {
    # Original Select mode registration passes these hover/click callbacks.
    0x0043DFC0: bytes.fromhex('83ec1453555633f65789'),
    0x0043E250: bytes.fromhex('83ec2853558b6c243456'),
    # Original character predicate: family==1, RET0.
    0x005B6670: bytes.fromhex('8b515c33c083fa010f94c0c3'),
    # Original click predicate rejects every second-byte L actor, including ALC1.
    0x0043E400: bytes.fromhex('81fe004c0000'),
    # Native sight-circle callback: descriptor second byte must be V or B.
    0x0042EE50: bytes.fromhex('83ec3c53568b74244857'),
    0x0042EE7C: bytes.fromhex('8b480481e100ff000081f900560000'),
}

def curate(text, exe):
    if hashlib.sha256(exe).hexdigest() != _research.PIN:
        raise ValueError('Pinned DirectDraw executable differs')
    for address, expected in BINDINGS.items():
        if _research.mapped_bytes(exe, address, len(expected)) != expected:
            raise ValueError(f'Original selection binding differs at {address:08x}')
    before = tomllib.loads(text)
    if before['game']['sha256'] != _research.PIN:
        raise ValueError('Game configuration names a different executable')
    existing = before['translate']['entry_points']
    match = re.search(r'^entry_points\s*=\s*\[([^\]]*)\]', text, re.M)
    if not match:
        raise ValueError('Expected original entry_points declaration')
    values = list(dict.fromkeys([*existing, *ENTRIES]))
    result = text[:match.start()] + 'entry_points = [' + ', '.join(f'0x{x:08x}' for x in values) + ']' + text[match.end():]
    after = tomllib.loads(result)
    after['translate']['entry_points'] = existing
    if after != before:
        raise ValueError('Selection curation changed unrelated configuration')
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game', type=Path, required=True)
    args = parser.parse_args()
    path = args.game / 'game.toml'
    text = path.read_text()
    config = tomllib.loads(text)
    path.write_text(curate(text, (args.game / config['game']['developer_exe']).read_bytes()))
    print('Pinned selection entries declared; official regeneration/build required')
