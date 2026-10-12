"""Literal third recipient votes, gated by the actual host's full held writer."""
import json
from pathlib import Path
import struct
import subprocess
from .native_original_host_replay import ROOT, bounded_read, digest
from .native_coop_saved_return_votes import CapturedSavedReturnRecipientVotes


class CapturedSavedRevisitRecipientVotes(CapturedSavedReturnRecipientVotes):
    def __init__(self, name, executable):
        self.path=Path(name).resolve();raw=bounded_read(self.path,2*1024*1024);proof=json.loads(raw)
        for key in ('originalRecipientThirdReadyLoadedExecutedQualified','originalRecipientThirdHeldWorldPreservedQualified',
                    'fullThirdLoadedGameplayComparisonQualified'):
            if proof.get(key) is not True:raise ValueError('Require original third reader/Loaded and full held preservation')
        if proof.get('browserUsed') is not False or proof.get('thirdSharedResumeQualified') is not False:
            raise ValueError('Third recipient proof scope differs')
        code="""import{inspectSavedRevisitTarget}from'./scripts/inspect-native-coop-saved-revisit-target.mjs';
const p=await inspectSavedRevisitTarget(process.argv[1],process.argv[2]);console.log(JSON.stringify({reportSha256:p.reportSha256,
 descriptorSha256:p.descriptorSha256,capturedRecipientThirdRequests:p.capturedRecipientThirdRequests,
 targetFullSnapshot:p.targetFullSnapshot,verifierInputs:p.verifierInputs}));"""
        result=subprocess.run(['node','--max-old-space-size=96','--input-type=module','-e',code,proof['report'],proof['baselineProof']],
                              cwd=ROOT,capture_output=True,text=True,timeout=120)
        if result.returncode or len(result.stdout)>32768:raise ValueError('Independent full third recipient inspection refused')
        checked=json.loads(result.stdout)
        if any(proof[k]!=checked[k]for k in checked):raise ValueError('Third recipient proof differs from independent inspection')
        report_raw=bounded_read(proof['report'],2*1024*1024);report=json.loads(report_raw)
        if digest(report_raw)!=proof['reportSha256'] or report['nativeExecutableSha256']!=executable:
            raise ValueError('Third recipient report/executable custody differs')
        self.rows=proof['capturedRecipientThirdRequests'];self.descriptor_sha=proof['descriptorSha256']
        self.source_inputs=[(self.path,raw),(Path(proof['report']),report_raw)];self.bodies=[]
        if len(self.rows)!=2:raise ValueError('Require exactly third recipient Ready/Loaded')
        for action,row in zip((2,3),self.rows):
            wire=bounded_read(row['copy'],2048)
            if (len(wire)<33 or len(wire)!=row['bytes'] or digest(wire)!=row['sha256'] or
                (row['sender'],row['host'],row['op'],row['action'])!=(2,False,12,action) or
                struct.unpack_from('<7I',wire)!=(0x31525044,1,12,row['request'],0,action,3) or
                len(wire)!=32+struct.unpack_from('<I',wire,28)[0] or digest(wire[32:])!=self.descriptor_sha):
                raise ValueError('Third recipient vote framing/custody differs')
            self.bodies.append(wire[20:]);self.source_inputs.append((Path(row['copy']),wire))
        host=proof['host'];host_raw=bounded_read(host['report'],2*1024*1024)
        if digest(host_raw)!=host['reportSha256']:raise ValueError('Third source host report custody differs')
        self.source_inputs.append((Path(host['report']),host_raw))
        self.source_rows=[host['current'],host['currentMarker']]
        for row in self.source_rows:
            data=bounded_read(row['path'],2*1024*1024)
            if len(data)!=row['bytes'] or digest(data)!=row['sha256']:raise ValueError('Recorded third source/marker changed')
            self.source_inputs.append((Path(row['path']),data))
        marker=bounded_read(self.source_rows[1]['path'],768).decode('ascii').splitlines()
        fields=self.bodies[0][12:].decode('ascii').splitlines()
        if len(fields)!=22 or len(marker)!=12 or marker[1] not in ('0','1'):
            raise ValueError('Third source selected marker framing differs')
        expected=['majesty-coop-checkpoint-v1',marker[1],fields[1],fields[8],fields[9],
                  '0','0','22','1650','2',str(self.source_rows[0]['bytes']),self.source_rows[0]['sha256']]
        if marker!=expected:
            raise ValueError('Third source selected marker identity differs')
        self.sent_ready=self.sent_loaded=False;self.frozen_inputs=[]

    def preserve(self,directory):
        for i,(source,data) in enumerate(self.source_inputs):
            path=directory/f'revisit-recipient-source-{i:03}-{source.name}'
            with path.open('xb')as stream:stream.write(data)
            self.frozen_inputs.append(dict(source=str(source),copy=str(path),bytes=len(data),sha256=digest(data)))
        self.verify_preserved()

    def preserve_source(self,profile):
        folder=profile/'captured-travel-source-3';folder.mkdir()
        marker=bounded_read(self.source_rows[1]['path'],768);fields=marker.decode('ascii').splitlines()
        if len(fields)!=12 or fields[0]!='majesty-coop-checkpoint-v1' or fields[1] not in ('0','1'):
            raise ValueError('Third source selected marker differs')
        result=[]
        for row,name in zip(self.source_rows,('source_'+fields[1]+'.GMP','source.checkpoint')):
            data=bounded_read(row['path'],2*1024*1024)
            if len(data)!=row['bytes'] or digest(data)!=row['sha256']:raise ValueError('Third source changed before staging')
            path=folder/name
            with path.open('xb')as stream:stream.write(data)
            result.append(dict(source=row['path'],copy=str(path),bytes=len(data),sha256=digest(data)))
        return result

    def host_actions(self,report):
        actions=[]
        for row in report.get('proposalProtocolRequests',[]):
            if (row['sender'],row['host'],row['op'])!=(1,True,12)or row['action']==0:continue
            wire=bounded_read(row['copy'],2048)
            if len(wire)!=row['bytes']or digest(wire)!=row['sha256']:raise ValueError('Actual third host vote custody differs')
            if len(wire)<28:raise ValueError('Actual host vote is truncated')
            if struct.unpack_from('<I',wire,24)[0]!=3:continue
            if len(wire)<33 or struct.unpack_from('<7I',wire)!=(0x31525044,1,12,row['request'],0,row['action'],3) or not 1<=struct.unpack_from('<I',wire,28)[0]<=1024 or len(wire)!=32+struct.unpack_from('<I',wire,28)[0]or digest(wire[32:])!=self.descriptor_sha:
                raise ValueError('Actual host third descriptor differs from recorded recipient')
            actions.append(row['action'])
        return actions

    async def send_pending(self,relay,rpc,report):
        events=report.get('observedRevisitEvents',[])
        if not events:return
        if events[0]['descriptorSha256']!=self.descriptor_sha:raise ValueError('Third host proposal differs')
        actions=self.host_actions(report)
        if not self.sent_ready and actions==[1,2]:
            self.sent_ready=True
            if await rpc(relay.BARRIER,self.bodies[0])!=b'':raise ValueError('Captured third recipient Ready refused')
            report['referenceReplayedThirdRecipientReadyVotes']=1
        if self.sent_ready and not self.sent_loaded and actions==[1,2,3]:
            log=Path(report['profile']).parent/'native.log'
            if not log.is_file()or log.is_symlink():return
            text=bounded_read(log,4*1024*1024)
            markers=[b'[coop-load] Saved source teardown epoch=1 serial=3 pause-held=1 loaded=1\n',
                     b'[coop-load] Held epoch=1 serial=3 slot=0 clock=1550\n',
                     b'[coop-load] Loaded epoch=1 serial=3 slot=0\n']
            if any(marker not in text for marker in markers):return
            target=Path(report['profile'])/'Documents/My Games/MajestyHD/SaveGame/Coop_World_Travel_Target_3.GMP'
            full=b'[coop-travel-target-fixture] Snapshot epoch=1 serial=3 local=1 slot=0 region=1_0 saved=1 frame=0 clock=1550 original-writer=1 source-retained=1 coordinator-loaded=1 peer-loaded=0 resume-controls=0 live-second-engine=0 '
            if full not in text or not target.is_file()or target.is_symlink():return
            if not 0<target.stat().st_size<=2*1024*1024:raise ValueError('Third host full writer exceeds bound')
            self.sent_loaded=True
            if await rpc(relay.BARRIER,self.bodies[1])!=b'':raise ValueError('Captured third recipient Loaded refused')
            report['referenceReplayedThirdRecipientLoadedVotes']=1

    def preserve_event(self,relay,body,packets,report):
        reader=relay.Reader(body);serial,stage=reader.u32(),reader.u32();descriptor=reader.string(relay.BARRIER_DESCRIPTOR_BYTES)
        count=reader.u32();players=[reader.u32()for _ in range(count)]if count<=4 else [];reader.done()
        rows=report.setdefault('observedRevisitEvents',[])
        if (serial!=3 or stage!=len(rows)+1 or len(rows)>=3 or len(body)>2048 or players!=[1,2] or
            digest(descriptor)!=self.descriptor_sha or [r['stage']for r in report.get('observedSavedReturnEvents',[])]!=[1,2,3] or
            (stage>=2 and not self.sent_ready)or(stage==3 and not self.sent_loaded)):
            raise ValueError('Third host event differs from actual votes/order')
        path=packets/f'revisit-{len(rows):03}.bin'
        with path.open('xb')as stream:stream.write(body)
        rows.append(dict(copy=str(path),bytes=len(body),sha256=digest(body),serial=serial,stage=stage,players=players,descriptorSha256=digest(descriptor)))
