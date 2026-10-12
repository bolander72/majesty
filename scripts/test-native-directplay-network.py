#!/usr/bin/env python3
"""Qualify real native DirectPlay host/join against the production relay locally.

Run from the game venv. No game or browser starts. The optional stopped owned
kingdom snapshot verifies transport bytes, not original game loading or votes.
"""
import argparse
import asyncio
from contextlib import AsyncExitStack
import hashlib
import importlib.util
import json
import logging
import os
import re
import signal
import secrets
import socket
from urllib.parse import urlsplit
from pathlib import Path
import subprocess
import sys
import time
from websockets.asyncio.client import connect
from websockets.asyncio.server import serve
from lib.native_pair_guard import owned_rows, stop_reason, stop_owned
from lib.native_public_tunnel import public_tunnel, protected_room_endpoint

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'
spec = importlib.util.spec_from_file_location('native_network_relay', ROOT / 'scripts/room_relay.py')
relay = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = relay
spec.loader.exec_module(relay)
MANIFEST = b'a' * 64 + b':' + b'b' * 64 + b':' + b'c' * 64
DESCRIPTOR = b'actual-socket-checkpoint-fixture-v1'
TOTAL = 50003


def process_rows():
    rows = []
    for line in subprocess.check_output(['ps', '-axo', 'pid=,ppid=,pgid=,rss=,comm='], text=True).splitlines():
        parts = line.split(None, 4)
        if len(parts) == 5:
            rows.append(dict(pid=int(parts[0]), parent=int(parts[1]), group=int(parts[2]),
                             rssBytes=int(parts[3]) * 1024, program=Path(parts[4]).name))
    return rows


async def supervise(process, log, row):
    started = time.monotonic()
    groups = {process.pid}
    samples = []
    row.update(resourceDeadlineSeconds=180, sdkRssCeilingBytes=512 * 1024 * 1024,
               oneJobBuildRssCeilingBytes=768 * 1024 * 1024, peakOwnedRssBytes=0)
    def save():
        log.with_suffix('.guard.json').write_text(json.dumps(dict(row=row, samples=samples, groups=sorted(groups)), indent=2) + '\n')
    async def cleanup():
        remaining = owned_rows(process_rows(), [process.pid], groups)
        if process.returncode is not None and not remaining:
            return
        try:
            await stop_owned([process], groups)
        except PermissionError as error:
            remaining = owned_rows(process_rows(), [process.pid], groups)
            row['cleanupSignalError'] = dict(errno=error.errno, remainingPids=[item['pid'] for item in remaining])
            save()
            if remaining or process.returncode is None:
                raise
    try:
        while process.returncode is None:
            rows = process_rows()
            owned = owned_rows(rows, [process.pid], groups)
            groups.update(item['group'] for item in owned)
            rss = sum(item['rssBytes'] for item in owned)
            row['peakOwnedRssBytes'] = max(row['peakOwnedRssBytes'], rss)
            building = any(item['program'] in ['cmake', 'ninja', 'clang', 'clang++'] for item in owned)
            limit = row['oneJobBuildRssCeilingBytes'] if building else row['sdkRssCeilingBytes']
            samples.append(dict(elapsedSeconds=round(time.monotonic() - started, 2), rssBytes=rss,
                                phase='one-job-build' if building else 'sdk-test', limitBytes=limit, owned=owned))
            if len(samples) > 64:
                samples.pop(0)
            reason = stop_reason(rows, [process.pid], time.monotonic() - started, 180,
                                 [log.stat().st_size], limit=limit, groups=groups, expected_producers=1)
            if reason:
                row['resourceStop'] = reason.replace('paired native', 'native SDK').replace('native pair', 'native SDK test')
                row['stopProcessRows'] = [item for item in rows if item in owned or item['program'] in ['pop_smoke', 'ninja', 'cmake', 'clang', 'clang++', 'wasm-opt', 'wasm-ld']]
                save()
                await cleanup()
                break
            save()
            await asyncio.sleep(.25)
    finally:
        await cleanup()
        # A finished wrapper can leave an orphan build child in its owned group.
        for group in groups:
            if any(item['group'] == group for item in process_rows()):
                try:
                    os.killpg(group, signal.SIGKILL)
                except ProcessLookupError:
                    pass
        for _ in range(20):
            if not owned_rows(process_rows(), [process.pid], groups):
                row['ownedGroupAbsent'] = True
                break
            await asyncio.sleep(.1)
        save()
        assert row.get('ownedGroupAbsent'), 'Owned SDK build/test group remains live'


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda: f.read(4096), b''):
            h.update(block)
    return h.hexdigest()


