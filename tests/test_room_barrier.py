import asyncio
import importlib.util
from pathlib import Path
import sys
import unittest

PATH = Path(__file__).resolve().parents[1] / 'scripts/room_relay.py'
spec = importlib.util.spec_from_file_location('majesty_barrier_relay', PATH)
relay = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = relay
spec.loader.exec_module(relay)
MANIFEST = b'a' * 64 + b':' + b'b' * 64 + b':' + b'c' * 64
# Opaque to the transport: the game client will validate actual frame, seed,
# content, region and checkpoint bytes. This is never a claim of native loading.
DESCRIPTOR = b'world=frontier frame=1000 from=0_0 to=-1_0 checkpoint=' + b'd' * 64


def session():
    desc = bytearray(80)
    import struct
    struct.pack_into('<I', desc, 0, 80)
    struct.pack_into('<I', desc, 40, 4)
    desc[24:40] = b'game application'
    return relay.Session(desc, b'Barrier test', b'')


def player(name):
    return relay.Player(0xffffffff, 0, name, b'', b'').encode()


def action(kind, serial=1, descriptor=DESCRIPTOR):
    return relay.put(kind, serial) + relay.string(descriptor)


def enable():
    return relay.put(relay.BARRIER_ENABLE) + relay.string(relay.BARRIER_CONTRACT)


