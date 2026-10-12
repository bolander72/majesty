"""Bounded fixture tests; synthetic packets do not prove original gameplay."""
import asyncio
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.native_original_host_replay import HostTranscript, PIN, ReplaySequence, lobby_manifest, replay_host
from lib.native_original_inputs import RecordedHostPauseInputs
from websockets.asyncio.client import connect
from websockets.asyncio.server import serve

spec = importlib.util.spec_from_file_location('original_replay_test_relay', ROOT / 'scripts/room_relay.py')
relay = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = relay
spec.loader.exec_module(relay)


def packet(kind, body):
    return struct.pack('<II', 0x100, kind) + bytes(byte ^ 0x31 for byte in body)


def status(kind, player, ready):
    return packet(kind, struct.pack('<IIBxH32s', player, 0xffffffff, ready, 0x106, b'1.5.1.2'))


def packets():
    return [packet(0x11, bytes(408)), packet(1, bytes(220)),
            packet(0x100, bytes(9)), packet(0x14, b''),
            status(2, 1, 1), status(2, 2, 0), status(2, 2, 1),
            packet(0x19, bytes(4)), packet(3, bytes(444)),
            packet(0x10, struct.pack('<II', 1, 1))]


class OriginalReplayOrdering(unittest.TestCase):
    def test_observed_original_guest_zero_field_is_accepted(self):
        state = ReplaySequence(packets(), 1, 2);state.joined(2)
        def actual_shape(ready):
            return packet(0x20, struct.pack('<IIBxH32s', 2, 0, ready, 0x106, b'1.5.1.2'))
        self.assertEqual(state.receive(2, 1, actual_shape(0)), [])
        self.assertEqual(len(state.receive(2, 1, actual_shape(1))), 3)
        self.assertTrue(state.guest_ready)

    def test_host_initialization_is_sent_only_after_actual_guest_vote(self):
        original = packets();state = ReplaySequence(original, 1, 2)
        self.assertEqual(state.joined(2), original[:6])
        self.assertEqual(state.receive(2, 1, status(0x20, 2, 0)), [])
        self.assertEqual(state.receive(2, 1, status(0x20, 2, 1)), original[6:9])
        self.assertFalse(state.guest_go)
        self.assertEqual(state.receive(2, 1, packet(0x10, struct.pack('<II', 2, 1))), original[9:])
        self.assertTrue(state.guest_ready and state.guest_go)
        self.assertEqual(state.stage, 'recording-ended')
        self.assertEqual(state.receive(2, 1, status(0x20, 2, 1)), [])

    def test_early_or_spoofed_go_is_rejected(self):
        for sender, recipient, player in [(2, 1, 2), (1, 1, 2), (2, 2, 2), (2, 1, 1)]:
            with self.subTest(sender=sender, recipient=recipient, player=player):
                state = ReplaySequence(packets(), 1, 2);state.joined(2)
                with self.assertRaises(ValueError):
                    state.receive(sender, recipient, packet(0x10, struct.pack('<II', player, 1)))

    def test_duplicate_ready_does_not_duplicate_start(self):
        state = ReplaySequence(packets(), 1, 2);state.joined(2)
        self.assertEqual(len(state.receive(2, 1, status(0x20, 2, 1))), 3)
        self.assertEqual(state.receive(2, 1, status(0x20, 2, 1)), [])

    def test_corrupted_host_vote_or_order_is_rejected(self):
        for change in ['host', 'vote', 'order', 'duplicate', 'start-size']:
            with self.subTest(change=change):
                original = packets()
                if change == 'host': original[-1] = packet(0x10, struct.pack('<II', 2, 1))
                if change == 'vote': original[-1] = packet(0x10, struct.pack('<II', 1, 0))
                if change == 'order': original[-2], original[-1] = original[-1], original[-2]
                if change == 'duplicate': original.append(original[-1])
                if change == 'start-size': original[-2] = packet(3, bytes(440))
                with self.assertRaises(ValueError): ReplaySequence(original, 1, 2)

    def test_wrong_roster_or_guest_version_is_rejected(self):
        state = ReplaySequence(packets(), 1, 2)
        with self.assertRaises(ValueError): state.joined(3)
        state.joined(2)
        with self.assertRaises(ValueError): state.joined(2)
        invalid = packet(0x20, struct.pack('<IIBxH32s', 2, 0xffffffff, 1, 0x107, b'1.5.1.3'))
        with self.assertRaises(ValueError): state.receive(2, 1, invalid)


