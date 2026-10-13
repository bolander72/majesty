import importlib.util
import os
from pathlib import Path
import struct
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.wayfinder_v2_interface import stationary_lodge_interface
from lib.wayfinder_interface import INTERFACE_ID, SOURCE_ID, string_entries

SDK = Path(os.environ.get('MAJESTY_SDK_ROOT', str(ROOT / 'upstream/majesty-recomp/original/gog/SDK/OriginalQuests')))
spec = importlib.util.spec_from_file_location('interface_native', ROOT / 'scripts/prepare-wayfinder-native-resources.py')
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)


@unittest.skipUnless(SDK.is_dir(), 'Requires the privately owned original game')
class WaystationPanel(unittest.TestCase):
    def test_only_complete_relocation_widgets_are_removed(self):
        original = native.cam_records(native.resident(SDK.parents[1] / 'Data/textdata.cam'))
        records = stationary_lodge_interface(original)
        source = original[b'SMNU', SOURCE_ID]
        portrait = source[:2180] + b'AVz1' + source[2184:]
        expected = portrait[:536] + portrait[716:2952] + portrait[3112:]
        self.assertEqual(records[b'SMNU', INTERFACE_ID], expected)
        words = struct.unpack(f'<{len(expected) // 4}i', expected)
        ids = [words[i + 1] for i in range(len(words) - 1) if words[i] == 13]
        self.assertNotIn(1005, ids)
        original_words = struct.unpack('<779i', source)
        original_ids = [original_words[i + 1] for i in range(len(original_words) - 1)
                        if original_words[i] == 13]
        self.assertEqual(ids.count(1016), original_ids.count(1016) - 1)
        self.assertIn(1025, ids)
        self.assertNotIn(b'AVH1', expected)
        self.assertEqual(expected.count(b'AVz1'), 1)
        text = string_entries(records[b'STRT', INTERFACE_ID])[1]
        self.assertIn(b'Lantern Survey', text[2])
        self.assertIn(b'Field Supply', text[4])
        self.assertEqual(set(records), {(b'SMNU', INTERFACE_ID), (b'STRT', INTERFACE_ID)})
