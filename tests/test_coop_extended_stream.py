"""Bounded longer replay admission; these packets are synthetic test data."""
import struct

import pytest

from scripts.lib.native_coop_extended_stream import RecordedExtendedHostCompletion
from tests.test_original_host_replay import original_resume_window
from tests.test_original_inputs import packet


def stream():
    frames = [packet(frame) for frame in range(10, 30, 2)]
    frames.insert(5, struct.pack('<4I', 2, 18, 1, 40093))
    return [original_resume_window()[0], *frames]


def test_preserves_ping_timestamp_and_packet_order_once():
    payloads = stream()
    window = RecordedExtendedHostCompletion(payloads)
    assert window.frames == list(range(10, 30, 2))
    assert window.pings == [dict(index=6, owner=1, timestamp=40093)]
    assert window.deliver(True, True) == payloads
    assert window.deliver(True, True) == []


@pytest.mark.parametrize('admission', [(False, True), (True, False), (1, True), (True, 1)])
def test_refuses_unqualified_barrier_without_consuming(admission):
    window = RecordedExtendedHostCompletion(stream())
    with pytest.raises(ValueError):
        window.deliver(*admission)
    assert not window.delivered


@pytest.mark.parametrize('case', [
    'missing-frame', 'repeat-frame', 'reorder-frame', 'nonempty-command',
    'wrong-timing', 'pong', 'wrong-owner', 'zero-time', 'long-ping',
    'third-ping', 'ping-before-first-input', 'altered-resume',
])
def test_rejects_invalid_original_stream(case):
    values = stream()
    if case == 'missing-frame': values.pop(2)
    elif case == 'repeat-frame': values[2] = values[1]
    elif case == 'reorder-frame': values[1], values[2] = values[2], values[1]
    elif case == 'nonempty-command': values[1] = packet(10, count=1)
    elif case == 'wrong-timing': values[1] = packet(10, timing=51)
    elif case == 'pong': values[6] = struct.pack('<4I', 2, 19, 1, 40093)
    elif case == 'wrong-owner': values[6] = struct.pack('<4I', 2, 18, 2, 40093)
    elif case == 'zero-time': values[6] = struct.pack('<4I', 2, 18, 1, 0)
    elif case == 'long-ping': values[6] += bytes(4)
    elif case == 'third-ping': values.extend([values[6], values[6]])
    elif case == 'ping-before-first-input': values[1], values[6] = values[6], values[1]
    elif case == 'altered-resume':
        altered = bytearray(values[0]); altered[36] ^= 1; values[0] = bytes(altered)
    with pytest.raises(ValueError):
        RecordedExtendedHostCompletion(values)
