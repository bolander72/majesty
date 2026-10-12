#!/usr/bin/env python3
"""Exercise one complete restored profile with a source-qualified native game.

This is a bounded original UI trial, never a substitute for paired co-op.
Only an exclusive working copy is writable; the restored collection is retained.
"""
import argparse
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import tempfile
import time
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(65536), b''):
            digest.update(chunk)
    return digest.hexdigest()


@contextmanager
def owned_lobby(enabled, out):
    """A loopback transport with no reference player or second game world."""
    if not enabled:
        yield None
        return
    helper = ROOT / 'scripts/run-owned-native-relay073.py'
    ready = out / 'relay-ready.json'
    with (out / 'relay.log').open('x') as sink:
        relay = subprocess.Popen([os.sys.executable, str(helper), '--ready-file', str(ready)],
                                 cwd=ROOT, stdout=sink,
                                 stderr=subprocess.STDOUT, start_new_session=True)
        try:
            deadline = time.monotonic() + 5
            while True:
                if relay.poll() is not None:
                    raise RuntimeError('Owned loopback relay exited before readiness')
                if ready.exists():
                    metadata = json.loads(ready.read_text())
                    if metadata['pid'] != relay.pid:
                        raise RuntimeError('Owned relay readiness identity differs')
                    break
                if time.monotonic() > deadline:
                    raise RuntimeError('Owned loopback relay readiness timed out')
                time.sleep(.1)
            yield dict(**metadata, helperSha256=sha(helper),
                       productionRelaySha256=sha(ROOT / 'scripts/room_relay.py'), referencePlayer=False)
        finally:
            if relay.poll() is None:
                os.killpg(relay.pid, signal.SIGTERM)
                try:
                    relay.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    os.killpg(relay.pid, signal.SIGKILL)
                    relay.wait(timeout=3)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--attempt', type=int, required=True)
    parser.add_argument('--build-report', type=Path, required=True)
    parser.add_argument('--backup-report', type=Path, required=True)
    parser.add_argument('--profile', choices=['resume073-host', 'resume073-guest'], required=True)
    parser.add_argument('--script', type=Path, required=True)
    parser.add_argument('--resource-modes', type=Path,
                        help='Use an existing packaged display-mode table in the isolated resources directory')
    parser.add_argument('--lobby', action='store_true',
                        help='Start an owned loopback relay for original multiplayer UI; no peer is supplied')
    parser.add_argument('--paired-context', type=Path,
                        help='Explicit qualified-build context for an actual local browser partner')
    parser.add_argument('--seconds', type=int, default=25)
    parser.add_argument('--diagnose-startup', action='store_true',
                        help='Capture one short native stack sample if startup produces no frame')
    args = parser.parse_args()
    if args.attempt < 1 or not 5 <= args.seconds <= 90:
        parser.error('Use a positive attempt and a 5–90 second trial')
    for path in (args.build_report, args.backup_report, args.script):
        if not path.resolve().is_relative_to(ROOT) or path.is_symlink():
            parser.error('Use owned workspace inputs')
    rows = subprocess.check_output(['ps', '-axo', 'pid=,comm='], text=True, timeout=3)
    if any(Path(row.split(None, 1)[1]).name in
           ('pop_smoke', 'clang', 'clang++', 'ninja', 'cmake', 'dx_tests')
           for row in rows.splitlines() if len(row.split(None, 1)) == 2):
        parser.error('Another heavy native process is live')
    build = json.loads(args.build_report.read_text())
    executable = GAME / 'build/recomp/pop_smoke'
    if not build.get('nativeBuildQualified') or sha(executable) != build['nativeExecutableSha256']:
        parser.error('Require the current successful official build')
    sources = {}
    for key in ('nativeSourceSha256', 'nativeHeapRuntimeSourceSha256',
                'nativeCheckpointRuntimeSourceSha256', 'nativeOrderRuntimeSourceSha256'):
        sources.update(build[key])
    if any(sha(ROOT / name) != digest for name, digest in sources.items()):
        parser.error('Compiled inputs changed after qualification')
    pinned = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
    if sha(GAME / 'original/gog/MajestyHD - Old.exe') != pinned:
        parser.error('The original executable differs from the pinned input')
    paired = None
    if args.paired_context:
        if args.lobby or args.paired_context.is_symlink() or not args.paired_context.resolve().is_relative_to(ROOT / 'output'):
            parser.error('Use an owned paired context and its existing owned relay')
        paired = json.loads(args.paired_context.read_text())
        wasm_report = json.loads((ROOT / paired['wasmBuildEvidence']).read_text())
        if (not wasm_report.get('wasmBuildQualified') or
                paired['nativeExecutableSha256'] != build['nativeExecutableSha256']):
            parser.error('Both paired builds must be qualified')
        switches = paired['environment']
        allowed = {'RECOMP_NETWORK_URL', 'RECOMP_NETWORK_MANIFEST', 'RECOMP_CONTENT_IDENTITY', 'RECOMP_COOP_RESUME'}
        allowed.update('RECOMP_' + key for key in ('RULE_FRONTIER_CHAPTER', 'RULE_INVENTORY_COMPAT',
            'RULE_COOP_WORLD', 'RULE_COOP_REGION', 'RULE_COOP_REGION_GENERATION', 'RULE_COOP_FRESH_GENERATION',
            'RULE_COOP_TRANSITION_PAUSE', 'RULE_COOP_CHECKPOINT', 'RULE_COOP_SHARED_READ'))
        endpoint = urlparse(switches.get('RECOMP_NETWORK_URL', ''))
        manifest = switches.get('RECOMP_NETWORK_MANIFEST', '').split(':')
        if (set(switches) != allowed or endpoint.scheme != 'ws' or endpoint.hostname != '127.0.0.1' or
                endpoint.path != '/rooms' or endpoint.username or endpoint.password or
                len(manifest) != 3 or manifest[1] != pinned or
                any(len(part) != 64 or any(ch not in '0123456789abcdef' for ch in part) for part in manifest)):
            parser.error('Invalid bounded local paired environment')
        if manifest[0] != paired['wasmSha256']:
            parser.error('Paired transport identity differs from its explicitly selected WASM build')
        if not any(Path(path).suffix == '.wasm' and artifact['sha256'] == manifest[0]
                   for path, artifact in wasm_report['artifacts'].items()):
            parser.error('Paired WASM identity is absent from the successful build receipt')
    backup = json.loads(args.backup_report.read_text())
    if backup.get('nativeFileHashesEqual') is not True:
        parser.error('Require a hash-qualified complete restored collection')
    collection = Path(backup['collection']).resolve()
    if not collection.is_relative_to(GAME / 'build') or not any(
            part.startswith('actor-arrival-fixture-backup073-') for part in collection.parts):
        parser.error('Require the owned backup restoration fixture')
    selected = [record for record in backup['nativeFiles']
                if record['path'].startswith(args.profile + '/')]
    if not selected or len(selected) > 64:
        parser.error('Invalid bounded restored profile')
    inputs = {}
    for record in selected:
        relative = Path(record['path']).relative_to(args.profile)
        source = collection / 'profile' / record['path']
        if ('..' in relative.parts or source.is_symlink() or
                source.resolve() != source or str(source) != record['filename'] or
                source.stat().st_size != record['bytes'] or
                sha(source) != record['sha256']):
            parser.error('Restored profile custody changed')
        inputs[str(relative)] = record['sha256']
    if not {'registry.json', 'mod-settings.json'}.issubset(inputs):
        parser.error('The restored profile is incomplete')
    resource_source = args.resource_modes.resolve() if args.resource_modes else None
    resource_digest = None
    if resource_source:
        if (not resource_source.is_relative_to(GAME / 'build') or
                args.resource_modes.is_symlink() or resource_source.name != 'classic-modes.json' or
                not 0 < resource_source.stat().st_size < 256 * 1024):
            parser.error('Use an existing bounded packaged game resource')
        modes = json.loads(resource_source.read_text())
        if modes.get('schema_version') != 1 or modes.get('native_compatibility') is not True:
            parser.error('Require the native-compatible display-mode table')
        resource_digest = sha(resource_source)
    out = ROOT / f'output/native-restored-backup073-{args.attempt:03}'
    out.mkdir()  # exclusive: retain all earlier evidence
    fixture = Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-restored073-', dir=GAME / 'build'))
    native = fixture / 'native/recomp'
    (native / 'mods').mkdir(parents=True)
    private_executable = native / 'pop_smoke'
    shutil.copy2(executable, private_executable)
    profile = out / 'profile'
    profile.mkdir()
    for name, digest in inputs.items():
        target = profile / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(collection / 'profile' / args.profile / name, target)
        assert sha(target) == digest
    frames = out / 'frames'
    frames.mkdir()
    usermods = out / 'user-mods'
    usermods.mkdir()
    script = out / 'input.script'
    shutil.copy2(args.script, script)
    shutil.copy2(Path(__file__), out / 'runner.py')
    resources = None
    if resource_source:
        resources = out / 'resources'
        resources.mkdir()
        shutil.copy2(resource_source, resources / 'classic-modes.json')
        assert sha(resources / 'classic-modes.json') == resource_digest
        # The smoke host's settings page probes this legacy relative path.
        # Keep the same packaged bytes in its owned working directory too.
        legacy = resources / 'tools/recomp/baseline/classic-modes.json'
        legacy.parent.mkdir(parents=True)
        shutil.copy2(resource_source, legacy)
        assert sha(legacy) == resource_digest
    settings = json.loads((profile / 'mod-settings.json').read_text())
    settings['host.display/frame_limit'] = 2  # registered 60 FPS choice
    (profile / 'mod-settings.json').write_text(json.dumps(settings) + '\n')
    env = {key: value for key, value in os.environ.items() if not key.startswith('RECOMP_')}
    env.update({
        'RECOMP_PROFILE_DIR': str(profile), 'RECOMP_REGISTRY': str(profile / 'registry.json'),
        'RECOMP_GUEST_ARGS': '-nointro -dochecksums',
        'RECOMP_SMOKE_SECONDS': str(args.seconds), 'RECOMP_SMOKE_WINDOW_INPUT': '1',
        'RECOMP_SMOKE_DRAWABLE': '800x600', 'RECOMP_SCRIPT': str(script),
        'RECOMP_HOST_DUMP_DIR': str(frames), 'RECOMP_MODS_DIR': str(usermods),
        'RECOMP_CORE_MODS_DIR': str(GAME / 'build/recomp/mods/core'),
    })
    if paired:
        env.update(paired['environment'])
    if resources:
        env['RECOMP_RESOURCES_DIR'] = str(resources)
    report = dict(buildReport=str(args.build_report.resolve()), buildReportSha256=sha(args.build_report),
                  pinnedExecutableSha256=pinned,
                  backupReportSha256=sha(args.backup_report), nativeExecutableSha256=sha(private_executable),
                  sourceInputs=sources, profile=args.profile, restoredFileHashes=inputs,
                  workingProfile=str(profile), fixture=str(fixture), scriptSha256=sha(script),
                  nativeProcessesStarted=1, browserUsed=False, liveSecondEngine=False,
                  nativeGameplayQualified=False, pairedResumeQualified=False,
                  packagedModesSource=str(resource_source) if resource_source else None,
                  packagedModesSha256=resource_digest,
                  workingDirectory=str(resources or GAME / 'kit'),
                  rssCeilingBytes=512 * 1024 * 1024, logCeilingBytes=4 * 1024 * 1024)
    if paired:
        report.update(pairedContextSha256=sha(args.paired_context),
                      actualBrowserPartnerPlanned=True, nativeBrowserInteropQualified=False,
                      transportIdentityWasmSha256=paired['wasmSha256'])
    log = out / 'native.log'
    with log.open('x') as sink, owned_lobby(args.lobby, out) as lobby:
        if lobby:
            env['RECOMP_NETWORK_URL'] = lobby['url']
            rules = hashlib.sha256(b'native-lobby-observation-only-v1').hexdigest()
            env['RECOMP_NETWORK_MANIFEST'] = pinned + ':' + build['nativeExecutableSha256'] + ':' + rules
            report['ownedLobby'] = lobby
        process = subprocess.Popen([str(private_executable)], cwd=resources or GAME / 'kit', env=env,
                                   stdout=sink, stderr=subprocess.STDOUT, start_new_session=True)
        report.update(nativePid=process.pid, startedAtMs=time.time_ns() // 1000000)
        report_path = out / 'run.json'
        report_path.write_text(json.dumps(report, indent=2) + '\n')
        deadline = time.monotonic() + args.seconds + 20
        diagnostic_at = time.monotonic() + 12
        diagnostic_done = False
        peak = 0
        reason = None
        try:
            while process.poll() is None:
                usage = subprocess.run(['ps', '-p', str(process.pid), '-o', 'rss='],
                                       capture_output=True, text=True, timeout=3)
                rss = int(usage.stdout.strip() or '0') * 1024
                peak = max(peak, rss)
                if args.diagnose_startup and not diagnostic_done and time.monotonic() > diagnostic_at:
                    diagnostic_done = True
                    if not any(frames.iterdir()) and process.poll() is None:
                        pending = []
                        opened = subprocess.run(['lsof', '-a', '-p', str(process.pid), '-Fn'],
                                                capture_output=True, text=True, timeout=5)
                        for row in opened.stdout.splitlines():
                            if row.startswith('n/'):
                                path = Path(row[1:])
                                if path.is_relative_to(ROOT) and path.exists():
                                    stat = path.stat()
                                    if stat.st_flags & 0x40000000:
                                        pending.append(dict(path=str(path), bytes=stat.st_size))
                        report['pendingCloudFiles'] = pending[:32]
                        sample = out / 'startup.sample.txt'
                        try:
                            result = subprocess.run(['/usr/bin/sample', str(process.pid), '1', '10',
                                                     '-file', str(sample)], capture_output=True,
                                                    text=True, timeout=5)
                            report['startupSampleExitCode'] = result.returncode
                            if sample.exists():
                                report['startupSampleSha256'] = sha(sample)
                        except subprocess.TimeoutExpired:
                            report['startupSampleTimedOut'] = True
                if rss > report['rssCeilingBytes']:
                    reason = 'rss-ceiling'
                elif log.stat().st_size > report['logCeilingBytes']:
                    reason = 'log-ceiling'
                elif time.monotonic() > deadline:
                    reason = 'deadline'
                if reason:
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        process.wait(timeout=3)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait(timeout=3)
                    break
                time.sleep(.5)
        finally:
            # Interrupted diagnostics or tools must not leave this owned game live.
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait(timeout=3)
    unchanged = all(sha(collection / 'profile' / args.profile / name) == digest
                    for name, digest in inputs.items())
    report.update(exitCode=process.returncode, stopReason=reason, peakRssBytes=peak,
                  sourceBackupUnchanged=unchanged, logSha256=sha(log),
                  ownedRelayStopped=True if args.lobby else None,
                  frames=[path.name for path in sorted(frames.iterdir())
                          if path.suffix in ('.png', '.ppm')],
                  finishedAtMs=time.time_ns() // 1000000)
    report_path.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: report[key] for key in
                      ('exitCode', 'stopReason', 'peakRssBytes', 'sourceBackupUnchanged', 'frames')}))
    return 0 if process.returncode == 0 and unchanged and reason is None else 1


if __name__ == '__main__':
    raise SystemExit(main())
