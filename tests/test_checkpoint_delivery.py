"""Checkpoint relay flow only: no game, browser or independent internet peer."""
import asyncio
import hashlib
import tempfile
import time
import unittest

import test_room_barrier as fixtures

relay = fixtures.relay


def request(serial=1, descriptor=fixtures.DESCRIPTOR):
    return relay.put(relay.CHECKPOINT_REQUEST, serial) + relay.string(descriptor)


class DeliveryContracts(unittest.TestCase):
    def setUp(self):
        fixtures.BarrierContracts.setUp(self)
        for peer in (self.host, self.guest):
            self.assertEqual(self.service.dispatch(peer, relay.CHECKPOINT,
                             relay.put(6, 0) + relay.string(b'checkpoint-delivery-v1')),
                             (0, relay.put(1)))
    drain = fixtures.BarrierContracts.drain
    call = fixtures.BarrierContracts.call
    events = fixtures.BarrierContracts.events
    begin = fixtures.BarrierContracts.begin

    def cp(self, peer, action, *fields, serial=1, data=b''):
        return self.service.dispatch(peer, relay.CHECKPOINT,
                                     relay.put(action, serial, *fields) + data)

    def asked(self, size=3):
        self.begin()
        self.assertEqual(self.service.dispatch(self.guest, relay.CHECKPOINT, request()), (0, b''))
        self.assertEqual(self.cp(self.host, relay.CHECKPOINT_OFFER, self.guest.player.id, size), (0, b''))

    def offered(self, size=3):
        self.asked(size)
        self.assertEqual(self.cp(self.guest, relay.CHECKPOINT_ACK, self.host.player.id, 0), (0, b''))
        self.drain(self.host); self.drain(self.guest)

    def test_no_transfer_without_exact_prepared_proposal_and_guest_request(self):
        self.assertEqual(self.service.dispatch(self.guest, relay.CHECKPOINT, request())[0], relay.CLOSED)
        self.begin()
        self.assertEqual(self.service.dispatch(self.host, relay.CHECKPOINT, request())[0], relay.ACCESS)
        for body in (request(2), request(descriptor=fixtures.DESCRIPTOR + b'x')):
            self.assertNotEqual(self.service.dispatch(self.guest, relay.CHECKPOINT, body)[0], 0)
        self.assertEqual(self.cp(self.host, relay.CHECKPOINT_OFFER, self.guest.player.id, 3)[0], relay.CLOSED)
        self.assertEqual(self.room.barrier.deliveries, {})
        self.assertTrue(self.host.outgoing.empty() and self.guest.outgoing.empty())

    def test_legacy_host_receives_no_new_events_without_delivery_negotiation(self):
        self.host.checkpoint_enabled = False
        self.begin()
        self.assertNotEqual(self.service.dispatch(self.guest, relay.CHECKPOINT, request())[0], 0)
        self.assertTrue(self.host.outgoing.empty() and self.guest.outgoing.empty())
        self.assertEqual(self.room.barrier.deliveries, {})

    def test_enable_requires_registered_negotiated_peer_and_no_active_proposal(self):
        for body in (relay.put(6, 1) + relay.string(relay.CHECKPOINT_CONTRACT),
                     relay.put(6, 0) + relay.string(b'wrong-contract')):
            self.assertNotEqual(self.service.dispatch(self.guest, relay.CHECKPOINT, body)[0], 0)
        self.guest.barrier_enabled = False
        self.assertNotEqual(self.service.dispatch(self.guest, relay.CHECKPOINT,
                            relay.put(6, 0) + relay.string(relay.CHECKPOINT_CONTRACT))[0], 0)
        self.guest.barrier_enabled = True
        self.begin()
        self.assertNotEqual(self.service.dispatch(self.guest, relay.CHECKPOINT,
                            relay.put(6, 0) + relay.string(relay.CHECKPOINT_CONTRACT))[0], 0)

    def test_duplicate_request_does_not_enqueue_or_extend_deadline(self):
        self.begin()
        self.assertEqual(self.service.dispatch(self.guest, relay.CHECKPOINT, request())[0], 0)
        deadline = self.room.barrier.deadline
        self.assertEqual(self.service.dispatch(self.guest, relay.CHECKPOINT, request())[0], relay.CLOSED)
        self.assertEqual(self.room.barrier.deadline, deadline)
        packets = self.drain(self.host)
        self.assertEqual(len(packets), 1)
        self.assertEqual(relay.HEADER.unpack_from(packets[0])[2], 110)
        self.assertEqual(packets[0][20:], relay.put(0, 1, self.guest.player.id, self.host.player.id))

    def test_roles_recipient_and_unnegotiated_peer_are_refused(self):
        self.offered()
        self.assertEqual(self.cp(self.guest, relay.CHECKPOINT_CHUNK, self.host.player.id, 1, 3, data=b'abc')[0], relay.ACCESS)
        self.assertEqual(self.cp(self.host, relay.CHECKPOINT_CHUNK, 999, 1, 3, data=b'abc')[0], relay.CLOSED)
        self.assertEqual(self.cp(self.host, relay.CHECKPOINT_CHUNK, self.host.player.id, 1, 3, data=b'abc')[0], relay.ACCESS)
        self.guest.barrier_enabled = False
        self.assertEqual(self.cp(self.guest, relay.CHECKPOINT_ACK, self.host.player.id, 0)[0], relay.CLOSED)
        self.assertEqual(self.room.barrier.deliveries[self.guest.player.id].forwarded, 0)

    def test_one_outstanding_event_and_no_early_ready(self):
        self.asked()
        self.assertEqual(self.cp(self.host, relay.CHECKPOINT_CHUNK, self.guest.player.id, 1, 3, data=b'abc')[0], relay.CLOSED)
        self.assertEqual(self.call(self.guest, relay.BARRIER_READY)[0], relay.CLOSED)
        self.assertEqual(self.cp(self.guest, relay.CHECKPOINT_ACK, self.host.player.id, 0)[0], 0)
        self.drain(self.host); self.drain(self.guest)
        self.assertEqual(self.cp(self.host, relay.CHECKPOINT_CHUNK, self.guest.player.id, 1, 3, data=b'abc')[0], 0)
        before = self.guest.bytes
        self.assertEqual(self.cp(self.host, relay.CHECKPOINT_CHUNK, self.guest.player.id, 2, 1, data=b'x')[0], relay.CLOSED)
        self.assertEqual(self.cp(self.host, relay.CHECKPOINT_END, self.guest.player.id, 2)[0], relay.CLOSED)
        self.assertEqual(self.guest.bytes, before)
        self.assertEqual(self.guest.outgoing.qsize(), 1)
        self.assertLessEqual(before, relay.CHECKPOINT_CHUNK_BYTES + 44)

    def test_invalid_sizes_sequence_and_trailing_bytes_preserve_progress(self):
        self.offered(size=relay.CHECKPOINT_CHUNK_BYTES + 1)
        transfer = self.room.barrier.deliveries[self.guest.player.id]
        for sequence, size in [(0, 1), (2, 1), (1, 0), (1, relay.CHECKPOINT_CHUNK_BYTES + 1)]:
            self.assertEqual(self.cp(self.host, relay.CHECKPOINT_CHUNK, self.guest.player.id, sequence, size)[0], relay.INVALID)
        for data in (b'a' * 16383, b'a' * 16385):
            with self.assertRaises(ValueError):
                self.cp(self.host, relay.CHECKPOINT_CHUNK, self.guest.player.id, 1, 16384, data=data)
        self.assertEqual((transfer.forwarded, transfer.next_sequence, transfer.waiting), (0, 1, None))
        self.assertTrue(self.guest.outgoing.empty())

    def test_partial_chunks_cannot_amplify_acknowledgement_work(self):
        self.offered(size=32769)
        self.assertEqual(self.cp(self.host, relay.CHECKPOINT_CHUNK, self.guest.player.id,
                                 1, 1, data=b'x')[0], relay.INVALID)
        self.assertEqual(self.room.barrier.deliveries[self.guest.player.id].forwarded, 0)
        self.assertEqual(self.cp(self.host, relay.CHECKPOINT_CHUNK, self.guest.player.id,
                                 1, 16384, data=b'x' * 16384)[0], 0)
        self.assertEqual(self.room.barrier.deliveries[self.guest.player.id].forwarded, 16384)

    def test_total_bounds_and_overflow_are_refused(self):
        self.begin()
        self.assertEqual(self.service.dispatch(self.guest, relay.CHECKPOINT, request())[0], 0)
        for size in (0, relay.CHECKPOINT_MAX_BYTES + 1, 0xffffffff):
            self.assertEqual(self.cp(self.host, relay.CHECKPOINT_OFFER, self.guest.player.id, size)[0], relay.INVALID)
        self.assertEqual(self.cp(self.host, relay.CHECKPOINT_OFFER, self.guest.player.id, 1)[0], 0)
        self.assertEqual(self.cp(self.guest, relay.CHECKPOINT_ACK, self.host.player.id, 0)[0], 0)
        self.assertEqual(self.cp(self.host, relay.CHECKPOINT_CHUNK, self.guest.player.id, 1, 2, data=b'ab')[0], relay.INVALID)
        self.assertEqual(self.room.barrier.deliveries[self.guest.player.id].forwarded, 0)

    def test_maximum_total_is_admitted_without_allocating_checkpoint_bytes(self):
        self.asked(size=relay.CHECKPOINT_MAX_BYTES)
        transfer = self.room.barrier.deliveries[self.guest.player.id]
        self.assertEqual(transfer.total, 64 * 1024 * 1024)
        self.assertTrue(all(not isinstance(value, (bytes, bytearray))
                            for value in vars(transfer).values()))
        self.assertLess(self.guest.bytes, 128)

    def test_four_player_party_retains_three_scalar_windows_and_one_chunk_each(self):
        guests = [self.guest]
        for name in (b'Third', b'Fourth'):
            peer = relay.Peer(None, manifest=fixtures.MANIFEST)
            self.assertEqual(self.service.dispatch(peer, relay.JOIN, self.room.session.encode())[0], 0)
            self.assertEqual(self.service.dispatch(peer, relay.PLAYER, fixtures.player(name))[0], 0)
            self.assertEqual(self.service.dispatch(peer, relay.BARRIER, fixtures.enable())[0], 0)
            self.assertEqual(self.service.dispatch(peer, relay.CHECKPOINT,
                             relay.put(6, 0) + relay.string(relay.CHECKPOINT_CONTRACT))[0], 0)
            guests.append(peer)
        self.assertEqual(self.call(self.host, relay.BARRIER_BEGIN)[0], 0)
        for peer in [self.host] + guests:
            self.drain(peer)
        for peer in guests:
            self.assertEqual(self.service.dispatch(peer, relay.CHECKPOINT, request())[0], 0)
            self.assertEqual(self.cp(self.host, relay.CHECKPOINT_OFFER, peer.player.id, 16384)[0], 0)
            self.assertEqual(self.cp(peer, relay.CHECKPOINT_ACK, self.host.player.id, 0)[0], 0)
            self.drain(peer)
            self.assertEqual(self.cp(self.host, relay.CHECKPOINT_CHUNK, peer.player.id, 1, 16384,
                                     data=b'x' * 16384)[0], 0)
            self.assertEqual(peer.outgoing.qsize(), 1)
            self.assertEqual(peer.bytes, 16384 + 44)
        self.assertEqual(len(self.room.barrier.deliveries), 3)
        for transfer in self.room.barrier.deliveries.values():
            self.assertEqual((transfer.forwarded, transfer.waiting), (16384, 1))
            self.assertTrue(all(not isinstance(value, (bytes, bytearray))
                                for value in vars(transfer).values()))

    def test_absolute_transfer_deadline_cancels_despite_recent_progress(self):
        self.offered()
        old = self.room.barrier
        old.transfer_deadline = time.monotonic() - 1
        self.assertEqual(self.cp(self.host, relay.CHECKPOINT_CHUNK, self.guest.player.id, 1, 3, data=b'abc')[0], relay.CLOSED)
        self.assertEqual(self.call(self.guest, relay.BARRIER_READY)[0], relay.CLOSED)
        self.assertIsNone(self.room.barrier)
        self.assertEqual(old.deliveries, {})

    def test_end_requires_all_bytes_and_end_ack_precedes_ready(self):
        self.offered()
        self.assertEqual(self.cp(self.host, relay.CHECKPOINT_END, self.guest.player.id, 1)[0], relay.INVALID)
        self.assertEqual(self.cp(self.host, relay.CHECKPOINT_CHUNK, self.guest.player.id, 1, 3, data=b'abc')[0], 0)
        self.assertEqual(self.cp(self.guest, relay.CHECKPOINT_END_ACK, self.host.player.id, 1)[0], relay.CLOSED)
        self.assertEqual(self.cp(self.guest, relay.CHECKPOINT_ACK, self.host.player.id, 1)[0], 0)
        self.assertEqual(self.cp(self.guest, relay.CHECKPOINT_ACK, self.host.player.id, 1)[0], relay.CLOSED)
        self.assertEqual(self.cp(self.host, relay.CHECKPOINT_END, self.guest.player.id, 2)[0], 0)
        self.assertEqual(self.call(self.guest, relay.BARRIER_READY)[0], relay.CLOSED)
        self.assertEqual(self.cp(self.guest, relay.CHECKPOINT_ACK, self.host.player.id, 2)[0], relay.CLOSED)
        self.assertEqual(self.cp(self.guest, relay.CHECKPOINT_END_ACK, self.host.player.id, 2)[0], 0)
        self.assertEqual(self.call(self.guest, relay.BARRIER_READY)[0], 0)
        self.assertEqual(self.call(self.host, relay.BARRIER_READY)[0], 0)
        self.assertTrue(self.room.barrier.committed)
        self.assertEqual(self.service.dispatch(self.guest, relay.CHECKPOINT, request())[0], relay.CLOSED)

    def test_preexisting_verified_target_needs_no_delivery(self):
        self.begin()
        self.assertEqual(self.call(self.guest, relay.BARRIER_READY)[0], 0)
        self.assertEqual(self.service.dispatch(self.guest, relay.CHECKPOINT, request())[0], relay.CLOSED)
        self.assertEqual(self.call(self.host, relay.BARRIER_READY)[0], 0)
        self.assertTrue(self.room.barrier.committed)

    def test_idle_timeout_cancellation_and_new_proposal_drop_transfer_state(self):
        self.offered()
        old = self.room.barrier
        old.deadline = 0
        self.assertEqual(self.cp(self.host, relay.CHECKPOINT_CHUNK, self.guest.player.id, 1, 3, data=b'abc')[0], relay.CLOSED)
        self.assertIsNone(self.room.barrier)
        self.assertEqual(old.deliveries, {})
        self.assertEqual(self.call(self.host, relay.BARRIER_BEGIN, serial=2)[0], 0)
        self.assertEqual(self.room.barrier.deliveries, {})
        self.assertEqual(self.cp(self.guest, relay.CHECKPOINT_ACK, self.host.player.id, 0)[0], relay.CLOSED)

    def test_only_acknowledged_progress_extends_idle_timeout_with_fixed_total_cap(self):
        self.offered()
        transfer = self.room.barrier.deliveries[self.guest.player.id]
        cap = self.room.barrier.transfer_deadline
        self.room.barrier.deadline = time.monotonic() + 1
        self.assertEqual(self.cp(self.host, relay.CHECKPOINT_CHUNK, self.guest.player.id, 1, 3, data=b'abc')[0], 0)
        before = self.room.barrier.deadline
        self.assertEqual(self.cp(self.guest, relay.CHECKPOINT_ACK, self.host.player.id, 0)[0], relay.CLOSED)
        self.assertEqual(self.room.barrier.deadline, before)
        self.room.barrier.transfer_deadline = time.monotonic() + 2
        self.assertEqual(self.cp(self.guest, relay.CHECKPOINT_ACK, self.host.player.id, 1)[0], 0)
        self.assertLessEqual(self.room.barrier.deadline, self.room.barrier.transfer_deadline)
        self.assertLess(self.room.barrier.deadline, cap)
        self.assertIsNone(transfer.waiting)

    def test_saturated_recipient_queue_cannot_advance_sender_progress(self):
        self.offered()
        transfer = self.room.barrier.deliveries[self.guest.player.id]
        self.guest.bytes = relay.QUEUE_BYTES
        with self.assertRaises(ValueError):
            self.cp(self.host, relay.CHECKPOINT_CHUNK, self.guest.player.id, 1, 3, data=b'abc')
        self.assertEqual((transfer.forwarded, transfer.next_sequence, transfer.waiting), (0, 1, None))

    def test_disconnect_removes_pending_delivery_and_entire_party(self):
        self.asked()
        old = self.room.barrier
        self.service.depart(self.guest)
        self.assertEqual(self.service.rooms, {})
        self.assertIsNone(self.host.room)
        self.assertEqual(old.deliveries, {})
        self.assertFalse(self.host.checkpoint_enabled or self.guest.checkpoint_enabled)