class OriginalReplaySocketFixture(unittest.IsolatedAsyncioTestCase):
    async def test_captured_stages_cross_the_real_production_relay_unchanged(self):
        await self.exchange(False)

    async def test_pause_window_crosses_only_after_original_guest_vote(self):
        await self.exchange(True)

    async def exchange(self, paused):
        # Synthetic reference peers only: no native game process or world runs.
        original = packets();state = ReplaySequence(original, 1, 2)
        desc = bytearray(80);struct.pack_into('<I', desc, 0, 80)
        struct.pack_into('<I', desc, 40, 2);desc[24:40] = b'fixture-game-app'
        transcript = SimpleNamespace(sequence=state,
            room=relay.Session(desc, b'Replay fixture', b'').encode(),
            player=relay.Player(1, 0x100, b'Host', b'Host', b'').encode(),
            pause_inputs=None, duplicate_go=[], replay_packet_count=state.packet_count)
        extra = []
        if paused:
            window = [packet(5,struct.pack('<16I',0,1,50,48,1,10,0,1,24,9,0,1,0,50,0,0))]
            window += [packet(5,struct.pack('<III',n,0,50)) for n in range(12,22,2)]
            transcript.pause_inputs = RecordedHostPauseInputs(window)
            transcript.duplicate_go = [original[-1]]
            transcript.paused_host_inspection = {'synthetic':True}
            extra = transcript.duplicate_go + window
            transcript.replay_packet_count += len(extra)
        process = SimpleNamespace(returncode=None)
        report = {'lobbyPacketMetadata': []}
        manifest = b'a' * 64 + b':' + b'b' * 64 + b':' + b'c' * 64
        service = relay.Relay()
        with tempfile.TemporaryDirectory() as directory:
            async with serve(service.handle, '127.0.0.1', 0, subprotocols=['recomp-directplay-v1'],
                             origins=[None], compression=None, max_size=relay.LIMIT,
                             max_queue=1, close_timeout=1) as server:
                url = f'ws://127.0.0.1:{server.sockets[0].getsockname()[1]}/rooms'
                task = asyncio.create_task(replay_host(relay, connect, url, manifest, transcript,
                                                     process, Path(directory), report, lambda: None))
                try:
                    for _ in range(100):
                        if report.get('recordedHostRoomCreated'): break
                        if task.done(): await task
                        await asyncio.sleep(.01)
                    self.assertTrue(report.get('recordedHostRoomCreated'))
                    async with connect(url, subprotocols=['recomp-directplay-v1'], compression=None,
                                       max_size=relay.LIMIT, max_queue=1, close_timeout=1) as guest:
                        request = 0
                        pending = []
                        async def rpc(op, body):
                            nonlocal request
                            request += 1
                            await guest.send(relay.HEADER.pack(relay.MAGIC, 1, op, request, 0) + body)
                            while True:
                                message = await asyncio.wait_for(guest.recv(), 2)
                                _, _, actual, rid, result = relay.HEADER.unpack_from(message)
                                if rid:
                                    self.assertEqual((actual, rid, result), (op | relay.REPLY, request, 0))
                                    return message[20:]
                                pending.append(message)
                        async def read_payloads(count):
                            got = []
                            while len(got) < count:
                                message = pending.pop(0) if pending else await asyncio.wait_for(guest.recv(), 2)
                                _, _, op, rid, result = relay.HEADER.unpack_from(message)
                                self.assertEqual((rid, result), (0, 0))
                                if op == relay.PACKET_EVENT:
                                    self.assertEqual(struct.unpack_from('<II', message, 24), (1, 2))
                                    got.append(message[32:])
                            return got
                        await rpc(relay.HELLO, relay.string(manifest))
                        r = relay.Reader(await rpc(relay.LIST, bytes(16) + relay.put(1)))
                        self.assertEqual(r.u32(), 1);room = relay.Session.read(r);r.done()
                        r = relay.Reader(await rpc(relay.JOIN, room.encode()))
                        relay.Session.read(r);self.assertEqual(r.u32(), 1)
                        self.assertEqual(relay.Player.read(r).id, 1);r.done()
                        r = relay.Reader(await rpc(relay.PLAYER, relay.Player(0xffffffff, 0, b'Guest', b'Guest', b'').encode()))
                        self.assertEqual(r.u32(), 2);self.assertEqual(relay.Player.read(r).id, 2);r.done()
                        self.assertEqual(await read_payloads(6), original[:6])
                        ready = status(0x20, 2, 1)
                        await guest.send(relay.HEADER.pack(relay.MAGIC, 1, relay.SEND, 0, 0) + relay.put(1, 2, 1, 1) + ready)
                        self.assertEqual(await read_payloads(3), original[6:9])
                        self.assertFalse(report['capturedHostGoStatusDelivered'])
                        if paused:self.assertFalse(transcript.pause_inputs.delivered)
                        go = packet(0x10, struct.pack('<II', 2, 1))
                        await guest.send(relay.HEADER.pack(relay.MAGIC, 1, relay.SEND, 0, 0) + relay.put(2, 2, 1, 1) + go)
                        self.assertEqual(await read_payloads(1+len(extra)), original[9:]+extra)
                        self.assertTrue(report['originalGuestGoStatusObserved'])
                        self.assertTrue(report['capturedHostGoStatusDelivered'])
                        self.assertEqual([Path(row['copy']).read_bytes() for row in report['lobbyPacketMetadata']], [ready, go])
                        self.assertEqual(len(report['replayedHostPackets']), 10+len(extra))
                        if paused:
                            self.assertTrue(report['capturedHostPauseInputWindowDelivered'])
                            self.assertEqual(report['capturedHostPauseInputWindow'],
                                [dict(bytes=len(p),sha256=hashlib.sha256(p).hexdigest()) for p in window])
                        process.returncode = 0
                    await asyncio.wait_for(task, 2)
                finally:
                    process.returncode = 0
                    if not task.done(): task.cancel()
                    await asyncio.gather(task, return_exceptions=True)
        self.assertFalse(service.peers or service.rooms)


