"""Replay captured original-host packets to one real native guest.

This fixture owns no world. It preserves original payloads and never invents
GoStatus or Loaded votes. A completed replay cannot qualify live multiplayer.
"""
import asyncio
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import re
from .native_original_inputs import RecordedHostPauseInputs

PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
ROOT = Path(__file__).resolve().parents[2]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def lobby_manifest(executable, chapter, region=None, content=None):
    """Bind recorded native initialization to the same explicit generation rules."""
    rules = b'native-lobby-observation-only-v1'
    if chapter:
        rules += f':RULE_FRONTIER_CHAPTER={chapter}'.encode()
    if region is None:
        if content is not None:
            raise ValueError('Baseline replay cannot use connected content')
        return (PIN + ':' + executable + ':' + digest(rules)).encode()
    try:
        coordinates = [int(part) for part in region.split('_')]
    except (ValueError, AttributeError):
        raise ValueError('Invalid connected replay region') from None
    if (chapter not in (1, 2, 3, 4) or len(coordinates) != 2 or
            any(abs(n) > 1000000 for n in coordinates) or
            region != '_'.join(map(str, coordinates)) or
            not isinstance(content, str) or len(content) != 129 or
            content[:65] != PIN + ':' or
            any(c not in '0123456789abcdef' for c in content[65:])):
        raise ValueError('Invalid connected replay region/content contract')
    rules += (':RULE_COOP_REGION_GENERATION=v1:RULE_COOP_WORLD=native-terrain-fixture:'
              'RULE_COOP_REGION=' + region + ':RULE_GAME_INVENTORY_ADAPTER=1').encode()
    return (content[65:] + ':' + PIN + ':' + digest(rules)).encode()


def bounded_read(path, limit):
    path = Path(path).resolve()
    if not path.is_relative_to(ROOT / 'output') or path.stat().st_size > limit:
        raise ValueError('Replay input is outside owned output or exceeds its bound')
    data = path.read_bytes()
    if len(data) > limit:
        raise ValueError('Replay input grew beyond its bound')
    return data


