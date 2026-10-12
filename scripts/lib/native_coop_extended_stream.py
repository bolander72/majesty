"""One bounded actual original completion stream, including original Ping bytes."""
import struct
from .native_original_inputs import RecordedHostResumeInputs,empty_input

class RecordedExtendedHostCompletion:
    def __init__(self,payloads):
        if not 10<=len(payloads)<=19:raise ValueError('Extended original stream exceeds9..16 frames and two Pings')
        # Both inputs are actual source bytes. Reuse the existing resume
        # validator without manufacturing an auxiliary packet.
        RecordedHostResumeInputs(payloads[:2])
        frames=[];pings=[]
        for index,payload in enumerate(payloads[1:],1):
            if len(payload)<8:raise ValueError('Truncated original extended packet')
            category=struct.unpack_from('<II',payload)
            if category==(256,5):frames.append(empty_input(payload))
            elif category==(2,18):
                if len(payload)!=16:raise ValueError('Original Ping requires exactly16 bytes')
                owner,timestamp=struct.unpack_from('<II',payload,8)
                if owner!=1 or not timestamp or len(pings)>=2:raise ValueError('Original Ping owner/time/count differs')
                pings.append(dict(index=index,owner=owner,timestamp=timestamp))
            else:raise ValueError('No other gameplay or protocol command may enter the extended stream')
        if not 9<=len(frames)<=16 or frames!=list(range(10,10+2*len(frames),2)):
            raise ValueError('Original extended input frames are missing, repeated or reordered')
        self.payloads=tuple(payloads);self.frames=frames;self.pings=pings;self.delivered=False

    def deliver(self,original_guest_loaded,real_barrier_complete):
        if original_guest_loaded is not True or real_barrier_complete is not True:
            raise ValueError('Extended original stream requires actual Loaded and real Complete')
        if self.delivered:return []
        self.delivered=True;return list(self.payloads)
