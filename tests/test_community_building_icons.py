import struct
import sys
from pathlib import Path
import unittest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from lib.community_building_icons import frame_emblem, pack_emblem
from lib.vampiric_revenge import decode_tile


class CommunityBuildingIcons(unittest.TestCase):
    def test_native_rim_replaces_custom_border_without_resizing_authentic_inset(self):
        header = bytearray(26)
        struct.pack_into('<4H', header, 0, 1, 25, 25, 25)
        palette = bytearray(1032)
        palette[12:16] = bytes([235, 180, 40, 0])
        tile = bytes(header) + bytes([1] * 625)
        source = Image.new('RGBA', (25, 25), (0, 255, 255, 255))
        for y in range(2, 23):
            for x in range(2, 23):
                source.putpixel((x, y), (x * 9, y * 9, 30, 255))
        original = source.tobytes()
        framed = frame_emblem(source, tile, bytes(palette))
        self.assertEqual(source.tobytes(), original)
        for y in range(25):
            for x in range(25):
                if x < 2 or y < 2 or x >= 23 or y >= 23:
                    self.assertEqual(framed.getpixel((x, y)), (235, 180, 40, 255))
                else:
                    self.assertEqual(framed.getpixel((x, y)), source.getpixel((x, y)))

    def test_world_sprites_cannot_be_used_as_building_list_emblems(self):
        with self.assertRaisesRegex(ValueError, '25-by-25'):
            frame_emblem(Image.new('RGBA', (160, 120)), b'', b'')

    def test_packing_keeps_native_rim_exact_and_avoids_engine_control_colors(self):
        for rich in [False, True]:
            source = Image.new('RGBA', (25, 25), (235, 180, 40, 255))
            for y in range(2, 23):
                for x in range(2, 23):
                    source.putpixel((x, y), (x * 9 if rich else 20,
                                            y * 9 if rich else 30, 60, 255))
            raw = pack_emblem(source, bytes(26))
            self.assertEqual(len(raw), 26 + 625 + 1032)
            self.assertLess(max(raw[26:651]), 247)
            restored = decode_tile(raw)
            self.assertEqual(restored.size, (25, 25))
            for y in range(25):
                for x in range(25):
                    self.assertEqual(restored.getpixel((x, y))[3], 255)
                    if x < 2 or y < 2 or x >= 23 or y >= 23:
                        self.assertEqual(restored.getpixel((x, y)), source.getpixel((x, y)))


if __name__ == '__main__':
    unittest.main()
