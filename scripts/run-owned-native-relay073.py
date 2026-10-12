#!/usr/bin/env python3
"""One ephemeral loopback relay for native UI trials; no player is invented."""
import argparse
import asyncio
import json
import os
from pathlib import Path

from websockets.asyncio.server import serve
from room_relay import Relay, LIMIT


async def main(ready, browser_origin=None):
    service = Relay()
    async with serve(service.handle, '127.0.0.1', 0,
                     subprotocols=['recomp-directplay-v1'], origins=[None] + ([browser_origin] if browser_origin else []),
                     compression=None, max_size=LIMIT, max_queue=1,
                     close_timeout=1) as server:
        port = server.sockets[0].getsockname()[1]
        with ready.open('x') as sink:
            json.dump(dict(pid=os.getpid(), url=f'ws://127.0.0.1:{port}/rooms', browserOrigin=browser_origin), sink)
        await asyncio.Future()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ready-file', type=Path, required=True)
    parser.add_argument('--browser-origin', choices=['http://localhost:8000'],
                        help='Allow one explicitly selected local browser origin for a real native/browser pair')
    args = parser.parse_args()
    asyncio.run(main(args.ready_file, args.browser_origin))
