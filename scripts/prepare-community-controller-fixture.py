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


def add_gpl_fixture(output):
    with (output / 'tests/CMakeLists.txt').open('a') as cmake:
        cmake.write('''
pop_add_plugin(community_gpl_probe SOURCE
  ${RECOMP_GAME_DIR}/source/native/community/native_probe_plugin.cpp
  OUTPUT_DIR ${POP_OUT}/private-plugins OUTPUT_NAME community_gpl_probe WARNINGS ${POP_WARN_HOST})
target_sources(community_gpl_probe PRIVATE
  ${RECOMP_GAME_DIR}/source/third_party/majesty-mod-manager/runtime/RuntimeFeatureRegistry.cpp
  ${RECOMP_GAME_DIR}/source/third_party/majesty-mod-manager/runtime/StockControllerRegistry.cpp)
target_include_directories(community_gpl_probe PRIVATE
  ${RECOMP_GAME_DIR}/source/native/community
  ${RECOMP_GAME_DIR}/source/third_party/majesty-mod-manager/runtime)
add_executable(community_gpl_attribute_tests
  ${RECOMP_GAME_DIR}/source/native/community/gpl_attribute_bridge_tests.cpp)
target_include_directories(community_gpl_attribute_tests PRIVATE ${RECOMP_GAME_DIR}/source/native/community)
target_compile_features(community_gpl_attribute_tests PRIVATE cxx_std_17)
target_compile_options(community_gpl_attribute_tests PRIVATE ${POP_WARN_STRICT})
pop_test_binary(community_gpl_attribute_tests)
add_dependencies(community_gpl_attribute_tests community_gpl_probe)
add_test(NAME community_gpl_attribute_tests COMMAND community_gpl_attribute_tests)
set_tests_properties(community_gpl_attribute_tests PROPERTIES LABELS nogame TIMEOUT 15)
''')
    add_equipment_fixture(output)
    add_integer_fixture(output)
    add_research_query_fixture(output)
    add_kingdom_descriptor_fixture(output)


def add_equipment_fixture(output):
    with (output / 'tests/CMakeLists.txt').open('a') as cmake:
        cmake.write('''
add_executable(community_equipment_tests
  ${RECOMP_GAME_DIR}/source/native/community/equipment_registration_tests.cpp)
target_include_directories(community_equipment_tests PRIVATE ${RECOMP_GAME_DIR}/source/native/community)
target_compile_features(community_equipment_tests PRIVATE cxx_std_17)
target_compile_options(community_equipment_tests PRIVATE ${POP_WARN_STRICT})
pop_test_binary(community_equipment_tests)
add_dependencies(community_equipment_tests community_gpl_probe)
add_test(NAME community_equipment_tests COMMAND community_equipment_tests)
set_tests_properties(community_equipment_tests PROPERTIES LABELS nogame TIMEOUT 15)
''')


def add_integer_fixture(output):
    with (output / 'tests/CMakeLists.txt').open('a') as cmake:
        cmake.write('''
add_executable(community_integer_helpers_tests
  ${RECOMP_GAME_DIR}/source/native/community/gpl_integer_helpers_tests.cpp)
target_include_directories(community_integer_helpers_tests PRIVATE
  ${RECOMP_GAME_DIR}/source/native/community
  ${RECOMP_GAME_DIR}/source/third_party/majesty-mod-manager/runtime)
target_compile_features(community_integer_helpers_tests PRIVATE cxx_std_17)
target_compile_options(community_integer_helpers_tests PRIVATE ${POP_WARN_STRICT})
pop_test_binary(community_integer_helpers_tests)
add_dependencies(community_integer_helpers_tests community_gpl_probe)
add_test(NAME community_integer_helpers_tests COMMAND community_integer_helpers_tests)
set_tests_properties(community_integer_helpers_tests PROPERTIES LABELS nogame TIMEOUT 15)
''')


def add_research_query_fixture(output):
    with (output / 'tests/CMakeLists.txt').open('a') as cmake:
        cmake.write('''
add_executable(community_research_query_tests
  ${RECOMP_GAME_DIR}/source/native/community/gpl_research_helpers_tests.cpp)
target_include_directories(community_research_query_tests PRIVATE
  ${RECOMP_GAME_DIR}/source/native/community
  ${RECOMP_GAME_DIR}/source/third_party/majesty-mod-manager/runtime)
target_compile_features(community_research_query_tests PRIVATE cxx_std_17)
target_compile_options(community_research_query_tests PRIVATE ${POP_WARN_STRICT})
pop_test_binary(community_research_query_tests)
add_dependencies(community_research_query_tests community_gpl_probe)
add_test(NAME community_research_query_tests COMMAND community_research_query_tests)
set_tests_properties(community_research_query_tests PROPERTIES LABELS nogame TIMEOUT 15)
''')


