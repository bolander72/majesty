import struct
import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'third_party/majesty-mod-manager/src')]
from majesty_cam.cam import CamArchive, CamSection, CamEntry
from lib.community_expansion_media import append_art, append_waves, image_sets


def entry(name, data):
    return CamEntry(name.ljust(20, b'\0'), data)


def image(sets):
    data = bytearray(24 + len(sets) * 8)
    struct.pack_into('<I', data, 20, len(sets))
    for index, (identity, tile) in enumerate(sets):
        struct.pack_into('<II', data, 24 + index * 8, identity, len(data))
        body = bytearray(100)
        struct.pack_into('<I', body, 0, 1)
        struct.pack_into('<I', body, 64, 68)
        struct.pack_into('<I', body, 72, 0x10001)
        struct.pack_into('<I', body, 84, 0x10000)
        struct.pack_into('<I', body, 96, tile)
        data.extend(body)
    return bytes(data)


def tile(palette, pixel):
    data = bytearray(27)
    struct.pack_into('<3H', data, 0, 1, 1, 1)
    struct.pack_into('<I', data, 22, palette)
    data[26] = pixel
    return bytes(data)


def archive(sets, tiles, palettes):
    return CamArchive((CamSection(b'IMAG', (entry(b'CUR1', image(sets)),)),
        CamSection(b'TILE', tuple(entry(str(i).encode(), data) for i, data in enumerate(tiles))),
        CamSection(b'SPLT', tuple(entry(str(i).encode(), data) for i, data in enumerate(palettes)))))


class ExpansionMediaTests(unittest.TestCase):
    def inputs(self, changed_cursor=False):
        blue, red = b'blue'.ljust(1032, b'\0'), b'red'.ljust(1032, b'\0')
        old = archive([(1039, 1)], [b'', tile(0, 3)], [blue])
        new = archive([(1039, 1 if changed_cursor else 2), (1038, 1)],
            [b'', tile(0, 4), tile(1, 3)], [red, blue])
        return old, new

    def test_cursor_extension_resolves_relocated_tiles_and_preserves_existing_sets(self):
        old, new = self.inputs()
        result, proof = append_art(old, new, {b'CUR1'}, extend_cursor=True)
        before = {part.extension: part for part in old.sections}
        after = {part.extension: part for part in result.sections}
        self.assertEqual(after[b'TILE'].entries[:2], before[b'TILE'].entries)
        self.assertEqual(after[b'SPLT'].entries[:1], before[b'SPLT'].entries)
        prior_sets = image_sets(before[b'IMAG'].entries[0], before)[1]
        result_sets = image_sets(after[b'IMAG'].entries[0], after)[1]
        self.assertEqual(prior_sets[1039], result_sets[1039])
        self.assertIn(1038, result_sets)
        self.assertTrue(proof['deployedCursorSetsIdentical'])

    def test_cursor_extension_rejects_changed_existing_pixels(self):
        old, new = self.inputs(changed_cursor=True)
        with self.assertRaisesRegex(ValueError, 'changes a deployed cursor set'):
            append_art(old, new, {b'CUR1'}, extend_cursor=True)
        with self.assertRaisesRegex(ValueError, 'replace a deployed image'):
            append_art(old, new, {b'CUR1'})

    def test_wave_import_preserves_existing_audio_and_rejects_replacement(self):
        old = CamArchive((CamSection(b'WAVE', (entry(b'OLD1', b'original waveform'),)),))
        new = CamArchive((CamSection(b'WAVE', (entry(b'NEW1', b'new waveform'),)),))
        result = append_waves(old, new, {b'NEW1'})
        self.assertEqual(result.sections[0].entries[0], old.sections[0].entries[0])
        self.assertEqual(result.sections[0].entries[1], new.sections[0].entries[0])
        with self.assertRaisesRegex(ValueError, 'occupied new waveform'):
            append_waves(old, old, {b'OLD1'})


if __name__ == '__main__':
    unittest.main()
