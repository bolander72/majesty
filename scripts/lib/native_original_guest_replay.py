"""Replay original guest readiness/vote to one original native host.

The vote is admitted only from an independently inspected original guest world,
and only after this host emits the identical captured GameStart and host vote.
This reference has no game world and cannot answer Loaded. An explicit native
fixture may additionally deliver one unchanged captured empty-input window.
"""
import asyncio
import json
from pathlib import Path
import struct
import time

from .native_original_host_replay import HostTranscript, ROOT, bounded_read, digest
from .native_saved_source import saved_source
from .native_original_inputs import RecordedEmptyInputs, empty_input
from .native_coop_proposal_observer import enable_proposal_observer, preserve_proposal_event
from .native_coop_proposal_replay import preserve_host_load_event


def replay_receive_timeout(home_inputs):
    # Prepared-input UI polling needs the actual peer window before the
    # native action's one-second expiry. Respect its existing100ms delivery
    # deadline instead of sleeping500ms between captured packets.
    if home_inputs is None or not home_inputs.window.pending or home_inputs.window.delivered:
        return .5
    deadline=home_inputs.window.deadline
    return .05 if deadline is None else max(.001,min(.05,deadline-home_inputs.window.clock()))


class GuestReplaySequence:
    def __init__(self, not_ready, ready, guest_go, game_start, host_go):
        self.stage = 'joining'
        self.host_start = self.host_go = False
        for payload, kind, size in [(not_ready, 0x20, 52), (ready, 0x20, 52),
                                   (guest_go, 0x10, 16), (game_start, 3, 452),
                                   (host_go, 0x10, 16)]:
            if len(payload) != size or struct.unpack_from('<II', payload) != (0x100, kind):
                raise ValueError('Captured initialization shape differs')
        for payload, expected_ready in [(not_ready, 0), (ready, 1)]:
            body = bytes(byte ^ 0x31 for byte in payload[8:])
            player, slot, flag, version, label = struct.unpack('<IIBxH32s', body)
            if (player != 2 or slot not in (0, 0xffffffff) or flag != expected_ready or
                    version != 0x106 or label.split(b'\0', 1)[0] != b'1.5.1.2'):
                raise ValueError('Captured readiness identity/version differs')
        for payload, player in [(guest_go, 2), (host_go, 1)]:
            if struct.unpack('<II', bytes(byte ^ 0x31 for byte in payload[8:])) != (player, 1):
                raise ValueError('Captured initialization vote differs')
        self.not_ready, self.ready, self.guest_vote = not_ready, ready, guest_go
        self.game_start, self.host_vote = game_start, host_go

    def joined(self, host, guest):
        if (host, guest) != (1, 2) or self.stage != 'joining':
            raise ValueError('Guest replay requires the original1/2 roster')
        self.stage = 'not-ready'
        return [self.not_ready]

    def receive(self, sender, recipient, payload):
        if (sender, recipient) != (1, 2) or not 8 <= len(payload) <= 65536:
            raise ValueError('Unauthenticated or truncated original host packet')
        if self.stage == 'recording-ended':
            return []
        category, kind = struct.unpack_from('<II', payload)
        if category != 0x100:
            raise ValueError('Unexpected original host packet category')
        if kind == 2:
            if len(payload) != 52:
                raise ValueError('Original host status shape differs')
            body = bytes(byte ^ 0x31 for byte in payload[8:])
            player, _, ready, version, label = struct.unpack('<IIBxH32s', body)
            if (player == 2 and not ready and version == 0x106 and
                    label.split(b'\0', 1)[0] == b'1.5.1.2' and self.stage == 'not-ready'):
                self.stage = 'ready'
                return [self.ready]
        elif kind == 3:
            if self.stage != 'ready' or payload != self.game_start:
                raise ValueError('This host GameStart differs from the initialized guest world')
            self.host_start = True
            self.stage = 'initializing'
        elif kind == 0x10:
            if self.stage != 'initializing' or not self.host_start or payload != self.host_vote:
                raise ValueError('Host vote arrived outside exact initialized GameStart')
            self.host_go = True
            self.stage = 'recording-ended'
            return [self.guest_vote]
        return []


