"""Replay a qualified original host's second Loaded/resume to one recipient.

The reference has no world. Every transmitted byte comes from a stopped host;
the recipient must complete its own saved reader and held full writer first.
"""
import json
from pathlib import Path
import struct
import subprocess

from .native_original_host_replay import ROOT, bounded_read, digest


class CapturedSavedReturnResume:
    def __init__(self, proof_name, descriptor_sha, executable, *, home_inputs=False):
        self.path = Path(proof_name).resolve()
        if not self.path.is_relative_to(ROOT / 'output'):
            raise ValueError('Require an owned original saved-return host proof')
        raw = bounded_read(self.path, 2 * 1024 * 1024)
        proof = json.loads(raw)
        for key in ('originalHostSavedReaderLoadedQualified', 'originalHostSavedHomeGameplayPreservedQualified',
                    'originalPausedSourceGameplayPreservedQualified', 'actualSecondCompleteQualified',
                    'originalHostSecondResumeExecutedQualified'):
            if proof.get(key) is not True:
                raise ValueError('Require full original saved-return preservation and actual host resume')
        if (proof.get('descriptorSha256') != descriptor_sha or proof.get('browserUsed') is not False or
                (proof.get('sourceFrame'), proof.get('sourceClock'), proof.get('originalClock')) != (31, 1550, 550)):
            raise ValueError('Saved-return completion descriptor or scope differs')
        code = """import {inspectSavedReturnHost} from './scripts/inspect-native-coop-saved-return-host.mjs';
const p=await inspectSavedReturnHost(process.argv[1]);
console.log(JSON.stringify({reportSha256:p.reportSha256,descriptorSha256:p.descriptorSha256,
 capturedHostSecondRequests:p.capturedHostSecondRequests,capturedSecondResume:p.capturedSecondResume,
 verifierInputs:p.verifierInputs}));"""
        result = subprocess.run(['node', '--max-old-space-size=96', '--input-type=module', '-e', code, proof['report']],
                                cwd=ROOT, capture_output=True, text=True, timeout=45)
        if result.returncode or len(result.stdout) > 32768:
            raise ValueError('Independent saved-return host completion inspection refused')
        checked = json.loads(result.stdout)
        if any(checked[k] != proof[k] for k in checked):
            raise ValueError('Saved-return completion proof differs from independent inspection')
        report_raw = bounded_read(proof['report'], 2 * 1024 * 1024)
        report = json.loads(report_raw)
        if digest(report_raw) != proof['reportSha256'] or report['nativeExecutableSha256'] != executable:
            raise ValueError('Saved-return completion report/build custody differs')
        rows = proof['capturedHostSecondRequests']
        if [r['action'] for r in rows] != [1, 2, 3]:
            raise ValueError('Require actual second host Begin/Ready/Loaded')
        for row in rows:
            wire = bounded_read(row['copy'], 2048)
            if (len(wire) != row['bytes'] or digest(wire) != row['sha256'] or len(wire) < 33 or
                    (row['sender'], row['host'], row['op']) != (1, True, 12) or
                    struct.unpack_from('<7I', wire) != (0x31525044, 1, 12, row['request'], 0, row['action'], 2) or
                    not row['request'] or len(wire) != 32 + struct.unpack_from('<I', wire, 28)[0] or
                    digest(wire[32:]) != descriptor_sha):
                raise ValueError('Captured second host vote framing/custody differs')
        self.loaded_body = bounded_read(rows[-1]['copy'], 2048)[20:]
        self.loaded_row = rows[-1]
        self.source_inputs = [(self.path, raw), (Path(proof['report']), report_raw)]
        for row in rows:
            self.source_inputs.append((Path(row['copy']), bounded_read(row['copy'], 2048)))
        row = proof['capturedSecondResume']
        self.resume = bounded_read(row['copy'], 65536)
        if (len(self.resume) != row['bytes'] or digest(self.resume) != row['sha256'] or
                (row['sender'], row['recipient']) != (1, 2) or len(self.resume) != 60 or
                struct.unpack_from('<2I', self.resume) != (256, 4) or
                struct.unpack('<13I', bytes(x ^ 49 for x in self.resume[8:])) !=
                (48, 1, 0, 0, 1, 24, 9, 1, 1, 0, 50, 0, 0)):
            raise ValueError('Captured second original resume framing/custody differs')
        self.resume_row = row
        self.source_inputs.append((Path(row['copy']), self.resume))
        self.resume_payloads = [self.resume]
        if home_inputs:
            from .native_original_inputs import empty_input
            stream = report['lobbyPacketMetadata']
            matches = [i for i,r in enumerate(stream) if r == self.resume_row]
            if len(stream)>128 or len(matches) != 1 or len(stream[matches[0]+1:]) < 5:
                raise ValueError('Require the actual five-packet host home stream')
            for frame,r in zip((10,12,14,16,18),stream[matches[0]+1:matches[0]+6]):
                payload = bounded_read(r['copy'],65536)
                if (len(payload) != r['bytes'] or digest(payload) != r['sha256'] or
                        (r['sender'],r['recipient']) != (1,2) or empty_input(payload) != frame):
                    raise ValueError('Actual host home input framing/custody differs')
                self.resume_payloads.append(payload)
                self.source_inputs.append((Path(r['copy']),payload))
        self.descriptor_sha = descriptor_sha
        self.sent_loaded = self.sent_resume = False

    async def send_pending(self, relay, rpc, report, parent):
        if self.sent_loaded or not parent.sent_return_ready or not parent.transfer.completed:
            return
        if [r['stage'] for r in report.get('observedSavedReturnEvents', [])] != [1, 2]:
            return
        loaded = []
        for row in report.get('proposalProtocolRequests', []):
            if (row['sender'], row['host'], row['op'], row['action']) != (2, False, 12, 3):
                continue
            wire = bounded_read(row['copy'], 2048)
            if len(wire) != row['bytes'] or digest(wire) != row['sha256']:
                raise ValueError('Actual second recipient Loaded custody differs')
            if struct.unpack_from('<I', wire, 24)[0] != 2:
                continue
            if len(wire) != 32 + struct.unpack_from('<I', wire, 28)[0] or digest(wire[32:]) != self.descriptor_sha:
                raise ValueError('Actual second recipient Loaded descriptor differs')
            loaded.append(row)
        if not loaded:
            return
        if len(loaded) != 1:
            raise ValueError('Repeated second recipient Loaded')
        profile = Path(report['profile'])
        log = profile.parent / 'native.log'
        target = profile / 'Documents/My Games/MajestyHD/SaveGame/Coop_World_Return_Target.GMP'
        if not log.is_file() or log.is_symlink() or not target.is_file() or target.is_symlink():
            return
        marker = (b'[coop-return-fixture] Snapshot epoch=1 serial=2 local=2 slot=1 region=0_0 '
                  b'frame=0 clock=550 original-writer=1 source-retained=1 coordinator-loaded=1 '
                  b'peer-loaded=0 resume-controls=0 live-second-engine=0\n')
        if marker not in bounded_read(log, 4 * 1024 * 1024):
            return
        if not 0 < target.stat().st_size <= 2 * 1024 * 1024:
            raise ValueError('Original held saved-return target exceeds its bound')
        self.sent_loaded = True  # Never retry an unknown vote outcome.
        if await rpc(relay.BARRIER, self.loaded_body) != b'':
            raise ValueError('Captured second host Loaded refused')
        report.update(referenceSecondHostLoadedVotesSent=1, capturedSavedReturnLoadedDelivered=True,
                      replayedSavedReturnLoadedBody=dict(source=self.loaded_row['copy'],
                          bytes=len(self.loaded_body), sha256=digest(self.loaded_body)))

    def resume_packets(self, report):
        if self.sent_resume or not self.sent_loaded:
            return []
        if [r['stage'] for r in report.get('observedSavedReturnEvents', [])] != [1, 2, 3]:
            return []
        self.sent_resume = True
        return list(getattr(self, 'resume_payloads', [self.resume]))
