"""Actual third Loaded precedes real Complete, which precedes original resume."""
import asyncio
import hashlib
from pathlib import Path
from types import SimpleNamespace
import pytest
from scripts.lib.native_coop_saved_revisit_resume import CapturedSavedRevisitResume
from scripts.lib.native_coop_saved_revisit_replay import CapturedSavedRevisit
from tests.test_coop_completion_replay import relay


@pytest.mark.parametrize('case',['valid','transfer-incomplete','no-ready','no-commit',
                               'no-loaded','no-writer','changed-descriptor','duplicate','unknown-outcome'])
def test_third_host_loaded_waits_for_actual_recipient_full_writer(tmp_path,monkeypatch,case):
    descriptor=b'actual third saved neighbor';wire=relay.put(0x31525044,1,12,91,0,3,3,len(descriptor))+descriptor
    path=tmp_path/'recipient-loaded.bin';path.write_bytes(wire)
    profile=tmp_path/'owned-profile';target=profile/'Documents/My Games/MajestyHD/SaveGame/Coop_World_Travel_Target_3.GMP'
    target.parent.mkdir(parents=True);target.write_bytes(b'original third full world')
    trace=('[coop-load] Held epoch=1 serial=3 slot=1 clock=1550\n[coop-load] Loaded epoch=1 serial=3 slot=1\n'
           '[coop-travel-target-fixture] Snapshot epoch=1 serial=3 local=2 slot=1 region=1_0 saved=1 frame=0 clock=1550 '
           'original-writer=1 source-retained=1 coordinator-loaded=1 peer-loaded=0 resume-controls=0 live-second-engine=0 heap-bytes=123 blocks=4\n')
    (tmp_path/'native.log').write_text(trace if case!='no-writer'else'unfinished full writer\n')
    monkeypatch.setattr('scripts.lib.native_coop_saved_revisit_resume.bounded_read',lambda name,cap:Path(name).read_bytes())
    p=CapturedSavedRevisitResume.__new__(CapturedSavedRevisitResume);p.sent_loaded=p.sent_resume=False
    p.descriptor_sha=hashlib.sha256(descriptor if case!='changed-descriptor'else b'changed').hexdigest()
    p.loaded_body=b'actual captured host third Loaded';p.loaded_row=dict(copy='actual-host-loaded')
    row=dict(sender=2,host=False,op=12,action=3,copy=str(path),bytes=len(wire),sha256=hashlib.sha256(wire).hexdigest())
    report=dict(profile=str(profile),observedSavedRevisitEvents=[dict(stage=1),dict(stage=2)],
                proposalProtocolRequests=[]if case=='no-loaded'else[row,row]if case=='duplicate'else[row])
    if case=='no-commit':report['observedSavedRevisitEvents'].pop()
    revisit=SimpleNamespace(sent_ready=case!='no-ready',transfer=SimpleNamespace(completed=case!='transfer-incomplete'))
    calls=[]
    async def rpc(op,body):
        calls.append((op,body))
        if case=='unknown-outcome':raise TimeoutError('unknown Loaded outcome')
        return b''
    if case in ('changed-descriptor','duplicate','unknown-outcome'):
        with pytest.raises(TimeoutError if case=='unknown-outcome'else ValueError):
            asyncio.run(p.send_pending(relay,rpc,report,revisit))
        if case!='unknown-outcome':assert not calls;return
    asyncio.run(p.send_pending(relay,rpc,report,revisit));asyncio.run(p.send_pending(relay,rpc,report,revisit))
    assert len(calls)==(1 if case in ('valid','unknown-outcome')else 0)
    assert p.sent_loaded==(case in ('valid','unknown-outcome'))


@pytest.mark.parametrize('loaded,stages,expected',[(False,[1,2,3],False),(True,[1,2],False),(True,[1,2,3],True)])
def test_third_resume_requires_real_complete_and_is_delivered_once(loaded,stages,expected):
    p=CapturedSavedRevisitResume.__new__(CapturedSavedRevisitResume)
    p.sent_loaded=loaded;p.sent_resume=False;p.resume=b'actual captured third original resume'
    report=dict(observedSavedRevisitEvents=[dict(stage=s)for s in stages])
    assert p.resume_packets(report)==([p.resume]if expected else[])
    assert not p.resume_packets(report)


@pytest.mark.parametrize('completion,loaded,accepted',[(False,False,False),(True,False,False),(True,True,True)])
def test_third_complete_requires_explicit_completion_scope_and_loaded(tmp_path,completion,loaded,accepted):
    p=CapturedSavedRevisit.__new__(CapturedSavedRevisit);p.sent_begin=p.sent_ready=True
    p.descriptor_sha=hashlib.sha256(b'descriptor').hexdigest()
    if completion:p.completion=SimpleNamespace(sent_loaded=loaded)
    report={}
    def event(stage):return relay.put(3,stage)+relay.string(b'descriptor')+relay.put(2,1,2)
    p.preserve_event(relay,event(1),tmp_path,report);p.preserve_event(relay,event(2),tmp_path,report)
    if accepted:
        p.preserve_event(relay,event(3),tmp_path,report)
        assert [r['stage']for r in report['observedSavedRevisitEvents']]==[1,2,3]
    else:
        with pytest.raises(ValueError):p.preserve_event(relay,event(3),tmp_path,report)
