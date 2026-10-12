#!/usr/bin/env python3
"""Recruit a living hero through the original UI in an initialized kingdom.

Own a fresh native profile and keep all source saves/settings immutable. This
does not enable region travel or bypass the browser launch suspension.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'
spec = importlib.util.spec_from_file_location('hero_helpers', ROOT / 'scripts/run-native-reconciled-terrain.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
sha = helper.sha
SETTINGS = ['mod-settings.json', 'Documents/My Games/MajestyHD/MajXPrefs',
            'Documents/My Games/MajestyHD/questdata_majx.sav']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('initialization_manifest', type=Path)
    parser.add_argument('--attempt', type=int, required=True)
    parser.add_argument('--recruit-at', nargs=2, type=int, metavar=('X', 'Y'))
    parser.add_argument('--recruit-wait-ms', type=int, default=25000,
                        help='Let original training and AI continue before saving (10000 through 25000 ms)')
    args = parser.parse_args()
    if args.attempt <= 0 or args.recruit_at and not (0 <= args.recruit_at[0] < 200 and 180 <= args.recruit_at[1] < 425):
        parser.error('Require a positive attempt and a recruitment point in the original unit panel')
    if not 10000 <= args.recruit_wait_ms <= 25000:
        parser.error('Recruitment continuation exceeds native duration budget')
    report = ROOT / f'output/native-generated-hero-attempt-{args.attempt:03}.json'
    log = report.with_suffix('.log')
    if report.exists() or log.exists():
        parser.error('Preserve previous attempts')
    helper.ensure_idle()
    manifest_path = args.initialization_manifest.resolve()
    meta_source = json.loads(manifest_path.read_text())
    profile_source = Path(meta_source['profile']).resolve()
    if (not meta_source.get('nativeSessionTerminal') or meta_source.get('nativeExitCode') != 0 or
            meta_source.get('generatedRegionInitialization') != 'v1' or
            not profile_source.is_relative_to(GAME / 'build') or
            not profile_source.parent.name.startswith('actor-arrival-fixture-connected-residency-')):
        parser.error('Require an owned stopped initialized-region producer')
    # Revalidate original causes, zero-tick publication, returns and provenance
    # before using that publication as a live gameplay starting point.
    check = "import {inspectConnectedLoadTransforms as inspect} from './scripts/inspect-native-connected-load-transforms.mjs'; const r=await inspect(process.argv[1],process.argv[2]); console.log(JSON.stringify({qualified:r.generatedRegionInitializationQualified}));"
    result = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', check,
        str(manifest_path), str(ROOT / 'output/native-connected-load-transforms-setter-audit.json')], cwd=ROOT, text=True))
    if result.get('qualified') is not True:
        parser.error('Generated initialization failed independent verification')
    build_path = Path(meta_source['buildReport'])
    build = json.loads(build_path.read_text())
    executable = GAME / 'build/recomp/pop_smoke'
    if not build.get('nativeBuildQualified') or sha(executable) != build['nativeExecutableSha256']:
        parser.error('Require the current qualified native build')
    for name, digest in build['nativeSourceSha256'].items():
        if sha(ROOT / name) != digest:
            parser.error('Native sources changed since build')
    saved = profile_source / 'Residency_Visit_1_After.GMP'
    run = Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-generated-hero-', dir=GAME / 'build'))
    profile = run / 'frontier_0_0'
    profile.mkdir()
    inputs = {}
    for name in SETTINGS:
        original = profile_source / name
        expected = meta_source['inputHashes'][name]
        if sha(original) != expected:
            parser.error('Original settings changed')
        dest = profile / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original, dest)
        if sha(dest) != expected:
            parser.error('Copied settings differ')
        inputs[name] = expected
    saves = profile / 'Documents/My Games/MajestyHD/SaveGame'
    saves.mkdir(parents=True)
    copied = saves / 'Hero_Starting_Realm.GMP'
    saved_sha = sha(saved)
    shutil.copy2(saved, copied)
    if sha(copied) != saved_sha:
        parser.error('Copied initialized kingdom differs')
    for name in ['frames', 'user-mods']:
        (run / name).mkdir()
    steps = ['wait 10000']
    def click(x, y, delay=1000):
        steps.extend([f'move {x} {y}', 'wait 100', 'button left down', 'wait 100', 'button left up', f'wait {delay}'])
    click(92, 578)
    click(150, 565, 10000)
    steps.append('dump generated_hero_loaded')
    # Known stopped native rendering of region0_0 places its existing Warriors
    # Guild here. The screenshot is checked before choosing recruitment input.
    click(630, 100)
    steps.append('dump generated_hero_guild')
    if args.recruit_at:
        click(*args.recruit_at, delay=args.recruit_wait_ms)
        steps.append('dump generated_hero_recruited')
    click(750, 585)
    click(350, 265)
    click(150, 565, 2000)
    steps.extend(['dump generated_hero_saved', 'wait 3000'])
    script = run / 'recruit-save.script'
    script.write_text('\n'.join(steps) + '\n')
    meta = dict(nativeOnly=True, browserUsed=False, nativeSessionTerminal=False, nativeExitCode=None,
        fixture=str(run), profile=str(profile), sourceManifest=str(manifest_path), sourceManifestSha256=sha(manifest_path),
        initializedSource=str(saved), initializedSourceSha256=saved_sha, inputHashes=inputs,
        buildReport=str(build_path), buildReportSha256=sha(build_path), nativeSourceSha256=build['nativeSourceSha256'],
        nativeExecutableSha256=sha(executable), script=str(script), scriptSha256=sha(script), log=str(log),
        recruitAt=args.recruit_at, recruitWaitMs=args.recruit_wait_ms, diagnosticHooksRequested=False, fixtureActorChangesRequested=False,
        resourceSamples=[], rssCeilingBytes=512 * 1024 * 1024, stopReason=None)
    env = {key: value for key, value in os.environ.items() if not key.startswith('RECOMP_')}
    env.update(RECOMP_PROFILE_DIR=str(profile), RECOMP_RULE_FRONTIER_REGION='0_0', RECOMP_RULE_INVENTORY_COMPAT='1',
        RECOMP_GUEST_ARGS='-nointro -dochecksums', RECOMP_SMOKE_SECONDS='65', RECOMP_SMOKE_WINDOW_INPUT='1',
        RECOMP_SMOKE_DRAWABLE='800x600', RECOMP_CORE_MODS_DIR=str(GAME / 'build/recomp/mods/core'),
        RECOMP_MODS_DIR=str(run / 'user-mods'), RECOMP_HOST_DUMP_DIR=str(run / 'frames'), RECOMP_SCRIPT=str(script))
    helper.ensure_idle()
    with log.open('x') as output:
        process = subprocess.Popen([str(executable)], cwd=GAME / 'kit', env=env, stdout=output, stderr=subprocess.STDOUT)
        meta.update(nativePid=process.pid, startedAtMs=time.time_ns() // 1000000)
        report.write_text(json.dumps(meta, indent=2) + '\n')
        print(json.dumps(dict(nativePid=process.pid, fixture=run.name)), flush=True)
        deadline = time.monotonic() + 95
        while process.poll() is None:
            try:
                row = subprocess.check_output(['ps', '-p', str(process.pid), '-o', 'pid=,rss=,%cpu='], text=True, timeout=2).split()
                if len(row) != 3 or int(row[0]) != process.pid:
                    raise RuntimeError('Missing exact-PID sample')
                sample = dict(pid=process.pid, sampledAtMs=time.time_ns() // 1000000,
                              rssBytes=int(row[1]) * 1024, cpuPercent=float(row[2]))
                meta['resourceSamples'].append(sample)
                if sample['rssBytes'] > meta['rssCeilingBytes']:
                    meta['stopReason'] = 'native-rss-ceiling'
                if time.monotonic() > deadline:
                    meta['stopReason'] = 'native-duration-ceiling'
            except (subprocess.SubprocessError, ValueError, RuntimeError) as error:
                if process.poll() is None:
                    meta['stopReason'] = type(error).__name__
            if meta['stopReason']:
                process.terminate()
            report.write_text(json.dumps(meta, indent=2) + '\n')
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                if meta['stopReason']:
                    process.kill()
        code = process.wait()
    meta.update(nativeSessionTerminal=True, nativeExitCode=code, finishedAtMs=time.time_ns() // 1000000,
        initializedSourceUnchanged=sha(saved) == saved_sha,
        originalSettingsUnchanged=all(sha(profile_source / name) == digest for name, digest in inputs.items()),
        saves=[dict(filename=str(path), bytes=path.stat().st_size, sha256=sha(path)) for path in sorted(saves.glob('*.GMP'))],
        frames=[str(path) for path in sorted((run / 'frames').glob('*.ppm'))])
    report.write_text(json.dumps(meta, indent=2) + '\n')
    print(json.dumps(dict(nativeSessionTerminal=True, nativeExitCode=code, saves=len(meta['saves']))), flush=True)
    raise SystemExit(code)


if __name__ == '__main__':
    main()
