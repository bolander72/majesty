"""Recorded host return inputs/Begin and owned checkpoint delivery to one guest.

The reference has no world. It uses actual stopped SDK Begin and save bytes,
responds only to the recipient's real checkpoint requests/ACKs, and optionally
replays inspected actual second-trip votes/resume after the recipient's real
load and writer boundaries. It never authors a vote or game command.
"""
import json
from pathlib import Path
import struct
import subprocess

from .native_original_host_replay import ROOT, bounded_read, digest
from .native_coop_completion_replay import CapturedHostCompletion
from .native_coop_proposal_replay import proposal_requests
from .native_coop_saved_return_inputs import RecordedSavedReturnHostInputs


class SavedReturnCheckpointSender:
    def __init__(self, data, *, serial=2, owner=1, recipient=2):
        if not 0 < len(data) <= 2 * 1024 * 1024 or (serial not in (2, 3) or (owner, recipient) != (1, 2)):
            raise ValueError('Require the bounded owned home checkpoint and original party')
        self.data, self.serial, self.owner, self.recipient = data, serial, owner, recipient
        self.started = self.ended = self.completed = False
        self.sequence = self.offset = 0

    def receive(self, relay, body):
        reader = relay.Reader(body)
        action, serial, sender, recipient = [reader.u32() for _ in range(4)]
        sequence = reader.u32() if action in (relay.CHECKPOINT_ACK, relay.CHECKPOINT_END_ACK) else None
        reader.done()
        if (serial, sender, recipient) != (self.serial, self.recipient, self.owner) or self.completed:
            raise ValueError('Checkpoint request/ACK party or stage differs')
        if action == relay.CHECKPOINT_REQUEST:
            if self.started:
                raise ValueError('Repeated checkpoint request')
            self.started = True
            return relay.put(relay.CHECKPOINT_OFFER, self.serial, self.recipient, len(self.data))
        if not self.started or sequence != self.sequence:
            raise ValueError('Checkpoint ACK is missing its exact preceding delivery')
        if action == relay.CHECKPOINT_END_ACK:
            if not self.ended or self.offset != len(self.data):
                raise ValueError('Checkpoint completion lacks the actual full delivery')
            self.completed = True
            return None
        if action != relay.CHECKPOINT_ACK or self.ended:
            raise ValueError('Unexpected checkpoint ACK action')
        self.sequence += 1
        if self.offset == len(self.data):
            self.ended = True
            return relay.put(relay.CHECKPOINT_END, self.serial, self.recipient, self.sequence)
        chunk = self.data[self.offset:self.offset + relay.CHECKPOINT_CHUNK_BYTES]
        self.offset += len(chunk)
        return relay.put(relay.CHECKPOINT_CHUNK, self.serial, self.recipient, self.sequence, len(chunk)) + chunk


