#!/usr/bin/env python3
"""Build the real web application through official tools, in an owned game view.

The official --target app accepts a private web preset and links recomp_app,
the same web application target, without publishing a website. Its game view
keeps every output separate from native and published web builds. Translation
inputs and actual game sources are shared by symlink, never manually edited.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'


def sha(path):
    if getattr(path.stat(), 'st_flags', 0) & 0x40000000:
        raise ValueError(f'Dataless build input: {path.name}')
    result = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(65536), b''):
            result.update(block)
    return result.hexdigest()


def qualified_native_inputs(receipt, root=ROOT):
    """Require a finished native build of the exact source closure being ported."""
    native = json.loads(receipt.read_text())
    if native.get('nativeBuildQualified') is not True or native.get('exitCode') != 0:
        raise ValueError('A successful terminal native build is required')
    inputs = {}
    for key in ('nativeSourceSha256', 'nativeHeapRuntimeSourceSha256',
                'nativeCheckpointRuntimeSourceSha256', 'nativeOrderRuntimeSourceSha256'):
        if not native.get(key):
            raise ValueError('Native build source closure is incomplete')
        inputs.update(native[key])
    if any(sha(root / name) != expected for name, expected in inputs.items()):
        raise ValueError('Source inputs changed after the current native qualification')
    return inputs


def owned_processes(rows, root_pid):
    """Ninja compiler children may have their own process groups."""
    owned = {root_pid} | {row['pid'] for row in rows if row['group'] == root_pid}
    while True:
        expanded = owned | {row['pid'] for row in rows if row['parent'] in owned}
        if expanded == owned:
            return [row for row in rows if row['pid'] in owned]
        owned = expanded


def private_tool_view(game_view, resource_modes):
    """Mirror official tool bytes; overlay only an existing packaged resource.

    The original iCloud placeholder is preserved. All runtime and translation
    sources remain links to their actual files. Copying the two unmodified
    official build entry points gives their path-based ROOT an owned directory.
    """
    resource_modes = resource_modes.resolve()
    expected = '91383ae1eac434cb0ae5ef3ae1f790d4f11089fb4cf59cd9ee20c65b8cb931e9'
    if sha(resource_modes) != expected:
        raise ValueError('Packaged classic display table differs from the recorded native trial')
    kit = game_view / 'kit'
    kit.mkdir()
    source_kit = GAME / 'kit'
    for source in source_kit.iterdir():
        if source.name.startswith('.') or source.name in ('tools', 'build'):
            continue
        (kit / source.name).symlink_to(source, target_is_directory=source.is_dir())
    for relative, excluded in [('tools', {'build.py', 'recomp'}),
                               ('tools/recomp', {'baseline'}),
                               ('tools/recomp/baseline', {'classic-modes.json'})]:
        target = kit / relative
        target.mkdir()
        for source in (source_kit / relative).iterdir():
            if source.name not in excluded and source.name != '__pycache__':
                (target / source.name).symlink_to(source, target_is_directory=source.is_dir())
        cache = source_kit / relative / '__pycache__'
        if cache.is_dir():
            (target / '__pycache__').mkdir()
            for source in cache.glob('*.pyc'):
                if not source.stat().st_flags & 0x40000000:
                    (target / '__pycache__' / source.name).write_bytes(source.read_bytes())
    (kit / 'tools/build.py').write_bytes((source_kit / 'tools/build.py').read_bytes())
    (kit / 'tools/recomp/baseline/classic-modes.json').write_bytes(resource_modes.read_bytes())
    (game_view / 'tools').unlink()
    (game_view / 'tools').mkdir()
    for source in (GAME / 'tools').iterdir():
        if source.name not in ('build.py', '__pycache__'):
            (game_view / 'tools' / source.name).symlink_to(source, target_is_directory=source.is_dir())
    (game_view / 'tools/build.py').write_bytes((GAME / 'tools/build.py').read_bytes())
    return dict(packagedResource=str(resource_modes), packagedResourceSha256=expected,
                originalCloudResourcePreserved=True,
                gameToolSha256=sha(game_view / 'tools/build.py'),
                kitToolSha256=sha(kit / 'tools/build.py'),
                officialToolsUnchanged=(sha(game_view / 'tools/build.py') == sha(GAME / 'tools/build.py')
                                        and sha(kit / 'tools/build.py') == sha(source_kit / 'tools/build.py')))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--attempt', type=int, required=True)
    parser.add_argument('--sdk-root', type=Path, default=ROOT / '.tools/emsdk',
                        help='Use an isolated recovery of the exact installed SDK release')
    parser.add_argument('--sdk-python', type=Path,
                        help='Use a resident supported Python interpreter for the recovered SDK')
    parser.add_argument('--resource-modes', type=Path,
                        help='Build through an owned tool view using the recorded packaged display table')
    parser.add_argument('--native-build', type=Path,
                        default=ROOT / 'output/native-world-residency-build-473.json',
                        help='Successful terminal native receipt matching current sources')
    args = parser.parse_args()
    if args.attempt < 1:
        parser.error('Use a positive exclusive build attempt')
    rows = subprocess.check_output(['ps', '-axo', 'pid=,comm='], text=True, timeout=3)
    if any(Path(row.split(None, 1)[1]).name in
           ('pop_smoke', 'clang', 'clang++', 'ninja', 'cmake', 'dx_tests')
           for row in rows.splitlines() if len(row.split(None, 1)) == 2):
        parser.error('Another heavy game/build is live')
    inputs = qualified_native_inputs(args.native_build)
    out = ROOT / f'output/private-resume073-wasm-{args.attempt:03}'
    out.mkdir()
    game_view = Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-web073-', dir=GAME / 'build'))
    # Ordinary files/configs are the actual current Majesty inputs. Directory
    # links retain curated mods/layouts/assets without copying player files.
    for source in GAME.iterdir():
        if source.name.startswith('.') or source.name in ('build', 'kit'):
            continue
        (game_view / source.name).symlink_to(source, target_is_directory=source.is_dir())
    tool_view = private_tool_view(game_view, args.resource_modes) if args.resource_modes else None
    build = game_view / 'build'
    (build / 'recomp').mkdir(parents=True)
    for name in ('gen', 'symbols.json'):
        source = GAME / 'build/recomp' / name
        (build / 'recomp' / name).symlink_to(source, target_is_directory=source.is_dir())
    sdk = args.sdk_root.resolve()
    env = dict(os.environ)
    python_wrapper = ROOT / 'scripts/python-emsdk-isolated-cache.py'
    env.update(EMSDK=str(sdk), EMSDK_NODE=str(sdk / 'node/24.19.0_64bit/bin/node'),
               EMSDK_PYTHON=str(python_wrapper),
               MAJESTY_EMSDK_PYCACHE=str(out / 'sdk-pycache'),
               EM_CONFIG=str(sdk / '.emscripten'),
               DEVELOPER_DIR='/Library/Developer/CommandLineTools',
               GIT_CEILING_DIRECTORIES=str(GAME / 'build'))
    if args.sdk_python:
        env['MAJESTY_EMSDK_PYTHON'] = str(args.sdk_python.resolve())
    env['PATH'] = str(sdk / 'upstream/emscripten') + os.pathsep + env.get('PATH', '')
    official_tool = (game_view if tool_view else GAME) / 'tools/build.py'
    command = [sys.executable, str(official_tool), '--game-dir', str(game_view),
               '--target', 'app', '--preset', 'resume073-web-checks', '--jobs', '1']
    report = dict(gameView=str(game_view), buildRoot=str(build), officialTool=str(GAME / 'tools/build.py'),
                  target='recomp_app', privatePreset='resume073-web-checks', maximumBuildJobs=1,
                  conservativeHeapGrowth=True, published=False, browserUsed=False,
                  generatedTranslationsEdited=False, wasmBuildQualified=False,
                  sourceInputs=inputs, presetSha256=sha(GAME / 'kit/CMakeUserPresets.json'),
                  pythonCacheWrapperSha256=sha(python_wrapper),
                  aggregateRssCeilingBytes=1536 * 1024 * 1024,
                  sdkConfigurationSha256=sha(sdk / '.emscripten'))
    report.update(sdkRoot=str(sdk), sdkPython=env.get('MAJESTY_EMSDK_PYTHON'))
    report.update(nativeBuildEvidence=str(args.native_build), nativeBuildReceiptSha256=sha(args.native_build))
    report.update(officialToolInvoked=str(official_tool), privateToolView=tool_view)
    log = out / 'build.log'
    receipt = out / 'build.json'
    (out / 'build-driver.py').write_bytes(Path(__file__).read_bytes())
    with log.open('x') as sink:
        process = subprocess.Popen(command, cwd=GAME, env=env, stdout=sink,
                                   stderr=subprocess.STDOUT, start_new_session=True)
        report.update(pid=process.pid, startedAtMs=time.time_ns() // 1000000)
        receipt.write_text(json.dumps(report, indent=2) + '\n')
        deadline = time.monotonic() + 1200
        reason = None
        peak = 0
        children = []
        try:
            while process.poll() is None:
                usage = subprocess.run(['ps', '-axo', 'pid=,ppid=,pgid=,rss='],
                                       capture_output=True, text=True, timeout=3)
                rows = [dict(pid=int(v[0]), parent=int(v[1]), group=int(v[2]), rss=int(v[3]) * 1024)
                        for line in usage.stdout.splitlines() if len(v := line.split()) == 4]
                children = owned_processes(rows, process.pid)
                aggregate = sum(row['rss'] for row in children)
                peak = max(peak, aggregate)
                if log.stat().st_size > 4 * 1024 * 1024:
                    reason = 'log-ceiling'
                elif aggregate > report['aggregateRssCeilingBytes']:
                    reason = 'aggregate-rss-ceiling'
                elif time.monotonic() > deadline:
                    reason = '20-minute-build-deadline'
                if reason:
                    break
                time.sleep(.5)
        finally:
            if process.poll() is None:
                groups = {process.pid} | {row['group'] for row in children}
                for group in groups:
                    try:
                        os.killpg(group, signal.SIGTERM)
                    except ProcessLookupError:
                        pass
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    for group in groups:
                        try:
                            os.killpg(group, signal.SIGKILL)
                        except ProcessLookupError:
                            pass
                    process.wait(timeout=3)
    report.update(exitCode=process.returncode, stopReason=reason, peakAggregateRssBytes=peak,
                  finishedAtMs=time.time_ns() // 1000000, logSha256=sha(log),
                  sourceInputsUnchanged=all(sha(ROOT / name) == expected for name, expected in inputs.items()))
    artifacts = {}
    for suffix in ('.wasm', '.js', '.data'):
        for path in (build / 'web/recomp').glob('*' + suffix):
            artifacts[str(path)] = dict(bytes=path.stat().st_size, sha256=sha(path))
    report['artifacts'] = artifacts
    report['wasmBuildQualified'] = (process.returncode == 0 and reason is None and
                                     report['sourceInputsUnchanged'] and
                                     any(name.endswith('.wasm') for name in artifacts))
    receipt.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in ('exitCode', 'stopReason', 'wasmBuildQualified')}))
    return 0 if report['wasmBuildQualified'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
