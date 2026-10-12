"""Bounded captured-input admission controls, with synthetic packet fixtures."""
import struct
import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from lib.native_original_inputs import RecordedEmptyInputs, RecordedHostPauseInputs


def packet(frame, count=0, timing=50):
    return struct.pack('<II',256,5) + bytes(x ^ 49 for x in struct.pack('<III',frame,count,timing))


class OriginalInputs(unittest.TestCase):
    def window(self):return [packet(n) for n in range(10,20,2)]

    def test_delivers_original_bytes_once_after_initialization(self):
        payloads=self.window();s=RecordedEmptyInputs(payloads,10)
        self.assertEqual(s.receive(1,2,packet(10),True),payloads)
        self.assertTrue(s.delivered)
        self.assertEqual(s.receive(1,2,packet(10),True),[])

    def test_uninitialized_original_request_refuses(self):
        s=RecordedEmptyInputs(self.window(),10)
        with self.assertRaisesRegex(ValueError,'before exact'):s.receive(1,2,packet(10),False)
        self.assertFalse(s.delivered)

    def test_original_host_can_first_request_later_member_of_same_window(self):
        s=RecordedEmptyInputs(self.window(),10)
        self.assertEqual(s.receive(1,2,packet(12),True),self.window())
        self.assertEqual(s.trigger_frame,12)

    def test_other_endpoints_refuse(self):
        s=RecordedEmptyInputs(self.window(),10)
        for endpoints in [(2,1),(1,0),(3,2)]:
            with self.assertRaises(ValueError):s.receive(*endpoints,packet(10),True)

    def test_original_host_command_bundle_does_not_close_or_grant_input_window(self):
        s=RecordedEmptyInputs(self.window(),10)
        command=packet(0,count=1)+bytes(52)
        self.assertEqual(s.receive(1,2,command,True),[])
        self.assertFalse(s.delivered)
        self.assertEqual(s.receive(1,2,packet(12),True),self.window())
        self.assertEqual(s.trigger_frame,12)

    def test_later_window_refuses_without_manufacturing_missing_inputs(self):
        s=RecordedEmptyInputs(self.window(),10)
        with self.assertRaisesRegex(ValueError,'different recorded'):s.receive(1,2,packet(20),True)
        self.assertFalse(s.delivered)

    def test_missing_reordered_and_repeated_captures_refuse(self):
        good=self.window()
        for bad in [good[:-1],good[::-1],[good[0]]*5]:
            with self.assertRaises(ValueError):RecordedEmptyInputs(bad,10)

    def test_captured_commands_timing_and_frame_changes_refuse(self):
        for bad in [packet(10,count=1),packet(10,timing=0),packet(0)]:
            with self.assertRaises(ValueError):RecordedEmptyInputs([bad]+self.window()[1:],10)

    def test_only_inspected_startup_frame_admitted(self):
        with self.assertRaises(ValueError):RecordedEmptyInputs(self.window(),12)

    def test_never_answers_later_votes_or_commands(self):
        s=RecordedEmptyInputs(self.window(),10)
        vote=struct.pack('<II',256,16)+bytes(8)
        self.assertEqual(s.receive(1,2,vote,False),[])
        s.receive(1,2,packet(10),True)
        self.assertEqual(s.receive(1,2,packet(20,1),True),[])
        self.assertEqual(s.receive(1,2,vote,True),[])


class OriginalHostPauseInputs(unittest.TestCase):
    def window(self):
        words=(0,1,50,48,1,10,0,1,24,9,0,1,0,50,0,0)
        pause=struct.pack('<II',256,5)+bytes(x^49 for x in struct.pack('<16I',*words))
        return [pause]+[packet(n) for n in range(12,22,2)]

    def test_delivers_exact_original_window_once(self):
        original=self.window();s=RecordedHostPauseInputs(original)
        self.assertEqual(s.deliver(True),original)
        self.assertEqual(s.deliver(True),[])

    def test_requires_explicit_original_initialization(self):
        for value in [False,None,1,'true']:
            s=RecordedHostPauseInputs(self.window())
            with self.assertRaises(ValueError):s.deliver(value)
            self.assertFalse(s.delivered)

    def test_every_pause_field_mutation_refuses(self):
        for at in range(16):
            original=self.window();pause=bytearray(original[0]);pause[8+at*4]^=1
            original[0]=bytes(pause)
            with self.assertRaises(ValueError):RecordedHostPauseInputs(original)

    def test_missing_reordered_repeated_and_later_windows_refuse(self):
        good=self.window()
        for bad in [good[:-1],good[::-1],good+[packet(22)],
                    [good[0]]+[good[1]]*5,[good[0]]+[packet(n) for n in range(14,24,2)]]:
            with self.assertRaises(ValueError):RecordedHostPauseInputs(bad)

    def test_packet_type_size_and_timing_refuse(self):
        for pos in [0,4]:
            original=self.window();p=bytearray(original[0]);p[pos]^=1;original[0]=bytes(p)
            with self.assertRaises(ValueError):RecordedHostPauseInputs(original)
        original=self.window();original[0]=original[0][:-1]
        with self.assertRaises(ValueError):RecordedHostPauseInputs(original)
        original=self.window();original[1]=packet(12,timing=100)
        with self.assertRaises(ValueError):RecordedHostPauseInputs(original)


if __name__=='__main__':unittest.main()
