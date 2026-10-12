"""Validate generated HUD geometry against the user's owned native layout."""
from pathlib import Path
import struct
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from hd_layouts import MODES, cam_entries, extended_layout, responsive_layout

SOURCE = ROOT / "upstream/majesty-recomp/original/gog/Data/UIData_1920_1080.dat"


@unittest.skipUnless(SOURCE.is_file(), "requires the owned Majesty layout")
class LayoutTests(unittest.TestCase):
    def setUp(self):
        self.source = SOURCE.read_bytes()
        self.entries = cam_entries(self.source)

    def test_world_and_edge_controls_use_the_selected_dimensions(self):
        for width, height in MODES:
            with self.subTest(mode=(width, height)):
                data = extended_layout(self.source, width, height)
                offset, _ = self.entries[(b"SMNU", b"APMK")]
                rect = lambda at: struct.unpack_from("<4i", data, offset + at + 4)
                self.assertEqual(rect(4), (-1, -1, width, height))
                self.assertEqual(rect(1828), (206, 29, width - 210, height - 63))
                # The original Options button stays at the bottom right;
                # its world hit target and visual frame move together.
                self.assertEqual(rect(3968), (width - 77, height - 24, 71, 21))
                self.assertEqual(rect(560), (width - 86, height - 35, 82, 35))
                self.assertEqual(rect(864), (4, 3, 176, 176))  # Minimap unchanged.

    def test_resources_and_widget_bindings_are_preserved(self):
        for width, height in MODES:
            data = extended_layout(self.source, width, height)
            self.assertEqual(cam_entries(data), self.entries)
            self.assertEqual(len(data), len(self.source))
            for key, (start, size) in self.entries.items():
                if key not in ((b"SMNU", b"APMK"), (b"SMNU", b"APdb")):
                    self.assertEqual(data[start:start + size], self.source[start:start + size])
            start, _ = self.entries[(b"SMNU", b"APMK")]
            # Verify the Options control's complete non-geometry properties.
            self.assertEqual(data[start + 3968 + 20:start + 4112 - 4],
                             self.source[start + 3968 + 20:start + 4112 - 4])
            self.assertEqual(data, extended_layout(self.source, width, height))

    def test_responsive_portrait_landscape_and_minimum_geometry(self):
        for width, height in ((800, 600), (839, 853), (800, 1420), (1280, 633),
                              (1280, 720), (1371, 779), (3440, 1440), (3840, 2160)):
            with self.subTest(viewport=(width, height)):
                data = responsive_layout(self.source, width, height)
                entries = cam_entries(data)
                start, size = entries[(b"SMNU", b"APMK")]
                rect = lambda at: struct.unpack_from("<4i", data, start + at + 4)
                self.assertEqual(rect(4), (-1, -1, width, height))
                self.assertEqual(rect(1828), (206, 29, width - 210, height - 63))
                self.assertEqual(rect(3968), (width - 77, height - 24, 71, 21))
                self.assertEqual(rect(864), (4, 3, 176, 176))
                self.assertEqual(size, 5408)
                self.assertEqual(set(entries), set(self.entries))
                for key, (at, length) in self.entries.items():
                    if key not in ((b"SMNU", b"APMK"), (b"SMNU", b"APdb")):
                        to, count = entries[key]
                        self.assertEqual(data[to:to+count], self.source[at:at+length])
                # UIData overlays do not override APMK's strings; the game
                # continues resolving that group from original textdata.cam.
                self.assertNotIn((b"STRT", b"APMK"), entries)
        for width, height in ((799, 600), (800, 599), (8193, 2160)):
            with self.assertRaises(ValueError):
                responsive_layout(self.source, width, height)

    def test_unverified_inputs_and_targets_are_rejected(self):
        bad = bytearray(self.source)
        bad[-1] ^= 1
        with self.assertRaisesRegex(ValueError, "verified input"):
            extended_layout(bytes(bad), 3840, 2160)
        with self.assertRaisesRegex(ValueError, "verified input"):
            responsive_layout(bytes(bad), 1280, 633)
        with self.assertRaisesRegex(ValueError, "targets"):
            extended_layout(self.source, 4096, 2160)

    def test_selection_actions_and_native_construction_binding_are_preserved(self):
        # Compare each native widget's non-geometry properties, not just a
        # reimplementation of the anchor formulas. In particular there is no
        # optional4000 widget that steals the original construction fallback.
        native_start, size = self.entries[(b"SMNU", b"APMK")]
        original = self.source[native_start:native_start+size]
        baseline = original[:5320] + original[5480:5564] + original[6944:6948]
        size = len(baseline)
        for width, height in ((800, 600), (1280, 633), (1280, 720), (1920, 1080), (3840, 2160)):
            data = responsive_layout(self.source, width, height)
            start, count = cam_entries(data)[(b"SMNU", b"APMK")]
            main = bytearray(data[start:start+count])
            rect = lambda at: struct.unpack_from("<4i", main, at + 4)
            sx, sy, sw, sh = rect(1468)
            words = struct.unpack_from(f"<{size // 4}i", baseline)
            for i in range(1, len(words) - 6):
                if words[i] != 2 or (i != 1 and words[i - 2] != -1):
                    continue
                at = i * 4
                if at not in (4, 1468):
                    x, y, w, h = rect(at)
                    self.assertFalse(x < sx+sw and x+w > sx and y < sy+sh and y+h > sy,
                                     f"widget {at} covers selection at {width}x{height}")
                main[at+4:at+20] = baseline[at+4:at+20]
            main[3716:3720] = baseline[3716:3720]
            self.assertEqual(bytes(main), baseline)
            self.assertEqual(rect(4744), (55, 824, 23, 17))



if __name__ == "__main__":
    unittest.main()
