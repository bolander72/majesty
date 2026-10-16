import importlib.util
from pathlib import Path
import struct
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('research_binding_preparer',
    ROOT / 'scripts/prepare-community-research-bindings.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ResearchBindingsTests(unittest.TestCase):
    def record(self, **changes):
        values = dict(identity='00112233445566778899aabbccddeeff',
            building_family=int.from_bytes(b'BDG', 'little'), action_control_id=29472,
            required_level=3)
        values.update(changes)
        return SimpleNamespace(**values)

    def registry(self, *records):
        return SimpleNamespace(kingdom_research=records or (self.record(),))

    def test_exact_source_identity_and_three_levels(self):
        raw, rows = module.encode_bindings(self.registry(),
            {'BDG1': 'ABt1', 'BDG2': 'ABt2', 'BDG3': 'ABt3'})
        self.assertEqual(raw[:8], b'MJR1' + struct.pack('<I', 1))
        self.assertEqual(raw[8:24], bytes.fromhex(self.record().identity))
        self.assertEqual(struct.unpack_from('<II', raw, 24),
            (self.record().building_family, int.from_bytes(b'ABt', 'little')))
        self.assertEqual(rows[0]['requiredLevel'], 3)
        self.assertEqual(rows[0]['actionControlId'], 29472)

    def test_missing_mixed_or_swapped_level_refused(self):
        for mapping in [
                {'BDG1': 'ABt1', 'BDG2': 'ABt2'},
                {'BDG1': 'ABt1', 'BDG2': 'ABu2', 'BDG3': 'ABt3'},
                {'BDG1': 'ABt1', 'BDG2': 'ABt3', 'BDG3': 'ABt2'}]:
            with self.subTest(mapping=mapping), self.assertRaises(ValueError):
                module.encode_bindings(self.registry(), mapping)

    def test_duplicate_identity_or_native_family_refused(self):
        mapping = {'BDG1': 'ABt1', 'BDG2': 'ABt2', 'BDG3': 'ABt3'}
        for other in [self.record(), self.record(identity='112233445566778899aabbccddeeff00',
                                               action_control_id=29473)]:
            with self.subTest(identity=other.identity), self.assertRaises(ValueError):
                module.encode_bindings(self.registry(self.record(), other), mapping)

    def test_empty_or_excessive_registry_refused(self):
        for records in [(), (self.record(),) * 65]:
            with self.assertRaises(ValueError):
                module.encode_bindings(SimpleNamespace(kingdom_research=records), {})


if __name__ == '__main__':
    unittest.main()
