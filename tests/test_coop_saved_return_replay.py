"""Real protocol shape/ordering checks for an owned saved checkpoint sender."""
import asyncio
import hashlib
import struct
from types import SimpleNamespace
from pathlib import Path
import pytest
from scripts.lib.native_coop_saved_return_replay import SavedReturnCheckpointSender, CapturedSavedReturnHostCompletion
from tests.test_coop_completion_replay import relay

FIRST_RESUMED='[coop-load] Resumed epoch=1 serial=1 region=1_0\n'
LATER_SAVED=('[coop-later-progress-fixture] Snapshot epoch=1 serial=1 local=2 slot=1 region=1_0 '
             'frame=20 clock=1000 original-writer=1 complete=1 running=1 source-retained=1 '
             'clock-input-phase-writes=0 live-second-engine=0\n')

def notice(action, sequence=None, *, serial=2, sender=2, recipient=1):
    return relay.put(action,serial,sender,recipient)+ (relay.put(sequence) if sequence is not None else b'')

def test_checkpoint_sender_preserves_exact_chunks_and_acknowledges_finish():
    data=bytes(range(256))*70; sender=SavedReturnCheckpointSender(data)
    assert sender.receive(relay,notice(0))==relay.put(1,2,2,len(data))
    first=sender.receive(relay,notice(3,0)); assert first==relay.put(2,2,2,1,16384)+data[:16384]
    second=sender.receive(relay,notice(3,1)); assert second==relay.put(2,2,2,2,len(data)-16384)+data[16384:]
    assert sender.receive(relay,notice(3,2))==relay.put(4,2,2,3)
    assert not sender.completed
    assert sender.receive(relay,notice(5,3)) is None
    assert sender.completed and sender.offset==len(data)
    with pytest.raises(ValueError):sender.receive(relay,notice(5,3))

@pytest.mark.parametrize('body',[notice(0,serial=1),notice(0,sender=1),notice(0,recipient=2),notice(0)+b'x',notice(3,0),notice(5,0),notice(2)])
def test_checkpoint_sender_requires_real_request_and_exact_party(body):
    sender=SavedReturnCheckpointSender(b'owned bytes')
    with pytest.raises(ValueError):sender.receive(relay,body)
    assert sender.offset==0 and not sender.completed

@pytest.mark.parametrize('case',['duplicate-request','skipped-ack','early-end-ack','repeated-offer-ack'])
def test_checkpoint_sender_refuses_duplicates_and_out_of_order_ack(case):
    sender=SavedReturnCheckpointSender(b'owned bytes');sender.receive(relay,notice(0))
    if case=='duplicate-request':bad=notice(0)
    elif case=='skipped-ack':bad=notice(3,1)
    elif case=='early-end-ack':bad=notice(5,0)
    else:sender.receive(relay,notice(3,0));bad=notice(3,0)
    with pytest.raises(ValueError):sender.receive(relay,bad)

@pytest.mark.parametrize('data',[b'',b'x'*(2*1024*1024+1)])
def test_checkpoint_sender_has_bounded_owned_input(data):
    with pytest.raises(ValueError):SavedReturnCheckpointSender(data)

def test_saved_begin_waits_for_actual_original_first_resume(tmp_path, monkeypatch):
    p=CapturedSavedReturnHostCompletion.__new__(CapturedSavedReturnHostCompletion)
    p.sent_return_begin=False;p.resume=SimpleNamespace(delivered=True)
    p.return_begin_body=b'actual captured Begin';p.return_rows=[dict(copy='owned actual source')]
    async def prior(*args):pass
    monkeypatch.setattr('scripts.lib.native_coop_completion_replay.CapturedHostCompletion.send_pending',prior)
    report=dict(profile=str(tmp_path/'owned-profile'));calls=[]
    async def rpc(*args):calls.append(args);return b''
    (tmp_path/'native.log').write_text('first load still held\n')
    asyncio.run(p.send_pending(relay,rpc,report));assert not calls
    (tmp_path/'native.log').write_text(FIRST_RESUMED)
    asyncio.run(p.send_pending(relay,rpc,report));assert not calls
    (tmp_path/'native.log').write_text(FIRST_RESUMED+LATER_SAVED)
    asyncio.run(p.send_pending(relay,rpc,report));asyncio.run(p.send_pending(relay,rpc,report))
    assert calls==[(12,p.return_begin_body)]
    assert report['referenceSecondHostReadyVotesSent']==report['referenceSecondHostLoadedVotesSent']==0

