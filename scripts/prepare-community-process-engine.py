#!/usr/bin/env python3
"""Link a private process-lived guild core with qualified original native objects."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct
import sys
import tomllib

ROOT = Path(__file__).resolve().parents[1]
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def digest_file(path):
    if not path.is_file() or getattr(path.stat(), 'st_flags', 0) & 0x40000000:
        raise ValueError('Require a resident input: ' + str(path))
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return dict(bytes=path.stat().st_size, sha256=h.hexdigest())


def quoted(value):
    value = str(value)
    if any(c in value for c in ['"', '\n', '\r', ';', '$']):
        raise ValueError('Unsupported CMake input path')
    return '"' + value + '"'


def prepare(args):
    if args.out.exists() or args.out.is_symlink():
        raise ValueError('Preserve earlier engines; choose a fresh output')
    producer = json.loads(args.producer.read_text())
    exe = args.game / 'build/recomp/pop_smoke'
    if not producer.get('nativeBuildQualified') or digest_file(exe)['sha256'] != producer['nativeExecutableSha256']:
        raise ValueError('Original native host producer is not qualified')
    source_raw = (args.source / 'source-stage.json').read_bytes()
    source = json.loads(source_raw)
    research_stage = json.loads((args.research / 'research-binding-stage.json').read_text())
    source_digest = dict(bytes=len(source_raw), sha256=hashlib.sha256(source_raw).hexdigest())
    if (research_stage['sourceStage'] != source_digest or
            digest_file(args.controllers) != source['resourceFiles']['controllers.bin']):
        raise ValueError('Source and research/controller bindings differ')
    if (digest_file(args.research / 'research-features.bin') != research_stage['featureRegistry'] or
            digest_file(args.research / 'research-bindings.bin') != research_stage['bindings'] or
            research_stage['featureRegistry'] != source['resourceFiles']['features.bin']):
        raise ValueError('Original research helper files changed')
    tables = json.loads((args.tables / 'native-tables-stage.json').read_text())
    names = args.tables / 'community-name-bindings.bin'
    if (tables['sourceStage'] != source_digest or
            digest_file(names) != tables['files']['community-name-bindings.bin']):
        raise ValueError('Native name bindings differ from source-bound collection')
    collection = json.loads((args.collection / 'candidate.json').read_text())
    if (collection['sourceStage'] != source_digest or collection['tablesStage'] != digest_file(
            args.tables / 'native-tables-stage.json')):
        raise ValueError('Process core and native collection differ')
    if not isinstance(collection.get('files'), dict) or not collection['files']:
        raise ValueError('Require a bound final private collection')
    for name, expected in collection['files'].items():
        path = Path(name)
        if path.is_absolute() or '..' in path.parts or '\\' in name:
            raise ValueError('Unsafe private collection path')
        if digest_file(args.collection / 'game' / path) != expected:
            raise ValueError('Private collection game file changed: ' + name)
    routes = args.collection / 'runtime/shared-overrides.tsv'
    if digest_file(routes) != collection['runtimeFiles']['shared-overrides.tsv']:
        raise ValueError('Final edition route bindings changed')
    config_raw = (args.game / 'game.toml').read_bytes()
    config = tomllib.loads(config_raw.decode())
    if config['game']['sha256'] != PIN or digest_file(args.game / config['game']['developer_exe'])['sha256'] != PIN:
        raise ValueError('Require the pinned original executable')
    ninja = (args.build / 'build.ninja').read_text()
    marker = 'build ' + str(exe) + ': CXX_EXECUTABLE_LINKER__pop_smoke_Release '
    start = ninja.index(marker)
    block = ninja[start:ninja.index('\n\n', start)]
    inputs = block.splitlines()[0][len(marker):].split(' | ', 1)[0].split()
    if not inputs or any(not p.endswith('.o') or '$' in p for p in inputs):
        raise ValueError('Unsupported original native link-object rule')
    objects = [(args.build / p).resolve() for p in inputs]
    link = re.search(r'^  LINK_LIBRARIES = (.+)$', block, re.M).group(1).split()
    libraries, frameworks, weak = [], [], []
    i = 0
    while i < len(link):
        token = link[i]
        if token == '-framework':
            frameworks.append(link[i + 1]); i += 2
        elif token == '-Xlinker' and link[i + 1] == '-force_load' and link[i + 2] == '-Xlinker':
            i += 3 # The following archive is admitted and force-loaded below.
        elif token == '-Xlinker' and link[i + 1] == '-weak_framework' and link[i + 2] == '-Xlinker':
            weak.append(link[i + 3]); i += 4
        elif token.endswith('.a'):
            libraries.append((args.build / token).resolve()); i += 1
        elif token in ['-lm', '-lpthread']:
            i += 1
        else:
            raise ValueError('Unreviewed native link input: ' + token)
    original = args.build / 'lib/librecomp_gen.a'
    if original.resolve() not in libraries:
        raise ValueError('Original translated archive missing')
    source_inputs = {str(p): digest_file(p) for p in dict.fromkeys([*objects, *libraries])}
    symbols = args.game / 'build/recomp/symbols.json'
    source_inputs[str(symbols)] = digest_file(symbols)
    fixture = json.loads((args.fixture / 'private-template-fixture.json').read_text())
    generated = {}
    for item in args.generated:
        name, sep, folder = item.partition('=')
        if not sep or name in generated or name not in fixture['modules']:
            raise ValueError('Unexpected private template module')
        generated[name] = Path(folder).resolve()
    if generated.keys() != fixture['modules'].keys():
        raise ValueError('Require all four original private modules')
    movement = None
    if bool(args.movement) != bool(args.movement_proof):
        raise ValueError('Require both movement generation and its producer proof')
    if args.movement:
        movement = json.loads(args.movement_proof.read_text())
        if (movement.get('format') != 'majesty-private-movement-generation-v1' or
                movement.get('exitCode') != 0 or movement.get('stopReason') or
                movement.get('sourceStage') != source_digest or
                movement.get('featureRegistry') != research_stage['featureRegistry'] or
                movement.get('entries') != ['005b7490'] or
                movement.get('frameLoanOffset') != 0x18 or
                movement.get('compileDefinitions') != [
                    'recomp_module_register=majesty_collect_private_movement',
                    'fn_005b7490=majesty_template_movement_fn_005b7490'] or
                set(movement.get('generatedFiles', {})) != {'chunk_000.c', 'table.c', 'funcs.h'}):
            raise ValueError('Movement template and community source binding differ')
        for name, expected in movement['generatedFiles'].items():
            if digest_file(args.movement / name) != expected:
                raise ValueError('Private movement translation changed: ' + name)
    hero_ui = None
    if any([args.hero_ui, args.hero_ui_proof, args.hero_ui_bindings]):
        if not all([args.hero_ui, args.hero_ui_proof, args.hero_ui_bindings]):
            raise ValueError('Require the complete hero UI generation and subject binding')
        hero_ui = json.loads(args.hero_ui_proof.read_text())
        if (hero_ui.get('format') != 'majesty-private-hero-ui-generation-v1' or
                hero_ui.get('exitCode') != 0 or hero_ui.get('stopReason') or
                hero_ui.get('sourceStage') != source_digest or
                hero_ui.get('featureRegistry') != research_stage['featureRegistry'] or
                hero_ui.get('entries') != ['00470c00', '00471030'] or
                hero_ui.get('compileDefinitions') != [
                    'recomp_module_register=majesty_collect_private_hero_ui',
                    'fn_00470c00=majesty_template_hero_ui_fn_00470c00',
                    'fn_00471030=majesty_template_hero_ui_fn_00471030'] or
                hero_ui.get('subjectBindings') != digest_file(args.hero_ui_bindings) or
                set(hero_ui.get('generatedFiles', {})) != {'chunk_000.c', 'table.c', 'funcs.h'}):
            raise ValueError('Private hero UI/source/subject binding differs')
        for name, expected in hero_ui['generatedFiles'].items():
            if digest_file(args.hero_ui / name) != expected:
                raise ValueError('Private hero UI translation changed: ' + name)
    hero_ui_compat = None
    if args.hero_ui_compat:
        hero_ui_compat = json.loads((args.hero_ui_compat / 'phantom-ui-stage.json').read_text())
        if (not hero_ui or hero_ui_compat.get('format') != 'majesty-phantom-ui-compat-v1' or
                hero_ui_compat.get('sourceStage') != source_digest or
                hero_ui_compat.get('candidate') != digest_file(args.collection / 'candidate.json') or
                hero_ui_compat.get('mediaStage') != collection['mediaStage'] or
                hero_ui_compat.get('features') != digest_file(args.hero_ui_compat / 'hero-info-compat.bin') or
                hero_ui_compat.get('sourceActionsUnchanged') is not True or
                hero_ui_compat.get('compiledGplUnchanged') is not True):
            raise ValueError('Phantom UI compatibility art/source binding differs')
    module_cmake = []
    for name, folder in generated.items():
        binding = fixture['modules'][name]
        for filename, expected in binding['generatedFilesSha256'].items():
            path = folder / filename
            if path.is_symlink() or digest_file(path)['sha256'] != expected:
                raise ValueError('Private translated source changed')
        definitions = binding['compileDefinitions']
        if 'recomp_module_register=majesty_collect_private_template' not in definitions:
            raise ValueError('Private constructors must not register original PE addresses')
        module_cmake += [f'add_library(community_template_{name} OBJECT {quoted(folder / "chunk_000.c")} {quoted(folder / "table.c")})',
            f'target_include_directories(community_template_{name} PRIVATE {quoted(folder)} ${{POP_ROOT}}/runtime ${{CMAKE_BINARY_DIR}}/generated)',
            f'target_compile_definitions(community_template_{name} PRIVATE ' + ' '.join(definitions) +
            ' GUEST_IMAGE_BASE=${RECOMP_IMAGE_BASE} GUEST_HEAP_BASE=${RECOMP_HEAP_BASE} GUEST_SIZE=${RECOMP_GUEST_SIZE})',
            f'target_sources(pop_smoke PRIVATE $<TARGET_OBJECTS:community_template_{name}>)']
    if movement:
        module_cmake += [
            f'add_library(community_template_movement OBJECT {quoted(args.movement / "chunk_000.c")} {quoted(args.movement / "table.c")})',
            f'target_include_directories(community_template_movement PRIVATE {quoted(args.movement)} ${{POP_ROOT}}/runtime ${{CMAKE_BINARY_DIR}}/generated)',
            'target_compile_definitions(community_template_movement PRIVATE ' + ' '.join(movement['compileDefinitions']) +
            ' GUEST_IMAGE_BASE=${RECOMP_IMAGE_BASE} GUEST_HEAP_BASE=${RECOMP_HEAP_BASE} GUEST_SIZE=${RECOMP_GUEST_SIZE})',
            'target_sources(pop_smoke PRIVATE $<TARGET_OBJECTS:community_template_movement>)']
    if hero_ui:
        module_cmake += [
            f'add_library(community_template_hero_ui OBJECT {quoted(args.hero_ui / "chunk_000.c")} {quoted(args.hero_ui / "table.c")})',
            f'target_include_directories(community_template_hero_ui PRIVATE {quoted(args.hero_ui)} ${{POP_ROOT}}/runtime ${{CMAKE_BINARY_DIR}}/generated)',
            'target_compile_definitions(community_template_hero_ui PRIVATE ' + ' '.join(hero_ui['compileDefinitions']) +
            ' GUEST_IMAGE_BASE=${RECOMP_IMAGE_BASE} GUEST_HEAP_BASE=${RECOMP_HEAP_BASE} GUEST_SIZE=${RECOMP_GUEST_SIZE})',
            'target_sources(pop_smoke PRIVATE $<TARGET_OBJECTS:community_template_hero_ui>)']
    args.out.mkdir(parents=True)
    (args.out / 'game.toml').write_bytes(config_raw)
    shutil.copyfile(args.game / 'globals.toml', args.out / 'globals.toml')
    native_config = config['translate'].get('native', {})
    for name in [native_config.get('header', ''), *native_config.get('sources', [])]:
        if name:
            digest_file(args.game / name)
            (args.out / name).symlink_to((args.game / name).resolve())
    for name in ['kit', 'analysis', 'original']:
        (args.out / name).symlink_to((args.game / name).resolve(), target_is_directory=True)
    # An empty native-generation directory prevents accidental regeneration or
    # duplicate compilation; this consumer links the exact qualified objects.
    (args.out / 'build/recomp').mkdir(parents=True)
    shutil.copyfile(symbols, args.out / 'build/recomp/symbols.json')
    (args.out / 'source').symlink_to(ROOT, target_is_directory=True)
    core = args.out / 'mods/core/community-guilds'
    support = core / 'support'
    support.mkdir(parents=True)
    native = ROOT / 'native/community'
    shutil.copyfile(native / 'native_probe_plugin.cpp', core / 'alchemist_native_probe.cpp')
    for path in native.glob('*.h'):
        shutil.copyfile(path, support / path.name)
    for name in ['private_template_bank.cpp', 'recruitment_panel_runtime.cpp', 'guild_gameplay_runtime.cpp', 'movement_runtime.cpp',
                 'hero_ui_runtime.cpp', 'hero_ui_presenter.cpp']:
        shutil.copyfile(native / name, support / name)
    vendor = ROOT / 'third_party/majesty-mod-manager/runtime'
    for path in vendor.glob('*.h'):
        shutil.copyfile(path, support / path.name)
    for name in ['StockControllerRegistry.cpp', 'RuntimeFeatureRegistry.cpp', 'BoundedMapQuery.cpp',
                 'IntentTextRegistry.cpp']:
        shutil.copyfile(vendor / name, support / name)
    shutil.copyfile(args.seed_mod / 'mod.toml', core / 'mod.toml')
    for name in ['features.bin','controllers.bin','shared-overrides.tsv']:
        shutil.copyfile(args.seed_mod / name, core / name)
    shutil.copyfile(routes, core / 'shared-overrides.tsv')
    shutil.copyfile(args.controllers, core / 'community-controllers.bin')
    intents = args.source / 'resources/MMMIntentText.bin'
    if 'MMMIntentText.bin' in source['resourceFiles']:
        if digest_file(intents) != source['resourceFiles']['MMMIntentText.bin']:
            raise ValueError('Private activity/quest text differs from source')
        shutil.copyfile(intents, core / 'MMMIntentText.bin')
    shutil.copyfile(names, core / 'community-name-bindings.bin')
    if hero_ui:
        shutil.copyfile(args.hero_ui_bindings, core / 'hero-info-bindings.bin')
    if hero_ui_compat:
        shutil.copyfile(args.hero_ui_compat / 'hero-info-compat.bin', core / 'hero-info-compat.bin')
    for name in ['research-features.bin','research-bindings.bin']:
        shutil.copyfile(args.research / name, core / name)
    # Same bound registry supplies the declared timing and equipment subsystems.
    for name in ['timing-features.bin','equipment-features.bin']:
        shutil.copyfile(args.research / 'research-features.bin', core / name)
    (args.out / 'mods/CMakeLists.txt').write_text('# Private engine is linked by the game-owned native fixture.\n')
    tests = args.out / 'tests'; tests.mkdir()
    cmake = ['if(TARGET pop_smoke)', '  message(FATAL_ERROR "Unexpected second native host; preserve original objects")', 'endif()',
        'add_executable(pop_smoke\n  ' + '\n  '.join(quoted(p) for p in objects) + '\n)',
        'set_target_properties(pop_smoke PROPERTIES LINKER_LANGUAGE CXX)',
        'pop_builtin_mods(pop_smoke RESOURCES ${POP_OUT})',
        'target_include_directories(pop_smoke_mod_alchemist_native_probe PRIVATE ${POP_ROOT} ${POP_ROOT}/runtime)',
        'target_compile_definitions(pop_smoke_mod_alchemist_native_probe PRIVATE RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME=1)',
        *module_cmake]
    for library in libraries:
        encoded = '"$<LINK_LIBRARY:WHOLE_ARCHIVE,' + quoted(library)[1:-1] + '>"' if library == original.resolve() else quoted(library)
        cmake.append('target_link_libraries(pop_smoke PRIVATE ' + encoded + ')')
    for name in dict.fromkeys(frameworks):
        if not re.fullmatch(r'[A-Za-z0-9]+', name): raise ValueError('Invalid original framework')
        cmake.append('target_link_libraries(pop_smoke PRIVATE "-framework ' + name + '")')
    for name in dict.fromkeys(weak):
        if not re.fullmatch(r'[A-Za-z0-9]+', name): raise ValueError('Invalid original weak framework')
        cmake.append('target_link_options(pop_smoke PRIVATE "LINKER:-weak_framework,' + name + '")')
    cmake += ['target_link_libraries(pop_smoke PRIVATE m pthread)',
        'add_executable(community_name_registration_tests ' + quoted(native / 'name_registration_tests.cpp') +
        ' ' + quoted(vendor / 'RuntimeFeatureRegistry.cpp') + ')',
        'target_include_directories(community_name_registration_tests PRIVATE ' + quoted(native) + ' ' + quoted(vendor) + ')',
        'target_compile_features(community_name_registration_tests PRIVATE cxx_std_17)',
        'target_compile_options(community_name_registration_tests PRIVATE ${POP_WARN_STRICT})',
        'pop_optimize(community_name_registration_tests 1)',
        'pop_test_binary(community_name_registration_tests)',
        'add_test(NAME community_name_registration_tests COMMAND community_name_registration_tests ' + quoted(core / 'features.bin') + ')',
        'set_tests_properties(community_name_registration_tests PROPERTIES LABELS nogame TIMEOUT 15)']
    cmake += [
        'add_executable(community_movement_scale_tests ' + quoted(native / 'movement_scale_tests.cpp') + ')',
        'target_include_directories(community_movement_scale_tests PRIVATE ' + quoted(native) + ')',
        'target_compile_features(community_movement_scale_tests PRIVATE cxx_std_17)',
        'target_compile_options(community_movement_scale_tests PRIVATE ${POP_WARN_STRICT})',
        'pop_test_binary(community_movement_scale_tests)',
        'add_test(NAME community_movement_scale_tests COMMAND community_movement_scale_tests)',
        'set_tests_properties(community_movement_scale_tests PROPERTIES LABELS nogame TIMEOUT 15)']
    cmake += [
        'add_executable(community_hero_info_policy_tests ' + quoted(native / 'hero_info_policy_tests.cpp') +
        ' ' + quoted(vendor / 'RuntimeFeatureRegistry.cpp') + ')',
        'target_include_directories(community_hero_info_policy_tests PRIVATE ' + quoted(native) + ' ' + quoted(vendor) + ')',
        'target_compile_features(community_hero_info_policy_tests PRIVATE cxx_std_17)',
        'target_compile_options(community_hero_info_policy_tests PRIVATE ${POP_WARN_STRICT})',
        'pop_test_binary(community_hero_info_policy_tests)',
        'add_test(NAME community_hero_info_policy_tests COMMAND community_hero_info_policy_tests)',
        'set_tests_properties(community_hero_info_policy_tests PROPERTIES LABELS nogame TIMEOUT 15)']
    (tests / 'CMakeLists.txt').write_text('\n'.join(cmake) + '\n')
    receipt = dict(format='majesty-community-process-core-engine-stage-v1', originalProducer=digest_file(args.producer),
        originalHost=digest_file(exe), originalGuestSha256=PIN, originalObjects=source_inputs,
        gameConfig=digest_file(args.out / 'game.toml'), privateTemplates=fixture,
        privateMovement=movement, privateHeroUi=hero_ui, privateHeroUiCompatibility=hero_ui_compat,
        sourceFiles={p.relative_to(core).as_posix():digest_file(p) for p in core.rglob('*') if p.is_file()},
        generatedSourcesEdited=False, originalObjectsReused=True, processLifetimeCore=True,
        nativeLinked=False, liveGameplayQualified=False, browserPlayable=False, published=False)
    (args.out / 'process-engine-stage.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['game','build','producer','fixture','seed-mod','controllers','research','source','tables','collection','out']:
        parser.add_argument('--' + name, required=True, type=Path)
    parser.add_argument('--movement', type=Path)
    parser.add_argument('--movement-proof', type=Path)
    parser.add_argument('--hero-ui', type=Path)
    parser.add_argument('--hero-ui-proof', type=Path)
    parser.add_argument('--hero-ui-bindings', type=Path)
    parser.add_argument('--hero-ui-compat', type=Path)
    parser.add_argument('--generated', action='append', required=True)
    args = parser.parse_args()
    try:
        prepare(args)
    except (ValueError, OSError, KeyError, StopIteration) as error:
        parser.exit(1, f'Process engine preparation refused: {error}\n')
    print('Private process core staged from qualified original native objects; not yet linked or playable')


if __name__ == '__main__':
    main()
