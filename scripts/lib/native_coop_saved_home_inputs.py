"""Bounded actual recipient inputs after the qualified saved-home resume."""
import json
from pathlib import Path
import struct
import subprocess
import time

from .native_original_host_replay import ROOT, bounded_read, digest
from .native_original_inputs import empty_input


class SavedHomeInputWindow:
    def __init__(self, payloads, clock=time.monotonic):
        if len(payloads) not in (5,7) or [empty_input(p) for p in payloads] != list(range(10,10+2*len(payloads),2)):
            raise ValueError('Require five or seven actual saved-home input frames')
        self.payloads = tuple(payloads)
        self.clock = clock
        self.resume_seen = self.pending = self.delivered = False
        self.next_index = 0
        self.deadline = None

    def observe(self, sender, recipient, payload, second_complete):
        if (sender, recipient) != (1, 2) or not 8 <= len(payload) <= 65536:
            raise ValueError('Saved-home request endpoints/size differ')
        if self.delivered or not second_complete:
            return
        kind = struct.unpack_from('<2I', payload)
        if kind == (256, 4):
            if self.resume_seen:
                raise ValueError('Repeated second original resume')
            if len(payload) != 60 or struct.unpack('<13I', bytes(x ^ 49 for x in payload[8:])) != (48,1,0,0,1,24,9,1,1,0,50,0,0):
                raise ValueError('Actual second original resume shape differs')
            self.resume_seen = True
        elif self.resume_seen and not self.pending and kind == (256, 5):
            if empty_input(payload) != 10:
                raise ValueError('Saved-home inputs require the actual first frame10 request')
            self.pending = True

    def deliver(self, original_resumed):
        if not self.pending or self.delivered or original_resumed is not True:
            return []
        now = self.clock()
        if self.deadline is not None and now < self.deadline:
            return []
        payload = self.payloads[self.next_index]
        self.next_index += 1
        self.deadline = now + .1
        self.delivered = self.next_index == len(self.payloads)
        return [payload]  # Never consume twice after an unknown send outcome.


class CapturedSavedHomeGuestInputs:
    def __init__(self, proof_name, executable):
        self.path = Path(proof_name).resolve()
        raw = bounded_read(self.path, 2 * 1024 * 1024)
        proof = json.loads(raw)
        if (not self.path.is_relative_to(ROOT / 'output') or
                proof.get('bothRecordedReturningRolesResumedQualified') is not True or
                proof.get('savedHomeGameplayPreservedQualified') is not True or proof.get('browserUsed') is not False):
            raise ValueError('Require independently qualified actual saved-home returning roles')
        code = """import {inspectSavedReturnResume} from './scripts/inspect-native-coop-saved-return-resume.mjs';
const p=await inspectSavedReturnResume(process.argv[1]);
console.log(JSON.stringify({reportSha256:p.reportSha256,descriptorSha256:p.descriptorSha256,
 snapshot:p.snapshot,verifierInputs:p.verifierInputs}));"""
        extended = proof.get('originalSavedHomeStreamQualified') is True
        if extended:
            code = code.replace('inspectSavedReturnResume','inspectSavedHomeStream').replace('inspect-native-coop-saved-return-resume.mjs','inspect-native-coop-saved-home-stream.mjs')
            code = code.replace('process.argv[1]);','process.argv[1],process.argv[2]);')
        arguments = ['node','--max-old-space-size=96','--input-type=module','-e',code,proof['report']]
        if extended:
            arguments.append(proof['baselineProof'])
        result = subprocess.run(arguments,cwd=ROOT,capture_output=True,text=True,timeout=60)
        if result.returncode or len(result.stdout) > 32768:
            raise ValueError('Independent saved-home resume inspection refused')
        checked = json.loads(result.stdout)
        if any(checked[k] != proof[k] for k in checked):
            raise ValueError('Saved-home resume proof differs from independent inspection')
        report_raw = bounded_read(proof['report'], 2 * 1024 * 1024)
        report = json.loads(report_raw)
        if digest(report_raw) != proof['reportSha256'] or report['nativeExecutableSha256'] != executable:
            raise ValueError('Saved-home input source report/build custody differs')
        inputs = []
        for i,row in enumerate(report['lobbyPacketMetadata'],1):
            if (row['sequence'],row['sender'],row['recipient']) != (i,2,1):
                raise ValueError('Actual saved-home recipient stream owner/order differs')
            payload = bounded_read(row['copy'],65536)
            if len(payload) != row['bytes'] or digest(payload) != row['sha256']:
                raise ValueError('Actual saved-home input packet custody differs')
            if struct.unpack_from('<2I',payload) == (256,5):
                inputs.append((row,payload,empty_input(payload)))
        home_count = 10 if extended else 5
        if len(inputs) != 22+home_count or [x[2] for x in inputs] != list(range(10,22,2))+list(range(10,42,2))+list(range(10,10+2*home_count,2)):
            raise ValueError('Require the actual source/fresh/home input rollbacks')
        selected = inputs[-home_count:][:7 if extended else 5]
        self.rows = [x[0] for x in selected]
        self.source_inputs = [(self.path,raw),(Path(proof['report']),report_raw)] + [(Path(row['copy']),data) for row,data,_ in selected]
        self.window = SavedHomeInputWindow([x[1] for x in selected])
        self.descriptor_sha = proof['descriptorSha256']
        self.frozen_inputs = []

    def preserve(self,directory):
        for i,(source,data) in enumerate(self.source_inputs):
            path = directory / f'saved-home-source-{i:03}-{source.name}'
            with path.open('xb') as sink: sink.write(data)
            self.frozen_inputs.append(dict(source=str(source),copy=str(path),bytes=len(data),sha256=digest(data)))

    def verify_preserved(self):
        for row in self.frozen_inputs:
            data = bounded_read(row['copy'],2*1024*1024)
            if len(data) != row['bytes'] or digest(data) != row['sha256']:
                raise ValueError('Owned saved-home input source changed')

    def pending(self,report):
        events = report.get('observedSavedReturnEvents',[])
        if [r['stage'] for r in events] != [1,2,3] or any(r['descriptorSha256'] != self.descriptor_sha for r in events):
            return []
        log = Path(report['profile']).parent / 'native.log'
        if not log.is_file() or log.is_symlink():
            return []
        trace = bounded_read(log,4*1024*1024)
        # Keep the real frame10 request waiting until the ordinary script
        # action is actually queued. Delivering this bounded peer window
        # earlier can exhaust it before the game consumes the travel action.
        resumed = (b'[coop-load] Resumed epoch=1 serial=2 region=0_0\n' in trace and
                   b'[smoke] named action coop-travel-east: queued\n' in trace)
        return self.window.deliver(resumed)

    def preserve_revisit_event(self,relay,body,packets,report):
        reader=relay.Reader(body)
        serial,stage=reader.u32(),reader.u32()
        descriptor=reader.string(relay.BARRIER_DESCRIPTOR_BYTES)
        count=reader.u32();players=[reader.u32() for _ in range(count)] if count<=4 else []
        reader.done()
        if (serial,stage,players) != (3,1,[1,2]) or not self.window.delivered or report.get('observedRevisitEvents'):
            raise ValueError('Saved revisit must follow completed original home input delivery')
        path=packets/'saved-revisit-prepared-000.bin'
        with path.open('xb') as sink:sink.write(body)
        report['observedRevisitEvents']=[dict(copy=str(path),bytes=len(body),sha256=digest(body),serial=serial,stage=stage,
                                            players=players,descriptorSha256=digest(descriptor))]
