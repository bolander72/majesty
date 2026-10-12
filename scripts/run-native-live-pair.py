#!/usr/bin/env python3
"""Prepare an isolated real-native co-op test; launch only after explicit approval.

Default execution prepares a reviewable plan and starts no game. AGENTS.md's
one-heavy-process constraint requires a human exception before --run-pair.
Browser launch suspension remains in force in either mode.
"""
import argparse
import asyncio
from collections import deque
from contextlib import AsyncExitStack
import hashlib
import importlib.util
import json
import logging
import os
import secrets
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
from websockets.asyncio.server import serve
from websockets.asyncio.client import connect
from lib.native_pair_guard import owned_rows, stop_owned, stop_reason
from lib.native_pair_script import defeat_script, victory_script
from lib.native_public_tunnel import public_tunnel, protected_room_endpoint

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
spec = importlib.util.spec_from_file_location('native_live_pair_relay', ROOT / 'scripts/room_relay.py')
relay = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = relay
spec.loader.exec_module(relay)


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as source:
        while chunk := source.read(4096):
            h.update(chunk)
    return h.hexdigest()


def process_rows():
    raw = subprocess.check_output(['ps', '-axo', 'pid=,ppid=,pgid=,rss=,comm='], text=True, timeout=3)
    rows = []
    for line in raw.splitlines():
        fields = line.split(None, 4)
        if len(fields) == 5:
            rows.append(dict(pid=int(fields[0]), parent=int(fields[1]), group=int(fields[2]),
                             rssBytes=int(fields[3]) * 1024, program=Path(fields[4]).name))
    return rows


