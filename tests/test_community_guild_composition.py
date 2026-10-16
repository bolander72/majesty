"""Guard combined namespaces and bounded original-resource ancestry reads."""
from dataclasses import dataclass
from pathlib import Path
import struct
import sys
import tempfile
from types import SimpleNamespace
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from lib.community_guild_composition import declared_archives, preserve_dialogs, stock_named_resources


@dataclass(frozen=True)
class Panel:
    owner: str
    source_dialog_id: bytes
    resolved_parent_dialog_id: bytes
    resolved_child_dialog_id: bytes


@dataclass(frozen=True)
class Record:
    dialog_id: int
    source_dialog_id: bytes


@dataclass(frozen=True)
class Controllers:
    panels: tuple
    records: tuple


def cam(records):
    # One section per record keeps the fixture's boundary evidence explicit.
    count = len(records)
    end = 20 + 8 * count + 36 * count
    directory, entries, bodies = [], [], []
    at = end
    for index, (kind, key, body) in enumerate(records):
        directory.append(struct.pack('<4sI', kind, 20 + 8 * count + index * 36))
        entries.append(struct.pack('<II20sII', 1, 0, key, at, len(body)))
        bodies.append(body)
        at += len(body)
    return (b'CYLBPC  \x01\x00\x01\x00' + struct.pack('<II', count, 36 * count)
            + b''.join(directory + entries + bodies))


class CompositionTests(unittest.TestCase):
    def controllers(self):
        return Controllers((Panel('bards', b'BDRC', b'CGBD', b'CG02'),
                            Panel('alchemist', b'CGBR', b'CG01', b'CG03')),
            (Record(int.from_bytes(b'CG02', 'little'), b'CG02'),
             Record(int.from_bytes(b'CG03', 'little'), b'CG03')))

    def test_namespace_relocation_is_simultaneous_and_preserves_sources(self):
        original = self.controllers()
        result = preserve_dialogs(original, ())
        self.assertEqual([(p.resolved_parent_dialog_id, p.resolved_child_dialog_id)
                          for p in result.panels], [(b'CGBD', b'CGBC'), (b'CG01', b'CG02')])
        self.assertEqual([r.dialog_id.to_bytes(4, 'little') for r in result.records],
                         [b'CGBC', b'CG02'])
        self.assertEqual([r.source_dialog_id for r in result.records], [b'CG02', b'CG03'])
        self.assertEqual(original, self.controllers())

    def test_new_source_collision_requires_review(self):
        inventory = SimpleNamespace(resources=(SimpleNamespace(key=b'CGBC'),))
        with self.assertRaisesRegex(ValueError, 'already occupied'):
            preserve_dialogs(self.controllers(), (inventory,))

    def test_unreviewed_panel_inventory_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'inventory'):
            preserve_dialogs(Controllers(self.controllers().panels[:1], ()), ())

    def test_overlapping_children_are_rejected(self):
        panels = (Panel('bards', b'BDRC', b'CGBD', b'CG02'),
                  Panel('alchemist', b'CGBR', b'CG01', b'CG02'))
        with self.assertRaisesRegex(ValueError, 'overlapping'):
            preserve_dialogs(Controllers(panels, ()), ())

    def fixture(self, root, base='$(MajestyDataPath)/base.cam'):
        (root / 'Data').mkdir()
        (root / 'DataMX').mkdir()
        def manifest(path, value):
            path.write_text('<Majesty><DataConfiguration><Dataset><Load><CAM>'
                + value + '</CAM></Load></Dataset></DataConfiguration></Majesty>')
        manifest(root / 'Data/MajestyDatasetDefinitions.xml', base)
        manifest(root / 'DataMX/MajestyExpansionDatasetDefinitions.xml',
                 '$(MajestyDataPath)/base.cam')
        payload = cam([(b'STRT', b'NAME', b'authentic-text'),
                       (b'WAVE', b'KEEP', b'voice'), (b'WAVE', b'SKIP', b'other'),
                       (b'TILE', b'0000', b'pixels')])
        (root / 'Data/base.cam').write_bytes(payload)

    def test_named_reader_keeps_requested_voice_and_ignores_pixels(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.fixture(root)
            result = stock_named_resources(root, {b'KEEP'})
            self.assertEqual(result, {(b'STRT', b'NAME'): b'authentic-text',
                                      (b'WAVE', b'KEEP'): b'voice'})
            self.assertEqual([p for p, _ in declared_archives(root)],
                             [Path('Data/base.cam'), Path('Data/base.cam')])

    def test_record_outside_archive_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.fixture(root)
            path = root / 'Data/base.cam'
            raw = bytearray(path.read_bytes())
            struct.pack_into('<I', raw, 20 + 4 * 8 + 8 + 20, len(raw) + 1)
            path.write_bytes(raw)
            with self.assertRaisesRegex(ValueError, 'leaves its archive'):
                stock_named_resources(root, set())

    def test_manifest_cannot_escape_game(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.fixture(root, '$(MajestyDataPath)/../../outside.cam')
            with self.assertRaisesRegex(ValueError, 'escapes'):
                list(declared_archives(root))


if __name__ == '__main__':
    unittest.main()
