import importlib.util
from pathlib import Path
import struct
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('native_dependencies', ROOT / 'scripts/merge-alchemist-native-dependencies.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
from majesty_cam.cam import CamArchive, CamEntry, CamSection, read_cam
from majesty_cam.strt import StrtTable, StrtRecord, parse_strt


class NativeDependenciesTests(unittest.TestCase):
    def test_output_must_be_a_fresh_sibling_before_reading_or_writing(self):
        with tempfile.TemporaryDirectory() as directory:
            candidate = Path(directory) / 'candidate'
            candidate.mkdir()
            for output in (candidate / 'nested', Path(directory) / 'elsewhere' / 'candidate'):
                with self.subTest(output=output), self.assertRaisesRegex(ValueError, 'sibling'):
                    module.stage(candidate, Path(directory) / 'package', output)
                self.assertFalse(output.exists())

    def archive(self, data=b'# LAST LINE MUST be blank\r\nABa1 : ABJ1\r\n\r\n'):
        return CamArchive((CamSection(b'DATA', (
            CamEntry(b'BDEP'.ljust(20, b'\0'), data),
            CamEntry(b'KEEP'.ljust(20, b'\0'), b'unrelated stock data'))),))

    def test_preserves_stock_and_adds_authored_palace_gate(self):
        original = self.archive()
        raw, proof = module.merge(original, b'ALB1 : ABJ2 ABJ3 NOT NOT ||')
        restored = read_cam(raw)
        self.assertTrue(module.dependency(restored).data.startswith(module.dependency(original).data))
        self.assertTrue(module.dependency(restored).data.endswith(b'\r\n\r\n'))
        self.assertEqual(restored.sections[0].entries[1].data, b'unrelated stock data')
        self.assertTrue(proof['stockBytesPreserved'])

    def test_refuses_existing_key_instead_of_changing_it(self):
        with self.assertRaisesRegex(ValueError, 'occupied'):
            module.merge(self.archive(b'ALB1 : ABJ1\r\n'), b'ALB1 : ABJ2 ABJ3 NOT NOT ||')

    def test_refuses_missing_duplicate_or_changed_authored_gate(self):
        for rule in (b'ALB1 : ABJ1', b'ALB1 : ABJ2 ABJ3 NOT NOT ||\nALB1 : ABJ2 ABJ3 NOT NOT ||', b'ABa1 : ABJ1'):
            with self.subTest(rule=rule), self.assertRaises(ValueError):
                module.authored_rule(rule)

    def test_refuses_ambiguous_native_table(self):
        original = self.archive()
        with self.assertRaises(ValueError):
            module.dependency(CamArchive(original.sections + original.sections))

    def test_loads_real_resources_in_original_and_expansion_classifications(self):
        raw = ('<XmlDataRoot><DataGroups><LoadData>' + ''.join(
            '<' + name + '><LoadCAM>stock.cam</LoadCAM></' + name + '>'
            for name in module.LOAD_GROUPS) + '</LoadData></DataGroups></XmlDataRoot>').encode()
        merged, proof = module.load_groups(raw)
        root = module.ET.fromstring(merged)
        for name in module.LOAD_GROUPS:
            entries = root.find('./DataGroups/LoadData/' + name)
            self.assertEqual([e.text for e in entries], ['stock.cam', *module.RESOURCE_FILES])
            self.assertTrue(proof[name]['existingLoadOrderPreserved'])
        repeated, proof = module.load_groups(merged)
        self.assertEqual(repeated, merged)
        self.assertTrue(all(not p['added'] for p in proof.values()))

    def test_missing_classification_refuses_partial_integration(self):
        with self.assertRaisesRegex(ValueError, 'classification'):
            module.load_groups(b'<XmlDataRoot><DataGroups><LoadData /></DataGroups></XmlDataRoot>')

    def test_catalog_adds_new_ids_and_preserves_stock_payloads(self):
        def catalog(key, payload):
            return CamArchive((CamSection(b'DUNT', (CamEntry(key.ljust(20, b'\0'), payload),)),))
        stock = catalog(b'ABJ1', b'original palace')
        private = catalog(b'ALB1', b'authored laboratory')
        raw, proof = module.merge_catalog(stock, private, b'DUNT')
        entries = read_cam(raw).sections[0].entries
        self.assertEqual([(e.name[:4], e.data) for e in entries],
                         [(b'ABJ1', b'original palace'), (b'ALB1', b'authored laboratory')])
        self.assertTrue(proof['stockPayloadsPreserved'])
        with self.assertRaisesRegex(ValueError, 'occupied'):
            module.merge_catalog(stock, stock, b'DUNT')

    def test_native_text_adds_semantic_keys_without_overwriting_stock(self):
        def table(rows):
            return CamArchive((CamSection(b'STRT', (CamEntry(b'UNTN'.ljust(20, b'\0'),
                StrtTable(b'\0 ', tuple(StrtRecord(k, v) for k, v in rows)).to_bytes()),)),))
        stock = table([(1, b'original name')])
        private = table([(1, b'newer stock name'), (2, b'Alchemy Lab')])
        raw, proof = module.merge_text(stock, private)
        rows = parse_strt(read_cam(raw).sections[0].entries[0].data).records
        self.assertEqual([(r.string_id, r.text) for r in rows],
                         [(1, b'original name'), (2, b'Alchemy Lab')])
        self.assertEqual(proof['UNTN']['addedRows'], 1)

    def test_authorized_potion_override_requires_original_identity_and_name(self):
        def action(name):
            def chunk(tag, data, count=0):
                return struct.pack('<4sIII', tag, len(data), 0, count) + data
            head = chunk(b'HEAD', b'A020' + bytes(4) + name.encode('ascii') + b'\0')
            raw = chunk(b'DACT', chunk(b'DATA', head, 1), 1)
            return CamArchive((CamSection(b'DACT', (CamEntry(b'A020'.ljust(20, b'\0'), raw),)),))
        stock = action('Speed_Tonic')
        _, proof = module.merge_catalog(stock, action('Speed_Tonic'), b'DACT', module.AUTHORED_POTION_ACTIONS)
        self.assertEqual(proof['authoredOverrideIds'], ['A020'])
        self.assertFalse(proof['stockPayloadsPreserved'])
        self.assertTrue(proof['unrelatedStockPayloadsPreserved'])
        with self.assertRaisesRegex(ValueError, 'binding'):
            module.merge_catalog(stock, action('Wrong Potion'), b'DACT', module.AUTHORED_POTION_ACTIONS)


if __name__ == '__main__':
    unittest.main()