class ReplaySequence:
    """Send each captured stage once, after authenticated guest evidence."""
    def __init__(self, payloads, host, guest):
        if host != 1 or guest != 2 or not payloads:
            raise ValueError('This owned replay requires the captured server1/guest2 roster')
        self.host, self.guest, self.stage = host, guest, 'joining'
        self.packet_count = len(payloads)
        self.guest_ready = self.guest_go = False
        kinds, ready_at = [], []
        for i, payload in enumerate(payloads):
            if not 8 <= len(payload) <= 65536:
                raise ValueError('Invalid captured game packet size')
            category, kind = struct.unpack_from('<II', payload)
            if category != 0x100:
                raise ValueError('Captured packet has an unexpected category')
            kinds.append(kind)
            if kind == 2:
                if len(payload) != 52:
                    raise ValueError('Invalid captured status packet')
                body = bytes(byte ^ 0x31 for byte in payload[8:])
                player = struct.unpack_from('<I', body)[0]
                if player == guest and body[8] == 1:
                    ready_at.append(i)
        if len(ready_at) != 1 or kinds.count(3) != 1 or kinds.count(0x10) != 1:
            raise ValueError('Capture must contain one guest Ready, GameStart and GoStatus')
        ready, start, go = ready_at[0], kinds.index(3), kinds.index(0x10)
        if not 0 < ready < start < go == len(payloads) - 1:
            raise ValueError('Captured initialization order differs from the original exchange')
        if len(payloads[start]) != 452 or len(payloads[go]) != 16:
            raise ValueError('Invalid captured GameStart/GoStatus shape')
        body = bytes(byte ^ 0x31 for byte in payloads[go][8:])
        if struct.unpack('<II', body) != (host, 1):
            raise ValueError('Captured GoStatus is not the original host initialization vote')
        self.initial = payloads[:ready]
        self.start = payloads[ready:go]
        self.go = payloads[go:]

    def joined(self, guest):
        if guest != self.guest or self.stage != 'joining':
            raise ValueError('Replay roster or join order mismatch')
        self.stage = 'ready'
        return self.initial

    def receive(self, sender, recipient, payload):
        if (sender, recipient) != (self.guest, self.host) or len(payload) < 8:
            raise ValueError('Unauthenticated or truncated original guest packet')
        if self.stage == 'recording-ended':
            # Retain bounded subsequent evidence without pretending the recorded
            # host can answer gameplay commands or execute a synchronized turn.
            return []
        category, kind = struct.unpack_from('<II', payload)
        if category != 0x100:
            raise ValueError('Unexpected original guest packet category')
        if kind == 0x20:
            if len(payload) != 52:
                raise ValueError('Invalid original guest readiness shape')
            body = bytes(byte ^ 0x31 for byte in payload[8:])
            player, slot, ready, version, label = struct.unpack('<IIBxH32s', body)
            # Original native guest017 sends0 in this field; the worldless
            # lobby reference usedFFFFFFFF. Do not reject the real client for
            # differing from a fixture default or infer its kingdom binding.
            if player != self.guest or slot not in (0, 0xffffffff) or ready not in (0, 1) or version != 0x106 or label.split(b'\0', 1)[0] != b'1.5.1.2':
                raise ValueError('Original guest readiness does not match the captured version/slot')
            if ready and self.stage == 'ready':
                self.guest_ready = True
                self.stage = 'initializing'
                return self.start
        elif kind == 0x10:
            if len(payload) != 16:
                raise ValueError('Invalid original guest GoStatus shape')
            body = bytes(byte ^ 0x31 for byte in payload[8:])
            if struct.unpack('<II', body) != (self.guest, 1):
                raise ValueError('Original guest GoStatus does not identify its initialized player')
            if self.stage != 'initializing':
                raise ValueError('Original guest GoStatus arrived outside initialization')
            self.guest_go = True
            self.stage = 'recording-ended'
            return self.go
        return []