def session():
    desc = bytearray(80)
    desc[:4] = relay.put(80)
    desc[40:44] = relay.put(4)
    return relay.Session(desc, b'Owned native socket fixture', b'')


class Reference:
    def __init__(self, ws):
        self.ws = ws
        self.request = 0
        self.serial = 1
        self.sequence = 0
        self.incoming_sequence = 0
        self.events = []
        self.observed = []

    async def rpc(self, op, body):
        self.request += 1
        await self.ws.send(relay.HEADER.pack(relay.MAGIC, 1, op, self.request, 0) + body)
        while True:
            message = await asyncio.wait_for(self.ws.recv(), 5)
            magic, version, actual, request, status = relay.HEADER.unpack_from(message)
            assert (magic, version) == (relay.MAGIC, 1)
            if request:
                assert (actual, request, status) == (op | relay.REPLY, self.request, 0)
                return message[20:]
            self.events.append((actual, message[20:]))
            assert len(self.events) <= 64

    async def event(self, op):
        while True:
            for index, (actual, body) in enumerate(self.events):
                if actual == op:
                    self.events.pop(index)
                    return body
            message = await asyncio.wait_for(self.ws.recv(), 5)
            magic, version, actual, request, status = relay.HEADER.unpack_from(message)
            assert (magic, version, request, status) == (relay.MAGIC, 1, 0, 0)
            self.events.append((actual, message[20:]))
            assert len(self.events) <= 64

    async def negotiate(self):
        assert await self.rpc(relay.BARRIER, relay.put(0) + relay.string(relay.BARRIER_CONTRACT)) == relay.put(1)
        assert await self.rpc(relay.CHECKPOINT, relay.put(6, 0) + relay.string(relay.CHECKPOINT_CONTRACT)) == relay.put(1)

    async def barrier(self, action):
        assert await self.rpc(relay.BARRIER, relay.put(action, self.serial) + relay.string(DESCRIPTOR)) == b''

    async def stage(self, stage):
        r = relay.Reader(await self.event(relay.BARRIER_EVENT))
        assert [r.u32(), r.u32(), r.string(1024), r.u32(), r.u32(), r.u32()] == [self.serial, stage, DESCRIPTOR, 2, 2, 3]
        r.done()
        self.observed.append(dict(serial=self.serial, stage=stage))

    async def checkpoint(self, action, peer, value=0, data=b''):
        body = relay.put(action, self.serial)
        if action == 0:
            body += relay.string(DESCRIPTOR)
        else:
            body += relay.put(peer, value)
            if action == 2:
                body += relay.put(len(data)) + data
        assert await self.rpc(relay.CHECKPOINT, body) == b''

    async def notice(self, action, sender, recipient, value=0):
        r = relay.Reader(await self.event(relay.CHECKPOINT_EVENT))
        assert [r.u32(), r.u32(), r.u32(), r.u32()] == [action, self.serial, sender, recipient]
        if action:
            assert r.u32() == value
        data = r.take(r.u32()) if action == 2 else b''
        r.done()
        self.observed.append(dict(serial=self.serial, action=action, value=value, bytes=len(data)))
        return data

    async def send(self, sender, recipient, payload):
        self.sequence += 1
        await self.ws.send(relay.HEADER.pack(relay.MAGIC, 1, relay.SEND, 0, 0) +
                           relay.put(self.sequence, sender, recipient, 1) + payload)

    async def packet(self, sender, recipient, payload):
        r = relay.Reader(await self.event(relay.PACKET_EVENT))
        self.incoming_sequence += 1
        assert [r.u32(), r.u32(), r.u32()] == [self.incoming_sequence, sender, recipient]
        assert r.take(len(payload)) == payload
        r.done()


