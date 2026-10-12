"""Synthetic observer custody/refusal tests; no world/load qualification."""
import asyncio
import hashlib
import importlib.util
from pathlib import Path
import sys
from types import SimpleNamespace

import pytest
from scripts.lib.native_coop_proposal_observer import enable_proposal_observer, preserve_proposal_event, ProposalObservedSocket

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('proposal_observer_test_relay', ROOT / 'scripts/room_relay.py')
relay = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = relay
spec.loader.exec_module(relay)


def event(stage=1, serial=1, players=(1, 2), descriptor=b'bounded synthetic descriptor'):
    return relay.put(serial, stage) + relay.string(descriptor) + relay.put(len(players), *players)


def report():
    return dict(referenceProposalObserverEnabled=True, observedProposalEvents=[])


def test_observer_only_enables_lanes_and_never_votes():
    calls = []
    async def rpc(op, body):
        calls.append((op, body))
        return relay.put(1)
    record = dict(nativeBeginFreshNeighborRequested=True)
    asyncio.run(enable_proposal_observer(relay, rpc, record))
    assert calls == [(relay.BARRIER, relay.put(0) + relay.string(relay.BARRIER_CONTRACT)),
                     (relay.CHECKPOINT, relay.put(6, 0) + relay.string(relay.CHECKPOINT_CONTRACT))]
    assert record['referenceProposalReadyVotesSent'] == record['referenceProposalLoadedVotesSent'] == 0


@pytest.mark.parametrize('flag', [None, False, 1, 'true'])
def test_enable_requires_explicit_fixture(flag):
    async def rpc(*_):
        raise AssertionError('Unexpected RPC')
    with pytest.raises(ValueError, match='explicit original-host'):
        asyncio.run(enable_proposal_observer(relay, rpc, dict(nativeBeginFreshNeighborRequested=flag)))


def test_preserve_exact_prepared_and_optional_cancellation(tmp_path):
    record = report()
    for stage in [1, 4]:
        body = event(stage)
        preserve_proposal_event(relay, body, tmp_path, record)
        row = record['observedProposalEvents'][-1]
        assert Path(row['copy']).read_bytes() == body
        assert row['sha256'] == hashlib.sha256(body).hexdigest()
        assert row['players'] == [1, 2] and row['serial'] == 1 and row['stage'] == stage


@pytest.mark.parametrize('body', [event(2), event(3), event(4), event(serial=2),
    event(players=(1,)), event(players=(2, 1)), event(players=(1, 3)),
    event(descriptor=b''), event() + b'X', event()[:-1]])
def test_refuse_commit_complete_wrong_roster_or_corruption(tmp_path, body):
    record = report()
    with pytest.raises(ValueError):
        preserve_proposal_event(relay, body, tmp_path, record)
    assert not record['observedProposalEvents'] and not list(tmp_path.iterdir())


def test_duplicate_prepared_refused_without_overwrite(tmp_path):
    record = report(); body = event()
    preserve_proposal_event(relay, body, tmp_path, record)
    with pytest.raises(ValueError): preserve_proposal_event(relay, body, tmp_path, record)
    assert len(record['observedProposalEvents']) == 1
    assert (tmp_path/'proposal-000.bin').read_bytes() == body


def test_unenabled_or_oversized_observer_refused(tmp_path):
    for record, body in [(dict(referenceProposalObserverEnabled=False), event()), (report(), b'X'*2049)]:
        with pytest.raises(ValueError): preserve_proposal_event(relay, body, tmp_path, record)
    assert not list(tmp_path.iterdir())


def test_socket_observer_preserves_actual_wire_and_forwards_it_unchanged(tmp_path):
    body = relay.put(2, 1) + relay.string(b'original bounded descriptor')
    message = relay.HEADER.pack(relay.MAGIC, 1, relay.BARRIER, 9, 0) + body
    class Socket:
        request = SimpleNamespace(path='/rooms')
        def __aiter__(self): return self
        async def __anext__(self): return message
    service = SimpleNamespace(peers=[])
    record = {}
    observed = ProposalObservedSocket(Socket(), relay, service, tmp_path, record, lambda: None)
    room = SimpleNamespace(host=None)
    peer = SimpleNamespace(socket=observed, player=SimpleNamespace(id=1), room=room)
    room.host = peer; service.peers.append(peer)
    assert asyncio.run(observed.__anext__()) is message
    assert observed.request.path == '/rooms'
    row = record['proposalProtocolRequests'][0]
    assert Path(row['copy']).read_bytes() == message
    assert row['sender'] == 1 and row['host'] is True and row['action'] == 2 and row['request'] == 9


