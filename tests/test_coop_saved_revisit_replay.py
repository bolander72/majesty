"""Third travel gates and exact real checkpoint protocol sequencing."""
import asyncio
import hashlib
from pathlib import Path
from types import SimpleNamespace
import pytest
from scripts.lib.native_coop_saved_revisit_replay import CapturedSavedRevisit
from scripts.lib.native_coop_saved_return_replay import SavedReturnCheckpointSender
from tests.test_coop_completion_replay import relay
from tests.test_coop_saved_return_replay import notice


def test_third_sender_requires_its_own_request_and_ack_sequence():
    p=SavedReturnCheckpointSender(b'actual neighbor',serial=3)
    with pytest.raises(ValueError): p.receive(relay,notice(0))
    assert p.receive(relay,notice(0,serial=3))==relay.put(1,3,2,15)
    assert p.receive(relay,notice(3,0,serial=3))==relay.put(2,3,2,1,15)+b'actual neighbor'
    with pytest.raises(ValueError):p.receive(relay,notice(5,1,serial=3))
    assert p.receive(relay,notice(3,1,serial=3))==relay.put(4,3,2,2)
    assert p.receive(relay,notice(5,2,serial=3)) is None
    assert p.completed


@pytest.mark.parametrize('serial',[0,1,4])
def test_sender_excludes_unqualified_serials(serial):
    with pytest.raises(ValueError):SavedReturnCheckpointSender(b'save',serial=serial)


@pytest.mark.parametrize('case',['no-resume','no-pause','valid','unknown'])
def test_third_begin_waits_for_actual_resume_and_new_home_packets(tmp_path,monkeypatch,case):
    p=CapturedSavedRevisit.__new__(CapturedSavedRevisit)
    p.sent_begin=p.sent_ready=False;p.transfer=SimpleNamespace(completed=False)
    p.begin_body=b'unchanged third Begin'
    report=dict(profile=str(tmp_path/'owned-profile'),capturedOriginalSecondHostResumeDelivered=True)
    log=tmp_path/'native.log'
    text='[coop-load] Resumed epoch=1 serial=2 region=0_0\n[smoke] peek 0071c6a8+4:\n    0071c6a8  72 06 00 00\n'
    if case=='no-resume':text=text.split('\n',1)[1]
    if case=='no-pause':text=text.split('\n',1)[0]+'\n'
    log.write_text(text)
    report['savedRevisitRecipientInputStart']=0;report['lobbyPacketMetadata']=[]
    if case!='no-pause':
        for i in range(7):
            data=relay.put(256,5)+bytes(x^49 for x in relay.put(10+2*i,0,50))
            path=tmp_path/f'input-{i}.bin';path.write_bytes(data)
            report['lobbyPacketMetadata'].append(dict(copy=str(path),bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),sender=2,recipient=1))
    monkeypatch.setattr('scripts.lib.native_coop_saved_revisit_replay.bounded_read',lambda path,cap:Path(path).read_bytes())
    parent=SimpleNamespace(return_completion=SimpleNamespace(sent_resume=True));calls=[]
    async def rpc(*args):
        calls.append(args)
        if case=='unknown':raise TimeoutError()
        return b''
    if case=='unknown':
        with pytest.raises(TimeoutError):asyncio.run(p.send_pending(relay,rpc,report,parent))
    else:asyncio.run(p.send_pending(relay,rpc,report,parent))
    asyncio.run(p.send_pending(relay,rpc,report,parent))
    assert calls==([(12,p.begin_body)] if case in ('valid','unknown') else [])


@pytest.mark.parametrize('case',['valid','no-ready','incomplete','wrong-descriptor','duplicate','unknown'])
def test_third_ready_waits_for_full_transfer_and_actual_recipient_vote(tmp_path,monkeypatch,case):
    descriptor=b'actual third descriptor';wire=relay.put(0x31525044,1,12,51,0,2,3,len(descriptor))+descriptor
    path=tmp_path/'third-ready.bin';path.write_bytes(wire)
    monkeypatch.setattr('scripts.lib.native_coop_saved_revisit_replay.bounded_read',lambda path,cap:Path(path).read_bytes())
    row=dict(sender=2,host=False,op=12,action=2,copy=str(path),bytes=len(wire),sha256=hashlib.sha256(wire).hexdigest())
    p=CapturedSavedRevisit.__new__(CapturedSavedRevisit);p.sent_begin=True;p.sent_ready=False
    p.transfer=SimpleNamespace(completed=case!='incomplete');p.ready_body=b'actual host Ready'
    p.descriptor_sha=hashlib.sha256(descriptor if case!='wrong-descriptor' else b'other').hexdigest()
    report=dict(proposalProtocolRequests=[] if case=='no-ready' else [row,row] if case=='duplicate' else [row]);calls=[]
    async def rpc(*args):
        calls.append(args)
        if case=='unknown':raise TimeoutError()
        return b''
    if case in ('wrong-descriptor','duplicate','unknown'):
        with pytest.raises(TimeoutError if case=='unknown' else ValueError):asyncio.run(p.send_pending(relay,rpc,report,None))
        if case=='unknown':asyncio.run(p.send_pending(relay,rpc,report,None));assert len(calls)==1
        else:assert not calls
    else:
        asyncio.run(p.send_pending(relay,rpc,report,None));asyncio.run(p.send_pending(relay,rpc,report,None))
        assert len(calls)==(1 if case=='valid' else 0)


@pytest.mark.parametrize('case',['valid','wrong-serial','wrong-party','wrong-descriptor','commit-before-ready','complete','duplicate'])
def test_third_barrier_events_bind_the_actual_descriptor_and_party(tmp_path,case):
    descriptor=b'actual third descriptor'
    p=CapturedSavedRevisit.__new__(CapturedSavedRevisit);p.sent_begin=True;p.sent_ready=False
    p.descriptor_sha=hashlib.sha256(descriptor).hexdigest();report={}
    serial=2 if case=='wrong-serial' else 3
    stage=2 if case=='commit-before-ready' else 3 if case=='complete' else 1
    party=[1,3] if case=='wrong-party' else [1,2]
    wire=relay.put(serial,stage)+relay.string(b'other' if case=='wrong-descriptor' else descriptor)+relay.put(2,*party)
    if case=='duplicate':p.preserve_event(relay,wire,tmp_path,report)
    if case!='valid':
        with pytest.raises(ValueError):p.preserve_event(relay,wire,tmp_path,report)
    else:
        p.preserve_event(relay,wire,tmp_path,report);p.sent_ready=True
        commit=relay.put(3,2)+relay.string(descriptor)+relay.put(2,1,2)
        p.preserve_event(relay,commit,tmp_path,report)
        assert [r['stage']for r in report['observedSavedRevisitEvents']]==[1,2]


def test_third_checkpoint_delivery_cannot_precede_begin(tmp_path):
    p=CapturedSavedRevisit.__new__(CapturedSavedRevisit);p.sent_begin=False
    async def rpc(*args):raise AssertionError('must not send')
    with pytest.raises(ValueError):asyncio.run(p.checkpoint_event(relay,notice(0,serial=3),rpc,tmp_path,{}))