class BarrierContracts(unittest.TestCase):
    def setUp(self):
        self.service = relay.Relay()
        self.host, self.guest = relay.Peer(None), relay.Peer(None)
        for peer in (self.host, self.guest):
            self.assertEqual(self.service.dispatch(peer, relay.HELLO, relay.string(MANIFEST))[0], 0)
        self.assertEqual(self.service.dispatch(self.host, relay.CREATE, session().encode())[0], 0)
        self.room = self.host.room
        self.assertEqual(self.service.dispatch(self.host, relay.PLAYER, player(b'Host'))[0], 0)
        self.assertEqual(self.service.dispatch(self.guest, relay.JOIN, self.room.session.encode())[0], 0)
        self.assertEqual(self.service.dispatch(self.guest, relay.PLAYER, player(b'Guest'))[0], 0)
        self.drain(self.host)
        for peer in (self.host, self.guest):
            self.assertEqual(self.service.dispatch(peer, relay.BARRIER, enable()), (0, relay.put(1)))

    def drain(self, peer):
        result = []
        while not peer.outgoing.empty():
            packet = peer.outgoing.get_nowait()
            peer.bytes -= len(packet)
            result.append(packet)
        return result

    def call(self, peer, kind, serial=1, descriptor=DESCRIPTOR):
        return self.service.dispatch(peer, relay.BARRIER, action(kind, serial, descriptor))

    def events(self, stage):
        for peer in (self.host, self.guest):
            packets = self.drain(peer)
            self.assertEqual(len(packets), 1)
            self.assertEqual(relay.HEADER.unpack_from(packets[0])[2], relay.BARRIER_EVENT)
            reader = relay.Reader(packets[0][20:])
            self.assertEqual((reader.u32(), reader.u32()), (self.room.barrier_serial, stage))
            self.assertEqual(reader.string(relay.BARRIER_DESCRIPTOR_BYTES), DESCRIPTOR)
            self.assertEqual(reader.u32(), 2)
            self.assertEqual([reader.u32(), reader.u32()], sorted([self.host.player.id, self.guest.player.id]))
            reader.done()

    def begin(self):
        self.assertEqual(self.call(self.host, relay.BARRIER_BEGIN), (0, b''))
        self.events(relay.BARRIER_PREPARED)

    def commit(self):
        self.begin()
        self.assertEqual(self.call(self.host, relay.BARRIER_READY), (0, b''))
        self.assertEqual(self.call(self.guest, relay.BARRIER_READY), (0, b''))
        self.events(relay.BARRIER_COMMITTED)

    def test_legacy_peers_receive_no_new_events_without_negotiation(self):
        self.guest.barrier_enabled = False
        self.assertEqual(self.call(self.host, relay.BARRIER_BEGIN)[0], relay.ACCESS)
        self.assertIsNone(self.room.barrier)
        self.assertTrue(self.host.outgoing.empty() and self.guest.outgoing.empty())
        self.assertEqual(self.room.barrier_serial, 0)

    def test_only_host_can_propose_and_all_registered_members_are_required(self):
        self.assertEqual(self.call(self.guest, relay.BARRIER_BEGIN)[0], relay.ACCESS)
        self.guest.player = None
        self.assertEqual(self.call(self.host, relay.BARRIER_BEGIN)[0], relay.ACCESS)
        self.assertIsNone(self.room.barrier)

    def test_commit_and_resume_each_require_every_peer_exactly_once(self):
        self.begin()
        self.assertEqual(self.call(self.host, relay.BARRIER_LOADED)[0], relay.CLOSED)
        for _ in range(3):
            self.assertEqual(self.call(self.host, relay.BARRIER_READY), (0, b''))
        self.assertFalse(self.room.barrier.committed)
        self.assertTrue(self.host.outgoing.empty() and self.guest.outgoing.empty())
        self.assertEqual(self.call(self.guest, relay.BARRIER_READY), (0, b''))
        self.events(relay.BARRIER_COMMITTED)
        self.assertEqual(self.call(self.guest, relay.BARRIER_READY), (0, b''))
        for _ in range(3):
            self.assertEqual(self.call(self.host, relay.BARRIER_LOADED), (0, b''))
        self.assertIsNotNone(self.room.barrier)
        self.assertTrue(self.host.outgoing.empty() and self.guest.outgoing.empty())
        self.assertEqual(self.call(self.guest, relay.BARRIER_LOADED), (0, b''))
        self.events(relay.BARRIER_COMPLETE)
        self.assertIsNone(self.room.barrier)
        self.assertEqual(self.call(self.guest, relay.BARRIER_LOADED)[0], relay.CLOSED)
        self.assertEqual(self.call(self.host, relay.BARRIER_BEGIN)[0], relay.CLOSED)
        self.assertEqual(self.call(self.host, relay.BARRIER_BEGIN, serial=2), (0, b''))

    def test_wrong_descriptor_stale_serial_and_oversized_input_cannot_count_as_ready(self):
        self.begin()
        for serial, desc in [(0, DESCRIPTOR), (2, DESCRIPTOR), (1, DESCRIPTOR + b'changed')]:
            self.assertNotEqual(self.call(self.guest, relay.BARRIER_READY, serial, desc)[0], 0)
        with self.assertRaises(ValueError):
            self.call(self.guest, relay.BARRIER_READY, descriptor=b'x' * (relay.BARRIER_DESCRIPTOR_BYTES + 1))
        self.assertEqual(self.call(self.guest, 99)[0], relay.INVALID)
        self.assertEqual(self.room.barrier.ready, set())
        self.assertTrue(self.host.outgoing.empty() and self.guest.outgoing.empty())

    def test_pending_roster_cannot_change_and_cancel_consumes_proposal_serial(self):
        self.begin()
        extra = relay.Peer(None, manifest=MANIFEST)
        self.assertEqual(self.service.dispatch(extra, relay.JOIN, self.room.session.encode())[0], relay.CLOSED)
        self.assertEqual(self.service.dispatch(self.host, relay.SESSION, self.room.session.encode())[0], relay.CLOSED)
        self.assertEqual(self.call(self.guest, relay.BARRIER_CANCEL), (0, b''))
        self.events(relay.BARRIER_CANCELED)
        self.assertIsNone(self.room.barrier)
        self.assertEqual(self.call(self.host, relay.BARRIER_BEGIN)[0], relay.CLOSED)
        self.assertEqual(self.call(self.host, relay.BARRIER_BEGIN, serial=2), (0, b''))
        self.assertEqual(self.call(self.guest, relay.BARRIER_READY)[0], relay.CLOSED)

    def test_cancel_after_load_permission_ends_entire_room(self):
        self.commit()
        self.assertEqual(self.call(self.guest, relay.BARRIER_CANCEL), (0, b''))
        self.assertIsNone(self.room.barrier)
        self.assertEqual(self.service.rooms, {})
        for peer in (self.host, self.guest):
            self.assertIsNone(peer.room)
            self.assertFalse(peer.barrier_enabled)
            self.assertEqual(relay.HEADER.unpack_from(self.drain(peer)[0])[2], relay.LOST_EVENT)

    def test_timeout_before_permission_cancels_and_after_permission_ends_room(self):
        self.begin()
        self.room.barrier.deadline = 0
        self.assertEqual(self.call(self.host, relay.BARRIER_READY)[0], relay.CLOSED)
        self.events(relay.BARRIER_CANCELED)
        self.assertEqual(self.call(self.host, relay.BARRIER_BEGIN, serial=2), (0, b''))
        self.drain(self.host);self.drain(self.guest)
        for peer in (self.host, self.guest):
            self.assertEqual(self.call(peer, relay.BARRIER_READY, serial=2), (0, b''))
        self.drain(self.host);self.drain(self.guest)
        self.room.barrier.deadline = 0
        self.assertEqual(self.call(self.host, relay.BARRIER_LOADED, serial=2)[0], relay.NO_SESSION)
        self.assertEqual(self.service.rooms, {})
        self.assertIsNone(self.room.barrier)

    def test_destroy_during_pending_proposal_cancels_without_leaving_world(self):
        self.begin()
        self.assertEqual(self.service.dispatch(self.guest, relay.DESTROY, relay.put(self.guest.player.id)), (0, b''))
        self.assertIsNone(self.room.barrier)
        self.assertIsNotNone(self.host.room)
        self.assertEqual([relay.HEADER.unpack_from(p)[2] for p in self.drain(self.host)],
                         [relay.BARRIER_EVENT, relay.DESTROY_EVENT])
        self.assertIsNone(self.guest.player)

    def test_destroy_after_permission_ends_entire_room(self):
        self.commit()
        self.assertEqual(self.service.dispatch(self.guest, relay.DESTROY, relay.put(self.guest.player.id)), (0, b''))
        self.assertEqual(self.service.rooms, {})
        self.assertIsNone(self.room.barrier)
        for peer in (self.host, self.guest):
            self.assertIsNone(peer.room)
            self.assertEqual(relay.HEADER.unpack_from(self.drain(peer)[0])[2], relay.LOST_EVENT)

    def test_four_player_party_and_repeated_transitions_retain_one_bounded_proposal(self):
        party = [self.host, self.guest]
        for name in (b'Third', b'Fourth'):
            peer = relay.Peer(None, manifest=MANIFEST)
            self.assertEqual(self.service.dispatch(peer, relay.JOIN, self.room.session.encode())[0], 0)
            self.assertEqual(self.service.dispatch(peer, relay.PLAYER, player(name))[0], 0)
            self.assertEqual(self.service.dispatch(peer, relay.BARRIER, enable())[0], 0)
            party.append(peer)
        for peer in party:
            self.drain(peer)
        for serial in range(1, 101):
            self.assertEqual(self.call(self.host, relay.BARRIER_BEGIN, serial), (0, b''))
            barrier = self.room.barrier
            self.assertEqual(len(barrier.players), 4)
            for peer in party[:-1]:
                self.assertEqual(self.call(peer, relay.BARRIER_READY, serial), (0, b''))
                self.assertFalse(barrier.committed)
            self.assertEqual(self.call(party[-1], relay.BARRIER_READY, serial), (0, b''))
            for peer in party[:-1]:
                self.assertEqual(self.call(peer, relay.BARRIER_LOADED, serial), (0, b''))
                self.assertIs(self.room.barrier, barrier)
            self.assertEqual(self.call(party[-1], relay.BARRIER_LOADED, serial), (0, b''))
            self.assertIsNone(self.room.barrier)
            self.assertEqual(self.room.barrier_serial, serial)
            self.assertLessEqual(len(barrier.descriptor), relay.BARRIER_DESCRIPTOR_BYTES)
            self.assertEqual((len(barrier.ready), len(barrier.loaded)), (4, 4))
            for peer in party:
                self.assertEqual(len(self.drain(peer)), 3)
                self.assertEqual(peer.bytes, 0)