class OriginalReplayFrozenInputs(unittest.TestCase):
    def setUp(self):
        (ROOT / 'output').mkdir(exist_ok=True)
        self.directory = tempfile.TemporaryDirectory(prefix='original-host-replay-unit-', dir=ROOT / 'output')
        self.addCleanup(self.directory.cleanup)
        self.out = Path(self.directory.name)
        self.report_path = self.out / 'unit-observed.json'
        self.audit_path = self.out / 'unit-packet-audit.json'
        def copied(name, data):
            path = self.out / name;path.write_bytes(data)
            return dict(copy=str(path), bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
        desc = bytearray(80);struct.pack_into('<I', desc, 0, 80)
        struct.pack_into('<I', desc, 40, 2);desc[24:40] = b'fixture-game-app'
        self.report = dict(nativePid=99999999, nativeExitCode=0, nativeSessionTerminal=True,
            producerAbsent=True, fixtureStopped=True, servedUnchanged=True,
            originalSettingsUnchanged=True, referenceReadyConfirmed=True, browserUsed=False,
            pinnedExecutableSha256=PIN, nativeExecutableSha256='b' * 64,
            configuredCoopChapter=1, originalHostPlayerIds=[1], referencePlayerId=2,
            originalRoomSnapshot=copied('room.bin', relay.Session(desc, b'Unit fixture', b'').encode()),
            originalHostPlayerSnapshots=[copied('player.bin', relay.Player(1, 0x100, b'Host', b'Host', b'').encode())],
            lobbyPacketMetadata=[])
        for i, payload in enumerate(packets(), 1):
            self.report['lobbyPacketMetadata'].append(dict(sequence=i, sender=1, recipient=2,
                **copied(f'packet-{i:03}.bin', payload)))
        self.audit = dict(originalGameStartPacketVerified=True, originalGoStatusPacketVerified=True,
                          readyRequestVerified=True, originalInitializationWaitObserved=True,
                          pinnedExecutableSha256=PIN, browserUsed=False, dynamicPeerIds=[1, 2])
        self.manifest = (PIN + ':' + 'b' * 64 + ':' + hashlib.sha256(b'native-lobby-observation-only-v1:RULE_FRONTIER_CHAPTER=1').hexdigest()).encode()
        self.write_reports()

    def write_reports(self):
        self.report_path.write_text(json.dumps(self.report))
        self.audit['observationSha256'] = hashlib.sha256(self.report_path.read_bytes()).hexdigest()
        self.audit_path.write_text(json.dumps(self.audit))

    def load(self):
        return HostTranscript(self.report_path, self.manifest, 'b' * 64, 1)

    def test_source_report_audit_and_payloads_are_preserved_and_checked(self):
        transcript = self.load()
        directory = self.out / 'preserved';directory.mkdir()
        transcript.preserve(directory)
        self.assertEqual(len(transcript.frozen_inputs), 14)
        self.assertEqual(transcript.sequence.packet_count, 10)
        path = Path(transcript.frozen_inputs[-1]['copy']);path.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'changed'): transcript.verify_preserved()

    def test_live_producer_and_replay_as_original_are_rejected(self):
        self.report['nativePid'] = os.getpid();self.write_reports()
        with self.assertRaisesRegex(ValueError, 'still live'): self.load()
        self.report['nativePid'] = 99999999;self.report['recordedHostReplay'] = True;self.write_reports()
        with self.assertRaisesRegex(ValueError, 'replay'): self.load()

    def test_unbound_audit_or_changed_payload_is_rejected(self):
        self.audit['observationSha256'] = '0' * 64
        self.audit_path.write_text(json.dumps(self.audit))
        with self.assertRaisesRegex(ValueError, 'bind'): self.load()
        self.write_reports()
        Path(self.report['lobbyPacketMetadata'][-1]['copy']).write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'hash/size'): self.load()

    def test_missing_original_room_snapshot_requires_a_new_capture(self):
        del self.report['originalRoomSnapshot'];self.write_reports()
        with self.assertRaisesRegex(ValueError, 'room and server'): self.load()

    def test_different_build_or_chapter_manifest_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'build/chapter'):
            HostTranscript(self.report_path, self.manifest, 'c' * 64, 1)
        with self.assertRaisesRegex(ValueError, 'manifest'):
            HostTranscript(self.report_path, self.manifest[:-1] + b'x', 'b' * 64, 1)

    def connected(self):
        content = PIN + ':' + 'd' * 64
        manifest = lobby_manifest('b' * 64, 1, '0_0', content)
        self.report.update(configuredCoopRegion='0_0', nativeFixtureContentIdentity=content,
                           networkManifestSha256=hashlib.sha256(manifest).hexdigest())
        self.write_reports()
        return manifest, content

    def test_connected_capture_requires_exact_region_content_and_recorded_manifest(self):
        manifest, content = self.connected()
        transcript = HostTranscript(self.report_path, manifest, 'b' * 64, 1, '0_0', content)
        self.assertEqual(transcript.sequence.packet_count, 10)
        for region, identity in [('1_0', content), ('0_0', PIN + ':' + 'e' * 64), (None, None)]:
            with self.subTest(region=region, identity=identity):
                with self.assertRaisesRegex(ValueError, 'region/content'):
                    HostTranscript(self.report_path, manifest, 'b' * 64, 1, region, identity)
        for recorded in [None, 'e' * 64]:
            self.report['networkManifestSha256'] = recorded;self.write_reports()
            with self.assertRaisesRegex(ValueError, 'bound'):
                HostTranscript(self.report_path, manifest, 'b' * 64, 1, '0_0', content)

    def test_legacy_connected_capture_without_contract_cannot_be_replayed(self):
        manifest, content = self.connected()
        del self.report['networkManifestSha256'];self.write_reports()
        with self.assertRaisesRegex(ValueError, 'bound'):
            HostTranscript(self.report_path, manifest, 'b' * 64, 1, '0_0', content)

    def test_invalid_connected_contract_refused(self):
        for region, content, chapter in [('00_0', PIN + ':' + 'd' * 64, 1),
                ('1000001_0', PIN + ':' + 'd' * 64, 1), ('0_0', PIN + ':' + 'D' * 64, 1),
                ('0_0', PIN + ':' + 'd' * 64, None), ('0', PIN + ':' + 'd' * 64, 1)]:
            with self.subTest(region=region, chapter=chapter):
                with self.assertRaises(ValueError): lobby_manifest('b' * 64, chapter, region, content)


