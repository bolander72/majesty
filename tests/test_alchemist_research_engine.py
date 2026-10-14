import hashlib
import importlib.util
from pathlib import Path
import struct
import tomllib
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('research_engine', ROOT / 'scripts/prepare-alchemist-research-engine.py')
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)


class ResearchEngineTests(unittest.TestCase):
    def setUp(self):
        # Synthetic PE sections exercise the address/pin guard without carrying
        # game assets in the test corpus. Actual native bindings are qualified
        # separately against the pinned executable.
        self.image = bytearray(0x3200)
        struct.pack_into('<I', self.image, 0x3C, 0x80)
        self.image[0x80:0x84] = b'PE\0\0'
        struct.pack_into('<H', self.image, 0x86, 3)
        struct.pack_into('<H', self.image, 0x94, 0xE0)
        struct.pack_into('<I', self.image, 0x98 + 28, 0x400000)
        for n, rva in enumerate((0x74C00, 0xABF00, 0x2C2000)):
            struct.pack_into('<IIII', self.image, 0x178 + n * 40 + 8,
                             0x1000, rva, 0x1000, 0x200 + n * 0x1000)
        self.image[0x210:0x213] = b'\x83\xec\x14'
        self.image[0x1270:0x1276] = b'\x64\xa1\0\0\0\0'
        struct.pack_into('<III', self.image, 0x2228, 0x2009, 0x4ABF70, 0x200B)
        self.pin = hashlib.sha256(self.image).hexdigest()
        self.config = f'''[game]
sha256 = "{self.pin}"
[translate]
entry_points = [0x401000]
instruction_patches = [{{ at = 0x401000, text = "NOP" }}]
overrides = "original.h"
native = {{ header = "original.h", sources = ["original.cpp"] }}
'''

    def test_only_verified_entries_change_and_repeat_is_idempotent(self):
        with patch.object(engine, 'PIN', self.pin):
            result = engine.curate(self.config, self.image)
            self.assertEqual(engine.curate(result, self.image), result)
        before, after = tomllib.loads(self.config), tomllib.loads(result)
        self.assertEqual(after['translate']['entry_points'], [0x401000, *engine.ENTRIES])
        after['translate']['entry_points'] = before['translate']['entry_points']
        self.assertEqual(after, before)

    def test_mismatched_executable_is_refused(self):
        with patch.object(engine, 'PIN', self.pin):
            self.image[-1] ^= 1
            with self.assertRaisesRegex(ValueError, 'executable differs'):
                engine.curate(self.config, self.image)

    def test_unknown_dispatch_is_refused_even_with_matching_pin(self):
        self.image[0x2228] ^= 1
        changed_pin = hashlib.sha256(self.image).hexdigest()
        with patch.object(engine, 'PIN', changed_pin):
            with self.assertRaisesRegex(ValueError, 'dispatch differs'):
                engine.curate(self.config.replace(self.pin, changed_pin), self.image)

    def test_config_pin_is_checked_independently(self):
        with patch.object(engine, 'PIN', self.pin):
            with self.assertRaisesRegex(ValueError, 'different executable'):
                engine.curate(self.config.replace(self.pin, '0' * 64), self.image)


if __name__ == '__main__':
    unittest.main()
