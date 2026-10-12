"""Synthetic protocol fixtures; no original world or gameplay qualification."""
import struct
import sys
import asyncio
import importlib.util
import tempfile
from types import SimpleNamespace
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from lib.native_original_guest_replay import GuestReplaySequence, replay_guest, replay_receive_timeout
from websockets.asyncio.client import connect
from websockets.asyncio.server import serve


def test_home_replay_receive_wait_preserves_delivery_deadline():
    assert replay_receive_timeout(None)==.5
    window=SimpleNamespace(pending=False,delivered=False,deadline=None,clock=lambda:20)
    home=SimpleNamespace(window=window)
    assert replay_receive_timeout(home)==.5
    window.pending=True
    assert replay_receive_timeout(home)==.05
    window.deadline=20.02
    assert abs(replay_receive_timeout(home)-.02)<1e-10
    window.deadline=19
    assert replay_receive_timeout(home)==.001
    window.delivered=True
    assert replay_receive_timeout(home)==.5

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('original_guest_replay_test_relay', ROOT / 'scripts/room_relay.py')
relay = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = relay
spec.loader.exec_module(relay)


def packet(kind, body):
    return struct.pack('<II', 0x100, kind) + bytes(byte ^ 0x31 for byte in body)


def status(kind, player, ready, version=0x106):
    return packet(kind, struct.pack('<IIBxH32s', player, 0xffffffff, ready,
                                    version, b'1.5.1.2'))


def sequence():
    return GuestReplaySequence(status(0x20, 2, 0), status(0x20, 2, 1),
        packet(0x10, struct.pack('<II', 2, 1)), packet(3, bytes(444)),
        packet(0x10, struct.pack('<II', 1, 1)))


class OriginalGuestReplayOrdering(unittest.TestCase):
    def ready(self, s):
        self.assertEqual(s.joined(1, 2), [s.not_ready])
        self.assertEqual(s.receive(1, 2, status(2, 2, 0)), [s.ready])

    def test_exact_host_start_and_vote_required_before_guest_vote(self):
        s = sequence();self.ready(s)
        self.assertEqual(s.receive(1, 2, s.game_start), [])
        self.assertEqual(s.receive(1, 2, s.host_vote), [s.guest_vote])
        self.assertTrue(s.host_start and s.host_go)
        self.assertEqual(s.stage, 'recording-ended')

    def test_changed_game_start_never_receives_old_guest_vote(self):
        s = sequence();self.ready(s)
        changed = s.game_start[:-1] + b'\0'
        with self.assertRaisesRegex(ValueError, 'GameStart differs'):
            s.receive(1, 2, changed)
        self.assertFalse(s.host_start or s.host_go)

    def test_changed_game_start_timing_never_reuses_vote(self):
        s = sequence();self.ready(s)
        changed = bytearray(s.game_start)
        struct.pack_into('<I', changed, 8 + 28, 0x02094080)
        with self.assertRaisesRegex(ValueError, 'GameStart differs'):
            s.receive(1, 2, bytes(changed))
        self.assertFalse(s.host_start or s.host_go)

    def test_premature_host_vote_refuses(self):
        s = sequence();self.ready(s)
        with self.assertRaisesRegex(ValueError, 'outside exact'):
            s.receive(1, 2, s.host_vote)
        self.assertFalse(s.host_go)

    def test_changed_scenario_seed_never_reuses_vote(self):
        s = sequence();self.ready(s)
        changed = bytearray(s.game_start)
        struct.pack_into('<I', changed, 8 + 24, 145493308)
        with self.assertRaisesRegex(ValueError, 'GameStart differs'):
            s.receive(1, 2, bytes(changed))
        self.assertFalse(s.host_start or s.host_go)

    def test_changed_host_vote_refuses(self):
        s = sequence();self.ready(s);s.receive(1, 2, s.game_start)
        with self.assertRaisesRegex(ValueError, 'outside exact'):
            s.receive(1, 2, packet(0x10, struct.pack('<II', 1, 0)))
        self.assertFalse(s.host_go)

    def test_matching_guest_status_version_needed_for_ready(self):
        s = sequence();s.joined(1, 2)
        for payload in [status(2, 1, 0), status(2, 2, 1), status(2, 2, 0, 0x107)]:
            self.assertEqual(s.receive(1, 2, payload), [])
        self.assertEqual(s.stage, 'not-ready')
        self.assertEqual(s.receive(1, 2, status(2, 2, 0)), [s.ready])
        self.assertEqual(s.receive(1, 2, status(2, 2, 0)), [])

    def test_vote_sent_once_and_later_gameplay_unanswered(self):
        s = sequence();self.ready(s);s.receive(1, 2, s.game_start)
        self.assertEqual(s.receive(1, 2, s.host_vote), [s.guest_vote])
        self.assertEqual(s.receive(1, 2, s.host_vote), [])
        self.assertEqual(s.receive(1, 2, packet(5, bytes(12))), [])

    def test_wrong_endpoints_refuse_even_after_recording_ends(self):
        s = sequence();self.ready(s);s.receive(1, 2, s.game_start);s.receive(1, 2, s.host_vote)
        for sender, recipient in [(2, 1), (3, 2), (1, 3)]:
            with self.assertRaisesRegex(ValueError, 'Unauthenticated'):
                s.receive(sender, recipient, s.host_vote)

    def test_wrong_roster_and_out_of_order_join_refuse(self):
        s = sequence()
        with self.assertRaises(ValueError):s.joined(1, 3)
        s.joined(1, 2)
        with self.assertRaises(ValueError):s.joined(1, 2)

    def test_captured_wrong_player_vote_refuses_before_join(self):
        s = sequence()
        with self.assertRaisesRegex(ValueError, 'vote differs'):
            GuestReplaySequence(s.not_ready, s.ready,
                packet(0x10, struct.pack('<II', 3, 1)), s.game_start, s.host_vote)