async def transfer(ref, native_role, source=None):
    total = source.stat().st_size if source else TOTAL
    def chunk_at(offset, count):
        if not source:
            return bytes((offset + i) % 251 for i in range(count))
        with source.open('rb') as file:
            file.seek(offset)
            chunk = file.read(count)
        assert len(chunk) == count
        return chunk
    host = native_role == 'guest'  # reference is the opposite role
    local, peer = (2, 3) if host else (3, 2)
    if host:
        await ref.packet(3, 2, b'peer-ready')
        await ref.barrier(1)
    else:
        await ref.send(3, 2, b'peer-ready')
    await ref.stage(1)
    if host:
        await ref.notice(0, 3, 2)
        await ref.checkpoint(1, 3, total)
        await ref.barrier(2)  # host verifies its source before recipient finishes
        await ref.notice(3, 3, 2, 0)
    else:
        await ref.checkpoint(0, 2)
        await ref.notice(1, 2, 3, total)
        await ref.checkpoint(3, 2, 0)
    offset, sequence, streamed = 0, 1, hashlib.sha256()
    while offset < total:
        chunk = chunk_at(offset, min(16384, total - offset))
        if host:
            await ref.checkpoint(2, 3, sequence, chunk)
            await ref.notice(3, 3, 2, sequence)
        else:
            actual = await ref.notice(2, 2, 3, sequence)
            assert actual == chunk
            await ref.checkpoint(3, 2, sequence)
        streamed.update(chunk)
        offset += len(chunk)
        sequence += 1
    assert sequence == (total + 16383) // 16384 + 1
    if host:
        await ref.checkpoint(4, 3, sequence)
        await ref.notice(5, 3, 2, sequence)
    else:
        await ref.notice(4, 2, 3, sequence)
        await ref.checkpoint(5, 2, sequence)
        await ref.barrier(2)
    await ref.stage(2)
    await ref.barrier(3)
    await ref.stage(3)
    await ref.packet(peer, local, b'agreement-observed')
    await ref.send(local, peer, b'agreement-observed')
    ref.serial = 2
    if host:
        await ref.barrier(1)
    await ref.stage(1)
    chunk = chunk_at(0, 16384)
    if host:
        await ref.notice(0, 3, 2)
        await ref.checkpoint(1, 3, total)
        await ref.notice(3, 3, 2, 0)
        await ref.checkpoint(2, 3, 1, chunk)
        await ref.notice(3, 3, 2, 1)
        await ref.barrier(4)
    else:
        await ref.checkpoint(0, 2)
        await ref.notice(1, 2, 3, total)
        await ref.checkpoint(3, 2, 0)
        assert await ref.notice(2, 2, 3, 1) == chunk
        await ref.checkpoint(3, 2, 1)
    await ref.stage(4)
    await ref.packet(peer, local, b'fixture-complete')
    await ref.send(local, peer, b'completion-confirmed')
    return dict(nativeRole=native_role, bytes=offset, chunks=sequence - 1,
                fixtureSha256=streamed.hexdigest(), observed=ref.observed,
                hostReadyDuringTransfer=True, agreementComplete=True,
                ordinaryPacketsExchanged=True, peerDisconnected=True,
                partialTransferCanceled=True, sourceRoomUsableAfterCancel=True)


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--attempt', type=int, required=True)
    parser.add_argument('--owned-kingdom-snapshot', action='store_true',
                        help='Transfer the independently pinned stopped Source_Before fixture')
    parser.add_argument('--public-tunnel', action='store_true',
                        help='Use a fresh owned public TLS route for both native and reference peers')
    args = parser.parse_args()
    out = ROOT / f'output/native-directplay-network-{args.attempt:03}'
    if args.attempt < 1 or out.exists():
        parser.error('Use a fresh positive attempt')
    rows = subprocess.check_output(['ps', '-axo', 'pid=,comm='], text=True).splitlines()
    if any(Path(row.split(None, 1)[1]).name in ['pop_smoke', 'clang', 'clang++', 'ninja', 'cmake', 'dx_tests', 'platform_websocket_tests'] for row in rows if len(row.split(None, 1)) == 2):
        parser.error('Another heavy game/build/test is live')
    out.mkdir()
    source = None
    original_source = None
    snapshot = None
    if args.owned_kingdom_snapshot:
        summary = json.loads((ROOT / 'output/actor-transfer-case-summary.json').read_text())
        original_source = Path(summary['committedFixture']) / 'Source_Before.GMP'
        assert original_source.parent.name.startswith('actor-arrival-fixture-')
        assert original_source.parent.parent == GAME / 'build'
        assert original_source.resolve() == original_source
        assert original_source.is_file() and 16384 < original_source.stat().st_size <= 2 * 1024 * 1024
        expected = '6e6a2ee125b68ce00ec25a46f205904e7cdd8f83ca009c10cf29e8e9ab76e2d1'
        assert digest(original_source) == expected
        source = out / 'owned-stopped-checkpoint.bin'
        with original_source.open('rb') as incoming, source.open('xb') as saved:
            while block := incoming.read(4096):
                saved.write(block)
        assert digest(source) == expected
        snapshot = dict(source=str(original_source), copy=str(source), bytes=source.stat().st_size,
                        sha256=expected, originalGameLoadQualified=False)
    # Freeze the handwritten libraries used by dx_tests, including the new
    # include fixture. Do not require an ignored prior build report to rerun.
    paths = [p for directory in ['platform', 'runtime', 'dx']
             for p in (GAME / 'kit' / directory).rglob('*')
             if p.is_file() and p.suffix in {'.cpp', '.h', '.inc', '.c', '.mm'}]
    paths += [GAME / name for name in ['kit/CMakeLists.txt', 'kit/platform/CMakeLists.txt', 'kit/dx/CMakeLists.txt', 'kit/runtime/CMakeLists.txt', 'kit/tools/test.py', 'kit/tools/build.py', 'game.toml', 'globals.toml']]
    paths += [ROOT / 'scripts/room_relay.py', ROOT / 'scripts/lib/native_pair_guard.py',
              ROOT / 'scripts/lib/native_public_tunnel.py',
              GAME / 'kit/tools/format.py', Path(__file__).resolve()]
    sources = []
    for path in dict.fromkeys(paths):
        copy = out / str(path.relative_to(ROOT)).replace('/', '_')
        copy.write_bytes(path.read_bytes())
        sources.append(dict(source=str(path), copy=str(copy), sha256=digest(path)))
    served = {}
    for name in ['MajestyRecomp.wasm', 'MajestyRecomp.js', 'MajestyRecomp.data', 'index.html']:
        p = GAME / 'build/web-site/majesty' / name
        st = p.stat()
        served[name] = dict(sha256=digest(p), bytes=st.st_size, inode=st.st_ino, mtimeNs=st.st_mtime_ns)
    report = dict(version=1, sources=sources, servedBefore=served, runs=[],
                  browserUsed=False, nativeWorldStarted=False, loopbackOnly=not args.public_tunnel,
                  publicTlsTransportRequested=args.public_tunnel, independentInternetParticipants=False,
                  syntheticFixtureOnly=source is None, stoppedKingdomSnapshot=snapshot, gameSaveLoaded=False,
                  gameplayQualified=False, sharedSaveLoadResumeQualified=False,
                  independentInternetQualified=False, sustainedBrowserMemoryBoundQualified=False,
                  crashResolved=False, goalComplete=False)
    (out / 'run.json').write_text(json.dumps(report, indent=2) + '\n')
    service = relay.Relay()
    connections = 0
    # A public quick-tunnel address alone is not access control. Restrict the
    # listener to a fresh 256-bit route token, kept out of public output/argv.
    private_path = '/sdk-' + secrets.token_urlsafe(32) if args.public_tunnel else '/rooms'
    def connected():
        nonlocal connections
        connections += 1
    route_gate, handler = protected_room_endpoint(service, private_path, connected)
    logger = logging.getLogger('native_directplay');logger.addHandler(logging.NullHandler());logger.propagate=False
    async with serve(handler, '127.0.0.1', 0, subprotocols=['recomp-directplay-v1'],
                     origins=[None], compression=None, max_size=relay.LIMIT,
                     max_queue=1, close_timeout=1, logger=logger,
                     process_request=route_gate if args.public_tunnel else None) as server, AsyncExitStack() as routes:
        port = server.sockets[0].getsockname()[1]
        url = f'ws://127.0.0.1:{port}{private_path}'
        if args.public_tunnel:
            origin, tunnel_meta = await routes.enter_async_context(public_tunnel(port, out))
            report['publicTunnel'] = tunnel_meta
            url = origin.replace('https://', 'wss://', 1) + private_path
            report['routePathSha256'] = hashlib.sha256(private_path.encode()).hexdigest()
            print(json.dumps({'ownedPublicTlsRouteReady':True, 'tunnelPid':tunnel_meta['tunnelPid'],
                              'nativeAndReferenceUseTls':True, 'routeTokenPublished':False}), flush=True)
            # A quick-tunnel URL is printed before its route is necessarily
            # usable. Verify a real TLS/subprotocol handshake before a native
            # producer starts, with a bounded retry window for edge startup.
            # Fresh DNS records may outlive the first negative-cache interval.
            # Keep the tunnel and listener alive during this bounded preflight;
            # do not alter DNS settings or bypass certificate verification.
            preflight_started = time.monotonic()
            deadline = preflight_started + 60
            attempts = 0
            while True:
                attempts += 1
                connection = connect(url, subprotocols=['recomp-directplay-v1'], compression=None,
                                     open_timeout=5, close_timeout=1, max_size=relay.LIMIT, max_queue=1)
                try:
                    async with connection as probe:
                        assert probe.subprotocol == 'recomp-directplay-v1'
                        hello = Reference(probe)
                        assert await hello.rpc(relay.HELLO, relay.string(MANIFEST)) == b''
                    report['tlsReadinessProbe'] = dict(attempts=attempts, authenticatedHandshake=True,
                                                      negotiatedProtocol=True, relayHelloAccepted=True,
                                                      helloRequests=1, gamePacketsSent=0)
                    (out / 'run.json').write_text(json.dumps(report, indent=2) + '\n')
                    break
                except Exception as error:
                    requested_host = urlsplit(url).hostname
                    if attempts == 1 and isinstance(error, socket.gaierror):
                        # Inspect only the default resolver's public response.
                        # Give its measured negative-cache lifetime one bounded
                        # chance to expire; no DNS override/flush is performed.
                        try:
                            dns = await asyncio.to_thread(subprocess.run,
                                ['dig', '+time=2', '+tries=1', requested_host, 'A',
                                 '+noall', '+comments', '+authority', '+answer'],
                                capture_output=True, text=True, timeout=3)
                            ttls = [int(value) for value in re.findall(r'\s(\d+)\s+IN\s+SOA\s', dns.stdout)]
                            budget = min(180, max(60, max(ttls, default=0) + 60))
                            deadline = preflight_started + budget
                            report['tlsDnsPreflight'] = dict(defaultResolverStatuses=re.findall(
                                r'status: ([A-Z]+)', dns.stdout), negativeCacheTtlSeconds=ttls,
                                preflightDeadlineSeconds=budget, settingsChanged=False)
                        except subprocess.TimeoutExpired:
                            report['tlsDnsPreflight'] = dict(queryTimedOut=True, settingsChanged=False,
                                                            preflightDeadlineSeconds=60)
                    try:
                        addresses = await asyncio.wait_for(asyncio.get_running_loop().getaddrinfo(
                            requested_host, 443, type=socket.SOCK_STREAM), 3)
                        resolves = bool(addresses)
                    except (OSError, asyncio.TimeoutError):
                        resolves = False
                    report['tlsReadinessProbe'] = dict(attempts=attempts, authenticatedHandshake=False,
                        lastErrorType=type(error).__name__, gamePacketsSent=0,
                        requestedHostMatchesTunnel=requested_host == tunnel_meta['publicHostname'],
                        requestedHostResolvesAfterError=resolves,
                        hostnameChangedByRedirect=urlsplit(connection.uri).hostname != requested_host)
                    (out / 'run.json').write_text(json.dumps(report, indent=2) + '\n')
                    if time.monotonic() >= deadline or tunnel_meta.get('resourceStop'):
                        report.update(publicTlsTransportQualified=False,
                                      failure='Public TLS readiness deadline; terminal tunnel state is in public-tunnel.json')
                        (out / 'run.json').write_text(json.dumps(report, indent=2) + '\n')
                        raise RuntimeError('Owned public TLS readiness failed: ' + type(error).__name__) from None
                    await asyncio.sleep(2 if isinstance(error, socket.gaierror) else .5)
        for role in ['host', 'guest']:
            env = os.environ.copy()
            env['NATIVE_DIRECTPLAY_TEST_URL'] = url
            env['NATIVE_DIRECTPLAY_TEST_ROLE'] = role
            env.pop('NATIVE_DIRECTPLAY_TEST_BYTES_FILE', None)
            if source:
                env['NATIVE_DIRECTPLAY_TEST_BYTES_FILE'] = str(source)
            command = ['.venv/bin/python', 'tools/test.py', '--native-test', 'directplay_network_tests', '--jobs', '1']
            log = out / f'{role}-official.log'
            async with connect(url, subprotocols=['recomp-directplay-v1'], compression=None, max_size=relay.LIMIT, max_queue=1, close_timeout=1) as ws:
                ref = Reference(ws)
                await ref.rpc(relay.HELLO, relay.string(MANIFEST))
                if role == 'guest':
                    r = relay.Reader(await ref.rpc(relay.CREATE, session().encode()))
                    room = relay.Session.read(r)
                    assert r.u32() == 0
                    r.done()
                    env['NATIVE_DIRECTPLAY_TEST_INSTANCE'] = bytes(room.desc[8:24]).hex()
                    r = relay.Reader(await ref.rpc(relay.PLAYER, relay.Player(0xffffffff, 0, b'Reference host', b'', b'').encode()))
                    assert r.u32() == 1 and relay.Player.read(r).id == 2
                    r.done()
                    await ref.negotiate()
                with log.open('x') as file:
                    process = await asyncio.create_subprocess_exec(*command, cwd=GAME, env=env, stdout=file, stderr=asyncio.subprocess.STDOUT, start_new_session=True)
                    row = dict(nativeRole=role, testPid=process.pid, log=str(log), startedAtMs=time.time_ns() // 1000000)
                    report['runs'].append(row)
                    (out / 'run.json').write_text(json.dumps(report, indent=2) + '\n')
                    print(json.dumps(row), flush=True)
                    guard = asyncio.create_task(supervise(process, log, row))
                    failure = None
                    try:
                        if role == 'host':
                            # Discovery and joining both go through actual wire RPCs.
                            deadline = time.monotonic() + 120
                            while True:
                                r = relay.Reader(await ref.rpc(relay.LIST, bytes(16) + relay.put(1)))
                                count = r.u32()
                                assert count in (0, 1)
                                if count:
                                    room = relay.Session.read(r); r.done()
                                    if relay.word(room.desc, 44) == 1:
                                        break
                                if process.returncode is not None:
                                    raise RuntimeError('Native test stopped before creating player')
                                if time.monotonic() >= deadline:
                                    raise TimeoutError('Native test did not create its room')
                                await asyncio.sleep(.1)
                            r = relay.Reader(await ref.rpc(relay.JOIN, room.encode()))
                            relay.Session.read(r)
                            assert r.u32() == 1 and relay.Player.read(r).id == 2
                            r.done()
                            r = relay.Reader(await ref.rpc(relay.PLAYER, relay.Player(0xffffffff, 0, b'Reference guest', b'', b'').encode()))
                            assert r.u32() == 2 and relay.Player.read(r).id == 3
                            r.done()
                            await ref.negotiate()
                        row['reference'] = await transfer(ref, role, source)
                        if source:
                            assert row['reference']['bytes'] == snapshot['bytes']
                            assert row['reference']['fixtureSha256'] == snapshot['sha256']
                            assert digest(source) == digest(original_source) == snapshot['sha256']
                    except Exception as error:
                        failure = error
                        row['referenceFailure'] = f'{type(error).__name__}: {error}'
                        row['referenceObservedBeforeFailure'] = list(ref.observed)
                    await ws.close()
                    # A timeout does not authorize another test: terminate this
                    # owned producer explicitly and reap it before proceeding.
                    try:
                        code = await asyncio.wait_for(process.wait(), 75)
                    except asyncio.TimeoutError:
                        row['producerTerminatedAfterTimeout'] = True
                        await stop_owned([process], [process.pid])
                        code = process.returncode
                        failure = failure or TimeoutError('Owned test producer exceeded deadline')
                    await guard
                try:
                    os.kill(process.pid, 0)
                except ProcessLookupError:
                    row['producerAbsent'] = True
                else:
                    raise RuntimeError('Test producer remains live')
                row.update(exitCode=code, testTerminal=True, logSha256=digest(log))
                trace = GAME / 'build/cmake/macos/Testing/Temporary/LastTest.log'
                if trace.exists():
                    copy = out / f'{role}-LastTest.log';copy.write_bytes(trace.read_bytes())
                    row['ctestLog'] = dict(copy=str(copy), sha256=digest(copy))
                    for line in trace.read_text().splitlines():
                        if 'directplay network:' in line and 'checks' in line:
                            row['result'] = line
                (out / 'run.json').write_text(json.dumps(report, indent=2) + '\n')
                print(json.dumps({k: row.get(k) for k in ['nativeRole', 'exitCode', 'result', 'referenceFailure', 'producerAbsent']}), flush=True)
                if code or failure:
                    report['failure'] = str(failure) if failure else 'Native test failed'
                    break
    assert not service.peers and not service.rooms
    report.update(fixtureConnections=connections, fixtureStopped=True,
                  nativeDirectPlayNetworkQualified=len(report['runs']) == 2 and all(r['exitCode'] == 0 and 'reference' in r and 'referenceFailure' not in r and 'resourceStop' not in r and r.get('ownedGroupAbsent') for r in report['runs']),
                  scope='Actual native DirectPlay guest COM ABI and checkpoint seams on default platform WebSockets against unchanged production room relay and reference peer. Hosting/joining, bounded transport bytes, fixture Ready/Loaded agreement, partial-transfer cancellation with source-room continuity, ordinary packets and peer disconnect. Optional stopped kingdom bytes are not loaded; no original world, game-owned Ready/Loaded, browser, full match or independent internet participant.')
    report['publicTlsTransportQualified'] = bool(args.public_tunnel and report['nativeDirectPlayNetworkQualified'] and
        report['publicTunnel'].get('terminal') and report['publicTunnel'].get('ownedGroupAbsent') and
        'resourceStop' not in report['publicTunnel'])
    assert all(digest(Path(item['source'])) == item['sha256'] for item in sources)
    for name, stamp in served.items():
        p = GAME / 'build/web-site/majesty' / name; st = p.stat()
        assert stamp == dict(sha256=digest(p), bytes=st.st_size, inode=st.st_ino, mtimeNs=st.st_mtime_ns)
    report['servedUnchanged'] = True
    config = GAME / 'build/cmake/macos/generated/game_config.h'
    if config.exists():
        copy = out / 'generated_game_config.h';copy.write_bytes(config.read_bytes())
        report['generatedConfig'] = dict(source=str(config), copy=str(copy), sha256=digest(copy))
    exe = GAME / 'build/recomp/dx_tests'
    if exe.exists():
        copy = out / 'dx_tests';copy.write_bytes(exe.read_bytes())
        report['binary'] = dict(source=str(exe), copy=str(copy), sha256=digest(copy))
    (out / 'run.json').write_text(json.dumps(report, indent=2) + '\n')
    (ROOT / f'output/native-directplay-network-{args.attempt:03}-observed.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report.get(k) for k in ['nativeDirectPlayNetworkQualified', 'fixtureConnections', 'fixtureStopped', 'servedUnchanged', 'failure']}), flush=True)
    return 0 if report['nativeDirectPlayNetworkQualified'] else 1


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
