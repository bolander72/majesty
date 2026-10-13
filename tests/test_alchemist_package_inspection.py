"""Malformed packages must fail before any installation or profile access."""
import importlib.util
from pathlib import Path
import struct
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('alchemist_inspection', ROOT / 'scripts/inspect-alchemist-package.py')
inspection = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inspection)


def archive(entries):
    directory_bytes = 8 + 28 * len(entries)
    offset = 28 + directory_bytes
    header = inspection.CAM_MAGIC + struct.pack('<II4sI', 1, directory_bytes, b'TILE', 28)
    records, payloads = [], []
    for name, payload in entries:
        records.append(struct.pack('<20sII', name, offset, len(payload)))
        payloads.append(payload)
        offset += len(payload)
    return header + struct.pack('<II', len(entries), 0) + b''.join(records + payloads)


class PackageInspectionTests(unittest.TestCase):
    def test_source_only_checkout_is_not_a_complete_package(self):
        with self.assertRaisesRegex(ValueError, 'Missing original community resource'):
            inspection.inspect(ROOT / 'content/community-mods/alchemist')

    def test_sparse_empty_stock_tiles_are_allowed_but_overlapping_art_is_not(self):
        raw = archive([(b'empty stock', b''), (b'ALC1custom', b'actual pixels')])
        self.assertEqual(inspection.cam_index(raw), {(b'TILE', b'ALC1custom'): 13})
        changed = bytearray(archive([(b'ALC1a', b'first'), (b'ALC1b', b'second')]))
        struct.pack_into('<I', changed, 36 + 28 + 20, 92)
        with self.assertRaisesRegex(ValueError, 'overlap'):
            inspection.cam_index(changed)

    def test_truncated_and_oversized_directories_are_rejected(self):
        raw = archive([(b'ALC1custom', b'pixels')])
        for stop in range(len(raw)):
            with self.subTest(stop=stop), self.assertRaises(ValueError):
                inspection.cam_index(raw[:stop])
        changed = bytearray(raw)
        struct.pack_into('<I', changed, 28, 0xffffffff)
        with self.assertRaisesRegex(ValueError, 'record bounds'):
            inspection.cam_index(changed)

    def test_traversal_and_symlink_resources_are_refused(self):
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            for invalid in ['../outside', '/outside', 'Data/../outside', 'Data\\outside', 'C:outside']:
                with self.subTest(invalid=invalid), self.assertRaisesRegex(ValueError, 'Unsafe'):
                    inspection.read(root, invalid)
            (root / 'original').write_bytes(b'preserved')
            (root / 'alias').symlink_to(root / 'original')
            with self.assertRaisesRegex(ValueError, 'Linked'):
                inspection.read(root, 'alias')
            self.assertEqual((root / 'original').read_bytes(), b'preserved')

    def test_manifest_entities_are_not_expanded(self):
        with self.assertRaisesRegex(ValueError, 'entities'):
            inspection.xml(b'<!DOCTYPE Majesty [<!ENTITY external SYSTEM "file:///outside">]><Majesty/>')


if __name__ == '__main__':
    unittest.main()
