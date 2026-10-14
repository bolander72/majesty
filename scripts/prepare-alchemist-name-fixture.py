#!/usr/bin/env python3
"""Prepare a focused official native fixture without changing game/kit sources or launching it."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tomllib

ROOT = Path(__file__).resolve().parents[1]


def prepare(game, registry, output):
    if output.exists():
        raise ValueError('Preserve existing native fixture; choose a new directory')
    contract = json.loads((ROOT / 'content/community-mods/alchemist/source-contract.json').read_text())
    third_party = ROOT / 'third_party/majesty-mod-manager'
    for relative, expected in contract['managerNativeModuleSha256'].items():
        path = third_party / relative
        if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError('Pinned original native registry parser differs')
    raw = registry.read_bytes()
    if raw[:8] != b'MMFR\x01\0\0\0':
        raise ValueError('Actual MMFRv1 fixture required')
    output.mkdir(parents=True)
    for name in ('game.toml', 'globals.toml'):
        shutil.copyfile(game / name, output / name)
    for name in ('kit', 'original', 'analysis', 'tools'):
        (output / name).symlink_to(game / name, target_is_directory=True)
    config = tomllib.loads((game / 'game.toml').read_text())
    dependencies = config.get('native', {}).get('sources', []) + [
        config.get('native', {}).get('header', ''), config.get('translate', {}).get('overrides', '')]
    for name in dependencies:
        if name and (game / name).is_file():
            (output / name).symlink_to(game / name)
    (output / 'source').symlink_to(ROOT, target_is_directory=True)
    (output / 'features.bin').write_bytes(raw)
    (output / 'tests').mkdir()
    cmake = '''add_executable(community_name_registration_tests
  ${RECOMP_GAME_DIR}/source/native/community/name_registration_tests.cpp
  ${RECOMP_GAME_DIR}/source/third_party/majesty-mod-manager/runtime/RuntimeFeatureRegistry.cpp)
target_include_directories(community_name_registration_tests PRIVATE
  ${RECOMP_GAME_DIR}/source/native/community
  ${RECOMP_GAME_DIR}/source/third_party/majesty-mod-manager/runtime)
target_compile_features(community_name_registration_tests PRIVATE cxx_std_17)
target_compile_options(community_name_registration_tests PRIVATE ${POP_WARN_STRICT})
pop_optimize(community_name_registration_tests 1)
pop_test_binary(community_name_registration_tests)
add_library(community_names_adapter_compile OBJECT
  ${RECOMP_GAME_DIR}/source/native/community/community_names.cpp)
target_include_directories(community_names_adapter_compile PRIVATE
  ${RECOMP_GAME_DIR}/source/native/community
  ${RECOMP_GAME_DIR}/source/third_party/majesty-mod-manager/runtime
  ${POP_ROOT} ${POP_ROOT}/runtime)
target_compile_features(community_names_adapter_compile PRIVATE cxx_std_17)
target_compile_options(community_names_adapter_compile PRIVATE ${POP_WARN_HOST})
add_dependencies(community_name_registration_tests community_names_adapter_compile)
add_test(NAME community_name_registration_tests
  COMMAND community_name_registration_tests ${RECOMP_GAME_DIR}/features.bin)
set_tests_properties(community_name_registration_tests PROPERTIES LABELS nogame TIMEOUT 15)
'''
    (output / 'tests/CMakeLists.txt').write_text(cmake)
    report = dict(format='majesty-community-name-fixture-v1', gameView=str(output),
                  originalToolsUnchanged=True, intensiveGameBuild=False, gameLaunched=False,
                  originalParserVerified=True, registrySha256=hashlib.sha256(raw).hexdigest(),
                  nativeRuntimeQualified=False, browserPlayable=False,
                  command=['tools/test.py', '--game-dir', str(output), '--native-test',
                           'community_name_registration_tests', '--jobs', '1'])
    (output / 'fixture.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('game', 'registry', 'out'):
        parser.add_argument('--' + name, required=True, type=Path)
    args = parser.parse_args()
    try:
        prepare(args.game, args.registry, args.out)
    except (OSError, ValueError) as error:
        parser.exit(1, f'Name fixture preparation refused: {error}\n')
    print('Focused official native fixture prepared; not built or launched')