if __name__ == '__main__':
    unittest.main()

import pytest
from scripts.lib.native_original_inputs import RecordedHostResumeInputs


def original_resume_window(following_count=4):
    encode=lambda words:bytes(x^0x31 for x in struct.pack('<'+'I'*len(words),*words))
    resume=struct.pack('<II',0x100,4)+encode((48,1,0,0,1,24,9,1,1,0,50,0,0))
    return [resume]+[struct.pack('<II',0x100,5)+encode((frame,0,50))for frame in range(10,10+2*following_count,2)]


def test_original_resume_requires_real_loaded_and_complete_and_delivers_once():
    rows=original_resume_window();p=RecordedHostResumeInputs(rows)
    for loaded,complete in [(False,False),(False,True),(True,False),(1,True)]:
        with pytest.raises(ValueError):p.deliver(loaded,complete)
    assert p.deliver(True,True)==rows and p.deliver(True,True)==[]


@pytest.mark.parametrize('case',['missing','owner','pause-instead-of-resume','category','input-frame','input-command','reorder'])
def test_original_resume_window_corruption_refused(case):
    rows=original_resume_window()
    if case=='missing':rows=rows[:1]
    if case=='owner':b=bytearray(rows[0]);b[8+8*4]^=1;rows[0]=bytes(b)
    if case=='pause-instead-of-resume':b=bytearray(rows[0]);b[8+7*4]^=1;rows[0]=bytes(b)
    if case=='category':b=bytearray(rows[0]);b[4]=5;rows[0]=bytes(b)
    if case=='input-frame':b=bytearray(rows[1]);b[8]^=1;rows[1]=bytes(b)
    if case=='input-command':b=bytearray(rows[1]);b[12]^=1;rows[1]=bytes(b)
    if case=='reorder':rows[-1],rows[-2]=rows[-2],rows[-1]
    with pytest.raises(ValueError):RecordedHostResumeInputs(rows)


@pytest.mark.parametrize('following_count', range(1,9))
def test_original_resume_preserves_bounded_actual_capture(following_count):
    rows = original_resume_window(following_count)
    assert RecordedHostResumeInputs(rows).deliver(True, True) == rows


def test_original_resume_rejects_oversized_capture():
    rows = original_resume_window(9)
    with pytest.raises(ValueError):
        RecordedHostResumeInputs(rows)
