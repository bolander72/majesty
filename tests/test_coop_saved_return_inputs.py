"""Refuse edited or phase-ineligible recorded second-pause streams; no game launch."""
import struct
import pytest
from scripts.lib.native_coop_saved_return_inputs import RecordedSavedReturnHostInputs

def packet(kind, words):
    body = struct.pack('<' + 'I' * len(words), *words)
    return struct.pack('<2I', 256, kind) + bytes(x ^ 49 for x in body)

def stream():
    resume = packet(4, (48,1,0,0,1,24,9,1,1,0,50,0,0))
    empty = lambda frame: packet(5, (frame,0,50))
    pause = packet(5, (0,2,50,16,1,27,0,0,48,1,28,0,1,24,9,0,1,0,50,0,0))
    return [resume] + [empty(f) for f in range(10,28,2)] + [pause] + [empty(f) for f in range(30,40,2)]

def test_second_pause_preserves_every_byte_and_delivers_once():
    packets = stream(); packets.insert(6, struct.pack('<4I',2,18,1,1234))
    recorded = RecordedSavedReturnHostInputs(packets)
    assert recorded.frames == list(range(10,28,2)) + list(range(30,40,2))
    assert recorded.pings == [1234] and recorded.pause_index == 11
    assert recorded.deliver(True, True) == packets
    assert recorded.deliver(True, True) == []

def test_captured_later_pause_requires_its_independently_admitted_clock():
    empty = lambda frame: packet(5, (frame,0,50))
    pause = packet(5, (0,2,50,16,1,29,0,0,48,1,30,0,1,24,9,0,1,0,50,0,0))
    packets = [stream()[0]] + [empty(f) for f in range(10,30,2)] + [pause] + [empty(f) for f in range(32,42,2)]
    recorded = RecordedSavedReturnHostInputs(packets, source_clock=1550)
    assert recorded.deliver(True, True) == packets
    with pytest.raises(ValueError): RecordedSavedReturnHostInputs(packets)
    with pytest.raises(ValueError): RecordedSavedReturnHostInputs(packets, source_clock=1500)

@pytest.mark.parametrize('loaded,complete', [(False,True),(True,False),(1,True),(True,1)])
def test_second_pause_requires_actual_first_trip_gates(loaded, complete):
    recorded = RecordedSavedReturnHostInputs(stream())
    with pytest.raises(ValueError): recorded.deliver(loaded,complete)
    assert recorded.delivered is False

@pytest.mark.parametrize('change', ['missing-pause','missing-frame','duplicate-frame','pause-owner','pause-frame','pause-mode','pause-time','reordered','ping-owner','ping-repeat','second-pause','early-pause'])
def test_second_pause_rejects_changed_stream(change):
    packets = stream()
    if change == 'missing-pause': packets.pop(10)
    elif change == 'missing-frame': packets.pop()
    elif change == 'duplicate-frame': packets[-1]=packets[-2]
    elif change.startswith('pause-'):
        words = list(struct.unpack('<21I',bytes(x^49 for x in packets[10][8:])))
        at = {'pause-owner':9,'pause-frame':10,'pause-mode':15,'pause-time':18}[change]
        words[at] += 1; packets[10]=packet(5,words)
    elif change == 'reordered': packets[8],packets[9]=packets[9],packets[8]
    elif change == 'ping-owner': packets.insert(5,struct.pack('<4I',2,18,2,1234))
    elif change == 'ping-repeat':
        ping=struct.pack('<4I',2,18,1,1234);packets[5:5]=[ping,ping]
    elif change == 'second-pause': packets.insert(11,packets[10])
    elif change == 'early-pause': packets.insert(5,packets.pop(10))
    with pytest.raises(ValueError): RecordedSavedReturnHostInputs(packets)
