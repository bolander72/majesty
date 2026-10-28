#!/usr/bin/env python3
"""Stage a private expansion runtime against a qualified native host; never launch it."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys
import tomllib

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.community_guild_composition import merge_shared_function_routes
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'


def digest(path):
    if not path.is_file() or getattr(path.stat(), 'st_flags', 0) & 0x40000000:
        raise ValueError('Require a resident file: ' + path.name)
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for data in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(data)
    return dict(bytes=path.stat().st_size, sha256=h.hexdigest())


def document(path, maximum=1024 * 1024):
    if path.stat().st_size > maximum:
        raise ValueError('Oversized stage metadata')
    digest(path)
    return json.loads(path.read_text())


def relative(name):
    value = Path(name)
    if value.is_absolute() or '..' in value.parts or '\\' in name or value == Path('.'):
        raise ValueError('Unsafe game resource path')
    return value


def prepare(a):
    if a.out.exists() or a.out.is_symlink() or a.out.resolve().is_relative_to(a.base_engine.resolve()):
        raise ValueError('Preserve existing engines; choose a fresh output')
    base, proof = a.base_engine.resolve(), document(a.base_proof)
    if (not proof.get('nativeBuildQualified') or
            digest(base / 'build/recomp/pop_smoke')['sha256'] != proof['nativeExecutableSha256']):
        raise ValueError('Require the qualified original native host')
    source = document(a.source / 'source-stage.json')
    creator = document(a.creator / 'source-stage.json')
    patches = document(a.patches / 'native-patches-stage.json')
    compiler = document(a.compiled / 'compiler-proof.json')
    release = document(a.prior_release)
    if (patches['sourceStage'] != digest(a.source / 'source-stage.json') or
            patches['creatorStage'] != digest(a.creator / 'source-stage.json') or
            patches['compilerProof'] != digest(a.compiled / 'compiler-proof.json') or
            patches['priorRelease'] != digest(a.prior_release) or
            compiler['sourceStage'] != patches['sourceStage'] or not compiler.get('compiled') or
            source['communityExpansions']['creatorStage'] != patches['creatorStage']):
        raise ValueError('Require one bound source/creator/patch/compiler/baseline selection')
    resources = {}
    for name in ('features.bin', 'controllers.bin', 'MMMIntentText.bin'):
        path = a.source / 'resources' / name
        if digest(path) != source['resourceFiles'][name]:
            raise ValueError('Source-bound runtime resource changed: ' + name)
        resources[name] = path
    if digest(resources['controllers.bin']) != creator['resourceFiles']['controllers.bin']:
        raise ValueError('Controller registries differ')
    routes = []
    for scope in ('Majesty', 'MajestyExpansion'):
        path = a.source / 'routes' / scope / 'shared-overrides.tsv'
        if digest(path) != source['legacyRoutes'][scope]:
            raise ValueError('Scoped route source changed')
        routes.append(path.read_bytes())
    union = merge_shared_function_routes(routes)
    config = tomllib.loads((base / 'game.toml').read_text())
    if config['game']['sha256'] != PIN or digest(a.asset_game / 'MajestyHD - Old.exe')['sha256'] != PIN:
        raise ValueError('Require the pinned original DirectDraw executable')
    # Retain the original host/translated-object link. Bind every explicit
    # object/archive input before creating a new handwritten fixture.
    old_cmake = (base / 'tests/CMakeLists.txt').read_text()
    link_inputs = {}
    for name in re.findall(r'"([^"\n]+\.(?:o|a|c|cpp|h)>?)"', old_cmake):
        path = Path(name.removeprefix('$<LINK_LIBRARY:WHOLE_ARCHIVE,').removesuffix('>'))
        if path.is_absolute(): link_inputs[str(path)] = digest(path)
    if not link_inputs:
        raise ValueError('Original link inputs unavailable')
    symbols = base / 'build/recomp/symbols.json'
    symbol_binding = digest(symbols)
    a.out.mkdir(parents=True)
    for name in ('game.toml', 'globals.toml'):
        shutil.copyfile(base / name, a.out / name)
    for name in ('kit', 'analysis', 'original'):
        (a.out / name).symlink_to((base / name).resolve(), target_is_directory=True)
    native = config['translate']['native']
    for name in (native['header'], *native['sources']):
        (a.out / name).symlink_to((base / name).resolve())
    (a.out / 'build/recomp').mkdir(parents=True)
    shutil.copyfile(symbols, a.out / 'build/recomp/symbols.json')
    (a.out / 'tests').mkdir()
    (a.out / 'tests/CMakeLists.txt').write_text(old_cmake.replace(str(base), str(a.out.resolve())))
    (a.out / 'mods').mkdir()
    shutil.copyfile(base / 'mods/CMakeLists.txt', a.out / 'mods/CMakeLists.txt')
    shutil.copytree(base / 'mods/core', a.out / 'mods/core')
    core = a.out / 'mods/core/community-guilds'
    support = core / 'support'
    shutil.copyfile(ROOT / 'native/community/native_probe_plugin.cpp', core / 'alchemist_native_probe.cpp')
    for path in (ROOT / 'native/community').glob('*.h'):
        shutil.copyfile(path, support / path.name)
    shutil.copyfile(ROOT / 'native/community/expansion_panel_runtime.cpp', support / 'expansion_panel_runtime.cpp')
    vendor = ROOT / 'third_party/majesty-mod-manager/runtime'
    for path in vendor.glob('*.h'):
        shutil.copyfile(path, support / path.name)
    for name in ('BoundedMapQuery.cpp', 'IntentTextRegistry.cpp'):
        shutil.copyfile(vendor / name, support / name)
    for name in ('research-features.bin', 'timing-features.bin', 'equipment-features.bin'):
        shutil.copyfile(resources['features.bin'], core / name)
    shutil.copyfile(resources['controllers.bin'], core / 'community-controllers.bin')
    shutil.copyfile(resources['MMMIntentText.bin'], core / 'MMMIntentText.bin')
    (core / 'shared-overrides.tsv').write_bytes(union)
    game = a.out / 'game'
    game.mkdir()
    for directory in ('Data', 'DataMX', 'Quests', 'QuestsMX', 'Music'):
        for path in (a.asset_game / directory).rglob('*'):
            target = game / path.relative_to(a.asset_game)
            if path.is_dir(): target.mkdir(parents=True, exist_ok=True)
            elif path.is_file():
                if getattr(path.stat(), 'st_flags', 0) & 0x40000000:
                    raise ValueError('Cold original game input')
                target.parent.mkdir(parents=True, exist_ok=True)
                target.symlink_to(path.resolve(strict=True))
    (game / 'MajestyHD - Old.exe').symlink_to((a.asset_game / 'MajestyHD - Old.exe').resolve())
    files = {}
    def install(name, path, expected):
        if digest(path) != expected: raise ValueError('Game resource binding changed: ' + name)
        target = game / relative(name)
        if target.exists() or target.is_symlink(): target.unlink()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.symlink_to(path.resolve(strict=True))
        files[name] = expected
    for row in release['patches']:
        if not row['path'].endswith('.bcd'):
            install(row['path'], a.current / relative(row['path']), {k: row[k] for k in ('bytes', 'sha256')})
    for name, expected in patches['files'].items():
        install(name, a.patches / 'game' / relative(name), expected)
    for directory in ('Data', 'DataMX'):
        for slug, title in (('common', 'Common'), ('base', 'Base'), ('expansion', 'Expansion')):
            install(directory + '/Community_' + title + '.bcd', a.compiled / (slug + '.bcd'),
                    {k: compiler['outputs'][slug][k] for k in ('bytes', 'sha256')})
    receipt = dict(format='majesty-community-expansion-runtime-probe-v2',
        baseEngine=digest(base / 'build/recomp/pop_smoke'), baseProof=digest(a.base_proof),
        sourceStage=digest(a.source / 'source-stage.json'), creatorStage=digest(a.creator / 'source-stage.json'),
        nativePatches=digest(a.patches / 'native-patches-stage.json'), compiler=digest(a.compiled / 'compiler-proof.json'),
        priorRelease=digest(a.prior_release), policy=digest(Path(__file__)), symbolsManifest=symbol_binding,
        originalLinkInputs=link_inputs, sources={p.relative_to(core).as_posix(): digest(p)
            for p in core.rglob('*') if p.is_file()}, gameFiles=files,
        generatedTranslationsEdited=False, privateProbeOnly=True, testGplInstalled=False,
        nativeGameplayQualified=False, browserPlayable=False, published=False)
    (a.out / 'probe-stage.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return dict(gamePatches=len(files), coreInputs=len(receipt['sources']), privateProbeOnly=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('base-engine', 'base-proof', 'asset-game', 'source', 'creator', 'patches',
                 'compiled', 'prior-release', 'current', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    print(json.dumps(prepare(parser.parse_args())))
