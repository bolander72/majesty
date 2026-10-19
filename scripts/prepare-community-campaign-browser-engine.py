#!/usr/bin/env python3
"""Stage the campaign compatibility core into a qualified browser engine.

Uses the original official object compile flags and link inputs, replacing only
one handwritten community core object. Build through kit/tools/build.py; staging
never edits generated translations, prior engines or any player collection.
"""
import argparse
import json
from pathlib import Path
import runpy
import shutil
import tomllib

ROOT = Path(__file__).resolve().parents[1]


def prepare(args):
    helpers = runpy.run_path(str(ROOT / 'scripts/prepare-composite-pool-browser-engine.py'))
    quote, block, field, digest = (helpers[n] for n in ('quote', 'block', 'field', 'digest'))
    base, core_engine, out = args.base_engine.resolve(), args.core_engine.resolve(), args.out
    if out.exists() or out.is_symlink():
        raise ValueError('Preserve prior engines; choose a fresh output')
    wasm = base / 'build/web/recomp/MajestyRecomp.wasm'
    if digest(wasm)['sha256'] != args.expected_engine_sha256:
        raise ValueError('Base engine differs from the qualified input')
    build, core_build = (x / ('build/cmake/' + args.preset) for x in (base, core_engine))
    link = block((build / 'build.ninja').read_text(), 'build ' +
        str(base / 'build/web/recomp/MajestyRecomp.js') + ': CXX_EXECUTABLE_LINKER__recomp_app_Release ')
    objects = [(build / p).resolve() for p in link.splitlines()[0].split(' |', 1)[0].split()]
    removed = [p for p in objects if p.name == 'alchemist_native_probe.cpp.o']
    if len(removed) != 1:
        raise ValueError('Require exactly one original community core object')
    old_core = core_engine / 'mods/core/community-guilds'
    rule = block((core_build / 'build.ninja').read_text(), 'build ' +
                 removed[0].relative_to(core_build).as_posix() + ': ')
    for p in objects:
        digest(p)  # Refuse missing/cold link inputs before creating the stage.
    out.mkdir(parents=True)
    core = out / 'community-core'
    shutil.copytree(old_core, core)
    shutil.copyfile(ROOT / 'native/community/native_probe_plugin.cpp', core / 'alchemist_native_probe.cpp')
    shutil.copyfile(ROOT / 'native/community/optional_expansion_effectors.h', core / 'optional_expansion_effectors.h')
    for name in ('game.toml', 'globals.toml'):
        shutil.copyfile(base / name, out / name)
    cfg = tomllib.loads((base / 'game.toml').read_text())['translate'].get('native', {})
    for name in (cfg.get('header', ''), *cfg.get('sources', [])):
        if name:
            (out / name).symlink_to((base / name).resolve())
    for name in ('kit', 'analysis', 'original'):
        (out / name).symlink_to((base / name).resolve(), target_is_directory=True)
    (out / 'build/recomp').mkdir(parents=True)
    shutil.copyfile(base / 'build/recomp/symbols.json', out / 'build/recomp/symbols.json')
    (out / 'mods').mkdir()
    (out / 'mods/CMakeLists.txt').write_text('# Original core retained as prebuilt link inputs.\n')
    shutil.copyfile(ROOT / 'scripts/pin-browser-memory-views.py', out / 'pin-browser-memory-views.py')
    flags = [v.replace(str(old_core), str(core)) for v in
             field(rule, 'FLAGS') + field(rule, 'DEFINES') + field(rule, 'INCLUDES')]
    libs = [quote((build / v).resolve()) if v.endswith('.a') else quote(v)
            for v in field(link, 'LINK_LIBRARIES')]
    cmake = [
        'if(NOT EMSCRIPTEN OR TARGET recomp_app)',
        'message(FATAL_ERROR "Campaign compatibility stage requires browser app link")', 'endif()',
        'add_library(campaign_core OBJECT ' + quote(core / 'alchemist_native_probe.cpp') + ')',
        'target_compile_options(campaign_core PRIVATE ' + ' '.join(map(quote, flags)) + ')',
        'add_executable(recomp_app\n' + '\n'.join(
            '$<TARGET_OBJECTS:campaign_core>' if p == removed[0] else quote(p) for p in objects) + '\n)',
        'set_target_properties(recomp_app PROPERTIES LINKER_LANGUAGE CXX OUTPUT_NAME MajestyRecomp RUNTIME_OUTPUT_DIRECTORY ${POP_OUT})',
        'target_link_libraries(recomp_app PRIVATE ' + ' '.join(libs) + ')',
        'target_link_options(recomp_app PRIVATE ' + ' '.join(map(quote, field(link, 'LINK_FLAGS'))) + ')',
        'add_custom_command(TARGET recomp_app POST_BUILD COMMAND ${Python3_EXECUTABLE} ' +
        quote(out / 'pin-browser-memory-views.py') + ' --js $<TARGET_FILE:recomp_app> VERBATIM)']
    (out / 'tests').mkdir()
    (out / 'tests/CMakeLists.txt').write_text('\n'.join(cmake) + '\n')
    (out / 'campaign-core-stage.json').write_text(json.dumps(dict(
        format='majesty-community-campaign-core-stage-v1', baseEngine=digest(wasm),
        sources={p.name: digest(p) for p in core.iterdir() if p.is_file()},
        replacedObject=digest(removed[0]), retainedObjects={str(p): digest(p) for p in objects if p != removed[0]},
        generatedTranslationsEdited=False, originalFilesUnchanged=True,
        built=False, browserPlayable=False, published=False), indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('base-engine', 'core-engine', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--expected-engine-sha256', required=True)
    parser.add_argument('--preset', default='alchemist1325-web')
    prepare(parser.parse_args())
    print('One source-bound community core staged; original SDK build and live verification required')
