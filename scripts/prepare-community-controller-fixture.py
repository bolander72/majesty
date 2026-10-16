#!/usr/bin/env python3
"""Stage an official native test of real MMCRv21 and the pinned Old AP52 table.

Uses pefile from the kit's development environment. Never builds, launches,
installs a mod, or opens player profiles; execute the recorded official test
command separately under the normal resource guard.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct
import tomllib

import pefile

ROOT = Path(__file__).resolve().parents[1]
EXE_SHA256 = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
TABLE_SHA256 = '116ab671abc4e384150bb2c6c007af7227bb33176e071a938d714236830bed29'


def prepare(game, controllers, output):
    if output.exists() or output.is_symlink():
        raise ValueError('Preserve existing fixture; choose a fresh output')
    config = tomllib.loads((game / 'game.toml').read_text())
    exe = game / config['game']['developer_exe']
    raw = exe.read_bytes()
    if (config['game']['sha256'] != EXE_SHA256
            or hashlib.sha256(raw).hexdigest() != EXE_SHA256):
        raise ValueError('Require the pinned DirectDraw executable')
    pe = pefile.PE(data=raw, fast_load=True)
    table = pe.get_data(0x00682050 - pe.OPTIONAL_HEADER.ImageBase, 68)
    if hashlib.sha256(table).hexdigest() != TABLE_SHA256:
        raise ValueError('Native AP52 table differs')
    registry = controllers.read_bytes()
    if registry[:8] != b'MMCR\x15\0\0\0' or not 60 <= len(registry) <= 512 * 1024:
        raise ValueError('Require bounded actual MMCRv21')
    output.mkdir(parents=True)
    for name in ('game.toml', 'globals.toml'):
        shutil.copyfile(game / name, output / name)
    for name in ('kit', 'original', 'analysis', 'tools'):
        (output / name).symlink_to((game / name).resolve(), target_is_directory=True)
    dependencies = config.get('native', {}).get('sources', []) + [
        config.get('native', {}).get('header', ''), config.get('translate', {}).get('overrides', '')]
    for name in dependencies:
        if name and (game / name).is_file():
            (output / name).symlink_to((game / name).resolve())
    (output / 'source').symlink_to(ROOT, target_is_directory=True)
    (output / 'controllers.bin').write_bytes(registry)
    (output / 'ap52-table.bin').write_bytes(table)
    (output / 'tests').mkdir()
    (output / 'tests/CMakeLists.txt').write_text('''add_executable(community_recruitment_tests
  ${RECOMP_GAME_DIR}/source/native/community/recruitment_commands_tests.cpp
  ${RECOMP_GAME_DIR}/source/third_party/majesty-mod-manager/runtime/StockControllerRegistry.cpp)
target_include_directories(community_recruitment_tests PRIVATE
  ${RECOMP_GAME_DIR}/source/native/community
  ${RECOMP_GAME_DIR}/source/third_party/majesty-mod-manager/runtime)
target_compile_features(community_recruitment_tests PRIVATE cxx_std_17)
target_compile_options(community_recruitment_tests PRIVATE ${POP_WARN_STRICT})
pop_optimize(community_recruitment_tests 1)
pop_test_binary(community_recruitment_tests)
add_test(NAME community_recruitment_tests COMMAND community_recruitment_tests
  ${RECOMP_GAME_DIR}/controllers.bin ${RECOMP_GAME_DIR}/ap52-table.bin)
set_tests_properties(community_recruitment_tests PROPERTIES LABELS nogame TIMEOUT 15)
''')
    report = dict(format='majesty-community-recruitment-native-fixture-v1',
        executableSha256=EXE_SHA256, vtableAddress='00682050',
        vtableSha256=TABLE_SHA256, vtableEntries=[f'{x:08x}' for x in struct.unpack('<17I', table)],
        registrySha256=hashlib.sha256(registry).hexdigest(), gameLaunched=False,
        originalFilesUnchanged=True, runtimeHooksEnabled=False, browserPlayable=False,
        command=['tools/test.py', '--game-dir', str(output), '--native-test',
                 'community_recruitment_tests', '--jobs', '1'])
    (output / 'fixture.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('game', 'controllers', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    prepare(args.game, args.controllers, args.out)
    print('Private native recruitment fixture staged; no engine launched')
