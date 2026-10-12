import asyncio
import importlib.util
from pathlib import Path
import sys
import unittest

RELAY_PATH = Path(__file__).resolve().parents[1] / 'scripts/room_relay.py'
spec = importlib.util.spec_from_file_location('majesty_room_relay', RELAY_PATH)
relay = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = relay
spec.loader.exec_module(relay)

MANIFEST = b'a' * 64 + b':' + b'b' * 64 + b':' + b'c' * 64


def session(name=b'Test room', password=b''):
    desc = bytearray(80)
    import struct
    struct.pack_into('<I', desc, 0, 80)
    struct.pack_into('<I', desc, 40, 4)
    desc[24:40] = b'game application'
    return relay.Session(desc, name, password)


def player(name=b'Mike'):
    return relay.Player(0xffffffff, 0, name, b'', b'')


class RelayContracts(unittest.TestCase):
    def setUp(self):
        self.service = relay.Relay()
        self.host, self.guest = relay.Peer(None), relay.Peer(None)
        for p in (self.host, self.guest):
            self.assertEqual(self.service.dispatch(p, relay.HELLO, relay.string(MANIFEST))[0], 0)
        hr, out = self.service.dispatch(self.host, relay.CREATE, session().encode())
        self.assertEqual(hr, 0)
        self.room = self.host.room
        self.join = self.room.session.encode()

    def test_join_snapshot_and_roster_notification(self):
        self.assertEqual(self.service.dispatch(self.host, relay.PLAYER, player(b'Host').encode())[0], 0)
        hr, out = self.service.dispatch(self.guest, relay.JOIN, self.join)
        self.assertEqual(hr, 0)
        r = relay.Reader(out)
        relay.Session.read(r)
        self.assertEqual(r.u32(), 1)
        self.assertEqual(relay.Player.read(r).short, b'Host')
        r.done()
        self.assertEqual(self.service.dispatch(self.guest, relay.PLAYER, player().encode())[0], 0)
        self.assertEqual(self.host.player.id, 2)
        self.assertEqual(self.guest.player.id, 3)
        self.assertEqual(relay.HEADER.unpack_from(self.host.outgoing.get_nowait())[2], relay.PLAYER_EVENT)

    def test_content_mismatch_rejects_join_and_listing(self):
        self.guest.manifest = MANIFEST[:-1] + b'd'
        self.assertEqual(self.service.dispatch(self.guest, relay.JOIN, self.join)[0], relay.NO_SESSION)
        hr, out = self.service.dispatch(self.guest, relay.LIST, bytes(16) + relay.put(1))
        self.assertEqual((hr, out), (0, relay.put(0)))

    def test_legacy_join_supplies_only_instance_guid(self):
        desc = bytearray(80)
        import struct
        struct.pack_into('<I', desc, 0, 80)
        desc[8:24] = self.room.session.desc[8:24]
        joining = relay.Session(desc, b'', b'')
        self.assertEqual(self.service.dispatch(self.guest, relay.JOIN, joining.encode())[0], 0)

    def test_password_not_disclosed_in_listing(self):
        self.room.session.password = b'secret'
        hr, out = self.service.dispatch(self.guest, relay.LIST, bytes(16) + relay.put(1))
        self.assertEqual(hr, 0)
        self.assertNotIn(b'secret', out)
        self.assertEqual(self.service.dispatch(self.guest, relay.JOIN, self.join)[0], relay.PASSWORD)

    def test_host_owns_session_settings(self):
        self.service.dispatch(self.guest, relay.JOIN, self.join)
        self.assertEqual(self.service.dispatch(self.guest, relay.SESSION, self.join)[0], relay.ACCESS)
        changed = self.room.session
        changed.patch(4, 0x21)
        self.assertEqual(self.service.dispatch(self.host, relay.SESSION, changed.encode())[0], 0)
        extra = relay.Peer(None, manifest=MANIFEST)
        self.assertEqual(self.service.dispatch(extra, relay.JOIN, changed.encode())[0], relay.CLOSED)

    def test_sender_and_recipient_are_validated(self):
        self.service.dispatch(self.host, relay.PLAYER, player().encode())
        for words in ((1, 99, 0, 1), (2, 2, 0, 1), (1, 2, 99, 1), (1, 2, 0, 0x40)):
            with self.assertRaises(ValueError):
                self.service.dispatch(self.host, relay.SEND, relay.put(*words) + b'command')

    def test_disconnect_terminates_session(self):
        self.service.dispatch(self.guest, relay.JOIN, self.join)
        self.service.depart(self.guest)
        self.assertEqual(self.service.rooms, {})
        self.assertIsNone(self.host.room)
        self.assertIsNone(self.guest.room)
        self.assertEqual(relay.HEADER.unpack_from(self.host.outgoing.get_nowait())[2], relay.LOST_EVENT)

    def test_explicit_leave_notifies_others_without_failing_the_leaver(self):
        self.service.dispatch(self.guest, relay.JOIN, self.join)
        self.assertEqual(self.service.dispatch(self.guest, relay.LEAVE, b''), (0, b''))
        self.assertEqual(self.service.rooms, {})
        self.assertTrue(self.guest.outgoing.empty())
        self.assertEqual(relay.HEADER.unpack_from(self.host.outgoing.get_nowait())[2], relay.LOST_EVENT)

    def test_malformed_and_oversized_packets_rejected(self):
        for payload in (b'', bytes(79), self.join + b'junk'):
            with self.assertRaises(ValueError):
                self.service.dispatch(self.guest, relay.JOIN, payload)
        with self.assertRaises(ValueError):
            self.host.enqueue(relay.PACKET_EVENT, bytes(relay.LIMIT))
        with self.assertRaises(ValueError):
            relay.Reader(relay.put(256) + bytes(256)).string()

    def test_small_chunk_burst_preserves_order_with_bounded_storage(self):
        peer = relay.Peer(None)
        for sequence in range(1200):
            peer.enqueue(relay.PACKET_EVENT, relay.put(sequence) + bytes(1024))
        self.assertLess(peer.bytes, relay.QUEUE_BYTES)
        for sequence in range(1200):
            packet = peer.outgoing.get_nowait()
            self.assertEqual(relay.word(packet, 20), sequence)
            peer.bytes -= len(packet)
        self.assertEqual(peer.bytes, 0)
        for _ in range(relay.QUEUE_MESSAGES):
            peer.enqueue(relay.SEND_ACK, relay.put(1))
        before = peer.bytes
        with self.assertRaisesRegex(ValueError, 'queue full'):
            peer.enqueue(relay.SEND_ACK, relay.put(2))
        self.assertEqual(peer.bytes, before)
        self.assertEqual(peer.outgoing.qsize(), relay.QUEUE_MESSAGES)

    def test_byte_budget_rejects_transfer_before_entry_budget(self):
        peer = relay.Peer(None)
        chunk = bytes(relay.LIMIT - relay.HEADER.size)
        while peer.bytes + relay.LIMIT <= relay.QUEUE_BYTES:
            peer.enqueue(relay.PACKET_EVENT, chunk)
        before = (peer.bytes, peer.outgoing.qsize())
        self.assertLess(before[1], relay.QUEUE_MESSAGES)
        with self.assertRaisesRegex(ValueError, 'queue full'):
            peer.enqueue(relay.PACKET_EVENT, chunk)
        self.assertEqual((peer.bytes, peer.outgoing.qsize()), before)


