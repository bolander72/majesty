"""Tiny local children check route parsing/cleanup; no real tunnel or game."""
import asyncio
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from lib.native_public_tunnel import public_tunnel, tunnel_origin, protected_room_endpoint
import room_relay as relay
from websockets.asyncio.client import connect
from websockets.asyncio.server import serve
from websockets.exceptions import InvalidStatus


class PublicTunnelTests(unittest.IsolatedAsyncioTestCase):
    def fake(self, directory, text):
        path = Path(directory) / 'fake-tunnel'
        path.write_text('#!' + sys.executable + '\n' + text)
        path.chmod(0o700)
        return path

    def absent(self, pid):
        with self.assertRaises(ProcessLookupError):
            os.kill(pid, 0)

    def test_only_expected_https_origin_is_accepted(self):
        self.assertEqual(tunnel_origin('URL https://one-two-3.trycloudflare.com |'),
                         'https://one-two-3.trycloudflare.com')
        for text in ['http://one.trycloudflare.com', 'https://one.trycloudflare.com.evil',
                     'https://evil.test', 'https://one.trycloudflare.com-evil',
                     'https://one..trycloudflare.com']:
            self.assertIsNone(tunnel_origin(text))

    async def test_context_error_reaps_owned_child_and_preserves_unrelated_child(self):
        with tempfile.TemporaryDirectory(prefix='owned-tunnel-test-') as directory:
            binary = self.fake(directory, 'import time\nprint("https://one-two.trycloudflare.com",flush=True)\ntime.sleep(10)\n')
            unrelated = await asyncio.create_subprocess_exec(sys.executable, '-c', 'import time;time.sleep(10)', start_new_session=True)
            try:
                with self.assertRaisesRegex(RuntimeError, 'caller failure'):
                    async with public_tunnel(12345, Path(directory), binary=binary, startup_seconds=2) as (origin, meta):
                        self.assertEqual(origin, 'https://one-two.trycloudflare.com')
                        pid = meta['tunnelPid']
                        raise RuntimeError('caller failure')
                self.absent(pid)
                self.assertIsNone(unrelated.returncode)
                report = json.loads((Path(directory) / 'public-tunnel.json').read_text())
                self.assertTrue(report['terminal'] and report['ownedGroupAbsent'])
                self.assertFalse(report['routeTokenPublished'])
                self.assertFalse((Path(directory) / 'owned-tunnel-config.yml').exists())
            finally:
                unrelated.terminate()
                await unrelated.wait()

    async def test_startup_timeout_reaps_owned_child(self):
        with tempfile.TemporaryDirectory(prefix='owned-tunnel-timeout-') as directory:
            binary = self.fake(directory, 'import time\ntime.sleep(10)\n')
            with self.assertRaises(TimeoutError):
                async with public_tunnel(12345, Path(directory), binary=binary, startup_seconds=.1):
                    self.fail('Timeout route was yielded')
            report = json.loads((Path(directory) / 'public-tunnel.json').read_text())
            self.absent(report['tunnelPid'])
            self.assertTrue(report['ownedGroupAbsent'])

    async def test_invalid_port_starts_no_process(self):
        for port in [0, 65536, True, '12345']:
            with self.assertRaises(ValueError):
                async with public_tunnel(port, Path('/unused')):
                    self.fail('Invalid port was yielded')

    async def test_invalid_deadline_starts_no_process(self):
        for seconds in [0, 59, 601, True, '300']:
            with self.assertRaises(ValueError):
                async with public_tunnel(12345, Path('/unused'), total_seconds=seconds):
                    self.fail('Invalid deadline was yielded')

    async def test_protected_path_maps_to_original_relay_and_wrong_path_is_rejected(self):
        service = relay.Relay()
        accepted = []
        gate, handler = protected_room_endpoint(service, '/test-secret', lambda:accepted.append(True))
        async with serve(handler, '127.0.0.1', 0, process_request=gate,
                         subprotocols=['recomp-directplay-v1'], compression=None) as server:
            base = 'ws://127.0.0.1:' + str(server.sockets[0].getsockname()[1])
            with self.assertRaises(InvalidStatus) as error:
                async with connect(base + '/rooms', subprotocols=['recomp-directplay-v1']):
                    self.fail('Unauthorized path was accepted')
            self.assertEqual(error.exception.response.status_code, 404)
            self.assertFalse(accepted)
            async with connect(base + '/test-secret', subprotocols=['recomp-directplay-v1']) as ws:
                manifest = b'a' * 64 + b':' + b'b' * 64 + b':' + b'c' * 64
                request = relay.HEADER.pack(relay.MAGIC, 1, relay.HELLO, 1, 0) + relay.string(manifest)
                await ws.send(request)
                response = await ws.recv()
                self.assertEqual(relay.HEADER.unpack_from(response), (relay.MAGIC, 1, relay.HELLO | relay.REPLY, 1, 0))
                self.assertEqual(response[20:], b'')
        self.assertEqual(accepted, [True])
        self.assertFalse(service.peers or service.rooms)

    async def test_direct_unauthorized_handler_cannot_call_relay(self):
        class Connection:
            class Request:
                path = '/rooms'
            request = Request()
            async def close(self, code, reason):
                self.code = code
        class Service:
            async def handle(self, connection):
                raise AssertionError('Unauthorized handler reached service')
        _, handler = protected_room_endpoint(Service(), '/test-secret')
        connection = Connection()
        await handler(connection)
        self.assertEqual(connection.code, 1008)


if __name__ == '__main__':
    unittest.main()
