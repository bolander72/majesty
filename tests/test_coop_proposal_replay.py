"""Bounded captured-vote replay/refusal tests; no native or browser launches."""
import asyncio
import hashlib
import importlib.util
from pathlib import Path
import struct
import sys
from types import SimpleNamespace

import pytest

from scripts.lib.native_coop_proposal_replay import proposal_requests, CapturedHostProposal, enable_replay_host, preserve_replay_event

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('proposal_replay_test_relay', ROOT / 'scripts/room_relay.py')
relay = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = relay
spec.loader.exec_module(relay)
sha = lambda b: hashlib.sha256(b).hexdigest()


def requests():
    descriptor = b'synthetic exact bounded descriptor'
    data, rows = {}, []
    for action in (1, 2):
        wire = struct.pack('<8I', 0x31525044, 1, 12, action + 20, 0, action, 1, len(descriptor)) + descriptor
        path = f'captured-{action}'
        data[path] = wire
        rows.append(dict(sender=1, host=True, op=12, action=action, request=action + 20,
                         copy=path, bytes=len(wire), sha256=sha(wire)))
    return descriptor, data, rows


def test_preserve_exact_original_host_bodies_and_omit_connection_request_header():
    descriptor, data, rows = requests()
    bodies = proposal_requests(rows, lambda p, _: data[p], sha(descriptor))
    assert bodies == tuple(data[r['copy']][20:] for r in rows)
    assert [struct.unpack_from('<I', b)[0] for b in bodies] == [1, 2]


@pytest.mark.parametrize('case', ['missing', 'reverse', 'loaded', 'guest', 'hash', 'length', 'request', 'descriptor', 'serial'])
def test_corrupt_or_non_original_votes_refused(case):
    descriptor, data, rows = requests()
    if case == 'missing': rows.pop()
    if case == 'reverse': rows.reverse()
    if case == 'loaded': rows[1]['action'] = 3
    if case == 'guest': rows[1]['sender'] = 2; rows[1]['host'] = False
    if case == 'hash': rows[0]['sha256'] = '0' * 64
    if case == 'length': rows[0]['bytes'] -= 1
    if case == 'request': rows[0]['request'] += 1
    if case == 'descriptor': descriptor += b'changed'
    if case == 'serial':
        wire = bytearray(data[rows[0]['copy']]); struct.pack_into('<I', wire, 24, 2)
        data[rows[0]['copy']] = bytes(wire); rows[0]['sha256'] = sha(wire)
    with pytest.raises(ValueError): proposal_requests(rows, lambda p, _: data[p], sha(descriptor))


def replay():
    descriptor, data, rows = requests()
    p = CapturedHostProposal.__new__(CapturedHostProposal)
    p.rows = rows; p.bodies = proposal_requests(rows, lambda path, _: data[path], sha(descriptor))
    p.descriptor_sha = sha(descriptor); p.sent = False
    return p, descriptor


def record():
    return dict(capturedHostPauseInputWindowDelivered=True, proposalProtocolRequests=[
        dict(sender=2, host=False, op=12, action=0), dict(sender=2, host=False, op=13, action=6)])


def test_require_original_pause_and_actual_guest_both_protocol_enables():
    p, _ = replay()
    m = record(); assert p.can_send(m)
    m['capturedHostPauseInputWindowDelivered'] = False; assert not p.can_send(m)
    m = record(); m['proposalProtocolRequests'].pop(); assert not p.can_send(m)
    m = record(); m['proposalProtocolRequests'][0]['sender'] = 1; assert not p.can_send(m)


def test_exact_once_captured_begin_and_ready_never_loaded():
    p, _ = replay(); m = record(); calls = []
    async def rpc(op, body): calls.append((op, body)); return b''
    asyncio.run(p.send(relay, rpc, m))
    assert calls == [(relay.BARRIER, b) for b in p.bodies]
    assert m['referenceReplayedHostReadyVotes'] == 1 and m['referenceHostLoadedVotesSent'] == 0
    with pytest.raises(ValueError): asyncio.run(p.send(relay, rpc, m))
    assert len(calls) == 2


def test_unknown_rpc_outcome_is_not_retried():
    p, _ = replay(); m = record(); calls = []
    async def rpc(*args): calls.append(args); raise TimeoutError('unknown outcome')
    with pytest.raises(TimeoutError): asyncio.run(p.send(relay, rpc, m))
    with pytest.raises(ValueError): asyncio.run(p.send(relay, rpc, m))
    assert len(calls) == 1