class GuestTranscript:
    def __init__(self, proof_path, manifest, executable, chapter, region, content):
        self.report_path = Path(proof_path).resolve()
        proof_bytes = bounded_read(self.report_path, 2 * 1024 * 1024)
        proof = json.loads(proof_bytes)
        saved_source(self.report_path, ROOT / 'upstream/majesty-recomp')
        report_bytes = bounded_read(proof['report'], 1024 * 1024)
        report = json.loads(report_bytes)
        if (digest(report_bytes) != proof['reportSha256'] or
                report['nativeExecutableSha256'] != executable or
                report.get('configuredCoopChapter') != chapter or
                report.get('configuredCoopRegion') != region or
                report.get('nativeFixtureContentIdentity') != content or
                report.get('networkManifestSha256') != digest(manifest) or
                not report.get('originalGuestGoStatusObserved') or
                not report.get('capturedHostGoStatusDelivered')):
            raise ValueError('Guest world does not bind this build/party initialization')
        parent = HostTranscript(report['replaySourceReport'], manifest, executable,
                                chapter, region, content)
        parent_report = json.loads(parent.source_inputs[0][1])
        descriptor = parent_report['referencePlayerSnapshot']
        self.player = bounded_read(descriptor['copy'], 65536)
        if len(self.player) != descriptor['bytes'] or digest(self.player) != descriptor['sha256']:
            raise ValueError('Captured GameStart party descriptor changed')
        self.source_inputs = [(self.report_path, proof_bytes), (Path(proof['report']), report_bytes),
                              (Path(descriptor['copy']), self.player)] + parent.source_inputs
        requests = {}
        empty_inputs = []
        rows = report['lobbyPacketMetadata']
        if not 3 <= len(rows) <= 128 or sum(row['bytes'] for row in rows) > 2 * 1024 * 1024:
            raise ValueError('Guest original packet bounds differ')
        for sequence, row in enumerate(rows, 1):
            if (row['sequence'], row['sender'], row['recipient']) != (sequence, 2, 1):
                raise ValueError('Guest original packet endpoints/order differ')
            payload = bounded_read(row['copy'], 65536)
            if len(payload) != row['bytes'] or digest(payload) != row['sha256']:
                raise ValueError('Guest original payload changed')
            category, kind = struct.unpack_from('<II', payload)
            if category != 0x100:
                raise ValueError('Guest original packet category differs')
            self.source_inputs.append((Path(row['copy']), payload))
            if kind == 0x20:
                ready = (payload[16] ^ 0x31) if len(payload) == 52 else None
                if ready in (0, 1): requests.setdefault(ready, payload)
            elif kind == 0x10:
                requests.setdefault('go', payload)
            elif kind == 5:
                empty_inputs.append(payload)
        starts = [p for p in parent.sequence.start if struct.unpack_from('<II', p) == (0x100, 3)]
        if set(requests) != {0, 1, 'go'} or len(starts) != 1:
            raise ValueError('Guest capture needs original not-ready/ready/vote stages')
        self.sequence = GuestReplaySequence(requests[0], requests[1], requests['go'],
                                           starts[0], parent.sequence.go[0])
        self.original_empty_inputs = empty_inputs
        self.progress_frame = proof['snapshots'][1]['frame']
        for snapshot in proof['snapshots']:
            data = bounded_read(snapshot['path'], 2 * 1024 * 1024)
            if len(data) != snapshot['bytes'] or digest(data) != snapshot['sha256']:
                raise ValueError('Inspected guest world snapshot changed')
            self.source_inputs.append((Path(snapshot['path']), data))
        self.frozen_inputs = []

    def input_window(self):
        return RecordedEmptyInputs(self.original_empty_inputs, self.progress_frame)

    def preserve(self, directory):
        for i, (source, data) in enumerate(self.source_inputs):
            target = directory / f'{i:03}-{source.name}'
            with target.open('xb') as sink: sink.write(data)
            self.frozen_inputs.append(dict(source=str(source), copy=str(target),
                                           bytes=len(data), sha256=digest(data)))
        self.verify_preserved()

    def verify_preserved(self):
        for record in self.frozen_inputs:
            if digest(bounded_read(record['copy'], 2 * 1024 * 1024)) != record['sha256']:
                raise ValueError('Private guest replay input changed')