class ObservedRelay(relay.Relay):
    """Observe after production dispatch; never replace game payloads or votes."""
    def __init__(self, directory):
        super().__init__()
        self.directory = directory
        self.recent = deque(maxlen=64)
        self.counts = {}
        self.initial = []
        self.failure = None

    def dispatch(self, peer, op, body):
        result = super().dispatch(peer, op, body)
        if op == relay.SEND and result[0] == 0:
            sequence, sender, recipient, flags = (relay.word(body, offset) for offset in [0, 4, 8, 12])
            payload = body[16:]
            category, kind = (relay.word(payload, offset) for offset in [0, 4]) if len(payload) >= 8 else (0, 0)
            key = f'{sender}:{category}:{kind}'
            if key not in self.counts and len(self.counts) >= 64:
                self.failure = 'paired packet kind accounting ceiling'
            else:
                self.counts[key] = self.counts.get(key, 0) + 1
            row = dict(sequence=sequence, sender=sender, recipient=recipient, flags=flags,
                       bytes=len(payload), category=category, kind=kind,
                       sha256=hashlib.sha256(payload).hexdigest())
            self.recent.append(row)
            if category == 0x100 and kind in (2, 3, 0x10, 0x20) and len(self.initial) < 32:
                path = self.directory / f'{sender}-{sequence:05}-{kind:02x}.bin'
                with path.open('xb') as sink:
                    sink.write(payload)
                self.initial.append(dict(row, copy=str(path)))
        return result


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--attempt', type=int, required=True)
    parser.add_argument('--build-report', type=Path, required=True)
    parser.add_argument('--settings-profile', type=Path, required=True)
    parser.add_argument('--coop-chapter', type=int, choices=[1, 2, 3, 4], default=1)
    parser.add_argument('--expected-outcome', choices=['victory', 'defeat'], default='victory')
    parser.add_argument('--surrender-role', choices=['host', 'guest'], help='Defeat test: this original peer requests shared surrender')
    parser.add_argument('--seconds', type=int, default=120)
    parser.add_argument('--run-pair', action='store_true', help='Requires a human exception to AGENTS.md; default only prepares a plan')
    parser.add_argument('--approved-plan', type=Path, help='When running, bind all inputs/bounds to the reviewed preparation report')
    parser.add_argument('--probe-host-only', action='store_true', help='Exercise the isolated host copy only; never starts a second game')
    parser.add_argument('--public-tunnel', action='store_true', help='Use an owned temporary authenticated public TLS route for both real peers')
    args = parser.parse_args()
    out = ROOT / f'output/native-live-pair-{args.attempt:03}'
    if args.attempt < 1 or out.exists() or args.seconds != 120:
        parser.error('Use a fresh attempt and the reviewed120-second deadline')
    if bool(args.approved_plan) != args.run_pair:
        parser.error('--run-pair requires the reviewed --approved-plan; neither implies human authorization')
    if args.probe_host_only and args.run_pair:
        parser.error('A one-producer isolation probe cannot run a pair')
    if args.probe_host_only and args.public_tunnel:
        parser.error('Public transport requires the real paired match')
    if args.expected_outcome == 'defeat':
        if not args.surrender_role or args.coop_chapter == 1 or args.probe_host_only:
            parser.error('Shared defeat requires chapter2..4 and one surrender role; chapter1 can finish before surrender')
    elif args.surrender_role:
        parser.error('--surrender-role requires --expected-outcome defeat')
    profile_source = args.settings_profile.resolve()
    if not profile_source.is_relative_to(GAME / 'build') or not any(part.startswith('actor-arrival-fixture-') for part in profile_source.parts):
        parser.error('Use an owned actor-arrival settings fixture')
    if any(row['program'] in ['pop_smoke', 'ninja', 'cmake', 'clang', 'clang++', 'wasm-opt', 'wasm-ld'] for row in process_rows()):
        parser.error('A native game/build is already live')
    build = json.loads(args.build_report.read_text())
    exe = GAME / 'build/recomp/pop_smoke'
    if not build['nativeBuildQualified'] or sha(exe) != build['nativeExecutableSha256']:
        parser.error('Use the matching successful official native build')
    sources = {}
    for key in ['nativeSourceSha256', 'nativeHeapRuntimeSourceSha256', 'nativeCheckpointRuntimeSourceSha256', 'nativeOrderRuntimeSourceSha256']:
        sources.update(build[key])
    if not all(sha(ROOT / name) == expected for name, expected in sources.items()):
        parser.error('Compiled sources differ from the official build')
    assert sha(GAME / 'original/gog/MajestyHD - Old.exe') == PIN
    settings_names = ['mod-settings.json', 'Documents/My Games/MajestyHD/MajXPrefs', 'Documents/My Games/MajestyHD/questdata_majx.sav']
    settings_before = {name: sha(profile_source / name) for name in settings_names}
    supervisor_names = ['scripts/run-native-live-pair.py', 'scripts/lib/native_pair_guard.py',
                        'scripts/lib/native_pair_script.py',
                        'scripts/room_relay.py', 'upstream/majesty-recomp/kit/runtime/layout.cpp',
                        'upstream/majesty-recomp/smoke/native-live-pair-host.script',
                        'upstream/majesty-recomp/smoke/native-live-pair-guest.script']
    if args.public_tunnel:
        supervisor_names.append('scripts/lib/native_public_tunnel.py')
    supervisor_inputs = {name:sha(ROOT / name) for name in supervisor_names}
    approved = None
    if args.approved_plan:
        path = args.approved_plan.resolve()
        if not path.is_relative_to(ROOT / 'output') or path.stat().st_size > 1024 * 1024:
            parser.error('Use an owned bounded preparation report')
        approved = json.loads(path.read_text())
        expected = dict(sources=sources, nativeExecutableSha256=sha(exe), settingsBefore=settings_before,
                        supervisorInputs=supervisor_inputs, configuredCoopChapter=args.coop_chapter,
                        expectedOutcome=args.expected_outcome, surrenderRole=args.surrender_role,
                        seconds=args.seconds, aggregateRssCeilingBytes=512 * 1024 * 1024,
                        logCeilingBytesPerRole=4 * 1024 * 1024,
                        publicTlsTransportRequested=args.public_tunnel,
                        publicTlsReadinessSeconds=120 if args.public_tunnel else 0)
        if approved.get('nativeProcessesStarted') != 0 or not approved.get('preparationQualified') or any(approved.get(key) != value for key,value in expected.items()):
            parser.error('Current inputs or bounds differ from the reviewed preparation')
    served = {}
    for name in ['MajestyRecomp.wasm', 'MajestyRecomp.js', 'MajestyRecomp.data', 'index.html']:
        path = GAME / 'build/web-site/majesty' / name
        st = path.stat();served[name] = dict(sha256=sha(path), inode=st.st_ino, mtimeNs=st.st_mtime_ns)
    canonical_state = {}
    for name in ['registry.json', 'mods/run.json']:
        path = GAME / 'build/recomp' / name
        canonical_state[name] = sha(path) if path.exists() else None
    out.mkdir()
    for name in ['run-native-live-pair.py', 'room_relay.py', 'lib/native_pair_guard.py', 'lib/native_pair_script.py', 'lib/native_public_tunnel.py']:
        shutil.copy2(ROOT / 'scripts' / name, out / Path(name).name)
    shutil.copy2(args.build_report, out / 'build.json')
    # Developer state normally goes under the executable's build directory,
    # even with PROFILE_DIR. The existing layout supports a private /recomp
    # directory under the game checkout when it contains mods/. Give each
    # producer that directory so registry/run records cannot race or overwrite
    # canonical developer state. The binary remains byte-identical; resources
    # and translated symbols still resolve through the same game checkout.
    native_directory = Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-native-live-pair-', dir=GAME / 'build'))
    roles = {}
    for role in ['host', 'guest']:
        directory = out / role;directory.mkdir()
        private_build = native_directory / role / 'recomp'
        (private_build / 'mods').mkdir(parents=True)
        private_exe = private_build / 'pop_smoke';shutil.copy2(exe, private_exe)
        assert sha(private_exe) == build['nativeExecutableSha256']
        profile = directory / 'owned-profile';profile.mkdir()
        for name in settings_names:
            target = profile / name;target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(profile_source / name, target)
        settings = profile / 'mod-settings.json';value = json.loads(settings.read_text())
        value['host.display/frame_limit'] = 2  # registered60 FPS, same as the qualified single-engine fixture
        settings.write_text(json.dumps(value, indent=2) + '\n')
        script_source = GAME / f'smoke/native-live-pair-{role}.script'
        script = directory / 'input.script';shutil.copy2(script_source, script)
        if args.expected_outcome == 'defeat':
            script.write_text(defeat_script(script.read_text(), role, role == args.surrender_role))
        elif not args.probe_host_only:
            script.write_text(victory_script(script.read_text(), role))
        if args.probe_host_only and role == 'host':
            script.write_text(script.read_text().split('wait 20500\n')[0] + 'wait 5000\ndump isolated_host_lobby\n')
        for name in ['frames', 'user-mods']:(directory / name).mkdir()
        roles[role] = dict(profile=str(profile), privateBuildDirectory=str(private_build),
                          nativeExecutable=str(private_exe), script=str(script), scriptSha256=sha(script), log=str(directory / 'native.log'))
    rules = f'native-live-pair-v1:RULE_FRONTIER_CHAPTER={args.coop_chapter}'.encode()
    manifest = f'{PIN}:{sha(exe)}:{hashlib.sha256(rules).hexdigest()}'
    report = dict(version=1, runRequested=args.run_pair, preparationQualified=True,
                  oneProducerIsolationProbe=args.probe_host_only,
                  requiresHumanExceptionToOneHeavyProcessRule=not args.probe_host_only,
                  nativeProcessesStarted=0, browserUsed=False, goalComplete=False,
                  sources=sources, nativeExecutableSha256=sha(exe), pinnedExecutableSha256=PIN,
                  supervisorInputs=supervisor_inputs,
                  approvedPlan=str(args.approved_plan.resolve()) if args.approved_plan else None,
                  approvedPlanSha256=sha(args.approved_plan) if args.approved_plan else None,
                  settingsSource=str(profile_source), settingsBefore=settings_before,
                  servedBefore=served, roles=roles, configuredCoopChapter=args.coop_chapter,
                  expectedOutcome=args.expected_outcome, surrenderRole=args.surrender_role,
                  canonicalDeveloperStateBefore=canonical_state,
                  seconds=args.seconds, aggregateRssCeilingBytes=512 * 1024 * 1024,
                  logCeilingBytesPerRole=4 * 1024 * 1024, resourceSamples=[], stopReason=None,
                  fullMatchQualified=False, sharedDefeatQualified=False, independentInternetQualified=False,
                  sustainedBrowserMemoryBoundQualified=False,
                  publicTlsTransportRequested=args.public_tunnel, bothNativePeersUseTls=False,
                  publicTlsReadinessSeconds=120 if args.public_tunnel else 0,
                  publicTlsTransportQualified=False, routeTokenPublished=False)
    def save():
        (out / 'run.json').write_text(json.dumps(report, indent=2) + '\n')
    save()
    if not args.run_pair and not args.probe_host_only:
        print(json.dumps(dict(preparationQualified=True, nativeProcessesStarted=0, plan=str(out / 'run.json'), requiresHumanException=True)))
        return 0
    # Only invoke this branch after the human grants the specific native-pair
    # exception. There is no browser launch or service replacement in this tool.
    packets = out / 'initial-packets';packets.mkdir()
    service = ObservedRelay(packets)
    connections = 0
    preflight = args.public_tunnel
    private_path = '/match-' + secrets.token_urlsafe(32) if args.public_tunnel else '/rooms'
    route_gate, protected_handler = protected_room_endpoint(service, private_path)
    async def handler(ws):
        nonlocal connections
        if preflight:
            # TLS readiness only; never send or accept a game packet here.
            await ws.close();return
        connections += 1
        if connections > 2:
            service.failure = 'unexpected third connection'
            await ws.close();return
        await protected_handler(ws)
    logger = logging.getLogger('native_live_pair');logger.addHandler(logging.NullHandler());logger.propagate=False
    processes, sinks, groups = [], [], set()
    tunnel_meta = None
    try:
        async with serve(handler, '127.0.0.1', 0, subprotocols=['recomp-directplay-v1'], origins=[None],
                         compression=None, max_size=relay.LIMIT, max_queue=1, close_timeout=1, logger=logger,
                         process_request=route_gate if args.public_tunnel else None) as server, AsyncExitStack() as routes:
            port = server.sockets[0].getsockname()[1]
            url = f'ws://127.0.0.1:{port}/rooms'
            if args.public_tunnel:
                origin, tunnel_meta = await routes.enter_async_context(public_tunnel(port, out))
                report['publicTunnel'] = tunnel_meta
                report['routePathSha256'] = hashlib.sha256(private_path.encode()).hexdigest()
                url = origin.replace('https://', 'wss://', 1) + private_path
                # LIFO cleanup closes/reaps native peers before their tunnel.
                routes.push_async_callback(lambda: stop_owned(processes, groups))
                ready_started = time.monotonic()
                attempts = 0
                while True:
                    attempts += 1
                    try:
                        async with connect(url, subprotocols=['recomp-directplay-v1'],
                                           compression=None, open_timeout=5, close_timeout=1,
                                           max_size=relay.LIMIT, max_queue=1) as probe:
                            assert probe.subprotocol == 'recomp-directplay-v1'
                        report['tlsReadinessProbe'] = dict(authenticatedHandshake=True,
                            negotiatedProtocol=True, attempts=attempts, gamePacketsSent=0)
                        break
                    except Exception as error:
                        report['tlsReadinessProbe'] = dict(authenticatedHandshake=False,
                            attempts=attempts, lastErrorType=type(error).__name__, gamePacketsSent=0)
                        save()
                        if time.monotonic() - ready_started >= report['publicTlsReadinessSeconds'] or tunnel_meta.get('resourceStop'):
                            raise RuntimeError('Owned public TLS readiness failed before native launch') from None
                        await asyncio.sleep(1)
                preflight = False
                report['bothNativePeersUseTls'] = True
                save()
            start = time.monotonic()
            report['startedAtMs'] = time.time_ns() // 1000000
            launch_roles = ['host'] if args.probe_host_only else ['host', 'guest']
            effective_seconds = 35 if args.probe_host_only else args.seconds
            for role in launch_roles:
                entry = roles[role]
                env = {key:value for key,value in os.environ.items() if not key.startswith('RECOMP_')}
                switches = dict(PROFILE_DIR=entry['profile'], NETWORK_URL=url, NETWORK_MANIFEST=manifest,
                    REGISTRY=str(Path(entry['profile']) / 'registry.json'),
                    GUEST_ARGS='-nointro -dochecksums', SMOKE_SECONDS=str(effective_seconds),
                    SMOKE_WINDOW_INPUT='1', SMOKE_DRAWABLE='800x600', NETWORK_DEBUG='1',
                    RULE_FRONTIER_CHAPTER=str(args.coop_chapter),
                    CORE_MODS_DIR=str(GAME / 'build/recomp/mods/core'),
                    MODS_DIR=str(out / role / 'user-mods'), HOST_DUMP_DIR=str(out / role / 'frames'), SCRIPT=entry['script'])
                env.update({'RECOMP_' + key:value for key,value in switches.items()})
                sink = Path(entry['log']).open('x');sinks.append(sink)
                assert sha(entry['nativeExecutable']) == report['nativeExecutableSha256']
                proc = await asyncio.create_subprocess_exec(entry['nativeExecutable'], cwd=GAME / 'kit', env=env,
                    stdout=sink, stderr=asyncio.subprocess.STDOUT, start_new_session=True)
                processes.append(proc);groups.add(proc.pid);entry['nativePid'] = proc.pid
                report['nativeProcessesStarted'] += 1;save()
            roots = [process.pid for process in processes]
            while any(process.returncode is None for process in processes):
                rows = process_rows();owned = owned_rows(rows, roots, groups)
                groups |= {row['group'] for row in owned}
                elapsed = time.monotonic() - start
                native_rss = sum(row['rssBytes'] for row in owned)
                transport = owned_rows(rows, [tunnel_meta['tunnelPid']]) if tunnel_meta else []
                transport_rss = sum(row['rssBytes'] for row in transport)
                rss = native_rss + transport_rss
                report['resourceSamples'].append(dict(elapsedSeconds=round(elapsed, 2), aggregateRssBytes=rss,
                    nativeRssBytes=native_rss, transportRssBytes=transport_rss, ownedProcesses=len(owned) + len(transport)))
                deadline = effective_seconds + (10 if args.probe_host_only else 0)
                reason = service.failure or stop_reason(rows, roots, elapsed, deadline,
                    [Path(roles[role]['log']).stat().st_size for role in launch_roles], groups=groups,
                    expected_producers=len(launch_roles), limit=report['aggregateRssCeilingBytes'] - transport_rss)
                if tunnel_meta and (tunnel_meta.get('resourceStop') or not transport):
                    reason = reason or 'owned public transport stopped'
                if reason:
                    report['stopReason'] = reason;break
                # A failed or early peer exit cannot qualify the remaining run.
                if any(process.returncode not in (None, 0) for process in processes):
                    report['stopReason'] = 'native peer failed';break
                await asyncio.sleep(.25)
            await stop_owned(processes, groups)
    except Exception as error:
        report['stopReason'] = report['stopReason'] or 'native pair supervision failure: ' + type(error).__name__
        # A WebSocket exception can contain the private route URL.
        raise RuntimeError(report['stopReason']) from None
    finally:
        await stop_owned(processes, groups)
        for sink in sinks:sink.close()
        report['finishedAtMs'] = time.time_ns() // 1000000
        report['nativeExitCodes'] = [process.returncode for process in processes]
        report['remainingOwnedProcesses'] = [row['pid'] for row in process_rows() if row['group'] in groups]
        report['producerAbsent'] = not report['remainingOwnedProcesses']
        report['initialPackets'] = service.initial
        report['recentPacketMetadata'] = list(service.recent)
        report['packetCounts'] = service.counts
        report['fixtureStopped'] = not service.peers and not service.rooms
        report['originalPeerConnections'] = connections
        if tunnel_meta:
            report['publicTunnel'] = tunnel_meta
        report['sourcesUnchanged'] = all(sha(ROOT / name) == expected for name, expected in sources.items())
        report['settingsSourceUnchanged'] = all(sha(profile_source / name) == expected for name, expected in settings_before.items())
        report['servedUnchanged'] = all(sha(GAME / 'build/web-site/majesty' / name) == stamp['sha256'] and
            (GAME / 'build/web-site/majesty' / name).stat().st_ino == stamp['inode'] and
            (GAME / 'build/web-site/majesty' / name).stat().st_mtime_ns == stamp['mtimeNs'] for name,stamp in served.items())
        report['logSha256'] = {role:sha(entry['log']) for role,entry in roles.items() if Path(entry['log']).exists()}
        report['canonicalDeveloperStateUnchanged'] = all(
            (sha(GAME / 'build/recomp' / name) if (GAME / 'build/recomp' / name).exists() else None) == expected
            for name,expected in canonical_state.items())
        save()
    print(json.dumps({key:report.get(key) for key in ['nativeExitCodes', 'producerAbsent', 'fixtureStopped', 'stopReason', 'servedUnchanged']}))
    expected_codes = [0] if args.probe_host_only else [0, 0]
    return 0 if report['nativeExitCodes'] == expected_codes and report['producerAbsent'] and not report['stopReason'] else 1


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
