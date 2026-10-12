#!/usr/bin/env python3
"""Load a private height-reconciled draft and save through the original menu.

No diagnostic hooks or actor fixtures are installed. Input settings and drafts
must match the recorded producers; only an owned temporary profile is writable.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for part in iter(lambda: stream.read(4096), b''):
            digest.update(part)
    return digest.hexdigest()


def ensure_idle():
    rows = subprocess.check_output(['ps', '-axo', 'pid=,comm='], text=True).splitlines()
    for row in rows:
        fields = row.split(None, 1)
        if len(fields) == 2 and Path(fields[1]).name in ['pop_smoke', 'clang', 'clang++', 'ninja']:
            raise RuntimeError('Another native game or build is live')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--attempt', type=int, required=True)
    parser.add_argument('--stage', choices=['Before', 'After'], default='Before')
    args = parser.parse_args()
    if args.attempt <= 0:
        parser.error('Attempt must be positive')
    report = ROOT / f'output/native-reconciled-terrain-attempt-{args.attempt:03}.json'
    log = report.with_suffix('.log')
    if report.exists() or log.exists():
        parser.error('Preserve prior attempts')
    ensure_idle()
    build_file = ROOT / 'output/native-world-residency-build-024.json'
    build = json.loads(build_file.read_text())
    executable = GAME / 'build/recomp/pop_smoke'
    if not build.get('nativeBuildQualified') or build.get('exitCode') != 0 or sha(executable) != build['nativeExecutableSha256']:
        parser.error('Current native executable differs from its qualified build')
    for name, digest in build['nativeSourceSha256'].items():
        if sha(ROOT / name) != digest:
            parser.error('Current native sources differ from their qualified build')
    drafts_file = ROOT / 'output/native-terrain-reconcile-real-files-observed.json'
    drafts = json.loads(drafts_file.read_text())
    if drafts.get('passed') is not True or drafts.get('originalFilesUnchanged') is not True:
        parser.error('Require previously checked private draft inputs')
    case = next(case for case in drafts['cases'] if case['stage'] == args.stage)
    draft = Path(case['draftFile']).resolve()
    if not draft.is_relative_to(ROOT / 'output') or sha(draft) != case['report']['sha256'] or draft.stat().st_size != case['report']['size']:
        parser.error('Private reconciled draft changed')
    settings_file = ROOT / 'output/native-world-persistence-attempt-017.json'
    settings_meta = json.loads(settings_file.read_text())
    source_profile = Path(settings_meta['profile']).resolve()
    if (not settings_meta.get('nativeSessionTerminal') or settings_meta.get('nativeExitCode') != 0 or
            not source_profile.is_relative_to(GAME / 'build') or source_profile.name != 'frontier_0_0'):
        parser.error('Require an owned completed settings producer')
    run = Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-terrain-reload-', dir=GAME / 'build'))
    profile = run / 'frontier_0_0'
    profile.mkdir()
    settings_hashes = {}
    for name in ['mod-settings.json', 'Documents/My Games/MajestyHD/MajXPrefs', 'Documents/My Games/MajestyHD/questdata_majx.sav']:
        expected = settings_meta['inputHashes'][name]
        if sha(source_profile / name) != expected:
            parser.error('Copied producer settings changed')
        target = profile / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_profile / name, target)
        if sha(target) != expected:
            parser.error('Settings changed during copy')
        settings_hashes[name] = expected
    saves = profile / 'Documents/My Games/MajestyHD/SaveGame'
    saves.mkdir(parents=True)
    copied = saves / 'Border_Test.GMP'
    shutil.copy2(draft, copied)
    if sha(copied) != case['report']['sha256']:
        parser.error('Draft changed during copy')
    for directory in ['user-mods', 'frames']:
        (run / directory).mkdir()
    script = run / 'load-save.script'
    steps = ['wait 10000']
    def click(x, y, wait=1000):
        steps.extend([f'move {x} {y}', 'wait 100', 'button left down', 'wait 100', 'button left up', f'wait {wait}'])
    click(92, 578)
    click(150, 565, 10000)
    steps.append('dump border_loaded')
    click(750, 585)
    click(350, 265)
    steps.append('dump border_save_dialog')
    click(150, 565, 2000)
    steps.extend(['dump border_saved', 'wait 3000', 'dump border_final'])
    script.write_text('\n'.join(steps) + '\n')
    meta = dict(nativeOnly=True, browserUsed=False, nativeSessionTerminal=False,
        nativeExitCode=None, stage=args.stage, fixture=str(run), profile=str(profile),
        inputDraft=str(draft), inputDraftSha256=sha(draft), inputDraftBytes=draft.stat().st_size,
        sourceDraftReport=str(drafts_file), sourceDraftReportSha256=sha(drafts_file),
        buildReport=str(build_file), buildReportSha256=sha(build_file),
        nativeExecutableSha256=sha(executable), nativeSourceSha256=build['nativeSourceSha256'],
        settingsProducer=str(settings_file), settingsProducerSha256=sha(settings_file),
        settingsHashes=settings_hashes, script=str(script), scriptSha256=sha(script),
        log=str(log), resourceSamples=[], rssCeilingBytes=512 * 1024 * 1024,
        stopReason=None, diagnosticHooksRequested=False, fixtureActorChangesRequested=False)
    env = {key: value for key, value in os.environ.items() if not key.startswith('RECOMP_')}
    env.update(RECOMP_PROFILE_DIR=str(profile), RECOMP_RULE_FRONTIER_REGION='0_0',
        RECOMP_RULE_INVENTORY_COMPAT='1', RECOMP_GUEST_ARGS='-nointro -dochecksums',
        RECOMP_SMOKE_SECONDS='40', RECOMP_SMOKE_WINDOW_INPUT='1', RECOMP_SMOKE_DRAWABLE='800x600',
        RECOMP_CORE_MODS_DIR=str(GAME / 'build/recomp/mods/core'), RECOMP_MODS_DIR=str(run / 'user-mods'),
        RECOMP_HOST_DUMP_DIR=str(run / 'frames'), RECOMP_SCRIPT=str(script))
    ensure_idle()
    if sha(executable) != meta['nativeExecutableSha256'] or sha(draft) != meta['inputDraftSha256']:
        parser.error('Native executable or draft changed before launch')
    with log.open('x') as output:
        process = subprocess.Popen([str(executable)], cwd=GAME / 'kit', env=env, stdout=output, stderr=subprocess.STDOUT)
        meta.update(nativePid=process.pid, startedAtMs=time.time_ns() // 1000000)
        report.write_text(json.dumps(meta, indent=2) + '\n')
        print(json.dumps(dict(nativePid=process.pid, fixture=run.name)), flush=True)
        deadline = time.monotonic() + 90
        while process.poll() is None:
            try:
                sample = subprocess.check_output(['ps', '-p', str(process.pid), '-o', 'pid=,rss=,%cpu='], text=True, timeout=2).split()
                if len(sample) != 3 or int(sample[0]) != process.pid:
                    raise RuntimeError('Missing exact native resource sample')
                meta['resourceSamples'].append(dict(pid=process.pid, rssBytes=int(sample[1]) * 1024, cpuPercent=float(sample[2])))
                if meta['resourceSamples'][-1]['rssBytes'] > meta['rssCeilingBytes']:
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
        originalDraftUnchanged=sha(draft) == meta['inputDraftSha256'],
        saves=[dict(filename=str(path), bytes=path.stat().st_size, sha256=sha(path)) for path in sorted(saves.glob('*.GMP'))],
        frames=[str(path) for path in sorted((run / 'frames').iterdir())])
    report.write_text(json.dumps(meta, indent=2) + '\n')
    print(json.dumps(dict(nativeSessionTerminal=True, nativeExitCode=code, saves=len(meta['saves']), originalDraftUnchanged=meta['originalDraftUnchanged'])), flush=True)
    raise SystemExit(code)


if __name__ == '__main__':
    main()
