#!/usr/bin/env python3
"""Carry a source-bound, native-tested expansion core into the qualified web host."""
import argparse
import importlib.util
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def prepare(a):
    policy = module('expansion_web_base', ROOT / 'scripts/prepare-community-campaign-browser-engine.py')
    helpers = module('expansion_web_link', ROOT / 'scripts/prepare-composite-pool-browser-engine.py')
    digest, block, field, quote = (getattr(helpers, name) for name in ('digest', 'block', 'field', 'quote'))
    def document(path):
        if path.stat().st_size > 1024 * 1024:
            raise ValueError('Oversized browser stage evidence')
        return json.loads(path.read_text())
    native = a.native_engine.resolve()
    probe = document(native / 'probe-stage.json')
    terminal = document(a.native_trial / 'native-terminal.json')
    trial = document(a.native_trial / 'stage.json')
    core = native / 'mods/core/community-guilds'
    if (probe.get('format') != 'majesty-community-expansion-runtime-probe-v2'
            or not probe.get('privateProbeOnly') or probe.get('published')
            or not terminal.get('nativeSessionTerminal') or terminal.get('nativeExitCode') != 0
            or terminal.get('stopReason') is not None
            or terminal.get('sourceEngineSha256') != digest(native / 'build/recomp/pop_smoke')['sha256']
            or trial.get('engineStage') != digest(native / 'probe-stage.json')['sha256']
            or trial.get('controls') != digest(native / 'test-controls-stage.json')['sha256']):
        raise ValueError('Require the exact source-bound clean native expansion trial')
    log = a.native_trial / 'run.log'
    if log.stat().st_size > 8 * 1024 * 1024:
        raise ValueError('Oversized native qualification log')
    text = log.read_text()
    markers = ('Controlled expansion panels: actual guild/Zoo births and all five native panels',
        'Controlled expansion play: original completion, paid board refresh, queued open/close',
        'Controlled More Heroes births: all 13 original native heroes',
        'Controlled More Heroes leveling: original native level-1000 cheat, all 13 classes',
        'Controlled More Heroes high-level AI: all 13 remain alive')
    if not all(marker in text for marker in markers):
        raise ValueError('Incomplete native expansion component qualification')
    for name, expected in probe['sources'].items():
        path = Path(name)
        if path.is_absolute() or '..' in path.parts or digest(core / path) != expected:
            raise ValueError('Native-tested core input changed: ' + name)
    base = a.base_engine.resolve()
    old_core = base / 'community-core'
    retained_sources = {}
    for old in old_core.rglob('*.cpp'):
        name = old.relative_to(old_core)
        if old.name == 'alchemist_native_probe.cpp':
            continue
        if digest(old) != digest(core / name):
            raise ValueError('A retained browser object requires recompilation: ' + str(name))
        retained_sources[str(name)] = digest(old)
    if not retained_sources:
        raise ValueError('Retained native support source bindings unavailable')
    build = base / ('build/cmake/' + a.preset)
    link = block((build / 'build.ninja').read_text(), 'build ' +
        str(base / 'build/web/recomp/MajestyRecomp.js') + ': CXX_EXECUTABLE_LINKER__recomp_app_Release ')
    flags = field(link, 'LINK_FLAGS')
    if flags.count('--preload-file') != 1:
        raise ValueError('Require one qualified original web resource mount')
    resource_argument = flags[flags.index('--preload-file') + 1]
    resource_name, mount = resource_argument.rsplit('@', 1)
    if mount != '/app/resources':
        raise ValueError('Original web resource mount changed')
    resources = Path(resource_name)
    resource_inputs = {p.relative_to(resources).as_posix():digest(p)
                       for p in resources.rglob('*') if p.is_file()}
    # The existing game-owned producer retains the exact translated host,
    # private presenter modules, original link flags and supported ABI.
    policy.prepare(argparse.Namespace(base_engine=base, core_engine=base, out=a.out,
        expected_engine_sha256=a.expected_engine_sha256, preset=a.preset))
    target = a.out / 'community-core'
    shutil.rmtree(target)
    shutil.copytree(core, target)
    destination = a.out / 'build/web/recomp/web-resources'
    shutil.copytree(resources, destination)
    shutil.rmtree(destination / 'mods')
    installed = {}
    for path in target.rglob('*'):
        if path.is_file() and path.suffix in ('.toml', '.bin', '.tsv'):
            name = path.relative_to(target)
            output = destination / 'mods/core/community-guilds' / name
            output.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, output)
            installed[str(name)] = digest(output)
    if not installed or 'MMMIntentText.bin' not in installed:
        raise ValueError('Expansion browser registries were not installed')
    cmake = a.out / 'tests/CMakeLists.txt'
    code = cmake.read_text()
    original = quote(resource_argument)
    if code.count(original) != 1:
        raise ValueError('Original browser resource argument changed')
    code = code.replace(original, quote(str(destination.resolve()) + '@' + mount))
    cmake.write_text(code)
    proof = dict(format='majesty-community-expansion-browser-core-stage-v1',
        policy=digest(Path(__file__)), nativeEngineStage=digest(native / 'probe-stage.json'),
        nativeTrial=digest(a.native_trial / 'native-terminal.json'), nativeTrialLog=digest(log),
        originalWebStage=digest(a.out / 'campaign-core-stage.json'),
        baseEngine=digest(base / 'build/web/recomp/MajestyRecomp.wasm'),
        retainedSupportSources=retained_sources, originalWebResources=resource_inputs,
        sources={p.relative_to(target).as_posix():digest(p) for p in target.rglob('*') if p.is_file()},
        installedRegistries=installed, cmake=digest(cmake),
        sourceStage=probe['sourceStage'], compiler=probe['compiler'], nativePatches=probe['nativePatches'],
        originalWebResourcesPreservedExceptCoreRegistries=True,
        testGplIncluded=False, testRuntimeFlagsEnabled=False,
        generatedTranslationsEdited=False, built=False, browserPlayable=False, published=False)
    (a.out / 'expansion-browser-stage.json').write_text(json.dumps(proof, indent=2) + '\n')
    return dict(installedRegistries=len(installed), retainedSupportSources=len(retained_sources),
        testGplIncluded=False, browserPlayable=False, published=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('base-engine', 'native-engine', 'native-trial', 'out'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--expected-engine-sha256', required=True)
    parser.add_argument('--preset', default='alchemist1325-web')
    print(json.dumps(prepare(parser.parse_args())))
