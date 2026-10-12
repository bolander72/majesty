"""Replay the inspected original recipient's second votes to one native host.

The reference owns no game world. Ready requires the identical real host
proposal; Loaded waits for the host's own full-reader/rebuild/Loaded boundary.
All vote bytes come from the stopped original recipient, without edits.
"""
import json
from pathlib import Path
import struct
import subprocess
from .native_original_host_replay import ROOT, bounded_read, digest


class CapturedSavedReturnRecipientVotes:
    def __init__(self, proof_name, executable_sha):
        self.path = Path(proof_name).resolve()
        raw = bounded_read(self.path, 2 * 1024 * 1024)
        proof = json.loads(raw)
        if (proof.get('originalRecipientSavedReaderLoadedQualified') is not True or
                proof.get('matchingPausedCurrentGameplayQualified') is not True or
                proof.get('referenceSecondReadyVotes') != 1 or
                proof.get('referenceSecondLoadedVotes') != 0 or
                proof.get('savedReturnCompleted') is not False or proof.get('browserUsed') is not False):
            raise ValueError('Require an inspected actual recipient saved reader without host Loaded')
        code = """import {inspectSavedReturnRecipient} from './scripts/inspect-native-coop-saved-return-recipient.mjs';
const p=await inspectSavedReturnRecipient(process.argv[1],{committed:true});
console.log(JSON.stringify({reportSha256:p.reportSha256,descriptorSha256:p.descriptorSha256,
 capturedRecipientRequests:p.capturedRecipientRequests,capturedRecipientLoadedRequests:p.capturedRecipientLoadedRequests,
 sourceClock:p.sourceClock,sourceFrame:p.sourceFrame,verifierInputs:p.verifierInputs}));"""
        result = subprocess.run(['node', '--max-old-space-size=96', '--input-type=module', '-e', code, proof['report']],
                                cwd=ROOT, capture_output=True, text=True, timeout=45)
        if result.returncode or len(result.stdout) > 32768:
            raise ValueError('Independent saved-return recipient inspection refused')
        checked = json.loads(result.stdout)
        if any(checked[key] != proof[key] for key in checked):
            raise ValueError('Recorded saved-return recipient proof differs')
        report_raw = bounded_read(proof['report'], 2 * 1024 * 1024)
        if digest(report_raw) != proof['reportSha256'] or json.loads(report_raw)['nativeExecutableSha256'] != executable_sha:
            raise ValueError('Recipient report/executable custody differs')
        self.rows = proof['capturedRecipientRequests'] + proof['capturedRecipientLoadedRequests']
        self.descriptor_sha = proof['descriptorSha256']
        self.source_inputs = [(self.path, raw), (Path(proof['report']), report_raw)]
        self.bodies = []
        if len(self.rows) != 2:
            raise ValueError('Require exactly actual recipient second Ready/Loaded')
        for action, row in zip((2, 3), self.rows):
            wire = bounded_read(row['copy'], 2048)
            if (len(wire) != row['bytes'] or digest(wire) != row['sha256'] or len(wire) < 33 or
                    (row['sender'], row['host'], row['op'], row['action']) != (2, False, 12, action)):
                raise ValueError('Actual recipient second vote custody differs')
            words = struct.unpack_from('<8I', wire)
            if (words[:7] != (0x31525044, 1, 12, row['request'], 0, action, 2) or
                    not words[3] or not 1 <= words[7] <= 1024 or len(wire) != 32 + words[7] or
                    digest(wire[32:]) != self.descriptor_sha):
                raise ValueError('Actual recipient second vote framing/descriptor differs')
            self.bodies.append(wire[20:]); self.source_inputs.append((Path(row['copy']), wire))
        source_raw = bounded_read(proof['sourceHostReport'], 2 * 1024 * 1024)
        if digest(source_raw) != proof['sourceHostReportSha256']:
            raise ValueError('Actual saved source host report custody differs')
        source_report = json.loads(source_raw)
        self.source_inputs.append((Path(proof['sourceHostReport']), source_raw))
        prefix = Path(source_report['profile']) / 'Documents/My Games/MajestyHD/SaveGame/CoopTransitions_native-terrain-fixture_1_0'
        files = source_report['savedReturnSourceFiles']
        if len(files) != 2:
            raise ValueError('Require one actual source file and its selected marker')
        self.source_rows = [next(r for r in files if r['path'] == str(prefix) + suffix)
                            for suffix in ('_0.GMP', '.checkpoint')]
        data = []
        for row in self.source_rows:
            blob = bounded_read(row['path'], 2 * 1024 * 1024)
            if len(blob) != row['bytes'] or digest(blob) != row['sha256']:
                raise ValueError('Original saved source/marker custody differs')
            self.source_inputs.append((Path(row['path']), blob)); data.append(blob)
        descriptor = self.bodies[0][12:].decode('ascii').splitlines()
        if len(descriptor) != 22 or descriptor[10:15] != ['31','1550','1',str(len(data[0])),digest(data[0])]:
            raise ValueError('Captured second vote lacks the exact original source checkpoint')
        expected_marker = ['majesty-coop-checkpoint-v1','0',descriptor[1],descriptor[8],descriptor[9],
                           '1','0','31','1550','1',str(len(data[0])),digest(data[0])]
        if data[1].decode('ascii').splitlines() != expected_marker:
            raise ValueError('Original second source selected marker differs')
        self.sent_ready = self.sent_loaded = False
        self.frozen_inputs = []

    def preserve(self, directory):
        for i, (source, data) in enumerate(self.source_inputs):
            path = directory / f'return-recipient-source-{i:03}-{source.name}'
            with path.open('xb') as sink: sink.write(data)
            self.frozen_inputs.append(dict(source=str(source), copy=str(path), bytes=len(data), sha256=digest(data)))
        self.verify_preserved()

    def verify_preserved(self):
        for row in self.frozen_inputs:
            data = bounded_read(row['copy'], 2 * 1024 * 1024)
            if len(data) != row['bytes'] or digest(data) != row['sha256']:
                raise ValueError('Owned second recipient vote inputs changed')

    def preserve_source(self, profile):
        folder = profile / 'captured-return-source'; folder.mkdir()
        rows = []
        for row, name in zip(self.source_rows, ('source_0.GMP','source.checkpoint')):
            data = bounded_read(row['path'], 2 * 1024 * 1024)
            if len(data) != row['bytes'] or digest(data) != row['sha256']:
                raise ValueError('Agreed original second source changed before copying')
            path = folder / name
            with path.open('xb') as sink: sink.write(data)
            rows.append(dict(source=row['path'],copy=str(path),bytes=len(data),sha256=digest(data)))
        return rows

    def host_actions(self, report):
        actions = []
        for row in report.get('proposalProtocolRequests', []):
            if row['sender'] != 1 or row['host'] is not True or row['op'] != 12 or row['action'] == 0:
                continue
            wire = bounded_read(row['copy'], 2048)
            if len(wire) != row['bytes'] or digest(wire) != row['sha256'] or len(wire) < 33:
                raise ValueError('Actual host second vote custody differs')
            if struct.unpack_from('<I', wire, 24)[0] != 2:
                continue
            if len(wire) != 32 + struct.unpack_from('<I', wire, 28)[0] or digest(wire[32:]) != self.descriptor_sha:
                raise ValueError('Actual host saved-return descriptor differs from captured recipient')
            actions.append(row['action'])
        return actions

    async def send_pending(self, relay, rpc, report):
        events = report.get('observedSavedReturnEvents', [])
        if not events:
            return
        if events[0]['descriptorSha256'] != self.descriptor_sha:
            raise ValueError('Actual host second proposal differs from captured recipient')
        actions = self.host_actions(report)
        if not self.sent_ready and actions == [1, 2]:
            self.sent_ready = True  # Never retry an unknown RPC outcome.
            if await rpc(relay.BARRIER, self.bodies[0]) != b'':
                raise ValueError('Captured actual recipient second Ready refused')
            report['referenceReplayedSecondRecipientReadyVotes'] = 1
        if self.sent_ready and not self.sent_loaded and actions == [1, 2, 3]:
            log = Path(report['profile']).parent / 'native.log'
            if not log.is_file() or log.is_symlink() or log.stat().st_size > 4 * 1024 * 1024:
                raise ValueError('Missing/unbounded actual saved host load trace')
            with log.open('rb') as stream:
                stream.seek(max(0, log.stat().st_size - 16384)); tail = stream.read(16384)
            markers = [b'[coop-load] Saved source teardown epoch=1 serial=2 pause-held=1 loaded=1\n',
                       b'[coop-load] Held epoch=1 serial=2 slot=0 clock=550\n',
                       b'[coop-load] Loaded epoch=1 serial=2 slot=0\n']
            if any(marker not in tail for marker in markers):
                return
            if report.get('nativeSavedReturnSnapshotRequested') is True:
                marker = (b'[coop-return-fixture] Snapshot epoch=1 serial=2 local=1 slot=0 region=0_0 '
                          b'frame=0 clock=550 original-writer=1 source-retained=1 coordinator-loaded=1 '
                          b'peer-loaded=0 resume-controls=0 live-second-engine=0\n')
                target = Path(report['profile']) / 'Documents/My Games/MajestyHD/SaveGame/Coop_World_Return_Target.GMP'
                if marker not in tail or not target.is_file() or target.is_symlink():
                    return
                if not 0 < target.stat().st_size <= 2 * 1024 * 1024:
                    raise ValueError('Original saved host snapshot exceeds its bound')
            self.sent_loaded = True
            if await rpc(relay.BARRIER, self.bodies[1]) != b'':
                raise ValueError('Captured actual recipient second Loaded refused')
            report['referenceReplayedSecondRecipientLoadedVotes'] = 1
        report['replayedSecondRecipientVoteBodies'] = [dict(action=r['action'],source=r['copy'],
            bytes=len(b),sha256=digest(b)) for r,b in zip(self.rows,self.bodies)
            if (r['action']==2 and self.sent_ready) or (r['action']==3 and self.sent_loaded)]

    def preserve_event(self, relay, body, packets, report):
        reader = relay.Reader(body); serial, stage = reader.u32(), reader.u32()
        descriptor = reader.string(relay.BARRIER_DESCRIPTOR_BYTES); count = reader.u32()
        players = [reader.u32() for _ in range(count)] if count <= 4 else []; reader.done()
        rows = report.setdefault('observedSavedReturnEvents', [])
        previous = report.get('observedProposalEvents', [])
        if (len(body) > 2048 or serial != 2 or players != [1,2] or len(rows) >= 3 or stage != len(rows)+1 or
                digest(descriptor) != self.descriptor_sha or [r['stage'] for r in previous] != [1,2,3] or
                (stage >= 2 and not self.sent_ready) or (stage == 3 and not self.sent_loaded)):
            raise ValueError('Saved host barrier differs from actual recipient votes/order')
        name = ['saved-return-prepared-000.bin','saved-return-committed-001.bin','saved-return-complete-002.bin'][len(rows)]
        path = packets / name
        with path.open('xb') as sink: sink.write(body)
        rows.append(dict(copy=str(path),bytes=len(body),sha256=digest(body),serial=serial,stage=stage,
                         players=players,descriptorSha256=digest(descriptor)))