def add_kingdom_descriptor_fixture(output):
    with (output / 'tests/CMakeLists.txt').open('a') as cmake:
        cmake.write('''
add_executable(community_kingdom_research_descriptors_tests
  ${RECOMP_GAME_DIR}/source/native/community/kingdom_research_descriptors_tests.cpp)
target_include_directories(community_kingdom_research_descriptors_tests PRIVATE
  ${RECOMP_GAME_DIR}/source/native/community
  ${RECOMP_GAME_DIR}/source/third_party/majesty-mod-manager/runtime)
target_compile_features(community_kingdom_research_descriptors_tests PRIVATE cxx_std_17)
target_compile_options(community_kingdom_research_descriptors_tests PRIVATE ${POP_WARN_STRICT})
pop_test_binary(community_kingdom_research_descriptors_tests)
add_dependencies(community_kingdom_research_descriptors_tests community_gpl_probe)
add_test(NAME community_kingdom_research_descriptors_tests COMMAND community_kingdom_research_descriptors_tests)
set_tests_properties(community_kingdom_research_descriptors_tests PROPERTIES LABELS nogame TIMEOUT 15)
''')


def prepare(game, controllers, output, shared_source=None, legacy_routes=None):
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
    shared_files = {}
    if bool(shared_source) != bool(legacy_routes):
        raise ValueError('Shared-source and legacy route fixtures must be supplied together')
    if shared_source:
        source_proof = json.loads((shared_source / 'source-stage.json').read_text())
        if not source_proof.get('stockCollisionAliasesOnly'):
            raise ValueError('Require source-bound scoped legacy exports')
        for scope in ('Majesty', 'MajestyExpansion'):
            value = (shared_source / 'routes' / scope / 'shared-overrides.tsv').read_bytes()
            if source_proof['legacyRoutes'][scope] != dict(
                    bytes=len(value), sha256=hashlib.sha256(value).hexdigest()):
                raise ValueError('Scoped route source binding differs')
            shared_files[scope + '-routes.tsv'] = value
        shared_files['Alchemist-routes.tsv'] = legacy_routes.read_bytes()
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
    for name, value in shared_files.items():
        (output / name).write_bytes(value)
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
    if shared_files:
        with (output / 'tests/CMakeLists.txt').open('a') as cmake:
            cmake.write('''
add_executable(community_shared_routes_tests
  ${RECOMP_GAME_DIR}/source/native/community/shared_function_routes_tests.cpp)
target_include_directories(community_shared_routes_tests PRIVATE
  ${RECOMP_GAME_DIR}/source/native/community)
target_compile_features(community_shared_routes_tests PRIVATE cxx_std_17)
target_compile_options(community_shared_routes_tests PRIVATE ${POP_WARN_STRICT})
pop_optimize(community_shared_routes_tests 1)
pop_test_binary(community_shared_routes_tests)
add_test(NAME community_shared_routes_tests COMMAND community_shared_routes_tests
  ${RECOMP_GAME_DIR}/Majesty-routes.tsv ${RECOMP_GAME_DIR}/MajestyExpansion-routes.tsv
  ${RECOMP_GAME_DIR}/Alchemist-routes.tsv)
set_tests_properties(community_shared_routes_tests PROPERTIES LABELS nogame TIMEOUT 15)
''')
    report = dict(format='majesty-community-recruitment-native-fixture-v1',
        executableSha256=EXE_SHA256, vtableAddress='00682050',
        vtableSha256=TABLE_SHA256, vtableEntries=[f'{x:08x}' for x in struct.unpack('<17I', table)],
        registrySha256=hashlib.sha256(registry).hexdigest(), gameLaunched=False,
        sharedRouteHashes={k: hashlib.sha256(v).hexdigest() for k, v in shared_files.items()},
        originalFilesUnchanged=True, runtimeHooksEnabled=False, browserPlayable=False,
        command=['tools/test.py', '--game-dir', str(output), '--native-test',
                 'community_recruitment_tests', '--jobs', '1'])
    add_gpl_fixture(output)
    (output / 'fixture.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('game', 'controllers', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--shared-source', type=Path)
    parser.add_argument('--legacy-routes', type=Path)
    args = parser.parse_args()
    prepare(args.game, args.controllers, args.out, args.shared_source, args.legacy_routes)
    print('Private native recruitment fixture staged; no engine launched')
