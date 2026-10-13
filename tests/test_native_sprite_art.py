import struct
import unittest
from scripts.lib.native_sprite_art import encode_cam, animation_sets, replace_animation_tiles


class NativeSpriteResources(unittest.TestCase):
    def test_indexed_tile_sections_keep_positional_identity(self):
        data = encode_cam([(b'IMAG', [(b'AVz1Wayfinder', b'imag')]),
                           (b'TILE', [(struct.pack('<I', 0), b'empty'),
                                      (struct.pack('<I', 1), b'new sprite')])])
        count, directory_size = struct.unpack_from('<II', data, 12)
        self.assertEqual(count, 2)
        _, imag_directory = struct.unpack_from('<4sI', data, 20)
        _, tile_directory = struct.unpack_from('<4sI', data, 28)
        self.assertEqual(struct.unpack_from('<II', data, imag_directory), (1, 0))
        self.assertEqual(struct.unpack_from('<II', data, tile_directory), (2, 1))
        for i, expected in enumerate([b'empty', b'new sprite']):
            label, off, size = struct.unpack_from('<20sII', data, tile_directory + 8 + i * 28)
            self.assertEqual(struct.unpack_from('<I', label)[0], i)
            self.assertGreaterEqual(off, 36 + directory_size)
            self.assertEqual(data[off:off + size], expected)

    def test_invalid_animation_directory_is_refused_before_rebinding(self):
        with self.assertRaisesRegex(ValueError, 'Truncated'):
            animation_sets(b'bad')
        malformed = bytearray(32)
        struct.pack_into('<III', malformed, 20, 1, 8, 999)
        with self.assertRaisesRegex(ValueError, 'bounds'):
            replace_animation_tiles(malformed, lambda *args: 1)

    def test_rebinding_removes_secondary_cast_art_and_preserves_native_flags(self):
        raw = bytearray(120)
        struct.pack_into('<III', raw, 20, 1, 128, 32)
        struct.pack_into('<I', raw, 32, 1)
        struct.pack_into('<I', raw, 96, 68)
        struct.pack_into('<I', raw, 104, 65538) # one frame, two streams
        raw.extend(struct.pack('<4I', 123, 0x12000042, 456, 0x34000099))
        updated, changed = replace_animation_tiles(raw, lambda sid, d, f, stream, total: 0 if stream else 5)
        self.assertEqual(changed, 2)
        self.assertEqual(struct.unpack_from('<4I', updated, 120), (123, 0x12000005, 456, 0x34000000))
