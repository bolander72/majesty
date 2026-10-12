#!/usr/bin/env python3
"""Initialize and revisit an original generated neighbor pair without advancing its first attachment."""
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
spec = importlib.util.spec_from_file_location('connected_helpers', ROOT / 'scripts/run-native-reconciled-terrain.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
sha = helper.sha
SETTINGS = ['mod-settings.json', 'Documents/My Games/MajestyHD/MajXPrefs',
            'Documents/My Games/MajestyHD/questdata_majx.sav']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('build_report', type=Path)
    parser.add_argument('first_region', type=Path)
    parser.add_argument('second_region', type=Path)
    parser.add_argument('--attempt', type=int, required=True)
    parser.add_argument('--visits', type=int, default=4)
    parser.add_argument('--observe-load-transforms', action='store_true', default=True,
                        help='Observe original selection, mini-view and terrain reveal changes; never repair them')
    parser.add_argument('--initialize-generated-regions', action='store_true', default=True,
                        help='Publish the first two attached kingdoms before any simulation tick, then revisit them')
    args = parser.parse_args()
    if args.attempt <= 0 or not 3 <= args.visits <= 8:
        parser.error('Positive fresh attempt and 3 through 8 visits required')
    if args.initialize_generated_regions and (args.visits < 4 or not args.observe_load_transforms):
        parser.error('Initialization requires both revisits and original load-transform observation')
    report = ROOT / f'output/native-connected-initialization-attempt-{args.attempt:03}.json'
    log = report.with_suffix('.log')
    if report.exists() or log.exists():
        parser.error('Preserve previous attempts')
    helper.ensure_idle()
    # Reinspect the actual stopped generated saves, including their complete
    # edge and file identity, before accepting them as immutable inputs.
    paths = [args.first_region.resolve(), args.second_region.resolve()]
    pair = json.loads(subprocess.check_output(
        ['node', str(ROOT / 'scripts/inspect-native-connected-terrain.mjs'), *map(str, paths)], text=True))
    if len(pair['seams']) != 1 or not pair['seams'][0]['matchingHeightBits']:
        parser.error('Require independently qualified neighboring generated kingdoms')
    regions = [json.loads(path.read_text()) for path in paths]
    coordinates = [region['region'] for region in regions]
    if coordinates != [case['region'] for case in pair['cases']]:
        parser.error('Generated report coordinates differ from the inspected saved terrain')
    if args.visits != 4:
        parser.error('Qualification requires two zero-tick initialization visits and two warm returns')
    for region in regions:
        profile = Path(region['profile']).resolve()
        if (not profile.is_relative_to(GAME / 'build') or
            not profile.parent.name.startswith('actor-arrival-fixture-connected-terrain-') or
            profile.name != 'frontier_' + region['region']):
            parser.error('Require owned generated profiles')
    if regions[0]['inputHashes'] != regions[1]['inputHashes']:
        parser.error('Generated kingdoms have different starting settings')
    build_path = args.build_report.resolve()
    build = json.loads(build_path.read_text())
    executable = GAME / 'build/recomp/pop_smoke'
    if not build.get('nativeBuildQualified') or build.get('exitCode') != 0 or sha(executable) != build['nativeExecutableSha256']:
        parser.error('Require current qualified native build')
    for name, digest in build['nativeSourceSha256'].items():
        if sha(ROOT / name) != digest:
            parser.error('Native source changed since build')
    if args.observe_load_transforms:
        symbols_file = GAME / 'build/recomp/gen/symbols.json'
        if sha(symbols_file) != build.get('nativeSymbolsSha256'):
            parser.error('Require recorded current symbols for load-transform observation')
        entries = {row['addr']: row for row in json.loads(symbols_file.read_text())['functions']}
        for address in ['005b6a80', '005afe20', '00438ac0']:
            entry = entries.get(address, {})
            if entry.get('kind') != 'entry' or not entry.get('hookable'):
                parser.error(f'Original load observer entry {address} is not declared; regenerate through the official tool')
    run = Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-connected-residency-', dir=GAME / 'build'))
    profile = run / 'frontier_0_0'
    profile.mkdir()
    inputs = {}
    original = Path(regions[0]['profile'])
    for name in SETTINGS:
        expected = regions[0]['inputHashes'][name]
        if sha(original / name) != expected:
            parser.error('Generated settings changed')
        target = profile / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original / name, target)
        if sha(target) != expected:
            parser.error('Copied settings differ')
        inputs[name] = expected
    for side, region in enumerate(regions):
        saved = region['saves'][0]
        if sha(Path(saved['filename'])) != saved['sha256']:
            parser.error('Generated save changed before copying')
        for kind in ['Source', 'Initial']:
            name = f'Residency_{kind}_{side}.GMP'
            shutil.copy2(saved['filename'], profile / name)
            if sha(profile / name) != saved['sha256']:
                parser.error('Copied generated save differs')
            inputs[name] = saved['sha256']
    menu_name = 'Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP'
    (profile / menu_name).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(profile / 'Residency_Source_1.GMP', profile / menu_name)
    inputs[menu_name] = sha(profile / menu_name)
    for name in ['frames', 'user-mods']:
        (run / name).mkdir()
    click = lambda x, y: f'move {x} {y}\nwait 100\nbutton left down\nwait 100\nbutton left up\n'
    script = run / 'load-replace.script'
    script.write_text('wait 10000\n' + ''.join(
        click(92, 578) + 'wait 1000\n' + click(150, 565) + 'wait 10000\n' +
        f'dump connected_residency_menu_{visit}\n' for visit in range(args.visits)))
    seconds = 10 + 12 * args.visits + 20
    meta = dict(nativeOnly=True, browserUsed=False, connectedResidencyVersion='v1',
                generatedRegionInitialization='v1' if args.initialize_generated_regions else None,
                completedTicksByVisit=[0 if args.initialize_generated_regions and visit < 2 else 20
                                       for visit in range(args.visits)],
                connectedLoadTransformObservation='v2' if args.observe_load_transforms else None,
                nativeSessionTerminal=False, nativeExitCode=None, fixture=str(run), profile=str(profile),
                regionReports=[str(path) for path in paths], regionReportSha256=[sha(path) for path in paths],
                generatedPairInspection=pair, regions=coordinates,
                runnerSha256=sha(Path(__file__)),
                loadSequence=[1 if visit % 2 == 0 else 0 for visit in range(args.visits)],
                loadExtents=[256] * args.visits, observedTicksPerLoad=20,
                inputHashes=inputs, buildReport=str(build_path), buildReportSha256=sha(build_path),
                nativeExecutableSha256=sha(executable), nativeSourceSha256=build['nativeSourceSha256'],
                nativeSymbolsSha256=build.get('nativeSymbolsSha256'),
                script=str(script), scriptSha256=sha(script), smokeSeconds=seconds, log=str(log),
                resourceSamples=[], rssCeilingBytes=512 * 1024 * 1024, stopReason=None)
    env = {key: value for key, value in os.environ.items() if not key.startswith('RECOMP_')}
    env.update(RECOMP_PROFILE_DIR=str(profile), RECOMP_RULE_FRONTIER_REGION='0_0',
               RECOMP_RULE_INVENTORY_COMPAT='1', RECOMP_BROWSER_STREAMING_DEBUG='1',
               RECOMP_BROWSER_STREAMING_WORLD_RESIDENCY_FIXTURE='1',
               RECOMP_BROWSER_STREAMING_WORLD_PERSISTENCE_FIXTURE='1',
               RECOMP_BROWSER_STREAMING_CONNECTED_RESIDENCY_FIXTURE='v1',
               RECOMP_BROWSER_STREAMING_WORLD_RESIDENCY_VISITS=str(args.visits),
               RECOMP_BROWSER_STREAMING_JOINT_DEPARTED_RELOAD_FIXTURE='1',
               RECOMP_BROWSER_STREAMING_JOINT_EVOLVED_CHECKPOINT_FIXTURE='1',
               RECOMP_GUEST_ARGS='-nointro -dochecksums', RECOMP_SMOKE_SECONDS=str(seconds),
               RECOMP_SMOKE_WINDOW_INPUT='1', RECOMP_SMOKE_DRAWABLE='800x600',
               RECOMP_CORE_MODS_DIR=str(GAME / 'build/recomp/mods/core'),
               RECOMP_MODS_DIR=str(run / 'user-mods'), RECOMP_HOST_DUMP_DIR=str(run / 'frames'),
               RECOMP_SCRIPT=str(script))
    if args.observe_load_transforms:
        env['RECOMP_BROWSER_STREAMING_CONNECTED_LOAD_TRANSFORMS'] = 'v2'
    if args.initialize_generated_regions:
        env['RECOMP_BROWSER_STREAMING_CONNECTED_INITIALIZATION_FIXTURE'] = 'v1'
    helper.ensure_idle()
    if sha(executable) != meta['nativeExecutableSha256']:
        parser.error('Native executable changed before launch')
    with log.open('x') as output:
        meta['startedAtMs'] = time.time_ns() // 1000000
        process = subprocess.Popen([str(executable)], cwd=GAME / 'kit', env=env, stdout=output, stderr=subprocess.STDOUT)
        meta['nativePid'] = process.pid
        report.write_text(json.dumps(meta, indent=2) + '\n')
        print(json.dumps(dict(nativePid=process.pid, fixture=run.name)), flush=True)
        deadline = time.monotonic() + seconds + 30
        while process.poll() is None:
            try:
                fields = subprocess.check_output(['ps', '-p', str(process.pid), '-o', 'pid=,rss=,%cpu='], text=True, timeout=2).split()
                if len(fields) != 3 or int(fields[0]) != process.pid:
                    raise RuntimeError('Missing exact-PID sample')
                sample = dict(sampledAtMs=time.time_ns() // 1000000, pid=process.pid,
                              rssBytes=int(fields[1]) * 1024, cpuPercent=float(fields[2]))
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
    meta.update(nativeExitCode=code, nativeSessionTerminal=True, finishedAtMs=time.time_ns() // 1000000,
                originalSettingsUnchanged=all(sha(original / name) == inputs[name] for name in SETTINGS),
                originalGeneratedSavesUnchanged=all(sha(Path(region['saves'][0]['filename'])) == region['saves'][0]['sha256'] for region in regions),
                frames=[str(path) for path in sorted((run / 'frames').glob('*.ppm'))])
    report.write_text(json.dumps(meta, indent=2) + '\n')
    print(json.dumps(dict(nativeSessionTerminal=True, nativeExitCode=code)), flush=True)
    raise SystemExit(code)


if __name__ == '__main__':
    main()
