"""Actual third host Loaded/resume, after the recipient original full writer."""
import json
from pathlib import Path
import struct
import subprocess
from .native_original_host_replay import ROOT, bounded_read, digest


class CapturedSavedRevisitResume:
    def __init__(self,name,descriptor_sha,executable):
        self.path=Path(name).resolve();raw=bounded_read(self.path,2*1024*1024);proof=json.loads(raw)
        for key in ('originalHostThirdSavedReaderLoadedQualified','originalHostThirdHeldWorldPreservedQualified',
                    'originalPausedThirdSourceGameplayPreservedQualified','actualThirdCompleteQualified',
                    'originalHostThirdResumeExecutedQualified'):
            if proof.get(key)is not True:raise ValueError('Require actual qualified third host load/full writer/Complete/resume')
        if proof.get('browserUsed')is not False or proof['descriptorSha256']!=descriptor_sha:
            raise ValueError('Third host completion scope/descriptor differs')
        code="""import{inspectSavedRevisitHost}from'./scripts/inspect-native-coop-saved-revisit-host.mjs';
const p=await inspectSavedRevisitHost(process.argv[1],process.argv[2]);console.log(JSON.stringify({reportSha256:p.reportSha256,
descriptorSha256:p.descriptorSha256,capturedHostThirdRequests:p.capturedHostThirdRequests,capturedThirdResume:p.capturedThirdResume,
verifierInputs:p.verifierInputs}));"""
        result=subprocess.run(['node','--max-old-space-size=96','--input-type=module','-e',code,proof['report'],proof['baselineProof']],
                              cwd=ROOT,capture_output=True,text=True,timeout=240)
        if result.returncode or len(result.stdout)>32768:raise ValueError('Independent third host completion refused')
        checked=json.loads(result.stdout)
        if any(proof[k]!=checked[k]for k in checked):raise ValueError('Third completion proof differs from independent inspection')
        report_raw=bounded_read(proof['report'],2*1024*1024)
        if digest(report_raw)!=proof['reportSha256']or json.loads(report_raw)['nativeExecutableSha256']!=executable:
            raise ValueError('Third host completion executable/report custody differs')
        self.source_inputs=[(self.path,raw),(Path(proof['report']),report_raw)]
        rows=proof['capturedHostThirdRequests']
        if len(rows)!=3 or [r['action']for r in rows]!=[1,2,3]:raise ValueError('Require actual third Begin/Ready/Loaded')
        for row in rows:
            wire=bounded_read(row['copy'],2048)
            if (len(wire)<33 or len(wire)!=row['bytes']or digest(wire)!=row['sha256']or
                (row['sender'],row['host'],row['op'])!=(1,True,12)or not row['request']or
                struct.unpack_from('<7I',wire)!=(0x31525044,1,12,row['request'],0,row['action'],3)or
                not 1<=struct.unpack_from('<I',wire,28)[0]<=1024 or len(wire)!=32+struct.unpack_from('<I',wire,28)[0]or
                digest(wire[32:])!=descriptor_sha):raise ValueError('Third host vote custody/framing differs')
            self.source_inputs.append((Path(row['copy']),wire))
        self.loaded_row=rows[-1];self.loaded_body=self.source_inputs[-1][1][20:]
        row=proof['capturedThirdResume'];self.resume=bounded_read(row['copy'],60)
        if (len(self.resume)!=60 or len(self.resume)!=row['bytes']or digest(self.resume)!=row['sha256']or
            (row['sender'],row['recipient'])!=(1,2)or struct.unpack_from('<2I',self.resume)!=(256,4)or
            struct.unpack('<13I',bytes(x^49 for x in self.resume[8:]))!=(48,1,0,0,1,24,9,1,1,0,50,0,0)):
            raise ValueError('Third original resume custody/framing differs')
        self.resume_row=row;self.source_inputs.append((Path(row['copy']),self.resume))
        self.descriptor_sha=descriptor_sha;self.sent_loaded=self.sent_resume=False

    async def send_pending(self,relay,rpc,report,revisit):
        if self.sent_loaded or not revisit.sent_ready or not revisit.transfer.completed:return
        if [r['stage']for r in report.get('observedSavedRevisitEvents',[])]!=[1,2]:return
        loaded=[]
        for row in report.get('proposalProtocolRequests',[]):
            if (row['sender'],row['host'],row['op'],row['action'])!=(2,False,12,3):continue
            wire=bounded_read(row['copy'],2048)
            if len(wire)<28 or len(wire)!=row['bytes']or digest(wire)!=row['sha256']:
                raise ValueError('Actual third recipient Loaded custody differs')
            if struct.unpack_from('<I',wire,24)[0]!=3:continue
            if len(wire)<33 or len(wire)!=32+struct.unpack_from('<I',wire,28)[0]or digest(wire[32:])!=self.descriptor_sha:
                raise ValueError('Actual third recipient Loaded descriptor differs')
            loaded.append(row)
        if not loaded:return
        if len(loaded)!=1:raise ValueError('Repeated third recipient Loaded')
        profile=Path(report['profile']);log=profile.parent/'native.log'
        target=profile/'Documents/My Games/MajestyHD/SaveGame/Coop_World_Travel_Target_3.GMP'
        if any(not p.is_file()or p.is_symlink()for p in (log,target)):return
        trace=bounded_read(log,4*1024*1024)
        markers=[b'[coop-load] Held epoch=1 serial=3 slot=1 clock=1550\n',b'[coop-load] Loaded epoch=1 serial=3 slot=1\n',
                 b'[coop-travel-target-fixture] Snapshot epoch=1 serial=3 local=2 slot=1 region=1_0 saved=1 frame=0 clock=1550 original-writer=1 source-retained=1 coordinator-loaded=1 peer-loaded=0 resume-controls=0 live-second-engine=0 ']
        if any(marker not in trace for marker in markers):return
        if not 0<target.stat().st_size<=2*1024*1024:raise ValueError('Third recipient full target exceeds bound')
        self.sent_loaded=True
        if await rpc(relay.BARRIER,self.loaded_body)!=b'':raise ValueError('Captured third host Loaded refused')
        report.update(referenceThirdHostLoadedVotesSent=1,capturedSavedRevisitLoadedDelivered=True,
                      replayedSavedRevisitLoadedBody=dict(source=self.loaded_row['copy'],bytes=len(self.loaded_body),sha256=digest(self.loaded_body)))

    def resume_packets(self,report):
        if self.sent_resume or not self.sent_loaded:return []
        if [r['stage']for r in report.get('observedSavedRevisitEvents',[])]!=[1,2,3]:return []
        self.sent_resume=True
        return [self.resume]
