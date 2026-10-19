#!/usr/bin/env python3
"""Replace one pinned presenter object in an otherwise unchanged browser link.

Stage only; compile/link through the original kit tools/build.py. No generated
translation or existing engine/source is edited. Live qualification is required.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shlex
import shutil
import tomllib

ROOT = Path(__file__).resolve().parents[1]
PRESENTER_SHA256 = 'c93203e281befad5b16427cb2e6f4afc238cb3043f39a1624494504e8542b4c7'


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
    if any(c in value for c in ['"', '\n', '\r', ';', '$']):
        raise ValueError('Unsupported CMake input')
    return '"' + value + '"'


def block(text, marker):
    if text.count(marker) != 1:
        raise ValueError('Require one exact official build rule')
    return text.split(marker, 1)[1].split('\n\n', 1)[0]


def field(rule, name):
    values = re.findall(r'^  ' + name + r' = (.+)$', rule, re.M)
    if len(values) != 1 or '$' in values[0]:
        raise ValueError('Unsupported build field: ' + name)
    return shlex.split(values[0])


def pooled_presenter(text):
    if hashlib.sha256(text.encode()).hexdigest() != PRESENTER_SHA256:
        raise ValueError('Presenter source differs from the reviewed version')
    changes = {
        '#include "present_frame.h"': '#include "present_frame.h"\n#include "composite_pool.h"',
        '    std::shared_ptr<Composite> cached;':
            '    presentation::CompositePool<Composite, 8> composite_pool;\n'
            '    std::shared_ptr<Composite> cached;',
        '''    std::shared_ptr<Composite> composite(int w, int h, gpu::Format format) {
        gpu::Texture t = texture(w, h, format);
        if (!t)
            return nullptr;
        auto c = std::make_shared<Composite>();
        c->device = device;
        c->texture = t;
        c->w = w;
        c->h = h;
        c->format = format;
        return c;
    }''': '''    std::shared_ptr<Composite> composite(int w, int h, gpu::Format format) {
        return composite_pool.acquire(
            [=](const Composite &c) { return c.w == w && c.h == h && c.format == format; },
            [&]() -> std::shared_ptr<Composite> {
                gpu::Texture t = texture(w, h, format);
                if (!t)
                    return nullptr;
                auto c = std::make_shared<Composite>();
                c->device = device;
                c->texture = t;
                c->w = w;
                c->h = h;
                c->format = format;
                return c;
            });
    }''',
    }
    for before, after in changes.items():
        if text.count(before) != 1:
            raise ValueError('Presenter lifecycle contract changed')
        text = text.replace(before, after, 1)
    return text


def prepare(args):
    if args.out.exists() or args.out.is_symlink():
        raise ValueError('Preserve prior engines; choose a fresh output')
    base = args.base_engine.resolve()
    wasm = base / 'build/web/recomp/MajestyRecomp.wasm'
    if digest(wasm)['sha256'] != args.expected_engine_sha256:
        raise ValueError('Base WASM differs from the qualified input')
    kit = (base / 'kit').resolve()
    source = kit / 'host/present_thread.cpp'
    original_source = source.read_text()
    patched = pooled_presenter(original_source)
    if args.unpooled_control:
        patched = original_source
    ninja = args.base_build / 'build.ninja'
    text = ninja.read_text()
    link = block(text, 'build ' + str(base / 'build/web/recomp/MajestyRecomp.js') +
                 ': CXX_EXECUTABLE_LINKER__recomp_app_Release ')
    tokens = link.splitlines()[0].split(' |', 1)[0].split()
    if not tokens or any(not x.endswith('.o') or '$' in x for x in tokens):
        raise ValueError('Unreviewed browser object list')
    objects = [(args.base_build / value).resolve() for value in tokens]
    removed = [p for p in objects if str(p).endswith('/recomp_app.dir/present_thread.cpp.o')]
    if len(removed) != 1:
        raise ValueError('Require exactly one original presenter object')
    # A flat relink's original presenter comes from the qualified base producer.
    # Its compile rule is in that object's own build directory, not the flat link.
    compile_root = removed[0].parents[3]
    compile_ninja = compile_root / 'build.ninja'
    compile_rule = block(compile_ninja.read_text(),
                         'build ' + removed[0].relative_to(compile_root).as_posix() + ': ')
    if not compile_rule.splitlines()[0].split(' ||', 1)[0].endswith(' ' + str(source)):
        raise ValueError('Presenter object uses an unexpected source')
    flags = field(link, 'LINK_FLAGS')
    if '-sWASMFS' not in flags or '-pthread' not in flags or flags.count('--preload-file') != 1:
        raise ValueError('Preserve the existing threaded browser host and resource mount')
    libraries = []
    bound = {str(p): digest(p) for p in objects}
    for value in field(link, 'LINK_LIBRARIES'):
        if value.endswith('.a'):
            path = (args.base_build / value).resolve()
            bound[str(path)] = digest(path)
            libraries.append(quote(path))
        elif value in ['-Wl,--whole-archive', '-Wl,--no-whole-archive', '-ldl', '-lpthread', '-lm']:
            libraries.append(quote(value))
        else:
            raise ValueError('Unreviewed browser library')
    args.out.mkdir()
    for name in ['game.toml', 'globals.toml']:
        shutil.copyfile(base / name, args.out / name)
    config = tomllib.loads((base / 'game.toml').read_text())['translate'].get('native', {})
    for name in [config.get('header', ''), *config.get('sources', [])]:
        if name:
            (args.out / name).symlink_to((base / name).resolve())
    for name in ['kit', 'analysis', 'original']:
        (args.out / name).symlink_to((base / name).resolve(), target_is_directory=True)
    (args.out / 'build/recomp').mkdir(parents=True)
    shutil.copyfile(base / 'build/recomp/symbols.json', args.out / 'build/recomp/symbols.json')
    (args.out / 'mods').mkdir()
    (args.out / 'mods/CMakeLists.txt').write_text('# Existing compiled community modules retained.\n')
    renderer = args.out / 'renderer'
    renderer.mkdir()
    (renderer / 'present_thread.cpp').write_text(patched)
    shutil.copyfile(ROOT / 'native/performance/composite_pool.h', renderer / 'composite_pool.h')
    shutil.copyfile(ROOT / 'scripts/pin-browser-memory-views.py', args.out / 'pin-browser-memory-views.py')
    included = field(compile_rule, 'INCLUDES')
    compile_flags = field(compile_rule, 'FLAGS') + field(compile_rule, 'DEFINES') + included
    cmake = ['if(NOT EMSCRIPTEN OR TARGET recomp_app)',
             '  message(FATAL_ERROR "Require one unregistered browser host")', 'endif()',
             'add_library(pooled_presenter OBJECT ' + quote(renderer / 'present_thread.cpp') + ')',
             'target_compile_options(pooled_presenter PRIVATE ' + ' '.join(map(quote, compile_flags)) + ')',
             'add_executable(recomp_app\n  ' + '\n  '.join(
                 '$<TARGET_OBJECTS:pooled_presenter>' if p == removed[0] else quote(p)
                 for p in objects) + '\n)',
             'set_target_properties(recomp_app PROPERTIES LINKER_LANGUAGE CXX OUTPUT_NAME MajestyRecomp RUNTIME_OUTPUT_DIRECTORY ${POP_OUT})',
             'target_link_libraries(recomp_app PRIVATE ' + ' '.join(libraries) + ')',
             'target_link_options(recomp_app PRIVATE ' + ' '.join(map(quote, flags)) + ')',
             'add_custom_command(TARGET recomp_app POST_BUILD COMMAND ${Python3_EXECUTABLE} ' +
             quote(args.out / 'pin-browser-memory-views.py') +
             ' --js $<TARGET_FILE:recomp_app> VERBATIM)']
    (args.out / 'tests').mkdir()
    (args.out / 'tests/CMakeLists.txt').write_text('\n'.join(cmake) + '\n')
    receipt = dict(format='majesty-composite-pool-stage-v1', baseEngineSha256=args.expected_engine_sha256,
                   originalNinja=digest(ninja), originalObjectsAndLibraries=bound,
                   originalCompileNinja=digest(compile_ninja),
                   replacedPresenter=str(removed[0]), originalPresenterSource=digest(source),
                   pooledPresenter=digest(renderer / 'present_thread.cpp'),
                   poolHeader=digest(renderer / 'composite_pool.h'),
                   pooled=not args.unpooled_control,
                   allOtherObjectsUnchanged=True, generatedSourcesEdited=False,
                   officialBuildRequired=True, browserQualified=False, published=False)
    (args.out / 'composite-pool-stage.json').write_text(json.dumps(receipt, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['base-engine', 'base-build', 'out']:
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--expected-engine-sha256', required=True)
    parser.add_argument('--unpooled-control', action='store_true',
                        help='Private comparison only: compile the same source without reuse')
    try:
        prepare(parser.parse_args())
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, 'Composite pool staging refused: ' + str(error) + '\n')
    print('One presenter object staged for official build; live qualification still required')
