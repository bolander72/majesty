"""Admission tests for actual target input replay; synthetic packet fixtures."""
import struct
from types import SimpleNamespace
import pytest
from scripts.lib.native_coop_target_inputs import RecordedTargetGuestInputs,CapturedTargetGuestInputs,RecordedTimedTargetGuestInputs
from scripts.lib.native_coop_target_inputs import select_target_sources

def test_actual_prefix_preserves_the_first_fourteen_source_records():
    frames=list(range(10,22,2))+list(range(10,50,2))
    sources=[(f'actual-{i}',packet(frame))for i,frame in enumerate(frames)]
    selected=select_target_sources(sources,frames,extended=True,prefix=14)
    assert selected==sources[6:20] and [frame for frame in frames[6:20]]==list(range(10,38,2))

@pytest.mark.parametrize('count,prefix,extended',[(13,14,True),(33,14,True),(20,13,True),(20,14,False),(20,0,True)])
def test_actual_prefix_refuses_short_unbounded_or_implicit_selection(count,prefix,extended):
    frames=list(range(10,22,2))+list(range(10,10+count*2,2))
    with pytest.raises(ValueError):select_target_sources(list(frames),frames,extended=extended,prefix=prefix)

def test_actual_prefix_refuses_reordered_source_frames():
    frames=list(range(10,22,2))+list(range(10,50,2));frames[-2],frames[-1]=frames[-1],frames[-2]
    with pytest.raises(ValueError):select_target_sources(list(frames),frames,extended=True,prefix=14)
from tests.test_original_inputs import packet
from tests.test_original_host_replay import original_resume_window

def window():return [packet(n)for n in range(10,30,2)]
def resumed():
    w=RecordedTargetGuestInputs(window());w.observe(1,2,original_resume_window()[0],True);return w

def test_exact_original_window_delivered_once_after_all_admissions():
    w=resumed();w.observe(1,2,packet(10),True)
    assert w.deliver(True,True,True,True)==window();assert w.deliver(True,True,True,True)==[]

def test_paced_delivery_needs_each_actual_matching_host_request():
    w=RecordedTargetGuestInputs(window(),paced=True)
    w.observe(1,2,original_resume_window()[0],True)
    for frame,data in zip(range(10,30,2),window()):
        assert w.deliver(True,True,True,True)==[]
        w.observe(1,2,packet(frame),True)
        assert w.deliver(True,True,True,True)==[data]
        assert w.deliver(True,True,True,True)==[]
    assert w.delivered and w.next_index==10

def test_two_packet_start_then_one_actual_captured_input_per_request():
    w=RecordedTargetGuestInputs(window(),paced=True,lead=2)
    w.observe(1,2,original_resume_window()[0],True);w.observe(1,2,packet(10),True)
    assert w.deliver(True,True,True,True)==window()[:2]
    for request,data in zip(range(12,28,2),window()[2:]):
        assert w.deliver(True,True,True,True)==[]
        w.observe(1,2,packet(request),True)
        assert w.deliver(True,True,True,True)==[data]
    assert w.delivered and w.next_index==10

@pytest.mark.parametrize('lead',[0,3,10])
def test_unbounded_or_invalid_lookahead_refuses(lead):
    with pytest.raises(ValueError):RecordedTargetGuestInputs(window(),paced=True,lead=lead)

def test_extended_actual_window_preserved_with_bounded_lookahead():
    payloads=[packet(frame)for frame in range(10,38,2)]
    w=RecordedTargetGuestInputs(payloads,paced=True,lead=2,extended=True)
    w.observe(1,2,original_resume_window()[0],True);w.observe(1,2,packet(10),True)
    delivered=w.deliver(True,True,True,True)
    for request in range(12,36,2):
        w.observe(1,2,packet(request),True);delivered+=w.deliver(True,True,True,True)
    assert delivered==payloads and w.delivered and w.frames==list(range(10,38,2))

@pytest.mark.parametrize('count',[9,17])
def test_extended_window_outside_observed_bound_refuses(count):
    with pytest.raises(ValueError):RecordedTargetGuestInputs([packet(n)for n in range(10,10+2*count,2)],extended=True)

def test_longer_window_cannot_enter_default_mode():
    with pytest.raises(ValueError):RecordedTargetGuestInputs([packet(n)for n in range(10,38,2)])

def test_timed_actual_stream_advances_without_additional_host_broadcasts():
    now=[0.0];payloads=[packet(n)for n in range(10,38,2)]
    w=RecordedTimedTargetGuestInputs(payloads,extended=True,clock=lambda:now[0])
    assert w.deliver(True,True,True,True)==[]
    w.observe(1,2,original_resume_window()[0],True);w.observe(1,2,packet(10),True)
    delivered=[]
    for i,data in enumerate(payloads):
        now[0]=i*.11
        assert w.deliver(True,True,True,False)==[]
        delivered+=w.deliver(True,True,True,True)
        assert delivered[-1]==data
        assert w.deliver(True,True,True,True)==[]
    assert delivered==payloads and w.delivered