class CapturedSavedReturnHostCompletion(CapturedHostCompletion):
    def __init__(self, proof_name, proposal, *, commit_return=False, return_completion=None, return_home_inputs=False, revisit=None, revisit_completion=None):
        self.path = Path(proof_name).resolve()
        if not self.path.is_relative_to(ROOT / 'output'):
            raise ValueError('Require an owned stopped saved-return proof')
        raw = bounded_read(self.path, 2 * 1024 * 1024); proof = json.loads(raw)
        for key in ('productionSavedReturnBeginQualified', 'actualSecondPauseCheckpointQualified',
                    'originalHomeCheckpointUnchangedQualified', 'priorClock1000GameplayMatchesQualified'):
            if proof.get(key) is not True:
                raise ValueError('Require inspected real saved-return source, retained home and progression')
        if proof.get('browserUsed') is not False or proof.get('savedReturnCompleted') is not False:
            raise ValueError('Recorded saved-return evidence has an incompatible scope')
        code = """import {inspectSavedReturnProposal} from './scripts/inspect-native-coop-saved-return-proposal.mjs';
const p=await inspectSavedReturnProposal(process.argv[1]);
console.log(JSON.stringify({reportSha256:p.reportSha256,descriptorSha256:p.descriptorSha256,
 capturedRequests:p.capturedRequests,home:p.home,homeMarker:p.homeMarker,
 sourceFrame:p.sourceFrame,sourceClock:p.sourceClock,verifierInputs:p.verifierInputs}));"""
        result = subprocess.run(['node', '--max-old-space-size=96', '--input-type=module', '-e', code, proof['report']],
                                cwd=ROOT, capture_output=True, text=True, timeout=30)
        if result.returncode or len(result.stdout) > 32768:
            raise ValueError('Independent saved-return proposal inspection refused')
        checked = json.loads(result.stdout)
        if any(checked[key] != proof[key] for key in checked):
            raise ValueError('Saved-return proof differs from independent inspection')
        report_raw = bounded_read(proof['report'], 2 * 1024 * 1024); report = json.loads(report_raw)
        if digest(report_raw) != proof['reportSha256']:
            raise ValueError('Saved-return host report custody differs')
        first_rows = []
        for row in report['proposalProtocolRequests']:
            if (row['sender'], row['host'], row['op']) != (1, True, 12) or row['action'] == 0:
                continue
            wire = bounded_read(row['copy'], 2048)
            if len(wire) != row['bytes'] or digest(wire) != row['sha256']:
                raise ValueError('Actual host SDK request custody differs')
            if struct.unpack_from('<I', wire, 24)[0] == 1:
                first_rows.append(row)
        if [r['action'] for r in first_rows] != [1, 2, 3]:
            raise ValueError('Require actual first-trip host Begin/Ready/Loaded')
        bodies = proposal_requests(first_rows[-2:], bounded_read, proposal.descriptor_sha, actions=(2, 3))
        self.loaded_body, self.loaded_row = bodies[1], first_rows[2]
        self.source_inputs = [(self.path, raw), (Path(proof['report']), report_raw)]
        for row in first_rows[-2:]:
            self.source_inputs.append((Path(row['copy']), bounded_read(row['copy'], 2048)))
        packets = []; resumed = False
        if len(report['lobbyPacketMetadata']) > 128:
            raise ValueError('Recorded host packet count exceeds its bound')
        for row in report['lobbyPacketMetadata']:
            if (row['sender'], row['recipient']) != (1, 2):
                raise ValueError('Original host stream endpoints differ')
            data = bounded_read(row['copy'], 65536)
            if len(data) != row['bytes'] or digest(data) != row['sha256']:
                raise ValueError('Recorded host stream custody differs')
            if struct.unpack_from('<2I', data) == (256, 4):
                if resumed: raise ValueError('Repeated original immediate resume')
                resumed = True
            if resumed:
                packets.append(data); self.source_inputs.append((Path(row['copy']), data))
        self.resume = RecordedSavedReturnHostInputs(packets, source_clock=proof['sourceClock'])
        self.return_rows = proof['capturedRequests']
        return_bodies = []
        for action, row in zip((1, 2), self.return_rows):
            wire = bounded_read(row['copy'], 2048)
            if (len(wire) != row['bytes'] or digest(wire) != row['sha256'] or
                    (row['sender'], row['host'], row['op'], row['action']) != (1, True, 12, action) or
                    struct.unpack_from('<8I', wire)[:7] != (0x31525044, 1, 12, row['request'], 0, action, 2) or
                    len(wire) != 32 + struct.unpack_from('<I', wire, 28)[0] or
                    digest(wire[32:]) != proof['descriptorSha256']):
                raise ValueError('Actual second-trip SDK request framing/custody differs')
            return_bodies.append(wire[20:]); self.source_inputs.append((Path(row['copy']), wire))
        if len(return_bodies) != 2:
            raise ValueError('Require captured second-trip Begin/Ready')
        self.return_begin_body = return_bodies[0]
        self.return_ready_body = return_bodies[1]
        self.commit_return = commit_return
        self.sent_return_ready = False
        self.return_descriptor_sha = proof['descriptorSha256']
        self.home = proof['home']; home_bytes = bounded_read(self.home['path'], 2 * 1024 * 1024)
        if len(home_bytes) != self.home['bytes'] or digest(home_bytes) != self.home['sha256']:
            raise ValueError('Original retained home checkpoint changed')
        self.source_inputs.append((Path(self.home['path']), home_bytes))
        self.transfer = SavedReturnCheckpointSender(home_bytes)
        self.sent_loaded = self.sent_return_begin = False
        self.frozen_inputs = []
        self.return_completion = None
        if return_completion:
            if not commit_return:
                raise ValueError('Second completion requires actual saved-return commit')
            from .native_coop_saved_return_resume import CapturedSavedReturnResume
            self.return_completion = CapturedSavedReturnResume(return_completion, self.return_descriptor_sha,
                                                               report['nativeExecutableSha256'],home_inputs=return_home_inputs)
            self.source_inputs += self.return_completion.source_inputs
        self.revisit = None
        self.revisit_completion = None
        if revisit:
            if not self.return_completion or return_home_inputs:
                raise ValueError('Third replay requires second completion and its own literal home stream')
            from .native_coop_saved_revisit_replay import CapturedSavedRevisit
            self.revisit = CapturedSavedRevisit(revisit, self, report['nativeExecutableSha256'])
            self.source_inputs += self.revisit.source_inputs
        if revisit_completion:
            if not self.revisit:raise ValueError('Third completion requires actual third proposal replay')
            from .native_coop_saved_revisit_resume import CapturedSavedRevisitResume
            self.revisit_completion = CapturedSavedRevisitResume(revisit_completion,self.revisit.descriptor_sha,report['nativeExecutableSha256'])
            self.revisit.completion = self.revisit_completion
            self.source_inputs += self.revisit_completion.source_inputs

    async def send_pending(self, relay, rpc, report):
        await super().send_pending(relay, rpc, report)
        if getattr(self, 'commit_return', False) and self.sent_return_begin:
            await self.send_return_ready(relay, rpc, report)
            if getattr(self, 'return_completion', None):
                await self.return_completion.send_pending(relay, rpc, report, self)
                if getattr(self, 'revisit', None):
                    await self.revisit.send_pending(relay, rpc, report, self)
                    if self.revisit_completion:
                        await self.revisit_completion.send_pending(relay,rpc,report,self.revisit)
        if self.sent_return_begin or not self.resume.delivered:
            return
        log = Path(report['profile']).parent / 'native.log'
        if not log.is_file() or log.is_symlink(): return
        if log.stat().st_size > 4 * 1024 * 1024:
            raise ValueError('Original recipient trace exceeds its bound')
        with log.open('rb') as stream:
            stream.seek(max(0, log.stat().st_size - 16384)); tail = stream.read(16384)
        if b'[coop-load] Resumed epoch=1 serial=1 region=1_0\n' not in tail:
            return
        progress = (b'[coop-later-progress-fixture] Snapshot epoch=1 serial=1 local=2 slot=1 region=1_0 '
                    b'frame=20 clock=1000 original-writer=1 complete=1 running=1 source-retained=1 '
                    b'clock-input-phase-writes=0 live-second-engine=0\n')
        if progress not in tail:
            return
        self.sent_return_begin = True  # Never repeat an unknown Begin outcome.
        if await rpc(relay.BARRIER, self.return_begin_body) != b'':
            raise ValueError('Captured saved-return Begin refused')
        report.update(capturedSavedReturnBeginDelivered=True,
                      referenceSecondHostReadyVotesSent=0, referenceSecondHostLoadedVotesSent=0,
                      replayedSavedReturnBeginBody=dict(source=self.return_rows[0]['copy'],
                          bytes=len(self.return_begin_body), sha256=digest(self.return_begin_body)))

    async def send_return_ready(self, relay, rpc, report):
        if self.sent_return_ready or not self.transfer.completed:
            return
        ready = []
        for row in report.get('proposalProtocolRequests', []):
            if (row['sender'], row['host'], row['op'], row['action']) != (2, False, 12, 2):
                continue
            wire = bounded_read(row['copy'], 2048)
            if len(wire) != row['bytes'] or digest(wire) != row['sha256']:
                raise ValueError('Actual recipient Ready custody differs')
            if struct.unpack_from('<I', wire, 24)[0] != 2:
                continue
            if (len(wire) != 32 + struct.unpack_from('<I', wire, 28)[0] or
                    digest(wire[32:]) != self.return_descriptor_sha):
                raise ValueError('Actual recipient saved-return Ready descriptor differs')
            ready.append(row)
        if not ready:
            return
        if len(ready) != 1:
            raise ValueError('Repeated recipient saved-return Ready')
        self.sent_return_ready = True  # Unknown outcomes are never retried.
        if await rpc(relay.BARRIER, self.return_ready_body) != b'':
            raise ValueError('Captured actual host saved-return Ready refused')
        report.update(capturedSavedReturnReadyDelivered=True, referenceSecondHostReadyVotesSent=1,
            replayedSavedReturnReadyBody=dict(source=self.return_rows[1]['copy'],
                bytes=len(self.return_ready_body), sha256=digest(self.return_ready_body)))

    async def checkpoint_event(self, relay, body, rpc, packets, report):
        if not self.sent_return_begin:
            raise ValueError('Checkpoint delivery preceded actual saved-return Begin')
        reply = self.transfer.receive(relay, body)
        rows = report.setdefault('savedReturnCheckpointEvents', [])
        if len(rows) >= 28 or len(body) > 20:
            raise ValueError('Saved-return checkpoint event bound exceeded')
        path = packets / f'saved-return-checkpoint-event-{len(rows):03}.bin'
        with path.open('xb') as sink: sink.write(body)
        rows.append(dict(copy=str(path), bytes=len(body), sha256=digest(body)))
        if reply is not None and await rpc(relay.CHECKPOINT, reply) != b'':
            raise ValueError('Requested original home checkpoint delivery refused')
        report.update(originalHomeCheckpointTransferCompleted=self.transfer.completed,
                      originalHomeCheckpointTransferredBytes=self.transfer.offset,
                      originalHomeCheckpointTransferSha256=self.home['sha256'])

    def preserve_return_event(self, relay, body, packets, report):
        reader = relay.Reader(body); serial, stage = reader.u32(), reader.u32()
        descriptor = reader.string(relay.BARRIER_DESCRIPTOR_BYTES); count = reader.u32()
        players = [reader.u32() for _ in range(count)] if count <= 4 else []; reader.done()
        rows = report.setdefault('observedSavedReturnEvents', [])
        expected_stage = len(rows) + 1
        completion = getattr(self, 'return_completion', None)
        if (not self.sent_return_begin or len(rows) >= (3 if completion else 2) or len(body) > 2048 or serial != 2 or stage != expected_stage or
                (stage == 2 and not getattr(self, 'sent_return_ready', False)) or
                (stage == 3 and (not completion or not completion.sent_loaded)) or
                players != [1, 2] or digest(descriptor) != self.return_descriptor_sha):
            raise ValueError('Saved-return event differs from actual unchanged host Begin')
        path = packets / ['saved-return-prepared-000.bin', 'saved-return-committed-001.bin',
                          'saved-return-complete-002.bin'][stage - 1]
        with path.open('xb') as sink: sink.write(body)
        rows.append(dict(copy=str(path), bytes=len(body), sha256=digest(body),
                         serial=serial, stage=stage, players=players, descriptorSha256=digest(descriptor)))

    def original_return_resume_packets(self, report):
        completion = getattr(self, 'return_completion', None)
        return completion.resume_packets(report) if completion else []