class HostTranscript:
    def __init__(self, report_path, manifest, executable, chapter, region=None, content=None,
                 *, paused_host=False):
        if type(paused_host) is not bool:
            raise ValueError('Paused host admission must be explicit boolean')
        self.report_path = Path(report_path).resolve()
        raw = bounded_read(self.report_path, 1024 * 1024)
        report = json.loads(raw)
        required = ['nativeSessionTerminal', 'producerAbsent', 'fixtureStopped',
                    'servedUnchanged', 'originalSettingsUnchanged']
        required += (['recordedGuestReplay', 'nativePauseWorldRequested',
                      'nativeProductionPauseActionRequested', 'replayOriginalInputsRequested',
                      'originalGuestInputWindowDelivered', 'originalHostGameStartMatched',
                      'originalHostGoStatusObserved', 'capturedGuestGoStatusDelivered']
                     if paused_host else ['referenceReadyConfirmed'])
        if report.get('nativeExitCode') != 0 or report.get('stopReason') or report.get('referenceError') or not all(report.get(key) is True for key in required):
            raise ValueError('Original host capture did not terminate safely with real Ready admission')
        if report.get('browserUsed') is not False or report.get('recordedHostReplay') or report['pinnedExecutableSha256'] != PIN or report['nativeExecutableSha256'] != executable or report.get('configuredCoopChapter') != chapter:
            raise ValueError('Capture is a replay or differs from the pinned build/chapter')
        try:
            os.kill(report['nativePid'], 0)
        except ProcessLookupError:
            pass
        else:
            raise ValueError('Original host producer is still live')
        if not self.report_path.name.endswith('-observed.json'):
            raise ValueError('Use the terminal host observation report')
        self.source_inputs = [(self.report_path, raw)]
        self.paused_host_inspection = None
        self.host_checkpoint = None
        if paused_host:
            if report.get('nativeReadbackWorldRequested') or report.get('liveSecondOriginalEngine') is not False:
                raise ValueError('Paused replay requires the complete original source, not a reader component')
            # Re-run the independent stopped typed-world inspector. It verifies
            # the actual host party, both kingdom graphs, current compiled
            # inputs and complete original script; no native/browser starts.
            code = """import {inspectCoopWorld} from './scripts/inspect-native-coop-world.mjs';
const p=await inspectCoopWorld(process.argv[1]);
console.log(JSON.stringify({role:p.originalRole,complete:p.scriptCompleted,
 reportSha256:p.reportSha256,snapshots:p.snapshots.map(s=>({frame:s.frame,clock:s.clock})),
 verifierInputs:p.verifierInputs}));"""
            result = subprocess.run(['node', '--input-type=module', '-e', code, str(self.report_path)],
                                    cwd=ROOT, capture_output=True, text=True, timeout=20)
            if result.returncode or len(result.stdout) > 8192:
                raise ValueError('Independent paused host inspection refused')
            proof = json.loads(result.stdout)
            if (proof['role'] != 'host' or proof['complete'] is not True or
                    proof['reportSha256'] != digest(raw) or
                    proof['snapshots'] != [dict(frame=0,clock=0),dict(frame=11,clock=550)]):
                raise ValueError('Inspected host does not own the exact original settled pause')
            self.paused_host_inspection = proof
            for record in report['worldSnapshots']:
                data = bounded_read(record['path'], 2 * 1024 * 1024)
                if len(data) != record['bytes'] or digest(data) != record['sha256']:
                    raise ValueError('Inspected host snapshot changed')
                self.source_inputs.append((Path(record['path']), data))
                if record['label'] == 'Coop_World_Progress':
                    self.host_checkpoint = dict(source=record['path'], bytes=len(data), sha256=digest(data))
        else:
            audit_path = self.report_path.with_name(self.report_path.name.replace('-observed.json', '-packet-audit.json'))
            audit_raw = bounded_read(audit_path, 1024 * 1024)
            audit = json.loads(audit_raw)
            if not all(audit.get(key) is True for key in ['originalGameStartPacketVerified', 'originalGoStatusPacketVerified', 'readyRequestVerified', 'originalInitializationWaitObserved']):
                raise ValueError('Host packet audit does not prove original initialization evidence')
            if audit.get('observationSha256') != digest(raw):
                raise ValueError('Host audit does not bind this observation')
            if audit.get('pinnedExecutableSha256') != PIN or audit.get('browserUsed') is not False or audit.get('dynamicPeerIds') != [1, 2]:
                raise ValueError('Host audit has a different executable, browser scope or roster')
            self.source_inputs.append((audit_path, audit_raw))
        def copied(record):
            data = bounded_read(record['copy'], 65536)
            if len(data) != record['bytes'] or digest(data) != record['sha256']:
                raise ValueError('Captured host input no longer matches its recorded hash/size')
            self.source_inputs.append((Path(record['copy']), data))
            return data
        if 'originalRoomSnapshot' not in report or len(report.get('originalHostPlayerSnapshots', [])) != 1:
            raise ValueError('Host capture needs original room and server player snapshots')
        self.room = copied(report['originalRoomSnapshot'])
        self.player = copied(report['originalHostPlayerSnapshots'][0])
        host, guest = report['originalHostPlayerIds'][0], report['referencePlayerId']
        rows = report['lobbyPacketMetadata']
        if not 1 <= len(rows) <= 128 or sum(row['bytes'] for row in rows) > 2 * 1024 * 1024:
            raise ValueError('Captured original packet bound exceeded')
        payloads = []
        for sequence, row in enumerate(rows, 1):
            if (row['sequence'], row['sender'], row['recipient']) != (sequence, host, guest):
                raise ValueError('Captured original packet endpoints/order changed')
            payloads.append(copied(row))
        self.pause_inputs = None
        self.duplicate_go = []
        if paused_host:
            kinds = [struct.unpack_from('<II', payload)[1] for payload in payloads]
            go = kinds.index(0x10)
            if (kinds[go:go+2] != [0x10,0x10] or payloads[go] != payloads[go+1] or
                    any(kind not in (5,0x12) for kind in kinds[go+2:])):
                raise ValueError('Paused capture must retain exactly its two startup votes')
            self.sequence = ReplaySequence(payloads[:go+1], host, guest)
            self.duplicate_go = [payloads[go+1]]
            self.pause_inputs = RecordedHostPauseInputs([payload for payload in payloads[go+2:]
                                                       if struct.unpack_from('<II',payload)[1] == 5])
        else:
            self.sequence = ReplaySequence(payloads, host, guest)
        self.replay_packet_count = self.sequence.packet_count + len(self.duplicate_go) + (
            len(self.pause_inputs.payloads) if self.pause_inputs else 0)
        if report.get('configuredCoopRegion') != region or report.get('nativeFixtureContentIdentity') != content:
            raise ValueError('Replay generation region/content differs from the captured contract')
        expected_manifest = lobby_manifest(executable, chapter, region, content)
        if manifest != expected_manifest:
            raise ValueError('Replay manifest differs from the captured build/chapter contract')
        recorded_manifest = report.get('networkManifestSha256')
        if (region is not None and recorded_manifest is None) or (
                recorded_manifest is not None and recorded_manifest != digest(manifest)):
            raise ValueError('Replay manifest is not bound to the original host report')
        self.manifest = manifest
        self.frozen_inputs = []

    def preserve(self, directory):
        for i, (source, data) in enumerate(self.source_inputs):
            target = directory / f'{i:03}-{source.name}'
            with target.open('xb') as sink:
                sink.write(data)
            self.frozen_inputs.append(dict(source=str(source), copy=str(target), bytes=len(data), sha256=digest(data)))
        self.verify_preserved()

    def verify_preserved(self):
        for record in self.frozen_inputs:
            if digest(bounded_read(record['copy'], 2 * 1024 * 1024)) != record['sha256']:
                raise ValueError('Private replay input changed during the observation')

    def preserve_host_checkpoint(self, profile):
        """Copy only the inspected paused host save into a fresh owned guest profile."""
        proof = self.paused_host_inspection
        if (not proof or proof.get('role') != 'host' or proof.get('complete') is not True or
                not self.host_checkpoint or proof.get('snapshots') !=
                [dict(frame=0,clock=0),dict(frame=11,clock=550)]):
            raise ValueError('Require the independently inspected original paused host checkpoint')
        profile = Path(profile).absolute()
        if (profile.name != 'owned-profile' or profile.parent.parent != ROOT / 'output' or
                not re.fullmatch(r'native-multiplayer-lobby-\d{3}', profile.parent.name) or
                profile.is_symlink() or profile.resolve() != profile or not profile.is_dir()):
            raise ValueError('Host checkpoint requires an exact owned native profile')
        record = self.host_checkpoint
        data = bounded_read(record['source'], 2 * 1024 * 1024)
        if len(data) != record['bytes'] or digest(data) != record['sha256']:
            raise ValueError('Inspected original host checkpoint changed')
        directory = profile
        for name in ('Documents','My Games','MajestyHD','SaveGame'):
            directory = directory / name
            if directory.is_symlink():
                raise ValueError('Host checkpoint destination has a symlink')
            directory.mkdir(exist_ok=True)
            if directory.resolve() != directory:
                raise ValueError('Host checkpoint destination is not canonical')
        target = directory / 'Coop_Host_Checkpoint.GMP'
        with target.open('xb') as sink:
            sink.write(data)
        return dict(source=record['source'], path=str(target), bytes=len(data), sha256=digest(data))