async def replay_guest(relay, connect, url, manifest, transcript, process, packets, report, save):
    async with connect(url, subprotocols=['recomp-directplay-v1'], compression=None,
                       max_size=relay.LIMIT, max_queue=1, close_timeout=1) as ws:
        request = tx = 0
        pending_events = []
        state = transcript.sequence
        votes = getattr(transcript, 'guest_votes', None)
        return_votes = getattr(transcript, 'saved_return_votes', None)
        revisit_votes = getattr(transcript, 'revisit_votes', None)
        if revisit_votes and report.get('replaySavedRevisitRecipientRequested') is not True:
            raise ValueError('Third votes require explicit recorded replay scope')
        target_inputs = getattr(transcript, 'target_guest_inputs', None)
        home_inputs = getattr(transcript, 'saved_home_inputs', None)
        input_window = transcript.input_window() if report.get('replayOriginalInputsRequested') else None
        report.update(replayedGuestPackets=[], originalHostGameStartMatched=False,
                      originalHostGoStatusObserved=False, capturedGuestGoStatusDelivered=False)
        if input_window:
            report.update(replayedGuestInputPackets=[], originalGuestInputWindowDelivered=False)
        if target_inputs:
            report.update(replayedGuestTargetInputPackets=[],originalGuestTargetInputsDelivered=False,
                          targetGuestInputServerAcks=[])
        if home_inputs:
            report.update(replayedSavedHomeInputPackets=[],savedHomeInputServerAcks=[])

        async def rpc(op, body):
            nonlocal request
            request += 1
            await ws.send(relay.HEADER.pack(relay.MAGIC, 1, op, request, 0) + body)
            while True:
                message = await asyncio.wait_for(ws.recv(), 3)
                header = relay.HEADER.unpack_from(message)
                if header == (relay.MAGIC, 1, op | relay.REPLY, request, 0):
                    return message[20:]
                if (report.get('nativeBeginFreshNeighborRequested') is True and
                        header[0:2] == (relay.MAGIC, 1) and header[3:] == (0, 0) and
                        len(message) <= relay.LIMIT and len(pending_events) < 32):
                    pending_events.append(message)
                else:
                    raise ValueError('Unexpected guest replay RPC response')

        async def send_stage(payloads):
            nonlocal tx
            for payload in payloads:
                tx += 1
                await ws.send(relay.HEADER.pack(relay.MAGIC, 1, relay.SEND, 0, 0) +
                              relay.put(tx, 2, 1, 1) + payload)
                report['replayedGuestPackets'].append(dict(sequence=tx, bytes=len(payload), sha256=digest(payload)))
            report.update(originalHostGameStartMatched=state.host_start,
                          originalHostGoStatusObserved=state.host_go,
                          capturedGuestGoStatusDelivered=state.stage == 'recording-ended' and len(report['replayedGuestPackets']) == 3)
            save()

        async def send_inputs(payloads):
            nonlocal tx
            for payload in payloads:
                tx += 1
                await ws.send(relay.HEADER.pack(relay.MAGIC, 1, relay.SEND, 0, 0) +
                              relay.put(tx, 2, 1, 1) + payload)
                report['replayedGuestInputPackets'].append(dict(sequence=tx, bytes=len(payload), sha256=digest(payload)))
            report['originalGuestInputWindowDelivered'] = input_window.delivered and len(report['replayedGuestInputPackets']) == 5
            if input_window.delivered:
                report['originalGuestInputWindowTriggerFrame'] = input_window.trigger_frame
            save()

        async def send_target_inputs():
            nonlocal tx
            payloads=target_inputs.pending(report,votes) if target_inputs else []
            for payload in payloads:
                sent_at=time.monotonic_ns()
                tx+=1
                await ws.send(relay.HEADER.pack(relay.MAGIC,1,relay.SEND,0,0)+relay.put(tx,2,1,1)+payload)
                report['replayedGuestTargetInputPackets'].append(dict(sequence=tx,bytes=len(payload),sha256=digest(payload)))
                if report.get('timedTargetGuestInputsRequested')is True:
                    report.setdefault('targetGuestInputSendCadence',[]).append(dict(sequence=tx,guestInputFrame=empty_input(payload),monotonicNs=sent_at))
                    report['targetGuestInputCadenceMs']=100
                if target_inputs.window.paced:
                    report.setdefault('targetGuestInputRequestBindings',[]).append(dict(sequence=tx,guestInputFrame=empty_input(payload),originalHostRequestFrame=target_inputs.window.request_frame,originalHostRequestSha256=target_inputs.window.request_sha256))
                    report['targetGuestInputMaximumLookaheadPackets']=target_inputs.window.lead-1
            if payloads:
                report.update(originalGuestTargetInputsQueued=target_inputs.window.delivered,
                    originalHostTargetResumeRequestSha256=target_inputs.window.resume_sha256,
                    originalHostTargetInputTriggerSha256=target_inputs.window.trigger_sha256,
                    originalGuestTargetInputFrames=target_inputs.window.frames,
                    originalGuestTargetInputAdmission='actual-target-writer-return+real-Complete+original-Resumed+actual-frame10')
                save()

        async def send_home_inputs():
            nonlocal tx
            for payload in home_inputs.pending(report) if home_inputs else []:
                tx += 1
                await ws.send(relay.HEADER.pack(relay.MAGIC,1,relay.SEND,0,0)+relay.put(tx,2,1,1)+payload)
                report['replayedSavedHomeInputPackets'].append(dict(sequence=tx,bytes=len(payload),sha256=digest(payload)))
                save()

        await rpc(relay.HELLO, relay.string(manifest))
        while process.returncode is None:
            r = relay.Reader(await rpc(relay.LIST, bytes(16) + relay.put(1)))
            count = r.u32()
            if count not in (0, 1): raise ValueError('Guest replay needs one native host room')
            if not count:
                r.done();await asyncio.sleep(.25);continue
            room = relay.Session.read(r);r.done()
            roster = relay.word(room.desc, 44)
            # CREATE publishes the room before the original host registers
            # its player. Wait for that real registration before joining.
            if roster == 0:
                await asyncio.sleep(.25)
                continue
            if roster != 1: raise ValueError('Native host room roster differs')
            r = relay.Reader(await rpc(relay.JOIN, room.encode()))
            joined_room = relay.Session.read(r)
            count = r.u32()
            server = relay.Player.read(r) if count == 1 else None
            if count != 1 or server.id != 1:
                raise ValueError('Native host must own original server1')
            r.done()
            # Preserve this actual native host's descriptors, rather than
            # borrowing an ancestor's room/name for a future command replay.
            room_path = packets / 'original-room.bin'
            server_path = packets / 'original-server-player.bin'
            for path, data in [(room_path, joined_room.encode()), (server_path, server.encode())]:
                with path.open('xb') as sink:sink.write(data)
            report['originalRoomSnapshot'] = dict(copy=str(room_path), bytes=len(joined_room.encode()),
                                                 sha256=digest(joined_room.encode()))
            report['originalHostPlayerSnapshots'] = [dict(copy=str(server_path),bytes=len(server.encode()),
                                                        sha256=digest(server.encode()))]
            r = relay.Reader(await rpc(relay.PLAYER, transcript.player))
            if r.u32() != 2 or relay.Player.read(r).id != 2:
                raise ValueError('Captured guest roster ID differs')
            r.done()
            report.update(referenceJoined=True, referencePlayerId=2, originalHostPlayerIds=[1])
            if report.get('nativeBeginFreshNeighborRequested') is True:
                await enable_proposal_observer(relay, rpc, report)
            await send_stage(state.joined(1, 2))
            while process.returncode is None:
                if votes:
                    target = Path(report['profile']) / 'Documents/My Games/MajestyHD/SaveGame/Coop_World_Target.GMP'
                    await votes.send_pending(relay, rpc, report, target)
                    save()
                if return_votes:
                    await return_votes.send_pending(relay, rpc, report)
                if revisit_votes and report.get('observedRevisitEvents'):
                    before_votes=(revisit_votes.sent_ready,revisit_votes.sent_loaded)
                    await revisit_votes.send_pending(relay, rpc, report)
                    if before_votes!=(revisit_votes.sent_ready,revisit_votes.sent_loaded):save()
                await send_target_inputs()
                await send_home_inputs()
                try: message = pending_events.pop(0) if pending_events else await asyncio.wait_for(ws.recv(), replay_receive_timeout(home_inputs))
                except asyncio.TimeoutError: continue
                magic, version, op, rid, status = relay.HEADER.unpack_from(message)
                if (magic, version, rid, status) != (relay.MAGIC, 1, 0, 0):
                    raise ValueError('Invalid guest replay event header')
                body = message[20:]
                if op == relay.PACKET_EVENT:
                    if len(body) < 20: raise ValueError('Truncated host packet event')
                    sequence, sender, recipient = struct.unpack_from('<III', body)
                    payload = body[12:];rows = report['lobbyPacketMetadata']
                    if (sequence != len(rows) + 1 or len(payload) > 65536 or len(rows) >= 128 or
                            sum(row['bytes'] for row in rows) + len(payload) > 2 * 1024 * 1024):
                        raise ValueError('Host packet bounds/order differ')
                    path = packets / f'host-{sequence:03}.bin'
                    with path.open('xb') as sink: sink.write(payload)
                    rows.append(dict(sequence=sequence, sender=sender, recipient=recipient,
                                     bytes=len(payload), sha256=digest(payload), copy=str(path)))
                    await send_stage(state.receive(sender, recipient, payload))
                    if target_inputs:
                        complete=[r['stage']for r in report.get('observedProposalEvents',[])]==[1,2,3]
                        target_inputs.window.observe(sender,recipient,payload,complete)
                    if home_inputs:
                        complete=[r['stage'] for r in report.get('observedSavedReturnEvents',[])]==[1,2,3]
                        home_inputs.window.observe(sender,recipient,payload,complete)
                    if input_window:
                        await send_inputs(input_window.receive(sender, recipient, payload,
                            state.stage == 'recording-ended' and report['capturedGuestGoStatusDelivered']))
                elif op == relay.LOST_EVENT:
                    report['referenceSawSessionLoss'] = True;save()
                elif op == relay.SEND_ACK and target_inputs:
                    if len(body)!=4:raise ValueError('Original target input acknowledgement size differs')
                    acknowledged=struct.unpack('<I',body)[0]
                    target_rows=report['replayedGuestTargetInputPackets']
                    if any(r['sequence']==acknowledged for r in target_rows):
                        acks=report['targetGuestInputServerAcks']
                        if len(acks)>=len(target_rows) or acknowledged!=target_rows[len(acks)]['sequence']:
                            raise ValueError('Target input server acknowledgement order differs')
                        path=packets/f'target-input-ack-{len(acks):03}.bin'
                        with path.open('xb')as f:f.write(message)
                        acks.append(dict(sequence=acknowledged,copy=str(path),bytes=len(message),sha256=digest(message)))
                        report['originalGuestTargetInputsDelivered']=len(acks)==len(target_inputs.window.payloads)
                        save()
                    if home_inputs:
                        home_rows=report['replayedSavedHomeInputPackets'];home_acks=report['savedHomeInputServerAcks']
                        if any(r['sequence']==acknowledged for r in home_rows):
                            if len(home_acks)>=len(home_rows) or acknowledged!=home_rows[len(home_acks)]['sequence']:
                                raise ValueError('Saved-home input acknowledgement order differs')
                            path=packets/f'saved-home-input-ack-{len(home_acks):03}.bin'
                            with path.open('xb') as sink:sink.write(message)
                            home_acks.append(dict(sequence=acknowledged,copy=str(path),bytes=len(message),sha256=digest(message)))
                            save()
                elif op == relay.BARRIER_EVENT:
                    if revisit_votes and len(body)>=4 and relay.word(body,0)==3:
                        revisit_votes.preserve_event(relay,body,packets,report)
                    elif home_inputs and len(body)>=4 and relay.word(body,0)==3:
                        home_inputs.preserve_revisit_event(relay,body,packets,report)
                    elif return_votes and len(body) >= 4 and relay.word(body,0) == 2:
                        return_votes.preserve_event(relay,body,packets,report)
                    elif votes:
                        preserve_host_load_event(relay, body, packets, report, votes)
                    else:
                        preserve_proposal_event(relay, body, packets, report)
                    save()
            return
