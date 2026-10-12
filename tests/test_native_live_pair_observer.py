"""Synthetic relay fixtures only; no original game process is launched."""
import importlib.util
from pathlib import Path
import struct
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
spec = importlib.util.spec_from_file_location('native_live_pair_fixture', ROOT / 'scripts/run-native-live-pair.py')
pair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pair)
relay = pair.relay


class NativePairObserver(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory();self.addCleanup(self.directory.cleanup)
        self.service = pair.ObservedRelay(Path(self.directory.name))
        self.host, self.guest = relay.Peer(None), relay.Peer(None)
        for peer in [self.host, self.guest]:
            self.assertEqual(self.service.dispatch(peer, relay.HELLO, relay.string(b'a'*64+b':'+b'b'*64+b':'+b'c'*64))[0], 0)
        desc = bytearray(80);struct.pack_into('<I', desc, 0, 80);struct.pack_into('<I', desc, 40, 2)
        self.assertEqual(self.service.dispatch(self.host, relay.CREATE, relay.Session(desc, b'Observer fixture', b'').encode())[0], 0)
        self.assertEqual(self.service.dispatch(self.host, relay.PLAYER, relay.Player(0xffffffff, 0x100, b'Host', b'Host', b'').encode())[0], 0)
        self.assertEqual(self.service.dispatch(self.guest, relay.JOIN, self.host.room.session.encode())[0], 0)
        self.assertEqual(self.service.dispatch(self.guest, relay.PLAYER, relay.Player(0xffffffff, 0, b'Guest', b'Guest', b'').encode())[0], 0)
        while not self.host.outgoing.empty():self.host.outgoing.get_nowait()

    def test_observer_preserves_original_payload_and_endpoints(self):
        payload = relay.put(0x100, 3) + bytes(range(256)) + bytes(188)
        self.assertEqual(len(payload), 452)
        self.assertEqual(self.service.dispatch(self.host, relay.SEND, relay.put(1, 1, 2, 1) + payload)[0], 0)
        message = self.guest.outgoing.get_nowait()
        self.assertEqual(relay.HEADER.unpack_from(message)[2], relay.PACKET_EVENT)
        self.assertEqual(struct.unpack_from('<III', message, 20), (1, 1, 2))
        self.assertEqual(message[32:], payload)
        self.assertEqual(Path(self.service.initial[0]['copy']).read_bytes(), payload)

    def test_packet_retention_stays_bounded_without_stopping_forwarding(self):
        payload = relay.put(0x100, 3) + bytes(444)
        for sequence in range(1, 101):
            self.assertEqual(self.service.dispatch(self.host, relay.SEND, relay.put(sequence, 1, 2, 1) + payload)[0], 0)
        self.assertEqual(len(self.service.recent), 64)
        self.assertEqual(len(self.service.initial), 32)
        self.assertEqual(self.service.counts['1:256:3'], 100)
        self.assertEqual(self.guest.outgoing.qsize(), 100)
        self.assertIsNone(self.service.failure)

    def test_invalid_sender_is_rejected_by_production_before_recording(self):
        payload = relay.put(0x100, 3) + bytes(444)
        with self.assertRaises(ValueError):
            self.service.dispatch(self.guest, relay.SEND, relay.put(1, 1, 2, 1) + payload)
        self.assertFalse(self.service.initial or self.service.recent or self.service.counts)


if __name__ == '__main__':
    unittest.main()
