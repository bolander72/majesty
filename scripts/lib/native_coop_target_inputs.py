"""Extend one original host with actual stopped recipient target inputs."""
import json
from pathlib import Path
import struct
import subprocess
import time
from .native_original_host_replay import ROOT,bounded_read,digest
from .native_original_inputs import empty_input
from .native_coop_proposal_replay import target_snapshot_completed


class RecordedTargetGuestInputs:
    """The inspected source20->target10 rollback, never invented frames."""
    def __init__(self,payloads,*,paced=False,lead=1,extended=False):
        if not (10<=len(payloads)<=16 if extended else len(payloads)==10) or [empty_input(p)for p in payloads]!=list(range(10,10+2*len(payloads),2)):
            raise ValueError('Require the bounded contiguous actual target input window')
        self.payloads=tuple(payloads);self.resume_seen=False;self.pending=False;self.delivered=False
        self.resume_sha256=None;self.trigger_sha256=None
        if lead not in (1,2) or (not paced and lead!=1):raise ValueError('Only one bounded captured input of lookahead is admitted')
        self.frames=list(range(10,10+2*len(payloads),2));self.paced=paced;self.lead=lead;self.next_index=0;self.request_sha256=None;self.request_frame=None

    def observe(self,sender,recipient,payload,complete):
        if (sender,recipient)!=(1,2) or not 8<=len(payload)<=65536:
            raise ValueError('Original target request endpoint/size differs')
        # This observer owns one captured input window. Once all its bytes
        # were delivered, later region barriers/resumes belong to the outer
        # replay, and must not reopen or invalidate this completed window.
        if self.delivered:
            return
        category=struct.unpack_from('<II',payload)
        if category==(0x100,4):
            if complete is not True or self.resume_seen:
                raise ValueError('Original target resume requires one real Complete')
            expected=(48,1,0,0,1,24,9,1,1,0,50,0,0)
            if len(payload)!=60 or struct.unpack('<13I',bytes(x^0x31 for x in payload[8:]))!=expected:
                raise ValueError('Actual original target resume schema differs')
            self.resume_seen=True;self.resume_sha256=digest(payload)
        elif self.resume_seen and not self.pending and not self.delivered and category==(0x100,5):
            expected=10+2*(self.next_index-self.lead+1) if self.paced and self.next_index else 10
            if complete is not True or empty_input(payload)!=expected:
                raise ValueError('Target must follow the actual ordered host request after Complete')
            self.pending=True;self.request_sha256=digest(payload);self.request_frame=expected
            if self.next_index==0:self.trigger_sha256=self.request_sha256

    def deliver(self,ready,loaded,complete,original_resumed):
        if not self.pending or self.delivered:return []
        if any(x is not True for x in [ready,loaded,complete,original_resumed]):return []
        if self.paced:
            count=self.lead if self.next_index==0 else 1
            payloads=self.payloads[self.next_index:self.next_index+count]
            self.next_index+=len(payloads);self.pending=False
            self.delivered=self.next_index==len(self.payloads)
            return list(payloads)  # Consume before an unknown send outcome; never retry.
        self.delivered=True  # Unknown send outcomes are never retried.
        return list(self.payloads)


class RecordedTimedTargetGuestInputs(RecordedTargetGuestInputs):
    """Transmit actual peer frame data independently of the host's broadcasts."""
    def __init__(self,payloads,*,extended=False,clock=time.monotonic):
        super().__init__(payloads,extended=extended)
        self.clock=clock;self.deadline=None
        # Admitted payloads have fixed50ms timing and consecutive even frames.
        self.interval=(self.frames[1]-self.frames[0])*50/1000

    def deliver(self,ready,loaded,complete,original_resumed):
        if not self.pending or self.delivered:return []
        if any(x is not True for x in [ready,loaded,complete,original_resumed]):return []
        now=self.clock()
        if self.deadline is not None and now<self.deadline:return []
        data=self.payloads[self.next_index]
        self.next_index+=1;self.deadline=now+self.interval
        self.delivered=self.next_index==len(self.payloads)
        return [data]  # Once consumed, an unknown send outcome is never retried.


def original_resumed(report):
    log=Path(report['profile']).parent/'native.log'
    if not log.is_file() or log.is_symlink():return False
    if log.stat().st_size>4*1024*1024:raise ValueError('Original resume trace exceeds bound')
    with log.open('rb')as f:
        f.seek(max(0,log.stat().st_size-16384));tail=f.read(16384)
    return b'[coop-load] Resumed epoch=1 serial=1 region=1_0\n'in tail


def select_target_sources(inputs, frames, *, extended=False, prefix=0):
    if len(inputs) != len(frames):
        raise ValueError('Original frame and source record counts differ')
    count = len(frames) - 6
    if prefix not in (0, 14) or (prefix and not extended):
        raise ValueError('Only an explicit fourteen-packet extended prefix is admitted')
    maximum = 32 if prefix else 16
    if not (14 <= count <= maximum if prefix else 10 <= count <= 16 if extended else count == 10) or frames != list(range(10,22,2))+list(range(10,10+2*count,2)):
        raise ValueError('Require the unique original source20->target10 rollback')
    return inputs[6:6 + prefix] if prefix else inputs[6:]