class OriginalGuestReplaySocketFixture(unittest.IsolatedAsyncioTestCase):
    async def test_original_payload_order_across_production_relay(self):
        await self.roundtrip(False)

    async def test_room_visible_before_host_player_registration(self):
        await self.roundtrip(True)

    async def roundtrip(self, delayed_player):
        # Two worldless synthetic SDK peers; no native game is launched.
        state = sequence();process = SimpleNamespace(returncode=None)
        transcript = SimpleNamespace(sequence=state,
            player=relay.Player(2, 0, b'Captured party', b'Captured party', b'').encode())
        service = relay.Relay();manifest = b'a' * 64 + b':' + b'b' * 64 + b':' + b'c' * 64
        report = {'lobbyPacketMetadata': []}
        with tempfile.TemporaryDirectory() as directory:
            async with serve(service.handle, '127.0.0.1', 0, subprotocols=['recomp-directplay-v1'], compression=None) as server:
                url = f'ws://127.0.0.1:{server.sockets[0].getsockname()[1]}/rooms'
                async with connect(url, subprotocols=['recomp-directplay-v1'], compression=None) as host:
                    request = tx = 0;pending = []
                    async def rpc(op, body):
                        nonlocal request
                        request += 1
                        await host.send(relay.HEADER.pack(relay.MAGIC, 1, op, request, 0) + body)
                        while True:
                            message = await asyncio.wait_for(host.recv(), 2)
                            _, _, actual, rid, result = relay.HEADER.unpack_from(message)
                            if rid:
                                self.assertEqual((actual, rid, result), (op | relay.REPLY, request, 0))
                                return message[20:]
                            pending.append(message)
                    async def send(payload):
                        nonlocal tx
                        tx += 1
                        await host.send(relay.HEADER.pack(relay.MAGIC, 1, relay.SEND, 0, 0) +
                                        relay.put(tx, 1, 2, 1) + payload)
                    async def receive():
                        while True:
                            message = pending.pop(0) if pending else await asyncio.wait_for(host.recv(), 2)
                            _, _, op, rid, result = relay.HEADER.unpack_from(message)
                            self.assertEqual((rid, result), (0, 0))
                            if op == relay.PACKET_EVENT:
                                self.assertEqual(struct.unpack_from('<II', message, 24), (2, 1))
                                return message[32:]
                    await rpc(relay.HELLO, relay.string(manifest))
                    desc = bytearray(80);struct.pack_into('<I', desc, 0, 80)
                    struct.pack_into('<I', desc, 40, 2);desc[24:40] = b'fixture-game-app'
                    await rpc(relay.CREATE, relay.Session(desc, b'Fixture', b'').encode())
                    if not delayed_player:
                        await rpc(relay.PLAYER, relay.Player(1, 0x100, b'Host', b'Host', b'').encode())
                    task = asyncio.create_task(replay_guest(relay, connect, url, manifest,
                        transcript, process, Path(directory), report, lambda: None))
                    try:
                        if delayed_player:
                            await asyncio.sleep(.6)
                            self.assertFalse(task.done())
                            self.assertFalse(report.get('referenceJoined', False))
                            self.assertFalse(service.rooms[next(iter(service.rooms))].players)
                            await rpc(relay.PLAYER, relay.Player(1, 0x100, b'Host', b'Host', b'').encode())
                        self.assertEqual(await receive(), state.not_ready)
                        await send(status(2, 2, 0))
                        self.assertEqual(await receive(), state.ready)
                        self.assertFalse(report['capturedGuestGoStatusDelivered'])
                        await send(state.game_start)
                        await send(state.host_vote)
                        self.assertEqual(await receive(), state.guest_vote)
                        self.assertTrue(report['originalHostGameStartMatched'])
                        self.assertTrue(report['originalHostGoStatusObserved'])
                        self.assertTrue(report['capturedGuestGoStatusDelivered'])
                        self.assertEqual(len(report['replayedGuestPackets']), 3)
                        self.assertEqual([Path(row['copy']).read_bytes() for row in report['lobbyPacketMetadata']],
                                         [status(2, 2, 0), state.game_start, state.host_vote])
                        process.returncode = 0
                        await asyncio.wait_for(task, 2)
                    finally:
                        process.returncode = 0
                        if not task.done():task.cancel()
                        await asyncio.gather(task, return_exceptions=True)
        self.assertFalse(service.peers or service.rooms)


if __name__ == '__main__':
    unittest.main()