def test_enable_only_negotiates_protocol_contracts():
    calls = []
    async def rpc(op, body): calls.append((op, body)); return relay.put(1)
    m = dict(replayHostProposalRequested=True)
    asyncio.run(enable_replay_host(relay, rpc, m))
    assert calls == [(12, relay.put(0) + relay.string(relay.BARRIER_CONTRACT)),
                     (13, relay.put(6, 0) + relay.string(relay.CHECKPOINT_CONTRACT))]
    assert m['referenceHostLoadedVotesSent'] == m['referenceReplayedHostReadyVotes'] == 0


def test_preserve_prepared_then_commit_only_with_actual_guest_ready(tmp_path):
    p, descriptor = replay(); m = record(); m['observedProposalEvents'] = []
    body = lambda stage: relay.put(1, stage) + relay.string(descriptor) + relay.put(2, 1, 2)
    preserve_replay_event(relay, body(1), tmp_path, m, p)
    with pytest.raises(ValueError, match='actual recipient Ready'):
        preserve_replay_event(relay, body(2), tmp_path, m, p)
    m['proposalProtocolRequests'].append(dict(sender=2, host=False, op=12, action=2))
    preserve_replay_event(relay, body(2), tmp_path, m, p)
    assert [r['stage'] for r in m['observedProposalEvents']] == [1, 2]
    assert (tmp_path/'proposal-001.bin').read_bytes() == body(2)
    with pytest.raises(ValueError): preserve_replay_event(relay, body(3), tmp_path, m, p)
    assert len(list(tmp_path.iterdir())) == 2

from scripts.lib.native_coop_proposal_replay import CapturedGuestVotes, preserve_host_load_event


def guest_votes():
    descriptor, data, rows = requests()
    for action, row in zip((2, 3), rows):
        old = data[row['copy']]
        wire = relay.HEADER.pack(relay.MAGIC, 1, 12, row['request'], 0) + relay.put(action, 1) + relay.string(descriptor)
        data[row['copy']] = wire
        row.update(sender=2, host=False, action=action, bytes=len(wire), sha256=sha(wire))
    p = CapturedGuestVotes.__new__(CapturedGuestVotes)
    p.rows = rows; p.descriptor_sha = sha(descriptor)
    p.bodies = proposal_requests(rows, lambda path, _: data[path], p.descriptor_sha,
                                sender=2, host=False, actions=(2, 3))
    p.sent_ready = p.sent_loaded = False
    return p, descriptor, data


def test_recipient_votes_preserve_exact_captured_bodies():
    p, _, data = guest_votes()
    assert p.bodies == tuple(data[r['copy']][20:] for r in p.rows)
    assert [relay.word(b) for b in p.bodies] == [2, 3]


@pytest.mark.parametrize('field,value', [('sender', 1), ('host', True), ('action', 1), ('sha256', '0'*64)])
def test_recipient_wrong_endpoint_or_action_or_custody_refused(field, value):
    p, _, data = guest_votes();p.rows[0][field] = value
    with pytest.raises(ValueError):
        proposal_requests(p.rows, lambda path, _: data[path], p.descriptor_sha,
                          sender=2, host=False, actions=(2, 3))


def test_recipient_loaded_waits_for_host_full_target_and_actual_loaded(tmp_path):
    p, _, _ = guest_votes(); target = tmp_path/'target.GMP'; calls=[]
    m = dict(observedProposalEvents=[dict(stage=1,descriptorSha256=p.descriptor_sha)], proposalProtocolRequests=[])
    async def rpc(op,body):calls.append((op,body));return b''
    asyncio.run(p.send_pending(relay,rpc,m,target))
    assert calls == [(12,p.bodies[0])] and not p.sent_loaded
    target.write_bytes(b'bounded stopped target')
    m['profile']=str(tmp_path/'owned-profile')
    asyncio.run(p.send_pending(relay,rpc,m,target))
    assert not p.sent_loaded and len(calls)==1
    (tmp_path/'native.log').write_text('[coop-target-fixture] Snapshot epoch=1 serial=1 local=1 slot=0 region=1_0 frame=0 clock=0 original-writer=1 source-retained=1 coordinator-loaded=1 peer-loaded=0 resume-controls=0 live-second-engine=0\n')
    with pytest.raises(ValueError,match='actual host Loaded'):
        asyncio.run(p.send_pending(relay,rpc,m,target))
    assert not p.sent_loaded and len(calls)==1
    m['proposalProtocolRequests']=[dict(sender=1,host=True,op=12,action=3)]
    asyncio.run(p.send_pending(relay,rpc,m,target))
    asyncio.run(p.send_pending(relay,rpc,m,target))
    assert calls == [(12,b) for b in p.bodies] and p.sent_loaded
    assert [r['action'] for r in m['replayedOriginalRecipientVoteBodies']] == [2,3]


