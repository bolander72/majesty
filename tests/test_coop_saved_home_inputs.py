"""Actual frame admission and bounded second-resume replay without game launches."""
import pytest
from scripts.lib.native_coop_saved_home_inputs import SavedHomeInputWindow,CapturedSavedHomeGuestInputs
from tests.test_original_inputs import packet
from tests.test_original_host_replay import original_resume_window

def test_home_delivery_requires_second_complete_and_original_resume_return():
    clock=[0.0];payloads=[packet(n) for n in range(10,20,2)]
    w=SavedHomeInputWindow(payloads,clock=lambda:clock[0])
    resume=original_resume_window()[0]
    w.observe(1,2,resume,False);assert not w.resume_seen
    w.observe(1,2,resume,True);w.observe(1,2,packet(10),True)
    assert w.deliver(False)==[]
    for data in payloads:
        assert w.deliver(True)==[data]
        assert w.deliver(True)==[]
        clock[0]+=.101
    assert w.delivered and w.next_index==5
    w.observe(1,2,resume,True);assert w.deliver(True)==[]

@pytest.mark.parametrize('case',['owner','first-frame','duplicate-resume','bad-resume'])
def test_home_window_refuses_unrelated_or_changed_requests(case):
    w=SavedHomeInputWindow([packet(n) for n in range(10,20,2)])
    resume=original_resume_window()[0]
    if case=='owner':args=(2,1,resume,True)
    elif case=='bad-resume':args=(1,2,resume[:-1],True)
    else:
        w.observe(1,2,resume,True)
        args=(1,2,resume if case=='duplicate-resume' else packet(12),True)
    with pytest.raises(ValueError):w.observe(*args)
    assert not w.pending

@pytest.mark.parametrize('frames',[[10,12,14,16],[10,12,14,16,20],[10,12,12,16,18]])
def test_home_window_refuses_invented_missing_or_repeated_frames(frames):
    with pytest.raises(ValueError):SavedHomeInputWindow([packet(n) for n in frames])

def test_home_peer_window_waits_for_actual_queued_travel_action(tmp_path,monkeypatch):
    p=CapturedSavedHomeGuestInputs.__new__(CapturedSavedHomeGuestInputs)
    payloads=[packet(n) for n in range(10,20,2)];p.window=SavedHomeInputWindow(payloads)
    p.window.pending=True;p.descriptor_sha='actual descriptor'
    log=tmp_path/'native.log';log.write_text('[coop-load] Resumed epoch=1 serial=2 region=0_0\n')
    monkeypatch.setattr('scripts.lib.native_coop_saved_home_inputs.bounded_read',lambda path,cap:log.read_bytes())
    report=dict(profile=str(tmp_path/'owned-profile'),observedSavedReturnEvents=[dict(stage=n,descriptorSha256=p.descriptor_sha) for n in (1,2,3)])
    assert p.pending(report)==[] and p.window.next_index==0
    log.write_text(log.read_text()+'[smoke] named action coop-travel-east: queued\n')
    assert p.pending(report)==[payloads[0]]

def test_seven_packet_actual_prefix_is_bounded_and_consumed_once():
    clock=[0.0];payloads=[packet(n) for n in range(10,24,2)]
    w=SavedHomeInputWindow(payloads,clock=lambda:clock[0]);w.pending=True
    seen=[]
    for data in payloads:
        seen+=w.deliver(True);assert w.deliver(True)==[];clock[0]+=.101
    assert seen==payloads and w.delivered and w.next_index==7
    assert w.deliver(True)==[]
    with pytest.raises(ValueError):SavedHomeInputWindow(payloads+[packet(24)])
