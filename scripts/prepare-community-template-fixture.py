#!/usr/bin/env python3
"""Bind private translated presenters to an official isolated native fixture."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def add_owner_fixture(output):
    with (output / 'tests/CMakeLists.txt').open('a') as cmake:
        cmake.write('''
add_library(community_recruitment_runtime_compile OBJECT
  ${RECOMP_GAME_DIR}/source/native/community/recruitment_panel_runtime.cpp
  ${RECOMP_GAME_DIR}/source/native/community/community_panels.cpp)
target_include_directories(community_recruitment_runtime_compile PRIVATE
  ${RECOMP_GAME_DIR}/source/native/community
  ${RECOMP_GAME_DIR}/source/third_party/majesty-mod-manager/runtime
  ${POP_ROOT} ${POP_ROOT}/runtime)
target_compile_features(community_recruitment_runtime_compile PRIVATE cxx_std_17)
target_compile_definitions(community_recruitment_runtime_compile PRIVATE
  RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME=1 RECOMP_COMMUNITY_RECRUITMENT_OWNER=1
  GUEST_IMAGE_BASE=${RECOMP_IMAGE_BASE} GUEST_HEAP_BASE=${RECOMP_HEAP_BASE} GUEST_SIZE=${RECOMP_GUEST_SIZE})
target_compile_options(community_recruitment_runtime_compile PRIVATE ${POP_WARN_STRICT})
add_executable(community_recruitment_owner_tests
  ${RECOMP_GAME_DIR}/source/native/community/recruitment_panel_owner_tests.cpp
  ${RECOMP_GAME_DIR}/source/third_party/majesty-mod-manager/runtime/StockControllerRegistry.cpp)
target_include_directories(community_recruitment_owner_tests PRIVATE
  ${RECOMP_GAME_DIR}/source/native/community
  ${RECOMP_GAME_DIR}/source/third_party/majesty-mod-manager/runtime
  ${POP_ROOT} ${POP_ROOT}/runtime)
target_compile_features(community_recruitment_owner_tests PRIVATE cxx_std_17)
target_compile_definitions(community_recruitment_owner_tests PRIVATE
  GUEST_IMAGE_BASE=${RECOMP_IMAGE_BASE} GUEST_HEAP_BASE=${RECOMP_HEAP_BASE} GUEST_SIZE=${RECOMP_GUEST_SIZE})
target_compile_options(community_recruitment_owner_tests PRIVATE ${POP_WARN_STRICT})
pop_test_binary(community_recruitment_owner_tests)
add_dependencies(community_recruitment_owner_tests community_recruitment_runtime_compile)
add_test(NAME community_recruitment_owner_tests COMMAND community_recruitment_owner_tests
  ${RECOMP_GAME_DIR}/controllers.bin ${RECOMP_GAME_DIR}/ap52-table.bin)
set_tests_properties(community_recruitment_owner_tests PROPERTIES LABELS nogame TIMEOUT 15)
''')


def add_execution_fixture(output, generated):
    """Execute real translated bodies with explicit refusing service fixtures."""
    returns = set()
    for folder in generated.values():
        table = (folder / 'table.c').read_text()
        match = re.search(r'static const uint32_t \w+_call_returns\[\] = \{([^}]+)\}', table)
        if not match:
            raise ValueError('Expected original generated call-return metadata')
        returns.update(re.findall(r'0x([0-9a-f]+)u', match[1]))
    addresses = sorted(int(value, 16) for value in returns)
    header = output / 'tests/template_return_addresses.h'
    if header.exists():
        raise ValueError('Preserve existing execution fixture')
    header.write_text('#pragma once\n#include <array>\n#include <cstdint>\n'
        + f'constexpr std::array<std::uint32_t, {len(addresses)}> templateReturnAddresses = {{'
        + ','.join(f'0x{x:08x}' for x in addresses) + '};\n')
    with (output / 'tests/CMakeLists.txt').open('a') as cmake:
        cmake.write('''
add_executable(community_private_template_execution_tests
  ${RECOMP_GAME_DIR}/source/native/community/private_template_bank.cpp
  ${RECOMP_GAME_DIR}/source/native/community/private_template_execution_tests.cpp)
target_include_directories(community_private_template_execution_tests PRIVATE ${RECOMP_GAME_DIR}/source/native/community ${RECOMP_GAME_DIR}/tests ${POP_ROOT} ${POP_ROOT}/runtime)
target_compile_features(community_private_template_execution_tests PRIVATE cxx_std_17)
target_compile_definitions(community_private_template_execution_tests PRIVATE RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME=1 GUEST_IMAGE_BASE=${RECOMP_IMAGE_BASE} GUEST_HEAP_BASE=${RECOMP_HEAP_BASE} GUEST_SIZE=${RECOMP_GUEST_SIZE})
target_compile_options(community_private_template_execution_tests PRIVATE ${POP_WARN_STRICT})
pop_test_binary(community_private_template_execution_tests)
add_test(NAME community_private_template_execution_tests COMMAND community_private_template_execution_tests)
set_tests_properties(community_private_template_execution_tests PROPERTIES LABELS nogame TIMEOUT 15)
''')
        for name in generated:
            cmake.write(f'target_sources(community_private_template_execution_tests PRIVATE $<TARGET_OBJECTS:community_template_{name}>)\n')


def add_runtime_execution_fixture(output, generated):
    with (output / 'tests/CMakeLists.txt').open('a') as cmake:
        cmake.write('''
add_executable(community_recruitment_runtime_execution_tests
  ${RECOMP_GAME_DIR}/source/native/community/private_template_bank.cpp
  ${RECOMP_GAME_DIR}/source/native/community/recruitment_panel_runtime.cpp
  ${RECOMP_GAME_DIR}/source/native/community/private_template_execution_tests.cpp
  ${RECOMP_GAME_DIR}/source/third_party/majesty-mod-manager/runtime/StockControllerRegistry.cpp)
target_include_directories(community_recruitment_runtime_execution_tests PRIVATE
  ${RECOMP_GAME_DIR}/source/native/community ${RECOMP_GAME_DIR}/tests
  ${RECOMP_GAME_DIR}/source/third_party/majesty-mod-manager/runtime
  ${POP_ROOT} ${POP_ROOT}/runtime)
target_compile_features(community_recruitment_runtime_execution_tests PRIVATE cxx_std_17)
target_compile_definitions(community_recruitment_runtime_execution_tests PRIVATE
  RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME=1 RECOMP_TEST_RECRUITMENT_OWNER=1
  GUEST_IMAGE_BASE=${RECOMP_IMAGE_BASE} GUEST_HEAP_BASE=${RECOMP_HEAP_BASE} GUEST_SIZE=${RECOMP_GUEST_SIZE})
target_compile_options(community_recruitment_runtime_execution_tests PRIVATE ${POP_WARN_STRICT})
pop_test_binary(community_recruitment_runtime_execution_tests)
add_test(NAME community_recruitment_runtime_execution_tests
  COMMAND community_recruitment_runtime_execution_tests ${RECOMP_GAME_DIR}/controllers.bin)
set_tests_properties(community_recruitment_runtime_execution_tests PROPERTIES LABELS nogame TIMEOUT 15)
''')
        for name in generated:
            cmake.write(f'target_sources(community_recruitment_runtime_execution_tests PRIVATE $<TARGET_OBJECTS:community_template_{name}>)\n')


def prepare(args):
    stage_raw = (args.templates / 'template-stage.json').read_bytes()
    stage = json.loads(stage_raw)
    if (stage.get('format') != 'majesty-private-native-recruitment-templates-v1'
            or stage.get('globalDispatchRegistrationAllowed') is not False):
        raise ValueError('Require privately collected original templates')
    generated = {}
    for row in args.generated:
        name, separator, path = row.partition('=')
        if not separator or name not in stage['modules'] or name in generated:
            raise ValueError('Unexpected or repeated translated module')
        generated[name] = Path(path).resolve()
    if generated.keys() != stage['modules'].keys():
        raise ValueError('Require all four private modules')
    cmake, bindings = [], {}
    for name, folder in generated.items():
        meta = stage['modules'][name]
        guard = json.loads((folder / 'guard.json').read_text())
        report = json.loads((folder / 'translation.json').read_text())
        config = Path(guard['sourceGameConfig'])
        if (guard.get('terminal') is not True or guard.get('exitCode') != 0 or guard.get('stopReason')
                or hashlib.sha256(config.read_bytes()).hexdigest() != meta['gameConfigSha256']
                or report['functions_ok'] != len(meta['entries'])):
            raise ValueError('Private translation is stopped, incomplete or source binding differs')
        command = guard['command']
        if command[command.index('--as-module') + 1] != meta['moduleName']:
            raise ValueError('Private translated module name differs')
        raw_table = (folder / 'table.c').read_text()
        pattern = (r'const uint32_t recomp_' + re.escape(meta['moduleName'])
                   + r'_func_addrs\[\] = \{([^}]+)\}')
        match = re.search(pattern, raw_table)
        if not match:
            raise ValueError('Expected original generated address table')
        addresses = re.findall(r'0x([0-9a-f]{8})u', match[1])
        if not 2 <= len(addresses) <= 16 or not set(meta['entries']) <= set(addresses):
            raise ValueError('Private exported function set differs')
        sources = sorted(folder.glob('chunk_*.c')) + [folder / 'table.c']
        if len(sources) != 2 or any(p.is_symlink() for p in sources):
            raise ValueError('Require bounded original generated module files')
        definitions = ['recomp_module_register=majesty_collect_private_template'] + [
            f'fn_{address}=majesty_template_{name}_fn_{address}' for address in addresses]
        target = 'community_template_' + name
        cmake.append(f'add_library({target} OBJECT ' + ' '.join(str(p) for p in sources) + ')\n'
            f'target_include_directories({target} PRIVATE {folder} ${{POP_ROOT}}/runtime ${{CMAKE_BINARY_DIR}}/generated)\n'
            f'target_compile_definitions({target} PRIVATE ' + ' '.join(definitions)
            + ' GUEST_IMAGE_BASE=${RECOMP_IMAGE_BASE} GUEST_HEAP_BASE=${RECOMP_HEAP_BASE} GUEST_SIZE=${RECOMP_GUEST_SIZE})\n'
            f'set_target_properties({target} PROPERTIES POSITION_INDEPENDENT_CODE ON)\n')
        bindings[name] = dict(exports=addresses, compileDefinitions=definitions,
            generatedFilesSha256={p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sources})
    helper_path = ROOT / 'scripts/prepare-community-controller-fixture.py'
    spec = importlib.util.spec_from_file_location('community_controller_fixture', helper_path)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    helper.prepare(args.game, args.controllers, args.out)
    cmake.append('''
pop_add_plugin(community_private_templates SOURCE ${RECOMP_GAME_DIR}/source/native/community/private_template_bank.cpp OUTPUT_DIR ${POP_OUT}/private-plugins OUTPUT_NAME community_private_templates)
target_include_directories(community_private_templates PRIVATE ${RECOMP_GAME_DIR}/source/native/community ${POP_ROOT} ${POP_ROOT}/runtime)
target_compile_features(community_private_templates PRIVATE cxx_std_17)
target_compile_definitions(community_private_templates PRIVATE GUEST_IMAGE_BASE=${RECOMP_IMAGE_BASE} GUEST_HEAP_BASE=${RECOMP_HEAP_BASE} GUEST_SIZE=${RECOMP_GUEST_SIZE})
''')
    for name in generated:
        cmake.append(f'target_sources(community_private_templates PRIVATE $<TARGET_OBJECTS:community_template_{name}>)\n')
    cmake.append('''
add_executable(community_private_template_tests
  ${RECOMP_GAME_DIR}/source/native/community/private_template_bank.cpp
  ${RECOMP_GAME_DIR}/source/native/community/private_template_bank_tests.cpp)
target_include_directories(community_private_template_tests PRIVATE ${RECOMP_GAME_DIR}/source/native/community ${POP_ROOT} ${POP_ROOT}/runtime)
target_compile_features(community_private_template_tests PRIVATE cxx_std_17)
target_compile_definitions(community_private_template_tests PRIVATE RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME=1 GUEST_IMAGE_BASE=${RECOMP_IMAGE_BASE} GUEST_HEAP_BASE=${RECOMP_HEAP_BASE} GUEST_SIZE=${RECOMP_GUEST_SIZE})
target_compile_options(community_private_template_tests PRIVATE ${POP_WARN_STRICT})
pop_test_binary(community_private_template_tests)
add_dependencies(community_private_template_tests community_private_templates)
add_test(NAME community_private_template_tests COMMAND community_private_template_tests)
set_tests_properties(community_private_template_tests PROPERTIES LABELS nogame TIMEOUT 15)
''')
    with (args.out / 'tests/CMakeLists.txt').open('a') as target:
        target.write('\n'.join(cmake))
    add_execution_fixture(args.out, generated)
    add_runtime_execution_fixture(args.out, generated)
    add_owner_fixture(args.out)
    receipt = dict(format='majesty-private-presenter-native-fixture-v1',
        templateStageSha256=hashlib.sha256(stage_raw).hexdigest(), modules=bindings,
        generatedSourcesEdited=False, templateConstructorsMustUsePrivateCollector=True,
        templateRawSymbolsMustBePrivate=True, liveBridgesDisabledInUnloadableBundle=True,
        nativeTestTarget='community_private_template_tests', gameLaunched=False,
        nativeGameplayQualified=False, browserPlayable=False, published=False)
    (args.out / 'private-template-fixture.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('game', 'controllers', 'templates', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--generated', action='append', required=True)
    prepare(parser.parse_args())
    print('Private original presenters bound to the official native fixture')
