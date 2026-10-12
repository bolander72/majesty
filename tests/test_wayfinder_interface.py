"""Check the real legacy GUI table and its independent clone, without gameplay claims."""
import importlib.util
from pathlib import Path
import struct
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('wayfinder_resources', ROOT / 'scripts/prepare-wayfinder-native-resources.py')
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)
from lib.wayfinder_interface import clone_interface, encode_interface_cam, string_entries, TEXT_EDITS


class InterfaceChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw = native.resident(native.INTERFACE_CAM)
        cls.original = native.cam_records(cls.raw)

    def test_new_panel_preserves_actions_and_unrelated_text(self):
        before = dict(self.original)
        cloned = clone_interface(self.original)
        self.assertEqual(cloned[b'SMNU', b'APw1'], before[b'SMNU', b'AP47'])
        old = string_entries(before[b'STRT', b'AP47'])[1]
        new = string_entries(cloned[b'STRT', b'APw1'])[1]
        self.assertEqual(len(old), len(new))
        for i in range(len(old)):
            self.assertEqual(new[i], TEXT_EDITS[i][1] if i in TEXT_EDITS else old[i])
        self.assertEqual(new[9], b'r')  # Original working recruitment shortcut.
        self.assertEqual(self.original, before)
        self.assertEqual(native.resident(native.INTERFACE_CAM), self.raw)
        self.assertEqual(native.cam_records(encode_interface_cam(cloned)), cloned)

    def test_existing_interface_and_changed_stock_panel_refused(self):
        with self.assertRaisesRegex(ValueError, 'already exists'):
            clone_interface(self.original, {b'APw1'})
        altered = dict(self.original)
        altered[b'SMNU', b'AP47'] += b'changed'
        with self.assertRaisesRegex(ValueError, 'baseline differs'):
            clone_interface(altered)

    def test_invalid_string_boundaries_and_identity_refused(self):
        baseline = self.original[b'STRT', b'AP47']
        for offset, value in [(4, len(baseline) + 1), (8, 116), (116, 28)]:
            raw = bytearray(baseline)
            struct.pack_into('<I', raw, offset, value)
            with self.subTest(offset=offset), self.assertRaises(ValueError):
                string_entries(raw)
        with self.assertRaises(ValueError):
            string_entries(baseline[:-1])


if __name__ == '__main__':
    unittest.main()