class RealWebSocketFlow(unittest.IsolatedAsyncioTestCase):
    async def test_two_clients_join_route_ordered_binary_commands_and_disconnect(self):
        from websockets.asyncio.server import serve
        from websockets.asyncio.client import connect
        service = relay.Relay()
        async with serve(service.handle, '127.0.0.1', 0, subprotocols=['recomp-directplay-v1'], compression=None) as server:
            port = server.sockets[0].getsockname()[1]
            url = f'ws://127.0.0.1:{port}/rooms'
            async with connect(url, subprotocols=['recomp-directplay-v1']) as a, connect(url, subprotocols=['recomp-directplay-v1']) as b:
                async def rpc(ws, op, req, body):
                    await ws.send(relay.HEADER.pack(relay.MAGIC, 1, op, req, 0) + body)
                    msg = await asyncio.wait_for(ws.recv(), 2)
                    header = relay.HEADER.unpack_from(msg)
                    self.assertEqual(header, (relay.MAGIC, 1, op | relay.REPLY, req, 0))
                    return msg[20:]
                for ws in (a, b):
                    await rpc(ws, relay.HELLO, 1, relay.string(MANIFEST))
                created = await rpc(a, relay.CREATE, 2, session().encode())
                r = relay.Reader(created)
                desc = relay.Session.read(r)
                await rpc(a, relay.PLAYER, 3, player(b'Host').encode())
                joined = await rpc(b, relay.JOIN, 2, desc.encode())
                r = relay.Reader(joined)
                relay.Session.read(r)
                self.assertEqual(r.u32(), 1)
                self.assertEqual(relay.Player.read(r).id, 2)
                await rpc(b, relay.PLAYER, 3, player(b'Guest').encode())
                event = await asyncio.wait_for(a.recv(), 2)
                self.assertEqual(relay.HEADER.unpack_from(event)[2], relay.PLAYER_EVENT)
                # Opaque commands arrive unchanged and in order, with relay-owned
                # source/target identities and per-recipient sequence numbers.
                for sequence in range(1, 101):
                    payload = relay.put(sequence) + b'\x00\xffconstruction-order'
                    await a.send(relay.HEADER.pack(relay.MAGIC, 1, relay.SEND, 0, 0) + relay.put(sequence, 2, 0, 1) + payload)
                    event = await asyncio.wait_for(b.recv(), 2)
                    self.assertEqual(relay.HEADER.unpack_from(event)[2], relay.PACKET_EVENT)
                    self.assertEqual(event[20:], relay.put(sequence, 2, 3) + payload)
                    ack = await asyncio.wait_for(a.recv(), 2)
                    self.assertEqual(relay.HEADER.unpack_from(ack)[2], relay.SEND_ACK)
                    self.assertEqual(ack[20:], relay.put(sequence))
                await b.close()
                event = await asyncio.wait_for(a.recv(), 2)
                self.assertEqual(relay.HEADER.unpack_from(event)[2], relay.LOST_EVENT)
                self.assertEqual(service.rooms, {})


if __name__ == '__main__':
    unittest.main()
