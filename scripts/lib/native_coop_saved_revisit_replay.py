"""Replay an inspected third saved-region proposal to an original recipient.

No world or authored votes live in the reference. Literal stopped-host inputs
settle the real pause; checkpoint delivery and Ready follow actual requests.
"""
import json
from pathlib import Path
import struct
import subprocess
from .native_original_host_replay import ROOT, bounded_read, digest
from .native_original_inputs import empty_input
from .native_coop_saved_return_replay import SavedReturnCheckpointSender


class CapturedSavedRevisit:
    def __init__(self, name, parent, executable):
        self.path = Path(name).resolve()
        raw = bounded_read(self.path, 2 * 1024 * 1024)
        proof = json.loads(raw)
        if (proof.get('originalSavedHomeProgressQualified') is not True or
                proof.get('originalThirdSavedRevisitProposalQualified') is not True or
                proof.get('browserUsed') is not False or
                (proof.get('sourceFrame'), proof.get('sourceClock'), proof.get('sourceRevision')) != (22, 1650, 2)):
            raise ValueError('Require inspected original third proposal and home progress')
        code = """import{inspectSavedRevisit}from'./scripts/inspect-native-coop-saved-revisit.mjs';
const p=await inspectSavedRevisit(process.argv[1]);console.log(JSON.stringify({reportSha256:p.reportSha256,
 descriptorSha256:p.descriptorSha256,capturedHostThirdRequests:p.capturedHostThirdRequests,
 neighbor:p.neighbor,verifierInputs:p.verifierInputs}));"""
        result = subprocess.run(['node', '--max-old-space-size=96', '--input-type=module', '-e', code, proof['report']],
                                cwd=ROOT, capture_output=True, text=True, timeout=60)
        if result.returncode or len(result.stdout) > 32768:
            raise ValueError('Independent third proposal inspection refused')
        checked = json.loads(result.stdout)
        if any(proof[k] != checked[k] for k in checked):
            raise ValueError('Third proposal differs from independent inspection')
        report_raw = bounded_read(proof['report'], 2 * 1024 * 1024)
        report = json.loads(report_raw)
        if digest(report_raw) != proof['reportSha256'] or report['nativeExecutableSha256'] != executable:
            raise ValueError('Third proposal report/build custody differs')
        if proof['source']['descriptorSha256'] != parent.return_descriptor_sha:
            raise ValueError('Third source differs from the inspected second return')
        self.source_inputs = [(self.path, raw), (Path(proof['report']), report_raw)]
        self.rows = proof['capturedHostThirdRequests']; self.descriptor_sha = proof['descriptorSha256']
        bodies = []
        for action, row in zip((1, 2), self.rows):
            wire = bounded_read(row['copy'], 2048)
            if (len(wire) != row['bytes'] or digest(wire) != row['sha256'] or
                    (row['sender'], row['host'], row['op'], row['action']) != (1, True, 12, action) or
                    struct.unpack_from('<7I', wire) != (0x31525044, 1, 12, row['request'], 0, action, 3) or
                    len(wire) != 32 + struct.unpack_from('<I', wire, 28)[0] or digest(wire[32:]) != self.descriptor_sha):
                raise ValueError('Actual third host SDK request framing/custody differs')
            bodies.append(wire[20:]); self.source_inputs.append((Path(row['copy']), wire))
        if len(bodies) != 2 or len(self.rows) != 2:
            raise ValueError('Require actual third Begin and Ready only')
        self.begin_body, self.ready_body = bodies
        self.neighbor = proof['neighbor']; data = bounded_read(self.neighbor['path'], 2 * 1024 * 1024)
        if len(data) != self.neighbor['bytes'] or digest(data) != self.neighbor['sha256']:
            raise ValueError('Saved neighbor checkpoint changed')
        self.source_inputs.append((Path(self.neighbor['path']), data))
        self.transfer = SavedReturnCheckpointSender(data, serial=3)
        stream = report['lobbyPacketMetadata']; resumes = []
        for i, row in enumerate(stream):
            payload = bounded_read(row['copy'], 65536)
            if len(payload) != row['bytes'] or digest(payload) != row['sha256'] or (row['sender'], row['recipient']) != (1, 2):
                raise ValueError('Actual third pause stream custody/endpoints differ')
            if struct.unpack_from('<2I', payload) == (256, 4): resumes.append(i)
        if len(resumes) != 2 or len(stream[resumes[1]:]) != 13:
            raise ValueError('Require actual bounded second resume and third pause window')
        payloads = [bounded_read(r['copy'], 65536) for r in stream[resumes[1]:]]
        if not payloads[0] == parent.return_completion.resume:
            raise ValueError('Third stream second resume differs from inspected completed return')
        for index, frame in [(1,10),(2,12),(3,14),(4,16),(5,18),(7,20),(9,24),(10,26),(11,28),(12,30)]:
            if empty_input(payloads[index]) != frame: raise ValueError('Third pause original input timing differs')
        if len(payloads[6]) != 16 or struct.unpack_from('<3I', payloads[6]) != (2,18,1) or not struct.unpack_from('<I',payloads[6],12)[0]:
            raise ValueError('Third pause original Ping differs')
        if (len(payloads[8]) != 92 or struct.unpack_from('<2I',payloads[8]) != (256,5) or
                struct.unpack('<21I',bytes(x ^ 49 for x in payloads[8][8:])) !=
                (0,2,50,48,1,21,0,1,24,9,0,1,0,50,0,0,16,1,22,0,0)):
            raise ValueError('Third pause original combined command differs')
        for row, payload in zip(stream[resumes[1]:], payloads):
            self.source_inputs.append((Path(row['copy']), payload))
        parent.return_completion.resume_payloads = payloads
        self.sent_begin = self.sent_ready = False

    async def send_pending(self, relay, rpc, report, parent):
        if not self.sent_begin:
            if not parent.return_completion.sent_resume or report.get('capturedOriginalSecondHostResumeDelivered') is not True:
                return
            log = Path(report['profile']).parent / 'native.log'
            if not log.is_file() or log.is_symlink(): return
            tail = bounded_read(log, 4 * 1024 * 1024)
            if b'[coop-load] Resumed epoch=1 serial=2 region=0_0\n' not in tail: return
            start = report.get('savedRevisitRecipientInputStart')
            rows = report.get('lobbyPacketMetadata', [])
            if not isinstance(start, int) or not 0 <= start <= len(rows) <= 128: return
            frames = []
            for row in rows[start:]:
                data = bounded_read(row['copy'], 65536)
                if (len(data) != row['bytes'] or digest(data) != row['sha256'] or
                        (row['sender'], row['recipient']) != (2, 1)):
                    raise ValueError('Actual home input custody/endpoints differ')
                if len(data) == 20 and struct.unpack_from('<2I',data) == (256,5): frames.append(empty_input(data))
            if frames[:7] != [10,12,14,16,18,20,22]: return
            # These are actual post-resume inputs, not a claimed pause receipt.
            # Production transfer start/Ready still require phase7/pending0,
            # owner1, frame22/clock1650 and the unchanged live party/graph.
            self.sent_begin = True  # Unknown outcomes are never retried.
            if await rpc(relay.BARRIER, self.begin_body) != b'': raise ValueError('Captured third Begin refused')
            report.update(capturedSavedRevisitBeginDelivered=True, referenceThirdHostReadyVotesSent=0,
                          referenceThirdHostLoadedVotesSent=0)
        if self.sent_ready or not self.transfer.completed: return
        ready = []
        for row in report.get('proposalProtocolRequests', []):
            if (row['sender'], row['host'], row['op'], row['action']) != (2, False, 12, 2): continue
            wire = bounded_read(row['copy'], 2048)
            if len(wire) != row['bytes'] or digest(wire) != row['sha256']: raise ValueError('Third recipient Ready custody differs')
            if struct.unpack_from('<I', wire, 24)[0] != 3: continue
            if len(wire) != 32 + struct.unpack_from('<I',wire,28)[0] or digest(wire[32:]) != self.descriptor_sha:
                raise ValueError('Third recipient Ready descriptor differs')
            ready.append(row)
        if not ready: return
        if len(ready) != 1: raise ValueError('Repeated third recipient Ready')
        self.sent_ready = True
        if await rpc(relay.BARRIER, self.ready_body) != b'': raise ValueError('Captured third Ready refused')
        report.update(capturedSavedRevisitReadyDelivered=True, referenceThirdHostReadyVotesSent=1)

    async def checkpoint_event(self, relay, body, rpc, packets, report):
        if not self.sent_begin: raise ValueError('Third checkpoint preceded actual Begin')
        reply = self.transfer.receive(relay, body)
        rows = report.setdefault('savedRevisitCheckpointEvents', [])
        if len(rows) >= 28 or len(body) > 20: raise ValueError('Third checkpoint event bound exceeded')
        path = packets / f'saved-revisit-checkpoint-event-{len(rows):03}.bin'
        with path.open('xb') as sink: sink.write(body)
        rows.append(dict(copy=str(path),bytes=len(body),sha256=digest(body)))
        if reply is not None and await rpc(relay.CHECKPOINT, reply) != b'': raise ValueError('Requested saved neighbor delivery refused')
        report.update(originalNeighborCheckpointTransferCompleted=self.transfer.completed,
                      originalNeighborCheckpointTransferredBytes=self.transfer.offset,
                      originalNeighborCheckpointTransferSha256=self.neighbor['sha256'])

    def preserve_event(self, relay, body, packets, report):
        reader = relay.Reader(body); serial, stage = reader.u32(), reader.u32()
        descriptor = reader.string(relay.BARRIER_DESCRIPTOR_BYTES); count = reader.u32()
        players = [reader.u32() for _ in range(count)] if count <= 4 else []; reader.done()
        rows = report.setdefault('observedSavedRevisitEvents', [])
        completion=getattr(self,'completion',None)
        if (not self.sent_begin or len(rows) >= (3 if completion else 2) or len(body) > 2048 or serial != 3 or stage != len(rows)+1 or
                (stage == 2 and not self.sent_ready) or (stage == 3 and (not completion or not completion.sent_loaded)) or players != [1,2] or digest(descriptor) != self.descriptor_sha):
            raise ValueError('Third event differs from actual unchanged host Begin')
        path = packets / f'saved-revisit-event-{len(rows):03}.bin'
        with path.open('xb') as sink: sink.write(body)
        rows.append(dict(copy=str(path),bytes=len(body),sha256=digest(body),serial=serial,stage=stage,
                         players=players,descriptorSha256=digest(descriptor)))
