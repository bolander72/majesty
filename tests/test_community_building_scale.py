"""Independent wire offsets protect geometry, UI frames, palette and shadows."""
from pathlib import Path
import struct
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from lib.community_building_scale import scale_imag, scale_tile, scaled


def image_record(sid=208, mask=1, auxiliary=1):
    direction = (struct.pack('<2hHHIIHH', -6, 10, 1, 1, mask, auxiliary, 0, 1)
                 + struct.pack('<4h', -4, -8, 20, 16)
                 + struct.pack('<I4i', 2, -100, 40, 80, -20)
                 + (struct.pack('<I2i', 1, -70, 25) if auxiliary == 3 else b'')
                 + struct.pack('<I2hI', 999, 7, -9, 0x12340005))
    return (struct.pack('<6I', 4, 0, 0, 0, 0, 1) + struct.pack('<2I', sid, 32)
            + struct.pack('<I', 1) + bytes(60) + struct.pack('<I', 68) + direction)


class BuildingWorldScaleTests(unittest.TestCase):
    def test_shipped_encoder_long_run_preserves_all_pixels(self):
        header = bytearray(26)
        struct.pack_into('<5H', header, 0, 3, 1, 300, 300, 32)
        raw = bytes(header) + struct.pack('<IHH', 4, 300, 0x8000 | 300) + bytes([17]) * 300
        result = scale_tile(raw, 90)
        self.assertEqual(struct.unpack_from('<3H', result), (3, 1, 270))
        at, values = 30, bytearray()
        while True:
            end, count, flags = struct.unpack_from('<HBB', result, at)
            self.assertLessEqual(count, 80)
            at += 4
            values += result[at:at + count]
            at += count
            self.assertEqual(end, len(values))
            if flags & 0x80:
                break
        self.assertEqual(values, bytes([17]) * 270)

    def test_empty_terminal_row_ignores_uninitialized_unused_x_coordinate(self):
        header = bytearray(26)
        struct.pack_into('<5H', header, 0, 3, 1, 4, 4, 32)
        raw = bytes(header) + struct.pack('<IHBB', 4, 0xcdcd, 0, 0x80)
        result = scale_tile(raw, 50)
        self.assertEqual(result[30:], struct.pack('<HBB', 0, 0, 0x80))

    def test_both_alchemy_lab_polygons_scale_without_changing_their_counts(self):
        raw = image_record(auxiliary=3)
        result, refs, _ = scale_imag(raw, 50, {5: 20})
        self.assertEqual(struct.unpack_from('<I2i', result, 148), (1, -35, 13))
        self.assertEqual(struct.unpack_from('<I2hI', result, 160), (999, 4, -5, 0x12340014))
        self.assertEqual(refs, [(168, 5)])

    def test_scales_rectangles_polygon_and_frame_offsets_without_touching_flags(self):
        raw = image_record()
        result, refs, count = scale_imag(raw, 50, {5: 20})
        self.assertEqual(len(result), len(raw))
        self.assertEqual(result[:100], raw[:100])
        self.assertEqual(struct.unpack_from('<2h', result, 100), (-3, 5))
        self.assertEqual(struct.unpack_from('<4h', result, 120), (-2, -4, 10, 8))
        self.assertEqual(struct.unpack_from('<I4i', result, 128), (2, -50, 20, 40, -10))
        self.assertEqual(struct.unpack_from('<I2hI', result, 148), (999, 4, -5, 0x12340014))
        self.assertEqual(refs, [(156, 5)])
        self.assertEqual(count, 12)

    def test_sidebar_sets_are_byte_identical_and_unknown_shapes_refuse(self):
        for sid in [1000, 1001, 1002]:
            raw = image_record(sid)
            result, refs, count = scale_imag(raw, 78, {})
            self.assertEqual(result, raw)
            self.assertEqual((refs, count), ([], 0))
        with self.assertRaisesRegex(ValueError, 'masks'):
            scale_imag(image_record(mask=8), 78, {})
        with self.assertRaisesRegex(ValueError, 'boundary'):
            scale_imag(image_record() + bytes(4), 78, {})

    def test_indexed_transparency_and_reserved_shadow_pixels_survive(self):
        header = bytearray(26)
        struct.pack_into('<5H2h', header, 0, 3, 1, 4, 4, 32, -4, 6)
        struct.pack_into('<HI', header, 20, 0, 855)
        # One transparent pixel, then shadow/control index247 and color17 twice.
        raw = bytes(header) + struct.pack('<IHH', 4, 4, 0x8003) + bytes([247, 17, 17])
        result = scale_tile(raw, 50)
        self.assertEqual(struct.unpack_from('<3H', result), (3, 1, 2))
        self.assertEqual(struct.unpack_from('<2h', result, 10), (-2, 3))
        self.assertEqual(result[20:26], raw[20:26])  # Shared palette reference intact.
        # Shadows and visible colors must occupy different native RLE segments.
        self.assertEqual(result[30:], struct.pack('<HBB', 1, 1, 0) + bytes([247])
                         + struct.pack('<HBB', 2, 1, 0x80) + bytes([17]))
        with self.assertRaisesRegex(ValueError, '1..100'):
            scaled(10, 0)


if __name__ == '__main__':
    unittest.main()
