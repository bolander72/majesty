import importlib.util
from pathlib import Path
import struct
import unittest

spec = importlib.util.spec_from_file_location('loading_art', Path(__file__).resolve().parents[1] / 'scripts/extract-loading-art.py')
art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)


class LoadingRaster(unittest.TestCase):
    def test_original_offset_and_bottom_up_rows_preserve_both_edges(self):
        header = struct.pack('<4IHH', 1, 131072, 0, 0, 2, 2)
        # Bottom: blue/white. Top: red/green. Extra storage is not raster data.
        record = header + struct.pack('<4H', 31, 32767, 31744, 992) + b'x' * 28
        self.assertEqual(art.decode_pixels(record), (2, 2, bytes([
            255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255])))

    def test_incomplete_raster_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Truncated'):
            art.decode_pixels(struct.pack('<4IHH', 1, 131072, 0, 0, 800, 600))
