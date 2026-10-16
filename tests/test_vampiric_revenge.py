import importlib.util
from pathlib import Path
import struct
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from lib.native_sprite_art import encode_cam
from lib.vampiric_revenge import legacy_template, records, replace_records, string_table

SPEC = importlib.util.spec_from_file_location('demo_prepare', ROOT / 'scripts/prepare-vampiric-revenge.py')
PREPARE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PREPARE)


class OriginalDemoTests(unittest.TestCase):
    def test_template_preserves_every_byte_after_initializer(self):
        body = b'VampVambVAMP' + bytes(range(256))
        original = b'RGM6\0\0\0\0' * 2 + b'VAMPIRIC_REVENGE\0' + body
        self.assertEqual(legacy_template(original),
                         original[:16] + b'DOWNLOADABLE_QUEST_3\0' + body)
        with self.assertRaises(ValueError):
            legacy_template(original.replace(b'VAMPIRIC_REVENGE', b'FERTILE_PLAIN'))

    def test_only_reserved_heading_changes(self):
        rows = [b'XQD1Balance of Twilight\0', b'XQD2Bonus Quest 2\0', b'XQD3Bonus Quest 3\0']
        base = 4 + 4 * len(rows)
        offsets = [base + sum(map(len, rows[:i])) for i in range(len(rows))]
        raw = struct.pack('<4I', 0x02000003, *offsets) + b''.join(rows)
        result = string_table(raw, b'XQD3', b'Vampiric Revenge')
        self.assertEqual(result[16:16 + len(rows[0]) + len(rows[1])], rows[0] + rows[1])
        self.assertTrue(result.endswith(b'XQD3Vampiric Revenge\0'))
        with self.assertRaises(ValueError):
            string_table(raw, b'VAMP', b'Wrong identity')

    def test_unrelated_resources_and_numeric_tiles_survive(self):
        raw = encode_cam([(b'DATA', [(b'XML1', b'old'), (b'QDEP', b'original rules')]),
                          (b'TILE', [(struct.pack('<I', 0), b'opaque native bytes')])])
        result = replace_records(raw, {(b'DATA', b'XML1'): b'new config'})
        self.assertEqual(list(records(result)), [
            (b'DATA', b'XML1', b'new config'), (b'DATA', b'QDEP', b'original rules'),
            (b'TILE', struct.pack('<I', 0), b'opaque native bytes')])
        with self.assertRaises(ValueError):
            replace_records(raw, {(b'DATA', b'NONE'): b'wrong'})

    def test_bridge_reloads_after_stock_and_community_scripts(self):
        import xml.etree.ElementTree as ET
        raw = b'<XmlDataRoot><DataGroups><LoadData><MajXCommonData><LoadGPL>MX_Build.bcd</LoadGPL></MajXCommonData><Rel0><LoadGPL>Bytecode.bcd</LoadGPL><LoadGPL>Alchemist_Composed.bcd</LoadGPL></Rel0></LoadData></DataGroups></XmlDataRoot>'
        root = ET.fromstring(PREPARE.bind_scripts(raw))
        self.assertEqual([n.text for n in root.findall('./DataGroups/LoadData/Rel0/LoadGPL')],
                         ['Bytecode.bcd', 'Alchemist_Composed.bcd', 'VampiricRevengeBridge.bcd'])
        self.assertEqual(root.findtext('./DataGroups/LoadData/MajXCommonData/LoadCAM'),
                         'VampiricRevenge-menu.cam')
        with self.assertRaises(ValueError):
            PREPARE.bind_scripts(PREPARE.bind_scripts(raw))


if __name__ == '__main__':
    unittest.main()
