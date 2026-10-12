import importlib.util
from pathlib import Path
import struct
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('native_menu', ROOT / 'scripts/prepare-wayfinder-native-menu.py')
MENU = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MENU)


class NativeMenuTests(unittest.TestCase):
    def config(self):
        return b'<XmlDataRoot><DataGroups><LoadData><MajXCommonData><LoadGPL>MX_Data.bcd</LoadGPL></MajXCommonData><Rel0/><Rel2/><Relp><LoadGPL>MX_Task.bcd</LoadGPL></Relp><Rel3/><Rel1/></LoadData><UnloadData><Relp><LoadGPL>MDL1.bcd</LoadGPL></Relp></UnloadData></DataGroups></XmlDataRoot>'

    def test_mission_entry_reloads_initialization_after_stock_scripts(self):
        tree = ET.fromstring(MENU.extend_load_groups(self.config()))
        for name in ('MajXCommonData', 'Rel0', 'Rel2', 'Relp', 'Rel3'):
            group = tree.find('./DataGroups/LoadData/' + name)
            self.assertEqual(group[-1].tag, 'LoadGPL')
            self.assertEqual(group[-1].text, 'Wayfinder.bcd')
        self.assertEqual(tree.find('./DataGroups/LoadData/Relp')[0].text, 'MX_Task.bcd')
        self.assertEqual([node.text for node in tree.findall('.//LoadCAM')],
                         ['Wayfinder-units.cam', 'Wayfinder-interface.cam'])
        self.assertEqual(len(tree.find('./DataGroups/LoadData/Rel1')), 0)
        self.assertEqual(tree.find('./DataGroups/UnloadData/Relp/LoadGPL').text, 'MDL1.bcd')

    def test_missing_or_duplicate_load_configuration_refused(self):
        with self.assertRaises(ValueError):
            MENU.extend_load_groups(self.config().replace(b'<Rel2/>', b''))
        with self.assertRaises(ValueError):
            MENU.extend_load_groups(MENU.extend_load_groups(self.config()))

    def test_preserves_original_bytes_and_inherits_postfix_requirement(self):
        old = b'# existing rules\r\nABW1 : ABJ1 ABJ2 ||\r\nABV1\r\n\r\n'
        new = MENU.extend_dependencies(old)
        self.assertTrue(new.startswith(old))
        self.assertTrue(new.endswith(b'ABs1 : ABJ1 ABJ2 ||\r\n\r\n'))

    def test_empty_ranger_rule_is_not_replaced_with_a_prerequisite(self):
        self.assertTrue(MENU.extend_dependencies(b'ABW1\r\n\r\n').endswith(b'ABs1\r\n\r\n'))

    def test_rejects_missing_blank_line_duplicates_and_collision(self):
        for bad in (b'ABW1\r\n', b'ABW1\r\nABW1\r\n\r\n', b'ABW1\r\nABs1\r\n\r\n', b'bad row\r\n\r\n'):
            with self.assertRaises(ValueError):
                MENU.extend_dependencies(bad)

    def test_archive_resize_preserves_unrelated_payload_and_labels(self):
        a, b = b'ABW1\r\n\r\n', b'<XmlDataRoot/>'
        start = 20 + 8 + 8 + 2 * 28
        labels = [b'BDEP' + b'original label!!', b'XML1' + b'config label!!!!']
        original = MENU.RESOURCES.HEADER + struct.pack('<II4sIII', 1, 64, b'DATA', 28, 2, 0)
        original += struct.pack('<20sII', labels[0], start, len(a)) + struct.pack('<20sII', labels[1], start + len(a), len(b)) + a + b
        patched = MENU.replace_records(original, {(b'DATA', b'BDEP'): MENU.extend_dependencies(a)})
        records = MENU.RESOURCES.cam_records(patched)
        self.assertEqual(records[b'DATA', b'XML1'], b)
        self.assertEqual(patched[36:56], original[36:56])
        self.assertEqual(patched[64:84], original[64:84])

    def test_rejects_out_of_bounds_archive(self):
        with self.assertRaises(ValueError):
            MENU.replace_records(MENU.RESOURCES.HEADER + b'\xff' * 24, {})


if __name__ == '__main__':
    unittest.main()