def test_timed_stream_cannot_burst_before_captured_frame_cadence():
    now=[0.0];w=RecordedTimedTargetGuestInputs(window(),clock=lambda:now[0])
    w.observe(1,2,original_resume_window()[0],True);w.observe(1,2,packet(10),True)
    assert w.deliver(True,True,True,True)==[packet(10)]
    now[0]=.099;assert w.deliver(True,True,True,True)==[]and w.next_index==1
    now[0]=.1;assert w.deliver(True,True,True,True)==[packet(12)]

@pytest.mark.parametrize('frame',[10,14,28])
def test_paced_delivery_refuses_repeated_or_skipped_request(frame):
    w=RecordedTargetGuestInputs(window(),paced=True)
    w.observe(1,2,original_resume_window()[0],True)
    w.observe(1,2,packet(10),True);assert w.deliver(True,True,True,True)==[packet(10)]
    with pytest.raises(ValueError):w.observe(1,2,packet(frame),True)
    assert w.next_index==1 and not w.pending

def test_paced_delivery_does_not_consume_a_request_before_actual_resume_return():
    w=RecordedTargetGuestInputs(window(),paced=True)
    w.observe(1,2,original_resume_window()[0],True);w.observe(1,2,packet(10),True)
    assert w.deliver(True,True,True,False)==[]and w.next_index==0
    assert w.deliver(True,True,True,True)==[packet(10)]

@pytest.mark.parametrize('index',range(4))
def test_waits_without_consuming_missing_admission(index):
    w=resumed();w.observe(1,2,packet(10),True);admissions=[True]*4;admissions[index]=False
    assert w.deliver(*admissions)==[]and not w.delivered
    assert w.deliver(True,True,True,True)==window()

def test_source_packets_do_not_authorize_target_inputs():
    w=RecordedTargetGuestInputs(window())
    for n in range(10,22,2):w.observe(1,2,packet(n),False)
    assert not w.pending and w.deliver(True,True,True,True)==[]

@pytest.mark.parametrize('case',['missing','extra','reordered','repeated','command','timing'])
def test_rejects_altered_captured_target_window(case):
    values=window()
    if case=='missing':values.pop()
    if case=='extra':values.append(packet(30))
    if case=='reordered':values[0],values[1]=values[1],values[0]
    if case=='repeated':values[1]=values[0]
    if case=='command':values[0]=packet(10,count=1)
    if case=='timing':values[0]=packet(10,timing=51)
    with pytest.raises(ValueError):RecordedTargetGuestInputs(values)

@pytest.mark.parametrize('endpoints',[(2,1),(1,3),(3,2)])
def test_wrong_request_endpoint_refuses(endpoints):
    w=RecordedTargetGuestInputs(window())
    with pytest.raises(ValueError):w.observe(*endpoints,packet(10),True)

@pytest.mark.parametrize('complete',[False,1,None])
def test_resume_requires_actual_boolean_complete(complete):
    w=RecordedTargetGuestInputs(window())
    with pytest.raises(ValueError):w.observe(1,2,original_resume_window()[0],complete)
    assert not w.resume_seen

def test_repeated_resume_refuses():
    w=resumed()
    with pytest.raises(ValueError):w.observe(1,2,original_resume_window()[0],True)

def test_completed_window_retires_before_next_region_resume():
    w=resumed();w.observe(1,2,packet(10),True)
    assert w.deliver(True,True,True,True)==window()
    first_resume=w.resume_sha256
    w.observe(1,2,original_resume_window()[0],True)
    assert w.resume_sha256==first_resume and w.delivered
    assert w.deliver(True,True,True,True)==[]
    with pytest.raises(ValueError):w.observe(2,1,original_resume_window()[0],True)

def test_altered_resume_command_refuses():
    w=RecordedTargetGuestInputs(window());data=bytearray(original_resume_window()[0]);data[36]^=1
    with pytest.raises(ValueError):w.observe(1,2,data,True)

def test_wrong_first_target_request_refuses():
    w=resumed()
    with pytest.raises(ValueError):w.observe(1,2,packet(12),True)
    assert not w.pending

def test_original_resumed_marker_and_writer_return_are_both_required(tmp_path):
    from scripts.lib.native_coop_proposal_replay import target_snapshot_completed
    from scripts.lib.native_coop_target_inputs import original_resumed
    p=CapturedTargetGuestInputs.__new__(CapturedTargetGuestInputs);p.window=resumed();p.window.observe(1,2,packet(10),True)
    report=dict(profile=str(tmp_path/'owned-profile'),observedProposalEvents=[dict(stage=n)for n in [1,2,3]])
    votes=SimpleNamespace(sent_ready=True,sent_loaded=True)
    marker='[coop-target-fixture] Snapshot epoch=1 serial=1 local=1 slot=0 region=1_0 frame=0 clock=0 original-writer=1 source-retained=1 coordinator-loaded=1 peer-loaded=0 resume-controls=0 live-second-engine=0\n'
    log=tmp_path/'native.log';log.write_text(marker)
    assert target_snapshot_completed(report,1,0)and not original_resumed(report)
    assert p.pending(report,votes)==[]and not p.window.delivered
    log.write_text('[coop-load] Resumed epoch=1 serial=1 region=1_0\n')
    assert original_resumed(report)and not target_snapshot_completed(report,1,0)
    assert p.pending(report,votes)==[]and not p.window.delivered
    log.write_text(marker+'[coop-load] Resumed epoch=1 serial=1 region=1_0\n')
    assert p.pending(report,votes)==window()
