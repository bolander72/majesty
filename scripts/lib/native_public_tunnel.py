"""Owned, short-lived TLS route for terminal protocol tests; never a game server."""
import asyncio
from contextlib import asynccontextmanager, suppress
import hashlib
from http import HTTPStatus
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import time

from .native_pair_guard import owned_rows, stop_owned


def protected_room_endpoint(service, path, connected=None):
    """Authenticate the temporary HTTP path, then route to original /rooms.

    No WebSocket payload, reply, player identity or room packet is rewritten.
    The second path check protects direct invocation outside the gate as well.
    """
    def gate(connection, request):
        if request.path != path:
            return connection.respond(HTTPStatus.NOT_FOUND, 'No fixture\n')
    async def handler(connection):
        if connection.request.path != path:
            await connection.close(1008, 'Invalid endpoint')
            return
        connection.request.path = '/rooms'
        if connected:
            connected()
        await service.handle(connection)
    return gate, handler


def process_rows():
    result = []
    for line in subprocess.check_output(['ps', '-axo', 'pid=,ppid=,pgid=,rss=,comm='], text=True).splitlines():
        parts = line.split(None, 4)
        if len(parts) == 5:
            result.append(dict(pid=int(parts[0]), parent=int(parts[1]), group=int(parts[2]),
                               rssBytes=int(parts[3]) * 1024, program=Path(parts[4]).name))
    return result


def tunnel_origin(text):
    match = re.search(r'https://([a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com)(?![a-zA-Z0-9.-])', text)
    return 'https://' + match[1] if match else None


@asynccontextmanager
async def public_tunnel(port, out, *, binary=None, startup_seconds=45, total_seconds=300):
    """Expose only an owned ephemeral listener; the caller authenticates its path.

    Existing tunnels/configuration are untouched. The helper accepts no account
    credentials and keeps the route private. Callers must close every native
    producer before leaving this context. SDK and tunnel bounds are separate.
    """
    if not isinstance(port, int) or isinstance(port, bool) or not 1 <= port <= 65535:
        raise ValueError('Invalid owned listener port')
    if not isinstance(total_seconds, int) or isinstance(total_seconds, bool) or not 60 <= total_seconds <= 600:
        raise ValueError('Owned tunnel deadline must be between 60 and 600 seconds')
    executable = binary or shutil.which('cloudflared')
    if not executable:
        raise RuntimeError('Installed cloudflared is required')
    executable = str(Path(executable).resolve())
    out = Path(out)
    config = out / 'owned-tunnel-config.yml'
    config.write_text('{}\n')
    log = out / 'owned-tunnel.log'
    report = out / 'public-tunnel.json'
    meta = dict(owned=True, startupDeadlineSeconds=startup_seconds, totalDeadlineSeconds=total_seconds,
                rssCeilingBytes=128 * 1024 * 1024, logCeilingBytes=1024 * 1024,
                existingConfigurationRead=False, existingTunnelChanged=False,
                peakOwnedRssBytes=0, routeTokenPublished=False)
    digest = hashlib.sha256()
    with Path(executable).open('rb') as file:
        for block in iter(lambda:file.read(4096), b''):
            digest.update(block)
    meta['tunnelExecutableSha256'] = digest.hexdigest()
    def save():
        report.write_text(json.dumps(meta, indent=2) + '\n')
    # Do not inherit account tokens or tunnel settings from another project.
    env = {key:os.environ[key] for key in ['PATH', 'LANG', 'LC_ALL', 'HOME', 'TMPDIR'] if key in os.environ}
    with log.open('x') as sink:
        process = await asyncio.create_subprocess_exec(executable, 'tunnel', '--config', str(config),
            '--url', f'http://127.0.0.1:{port}', '--no-autoupdate', '--protocol', 'http2',
            env=env, stdout=sink, stderr=asyncio.subprocess.STDOUT, start_new_session=True)
        groups = {process.pid}
        meta['tunnelPid'] = process.pid
        started = time.monotonic()
        save()
        async def monitor():
            while process.returncode is None:
                owned = owned_rows(process_rows(), [process.pid], groups)
                groups.update(row['group'] for row in owned)
                rss = sum(row['rssBytes'] for row in owned)
                meta['peakOwnedRssBytes'] = max(meta['peakOwnedRssBytes'], rss)
                if rss > meta['rssCeilingBytes']:
                    meta['resourceStop'] = 'owned tunnel RSS ceiling'
                elif log.stat().st_size > meta['logCeilingBytes']:
                    meta['resourceStop'] = 'owned tunnel log ceiling'
                elif time.monotonic() - started > meta['totalDeadlineSeconds']:
                    meta['resourceStop'] = 'owned tunnel deadline'
                save()
                if 'resourceStop' in meta:
                    await stop_owned([process], groups)
                    return
                await asyncio.sleep(.25)
        guard = asyncio.create_task(monitor())
        try:
            origin = None
            while not origin:
                if guard.done():
                    guard.result()
                if process.returncode is not None or 'resourceStop' in meta:
                    raise RuntimeError('Owned tunnel stopped before publishing a route')
                if time.monotonic() - started > startup_seconds:
                    raise TimeoutError('Owned tunnel startup deadline')
                # Limit the read even if a noisy process outruns the sampler.
                with log.open('rb') as file:
                    raw = file.read(meta['logCeilingBytes'] + 1)
                if len(raw) > meta['logCeilingBytes']:
                    raise RuntimeError('Owned tunnel log ceiling')
                origin = tunnel_origin(raw.decode('utf8', errors='replace'))
                if not origin:
                    await asyncio.sleep(.2)
            meta['publicHostname'] = origin.removeprefix('https://')
            save()
            yield origin, meta
        finally:
            guard.cancel()
            with suppress(asyncio.CancelledError):
                await guard
            if process.returncode is None or owned_rows(process_rows(), [process.pid], groups):
                await stop_owned([process], groups)
            for group in groups:
                if any(row['group'] == group for row in process_rows()):
                    try:
                        os.killpg(group, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
            for _ in range(20):
                if not owned_rows(process_rows(), [process.pid], groups):
                    meta['ownedGroupAbsent'] = True
                    break
                await asyncio.sleep(.1)
            meta.update(exitCode=process.returncode, terminal=process.returncode is not None,
                        elapsedSeconds=round(time.monotonic() - started, 2))
            # The fresh empty config is not a user file or a credential.
            config.unlink(missing_ok=True)
            save()
            if not meta.get('ownedGroupAbsent'):
                raise RuntimeError('Owned tunnel group remains live')