async def replay_host(relay, connect, url, manifest, transcript, process, packets, report, save):
    from .native_coop_proposal_replay import enable_replay_host, preserve_replay_event
    async with connect(url, subprotocols=['recomp-directplay-v1'], compression=None,
                       max_size=relay.LIMIT, max_queue=1, close_timeout=1) as ws:
        request = tx = 0
        pending_events = []
        proposal = getattr(transcript, 'proposal_replay', None)
        completion = getattr(transcript, 'host_completion', None)
        if bool(completion) != (report.get('replayHostCompletionRequested') is True):
            raise ValueError('Recorded host completion replay flag/inputs differ')
        if bool(proposal) != (report.get('replayHostProposalRequested') is True):
            raise ValueError('Recorded proposal replay flag/inputs differ')
        state = transcript.sequence
        report.update(replayedHostPackets=[], originalGuestReadyObserved=False,
                      originalGuestGoStatusObserved=False, capturedHostGoStatusDelivered=False)

        async def rpc(op, body):
            nonlocal request
            request += 1
            await ws.send(relay.HEADER.pack(relay.MAGIC, 1, op, request, 0) + body)
            while True:
                message = await asyncio.wait_for(ws.recv(), 3)
                header = relay.HEADER.unpack_from(message)
                if header == (relay.MAGIC, 1, op | relay.REPLY, request, 0):
                    return message[20:]
                if (proposal and header[:2] == (relay.MAGIC, 1) and header[3:] == (0, 0) and
                        len(message) <= relay.LIMIT and len(pending_events) < 32):
                    pending_events.append(message)
                else:
                    raise ValueError('Unexpected replay host RPC response')

        async def send_stage(payloads):
            nonlocal tx
            for payload in payloads:
                tx += 1
                await ws.send(relay.HEADER.pack(relay.MAGIC, 1, relay.SEND, 0, 0)
                              + relay.put(tx, state.host, state.guest, 1) + payload)
                report['replayedHostPackets'].append(dict(sequence=tx, bytes=len(payload), sha256=digest(payload)))
            report.update(originalGuestReadyObserved=state.guest_ready,
                          originalGuestGoStatusObserved=state.guest_go,
                          capturedHostGoStatusDelivered=report.get('capturedHostGoStatusDelivered', False) or
                          (state.guest_go and tx == transcript.replay_packet_count))
            save()

        await rpc(relay.HELLO, relay.string(manifest))
        r = relay.Reader(await rpc(relay.CREATE, transcript.room))
        relay.Session.read(r)
        if r.u32() != 0:
            raise ValueError('Replay host did not create an empty room')
        r.done()
        r = relay.Reader(await rpc(relay.PLAYER, transcript.player))
        if r.u32() != 1 or relay.Player.read(r).id != state.host:
            raise ValueError('Original host server identity was not preserved')
        r.done()
        report['recordedHostRoomCreated'] = True
        if proposal:
            await enable_replay_host(relay, rpc, report)
        save()
        while process.returncode is None:
            if completion:
                await completion.send_pending(relay, rpc, report)
                save()
            try:
                message = pending_events.pop(0) if pending_events else await asyncio.wait_for(ws.recv(), .5)
            except asyncio.TimeoutError:
                continue
            magic, version, op, rid, status = relay.HEADER.unpack_from(message)
            if (magic, version, rid, status) != (relay.MAGIC, 1, 0, 0):
                raise ValueError('Invalid replay host event header')
            body = message[20:]
            if op == relay.PLAYER_EVENT:
                r = relay.Reader(body)
                if r.u32() != 2:
                    raise ValueError('Replay admits exactly one original guest')
                guest = relay.Player.read(r);r.done()
                report.update(referenceJoined=True, originalGuestPlayerId=guest.id)
                descriptor = packets / 'original-guest-player.bin'
                with descriptor.open('xb') as sink:
                    sink.write(guest.encode())
                report['originalGuestPlayerSnapshot'] = dict(copy=str(descriptor),
                    sha256=digest(guest.encode()), bytes=len(guest.encode()))
                await send_stage(state.joined(guest.id))
            elif op == relay.PACKET_EVENT:
                if len(body) < 20:
                    raise ValueError('Truncated original guest packet event')
                sequence, sender, recipient = struct.unpack_from('<III', body)
                payload = body[12:]
                rows = report['lobbyPacketMetadata']
                if sequence != len(rows) + 1 or len(payload) > 65536 or len(rows) >= 128 or sum(row['bytes'] for row in rows) + len(payload) > 2 * 1024 * 1024:
                    raise ValueError('Original guest packet observation bound/order failed')
                path = packets / f'guest-{sequence:03}.bin'
                with path.open('xb') as sink:
                    sink.write(payload)
                rows.append(dict(sequence=sequence, sender=sender, recipient=recipient,
                                 bytes=len(payload), sha256=digest(payload), copy=str(path)))
                replies = state.receive(sender, recipient, payload)
                if transcript.pause_inputs and state.guest_go and not transcript.pause_inputs.delivered:
                    replies += transcript.duplicate_go + transcript.pause_inputs.deliver(state.guest_go)
                    report['capturedHostPauseInputWindowDelivered'] = True
                    report['capturedHostPauseInputWindow'] = [dict(bytes=len(p),sha256=digest(p))
                                                            for p in transcript.pause_inputs.payloads]
                    report['pausedHostInspection'] = transcript.paused_host_inspection
                await send_stage(replies)
                if proposal and proposal.can_send(report):
                    await proposal.send(relay, rpc, report)
                    save()
            elif op == relay.BARRIER_EVENT and proposal:
                if (report.get('replaySavedRevisitHostRequested') is True and
                        len(body) >= 4 and relay.word(body, 0) == 3):
                    completion.revisit.preserve_event(relay, body, packets, report)
                    third=getattr(completion,'revisit_completion',None)
                    payloads=third.resume_packets(report)if third else []
                    if payloads:
                        await send_stage(payloads)
                        report['capturedOriginalThirdHostResumeDelivered']=True
                        report['capturedOriginalThirdHostResumeInputs']=[dict(bytes=len(p),sha256=digest(p))for p in payloads]
                    save()
                    continue
                if (report.get('replaySavedReturnHostRequested') is True and
                        len(body) >= 4 and relay.word(body, 0) == 2):
                    completion.preserve_return_event(relay, body, packets, report)
                    payloads = completion.original_return_resume_packets(report)
                    if payloads:
                        if report.get('replaySavedRevisitHostRequested') is True:
                            report['savedRevisitRecipientInputStart'] = len(report['lobbyPacketMetadata'])
                        await send_stage(payloads)
                        report['capturedOriginalSecondHostResumeDelivered'] = True
                        report['capturedOriginalSecondHostResumeInputs'] = [dict(bytes=len(p), sha256=digest(p)) for p in payloads]
                    save()
                    continue
                preserve_replay_event(relay, body, packets, report, proposal, completion)
                if completion and len(report['observedProposalEvents']) == 3:
                    payloads=completion.original_resume_packets(report)
                    await send_stage(payloads)
                    report['capturedOriginalHostResumeDelivered']=completion.resume.delivered
                    report['capturedOriginalHostResumeInputs']=[dict(bytes=len(p),sha256=digest(p))for p in completion.resume.payloads]
                save()
            elif op == relay.CHECKPOINT_EVENT and report.get('replaySavedReturnHostRequested') is True:
                if (report.get('replaySavedRevisitHostRequested') is True and
                        len(body) >= 8 and relay.word(body, 4) == 3):
                    await completion.revisit.checkpoint_event(relay, body, rpc, packets, report)
                else:
                    await completion.checkpoint_event(relay, body, rpc, packets, report)
                save()
            elif op == relay.LOST_EVENT:
                report['referenceSawSessionLoss'] = True
                save()
