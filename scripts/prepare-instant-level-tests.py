#!/usr/bin/env python3
"""Attach the cheat arithmetic suite to an existing owned native game fixture."""
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--game-dir', type=Path, required=True)
args = parser.parse_args()
game = args.game_dir.resolve()
if not (game / 'game.toml').is_file() or not (game / 'kit/tools/test.py').is_file():
    parser.error('Requires an existing original game fixture with official tools')
source = game / 'source'
if not source.exists():
    source.symlink_to(ROOT, target_is_directory=True)
if source.resolve() != ROOT:
    parser.error('Preserve the existing source link; use a separate owned fixture')
cmake = game / 'tests/CMakeLists.txt'
cmake.parent.mkdir(exist_ok=True)
text = cmake.read_text() if cmake.exists() else ''
line = 'include(${RECOMP_GAME_DIR}/source/native/cheats/tests.cmake)\n'
if 'instant_hero_level_tests' in text and line not in text:
    parser.error('An existing test definition needs review; refusing to replace it')
if line not in text:
    cmake.write_text(text + '\n' + line)
print('Prepared instant_hero_level_tests; run the official tools/test.py suite')