def test_saved_begin_unknown_outcome_is_not_retried(tmp_path,monkeypatch):
    p=CapturedSavedReturnHostCompletion.__new__(CapturedSavedReturnHostCompletion)
    p.sent_return_begin=False;p.resume=SimpleNamespace(delivered=True);p.return_begin_body=b'actual Begin'
    async def prior(*args):pass
    monkeypatch.setattr('scripts.lib.native_coop_completion_replay.CapturedHostCompletion.send_pending',prior)
    report=dict(profile=str(tmp_path/'owned-profile'));calls=[]
    (tmp_path/'native.log').write_text(FIRST_RESUMED+LATER_SAVED)
    async def rpc(*args):calls.append(args);raise TimeoutError()
    with pytest.raises(TimeoutError):asyncio.run(p.send_pending(relay,rpc,report))
    asyncio.run(p.send_pending(relay,rpc,report));assert len(calls)==1

@pytest.mark.parametrize('case',['valid','transfer-incomplete','no-ready','wrong-descriptor','duplicate','unknown-outcome'])
def test_saved_commit_requires_actual_recipient_ready_and_full_transfer(tmp_path,case,monkeypatch):
    descriptor=b'actual captured descriptor'
    wire=struct.pack('<8I',0x31525044,1,12,99,0,2,2,len(descriptor))+descriptor
    path=tmp_path/'actual-recipient-ready.bin';path.write_bytes(wire)
    def read_owned(name, cap):
        assert name==str(path) and len(wire)<=cap
        return path.read_bytes()
    monkeypatch.setattr('scripts.lib.native_coop_saved_return_replay.bounded_read',read_owned)
    row=dict(sender=2,host=False,op=12,action=2,copy=str(path),bytes=len(wire),sha256=hashlib.sha256(wire).hexdigest())
    p=CapturedSavedReturnHostCompletion.__new__(CapturedSavedReturnHostCompletion)
    p.sent_return_ready=False;p.transfer=SimpleNamespace(completed=case!='transfer-incomplete')
    p.return_descriptor_sha=hashlib.sha256(descriptor if case!='wrong-descriptor' else b'other').hexdigest()
    p.return_ready_body=b'captured unchanged host Ready';p.return_rows=[{},dict(copy='owned-host-ready')]
    report=dict(proposalProtocolRequests=[] if case=='no-ready' else [row,row] if case=='duplicate' else [row]);calls=[]
    async def rpc(*args):
        calls.append(args)
        if case=='unknown-outcome':raise TimeoutError()
        return b''
    if case in ['wrong-descriptor','duplicate','unknown-outcome']:
        with pytest.raises(TimeoutError if case=='unknown-outcome' else ValueError):
            asyncio.run(p.send_return_ready(relay,rpc,report))
        if case=='unknown-outcome':
            asyncio.run(p.send_return_ready(relay,rpc,report));assert len(calls)==1
        else:assert not calls and not p.sent_return_ready
    else:
        asyncio.run(p.send_return_ready(relay,rpc,report));asyncio.run(p.send_return_ready(relay,rpc,report))
        assert len(calls)==(1 if case=='valid' else 0)
        if case=='valid':
            assert report['referenceSecondHostReadyVotesSent']==1
            assert calls==[(12,b'captured unchanged host Ready')]