def test_recipient_unknown_ready_outcome_is_never_retried(tmp_path):
    p, _, _ = guest_votes();calls=[]
    m=dict(observedProposalEvents=[dict(stage=1,descriptorSha256=p.descriptor_sha)])
    async def rpc(*args):calls.append(args);raise TimeoutError()
    with pytest.raises(TimeoutError):asyncio.run(p.send_pending(relay,rpc,m,tmp_path/'absent'))
    asyncio.run(p.send_pending(relay,rpc,m,tmp_path/'absent'))
    assert len(calls)==1 and p.sent_ready and not p.sent_loaded


def test_host_load_events_require_votes_and_exact_order(tmp_path):
    p, descriptor, _ = guest_votes();m=dict(observedProposalEvents=[])
    body=lambda stage:relay.put(1,stage)+relay.string(descriptor)+relay.put(2,1,2)
    with pytest.raises(ValueError):preserve_host_load_event(relay,body(2),tmp_path,m,p)
    preserve_host_load_event(relay,body(1),tmp_path,m,p)
    with pytest.raises(ValueError):preserve_host_load_event(relay,body(2),tmp_path,m,p)
    p.sent_ready=True;preserve_host_load_event(relay,body(2),tmp_path,m,p)
    with pytest.raises(ValueError):preserve_host_load_event(relay,body(3),tmp_path,m,p)
    p.sent_loaded=True;preserve_host_load_event(relay,body(3),tmp_path,m,p)
    with pytest.raises(ValueError):preserve_host_load_event(relay,body(3),tmp_path,m,p)
    assert [r['stage'] for r in m['observedProposalEvents']]==[1,2,3]


def saved_return_case():
    p, _, _ = guest_votes()
    p.sent_ready = p.sent_loaded = True
    fields = ['majesty-coop-region-v1', 'native-terrain-fixture', '1', '0', '0', '0',
              '71201', '1', 'a'*64+':'+ 'b'*64, 'c'*64, '24', '1200', '1',
              '80000', 'd'*64, '1', '1', '550', '80000', 'e'*64, '1589138072', '1589138072']
    descriptor = ('\n'.join(fields)+'\n').encode()
    m = dict(observeSavedReturnProposalRequested=True, observedProposalEvents=[
        dict(serial=1,stage=stage,descriptorSha256=p.descriptor_sha) for stage in (1,2,3)])
    return p, descriptor, m


def test_saved_return_observes_only_new_prepared_bytes(tmp_path):
    p, descriptor, m = saved_return_case()
    body = relay.put(2,1)+relay.string(descriptor)+relay.put(2,1,2)
    preserve_host_load_event(relay,body,tmp_path,m,p)
    assert [r['stage'] for r in m['observedProposalEvents']] == [1,2,3]
    rows = m['observedSavedReturnEvents']
    assert len(rows)==1 and rows[0]['serial']==2 and rows[0]['sha256']==sha(body)
    assert Path(rows[0]['copy']).read_bytes()==body
    with pytest.raises(ValueError):preserve_host_load_event(relay,body,tmp_path,m,p)
    assert not any(tmp_path.glob('proposal-*.bin'))


@pytest.mark.parametrize('change', ['optin','first-complete','first-digest','first-votes','commit','fresh','direction','players','serial','encoding'])
def test_saved_return_rejects_unqualified_or_unexpected_events(tmp_path, change):
    p, descriptor, m = saved_return_case()
    serial, stage, players = 2, 1, [1,2]
    if change=='optin':m['observeSavedReturnProposalRequested']=False
    elif change=='first-complete':m['observedProposalEvents'].pop()
    elif change=='first-digest':m['observedProposalEvents'][0]['descriptorSha256']='f'*64
    elif change=='first-votes':p.sent_loaded=False
    elif change=='commit':stage=2
    elif change=='fresh':
        fields=descriptor.decode().split('\n');fields[15]='0';descriptor='\n'.join(fields).encode()
    elif change=='direction':
        fields=descriptor.decode().split('\n');fields[4]='2';descriptor='\n'.join(fields).encode()
    elif change=='players':players=[2,1]
    elif change=='serial':serial=3
    elif change=='encoding':descriptor+=b'\xff'
    body=relay.put(serial,stage)+relay.string(descriptor)+relay.put(len(players),*players)
    with pytest.raises(ValueError):preserve_host_load_event(relay,body,tmp_path,m,p)
    assert not list(tmp_path.iterdir())
