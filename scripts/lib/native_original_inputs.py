"""One bounded original empty-input window; no invented frames or commands."""
import struct


def empty_input(payload):
    if len(payload) != 20 or struct.unpack_from('<II', payload) != (0x100, 5):
        raise ValueError('Requires an original empty-input packet')
    frame, count, timing = struct.unpack('<III', bytes(x ^ 0x31 for x in payload[8:]))
    if count or not frame or timing != 50:
        raise ValueError('Empty input frame/count/timing differs')
    return frame


class RecordedEmptyInputs:
    def __init__(self, payloads, first_frame):
        if first_frame != 10 or len(payloads) != 5:
            raise ValueError('Requires the inspected ten-tick startup window')
        if [empty_input(p) for p in payloads] != list(range(first_frame, first_frame + 10, 2)):
            raise ValueError('Captured input window is missing, repeated or reordered')
        self.payloads = tuple(payloads)
        self.first_frame = first_frame
        self.delivered = False

    def receive(self, sender, recipient, payload, initialized):
        if (sender, recipient) != (1, 2):
            raise ValueError('Original input request endpoints differ')
        if not 8 <= len(payload) <= 65536:
            raise ValueError('Truncated or oversized input request')
        if self.delivered:
            return []
        if struct.unpack_from('<II', payload) != (0x100, 5):
            return []
        if not initialized:
            raise ValueError('Cannot replay input before exact original initialization')
        # The host may send its own command bundle first (e.g. original pause).
        # It is not an empty input request and grants no new replay window.
        # Keep observing until the host requests a captured empty frame.
        if len(payload) > 20:
            return []
        request_frame = empty_input(payload)
        if request_frame not in range(self.first_frame, self.first_frame + 10, 2):
            raise ValueError('Host requests a different recorded input window')
        self.trigger_frame = request_frame
        self.delivered = True
        return list(self.payloads)


class RecordedHostPauseInputs:
    """One original host pause and its unchanged following input window.

    This admits the reviewed owned capture only, not arbitrary commands or a
    generic multiplayer stream. The containing transcript binds source hashes,
    the actual paused original world, sender1/guest2 and exact GameStart.
    """
    def __init__(self, payloads):
        if len(payloads) != 6:
            raise ValueError('Require one original pause plus five following inputs')
        pause = payloads[0]
        if len(pause) != 72 or struct.unpack_from('<II', pause) != (0x100, 5):
            raise ValueError('Original host pause packet shape differs')
        body = bytes(x ^ 0x31 for x in pause[8:])
        # Original captured writer: outer frame/count/50ms, one48-byte record,
        # server1, ten-frame delay, frame0, one24-byte type9 command, pause0,
        # owner1, original pace50 and zero ancillary fields. Do not manufacture
        # a different command, owner, delay or resumed input window.
        expected = (0, 1, 50, 48, 1, 10, 0, 1, 24, 9, 0, 1, 0, 50, 0, 0)
        if struct.unpack('<16I', body) != expected:
            raise ValueError('Original host pause command/owner/delay differs')
        if [empty_input(p) for p in payloads[1:]] != [12, 14, 16, 18, 20]:
            raise ValueError('Original following host inputs are missing or reordered')
        self.payloads = tuple(payloads)
        self.delivered = False

    def deliver(self, original_guest_initialized):
        if original_guest_initialized is not True:
            raise ValueError('Cannot deliver pause before original guest initialization')
        if self.delivered:
            return []
        self.delivered = True
        return list(self.payloads)


class RecordedHostResumeInputs:
    """One captured original immediate resume plus its bounded target inputs."""
    def __init__(self, payloads):
        if not 2 <= len(payloads) <= 9:
            raise ValueError('Require one original resume plus one to eight captured target inputs')
        resume = payloads[0]
        if len(resume) != 60 or struct.unpack_from('<II', resume) != (0x100, 4):
            raise ValueError('Original immediate host resume shape differs')
        body = bytes(x ^ 0x31 for x in resume[8:])
        expected = (48, 1, 0, 0, 1, 24, 9, 1, 1, 0, 50, 0, 0)
        if struct.unpack('<13I', body) != expected:
            raise ValueError('Original immediate host resume command/owner/pace differs')
        if [empty_input(p) for p in payloads[1:]] != list(range(10, 10 + 2 * (len(payloads)-1), 2)):
            raise ValueError('Captured resumed host inputs are missing or reordered')
        self.payloads = tuple(payloads)
        self.delivered = False

    def deliver(self, original_guest_loaded, real_barrier_complete):
        if original_guest_loaded is not True or real_barrier_complete is not True:
            raise ValueError('Original resume replay requires actual guest Loaded and real Complete')
        if self.delivered:
            return []
        self.delivered = True
        return list(self.payloads)
