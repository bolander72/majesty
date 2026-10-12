#!/usr/bin/env python3
"""Bounded owned public-WSS relay for two actual browser clients; no game assets."""
import argparse
import asyncio
import json
from pathlib import Path
import secrets
import time

from websockets.asyncio.server import serve
from websockets.asyncio.client import connect
from websockets.exceptions import InvalidStatus
from room_relay import Relay, LIMIT
from lib.native_public_tunnel import public_tunnel, protected_room_endpoint


async def main(out):
    out.mkdir()
    relay = Relay()
    private_path = '/trial-' + secrets.token_hex(32)
    gate, handler = protected_room_endpoint(relay, private_path)
    started = time.monotonic()
    metadata = dict(referencePlayers=0, gameAssetsServed=False, gameProcessesStarted=0,
                    allowedOrigin='http://localhost:8000', terminal=False,
                    publicTlsHandshakeQualified=False)
    report = out / 'service.json'
    try:
        async with serve(handler, '127.0.0.1', 0, process_request=gate,
                         subprotocols=['recomp-directplay-v1'], origins=['http://localhost:8000'],
                         compression=None, max_size=LIMIT, max_queue=1, close_timeout=1) as server:
            port = server.sockets[0].getsockname()[1]
            async with public_tunnel(port, out, startup_seconds=60, total_seconds=600) as (origin, tunnel):
                endpoint = origin.replace('https:', 'wss:', 1) + private_path
                readiness_deadline = time.monotonic() + 120
                while True:
                    try:
                        async with connect(endpoint, origin='http://localhost:8000',
                                           subprotocols=['recomp-directplay-v1'], compression=None,
                                           open_timeout=10, close_timeout=1, proxy=None) as socket:
                            assert socket.subprotocol == 'recomp-directplay-v1'
                        break
                    except (OSError, TimeoutError, InvalidStatus) as error:
                        metadata['lastReadinessFailure'] = type(error).__name__
                        report.write_text(json.dumps(metadata, indent=2) + '\n')
                        if time.monotonic() >= readiness_deadline:
                            raise RuntimeError('Public TLS/DNS readiness deadline; no game was launched') from None
                        await asyncio.sleep(2)
                metadata['publicTlsHandshakeQualified'] = True
                (out / 'ready.json').write_text(json.dumps(dict(endpoint=endpoint, ready=True)) + '\n')
                report.write_text(json.dumps(metadata, indent=2) + '\n')
                print(json.dumps(dict(ready=True, publicTlsHandshakeQualified=True)), flush=True)
                ready_at = time.monotonic()
                metadata['gameWindowSeconds'] = 420
                while not (out / 'stop').exists() and time.monotonic() - ready_at < 420:
                    if tunnel.get('resourceStop') or tunnel.get('terminal'):
                        break
                    await asyncio.sleep(1)
    finally:
        (out / 'ready.json').unlink(missing_ok=True)
        metadata.update(terminal=True, livePeers=len(relay.peers), liveRooms=len(relay.rooms),
                        elapsedSeconds=round(time.monotonic()-started, 2))
        report.write_text(json.dumps(metadata, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    asyncio.run(main(args.output))
