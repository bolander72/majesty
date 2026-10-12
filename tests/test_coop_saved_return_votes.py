"""Second votes require real proposal, native load boundary and unchanged bytes."""
import asyncio
import hashlib
from pathlib import Path
from types import SimpleNamespace
import pytest
from scripts.lib.native_coop_saved_return_votes import CapturedSavedReturnRecipientVotes
from tests.test_coop_completion_replay import relay

def votes():
    p=CapturedSavedReturnRecipientVotes.__new__(CapturedSavedReturnRecipientVotes)
    p.descriptor_sha=hashlib.sha256(b'actual descriptor').hexdigest()
    p.sent_ready=p.sent_loaded=False
    p.bodies=[b'actual captured recipient Ready',b'actual captured recipient Loaded']
    p.rows=[dict(action=2,copy='actual-ready'),dict(action=3,copy='actual-loaded')]
    return p

@pytest.mark.parametrize('case',['valid','no-proposal','different-proposal','no-host-ready','no-host-loaded','no-writer','unknown-ready','unknown-loaded','no-return-save','valid-return-save'])
def test_second_votes_require_identical_proposal_and_actual_host_loaded(tmp_path,case,monkeypatch):
    p=votes();m=dict(profile=str(tmp_path/'owned-profile'),observedSavedReturnEvents=[dict(descriptorSha256=p.descriptor_sha)])
    actions=[1,2]
    monkeypatch.setattr(p,'host_actions',lambda report:actions[:])
    if case=='no-proposal':m['observedSavedReturnEvents']=[]
    if case=='different-proposal':m['observedSavedReturnEvents'][0]['descriptorSha256']='wrong'
    if case=='no-host-ready':actions.pop()
    calls=[]
    async def rpc(op,body):
        calls.append((op,body))
        if (case=='unknown-ready' and body==p.bodies[0])or(case=='unknown-loaded' and body==p.bodies[1]):raise TimeoutError()
        return b''
    if case=='different-proposal':
        with pytest.raises(ValueError):asyncio.run(p.send_pending(relay,rpc,m))
        assert not calls;return
    if case=='unknown-ready':
        with pytest.raises(TimeoutError):asyncio.run(p.send_pending(relay,rpc,m))
        asyncio.run(p.send_pending(relay,rpc,m));assert len(calls)==1;return
    asyncio.run(p.send_pending(relay,rpc,m));asyncio.run(p.send_pending(relay,rpc,m))
    if case in ['no-proposal','no-host-ready']:
        assert not calls;return
    assert calls==[(12,p.bodies[0])]
    markers='[coop-load] Saved source teardown epoch=1 serial=2 pause-held=1 loaded=1\n[coop-load] Held epoch=1 serial=2 slot=0 clock=550\n[coop-load] Loaded epoch=1 serial=2 slot=0\n'
    (tmp_path/'native.log').write_text('writer incomplete\n' if case=='no-writer' else markers)
    if case in ['no-return-save','valid-return-save']:
        m['nativeSavedReturnSnapshotRequested']=True
        if case=='valid-return-save':
            target=Path(m['profile'])/'Documents/My Games/MajestyHD/SaveGame/Coop_World_Return_Target.GMP'
            target.parent.mkdir(parents=True);target.write_bytes(b'actual writer result')
            with (tmp_path/'native.log').open('a')as f:f.write('[coop-return-fixture] Snapshot epoch=1 serial=2 local=1 slot=0 region=0_0 frame=0 clock=550 original-writer=1 source-retained=1 coordinator-loaded=1 peer-loaded=0 resume-controls=0 live-second-engine=0\n')
    if case!='no-host-loaded':actions.append(3)
    if case=='unknown-loaded':
        with pytest.raises(TimeoutError):asyncio.run(p.send_pending(relay,rpc,m))
    asyncio.run(p.send_pending(relay,rpc,m));asyncio.run(p.send_pending(relay,rpc,m))
    assert len(calls)==(1 if case in ['no-host-loaded','no-writer','no-return-save'] else 2)
    assert p.sent_loaded==(case not in ['no-host-loaded','no-writer','no-return-save'])

@pytest.mark.parametrize('case',['valid','missing-first-complete','premature-commit','premature-complete','edited-descriptor','duplicate'])
def test_saved_barrier_requires_actual_votes_in_order(tmp_path,case):
    p=votes();descriptor=b'actual descriptor'
    m=dict(observedProposalEvents=[dict(stage=s)for s in [1,2,3]])
    if case=='missing-first-complete':m['observedProposalEvents'].pop()
    def event(stage,data=descriptor):return relay.put(2,stage)+relay.string(data)+relay.put(2,1,2)
    if case=='missing-first-complete':
        with pytest.raises(ValueError):p.preserve_event(relay,event(1),tmp_path,m)
        return
    p.preserve_event(relay,event(1),tmp_path,m)
    if case=='edited-descriptor':
        with pytest.raises(ValueError):p.preserve_event(relay,event(2,b'edited'),tmp_path,m)
        return
    if case=='duplicate':
        with pytest.raises(ValueError):p.preserve_event(relay,event(1),tmp_path,m)
        return
    if case=='premature-commit':
        with pytest.raises(ValueError):p.preserve_event(relay,event(2),tmp_path,m)
        return
    p.sent_ready=True;p.preserve_event(relay,event(2),tmp_path,m)
    if case=='premature-complete':
        with pytest.raises(ValueError):p.preserve_event(relay,event(3),tmp_path,m)
        return
    p.sent_loaded=True;p.preserve_event(relay,event(3),tmp_path,m)
    assert [r['stage']for r in m['observedSavedReturnEvents']]==[1,2,3]
    assert (tmp_path/'saved-return-complete-002.bin').read_bytes()==event(3)

@pytest.mark.parametrize('edited',[False,True])
def test_return_source_preserves_actual_selected_bytes_and_refuses_changes(tmp_path,edited,monkeypatch):
    p=votes();p.source_rows=[]
    for name,data in [('source.GMP',b'original full source'),('source.checkpoint',b'original selected marker')]:
        path=tmp_path/name;path.write_bytes(data)
        p.source_rows.append(dict(path=str(path),bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
    def read_owned(name,cap):
        path=Path(name);assert path in [tmp_path/'source.GMP',tmp_path/'source.checkpoint']
        data=path.read_bytes();assert len(data)<=cap;return data
    monkeypatch.setattr('scripts.lib.native_coop_saved_return_votes.bounded_read',read_owned)
    profile=tmp_path/'owned-profile';profile.mkdir()
    if edited:
        (tmp_path/'source.GMP').write_bytes(b'changed full source')
        with pytest.raises(ValueError):p.preserve_source(profile)
        assert not (profile/'captured-return-source/source_0.GMP').exists()
    else:
        rows=p.preserve_source(profile)
        assert len(rows)==2
        assert (profile/'captured-return-source/source_0.GMP').read_bytes()==b'original full source'
        assert (profile/'captured-return-source/source.checkpoint').read_bytes()==b'original selected marker'