class RealBarrierConnections(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from websockets.asyncio.server import serve
        from websockets.asyncio.client import connect
        self.service = relay.Relay()
        self.server = await serve(self.service.handle, '127.0.0.1', 0,
                                  subprotocols=['recomp-directplay-v1'], compression=None)
        url = f'ws://127.0.0.1:{self.server.sockets[0].getsockname()[1]}/rooms'
        self.a = await connect(url, subprotocols=['recomp-directplay-v1'])
        self.b = await connect(url, subprotocols=['recomp-directplay-v1'])
        self.requests = {self.a: 0, self.b: 0}
        self.events = {self.a: [], self.b: []}
        for ws in (self.a, self.b):
            await self.rpc(ws, relay.HELLO, relay.string(MANIFEST))
        created = await self.rpc(self.a, relay.CREATE, session().encode())
        desc = relay.Session.read(relay.Reader(created))
        await self.rpc(self.a, relay.PLAYER, player(b'Host'))
        await self.rpc(self.b, relay.JOIN, desc.encode())
        await self.rpc(self.b, relay.PLAYER, player(b'Guest'))
        notification = await asyncio.wait_for(self.a.recv(), 2)
        self.assertEqual(relay.HEADER.unpack_from(notification)[2], relay.PLAYER_EVENT)
        for ws in (self.a, self.b):
            await self.rpc(ws, relay.BARRIER, enable())
        self.room = next(iter(self.service.rooms.values()))

    async def asyncTearDown(self):
        await self.a.close();await self.b.close()
        self.server.close();await self.server.wait_closed()
        self.assertEqual(self.service.rooms, {})
        self.assertEqual(self.service.peers, set())
        self.assertIsNone(self.room.barrier)

    async def rpc(self, ws, op, body, status=0):
        self.requests[ws] += 1
        req = self.requests[ws]
        await ws.send(relay.HEADER.pack(relay.MAGIC, 1, op, req, 0) + body)
        while True:
            msg = await asyncio.wait_for(ws.recv(), 2)
            header = relay.HEADER.unpack_from(msg)
            if header[2] & relay.REPLY:
                self.assertEqual(header, (relay.MAGIC, 1, op | relay.REPLY, req, status))
                return msg[20:]
            self.events[ws].append(msg)

    async def event(self, ws, stage):
        msg = self.events[ws].pop(0) if self.events[ws] else await asyncio.wait_for(ws.recv(), 2)
        self.assertEqual(relay.HEADER.unpack_from(msg)[2], relay.BARRIER_EVENT)
        r = relay.Reader(msg[20:])
        self.assertEqual((r.u32(), r.u32()), (1, stage))
        self.assertEqual(r.string(relay.BARRIER_DESCRIPTOR_BYTES), DESCRIPTOR)
        self.assertEqual(r.u32(), 2)
        self.assertEqual([r.u32(), r.u32()], [2, 3]);r.done()

    async def begin(self):
        await self.rpc(self.a, relay.BARRIER, action(relay.BARRIER_BEGIN))
        for ws in (self.a, self.b):
            await self.event(ws, relay.BARRIER_PREPARED)

    async def commit(self):
        await self.begin()
        await self.rpc(self.a, relay.BARRIER, action(relay.BARRIER_READY))
        await self.rpc(self.b, relay.BARRIER, action(relay.BARRIER_READY))
        for ws in (self.a, self.b):
            await self.event(ws, relay.BARRIER_COMMITTED)

    async def test_ready_and_loaded_are_two_separate_all_party_agreements(self):
        await self.begin()
        await self.rpc(self.a, relay.BARRIER, action(relay.BARRIER_READY))
        self.assertFalse(self.room.barrier.committed)
        await self.rpc(self.b, relay.BARRIER, action(relay.BARRIER_READY, descriptor=DESCRIPTOR+b'wrong'), relay.CLOSED)
        self.assertFalse(self.room.barrier.committed)
        await self.rpc(self.b, relay.BARRIER, action(relay.BARRIER_READY))
        for ws in (self.a, self.b):
            await self.event(ws, relay.BARRIER_COMMITTED)
        timer = self.room.barrier.timer
        await self.rpc(self.a, relay.BARRIER, action(relay.BARRIER_LOADED))
        self.assertIsNotNone(self.room.barrier)
        await self.rpc(self.b, relay.BARRIER, action(relay.BARRIER_LOADED))
        for ws in (self.a, self.b):
            await self.event(ws, relay.BARRIER_COMPLETE)
        self.assertIsNone(self.room.barrier);self.assertTrue(timer.cancelled())

    async def test_real_timer_cancels_uncommitted_proposal(self):
        from unittest.mock import patch
        with patch.object(relay, 'BARRIER_SECONDS', 0.1):
            await self.begin()
            for ws in (self.a, self.b):
                await self.event(ws, relay.BARRIER_CANCELED)
        self.assertIsNone(self.room.barrier)
        self.assertIsNotNone(self.a)
        self.assertEqual(len(self.service.rooms), 1)

    async def test_missing_load_confirmation_terminates_both_connections_room(self):
        from unittest.mock import patch
        await self.begin()
        await self.rpc(self.a, relay.BARRIER, action(relay.BARRIER_READY))
        with patch.object(relay, 'BARRIER_SECONDS', 0.1):
            await self.rpc(self.b, relay.BARRIER, action(relay.BARRIER_READY))
            for ws in (self.a, self.b):
                await self.event(ws, relay.BARRIER_COMMITTED)
            for ws in (self.a, self.b):
                msg = await asyncio.wait_for(ws.recv(), 2)
                self.assertEqual(relay.HEADER.unpack_from(msg)[2], relay.LOST_EVENT)
        self.assertEqual(self.service.rooms, {})
        self.assertIsNone(self.room.barrier)

    async def test_disconnect_during_transition_never_resumes_remaining_player(self):
        await self.commit()
        timer = self.room.barrier.timer
        await self.b.close()
        msg = await asyncio.wait_for(self.a.recv(), 2)
        self.assertEqual(relay.HEADER.unpack_from(msg)[2], relay.LOST_EVENT)
        self.assertTrue(timer.cancelled())
        self.assertIsNone(self.room.barrier)
        self.assertEqual(self.service.rooms, {})


if __name__ == '__main__':
    unittest.main()
