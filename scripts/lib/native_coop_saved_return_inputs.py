"""Admit the captured stopped host resume/second-pause stream, without edits.

This is a narrow recorded-input component. Its caller must independently bind
the packets to the stopped original host, full checkpoints and authenticated
endpoints. It does not supply proposal votes or qualify recipient gameplay.
"""
import struct

from .native_original_inputs import RecordedHostResumeInputs, empty_input


class RecordedSavedReturnHostInputs:
    def __init__(self, payloads, *, source_clock=1450):
        if source_clock not in (1450, 1550):
            raise ValueError('Require an independently captured admitted pause clock')
        pause_frame = source_clock // 50 - 1
        before = list(range(10, pause_frame, 2))
        after = list(range(pause_frame + 2, pause_frame + 12, 2))
        minimum = len(before) + len(after) + 2
        if not minimum <= len(payloads) <= minimum + 2:
            raise ValueError('Require resume, the captured input window and at most two actual Pings')
        RecordedHostResumeInputs(payloads[:2])
        frames, pings, pause = [], [], None
        for index, payload in enumerate(payloads[1:], 1):
            if len(payload) < 8:
                raise ValueError('Truncated saved-return stream packet')
            category = struct.unpack_from('<2I', payload)
            if category == (2, 18):
                if len(payload) != 16 or len(pings) >= 2:
                    raise ValueError('Unbounded original Ping')
                owner, timestamp = struct.unpack_from('<2I', payload, 8)
                if owner != 1 or not timestamp or timestamp in pings:
                    raise ValueError('Original host Ping identity/timestamp differs')
                pings.append(timestamp)
            elif category == (256, 5) and len(payload) == 92:
                if pause is not None or frames != before:
                    raise ValueError('Second pause is missing its original preceding frame window')
                words = struct.unpack('<21I', bytes(x ^ 0x31 for x in payload[8:]))
                expected = (0, 2, 50, 16, 1, pause_frame - 1, 0, 0,
                            48, 1, pause_frame, 0, 1, 24, 9, 0, 1, 0, 50, 0, 0)
                if words != expected:
                    raise ValueError('Original second pause records/owner/timing differ')
                pause = index
            else:
                frame = empty_input(payload)
                expected = (10 + len(frames) * 2) if pause is None else (pause_frame + 2 + (len(frames) - len(before)) * 2)
                if frame != expected:
                    raise ValueError('Original saved-return frame window differs')
                frames.append(frame)
        if pause is None or frames != before + after:
            raise ValueError('Require the complete observed second-pause input window')
        self.payloads, self.frames, self.pings = tuple(payloads), frames, pings
        self.pause_index, self.delivered = pause, False

    def deliver(self, original_guest_loaded, real_first_barrier_complete):
        if original_guest_loaded is not True or real_first_barrier_complete is not True:
            raise ValueError('Recorded second pause requires actual first-trip Loaded and Complete')
        if self.delivered:
            return []
        self.delivered = True
        return list(self.payloads)
