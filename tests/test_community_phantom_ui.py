import importlib.util
from pathlib import Path
import struct
import unittest

spec = importlib.util.spec_from_file_location('phantom_ui',
    Path(__file__).resolve().parents[1] / 'scripts/prepare-community-phantom-ui.py')
ui = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ui)


class PhantomIconTests(unittest.TestCase):
    def test_native_icon_bounds_palette_and_roundtrip(self):
        from PIL import Image, ImageDraw
        from lib.vampiric_revenge import decode_tile
        glyph = Image.new('RGBA', (64, 48))
        ImageDraw.Draw(glyph).line((0, 0, 63, 47), fill=(30, 180, 250, 255), width=8)
        header = struct.pack('<10HHI', 1, 24, 24, 24, 0, 0, 0, 0, 0, 0, 1, 602)
        for side in (24, 25):
            raw = ui.static_tile(glyph, header, side)
            self.assertEqual(len(raw), 1058 + side * side)
            self.assertLess(max(raw[26:26 + side * side]), 247)
            image = decode_tile(raw)
            self.assertEqual(image.size, (side, side))
            self.assertEqual(image.getchannel('A').getextrema(), (255, 255))
            self.assertEqual(image.getpixel((0, 0)), (0, 0, 0, 255))
            self.assertNotEqual(image.getpixel((side // 2, side // 2)), (0, 0, 0, 255))

    def test_empty_glyph_or_wrong_native_template_is_refused(self):
        from PIL import Image
        for image, header in [(Image.new('RGBA', (24, 24)), b'\x01\0' + b'\0' * 24),
                              (Image.new('RGBA', (24, 24), 'blue'), b'\x03\0' + b'\0' * 24)]:
            with self.assertRaises(ValueError):
                ui.static_tile(image, header, 24)
