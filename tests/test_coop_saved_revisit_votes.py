"""Third barrier cannot complete before original held state exists."""
import asyncio
import hashlib
from pathlib import Path
import pytest
from scripts.lib.native_coop_saved_revisit_votes import CapturedSavedRevisitRecipientVotes
from tests.test_coop_completion_replay import relay


def votes():
    p=CapturedSavedRevisitRecipientVotes.__new__(CapturedSavedRevisitRecipientVotes)
    p.descriptor_sha=hashlib.sha256(b'actual third descriptor').hexdigest()
    p.sent_ready=p.sent_loaded=False
    p.bodies=[b'actual captured third Ready',b'actual captured third Loaded']
    return p


@pytest.mark.parametrize('case',[
    'valid','no-proposal','different-proposal','no-host-ready','no-host-loaded',
    'missing-reader','missing-file','missing-full-marker','wrong-clock',
    'symlink-file','unknown-ready','unknown-loaded','oversize-file'])
def test_third_votes_wait_for_actual_reader_and_full_writer(tmp_path,case,monkeypatch):
    p=votes();report=dict(profile=str(tmp_path/'owned-profile'),
                         observedRevisitEvents=[dict(descriptorSha256=p.descriptor_sha)])
    actions=[1,2];monkeypatch.setattr(p,'host_actions',lambda _:actions[:])
    monkeypatch.setattr('scripts.lib.native_coop_saved_revisit_votes.bounded_read',
                        lambda name,cap:Path(name).read_bytes())
    if case=='no-proposal':report['observedRevisitEvents']=[]
    if case=='different-proposal':report['observedRevisitEvents'][0]['descriptorSha256']='changed'
    if case=='no-host-ready':actions.pop()
    calls=[]
    async def rpc(op,body):
        calls.append((op,body))
        if (case=='unknown-ready' and body==p.bodies[0])or(case=='unknown-loaded' and body==p.bodies[1]):
            raise TimeoutError('RPC outcome unknown')
        return b''
    if case in ('different-proposal','unknown-ready'):
        with pytest.raises(ValueError if case=='different-proposal' else TimeoutError):
            asyncio.run(p.send_pending(relay,rpc,report))
        if case=='unknown-ready':asyncio.run(p.send_pending(relay,rpc,report))
        assert len(calls)==(0 if case=='different-proposal' else 1);return
    asyncio.run(p.send_pending(relay,rpc,report))
    if case in ('no-proposal','no-host-ready'):
        assert not calls;return
    assert calls==[(12,p.bodies[0])]
    log=('[coop-load] Saved source teardown epoch=1 serial=3 pause-held=1 loaded=1\n'
         '[coop-load] Held epoch=1 serial=3 slot=0 clock=1550\n'
         '[coop-load] Loaded epoch=1 serial=3 slot=0\n')
    marker=('[coop-travel-target-fixture] Snapshot epoch=1 serial=3 local=1 slot=0 region=1_0 '
            'saved=1 frame=0 clock=1550 original-writer=1 source-retained=1 coordinator-loaded=1 '
            'peer-loaded=0 resume-controls=0 live-second-engine=0 heap-bytes=123 blocks=4\n')
    if case=='missing-reader':log='unfinished reader\n'
    if case!='missing-full-marker':log+=marker
    if case=='wrong-clock':log=log.replace('clock=1550','clock=1500')
    (tmp_path/'native.log').write_text(log)
    target=Path(report['profile'])/'Documents/My Games/MajestyHD/SaveGame/Coop_World_Travel_Target_3.GMP'
    target.parent.mkdir(parents=True)
    if case=='symlink-file':
        other=tmp_path/'other.GMP';other.write_bytes(b'original');target.symlink_to(other)
    elif case!='missing-file':target.write_bytes(b'x'*(2*1024*1024+1) if case=='oversize-file' else b'original full world')
    if case!='no-host-loaded':actions.append(3)
    if case in ('unknown-loaded','oversize-file'):
        with pytest.raises(TimeoutError if case=='unknown-loaded' else ValueError):
            asyncio.run(p.send_pending(relay,rpc,report))
        if case=='oversize-file':assert len(calls)==1;return
    asyncio.run(p.send_pending(relay,rpc,report));asyncio.run(p.send_pending(relay,rpc,report))
    admitted=case in ('valid','unknown-loaded')
    assert len(calls)==(2 if admitted else 1)
    assert p.sent_loaded==admitted


@pytest.mark.parametrize('case',['valid','missing-second-complete','premature-commit',
                               'premature-complete','changed-descriptor','wrong-party','duplicate'])
def test_third_events_require_actual_votes_and_previous_complete(tmp_path,case):
    p=votes();report=dict(observedSavedReturnEvents=[dict(stage=s)for s in (1,2,3)])
    def event(stage,descriptor=b'actual third descriptor',players=(1,2)):
        return relay.put(3,stage)+relay.string(descriptor)+relay.put(len(players),*players)
    if case=='missing-second-complete':report['observedSavedReturnEvents'].pop()
    if case in ('missing-second-complete','wrong-party'):
        with pytest.raises(ValueError):p.preserve_event(relay,event(1,players=(1,3)if case=='wrong-party'else(1,2)),tmp_path,report)
        return
    p.preserve_event(relay,event(1),tmp_path,report)
    if case in ('duplicate','changed-descriptor','premature-commit'):
        body=event(1)if case=='duplicate'else event(2,b'changed'if case=='changed-descriptor'else b'actual third descriptor')
        with pytest.raises(ValueError):p.preserve_event(relay,body,tmp_path,report)
        return
    p.sent_ready=True;p.preserve_event(relay,event(2),tmp_path,report)
    if case=='premature-complete':
        with pytest.raises(ValueError):p.preserve_event(relay,event(3),tmp_path,report)
        return
    p.sent_loaded=True;p.preserve_event(relay,event(3),tmp_path,report)
    assert [r['stage']for r in report['observedRevisitEvents']]==[1,2,3]
    assert (tmp_path/'revisit-002.bin').read_bytes()==event(3)


def test_third_input_preservation_does_not_collide_with_second(tmp_path,monkeypatch):
    p=votes();p.source_inputs=[(Path('source.json'),b'unchanged source')];p.frozen_inputs=[]
    second=tmp_path/'return-recipient-source-000-source.json';second.write_bytes(b'second source')
    monkeypatch.setattr('scripts.lib.native_coop_saved_return_votes.bounded_read',lambda name,cap:Path(name).read_bytes())
    p.preserve(tmp_path)
    assert second.read_bytes()==b'second source'
    assert Path(p.frozen_inputs[0]['copy']).read_bytes()==b'unchanged source'
    Path(p.frozen_inputs[0]['copy']).write_bytes(b'changed')
    with pytest.raises(ValueError):p.verify_preserved()
