#!/usr/bin/env python3
"""Verify an owned HTTPS/WSS deployment without launching a game or reading saves."""
import argparse
import asyncio
import importlib.util
import json
from pathlib import Path
import ssl
import urllib.request

from websockets.asyncio.client import connect
from websockets.exceptions import InvalidStatus

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('hosting_relay_contract', ROOT / 'tests/test_room_relay.py')
contract = importlib.util.module_from_spec(spec)
spec.loader.exec_module(contract)
relay = contract.relay


async def verify(origin, certificate):
    context = ssl.create_default_context(cafile=str(certificate))
    result = {'protocolOnly': True, 'gameProcessesStarted': 0, 'browserGameplayQualified': False}
    for path in ['/', '/majesty/', '/multiplayer/resume.html', '/multiplayer/reconnect.html']:
        request = urllib.request.Request(origin + path, method='HEAD')
        with urllib.request.urlopen(request, context=context, timeout=10) as response:
            assert response.status == 200, path
            assert response.headers['Cross-Origin-Opener-Policy'] == 'same-origin'
            assert response.headers['Cross-Origin-Embedder-Policy'] == 'require-corp'
    result['staticHtmlAndIsolationHeaders'] = True
    request = urllib.request.Request(origin + '/majesty/MajestyRecomp.wasm', headers={'Range': 'bytes=0-7'})
    with urllib.request.urlopen(request, context=context, timeout=10) as response:
        assert response.status == 206
        assert response.headers.get_content_type() == 'application/wasm'
        assert response.read(9) == b'\0asm\x01\0\0\0'
    result['wasmMimeAndRange'] = True
    endpoint = origin.replace('https:', 'wss:', 1) + '/rooms'
    options = dict(ssl=context, origin=origin, subprotocols=['recomp-directplay-v1'],
                   compression=None, open_timeout=10, close_timeout=1, proxy=None)
    for modified, expected in [({'origin': 'https://different.invalid'}, 403), ({'subprotocols': ['wrong-protocol']}, 400)]:
        try:
            async with connect(endpoint, **(options | modified)):
                raise AssertionError('Unexpected unauthorized upgrade')
        except InvalidStatus as error:
            assert error.response.status_code == expected
    result['wrongOriginAndSubprotocolRejected'] = True
    async with connect(endpoint, **options) as host, connect(endpoint, **options) as guest:
        async def rpc(socket, operation, request, body):
            await socket.send(relay.HEADER.pack(relay.MAGIC, 1, operation, request, 0) + body)
            message = await asyncio.wait_for(socket.recv(), 5)
            assert relay.HEADER.unpack_from(message) == (relay.MAGIC, 1, operation | relay.REPLY, request, 0)
            return message[20:]
        for socket in (host, guest):
            await rpc(socket, relay.HELLO, 1, relay.string(contract.MANIFEST))
        created = await rpc(host, relay.CREATE, 2, contract.session(b'HTTPS verification').encode())
        description = relay.Session.read(relay.Reader(created))
        await rpc(host, relay.PLAYER, 3, contract.player(b'Host').encode())
        joined = relay.Reader(await rpc(guest, relay.JOIN, 2, description.encode()))
        relay.Session.read(joined)
        assert joined.u32() == 1 and relay.Player.read(joined).id == 2
        await rpc(guest, relay.PLAYER, 3, contract.player(b'Guest').encode())
        assert relay.HEADER.unpack_from(await asyncio.wait_for(host.recv(), 5))[2] == relay.PLAYER_EVENT
        for sequence in range(1, 101):
            payload = relay.put(sequence) + b'\0\xffconstruction-order'
            await host.send(relay.HEADER.pack(relay.MAGIC, 1, relay.SEND, 0, 0) + relay.put(sequence, 2, 0, 1) + payload)
            event = await asyncio.wait_for(guest.recv(), 5)
            assert relay.HEADER.unpack_from(event)[2] == relay.PACKET_EVENT
            assert event[20:] == relay.put(sequence, 2, 3) + payload
            assert relay.HEADER.unpack_from(await asyncio.wait_for(host.recv(), 5))[2] == relay.SEND_ACK
        await guest.close()
        assert relay.HEADER.unpack_from(await asyncio.wait_for(host.recv(), 5))[2] == relay.LOST_EVENT
    result.update(twoClientsJoinThroughTlsProxy=True, orderedBinaryCommands=100, disconnectNotification=True,
                  socketsReleased=True, qualified=True)
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('origin')
    parser.add_argument('certificate', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    assert args.origin.startswith('https://') and not args.output.exists()
    report = asyncio.run(verify(args.origin, args.certificate))
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
