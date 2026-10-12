"""Replay inspected actual host Loaded and original resume to one original guest."""
import json
from pathlib import Path
import struct
import subprocess

from .native_original_host_replay import ROOT, bounded_read, digest
from .native_original_inputs import RecordedHostResumeInputs
from .native_coop_proposal_replay import proposal_requests, target_snapshot_completed
from .native_coop_extended_stream import RecordedExtendedHostCompletion


class CapturedHostCompletion:
    def __init__(self, proof_name, proposal, *, extended=False):
        self.path=Path(proof_name).resolve()
        raw=bounded_read(self.path,2*1024*1024);proof=json.loads(raw)
        if (proof.get('recordedRoleTargetGameplayEqualityQualified') is not True or
                proof.get('sourceImportedLiveGameplayMatches') is not True or
                proof.get('hostOriginalResumeExecuted') is not True or
                proof.get('descriptorSha256') != proposal.descriptor_sha or
                proof.get('browserUsed') is not False):
            raise ValueError('Require inspected host target/source equality and actual original resume')
        code="""import {inspectHostLoaded} from './scripts/inspect-native-coop-host-loaded.mjs';
const p=await inspectHostLoaded(process.argv[1]);
console.log(JSON.stringify({reportSha256:p.reportSha256,descriptorSha256:p.descriptorSha256,
 capturedHostRequests:p.capturedHostRequests,recipientReportSha256:p.recipientReportSha256,
 verifierInputs:p.verifierInputs,hostOriginalResumeExecuted:p.hostOriginalResumeExecuted}));"""
        result=subprocess.run(['node','--max-old-space-size=96','--input-type=module','-e',code,proof['report']],cwd=ROOT,capture_output=True,text=True,timeout=20)
        if result.returncode or len(result.stdout)>32768:
            raise ValueError('Independent host full-world completion inspection refused')
        checked=json.loads(result.stdout)
        if any(checked[k]!=proof[k] for k in checked):
            raise ValueError('Host completion proof differs from independent inspection')
        rows=proof['capturedHostRequests']
        if [r['action'] for r in rows]!=[1,2,3]:
            raise ValueError('Require original host Begin/Ready/Loaded capture')
        bodies=proposal_requests(rows[-2:],bounded_read,proposal.descriptor_sha,actions=(2,3))
        self.loaded_body=bodies[1];self.loaded_row=rows[2]
        report_raw=bounded_read(proof['report'],2*1024*1024);report=json.loads(report_raw)
        if digest(report_raw)!=proof['reportSha256']:
            raise ValueError('Host completion report custody differs')
        packets=[];resumed=False;self.source_inputs=[(self.path,raw)]
        for row in rows[-2:]:self.source_inputs.append((Path(row['copy']),bounded_read(row['copy'],2048)))
        for row in report['lobbyPacketMetadata']:
            if (row['sender'],row['recipient'])!=(1,2):
                raise ValueError('Host resume capture has a different authenticated endpoint')
            payload=bounded_read(row['copy'],65536)
            if len(payload)!=row['bytes'] or digest(payload)!=row['sha256']:
                raise ValueError('Captured host resume packet custody differs')
            if struct.unpack_from('<II',payload)==(0x100,4):
                if resumed:raise ValueError('Repeated original host immediate command')
                resumed=True
            if resumed:
                packets.append(payload);self.source_inputs.append((Path(row['copy']),payload))
        if extended:
            code="""import{inspectTargetInputs}from'./scripts/inspect-native-coop-target-inputs.mjs';
const p=await inspectTargetInputs(process.argv[1]);console.log(JSON.stringify({reportSha256:p.reportSha256,accepted:p.actualRelayAcceptedTargetGuestPackets,clock:p.originalFinalClock}));"""
            result=subprocess.run(['node','--max-old-space-size=96','--input-type=module','-e',code,proof['report']],cwd=ROOT,capture_output=True,text=True,timeout=20)
            if result.returncode or len(result.stdout)>4096:raise ValueError('Independent extended host input inspection refused')
            checked=json.loads(result.stdout)
            if checked['reportSha256']!=proof['reportSha256']or checked['accepted']!=10 or checked['clock']<900:
                raise ValueError('Extended host stream lacks accepted actual guest inputs/progression')
            self.resume=RecordedExtendedHostCompletion(packets)
        else:self.resume=RecordedHostResumeInputs(packets)
        self.sent_loaded=False;self.frozen_inputs=[]

    def preserve(self,directory):
        for i,(source,data)in enumerate(self.source_inputs):
            target=directory/f'completion-source-{i:03}-{source.name}'
            with target.open('xb')as sink:sink.write(data)
            self.frozen_inputs.append(dict(source=str(source),copy=str(target),bytes=len(data),sha256=digest(data)))
        self.verify_preserved()

    def verify_preserved(self):
        for row in self.frozen_inputs:
            data=bounded_read(row['copy'],2*1024*1024)
            if len(data)!=row['bytes'] or digest(data)!=row['sha256']:
                raise ValueError('Owned host completion replay input changed')

    async def send_pending(self,relay,rpc,report):
        if self.sent_loaded or not target_snapshot_completed(report,2,1):return
        actions=[r['action']for r in report.get('proposalProtocolRequests',[])
                 if (r['sender'],r['host'],r['op'])==(2,False,12) and r['action']>0]
        if actions!=[2,3] or [r['stage']for r in report['observedProposalEvents']]!=[1,2]:
            raise ValueError('Host Loaded replay requires actual recipient Ready/Loaded and real Commit')
        self.sent_loaded=True  # Never retry unknown outcomes or duplicate Loaded.
        if await rpc(relay.BARRIER,self.loaded_body)!=b'':
            raise ValueError('Captured actual host Loaded refused')
        report.update(referenceHostLoadedVotesSent=1,capturedOriginalHostLoadedDelivered=True,
                      replayedOriginalHostLoadedBody=dict(source=self.loaded_row['copy'],bytes=len(self.loaded_body),sha256=digest(self.loaded_body)))

    def original_resume_packets(self,report):
        complete=[r['stage']for r in report.get('observedProposalEvents',[])]==[1,2,3]
        return self.resume.deliver(self.sent_loaded,complete)
