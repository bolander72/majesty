import importlib.util
from pathlib import Path
import struct
import unittest

spec = importlib.util.spec_from_file_location('hero_ui_template',
    Path(__file__).resolve().parents[1] / 'scripts/prepare-community-hero-ui-template.py')
template = importlib.util.module_from_spec(spec)
spec.loader.exec_module(template)


class HeroUiTemplateTests(unittest.TestCase):
    def test_source_aliases_are_deterministic_and_preserve_stock_identity(self):
        ids = {'BDD1': 'AVt1', 'BDS1': 'AVu1', 'BDG1': 'ABt1'}
        raw = template.bindings(ids, {'BDS1', 'BDD1'})
        self.assertEqual(raw, template.bindings(ids, {'BDD1', 'BDS1'}))
        self.assertEqual(raw[:12], b'MHB1' + struct.pack('<II', 1, 2))
        self.assertEqual(len(raw), 28)
        self.assertNotIn(b'ABt1', raw)
        self.assertIn(b'AVt1BDD1', raw)

    def test_missing_or_building_alias_refused(self):
        for ids in [{}, {'BDD1': 'ABt1'}, {'BDD1': 'AVt12'}]:
            with self.assertRaises(ValueError):
                template.bindings(ids, {'BDD1'})

    def test_duplicate_native_subject_refused(self):
        with self.assertRaises(ValueError):
            template.bindings({'BDD1': 'AVt1', 'BDS1': 'AVt1'}, {'BDD1', 'BDS1'})

    def test_only_read_gates_are_replaced(self):
        self.assertEqual(template.PATCHES, {
            0x470cae: bytes.fromhex('8a4810'),
            0x470feb: bytes.fromhex('8b4e14'),
            0x471112: bytes.fromhex('8b4104'),
        })


if __name__ == '__main__':
    unittest.main()
