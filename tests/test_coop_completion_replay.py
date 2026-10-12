"""Original recorded host completion admission; no engines or browser launches."""
import asyncio
import importlib.util
from pathlib import Path
import sys
from types import SimpleNamespace
import pytest
from scripts.lib.native_coop_completion_replay import CapturedHostCompletion
from scripts.lib.native_coop_proposal_replay import preserve_replay_event
from scripts.lib.native_original_inputs import RecordedHostResumeInputs
from tests.test_coop_proposal_replay import replay
from tests.test_original_host_replay import original_resume_window
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('completion_test_relay',ROOT/'scripts/room_relay.py');relay=importlib.util.module_from_spec(spec);sys.modules[spec.name]=relay;spec.loader.exec_module(relay)

def completion():
 p=CapturedHostCompletion.__new__(CapturedHostCompletion);p.sent_loaded=False;p.loaded_body=b'unchanged captured host Loaded';p.loaded_row=dict(copy='original-captured-wire');p.resume=RecordedHostResumeInputs(original_resume_window());return p

def fixture(tmp_path):
 m=dict(profile=str(tmp_path/'owned-profile'),observedProposalEvents=[dict(stage=1),dict(stage=2)],proposalProtocolRequests=[dict(sender=2,host=False,op=12,action=a)for a in (2,3)])
 marker='[coop-target-fixture] Snapshot epoch=1 serial=1 local=2 slot=1 region=1_0 frame=0 clock=0 original-writer=1 source-retained=1 coordinator-loaded=1 peer-loaded=0 resume-controls=0 live-second-engine=0\n'
 (tmp_path/'native.log').write_text(marker);return m

def test_host_loaded_waits_for_actual_recipient_writer_return(tmp_path):
 p=completion();m=fixture(tmp_path);calls=[]
 async def rpc(*args):calls.append(args);return b''
 (tmp_path/'native.log').write_text('writer started\n')
 asyncio.run(p.send_pending(relay,rpc,m));assert not calls and not p.sent_loaded
 m=fixture(tmp_path);asyncio.run(p.send_pending(relay,rpc,m));asyncio.run(p.send_pending(relay,rpc,m))
 assert calls==[(12,p.loaded_body)] and p.sent_loaded and m['referenceHostLoadedVotesSent']==1

@pytest.mark.parametrize('case',['missing-loaded','wrong-player','ready-only','not-committed'])
def test_host_loaded_rejects_missing_recipient_or_commit(tmp_path,case):
 p=completion();m=fixture(tmp_path);calls=[]
 if case=='missing-loaded':m['proposalProtocolRequests'].pop()
 if case=='wrong-player':m['proposalProtocolRequests'][1]['sender']=1
 if case=='ready-only':m['proposalProtocolRequests'][1]['action']=2
 if case=='not-committed':m['observedProposalEvents'].pop()
 async def rpc(*args):calls.append(args);return b''
 with pytest.raises(ValueError):asyncio.run(p.send_pending(relay,rpc,m))
 assert not calls and not p.sent_loaded

def test_unknown_host_loaded_outcome_is_not_retried(tmp_path):
 p=completion();m=fixture(tmp_path);calls=[]
 async def rpc(*args):calls.append(args);raise TimeoutError()
 with pytest.raises(TimeoutError):asyncio.run(p.send_pending(relay,rpc,m))
 asyncio.run(p.send_pending(relay,rpc,m));assert len(calls)==1

def test_original_host_resume_requires_complete_then_delivers_once(tmp_path):
 p=completion();m=fixture(tmp_path)
 with pytest.raises(ValueError):p.original_resume_packets(m)
 p.sent_loaded=True
 with pytest.raises(ValueError):p.original_resume_packets(m)
 m['observedProposalEvents'].append(dict(stage=3))
 assert p.original_resume_packets(m)==original_resume_window() and p.original_resume_packets(m)==[]

def test_complete_event_requires_captured_actual_host_loaded(tmp_path):
 proposal,descriptor=replay();m=dict(observedProposalEvents=[],proposalProtocolRequests=[dict(sender=2,host=False,op=12,action=2)])
 c=completion();body=lambda stage:relay.put(1,stage)+relay.string(descriptor)+relay.put(2,1,2)
 preserve_replay_event(relay,body(1),tmp_path,m,proposal,c);preserve_replay_event(relay,body(2),tmp_path,m,proposal,c)
 with pytest.raises(ValueError):preserve_replay_event(relay,body(3),tmp_path,m,proposal,c)
 c.sent_loaded=True;preserve_replay_event(relay,body(3),tmp_path,m,proposal,c)
 assert [r['stage']for r in m['observedProposalEvents']]==[1,2,3]
 with pytest.raises(ValueError):preserve_replay_event(relay,body(3),tmp_path,m,proposal,c)