def test_socket_observer_refuses_unregistered_sender(tmp_path):
    class Socket:
        def __aiter__(self): return self
        async def __anext__(self):
            return relay.HEADER.pack(relay.MAGIC, 1, relay.BARRIER, 1, 0) + relay.put(2)
    observed = ProposalObservedSocket(Socket(), relay, SimpleNamespace(peers=[]), tmp_path, {}, lambda: None)
    with pytest.raises(ValueError, match='authenticated player'):
        asyncio.run(observed.__anext__())
    assert not list(tmp_path.iterdir())


@pytest.mark.parametrize('flag,serial,size,accepted',[
    (True,2,16384,True), (False,2,16384,False), (1,2,16384,False),
    (True,1,16384,False), (True,2,16385,False)])
def test_checkpoint_transfer_custody_requires_explicit_saved_serial_and_bound(tmp_path,flag,serial,size,accepted):
    body=relay.put(2,serial,2,1,size)+b'x'*size
    message=relay.HEADER.pack(relay.MAGIC,1,relay.CHECKPOINT,9,0)+body
    class Socket:
        def __aiter__(self):return self
        async def __anext__(self):return message
    service=SimpleNamespace(peers=[]);record=dict(replaySavedReturnHostRequested=flag)
    observed=ProposalObservedSocket(Socket(),relay,service,tmp_path,record,lambda:None)
    room=SimpleNamespace(host=None);peer=SimpleNamespace(socket=observed,player=SimpleNamespace(id=1),room=room)
    room.host=peer;service.peers.append(peer)
    if accepted:
        assert asyncio.run(observed.__anext__()) is message
        row=record['proposalProtocolRequests'][0]
        assert Path(row['copy']).read_bytes()==message and row['sha256']==hashlib.sha256(message).hexdigest()
    else:
        with pytest.raises(ValueError):asyncio.run(observed.__anext__())
        assert not list(tmp_path.iterdir())


@pytest.mark.parametrize('return_flag,revisit_flag,serial,accepted',[
    (True,True,3,True),(True,False,3,False),(True,1,3,False),
    (False,True,3,False),(True,True,1,False),(True,True,4,False)])
def test_third_checkpoint_custody_requires_both_explicit_replay_scopes(tmp_path,return_flag,revisit_flag,serial,accepted):
    body=relay.put(0,serial,1)+relay.string(b'actual bounded descriptor')
    message=relay.HEADER.pack(relay.MAGIC,1,relay.CHECKPOINT,9,0)+body
    class Socket:
        def __aiter__(self):return self
        async def __anext__(self):return message
    service=SimpleNamespace(peers=[])
    record=dict(replaySavedReturnHostRequested=return_flag,replaySavedRevisitHostRequested=revisit_flag)
    observed=ProposalObservedSocket(Socket(),relay,service,tmp_path,record,lambda:None)
    room=SimpleNamespace(host=None);peer=SimpleNamespace(socket=observed,player=SimpleNamespace(id=2),room=room)
    service.peers.append(peer)
    if accepted:
        assert asyncio.run(observed.__anext__()) is message
        row=record['proposalProtocolRequests'][0]
        assert Path(row['copy']).read_bytes()==message and row['sender']==2 and row['host'] is False
    else:
        with pytest.raises(ValueError):asyncio.run(observed.__anext__())
        assert not list(tmp_path.iterdir())


@pytest.mark.parametrize('return_flag,revisit_flag,completion,count,accepted',[
    (True,True,True,128,True),(True,True,True,129,False),
    (True,True,False,128,False),(True,False,True,128,False),
    (False,True,True,64,False),(True,True,1,128,False),
    (True,True,False,127,True)])
def test_third_completion_admits_one_extra_rpc_only_in_all_explicit_scopes(tmp_path,return_flag,revisit_flag,completion,count,accepted):
    descriptor=b'actual third host Loaded'
    message=relay.HEADER.pack(relay.MAGIC,1,relay.BARRIER,91,0)+relay.put(3,3)+relay.string(descriptor)
    class Socket:
        def __aiter__(self):return self
        async def __anext__(self):return message
    service=SimpleNamespace(peers=[])
    record=dict(replaySavedReturnHostRequested=return_flag,replaySavedRevisitHostRequested=revisit_flag,
                replaySavedRevisitCompletionRequested=completion,proposalProtocolRequests=[dict(bytes=1)for _ in range(count)])
    observed=ProposalObservedSocket(Socket(),relay,service,tmp_path,record,lambda:None)
    room=SimpleNamespace(host=None);peer=SimpleNamespace(socket=observed,player=SimpleNamespace(id=1),room=room)
    room.host=peer;service.peers.append(peer)
    if accepted:
        assert asyncio.run(observed.__anext__())is message
        assert len(record['proposalProtocolRequests'])==count+1
        assert Path(record['proposalProtocolRequests'][-1]['copy']).read_bytes()==message
    else:
        with pytest.raises(ValueError):asyncio.run(observed.__anext__())
        assert len(record['proposalProtocolRequests'])==count