class RealDeliveryConnections(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        await fixtures.RealBarrierConnections.asyncSetUp(self)
        for ws in (self.a, self.b):
            self.assertEqual(await self.rpc(ws, relay.CHECKPOINT,
                             relay.put(6, 0) + relay.string(relay.CHECKPOINT_CONTRACT)), relay.put(1))
    asyncTearDown = fixtures.RealBarrierConnections.asyncTearDown
    rpc = fixtures.RealBarrierConnections.rpc
    event = fixtures.RealBarrierConnections.event
    begin = fixtures.RealBarrierConnections.begin

    async def cp(self, ws, action, *fields, data=b'', status=0):
        return await self.rpc(ws, relay.CHECKPOINT,
                              relay.put(action, 1, *fields) + data, status)

    async def checkpoint_event(self, ws, action, sender, recipient):
        message = self.events[ws].pop(0) if self.events[ws] else await asyncio.wait_for(ws.recv(), 2)
        self.assertEqual(relay.HEADER.unpack_from(message)[2], 110)
        r = relay.Reader(message[20:])
        self.assertEqual([r.u32() for _ in range(4)], [action, 1, sender, recipient])
        return r

    async def test_stream_real_websocket_bytes_to_file_then_complete_agreement(self):
        await self.begin()
        await self.rpc(self.b, relay.CHECKPOINT, request())
        (await self.checkpoint_event(self.a, 0, 3, 2)).done()
        size = 25 * 16384 + 173
        await self.cp(self.a, 1, 3, size)
        event = await self.checkpoint_event(self.b, 1, 2, 3)
        self.assertEqual(event.u32(), size); event.done()
        await self.cp(self.b, 3, 2, 0)
        event = await self.checkpoint_event(self.a, 3, 3, 2)
        self.assertEqual(event.u32(), 0); event.done()
        expected = hashlib.sha256()
        with tempfile.TemporaryFile() as received:
            sequence, offset = 1, 0
            while offset < size:
                chunk = bytes((i + offset) % 251 for i in range(min(16384, size - offset)))
                expected.update(chunk)
                await self.cp(self.a, 2, 3, sequence, len(chunk), data=chunk)
                event = await self.checkpoint_event(self.b, 2, 2, 3)
                self.assertEqual(event.u32(), sequence)
                payload = event.take(event.u32()); event.done()
                self.assertEqual(payload, chunk)
                received.write(payload)
                await self.cp(self.b, 3, 2, sequence)
                event = await self.checkpoint_event(self.a, 3, 3, 2)
                self.assertEqual(event.u32(), sequence); event.done()
                offset += len(chunk); sequence += 1
            await self.cp(self.a, 4, 3, sequence)
            event = await self.checkpoint_event(self.b, 4, 2, 3)
            self.assertEqual(event.u32(), sequence); event.done()
            received.seek(0)
            actual = hashlib.file_digest(received, 'sha256').hexdigest()
            self.assertEqual(actual, expected.hexdigest())
            await self.rpc(self.b, relay.BARRIER, fixtures.action(relay.BARRIER_READY), relay.CLOSED)
            await self.cp(self.b, 5, 2, sequence)
            event = await self.checkpoint_event(self.a, 5, 3, 2)
            self.assertEqual(event.u32(), sequence); event.done()
        for ws in (self.a, self.b):
            await self.rpc(ws, relay.BARRIER, fixtures.action(relay.BARRIER_READY))
        for ws in (self.a, self.b):
            await self.event(ws, relay.BARRIER_COMMITTED)
        for ws in (self.a, self.b):
            await self.rpc(ws, relay.BARRIER, fixtures.action(relay.BARRIER_LOADED))
        for ws in (self.a, self.b):
            await self.event(ws, relay.BARRIER_COMPLETE)
        self.assertIsNone(self.room.barrier)
        self.assertFalse(self.events[self.a] or self.events[self.b])

    async def test_real_peer_cannot_pipeline_chunks_before_acknowledgement(self):
        await self.begin()
        await self.rpc(self.b, relay.CHECKPOINT, request())
        (await self.checkpoint_event(self.a, 0, 3, 2)).done()
        await self.cp(self.a, 1, 3, 32768)
        await self.cp(self.a, 2, 3, 1, 1, data=b'x', status=relay.CLOSED)
        self.assertEqual(self.room.barrier.deliveries[3].forwarded, 0)
        event = await self.checkpoint_event(self.b, 1, 2, 3)
        self.assertEqual(event.u32(), 32768); event.done()
        await self.cp(self.b, 3, 2, 0)
        await self.cp(self.a, 2, 3, 1, 16384, data=b'x' * 16384)
        await self.cp(self.a, 2, 3, 2, 16384, data=b'y' * 16384, status=relay.CLOSED)
        self.assertEqual(self.room.barrier.deliveries[3].forwarded, 16384)
        self.assertEqual(self.room.barrier.deliveries[3].waiting, 1)

    async def test_disconnect_during_transfer_ends_room_and_discards_delivery(self):
        await self.begin()
        await self.rpc(self.b, relay.CHECKPOINT, request())
        (await self.checkpoint_event(self.a, 0, 3, 2)).done()
        await self.cp(self.a, 1, 3, 32768)
        barrier = self.room.barrier
        await self.b.close()
        message = await asyncio.wait_for(self.a.recv(), 2)
        self.assertEqual(relay.HEADER.unpack_from(message)[2], relay.LOST_EVENT)
        self.assertIsNone(self.room.barrier)
        self.assertEqual(barrier.deliveries, {})


if __name__ == '__main__':
    unittest.main()