class CapturedTargetGuestInputs:
    def __init__(self,proof_name,votes,executable,*,paced=False,extended=False,timed=False,prefix=0):
        if prefix and (not extended or not timed or paced):
            raise ValueError('An actual packet prefix requires extended timed replay')
        self.path=Path(proof_name).resolve();raw=bounded_read(self.path,2*1024*1024);proof=json.loads(raw)
        if (proof.get('recordedRolePostResumeGameplayEqualityQualified')is not True or
            proof.get('browserUsed')is not False or proof.get('livePairedSynchronizationQualified')is not False):
            raise ValueError('Require inspected matching stopped post-resume roles')
        code="""import{inspectTargetProgressPair}from'./scripts/inspect-native-coop-target-progress.mjs';
const p=await inspectTargetProgressPair(process.argv[1],process.argv[2]);
console.log(JSON.stringify({host:p.host.reportSha256,guest:p.guest.reportSha256,
descriptor:p.guest.originalResumeProof.descriptorSha256,
hostSnapshot:p.host.snapshot,guestSnapshot:p.guest.snapshot,
hostVerifiers:p.host.verifierInputs,guestVerifiers:p.guest.verifierInputs}));"""
        if extended:code=code.replace('inspectTargetProgressPair','inspectExtendedTargetProgressPair').replace('inspect-native-coop-target-progress.mjs','inspect-native-coop-extended-target-progress.mjs')
        result=subprocess.run(['node','--max-old-space-size=96','--input-type=module','-e',code,
            proof['host']['report'],proof['guest']['report']],cwd=ROOT,capture_output=True,text=True,timeout=20)
        if result.returncode or len(result.stdout)>16384:raise ValueError('Independent post-resume pair inspection refused')
        checked=json.loads(result.stdout)
        expected=dict(host=proof['host']['reportSha256'],guest=proof['guest']['reportSha256'],
            descriptor=proof['guest']['originalResumeProof']['descriptorSha256'],
            hostSnapshot=proof['host']['snapshot'],guestSnapshot=proof['guest']['snapshot'],
            hostVerifiers=proof['host']['verifierInputs'],guestVerifiers=proof['guest']['verifierInputs'])
        if checked!=expected or checked['descriptor']!=votes.descriptor_sha:
            raise ValueError('Target input proof differs from actual held-world agreement')
        guest_path=Path(proof['guest']['report']);guest_raw=bounded_read(guest_path,2*1024*1024);guest=json.loads(guest_raw)
        if digest(guest_raw)!=checked['guest'] or guest['nativeExecutableSha256']!=executable:
            raise ValueError('Target input source differs from this native build')
        self.source_inputs=[(self.path,raw),(guest_path,guest_raw)];inputs=[];frames=[]
        rows=guest['lobbyPacketMetadata']
        if len(rows)>128:raise ValueError('Original recipient capture exceeds bound')
        for index,row in enumerate(rows):
            if (row['sender'],row['recipient'],row['sequence'])!=(2,1,index+1):
                raise ValueError('Captured recipient input owner/order differs')
            data=bounded_read(row['copy'],65536)
            if len(data)!=row['bytes'] or digest(data)!=row['sha256']:raise ValueError('Actual recipient input custody differs')
            if struct.unpack_from('<II',data)==(0x100,5):
                frames.append(empty_input(data));inputs.append((Path(row['copy']),data))
        self.source_frame_count=len(frames)-6
        self.prefix_count=prefix
        self.target_sources=select_target_sources(inputs,frames,extended=extended,prefix=prefix);self.source_inputs+=self.target_sources
        payloads=[data for _,data in self.target_sources]
        self.window=RecordedTimedTargetGuestInputs(payloads,extended=extended) if timed else RecordedTargetGuestInputs(payloads,paced=paced,lead=2 if paced else 1,extended=extended)
        self.frozen_inputs=[]

    def preserve(self,directory):
        for i,(source,data)in enumerate(self.source_inputs):
            target=directory/f'target-guest-source-{i:03}-{source.name}'
            with target.open('xb')as f:f.write(data)
            self.frozen_inputs.append(dict(source=str(source),copy=str(target),bytes=len(data),sha256=digest(data)))
        self.verify_preserved()

    def verify_preserved(self):
        for row in self.frozen_inputs:
            data=bounded_read(row['copy'],2*1024*1024)
            if len(data)!=row['bytes'] or digest(data)!=row['sha256']:raise ValueError('Owned target input source changed')

    def pending(self,report,votes):
        complete=[r['stage']for r in report.get('observedProposalEvents',[])]==[1,2,3]
        writer=target_snapshot_completed(report,1,0)
        return self.window.deliver(votes.sent_ready,votes.sent_loaded,complete,writer and original_resumed(report))
