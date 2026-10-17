#!/usr/bin/env python3
"""Stage a private browser core against exact, already-built production objects.

This does not change a public release or compile generated translations. Build
the resulting view with the official tools/build.py, then qualify it in-game.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shlex
import shutil
import tomllib


def digest(path):
    if not path.is_file() or path.stat().st_flags & 0x40000000:
        raise ValueError('Require a resident input: ' + str(path))
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return dict(bytes=path.stat().st_size, sha256=h.hexdigest())


def quote(value):
    value = str(value)
    if any(c in value for c in '"\n\r;$'):
        raise ValueError('Unsupported CMake path or argument')
    return '"' + value + '"'


def web_rule(ninja, output):
    marker = 'build ' + str(output) + ': CXX_EXECUTABLE_LINKER__recomp_app_Release '
    if ninja.count(marker) != 1:
        raise ValueError('Require exactly one original browser app link rule')
    block = ninja.split(marker, 1)[1].split('\n\n', 1)[0]
    objects = block.splitlines()[0].split(' |', 1)[0].split()
    if not objects or any(not p.endswith('.o') or '$' in p for p in objects):
        raise ValueError('Unsupported original browser objects')
    removed = [p for p in objects if '/recomp_app_mod_alchemist_native_probe.dir/' in p or
               p.endswith('/generated/recomp_app_builtin_mods.c.o')]
    if len(removed) != 4 or sum('/recomp_app_mod_' in p for p in objects) != 3:
        raise ValueError('Require the known three-object Alchemist core and builtin table')
    fields = {}
    for name in ['LINK_FLAGS', 'LINK_LIBRARIES']:
        match = re.search(r'^  ' + name + r' = (.+)$', block, re.M)
        if not match:
            raise ValueError('Missing browser link field: ' + name)
        fields[name] = shlex.split(match[1])
    flags = fields['LINK_FLAGS']
    if flags.count('--preload-file') != 1:
        raise ValueError('Require one original resource bundle')
    index = flags.index('--preload-file')
    if index + 1 >= len(flags) or not flags[index + 1].endswith('@/app/resources'):
        raise ValueError('Unexpected browser resource mount')
    resources = flags[index + 1].removesuffix('@/app/resources')
    flags = flags[:index] + flags[index + 2:]
    if '-pthread' not in flags or '-sWASMFS' not in flags or '-sINVOKE_RUN=0' not in flags:
        raise ValueError('Preserve the original threaded, explicitly started browser host')
    libraries = fields['LINK_LIBRARIES']
    if libraries.count('-Wl,--whole-archive') != 1 or libraries.count('-Wl,--no-whole-archive') != 1:
        raise ValueError('Require the original translated archive retention')
    retained = [p for p in objects if p not in removed]
    return dict(objects=retained, removed=removed, flags=flags,
                libraries=libraries, resources=resources)


def prepare(args):
    if args.out.exists() or args.out.is_symlink():
        raise ValueError('Preserve previous engines; choose a fresh output')
    native = json.loads(args.native_producer.read_text())
    if not native.get('nativeBuildQualified') or digest(args.native_engine / 'build/recomp/pop_smoke')[
            'sha256'] != native['nativeExecutableSha256']:
        raise ValueError('Native core producer differs')
    stage_path = args.native_engine / 'process-engine-stage.json'
    if digest(stage_path)['sha256'] != native['engineStageSha256']:
        raise ValueError('Native core stage differs')
    stage = json.loads(stage_path.read_text())
    core = args.native_engine / 'mods/core/community-guilds'
    for name, expected in stage['sourceFiles'].items():
        if digest(core / name) != expected:
            raise ValueError('Native core source changed: ' + name)
    if digest(args.web_game / 'game.toml') != stage['gameConfig']:
        raise ValueError('Native and browser translation configurations differ')
    if digest(args.web_game / 'build/recomp/symbols.json') != digest(
            args.native_engine / 'build/recomp/symbols.json'):
        raise ValueError('Native and browser original symbol tables differ')
    producer = json.loads(args.web_producer.read_text())
    for suffix in ['js', 'data', 'wasm']:
        if digest(args.web_game / ('build/web/recomp/MajestyRecomp.' + suffix)) != producer[suffix]:
            raise ValueError('Original browser producer differs: ' + suffix)
    ninja = args.web_build / 'build.ninja'
    rule = web_rule(ninja.read_text(), args.web_game / 'build/web/recomp/MajestyRecomp.js')
    objects = [(args.web_build / p).resolve() for p in rule['objects']]
    libraries = []
    library_files = []
    for token in rule['libraries']:
        if token.endswith('.a'):
            path = (args.web_build / token).resolve()
            library_files.append(path)
            libraries.append(quote(path))
        elif token in ['-Wl,--whole-archive', '-Wl,--no-whole-archive', '-ldl', '-lpthread', '-lm']:
            libraries.append(quote(token))
        else:
            raise ValueError('Unreviewed original browser library argument: ' + token)
    bound = {str(p): digest(p) for p in [*objects, *library_files]}
    # Reuse only the exact official private translations bound by the native
    # stage. Their collected modules never replace the original global table.
    native_cmake = (args.native_engine / 'tests/CMakeLists.txt').read_text()
    module_lines = [line.replace('pop_smoke', 'recomp_app') for line in native_cmake.splitlines()
                    if line.startswith(('add_library(community_template_',
                                        'target_include_directories(community_template_',
                                        'target_compile_definitions(community_template_',
                                        'target_sources(pop_smoke PRIVATE $<TARGET_OBJECTS:community_template_'))]
    private_stages = {k: v for k, v in {
        'movement': stage.get('privateMovement'), 'hero_ui': stage.get('privateHeroUi')}.items() if v}
    if len(module_lines) != 4 * (4 + len(private_stages)):
        raise ValueError('Private original presenter/movement/UI module set differs')
    folders = {}
    for line in module_lines:
        if not line.startswith('add_library('):
            continue
        match = re.fullmatch(r'add_library\(community_template_(\w+) OBJECT "(.+)/chunk_000.c" "\2/table.c"\)', line)
        if not match or match[1] in folders:
            raise ValueError('Unexpected private module translation inputs')
        folders[match[1]] = Path(match[2])
    if set(folders) != {*stage['privateTemplates']['modules'], *private_stages}:
        raise ValueError('Private translated module set differs')
    for name, folder in folders.items():
        if name in private_stages:
            for filename, expected in private_stages[name]['generatedFiles'].items():
                if digest(folder / filename) != expected:
                    raise ValueError('Private ' + name + ' translation changed')
        else:
            for filename, expected in stage['privateTemplates']['modules'][name]['generatedFilesSha256'].items():
                if digest(folder / filename)['sha256'] != expected:
                    raise ValueError('Private presenter translation changed')
    original_resources = Path(rule['resources'])
    resource_files = {p.relative_to(original_resources).as_posix(): digest(p)
                      for p in original_resources.rglob('*') if p.is_file()}
    args.out.mkdir(parents=True)
    memory_policy = args.out / 'pin-browser-memory-views.py'
    shutil.copyfile(Path(__file__).with_name(memory_policy.name), memory_policy)
    for name in ['game.toml', 'globals.toml']:
        shutil.copyfile(args.web_game / name, args.out / name)
    config = tomllib.loads((args.web_game / 'game.toml').read_text())
    replacements = config['translate'].get('native', {})
    for name in [replacements.get('header', ''), *replacements.get('sources', [])]:
        if name:
            path = args.web_game / name
            digest(path)
            (args.out / name).symlink_to(path.resolve())
    for name in ['kit', 'analysis', 'original']:
        (args.out / name).symlink_to((args.native_engine / name).resolve(), target_is_directory=True)
    (args.out / 'build/recomp').mkdir(parents=True)
    shutil.copyfile(args.native_engine / 'build/recomp/symbols.json', args.out / 'build/recomp/symbols.json')
    target_core = args.out / 'mods/core/community-guilds'
    shutil.copytree(core, target_core)
    (args.out / 'mods/CMakeLists.txt').write_text('# Linked by the private browser fixture.\n')
    resources = args.out / 'build/web/recomp/web-resources'
    shutil.copytree(original_resources, resources)
    shutil.rmtree(resources / 'mods')
    for path in target_core.rglob('*'):
        if path.is_file() and path.suffix in ['.toml', '.bin', '.tsv']:
            target = resources / 'mods/core/community-guilds' / path.relative_to(target_core)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)
    cmake = ['if(NOT EMSCRIPTEN OR TARGET recomp_app)',
             '  message(FATAL_ERROR "Private browser fixture needs an unregistered web host")',
             'endif()', 'add_executable(recomp_app\n  ' + '\n  '.join(map(quote, objects)) + '\n)',
             'set_target_properties(recomp_app PROPERTIES LINKER_LANGUAGE CXX OUTPUT_NAME MajestyRecomp RUNTIME_OUTPUT_DIRECTORY ${POP_OUT})',
             'pop_builtin_mods(recomp_app)',
             'target_include_directories(recomp_app_mod_alchemist_native_probe PRIVATE ${POP_ROOT} ${POP_ROOT}/runtime)',
             'target_compile_definitions(recomp_app_mod_alchemist_native_probe PRIVATE RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME=1)',
             *module_lines,
             'target_link_libraries(recomp_app PRIVATE ' + ' '.join(libraries) + ')',
             'target_link_options(recomp_app PRIVATE ' + ' '.join(map(quote, rule['flags'])) +
             ' --preload-file ' + quote(str(resources) + '@/app/resources') + ')',
             'add_custom_command(TARGET recomp_app POST_BUILD COMMAND ${Python3_EXECUTABLE} ' +
             quote(memory_policy) +
             ' --js $<TARGET_FILE:recomp_app> VERBATIM)']
    (args.out / 'tests').mkdir()
    (args.out / 'tests/CMakeLists.txt').write_text('\n'.join(cmake) + '\n')
    receipt = dict(format='majesty-community-browser-core-stage-v1', nativeProducer=digest(args.native_producer),
                   nativeStage=digest(stage_path), browserProducer=digest(args.web_producer),
                   originalNinja=digest(ninja), originalLinkFiles=bound,
                   originalResources=resource_files,
                   browserMemoryViewPolicy=digest(memory_policy),
                   excludedPriorCoreObjects=rule['removed'],
                   coreFiles=stage['sourceFiles'], officialBuildRequired=True,
                   generatedSourcesEdited=False, browserPlayable=False, published=False)
    (args.out / 'browser-engine-stage.json').write_text(json.dumps(receipt, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['native-engine', 'native-producer', 'web-game', 'web-build', 'web-producer', 'out']:
        parser.add_argument('--' + name, type=Path, required=True)
    try:
        prepare(parser.parse_args())
    except (ValueError, KeyError, OSError) as error:
        parser.exit(1, 'Private browser preparation refused: ' + str(error) + '\n')
    print('Private browser core staged; official build and live qualification remain required')
